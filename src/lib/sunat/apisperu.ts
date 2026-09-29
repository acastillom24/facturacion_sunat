import { montoEnLetras } from "./montoEnLetras";
import type {
  ClienteSunat,
  ComprobantePayload,
  DetalleSunat,
  EmpresaSunat,
  InvoiceSendResponse,
  ItemInput,
  SunatCdrResponse,
  TipoDoc,
} from "./types";

const BASE_URL = "https://facturacion.apisperu.com/api/v1";

function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

/** Fecha/hora en formato que espera SUNAT: 2025-06-26T10:30:00-05:00 (Lima, sin DST). */
export function nowLimaIso(): string {
  const now = new Date();
  const limaMs = now.getTime() - 5 * 60 * 60 * 1000; // UTC-5 fijo
  const d = new Date(limaMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const mm = pad(d.getUTCMonth() + 1);
  const dd = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mi = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}-05:00`;
}

/** Fecha de hoy en Lima como "YYYY-MM-DD" (para filtros y valores por defecto en la UI). */
export function hoyLimaFecha(): string {
  return nowLimaIso().slice(0, 10);
}

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Respuesta no JSON de APIsPERU (status ${res.status}): ${text.slice(0, 500)}`);
  }
}

export interface EmitirParams {
  empresa: EmpresaSunat;
  tipoDoc: TipoDoc;
  serie: string;
  correlativo: string | number;
  items: ItemInput[];
  cliente?: ClienteSunat;
  fechaEmision?: string;
  moneda?: string;
  formaPago?: "Contado" | "Credito";
  igvRate?: number;
}

/** Construye el payload UBL para boleta (03) o factura (01). */
export function construirPayload(params: EmitirParams): ComprobantePayload {
  const {
    empresa,
    tipoDoc,
    serie,
    correlativo,
    items,
    fechaEmision,
    moneda = "PEN",
    formaPago = "Contado",
    igvRate = 0.18,
  } = params;

  const cliente: ClienteSunat =
    params.cliente ??
    (tipoDoc === "01"
      ? (() => {
          throw new Error("Una factura (tipoDoc 01) requiere cliente con RUC");
        })()
      : { tipoDoc: "0", numDoc: "-", rznSocial: "Cliente varios" });

  const details: DetalleSunat[] = [];
  let mtoOperGravadas = 0;
  let mtoIgvTotal = 0;

  for (const it of items) {
    const cant = Number(it.cantidad);
    const precioConIgv = Number(it.precioUnitario);
    const valorUnitario = precioConIgv / (1 + igvRate);
    const valorVentaItem = round2(valorUnitario * cant);
    const igvItem = round2(valorVentaItem * igvRate);

    mtoOperGravadas += valorVentaItem;
    mtoIgvTotal += igvItem;

    details.push({
      codProducto: it.codigo ?? "",
      unidad: it.unidad ?? "NIU",
      descripcion: it.descripcion,
      cantidad: cant,
      mtoValorUnitario: round2(valorUnitario),
      mtoValorVenta: valorVentaItem,
      mtoBaseIgv: valorVentaItem,
      porcentajeIgv: igvRate * 100,
      igv: igvItem,
      tipAfeIgv: "10",
      totalImpuestos: igvItem,
      mtoPrecioUnitario: round2(precioConIgv),
    });
  }

  mtoOperGravadas = round2(mtoOperGravadas);
  mtoIgvTotal = round2(mtoIgvTotal);
  const valorVenta = mtoOperGravadas;
  const totalImpuestos = mtoIgvTotal;
  const subTotal = round2(valorVenta + totalImpuestos);
  const mtoImpVenta = subTotal;

  return {
    ublVersion: "2.1",
    tipoOperacion: "0101",
    tipoDoc,
    serie,
    correlativo: String(correlativo),
    fechaEmision: fechaEmision ?? nowLimaIso(),
    formaPago: { moneda, tipo: formaPago },
    tipoMoneda: moneda,
    client: cliente,
    company: empresa,
    mtoOperGravadas,
    mtoIGV: mtoIgvTotal,
    valorVenta,
    totalImpuestos,
    subTotal,
    mtoImpVenta,
    details,
    legends: [{ code: "1000", value: montoEnLetras(mtoImpVenta, moneda) }],
  };
}

/** Emite una boleta (03) o factura (01) ya con el payload construido. */
export async function emitirComprobante(
  token: string,
  payload: ComprobantePayload,
): Promise<InvoiceSendResponse> {
  const res = await fetch(`${BASE_URL}/invoice/send`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(payload),
  });
  const body = (await parseJsonSafe(res)) as InvoiceSendResponse;
  return body;
}

