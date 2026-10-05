import type { Company } from "@/lib/db/companies";
import { companyToEmpresaSunat } from "@/lib/db/companies";
import { marcarAnulado, marcarAnulando, marcarErrorAnulacion, type Comprobante } from "@/lib/db/comprobantes";
import { siguienteCorrelativoResumen } from "@/lib/db/correlativos";
import { anularBoleta, anularFactura, nowLimaIso } from "./apisperu";

/**
 * Anula un comprobante ya emitido: boleta -> resumen diario (estado 3);
 * factura -> comunicación de baja. Devuelve `{ error }` si SUNAT lo rechaza o falla la red.
 */
export async function anularComprobante(
  company: Company,
  comprobante: Comprobante,
  motivoIn?: string,
): Promise<{ error?: string }> {
  if (comprobante.estado !== "emitido" && comprobante.estado !== "error_anulacion") {
    return { error: "Solo se pueden anular comprobantes emitidos o con error de anulación" };
  }
  const empresa = companyToEmpresaSunat(company);
  const fecResumen = nowLimaIso();

  if (comprobante.tipo_doc === "03") {
    const correlativoResumen = await siguienteCorrelativoResumen(company.id, fecResumen.slice(0, 10));
    await marcarAnulando(comprobante.id, {
      correlativoResumen: String(correlativoResumen),
      estado: "enviado",
      fecResumen,
    });
    try {
      const resultado = await anularBoleta({
        token: company.apisperu_token,
        empresa,
        serie: comprobante.serie,
        correlativo: comprobante.correlativo,
        correlativoResumen,
        total: comprobante.mto_imp_venta,
        clienteTipo: comprobante.cliente.tipoDoc,
        clienteNumero: comprobante.cliente.numDoc,
        fechaEmisionBoleta: comprobante.fecha_emision,
        fechaResumen: fecResumen,
        igvRate: Number(company.igv_rate),
      });
      if (resultado.ticket) {
        await marcarAnulado(comprobante.id, {
          correlativoResumen: String(correlativoResumen),
          ticket: resultado.ticket,
          estado: "aceptado",
          resultado,
          fecResumen,
        });
      } else {
        await marcarErrorAnulacion(comprobante.id, {
          correlativoResumen: String(correlativoResumen),
          estado: "rechazado",
          resultado,
          fecResumen,
        });
        return { error: "SUNAT rechazó la anulación, revisa el detalle" };
      }
    } catch (err) {
      await marcarErrorAnulacion(comprobante.id, {
        correlativoResumen: String(correlativoResumen),
        estado: "rechazado",
        resultado: { error: { message: err instanceof Error ? err.message : String(err) } },
        fecResumen,
      });
      return { error: "No hubo respuesta de la API al anular; el comprobante quedó con error de anulación, reintenta desde su detalle" };
    }
  } else {
    const motivo = motivoIn?.trim() || "ANULACION SOLICITADA POR EL EMISOR";
    const correlativoBaja = await siguienteCorrelativoResumen(company.id, fecResumen.slice(0, 10));
    await marcarAnulando(comprobante.id, {
      correlativoResumen: String(correlativoBaja),
      motivo,
      estado: "enviado",
      fecResumen,
    });
    try {
      const resultado = await anularFactura({
        token: company.apisperu_token,
        empresa,
        serie: comprobante.serie,
        correlativo: comprobante.correlativo,
        correlativoBaja,
        motivo,
        fechaEmisionFactura: comprobante.fecha_emision,
        fechaComunicacion: fecResumen,
      });
      if (resultado.ticket) {
        await marcarAnulado(comprobante.id, {
          correlativoResumen: String(correlativoBaja),
          motivo,
          ticket: resultado.ticket,
          estado: "aceptado",
          resultado,
          fecResumen,
        });
      } else {
        await marcarErrorAnulacion(comprobante.id, {
          correlativoResumen: String(correlativoBaja),
          motivo,
          estado: "rechazado",
          resultado,
          fecResumen,
        });
        return { error: "SUNAT rechazó la comunicación de baja, revisa el detalle" };
      }
    } catch (err) {
      await marcarErrorAnulacion(comprobante.id, {
        correlativoResumen: String(correlativoBaja),
        motivo,
        estado: "rechazado",
        resultado: { error: { message: err instanceof Error ? err.message : String(err) } },
        fecResumen,
      });
      return { error: "No hubo respuesta de la API al anular; el comprobante quedó con error de anulación, reintenta desde su detalle" };
    }
  }

  return {};
}
