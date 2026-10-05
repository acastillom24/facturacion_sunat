"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verifyPassword } from "@/lib/auth/password";
import { crearTokenSesion, sessionCookieName, SESSION_MAX_AGE } from "@/lib/auth/session";
import { companyToEmpresaSunat, getCompanyBySlug } from "@/lib/db/companies";
import {
  crearComprobantePendiente,
  buscarComprobantePorNumero,
  marcarCancelado,
  obtenerComprobante,
} from "@/lib/db/comprobantes";
import { siguienteCorrelativo } from "@/lib/db/correlativos";
import { leerFilasCargaMasiva } from "@/lib/excel/plantilla";
import { anularComprobante } from "@/lib/sunat/anulacion";
import { construirPayload } from "@/lib/sunat/apisperu";
import { MAX_FILAS_CARGA_MASIVA, procesarCargaMasiva, type ResultadoFilaCarga } from "@/lib/sunat/cargaMasiva";
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

export async function cargaMasivaAction(
  slug: string,
  formData: FormData,
): Promise<{ error?: string; resultados?: ResultadoFilaCarga[] }> {
  const company = await getCompanyBySlug(slug);
  if (!company) return { error: "Empresa no encontrada" };

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Selecciona un archivo Excel (.xlsx)" };
  }

  const buffer = await archivo.arrayBuffer();
  let filas;
  try {
    filas = await leerFilasCargaMasiva(buffer);
  } catch {
    return { error: "No se pudo leer el archivo. Verifica que sea un .xlsx válido generado a partir de la plantilla." };
  }

  if (filas.length === 0) return { error: "El archivo no tiene filas de datos" };
  if (filas.length > MAX_FILAS_CARGA_MASIVA) {
    return { error: `El archivo tiene ${filas.length} filas; el máximo por carga es ${MAX_FILAS_CARGA_MASIVA}. Divídelo en partes más pequeñas.` };
  }

  const resultados = await procesarCargaMasiva(company, filas);
  return { resultados };
}

export interface ResultadoAnulacionMasiva {
  codigo: string;
  estado: "anulado" | "error";
  mensaje?: string;
}

const MAX_CODIGOS_ANULACION_MASIVA = 40;

/** Anula varios comprobantes a partir de sus códigos "SERIE-NUMERO" (ej. B001-5744, F001-57). */
export async function anulacionMasivaAction(
  slug: string,
  formData: FormData,
): Promise<{ error?: string; resultados?: ResultadoAnulacionMasiva[] }> {
  const company = await getCompanyBySlug(slug);
  if (!company) return { error: "Empresa no encontrada" };

  const codigos = [
    ...new Set(
      String(formData.get("codigos") ?? "")
        .split(/[\s,;]+/)
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
  if (codigos.length === 0) return { error: "Ingresa al menos un código (ej. B001-5744)" };
  if (codigos.length > MAX_CODIGOS_ANULACION_MASIVA) {
    return { error: `Máximo ${MAX_CODIGOS_ANULACION_MASIVA} códigos por vez; ingresaste ${codigos.length}.` };
  }
  const motivo = String(formData.get("motivo") ?? "");

  const resultados: ResultadoAnulacionMasiva[] = [];
  for (const codigo of codigos) {
    const m = codigo.match(/^([BF]\d{3})-0*(\d+)$/);
    if (!m) {
      resultados.push({ codigo, estado: "error", mensaje: "Formato inválido (usa SERIE-NUMERO, ej. B001-5744)" });
      continue;
    }
    const comprobante = await buscarComprobantePorNumero(company.id, m[1], Number(m[2]));
    if (!comprobante) {
      resultados.push({ codigo, estado: "error", mensaje: "No existe en el sistema" });
      continue;
    }
    if (comprobante.estado !== "emitido") {
      resultados.push({ codigo, estado: "error", mensaje: `Estado "${comprobante.estado}": solo se anulan comprobantes emitidos` });
      continue;
    }
    const r = await anularComprobante(company, comprobante, motivo);
    resultados.push(r.error ? { codigo, estado: "error", mensaje: r.error } : { codigo, estado: "anulado" });
  }
  return { resultados };
}

/** Anula los comprobantes seleccionados en el historial (por id). Solo se anulan los emitidos. */
export async function anularSeleccionadosAction(
  slug: string,
  ids: string[],
  motivo = "",
): Promise<{ error?: string; resultados?: ResultadoAnulacionMasiva[] }> {
  const company = await getCompanyBySlug(slug);
  if (!company) return { error: "Empresa no encontrada" };
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return { error: "No seleccionaste comprobantes" };
  if (unicos.length > MAX_CODIGOS_ANULACION_MASIVA) {
    return { error: `Máximo ${MAX_CODIGOS_ANULACION_MASIVA} comprobantes por vez; seleccionaste ${unicos.length}.` };
  }

  const resultados: ResultadoAnulacionMasiva[] = [];
  for (const id of unicos) {
    const comprobante = await obtenerComprobante(company.id, id);
    if (!comprobante) {
      resultados.push({ codigo: id, estado: "error", mensaje: "No existe en el sistema" });
      continue;
    }
    const codigo = `${comprobante.serie}-${comprobante.correlativo}`;
    if (comprobante.estado !== "emitido") {
      resultados.push({ codigo, estado: "error", mensaje: `Estado "${comprobante.estado}": solo se anulan comprobantes emitidos` });
      continue;
    }
    const r = await anularComprobante(company, comprobante, motivo);
    resultados.push(r.error ? { codigo, estado: "error", mensaje: r.error } : { codigo, estado: "anulado" });
  }
  revalidatePath(`/${slug}`);
  return { resultados };
}
