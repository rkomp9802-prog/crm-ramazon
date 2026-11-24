import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

// Next.js 16: бывший middleware.ts теперь называется proxy.ts.
// Здесь только быстрая проверка подписи JWT. Полная проверка (пользователь
// существует, активен, актуальная роль из БД) — в lib/session.ts и в каждом API route.

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login", "/api/auth/logout", "/api/telegram/webhook"]);
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isAdminPath(pathname: string): boolean {
  return (
    pathname === "/users" ||
    pathname.startsWith("/users/") ||
    pathname === "/api/users" ||
    pathname.startsWith("/api/users/")
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  // Защита от CSRF: изменяющие запросы к API принимаем только со своего origin.
  if (isApi && !SAFE_METHODS.has(request.method)) {
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin) {
      return NextResponse.json({ error: "Запрос с чужого сайта отклонён" }, { status: 403 });
    }
  }

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session) {
    if (isApi) return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminPath(pathname) && session.role !== "admin") {
    if (isApi) return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
