import { NextResponse } from "next/server";
import { assertAdmin, HttpError, readJson, requireApiUser, route } from "@/lib/http";
import { has, readBoolean, readEmail, readEnum, readId, readNewPassword, readRequiredString } from "@/lib/validation";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth";
import { createUser, getUserById, listUsers, updateUser, type UpdateUserInput } from "@/lib/users";
import { USER_ROLES } from "@/types/crm.types";

// Только admin. proxy.ts уже отсекает по роли из JWT, здесь — повторная проверка по роли из БД.

export const GET = route(async () => {
  assertAdmin(await requireApiUser());
  return NextResponse.json({ users: await listUsers() });
});

export const POST = route(async (request) => {
  assertAdmin(await requireApiUser());
  const body = await readJson(request);
  const user = await createUser({
    name: readRequiredString(body.name, { label: "Имя", max: 100 }),
    email: readEmail(body.email, true) as string,
    role: body.role === undefined ? "manager" : readEnum(body.role, USER_ROLES, "Роль"),
    password: readNewPassword(body.password, MIN_PASSWORD_LENGTH),
  });
  return NextResponse.json({ user }, { status: 201 });
});

/** { id, name?, email?, role?, is_active?, password? } — сотрудников не удаляем, только деактивируем. */
export const PATCH = route(async (request) => {
  const admin = await requireApiUser();
  assertAdmin(admin);
  const body = await readJson(request);

  const id = readId(body.id, "id");
  if (!id) throw new HttpError(400, "Не указан сотрудник");
  if (!(await getUserById(id))) throw new HttpError(404, "Сотрудник не найден");

  const patch: UpdateUserInput = {};
  if (has(body, "name")) patch.name = readRequiredString(body.name, { label: "Имя", max: 100 });
  if (has(body, "email")) patch.email = readEmail(body.email, true) as string;
  if (has(body, "role")) patch.role = readEnum(body.role, USER_ROLES, "Роль");
  if (has(body, "is_active")) patch.is_active = readBoolean(body.is_active, "Активен");
  if (has(body, "password")) patch.password = readNewPassword(body.password, MIN_PASSWORD_LENGTH);

  // Не даём администратору случайно запереть самого себя.
  if (id === admin.id && (patch.role === "manager" || patch.is_active === false)) {
    throw new HttpError(400, "Нельзя снять с себя роль администратора или деактивировать себя");
  }

  return NextResponse.json({ user: await updateUser(id, patch) });
});
