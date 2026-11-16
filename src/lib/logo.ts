/** Límite de la API propia para el campo logo (bytes del archivo). */
export const MAX_LOGO_BYTES = 300_000;
export const MAX_LOGO_TEXTO = "300 KB";

/** Valida el archivo en el navegador, antes de subirlo. Devuelve el mensaje de error o null. */
export function errorLogo(archivo: File | undefined | null): string | null {
  if (!archivo) return null;
  if (archivo.type !== "image/png" && archivo.type !== "image/jpeg") return "El logo debe ser PNG o JPG.";
  if (archivo.size > MAX_LOGO_BYTES)
    return `El logo pesa ${Math.round(archivo.size / 1000)} KB y el máximo es ${MAX_LOGO_TEXTO}. Elige una imagen más liviana.`;
  return null;
}
