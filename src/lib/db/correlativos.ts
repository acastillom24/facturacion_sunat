import { supabaseAdmin } from "@/lib/supabase/admin";
import type { TipoDoc } from "@/lib/sunat/types";

/** Reserva y devuelve el siguiente correlativo para (empresa, tipoDoc, serie). */
export async function siguienteCorrelativo(
  companyId: string,
  tipoDoc: TipoDoc,
  serie: string,
): Promise<number> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("correlativos")
    .select("id, ultimo_correlativo")
    .eq("company_id", companyId)
    .eq("tipo_doc", tipoDoc)
    .eq("serie", serie)
    .maybeSingle();
  if (error) throw error;

  if (!data) {
    const { error: insErr } = await db
      .from("correlativos")
      .insert({ company_id: companyId, tipo_doc: tipoDoc, serie, ultimo_correlativo: 1 });
    if (insErr) throw insErr;
    return 1;
  }

  const siguiente = data.ultimo_correlativo + 1;
  const { error: updErr } = await db
    .from("correlativos")
    .update({ ultimo_correlativo: siguiente })
    .eq("id", data.id);
  if (updErr) throw updErr;
  return siguiente;
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

/** Reserva y devuelve el siguiente correlativo de resumen diario / comunicación de baja para hoy. */
export async function siguienteCorrelativoResumen(companyId: string, fecha: string): Promise<number> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("resumen_correlativos")
    .select("id, ultimo_correlativo")
    .eq("company_id", companyId)
    .eq("fecha", fecha)
    .maybeSingle();
  if (error) throw error;

  if (!data) {
    const { error: insErr } = await db
      .from("resumen_correlativos")
      .insert({ company_id: companyId, fecha, ultimo_correlativo: 1 });
    if (insErr) throw insErr;
    return 1;
  }

  const siguiente = data.ultimo_correlativo + 1;
  const { error: updErr } = await db
    .from("resumen_correlativos")
    .update({ ultimo_correlativo: siguiente })
    .eq("id", data.id);
  if (updErr) throw updErr;
  return siguiente;
}
