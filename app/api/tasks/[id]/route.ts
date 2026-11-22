import { NextResponse } from "next/server";
import { HttpError, readJson, requireApiUser, route } from "@/lib/http";
import { has, readDate, readEnum, readId, readRequiredString } from "@/lib/validation";
import { canEditTask, getTask, updateTask, type UpdateTaskInput } from "@/lib/tasks";
import { isActiveUser } from "@/lib/users";
import { TASK_STATUSES } from "@/types/crm.types";

type Context = { params: Promise<{ id: string }> };

/** Изменить статус/срок/название. Владелец задачи или admin; переназначить — только admin. */
export const PATCH = route<Context>(async (request, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const task = await getTask(id);
  if (!task) throw new HttpError(404, "Задача не найдена");
  if (!canEditTask(user, task)) throw new HttpError(403, "Нет доступа к этой задаче");

  const body = await readJson(request);
  const patch: UpdateTaskInput = {};
  if (has(body, "title")) patch.title = readRequiredString(body.title, { label: "Задача", max: 300 });
  if (has(body, "due_date")) patch.dueDate = readDate(body.due_date, "Срок");
  if (has(body, "status")) patch.status = readEnum(body.status, TASK_STATUSES, "Статус");
  if (has(body, "assigned_to")) {
    if (user.role !== "admin") throw new HttpError(403, "Переназначать задачи может только администратор");
    const assignedTo = readId(body.assigned_to, "assigned_to");
    if (!assignedTo || !(await isActiveUser(assignedTo))) {
      throw new HttpError(400, "Сотрудник не найден или деактивирован");
    }
    patch.assignedTo = assignedTo;
  }

  return NextResponse.json({ task: await updateTask(id, patch) });
});
