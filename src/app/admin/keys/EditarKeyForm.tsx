"use client";

import { useState, useTransition } from "react";
import type { ApiKeyAdmin } from "@/lib/sunat/apiKeys";
import { editarKeyAction } from "./actions";

const INPUT = "w-24 rounded-md border border-neutral-300 px-2 py-1 text-sm";

export function EditarKeyForm({ k }: { k: ApiKeyAdmin }) {
  const [msg, setMsg] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) =>
        start(async () => {
          const r = await editarKeyAction(k.id, fd);
          setMsg(r.error ?? "Guardado");
        })
      }
      className="flex flex-wrap items-center gap-2"
    >
      <input name="monthlyLimit" defaultValue={k.monthlyLimit ?? ""} placeholder="mes" inputMode="numeric" className={INPUT} aria-label="Límite mensual" />
      <input name="dailyLimit" defaultValue={k.dailyLimit ?? ""} placeholder="día" inputMode="numeric" className={INPUT} aria-label="Límite diario" />
      <input name="expiresAt" type="date" defaultValue={k.expiresAt?.slice(0, 10) ?? ""} className="rounded-md border border-neutral-300 px-2 py-1 text-sm" aria-label="Vencimiento" />
      <button disabled={pending} className="rounded-md bg-neutral-800 px-2 py-1 text-xs text-white disabled:opacity-50">
        Guardar
      </button>
      {msg && <span className={msg === "Guardado" ? "text-xs text-emerald-700" : "text-xs text-red-600"}>{msg}</span>}
    </form>
  );
}
