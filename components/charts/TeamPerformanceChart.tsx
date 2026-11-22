"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, ChartEmpty, GRID_COLOR, TOOLTIP_STYLE } from "@/components/charts/shared";
import { STATUS_COLORS } from "@/lib/labels";

const REST_COLOR = "#c9d3e6";

export function TeamPerformanceChart({
  data,
}: {
  data: { userId: string; userName: string; won: number; total: number }[];
}) {
  if (!data.some((item) => item.total > 0)) return <ChartEmpty />;
  const rows = data.map((item) => ({ ...item, rest: item.total - item.won }));
  const height = Math.max(160, rows.length * 44 + 32);

  return (
    <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
      <div>
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID_COLOR} horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="userName" tick={AXIS_TICK} tickLine={false} axisLine={false} width={130} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: "#f5f6f8" }}
                formatter={(value, name) => [String(value), String(name)]}
              />
              <Bar dataKey="won" name="Успешно" stackId="leads" fill={STATUS_COLORS.won} barSize={18} />
              <Bar dataKey="rest" name="Остальные" stackId="leads" fill={REST_COLOR} radius={[0, 4, 4, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ backgroundColor: STATUS_COLORS.won }} aria-hidden />
            Успешно
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ backgroundColor: REST_COLOR }} aria-hidden />
            Остальные заявки
          </span>
        </div>
      </div>

      <table className="w-full self-start text-sm">
        <thead className="border-b border-line text-left text-xs text-muted">
          <tr>
            <th className="py-2 font-medium">Сотрудник</th>
            <th className="py-2 text-right font-medium">Заявок</th>
            <th className="py-2 text-right font-medium">Успешно</th>
            <th className="py-2 text-right font-medium">Доля</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {data.map((item) => (
            <tr key={item.userId}>
              <td className="py-2">{item.userName}</td>
              <td className="py-2 text-right tabular-nums">{item.total}</td>
              <td className="py-2 text-right tabular-nums">{item.won}</td>
              <td className="py-2 text-right text-muted tabular-nums">
                {item.total ? `${Math.round((item.won / item.total) * 100)}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
