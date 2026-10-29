import { json, query, queryOne } from "@/lib/db/client";
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
  sunat_provider: "apisperu" | "propia" | null;
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
  // Solo pedimos "id" de vuelta: el resto de los datos (payload, intentos=0) ya los tenemos en memoria.
  const [fila] = await query<{ id: string }>(
    `insert into comprobantes
       (company_id, tipo_doc, serie, correlativo, moneda, forma_pago, cliente, items,
        mto_oper_gravadas, mto_igv, mto_imp_venta, payload, estado, fecha_emision)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, $12::jsonb, 'pendiente', $13)
     returning id`,
    [
      input.companyId,
      input.tipoDoc,
      input.serie,
      input.correlativo,
      input.moneda,
      input.formaPago,
      json(input.cliente),
      json(input.items),
      input.payload.mtoOperGravadas,
      input.payload.mtoIGV,
      input.payload.mtoImpVenta,
      json(input.payload),
      input.payload.fechaEmision,
    ],
  );
  return { id: fila.id, payload: input.payload, intentos: 0 };
}

export interface FiltrosComprobantes {
  /** Rango "YYYY-MM-DD" (inclusive) en hora de Lima; vacío/undefined = sin límite por ese lado. */
  desde?: string;
  hasta?: string;
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
  const params: unknown[] = [companyId];
  let sql = `select ${COLUMNAS_RESUMEN} from comprobantes where company_id = $1`;

  if (filtros.desde) {
    params.push(`${filtros.desde}T00:00:00-05:00`);
    sql += ` and fecha_emision >= $${params.length}`;
  }
  if (filtros.hasta) {
    const finDia = new Date(new Date(`${filtros.hasta}T00:00:00-05:00`).getTime() + 24 * 60 * 60 * 1000);
    params.push(finDia.toISOString());
    sql += ` and fecha_emision < $${params.length}`;
  }

  const numero = filtros.numero?.trim();
  if (numero) {
    // Acepta "25", "B001-25" o "B001-000025": se compara el correlativo como número.
    const soloDigitos = numero.match(/(\d+)\s*$/)?.[1];
    if (soloDigitos) {
      params.push(Number(soloDigitos));
      sql += ` and correlativo = $${params.length}`;
    }
  }

  params.push(limit);
  return query<ComprobanteResumen>(`${sql} order by created_at desc limit $${params.length}`, params);
}

export async function obtenerComprobante(companyId: string, id: string): Promise<Comprobante | null> {
  return queryOne<Comprobante>("select * from comprobantes where company_id = $1 and id = $2", [companyId, id]);
}

export async function buscarComprobantePorNumero(
  companyId: string,
  serie: string,
  correlativo: number,
): Promise<Comprobante | null> {
  return queryOne<Comprobante>(
    "select * from comprobantes where company_id = $1 and serie = $2 and correlativo = $3 limit 1",
    [companyId, serie, correlativo],
  );
}

/** Reemplaza los datos a enviar de un comprobante aún no emitido (corrección manual antes de reintentar). */
export async function actualizarDatosComprobante(
  id: string,
  datos: { cliente: ClienteSunat; items: ItemInput[]; payload: ComprobantePayload },
): Promise<void> {
  const { cliente, items, payload } = datos;
  await query(
    `update comprobantes set cliente = $2::jsonb, items = $3::jsonb, payload = $4::jsonb,
       mto_oper_gravadas = $5, mto_igv = $6, mto_imp_venta = $7, updated_at = now()
     where id = $1`,
    [id, json(cliente), json(items), json(payload), payload.mtoOperGravadas, payload.mtoIGV, payload.mtoImpVenta],
  );
}

export async function marcarEmitido(
  id: string,
  sunatResponse: SunatCdrResponse,
  hash?: string,
  proveedor?: "apisperu" | "propia",
): Promise<void> {
  await query(
    `update comprobantes set estado = 'emitido', sunat_response = $2::jsonb, hash = $3,
       sunat_provider = coalesce($4, sunat_provider), proximo_intento_at = null, updated_at = now()
     where id = $1`,
    [id, json(sunatResponse), hash ?? null, proveedor ?? null],
  );
}

