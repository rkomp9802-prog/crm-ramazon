import type { LeadSource, LeadStatus, UserRole } from "@/types/crm.types";

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  waiting: "Ожидание",
  won: "Успешно",
  lost: "Отказ",
};

export const SOURCE_LABELS: Record<LeadSource, string> = {
  website_form: "Форма на сайте",
  telegram_bot: "Telegram-бот",
  phone: "Телефон",
  referral: "Рекомендация",
  manual: "Вручную",
  other: "Другое",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Администратор",
  manager: "Менеджер",
};

/** Цвета статусов для графиков (hex — recharts не понимает классы Tailwind). */
export const STATUS_COLORS: Record<LeadStatus, string> = {
  new: "#64748b",
  in_progress: "#2d5bd8",
  waiting: "#d08a12",
  won: "#1f9d55",
  lost: "#d64545",
};

export const STATUS_BADGE_CLASSES: Record<LeadStatus, string> = {
  new: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-50 text-blue-700",
  waiting: "bg-amber-50 text-amber-800",
  won: "bg-green-50 text-green-700",
  lost: "bg-red-50 text-red-700",
};

export const STATUS_DOT_CLASSES: Record<LeadStatus, string> = {
  new: "bg-slate-400",
  in_progress: "bg-blue-600",
  waiting: "bg-amber-500",
  won: "bg-green-600",
  lost: "bg-red-500",
};
