"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyPassword } from "@/lib/auth/password";
import { crearTokenSesion, sessionCookieName, SESSION_MAX_AGE } from "@/lib/auth/session";
import { companyToEmpresaSunat, getCompanyBySlug } from "@/lib/db/companies";
import {
  actualizarDatosComprobante,
  crearComprobantePendiente,
  buscarComprobantePorNumero,
  marcarCancelado,
  obtenerComprobante,
} from "@/lib/db/comprobantes";
import { siguienteCorrelativo } from "@/lib/db/correlativos";
import { mensajeExcedeLimite } from "@/lib/limites";
import { leerFilasCargaMasiva } from "@/lib/excel/plantilla";
import { anularComprobante } from "@/lib/sunat/anulacion";
import { construirPayload } from "@/lib/sunat/apisperu";
import { agruparFilas, MAX_FILAS_CARGA_MASIVA, procesarGrupo, type GrupoCarga, type ResultadoFilaCarga } from "@/lib/sunat/cargaMasiva";
import { intentarEmitir } from "@/lib/sunat/emision";
import type { ClienteSunat, ItemInput, TipoDoc } from "@/lib/sunat/types";
import { validarCliente } from "@/lib/sunat/validacion";

export async function loginAction(slug: string, formData: FormData): Promise<{ error?: string }> {
  const password = String(formData.get("password") ?? "");
  const company = await getCompanyBySlug(slug);
  if (!company) return { error: "Empresa no encontrada" };

  const valido = await verifyPassword(password, company.password_hash);
  if (!valido) return { error: "Contraseña incorrecta" };

  const token = await crearTokenSesion(company.id, slug);
  const jar = await cookies();
  jar.set(sessionCookieName(slug), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect(`/${slug}`);
}

export async function logoutAction(slug: string): Promise<void> {
  const jar = await cookies();
  jar.delete(sessionCookieName(slug));
  redirect(`/${slug}/login`);
}

export async function crearComprobanteAction(
  slug: string,
  formData: FormData,
): Promise<{ error?: string; id?: string }> {
  const company = await getCompanyBySlug(slug);
  if (!company) return { error: "Empresa no encontrada" };

  const tipoDoc = String(formData.get("tipoDoc")) as TipoDoc;
  const serie = String(formData.get("serie") ?? "").toUpperCase().trim();
  if (!/^[A-Z]\d{3}$/.test(serie)) {
    return { error: 'La serie debe tener 1 letra + 3 dígitos (ej. "B001" para boletas, "F001" para facturas). El número correlativo lo asigna el sistema automáticamente, no lo escribas en la serie.' };
  }

  const clienteTipoDoc = String(formData.get("clienteTipoDoc") ?? "0");
  const clienteNumDoc = String(formData.get("clienteNumDoc") ?? "-").trim() || "-";
  const clienteRznSocial = String(formData.get("clienteRznSocial") ?? "").trim();

  const cliente: ClienteSunat = {
    tipoDoc: clienteTipoDoc,
    numDoc: clienteNumDoc,
    rznSocial: clienteRznSocial || "Cliente varios",
  };

  let items: ItemInput[];
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { error: "Ítems inválidos" };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "Agrega al menos un ítem" };
  }

  const totalConIgv = items.reduce((acc, it) => acc + Number(it.cantidad) * Number(it.precioUnitario), 0);
  const errorCliente = validarCliente(tipoDoc, cliente, totalConIgv);
  if (errorCliente) return { error: errorCliente };

  const correlativo = await siguienteCorrelativo(company.id, tipoDoc, serie);
  const payload = construirPayload({
    empresa: companyToEmpresaSunat(company),
    tipoDoc,
    serie,
    correlativo,
    items,
    cliente,
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

  await intentarEmitir(comprobante, company.apisperu_token);
  redirect(`/${slug}/comprobantes/${comprobante.id}`);
}

export async function reintentarAction(slug: string, id: string): Promise<void> {
  const company = await getCompanyBySlug(slug);
  if (!company) return;
  const comprobante = await obtenerComprobante(company.id, id);
  if (!comprobante || (comprobante.estado !== "pendiente" && comprobante.estado !== "error")) return;
  await intentarEmitir(comprobante, company.apisperu_token);
  redirect(`/${slug}/comprobantes/${id}`);
}

/** Corrige cliente/ítems de un comprobante pendiente o con error, reconstruye el payload y reintenta la emisión. */
export async function editarYReintentarAction(
  slug: string,
  id: string,
  cliente: ClienteSunat,
  items: ItemInput[],
): Promise<{ error?: string }> {
  const company = await getCompanyBySlug(slug);
  if (!company) return { error: "Empresa no encontrada" };
  const comprobante = await obtenerComprobante(company.id, id);
  if (!comprobante || (comprobante.estado !== "pendiente" && comprobante.estado !== "error")) {
    return { error: "Solo se pueden editar comprobantes pendientes o con error" };
  }

  const itemsLimpios = items.map((it) => ({
    ...it,
    descripcion: String(it.descripcion ?? "").trim(),
    cantidad: Number(it.cantidad),
    precioUnitario: Number(it.precioUnitario),
  }));
  if (itemsLimpios.length === 0) return { error: "Agrega al menos un ítem" };
  if (itemsLimpios.some((it) => !it.descripcion || !(it.cantidad > 0) || !(it.precioUnitario > 0))) {
    return { error: "Cada ítem necesita descripción, cantidad y precio mayores a 0" };
  }

  const clienteLimpio: ClienteSunat = {
    tipoDoc: cliente.tipoDoc,
    numDoc: String(cliente.numDoc ?? "-").trim() || "-",
    rznSocial: String(cliente.rznSocial ?? "").trim() || "Cliente varios",
  };
  const total = itemsLimpios.reduce((acc, it) => acc + it.cantidad * it.precioUnitario, 0);
  const errorCliente = validarCliente(comprobante.tipo_doc, clienteLimpio, total);
  if (errorCliente) return { error: errorCliente };

  const payload = construirPayload({
    empresa: comprobante.payload.company,
    tipoDoc: comprobante.tipo_doc,
    serie: comprobante.serie,
    correlativo: comprobante.correlativo,
    items: itemsLimpios,
    cliente: clienteLimpio,
    fechaEmision: comprobante.payload.fechaEmision,
    moneda: comprobante.moneda,
    formaPago: comprobante.forma_pago as "Contado" | "Credito",
    igvRate: Number(company.igv_rate),
  });
  await actualizarDatosComprobante(comprobante.id, { cliente: clienteLimpio, items: itemsLimpios, payload });
  await intentarEmitir({ id: comprobante.id, payload, intentos: comprobante.intentos }, company.apisperu_token);
  redirect(`/${slug}/comprobantes/${id}`);
}

/** Detiene el reintento automático (ej. quedó con serie/correlativo erróneo y siempre va a fallar). */
export async function cancelarReintentoAction(slug: string, id: string): Promise<void> {
  const company = await getCompanyBySlug(slug);
  if (!company) return;
  const comprobante = await obtenerComprobante(company.id, id);
  if (!comprobante || comprobante.estado !== "pendiente") return;
  await marcarCancelado(comprobante.id);
  redirect(`/${slug}/comprobantes/${id}`);
}

export async function anularAction(
  slug: string,
  id: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const company = await getCompanyBySlug(slug);
  if (!company) return { error: "Empresa no encontrada" };
  const comprobante = await obtenerComprobante(company.id, id);
  if (!comprobante) return { error: "Comprobante no encontrado" };
  const resultado = await anularComprobante(company, comprobante, String(formData.get("motivo") ?? ""));
  if (resultado.error) return resultado;

  redirect(`/${slug}/comprobantes/${id}`);
}

/** Lee el Excel y devuelve los comprobantes (grupos de filas) a emitir; la emisión se hace de a uno con `emitirGrupoAction`. */
export async function prepararCargaAction(
  slug: string,
  formData: FormData,
): Promise<{ error?: string; grupos?: GrupoCarga[] }> {
  const company = await getCompanyBySlug(slug);
  if (!company) return { error: "Empresa no encontrada" };

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Selecciona un archivo Excel (.xlsx)" };
  }

  let filas;
  try {
    filas = await leerFilasCargaMasiva(await archivo.arrayBuffer());
  } catch {
    return { error: "No se pudo leer el archivo. Verifica que sea un .xlsx válido generado a partir de la plantilla." };
  }
  if (filas.length === 0) return { error: "El archivo no tiene filas de datos" };

  // El límite es de comprobantes, no de filas: varias filas con el mismo "Grupo" son un solo comprobante.
  const grupos = agruparFilas(filas);
  if (grupos.length > MAX_FILAS_CARGA_MASIVA) {
    return {
      error: mensajeExcedeLimite(
        grupos.length,
        MAX_FILAS_CARGA_MASIVA,
        `el archivo genera ${grupos.length} comprobantes (${filas.length} filas)`,
      ),
    };
  }
  return { grupos };
}

