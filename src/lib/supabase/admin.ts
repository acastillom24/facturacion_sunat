import { createClient } from "@supabase/supabase-js";
import NodeWebSocket from "ws";

// supabase-js instancia un cliente de Realtime aunque no lo usemos, y ese
// cliente exige `WebSocket` global. Node 22+ lo trae nativo; en Node 20 (aún
// común localmente) hay que poner un polyfill antes de crear el cliente.
if (typeof globalThis.WebSocket === "undefined") {
  // @ts-expect-error -- polyfill de Node 20, tipos no coinciden 1:1 con el WebSocket del DOM
  globalThis.WebSocket = NodeWebSocket;
}

/**
 * Cliente Supabase con la service_role key. Solo se usa en el servidor
 * (Server Actions, Route Handlers, cron). Nunca importar desde un componente
 * cliente: la key tiene acceso total y se salta RLS.
 */
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno");
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
