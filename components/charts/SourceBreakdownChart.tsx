"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ACCENT, AXIS_TICK, ChartEmpty, GRID_COLOR, TOOLTIP_STYLE } from "@/components/charts/shared";
import { SOURCE_LABELS } from "@/lib/labels";
import type { LeadSource } from "@/types/crm.types";

export function SourceBreakdownChart({ data }: { data: { source: LeadSource; count: number }[] }) {
  if (!data.length) return <ChartEmpty />;
  const rows = data.map((item) => ({ ...item, label: SOURCE_LABELS[item.source] }));
  const height = Math.max(160, rows.length * 40 + 32);

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID_COLOR} horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} width={120} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#f5f6f8" }} formatter={(value) => [String(value), "Заявок"]} />
          <Bar dataKey="count" fill={ACCENT} radius={[0, 4, 4, 0]} barSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
