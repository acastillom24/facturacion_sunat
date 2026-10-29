import { neon, types, type NeonQueryFunction } from "@neondatabase/serverless";

// Mantiene las formas que devolvía PostgREST: fechas como string ISO y numeric/bigint como number.
const parsers: Record<number, (valor: string) => unknown> = {
  1082: (v) => v, // date -> "YYYY-MM-DD"
  1184: (v) => new Date(v).toISOString(), // timestamptz
  1700: (v) => Number(v), // numeric
  20: (v) => Number(v), // int8 (count(*))
};

let clienteCacheado: NeonQueryFunction<false, false> | null = null;

function cliente(): NeonQueryFunction<false, false> {
  if (clienteCacheado) return clienteCacheado;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL en el entorno");
  clienteCacheado = neon(url);
  return clienteCacheado;
}

const opciones = {
  types: {
    getTypeParser: (oid: number, formato?: unknown) => parsers[oid] ?? types.getTypeParser(oid, formato as "text"),
  },
};

/**
 * Ejecuta SQL parametrizado ($1, $2...) contra Neon y devuelve las filas.
 * Solo para el servidor. Los valores jsonb deben pasarse con `json()` y el
 * placeholder con cast: `$3::jsonb`.
 */
export async function query<T = Record<string, unknown>>(texto: string, params: unknown[] = []): Promise<T[]> {
  return (await cliente().query(texto, params, opciones)) as unknown as T[];
}

/** Primera fila o null (equivale al `.maybeSingle()` de PostgREST). */
export async function queryOne<T = Record<string, unknown>>(texto: string, params: unknown[] = []): Promise<T | null> {
  return (await query<T>(texto, params))[0] ?? null;
}

/** Serializa un valor para un parámetro `$n::jsonb`. */
export function json(valor: unknown): string | null {
  return valor === undefined || valor === null ? null : JSON.stringify(valor);
}
