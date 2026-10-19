import {
  marcarEmitido,
  marcarErrorConReintento,
  marcarErrorDefinitivo,
  type ComprobanteReintentable,
} from "@/lib/db/comprobantes";
import { emitirComprobante } from "./apisperu";
import { emitirComprobantePropio, tokenApisperu, usaApiPropia } from "./apiPropia";

export const MAX_INTENTOS = 6; // 6 reintentos horarios ~ 6h antes de marcar error definitivo

/**
 * Intenta emitir un comprobante ya creado (estado pendiente) contra APIsPERU o la API propia según `companies.sunat_provider`.
 * Usado tanto en la creación inicial como por el cron de reintentos. Solo
 * necesita id/payload/intentos, así los llamadores pueden traer de la base
 * de datos únicamente esas columnas en vez del comprobante completo.
 */
export async function intentarEmitir(comprobante: ComprobanteReintentable, company: { apisperu_token: string | null; sunat_provider: "apisperu" | "propia" }): Promise<{
  ok: boolean;
  estadoFinal: string;
}> {
  try {
    const propia = usaApiPropia(company);
    const resp = propia
      ? await emitirComprobantePropio(comprobante.payload, tokenApisperu(company))
      : await emitirComprobante(tokenApisperu(company), comprobante.payload);
    const sunat = resp.sunatResponse;

    if (sunat?.success) {
      await marcarEmitido(comprobante.id, sunat, resp.hash, propia ? "propia" : "apisperu");
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
