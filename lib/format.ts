// Форматирование без зависимости от часового пояса браузера —
// одинаковый результат на сервере и клиенте (нет ошибок гидрации).

/** "2026-11-23" или ISO-время → "23.11.2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return iso;
  return `${day}.${month}.${year}`;
}

/** "2026-11-23" → "23.11" */
export function formatShortDate(iso: string): string {
  const [, month, day] = iso.slice(0, 10).split("-");
  return `${day}.${month}`;
}

const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

/** "2026-11-01" → "ноя 2026" */
export function formatMonth(iso: string): string {
  const [year, month] = iso.split("-");
  return `${MONTHS[Number(month) - 1] ?? month} ${year}`;
}

const moneyFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

export function formatMoney(value: number | null | undefined): string {
  if (value == null) return "—";
  return moneyFormatter.format(value);
}

export function formatDays(days: number | null): string {
  if (days == null) return "—";
  if (days < 1) return "меньше дня";
  const rounded = Math.round(days * 10) / 10;
  return `${String(rounded).replace(".", ",")} дн.`;
}
