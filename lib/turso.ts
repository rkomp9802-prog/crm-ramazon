import { createClient, type Client } from "@libsql/client";

const globalForDb = globalThis as unknown as { __crmDb?: Client };

function createDb(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url && process.env.NODE_ENV === "production") {
    throw new Error("TURSO_DATABASE_URL не задан");
  }
  return createClient({
    url: url || "file:local.db",
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });
}

/** Один клиент базы на процесс (в dev переживает hot reload). */
export function getDb(): Client {
  if (!globalForDb.__crmDb) globalForDb.__crmDb = createDb();
  return globalForDb.__crmDb;
}

export function str(value: unknown): string {
  return value == null ? "" : String(value);
}

export function strOrNull(value: unknown): string | null {
  return value == null ? null : String(value);
}

export function numOrNull(value: unknown): number | null {
  return value == null ? null : Number(value);
}

/** Экранирует % и _ для LIKE ... ESCAPE '\'. */
export function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}
