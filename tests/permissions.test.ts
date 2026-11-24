import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as listLeads, POST as createLead } from "@/app/api/leads/route";
import { GET as getLead, PATCH as patchLead } from "@/app/api/leads/[id]/route";
import { GET as listTasks, POST as createTask } from "@/app/api/tasks/route";
import { PATCH as patchTask } from "@/app/api/tasks/[id]/route";
import { GET as listClients } from "@/app/api/clients/route";
import { GET as getClientCard } from "@/app/api/clients/[id]/route";
import { GET as getAnalytics } from "@/app/api/analytics/route";
import { GET as listUsers, PATCH as patchUser, POST as createUser } from "@/app/api/users/route";
import { call, loginAs, seedClient, seedLead, seedTask, seedUser, setSession, type TestUser } from "./helpers";

// Матрица прав из раздела 2 спецификации: admin видит всё, manager — только своё.

let admin: TestUser;
let alice: TestUser;
let bob: TestUser;
let clientId: string;
let aliceLead: string;
let bobLead: string;
let unassignedLead: string;
let aliceTask: string;
let bobTask: string;

beforeAll(async () => {
  admin = await seedUser("admin");
  alice = await seedUser("manager");
  bob = await seedUser("manager");
  clientId = await seedClient("Иван Петров", "+998 93 160-65-24");
  aliceLead = await seedLead(clientId, alice.id);
  bobLead = await seedLead(clientId, bob.id);
  unassignedLead = await seedLead(clientId, null);
  aliceTask = await seedTask(alice.id, aliceLead, clientId);
  bobTask = await seedTask(bob.id, bobLead, clientId);
});

beforeEach(() => setSession(null));

const ids = (items: { id: string }[]) => items.map((item) => item.id);

describe("заявки", () => {
  it("без сессии — 401", async () => {
    expect((await call(listLeads)).status).toBe(401);
  });

  it("admin видит все заявки, manager — только свои", async () => {
    await loginAs(admin);
    expect(ids((await call(listLeads)).data.leads)).toEqual(expect.arrayContaining([aliceLead, bobLead, unassignedLead]));

    await loginAs(alice);
    const own = (await call(listLeads)).data.leads as { id: string; assigned_to: string }[];
    expect(ids(own)).toContain(aliceLead);
    expect(own.every((lead) => lead.assigned_to === alice.id)).toBe(true);
  });

  it("manager не может открыть или изменить чужую и неназначенную заявку", async () => {
    await loginAs(alice);
    expect((await call(getLead, { params: { id: bobLead } })).status).toBe(403);
    expect((await call(getLead, { params: { id: unassignedLead } })).status).toBe(403);
    expect((await call(patchLead, { method: "PATCH", params: { id: bobLead }, body: { status: "won" } })).status).toBe(403);
    expect((await call(getLead, { params: { id: aliceLead } })).status).toBe(200);
  });

  it("manager не может переназначить даже свою заявку", async () => {
    await loginAs(alice);
    const result = await call(patchLead, { method: "PATCH", params: { id: aliceLead }, body: { assigned_to: bob.id } });
    expect(result.status).toBe(403);
  });

  it("перенос в «Отказ» ставит closed_at и дописывает причину, возврат в работу снимает closed_at", async () => {
    await loginAs(alice);
    const lost = await call(patchLead, {
      method: "PATCH",
      params: { id: aliceLead },
      body: { status: "lost", append_note: "Причина отказа: дорого" },
    });
    expect(lost.status).toBe(200);
    expect(lost.data.lead.closed_at).not.toBeNull();
    expect(lost.data.lead.notes).toBe("Причина отказа: дорого");

    const reopened = await call(patchLead, { method: "PATCH", params: { id: aliceLead }, body: { status: "in_progress" } });
    expect(reopened.data.lead.closed_at).toBeNull();
    expect(reopened.data.lead.notes).toBe("Причина отказа: дорого");
  });

  it("недопустимый статус — 400", async () => {
    await loginAs(alice);
    const result = await call(patchLead, { method: "PATCH", params: { id: aliceLead }, body: { status: "bogus" } });
    expect(result.status).toBe(400);
  });

  it("заявку нельзя создать без клиента; manager создаёт заявку только на себя", async () => {
    await loginAs(alice);
    expect((await call(createLead, { method: "POST", body: { source: "phone" } })).status).toBe(400);

    const created = await call(createLead, {
      method: "POST",
      body: {
        new_client: { name: "Тест Тестов", phone: "+998 90 000-00-01" },
        source: "phone",
        value: "1 500 000",
        assigned_to: bob.id,
      },
    });
    expect(created.status).toBe(201);
    expect(created.data.lead.assigned_to).toBe(alice.id);
    expect(created.data.lead.value).toBe(1500000);
  });

  it("admin может оставить заявку без ответственного, но не назначить на выключенного", async () => {
    const inactive = await seedUser("manager", { active: false });
    await loginAs(admin);
    const toInactive = await call(createLead, { method: "POST", body: { client_id: clientId, assigned_to: inactive.id } });
    expect(toInactive.status).toBe(400);

    const unassigned = await call(createLead, { method: "POST", body: { client_id: clientId, assigned_to: null } });
    expect(unassigned.status).toBe(201);
    expect(unassigned.data.lead.assigned_to).toBeNull();
  });
});

