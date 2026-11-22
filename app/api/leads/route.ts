import { NextResponse } from "next/server";
import { HttpError, readJson, requireApiUser, route } from "@/lib/http";
import { has, readEnum, readId, readMoney, readString } from "@/lib/validation";
import { parseClientInput } from "@/lib/clients";
import { createLead, listLeads } from "@/lib/leads";
import { isActiveUser } from "@/lib/users";
import { LEAD_SOURCES, LEAD_STATUSES } from "@/types/crm.types";

/** admin — все заявки, manager — только свои. */
export const GET = route(async () => {
  const user = await requireApiUser();
  return NextResponse.json({ leads: await listLeads(user) });
});

export const POST = route(async (request) => {
  const user = await requireApiUser();
  const body = await readJson(request);

  const clientId = readId(body.client_id, "client_id");
  const hasNewClient = body.new_client !== undefined && body.new_client !== null;
  if (hasNewClient && (typeof body.new_client !== "object" || Array.isArray(body.new_client))) {
    throw new HttpError(400, "Некорректные данные нового клиента");
  }
  if (!clientId && !hasNewClient) throw new HttpError(400, "Выберите клиента или создайте нового");
  if (clientId && hasNewClient) throw new HttpError(400, "Укажите либо существующего клиента, либо нового");
  const newClient = hasNewClient ? parseClientInput(body.new_client as Record<string, unknown>) : null;

  // manager создаёт заявки только на себя; admin может назначить любого активного сотрудника или никого.
  let assignedTo: string | null = user.id;
  if (user.role === "admin" && has(body, "assigned_to")) {
    assignedTo = readId(body.assigned_to, "assigned_to");
    if (assignedTo && !(await isActiveUser(assignedTo))) {
      throw new HttpError(400, "Сотрудник не найден или деактивирован");
    }
  }

  const lead = await createLead({
    clientId,
    newClient,
    source: body.source === undefined ? "manual" : readEnum(body.source, LEAD_SOURCES, "Источник"),
    status: body.status === undefined ? "new" : readEnum(body.status, LEAD_STATUSES, "Статус"),
    assignedTo,
    value: readMoney(body.value),
    notes: readString(body.notes, { label: "Заметки", max: 10000 }),
  });

  return NextResponse.json({ lead }, { status: 201 });
});
