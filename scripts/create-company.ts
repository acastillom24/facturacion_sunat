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
 * Requiere DATABASE_URL en el entorno (.env.local).
 */
import { config } from "dotenv";
import bcrypt from "bcryptjs";
import { cifrar } from "../src/lib/crypto/secretos";
import { query, queryOne } from "../src/lib/db/client";

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
  const required = ["slug", "password", "ruc", "razonSocial"];
  const faltantes = required.filter((k) => !args[k]);
  if (faltantes.length) {
    console.error(`Faltan argumentos: ${faltantes.join(", ")}`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(args.password, 12);

  // Si la empresa ya existe, los campos opcionales no indicados en esta
  // corrida conservan su valor anterior (en vez de resetearse), para poder
  // re-ejecutar el script solo para cambiar la contraseña sin borrar el resto.
  const existente = await queryOne<Record<string, any>>("select * from companies where slug = $1", [args.slug]);

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
    apisperu_token: (args.token ? cifrar(args.token) : null) ?? existente?.apisperu_token ?? null,
    igv_rate: args.igvRate ? Number(args.igvRate) : existente?.igv_rate ?? 0.18,
    logo_url: args.logoUrl ?? existente?.logo_url ?? null,
  };

  try {
    await query(
      `insert into companies
         (slug, password_hash, ruc, razon_social, nombre_comercial, ubigueo, departamento, provincia, distrito,
          direccion, cod_local, apisperu_token, igv_rate, logo_url)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       on conflict (slug) do update set
         password_hash = excluded.password_hash, ruc = excluded.ruc, razon_social = excluded.razon_social,
         nombre_comercial = excluded.nombre_comercial, ubigueo = excluded.ubigueo, departamento = excluded.departamento,
         provincia = excluded.provincia, distrito = excluded.distrito, direccion = excluded.direccion,
         cod_local = excluded.cod_local, apisperu_token = excluded.apisperu_token, igv_rate = excluded.igv_rate,
         logo_url = excluded.logo_url`,
      [row.slug, row.password_hash, row.ruc, row.razon_social, row.nombre_comercial, row.ubigueo, row.departamento,
        row.provincia, row.distrito, row.direccion, row.cod_local, row.apisperu_token, row.igv_rate, row.logo_url],
    );
  } catch (e) {
    console.error("Error creando/actualizando la empresa:", e instanceof Error ? e.message : e);
    process.exit(1);
  }

  console.log(`Empresa "${args.slug}" lista. URL de acceso: /${args.slug}/login`);
}

main();
