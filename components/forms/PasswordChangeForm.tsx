"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, FormError, Input } from "@/components/ui/fields";
import { api, errorMessage } from "@/lib/client-api";

const MIN_PASSWORD_LENGTH = 8;

export function PasswordChangeForm() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (next.length < MIN_PASSWORD_LENGTH) {
      setError(`Новый пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`);
      return;
    }
    if (next !== confirm) {
      setError("Пароли не совпадают");
      return;
    }
    setPending(true);
    try {
      await api("/api/auth/password", { method: "POST", body: { current_password: current, new_password: next } });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Текущий пароль" htmlFor="current-password">
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
        />
      </Field>
      <Field label="Новый пароль" htmlFor="new-password" hint={`Не короче ${MIN_PASSWORD_LENGTH} символов.`}>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          maxLength={72}
          value={next}
          onChange={(event) => setNext(event.target.value)}
        />
      </Field>
      <Field label="Повторите новый пароль" htmlFor="confirm-password">
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          maxLength={72}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </Field>
      <FormError message={error} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Сохраняем…" : "Сменить пароль"}
      </Button>
    </form>
  );
}
