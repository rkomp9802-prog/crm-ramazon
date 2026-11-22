import "./env";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/turso";
import { migrate } from "@/lib/schema";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth";

/**
 * Создаёт первого администратора из ADMIN_EMAIL / ADMIN_PASSWORD (.env.local).
 * Через UI admin не создаётся намеренно — иначе любой мог бы назначить себя админом.
 */
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const name = process.env.ADMIN_NAME?.trim() || "Администратор";

  if (!email || !password) throw new Error("Укажите ADMIN_EMAIL и ADMIN_PASSWORD в .env.local");
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD должен быть не короче ${MIN_PASSWORD_LENGTH} символов`);
  }

  const db = getDb();
  await migrate(db);

  const existing = await db.execute({ sql: "select id from users where email = ?", args: [email] });
  if (existing.rows.length > 0) {
    console.log(`Пользователь ${email} уже существует — ничего не меняю.`);
    return;
  }

  await db.execute({
    sql: "insert into users (id, name, email, password_hash, role, is_active, created_at) values (?, ?, ?, ?, 'admin', 1, ?)",
    args: [randomUUID(), name, email, await hashPassword(password), new Date().toISOString()],
  });
  console.log(`Администратор ${email} создан.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
