import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { signSession } from "@/lib/auth";

async function run(path: string, options: { token?: string; method?: string; origin?: string } = {}) {
  const headers = new Headers();
  if (options.token) headers.set("cookie", `session=${options.token}`);
  if (options.origin) headers.set("origin", options.origin);
  return proxy(new NextRequest(new URL(path, "http://localhost:3000"), { method: options.method ?? "GET", headers }));
}

/** NextResponse.next() — запрос пропущен дальше. */
const passedThrough = (response: Response) => response.headers.get("x-middleware-next") === "1";
const tokenFor = (role: "admin" | "manager") => signSession({ userId: `${role}-id`, role, sessionVersion: 0 });

describe("proxy", () => {
  it("без сессии отправляет со страницы на /login и запоминает, куда вернуться", async () => {
    const response = await run("/leads?q=1");
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/leads?q=1");
  });

  it("без сессии API отвечает 401", async () => {
    expect((await run("/api/leads")).status).toBe(401);
  });

  it("страница входа и сам вход открыты без сессии", async () => {
    expect(passedThrough(await run("/login"))).toBe(true);
    expect(passedThrough(await run("/api/auth/login", { method: "POST" }))).toBe(true);
  });

  it("поддельный токен не принимается", async () => {
    const response = await run("/dashboard", { token: "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJ4In0.forged" });
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/login");
  });

  it("manager не попадает в раздел сотрудников", async () => {
    const token = await tokenFor("manager");
    const page = await run("/users", { token });
    expect(page.status).toBe(307);
    expect(new URL(page.headers.get("location") ?? "").pathname).toBe("/dashboard");
    expect((await run("/api/users", { token })).status).toBe(403);
  });

  it("admin проходит в раздел сотрудников", async () => {
    expect(passedThrough(await run("/users", { token: await tokenFor("admin") }))).toBe(true);
  });

  it("изменяющий запрос с чужого сайта отклоняется, со своего — проходит", async () => {
    const token = await tokenFor("admin");
    expect((await run("/api/leads", { token, method: "POST", origin: "http://evil.test" })).status).toBe(403);
    expect(passedThrough(await run("/api/leads", { token, method: "POST", origin: "http://localhost:3000" }))).toBe(true);
  });
});
