"use client";

import { useRef, useState } from "react";
import { MAX_COMPROBANTES_POR_LOTE, mensajeExcedeLimite } from "@/lib/limites";
import type { ProgresoLote } from "@/lib/lote";
import type { ResultadoAnulacionMasiva } from "../actions";
import { anularLote } from "../anularLote";
import { BarraProgreso } from "../BarraProgreso";

export function AnulacionMasivaForm({ slug }: { slug: string }) {
  const [pending, setPending] = useState(false);
  const cancelRef = useRef(false);
  const [progreso, setProgreso] = useState<ProgresoLote | null>(null);
  const [state, setState] = useState<{ error?: string; resultados?: ResultadoAnulacionMasiva[]; sinProcesar?: number }>({});

  async function anular(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const codigos = [
      ...new Set(
        String(formData.get("codigos") ?? "")
          .split(/[\s,;]+/)
          .map((c) => c.trim().toUpperCase())
          .filter(Boolean),
      ),
    ];
    if (codigos.length === 0) return setState({ error: "Ingresa al menos un código (ej. B001-5744)" });
    if (codigos.length > MAX_COMPROBANTES_POR_LOTE) {
      return setState({
        error: mensajeExcedeLimite(codigos.length, MAX_COMPROBANTES_POR_LOTE, `ingresaste ${codigos.length} códigos`),
      });
    }
    setPending(true);
    setState({});
    cancelRef.current = false;
    const { resultados, sinProcesar } = await anularLote(
      slug,
      codigos.map((codigo) => ({ codigo })),
      String(formData.get("motivo") ?? ""),
      setProgreso,
      () => cancelRef.current,
    );
    setState({ resultados, sinProcesar });
    setProgreso(null);
    setPending(false);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-neutral-600">
        <p>
          Escribe los códigos de las boletas y facturas a anular, separados por salto de línea,
          coma o espacio (ej. <code>B001-5744</code>, <code>F001-57</code>). Las boletas se anulan
          con resumen diario y las facturas con comunicación de baja. Máximo 500 por vez; se anulan de a uno y verás el avance. Solo se
          anulan comprobantes emitidos (o con error de anulación); la anulación no se puede revertir.
        </p>
      </div>

      <form onSubmit={anular} className="space-y-3">
        <textarea
          name="codigos"
          required
          rows={8}
          placeholder={"B001-5744\nB001-5745\nF001-57"}
          className="block w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm"
        />
        <input
          type="text"
          name="motivo"
          placeholder="Motivo (solo facturas, opcional)"
          className="block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {progreso && <BarraProgreso progreso={progreso} verbo="Anulando" hecho="anulados" onCancelar={() => (cancelRef.current = true)} />}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-60"
        >
          {pending ? "Anulando..." : "Anular comprobantes"}
        </button>
      </form>

      {!!state.sinProcesar && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Anulación cancelada: {state.sinProcesar} códigos quedaron sin procesar (los ya anulados se mantienen).
        </p>
      )}
      {state.resultados && (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-500">
              <tr>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Resultado</th>
                <th className="px-3 py-2">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {state.resultados.map((r) => (
                <tr key={r.codigo}>
                  <td className="px-3 py-2 font-mono">{r.codigo}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.estado === "anulado" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      }`}
                    >
                      {r.estado === "anulado" ? "Anulado" : "Error"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-500">{r.mensaje ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
