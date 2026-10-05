import Image from "next/image";

const WA_NUMBER = "51952520362";
const EMAIL = "alin.castillo1995@gmail.com";
const wa = (msg: string) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
const WA_DEMO = wa("Hola, quiero una demo del sistema de facturación electrónica SUNAT.");

const features = [
  { t: "Boletas y facturas en segundos", d: "Emite comprobantes electrónicos válidos ante SUNAT desde cualquier dispositivo, sin instalar nada.", i: "M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v14l-3-2-2 2-2-2-2 2-2-2-3 2V6a2 2 0 012-2z" },
  { t: "Carga masiva desde Excel", d: "Sube hasta 500 ventas por carga y genera todos los comprobantes automáticamente, las veces que necesites.", i: "M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0-12l-4 4m4-4l4 4" },
  { t: "Anulaciones masivas", d: "Anula varios comprobantes a la vez o de forma individual, con control total y trazabilidad.", i: "M6 18L18 6M6 6l12 12" },
  { t: "Emisiones ilimitadas", d: "Sin tope mensual: emite todos los comprobantes que tu negocio necesite.", i: "M18.2 8a4 4 0 100 8c3 0 4.8-4 6-4s-3-4-6-4zM5.8 8a4 4 0 110 8c-3 0-4.8-4-6-4s3-4 6-4z" },
  { t: "Reintentos automáticos", d: "Si SUNAT no responde, el sistema reintenta solo. Tú no pierdes ninguna venta.", i: "M4 4v5h5M20 20v-5h-5M5.6 15A8 8 0 0018 17.7M18.4 9A8 8 0 006 6.3" },
  { t: "Multi-empresa", d: "Cada negocio con su acceso propio, series y correlativos independientes y datos aislados.", i: "M3 21h18M5 21V7l7-4 7 4v14M9 9h1m4 0h1M9 13h1m4 0h1M9 17h1m4 0h1" },
  { t: "Para todos tus equipos", d: "Celular, tablet, laptop o PC. Diseño adaptable para vender donde estés.", i: "M7 4h10a1 1 0 011 1v14a1 1 0 01-1 1H7a1 1 0 01-1-1V5a1 1 0 011-1zm5 14h.01" },
];

const steps = [
  { n: "01", t: "Nos escribes", d: "Cuéntanos qué vendes y cuántos comprobantes emites al mes." },
  { n: "02", t: "Configuramos tu empresa", d: "Creamos tu acceso, series y conexión con SUNAT. Tú no tocas nada técnico." },
  { n: "03", t: "Empiezas a facturar", d: "Ingresas a tu enlace propio y emites desde el primer día, con acompañamiento." },
];

const stats = [
  { v: "100%", l: "Online, sin instalar" },
  { v: "∞", l: "Emisiones ilimitadas" },
  { v: "500", l: "Emisiones por cada carga" },
  { v: "SUNAT", l: "Envío electrónico" },
];

const faqs = [
  { q: "¿Necesito instalar algún programa?", a: "No. Funciona desde el navegador en tu celular, tablet o computadora." },
  { q: "¿Mis comprobantes son válidos ante SUNAT?", a: "Sí. Se envían electrónicamente a SUNAT y recibes la constancia de aceptación (CDR)." },
  { q: "¿Puedo emitir muchas ventas a la vez?", a: "Sí. Las emisiones son ilimitadas y cada carga masiva desde Excel procesa hasta 500 comprobantes." },
  { q: "¿Cuánto tarda la implementación?", a: "Normalmente tu empresa queda lista para facturar en pocas horas tras compartirnos tus datos." },
  { q: "¿Qué pasa si SUNAT está caído?", a: "El sistema reintenta automáticamente hasta que el comprobante sea aceptado." },
];

function Icon({ d, className = "h-6 w-6" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={d} />
    </svg>
  );
}

const WaIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1l-.9 1.1c-.2.2-.3.2-.6.1a7.6 7.6 0 01-3.8-3.3c-.3-.5.3-.5.8-1.5.1-.2 0-.4 0-.5l-.9-2.1c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.2c0 1.3.9 2.6 1 2.8.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4l-.5-.3zM12 2a10 10 0 00-8.6 15L2 22l5.2-1.4A10 10 0 1012 2z" />
  </svg>
);

