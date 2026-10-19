import { totpActivado } from "@/lib/auth/totp";
import { AdminLoginForm } from "./AdminLoginForm";

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-lg">
        <h1 className="text-xl font-semibold text-neutral-900">Administración</h1>
        <AdminLoginForm conTotp={totpActivado()} />
      </div>
    </main>
  );
}
