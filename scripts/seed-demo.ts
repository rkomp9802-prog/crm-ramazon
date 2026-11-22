import "./env";
import { randomUUID } from "node:crypto";
import type { InStatement } from "@libsql/client";
import { getDb } from "@/lib/turso";
import { migrate } from "@/lib/schema";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth";
import { buildClientSearch } from "@/lib/clients";
import type { LeadSource, LeadStatus } from "@/types/crm.types";

/**
 * Демо-данные для локальной разработки: 2 менеджера, клиенты, заявки за ~2,5 месяца, задачи.
 * Защита: только локальная база (file:) и только если заявок ещё нет — флаги --allow-remote / --force.
 */

const flags = new Set(process.argv.slice(2));

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261123);
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)] as T;

const DAY = 86_400_000;
const now = Date.now();
const isoDaysAgo = (days: number, extraMs = 0) => new Date(now - days * DAY + extraMs).toISOString();
const dateOffset = (days: number) => new Date(now + days * DAY).toISOString().slice(0, 10);

const SOURCE_WEIGHTS: LeadSource[] = [
  "website_form", "website_form", "website_form", "website_form",
  "telegram_bot", "telegram_bot", "telegram_bot",
  "phone", "phone", "phone",
  "referral", "referral",
  "manual",
  "other",
];

function pickStatus(ageDays: number): LeadStatus {
  const r = rand();
  if (ageDays > 20) {
    if (r < 0.38) return "won";
    if (r < 0.62) return "lost";
    if (r < 0.77) return "waiting";
    if (r < 0.9) return "in_progress";
    return "new";
  }
  if (r < 0.35) return "new";
  if (r < 0.65) return "in_progress";
  if (r < 0.8) return "waiting";
  if (r < 0.92) return "won";
  return "lost";
}

const CLIENT_NAMES = [
  "Алишер Каримов", "Иван Петров", "ООО «Сфера»", "Наталья Ли", "Дильноза Рахимова",
  "Тимур Ахмедов", "ИП Соколова", "Бахтиёр Усманов", "Екатерина Орлова", "Равшан Турсунов",
  "Гульнора Азимова", "ООО «Восток Логистик»", "Анна Смирнова", "Жасур Хамидов", "Ольга Ким",
  "Шахзод Мирзаев",
];

const TASK_TITLES = [
  "Перезвонить клиенту", "Отправить коммерческое предложение", "Уточнить бюджет",
  "Назначить встречу", "Подготовить договор", "Отправить счёт", "Напомнить о заявке",
];

const LEAD_NOTES = [
  "Интересуется полным пакетом услуг.", "Просил перезвонить после 18:00.", "Сравнивает с конкурентами.",
  "Нужна консультация по срокам.", null, null, null,
];

async function main() {
  const url = process.env.TURSO_DATABASE_URL || "file:local.db";
  if (!url.startsWith("file:") && !flags.has("--allow-remote")) {
    throw new Error("Демо-данные заливаются только в локальную базу (file:...). Для удалённой — флаг --allow-remote.");
  }
  const password = process.env.DEMO_USER_PASSWORD ?? "";
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Укажите DEMO_USER_PASSWORD (не короче ${MIN_PASSWORD_LENGTH} символов) в .env.local`);
  }

  const db = getDb();
  await migrate(db);

  const leadCount = await db.execute("select count(*) as n from leads");
  if (Number(leadCount.rows[0]?.n ?? 0) > 0 && !flags.has("--force")) {
    console.log("В базе уже есть заявки — демо-данные не добавлены (флаг --force добавит ещё).");
    return;
  }

  const adminRs = await db.execute("select id from users where role = 'admin' and is_active = 1 limit 1");
  const adminId = adminRs.rows[0] ? String(adminRs.rows[0].id) : null;

  const statements: InStatement[] = [];
  const passwordHash = await hashPassword(password);
  const managers = [
    { name: "Мадина Юсупова", email: "madina@crm.test" },
    { name: "Сергей Ким", email: "sergey@crm.test" },
  ];
  const managerIds: string[] = [];
  for (const manager of managers) {
    const found = await db.execute({ sql: "select id from users where email = ?", args: [manager.email] });
    if (found.rows[0]) {
      managerIds.push(String(found.rows[0].id));
      continue;
    }
    const id = randomUUID();
    managerIds.push(id);
    statements.push({
      sql: "insert into users (id, name, email, password_hash, role, is_active, created_at) values (?, ?, ?, ?, 'manager', 1, ?)",
      args: [id, manager.name, manager.email, passwordHash, isoDaysAgo(95)],
    });
  }

  const clientIds: string[] = [];
  for (const [index, name] of CLIENT_NAMES.entries()) {
    const id = randomUUID();
    clientIds.push(id);
    const phone = `+998 9${randInt(0, 9)} ${randInt(100, 999)}-${randInt(10, 99)}-${randInt(10, 99)}`;
    const email = rand() < 0.45 ? `client${index + 1}@example.com` : null;
    statements.push({
      sql: "insert into clients (id, name, phone, email, notes, search, created_at) values (?, ?, ?, ?, ?, ?, ?)",
      args: [id, name, phone, email, null, buildClientSearch({ name, phone, email }), isoDaysAgo(randInt(80, 90))],
    });
  }

  const openLeads: { id: string; clientId: string; assignedTo: string | null }[] = [];
  for (let i = 0; i < 58; i++) {
    const id = randomUUID();
    const clientId = pick(clientIds);
    const ageDays = Math.floor(Math.pow(rand(), 1.4) * 75);
    const createdAt = isoDaysAgo(ageDays, -randInt(0, 10) * 3_600_000);
    const status = pickStatus(ageDays);
    const r = rand();
    const assignedTo = r < 0.82 ? pick(managerIds) : r < 0.92 && adminId ? adminId : null;
    const closedAt =
      status === "won" || status === "lost"
        ? new Date(Math.min(now, Date.parse(createdAt) + randInt(1, Math.max(1, Math.min(ageDays, 14))) * DAY)).toISOString()
        : null;
    const updatedAt = closedAt ?? new Date(Math.min(now, Date.parse(createdAt) + randInt(0, 3) * DAY)).toISOString();
    const value = rand() < 0.65 ? randInt(5, 120) * 100_000 : null;
    statements.push({
      sql: `insert into leads (id, client_id, source, status, assigned_to, value, notes, created_at, updated_at, closed_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, clientId, pick(SOURCE_WEIGHTS), status, assignedTo, value, pick(LEAD_NOTES), createdAt, updatedAt, closedAt],
    });
    if (status !== "won" && status !== "lost") openLeads.push({ id, clientId, assignedTo });
  }

  for (let i = 0; i < 22 && openLeads.length > 0; i++) {
    const lead = pick(openLeads);
    statements.push({
      sql: `insert into tasks (id, lead_id, client_id, assigned_to, title, due_date, status, created_at)
            values (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        randomUUID(),
        lead.id,
        lead.clientId,
        lead.assignedTo ?? pick(managerIds),
        pick(TASK_TITLES),
        rand() < 0.85 ? dateOffset(randInt(-6, 10)) : null,
        rand() < 0.3 ? "done" : "pending",
        isoDaysAgo(randInt(1, 10)),
      ],
    });
  }

  await db.batch(statements, "write");
  console.log(
    `Демо-данные добавлены: менеджеры ${managers.map((m) => m.email).join(", ")} (пароль — DEMO_USER_PASSWORD), ` +
      `${CLIENT_NAMES.length} клиентов, 58 заявок, задачи.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
