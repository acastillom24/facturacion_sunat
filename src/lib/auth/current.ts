import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCompanyById, type Company } from "@/lib/db/companies";
import { sessionCookieName, verificarTokenSesion } from "./session";

/** Para usar en páginas protegidas de /[empresa]/*. Redirige a login si la sesión no es válida. */
export async function requireCompany(slug: string): Promise<Company> {
  const jar = await cookies();
  const cookie = jar.get(sessionCookieName(slug));
  const sesion = cookie ? await verificarTokenSesion(cookie.value) : null;
  if (!sesion || sesion.slug !== slug) {
    redirect(`/${slug}/login`);
  }
  const company = await getCompanyById(sesion.companyId);
  if (!company) {
    redirect(`/${slug}/login`);
  }
  return company;
}

/** Variante para Route Handlers: no redirige, devuelve null si no hay sesión válida. */
export async function getCompanyFromSession(slug: string): Promise<Company | null> {
  const jar = await cookies();
  const cookie = jar.get(sessionCookieName(slug));
  const sesion = cookie ? await verificarTokenSesion(cookie.value) : null;
  if (!sesion || sesion.slug !== slug) return null;
  return getCompanyById(sesion.companyId);
}
