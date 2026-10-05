import Link from "next/link";
import { requireCompany } from "@/lib/auth/current";
import { listarComprobantes } from "@/lib/db/comprobantes";
import { FiltroFechas } from "./FiltroFechas";
import { TablaComprobantes } from "./TablaComprobantes";
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
  emitido: "bg-emerald-100 text-emerald-800",
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
  searchParams: Promise<{ desde?: string; hasta?: string; numero?: string }>;
}) {
  const { empresa } = await params;
  const sp = await searchParams;
  const company = await requireCompany(empresa);

  // Sin parámetros (primera visita) -> filtra por hoy. Si el usuario ya filtró
  // (aunque sea con "" para ver todas las fechas), se respeta.
  const sinFiltro = sp.desde === undefined && sp.hasta === undefined;
  const desde = sinFiltro ? hoyLimaFecha() : (sp.desde ?? "");
  const hasta = sinFiltro ? hoyLimaFecha() : (sp.hasta ?? "");
  const numero = sp.numero ?? "";

  const comprobantes = await listarComprobantes(company.id, { desde, hasta, numero });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          {company.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logo_url} alt="" className="h-12 w-12 rounded-lg border border-neutral-200 object-contain p-1" />
          )}
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">{company.razon_social}</h1>
            <p className="text-sm text-neutral-500">RUC {company.ruc}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${empresa}/nuevo`}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            + Nuevo comprobante
          </Link>
          <Link
            href={`/${empresa}/carga-masiva`}
            className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
          >
            Carga masiva
          </Link>
          <Link
            href={`/${empresa}/anulacion-masiva`}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Anulación masiva
          </Link>
          <form action={`/${empresa}/logout`} method="post">
            <button className="rounded-md px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100">Salir</button>
          </form>
        </div>
      </header>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-neutral-700">Historial de comprobantes</h2>
        <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <FiltroFechas slug={empresa} desde={desde} hasta={hasta} numero={numero} />
        </div>
        <TablaComprobantes
          slug={empresa}
          vacio={desde || hasta || numero ? "No hay comprobantes con esos filtros." : "Aún no hay comprobantes."}
          filas={comprobantes.map((c) => ({
            id: c.id,
            documento: `${c.tipo_doc === "01" ? "Factura" : "Boleta"} ${c.serie}-${String(c.correlativo).padStart(6, "0")}`,
            cliente: c.cliente.rznSocial,
            total: `${c.moneda === "PEN" ? "S/" : "$"} ${c.mto_imp_venta.toFixed(2)}`,
            estadoLabel: ESTADO_LABEL[c.estado] ?? c.estado,
            estadoClass: ESTADO_CLASS[c.estado] ?? "",
            fecha: new Date(c.created_at).toLocaleString("es-PE", { timeZone: "America/Lima" }),
          }))}
        />
      </section>
    </main>
  );
}