/** Crea y emite UN comprobante de la carga masiva. */
export async function emitirGrupoAction(slug: string, grupo: GrupoCarga): Promise<ResultadoFilaCarga> {
  const company = await getCompanyBySlug(slug);
  if (!company) return { filas: grupo.filasNumeros, estado: "error", mensaje: "Empresa no encontrada" };
  return procesarGrupo(company, grupo);
}

/** Reintenta la emisión de un comprobante ya creado (reusa su correlativo). */
export async function reintentarEmisionAction(
  slug: string,
  id: string,
): Promise<{ estado: "emitido" | "pendiente" | "error"; mensaje?: string }> {
  const company = await getCompanyBySlug(slug);
  if (!company) return { estado: "error", mensaje: "Empresa no encontrada" };
  const comprobante = await obtenerComprobante(company.id, id);
  if (!comprobante) return { estado: "error", mensaje: "Comprobante no encontrado" };
  if (comprobante.estado === "emitido") return { estado: "emitido" };
  if (comprobante.estado !== "pendiente" && comprobante.estado !== "error") {
    return { estado: "error", mensaje: `Estado "${comprobante.estado}": no se puede reintentar` };
  }
  const { estadoFinal } = await intentarEmitir(comprobante, company.apisperu_token);
  return { estado: estadoFinal as "emitido" | "pendiente" | "error" };
}

