import { supabaseAdmin } from "@/lib/supabase/admin";

/** Registra una acción del admin. `detalle` nunca debe contener secretos. */
export async function registrarAuditoria(accion: string, companySlug: string | null, detalle?: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin().from("admin_audit_log").insert({ accion, company_slug: companySlug, detalle: detalle ?? null });
  if (error) console.error("No se pudo registrar la auditoría:", error.message);
}
