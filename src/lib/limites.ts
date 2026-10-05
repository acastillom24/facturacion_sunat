/** Máximo de comprobantes por lote (carga masiva, anulación). Se procesan de a uno, así que solo acota el tamaño de la corrida. */
export const MAX_COMPROBANTES_POR_LOTE = 500;

/** Mensaje de error cuando un lote supera el máximo; `que` completa "…: {que}" (ej. "seleccionaste 600 comprobantes"). */
export function mensajeExcedeLimite(cantidad: number, max: number, que: string): string {
  const partes = Math.ceil(cantidad / max);
  return `No se procesó ningún comprobante: ${que} y el límite es ${max} por vez (sobran ${cantidad - max}). Divídelos en ${partes} partes de hasta ${max}.`;
}
