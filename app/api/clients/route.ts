import { NextResponse } from "next/server";
import { readJson, requireApiUser, route } from "@/lib/http";
import { insertClient, listClients, parseClientInput } from "@/lib/clients";

export const GET = route(async (request) => {
  const user = await requireApiUser();
  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? 100);
  const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 200) : 100;
  const clients = await listClients(user, url.searchParams.get("q"), limit);
  return NextResponse.json({ clients });
});

export const POST = route(async (request) => {
  await requireApiUser();
  const client = await insertClient(parseClientInput(await readJson(request)));
  return NextResponse.json({ client }, { status: 201 });
});
