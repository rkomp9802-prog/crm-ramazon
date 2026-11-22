import { NextResponse } from "next/server";
import { HttpError, readJson, requireApiUser, route } from "@/lib/http";
import { has, readEnum, readId, readMoney, readString } from "@/lib/validation";
import { canAccessLead, getLead, updateLead, type UpdateLeadInput } from "@/lib/leads";
import { isActiveUser } from "@/lib/users";
import { LEAD_STATUSES, type User } from "@/types/crm.types";

type Context = { params: Promise<{ id: string }> };

async function loadAccessibleLead(id: string, user: User) {
  const lead = await getLead(id);
  if (!lead) throw new HttpError(404, "Заявка не найдена");
  if (!canAccessLead(user, lead)) throw new HttpError(403, "Нет доступа к этой заявке");
  return lead;
}

export const GET = route<Context>(async (_request, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  return NextResponse.json({ lead: await loadAccessibleLead(id, user) });
});

/** Изменить статус / назначение / сумму / заметки. admin — любую заявку, manager — только свою. */
export const PATCH = route<Context>(async (request, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const lead = await loadAccessibleLead(id, user);
  const body = await readJson(request);

  const patch: UpdateLeadInput = {};
  if (has(body, "status")) patch.status = readEnum(body.status, LEAD_STATUSES, "Статус");
  if (has(body, "value")) patch.value = readMoney(body.value);
  if (has(body, "notes")) patch.notes = readString(body.notes, { label: "Заметки", max: 10000 });
  if (has(body, "append_note")) patch.appendNote = readString(body.append_note, { label: "Заметка", max: 2000 });
  if (has(body, "assigned_to")) {
    if (user.role !== "admin") throw new HttpError(403, "Переназначать заявки может только администратор");
    const assignedTo = readId(body.assigned_to, "assigned_to");
    if (assignedTo && !(await isActiveUser(assignedTo))) {
      throw new HttpError(400, "Сотрудник не найден или деактивирован");
    }
    patch.assignedTo = assignedTo;
  }

  return NextResponse.json({ lead: await updateLead(lead, patch) });
});
