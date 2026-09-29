import { NextRequest, NextResponse } from "next/server";
import { getCompanyById } from "@/lib/db/companies";
import { listarPendientesParaReintento } from "@/lib/db/comprobantes";
import { intentarEmitir } from "@/lib/sunat/emision";

/**
 * Reintenta comprobantes cuya emisión falló y cuyo `proximo_intento_at` ya venció.
 * Protegido con CRON_SECRET: lo llama Vercel Cron (ver vercel.json) o, en el
 * plan gratuito de Vercel (cron limitado a 1 vez/día), un scheduler externo
 * como cron-job.org apuntando aquí cada hora con el header Authorization.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const pendientes = await listarPendientesParaReintento();
  const resultados: { id: string; estadoFinal: string }[] = [];

  // Cachea la empresa por id dentro de esta corrida: si varios comprobantes
  // pendientes son de la misma empresa, evita repetir la misma consulta.
  const empresasCache = new Map<string, Awaited<ReturnType<typeof getCompanyById>>>();
  async function obtenerEmpresaCacheada(companyId: string) {
    if (!empresasCache.has(companyId)) {
      empresasCache.set(companyId, await getCompanyById(companyId));
    }
    return empresasCache.get(companyId) ?? null;
  }

  for (const comprobante of pendientes) {
    const company = await obtenerEmpresaCacheada(comprobante.company_id);
    if (!company) continue;
    const { estadoFinal } = await intentarEmitir(comprobante, company.apisperu_token);
    resultados.push({ id: comprobante.id, estadoFinal });
  }

  return NextResponse.json({ procesados: resultados.length, resultados });
}
