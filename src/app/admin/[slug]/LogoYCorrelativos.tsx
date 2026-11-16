"use client";

import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import { Badge, Boton, Card, Field, Mensaje, inputClass } from "@/components/admin/ui";
import { MAX_LOGO_TEXTO, errorLogo } from "@/lib/logo";
import { fijarCorrelativoAction, guardarLogoAction, reenviarLogoAction } from "../actions";

type Estado = { ok?: boolean; error?: string; aviso?: string };

export function LogoForm({ slug, logoUrl, enApi }: { slug: string; logoUrl: string | null; enApi: boolean | null }) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(async (_p: Estado, fd: FormData) => guardarLogoAction(slug, fd), {});
  const [reenvio, reenviar, reenviando] = useActionState(async () => reenviarLogoAction(slug), {} as Estado);

  // Vista previa del archivo elegido (aún sin guardar); se libera al cambiar o desmontar.
  const preview = useMemo(() => (archivo ? URL.createObjectURL(archivo) : null), [archivo]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const mostrado = preview ?? logoUrl;
  return (
    <form
      action={(fd) => {
        formAction(fd);
        setArchivo(null);
      }}
    >
      <Card
        titulo="Logo"
        descripcion={`Se muestra en el ticket y el PDF A4. PNG o JPG, máximo ${MAX_LOGO_TEXTO}.`}
        badge={enApi === null ? null : <Badge tono={enApi ? "ok" : "aviso"}>{enApi ? "En la API: sí" : "En la API: no"}</Badge>}
        acciones={
          <>
            <Boton pendiente={pending} disabled={!archivo || !!errorLocal} textoPendiente="Subiendo…">
              Guardar logo
            </Boton>
            {enApi !== null && logoUrl && (
              <Boton
                type="button"
                variante="secundario"
                pendiente={reenviando}
                textoPendiente="Enviando…"
                onClick={() => startTransition(() => reenviar())}
              >
                Reenviar a la API
              </Boton>
            )}
            {!archivo && <span className="text-xs text-neutral-500">Elige un archivo para habilitar el guardado.</span>}
            {archivo && !errorLocal && <span className="text-xs text-amber-700">Logo nuevo sin guardar.</span>}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50">
            {mostrado ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mostrado} alt="Logo" className="max-h-full max-w-full object-contain p-2" />
            ) : (
              <span className="px-2 text-center text-xs text-neutral-400">Sin logo</span>
            )}
          </div>
          <Field label={logoUrl ? "Reemplazar logo" : "Subir logo"} className="min-w-0 flex-1" ayuda={archivo ? `${archivo.name} · ${Math.round(archivo.size / 1000)} KB` : undefined}>
            <input
              name="logo"
              type="file"
              accept="image/png,image/jpeg"
              className={inputClass(!!errorLocal)}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                const msg = errorLogo(f);
                setErrorLocal(msg);
                if (msg) e.target.value = ""; // descarta el archivo para que no se pueda enviar
                setArchivo(msg ? null : f);
              }}
            />
          </Field>
        </div>

        {errorLocal && <Mensaje tono="error">{errorLocal}</Mensaje>}
        {state?.error && <Mensaje tono="error">{state.error}</Mensaje>}
        {state?.aviso && <Mensaje tono="aviso">{state.aviso}</Mensaje>}
        {state?.ok && !state.aviso && <Mensaje tono="ok">Logo actualizado.</Mensaje>}
        {reenvio?.error && <Mensaje tono="error">{reenvio.error}</Mensaje>}
        {reenvio?.ok && <Mensaje tono="ok">Logo enviado a la API.</Mensaje>}
      </Card>
    </form>
  );
}

export function CorrelativosForm({ slug, series }: { slug: string; series: { tipo_doc: string; serie: string; ultimo_correlativo: number }[] }) {
  const [state, formAction, pending] = useActionState(async (_p: Estado, fd: FormData) => fijarCorrelativoAction(slug, fd), {});
  return (
    <form action={formAction}>
      <Card
        titulo="Correlativos"
        descripcion="Número del último comprobante emitido por serie. El siguiente será ese +1."
        acciones={
          <>
            <Boton pendiente={pending} textoPendiente="Guardando…">
              Fijar correlativo
            </Boton>
            <span className="text-xs text-amber-700">Bajar el número por debajo de lo ya emitido provocará duplicados.</span>
          </>
        }
      >
        {series.length > 0 ? (
          <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 text-sm">
            {series.map((s) => (
              <li key={s.tipo_doc + s.serie} className="flex items-center justify-between px-3 py-2">
                <span>
                  {s.tipo_doc === "01" ? "Factura" : "Boleta"} <b>{s.serie}</b> · último {s.ultimo_correlativo}
                </span>
                <Badge>siguiente {s.serie}-{s.ultimo_correlativo + 1}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">Sin series aún (la primera emisión empieza en 1).</p>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Tipo">
            <select name="tipo" className={inputClass()}>
              <option value="03">Boleta</option>
              <option value="01">Factura</option>
            </select>
          </Field>
          <Field label="Serie" ayuda="Ej. B001 / F001">
            <input name="serie" required maxLength={4} placeholder="B001" className={inputClass()} />
          </Field>
          <Field label="Último usado">
            <input name="ultimo" required inputMode="numeric" className={inputClass()} />
          </Field>
        </div>
        {state?.error && <Mensaje tono="error">{state.error}</Mensaje>}
        {state?.ok && <Mensaje tono="ok">Correlativo actualizado.</Mensaje>}
      </Card>
    </form>
  );
}
