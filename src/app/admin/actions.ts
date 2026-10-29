"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ADMIN_COOKIE, ADMIN_MAX_AGE, crearTokenAdmin, esAdmin } from "@/lib/auth/admin";
import { cifrar } from "@/lib/crypto/secretos";
import { registrarAuditoria } from "@/lib/db/audit";
import { verificarTotp } from "@/lib/auth/totp";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { estaBloqueado, limpiarFallos, registrarFallo } from "@/lib/auth/limite";
import { getCompanyBySlug } from "@/lib/db/companies";
import { tokenApisperu } from "@/lib/sunat/apiPropia";
import { query, queryOne } from "@/lib/db/client";
import { v2 as cloudinary } from "cloudinary";
import { estadoEmpresaPropia, guardarEmpresaPropia } from "@/lib/sunat/apiPropiaEmpresa";

export async function adminLoginAction(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) return { error: "Falta ADMIN_PASSWORD_HASH en el entorno" };
  if (await estaBloqueado("admin")) return { error: "Demasiados intentos, espera unos minutos" };

  const ok = await verifyPassword(String(formData.get("password") ?? ""), hash);
  if (!ok) {
    await registrarFallo("admin");
    return { error: "Contraseña incorrecta" };
  }
  if (!verificarTotp(String(formData.get("totp") ?? ""))) {
    await registrarFallo("admin");
    return { error: "Código 2FA incorrecto" };
  }
  await limpiarFallos("admin");
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, await crearTokenAdmin(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_MAX_AGE,
  });
  redirect("/admin");
}

