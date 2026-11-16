"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, inputClass } from "@/components/admin/ui";

export interface FilaEmpresa {
  slug: string;
  ruc: string;
  razonSocial: string;
  propia: boolean;
  activa: boolean;
  /** Solo API propia. undefined = no aplica; error = la API no respondió. */
  cert?: { error?: boolean; vence?: string; dias?: number };
  logo?: boolean;
}

type Filtro = "todas" | "atencion" | "suspendidas" | "propia" | "apisperu";

/** Una empresa "pide atención" si su certificado vence en ≤30 días, ya venció, falta, o no tiene logo en la API. */
function pideAtencion(f: FilaEmpresa): boolean {
  if (!f.propia || !f.activa) return false;
  const c = f.cert;
  if (!c || c.error) return !!c?.error;
  return !c.vence || c.dias! <= 30 || f.logo === false;
}

function BadgeCert({ f }: { f: FilaEmpresa }) {
  if (!f.propia) return <span className="text-neutral-400">—</span>;
  const c = f.cert;
  if (!c || c.error) return <Badge tono="aviso">sin respuesta</Badge>;
  if (!c.vence) return <Badge tono="aviso">no cargado</Badge>;
  if (c.dias! < 0) return <Badge tono="error">vencido {c.vence}</Badge>;
  return <Badge tono={c.dias! <= 30 ? "aviso" : "ok"}>{`vence ${c.vence} (${c.dias} d)`}</Badge>;
}

export function ListaEmpresas({ filas }: { filas: FilaEmpresa[] }) {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const conteo = useMemo(
    () => ({
      todas: filas.length,
      atencion: filas.filter(pideAtencion).length,
      suspendidas: filas.filter((f) => !f.activa).length,
      propia: filas.filter((f) => f.propia).length,
      apisperu: filas.filter((f) => !f.propia).length,
    }),
    [filas],
  );

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return filas.filter((f) => {
      if (t && !`${f.razonSocial} ${f.slug} ${f.ruc}`.toLowerCase().includes(t)) return false;
      switch (filtro) {
        case "atencion": return pideAtencion(f);
        case "suspendidas": return !f.activa;
        case "propia": return f.propia;
        case "apisperu": return !f.propia;
        default: return true;
      }
    });
  }, [filas, q, filtro]);

  const FILTROS: { id: Filtro; texto: string }[] = [
    { id: "todas", texto: "Todas" },
    { id: "atencion", texto: "Requieren atención" },
    { id: "suspendidas", texto: "Suspendidas" },
    { id: "propia", texto: "API propia" },
    { id: "apisperu", texto: "APIsPERU" },
  ];

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, RUC o identificador…"
          aria-label="Buscar empresas"
          className={`${inputClass()} !mt-0 max-w-sm`}
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtros">
          {FILTROS.map((x) => (
            <button
              key={x.id}
              type="button"
              aria-pressed={filtro === x.id}
              onClick={() => setFiltro(x.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition ${
                filtro === x.id ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-neutral-600 ring-neutral-300 hover:bg-neutral-100"
              }`}
            >
              {x.texto} <span className={filtro === x.id ? "text-indigo-200" : "text-neutral-400"}>{conteo[x.id]}</span>
            </button>
          ))}
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          {filas.length === 0 ? "Aún no hay empresas. Crea la primera con “Nueva empresa”." : "Ninguna empresa coincide con la búsqueda o el filtro."}
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          {visibles.map((f) => (
            <li key={f.slug}>
              <Link href={`/admin/${f.slug}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition hover:bg-neutral-50">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="truncate text-sm font-medium text-neutral-900">
                    {f.razonSocial}
                    {!f.activa && <span className="ml-2 align-middle"><Badge tono="error">Suspendida</Badge></span>}
                  </p>
                  <p className="text-xs text-neutral-500">
                    RUC {f.ruc} · /{f.slug}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tono={f.propia ? "ok" : "neutro"}>{f.propia ? "API propia" : "APIsPERU"}</Badge>
                  {f.propia && <BadgeCert f={f} />}
                  {f.propia && f.cert && !f.cert.error && <Badge tono={f.logo ? "ok" : "aviso"}>{f.logo ? "Logo en API" : "Sin logo en API"}</Badge>}
                </div>
                <span className="text-sm text-indigo-600" aria-hidden>
                  Configurar →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
