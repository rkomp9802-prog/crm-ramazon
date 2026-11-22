import { randomUUID } from "node:crypto";
import type { Row } from "@libsql/client";
import { getDb, str } from "@/lib/turso";
import { HttpError } from "@/lib/errors";
import { hashPassword } from "@/lib/auth";
import type { User, UserOption, UserRole } from "@/types/crm.types";

const USER_COLUMNS = "id, name, email, role, is_active, created_at";

export function rowToUser(row: Row): User {
  return {
    id: str(row.id),
    name: str(row.name),
    email: str(row.email),
    role: row.role === "admin" ? "admin" : "manager",
    is_active: Number(row.is_active) === 1,
    created_at: str(row.created_at),
  };
}

export async function getUserById(id: string): Promise<User | null> {
  const rs = await getDb().execute({ sql: `select ${USER_COLUMNS} from users where id = ?`, args: [id] });
  return rs.rows[0] ? rowToUser(rs.rows[0]) : null;
}

export async function getUserWithHashByEmail(email: string): Promise<(User & { password_hash: string }) | null> {
  const rs = await getDb().execute({
    sql: `select ${USER_COLUMNS}, password_hash from users where email = ?`,
    args: [email],
  });
  const row = rs.rows[0];
  return row ? { ...rowToUser(row), password_hash: str(row.password_hash) } : null;
}

export async function listUsers(): Promise<User[]> {
  const rs = await getDb().execute(`select ${USER_COLUMNS} from users order by is_active desc, name`);
  return rs.rows.map(rowToUser);
}

export async function listActiveUserOptions(): Promise<UserOption[]> {
  const rs = await getDb().execute("select id, name from users where is_active = 1 order by name");
  return rs.rows.map((row) => ({ id: str(row.id), name: str(row.name) }));
}

export async function isActiveUser(id: string): Promise<boolean> {
  const rs = await getDb().execute({ sql: "select 1 from users where id = ? and is_active = 1", args: [id] });
  return rs.rows.length > 0;
}

async function emailTaken(email: string, exceptId?: string): Promise<boolean> {
  const rs = await getDb().execute({
    sql: "select 1 from users where email = ? and id != ?",
    args: [email, exceptId ?? ""],
  });
  return rs.rows.length > 0;
}

export interface CreateUserInput {
  name: string;
  email: string;
  role: UserRole;
  password: string;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  if (await emailTaken(input.email)) throw new HttpError(409, "Сотрудник с таким email уже есть");
  const id = randomUUID();
  await getDb().execute({
    sql: "insert into users (id, name, email, password_hash, role, is_active, created_at) values (?, ?, ?, ?, ?, 1, ?)",
    args: [id, input.name, input.email, await hashPassword(input.password), input.role, new Date().toISOString()],
  });
  return (await getUserById(id)) as User;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: UserRole;
  is_active?: boolean;
  password?: string;
}

export async function updateUser(id: string, patch: UpdateUserInput): Promise<User> {
  const sets: string[] = [];
  const args: (string | number)[] = [];
  if (patch.name !== undefined) {
    sets.push("name = ?");
    args.push(patch.name);
  }
  if (patch.email !== undefined) {
    if (await emailTaken(patch.email, id)) throw new HttpError(409, "Сотрудник с таким email уже есть");
    sets.push("email = ?");
    args.push(patch.email);
  }
  if (patch.role !== undefined) {
    sets.push("role = ?");
    args.push(patch.role);
  }
  if (patch.is_active !== undefined) {
    sets.push("is_active = ?");
    args.push(patch.is_active ? 1 : 0);
  }
  if (patch.password !== undefined) {
    sets.push("password_hash = ?");
    args.push(await hashPassword(patch.password));
  }
  if (sets.length) {
    await getDb().execute({ sql: `update users set ${sets.join(", ")} where id = ?`, args: [...args, id] });
  }
  const user = await getUserById(id);
  if (!user) throw new HttpError(404, "Сотрудник не найден");
  return user;
}
