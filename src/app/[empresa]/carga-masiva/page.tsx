import Link from "next/link";
import { requireCompany } from "@/lib/auth/current";
import { CargaMasivaForm } from "./CargaMasivaForm";

// El procesamiento es secuencial (un fetch a APIsPERU por fila) y puede tardar;
// 60s es el máximo permitido en el plan Hobby de Vercel.
export const maxDuration = 60;

export default async function CargaMasivaPage({
  params,
}: {
  params: Promise<{ empresa: string }>;
}) {
  const { empresa } = await params;
  await requireCompany(empresa);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href={`/${empresa}`} className="text-sm text-indigo-600 hover:underline">
        ← Volver
      </Link>
      <h1 className="mt-2 text-lg font-semibold text-neutral-900">Carga masiva</h1>
      <div className="mt-6">
        <CargaMasivaForm slug={empresa} />
      </div>
    </main>
  );
}
