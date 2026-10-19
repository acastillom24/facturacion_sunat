import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifrado AES-256-GCM de secretos en reposo (p. ej. tokens de APIsPERU).
 * Clave: TOKEN_ENCRYPTION_KEY = 32 bytes en base64 (`openssl rand -base64 32`).
 * Formato: enc:v1:<iv>.<tag>.<datos> (base64). Lo que no tenga el prefijo se
 * considera texto plano heredado y se devuelve tal cual.
 */
const PREFIJO = "enc:v1:";

function clave(): Buffer | null {
  const k = process.env.TOKEN_ENCRYPTION_KEY;
  if (!k) return null;
  const buf = Buffer.from(k, "base64");
  if (buf.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY debe ser de 32 bytes en base64");
  return buf;
}

export function cifrar(texto: string): string {
  const k = clave();
  if (!k) throw new Error("Falta TOKEN_ENCRYPTION_KEY para guardar secretos cifrados");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  const datos = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return `${PREFIJO}${iv.toString("base64")}.${c.getAuthTag().toString("base64")}.${datos.toString("base64")}`;
}

export function descifrar(valor: string): string {
  if (!valor.startsWith(PREFIJO)) return valor;
  const k = clave();
  if (!k) throw new Error("Falta TOKEN_ENCRYPTION_KEY para leer secretos cifrados");
  const [iv, tag, datos] = valor.slice(PREFIJO.length).split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", k, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(datos), d.final()]).toString("utf8");
}
