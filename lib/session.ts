import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { getSessionUser } from "@/lib/users";
import { ensureSchema } from "@/lib/schema";
import type { User } from "@/types/crm.types";

/**
 * Текущий пользователь из cookie. Роль, активность и версия сессий берутся из БД, а не из JWT:
 * выключенный сотрудник теряет доступ сразу, а после смены или сброса пароля
 * старые cookie перестают работать.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  await ensureSchema();
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const record = await getSessionUser(session.userId);
  if (!record || !record.user.is_active || record.sessionVersion !== session.sessionVersion) return null;
  return record.user;
});

/** Для страниц CRM: без входа — на /login, с временным паролем — на /password. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.must_change_password) redirect("/password");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}
