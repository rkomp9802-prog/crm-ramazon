import "server-only";
import { NextResponse } from "next/server";
import { HttpError } from "@/lib/errors";
import { getCurrentUser } from "@/lib/session";
import type { User } from "@/types/crm.types";

export { HttpError };

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

type Handler<C> = (request: Request, context: C) => Promise<Response>;

/** Обёртка для route handler: HttpError → JSON с его статусом, прочее → 500. */
export function route<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof HttpError) return jsonError(error.status, error.message);
      console.error(error);
      return jsonError(500, "Внутренняя ошибка сервера");
    }
  };
}

/**
 * Текущий пользователь или 401. Сотрудник с временным паролем получает 403 везде,
 * кроме смены пароля (allowPendingPasswordChange).
 */
export async function requireApiUser(options: { allowPendingPasswordChange?: boolean } = {}): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Требуется вход");
  if (user.must_change_password && !options.allowPendingPasswordChange) {
    throw new HttpError(403, "Сначала смените временный пароль");
  }
  return user;
}

export function assertAdmin(user: User): void {
  if (user.role !== "admin") throw new HttpError(403, "Недостаточно прав");
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Некорректный JSON");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Ожидается JSON-объект");
  }
  return body as Record<string, unknown>;
}
