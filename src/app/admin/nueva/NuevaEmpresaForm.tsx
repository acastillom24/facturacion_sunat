"use client";

import { startTransition, useActionState, useState } from "react";
import { crearEmpresaAction } from "../actions";
import { Boton, Card, Field, Mensaje, inputClass } from "@/components/admin/ui";
import { MAX_LOGO_TEXTO, errorLogo } from "@/lib/logo";

type CampoProps = { label: string; name: string; invalido?: boolean; ayuda?: string; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "className">;

function Campo({ label, name, invalido, ayuda, className, ...rest }: CampoProps) {
  return (
    <Field label={label} ayuda={ayuda} className={className}>
      <input name={name} aria-invalid={invalido} className={inputClass(invalido)} {...rest} />
    </Field>
  );
}

export function NuevaEmpresaForm() {
  const [state, formAction, pending] = useActionState(crearEmpresaAction, {});
  const [proveedor, setProveedor] = useState("propia");
  const [ambiente, setAmbiente] = useState<"beta" | "produccion">("beta");
  const [errorLogoLocal, setErrorLogoLocal] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const err = (n: string) => state?.campo === n;

  return (
    <form
      // Se envía en una transición para que React no resetee los campos tras un error.
      onSubmit={(e) => {
        e.preventDefault();
        if (errorLogoLocal) return;
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="mt-4 space-y-6"
    >
      <Card titulo="1. Datos de la empresa" descripcion="Identifican a la empresa en SUNAT y en el panel.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Identificador" name="slug" invalido={err("slug")} required placeholder="acme" ayuda="Será la URL de acceso: /acme" />
          <Campo label="Contraseña inicial" name="password" invalido={err("password")} type="password" required autoComplete="new-password" ayuda="Mínimo 8 caracteres." />
          <Campo label="RUC" name="ruc" invalido={err("ruc")} required inputMode="numeric" maxLength={11} />
          <Campo label="Razón social" name="razonSocial" invalido={err("razonSocial")} required />
          <Campo label="Nombre comercial" name="nombreComercial" ayuda="Opcional; por defecto la razón social." />
          <Campo label="IGV" name="igvRate" invalido={err("igvRate")} defaultValue="0.18" />
        </div>
        <details className="rounded-lg border border-neutral-200 p-3">
          <summary className="cursor-pointer text-sm font-medium text-neutral-700">Dirección fiscal y ubigeo</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Campo label="Dirección fiscal" name="direccion" className="sm:col-span-2" />
            <Campo label="Código de local" name="codLocal" defaultValue="0000" ayuda="0000 = sede / domicilio fiscal." />
            <Campo label="Ubigeo" name="ubigueo" defaultValue="150101" />
            <Campo label="Departamento" name="departamento" defaultValue="LIMA" />
            <Campo label="Provincia" name="provincia" defaultValue="LIMA" />
            <Campo label="Distrito" name="distrito" defaultValue="LIMA" />
          </div>
        </details>
      </Card>

      <Card titulo="2. Logo" descripcion={`Opcional. PNG o JPG, máximo ${MAX_LOGO_TEXTO}. Aparece en el ticket y el PDF A4.`}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Vista previa del logo" className="max-h-full max-w-full object-contain p-2" />
            ) : (
              <span className="px-2 text-center text-xs text-neutral-400">Sin logo</span>
            )}
          </div>
          <Field label="Archivo" className="min-w-0 flex-1">
            <input
              name="logo"
              type="file"
              accept="image/png,image/jpeg"
              className={inputClass(err("logo") || !!errorLogoLocal)}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                const msg = errorLogo(f);
                setErrorLogoLocal(msg);
                if (msg) e.target.value = "";
                setPreview((anterior) => {
                  if (anterior) URL.revokeObjectURL(anterior);
                  return f && !msg ? URL.createObjectURL(f) : null;
                });
              }}
            />
          </Field>
        </div>
        {errorLogoLocal && <Mensaje tono="error">{errorLogoLocal}</Mensaje>}
      </Card>

      <Card titulo="3. Correlativos iniciales" descripcion="Opcional. Indica el ÚLTIMO número ya usado; el siguiente comprobante será ese +1. Vacío = empezar en 1.">
        <div className="grid gap-3 sm:grid-cols-4">
          <Campo label="Serie boleta" name="serieBoleta" invalido={err("serieBoleta")} placeholder="B001" maxLength={4} />
          <Campo label="Último boleta" name="ultimoBoleta" invalido={err("ultimoBoleta")} inputMode="numeric" />
          <Campo label="Serie factura" name="serieFactura" invalido={err("serieFactura")} placeholder="F001" maxLength={4} />
          <Campo label="Último factura" name="ultimoFactura" invalido={err("ultimoFactura")} inputMode="numeric" />
        </div>
      </Card>

      <Card titulo="4. Proveedor de emisión" descripcion="Con qué servicio emitirá comprobantes.">
        <Field label="Proveedor">
          <select name="proveedor" value={proveedor} onChange={(e) => setProveedor(e.target.value)} className={inputClass()}>
            <option value="propia">API propia</option>
            <option value="apisperu">APIsPERU (legado)</option>
          </select>
        </Field>
        <Campo label="Token (API key)" required name="token" invalido={err("token")} type="password" autoComplete="off" />

        {proveedor === "propia" && (
          <>
            <div>
              <span className="text-sm font-medium text-neutral-700">Ambiente</span>
              <input type="hidden" name="ambiente" value={ambiente} />
              <div className="mt-1 inline-flex rounded-lg border border-neutral-300 p-0.5 text-sm">
                {(["beta", "produccion"] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={ambiente === a}
                    onClick={() => setAmbiente(a)}
                    className={`rounded-md px-3 py-1.5 ${ambiente === a ? (a === "produccion" ? "bg-emerald-600 text-white" : "bg-indigo-600 text-white") : "text-neutral-600 hover:bg-neutral-100"}`}
                  >
                    {a === "beta" ? "Beta (pruebas)" : "Producción"}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4">
              <h3 className="text-sm font-medium text-neutral-900">Credenciales SOL y certificado</h3>
              <p className="mt-0.5 text-xs text-neutral-500">Opcionales aquí; si las omites, cárgalas luego en la ficha (hasta entonces no podrá emitir).</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Campo label="Usuario secundario SOL" name="solUsuario" autoComplete="off" />
                <Campo label="Clave SOL" name="solClave" type="password" autoComplete="new-password" />
                <Field label="Certificado .p12 / .pfx" ayuda="Máx. 50 KB.">
                  <input name="certificado" type="file" accept=".p12,.pfx" className={inputClass(err("certificado"))} />
                </Field>
                <Campo label="Clave del certificado" name="certificadoClave" invalido={err("certificadoClave")} type="password" autoComplete="new-password" />
              </div>
            </div>
          </>
        )}
      </Card>

      {state?.error && <Mensaje tono="error">{state.error}</Mensaje>}
      <div className="sticky bottom-0 -mx-4 flex justify-end border-t border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur">
        <Boton pendiente={pending} disabled={!!errorLogoLocal} textoPendiente="Creando…">
          Crear empresa
        </Boton>
      </div>
    </form>
  );
}
