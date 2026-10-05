export interface ProgresoLote {
  fase: "procesando" | "reintentando";
  hechos: number;
  total: number;
  /** Ronda de reintentos (1..max), solo en fase "reintentando". */
  ronda?: number;
}

/**
 * Procesa los ítems de a uno (cada uno es una llamada corta al servidor, así no se
 * topa con el límite de tiempo de la función). Los que quedan como "reintentables"
 * se vuelven a intentar al final, hasta `maxReintentos` rondas; los que sigan
 * fallando pasan por `agotado` para quedar como error definitivo.
 */
export async function procesarLote<I, R>(opts: {
  items: I[];
  procesar: (item: I) => Promise<R>;
  deError: (item: I, mensaje: string) => R;
  reintentable: (r: R) => boolean;
  reintentar: (item: I, previo: R) => Promise<R>;
  agotado: (r: R) => R;
  onProgreso: (p: ProgresoLote) => void;
  maxReintentos?: number;
  /** Se consulta entre ítems; si devuelve true se deja de procesar (el ítem en curso termina). */
  cancelado?: () => boolean;
}): Promise<{ resultados: R[]; sinProcesar: number }> {
  const { items, procesar, deError, reintentable, reintentar, agotado, onProgreso, maxReintentos = 3, cancelado = () => false } = opts;
  const resultados: R[] = [];

  for (let i = 0; i < items.length; i++) {
    if (cancelado()) break;
    try {
      resultados.push(await procesar(items[i]));
    } catch (err) {
      resultados.push(deError(items[i], err instanceof Error ? err.message : String(err)));
    }
    onProgreso({ fase: "procesando", hechos: i + 1, total: items.length });
  }

  for (let ronda = 1; ronda <= maxReintentos && !cancelado(); ronda++) {
    const pendientes = resultados.flatMap((r, i) => (reintentable(r) ? [i] : []));
    if (pendientes.length === 0) break;
    onProgreso({ fase: "reintentando", hechos: 0, total: pendientes.length, ronda });
    for (let k = 0; k < pendientes.length; k++) {
      if (cancelado()) break;
      const i = pendientes[k];
      try {
        resultados[i] = await reintentar(items[i], resultados[i]);
      } catch {
        // se conserva el resultado previo y se intenta en la próxima ronda
      }
      onProgreso({ fase: "reintentando", hechos: k + 1, total: pendientes.length, ronda });
    }
  }

  const sinProcesar = items.length - resultados.length;
  // Si se canceló, los reintentables quedan como están (no se agotaron los reintentos).
  return { resultados: cancelado() ? resultados : resultados.map((r) => (reintentable(r) ? agotado(r) : r)), sinProcesar };
}