export async function consultarEstadoComprobante(
  token: string,
  params: { ruc: string; tipo: TipoDoc; serie: string; numero: string | number },
): Promise<SunatCdrResponse> {
  const qs = new URLSearchParams({
    tipo: params.tipo,
    serie: params.serie,
    numero: String(params.numero),
    ruc: params.ruc,
  });
  const res = await fetch(`${BASE_URL}/invoice/status?${qs.toString()}`, {
    headers: headers(token),
  });
  return (await parseJsonSafe(res)) as SunatCdrResponse;
}

export async function descargarPdfComprobante(
  token: string,
  payload: ComprobantePayload,
): Promise<ArrayBuffer> {
  const res = await fetch(`${BASE_URL}/invoice/pdf`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await parseJsonSafe(res).catch(() => null);
    throw new Error(`Error generando PDF (status ${res.status}): ${JSON.stringify(body)}`);
  }
  return res.arrayBuffer();
}

// ---------------------------------------------------------------------------
// Anulación de BOLETAS: Resumen Diario con detalle en estado "3" (baja)
// ---------------------------------------------------------------------------

export interface AnularBoletaParams {
  token: string;
  empresa: EmpresaSunat;
  serie: string;
  correlativo: string | number;
  correlativoResumen: string | number;
  total: number;
  clienteTipo?: string;
  clienteNumero?: string;
  fechaEmisionBoleta?: string;
  fechaResumen?: string;
  moneda?: string;
  igvRate?: number;
}

export async function anularBoleta(params: AnularBoletaParams): Promise<SunatCdrResponse> {
  const {
    token,
    empresa,
    serie,
    correlativo,
    correlativoResumen,
    total,
    clienteTipo = "0",
    clienteNumero = "-",
    fechaEmisionBoleta,
    fechaResumen,
    moneda = "PEN",
    igvRate = 0.18,
  } = params;

  const totalR = round2(total);
  const base = totalR / (1 + igvRate);
  const igv = round2(totalR - base);
  const gravadas = round2(totalR - igv);

  const detalle = {
    tipoDoc: "03",
    serieNro: `${serie}-${correlativo}`,
    estado: "3",
    clienteTipo,
    clienteNro: String(clienteNumero),
    total: totalR,
    mtoOperGravadas: gravadas,
    mtoIGV: igv,
    porcentajeIgv: igvRate * 100,
  };

  const payload = {
    fecGeneracion: fechaEmisionBoleta ?? nowLimaIso(),
    fecResumen: fechaResumen ?? nowLimaIso(),
    correlativo: String(correlativoResumen),
    moneda,
    company: empresa,
    details: [detalle],
  };

  const res = await fetch(`${BASE_URL}/summary/send`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(payload),
  });
  const body = (await parseJsonSafe(res)) as { sunatResponse?: SunatCdrResponse };
  return body.sunatResponse ?? (body as SunatCdrResponse);
}

export async function consultarTicketResumen(
  token: string,
  ticket: string,
  ruc: string,
): Promise<SunatCdrResponse> {
  const qs = new URLSearchParams({ ticket, ruc });
  const res = await fetch(`${BASE_URL}/summary/status?${qs.toString()}`, {
    headers: headers(token),
  });
  return (await parseJsonSafe(res)) as SunatCdrResponse;
}

// ---------------------------------------------------------------------------
// Anulación de FACTURAS: Comunicación de Baja (/voided/send)
// ---------------------------------------------------------------------------

export interface AnularFacturaParams {
  token: string;
  empresa: EmpresaSunat;
  serie: string;
  correlativo: string | number;
  correlativoBaja: string | number;
  motivo: string;
  fechaEmisionFactura?: string;
  fechaComunicacion?: string;
}

export async function anularFactura(params: AnularFacturaParams): Promise<SunatCdrResponse> {
  const {
    token,
    empresa,
    serie,
    correlativo,
    correlativoBaja,
    motivo,
    fechaEmisionFactura,
    fechaComunicacion,
  } = params;

  const payload = {
    correlativo: String(correlativoBaja),
    fecGeneracion: fechaEmisionFactura ?? nowLimaIso(),
    fecComunicacion: fechaComunicacion ?? nowLimaIso(),
    company: empresa,
    details: [
      {
        tipoDoc: "01",
        serie,
        correlativo: String(correlativo),
        desMotivoBaja: motivo,
      },
    ],
  };

  const res = await fetch(`${BASE_URL}/voided/send`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(payload),
  });
  const body = (await parseJsonSafe(res)) as { sunatResponse?: SunatCdrResponse };
  return body.sunatResponse ?? (body as SunatCdrResponse);
}

export async function consultarTicketBaja(
  token: string,
  ticket: string,
  ruc: string,
): Promise<SunatCdrResponse> {
  const qs = new URLSearchParams({ ticket, ruc });
  const res = await fetch(`${BASE_URL}/voided/status?${qs.toString()}`, {
    headers: headers(token),
  });
  return (await parseJsonSafe(res)) as SunatCdrResponse;
}
