import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCompany } from "@/lib/auth/current";
import { obtenerComprobante } from "@/lib/db/comprobantes";
import { AnularForm } from "./AnularForm";
import { CancelarReintentoButton } from "./CancelarReintentoButton";
import { ReintentarButton } from "./ReintentarButton";

export default async function ComprobanteDetallePage({
  params,
}: {
  params: Promise<{ empresa: string; id: string }>;
}) {
  const { empresa, id } = await params;
  const company = await requireCompany(empresa);
  const comprobante = await obtenerComprobante(company.id, id);
  if (!comprobante) notFound();

  const moneda = comprobante.moneda === "PEN" ? "S/" : "$";
  const puedeReintentar = comprobante.estado === "pendiente" || comprobante.estado === "error";
  const puedeCancelarReintento = comprobante.estado === "pendiente";
  const puedeAnular = comprobante.estado === "emitido" || comprobante.estado === "error_anulacion";

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href={`/${empresa}`} className="text-sm text-indigo-600 hover:underline">
        ← Volver al historial
      </Link>

      <h1 className="mt-2 text-lg font-semibold text-neutral-900">
        {comprobante.tipo_doc === "01" ? "Factura" : "Boleta"} {comprobante.serie}-
        {String(comprobante.correlativo).padStart(6, "0")}
      </h1>
      <p className="text-sm text-neutral-500">Estado: {comprobante.estado}</p>

      <section className="mt-6 rounded-lg border border-neutral-200 p-4 text-sm">
        <dl className="grid grid-cols-2 gap-2">
          <dt className="text-neutral-500">Cliente</dt>
          <dd>{comprobante.cliente.rznSocial}</dd>
          <dt className="text-neutral-500">Documento</dt>
          <dd>{comprobante.cliente.numDoc}</dd>
          <dt className="text-neutral-500">Fecha emisión</dt>
          <dd>{new Date(comprobante.fecha_emision).toLocaleString("es-PE", { timeZone: "America/Lima" })}</dd>
          <dt className="text-neutral-500">Total</dt>
          <dd>{moneda} {comprobante.mto_imp_venta.toFixed(2)}</dd>
          <dt className="text-neutral-500">Intentos de emisión</dt>
          <dd>{comprobante.intentos}</dd>
          {comprobante.proximo_intento_at && (
            <>
              <dt className="text-neutral-500">Próximo reintento</dt>
              <dd>{new Date(comprobante.proximo_intento_at).toLocaleString("es-PE", { timeZone: "America/Lima" })}</dd>
            </>
          )}
        </dl>
      </section>

      <section className="mt-4 rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-medium text-neutral-700">Ítems</h2>
        <table className="mt-2 w-full text-sm">
          <tbody>
            {comprobante.items.map((it, i) => (
              <tr key={i} className="border-t border-neutral-100">
                <td className="py-1">{it.descripcion}</td>
                <td className="py-1 text-right">{it.cantidad}</td>
                <td className="py-1 text-right">{moneda} {Number(it.precioUnitario).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {comprobante.sunat_response && (
        <section className="mt-4 rounded-lg border border-neutral-200 p-4">
          <h2 className="text-sm font-medium text-neutral-700">Respuesta SUNAT / APIsPERU</h2>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-neutral-600">
            {JSON.stringify(comprobante.sunat_response, null, 2)}
          </pre>
        </section>
      )}

      {comprobante.anulacion && (
        <section className="mt-4 rounded-lg border border-neutral-200 p-4">
          <h2 className="text-sm font-medium text-neutral-700">Anulación</h2>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-neutral-600">
            {JSON.stringify(comprobante.anulacion, null, 2)}
          </pre>
        </section>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        {comprobante.estado === "emitido" && (
          <>
            <a
              href={`/${empresa}/comprobantes/${comprobante.id}/pdf`}
              target="_blank"
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100"
            >
              Descargar PDF (A4)
            </a>
            <a
              href={`/${empresa}/comprobantes/${comprobante.id}/ticket`}
              target="_blank"
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100"
            >
              Descargar ticket (80mm)
            </a>
          </>
        )}
        {puedeReintentar && <ReintentarButton slug={empresa} id={comprobante.id} />}
        {puedeCancelarReintento && <CancelarReintentoButton slug={empresa} id={comprobante.id} />}
        {puedeAnular && <AnularForm slug={empresa} id={comprobante.id} esFactura={comprobante.tipo_doc === "01"} />}
      </div>
    </main>
  );
}
