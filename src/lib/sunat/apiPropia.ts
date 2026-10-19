import { descifrar } from "@/lib/crypto/secretos";
import type { ComprobantePayload, InvoiceSendResponse, SunatCdrResponse, TipoDoc } from "./types";

/**
 * Cliente de la API propia (repo `apis`, POST /v1/sunat/documents).
 * Traduce el payload con formato APIsPERU que ya arma `construirPayload` y
 * devuelve la respuesta con la forma que espera el resto de la app.
 *
 * Variable: SUNAT_API_URL (p. ej. http://localhost:3000). La API key es el token de cada empresa.
 * La empresa se elige con la cabecera x-ruc.
 */

export const TIMEOUT_MS = 40_000;

/** El proveedor lo define el admin por empresa (`companies.sunat_provider`). */
export function usaApiPropia(company: { sunat_provider?: string | null }): boolean {
  return company.sunat_provider === "propia";
}

/** Proveedor con el que se emitió el comprobante (si se desconoce, el actual de la empresa). */
export function proveedorDe(
  comprobante: { sunat_provider: "apisperu" | "propia" | null },
  company: { sunat_provider?: string | null },
): { sunat_provider: "apisperu" | "propia" } {
  return { sunat_provider: comprobante.sunat_provider ?? (company.sunat_provider === "propia" ? "propia" : "apisperu") };
}

/** Token de APIsPERU de la empresa; falla con un mensaje claro si no está cargado. */
export function tokenApisperu(company: { apisperu_token: string | null }): string {
  if (!company.apisperu_token) throw new Error("La empresa no tiene token de APIsPERU configurado");
  return descifrar(company.apisperu_token);
}

export function config(key: string): { url: string; key: string } {
  const url = process.env.SUNAT_API_URL?.replace(/\/+$/, "");
  if (!url) throw new Error("Falta SUNAT_API_URL para la API propia");
  return { url, key };
}

interface ApiPropiaRespuesta {
  success?: boolean;
  message?: string;
  error?: string;
  payload?: {
    estado?: string;
    hash?: string;
    xml?: string;
    cdr?: string;
    pdf?: { ticket?: string; a4?: string };
    sunat?: { codigo?: string; descripcion?: string; observaciones?: string[] };
  };
}

export function aFormatoApiPropia(p: ComprobantePayload) {
  const hora = p.fechaEmision.slice(11, 19);
  return {
    documento: p.tipoDoc === "01" ? "factura" : "boleta",
    serie: p.serie,
    numero: Number(p.correlativo),
    fecha_de_emision: p.fechaEmision.slice(0, 10),
    ...(hora ? { hora_de_emision: hora } : {}),
    moneda: p.tipoMoneda,
    tipo_operacion: p.tipoOperacion,
    cliente_tipo_de_documento: p.client.tipoDoc,
    cliente_numero_de_documento: p.client.numDoc,
    cliente_denominacion: p.client.rznSocial,
    cliente_direccion: "-",
    items: p.details.map((d) => ({
      unidad_de_medida: d.unidad,
      ...(d.codProducto ? { codigo_interno: d.codProducto } : {}),
      descripcion: d.descripcion,
      cantidad: String(d.cantidad),
      // Se parte del precio con IGV (ya redondeado a 2) para que el total cuadre.
      valor_unitario: (d.mtoPrecioUnitario / (1 + d.porcentajeIgv / 100)).toFixed(10),
      porcentaje_igv: String(d.porcentajeIgv),
      codigo_tipo_afectacion_igv: d.tipAfeIgv,
    })),
    total: p.mtoImpVenta.toFixed(2),
  };
}

