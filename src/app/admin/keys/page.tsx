import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { listarApiKeys } from "@/lib/sunat/apiKeys";
import { EditarKeyForm } from "./EditarKeyForm";
import { NuevaKeyForm } from "./NuevaKeyForm";
import { habilitarKeyAction } from "./actions";

export const dynamic = "force-dynamic";

const uso = (usado: number, tope: number | null) => (tope == null ? `${usado} / ∞` : `${usado} / ${tope}`);

export default async function KeysPage() {
  await requireAdmin();
  let data: Awaited<ReturnType<typeof listarApiKeys>> | null = null;
  let error: string | null = null;
  try {
    data = await listarApiKeys();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-neutral-900">API keys ({data?.keys.length ?? 0})</h1>
        <Link href="/admin" className="rounded-md px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100">
          ← Empresas
        </Link>
      </header>

      <NuevaKeyForm />

      {error && <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {data && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full rounded-xl border border-neutral-200 bg-white text-sm shadow-sm">
            <thead className="text-left text-neutral-500">
              <tr>
                <th className="p-3">Key</th>
                <th className="p-3">Dueño</th>
                <th className="p-3">Uso mes ({data.period})</th>
                <th className="p-3">Uso hoy</th>
                <th className="p-3">Límites y vencimiento</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {data.keys.map((k) => (
                <tr key={k.id} className="border-t border-neutral-100 align-top">
                  <td className="p-3">
                    {k.name} <span className="text-neutral-400">{k.prefix}…</span>
                    {!k.enabled && <span className="ml-2 text-xs text-red-600">revocada</span>}
                    {k.expired && <span className="ml-2 text-xs text-amber-700">vencida</span>}
                  </td>
                  <td className="p-3 text-neutral-600">{k.owner ?? "—"}</td>
                  <td className="p-3">{uso(k.usedMonth, k.monthlyLimit)}</td>
                  <td className="p-3">{uso(k.usedDay, k.dailyLimit)}</td>
                  <td className="p-3">
                    <EditarKeyForm k={k} />
                  </td>
                  <td className="p-3">
                    <form action={habilitarKeyAction.bind(null, k.id, !k.enabled)}>
                      <button className={`rounded-md px-2 py-1 text-xs ${k.enabled ? "text-red-600 hover:bg-red-50" : "text-emerald-700 hover:bg-emerald-50"}`}>
                        {k.enabled ? "Revocar" : "Restaurar"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
