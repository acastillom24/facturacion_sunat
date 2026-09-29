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
}): Promise<Comprobante> {
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
    .select("*")
    .single();
  if (error) throw error;
  return data as Comprobante;
}

export async function listarComprobantes(companyId: string, limit = 100): Promise<Comprobante[]> {
  const { data, error } = await supabaseAdmin()
    .from("comprobantes")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Comprobante[];
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

/** Comprobantes pendientes cuyo próximo intento ya venció (usado por el cron). */
export async function listarPendientesParaReintento(limit = 25): Promise<Comprobante[]> {
  const { data, error } = await supabaseAdmin()
    .from("comprobantes")
    .select("*")
    .eq("estado", "pendiente")
    .not("proximo_intento_at", "is", null)
    .lte("proximo_intento_at", new Date().toISOString())
    .order("proximo_intento_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Comprobante[];
}
