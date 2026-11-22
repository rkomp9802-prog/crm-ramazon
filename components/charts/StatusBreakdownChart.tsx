"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartEmpty, TOOLTIP_STYLE } from "@/components/charts/shared";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/labels";
import type { LeadStatus } from "@/types/crm.types";

export function StatusBreakdownChart({ data }: { data: { status: LeadStatus; count: number }[] }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  if (!total) return <ChartEmpty />;
  const rows = data.filter((item) => item.count > 0).map((item) => ({ ...item, label: STATUS_LABELS[item.status] }));

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="h-52 w-full sm:w-1/2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="count" nameKey="label" innerRadius="58%" outerRadius="90%" paddingAngle={1} stroke="#fff">
              {rows.map((row) => (
                <Cell key={row.status} fill={STATUS_COLORS[row.status]} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value, name) => [String(value), String(name)]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full space-y-2.5 sm:w-1/2">
        {data.map((item) => (
          <li key={item.status} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-sm" style={{ backgroundColor: STATUS_COLORS[item.status] }} aria-hidden />
              {STATUS_LABELS[item.status]}
            </span>
            <span className="text-muted tabular-nums">
              {item.count} · {Math.round((item.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