export interface ResultadoAnulacionMasiva {
  codigo: string;
  estado: "anulado" | "error";
  mensaje?: string;
  /** true si falló la llamada a SUNAT/API (el comprobante quedó en error_anulacion y vale la pena reintentar). */
  reintentable?: boolean;
}

/**
 * Anula UN comprobante, indicado por `id` (selector del historial) o por `codigo` "SERIE-NUMERO"
 * (ej. B001-5744, F001-57). Acepta emitidos y los que quedaron en "error_anulacion".
 */
export async function anularUnoAction(
  slug: string,
  ref: { id?: string; codigo?: string },
  motivo: string,
): Promise<ResultadoAnulacionMasiva> {
  const etiqueta = ref.codigo ?? ref.id ?? "";
  const company = await getCompanyBySlug(slug);
  if (!company) return { codigo: etiqueta, estado: "error", mensaje: "Empresa no encontrada" };

  let comprobante = null;
  if (ref.id) {
    comprobante = await obtenerComprobante(company.id, ref.id);
  } else if (ref.codigo) {
    const m = ref.codigo.match(/^([BF]\d{3})-0*(\d+)$/);
    if (!m) {
      return { codigo: etiqueta, estado: "error", mensaje: "Formato inválido (usa SERIE-NUMERO, ej. B001-5744)" };
    }
    comprobante = await buscarComprobantePorNumero(company.id, m[1], Number(m[2]));
  }
  if (!comprobante) return { codigo: etiqueta, estado: "error", mensaje: "No existe en el sistema" };

  const codigo = `${comprobante.serie}-${comprobante.correlativo}`;
  if (comprobante.estado !== "emitido" && comprobante.estado !== "error_anulacion") {
    return { codigo, estado: "error", mensaje: `Estado "${comprobante.estado}": solo se anulan comprobantes emitidos` };
  }
  const r = await anularComprobante(company, comprobante, motivo);
  return r.error
    ? { codigo, estado: "error", mensaje: r.error, reintentable: true }
    : { codigo, estado: "anulado" };
}
