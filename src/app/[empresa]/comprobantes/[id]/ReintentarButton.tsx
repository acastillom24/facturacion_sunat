"use client";

import { useTransition } from "react";
import { reintentarAction } from "../../actions";

export function ReintentarButton({ slug, id }: { slug: string; id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => startTransition(() => reintentarAction(slug, id))}
      className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 hover:bg-amber-100 disabled:opacity-60"
    >
      {pending ? "Reintentando..." : "Reintentar ahora"}
    </button>
  );
}