export default function Home() {
  return (
    <div className="overflow-x-hidden bg-slate-950 text-slate-100">
      {/* NAV */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <a href="#inicio" className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-sm">E</span>
            Emite<span className="text-indigo-400">Sunat</span>
          </a>
          <div className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
            <a href="#funciones" className="hover:text-white">Funciones</a>
            <a href="#proceso" className="hover:text-white">Cómo funciona</a>
            <a href="#clientes" className="hover:text-white">Clientes</a>
            <a href="#faq" className="hover:text-white">Preguntas</a>
          </div>
          <a href={WA_DEMO} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400">
            <WaIcon className="h-4 w-4" /> <span className="hidden sm:inline">Escríbenos</span><span className="sm:hidden">WhatsApp</span>
          </a>
        </nav>
      </header>

      {/* HERO */}
      <section id="inicio" className="relative isolate px-4 pb-20 pt-32 sm:px-6 sm:pt-40">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-indigo-600/40 blur-[120px]" />
          <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-fuchsia-600/30 blur-[110px]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        </div>
        <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
          <div className="rise text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Facturación electrónica SUNAT
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              Factura sin complicaciones.{" "}
              <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-amber-300 bg-clip-text text-transparent">Vende sin límites.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base text-slate-300 sm:text-lg lg:mx-0">
              Emite boletas y facturas electrónicas, anula en masa y carga ventas desde Excel. Nosotros lo configuramos todo por ti y tu negocio empieza a facturar hoy.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <a href={WA_DEMO} target="_blank" rel="noopener noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-7 py-3.5 font-semibold text-white shadow-xl shadow-emerald-500/30 transition hover:scale-[1.03] hover:bg-emerald-400 sm:w-auto">
                <WaIcon /> Solicitar demo por WhatsApp
              </a>
              <a href={`mailto:${EMAIL}?subject=${encodeURIComponent("Consulta facturación electrónica")}`} className="inline-flex w-full items-center justify-center rounded-full border border-white/20 px-7 py-3.5 font-semibold transition hover:bg-white/10 sm:w-auto">
                Escribir por correo
              </a>
            </div>
          </div>

          {/* mockup */}
          <div className="rise relative mx-auto w-full max-w-md [animation-delay:.2s]">
            <div className="float rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-indigo-900/40 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Factura F001-00128</p>
                <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-medium text-emerald-300">● Aceptada SUNAT</span>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                {[["Cliente", "Comercial Andina S.A.C."], ["RUC", "20512345678"], ["Subtotal", "S/ 1,016.95"], ["IGV 18%", "S/ 183.05"]].map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-white/5 pb-2 text-slate-300"><span>{k}</span><span className="font-medium text-white">{v}</span></div>
                ))}
                <div className="flex items-end justify-between pt-2"><span className="text-slate-400">Total</span><span className="text-3xl font-extrabold">S/ 1,200.00</span></div>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full w-4/5 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500" /></div>
              <p className="mt-2 text-xs text-slate-400">Carga masiva · 32 de 40 comprobantes</p>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-20 grid max-w-4xl grid-cols-2 gap-6 text-center sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.l}><p className="bg-gradient-to-b from-white to-slate-400 bg-clip-text text-3xl font-extrabold text-transparent">{s.v}</p><p className="mt-1 text-xs text-slate-400">{s.l}</p></div>
          ))}
        </div>
      </section>

      {/* CLIENTES */}
      <section id="clientes" className="border-y border-white/10 bg-white/[0.02] py-12">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Empresas que confían en nosotros</p>
        <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center gap-4 px-4 text-center">
          <div className="reveal rounded-2xl bg-white px-10 py-6 shadow-2xl shadow-indigo-500/20 transition hover:scale-105">
            <Image src="/logos/le-chic.png" alt="Le Chic" width={180} height={70} className="h-14 w-auto object-contain" />
          </div>
          <p className="max-w-md text-sm text-slate-300">Trabajamos con <strong className="text-white">Le Chic</strong>, que factura con nuestro sistema día a día.</p>
        </div>
      </section>

      {/* FUNCIONES */}
      <section id="funciones" className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="reveal mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold text-indigo-400">Funciones</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Todo lo que tu negocio necesita para facturar</h2>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.t} className="reveal group rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-6 transition hover:-translate-y-1 hover:border-indigo-400/50 hover:shadow-xl hover:shadow-indigo-500/10">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white transition group-hover:scale-110"><Icon d={f.i} /></div>
                <h3 className="mt-5 text-lg font-bold">{f.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROCESO */}
      <section id="proceso" className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="reveal text-center text-3xl font-extrabold tracking-tight sm:text-4xl">Empieza en 3 pasos</h2>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="reveal rounded-2xl border border-white/10 bg-white/[0.04] p-7">
                <span className="bg-gradient-to-br from-indigo-400 to-fuchsia-400 bg-clip-text text-5xl font-black text-transparent">{s.n}</span>
                <h3 className="mt-3 text-lg font-bold">{s.t}</h3>
                <p className="mt-2 text-sm text-slate-400">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h2 className="reveal text-center text-3xl font-extrabold tracking-tight sm:text-4xl">Preguntas frecuentes</h2>
          <div className="mt-10 space-y-3">
            {faqs.map((f) => (
              <details key={f.q} className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-4 open:border-indigo-400/40">
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold">
                  {f.q}
                  <svg className="chev h-5 w-5 shrink-0 text-indigo-400 transition" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                </summary>
                <p className="mt-3 text-sm text-slate-400">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contacto" className="px-4 pb-24 sm:px-6">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-16 text-center shadow-2xl shadow-indigo-700/30 sm:px-12">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/20 blur-3xl" />
          <h2 className="relative text-3xl font-extrabold tracking-tight sm:text-5xl">¿Listo para facturar sin dolores de cabeza?</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-indigo-100">Escríbenos ahora y te respondemos en minutos. Te mostramos el sistema y dejamos tu empresa lista.</p>
          <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href={WA_DEMO} target="_blank" rel="noopener noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 font-bold text-emerald-600 shadow-xl transition hover:scale-105 sm:w-auto">
              <WaIcon /> +51 952 520 362
            </a>
            <a href={`mailto:${EMAIL}`} className="inline-flex w-full items-center justify-center break-all rounded-full border border-white/40 px-7 py-3.5 font-semibold transition hover:bg-white/10 sm:w-auto">{EMAIL}</a>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-4 py-8 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} EmiteSunat · Facturación electrónica para tu negocio</p>
        <p className="mt-1">¿Ya eres cliente? Ingresa a <code className="rounded bg-white/10 px-1.5 py-0.5">emitesunat.com/tu-empresa</code></p>
      </footer>

      {/* WhatsApp flotante */}
      <a href={wa("Hola, quisiera más información.")} target="_blank" rel="noopener noreferrer" aria-label="Escribir por WhatsApp" className="fixed bottom-5 right-5 z-50 grid h-14 w-14 place-items-center rounded-full bg-emerald-500 text-white shadow-2xl shadow-emerald-500/50 transition hover:scale-110">
        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/50" />
        <WaIcon className="relative h-7 w-7" />
      </a>
    </div>
  );
}
