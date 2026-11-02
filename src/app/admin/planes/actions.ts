"use server";

import { revalidatePath } from "next/cache";
import { esAdmin } from "@/lib/auth/admin";
import { limite, mensajeError, texto, vencimiento } from "@/lib/admin/campos";
import { registrarAuditoria } from "@/lib/db/audit";
import { asignarPlan, quitarPlan, type AsignacionPlan } from "@/lib/sunat/apiPlanes";

export async function asignarPlanAction(email: string, fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  if (!(await esAdmin())) return { error: "Sesión admin vencida" };
  const plan = texto(fd, "plan");
  if (!plan || plan === "free") return { error: "Elige un plan" };
  const expiresAt = vencimiento(fd);
  if (expiresAt === "invalido") return { error: "Fecha de vencimiento inválida" };
  if (expiresAt && new Date(expiresAt) <= new Date()) return { error: "La fecha de vencimiento ya pasó" };

  const body: AsignacionPlan = { plan, expiresAt };
  if (fd.get("ilimitado")) {
    body.monthlyLimit = null;
  } else {
    // Vacío = el límite del catálogo (no se manda).
    const monthlyLimit = limite(fd, "monthlyLimit");
    if (monthlyLimit === "invalido") return { error: "El límite debe ser un entero positivo (vacío = el del plan)" };
    if (monthlyLimit !== null) body.monthlyLimit = monthlyLimit;
  }

  try {
    await asignarPlan(email, body);
  } catch (e) {
    return { error: mensajeError(e) };
  }
  await registrarAuditoria("asignar_plan", null, { email, product: "sunat", ...body });
  revalidatePath("/admin/planes");
  return { ok: true };
}

export async function quitarPlanAction(email: string): Promise<void> {
  if (!(await esAdmin())) return;
  await quitarPlan(email);
  await registrarAuditoria("quitar_plan", null, { email, product: "sunat" });
  revalidatePath("/admin/planes");
}