export async function emitirComprobantePropio(payload: ComprobantePayload, token: string): Promise<InvoiceSendResponse> {
  const { url, key } = config(token);
  const res = await fetch(`${url}/v1/sunat/documents`, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "x-ruc": payload.company.ruc,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(aFormatoApiPropia(payload)),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  let body: ApiPropiaRespuesta;
  try {
    body = JSON.parse(text) as ApiPropiaRespuesta;
  } catch {
    throw new Error(`Respuesta no JSON de la API propia (status ${res.status}): ${text.slice(0, 300)}`);
  }

  // Fallos de infraestructura (5xx, 401, 429): se lanzan para que se reintente.
  if (res.status >= 500 || res.status === 401 || res.status === 403 || res.status === 429) {
    throw new Error(`API propia respondió ${res.status}: ${body.message ?? text.slice(0, 200)}`);
  }

  const sunat = body.payload?.sunat;
  const aceptado = body.success === true && body.payload?.estado === "ACEPTADO";
  if (aceptado) {
    return {
      sunatResponse: {
        success: true,
        cdrResponse: { code: sunat?.codigo, description: sunat?.descripcion, notes: sunat?.observaciones ?? [] },
      },
      xml: body.payload?.xml,
      hash: body.payload?.hash,
      cdrUrl: body.payload?.cdr,
      pdf: body.payload?.pdf,
    };
  }
  return {
    sunatResponse: {
      success: false,
      error: { code: sunat?.codigo ?? String(res.status), message: sunat?.descripcion ?? body.message ?? body.error ?? "Rechazado" },
    },
  };
}

// ---------------------------------------------------------------------------
// Anulación y PDF
// ---------------------------------------------------------------------------

interface RespuestaOperacion extends ApiPropiaRespuesta {
  payload?: ApiPropiaRespuesta["payload"] & { ticket?: string };
}

async function postJson(path: string, ruc: string, token: string, cuerpo: unknown): Promise<{ status: number; body: RespuestaOperacion }> {
  const { url, key } = config(token);
  const res = await fetch(`${url}${path}`, {
    method: "POST",
    headers: { "x-api-key": key, "x-ruc": ruc, "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  let body: RespuestaOperacion;
  try {
    body = JSON.parse(text) as RespuestaOperacion;
  } catch {
    throw new Error(`Respuesta no JSON de la API propia (status ${res.status}): ${text.slice(0, 300)}`);
  }
  if (res.status >= 500 || res.status === 401 || res.status === 403 || res.status === 429) {
    throw new Error(`API propia respondió ${res.status}: ${body.message ?? text.slice(0, 200)}`);
  }
  return { status: res.status, body };
}

/** Convierte la respuesta de baja/resumen al formato que usa anularComprobante (`ticket` = aceptado). */
function aRespuestaAnulacion(status: number, body: RespuestaOperacion): SunatCdrResponse {
  const ticket = body.payload?.ticket;
  if (body.success === true && ticket) {
    return {
      success: true,
      ticket,
      cdrResponse: { code: body.payload?.sunat?.codigo, description: body.payload?.sunat?.descripcion },
    };
  }
  return { success: false, error: { code: String(status), message: body.message ?? body.error ?? "Rechazado" } };
}

/** Boleta: resumen diario con la boleta en acción "anular". La API calcula todo desde su propia copia. */
export async function anularBoletaPropia(p: { token: string; ruc: string; serie: string; correlativo: string | number }): Promise<SunatCdrResponse> {
  const { status, body } = await postJson("/v1/sunat/daily-summary", p.ruc, p.token, {
    documentos_afectados: [{ documento: "boleta", serie: p.serie, numero: Number(p.correlativo), accion_resumen: "anular" }],
  });
  return aRespuestaAnulacion(status, body);
}

/** Factura: comunicación de baja. */
export async function anularFacturaPropia(p: {
  token: string;
  ruc: string;
  serie: string;
  correlativo: string | number;
  motivo: string;
}): Promise<SunatCdrResponse> {
  const { status, body } = await postJson("/v1/sunat/voided", p.ruc, p.token, {
    motivo: p.motivo.slice(0, 100),
    documento_afectado: { documento: "factura", serie: p.serie, numero: Number(p.correlativo) },
  });
  return aRespuestaAnulacion(status, body);
}

/** PDF A4 del comprobante: consulta su estado, y descarga el archivo del enlace que devuelve la API. */
export async function descargarPdfPropio(p: { token: string; ruc: string; tipoDoc: TipoDoc; serie: string; correlativo: string | number }): Promise<ArrayBuffer> {
  const { status, body } = await postJson("/v1/sunat/status", p.ruc, p.token, {
    documento: p.tipoDoc === "01" ? "factura" : "boleta",
    serie: p.serie,
    numero: Number(p.correlativo),
  });
  const enlace = body.payload?.pdf?.a4;
  if (!enlace) throw new Error(`La API propia no devolvió el PDF (status ${status}): ${body.message ?? ""}`);
  const res = await fetch(enlace, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Error descargando el PDF (status ${res.status})`);
  return res.arrayBuffer();
}
