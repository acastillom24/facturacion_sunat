"use client";

import { useState, useTransition } from "react";
import type { DuenoPlan, PlanCatalogo } from "@/lib/sunat/apiPlanes";
import { asignarPlanAction } from "./actions";

const INPUT = "rounded-md border border-neutral-300 px-2 py-1 text-sm";
const tope = (n: number | null) => (n == null ? "ilimitado" : String(n));

export function AsignarPlanForm({ dueno, catalogo }: { dueno: DuenoPlan; catalogo: PlanCatalogo[] }) {
  const pagos = catalogo.filter((p) => p.id !== "free");
  const sub = dueno.subscription;
  const [planId, setPlanId] = useState(sub && pagos.some((p) => p.id === sub.plan) ? sub.plan : (pagos[0]?.id ?? ""));
  const delCatalogo = pagos.find((p) => p.id === planId);
  // Si el plan guardado es el elegido y su límite difiere del catálogo, se muestra como personalizado.
  const personalizado = sub && sub.plan === planId && sub.monthlyLimit !== delCatalogo?.monthlyLimit;
  const [ilimitado, setIlimitado] = useState(!!personalizado && sub?.monthlyLimit == null);
  const [msg, setMsg] = useState<string>();
  const [pending, start] = useTransition();

  return (
    <form
      action={(fd) =>
        start(async () => {
          const r = await asignarPlanAction(dueno.email, fd);
          setMsg(r.error ?? "Guardado");
        })
      }
      className="flex flex-wrap items-center gap-2"
    >
      <select name="plan" value={planId} onChange={(e) => setPlanId(e.target.value)} className={INPUT} aria-label="Plan">
        {pagos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({tope(p.monthlyLimit)})
          </option>
        ))}
      </select>
      <input
        key={planId}
        name="monthlyLimit"
        defaultValue={personalizado && sub?.monthlyLimit != null ? sub.monthlyLimit : ""}
        placeholder={tope(delCatalogo?.monthlyLimit ?? null)}
        inputMode="numeric"
        disabled={ilimitado}
        className={`${INPUT} w-24 disabled:bg-neutral-100`}
        aria-label="Límite mensual (vacío = el del plan)"
        title="Vacío = el límite del plan"
      />
      <label className="flex items-center gap-1 text-xs text-neutral-600">
        <input type="checkbox" name="ilimitado" checked={ilimitado} onChange={(e) => setIlimitado(e.target.checked)} />
        ilimitado
      </label>
      <input name="expiresAt" type="date" defaultValue={sub?.expiresAt?.slice(0, 10) ?? ""} className={INPUT} aria-label="Vencimiento (vacío = no vence)" />
      <button disabled={pending || !planId} className="rounded-md bg-neutral-800 px-2 py-1 text-xs text-white disabled:opacity-50">
        {sub ? "Guardar" : "Asignar"}
      </button>
      {msg && <span className={msg === "Guardado" ? "text-xs text-emerald-700" : "text-xs text-red-600"}>{msg}</span>}
    </form>
  );
}
