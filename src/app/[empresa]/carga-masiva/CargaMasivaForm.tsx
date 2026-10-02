"use client";

import { useActionState, useRef, useState } from "react";
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
  const [descargandoZip, setDescargandoZip] = useState(false);
  const [errorZip, setErrorZip] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(
    async (_prev: Awaited<ReturnType<typeof cargaMasivaAction>>, formData: FormData) => {
      const result = await cargaMasivaAction(slug, formData);
      formRef.current?.reset();
      return result;
    },
    {},
  );

  const emitidos = state?.resultados?.filter((r) => r.estado === "emitido" && r.id) ?? [];
  const idsEmitidos = emitidos.map((r) => r.id as string);

  async function descargarTicketsZip() {
    setErrorZip(null);
    setDescargandoZip(true);
    try {
      const res = await fetch(`/${slug}/carga-masiva/tickets-zip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archivos: emitidos.map((r) => ({ id: r.id, prefijo: r.prefijo ?? "" })) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "No se pudo generar el .zip");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "tickets.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorZip(err instanceof Error ? err.message : "No se pudo generar el .zip");
    } finally {
      setDescargandoZip(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-neutral-600">
        <p>
          Descarga la plantilla, complétala y súbela aquí. Por defecto cada fila es un
          comprobante con un solo ítem; si necesitas varios ítems en un mismo comprobante,
          repite el mismo número en la columna <strong>Grupo</strong> en esas filas (el tipo,
          la serie y el cliente se toman de la primera fila de cada grupo).
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><strong>Tipo</strong>: &quot;B&quot; para boleta o &quot;F&quot; para factura.</li>
          <li><strong>Documento Cliente</strong>: obligatorio (RUC, 11 dígitos) si es factura; obligatorio (DNI, 8 dígitos) en boletas con monto mayor a S/ 699.</li>
          <li><strong>Prefijo Archivo</strong> (opcional): nombre para el PDF, que quedará como <code>Prefijo_B001-5744.pdf</code>; en blanco queda solo <code>B001-5744.pdf</code>.</li>
          <li>El correlativo de cada comprobante lo asigna el sistema automáticamente.</li>
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
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {pending ? "Procesando..." : "Procesar archivo"}
        </button>
      </form>

      {state?.resultados && (
        <div className="space-y-3">
          {idsEmitidos.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={descargarTicketsZip}
                disabled={descargandoZip}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-100 disabled:opacity-60"
              >
                {descargandoZip ? "Generando .zip..." : `Descargar tickets emitidos (.zip, ${idsEmitidos.length})`}
              </button>
              {errorZip && <p className="text-sm text-red-600">{errorZip}</p>}
            </div>
          )}
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
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
                  <tr key={r.filas.join("-")}>
                    <td className="px-3 py-2">{r.filas.join(", ")}</td>
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
        </div>
      )}
    </div>
  );
}
