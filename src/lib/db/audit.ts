import { json, query } from "@/lib/db/client";

/** Registra una acción del admin. `detalle` nunca debe contener secretos. */
export async function registrarAuditoria(accion: string, companySlug: string | null, detalle?: Record<string, unknown>): Promise<void> {
  try {
    await query("insert into admin_audit_log (accion, company_slug, detalle) values ($1, $2, $3::jsonb)", [accion, companySlug, json(detalle)]);
  } catch (error) {
    console.error("No se pudo registrar la auditoría:", error instanceof Error ? error.message : error);
  }
}
