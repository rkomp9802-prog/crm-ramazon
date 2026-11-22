import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getAnalytics, parsePeriod, PERIOD_LABELS } from "@/lib/analytics";
import { formatDays } from "@/lib/format";
import { Card, PageHeader } from "@/components/ui/Layout";
import { LeadsOverTimeChart } from "@/components/charts/LeadsOverTimeChart";
import { StatusBreakdownChart } from "@/components/charts/StatusBreakdownChart";
import { SourceBreakdownChart } from "@/components/charts/SourceBreakdownChart";
import { TeamPerformanceChart } from "@/components/charts/TeamPerformanceChart";
import type { AnalyticsPeriod } from "@/types/crm.types";

export const metadata: Metadata = { title: "Дашборд" };

const PERIODS: AnalyticsPeriod[] = ["7", "30", "90", "all"];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const user = await requireUser();
  const period = parsePeriod((await searchParams).period);
  const data = await getAnalytics(user, period);
  const isAdmin = user.role === "admin";

  const won = data.statusBreakdown.find((item) => item.status === "won")?.count ?? 0;
  const lost = data.statusBreakdown.find((item) => item.status === "lost")?.count ?? 0;

  return (
    <>
      <PageHeader
        title="Дашборд"
        description={isAdmin ? "Показатели всей команды" : "Показатели по вашим заявкам"}
        actions={<PeriodPicker current={period} />}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Заявок за период" value={String(data.totalLeads)} />
        <Metric
          label="Конверсия"
          value={`${String(data.conversionRate).replace(".", ",")}%`}
          hint={won + lost > 0 ? `${won} успешных из ${won + lost} закрытых` : "закрытых заявок пока нет"}
        />
        <Metric
          label="Среднее время закрытия"
          value={formatDays(data.avgCloseDays)}
          hint="от создания до «Успешно» или «Отказ»"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Заявки по времени" className="lg:col-span-2">
          <LeadsOverTimeChart data={data.leadsOverTime} granularity={data.granularity} />
        </Card>
        <Card title="Статусы">
          <StatusBreakdownChart data={data.statusBreakdown} />
        </Card>
        <Card title="Источники">
          <SourceBreakdownChart data={data.sourceBreakdown} />
        </Card>
        {isAdmin && data.teamPerformance ? (
          <Card title="Сотрудники" className="lg:col-span-2">
            <TeamPerformanceChart data={data.teamPerformance} />
          </Card>
        ) : null}
      </div>
    </>
  );
}

function PeriodPicker({ current }: { current: AnalyticsPeriod }) {
  return (
    <nav aria-label="Период" className="inline-flex rounded-md border border-line bg-surface p-0.5">
      {PERIODS.map((period) => (
        <Link
          key={period}
          href={period === "30" ? "/dashboard" : `/dashboard?period=${period}`}
          aria-current={period === current ? "page" : undefined}
          className={`rounded px-3 py-1.5 text-sm transition-colors ${
            period === current ? "bg-accent-soft font-medium text-accent-strong" : "text-muted hover:text-ink"
          }`}
        >
          {PERIOD_LABELS[period]}
        </Link>
      ))}
    </nav>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-5">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}
