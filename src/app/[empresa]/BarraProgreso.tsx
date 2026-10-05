"use client";

import { useEffect, useState } from "react";
import type { ProgresoLote } from "@/lib/lote";

/** Barra de progreso de un lote; avisa antes de cerrar la pestaña mientras corre. */
export function BarraProgreso({
  progreso,
  verbo,
  hecho,
  onCancelar,
}: {
  progreso: ProgresoLote;
  verbo: string;
  /** Participio plural para el aviso de cancelación, ej. "emitidos" / "anulados". */
  hecho: string;
  onCancelar: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  useEffect(() => {
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, []);

  const pct = progreso.total > 0 ? Math.round((progreso.hechos / progreso.total) * 100) : 0;
  const texto =
    progreso.fase === "procesando"
      ? `${verbo}: ${progreso.hechos} de ${progreso.total}`
      : `Reintentando errores (ronda ${progreso.ronda}): ${progreso.hechos} de ${progreso.total}`;

  return (
    <div className="space-y-1 rounded-xl border border-indigo-100 bg-indigo-50 p-3">
      <div className="flex justify-between text-sm text-neutral-700">
        <span>{texto}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-indigo-100">
        <div className="h-full bg-indigo-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-neutral-500">
          {cancelando ? "Cancelando: terminando el comprobante en curso..." : "No cierres ni recargues esta página hasta que termine."}
        </p>
        {!cancelando && (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="rounded-md border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            Cancelar
          </button>
        )}
      </div>
      {confirmando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="font-semibold text-neutral-900">¿Seguro que deseas cancelar?</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Se detendrá el proceso: los {progreso.hechos} comprobantes ya procesados se mantienen {hecho} (no se
              revierten) y solo se dejarán de procesar los que faltan.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmando(false)} className="rounded-md px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100">
                Continuar proceso
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmando(false);
                  setCancelando(true);
                  onCancelar();
                }}
                className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-600"
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
