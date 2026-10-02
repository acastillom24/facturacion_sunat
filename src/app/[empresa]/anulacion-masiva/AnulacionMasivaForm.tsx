"use client";

import { useActionState } from "react";
import { anulacionMasivaAction } from "../actions";

export function AnulacionMasivaForm({ slug }: { slug: string }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: Awaited<ReturnType<typeof anulacionMasivaAction>>, formData: FormData) =>
      anulacionMasivaAction(slug, formData),
    {},
  );

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
        <p>
          Escribe los códigos de las boletas y facturas a anular, separados por salto de línea,
          coma o espacio (ej. <code>B001-5744</code>, <code>F001-57</code>). Las boletas se anulan
          con resumen diario y las facturas con comunicación de baja. Máximo 40 por vez. Solo se
          anulan comprobantes en estado emitido; la anulación no se puede revertir.
        </p>
      </div>

      <form action={formAction} className="space-y-3">
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
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-60"
        >
          {pending ? "Anulando..." : "Anular comprobantes"}
        </button>
      </form>

      {state?.resultados && (
        <div className="overflow-hidden rounded-lg border border-neutral-200">
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
