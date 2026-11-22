"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Button, Field, FormActions, FormError, Input, Textarea } from "@/components/ui/fields";
import { api, errorMessage } from "@/lib/client-api";
import type { Client } from "@/types/crm.types";

interface ClientFormProps {
  initial?: Client;
  onSaved: (client: Client) => void;
  onCancel: () => void;
}

export function ClientForm({ initial, onSaved, onCancel }: ClientFormProps) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    notes: initial?.notes ?? "",
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bind = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value })),
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const body = {
      name: form.name,
      phone: form.phone,
      email: form.email.trim() || null,
      notes: form.notes.trim() || null,
    };
    try {
      const { client } = initial
        ? await api<{ client: Client }>(`/api/clients/${initial.id}`, { method: "PATCH", body })
        : await api<{ client: Client }>("/api/clients", { method: "POST", body });
      onSaved(client);
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Имя или название" htmlFor="client-name">
          <Input id="client-name" required maxLength={200} autoFocus {...bind("name")} />
        </Field>
        <Field label="Телефон" htmlFor="client-phone">
          <Input id="client-phone" type="tel" required maxLength={50} {...bind("phone")} />
        </Field>
      </div>
      <Field label="Email (необязательно)" htmlFor="client-email">
        <Input id="client-email" type="email" maxLength={254} {...bind("email")} />
      </Field>
      <Field label="Заметки" htmlFor="client-notes">
        <Textarea id="client-notes" maxLength={5000} {...bind("notes")} />
      </Field>
      <FormError message={error} />
      <FormActions>
        <Button variant="secondary" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Сохраняем…" : initial ? "Сохранить" : "Добавить клиента"}
        </Button>
      </FormActions>
    </form>
  );
}

export function NewClientButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Новый клиент</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Новый клиент">
        <ClientForm
          onCancel={() => setOpen(false)}
          onSaved={(client) => {
            setOpen(false);
            toast("Клиент добавлен");
            router.push(`/clients/${client.id}`);
          }}
        />
      </Modal>
    </>
  );
}

export function EditClientButton({ client }: { client: Client }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Редактировать
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Контакты клиента">
        <ClientForm
          initial={client}
          onCancel={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            toast("Контакты обновлены");
            router.refresh();
          }}
        />
      </Modal>
    </>
  );
}
