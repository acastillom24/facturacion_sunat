import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";
import { getCompanyFromSession } from "@/lib/auth/current";
import { obtenerComprobante } from "@/lib/db/comprobantes";
import { generarTicketPdf } from "@/lib/sunat/ticketPdf";

const MAX_IDS = 100;

/**
 * Genera un .zip con el ticket (PDF 80mm) de cada comprobante indicado,
 * nombrado "{prefijo}_{serie}-{correlativo}.pdf" (sin prefijo: "{serie}-{correlativo}.pdf"). Pensado para usarse justo después
 * de una carga masiva, con los ids que quedaron "emitido" en esa corrida.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ empresa: string }> }) {
  const { empresa } = await params;
  const company = await getCompanyFromSession(empresa);
  if (!company) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const archivos: { id: string; prefijo: string }[] = Array.isArray(body?.archivos)
    ? body.archivos
        .filter((x: unknown): x is { id: string; prefijo?: unknown } => typeof (x as { id?: unknown })?.id === "string")
        .map((x: { id: string; prefijo?: unknown }) => ({ id: x.id, prefijo: typeof x.prefijo === "string" ? x.prefijo : "" }))
    : [];
  const ids = archivos.map((a) => a.id);
  if (ids.length === 0) return NextResponse.json({ error: "No se indicaron comprobantes" }, { status: 400 });
  if (ids.length > MAX_IDS) {
    return NextResponse.json({ error: `Máximo ${MAX_IDS} comprobantes por descarga` }, { status: 400 });
  }

  const zip = new JSZip();
  let agregados = 0;

  const nombresUsados = new Set<string>();
  for (const { id, prefijo } of archivos) {
    const comprobante = await obtenerComprobante(company.id, id);
    if (!comprobante || comprobante.estado !== "emitido") continue;
    const pdf = await generarTicketPdf(comprobante.payload, comprobante.hash, company.logo_url);
    // "{prefijo}_B001-5744.pdf"; sin prefijo, solo "B001-5744.pdf".
    const prefijoLimpio = prefijo.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").trim();
    const base = `${comprobante.serie}-${comprobante.correlativo}`;
    let nombre = `${prefijoLimpio ? `${prefijoLimpio}_` : ""}${base}`;
    for (let n = 2; nombresUsados.has(nombre); n++) nombre = `${prefijoLimpio ? `${prefijoLimpio}_` : ""}${base}_${n}`;
    nombresUsados.add(nombre);
    zip.file(`${nombre}.pdf`, pdf);
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