export async function marcarRechazado(id: string, sunatResponse: SunatCdrResponse): Promise<void> {
  await query(
    "update comprobantes set estado = 'rechazado', sunat_response = $2::jsonb, proximo_intento_at = null, updated_at = now() where id = $1",
    [id, json(sunatResponse)],
  );
}

/** Falla transitoria: reintentar en 1 hora. */
export async function marcarErrorConReintento(
  id: string,
  sunatResponse: SunatCdrResponse | null,
  intentosActuales: number,
): Promise<void> {
  const proximoIntento = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await query(
    `update comprobantes set estado = 'pendiente', sunat_response = $2::jsonb, intentos = $3,
       proximo_intento_at = $4, updated_at = now()
     where id = $1`,
    [id, json(sunatResponse), intentosActuales + 1, proximoIntento],
  );
}

export async function marcarErrorDefinitivo(id: string, sunatResponse: SunatCdrResponse | null): Promise<void> {
  await query(
    "update comprobantes set estado = 'error', sunat_response = $2::jsonb, proximo_intento_at = null, updated_at = now() where id = $1",
    [id, json(sunatResponse)],
  );
}

/** El usuario decide no seguir reintentando (ej. la serie/correlativo quedó mal). Detiene el cron para este comprobante. */
export async function marcarCancelado(id: string): Promise<void> {
  await query("update comprobantes set estado = 'cancelado', proximo_intento_at = null, updated_at = now() where id = $1", [id]);
}

async function actualizarAnulacion(id: string, estado: EstadoComprobante, anulacion: Anulacion): Promise<void> {
  await query("update comprobantes set estado = $2, anulacion = $3::jsonb, updated_at = now() where id = $1", [id, estado, json(anulacion)]);
}

export const marcarAnulando = (id: string, anulacion: Anulacion) => actualizarAnulacion(id, "anulando", anulacion);
export const marcarAnulado = (id: string, anulacion: Anulacion) => actualizarAnulacion(id, "anulado", anulacion);
export const marcarErrorAnulacion = (id: string, anulacion: Anulacion) => actualizarAnulacion(id, "error_anulacion", anulacion);

export interface PendienteReintento extends ComprobanteReintentable {
  company_id: string;
}

/**
 * Comprobantes pendientes cuyo próximo intento ya venció (usado por el cron).
 * Solo trae las columnas que `intentarEmitir()` usa; se omiten cliente, items,
 * sunat_response, anulacion, etc., que no hacen falta para reintentar.
 */
export async function listarPendientesParaReintento(limit = 25): Promise<PendienteReintento[]> {
  return query<PendienteReintento>(
    `select id, company_id, payload, intentos from comprobantes
     where estado = 'pendiente' and proximo_intento_at is not null and proximo_intento_at <= now()
     order by proximo_intento_at asc limit $1`,
    [limit],
  );
}

/**
 * Comprobantes que quedaron en "anulando" porque la función murió a mitad de la anulación
 * (corte de Vercel, etc.): pasan a "error_anulacion" para que se puedan reintentar.
 * Una anulación normal dura segundos (la llamada a la API tiene timeout de 20 s), así que
 * pasados `minutos` sin actualizarse se considera atascada.
 */
export async function recuperarAnulacionesAtascadas(minutos = 2, companyId?: string): Promise<number> {
  const limite = new Date(Date.now() - minutos * 60 * 1000).toISOString();
  const filas = await query<{ id: string; anulacion: Anulacion | null }>(
    `select id, anulacion from comprobantes
     where estado = 'anulando' and updated_at < $1 and ($2::uuid is null or company_id = $2::uuid)`,
    [limite, companyId ?? null],
  );

  for (const fila of filas) {
    await marcarErrorAnulacion(fila.id, {
      ...(fila.anulacion ?? { fecResumen: new Date().toISOString() }),
      estado: "rechazado",
      resultado: { error: { message: `La anulación quedó sin respuesta por más de ${minutos} minutos` } },
    });
  }
  return filas.length;
}
