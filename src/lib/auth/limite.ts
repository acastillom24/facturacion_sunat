import { query, queryOne } from "@/lib/db/client";

const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 10;

/** True si la clave ('admin', 'empresa:<slug>') está bloqueada por demasiados intentos fallidos. */
export async function estaBloqueado(clave: string): Promise<boolean> {
  const fila = await queryOne<{ bloqueado: boolean }>(
    "select coalesce(bloqueado_hasta > now(), false) as bloqueado from login_intentos where clave = $1",
    [clave],
  );
  return fila?.bloqueado ?? false;
}

/** Suma un intento fallido; al llegar al máximo bloquea la clave y reinicia el contador. */
export async function registrarFallo(clave: string): Promise<void> {
  await query(
    `insert into login_intentos (clave, intentos) values ($1, 1)
     on conflict (clave) do update set
       intentos = case when login_intentos.intentos + 1 >= $2 then 0 else login_intentos.intentos + 1 end,
       bloqueado_hasta = case when login_intentos.intentos + 1 >= $2 then now() + make_interval(mins => $3) else login_intentos.bloqueado_hasta end`,
    [clave, MAX_INTENTOS, BLOQUEO_MINUTOS],
  );
}

export async function limpiarFallos(clave: string): Promise<void> {
  await query("delete from login_intentos where clave = $1", [clave]);
}
