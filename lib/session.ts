import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { getUserById } from "@/lib/users";
import type { User } from "@/types/crm.types";

/**
 * Текущий пользователь из cookie. Роль и активность берутся из БД, а не из JWT:
 * деактивированный сотрудник теряет доступ сразу, а не через 7 дней.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await getUserById(session.userId);
  if (!user || !user.is_active) return null;
  return user;
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}
