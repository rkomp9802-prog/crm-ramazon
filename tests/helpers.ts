import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/turso";
import { hashPassword, SESSION_COOKIE, signSession } from "@/lib/auth";
import { buildClientSearch } from "@/lib/clients";
import type { LeadSource, LeadStatus, UserRole } from "@/types/crm.types";

/** Пароль всех тестовых сотрудников. */
export const PASSWORD = "correct-horse-battery";

export interface TestUser {
  id: string;
  email: string;
  role: UserRole;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteHandler = (request: Request, context: any) => Promise<Response>;

function cookieJar(): Map<string, string> {
  return (globalThis as unknown as { __testCookies: Map<string, string> }).__testCookies;
}

/** Cookie сессии, с которой пойдут следующие вызовы API (null — без сессии). */
export function setSession(token: string | null): void {
  if (token === null) cookieJar().delete(SESSION_COOKIE);
  else cookieJar().set(SESSION_COOKIE, token);
}

/** Значение cookie сессии из заголовка Set-Cookie ответа. */
export function sessionTokenFrom(response: Response): string | null {
  const match = (response.headers.get("set-cookie") ?? "").match(/(?:^|,\s*)session=([^;]*)/);
  return match?.[1] ? match[1] : null;
}

interface CallOptions {
  method?: string;
  body?: unknown;
  params?: Record<string, string>;
  /** Строка запроса, например "?scope=all". */
  query?: string;
  headers?: Record<string, string>;
}

/** Вызвать обработчик API так же, как его вызывает Next.js. */
export async function call(
  handler: RouteHandler,
  { method = "GET", body, params = {}, query = "", headers = {} }: CallOptions = {},
) {
  const request = new Request(`http://localhost/api${query}`, {
    method,
    headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const response = await handler(request, { params: Promise.resolve(params) });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await response.json().catch(() => null);
  return { status: response.status, data, response };
}

let passwordHash: Promise<string> | undefined;
let counter = 0;

export async function seedUser(
  role: UserRole,
  options: { active?: boolean; mustChangePassword?: boolean } = {},
): Promise<TestUser> {
  passwordHash ??= hashPassword(PASSWORD);
  counter += 1;
  const id = randomUUID();
  const email = `${role}-${counter}-${id.slice(0, 8)}@crm.test`;
  await getDb().execute({
    sql: `insert into users (id, name, email, password_hash, role, is_active, must_change_password, session_version, created_at)
          values (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    args: [
      id,
      `${role === "admin" ? "Админ" : "Менеджер"} ${counter}`,
      email,
      await passwordHash,
      role,
      options.active === false ? 0 : 1,
      options.mustChangePassword ? 1 : 0,
      new Date().toISOString(),
    ],
  });
  return { id, email, role };
}

/** Войти без пароля: подписать токен с текущей версией сессий и положить его в cookie. */
export async function loginAs(user: TestUser): Promise<string> {
  const rs = await getDb().execute({ sql: "select session_version from users where id = ?", args: [user.id] });
  const token = await signSession({
    userId: user.id,
    role: user.role,
    sessionVersion: Number(rs.rows[0]?.session_version ?? 0),
  });
  setSession(token);
  return token;
}

export async function seedClient(name: string, phone = "+998 90 123-45-67"): Promise<string> {
  const id = randomUUID();
  await getDb().execute({
    sql: "insert into clients (id, name, phone, email, notes, search, created_at) values (?, ?, ?, null, null, ?, ?)",
    args: [id, name, phone, buildClientSearch({ name, phone, email: null }), new Date().toISOString()],
  });
  return id;
}

export async function seedLead(
  clientId: string,
  assignedTo: string | null,
  options: { status?: LeadStatus; source?: LeadSource; createdAt?: string; closedAt?: string | null } = {},
): Promise<string> {
  const id = randomUUID();
  const createdAt = options.createdAt ?? new Date().toISOString();
  await getDb().execute({
    sql: `insert into leads (id, client_id, source, status, assigned_to, value, notes, created_at, updated_at, closed_at)
          values (?, ?, ?, ?, ?, null, null, ?, ?, ?)`,
    args: [
      id,
      clientId,
      options.source ?? "manual",
      options.status ?? "new",
      assignedTo,
      createdAt,
      createdAt,
      options.closedAt ?? null,
    ],
  });
  return id;
}

export async function seedTask(assignedTo: string, leadId: string | null, clientId: string | null): Promise<string> {
  const id = randomUUID();
  await getDb().execute({
    sql: `insert into tasks (id, lead_id, client_id, assigned_to, title, due_date, status, created_at)
          values (?, ?, ?, ?, 'Перезвонить клиенту', null, 'pending', ?)`,
    args: [id, leadId, clientId, assignedTo, new Date().toISOString()],
  });
  return id;
}
