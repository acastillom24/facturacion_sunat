/**
 * Fija el ÚLTIMO correlativo ya usado de una serie (el siguiente comprobante será +1).
 * Sirve para continuar la numeración de un sistema anterior.
 *
 * Uso:
 *   npm run set-correlativo -- --slug=lechic --tipo=03 --serie=B001 --ultimo=5838
 *   npm run set-correlativo -- --slug=lechic --tipo=01 --serie=F001 --ultimo=57
 *
 * Requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno (.env.local).
 */
import { config } from "dotenv";
import { supabaseAdmin } from "../src/lib/supabase/admin";

config({ path: ".env.local" });

function parseArgs(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const ultimo = Number(args.ultimo);
  if (!args.slug || !["01", "03"].includes(args.tipo) || !/^[A-Z]\d{3}$/.test(args.serie ?? "") || !Number.isInteger(ultimo) || ultimo < 0) {
    console.error("Uso: --slug=<empresa> --tipo=01|03 --serie=B001 --ultimo=<último número ya usado>");
    process.exit(1);
  }

  const db = supabaseAdmin();
  const { data: company } = await db.from("companies").select("id").eq("slug", args.slug).maybeSingle();
  if (!company) {
    console.error(`Empresa "${args.slug}" no encontrada`);
    process.exit(1);
  }

  const { error } = await db
    .from("correlativos")
    .upsert(
      { company_id: company.id, tipo_doc: args.tipo, serie: args.serie, ultimo_correlativo: ultimo },
      { onConflict: "company_id,tipo_doc,serie" },
    );
  if (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
  console.log(`${args.serie}: el siguiente comprobante será ${args.serie}-${ultimo + 1}`);
}

main();
