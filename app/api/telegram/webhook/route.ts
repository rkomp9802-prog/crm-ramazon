import { NextResponse } from "next/server";
import { ensureSchema } from "@/lib/schema";
import { createLead } from "@/lib/leads";
import {
  findOrCreateTelegramClient,
  isValidWebhookSecret,
  parseUpdate,
  sendTelegramMessage,
} from "@/lib/telegram";

// Вебхук Telegram: публичный путь (proxy.ts), защищён секретом из setWebhook.
const REPLY = "Спасибо, ваша заявка принята. Менеджер свяжется с вами в ближайшее время.";

export async function POST(request: Request) {
  if (!isValidWebhookSecret(request.headers.get("x-telegram-bot-api-secret-token"))) {
    return NextResponse.json({ error: "Неверный секрет" }, { status: 401 });
  }

  const update: unknown = await request.json().catch(() => null);
  const message = parseUpdate(update);
  // Не-текстовые апдейты подтверждаем 200, иначе Telegram будет слать их повторно.
  if (!message) return NextResponse.json({ ok: true });

  await ensureSchema();
  const clientId = await findOrCreateTelegramClient(message.telegramId, message.name);
  await createLead({
    clientId,
    newClient: null,
    source: "telegram_bot",
    status: "new",
    assignedTo: null,
    value: null,
    notes: message.text,
  });

  await sendTelegramMessage(message.chatId, REPLY);
  return NextResponse.json({ ok: true });
}
