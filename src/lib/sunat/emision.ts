import {
  marcarEmitido,
  marcarErrorConReintento,
  marcarErrorDefinitivo,
  type ComprobanteReintentable,
} from "@/lib/db/comprobantes";
import { emitirComprobante } from "./apisperu";

export const MAX_INTENTOS = 6; // 6 reintentos horarios ~ 6h antes de marcar error definitivo

/**
 * Intenta emitir un comprobante ya creado (estado pendiente) contra APIsPERU.
 * Usado tanto en la creación inicial como por el cron de reintentos. Solo
 * necesita id/payload/intentos, así los llamadores pueden traer de la base
 * de datos únicamente esas columnas en vez del comprobante completo.
 */
export async function intentarEmitir(comprobante: ComprobanteReintentable, token: string): Promise<{
  ok: boolean;
  estadoFinal: string;
}> {
  try {
    const resp = await emitirComprobante(token, comprobante.payload);
    const sunat = resp.sunatResponse;

    if (sunat?.success) {
      await marcarEmitido(comprobante.id, sunat, resp.hash);
      return { ok: true, estadoFinal: "emitido" };
    }

    // SUNAT respondió pero sin éxito (rechazo o error de validación).
    if (comprobante.intentos + 1 >= MAX_INTENTOS) {
      await marcarErrorDefinitivo(comprobante.id, sunat ?? null);
      return { ok: false, estadoFinal: "error" };
    }
    await marcarErrorConReintento(comprobante.id, sunat ?? null, comprobante.intentos);
    return { ok: false, estadoFinal: "pendiente" };
  } catch (err) {
    // Error de red / timeout / respuesta inesperada: se reintenta igual.
    const mensaje = err instanceof Error ? err.message : String(err);
    if (comprobante.intentos + 1 >= MAX_INTENTOS) {
      await marcarErrorDefinitivo(comprobante.id, { error: { message: mensaje } });
      return { ok: false, estadoFinal: "error" };
    }
    await marcarErrorConReintento(comprobante.id, { error: { message: mensaje } }, comprobante.intentos);
    return { ok: false, estadoFinal: "pendiente" };
  }
}
