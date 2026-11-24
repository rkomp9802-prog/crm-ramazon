export type UserRole = "admin" | "manager";
export const USER_ROLES = ["admin", "manager"] as const satisfies readonly UserRole[];

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
  is_active: boolean;
  /** Пароль выдан администратором — при входе сотрудник обязан задать свой. */
  must_change_password: boolean;
}

/** Короткая запись сотрудника для выпадающих списков. */
export type UserOption = Pick<User, "id" | "name">;

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  created_at: string;
}

export interface ClientListItem extends Client {
  leads_count: number;
}

export type ClientSummary = Pick<Client, "id" | "name" | "phone">;

export type LeadStatus = "new" | "in_progress" | "waiting" | "won" | "lost";
export const LEAD_STATUSES = ["new", "in_progress", "waiting", "won", "lost"] as const satisfies readonly LeadStatus[];

export type LeadSource = "website_form" | "telegram_bot" | "phone" | "referral" | "manual" | "other";
export const LEAD_SOURCES = [
  "website_form",
  "telegram_bot",
  "phone",
  "referral",
  "manual",
  "other",
] as const satisfies readonly LeadSource[];

export interface Lead {
  id: string;
  client_id: string;
  source: LeadSource;
  status: LeadStatus;
  assigned_to: string | null; // user.id
  value: number | null; // потенциальная сумма сделки, опционально
  notes: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null; // когда заявка перешла в won/lost — для «среднего времени закрытия»
}

/** Заявка вместе с данными клиента и назначенного сотрудника (для списков и карточек). */
export interface LeadWithClient extends Lead {
  client_name: string;
  client_phone: string;
  assignee_name: string | null;
}

export type TaskStatus = "pending" | "done";
export const TASK_STATUSES = ["pending", "done"] as const satisfies readonly TaskStatus[];

export interface Task {
  id: string;
  lead_id: string | null; // задача может быть привязана к заявке...
  client_id: string | null; // ...или к клиенту напрямую
  assigned_to: string; // user.id
  title: string;
  due_date: string | null; // YYYY-MM-DD
  status: TaskStatus;
  created_at: string;
}

export interface TaskWithContext extends Task {
  assignee_name: string | null;
  client_name: string | null;
}

export type AnalyticsPeriod = "7" | "30" | "90" | "all";
export type AnalyticsGranularity = "day" | "week" | "month";

export interface AnalyticsResponse {
  period: AnalyticsPeriod;
  granularity: AnalyticsGranularity;
  totalLeads: number;
  avgCloseDays: number | null;
  leadsOverTime: { date: string; count: number }[]; // для линейного графика
  statusBreakdown: { status: LeadStatus; count: number }[]; // для круговой диаграммы
  sourceBreakdown: { source: LeadSource; count: number }[]; // для столбчатой диаграммы
  conversionRate: number; // won / (won + lost), в процентах
  teamPerformance?: { userId: string; userName: string; won: number; total: number }[]; // только для admin
}
