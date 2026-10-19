"use client";

import { useActionState } from "react";
import { fijarCorrelativoAction, guardarLogoAction } from "../actions";

const INPUT = "mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm";
type Estado = { ok?: boolean; error?: string };

export function LogoForm({ slug, logoUrl }: { slug: string; logoUrl: string | null }) {
  const [state, formAction, pending] = useActionState(async (_p: Estado, fd: FormData) => guardarLogoAction(slug, fd), {});
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {logoUrl && <img src={logoUrl} alt="Logo" className="h-12 w-12 rounded-lg border border-neutral-200 object-contain p-1" />}
      <input name="logo" type="file" accept="image/png,image/jpeg" className="text-sm" />
      <button disabled={pending} className="rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100 disabled:opacity-50">
        {pending ? "Subiendo…" : logoUrl ? "Cambiar logo" : "Subir logo"}
      </button>
      {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      {state?.ok && <span className="text-sm text-emerald-700">Logo actualizado.</span>}
    </form>
  );
}

export function CorrelativosForm({ slug, series }: { slug: string; series: { tipo_doc: string; serie: string; ultimo_correlativo: number }[] }) {
  const [state, formAction, pending] = useActionState(async (_p: Estado, fd: FormData) => fijarCorrelativoAction(slug, fd), {});
  return (
    <div className="space-y-3">
      {series.length > 0 ? (
        <ul className="text-sm text-neutral-700">
          {series.map((s) => (
            <li key={s.tipo_doc + s.serie}>
              {s.tipo_doc === "01" ? "Factura" : "Boleta"} {s.serie}: último {s.ultimo_correlativo} → siguiente <b>{s.serie}-{s.ultimo_correlativo + 1}</b>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-neutral-500">Sin series aún (la primera emisión empieza en 1).</p>
      )}
      <form action={formAction} className="grid items-end gap-3 sm:grid-cols-4">
        <div>
          <label className="text-sm text-neutral-600">Tipo</label>
          <select name="tipo" className={INPUT}>
            <option value="03">Boleta</option>
            <option value="01">Factura</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-neutral-600">Serie</label>
          <input name="serie" required maxLength={4} placeholder="B001" className={INPUT} />
        </div>
        <div>
          <label className="text-sm text-neutral-600">Último usado</label>
          <input name="ultimo" required inputMode="numeric" className={INPUT} />
        </div>
        <button disabled={pending} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
          {pending ? "Guardando…" : "Fijar correlativo"}
        </button>
      </form>
      <p className="text-xs text-amber-700">Cuidado: bajar el número por debajo de lo ya emitido provocará duplicados.</p>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700">Correlativo actualizado.</p>}
    </div>
  );
}
