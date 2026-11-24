import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, vi } from "vitest";

// Обработчики API вызываются напрямую, без сервера Next.js. Внутри запроса Next cookies()
// читает cookie запроса — здесь подменяем его хранилищем, которым управляет тест (helpers.setSession).
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const jar = (globalThis as { __testCookies?: Map<string, string> }).__testCookies;
      const value = jar?.get(name);
      return value === undefined ? undefined : { name, value };
    },
  }),
}));

// У каждого файла тестов — своя временная база SQLite.
mkdirSync(".test-dbs", { recursive: true });
const dbFile = `.test-dbs/crm-${randomUUID()}.db`;
process.env.TURSO_DATABASE_URL = `file:${dbFile}`;
process.env.TURSO_AUTH_TOKEN = "";
process.env.JWT_SECRET = "test-only-jwt-secret-0123456789-abcdefghijklmnop";
process.env.APP_TIMEZONE = "UTC";

const globals = globalThis as { __testCookies?: Map<string, string>; __crmDb?: { close(): void } };
globals.__testCookies = new Map();
globals.__crmDb = undefined;

beforeAll(async () => {
  const { getDb } = await import("@/lib/turso");
  const { migrate } = await import("@/lib/schema");
  await migrate(getDb());
});

// Файл базы удаляет tests/global-setup.ts после всего прогона: пока воркер жив, Windows его не отпускает.
afterAll(() => {
  globals.__crmDb?.close();
  globals.__crmDb = undefined;
});
