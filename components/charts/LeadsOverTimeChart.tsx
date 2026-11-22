"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ACCENT, AXIS_TICK, ChartEmpty, GRID_COLOR, TOOLTIP_STYLE } from "@/components/charts/shared";
import { formatDate, formatMonth, formatShortDate } from "@/lib/format";
import type { AnalyticsGranularity } from "@/types/crm.types";

function axisLabel(date: string, granularity: AnalyticsGranularity): string {
  return granularity === "month" ? formatMonth(date) : formatShortDate(date);
}

function tooltipLabel(date: string, granularity: AnalyticsGranularity): string {
  if (granularity === "day") return formatDate(date);
  if (granularity === "week") return `Неделя с ${formatDate(date)}`;
  return formatMonth(date);
}

export function LeadsOverTimeChart({
  data,
  granularity,
}: {
  data: { date: string; count: number }[];
  granularity: AnalyticsGranularity;
}) {
  if (!data.some((point) => point.count > 0)) return <ChartEmpty />;
  const rows = data.map((point) => ({ ...point, label: axisLabel(point.date, granularity) }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID_COLOR} vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_COLOR }} minTickGap={24} />
          <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={32} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value) => [String(value), "Заявок"]}
            labelFormatter={(_label, payload) => {
              const date = payload?.[0]?.payload?.date as string | undefined;
              return date ? tooltipLabel(date, granularity) : "";
            }}
          />
          <Line type="monotone" dataKey="count" stroke={ACCENT} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
