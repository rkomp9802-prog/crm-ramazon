// Общие настройки графиков recharts (цвета — hex, классы Tailwind recharts не понимает).

export const AXIS_TICK = { fontSize: 12, fill: "#626a77" };
export const GRID_COLOR = "#e2e5ea";
export const ACCENT = "#2d5bd8";

export const TOOLTIP_STYLE = {
  borderRadius: 8,
  border: "1px solid #e2e5ea",
  boxShadow: "0 4px 12px rgb(0 0 0 / 0.06)",
  fontSize: 13,
};

export function ChartEmpty({ text = "Нет данных за выбранный период" }: { text?: string }) {
  return <div className="flex h-48 items-center justify-center text-sm text-muted">{text}</div>;
}
