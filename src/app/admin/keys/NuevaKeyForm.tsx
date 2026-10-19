"use client";

import { useActionState } from "react";
import { crearKeyAction } from "./actions";

const INPUT = "mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm";

function Campo({ label, name, ...rest }: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="text-sm text-neutral-600">{label}</label>
      <input name={name} className={INPUT} {...rest} />
    </div>
  );
}

export function NuevaKeyForm() {
  const [state, formAction, pending] = useActionState(crearKeyAction, {});
  return (
    <form action={formAction} className="mt-4 space-y-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Nombre" name="name" required />
        <Campo label="Correo del dueño (requerido: la API de SUNAT asocia las empresas a esta cuenta)" name="email" type="email" required />
        <Campo label="Límite mensual (vacío = sin tope)" name="monthlyLimit" inputMode="numeric" />
        <Campo label="Límite diario (vacío = sin tope)" name="dailyLimit" inputMode="numeric" />
        <Campo label="Vence (vacío = no vence)" name="expiresAt" type="date" />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.key && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <p className="font-medium text-emerald-800">Key creada. Cópiala ahora: no se vuelve a mostrar.</p>
          <code className="mt-1 block break-all select-all">{state.key}</code>
        </div>
      )}
      <button disabled={pending} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
        {pending ? "Creando…" : "Crear key"}
      </button>
    </form>
  );
}
