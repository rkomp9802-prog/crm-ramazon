import { NextResponse } from "next/server";
import { HttpError, readJson, requireApiUser, route } from "@/lib/http";
import { getClient, parseClientPatch, updateClientRecord } from "@/lib/clients";
import { listLeads } from "@/lib/leads";

type Context = { params: Promise<{ id: string }> };

/** Карточка клиента + история заявок (manager видит только свои заявки этого клиента). */
export const GET = route<Context>(async (_request, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const client = await getClient(id);
  if (!client) throw new HttpError(404, "Клиент не найден");
  const leads = await listLeads(user, { clientId: id });
  return NextResponse.json({ client, leads });
});

/** Правка контактов. Справочник клиентов общий — править может любой сотрудник. */
export const PATCH = route<Context>(async (request, { params }) => {
  await requireApiUser();
  const { id } = await params;
  const patch = parseClientPatch(await readJson(request));
  return NextResponse.json({ client: await updateClientRecord(id, patch) });
});
