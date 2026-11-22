import { NextResponse } from "next/server";
import { jsonError, readJson, route } from "@/lib/http";
import { getDummyHash, SESSION_COOKIE, sessionCookieOptions, signSession, verifyPassword } from "@/lib/auth";
import { getUserWithHashByEmail } from "@/lib/users";

// Одно сообщение на все случаи: нет пользователя, неверный пароль, аккаунт деактивирован.
const INVALID_CREDENTIALS = "Неверный email или пароль";

export const POST = route(async (request) => {
  const body = await readJson(request);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password || password.length > 200) {
    await verifyPassword("invalid", await getDummyHash());
    return jsonError(401, INVALID_CREDENTIALS);
  }

  const user = await getUserWithHashByEmail(email);
  if (!user || !user.is_active) {
    // Тратим столько же времени, сколько на настоящую проверку, — не выдаём, что email существует.
    await verifyPassword(password, await getDummyHash());
    return jsonError(401, INVALID_CREDENTIALS);
  }

  if (!(await verifyPassword(password, user.password_hash))) {
    return jsonError(401, INVALID_CREDENTIALS);
  }

  const token = await signSession({ userId: user.id, role: user.role });
  const response = NextResponse.json({ ok: true, user: { id: user.id, name: user.name, role: user.role } });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
});
