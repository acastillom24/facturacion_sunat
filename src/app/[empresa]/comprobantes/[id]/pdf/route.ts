import { NextRequest, NextResponse } from "next/server";
import { getCompanyFromSession } from "@/lib/auth/current";
import { obtenerComprobante } from "@/lib/db/comprobantes";
import { descargarPdfComprobante } from "@/lib/sunat/apisperu";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ empresa: string; id: string }> }) {
  const { empresa, id } = await params;
  const company = await getCompanyFromSession(empresa);
  if (!company) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const comprobante = await obtenerComprobante(company.id, id);
  if (!comprobante) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (comprobante.estado === "pendiente" && !comprobante.hash) {
    return NextResponse.json({ error: "El comprobante aún no fue emitido" }, { status: 409 });
  }

  const pdf = await descargarPdfComprobante(company.apisperu_token, comprobante.payload);
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${comprobante.serie}-${comprobante.correlativo}.pdf"`,
    },
  });
}
