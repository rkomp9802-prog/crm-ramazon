import { NextResponse } from "next/server";
import { requireApiUser, route } from "@/lib/http";
import { getAnalytics, parsePeriod } from "@/lib/analytics";

/** Все агрегаты дашборда одним запросом. ?period=7|30|90|all. Для manager — только его заявки. */
export const GET = route(async (request) => {
  const user = await requireApiUser();
  const period = parsePeriod(new URL(request.url).searchParams.get("period"));
  return NextResponse.json(await getAnalytics(user, period));
});
