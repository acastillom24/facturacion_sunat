import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName } from "@/lib/auth/session";

export async function POST(req: NextRequest, { params }: { params: Promise<{ empresa: string }> }) {
  const { empresa } = await params;
  const res = NextResponse.redirect(new URL(`/${empresa}/login`, req.url));
  res.cookies.delete(sessionCookieName(empresa));
  return res;
}
