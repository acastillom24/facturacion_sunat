/**
 * Envía a la API propia el logo (companies.logo_url) de cada empresa que la usa.
 * Descarga la imagen (o lee public/ si la ruta empieza con "/"), la convierte a base64
 * y llama a enviarLogoPropia. Imprime el resultado por empresa.
 *
 * Uso: npm run sync-logos
 * Requiere DATABASE_URL, SUNAT_API_URL y la clave de cifrado en .env.local.
 */
import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import path from "node:path";

config({ path: ".env.local" });

const MAX_LOGO_BYTES = 300_000;

async function main() {
  // Import dinámico: los módulos leen variables de entorno, así que dotenv debe cargarse antes.
  const { query } = await import("../src/lib/db/client");
  const { tokenApisperu } = await import("../src/lib/sunat/apiPropia");
  const { enviarLogoPropia } = await import("../src/lib/sunat/apiPropiaEmpresa");

  const empresas = await query<{ slug: string; ruc: string; logo_url: string; apisperu_token: string | null }>(
    "select slug, ruc, logo_url, apisperu_token from companies where sunat_provider = 'propia' and logo_url is not null order by slug",
  );
  let fallos = 0;
  for (const c of empresas ?? []) {
    try {
      let buf: Buffer;
      if (c.logo_url.startsWith("/")) {
        buf = await readFile(path.join(process.cwd(), "public", c.logo_url));
      } else {
        const res = await fetch(c.logo_url, { signal: AbortSignal.timeout(20_000) });
        if (!res.ok) throw new Error(`descarga del logo falló (${res.status})`);
        buf = Buffer.from(await res.arrayBuffer());
      }
      if (buf.length > MAX_LOGO_BYTES) throw new Error(`el logo pesa ${Math.round(buf.length / 1000)} KB (máx. 300 KB)`);
      const r = await enviarLogoPropia(tokenApisperu(c), c.ruc, buf.toString("base64"));
      if (!r.ok) throw new Error(r.mensaje);
      console.log(`OK    ${c.slug} (${c.ruc}): ${r.mensaje}`);
    } catch (e) {
      fallos++;
      console.error(`ERROR ${c.slug} (${c.ruc}): ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`\n${(empresas?.length ?? 0) - fallos}/${empresas?.length ?? 0} empresas sincronizadas.`);
  process.exit(fallos ? 1 : 0);
}

main();
