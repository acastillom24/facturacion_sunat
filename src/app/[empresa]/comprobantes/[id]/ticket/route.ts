import { NextRequest, NextResponse } from "next/server";
import { getCompanyFromSession } from "@/lib/auth/current";
import { obtenerComprobante } from "@/lib/db/comprobantes";
import { generarTicketTexto } from "@/lib/sunat/ticketTexto";

export async function GET(req: NextRequest, { params }: { params: Promise<{ empresa: string; id: string }> }) {
  const { empresa, id } = await params;
  const company = await getCompanyFromSession(empresa);
  if (!company) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const comprobante = await obtenerComprobante(company.id, id);
  if (!comprobante) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const ancho = Number(req.nextUrl.searchParams.get("ancho") ?? "48");
  const texto = generarTicketTexto(comprobante.payload, ancho);
  return new NextResponse(texto, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
