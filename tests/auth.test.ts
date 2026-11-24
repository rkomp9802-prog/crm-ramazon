import { beforeEach, describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as changePassword } from "@/app/api/auth/password/route";
import { GET as listLeads } from "@/app/api/leads/route";
import { PATCH as patchUser, POST as createUser } from "@/app/api/users/route";
import { getDb } from "@/lib/turso";
import { call, loginAs, PASSWORD, seedUser, sessionTokenFrom, setSession } from "./helpers";

const GENERIC_ERROR = "Неверный email или пароль";

function attempt(email: string, password: string, ip: string) {
  return call(login, { method: "POST", body: { email, password }, headers: { "x-forwarded-for": ip } });
}

beforeEach(async () => {
  await getDb().execute("delete from login_attempts");
  setSession(null);
});

describe("вход", () => {
  it("при верном пароле ставит httpOnly-cookie сессии", async () => {
    const user = await seedUser("manager");
    const result = await attempt(user.email, PASSWORD, "10.0.0.1");
    expect(result.status).toBe(200);
    const cookie = result.response.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
  });

  it("одинаково отвечает на неверный пароль, неизвестный email и выключенный аккаунт", async () => {
    const active = await seedUser("manager");
    const inactive = await seedUser("manager", { active: false });
    const results = [
      await attempt(active.email, "wrong-password", "10.0.1.1"),
      await attempt("nobody@crm.test", PASSWORD, "10.0.1.2"),
      await attempt(inactive.email, PASSWORD, "10.0.1.3"),
    ];
    for (const result of results) {
      expect(result.status).toBe(401);
      expect(result.data.error).toBe(GENERIC_ERROR);
    }
  });

  it("после 5 ошибок с одного IP на один email отвечает 429 — даже на верный пароль", async () => {
    const user = await seedUser("manager");
    for (let i = 0; i < 5; i++) {
      expect((await attempt(user.email, `wrong-${i}`, "10.0.2.1")).status).toBe(401);
    }
    const blocked = await attempt(user.email, PASSWORD, "10.0.2.1");
    expect(blocked.status).toBe(429);
    expect(blocked.data.error).toMatch(/Слишком много/);
    expect(Number(blocked.response.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("блокировка по паре IP+email не мешает войти с другого IP", async () => {
    const user = await seedUser("manager");
    for (let i = 0; i < 5; i++) await attempt(user.email, "wrong", "10.0.3.1");
    expect((await attempt(user.email, PASSWORD, "10.0.3.1")).status).toBe(429);
    expect((await attempt(user.email, PASSWORD, "10.0.3.2")).status).toBe(200);
  });

  it("несуществующий email блокируется так же — по ответу не понять, есть ли аккаунт", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await attempt("ghost@crm.test", "wrong", "10.0.4.1")).status).toBe(401);
    }
    expect((await attempt("ghost@crm.test", "wrong", "10.0.4.1")).status).toBe(429);
  });

  it("успешный вход обнуляет счётчик ошибок", async () => {
    const user = await seedUser("manager");
    for (let i = 0; i < 4; i++) await attempt(user.email, "wrong", "10.0.5.1");
    expect((await attempt(user.email, PASSWORD, "10.0.5.1")).status).toBe(200);
    for (let i = 0; i < 4; i++) {
      expect((await attempt(user.email, "wrong", "10.0.5.1")).status).toBe(401);
    }
    expect((await attempt(user.email, PASSWORD, "10.0.5.1")).status).toBe(200);
  });

  it("ограничивает перебор разных email с одного IP", async () => {
    for (let i = 0; i < 25; i++) {
      expect((await attempt(`spray-${i}@crm.test`, "wrong", "10.0.6.1")).status).toBe(401);
    }
    expect((await attempt("spray-last@crm.test", "wrong", "10.0.6.1")).status).toBe(429);
  });

  it("пачка параллельных запросов не обходит лимит: пароль проверяется не больше 5 раз", async () => {
    const user = await seedUser("manager");
    const results = await Promise.all(Array.from({ length: 10 }, () => attempt(user.email, "wrong", "10.0.10.1")));
    const statuses = results.map((result) => result.status);
    expect(statuses.filter((status) => status === 401)).toHaveLength(5);
    expect(statuses.filter((status) => status === 429)).toHaveLength(5);
  });

  it("без заголовков с IP чужие ошибки не блокируют вход остальным", async () => {
    for (let i = 0; i < 30; i++) {
      await call(login, { method: "POST", body: { email: `no-ip-${i}@crm.test`, password: "wrong" } });
    }
    const user = await seedUser("manager");
    const result = await call(login, { method: "POST", body: { email: user.email, password: PASSWORD } });
    expect(result.status).toBe(200);
  });

  it("ограничивает атаку на один email с разных IP", async () => {
    const user = await seedUser("manager");
    for (let i = 0; i < 30; i++) {
      expect((await attempt(user.email, "wrong", `10.1.${i}.1`)).status).toBe(401);
    }
    expect((await attempt(user.email, PASSWORD, "10.2.0.1")).status).toBe(429);
  });
});

