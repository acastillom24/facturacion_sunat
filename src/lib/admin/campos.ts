/** Lectura de campos de los formularios del panel admin (keys y planes). */

export const texto = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Vacío = sin tope (null). */
export function limite(fd: FormData, k: string): number | null | "invalido" {
  const v = texto(fd, k);
  if (!v) return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : "invalido";
}

/** Vacío = no vence. La fecha se interpreta como fin de ese día en Lima (UTC-5). */
export function vencimiento(fd: FormData, k = "expiresAt"): string | null | "invalido" {
  const v = texto(fd, k);
  if (!v) return null;
  const d = new Date(`${v}T23:59:59-05:00`);
  return Number.isNaN(d.getTime()) ? "invalido" : d.toISOString();
}

export const mensajeError = (e: unknown) => (e instanceof Error ? e.message : String(e));
