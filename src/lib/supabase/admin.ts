import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import NodeWebSocket from "ws";

// supabase-js instancia un cliente de Realtime aunque no lo usemos, y ese
// cliente exige `WebSocket` global. Node 22+ lo trae nativo; en Node 20 (aún
// común localmente) hay que poner un polyfill antes de crear el cliente.
if (typeof globalThis.WebSocket === "undefined") {
  // @ts-expect-error -- polyfill de Node 20, tipos no coinciden 1:1 con el WebSocket del DOM
  globalThis.WebSocket = NodeWebSocket;
}

let clienteCacheado: SupabaseClient | null = null;

/**
 * Cliente Supabase con la service_role key. Solo se usa en el servidor
 * (Server Actions, Route Handlers, cron). Nunca importar desde un componente
 * cliente: la key tiene acceso total y se salta RLS.
 *
 * Se cachea a nivel de módulo: en una instancia "caliente" de la función
 * serverless, varias llamadas dentro del mismo o de distintos requests
 * reutilizan el mismo cliente en vez de reconstruirlo cada vez.
 */
export function supabaseAdmin(): SupabaseClient {
  if (clienteCacheado) return clienteCacheado;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno");
  }
  clienteCacheado = createClient(url, key, {
    auth: { persistSession: false },
  });
  return clienteCacheado;
}
