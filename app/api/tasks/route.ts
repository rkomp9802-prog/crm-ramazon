import { NextResponse } from "next/server";
import { HttpError, readJson, requireApiUser, route } from "@/lib/http";
import { readDate, readId, readRequiredString } from "@/lib/validation";
import { createTask, listTasks } from "@/lib/tasks";
import { canAccessLead, getLead } from "@/lib/leads";
import { getClient } from "@/lib/clients";
import { isActiveUser } from "@/lib/users";

/** ?scope=mine|all (all — только admin), ?lead_id=, ?client_id= */
export const GET = route(async (request) => {
  const user = await requireApiUser();
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") === "all" ? "all" : "mine";
  if (scope === "all" && user.role !== "admin") {
    throw new HttpError(403, "Все задачи доступны только администратору");
  }
  const tasks = await listTasks(user, {
    scope,
    leadId: url.searchParams.get("lead_id") ?? undefined,
    clientId: url.searchParams.get("client_id") ?? undefined,
  });
  return NextResponse.json({ tasks });
});

export const POST = route(async (request) => {
  const user = await requireApiUser();
  const body = await readJson(request);

  const title = readRequiredString(body.title, { label: "Задача", max: 300 });
  const dueDate = readDate(body.due_date, "Срок");
  const leadId = readId(body.lead_id, "lead_id");
  let clientId = readId(body.client_id, "client_id");

  if (leadId) {
    const lead = await getLead(leadId);
    if (!lead) throw new HttpError(400, "Заявка не найдена");
    if (!canAccessLead(user, lead)) throw new HttpError(403, "Нет доступа к этой заявке");
    clientId = lead.client_id;
  } else if (clientId && !(await getClient(clientId))) {
    throw new HttpError(400, "Клиент не найден");
  }

  let assignedTo = user.id;
  const requestedAssignee = readId(body.assigned_to, "assigned_to");
  if (requestedAssignee && requestedAssignee !== user.id) {
    if (user.role !== "admin") throw new HttpError(403, "Назначать задачи другим может только администратор");
    if (!(await isActiveUser(requestedAssignee))) throw new HttpError(400, "Сотрудник не найден или деактивирован");
    assignedTo = requestedAssignee;
  }

  const task = await createTask({ leadId, clientId, assignedTo, title, dueDate });
  return NextResponse.json({ task }, { status: 201 });
});
