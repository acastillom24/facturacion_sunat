"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function iso(d: Date): string {
  const lima = new Date(d.getTime() - 5 * 60 * 60 * 1000); // hora de Lima (UTC-5)
  return lima.toISOString().slice(0, 10);
}

function abrirCalendario(e: React.MouseEvent<HTMLInputElement>) {
  try {
    e.currentTarget.showPicker();
  } catch {
    // navegadores sin showPicker: queda el comportamiento nativo
  }
}

export function FiltroFechas({
  slug,
  desde,
  hasta,
  numero,
}: {
  slug: string;
  desde: string;
  hasta: string;
  numero: string;
}) {
  const router = useRouter();
  const [d, setD] = useState(desde);
  const [h, setH] = useState(hasta);
  const [n, setN] = useState(numero);

  function ir(nd: string, nh: string, nn: string) {
    setD(nd);
    setH(nh);
    router.push(`/${slug}?desde=${nd}&hasta=${nh}&numero=${encodeURIComponent(nn)}`);
  }

  const hoy = new Date();
  const dias = (cant: number) => iso(new Date(hoy.getTime() - cant * 24 * 60 * 60 * 1000));
  const inicioMes = `${iso(hoy).slice(0, 8)}01`;
  const atajos: [string, string, string][] = [
    ["Hoy", iso(hoy), iso(hoy)],
    ["Ayer", dias(1), dias(1)],
    ["Últimos 7 días", dias(6), iso(hoy)],
    ["Este mes", inicioMes, iso(hoy)],
    ["Todas", "", ""],
  ];

  const inputCls = "mt-1 cursor-pointer rounded-md border border-neutral-300 px-2 py-1.5 text-sm";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        ir(d, h, n);
      }}
      className="space-y-3"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-500">Desde</label>
          <input
            type="date"
            value={d}
            max={h || undefined}
            onClick={abrirCalendario}
            onChange={(e) => ir(e.target.value, h, n)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-500">Hasta</label>
          <input
            type="date"
            value={h}
            min={d || undefined}
            onClick={abrirCalendario}
            onChange={(e) => ir(d, e.target.value, n)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-500">N.° de comprobante</label>
          <input
            type="text"
            value={n}
            onChange={(e) => setN(e.target.value)}
            placeholder="ej. 5744"
            className="mt-1 w-32 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Buscar
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {atajos.map(([label, a, b]) => {
          const activo = d === a && h === b;
          return (
            <button
              key={label}
              type="button"
              onClick={() => ir(a, b, n)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                activo
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-neutral-300 bg-white text-neutral-600 hover:border-indigo-300 hover:text-indigo-700"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </form>
  );
}
