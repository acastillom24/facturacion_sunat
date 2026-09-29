/**
 * Crea (o actualiza la contraseña de) una empresa.
 *
 * Uso:
 *   npm run create-company -- --slug=acme --password=secreta \
 *     --ruc=20613818171 --razonSocial="ACME SAC" --token=EL_TOKEN_PERMANENTE_DE_APISPERU \
 *     [--nombreComercial="Acme"] [--direccion="Av. Siempre Viva 123"] \
 *     [--ubigueo=150101] [--departamento=LIMA] [--provincia=LIMA] [--distrito=LIMA] [--igvRate=0.18]
 *
 * Requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno (.env.local).
 */
import { config } from "dotenv";
import bcrypt from "bcryptjs";
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
  const required = ["slug", "password", "ruc", "razonSocial", "token"];
  const faltantes = required.filter((k) => !args[k]);
  if (faltantes.length) {
    console.error(`Faltan argumentos: ${faltantes.join(", ")}`);
    process.exit(1);
  }

  const db = supabaseAdmin();
  const passwordHash = await bcrypt.hash(args.password, 12);

  const row = {
    slug: args.slug,
    password_hash: passwordHash,
    ruc: args.ruc,
    razon_social: args.razonSocial,
    nombre_comercial: args.nombreComercial ?? args.razonSocial,
    ubigueo: args.ubigueo ?? "150101",
    departamento: args.departamento ?? "LIMA",
    provincia: args.provincia ?? "LIMA",
    distrito: args.distrito ?? "LIMA",
    direccion: args.direccion ?? "",
    cod_local: args.codLocal ?? "0000",
    apisperu_token: args.token,
    igv_rate: args.igvRate ? Number(args.igvRate) : 0.18,
  };

  const { error } = await db.from("companies").upsert(row, { onConflict: "slug" });
  if (error) {
    console.error("Error creando/actualizando la empresa:", error.message);
    process.exit(1);
  }

  console.log(`Empresa "${args.slug}" lista. URL de acceso: /${args.slug}/login`);
}

main();
