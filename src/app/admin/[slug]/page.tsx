import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { getCompanyBySlug } from "@/lib/db/companies";
import { estadoEmpresaPropia, type EstadoEmpresaPropia } from "@/lib/sunat/apiPropiaEmpresa";
import { tokenApisperu } from "@/lib/sunat/apiPropia";
import { ControlesEmpresa } from "./ControlesEmpresa";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CorrelativosForm, LogoForm } from "./LogoYCorrelativos";
import { ProveedorForm } from "./ProveedorForm";

export const dynamic = "force-dynamic";

export default async function AdminEmpresaPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const { data: series } = await supabaseAdmin()
    .from("correlativos")
    .select("tipo_doc, serie, ultimo_correlativo")
    .eq("company_id", company.id)
    .order("tipo_doc", { ascending: false })
    .order("serie");

  let estado: EstadoEmpresaPropia | null = null;
  let errorApi: string | null = null;
  try {
    if (company.apisperu_token) estado = await estadoEmpresaPropia(company.ruc, tokenApisperu(company));
  } catch (e) {
    errorApi = e instanceof Error ? e.message : String(e);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/admin" className="text-sm text-indigo-600 hover:underline">
        ← Empresas
      </Link>
      <h1 className="mt-2 text-lg font-semibold text-neutral-900">{company.razon_social}</h1>
      <p className="text-sm text-neutral-500">RUC {company.ruc} · /{company.slug}</p>

      <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Proveedor de emisión</h2>
        <ProveedorForm
          slug={slug}
          actual={company.sunat_provider}
          tieneToken={!!company.apisperu_token}
          ambienteActual={estado?.ambiente ?? "beta"}
          solUsuarioActual={estado?.sol_usuario ?? ""}
        />
      </section>

      <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">
          Acceso {company.activa ? "" : <span className="text-red-600">(SUSPENDIDA)</span>}
        </h2>
        <ControlesEmpresa slug={slug} activa={company.activa} />
      </section>

      <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Logo</h2>
        <LogoForm slug={slug} logoUrl={company.logo_url} />
      </section>

      <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Correlativos</h2>
        <CorrelativosForm slug={slug} series={series ?? []} />
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-neutral-700">Estado en la API propia</h2>
        {errorApi && <p className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-700">No se pudo consultar la API: {errorApi}</p>}
        {(
          <>
            <p className="mt-2 rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700 shadow-sm">
              {estado ? (
                <>
                  Ambiente: <b>{estado.ambiente === "produccion" ? "Producción" : "Beta"}</b> · SOL: {estado.sol_usuario ?? "—"} (clave{" "}
                  {estado.tiene_sol_clave ? "guardada" : "no cargada"}) · Certificado:{" "}
                  {estado.certificado
                    ? `${estado.certificado.titular}, vence ${estado.certificado.valido_hasta.slice(0, 10)}${estado.certificado.vencido ? " (VENCIDO)" : ""}`
                    : "no cargado"}
                  <br />
                  <span className={estado.listo_para_produccion ? "text-emerald-700" : "text-amber-700"}>
                    {estado.listo_para_produccion ? "Lista para producción." : `Falta: ${estado.faltantes_para_produccion.join(", ")}`}
                  </span>
                </>
              ) : (
                "Empresa aún no registrada en la API; se creará al guardar."
              )}
            </p>
          </>
        )}
      </section>
    </main>
  );
}
