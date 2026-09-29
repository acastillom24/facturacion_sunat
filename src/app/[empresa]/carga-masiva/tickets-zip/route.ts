import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";
import { getCompanyFromSession } from "@/lib/auth/current";
import { obtenerComprobante } from "@/lib/db/comprobantes";
import { generarTicketPdf } from "@/lib/sunat/ticketPdf";

const MAX_IDS = 100;

/**
 * Genera un .zip con el ticket (PDF 80mm) de cada comprobante indicado,
 * nombrado "{serie}-{correlativo}.pdf". Pensado para usarse justo después
 * de una carga masiva, con los ids que quedaron "emitido" en esa corrida.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ empresa: string }> }) {
  const { empresa } = await params;
  const company = await getCompanyFromSession(empresa);
  if (!company) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x: unknown): x is string => typeof x === "string") : [];
  if (ids.length === 0) return NextResponse.json({ error: "No se indicaron comprobantes" }, { status: 400 });
  if (ids.length > MAX_IDS) {
    return NextResponse.json({ error: `Máximo ${MAX_IDS} comprobantes por descarga` }, { status: 400 });
  }

  const zip = new JSZip();
  let agregados = 0;

  for (const id of ids) {
    const comprobante = await obtenerComprobante(company.id, id);
    if (!comprobante || comprobante.estado !== "emitido") continue;
    const pdf = await generarTicketPdf(comprobante.payload, comprobante.hash, company.logo_url);
    const nombre = `${comprobante.serie}-${String(comprobante.correlativo).padStart(6, "0")}.pdf`;
    zip.file(nombre, pdf);
    agregados++;
  }

  if (agregados === 0) {
    return NextResponse.json({ error: "Ninguno de los comprobantes indicados está emitido" }, { status: 400 });
  }

  const contenido = await zip.generateAsync({ type: "nodebuffer" });
  const fecha = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(contenido), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="tickets-${fecha}.zip"`,
    },
  });
}
