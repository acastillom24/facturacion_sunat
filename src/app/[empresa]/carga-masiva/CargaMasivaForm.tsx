"use client";

import { useActionState, useRef } from "react";
import { cargaMasivaAction } from "../actions";

const ESTADO_LABEL: Record<string, string> = {
  emitido: "Emitido",
  pendiente: "Pendiente / reintentando",
  error: "Error",
  invalido: "Rechazado antes de enviar",
};

const ESTADO_CLASS: Record<string, string> = {
  emitido: "bg-green-100 text-green-800",
  pendiente: "bg-amber-100 text-amber-800",
  error: "bg-red-100 text-red-800",
  invalido: "bg-red-100 text-red-800",
};

export function CargaMasivaForm({ slug }: { slug: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (_prev: Awaited<ReturnType<typeof cargaMasivaAction>>, formData: FormData) => {
      const result = await cargaMasivaAction(slug, formData);
      formRef.current?.reset();
      return result;
    },
    {},
  );

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
        <p>
          Descarga la plantilla, complétala (una fila = un comprobante con un solo ítem) y súbela aquí.
          El correlativo de cada comprobante lo asigna el sistema automáticamente.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><strong>Tipo</strong>: &quot;B&quot; para boleta o &quot;F&quot; para factura.</li>
          <li><strong>Documento Cliente</strong>: obligatorio (RUC, 11 dígitos) si es factura; obligatorio (DNI, 8 dígitos) en boletas con monto mayor a S/ 699.</li>
          <li>Máximo 40 filas por archivo (para archivos más grandes, divide en varias cargas).</li>
        </ul>
        <a
          href={`/${slug}/carga-masiva/plantilla`}
          className="mt-3 inline-block rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-100"
        >
          Descargar plantilla (.xlsx)
        </a>
      </div>

      <form ref={formRef} action={formAction} className="space-y-3">
        <input
          type="file"
          name="archivo"
          accept=".xlsx"
          required
          className="block w-full text-sm text-neutral-700"
        />
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60"
        >
          {pending ? "Procesando..." : "Procesar archivo"}
        </button>
      </form>

      {state?.resultados && (
        <div className="overflow-hidden rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-500">
              <tr>
                <th className="px-3 py-2">Fila</th>
                <th className="px-3 py-2">Documento</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {state.resultados.map((r) => (
                <tr key={r.fila}>
                  <td className="px-3 py-2">{r.fila}</td>
                  <td className="px-3 py-2">
                    {r.serie && r.correlativo ? `${r.serie}-${String(r.correlativo).padStart(6, "0")}` : "-"}
                  </td>
                  <td className="px-3 py-2 text-neutral-600">{r.cliente ?? "-"}</td>
                  <td className="px-3 py-2 text-neutral-600">{r.total !== undefined ? r.total.toFixed(2) : "-"}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_CLASS[r.estado] ?? ""}`}>
                      {ESTADO_LABEL[r.estado] ?? r.estado}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-500">
                    {r.mensaje ?? (r.id ? <a className="underline" href={`/${slug}/comprobantes/${r.id}`}>Ver</a> : "-")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
