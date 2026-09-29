import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ClienteSunat, ComprobantePayload, ItemInput, SunatCdrResponse, TipoDoc } from "@/lib/sunat/types";

export type EstadoComprobante =
  | "pendiente"
  | "emitido"
  | "rechazado"
  | "error"
  | "cancelado"
  | "anulando"
  | "anulado"
  | "error_anulacion";

export interface Anulacion {
  correlativoResumen?: string;
  ticket?: string;
  motivo?: string;
  estado: "enviado" | "aceptado" | "rechazado";
  resultado?: SunatCdrResponse;
  fecResumen: string;
}

export interface Comprobante {
  id: string;
  company_id: string;
  tipo_doc: TipoDoc;
  serie: string;
  correlativo: number;
  moneda: string;
  forma_pago: string;
  cliente: ClienteSunat;
  items: ItemInput[];
  mto_oper_gravadas: number;
  mto_igv: number;
  mto_imp_venta: number;
  payload: ComprobantePayload;
  estado: EstadoComprobante;
  sunat_response: SunatCdrResponse | null;
  hash: string | null;
  fecha_emision: string;
  intentos: number;
  proximo_intento_at: string | null;
  anulacion: Anulacion | null;
  created_at: string;
  updated_at: string;
}

/** Lo mínimo que necesita `intentarEmitir()` para intentar emitir/reintentar un comprobante. */
export interface ComprobanteReintentable {
  id: string;
  payload: ComprobantePayload;
  intentos: number;
}

export async function crearComprobantePendiente(input: {
  companyId: string;
  tipoDoc: TipoDoc;
  serie: string;
  correlativo: number;
  moneda: string;
  formaPago: string;
  cliente: ClienteSunat;
  items: ItemInput[];
  payload: ComprobantePayload;
}): Promise<ComprobanteReintentable> {
  // Solo pedimos "id" de vuelta: el resto de los datos (payload, intentos=0)
  // ya los tenemos en memoria, no hace falta que Supabase nos los reenvíe.
  const { data, error } = await supabaseAdmin()
    .from("comprobantes")
    .insert({
      company_id: input.companyId,
      tipo_doc: input.tipoDoc,
      serie: input.serie,
      correlativo: input.correlativo,
      moneda: input.moneda,
      forma_pago: input.formaPago,
      cliente: input.cliente,
      items: input.items,
      mto_oper_gravadas: input.payload.mtoOperGravadas,
      mto_igv: input.payload.mtoIGV,
      mto_imp_venta: input.payload.mtoImpVenta,
      payload: input.payload,
      estado: "pendiente",
      fecha_emision: input.payload.fechaEmision,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id as string, payload: input.payload, intentos: 0 };
}

export interface FiltrosComprobantes {
  /** "YYYY-MM-DD" en hora de Lima; vacío/undefined = sin filtro de fecha. */
  fecha?: string;
  /** Número de comprobante (correlativo), o "serie-correlativo"; vacío/undefined = sin filtro. */
  numero?: string;
}

/** Columnas que realmente pinta la tabla del historial (evita traer payload/items/sunat_response). */
export interface ComprobanteResumen {
  id: string;
  tipo_doc: TipoDoc;
  serie: string;
  correlativo: number;
  cliente: ClienteSunat;
  moneda: string;
  mto_imp_venta: number;
  estado: EstadoComprobante;
  created_at: string;
}

const COLUMNAS_RESUMEN = "id, tipo_doc, serie, correlativo, cliente, moneda, mto_imp_venta, estado, created_at";

export async function listarComprobantes(
  companyId: string,
  filtros: FiltrosComprobantes = {},
  limit = 200,
): Promise<ComprobanteResumen[]> {
  let query = supabaseAdmin().from("comprobantes").select(COLUMNAS_RESUMEN).eq("company_id", companyId);

  if (filtros.fecha) {
    const inicio = `${filtros.fecha}T00:00:00-05:00`;
    const fin = new Date(new Date(inicio).getTime() + 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("fecha_emision", inicio).lt("fecha_emision", fin);
  }

  const numero = filtros.numero?.trim();
  if (numero) {
    // Acepta "25", "B001-25" o "B001-000025": se compara el correlativo como número.
    const soloDigitos = numero.match(/(\d+)\s*$/)?.[1];
    if (soloDigitos) query = query.eq("correlativo", Number(soloDigitos));
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ComprobanteResumen[];
}

export async function obtenerComprobante(companyId: string, id: string): Promise<Comprobante | null> {
  const { data, error } = await supabaseAdmin()
    .from("comprobantes")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Comprobante | null;
}

export async function marcarEmitido(id: string, sunatResponse: SunatCdrResponse, hash?: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("comprobantes")
    .update({
      estado: "emitido",
      sunat_response: sunatResponse,
      hash: hash ?? null,
      proximo_intento_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function marcarRechazado(id: string, sunatResponse: SunatCdrResponse): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("comprobantes")
    .update({
      estado: "rechazado",
      sunat_response: sunatResponse,
      proximo_intento_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

/** Falla transitoria: reintentar en 1 hora. */
export async function marcarErrorConReintento(
  id: string,
  sunatResponse: SunatCdrResponse | null,
  intentosActuales: number,
): Promise<void> {
  const proximoIntento = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const { error } = await supabaseAdmin()
    .from("comprobantes")
    .update({
      estado: "pendiente",
      sunat_response: sunatResponse,
      intentos: intentosActuales + 1,
      proximo_intento_at: proximoIntento,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function marcarErrorDefinitivo(id: string, sunatResponse: SunatCdrResponse | null): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("comprobantes")
    .update({
      estado: "error",
      sunat_response: sunatResponse,
      proximo_intento_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

/** El usuario decide no seguir reintentando (ej. la serie/correlativo quedó mal). Detiene el cron para este comprobante. */
export async function marcarCancelado(id: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("comprobantes")
    .update({
      estado: "cancelado",
      proximo_intento_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function marcarAnulando(id: string, anulacion: Anulacion): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("comprobantes")
    .update({ estado: "anulando", anulacion, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function marcarAnulado(id: string, anulacion: Anulacion): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("comprobantes")
    .update({ estado: "anulado", anulacion, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function marcarErrorAnulacion(id: string, anulacion: Anulacion): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("comprobantes")
    .update({ estado: "error_anulacion", anulacion, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export interface PendienteReintento extends ComprobanteReintentable {
  company_id: string;
}

/**
 * Comprobantes pendientes cuyo próximo intento ya venció (usado por el cron).
 * Solo trae las columnas que `intentarEmitir()` usa; se omiten cliente, items,
 * sunat_response, anulacion, etc., que no hacen falta para reintentar.
 */
export async function listarPendientesParaReintento(limit = 25): Promise<PendienteReintento[]> {
  const { data, error } = await supabaseAdmin()
    .from("comprobantes")
    .select("id, company_id, payload, intentos")
    .eq("estado", "pendiente")
    .not("proximo_intento_at", "is", null)
    .lte("proximo_intento_at", new Date().toISOString())
    .order("proximo_intento_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as PendienteReintento[];
}
