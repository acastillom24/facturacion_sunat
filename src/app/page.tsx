export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-50 to-slate-50 px-4 text-center">
      <h1 className="text-2xl font-semibold text-neutral-900">Facturación electrónica SUNAT</h1>
      <p className="mt-2 max-w-md text-sm text-neutral-500">
        Cada empresa tiene su propio acceso en <code className="rounded bg-neutral-100 px-1.5 py-0.5">/nombre-empresa</code>.
        Pide a tu administrador el identificador de tu empresa e ingresa a esa dirección para iniciar sesión.
      </p>
    </main>
  );
}
