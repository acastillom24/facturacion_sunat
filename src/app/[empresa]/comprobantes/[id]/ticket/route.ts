import { NextRequest, NextResponse } from "next/server";
import { getCompanyFromSession } from "@/lib/auth/current";
import { obtenerComprobante } from "@/lib/db/comprobantes";
import { generarTicketPdf } from "@/lib/sunat/ticketPdf";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ empresa: string; id: string }> }) {
  const { empresa, id } = await params;
  const company = await getCompanyFromSession(empresa);
  if (!company) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const comprobante = await obtenerComprobante(company.id, id);
  if (!comprobante) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const pdf = await generarTicketPdf(comprobante.payload, comprobante.hash, company.logo_url);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="ticket-${comprobante.serie}-${comprobante.correlativo}.pdf"`,
    },
  });
}