describe("задачи", () => {
  it("manager видит только свои задачи и не может запросить все", async () => {
    await loginAs(alice);
    expect((await call(listTasks, { query: "?scope=all" })).status).toBe(403);
    const own = (await call(listTasks)).data.tasks as { id: string; assigned_to: string }[];
    expect(ids(own)).toContain(aliceTask);
    expect(ids(own)).not.toContain(bobTask);
    expect(own.every((task) => task.assigned_to === alice.id)).toBe(true);
  });

  it("admin видит задачи всех сотрудников", async () => {
    await loginAs(admin);
    expect(ids((await call(listTasks, { query: "?scope=all" })).data.tasks)).toEqual(
      expect.arrayContaining([aliceTask, bobTask]),
    );
  });

  it("manager отмечает свою задачу, но не чужую", async () => {
    await loginAs(alice);
    const own = await call(patchTask, { method: "PATCH", params: { id: aliceTask }, body: { status: "done" } });
    expect(own.status).toBe(200);
    expect(own.data.task.status).toBe("done");
    const foreign = await call(patchTask, { method: "PATCH", params: { id: bobTask }, body: { status: "done" } });
    expect(foreign.status).toBe(403);
  });

  it("manager не назначает задачи другим и не создаёт их по чужой заявке", async () => {
    await loginAs(alice);
    expect((await call(createTask, { method: "POST", body: { title: "x", assigned_to: bob.id } })).status).toBe(403);
    expect((await call(createTask, { method: "POST", body: { title: "x", lead_id: bobLead } })).status).toBe(403);

    const created = await call(createTask, { method: "POST", body: { title: "Позвонить", lead_id: aliceLead } });
    expect(created.status).toBe(201);
    expect(created.data.task.client_id).toBe(clientId);
    expect(created.data.task.assigned_to).toBe(alice.id);
  });
});

describe("клиенты", () => {
  it("поиск не зависит от регистра кириллицы и находит по цифрам телефона", async () => {
    await loginAs(alice);
    const byName = await call(listClients, { query: `?q=${encodeURIComponent("ИВАН")}` });
    expect(ids(byName.data.clients)).toContain(clientId);
    const byDigits = await call(listClients, { query: "?q=998931606524" });
    expect(ids(byDigits.data.clients)).toContain(clientId);
    const nothing = await call(listClients, { query: `?q=${encodeURIComponent("нет-такого")}` });
    expect(ids(nothing.data.clients)).not.toContain(clientId);
  });

  it("в карточке клиента manager видит только свои заявки", async () => {
    await loginAs(alice);
    const card = await call(getClientCard, { params: { id: clientId } });
    expect(card.status).toBe(200);
    const leads = card.data.leads as { assigned_to: string }[];
    expect(leads.length).toBeGreaterThan(0);
    expect(leads.every((lead) => lead.assigned_to === alice.id)).toBe(true);
  });
});

describe("аналитика", () => {
  it("manager видит только свои показатели и не получает показатели команды", async () => {
    await loginAs(alice);
    const mine = (await call(getAnalytics, { query: "?period=30" })).data;
    expect(mine).not.toHaveProperty("teamPerformance");

    await loginAs(admin);
    const all = (await call(getAnalytics, { query: "?period=30" })).data;
    expect(Array.isArray(all.teamPerformance)).toBe(true);
    expect(mine.totalLeads).toBeLessThan(all.totalLeads);
  });
});

describe("сотрудники", () => {
  it("manager не управляет сотрудниками", async () => {
    await loginAs(alice);
    expect((await call(listUsers)).status).toBe(403);
    const create = await call(createUser, {
      method: "POST",
      body: { name: "x", email: "x@crm.test", role: "admin", password: "12345678" },
    });
    expect(create.status).toBe(403);
    expect((await call(patchUser, { method: "PATCH", body: { id: alice.id, role: "admin" } })).status).toBe(403);
  });

  it("admin не может снять с себя роль или выключить себя", async () => {
    await loginAs(admin);
    expect((await call(patchUser, { method: "PATCH", body: { id: admin.id, role: "manager" } })).status).toBe(400);
    expect((await call(patchUser, { method: "PATCH", body: { id: admin.id, is_active: false } })).status).toBe(400);
  });

  it("выключение сотрудника сразу действует на его открытые сеансы", async () => {
    const bobToken = await loginAs(bob);
    await loginAs(admin);
    expect((await call(patchUser, { method: "PATCH", body: { id: bob.id, is_active: false } })).status).toBe(200);

    setSession(bobToken);
    expect((await call(listLeads)).status).toBe(401);

    await loginAs(admin);
    await call(patchUser, { method: "PATCH", body: { id: bob.id, is_active: true } });
    setSession(bobToken);
    expect((await call(listLeads)).status).toBe(200);
  });
});
