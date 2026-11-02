/** Días enteros desde `ahora` hasta la fecha dada (negativo si ya pasó). */
export function diasHasta(fechaISO: string, ahora = new Date()): number {
  return Math.floor((new Date(fechaISO).getTime() - ahora.getTime()) / 86_400_000);
}
