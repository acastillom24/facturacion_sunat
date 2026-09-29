import { supabaseAdmin } from "@/lib/supabase/admin";
import type { TipoDoc } from "@/lib/sunat/types";

/**
 * Reserva y devuelve el siguiente correlativo para (empresa, tipoDoc, serie)
 * en una sola llamada atómica (función `siguiente_correlativo` en Postgres,
 * ver supabase/migrations/0002_correlativos_rpc.sql).
 */
export async function siguienteCorrelativo(
  companyId: string,
  tipoDoc: TipoDoc,
  serie: string,
): Promise<number> {
  const { data, error } = await supabaseAdmin().rpc("siguiente_correlativo", {
    p_company_id: companyId,
    p_tipo_doc: tipoDoc,
    p_serie: serie,
  });
  if (error) throw error;
  return data as number;
}

/** Solo lectura: qué correlativo tocaría a continuación, sin reservarlo. Para mostrarlo en la UI. */
export async function previsualizarCorrelativo(
  companyId: string,
  tipoDoc: TipoDoc,
  serie: string,
): Promise<number> {
  const { data, error } = await supabaseAdmin()
    .from("correlativos")
    .select("ultimo_correlativo")
    .eq("company_id", companyId)
    .eq("tipo_doc", tipoDoc)
    .eq("serie", serie)
    .maybeSingle();
  if (error) throw error;
  return (data?.ultimo_correlativo ?? 0) + 1;
}

/**
 * Reserva y devuelve el siguiente correlativo de resumen diario / comunicación
 * de baja para una fecha, en una sola llamada atómica (función
 * `siguiente_correlativo_resumen` en Postgres).
 */
export async function siguienteCorrelativoResumen(companyId: string, fecha: string): Promise<number> {
  const { data, error } = await supabaseAdmin().rpc("siguiente_correlativo_resumen", {
    p_company_id: companyId,
    p_fecha: fecha,
  });
  if (error) throw error;
  return data as number;
}
