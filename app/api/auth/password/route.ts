import { NextResponse } from "next/server";
import { HttpError, readJson, requireApiUser, route } from "@/lib/http";
import { MIN_PASSWORD_LENGTH, SESSION_COOKIE, sessionCookieOptions, signSession, verifyPassword } from "@/lib/auth";
import { readNewPassword } from "@/lib/validation";
import { changeOwnPassword, getPasswordHash } from "@/lib/users";
import { getBlockedUntil, registerAttempt, resetAttempts, tooManyAttemptsMessage } from "@/lib/rate-limit";

/** Сколько раз можно ошибиться с текущим паролем за 15 минут (защита на случай украденной сессии). */
const MAX_WRONG_CURRENT_PASSWORD = 5;

/**
 * Смена своего пароля. Доступна и с временным паролем (must_change_password).
 * Все остальные сеансы пользователя завершаются, текущий получает новую cookie.
 */
export const POST = route(async (request) => {
  const user = await requireApiUser({ allowPendingPasswordChange: true });
  const body = await readJson(request);
  const currentPassword = typeof body.current_password === "string" ? body.current_password : "";
  const newPassword = readNewPassword(body.new_password, MIN_PASSWORD_LENGTH);

  // Попытка засчитывается до проверки пароля — параллельные запросы не обойдут лимит.
  const limit = { key: `password:${user.id}`, max: MAX_WRONG_CURRENT_PASSWORD };
  const blockedUntil = (await getBlockedUntil([limit.key])) ?? (await registerAttempt([limit]));
  if (blockedUntil) throw new HttpError(429, tooManyAttemptsMessage(blockedUntil));

  const hash = await getPasswordHash(user.id);
  if (!hash || !currentPassword || !(await verifyPassword(currentPassword, hash))) {
    throw new HttpError(400, "Текущий пароль указан неверно");
  }
  await resetAttempts([limit.key]);
  if (newPassword === currentPassword) {
    throw new HttpError(400, "Новый пароль должен отличаться от текущего");
  }

  const sessionVersion = await changeOwnPassword(user.id, newPassword);

  const token = await signSession({ userId: user.id, role: user.role, sessionVersion });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
});
