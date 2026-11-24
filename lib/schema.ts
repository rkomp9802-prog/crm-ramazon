import type { Client } from "@libsql/client";
import { getDb } from "@/lib/turso";

/**
 * Схема из спецификации (раздел 3.2) плюс два служебных поля:
 * - clients.search — имя/телефон/email в нижнем регистре: LIKE в SQLite
 *   не умеет регистронезависимо сравнивать кириллицу;
 * - leads.closed_at — момент перехода в won/lost, нужен для «среднего времени закрытия».
 */
export const SCHEMA: string[] = [
  `create table if not exists users (
    id text primary key,
    name text not null,
    email text not null unique,
    password_hash text not null,
    role text not null default 'manager' check (role in ('admin', 'manager')),
    is_active integer not null default 1,
    must_change_password integer not null default 0,
    session_version integer not null default 0,
    created_at text not null
  )`,
  // Неудачные попытки входа / смены пароля — для ограничения перебора (lib/rate-limit.ts).
  `create table if not exists login_attempts (
    key text primary key,
    failures integer not null,
    window_start text not null,
    blocked_until text
  )`,
  `create table if not exists clients (
    id text primary key,
    name text not null,
    phone text not null,
    email text,
    notes text,
    search text not null default '',
    created_at text not null
  )`,
  `create table if not exists leads (
    id text primary key,
    client_id text not null references clients(id),
    source text not null default 'manual'
      check (source in ('website_form', 'telegram_bot', 'phone', 'referral', 'manual', 'other')),
    status text not null default 'new'
      check (status in ('new', 'in_progress', 'waiting', 'won', 'lost')),
    assigned_to text references users(id),
    value real,
    notes text,
    created_at text not null,
    updated_at text not null,
    closed_at text
  )`,
  `create table if not exists tasks (
    id text primary key,
    lead_id text references leads(id),
    client_id text references clients(id),
    assigned_to text not null references users(id),
    title text not null,
    due_date text,
    status text not null default 'pending' check (status in ('pending', 'done')),
    created_at text not null
  )`,
  `create index if not exists idx_leads_assigned_to on leads(assigned_to)`,
  `create index if not exists idx_leads_client_id on leads(client_id)`,
  `create index if not exists idx_leads_created_at on leads(created_at)`,
  `create index if not exists idx_tasks_assigned_to on tasks(assigned_to)`,
  `create index if not exists idx_tasks_lead_id on tasks(lead_id)`,
  `create index if not exists idx_tasks_client_id on tasks(client_id)`,
];

/** Колонки, добавленные после первой версии: на старых базах добавляются через ALTER TABLE. */
const COLUMN_MIGRATIONS = [
  {
    table: "users",
    column: "must_change_password",
    ddl: "alter table users add column must_change_password integer not null default 0",
  },
  {
    table: "users",
    column: "session_version",
    ddl: "alter table users add column session_version integer not null default 0",
  },
];

/** Идемпотентно: можно запускать сколько угодно раз. */
export async function migrate(db: Client): Promise<void> {
  await db.batch(SCHEMA, "write");
  for (const migration of COLUMN_MIGRATIONS) {
    const info = await db.execute(`pragma table_info(${migration.table})`);
    if (!info.rows.some((row) => row.name === migration.column)) {
      try {
        await db.execute(migration.ddl);
      } catch (error) {
        // Параллельный запуск (второй экземпляр приложения) мог уже добавить колонку.
        if (!/duplicate column/i.test(error instanceof Error ? error.message : String(error))) throw error;
      }
    }
  }
}

let schemaReady: Promise<void> | null = null;

/**
 * Схема применяется один раз за жизнь процесса, при первом обращении к БД.
 * Так приложение не упадёт с 500, если после обновления кода забыли `npm run db:migrate`.
 */
export function ensureSchema(): Promise<void> {
  schemaReady ??= migrate(getDb()).catch((error: unknown) => {
    schemaReady = null; // следующий запрос попробует снова
    throw error;
  });
  return schemaReady;
}
