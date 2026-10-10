"use client";

import { useState, useTransition } from "react";
import type { ClienteSunat, ItemInput } from "@/lib/sunat/types";
import { editarYReintentarAction } from "../../actions";

const inputCls = "w-full rounded-md border border-neutral-300 px-2 py-1 text-sm";

export function EditarReintentarForm({
  slug,
  id,
  cliente: clienteInicial,
  items: itemsIniciales,
}: {
  slug: string;
  id: string;
  cliente: ClienteSunat;
  items: ItemInput[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [cliente, setCliente] = useState(clienteInicial);
  const [items, setItems] = useState(itemsIniciales);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function cambiarItem(i: number, campo: keyof ItemInput, valor: string) {
    setItems((prev) => prev.map((it, k) => (k === i ? { ...it, [campo]: valor } : it)));
  }

  function enviar() {
    setError(null);
    startTransition(async () => {
      const r = await editarYReintentarAction(slug, id, cliente, items);
      if (r?.error) setError(r.error);
    });
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="rounded-md border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm text-indigo-800 hover:bg-indigo-100"
      >
        Editar y reintentar
      </button>
    );
  }

  return (
    <div className="w-full rounded-lg border border-indigo-200 p-4 text-sm">
      <h2 className="font-medium text-neutral-700">Editar datos a enviar</h2>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <label className="text-neutral-500">
          Tipo doc.
          <select className={inputCls} value={cliente.tipoDoc} onChange={(e) => setCliente({ ...cliente, tipoDoc: e.target.value })}>
            <option value="0">Sin documento</option>
            <option value="1">DNI</option>
            <option value="6">RUC</option>
          </select>
        </label>
        <label className="text-neutral-500">
          N.º documento
          <input className={inputCls} value={cliente.numDoc} onChange={(e) => setCliente({ ...cliente, numDoc: e.target.value })} />
        </label>
        <label className="text-neutral-500">
          Nombre / razón social
          <input className={inputCls} value={cliente.rznSocial} onChange={(e) => setCliente({ ...cliente, rznSocial: e.target.value })} />
        </label>
      </div>

      <div className="mt-3 space-y-2">
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-[1fr_5rem_6rem] gap-2">
            <input className={inputCls} value={it.descripcion} placeholder="Descripción" onChange={(e) => cambiarItem(i, "descripcion", e.target.value)} />
            <input className={inputCls} type="number" min="0" step="any" value={it.cantidad} onChange={(e) => cambiarItem(i, "cantidad", e.target.value)} />
            <input className={inputCls} type="number" min="0" step="0.01" value={it.precioUnitario} onChange={(e) => cambiarItem(i, "precioUnitario", e.target.value)} />
          </div>
        ))}
      </div>
      <p className="mt-1 text-xs text-neutral-500">Precio unitario con IGV. Se conservan serie, correlativo y fecha de emisión.</p>

      {error && <p className="mt-2 text-red-600">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button
          disabled={pending}
          onClick={enviar}
          className="rounded-md bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {pending ? "Enviando..." : "Guardar y reintentar"}
        </button>
        <button disabled={pending} onClick={() => setAbierto(false)} className="rounded-md border border-neutral-300 px-3 py-2 hover:bg-neutral-100">
          Cerrar
        </button>
      </div>
    </div>
  );
}
