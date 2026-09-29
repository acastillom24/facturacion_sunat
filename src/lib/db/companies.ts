import { supabaseAdmin } from "@/lib/supabase/admin";
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
  apisperu_token: string;
  igv_rate: number;
  created_at: string;
}

export async function getCompanyBySlug(slug: string): Promise<Company | null> {
  const { data, error } = await supabaseAdmin()
    .from("companies")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data as Company | null;
}

export async function getCompanyById(id: string): Promise<Company | null> {
  const { data, error } = await supabaseAdmin()
    .from("companies")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Company | null;
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
