import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { listarPlanes } from "@/lib/sunat/apiPlanes";
import { AsignarPlanForm } from "./AsignarPlanForm";
import { quitarPlanAction } from "./actions";

export const dynamic = "force-dynamic";

const uso = (usado: number, tope: number | null) => (tope == null ? `${usado} / ∞` : `${usado} / ${tope}`);
const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-PE", { timeZone: "America/Lima" });

export default async function PlanesPage() {
  await requireAdmin();
  let data: Awaited<ReturnType<typeof listarPlanes>> | null = null;
  let error: string | null = null;
  try {
    data = await listarPlanes();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const nombre = (id: string) => data?.catalog.find((p) => p.id === id)?.name ?? id;
  const gratis = data?.catalog.find((p) => p.id === "free")?.monthlyLimit ?? 20;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-neutral-900">Planes SUNAT ({data?.owners.length ?? 0} clientes)</h1>
        <div className="flex items-center gap-2">
          <Link href="/admin/keys" className="rounded-md px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100">
            API keys
          </Link>
          <Link href="/admin" className="rounded-md px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100">
            ← Empresas
          </Link>
        </div>
      </header>

      <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Con plan, todas las keys del cliente comparten la cuota mensual del plan (además de los límites de cada key).
        Sin plan, rigen solo los límites de cada key. <strong>Si un plan vence, el cliente cae al plan gratis ({gratis}/mes)</strong>:
        quítalo en vez de dejarlo vencer si quieres volver a los límites de las keys.
      </div>

      {error && <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {data && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full rounded-xl border border-neutral-200 bg-white text-sm shadow-sm">
            <thead className="text-left text-neutral-500">
              <tr>
                <th className="p-3">Cliente</th>
                <th className="p-3">Keys</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Uso mes ({data.period})</th>
                <th className="p-3">Asignar / editar</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {data.owners.map((d) => {
                const s = d.subscription;
                return (
                  <tr key={d.email} className="border-t border-neutral-100 align-top">
                    <td className="p-3">
                      {d.email}
                      {d.name && <div className="text-xs text-neutral-400">{d.name}</div>}
                    </td>
                    <td className="p-3">{d.keys}</td>
                    <td className="p-3">
                      {s ? (
                        <>
                          {nombre(s.plan)} <span className="text-neutral-400">({s.monthlyLimit ?? "∞"}/mes)</span>
                          <div className={`text-xs ${s.expired ? "text-red-600" : "text-neutral-500"}`}>
                            {s.expiresAt ? `${s.expired ? "venció" : "vence"} ${fecha(s.expiresAt)}` : "no vence"}
                            {s.expired && ` → rige el gratis (${gratis}/mes)`}
                          </div>
                        </>
                      ) : (
                        <span className="text-neutral-500">Sin plan (límites de la key)</span>
                      )}
                    </td>
                    <td className="p-3">
                      {s ? uso(d.usedMonth, s.expired ? gratis : s.monthlyLimit) : <span className="text-neutral-400">—</span>}
                    </td>
                    <td className="p-3">
                      <AsignarPlanForm dueno={d} catalogo={data.catalog} />
                    </td>
                    <td className="p-3">
                      {s && (
                        <form action={quitarPlanAction.bind(null, d.email)}>
                          <button className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50">Quitar plan</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
