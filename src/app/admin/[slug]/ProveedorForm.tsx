"use client";

import { startTransition, useActionState, useState } from "react";
import { guardarProveedorAction, type ProveedorState } from "../actions";
import { Badge, Boton, Card, Field, Mensaje, inputClass } from "@/components/admin/ui";

type Proveedor = "apisperu" | "propia";

const OPCIONES: { valor: Proveedor; titulo: string; texto: string }[] = [
  { valor: "propia", titulo: "API propia", texto: "Emite directo a SUNAT con tu certificado y usuario SOL." },
  { valor: "apisperu", titulo: "APIsPERU", texto: "Servicio externo (legado). Solo requiere el token." },
];

export function ProveedorForm({
  slug,
  actual,
  tieneToken,
  ambienteActual,
  solUsuarioActual,
  tieneSolClave,
  certificadoResumen,
}: {
  slug: string;
  actual: Proveedor;
  tieneToken: boolean;
  ambienteActual: "beta" | "produccion";
  solUsuarioActual: string;
  tieneSolClave: boolean;
  /** Texto con el certificado ya cargado en la API (titular, vencimiento), o null si no hay. */
  certificadoResumen: string | null;
}) {
  const [state, formAction, pending] = useActionState(async (_p: ProveedorState, fd: FormData) => guardarProveedorAction(slug, fd), {});
  const [proveedor, setProveedor] = useState<Proveedor>(actual);
  const [ambiente, setAmbiente] = useState(ambienteActual);
  const [cambios, setCambios] = useState(false);
  const err = (n: string) => state?.campo === n;

  return (
    <form
      // Se envía en una transición para que React no resetee los campos tras un error.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => {
          formAction(fd);
          setCambios(false);
        });
      }}
      onChange={() => setCambios(true)}
    >
      <Card
        titulo="Proveedor de emisión"
        descripcion="Con qué servicio se emiten los comprobantes de esta empresa."
        badge={<Badge tono={actual === "propia" ? "ok" : "neutro"}>{actual === "propia" ? "API propia" : "APIsPERU"}</Badge>}
        acciones={
          <>
            <Boton pendiente={pending} disabled={!cambios} textoPendiente="Guardando…">
              Guardar proveedor
            </Boton>
            {!cambios && !state?.ok && !state?.error && <span className="text-xs text-neutral-500">Sin cambios por guardar.</span>}
            {cambios && <span className="text-xs text-amber-700">Tienes cambios sin guardar.</span>}
          </>
        }
      >
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">Proveedor</legend>
          {OPCIONES.map((o) => (
            <label
              key={o.valor}
              className={`cursor-pointer rounded-lg border p-3 text-sm transition ${
                proveedor === o.valor ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500" : "border-neutral-200 hover:border-neutral-300"
              }`}
            >
              <input type="radio" name="proveedor" value={o.valor} checked={proveedor === o.valor} onChange={() => setProveedor(o.valor)} className="sr-only" />
              <span className="block font-medium text-neutral-900">{o.titulo}</span>
              <span className="mt-0.5 block text-xs text-neutral-500">{o.texto}</span>
            </label>
          ))}
        </fieldset>

        <Field
          label="Token (API key)"
          ayuda={tieneToken ? "Ya hay uno guardado. Déjalo vacío para conservarlo." : "Obligatorio."}
         
        >
          <input name="token" type="password" autoComplete="off" aria-invalid={err("token")} className={inputClass(err("token"))} />
        </Field>

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
                    onClick={() => {
                      setAmbiente(a);
                      setCambios(true);
                    }}
                    aria-pressed={ambiente === a}
                    className={`rounded-md px-3 py-1.5 ${ambiente === a ? (a === "produccion" ? "bg-emerald-600 text-white" : "bg-indigo-600 text-white") : "text-neutral-600 hover:bg-neutral-100"}`}
                  >
                    {a === "beta" ? "Beta (pruebas)" : "Producción"}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                {ambiente === "produccion" ? "Los comprobantes serán reales y tendrán validez tributaria." : "Comprobantes de prueba, sin validez tributaria."}
              </p>
            </div>

            <div className="rounded-lg border border-neutral-200 p-4">
              <h3 className="text-sm font-medium text-neutral-900">Credenciales SOL</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Usuario secundario SOL">
                  <input name="solUsuario" defaultValue={solUsuarioActual} autoComplete="off" className={inputClass(err("solUsuario"))} />
                </Field>
                <Field label="Clave SOL" ayuda={tieneSolClave ? "Guardada. Vacía = no cambiarla." : "Aún no cargada."}>
                  <input name="solClave" type="password" autoComplete="new-password" className={inputClass(err("solClave"))} />
                </Field>
              </div>
            </div>

            <div className="rounded-lg border border-neutral-200 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-neutral-900">Certificado digital</h3>
                <Badge tono={certificadoResumen ? "ok" : "aviso"}>{certificadoResumen ?? "No cargado"}</Badge>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Archivo .p12 / .pfx" ayuda="Máx. 50 KB. Vacío = conservar el actual.">
                  <input name="certificado" type="file" accept=".p12,.pfx" className={inputClass(err("certificado"))} />
                </Field>
                <Field label="Clave del certificado" ayuda="Obligatoria si subes un archivo nuevo.">
                  <input name="certificadoClave" type="password" autoComplete="new-password" className={inputClass(err("certificadoClave"))} />
                </Field>
              </div>
            </div>
          </>
        )}

        {state?.error && <Mensaje tono="error">{state.error}</Mensaje>}
        {state?.ok && <Mensaje tono="ok">{state.mensaje}</Mensaje>}
      </Card>
    </form>
  );
}
