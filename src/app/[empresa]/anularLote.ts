import { procesarLote, type ProgresoLote } from "@/lib/lote";
import { anularUnoAction, type ResultadoAnulacionMasiva } from "./actions";

export type RefAnulacion = { id?: string; codigo?: string };

/** Anula de a uno mostrando progreso; los que fallan por SUNAT/API se reintentan al final (hasta 3 rondas). */
export function anularLote(
  slug: string,
  refs: RefAnulacion[],
  motivo: string,
  onProgreso: (p: ProgresoLote) => void,
  cancelado: () => boolean,
) {
  return procesarLote<RefAnulacion, ResultadoAnulacionMasiva>({
    items: refs,
    procesar: (ref) => anularUnoAction(slug, ref, motivo),
    deError: (ref, mensaje) => ({ codigo: ref.codigo ?? ref.id ?? "", estado: "error", mensaje, reintentable: true }),
    reintentable: (r) => r.estado === "error" && !!r.reintentable,
    reintentar: (ref) => anularUnoAction(slug, ref, motivo),
    agotado: (r) => ({
      ...r,
      reintentable: false,
      mensaje: `${r.mensaje ?? "Error"} (falló tras 3 reintentos; puedes reintentar desde el detalle del comprobante)`,
    }),
    onProgreso,
    cancelado,
  });
}
