"use server";

import { revalidatePath } from "next/cache";
import { esAdmin } from "@/lib/auth/admin";
import { registrarAuditoria } from "@/lib/db/audit";
import { actualizarApiKey, crearApiKey } from "@/lib/sunat/apiKeys";

const texto = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Vacío = sin tope (null). */
function limite(fd: FormData, k: string): number | null | "invalido" {
  const v = texto(fd, k);
  if (!v) return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : "invalido";
}

/** Vacío = no vence. La fecha se interpreta como fin de ese día en Lima (UTC-5). */
function vencimiento(fd: FormData): string | null | "invalido" {
  const v = texto(fd, "expiresAt");
  if (!v) return null;
  const d = new Date(`${v}T23:59:59-05:00`);
  return Number.isNaN(d.getTime()) ? "invalido" : d.toISOString();
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function crearKeyAction(
  _prev: { error?: string; key?: string },
  fd: FormData,
): Promise<{ error?: string; key?: string }> {
  if (!(await esAdmin())) return { error: "Sesión admin vencida" };
  const name = texto(fd, "name");
  if (!name) return { error: "Falta el nombre" };
  const monthlyLimit = limite(fd, "monthlyLimit");
  const dailyLimit = limite(fd, "dailyLimit");
  const expiresAt = vencimiento(fd);
  if (monthlyLimit === "invalido" || dailyLimit === "invalido") return { error: "Los límites deben ser enteros positivos (vacío = sin tope)" };
  if (expiresAt === "invalido") return { error: "Fecha de vencimiento inválida" };
  const email = texto(fd, "email");
  if (!email) return { error: "Falta el correo del dueño: sin él la key no sirve para la API de SUNAT" };
  try {
    const r = await crearApiKey({
      name,
      product: "sunat",
      email: email || undefined,
      userName: texto(fd, "userName") || undefined,
      monthlyLimit,
      dailyLimit,
      expiresAt,
    });
    await registrarAuditoria("crear_api_key", null, { id: r.id, prefix: r.prefix, name, owner: email || null });
    revalidatePath("/admin/keys");
    return { key: r.key };
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function editarKeyAction(id: string, fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  if (!(await esAdmin())) return { error: "Sesión admin vencida" };
  const monthlyLimit = limite(fd, "monthlyLimit");
  const dailyLimit = limite(fd, "dailyLimit");
  const expiresAt = vencimiento(fd);
  if (monthlyLimit === "invalido" || dailyLimit === "invalido") return { error: "Los límites deben ser enteros positivos (vacío = sin tope)" };
  if (expiresAt === "invalido") return { error: "Fecha de vencimiento inválida" };
  try {
    await actualizarApiKey(id, { monthlyLimit, dailyLimit, expiresAt });
  } catch (e) {
    return { error: msg(e) };
  }
  await registrarAuditoria("editar_api_key", null, { id, monthlyLimit, dailyLimit, expiresAt });
  revalidatePath("/admin/keys");
  return { ok: true };
}

export async function habilitarKeyAction(id: string, enabled: boolean): Promise<void> {
  if (!(await esAdmin())) return;
  await actualizarApiKey(id, { enabled });
  await registrarAuditoria(enabled ? "restaurar_api_key" : "revocar_api_key", null, { id });
  revalidatePath("/admin/keys");
}
