"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyPassword } from "@/lib/auth/password";
import { crearTokenSesion, sessionCookieName, SESSION_MAX_AGE } from "@/lib/auth/session";
import { companyToEmpresaSunat, getCompanyBySlug } from "@/lib/db/companies";
import {
  crearComprobantePendiente,
  marcarAnulado,
  marcarAnulando,
  marcarCancelado,
  marcarErrorAnulacion,
  obtenerComprobante,
} from "@/lib/db/comprobantes";
import { siguienteCorrelativo, siguienteCorrelativoResumen } from "@/lib/db/correlativos";
import { leerFilasCargaMasiva } from "@/lib/excel/plantilla";
import { anularBoleta, anularFactura, construirPayload, nowLimaIso } from "@/lib/sunat/apisperu";
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
  if (comprobante.estado !== "emitido") return { error: "Solo se pueden anular comprobantes emitidos" };

  const empresa = companyToEmpresaSunat(company);
  const fecResumen = nowLimaIso();

  if (comprobante.tipo_doc === "03") {
    const correlativoResumen = await siguienteCorrelativoResumen(company.id, fecResumen.slice(0, 10));
    await marcarAnulando(comprobante.id, {
      correlativoResumen: String(correlativoResumen),
      estado: "enviado",
      fecResumen,
    });
    try {
      const resultado = await anularBoleta({
        token: company.apisperu_token,
        empresa,
        serie: comprobante.serie,
        correlativo: comprobante.correlativo,
        correlativoResumen,
        total: comprobante.mto_imp_venta,
        clienteTipo: comprobante.cliente.tipoDoc,
        clienteNumero: comprobante.cliente.numDoc,
        fechaEmisionBoleta: comprobante.fecha_emision,
        fechaResumen: fecResumen,
        igvRate: Number(company.igv_rate),
      });
      if (resultado.ticket) {
        await marcarAnulado(comprobante.id, {
          correlativoResumen: String(correlativoResumen),
          ticket: resultado.ticket,
          estado: "aceptado",
          resultado,
          fecResumen,
        });
      } else {
        await marcarErrorAnulacion(comprobante.id, {
          correlativoResumen: String(correlativoResumen),
          estado: "rechazado",
          resultado,
          fecResumen,
        });
        return { error: "SUNAT rechazó la anulación, revisa el detalle" };
      }
    } catch (err) {
      await marcarErrorAnulacion(comprobante.id, {
        correlativoResumen: String(correlativoResumen),
        estado: "rechazado",
        resultado: { error: { message: err instanceof Error ? err.message : String(err) } },
        fecResumen,
      });
      return { error: "Error de red al anular, intenta de nuevo" };
    }
  } else {
    const motivo = String(formData.get("motivo") ?? "").trim() || "ANULACION SOLICITADA POR EL EMISOR";
    const correlativoBaja = await siguienteCorrelativoResumen(company.id, fecResumen.slice(0, 10));
    await marcarAnulando(comprobante.id, {
      correlativoResumen: String(correlativoBaja),
      motivo,
      estado: "enviado",
      fecResumen,
    });
    try {
      const resultado = await anularFactura({
        token: company.apisperu_token,
        empresa,
        serie: comprobante.serie,
        correlativo: comprobante.correlativo,
        correlativoBaja,
        motivo,
        fechaEmisionFactura: comprobante.fecha_emision,
        fechaComunicacion: fecResumen,
      });
      if (resultado.ticket) {
        await marcarAnulado(comprobante.id, {
          correlativoResumen: String(correlativoBaja),
          motivo,
          ticket: resultado.ticket,
          estado: "aceptado",
          resultado,
          fecResumen,
        });
      } else {
        await marcarErrorAnulacion(comprobante.id, {
          correlativoResumen: String(correlativoBaja),
          motivo,
          estado: "rechazado",
          resultado,
          fecResumen,
        });
        return { error: "SUNAT rechazó la comunicación de baja, revisa el detalle" };
      }
    } catch (err) {
      await marcarErrorAnulacion(comprobante.id, {
        correlativoResumen: String(correlativoBaja),
        motivo,
        estado: "rechazado",
        resultado: { error: { message: err instanceof Error ? err.message : String(err) } },
        fecResumen,
      });
      return { error: "Error de red al anular, intenta de nuevo" };
    }
  }

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
