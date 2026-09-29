import type { Company } from "@/lib/db/companies";
import { companyToEmpresaSunat } from "@/lib/db/companies";
import { crearComprobantePendiente } from "@/lib/db/comprobantes";
import { siguienteCorrelativo } from "@/lib/db/correlativos";
import type { FilaCargaCruda } from "@/lib/excel/plantilla";
import { construirPayload } from "./apisperu";
import { intentarEmitir } from "./emision";
import type { TipoDoc } from "./types";
import { inferirClienteDesdeDocumento, validarCliente } from "./validacion";

/**
 * Límite de filas por archivo para no exceder el tiempo máximo de la función
 * serverless. En el plan Hobby de Vercel el límite de duración es 60s; con este
 * tope y llamadas de ~1s a APIsPERU debería sobrar margen. Si tienes Vercel Pro
 * puedes subir este valor y `maxDuration` en `carga-masiva/page.tsx`.
 */
export const MAX_FILAS_CARGA_MASIVA = 40;

const SERIE_DEFAULT: Record<TipoDoc, string> = { "01": "F001", "03": "B001" };

export interface ResultadoFilaCarga {
  fila: number;
  tipoDoc?: TipoDoc;
  serie?: string;
  correlativo?: number;
  cliente?: string;
  total?: number;
  estado: "emitido" | "pendiente" | "error" | "invalido";
  mensaje?: string;
  id?: string;
}

function parseNumero(texto: string | undefined): number | null {
  if (!texto) return null;
  const n = Number(texto.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

async function procesarFila(company: Company, fila: FilaCargaCruda): Promise<ResultadoFilaCarga> {
  const v = fila.valores;

  const tipoLetra = (v.tipo ?? "").trim().toUpperCase().charAt(0);
  const tipoDoc: TipoDoc | null = tipoLetra === "B" ? "03" : tipoLetra === "F" ? "01" : null;
  if (!tipoDoc) {
    return { fila: fila.fila, estado: "invalido", mensaje: 'Columna "Tipo" debe ser B (boleta) o F (factura)' };
  }

  const serie = (v.serie || SERIE_DEFAULT[tipoDoc]).trim().toUpperCase();
  if (!/^[A-Z]\d{3}$/.test(serie)) {
    return { fila: fila.fila, tipoDoc, estado: "invalido", mensaje: `Serie inválida "${serie}" (debe ser 1 letra + 3 dígitos, ej. B001)` };
  }

  const descripcion = (v.descripcion ?? "").trim();
  if (!descripcion) {
    return { fila: fila.fila, tipoDoc, serie, estado: "invalido", mensaje: "Falta la descripción del ítem" };
  }

  const cantidad = parseNumero(v.cantidad);
  if (cantidad === null || cantidad <= 0) {
    return { fila: fila.fila, tipoDoc, serie, estado: "invalido", mensaje: `Cantidad inválida ("${v.cantidad ?? ""}")` };
  }

  const precioUnitario = parseNumero(v.precioUnitario);
  if (precioUnitario === null || precioUnitario <= 0) {
    return { fila: fila.fila, tipoDoc, serie, estado: "invalido", mensaje: `Precio unitario inválido ("${v.precioUnitario ?? ""}")` };
  }

  const clienteResult = inferirClienteDesdeDocumento(v.documento, v.nombre);
  if ("error" in clienteResult) {
    return { fila: fila.fila, tipoDoc, serie, estado: "invalido", mensaje: clienteResult.error };
  }
  const cliente = clienteResult.cliente;

  const total = cantidad * precioUnitario;
  const errorCliente = validarCliente(tipoDoc, cliente, total);
  if (errorCliente) {
    return { fila: fila.fila, tipoDoc, serie, cliente: cliente.rznSocial, total, estado: "invalido", mensaje: errorCliente };
  }

  const moneda = (v.moneda || "PEN").trim().toUpperCase();
  const formaPago = /credito/i.test(v.formaPago ?? "") ? "Credito" : "Contado";

  const correlativo = await siguienteCorrelativo(company.id, tipoDoc, serie);
  const payload = construirPayload({
    empresa: companyToEmpresaSunat(company),
    tipoDoc,
    serie,
    correlativo,
    items: [{ descripcion, cantidad, precioUnitario, codigo: v.codigo || undefined }],
    cliente,
    moneda,
    formaPago,
    igvRate: Number(company.igv_rate),
  });

  const comprobante = await crearComprobantePendiente({
    companyId: company.id,
    tipoDoc,
    serie,
    correlativo,
    moneda: payload.tipoMoneda,
    formaPago: payload.formaPago.tipo,
    cliente,
    items: [{ descripcion, cantidad, precioUnitario, codigo: v.codigo || undefined }],
    payload,
  });

  const { estadoFinal } = await intentarEmitir(comprobante, company.apisperu_token);

  return {
    fila: fila.fila,
    tipoDoc,
    serie,
    correlativo,
    cliente: cliente.rznSocial,
    total: payload.mtoImpVenta,
    estado: estadoFinal as ResultadoFilaCarga["estado"],
    id: comprobante.id,
  };
}

/** Procesa las filas EN ORDEN (no en paralelo): el correlativo de cada serie depende del anterior. */
export async function procesarCargaMasiva(
  company: Company,
  filas: FilaCargaCruda[],
): Promise<ResultadoFilaCarga[]> {
  const resultados: ResultadoFilaCarga[] = [];
  for (const fila of filas) {
    resultados.push(await procesarFila(company, fila));
  }
  return resultados;
}
