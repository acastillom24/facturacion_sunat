import { SignJWT, jwtVerify } from "jose";

const ALG = "HS256";
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12 horas

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Falta SESSION_SECRET en el entorno");
  return new TextEncoder().encode(secret);
}

/** Nombre de cookie único por empresa: permite sesiones simultáneas en distintas pestañas. */
export function sessionCookieName(slug: string): string {
  return `sunat_session_${slug}`;
}

export async function crearTokenSesion(companyId: string, slug: string): Promise<string> {
  return new SignJWT({ companyId, slug })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export interface SesionPayload {
  companyId: string;
  slug: string;
}

export async function verificarTokenSesion(token: string): Promise<SesionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.companyId !== "string" || typeof payload.slug !== "string") return null;
    return { companyId: payload.companyId, slug: payload.slug };
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
