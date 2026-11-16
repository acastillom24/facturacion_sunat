import type { ReactNode } from "react";

/**
 * Piezas visuales compartidas del panel admin. Todo el estilo vive aquí:
 * si cambias un color o un espaciado, cámbialo en este archivo y se actualiza en todos los formularios.
 */

export const inputClass = (invalido?: boolean) =>
  `mt-1 w-full rounded-lg border px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none transition placeholder:text-neutral-400 focus:ring-2 ${
    invalido
      ? "border-red-400 bg-red-50 focus:ring-red-200"
      : "border-neutral-300 bg-white focus:border-indigo-500 focus:ring-indigo-100"
  }`;

/** Tarjeta de sección: título + descripción arriba, contenido en medio, acciones (botón guardar) abajo. */
export function Card({
  titulo,
  descripcion,
  badge,
  children,
  acciones,
  peligro,
}: {
  titulo: string;
  descripcion?: string;
  badge?: ReactNode;
  children: ReactNode;
  acciones?: ReactNode;
  peligro?: boolean;
}) {
  return (
    <section className={`overflow-hidden rounded-xl border bg-white shadow-sm ${peligro ? "border-red-200" : "border-neutral-200"}`}>
      <header className="flex items-start justify-between gap-3 px-5 pt-5">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">{titulo}</h2>
          {descripcion && <p className="mt-0.5 text-sm text-neutral-500">{descripcion}</p>}
        </div>
        {badge}
      </header>
      <div className="space-y-4 px-5 py-4">{children}</div>
      {acciones && <footer className="flex flex-wrap items-center gap-3 border-t border-neutral-100 bg-neutral-50 px-5 py-3">{acciones}</footer>}
    </section>
  );
}

/** Etiqueta + control + ayuda + error, siempre en el mismo orden. */
export function Field({
  label,
  ayuda,
  error,
  className,
  children,
}: {
  label: string;
  ayuda?: string;
  error?: string | null;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="text-sm font-medium text-neutral-700">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : ayuda && <span className="mt-1 block text-xs text-neutral-500">{ayuda}</span>}
    </label>
  );
}

type Tono = "ok" | "aviso" | "error" | "neutro";
const TONOS: Record<Tono, string> = {
  ok: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  aviso: "bg-amber-50 text-amber-800 ring-amber-200",
  error: "bg-red-50 text-red-700 ring-red-200",
  neutro: "bg-neutral-100 text-neutral-600 ring-neutral-200",
};

export function Badge({ tono = "neutro", children }: { tono?: Tono; children: ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONOS[tono]}`}>{children}</span>;
}

/** Mensaje de resultado de una acción. Se anuncia a lectores de pantalla. */
export function Mensaje({ tono, children }: { tono: "ok" | "aviso" | "error"; children: ReactNode }) {
  const icono = tono === "ok" ? "✓" : tono === "aviso" ? "!" : "✕";
  return (
    <p role={tono === "error" ? "alert" : "status"} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ring-1 ring-inset ${TONOS[tono]}`}>
      <span aria-hidden className="font-bold">{icono}</span>
      <span>{children}</span>
    </p>
  );
}

export function Boton({
  variante = "primario",
  pendiente,
  textoPendiente,
  children,
  ...rest
}: {
  variante?: "primario" | "secundario" | "peligro";
  pendiente?: boolean;
  textoPendiente?: string;
  children: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const estilos = {
    primario: "bg-indigo-600 text-white hover:bg-indigo-700",
    secundario: "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100",
    peligro: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
  }[variante];
  return (
    <button
      {...rest}
      disabled={rest.disabled || pendiente}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${estilos}`}
    >
      {pendiente ? (textoPendiente ?? "Guardando…") : children}
    </button>
  );
}
