import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

export const POST = route(async () => {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
});
