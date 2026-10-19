"use client";

import { useActionState } from "react";
import { adminLoginAction } from "../actions";

export function AdminLoginForm({ conTotp }: { conTotp: boolean }) {
  const [state, formAction, pending] = useActionState(adminLoginAction, {});
  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input
        name="password"
        type="password"
        required
        autoFocus
        placeholder="Contraseña"
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />
      {conTotp && (
        <input
          name="totp"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          placeholder="Código 2FA (6 dígitos)"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      )}
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
        {pending ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