describe("смена своего пароля", () => {
  it("меняет пароль, завершает старые сеансы и выдаёт новую cookie", async () => {
    const user = await seedUser("manager");
    const oldToken = await loginAs(user);

    const result = await call(changePassword, {
      method: "POST",
      body: { current_password: PASSWORD, new_password: "brand-new-password" },
    });
    expect(result.status).toBe(200);
    const newToken = sessionTokenFrom(result.response);
    expect(newToken).toBeTruthy();

    setSession(oldToken);
    expect((await call(listLeads)).status).toBe(401);
    setSession(newToken);
    expect((await call(listLeads)).status).toBe(200);

    expect((await attempt(user.email, PASSWORD, "10.0.7.1")).status).toBe(401);
    expect((await attempt(user.email, "brand-new-password", "10.0.7.1")).status).toBe(200);
  });

  it("неверный текущий пароль — 400, после 5 ошибок — 429", async () => {
    const user = await seedUser("manager");
    await loginAs(user);
    for (let i = 0; i < 5; i++) {
      const result = await call(changePassword, {
        method: "POST",
        body: { current_password: "wrong", new_password: "another-password" },
      });
      expect(result.status).toBe(400);
    }
    const blocked = await call(changePassword, {
      method: "POST",
      body: { current_password: PASSWORD, new_password: "another-password" },
    });
    expect(blocked.status).toBe(429);
  });

  it("не принимает короткий пароль и пароль, совпадающий с текущим", async () => {
    const user = await seedUser("manager");
    await loginAs(user);
    const short = await call(changePassword, { method: "POST", body: { current_password: PASSWORD, new_password: "short" } });
    expect(short.status).toBe(400);
    const same = await call(changePassword, { method: "POST", body: { current_password: PASSWORD, new_password: PASSWORD } });
    expect(same.status).toBe(400);
    expect(same.data.error).toMatch(/отличаться/);
  });
});

describe("временный пароль", () => {
  it("сотрудник, созданный администратором, до смены пароля получает 403", async () => {
    const admin = await seedUser("admin");
    await loginAs(admin);
    const email = `new-${Date.now()}@crm.test`;
    const created = await call(createUser, {
      method: "POST",
      body: { name: "Новый сотрудник", email, role: "manager", password: "temporary-1" },
    });
    expect(created.status).toBe(201);
    expect(created.data.user.must_change_password).toBe(true);

    const loggedIn = await attempt(email, "temporary-1", "10.0.8.1");
    expect(loggedIn.status).toBe(200);
    expect(loggedIn.data.user.must_change_password).toBe(true);
    setSession(sessionTokenFrom(loggedIn.response));

    const blocked = await call(listLeads);
    expect(blocked.status).toBe(403);
    expect(blocked.data.error).toMatch(/временный пароль/);

    const changed = await call(changePassword, {
      method: "POST",
      body: { current_password: "temporary-1", new_password: "my-own-password" },
    });
    expect(changed.status).toBe(200);
    setSession(sessionTokenFrom(changed.response));
    expect((await call(listLeads)).status).toBe(200);
  });

  it("сброс пароля администратором завершает сеансы и снова требует смены", async () => {
    const admin = await seedUser("admin");
    const manager = await seedUser("manager");
    const managerToken = await loginAs(manager);

    await loginAs(admin);
    const reset = await call(patchUser, { method: "PATCH", body: { id: manager.id, password: "reset-temp-1" } });
    expect(reset.status).toBe(200);
    expect(reset.data.user.must_change_password).toBe(true);

    setSession(managerToken);
    expect((await call(listLeads)).status).toBe(401);

    const relogin = await attempt(manager.email, "reset-temp-1", "10.0.9.1");
    expect(relogin.status).toBe(200);
    setSession(sessionTokenFrom(relogin.response));
    expect((await call(listLeads)).status).toBe(403);
  });

  it("администратор не может сбросить себе пароль через раздел «Сотрудники»", async () => {
    const admin = await seedUser("admin");
    await loginAs(admin);
    const result = await call(patchUser, { method: "PATCH", body: { id: admin.id, password: "self-reset-1" } });
    expect(result.status).toBe(400);
  });
});
