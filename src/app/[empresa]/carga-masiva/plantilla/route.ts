import { NextRequest, NextResponse } from "next/server";
import { getCompanyFromSession } from "@/lib/auth/current";
import { generarPlantillaCargaMasiva } from "@/lib/excel/plantilla";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ empresa: string }> }) {
  const { empresa } = await params;
  const company = await getCompanyFromSession(empresa);
  if (!company) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const buffer = await generarPlantillaCargaMasiva();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-carga-masiva.xlsx"',
    },
  });
}
