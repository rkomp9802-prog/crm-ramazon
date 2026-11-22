import { randomUUID } from "node:crypto";
import type { InValue, Row } from "@libsql/client";
import { getDb, str, strOrNull } from "@/lib/turso";
import type { Task, TaskStatus, TaskWithContext, User } from "@/types/crm.types";

const TASK_SELECT = `
  select t.id, t.lead_id, t.client_id, t.assigned_to, t.title, t.due_date, t.status, t.created_at,
         u.name as assignee_name,
         coalesce(c.name, lc.name) as client_name
  from tasks t
  left join users u on u.id = t.assigned_to
  left join clients c on c.id = t.client_id
  left join leads l on l.id = t.lead_id
  left join clients lc on lc.id = l.client_id`;

const TASK_ORDER = `
  order by case when t.status = 'pending' then 0 else 1 end,
           case when t.due_date is null then 1 else 0 end,
           t.due_date,
           t.created_at desc`;

export function rowToTask(row: Row): TaskWithContext {
  return {
    id: str(row.id),
    lead_id: strOrNull(row.lead_id),
    client_id: strOrNull(row.client_id),
    assigned_to: str(row.assigned_to),
    title: str(row.title),
    due_date: strOrNull(row.due_date),
    status: row.status === "done" ? "done" : "pending",
    created_at: str(row.created_at),
    assignee_name: strOrNull(row.assignee_name),
    client_name: strOrNull(row.client_name),
  };
}

export function canEditTask(user: User, task: Pick<Task, "assigned_to">): boolean {
  return user.role === "admin" || task.assigned_to === user.id;
}

export interface TaskFilters {
  /** "all" учитывается только для admin; manager всегда видит только свои задачи. */
  scope?: "mine" | "all";
  leadId?: string;
  clientId?: string;
}

export async function listTasks(user: User, filters: TaskFilters = {}): Promise<TaskWithContext[]> {
  const conditions: string[] = [];
  const args: InValue[] = [];
  if (user.role !== "admin" || filters.scope !== "all") {
    conditions.push("t.assigned_to = ?");
    args.push(user.id);
  }
  if (filters.leadId) {
    conditions.push("t.lead_id = ?");
    args.push(filters.leadId);
  }
  if (filters.clientId) {
    conditions.push("(t.client_id = ? or l.client_id = ?)");
    args.push(filters.clientId, filters.clientId);
  }
  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
  const rs = await getDb().execute({ sql: `${TASK_SELECT} ${where} ${TASK_ORDER}`, args });
  return rs.rows.map(rowToTask);
}

export async function getTask(id: string): Promise<TaskWithContext | null> {
  const rs = await getDb().execute({ sql: `${TASK_SELECT} where t.id = ?`, args: [id] });
  return rs.rows[0] ? rowToTask(rs.rows[0]) : null;
}

export interface CreateTaskInput {
  leadId: string | null;
  clientId: string | null;
  assignedTo: string;
  title: string;
  dueDate: string | null;
}

export async function createTask(input: CreateTaskInput): Promise<TaskWithContext> {
  const id = randomUUID();
  await getDb().execute({
    sql: `insert into tasks (id, lead_id, client_id, assigned_to, title, due_date, status, created_at)
          values (?, ?, ?, ?, ?, ?, 'pending', ?)`,
    args: [id, input.leadId, input.clientId, input.assignedTo, input.title, input.dueDate, new Date().toISOString()],
  });
  return (await getTask(id)) as TaskWithContext;
}

export interface UpdateTaskInput {
  title?: string;
  dueDate?: string | null;
  status?: TaskStatus;
  assignedTo?: string;
}

export async function updateTask(id: string, patch: UpdateTaskInput): Promise<TaskWithContext> {
  const sets: string[] = [];
  const args: InValue[] = [];
  if (patch.title !== undefined) {
    sets.push("title = ?");
    args.push(patch.title);
  }
  if (patch.dueDate !== undefined) {
    sets.push("due_date = ?");
    args.push(patch.dueDate);
  }
  if (patch.status !== undefined) {
    sets.push("status = ?");
    args.push(patch.status);
  }
  if (patch.assignedTo !== undefined) {
    sets.push("assigned_to = ?");
    args.push(patch.assignedTo);
  }
  if (sets.length) {
    await getDb().execute({ sql: `update tasks set ${sets.join(", ")} where id = ?`, args: [...args, id] });
  }
  return (await getTask(id)) as TaskWithContext;
}

/** Просроченные невыполненные задачи: admin — все, manager — свои. */
export async function countOverdueTasks(user: User, today: string): Promise<number> {
  const args: InValue[] = [today];
  let filter = "";
  if (user.role !== "admin") {
    filter = "and assigned_to = ?";
    args.push(user.id);
  }
  const rs = await getDb().execute({
    sql: `select count(*) as n from tasks where status = 'pending' and due_date is not null and due_date < ? ${filter}`,
    args,
  });
  return Number(rs.rows[0]?.n ?? 0);
}
