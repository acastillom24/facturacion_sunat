"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { MAX_COMPROBANTES_POR_LOTE, mensajeExcedeLimite } from "@/lib/limites";
import type { ProgresoLote } from "@/lib/lote";
import { cancelarPendientesAction, type ResultadoAnulacionMasiva } from "./actions";
import { anularLote } from "./anularLote";
import { BarraProgreso } from "./BarraProgreso";

const MAX_DESCARGA = 100;

export interface FilaComprobante {
  id: string;
  documento: string;
  cliente: string;
  total: string;
  estado: string;
  estadoLabel: string;
  estadoClass: string;
  fecha: string;
}

export function TablaComprobantes({
  slug,
  filas,
  vacio,
}: {
  slug: string;
  filas: FilaComprobante[];
  vacio: string;
}) {
  const router = useRouter();
  const cancelRef = useRef(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [progreso, setProgreso] = useState<ProgresoLote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultados, setResultados] = useState<ResultadoAnulacionMasiva[] | null>(null);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const todos = filas.length > 0 && filas.every((f) => sel.has(f.id));
  const pendientesSel = filas.filter((f) => sel.has(f.id) && f.estado === "pendiente").map((f) => f.id);
  const alternar = (id: string) =>
    setSel((prev) => {
      const n = new Set(prev);
      if (!n.delete(id)) n.add(id);
      return n;
    });

  function excede(max: number): boolean {
    if (sel.size <= max) return false;
    setError(mensajeExcedeLimite(sel.size, max, `seleccionaste ${sel.size} comprobantes`));
    return true;
  }

  async function descargar() {
    if (excede(MAX_DESCARGA)) return;
    setError(null);
    setTrabajando(true);
    try {
      const res = await fetch(`/${slug}/carga-masiva/tickets-zip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archivos: [...sel].map((id) => ({ id, prefijo: "" })) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "No se pudo generar el .zip");
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "comprobantes.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el .zip");
    } finally {
      setTrabajando(false);
    }
  }

  async function anular() {
    setConfirmando(false);
    setError(null);
    setTrabajando(true);
    cancelRef.current = false;
    const { resultados: r, sinProcesar } = await anularLote(
      slug,
      [...sel].map((id) => ({ id })),
      motivo,
      setProgreso,
      () => cancelRef.current,
    );
    if (sinProcesar > 0) {
      setError(`Anulación cancelada: ${sinProcesar} comprobantes quedaron sin procesar (los ya anulados se mantienen).`);
    }
    setMotivo("");
    setProgreso(null);
    setTrabajando(false);
    setResultados(r);
    setSel(new Set());
    router.refresh();
  }

  async function cancelarPendientes() {
    setConfirmandoCancelar(false);
    setError(null);
    setAviso(null);
    setTrabajando(true);
    try {
      const r = await cancelarPendientesAction(slug, pendientesSel);
      if (r.error) {
        setError(r.error);
        return;
      }
      const n = r.cancelados ?? 0;
      const omitidos = pendientesSel.length - n;
      setAviso(
        `${n} reintento(s) cancelado(s).` +
          (omitidos > 0 ? ` ${omitidos} ya no estaban pendientes (se emitieron o cambiaron de estado) y no se tocaron.` : ""),
      );
      setSel(new Set());
      router.refresh();
    } catch {
      setError("No se pudieron cancelar los pendientes");
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <div className="mt-3 space-y-3">
      {sel.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm">
          <span className="font-medium text-indigo-900">{sel.size} seleccionado(s)</span>
          <button
            onClick={descargar}
            disabled={trabajando}
            className="rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {trabajando ? "Procesando..." : "Descargar (.zip)"}
          </button>
          <button
            onClick={() => !excede(MAX_COMPROBANTES_POR_LOTE) && setConfirmando(true)}
            disabled={trabajando}
            className="rounded-md bg-red-700 px-3 py-1.5 font-medium text-white hover:bg-red-600 disabled:opacity-60"
          >
            Anular
          </button>
          {pendientesSel.length > 0 && (
            <button
              onClick={() => setConfirmandoCancelar(true)}
              disabled={trabajando}
              className="rounded-md bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700 disabled:opacity-60"
            >
              Cancelar pendientes ({pendientesSel.length})
            </button>
          )}
          <button
            onClick={() => setSel(new Set())}
            disabled={trabajando}
            className="ml-auto rounded-md border border-indigo-300 bg-white px-3 py-1.5 font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
          >
            ✕ Quitar selección
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {aviso && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          <p>{aviso}</p>
          <button onClick={() => setAviso(null)} className="text-emerald-600 hover:text-emerald-900">
            Cerrar
          </button>
        </div>
      )}
      {progreso && <BarraProgreso progreso={progreso} verbo="Anulando" hecho="anulados" onCancelar={() => (cancelRef.current = true)} />}
      {resultados && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm shadow-sm">
          <div className="flex justify-between">
            <p className="font-medium">Resultado de la anulación</p>
            <button onClick={() => setResultados(null)} className="text-neutral-400 hover:text-neutral-700">
              Cerrar
            </button>
          </div>
          <ul className="mt-2 space-y-1">
            {resultados.map((r) => (
              <li key={r.codigo} className={r.estado === "anulado" ? "text-green-700" : "text-red-600"}>
                <span className="font-mono">{r.codigo}</span>: {r.estado === "anulado" ? "Anulado" : r.mensaje}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="w-10 px-4 py-2">
                <input
                  type="checkbox"
                  aria-label="Seleccionar todos"
                  checked={todos}
                  onChange={() => setSel(todos ? new Set() : new Set(filas.map((f) => f.id)))}
                />
              </th>
              <th className="px-4 py-2">Documento</th>
              <th className="px-4 py-2">Cliente</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-400">
                  {vacio}
                </td>
              </tr>
            )}
            {filas.map((c) => (
              <tr key={c.id} className="hover:bg-indigo-50/60">
                <td className="px-4 py-2">
                  <input type="checkbox" checked={sel.has(c.id)} onChange={() => alternar(c.id)} />
                </td>
                <td className="px-4 py-2">
                  <Link href={`/${slug}/comprobantes/${c.id}`} className="font-medium text-indigo-700 underline-offset-2 hover:underline">
                    {c.documento}
                  </Link>
                </td>
                <td className="px-4 py-2 text-neutral-600">{c.cliente}</td>
                <td className="px-4 py-2 text-neutral-600">{c.total}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.estadoClass}`}>{c.estadoLabel}</span>
                </td>
                <td className="px-4 py-2 text-neutral-500">{c.fecha}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirmando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="font-semibold text-neutral-900">¿Seguro que deseas anular?</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Se anularán {sel.size} comprobante(s) ante SUNAT. Solo se anulan los emitidos y esta acción no se puede revertir.
            </p>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo (solo facturas, opcional)"
              className="mt-3 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirmando(false)} className="rounded-md px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100">
                Cancelar
              </button>
              <button onClick={anular} className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-600">
                Sí, anular
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmandoCancelar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="font-semibold text-neutral-900">¿Cancelar los pendientes?</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Se cancelarán {pendientesSel.length} comprobante(s) pendiente(s) y ya no se volverá a intentar emitirlos.
              {sel.size > pendientesSel.length && " Los demás seleccionados no se modifican."}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmandoCancelar(false)}
                className="rounded-md px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100"
              >
                Volver
              </button>
              <button
                onClick={cancelarPendientes}
                className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700"
              >
                Sí, cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
