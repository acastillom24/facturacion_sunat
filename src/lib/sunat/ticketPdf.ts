import { readFile } from "fs/promises";
import path from "path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { ComprobantePayload } from "./types";

const TIPO_DOC_CLIENTE: Record<string, string> = {
  "0": "S/D",
  "1": "DNI",
  "4": "C.EXT",
  "6": "RUC",
  "7": "PAS",
};

const ANCHO_TICKET = 226; // 80mm en puntos (1mm = 2.83pt)
const MARGEN = 12;
const ANCHO_UTIL = ANCHO_TICKET - MARGEN * 2;
const ANCHO_MAXIMO = 2000; // alto "de sobra" para la pasada de medición
const LOGO_ANCHO_MAX = 150;
const LOGO_ALTO_MAX = 150;

// Columnas de la tabla de ítems (suman ANCHO_UTIL = 206pt).
const COL_CANT = 26;
const COL_DESC = 82;
const COL_PUNIT = 45;
const COL_TOTAL = ANCHO_UTIL - COL_CANT - COL_DESC - COL_PUNIT;
const X_CANT = MARGEN;
const X_DESC = X_CANT + COL_CANT;
const X_PUNIT = X_DESC + COL_DESC;
const X_TOTAL = X_PUNIT + COL_PUNIT;

/** Contenido del QR según el formato estándar SUNAT para boletas/facturas. */
function contenidoQr(payload: ComprobantePayload): string {
  const emp = payload.company;
  const cli = payload.client;
  return (
    [
      emp.ruc,
      payload.tipoDoc,
      payload.serie,
      payload.correlativo,
      payload.mtoIGV.toFixed(2),
      payload.mtoImpVenta.toFixed(2),
      payload.fechaEmision.slice(0, 10),
      cli.tipoDoc,
      cli.numDoc,
    ].join("|") + "|"
  );
}

/**
 * Obtiene el logo configurado para la empresa. Si `logoUrl` empieza con "/"
 * se lee como un archivo dentro de `public/` (sin red, sin costo); si es una
 * URL completa (http/https) se descarga. Si falla o no hay logo, se omite
 * sin interrumpir el ticket.
 */
