"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Button, Field, FormActions, FormError, Input, Select } from "@/components/ui/fields";
import { api, errorMessage } from "@/lib/client-api";
import { ROLE_LABELS } from "@/lib/labels";
import { USER_ROLES, type User, type UserRole } from "@/types/crm.types";

const MIN_PASSWORD_LENGTH = 8;

function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function PasswordField({ value, onChange, id }: { value: string; onChange: (value: string) => void; id: string }) {
  return (
    <Field label="Временный пароль" htmlFor={id} hint={`Не короче ${MIN_PASSWORD_LENGTH} символов. Передайте его сотруднику лично.`}>
      <div className="flex gap-2">
        <Input
          id={id}
          type="text"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          maxLength={72}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="font-mono"
        />
        <Button variant="secondary" onClick={() => onChange(generatePassword())}>
          Сгенерировать
        </Button>
      </div>
    </Field>
  );
}

export function UserForm({ onSaved, onCancel }: { onSaved: (user: User) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", role: "manager" as UserRole, password: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const { user } = await api<{ user: User }>("/api/users", { method: "POST", body: form });
      onSaved(user);
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Имя" htmlFor="user-name">
          <Input
            id="user-name"
            required
            maxLength={100}
            autoFocus
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
        </Field>
        <Field label="Email" htmlFor="user-email">
          <Input
            id="user-email"
            type="email"
            required
            maxLength={254}
            autoComplete="off"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          />
        </Field>
      </div>
      <Field label="Роль" htmlFor="user-role">
        <Select
          id="user-role"
          value={form.role}
          onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as UserRole }))}
        >
          {USER_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </Select>
      </Field>
      <PasswordField id="user-password" value={form.password} onChange={(password) => setForm((current) => ({ ...current, password }))} />
      <FormError message={error} />
      <FormActions>
        <Button variant="secondary" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Создаём…" : "Добавить сотрудника"}
        </Button>
      </FormActions>
    </form>
  );
}

export function PasswordResetForm({ user, onDone, onCancel }: { user: User; onDone: () => void; onCancel: () => void }) {
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await api("/api/users", { method: "PATCH", body: { id: user.id, password } });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-muted">
        Новый пароль для <span className="font-medium text-ink">{user.name}</span> ({user.email}).
      </p>
      <PasswordField id="reset-password" value={password} onChange={setPassword} />
      <FormError message={error} />
      <FormActions>
        <Button variant="secondary" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Сохраняем…" : "Сменить пароль"}
        </Button>
      </FormActions>
    </form>
  );
}

export function NewUserButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Новый сотрудник</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Новый сотрудник">
        <UserForm
          onCancel={() => setOpen(false)}
          onSaved={(user) => {
            setOpen(false);
            toast(`${user.name} добавлен(а)`);
            router.refresh();
          }}
        />
      </Modal>
    </>
  );
}
