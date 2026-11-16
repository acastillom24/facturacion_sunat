import { config, TIMEOUT_MS } from "./apiPropia";

/** Alta y consulta de la empresa (credenciales SOL y certificado) en la API propia. */

export interface EstadoEmpresaPropia {
  ambiente: "beta" | "produccion";
  sol_usuario: string | null;
  tiene_sol_clave: boolean;
  certificado: { titular: string; valido_hasta: string; vencido: boolean } | null;
  tiene_logo: boolean;
  listo_para_produccion: boolean;
  faltantes_para_produccion: string[];
}

/** Estado de la empresa en la API, o null si todavía no está registrada. */
export async function estadoEmpresaPropia(ruc: string, token: string): Promise<EstadoEmpresaPropia | null> {
  const { url, key } = config(token);
  const res = await fetch(`${url}/v1/sunat/companies/${encodeURIComponent(ruc)}`, {
    headers: { "x-api-key": key },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  const body = (await res.json().catch(() => null)) as { payload?: EstadoEmpresaPropia; message?: string } | null;
  if (!res.ok || !body?.payload) throw new Error(body?.message ?? `La API propia respondió ${res.status}`);
  return body.payload;
}

export interface GuardarEmpresaParams {
  token: string;
  ruc: string;
  /** Obligatorios solo en el alta; en actualizaciones parciales (p. ej. solo el logo) pueden omitirse. */
  razonSocial?: string;
  nombreComercial?: string | null;
  direccion?: string;
  ubigeo?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  ambiente?: "beta" | "produccion";
  solUsuario?: string;
  solClave?: string;
  certificadoBase64?: string;
  certificadoClave?: string;
  /** PNG/JPG en base64 (máx. 300 KB). null borra el logo en la API; undefined lo deja igual. */
  logoBase64?: string | null;
}

/** Registra o actualiza la empresa. Lo que no se manda no cambia en la API. */
export async function guardarEmpresaPropia(p: GuardarEmpresaParams): Promise<{ ok: boolean; mensaje: string }> {
  const { url, key } = config(p.token);
  const cuerpo: Record<string, unknown> = {
    ruc: p.ruc,
  };
  if (p.razonSocial !== undefined) cuerpo.razon_social = p.razonSocial;
  if (p.direccion !== undefined) cuerpo.direccion = p.direccion;
  if (p.ubigeo !== undefined) cuerpo.ubigeo = p.ubigeo;
  if (p.departamento !== undefined) cuerpo.departamento = p.departamento;
  if (p.provincia !== undefined) cuerpo.provincia = p.provincia;
  if (p.distrito !== undefined) cuerpo.distrito = p.distrito;
  if (p.logoBase64 !== undefined) cuerpo.logo = p.logoBase64;
  if (p.nombreComercial) cuerpo.nombre_comercial = p.nombreComercial;
  if (p.ambiente) cuerpo.ambiente = p.ambiente;
  if (p.solUsuario) cuerpo.sol_usuario = p.solUsuario;
  if (p.solClave) cuerpo.sol_clave = p.solClave;
  if (p.certificadoBase64) {
    cuerpo.certificado = p.certificadoBase64;
    cuerpo.certificado_clave = p.certificadoClave ?? "";
  }
  const res = await fetch(`${url}/v1/sunat/companies`, {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return { ok: res.ok, mensaje: body?.message ?? `La API propia respondió ${res.status}` };
}

/**
 * Envía solo el logo (base64) de una empresa ya registrada en la API.
 * Si la empresa no existe, la API no puede crearla sin razón social ni dirección: se devuelve un mensaje claro.
 */
export async function enviarLogoPropia(token: string, ruc: string, logoBase64: string | null): Promise<{ ok: boolean; mensaje: string }> {
  const r = await guardarEmpresaPropia({ token, ruc, logoBase64 });
  if (!r.ok && /razon_social|direccion|404|no existe|not found/i.test(r.mensaje))
    return { ok: false, mensaje: "La empresa aún no está registrada en la API propia; guarda primero su configuración en el proveedor." };
  return r;
}
