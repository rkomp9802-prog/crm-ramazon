import { randomUUID } from "node:crypto";
import type { InStatement, Row } from "@libsql/client";
import { getDb, likePattern, str, strOrNull } from "@/lib/turso";
import { HttpError } from "@/lib/errors";
import { has, readEmail, readPhone, readRequiredString, readString } from "@/lib/validation";
import type { Client, ClientListItem, User } from "@/types/crm.types";

const CLIENT_COLUMNS = "c.id, c.name, c.phone, c.email, c.notes, c.created_at";

export interface ClientInput {
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
}

export function rowToClient(row: Row): Client {
  return {
    id: str(row.id),
    name: str(row.name),
    phone: str(row.phone),
    email: strOrNull(row.email),
    notes: strOrNull(row.notes),
    created_at: str(row.created_at),
  };
}

function digitsOnly(text: string): string {
  return text.replace(/\D/g, "");
}

/** Текст для поиска: в нижнем регистре + телефон только цифрами («+998 90 123» ищется и как «99890123»). */
export function buildClientSearch(input: Pick<ClientInput, "name" | "phone" | "email">): string {
  return [input.name.toLowerCase(), input.phone.toLowerCase(), digitsOnly(input.phone), (input.email ?? "").toLowerCase()]
    .filter(Boolean)
    .join(" ");
}

export function parseClientInput(body: Record<string, unknown>): ClientInput {
  return {
    name: readRequiredString(body.name, { label: "Имя", max: 200 }),
    phone: readPhone(body.phone),
    email: readEmail(body.email),
    notes: readString(body.notes, { label: "Заметки", max: 5000 }),
  };
}

export function parseClientPatch(body: Record<string, unknown>): Partial<ClientInput> {
  const patch: Partial<ClientInput> = {};
  if (has(body, "name")) patch.name = readRequiredString(body.name, { label: "Имя", max: 200 });
  if (has(body, "phone")) patch.phone = readPhone(body.phone);
  if (has(body, "email")) patch.email = readEmail(body.email);
  if (has(body, "notes")) patch.notes = readString(body.notes, { label: "Заметки", max: 5000 });
  return patch;
}

export function clientInsertStatement(id: string, input: ClientInput, now: string): InStatement {
  return {
    sql: "insert into clients (id, name, phone, email, notes, search, created_at) values (?, ?, ?, ?, ?, ?, ?)",
    args: [id, input.name, input.phone, input.email, input.notes, buildClientSearch(input), now],
  };
}

/**
 * Список клиентов (справочник общий для всех сотрудников).
 * leads_count у менеджера считает только его собственные заявки.
 */
export async function listClients(user: User, query?: string | null, limit = 100): Promise<ClientListItem[]> {
  const args: (string | number)[] = [];
  const countFilter = user.role === "admin" ? "" : "and l.assigned_to = ?";
  if (user.role !== "admin") args.push(user.id);

  let where = "";
  const q = query?.trim().toLowerCase();
  if (q) {
    const conditions = ["c.search like ? escape '\\'"];
    args.push(likePattern(q));
    // Запрос похож на телефон → дополнительно ищем по одним цифрам.
    if (/^[\d\s()+-]+$/.test(q) && digitsOnly(q)) {
      conditions.push("c.search like ? escape '\\'");
      args.push(likePattern(digitsOnly(q)));
    }
    where = `where ${conditions.join(" or ")}`;
  }
  args.push(limit);

  const rs = await getDb().execute({
    sql: `select ${CLIENT_COLUMNS},
            (select count(*) from leads l where l.client_id = c.id ${countFilter}) as leads_count
          from clients c ${where}
          order by c.created_at desc
          limit ?`,
    args,
  });
  return rs.rows.map((row) => ({ ...rowToClient(row), leads_count: Number(row.leads_count ?? 0) }));
}

export async function getClient(id: string): Promise<Client | null> {
  const rs = await getDb().execute({ sql: `select ${CLIENT_COLUMNS} from clients c where c.id = ?`, args: [id] });
  return rs.rows[0] ? rowToClient(rs.rows[0]) : null;
}

export async function insertClient(input: ClientInput): Promise<Client> {
  const id = randomUUID();
  await getDb().execute(clientInsertStatement(id, input, new Date().toISOString()));
  return (await getClient(id)) as Client;
}

export async function updateClientRecord(id: string, patch: Partial<ClientInput>): Promise<Client> {
  const current = await getClient(id);
  if (!current) throw new HttpError(404, "Клиент не найден");
  const next: ClientInput = {
    name: patch.name ?? current.name,
    phone: patch.phone ?? current.phone,
    email: patch.email !== undefined ? patch.email : current.email,
    notes: patch.notes !== undefined ? patch.notes : current.notes,
  };
  await getDb().execute({
    sql: "update clients set name = ?, phone = ?, email = ?, notes = ?, search = ? where id = ?",
    args: [next.name, next.phone, next.email, next.notes, buildClientSearch(next), id],
  });
  return (await getClient(id)) as Client;
}