async function obtenerLogo(logoUrl: string | null | undefined): Promise<Buffer | null> {
  if (!logoUrl) return null;
  try {
    if (logoUrl.startsWith("/")) {
      return await readFile(path.join(process.cwd(), "public", logoUrl));
    }
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function dibujarTablaItems(doc: PDFKit.PDFDocument, payload: ComprobantePayload): void {
  const alturaLinea = (texto: string, ancho: number) => doc.heightOfString(texto, { width: ancho - 4 });

  const dibujarFila = (
    yInicio: number,
    altura: number,
    cant: string,
    desc: string,
    punit: string,
    total: string,
    opciones: { negrita?: boolean } = {},
  ) => {
    doc.rect(MARGEN, yInicio, ANCHO_UTIL, altura).stroke();
    [X_DESC, X_PUNIT, X_TOTAL].forEach((x) => doc.moveTo(x, yInicio).lineTo(x, yInicio + altura).stroke());
    if (opciones.negrita) doc.font("Helvetica-Bold");
    doc.text(cant, X_CANT + 2, yInicio + 2, { width: COL_CANT - 4 });
    doc.text(desc, X_DESC + 2, yInicio + 2, { width: COL_DESC - 4 });
    doc.text(punit, X_PUNIT + 2, yInicio + 2, { width: COL_PUNIT - 4, align: "right" });
    doc.text(total, X_TOTAL + 2, yInicio + 2, { width: COL_TOTAL - 4, align: "right" });
    if (opciones.negrita) doc.font("Helvetica");
  };

  // Encabezado
  doc.fontSize(8).font("Helvetica-Bold");
  const yHeader = doc.y;
  const altoHeader = 18;
  dibujarFila(yHeader, altoHeader, "Cant", "Descripcion", "P.Unit", "Total");
  doc.y = yHeader + altoHeader;

  // Filas de ítems
  doc.font("Helvetica").fontSize(8);
  for (const d of payload.details) {
    const alto = Math.max(18, alturaLinea(d.descripcion, COL_DESC) + 6);
    const yFila = doc.y;
    dibujarFila(
      yFila,
      alto,
      String(d.cantidad),
      d.descripcion,
      d.mtoPrecioUnitario.toFixed(2),
      (d.cantidad * d.mtoPrecioUnitario).toFixed(2),
    );
    doc.y = yFila + alto;
  }
}

function dibujarContenido(
  doc: PDFKit.PDFDocument,
  payload: ComprobantePayload,
  hash: string | null,
  qrBuffer: Buffer,
  logoBuffer: Buffer | null,
): void {
  const centrar = (texto: string) => doc.text(texto, MARGEN, doc.y, { width: ANCHO_UTIL, align: "center" });

  if (logoBuffer) {
    try {
      // pdfkit expone openImage() en runtime para conocer el tamaño natural
      // de la imagen antes de dibujarla, pero @types/pdfkit no lo declara.
      const docConOpenImage = doc as unknown as { openImage(src: Buffer): { width: number; height: number } };
      const img = docConOpenImage.openImage(logoBuffer);
      const escala = Math.min(LOGO_ANCHO_MAX / img.width, LOGO_ALTO_MAX / img.height, 1);
      const w = img.width * escala;
      const h = img.height * escala;
      doc.image(logoBuffer, MARGEN + (ANCHO_UTIL - w) / 2, doc.y, { width: w, height: h });
      doc.y += h + 8;
    } catch {
      // Formato de imagen no soportado por pdfkit (ej. no es png/jpg): se omite.
    }
  }

  doc.moveDown(1);
  const emp = payload.company;
  doc.font("Helvetica-Bold").fontSize(12);
  centrar(emp.razonSocial);
  if (emp.nombreComercial && emp.nombreComercial !== emp.razonSocial) {
    doc.font("Helvetica").fontSize(10);
    centrar(emp.nombreComercial);
  }
  doc.font("Helvetica").fontSize(10);
  centrar(`RUC ${emp.ruc}`);
  const direccion = emp.address?.direccion;
  if (direccion) centrar(direccion);

  doc.moveDown(1.2);
  doc.font("Helvetica-Bold").fontSize(11);
  centrar(payload.tipoDoc === "01" ? "FACTURA ELECTRONICA" : "BOLETA DE VENTA ELECTRONICA");
  centrar(`${payload.serie}-${String(payload.correlativo).padStart(6, "0")}`);
  doc.moveDown(1.2);

  // Filas simples "Etiqueta: valor" en una sola línea (etiqueta corta, ancho fijo).
  doc.font("Helvetica").fontSize(9);
  const filaSimple = (etiqueta: string, valor: string) => {
    doc.text(etiqueta, MARGEN, doc.y, { continued: true, lineBreak: false });
    doc.text(` ${valor}`, { width: ANCHO_UTIL });
    doc.moveDown(0.35);
  };
  filaSimple("Fecha:", (payload.fechaEmision ?? "").slice(0, 19).replace("T", " "));
  const cli = payload.client;
  filaSimple("Cliente:", cli.rznSocial ?? "-");
  if (cli.numDoc && cli.numDoc !== "-") {
    filaSimple(`${TIPO_DOC_CLIENTE[String(cli.tipoDoc ?? "0")] ?? "Doc."}:`, String(cli.numDoc));
  }

  doc.moveDown(0.8);
  const moneda = payload.tipoMoneda === "PEN" ? "S/" : "$";
  doc.font("Helvetica").fontSize(8);
  centrar(`Montos en ${moneda === "S/" ? "Soles" : "Dolares"}`);
  doc.moveDown(0.5);

  dibujarTablaItems(doc, payload);

  doc.moveDown(0.8);

  // Totales: etiqueta a la izquierda, monto a la derecha en la misma línea.
  doc.fontSize(9);
  const filaMonto = (etiqueta: string, valor: string, negrita = false) => {
    if (negrita) doc.font("Helvetica-Bold");
    doc.text(etiqueta, MARGEN, doc.y, { continued: true, width: ANCHO_UTIL * 0.6 });
    doc.text(valor, { align: "right", width: ANCHO_UTIL * 0.4 });
    doc.moveDown(0.35);
    if (negrita) doc.font("Helvetica");
  };
  filaMonto("Op. Gravada:", `${moneda}${payload.mtoOperGravadas.toFixed(2)}`);
  filaMonto("IGV:", `${moneda}${payload.mtoIGV.toFixed(2)}`);
  filaMonto("Total a pagar:", `${moneda}${payload.mtoImpVenta.toFixed(2)}`, true);

  doc.moveDown(1);
  const legend = payload.legends.find((l) => l.code === "1000");
  if (legend) {
    doc.text("Son: ", MARGEN, doc.y, { continued: true });
    doc.font("Helvetica-Bold").text(legend.value, { width: ANCHO_UTIL });
    doc.font("Helvetica");
  }

  doc.moveDown(1.2);
  const yQr = doc.y;
  doc.image(qrBuffer, MARGEN, yQr, { width: 100 });
  doc.fontSize(8).text(`Condicion de pago: ${payload.formaPago.tipo}`, MARGEN + 110, yQr, {
    width: ANCHO_UTIL - 110,
  });
  if (hash) doc.text(`Hash: ${hash}`, MARGEN + 110, doc.y + 4, { width: ANCHO_UTIL - 110 });
  doc.y = Math.max(doc.y, yQr + 100);

  doc.moveDown(1.2);
  doc.fontSize(8);
  centrar("Representacion impresa del comprobante electronico");
}

/** Genera el ticket (formato térmico 80mm) de un comprobante como PDF. */
export async function generarTicketPdf(
  payload: ComprobantePayload,
  hash: string | null,
  logoUrl?: string | null,
): Promise<Buffer> {
  const [qrDataUrl, logoBuffer] = await Promise.all([
    QRCode.toDataURL(contenidoQr(payload), { margin: 0, width: 150 }),
    obtenerLogo(logoUrl),
  ]);
  const qrBuffer = Buffer.from(qrDataUrl.split(",")[1], "base64");

  // Pasada 1: dibuja en una página "de sobra" solo para medir dónde termina el contenido.
  const medicion = new PDFDocument({ size: [ANCHO_TICKET, ANCHO_MAXIMO], margin: MARGEN });
  medicion.on("data", () => {});
  dibujarContenido(medicion, payload, hash, qrBuffer, logoBuffer);
  // +6pt de holgura: con el alto exacto, el redondeo de pdfkit puede disparar
  // un salto de página justo al dibujar la última línea.
  const alturaFinal = medicion.y + MARGEN + 6;
  medicion.end();

  // Pasada 2: documento real, con el alto justo para el contenido.
  const doc = new PDFDocument({ size: [ANCHO_TICKET, alturaFinal], margin: MARGEN });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const fin = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  dibujarContenido(doc, payload, hash, qrBuffer, logoBuffer);
  doc.end();
  return fin;
}
