import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const ALG = "HS256";
const MAX_AGE_SECONDS = 60 * 60 * 4; // 4 horas
export const ADMIN_COOKIE = "sunat_admin";
export const ADMIN_MAX_AGE = MAX_AGE_SECONDS;

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Falta SESSION_SECRET en el entorno");
  return new TextEncoder().encode(secret);
}

export async function crearTokenAdmin(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verificarTokenAdmin(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload.role === "admin";
  } catch {
    return false;
  }
}

/** Para páginas /admin/*. Redirige al login admin si no hay sesión válida. */
export async function requireAdmin(): Promise<void> {
  if (!(await esAdmin())) redirect("/admin/login");
}

/** Variante para server actions: devuelve false en vez de redirigir. */
export async function esAdmin(): Promise<boolean> {
  const jar = await cookies();
  const cookie = jar.get(ADMIN_COOKIE);
  return cookie ? verificarTokenAdmin(cookie.value) : false;
}
