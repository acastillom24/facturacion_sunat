import { NextRequest, NextResponse } from "next/server";
import { getCompanyFromSession } from "@/lib/auth/current";
import { previsualizarCorrelativo } from "@/lib/db/correlativos";
import type { TipoDoc } from "@/lib/sunat/types";

export async function GET(req: NextRequest, { params }: { params: Promise<{ empresa: string }> }) {
  const { empresa } = await params;
  const company = await getCompanyFromSession(empresa);
  if (!company) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const tipoDoc = req.nextUrl.searchParams.get("tipoDoc") as TipoDoc | null;
  const serie = (req.nextUrl.searchParams.get("serie") ?? "").toUpperCase();
  if ((tipoDoc !== "01" && tipoDoc !== "03") || !/^[A-Z]\d{3}$/.test(serie)) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const correlativo = await previsualizarCorrelativo(company.id, tipoDoc, serie);
  return NextResponse.json({ correlativo });
}
