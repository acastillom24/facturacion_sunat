import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { getCompanyBySlug } from "@/lib/db/companies";
import { estadoEmpresaPropia, type EstadoEmpresaPropia } from "@/lib/sunat/apiPropiaEmpresa";
import { tokenApisperu } from "@/lib/sunat/apiPropia";
import { ControlesEmpresa } from "./ControlesEmpresa";
import { query } from "@/lib/db/client";
import { CorrelativosForm, LogoForm } from "./LogoYCorrelativos";
import { ProveedorForm } from "./ProveedorForm";
import { Badge, Mensaje } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function AdminEmpresaPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const series = await query<{ tipo_doc: string; serie: string; ultimo_correlativo: number }>(
    "select tipo_doc, serie, ultimo_correlativo from correlativos where company_id = $1 order by tipo_doc desc, serie",
    [company.id],
  );

  let estado: EstadoEmpresaPropia | null = null;
  let errorApi: string | null = null;
  try {
    if (company.apisperu_token) estado = await estadoEmpresaPropia(company.ruc, tokenApisperu(company));
  } catch (e) {
    errorApi = e instanceof Error ? e.message : String(e);
  }

  const propia = company.sunat_provider === "propia";
  const cert = estado?.certificado;
  const certResumen = cert ? `${cert.vencido ? "Vencido" : "Vigente"} · vence ${cert.valido_hasta.slice(0, 10)}` : null;

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <Link href="/admin" className="text-sm text-indigo-600 hover:underline">
          ← Empresas
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-neutral-900">{company.razon_social}</h1>
        <p className="text-sm text-neutral-500">RUC {company.ruc} · /{company.slug}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tono={company.activa ? "ok" : "error"}>{company.activa ? "Activa" : "Suspendida"}</Badge>
          <Badge tono={propia ? "ok" : "neutro"}>{propia ? "API propia" : "APIsPERU"}</Badge>
          {propia && estado && (
            <>
              <Badge tono={estado.ambiente === "produccion" ? "ok" : "aviso"}>{estado.ambiente === "produccion" ? "Producción" : "Beta"}</Badge>
              <Badge tono={estado.listo_para_produccion ? "ok" : "aviso"}>
                {estado.listo_para_produccion ? "Lista para producción" : `Falta: ${estado.faltantes_para_produccion.join(", ")}`}
              </Badge>
            </>
          )}
        </div>
        {propia && errorApi && (
          <div className="mt-3">
            <Mensaje tono="error">No se pudo consultar la API: {errorApi}</Mensaje>
          </div>
        )}
        {propia && !errorApi && !estado && (
          <div className="mt-3">
            <Mensaje tono="aviso">La empresa aún no está registrada en la API; se creará al guardar el proveedor.</Mensaje>
          </div>
        )}
      </div>

      <ProveedorForm
        slug={slug}
        actual={company.sunat_provider}
        tieneToken={!!company.apisperu_token}
        ambienteActual={estado?.ambiente ?? "beta"}
        solUsuarioActual={estado?.sol_usuario ?? ""}
        tieneSolClave={estado?.tiene_sol_clave ?? false}
        certificadoResumen={certResumen}
      />

      <LogoForm slug={slug} logoUrl={company.logo_url} enApi={propia && estado ? estado.tiene_logo : null} />

      <CorrelativosForm slug={slug} series={series ?? []} />

      <ControlesEmpresa slug={slug} activa={company.activa} />
    </main>
  );
}
