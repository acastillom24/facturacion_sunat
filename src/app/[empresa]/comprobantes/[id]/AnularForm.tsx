"use client";

import { useActionState, useState } from "react";
import { anularAction } from "../../actions";

export function AnularForm({ slug, id, esFactura }: { slug: string; id: string; esFactura: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => (await anularAction(slug, id, formData)) ?? {},
    {},
  );

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100"
      >
        Anular
      </button>
    );
  }

  return (
    <form action={formAction} className="w-full space-y-2 rounded-md border border-red-200 p-4">
      <p className="text-sm text-neutral-700">
        {esFactura
          ? "Se enviará una Comunicación de Baja a SUNAT."
          : "Se anulará mediante Resumen Diario de bajas a SUNAT."}
      </p>
      {esFactura && (
        <div>
          <label className="block text-xs text-neutral-500">Motivo de la baja</label>
          <input
            name="motivo"
            required
            placeholder="ERROR EN DATOS DEL CLIENTE"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
      )}
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
        >
          {pending ? "Anulando..." : "Confirmar anulación"}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="px-3 py-2 text-sm text-neutral-500">
          Cancelar
        </button>
      </div>
    </form>
  );
}
