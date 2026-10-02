import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName, verificarTokenSesion } from "@/lib/auth/session";

const PUBLIC_SUBPATHS = new Set(["login"]);
const RESERVED_SLUGS = new Set(["api", "_next", "favicon.ico", "logos"]);

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return NextResponse.next();

  const [slug, sub] = segments;
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
