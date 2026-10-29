import { queryOne } from "@/lib/db/client";
import type { EmpresaSunat } from "@/lib/sunat/types";

export interface Company {
  id: string;
  slug: string;
  password_hash: string;
  ruc: string;
  razon_social: string;
  nombre_comercial: string | null;
  ubigueo: string;
  departamento: string;
  provincia: string;
  distrito: string;
  direccion: string;
  cod_local: string;
  apisperu_token: string | null;
  sunat_provider: "apisperu" | "propia";
  igv_rate: number;
  logo_url: string | null;
  activa: boolean;
  created_at: string;
}

export async function getCompanyBySlug(slug: string): Promise<Company | null> {
  return queryOne<Company>("select * from companies where slug = $1", [slug]);
}

export async function getCompanyById(id: string): Promise<Company | null> {
  return queryOne<Company>("select * from companies where id = $1", [id]);
}

export function companyToEmpresaSunat(company: Company): EmpresaSunat {
  return {
    ruc: company.ruc,
    razonSocial: company.razon_social,
    nombreComercial: company.nombre_comercial ?? company.razon_social,
    address: {
      ubigueo: company.ubigueo,
      departamento: company.departamento,
      provincia: company.provincia,
      distrito: company.distrito,
      direccion: company.direccion,
      codLocal: company.cod_local,
    },
  };
}
