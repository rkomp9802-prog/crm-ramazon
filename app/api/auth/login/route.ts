import { NextResponse } from "next/server";
import { jsonError, readJson, route } from "@/lib/http";
import { getDummyHash, SESSION_COOKIE, sessionCookieOptions, signSession, verifyPassword } from "@/lib/auth";
import { getUserWithHashByEmail } from "@/lib/users";
import { ensureSchema } from "@/lib/schema";
import {
  clientIp,
  forgiveAttempt,
  getBlockedUntil,
  registerAttempt,
  retryAfterSeconds,
  tooManyAttemptsMessage,
  type LimitRule,
} from "@/lib/rate-limit";

// Одно сообщение на все случаи: нет пользователя, неверный пароль, аккаунт выключен.
const INVALID_CREDENTIALS = "Неверный email или пароль";

/**
 * Лимиты неудачных попыток за 15 минут, после них — блокировка на 15 минут (ответ 429):
 * - IP + email: обычный перебор пароля одного сотрудника с одного компьютера;
 * - IP: перебор разных email с одного адреса;
 * - email: распределённая атака на один аккаунт с разных адресов. Порог выше,
 *   чтобы посторонний не мог легко заблокировать вход сотруднику.
 * Ошибки считаются и для несуществующих email — по блокировке нельзя понять, есть ли аккаунт.
 */
const LIMIT_PER_IP_AND_EMAIL = 5;
const LIMIT_PER_IP = 25;
const LIMIT_PER_EMAIL = 30;

export const POST = route(async (request) => {
  const body = await readJson(request);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
  const password = typeof body.password === "string" ? body.password : "";
  const ip = clientIp(request);
  await ensureSchema();

  // Без IP (свой хостинг без прокси) лимиты по IP не применяем: иначе все сотрудники
  // делили бы один счётчик, и чужие ошибки блокировали бы вход всем.
  const pairKey = ip && email ? `login:pair:${ip}|${email}` : null;
  const rules: LimitRule[] = [];
  if (ip) rules.push({ key: `login:ip:${ip}`, max: LIMIT_PER_IP });
  if (pairKey) rules.push({ key: pairKey, max: LIMIT_PER_IP_AND_EMAIL });
  if (email) rules.push({ key: `login:email:${email}`, max: LIMIT_PER_EMAIL });

  // Попытка засчитывается до проверки пароля — пачка параллельных запросов не обойдёт лимит.
  const blockedUntil =
    (await getBlockedUntil(rules.map((rule) => rule.key))) ?? (await registerAttempt(rules));
  if (blockedUntil) {
    return NextResponse.json(
      { error: tooManyAttemptsMessage(blockedUntil) },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds(blockedUntil)) } },
    );
  }

  const reject = () => jsonError(401, INVALID_CREDENTIALS);

  if (!email || !password || password.length > 200) {
    await verifyPassword("invalid", await getDummyHash());
    return reject();
  }

  const user = await getUserWithHashByEmail(email);
  if (!user || !user.is_active) {
    // Тратим столько же времени, сколько на настоящую проверку, — не выдаём, что email существует.
    await verifyPassword(password, await getDummyHash());
    return reject();
  }

  if (!(await verifyPassword(password, user.password_hash))) {
    return reject();
  }

  // Успешный вход — не ошибка: снимаем попытку со счётчиков, счётчик пары обнуляем.
  await forgiveAttempt(rules, pairKey ? [pairKey] : []);
  const token = await signSession({ userId: user.id, role: user.role, sessionVersion: user.session_version });
  const response = NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name, role: user.role, must_change_password: user.must_change_password },
  });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
});
