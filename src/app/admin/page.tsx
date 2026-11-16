import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { query } from "@/lib/db/client";
import { diasHasta } from "@/lib/fechas";
import { tokenApisperu } from "@/lib/sunat/apiPropia";
import { estadoEmpresaPropia } from "@/lib/sunat/apiPropiaEmpresa";
import { adminLogoutAction } from "./actions";
import { ListaEmpresas, type FilaEmpresa } from "./ListaEmpresas";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const data = await query<{ slug: string; ruc: string; razon_social: string; sunat_provider: string; activa: boolean; apisperu_token: string | null }>(
    "select slug, ruc, razon_social, sunat_provider, activa, apisperu_token from companies order by razon_social",
  );

  // Vencimiento del certificado (solo empresas en API propia), en paralelo y tolerante a fallos.
  const certs = new Map<string, { vence?: string; dias?: number; error?: boolean; logo?: boolean }>();
  await Promise.all(
    (data ?? [])
      .filter((c) => c.sunat_provider === "propia")
      .map(async (c) => {
        try {
          const estado = await estadoEmpresaPropia(c.ruc, tokenApisperu(c));
          const cert = estado?.certificado;
          const logo = estado?.tiene_logo;
          if (!cert) return certs.set(c.slug, { logo });
          const vence = cert.valido_hasta.slice(0, 10);
          certs.set(c.slug, { vence, dias: diasHasta(vence), logo });
        } catch {
          certs.set(c.slug, { error: true });
        }
      }),
  );

  const filas: FilaEmpresa[] = (data ?? []).map((c) => {
    const propia = c.sunat_provider === "propia";
    const k = certs.get(c.slug);
    return {
      slug: c.slug,
      ruc: c.ruc,
      razonSocial: c.razon_social,
      propia,
      activa: c.activa,
      cert: propia ? (k ? { error: k.error, vence: k.vence, dias: k.dias } : { error: true }) : undefined,
      logo: k?.logo,
    };
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Empresas</h1>
          <p className="text-sm text-neutral-500">{filas.length} registradas · {filas.filter((f) => f.activa).length} activas</p>
        </div>
        <nav className="flex items-center gap-1">
          <Link href="/admin/keys" className="rounded-lg px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100">
            API keys
          </Link>
          <Link href="/admin/planes" className="rounded-lg px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100">
            Planes
          </Link>
          <Link href="/admin/nueva" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            + Nueva empresa
          </Link>
          <form action={adminLogoutAction}>
            <button className="rounded-lg px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100">Salir</button>
          </form>
        </nav>
      </header>
      <ListaEmpresas filas={filas} />
    </main>
  );
}