export async function adminLogoutAction(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

export type ProveedorState = { ok?: boolean; mensaje?: string; error?: string; campo?: string };

export async function guardarProveedorAction(slug: string, formData: FormData): Promise<ProveedorState> {
  if (!(await esAdmin())) return { error: "Sesión admin vencida" };
  const proveedor = String(formData.get("proveedor"));
  if (proveedor !== "apisperu" && proveedor !== "propia") return { error: "Proveedor inválido", campo: "proveedor" };
  const company = await getCompanyBySlug(slug);
  if (!company) return { error: "Empresa no encontrada" };

  const token = String(formData.get("token") ?? "").trim();
  if (!token && !company.apisperu_token) return { error: "Falta el token", campo: "token" };
  const tokenFinal = token || tokenApisperu(company);
  const tokenCifrado = token ? cifrar(token) : null;

  let mensaje = "Proveedor actualizado.";
  if (proveedor === "propia") {
    const ambiente = String(formData.get("ambiente")) === "produccion" ? "produccion" : "beta";
    const solUsuario = String(formData.get("solUsuario") ?? "").trim();
    const solClave = String(formData.get("solClave") ?? "");
    const certificadoClave = String(formData.get("certificadoClave") ?? "");
    const cert = formData.get("certificado");
    let certificadoBase64: string | undefined;
    if (cert instanceof File && cert.size > 0) {
      if (cert.size > 50_000) return { error: "El certificado es demasiado grande (máx. 50 KB)", campo: "certificado" };
      if (!/\.(p12|pfx)$/i.test(cert.name)) return { error: "El certificado debe ser un archivo .p12 o .pfx", campo: "certificado" };
      if (!certificadoClave) return { error: "Falta la clave del certificado", campo: "certificadoClave" };
      certificadoBase64 = Buffer.from(await cert.arrayBuffer()).toString("base64");
    }
    try {
      const r = await guardarEmpresaPropia({
        token: tokenFinal,
        ruc: company.ruc,
        razonSocial: company.razon_social,
        nombreComercial: company.nombre_comercial,
        direccion: company.direccion,
        ubigeo: company.ubigueo,
        departamento: company.departamento,
        provincia: company.provincia,
        distrito: company.distrito,
        ambiente,
        solUsuario: solUsuario || undefined,
        solClave: solClave || undefined,
        certificadoBase64,
        certificadoClave: certificadoClave || undefined,
      });
      if (!r.ok) return { error: r.mensaje };
      mensaje = r.mensaje;
      const estado = await estadoEmpresaPropia(company.ruc, tokenFinal);
      if (estado && !estado.listo_para_produccion && estado.ambiente === "produccion")
        return { error: `Configuración guardada en la API, pero falta: ${estado.faltantes_para_produccion.join(", ")}` };
    } catch (e) {
      return { error: `No se pudo consultar la API propia: ${e instanceof Error ? e.message : String(e)}` };
    }
  }
  try {
    await query("update companies set sunat_provider = $2, apisperu_token = coalesce($3, apisperu_token) where id = $1", [company.id, proveedor, tokenCifrado]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  await registrarAuditoria("cambiar_proveedor", slug, { proveedor, tokenActualizado: !!token });
  revalidatePath("/admin");
  revalidatePath(`/admin/${slug}`);
  return { ok: true, mensaje };
}

const texto = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export type CrearEmpresaState = { error?: string; campo?: string };

export async function crearEmpresaAction(_prev: CrearEmpresaState, fd: FormData): Promise<CrearEmpresaState> {
  if (!(await esAdmin())) return { error: "Sesión admin vencida" };
  const slug = texto(fd, "slug").toLowerCase();
  const ruc = texto(fd, "ruc");
  const razonSocial = texto(fd, "razonSocial");
  const password = String(fd.get("password") ?? "");
  const proveedor = texto(fd, "proveedor") === "propia" ? "propia" : "apisperu";
  const token = texto(fd, "token");
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug) || ["admin", "api", "logos", "login"].includes(slug))
    return { error: "Identificador inválido (minúsculas, números y guiones; no reservado)", campo: "slug" };
  if (!/^\d{11}$/.test(ruc)) return { error: "El RUC debe tener 11 dígitos", campo: "ruc" };
  if (!razonSocial) return { error: "Falta la razón social", campo: "razonSocial" };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres", campo: "password" };
  if (!token) return { error: "Falta el token", campo: "token" };
  const igv = Number(texto(fd, "igvRate") || "0.18");
  if (!(igv >= 0 && igv < 1)) return { error: "IGV inválido (ej. 0.18)", campo: "igvRate" };

  const corr = [
    { tipo: "03" as const, serie: texto(fd, "serieBoleta").toUpperCase(), ultimo: texto(fd, "ultimoBoleta") },
    { tipo: "01" as const, serie: texto(fd, "serieFactura").toUpperCase(), ultimo: texto(fd, "ultimoFactura") },
  ].filter((c) => c.serie || c.ultimo);
  for (const c of corr) {
    if (!c.serie || c.ultimo === "")
      return { error: "Para fijar un correlativo indica serie y último número", campo: !c.serie ? (c.tipo === "03" ? "serieBoleta" : "serieFactura") : (c.tipo === "03" ? "ultimoBoleta" : "ultimoFactura") };
  }
  // Se valida el certificado antes de insertar para no dejar la empresa a medias.
  let certificadoBase64: string | undefined;
  const cert = fd.get("certificado");
  if (proveedor === "propia" && cert instanceof File && cert.size > 0) {
    if (cert.size > 50_000) return { error: "El certificado es demasiado grande (máx. 50 KB)", campo: "certificado" };
    if (!/\.(p12|pfx)$/i.test(cert.name)) return { error: "El certificado debe ser un archivo .p12 o .pfx", campo: "certificado" };
    if (!String(fd.get("certificadoClave") ?? "")) return { error: "Falta la clave del certificado", campo: "certificadoClave" };
    certificadoBase64 = Buffer.from(await cert.arrayBuffer()).toString("base64");
  }

  const logo = fd.get("logo");
  let logoUrl: string | null = null;
  if (logo instanceof File && logo.size > 0) {
    const r = await subirLogo(slug, logo);
    if (!r.url) return { error: r.error, campo: "logo" };
    logoUrl = r.url;
  }

  let creadaId: string;
  try {
    const [creada] = await query<{ id: string }>(
      `insert into companies
         (slug, password_hash, ruc, razon_social, nombre_comercial, ubigueo, departamento, provincia, distrito,
          direccion, cod_local, apisperu_token, sunat_provider, igv_rate, logo_url)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       returning id`,
      [
        slug,
        await hashPassword(password),
        ruc,
        razonSocial,
        texto(fd, "nombreComercial") || razonSocial,
        texto(fd, "ubigueo") || "150101",
        texto(fd, "departamento") || "LIMA",
        texto(fd, "provincia") || "LIMA",
        texto(fd, "distrito") || "LIMA",
        texto(fd, "direccion"),
        texto(fd, "codLocal") || "0000",
        cifrar(token),
        proveedor,
        igv,
        logoUrl,
      ],
    );
    creadaId = creada.id;
  } catch (e) {
    const duplicado = (e as { code?: string }).code === "23505";
    return { error: duplicado ? "Ya existe una empresa con ese identificador" : e instanceof Error ? e.message : String(e), campo: duplicado ? "slug" : undefined };
  }
  for (const c of corr) {
    const err = await fijarCorrelativo(creadaId, c.tipo, c.serie, Number(c.ultimo));
    if (err) return { error: `Empresa creada, pero falló el correlativo ${c.serie}: ${err}. Corrígelo en su ficha.` };
  }
  if (proveedor === "propia") {
    const ambiente = texto(fd, "ambiente") === "produccion" ? "produccion" : "beta";
    const r = await guardarEmpresaPropia({
      token,
      ruc,
      razonSocial,
      nombreComercial: texto(fd, "nombreComercial") || razonSocial,
      direccion: texto(fd, "direccion"),
      ubigeo: texto(fd, "ubigueo") || "150101",
      departamento: texto(fd, "departamento") || "LIMA",
      provincia: texto(fd, "provincia") || "LIMA",
      distrito: texto(fd, "distrito") || "LIMA",
      ambiente,
      solUsuario: texto(fd, "solUsuario") || undefined,
      solClave: String(fd.get("solClave") ?? "") || undefined,
      certificadoBase64,
      certificadoClave: String(fd.get("certificadoClave") ?? "") || undefined,
    });
    if (!r.ok) return { error: `Empresa creada, pero no se pudo registrar en la API propia: ${r.mensaje}. Complétalo desde su ficha (/admin/${slug}).` };
  }
  await registrarAuditoria("crear_empresa", slug, { ruc, proveedorSolicitado: proveedor });
  revalidatePath("/admin");
  redirect(`/admin/${slug}`);
}

export async function resetPasswordAction(slug: string, fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  if (!(await esAdmin())) return { error: "Sesión admin vencida" };
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres" };
  try {
    await query("update companies set password_hash = $2 where slug = $1", [slug, await hashPassword(password)]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  await registrarAuditoria("reset_password", slug);
  return { ok: true };
}

export async function toggleActivaAction(slug: string, activa: boolean): Promise<void> {
  if (!(await esAdmin())) return;
  await query("update companies set activa = $2 where slug = $1", [slug, activa]);
  await registrarAuditoria(activa ? "reactivar_empresa" : "suspender_empresa", slug);
  revalidatePath("/admin");
  revalidatePath(`/admin/${slug}`);
}

// ---------------------------------------------------------------------------
// Logo y correlativos
// ---------------------------------------------------------------------------

const MAX_LOGO_BYTES = 500_000;
const CARPETA_LOGOS = "facturacion_sunat";

/** Sube el logo a Cloudinary (carpeta facturacion_sunat) y devuelve su URL pública https. */
async function subirLogo(slug: string, archivo: File): Promise<{ url?: string; error?: string }> {
  const tipos: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg" };
  if (!tipos[archivo.type]) return { error: "El logo debe ser PNG o JPG" };
  if (archivo.size > MAX_LOGO_BYTES) return { error: "El logo es demasiado grande (máx. 500 KB)" };
  // Con CLOUDINARY_URL el SDK se configura solo; si no, se usan las tres variables sueltas.
  if (!process.env.CLOUDINARY_URL) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }
  try {
    const buffer = Buffer.from(await archivo.arrayBuffer());
    const r = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: CARPETA_LOGOS, public_id: `${slug}-${Date.now()}`, resource_type: "image" }, (err, res) =>
          err || !res ? reject(err ?? new Error("Cloudinary no devolvió respuesta")) : resolve(res),
        )
        .end(buffer);
    });
    return { url: r.secure_url };
  } catch (e) {
    return { error: `No se pudo subir el logo: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function guardarLogoAction(slug: string, fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  if (!(await esAdmin())) return { error: "Sesión admin vencida" };
  const archivo = fd.get("logo");
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Selecciona un archivo" };
  const r = await subirLogo(slug, archivo);
  if (!r.url) return { error: r.error };
  try {
    await query("update companies set logo_url = $2 where slug = $1", [slug, r.url]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  await registrarAuditoria("cambiar_logo", slug);
  revalidatePath(`/admin/${slug}`);
  return { ok: true };
}

/** Fija el ÚLTIMO número ya usado de una serie (el siguiente será +1). */
async function fijarCorrelativo(companyId: string, tipo: "01" | "03", serie: string, ultimo: number): Promise<string | null> {
  const prefijo = tipo === "01" ? "F" : "B";
  if (!new RegExp(`^${prefijo}[A-Z0-9]{3}$`).test(serie)) return `La serie de ${tipo === "01" ? "factura" : "boleta"} debe ser ${prefijo}### (ej. ${prefijo}001)`;
  if (!Number.isInteger(ultimo) || ultimo < 0) return "El último correlativo debe ser un entero ≥ 0";
  try {
    await query(
      `insert into correlativos (company_id, tipo_doc, serie, ultimo_correlativo) values ($1, $2, $3, $4)
       on conflict (company_id, tipo_doc, serie) do update set ultimo_correlativo = excluded.ultimo_correlativo`,
      [companyId, tipo, serie, ultimo],
    );
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

export async function fijarCorrelativoAction(slug: string, fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  if (!(await esAdmin())) return { error: "Sesión admin vencida" };
  const tipo = texto(fd, "tipo") === "01" ? "01" : "03";
  const serie = texto(fd, "serie").toUpperCase();
  const ultimo = Number(texto(fd, "ultimo"));
  const company = await queryOne<{ id: string }>("select id from companies where slug = $1", [slug]);
  if (!company) return { error: "Empresa no encontrada" };
  const err = await fijarCorrelativo(company.id, tipo, serie, ultimo);
  if (err) return { error: err };
  await registrarAuditoria("fijar_correlativo", slug, { tipo, serie, ultimo });
  revalidatePath(`/admin/${slug}`);
  return { ok: true };
}
