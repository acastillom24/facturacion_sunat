import Link from "next/link";
import { requireCompany } from "@/lib/auth/current";
import { listarComprobantes } from "@/lib/db/comprobantes";
import { hoyLimaFecha } from "@/lib/sunat/apisperu";

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente / reintentando",
  emitido: "Emitido",
  rechazado: "Rechazado",
  error: "Error",
  cancelado: "Reintento cancelado",
  anulando: "Anulando",
  anulado: "Anulado",
  error_anulacion: "Error al anular",
};

const ESTADO_CLASS: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-800",
  emitido: "bg-green-100 text-green-800",
  rechazado: "bg-red-100 text-red-800",
  error: "bg-red-100 text-red-800",
  cancelado: "bg-neutral-200 text-neutral-700",
  anulando: "bg-amber-100 text-amber-800",
  anulado: "bg-neutral-200 text-neutral-700",
  error_anulacion: "bg-red-100 text-red-800",
};

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ empresa: string }>;
  searchParams: Promise<{ fecha?: string; numero?: string }>;
}) {
  const { empresa } = await params;
  const sp = await searchParams;
  const company = await requireCompany(empresa);

  // Sin parámetro "fecha" en la URL (primera visita) -> filtra por hoy. Si el
  // usuario ya filtró (aunque sea con "" para ver todas las fechas), se respeta.
  const fecha = sp.fecha ?? hoyLimaFecha();
  const numero = sp.numero ?? "";

  const comprobantes = await listarComprobantes(company.id, { fecha, numero });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">{company.razon_social}</h1>
          <p className="text-sm text-neutral-500">RUC {company.ruc}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/${empresa}/nuevo`}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Nuevo comprobante
          </Link>
          <Link
            href={`/${empresa}/carga-masiva`}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Carga masiva
          </Link>
          <Link
            href={`/${empresa}/anulacion-masiva`}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Anulación masiva
          </Link>
          <form action={`/${empresa}/logout`} method="post">
            <button className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100">
              Salir
            </button>
          </form>
        </div>
      </header>

      <section className="mt-8">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-sm font-medium text-neutral-500">Historial de comprobantes</h2>
          <form method="get" className="flex items-end gap-3">
            <div>
              <label className="block text-xs text-neutral-500">Fecha</label>
              <input
                type="date"
                name="fecha"
                defaultValue={fecha}
                className="mt-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500">N.° de comprobante</label>
              <input
                type="text"
                name="numero"
                defaultValue={numero}
                placeholder="ej. 25"
                className="mt-1 w-32 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
            >
              Filtrar
            </button>
            <Link
              href={`/${empresa}?fecha=&numero=`}
              className="pb-1.5 text-sm text-neutral-500 underline-offset-2 hover:underline"
            >
              Ver todas las fechas
            </Link>
          </form>
        </div>
        <div className="mt-3 overflow-hidden rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-500">
              <tr>
                <th className="px-4 py-2">Documento</th>
                <th className="px-4 py-2">Cliente</th>
                <th className="px-4 py-2">Total</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {comprobantes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-neutral-400">
                    {fecha || numero ? "No hay comprobantes con esos filtros." : "Aún no hay comprobantes."}
                  </td>
                </tr>
              )}
              {comprobantes.map((c) => (
                <tr key={c.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-2">
                    <Link href={`/${empresa}/comprobantes/${c.id}`} className="font-medium text-neutral-900 underline-offset-2 hover:underline">
                      {c.tipo_doc === "01" ? "Factura" : "Boleta"} {c.serie}-{String(c.correlativo).padStart(6, "0")}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{c.cliente.rznSocial}</td>
                  <td className="px-4 py-2 text-neutral-600">
                    {c.moneda === "PEN" ? "S/" : "$"} {c.mto_imp_venta.toFixed(2)}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_CLASS[c.estado] ?? ""}`}>
                      {ESTADO_LABEL[c.estado] ?? c.estado}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-neutral-500">
                    {new Date(c.created_at).toLocaleString("es-PE")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
