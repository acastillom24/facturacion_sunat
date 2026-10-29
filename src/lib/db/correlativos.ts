import { query, queryOne } from "@/lib/db/client";
import type { TipoDoc } from "@/lib/sunat/types";

/**
 * Reserva y devuelve el siguiente correlativo para (empresa, tipoDoc, serie)
 * en una sola llamada atómica (función `siguiente_correlativo` en Postgres,
 * ver db/migrations/0002_correlativos_rpc.sql).
 */
export async function siguienteCorrelativo(
  companyId: string,
  tipoDoc: TipoDoc,
  serie: string,
): Promise<number> {
  const [fila] = await query<{ n: number }>("select siguiente_correlativo($1, $2, $3) as n", [companyId, tipoDoc, serie]);
  return fila.n;
}

/** Solo lectura: qué correlativo tocaría a continuación, sin reservarlo. Para mostrarlo en la UI. */
export async function previsualizarCorrelativo(
  companyId: string,
  tipoDoc: TipoDoc,
  serie: string,
): Promise<number> {
  const fila = await queryOne<{ ultimo_correlativo: number }>(
    "select ultimo_correlativo from correlativos where company_id = $1 and tipo_doc = $2 and serie = $3",
    [companyId, tipoDoc, serie],
  );
  return (fila?.ultimo_correlativo ?? 0) + 1;
}

/**
 * Reserva y devuelve el siguiente correlativo de resumen diario / comunicación
 * de baja para una fecha, en una sola llamada atómica (función
 * `siguiente_correlativo_resumen` en Postgres).
 */
export async function siguienteCorrelativoResumen(companyId: string, fecha: string): Promise<number> {
  const [fila] = await query<{ n: number }>("select siguiente_correlativo_resumen($1, $2::date) as n", [companyId, fecha]);
  return fila.n;
}
