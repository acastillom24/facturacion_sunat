"use client";

import { startTransition, useActionState, useState } from "react";
import { guardarProveedorAction, type ProveedorState } from "../actions";

const BASE = "mt-1 w-full rounded-md border px-3 py-2 text-sm";
const OK = "border-neutral-300";
const KO = "border-red-500 bg-red-50 focus:outline-red-500";

export function ProveedorForm({
  slug,
  actual,
  tieneToken,
  ambienteActual,
  solUsuarioActual,
}: {
  slug: string;
  actual: "apisperu" | "propia";
  tieneToken: boolean;
  ambienteActual: "beta" | "produccion";
  solUsuarioActual: string;
}) {
  const [state, formAction, pending] = useActionState(
    async (_p: ProveedorState, fd: FormData) => guardarProveedorAction(slug, fd),
    {},
  );
  const [proveedor, setProveedor] = useState(actual);
  const cls = (n: string) => `${BASE} ${state?.campo === n ? KO : OK}`;
  return (
    <form
      // Se envía en una transición para que React no resetee los campos tras un error.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="space-y-4"
    >
      <select name="proveedor" value={proveedor} onChange={(e) => setProveedor(e.target.value as typeof actual)} className={cls("proveedor")}>
        <option value="apisperu">APIsPERU</option>
        <option value="propia">API propia</option>
      </select>

      <div>
        <label className="text-sm text-neutral-600">Token</label>
        <input
          name="token"
          type="password"
          autoComplete="off"
          aria-invalid={state?.campo === "token"}
          placeholder={tieneToken ? "Vacío = conservar el actual" : "Requerido"}
          className={cls("token")}
        />
      </div>

      {proveedor === "propia" && (
        <>
          <div>
            <label className="text-sm text-neutral-600">Ambiente</label>
            <select name="ambiente" defaultValue={ambienteActual} className={cls("ambiente")}>
              <option value="beta">Beta (pruebas, sin validez tributaria)</option>
              <option value="produccion">Producción (comprobantes reales)</option>
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm text-neutral-600">Usuario secundario SOL</label>
              <input name="solUsuario" defaultValue={solUsuarioActual} autoComplete="off" className={cls("solUsuario")} />
            </div>
            <div>
              <label className="text-sm text-neutral-600">Clave SOL (vacía = no cambiarla)</label>
              <input name="solClave" type="password" autoComplete="new-password" className={cls("solClave")} />
            </div>
            <div>
              <label className="text-sm text-neutral-600">Certificado .p12 / .pfx (vacío = no cambiarlo)</label>
              <input name="certificado" type="file" accept=".p12,.pfx" className={cls("certificado")} />
            </div>
            <div>
              <label className="text-sm text-neutral-600">Clave del certificado</label>
              <input name="certificadoClave" type="password" autoComplete="new-password" className={cls("certificadoClave")} />
            </div>
          </div>
        </>
      )}

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700">{state.mensaje}</p>}
      <button disabled={pending} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {pending ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
