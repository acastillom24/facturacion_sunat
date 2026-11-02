import { llamarAdmin } from "./apiKeys";

/**
 * Planes de la API de SUNAT por cliente (dueño de keys), vía /v1/internal/admin/plans.
 * Con plan vigente, todas las keys del dueño comparten su cuota mensual (además de
 * los topes de cada key). Sin plan, rigen solo los topes de cada key. Si el plan
 * vence, la API aplica el plan gratis (20/mes).
 */

const PRODUCTO = "sunat";

export type PlanCatalogo = {
  id: string;
  name: string;
  monthlyLimit: number | null; // null = ilimitado
};

export type SuscripcionDueno = {
  plan: string;
  monthlyLimit: number | null;
  expiresAt: string | null;
  expired: boolean;
};

export type DuenoPlan = {
  email: string;
  name: string | null;
  /** Keys activas del dueño que llegan a SUNAT. */
  keys: number;
  subscription: SuscripcionDueno | null;
  /** Consumo del mes contra la cuota del plan. */
  usedMonth: number;
};

export type AsignacionPlan = {
  plan: string;
  /** Se omite para usar el límite del catálogo; null = ilimitado. */
  monthlyLimit?: number | null;
  expiresAt: string | null;
};

export const listarPlanes = () =>
  llamarAdmin<{ period: string; catalog: PlanCatalogo[]; owners: DuenoPlan[] }>(`/plans?product=${PRODUCTO}`);

export const asignarPlan = (email: string, body: AsignacionPlan) =>
  llamarAdmin<unknown>(`/plans/${PRODUCTO}`, { method: "PUT", body: { email, ...body } });

export const quitarPlan = (email: string) =>
  llamarAdmin<unknown>(`/plans/${PRODUCTO}?email=${encodeURIComponent(email)}`, { method: "DELETE" });
