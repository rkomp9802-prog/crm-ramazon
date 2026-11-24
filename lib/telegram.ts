import { randomUUID, timingSafeEqual } from "node:crypto";
import { getDb, str } from "@/lib/turso";
import { buildClientSearch } from "@/lib/clients";

/** Сравнение секрета за постоянное время; нет переменной окружения или заголовка — false. */
export function isValidWebhookSecret(header: string | null): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface TelegramMessage {
  telegramId: string;
  chatId: string;
  name: string;
  text: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function idOf(value: unknown): string | null {
  return typeof value === "number" || typeof value === "string" ? String(value) : null;
}

/** Достаёт из апдейта Telegram нужное; null — апдейт без текстового сообщения. */
export function parseUpdate(update: unknown): TelegramMessage | null {
  const message = asRecord(asRecord(update)?.message);
  const from = asRecord(message?.from);
  const chat = asRecord(message?.chat);
  const text = typeof message?.text === "string" ? message.text.trim() : "";
  const telegramId = idOf(from?.id);
  const chatId = idOf(chat?.id);
  if (!text || !telegramId || !chatId) return null;

  const firstName = typeof from?.first_name === "string" ? from.first_name.trim() : "";
  const username = typeof from?.username === "string" ? from.username.trim() : "";
  const name = (firstName || (username ? `@${username}` : `Telegram ${telegramId}`)).slice(0, 200);
  return { telegramId, chatId, name, text: text.slice(0, 5000) };
}

/**
 * Клиент по Telegram ID; нового создаём с пустым телефоном (phone not null, а у Telegram номера нет).
 * Параллельные сообщения: уникальный индекс не даст создать дубль — тогда берём победителя.
 */
export async function findOrCreateTelegramClient(telegramId: string, name: string): Promise<string> {
  const db = getDb();
  const find = async () => {
    const rs = await db.execute({ sql: "select id from clients where telegram_id = ?", args: [telegramId] });
    return rs.rows[0] ? str(rs.rows[0].id) : null;
  };
  const existing = await find();
  if (existing) return existing;

  const id = randomUUID();
  try {
    await db.execute({
      sql: `insert into clients (id, name, phone, email, notes, search, telegram_id, created_at)
            values (?, ?, '', null, null, ?, ?, ?)`,
      args: [id, name, buildClientSearch({ name, phone: "", email: null }), telegramId, new Date().toISOString()],
    });
    return id;
  } catch (error) {
    const raced = await find();
    if (raced) return raced;
    throw error;
  }
}

/** Ответ клиенту. Ошибки не пробрасываем: заявка уже создана. */
export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) console.error(`Telegram sendMessage: HTTP ${response.status}`);
  } catch (error) {
    // Токен в сообщение об ошибке не попадает: пишем только имя ошибки.
    console.error("Telegram sendMessage failed:", error instanceof Error ? error.name : "unknown");
  }
}
