import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { NuevaEmpresaForm } from "./NuevaEmpresaForm";

export default async function NuevaEmpresaPage() {
  await requireAdmin();
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/admin" className="text-sm text-indigo-600 hover:underline">
        ← Empresas
      </Link>
      <h1 className="mt-2 text-lg font-semibold text-neutral-900">Nueva empresa</h1>
      <NuevaEmpresaForm />
    </main>
  );
}
