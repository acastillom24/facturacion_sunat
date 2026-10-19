"use client";

import { useActionState } from "react";
import { resetPasswordAction, toggleActivaAction } from "../actions";

export function ControlesEmpresa({ slug, activa }: { slug: string; activa: boolean }) {
  const [state, formAction, pending] = useActionState(
    async (_p: { ok?: boolean; error?: string }, fd: FormData) => resetPasswordAction(slug, fd),
    {},
  );
  return (
    <div className="space-y-4">
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Nueva contraseña (mín. 8)"
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <button disabled={pending} className="rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100 disabled:opacity-50">
          Cambiar contraseña
        </button>
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state?.ok && <span className="text-sm text-emerald-700">Contraseña actualizada.</span>}
      </form>
      <form action={() => toggleActivaAction(slug, !activa)}>
        <button className={`rounded-md px-3 py-2 text-sm ${activa ? "border border-red-300 text-red-700 hover:bg-red-50" : "bg-emerald-600 text-white"}`}>
          {activa ? "Suspender empresa" : "Reactivar empresa"}
        </button>
      </form>
    </div>
  );
}
