import { createHmac, timingSafeEqual } from "node:crypto";

/** TOTP (RFC 6238, SHA-1, 6 dígitos, 30 s) con el secreto en base32 de ADMIN_TOTP_SECRET. */
const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32aBytes(s: string): Buffer {
  let bits = "";
  for (const ch of s.replace(/[\s=]/g, "").toUpperCase()) {
    const v = ALFABETO.indexOf(ch);
    if (v < 0) throw new Error("ADMIN_TOTP_SECRET no es base32 válido");
    bits += v.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function codigo(secreto: Buffer, contador: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(contador));
  const h = createHmac("sha1", secreto).update(msg).digest();
  const o = h[h.length - 1] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}

export function totpActivado(): boolean {
  return !!process.env.ADMIN_TOTP_SECRET;
}

/** Acepta el código actual y ±1 ventana (desfase de reloj). */
export function verificarTotp(ingresado: string): boolean {
  const s = process.env.ADMIN_TOTP_SECRET;
  if (!s) return true;
  const clave = base32aBytes(s);
  const ahora = Math.floor(Date.now() / 30_000);
  const dado = Buffer.from(ingresado.trim());
  return [-1, 0, 1].some((d) => {
    const esperado = Buffer.from(codigo(clave, ahora + d));
    return esperado.length === dado.length && timingSafeEqual(esperado, dado);
  });
}
