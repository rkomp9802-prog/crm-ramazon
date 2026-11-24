import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { call } from "./helpers";
import { getDb } from "@/lib/turso";
import { POST } from "@/app/api/telegram/webhook/route";

const SECRET = "test-webhook-secret";
const headers = { "x-telegram-bot-api-secret-token": SECRET };

const update = (overrides: Record<string, unknown> = {}) => ({
  update_id: 1,
  message: {
    message_id: 10,
    from: { id: 555001, first_name: "Алиса", username: "alice" },
    chat: { id: 555001 },
    text: "Хочу заказать сайт",
    ...overrides,
  },
});

async function count(sql: string, ...args: string[]): Promise<number> {
  const rs = await getDb().execute({ sql, args });
  return Number(rs.rows[0]?.n);
}

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  process.env.TELEGRAM_WEBHOOK_SECRET = SECRET;
  process.env.TELEGRAM_BOT_TOKEN = "123:test-token";
  fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
});

afterEach(() => {
  fetchSpy.mockRestore();
});

describe("Telegram webhook", () => {
  it("без секрета и с неверным секретом отвечает 401 и ничего не создаёт", async () => {
    expect((await call(POST, { method: "POST", body: update() })).status).toBe(401);
    const wrong = await call(POST, { method: "POST", body: update(), headers: { "x-telegram-bot-api-secret-token": "nope" } });
    expect(wrong.status).toBe(401);
    expect(await count("select count(*) n from clients where telegram_id = '555001'")).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("если секрет не задан в окружении — 401", async () => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    expect((await call(POST, { method: "POST", body: update(), headers })).status).toBe(401);
  });

  it("новое сообщение создаёт клиента и заявку telegram_bot и отвечает клиенту", async () => {
    const { status } = await call(POST, { method: "POST", body: update(), headers });
    expect(status).toBe(200);

    const client = (await getDb().execute("select id, name, phone from clients where telegram_id = '555001'")).rows[0];
    expect(client.name).toBe("Алиса");
    expect(client.phone).toBe("");

    const lead = (await getDb().execute({ sql: "select * from leads where client_id = ?", args: [client.id as string] })).rows[0];
    expect(lead.source).toBe("telegram_bot");
    expect(lead.status).toBe("new");
    expect(lead.assigned_to).toBeNull();
    expect(lead.notes).toBe("Хочу заказать сайт");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bot123:test-token/sendMessage");
    expect(JSON.parse(init.body as string).chat_id).toBe("555001");
  });

  it("повторное сообщение того же from.id переиспользует клиента", async () => {
    const from = { id: 555002, username: "bob" };
    await call(POST, { method: "POST", body: update({ from, chat: { id: 555002 } }), headers });
    await call(POST, { method: "POST", body: update({ from, chat: { id: 555002 }, text: "Ещё вопрос" }), headers });

    expect(await count("select count(*) n from clients where telegram_id = '555002'")).toBe(1);
    expect(
      await count("select count(*) n from leads l join clients c on c.id = l.client_id where c.telegram_id = '555002'"),
    ).toBe(2);
    expect((await getDb().execute("select name from clients where telegram_id = '555002'")).rows[0].name).toBe("@bob");
  });

  it("апдейт без текста — 200 без заявки", async () => {
    const before = await count("select count(*) n from leads");
    const photo = { update_id: 2, message: { from: { id: 555003, first_name: "Вера" }, chat: { id: 555003 }, photo: [{}] } };
    expect((await call(POST, { method: "POST", body: photo, headers })).status).toBe(200);
    expect((await call(POST, { method: "POST", body: { update_id: 3, edited_message: {} }, headers })).status).toBe(200);
    expect(await count("select count(*) n from leads")).toBe(before);
    expect(await count("select count(*) n from clients where telegram_id = '555003'")).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("ошибка отправки ответа не роняет обработку: заявка уже создана", async () => {
    fetchSpy.mockRejectedValue(new Error("network down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const body = update({ from: { id: 555004, first_name: "Глеб" }, chat: { id: 555004 } });
    expect((await call(POST, { method: "POST", body, headers })).status).toBe(200);
    expect(
      await count("select count(*) n from leads l join clients c on c.id = l.client_id where c.telegram_id = '555004'"),
    ).toBe(1);
    errorSpy.mockRestore();
  });
});
