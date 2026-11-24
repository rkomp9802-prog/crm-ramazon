import { randomUUID } from "node:crypto";
import { createClient } from "@libsql/client";
import { describe, expect, it } from "vitest";
import { migrate } from "@/lib/schema";
import { readEmail, readMoney, readNewPassword, readPhone } from "@/lib/validation";
import { buildClientSearch } from "@/lib/clients";
import { formatDate, formatDays, formatMoney } from "@/lib/format";
import { getAnalytics } from "@/lib/analytics";
import { forgiveAttempt, getBlockedUntil, registerAttempt, resetAttempts } from "@/lib/rate-limit";
import { getUserById } from "@/lib/users";
import { getDb } from "@/lib/turso";
import { seedClient, seedLead, seedUser } from "./helpers";

describe("проверка ввода", () => {
  it("сумма: понимает пробелы и запятую, отклоняет отрицательные числа и мусор", () => {
    expect(readMoney("1 500 000")).toBe(1500000);
    expect(readMoney("12,5")).toBe(12.5);
    expect(readMoney("")).toBeNull();
    expect(() => readMoney(-1)).toThrow();
    expect(() => readMoney("abc")).toThrow();
  });

  it("телефон — минимум 5 цифр, email приводится к нижнему регистру", () => {
    expect(() => readPhone("12-34")).toThrow();
    expect(readPhone("+998 90 123")).toBe("+998 90 123");
    expect(readEmail("  Admin@CRM.test ")).toBe("admin@crm.test");
    expect(() => readEmail("not-an-email")).toThrow();
  });

  it("новый пароль: не короче 8 символов и не длиннее 72 байт", () => {
    expect(() => readNewPassword("short", 8)).toThrow();
    expect(() => readNewPassword("x".repeat(73), 8)).toThrow();
    expect(() => readNewPassword("пароль".repeat(7), 8)).toThrow(); // 42 символа, но 84 байта
    expect(readNewPassword("надёжный-пароль", 8)).toBe("надёжный-пароль");
  });
});

describe("форматирование и поиск", () => {
  it("строка поиска клиента — в нижнем регистре и с цифрами телефона", () => {
    expect(buildClientSearch({ name: "Иван ПЕТРОВ", phone: "+998 (93) 160-65-24", email: "Ivan@Mail.ru" })).toBe(
      "иван петров +998 (93) 160-65-24 998931606524 ivan@mail.ru",
    );
  });

  it("даты, дни и суммы", () => {
    expect(formatDate("2026-11-23T22:30:00.000Z")).toBe("23.11.2026");
    expect(formatDays(0.4)).toBe("меньше дня");
    expect(formatDays(2.25)).toBe("2,3 дн.");
    expect(formatMoney(1500000)).toMatch(/^1\s500\s000$/);
  });
});

describe("ограничение попыток", () => {
  it("блокирует ключ, когда попыток становится больше max, и снимает блокировку при сбросе", async () => {
    const rule = { key: "test:block", max: 3 };
    for (let i = 0; i < 3; i++) expect(await registerAttempt([rule])).toBeNull();

    const until = await registerAttempt([rule]);
    expect(until).not.toBeNull();
    expect((await getBlockedUntil([rule.key]))!.getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);

    await resetAttempts([rule.key]);
    expect(await getBlockedUntil([rule.key])).toBeNull();
  });

  it("успешная попытка снимается со счётчика", async () => {
    const rule = { key: "test:forgive", max: 3 };
    await registerAttempt([rule]);
    await registerAttempt([rule]);
    await forgiveAttempt([rule]); // осталась 1 ошибка
    expect(await registerAttempt([rule])).toBeNull(); // 2
    expect(await registerAttempt([rule])).toBeNull(); // 3
    expect(await registerAttempt([rule])).not.toBeNull(); // 4 > 3
  });

  it("попытки из прошедшего окна не учитываются", async () => {
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60_000).toISOString();
    await getDb().execute({
      sql: "insert into login_attempts (key, failures, window_start, blocked_until) values (?, 99, ?, null)",
      args: ["test:old", twentyMinutesAgo],
    });
    expect(await registerAttempt([{ key: "test:old", max: 3 }])).toBeNull();
    const rs = await getDb().execute({ sql: "select failures from login_attempts where key = ?", args: ["test:old"] });
    expect(Number(rs.rows[0]?.failures)).toBe(1);
    expect(await getBlockedUntil(["test:old"])).toBeNull();
  });
});

describe("миграция", () => {
  it("добавляет новые колонки в базу старой версии и безопасна при повторном запуске", async () => {
    const legacy = createClient({ url: `file:.test-dbs/legacy-${randomUUID()}.db` });
    await legacy.execute(`create table users (
      id text primary key, name text not null, email text not null unique, password_hash text not null,
      role text not null default 'manager', is_active integer not null default 1, created_at text not null)`);
    await legacy.execute({
      sql: "insert into users (id, name, email, password_hash, role, created_at) values ('u1', 'Старый', 'old@crm.test', 'x', 'admin', ?)",
      args: [new Date().toISOString()],
    });

    await migrate(legacy);
    await migrate(legacy);

    const columns = (await legacy.execute("pragma table_info(users)")).rows.map((row) => row.name);
    expect(columns).toEqual(expect.arrayContaining(["must_change_password", "session_version"]));
    const row = (await legacy.execute("select must_change_password, session_version from users where id = 'u1'")).rows[0];
    expect(Number(row?.must_change_password)).toBe(0);
    expect(Number(row?.session_version)).toBe(0);
    legacy.close();
  });
});

describe("аналитика", () => {
  it("конверсия, время закрытия и разбивка; manager видит только свои заявки", async () => {
    const admin = await seedUser("admin");
    const anna = await seedUser("manager");
    const oleg = await seedUser("manager");
    const client = await seedClient("Аналитика");
    const day = 24 * 60 * 60 * 1000;
    const ago = (days: number) => new Date(Date.now() - days * day).toISOString();

    await seedLead(client, anna.id, { status: "won", createdAt: ago(3), closedAt: ago(1) }); // закрыта за 2 дня
    await seedLead(client, anna.id, { status: "lost", createdAt: ago(2), closedAt: ago(1) }); // за 1 день
    await seedLead(client, anna.id, { status: "new", createdAt: ago(1) });
    await seedLead(client, oleg.id, { status: "won", createdAt: ago(1), closedAt: ago(0) }); // за 1 день

    const all = await getAnalytics((await getUserById(admin.id))!, "7");
    expect(all.totalLeads).toBe(4);
    expect(all.conversionRate).toBe(66.7); // 2 успешных из 3 закрытых
    expect(all.avgCloseDays).toBeCloseTo(4 / 3, 2);
    expect(all.granularity).toBe("day");
    expect(all.leadsOverTime).toHaveLength(7);
    expect(all.leadsOverTime.reduce((sum, point) => sum + point.count, 0)).toBe(4);
    expect(all.teamPerformance?.find((row) => row.userId === anna.id)).toMatchObject({ won: 1, total: 3 });

    const mine = await getAnalytics((await getUserById(anna.id))!, "7");
    expect(mine.totalLeads).toBe(3);
    expect(mine.conversionRate).toBe(50);
    expect(mine).not.toHaveProperty("teamPerformance");
  });
});
