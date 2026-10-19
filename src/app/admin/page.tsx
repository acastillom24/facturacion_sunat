import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { tokenApisperu } from "@/lib/sunat/apiPropia";
import { estadoEmpresaPropia } from "@/lib/sunat/apiPropiaEmpresa";
import { adminLogoutAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const { data, error } = await supabaseAdmin()
    .from("companies")
    .select("slug, ruc, razon_social, sunat_provider, activa, apisperu_token")
    .order("razon_social");
  if (error) throw error;

  // Vencimiento del certificado (solo empresas en API propia), en paralelo y tolerante a fallos.
  const certs = new Map<string, { vence?: string; dias?: number; error?: boolean }>();
  await Promise.all(
    (data ?? [])
      .filter((c) => c.sunat_provider === "propia")
      .map(async (c) => {
        try {
          const cert = (await estadoEmpresaPropia(c.ruc, tokenApisperu(c)))?.certificado;
          if (!cert) return certs.set(c.slug, {});
          const vence = cert.valido_hasta.slice(0, 10);
          certs.set(c.slug, { vence, dias: Math.floor((new Date(vence).getTime() - Date.now()) / 86_400_000) });
        } catch {
          certs.set(c.slug, { error: true });
        }
      }),
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-neutral-900">Empresas ({data?.length ?? 0})</h1>
        <div className="flex items-center gap-2">
          <Link href="/admin/keys" className="rounded-md px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100">
            API keys
          </Link>
          <Link href="/admin/nueva"className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Nueva empresa
          </Link>
          <form action={adminLogoutAction}>
            <button className="rounded-md px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100">Salir</button>
          </form>
        </div>
      </header>
      <table className="mt-4 w-full rounded-xl border border-neutral-200 bg-white text-sm shadow-sm">
        <thead className="text-left text-neutral-500">
          <tr>
            <th className="p-3">Empresa</th>
            <th className="p-3">RUC</th>
            <th className="p-3">Proveedor</th>
            <th className="p-3">Certificado</th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {data?.map((c) => (
            <tr key={c.slug} className="border-t border-neutral-100">
              <td className="p-3">
                {c.razon_social} <span className="text-neutral-400">/{c.slug}</span>
                {!c.activa && <span className="ml-2 text-xs text-red-600">suspendida</span>}
              </td>
              <td className="p-3">{c.ruc}</td>
              <td className="p-3">
                <span className={c.sunat_provider === "propia" ? "text-emerald-700" : "text-neutral-600"}>
                  {c.sunat_provider === "propia" ? "API propia" : "APIsPERU"}
                </span>
              </td>
              <td className="p-3">
                {(() => {
                  const k = certs.get(c.slug);
                  if (!k) return <span className="text-neutral-400">—</span>;
                  if (k.error) return <span className="text-amber-700">sin respuesta</span>;
                  if (!k.vence) return <span className="text-amber-700">no cargado</span>;
                  const color = k.dias! < 0 ? "text-red-600 font-medium" : k.dias! <= 30 ? "text-amber-700" : "text-neutral-600";
                  return (
                    <span className={color}>
                      {k.dias! < 0 ? `vencido ${k.vence}` : `vence ${k.vence} (${k.dias} d)`}
                    </span>
                  );
                })()}
              </td>
              <td className="p-3 text-right">
                <Link href={`/admin/${c.slug}`} className="text-indigo-600 hover:underline">
                  Configurar
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
