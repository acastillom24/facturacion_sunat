"use client";

import { startTransition, useActionState, useState } from "react";
import { crearEmpresaAction } from "../actions";

const INPUT = "mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm";
const INPUT_ERROR = "mt-1 w-full rounded-md border border-red-500 bg-red-50 px-3 py-2 text-sm focus:outline-red-500";

function Campo({
  label,
  name,
  invalido,
  ...rest
}: { label: string; name: string; invalido?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className={`text-sm ${invalido ? "text-red-600" : "text-neutral-600"}`}>{label}</label>
      <input name={name} aria-invalid={invalido} className={invalido ? INPUT_ERROR : INPUT} {...rest} />
    </div>
  );
}

export function NuevaEmpresaForm() {
  const [state, formAction, pending] = useActionState(crearEmpresaAction, {});
  const [proveedor, setProveedor] = useState("propia");
  const err = (n: string) => state?.campo === n;
  return (
    <form
      // Se envía en una transición para que React no resetee los campos tras un error.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="mt-4 space-y-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Identificador (URL: /identificador)" name="slug" invalido={err("slug")} required placeholder="acme" />
        <Campo label="Contraseña inicial (mín. 8)" name="password" invalido={err("password")} type="password" required autoComplete="new-password" />
        <Campo label="RUC" name="ruc" invalido={err("ruc")} required inputMode="numeric" maxLength={11} />
        <Campo label="Razón social" name="razonSocial" invalido={err("razonSocial")} required />
        <Campo label="Nombre comercial" name="nombreComercial" />
        <Campo label="IGV (0.18)" name="igvRate" invalido={err("igvRate")} defaultValue="0.18" />
        <Campo label="Dirección fiscal" name="direccion" />
        <Campo label="Código de local (0000 = sede/domicilio fiscal)" name="codLocal" defaultValue="0000" />
        <Campo label="Ubigeo" name="ubigueo" defaultValue="150101" />
        <Campo label="Departamento" name="departamento" defaultValue="LIMA" />
        <Campo label="Provincia" name="provincia" defaultValue="LIMA" />
        <Campo label="Distrito" name="distrito" defaultValue="LIMA" />
      </div>

      <fieldset className="rounded-lg border border-neutral-200 p-4">
        <legend className="px-1 text-sm font-medium text-neutral-700">Logo (opcional, PNG/JPG, máx. 500 KB)</legend>
        <input name="logo" type="file" accept="image/png,image/jpeg" className={err("logo") ? INPUT_ERROR : INPUT} />
      </fieldset>

      <fieldset className="rounded-lg border border-neutral-200 p-4">
        <legend className="px-1 text-sm font-medium text-neutral-700">Correlativos iniciales (opcional)</legend>
        <p className="text-xs text-neutral-500">Indica el ÚLTIMO número ya usado; el siguiente comprobante será ese +1. Déjalo vacío para empezar en 1.</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-4">
          <Campo label="Serie boleta" name="serieBoleta" invalido={err("serieBoleta")} placeholder="B001" maxLength={4} />
          <Campo label="Último boleta" name="ultimoBoleta" invalido={err("ultimoBoleta")} inputMode="numeric" />
          <Campo label="Serie factura" name="serieFactura" invalido={err("serieFactura")} placeholder="F001" maxLength={4} />
          <Campo label="Último factura" name="ultimoFactura" invalido={err("ultimoFactura")} inputMode="numeric" />
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-neutral-200 p-4">
        <legend className="px-1 text-sm font-medium text-neutral-700">Proveedor de emisión</legend>
        <select name="proveedor" value={proveedor} onChange={(e) => setProveedor(e.target.value)} className={INPUT}>
          <option value="propia">API propia (configura SOL y certificado en la ficha)</option>
          <option value="apisperu">APIsPERU</option>
        </select>
        <Campo label="Token" required name="token" invalido={err("token")} type="password" autoComplete="off" />
        {proveedor === "propia" && (
          <>
            <div>
              <label className="text-sm text-neutral-600">Ambiente (solo API propia)</label>
              <select name="ambiente" defaultValue="beta" className={INPUT}>
                <option value="beta">Beta (pruebas, sin validez tributaria)</option>
                <option value="produccion">Producción (comprobantes reales)</option>
              </select>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Campo label="Usuario secundario SOL (API propia)" name="solUsuario" autoComplete="off" />
              <Campo label="Clave SOL" name="solClave" type="password" autoComplete="new-password" />
              <div>
                <label className="text-sm text-neutral-600">Certificado .p12 / .pfx</label>
                <input name="certificado" type="file" accept=".p12,.pfx" className={err("certificado") ? INPUT_ERROR : INPUT} />
              </div>
              <Campo label="Clave del certificado" name="certificadoClave" invalido={err("certificadoClave")} type="password" autoComplete="new-password" />
            </div>
          </>
        )}
        {proveedor === "propia" && (
        <p className="mt-2 text-xs text-neutral-500">
          Con API propia se registra en la API con el ambiente elegido; SOL y certificado son opcionales aquí; si los omites, cárgalos luego en su ficha (hasta entonces no podrá emitir).
        </p>
        )}
      </fieldset>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {pending ? "Creando…" : "Crear empresa"}
      </button>
    </form>
  );
}
