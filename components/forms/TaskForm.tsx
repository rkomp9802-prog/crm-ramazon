"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Button, Field, FormActions, FormError, Input, Select } from "@/components/ui/fields";
import { api, errorMessage } from "@/lib/client-api";
import type { TaskWithContext, UserOption } from "@/types/crm.types";

interface TaskFormProps {
  isAdmin: boolean;
  users: UserOption[];
  currentUserId: string;
  leadId?: string;
  clientId?: string;
  /** Кого подставить ответственным (admin), например ответственного за заявку. */
  defaultAssignee?: string;
  onCreated: (task: TaskWithContext) => void;
  onCancel: () => void;
}

export function TaskForm({
  isAdmin,
  users,
  currentUserId,
  leadId,
  clientId,
  defaultAssignee,
  onCreated,
  onCancel,
}: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState(
    defaultAssignee && users.some((user) => user.id === defaultAssignee) ? defaultAssignee : currentUserId,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const { task } = await api<{ task: TaskWithContext }>("/api/tasks", {
        method: "POST",
        body: {
          title,
          due_date: dueDate || null,
          lead_id: leadId ?? null,
          client_id: clientId ?? null,
          ...(isAdmin ? { assigned_to: assignedTo } : {}),
        },
      });
      onCreated(task);
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Что нужно сделать" htmlFor="task-title">
        <Input id="task-title" required maxLength={300} autoFocus value={title} onChange={(event) => setTitle(event.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Срок (необязательно)" htmlFor="task-due">
          <Input id="task-due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </Field>
        {isAdmin ? (
          <Field label="Ответственный" htmlFor="task-assignee">
            <Select id="task-assignee" value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                  {user.id === currentUserId ? " (вы)" : ""}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </div>
      <FormError message={error} />
      <FormActions>
        <Button variant="secondary" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Создаём…" : "Создать задачу"}
        </Button>
      </FormActions>
    </form>
  );
}

export function NewTaskButton({
  size,
  ...formProps
}: Omit<TaskFormProps, "onCreated" | "onCancel"> & { size?: "sm" | "md" }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <Button size={size} variant={size === "sm" ? "secondary" : "primary"} onClick={() => setOpen(true)}>
        + Задача
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Новая задача">
        <TaskForm
          {...formProps}
          onCancel={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            toast("Задача создана");
            router.refresh();
          }}
        />
      </Modal>
    </>
  );
}
