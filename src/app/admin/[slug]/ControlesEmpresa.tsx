"use client";

import { useActionState } from "react";
import { Boton, Card, Field, Mensaje, inputClass } from "@/components/admin/ui";
import { resetPasswordAction, toggleActivaAction } from "../actions";

export function ControlesEmpresa({ slug, activa }: { slug: string; activa: boolean }) {
  const [state, formAction, pending] = useActionState(
    async (_p: { ok?: boolean; error?: string }, fd: FormData) => resetPasswordAction(slug, fd),
    {},
  );
  return (
    <div className="space-y-6">
      <form action={formAction}>
        <Card
          titulo="Contraseña de la empresa"
          descripcion="Restablece el acceso al panel de la empresa."
          acciones={
            <Boton pendiente={pending} variante="secundario">
              Cambiar contraseña
            </Boton>
          }
        >
          <Field label="Nueva contraseña" ayuda="Mínimo 8 caracteres.">
            <input name="password" type="password" autoComplete="new-password" className={inputClass(!!state?.error)} />
          </Field>
          {state?.error && <Mensaje tono="error">{state.error}</Mensaje>}
          {state?.ok && <Mensaje tono="ok">Contraseña actualizada.</Mensaje>}
        </Card>
      </form>

      <form action={() => toggleActivaAction(slug, !activa)}>
        <Card
          peligro={activa}
          titulo={activa ? "Suspender empresa" : "Reactivar empresa"}
          descripcion={activa ? "La empresa no podrá iniciar sesión ni emitir comprobantes mientras esté suspendida." : "La empresa vuelve a tener acceso."}
          acciones={
            <Boton variante={activa ? "peligro" : "primario"}>{activa ? "Suspender empresa" : "Reactivar empresa"}</Boton>
          }
        >
          <p className="text-sm text-neutral-600">
            Estado actual: <b className={activa ? "text-emerald-700" : "text-red-600"}>{activa ? "activa" : "suspendida"}</b>
          </p>
        </Card>
      </form>
    </div>
  );
}
