import { getCompanyBySlug } from "@/lib/db/companies";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ empresa: string }>;
}) {
  const { empresa } = await params;
  const company = await getCompanyBySlug(empresa);

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-neutral-900">
          {company ? company.razon_social : empresa}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">Facturación electrónica SUNAT</p>

        {!company ? (
          <p className="mt-6 text-sm text-red-600">
            No existe una empresa con el identificador &quot;{empresa}&quot;.
          </p>
        ) : (
          <LoginForm slug={empresa} />
        )}
      </div>
    </main>
  );
}
