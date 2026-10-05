import type { Company } from "@/lib/db/companies";
import { MAX_COMPROBANTES_POR_LOTE } from "@/lib/limites";
import { companyToEmpresaSunat } from "@/lib/db/companies";
import { crearComprobantePendiente } from "@/lib/db/comprobantes";
import { siguienteCorrelativo } from "@/lib/db/correlativos";
import type { FilaCargaCruda } from "@/lib/excel/plantilla";
import { construirPayload } from "./apisperu";
import { intentarEmitir } from "./emision";
import type { ItemInput, TipoDoc } from "./types";
import { inferirClienteDesdeDocumento, validarCliente } from "./validacion";

/**
 * Límite de COMPROBANTES (grupos de filas, no filas) por archivo. Se emiten de a uno desde el
 * cliente (una llamada corta por comprobante), así que solo acota el tamaño de la corrida.
 */
export const MAX_FILAS_CARGA_MASIVA = MAX_COMPROBANTES_POR_LOTE;

const SERIE_DEFAULT: Record<TipoDoc, string> = { "01": "F001", "03": "B001" };

export interface ResultadoFilaCarga {
  filas: number[]; // filas del Excel que forman este comprobante (varias si tenía Grupo)
  tipoDoc?: TipoDoc;
  serie?: string;
  correlativo?: number;
  cliente?: string;
  total?: number;
  estado: "emitido" | "pendiente" | "error" | "invalido";
  mensaje?: string;
  id?: string;
  /** Prefijo para el nombre del archivo (columna "Prefijo Archivo"); vacío = solo "{serie}-{correlativo}". */
  prefijo?: string;
}

export interface GrupoCarga {
  filasNumeros: number[];
  cabecera: FilaCargaCruda;
  itemsCrudos: FilaCargaCruda["valores"][];
}

/** Agrupa filas por la columna "Grupo"; las filas sin grupo son cada una un comprobante independiente. */
export function agruparFilas(filas: FilaCargaCruda[]): GrupoCarga[] {
  const grupos = new Map<string, GrupoCarga>();
  const orden: string[] = [];
  let sinGrupoContador = 0;

  for (const fila of filas) {
    const grupoRaw = (fila.valores.grupo ?? "").trim();
    const key = grupoRaw || `__sin_grupo_${++sinGrupoContador}`;
    let grupo = grupos.get(key);
    if (!grupo) {
      grupo = { filasNumeros: [], cabecera: fila, itemsCrudos: [] };
      grupos.set(key, grupo);
      orden.push(key);
    }
    grupo.filasNumeros.push(fila.fila);
    grupo.itemsCrudos.push(fila.valores);
  }

  return orden.map((k) => grupos.get(k)!);
}

function parseNumero(texto: string | undefined): number | null {
  if (!texto) return null;
  const n = Number(texto.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export async function procesarGrupo(company: Company, grupo: GrupoCarga): Promise<ResultadoFilaCarga> {
  const filas = grupo.filasNumeros;
  const cabecera = grupo.cabecera.valores;

  const tipoLetra = (cabecera.tipo ?? "").trim().toUpperCase().charAt(0);
  const tipoDoc: TipoDoc | null = tipoLetra === "B" ? "03" : tipoLetra === "F" ? "01" : null;
  if (!tipoDoc) {
    return { filas, estado: "invalido", mensaje: 'Columna "Tipo" debe ser B (boleta) o F (factura) en la primera fila del grupo' };
  }

  const serie = (cabecera.serie || SERIE_DEFAULT[tipoDoc]).trim().toUpperCase();
  if (!/^[A-Z]\d{3}$/.test(serie)) {
    return { filas, tipoDoc, estado: "invalido", mensaje: `Serie inválida "${serie}" (debe ser 1 letra + 3 dígitos, ej. B001)` };
  }

  const items: ItemInput[] = [];
  for (let i = 0; i < grupo.itemsCrudos.length; i++) {
    const v = grupo.itemsCrudos[i];
    const filaNum = filas[i];
    const descripcion = (v.descripcion ?? "").trim();
    if (!descripcion) {
      return { filas, tipoDoc, serie, estado: "invalido", mensaje: `Fila ${filaNum}: falta la descripción del ítem` };
    }
    const cantidad = parseNumero(v.cantidad);
    if (cantidad === null || cantidad <= 0) {
      return { filas, tipoDoc, serie, estado: "invalido", mensaje: `Fila ${filaNum}: cantidad inválida ("${v.cantidad ?? ""}")` };
    }
    const precioUnitario = parseNumero(v.precioUnitario);
    if (precioUnitario === null || precioUnitario <= 0) {
      return { filas, tipoDoc, serie, estado: "invalido", mensaje: `Fila ${filaNum}: precio unitario inválido ("${v.precioUnitario ?? ""}")` };
    }
    items.push({ descripcion, cantidad, precioUnitario, codigo: v.codigo || undefined });
  }

  const clienteResult = inferirClienteDesdeDocumento(cabecera.documento, cabecera.nombre);
  if ("error" in clienteResult) {
    return { filas, tipoDoc, serie, estado: "invalido", mensaje: clienteResult.error };
  }
  const cliente = clienteResult.cliente;

  const totalConIgv = items.reduce((acc, it) => acc + it.cantidad * it.precioUnitario, 0);
  const errorCliente = validarCliente(tipoDoc, cliente, totalConIgv);
  if (errorCliente) {
    return { filas, tipoDoc, serie, cliente: cliente.rznSocial, total: totalConIgv, estado: "invalido", mensaje: errorCliente };
  }

  const moneda = (cabecera.moneda || "PEN").trim().toUpperCase();
  const formaPago = /credito/i.test(cabecera.formaPago ?? "") ? "Credito" : "Contado";

  const correlativo = await siguienteCorrelativo(company.id, tipoDoc, serie);
  const payload = construirPayload({
    empresa: companyToEmpresaSunat(company),
    tipoDoc,
    serie,
    correlativo,
    items,
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
    items,
    payload,
  });

  const { estadoFinal } = await intentarEmitir(comprobante, company.apisperu_token);

  return {
    filas,
    tipoDoc,
    serie,
    correlativo,
    cliente: cliente.rznSocial,
    total: payload.mtoImpVenta,
    estado: estadoFinal as ResultadoFilaCarga["estado"],
    id: comprobante.id,
    prefijo: (cabecera.prefijo ?? "").trim(),
  };
}
