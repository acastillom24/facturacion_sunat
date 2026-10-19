import { config, TIMEOUT_MS } from "./apiPropia";

/** Alta y consulta de la empresa (credenciales SOL y certificado) en la API propia. */

export interface EstadoEmpresaPropia {
  ambiente: "beta" | "produccion";
  sol_usuario: string | null;
  tiene_sol_clave: boolean;
  certificado: { titular: string; valido_hasta: string; vencido: boolean } | null;
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
  razonSocial: string;
  nombreComercial?: string | null;
  direccion: string;
  ubigeo: string;
  departamento: string;
  provincia: string;
  distrito: string;
  ambiente?: "beta" | "produccion";
  solUsuario?: string;
  solClave?: string;
  certificadoBase64?: string;
  certificadoClave?: string;
}

/** Registra o actualiza la empresa. Lo que no se manda no cambia en la API. */
export async function guardarEmpresaPropia(p: GuardarEmpresaParams): Promise<{ ok: boolean; mensaje: string }> {
  const { url, key } = config(p.token);
  const cuerpo: Record<string, unknown> = {
    ruc: p.ruc,
    razon_social: p.razonSocial,
    direccion: p.direccion,
    ubigeo: p.ubigeo,
    departamento: p.departamento,
    provincia: p.provincia,
    distrito: p.distrito,
  };
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
