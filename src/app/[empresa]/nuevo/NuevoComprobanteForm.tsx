"use client";

import { useActionState, useEffect, useState } from "react";
import { crearComprobanteAction } from "../actions";

interface ItemRow {
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
  codigo: string;
}

const ITEM_VACIO: ItemRow = { descripcion: "", cantidad: "1", precioUnitario: "", codigo: "" };

const SERIE_DEFAULT: Record<"01" | "03", string> = { "01": "F001", "03": "B001" };

const UMBRAL_DNI_BOLETA = 699;

export function NuevoComprobanteForm({ slug }: { slug: string }) {
  const [tipoDoc, setTipoDoc] = useState<"01" | "03">("03");
  const [serie, setSerie] = useState(SERIE_DEFAULT["03"]);
  const [items, setItems] = useState<ItemRow[]>([{ ...ITEM_VACIO }]);
  const [clienteTipoDoc, setClienteTipoDoc] = useState("0");
  const [clienteNumDoc, setClienteNumDoc] = useState("");

  function cambiarTipoDoc(nuevo: "01" | "03") {
    setTipoDoc(nuevo);
    // Si el usuario no tocó la serie (sigue en el valor por defecto del otro tipo), la actualizamos.
    if (serie === SERIE_DEFAULT[tipoDoc]) setSerie(SERIE_DEFAULT[nuevo]);
    setClienteTipoDoc(nuevo === "01" ? "6" : "0");
  }

  const serieValida = /^[A-Z]\d{3}$/.test(serie);
  const [proximoCorrelativo, setProximoCorrelativo] = useState<number | null>(null);

  useEffect(() => {
    if (!serieValida) return;
    const controller = new AbortController();
    fetch(`/${slug}/proximo-correlativo?tipoDoc=${tipoDoc}&serie=${serie}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setProximoCorrelativo(data?.correlativo ?? null))
      .catch(() => {});
    return () => controller.abort();
  }, [slug, tipoDoc, serie, serieValida]);

  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      formData.set("items", JSON.stringify(
        items
          .filter((it) => it.descripcion.trim())
          .map((it) => ({
            descripcion: it.descripcion,
            cantidad: Number(it.cantidad),
            precioUnitario: Number(it.precioUnitario),
            codigo: it.codigo || undefined,
          })),
      ));
      return (await crearComprobanteAction(slug, formData)) ?? {};
    },
    {},
  );

  const total = items.reduce((acc, it) => acc + (Number(it.cantidad) || 0) * (Number(it.precioUnitario) || 0), 0);
  const requiereDni = tipoDoc === "03" && total > UMBRAL_DNI_BOLETA;
  const dniFaltante = requiereDni && (clienteTipoDoc !== "1" || !/^\d{8}$/.test(clienteNumDoc));

  function actualizarItem(i: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="tipoDoc" value={tipoDoc} />

      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={tipoDoc === "03"} onChange={() => cambiarTipoDoc("03")} /> Boleta
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={tipoDoc === "01"} onChange={() => cambiarTipoDoc("01")} /> Factura
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700">Serie</label>
          <input
            name="serie"
            required
            value={serie}
            onChange={(e) => setSerie(e.target.value.toUpperCase())}
            pattern="[A-Z]\d{3}"
            maxLength={4}
            title="1 letra + 3 dígitos, ej. B001"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm uppercase"
          />
          <p className="mt-1 text-xs text-neutral-400">
            Se mantiene fija (ej. {SERIE_DEFAULT[tipoDoc]}); el número de comprobante lo asigna el sistema.
          </p>
          {serieValida && proximoCorrelativo !== null && (
            <p className="mt-1 text-xs font-medium text-neutral-600">
              Se emitirá como {serie}-{String(proximoCorrelativo).padStart(6, "0")}
            </p>
          )}
        </div>
      </div>

      <fieldset className="rounded-md border border-neutral-200 p-4">
        <legend className="px-1 text-sm font-medium text-neutral-700">Cliente</legend>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-neutral-500">Tipo doc.</label>
            <select
              name="clienteTipoDoc"
              value={clienteTipoDoc}
              onChange={(e) => setClienteTipoDoc(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="0">Sin documento</option>
              <option value="1">DNI</option>
              <option value="6">RUC</option>
              <option value="4">Carnet ext.</option>
              <option value="7">Pasaporte</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Número</label>
            <input
              name="clienteNumDoc"
              value={clienteNumDoc}
              onChange={(e) => setClienteNumDoc(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Nombre / Razón social</label>
            <input name="clienteRznSocial" className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
        </div>
        {dniFaltante && (
          <p className="mt-3 text-xs font-medium text-amber-700">
            El total (S/ {total.toFixed(2)}) supera S/ {UMBRAL_DNI_BOLETA}: selecciona &quot;DNI&quot; e ingresa los 8 dígitos para poder emitir.
          </p>
        )}
      </fieldset>

      <fieldset className="rounded-md border border-neutral-200 p-4">
        <legend className="px-1 text-sm font-medium text-neutral-700">Ítems (precio con IGV incluido)</legend>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <input
                placeholder="Descripción"
                value={it.descripcion}
                onChange={(e) => actualizarItem(i, { descripcion: e.target.value })}
                className="col-span-5 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              />
              <input
                placeholder="Cant."
                type="number"
                min="0"
                step="0.01"
                value={it.cantidad}
                onChange={(e) => actualizarItem(i, { cantidad: e.target.value })}
                className="col-span-2 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              />
              <input
                placeholder="Precio unit."
                type="number"
                min="0"
                step="0.01"
                value={it.precioUnitario}
                onChange={(e) => actualizarItem(i, { precioUnitario: e.target.value })}
                className="col-span-2 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              />
              <input
                placeholder="Código"
                value={it.codigo}
                onChange={(e) => actualizarItem(i, { codigo: e.target.value })}
                className="col-span-2 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                className="col-span-1 text-sm text-red-600"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setItems((prev) => [...prev, { ...ITEM_VACIO }])}
          className="mt-3 text-sm text-neutral-600 underline"
        >
          + Agregar ítem
        </button>
        <p className="mt-3 text-right text-sm font-medium text-neutral-900">Total: S/ {total.toFixed(2)}</p>
      </fieldset>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60"
      >
        {pending ? "Emitiendo..." : "Emitir"}
      </button>
    </form>
  );
}
