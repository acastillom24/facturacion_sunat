/**
 * Crea (o actualiza la contraseña de) una empresa.
 *
 * Uso:
 *   npm run create-company -- --slug=acme --password=secreta \
 *     --ruc=20613818171 --razonSocial="ACME SAC" --token=EL_TOKEN_PERMANENTE_DE_APISPERU \
 *     [--nombreComercial="Acme"] [--direccion="Av. Siempre Viva 123"] \
 *     [--ubigueo=150101] [--departamento=LIMA] [--provincia=LIMA] [--distrito=LIMA] [--igvRate=0.18] \
 *     [--logoUrl="https://.../logo.png"]
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

  // Si la empresa ya existe, los campos opcionales no indicados en esta
  // corrida conservan su valor anterior (en vez de resetearse), para poder
  // re-ejecutar el script solo para cambiar la contraseña sin borrar el resto.
  const { data: existente } = await db.from("companies").select("*").eq("slug", args.slug).maybeSingle();

  const row = {
    slug: args.slug,
    password_hash: passwordHash,
    ruc: args.ruc,
    razon_social: args.razonSocial,
    nombre_comercial: args.nombreComercial ?? existente?.nombre_comercial ?? args.razonSocial,
    ubigueo: args.ubigueo ?? existente?.ubigueo ?? "150101",
    departamento: args.departamento ?? existente?.departamento ?? "LIMA",
    provincia: args.provincia ?? existente?.provincia ?? "LIMA",
    distrito: args.distrito ?? existente?.distrito ?? "LIMA",
    direccion: args.direccion ?? existente?.direccion ?? "",
    cod_local: args.codLocal ?? existente?.cod_local ?? "0000",
    apisperu_token: args.token,
    igv_rate: args.igvRate ? Number(args.igvRate) : existente?.igv_rate ?? 0.18,
    logo_url: args.logoUrl ?? existente?.logo_url ?? null,
  };

  const { error } = await db.from("companies").upsert(row, { onConflict: "slug" });
  if (error) {
    console.error("Error creando/actualizando la empresa:", error.message);
    process.exit(1);
  }

  console.log(`Empresa "${args.slug}" lista. URL de acceso: /${args.slug}/login`);
}

main();
