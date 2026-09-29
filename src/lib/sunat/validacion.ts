import type { ClienteSunat, TipoDoc } from "./types";

/** SUNAT exige identificar al cliente de una boleta cuando el monto supera este umbral. */
export const UMBRAL_DNI_BOLETA = 699;

const RUC_REGEX = /^\d{11}$/;
const DNI_REGEX = /^\d{8}$/;

/**
 * Reglas comunes de cliente para emitir un comprobante, usadas tanto en el
 * alta individual como en la carga masiva:
 *  - Factura (01): siempre requiere RUC (11 dígitos) y razón social.
 *  - Boleta (03): si el total con IGV supera UMBRAL_DNI_BOLETA, requiere DNI (8 dígitos).
 * Devuelve un mensaje de error, o null si es válido.
 */
export function validarCliente(
  tipoDoc: TipoDoc,
  cliente: ClienteSunat,
  totalConIgv: number,
): string | null {
  if (tipoDoc === "01") {
    if (cliente.tipoDoc !== "6" || !RUC_REGEX.test(cliente.numDoc) || !cliente.rznSocial.trim()) {
      return "Una factura requiere cliente con RUC (11 dígitos) y razón social";
    }
    return null;
  }

  if (totalConIgv > UMBRAL_DNI_BOLETA && (cliente.tipoDoc !== "1" || !DNI_REGEX.test(cliente.numDoc))) {
    return `El monto (S/ ${totalConIgv.toFixed(2)}) supera S/ ${UMBRAL_DNI_BOLETA}: la boleta requiere el DNI (8 dígitos) del cliente`;
  }
  return null;
}

/**
 * Infiere el tipo de documento del cliente a partir del número (usado en la carga masiva).
 * Devuelve un mensaje de error si el documento no está vacío pero no es un DNI (8 dígitos)
 * ni un RUC (11 dígitos) válido.
 */
export function inferirClienteDesdeDocumento(
  documento: string | undefined,
  nombre: string | undefined,
): { cliente: ClienteSunat } | { error: string } {
  const doc = (documento ?? "").trim();
  const nombreLimpio = (nombre ?? "").trim();

  if (!doc) {
    return { cliente: { tipoDoc: "0", numDoc: "-", rznSocial: nombreLimpio || "Cliente varios" } };
  }
  if (RUC_REGEX.test(doc)) {
    return { cliente: { tipoDoc: "6", numDoc: doc, rznSocial: nombreLimpio || "-" } };
  }
  if (DNI_REGEX.test(doc)) {
    return { cliente: { tipoDoc: "1", numDoc: doc, rznSocial: nombreLimpio || "-" } };
  }
  return { error: `Documento de cliente inválido ("${doc}"): debe ser DNI (8 dígitos) o RUC (11 dígitos)` };
}
