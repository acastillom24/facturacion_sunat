"use client";

import { useTransition } from "react";
import { cancelarReintentoAction } from "../../actions";

export function CancelarReintentoButton({ slug, id }: { slug: string; id: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!confirm("¿Cancelar los reintentos automáticos de este comprobante? Ya no se volverá a intentar emitir.")) {
      return;
    }
    startTransition(() => cancelarReintentoAction(slug, id));
  }

  return (
    <button
      disabled={pending}
      onClick={onClick}
      className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 disabled:opacity-60"
    >
      {pending ? "Cancelando..." : "Cancelar reintento"}
    </button>
  );
}
