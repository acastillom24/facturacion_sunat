import Link from "next/link";
import { requireCompany } from "@/lib/auth/current";
import { NuevoComprobanteForm } from "./NuevoComprobanteForm";

export default async function NuevoComprobantePage({
  params,
}: {
  params: Promise<{ empresa: string }>;
}) {
  const { empresa } = await params;
  await requireCompany(empresa);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href={`/${empresa}`} className="text-sm text-indigo-600 hover:underline">
        ← Volver
      </Link>
      <h1 className="mt-2 text-lg font-semibold text-neutral-900">Nuevo comprobante</h1>
      <div className="mt-6">
        <NuevoComprobanteForm slug={empresa} />
      </div>
    </main>
  );
}
