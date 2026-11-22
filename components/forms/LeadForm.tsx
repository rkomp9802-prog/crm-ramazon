"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Button, Field, FormActions, FormError, Input, Select, Textarea } from "@/components/ui/fields";
import { api, errorMessage } from "@/lib/client-api";
import { SOURCE_LABELS } from "@/lib/labels";
import { LEAD_SOURCES, type ClientSummary, type LeadSource, type LeadWithClient, type UserOption } from "@/types/crm.types";

interface LeadFormProps {
  isAdmin: boolean;
  users: UserOption[];
  currentUserId: string;
  /** Клиент уже выбран (форма открыта из карточки клиента). */
  presetClient?: ClientSummary;
  onCreated: (lead: LeadWithClient) => void;
  onCancel: () => void;
}

/** Новая заявка: выбор существующего клиента (поиск) или создание нового прямо из формы. */
export function LeadForm({ isAdmin, users, currentUserId, presetClient, onCreated, onCancel }: LeadFormProps) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selected, setSelected] = useState<ClientSummary | null>(presetClient ?? null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", phone: "", email: "" });
  const [source, setSource] = useState<LeadSource>("manual");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [assignedTo, setAssignedTo] = useState(users.some((user) => user.id === currentUserId) ? currentUserId : "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (presetClient || mode !== "existing" || selected) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/clients?limit=8&q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (response.ok) {
          const data = (await response.json()) as { clients: ClientSummary[] };
          setResults(data.clients);
        }
      } catch {
        // запрос отменён — пользователь продолжил печатать
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, mode, selected, presetClient]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const body: Record<string, unknown> = { source, value: value.trim() || null, notes: notes.trim() || null };
    if (mode === "existing") {
      if (!selected) {
        setError("Выберите клиента или создайте нового");
        return;
      }
      body.client_id = selected.id;
    } else {
      body.new_client = { name: newClient.name, phone: newClient.phone, email: newClient.email.trim() || null };
    }
    if (isAdmin) body.assigned_to = assignedTo || null;

    setPending(true);
    try {
      const { lead } = await api<{ lead: LeadWithClient }>("/api/leads", { method: "POST", body });
      onCreated(lead);
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  const modeButton = (target: "existing" | "new", label: string) => (
    <button
      type="button"
      onClick={() => setMode(target)}
      aria-pressed={mode === target}
      className={`rounded px-3 py-1.5 text-sm transition-colors ${
        mode === target ? "bg-accent-soft font-medium text-accent-strong" : "text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {presetClient ? (
        <Field label="Клиент">
          <div className="rounded-md border border-line bg-canvas px-3 py-2 text-sm">
            <span className="font-medium">{presetClient.name}</span> <span className="text-muted">· {presetClient.phone}</span>
          </div>
        </Field>
      ) : (
        <fieldset className="space-y-3">
          <legend className="mb-1.5 text-sm font-medium">Клиент</legend>
          <div className="inline-flex rounded-md border border-line p-0.5">
            {modeButton("existing", "Существующий")}
            {modeButton("new", "Новый клиент")}
          </div>

          {mode === "existing" ? (
            selected ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-canvas px-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{selected.name}</span> <span className="text-muted">· {selected.phone}</span>
                </span>
                <button type="button" onClick={() => setSelected(null)} className="text-accent hover:underline">
                  Изменить
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Начните вводить имя или телефон"
                  aria-label="Поиск клиента"
                  autoFocus
                />
                <ul className="max-h-48 divide-y divide-line overflow-y-auto rounded-md border border-line">
                  {results.map((client) => (
                    <li key={client.id}>
                      <button
                        type="button"
                        onClick={() => setSelected({ id: client.id, name: client.name, phone: client.phone })}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-canvas"
                      >
                        <span className="font-medium">{client.name}</span>
                        <span className="text-muted tabular-nums">{client.phone}</span>
                      </button>
                    </li>
                  ))}
                  {!searching && results.length === 0 ? (
                    <li className="px-3 py-3 text-sm text-muted">
                      Никого не нашли.{" "}
                      <button type="button" onClick={() => setMode("new")} className="text-accent hover:underline">
                        Создать нового клиента
                      </button>
                    </li>
                  ) : null}
                </ul>
              </div>
            )
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Имя" htmlFor="new-client-name">
                <Input
                  id="new-client-name"
                  required
                  maxLength={200}
                  value={newClient.name}
                  onChange={(event) => setNewClient((current) => ({ ...current, name: event.target.value }))}
                />
              </Field>
              <Field label="Телефон" htmlFor="new-client-phone">
                <Input
                  id="new-client-phone"
                  type="tel"
                  required
                  maxLength={50}
                  value={newClient.phone}
                  onChange={(event) => setNewClient((current) => ({ ...current, phone: event.target.value }))}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Email (необязательно)" htmlFor="new-client-email">
                  <Input
                    id="new-client-email"
                    type="email"
                    maxLength={254}
                    value={newClient.email}
                    onChange={(event) => setNewClient((current) => ({ ...current, email: event.target.value }))}
                  />
                </Field>
              </div>
            </div>
          )}
        </fieldset>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Источник" htmlFor="lead-source">
          <Select id="lead-source" value={source} onChange={(event) => setSource(event.target.value as LeadSource)}>
            {LEAD_SOURCES.map((item) => (
              <option key={item} value={item}>
                {SOURCE_LABELS[item]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Сумма сделки (необязательно)" htmlFor="lead-value">
          <Input id="lead-value" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} />
        </Field>
      </div>

      {isAdmin ? (
        <Field label="Ответственный" htmlFor="lead-assignee">
          <Select id="lead-assignee" value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
            <option value="">— не назначена —</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <Field label="Заметки" htmlFor="lead-notes">
        <Textarea id="lead-notes" maxLength={10000} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>

      <FormError message={error} />
      <FormActions>
        <Button variant="secondary" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Создаём…" : "Создать заявку"}
        </Button>
      </FormActions>
    </form>
  );
}

export function NewLeadButton({
  onCreated,
  ...formProps
}: Omit<LeadFormProps, "onCreated" | "onCancel"> & { onCreated?: (lead: LeadWithClient) => void }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const toast = useToast();

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Новая заявка</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Новая заявка">
        <LeadForm
          {...formProps}
          onCancel={() => setOpen(false)}
          onCreated={(lead) => {
            setOpen(false);
            toast(`Заявка для «${lead.client_name}» создана`);
            onCreated?.(lead);
            router.refresh();
          }}
        />
      </Modal>
    </>
  );
}
