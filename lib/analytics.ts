import type { InValue } from "@libsql/client";
import { getDb, str } from "@/lib/turso";
import { daysBetween, shiftDate, utcToday } from "@/lib/dates";
import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  type AnalyticsGranularity,
  type AnalyticsPeriod,
  type AnalyticsResponse,
  type LeadSource,
  type LeadStatus,
  type User,
} from "@/types/crm.types";

const PERIOD_DAYS: Record<AnalyticsPeriod, number | null> = { "7": 7, "30": 30, "90": 90, all: null };

export const PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  "7": "7 дней",
  "30": "30 дней",
  "90": "90 дней",
  all: "Всё время",
};

export function parsePeriod(value: unknown): AnalyticsPeriod {
  return value === "7" || value === "90" || value === "all" ? value : "30";
}

function pickGranularity(spanDays: number): AnalyticsGranularity {
  if (spanDays <= 31) return "day";
  if (spanDays <= 210) return "week";
  return "month";
}

/** Начало корзины для даты YYYY-MM-DD: сам день, понедельник недели или 1-е число месяца. */
function bucketStart(isoDate: string, granularity: AnalyticsGranularity): string {
  if (granularity === "day") return isoDate;
  if (granularity === "month") return `${isoDate.slice(0, 7)}-01`;
  const weekday = new Date(`${isoDate}T00:00:00Z`).getUTCDay(); // 0 = воскресенье
  return shiftDate(isoDate, -((weekday + 6) % 7));
}

function nextBucket(isoDate: string, granularity: AnalyticsGranularity): string {
  if (granularity === "day") return shiftDate(isoDate, 1);
  if (granularity === "week") return shiftDate(isoDate, 7);
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Все агрегаты для дашборда одним батчем запросов.
 * manager — только его заявки (assigned_to), teamPerformance не отдаётся вовсе.
 */
export async function getAnalytics(user: User, period: AnalyticsPeriod): Promise<AnalyticsResponse> {
  const days = PERIOD_DAYS[period];
  const today = utcToday();
  const sinceDate = days ? shiftDate(today, -(days - 1)) : null;
  const since = sinceDate ? `${sinceDate}T00:00:00.000Z` : null;
  const isAdmin = user.role === "admin";

  const scope: string[] = [];
  const scopeArgs: InValue[] = [];
  if (since) {
    scope.push("created_at >= ?");
    scopeArgs.push(since);
  }
  if (!isAdmin) {
    scope.push("assigned_to = ?");
    scopeArgs.push(user.id);
  }
  const where = scope.length ? `where ${scope.join(" and ")}` : "";

  const closeScope = ["closed_at is not null", "status in ('won', 'lost')"];
  const closeArgs: InValue[] = [];
  if (since) {
    closeScope.push("closed_at >= ?");
    closeArgs.push(since);
  }
  if (!isAdmin) {
    closeScope.push("assigned_to = ?");
    closeArgs.push(user.id);
  }

  const statements = [
    { sql: `select status, count(*) as n from leads ${where} group by status`, args: scopeArgs },
    { sql: `select source, count(*) as n from leads ${where} group by source`, args: scopeArgs },
    {
      sql: `select substr(created_at, 1, 10) as day, count(*) as n from leads ${where} group by day order by day`,
      args: scopeArgs,
    },
    {
      sql: `select avg(julianday(closed_at) - julianday(created_at)) as avg_days
            from leads where ${closeScope.join(" and ")}`,
      args: closeArgs,
    },
  ];
  if (isAdmin) {
    statements.push({
      sql: `select u.id, u.name,
                   coalesce(sum(case when l.status = 'won' then 1 else 0 end), 0) as won,
                   count(l.id) as total
            from users u
            left join leads l on l.assigned_to = u.id ${since ? "and l.created_at >= ?" : ""}
            group by u.id, u.name
            having u.is_active = 1 or count(l.id) > 0
            order by won desc, total desc, u.name`,
      args: since ? [since] : [],
    });
  }

  const [statusRs, sourceRs, dayRs, closeRs, teamRs] = await getDb().batch(statements, "read");

  const statusCounts = new Map<string, number>(statusRs.rows.map((r) => [str(r.status), Number(r.n)]));
  const statusBreakdown = LEAD_STATUSES.map((status: LeadStatus) => ({ status, count: statusCounts.get(status) ?? 0 }));
  const totalLeads = statusBreakdown.reduce((sum, item) => sum + item.count, 0);

  const sourceCounts = new Map<string, number>(sourceRs.rows.map((r) => [str(r.source), Number(r.n)]));
  const sourceBreakdown = LEAD_SOURCES.map((source: LeadSource) => ({ source, count: sourceCounts.get(source) ?? 0 }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);

  const won = statusCounts.get("won") ?? 0;
  const lost = statusCounts.get("lost") ?? 0;
  const conversionRate = won + lost > 0 ? Math.round((won / (won + lost)) * 1000) / 10 : 0;

  const avgRaw = closeRs.rows[0]?.avg_days;
  const avgCloseDays = avgRaw == null ? null : Number(avgRaw);

  // Линия по времени: заполняем пустые дни/недели нулями.
  const dayCounts = dayRs.rows.map((r) => ({ day: str(r.day), count: Number(r.n) }));
  const startDate = sinceDate ?? dayCounts[0]?.day ?? today;
  const granularity = pickGranularity(daysBetween(startDate, today) + 1);
  const buckets = new Map<string, number>();
  for (let cursor = bucketStart(startDate, granularity); cursor <= today; cursor = nextBucket(cursor, granularity)) {
    buckets.set(cursor, 0);
  }
  for (const { day, count } of dayCounts) {
    const key = bucketStart(day, granularity);
    buckets.set(key, (buckets.get(key) ?? 0) + count);
  }
  const leadsOverTime = [...buckets.entries()].map(([date, count]) => ({ date, count }));

  const response: AnalyticsResponse = {
    period,
    granularity,
    totalLeads,
    avgCloseDays,
    leadsOverTime,
    statusBreakdown,
    sourceBreakdown,
    conversionRate,
  };

  if (isAdmin && teamRs) {
    response.teamPerformance = teamRs.rows.map((r) => ({
      userId: str(r.id),
      userName: str(r.name),
      won: Number(r.won),
      total: Number(r.total),
    }));
  }

  return response;
}
