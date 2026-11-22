"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { Button, Field, FormActions, FormError, Input, Select, Textarea } from "@/components/ui/fields";
import { api, errorMessage } from "@/lib/client-api";
import { STATUS_LABELS } from "@/lib/labels";
import { LEAD_STATUSES, type LeadStatus, type LeadWithClient, type UserOption } from "@/types/crm.types";

interface LeadDetailsProps {
  lead: LeadWithClient;
  isAdmin: boolean;
  users: UserOption[];
}

export function LeadDetails({ lead, isAdmin, users }: LeadDetailsProps) {
  const router = useRouter();
  const toast = useToast();
  const initialValue = lead.value == null ? "" : String(lead.value);

  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [assignedTo, setAssignedTo] = useState(lead.assigned_to ?? "");
  const [value, setValue] = useState(initialValue);
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Если ответственный деактивирован, его нет среди активных — показываем отдельно.
  const assigneeOptions =
    lead.assigned_to && !users.some((user) => user.id === lead.assigned_to)
      ? [...users, { id: lead.assigned_to, name: `${lead.assignee_name ?? "Сотрудник"} (неактивен)` }]
      : users;

  const changes: Record<string, unknown> = {};
  if (status !== lead.status) changes.status = status;
  if (isAdmin && assignedTo !== (lead.assigned_to ?? "")) changes.assigned_to = assignedTo || null;
  if (value !== initialValue) changes.value = value.trim() || null;
  if (notes !== (lead.notes ?? "")) changes.notes = notes;
  const dirty = Object.keys(changes).length > 0;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty) return;
    setError(null);
    setPending(true);
    try {
      await api(`/api/leads/${lead.id}`, { method: "PATCH", body: changes });
      toast("Заявка сохранена");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Статус" htmlFor="lead-status">
          <Select id="lead-status" value={status} onChange={(event) => setStatus(event.target.value as LeadStatus)}>
            {LEAD_STATUSES.map((item) => (
              <option key={item} value={item}>
                {STATUS_LABELS[item]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ответственный" htmlFor="lead-assignee">
          {isAdmin ? (
            <Select id="lead-assignee" value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
              <option value="">— не назначена —</option>
              {assigneeOptions.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </Select>
          ) : (
            <Input id="lead-assignee" value={lead.assignee_name ?? "—"} disabled />
          )}
        </Field>
        <Field label="Сумма сделки" htmlFor="lead-value">
          <Input id="lead-value" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} />
        </Field>
      </div>
      <Field label="Заметки" htmlFor="lead-notes" hint="Свободный текст. Новые записи дописывайте с новой строки.">
        <Textarea id="lead-notes" rows={7} maxLength={10000} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
      <FormError message={error} />
      <FormActions>
        <Button type="submit" disabled={!dirty || pending}>
          {pending ? "Сохраняем…" : "Сохранить"}
        </Button>
      </FormActions>
    </form>
  );
}
