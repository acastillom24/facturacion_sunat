import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verificarTokenAdmin } from "@/lib/auth/admin";
import { sessionCookieName, verificarTokenSesion } from "@/lib/auth/session";

const PUBLIC_SUBPATHS = new Set(["login"]);
const RESERVED_SLUGS = new Set(["api", "_next", "favicon.ico", "logos"]);

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return NextResponse.next();

  const [slug, sub] = segments;
  if (slug === "admin") {
    // Subdominio dedicado: si ADMIN_HOST está definido, /admin solo responde en ese host.
    const adminHost = process.env.ADMIN_HOST;
    if (adminHost && req.headers.get("host") !== adminHost) return new NextResponse("Not found", { status: 404 });
    // Lista de IPs permitidas (separadas por coma); vacía = sin restricción.
    const permitidas = (process.env.ADMIN_ALLOWED_IPS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
    if (permitidas.length && !permitidas.includes(ip)) return new NextResponse("Not found", { status: 404 });
    if (sub === "login") return NextResponse.next();
    const c = req.cookies.get(ADMIN_COOKIE);
    if (c && (await verificarTokenAdmin(c.value))) return NextResponse.next();
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  if (RESERVED_SLUGS.has(slug)) return NextResponse.next();
  if (sub && PUBLIC_SUBPATHS.has(sub)) return NextResponse.next();

  const cookie = req.cookies.get(sessionCookieName(slug));
  const sesion = cookie ? await verificarTokenSesion(cookie.value) : null;

  if (!sesion || sesion.slug !== slug) {
    const loginUrl = new URL(`/${slug}/login`, req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
