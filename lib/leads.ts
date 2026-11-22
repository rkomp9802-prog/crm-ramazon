import { randomUUID } from "node:crypto";
import type { InStatement, InValue, Row } from "@libsql/client";
import { getDb, numOrNull, str, strOrNull } from "@/lib/turso";
import { HttpError } from "@/lib/errors";
import { clientInsertStatement, getClient, type ClientInput } from "@/lib/clients";
import type { Lead, LeadSource, LeadStatus, LeadWithClient, User } from "@/types/crm.types";

const LEAD_SELECT = `
  select l.id, l.client_id, l.source, l.status, l.assigned_to, l.value, l.notes,
         l.created_at, l.updated_at, l.closed_at,
         c.name as client_name, c.phone as client_phone, u.name as assignee_name
  from leads l
  join clients c on c.id = l.client_id
  left join users u on u.id = l.assigned_to`;

const CLOSED_STATUSES: readonly LeadStatus[] = ["won", "lost"];

export function isClosedStatus(status: LeadStatus): boolean {
  return CLOSED_STATUSES.includes(status);
}

export function rowToLead(row: Row): LeadWithClient {
  return {
    id: str(row.id),
    client_id: str(row.client_id),
    source: str(row.source) as LeadSource,
    status: str(row.status) as LeadStatus,
    assigned_to: strOrNull(row.assigned_to),
    value: numOrNull(row.value),
    notes: strOrNull(row.notes),
    created_at: str(row.created_at),
    updated_at: str(row.updated_at),
    closed_at: strOrNull(row.closed_at),
    client_name: str(row.client_name),
    client_phone: str(row.client_phone),
    assignee_name: strOrNull(row.assignee_name),
  };
}

/** admin — любую заявку, manager — только назначенную на него. */
export function canAccessLead(user: User, lead: Pick<Lead, "assigned_to">): boolean {
  return user.role === "admin" || lead.assigned_to === user.id;
}

export async function listLeads(user: User, options: { clientId?: string } = {}): Promise<LeadWithClient[]> {
  const conditions: string[] = [];
  const args: InValue[] = [];
  if (user.role !== "admin") {
    conditions.push("l.assigned_to = ?");
    args.push(user.id);
  }
  if (options.clientId) {
    conditions.push("l.client_id = ?");
    args.push(options.clientId);
  }
  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
  const rs = await getDb().execute({ sql: `${LEAD_SELECT} ${where} order by l.updated_at desc`, args });
  return rs.rows.map(rowToLead);
}

export async function getLead(id: string): Promise<LeadWithClient | null> {
  const rs = await getDb().execute({ sql: `${LEAD_SELECT} where l.id = ?`, args: [id] });
  return rs.rows[0] ? rowToLead(rs.rows[0]) : null;
}

export interface CreateLeadInput {
  clientId: string | null;
  newClient: ClientInput | null;
  source: LeadSource;
  status: LeadStatus;
  assignedTo: string | null;
  value: number | null;
  notes: string | null;
}

/** Создаёт заявку; если передан newClient — клиента и заявку в одной транзакции. */
export async function createLead(input: CreateLeadInput): Promise<LeadWithClient> {
  const now = new Date().toISOString();
  const statements: InStatement[] = [];

  let clientId = input.clientId;
  if (input.newClient) {
    clientId = randomUUID();
    statements.push(clientInsertStatement(clientId, input.newClient, now));
  } else if (!clientId || !(await getClient(clientId))) {
    throw new HttpError(400, "Клиент не найден");
  }

  const leadId = randomUUID();
  statements.push({
    sql: `insert into leads (id, client_id, source, status, assigned_to, value, notes, created_at, updated_at, closed_at)
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      leadId,
      clientId,
      input.source,
      input.status,
      input.assignedTo,
      input.value,
      input.notes,
      now,
      now,
      isClosedStatus(input.status) ? now : null,
    ],
  });

  await getDb().batch(statements, "write");
  return (await getLead(leadId)) as LeadWithClient;
}

export interface UpdateLeadInput {
  status?: LeadStatus;
  assignedTo?: string | null;
  value?: number | null;
  notes?: string | null;
  /** Дописать строку в конец заметок (например, причину отказа). */
  appendNote?: string | null;
}

export async function updateLead(lead: Lead, patch: UpdateLeadInput): Promise<LeadWithClient> {
  const now = new Date().toISOString();
  const sets: string[] = [];
  const args: InValue[] = [];

  if (patch.status !== undefined && patch.status !== lead.status) {
    sets.push("status = ?", "closed_at = ?");
    args.push(patch.status, isClosedStatus(patch.status) ? now : null);
  }
  if (patch.assignedTo !== undefined) {
    sets.push("assigned_to = ?");
    args.push(patch.assignedTo);
  }
  if (patch.value !== undefined) {
    sets.push("value = ?");
    args.push(patch.value);
  }

  if (patch.notes !== undefined) {
    const notes = patch.appendNote ? [patch.notes, patch.appendNote].filter(Boolean).join("\n") : patch.notes;
    sets.push("notes = ?");
    args.push(notes || null);
  } else if (patch.appendNote) {
    // Дописываем на стороне БД, чтобы не затереть параллельную правку заметок.
    sets.push("notes = case when coalesce(notes, '') = '' then ? else notes || char(10) || ? end");
    args.push(patch.appendNote, patch.appendNote);
  }

  if (sets.length) {
    sets.push("updated_at = ?");
    args.push(now);
    await getDb().execute({ sql: `update leads set ${sets.join(", ")} where id = ?`, args: [...args, lead.id] });
  }
  return (await getLead(lead.id)) as LeadWithClient;
}
