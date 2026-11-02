/**
 * Cliente (solo servidor) de la administración del repo `apis`:
 * /v1/internal/admin/*, protegido con `x-admin-secret` (ADMIN_API_SECRET).
 * La URL base es la misma de la API propia (SUNAT_API_URL).
 */

export type ApiKeyAdmin = {
  id: string;
  prefix: string;
  name: string;
  product: string;
  owner: string | null;
  enabled: boolean;
  expiresAt: string | null;
  expired: boolean;
  monthlyLimit: number | null;
  dailyLimit: number | null;
  usedMonth: number;
  usedDay: number;
  createdAt: string;
};

export type NuevaApiKey = {
  name: string;
  product?: string;
  email?: string;
  userName?: string;
  monthlyLimit: number | null;
  dailyLimit: number | null;
  expiresAt: string | null;
};

export type CambiosApiKey = Partial<{
  name: string;
  monthlyLimit: number | null;
  dailyLimit: number | null;
  expiresAt: string | null;
  enabled: boolean;
}>;

/** `ruta` es relativa a /v1/internal/admin (p. ej. "/keys"). */
export async function llamarAdmin<T>(ruta: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const url = process.env.SUNAT_API_URL?.replace(/\/+$/, "");
  const secret = process.env.ADMIN_API_SECRET;
  if (!url || !secret) throw new Error("Faltan SUNAT_API_URL y/o ADMIN_API_SECRET");
  const res = await fetch(`${url}/v1/internal/admin${ruta}`, {
    method: init?.method ?? "GET",
    headers: { "x-admin-secret": secret, ...(init?.body ? { "content-type": "application/json" } : {}) },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const detalle = await res.json().catch(() => null);
    const msg = detalle?.message ?? detalle?.error?.message;
    throw new Error(res.status === 401 ? "ADMIN_API_SECRET no coincide con el de la API" : res.status === 404 && !msg ? `La API no tiene ADMIN_API_SECRET configurado o no tiene ${ruta.split("?")[0]}` : String(msg ?? `HTTP ${res.status}`));
  }
  return res.json() as Promise<T>;
}

export const listarApiKeys = () => llamarAdmin<{ period: string; day: string; keys: ApiKeyAdmin[] }>("/keys");

export const crearApiKey = (body: NuevaApiKey) =>
  llamarAdmin<{ key: string; id: string; prefix: string }>("/keys", { method: "POST", body });

export const actualizarApiKey = (id: string, body: CambiosApiKey) =>
  llamarAdmin<{ updated: boolean }>(`/keys/${encodeURIComponent(id)}`, { method: "PATCH", body });
