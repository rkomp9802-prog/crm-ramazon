"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/Layout";
import { useToast } from "@/components/ui/Toast";
import { inputClass } from "@/components/ui/fields";
import { api, errorMessage } from "@/lib/client-api";
import { formatDate } from "@/lib/format";
import type { TaskStatus, TaskWithContext } from "@/types/crm.types";

interface TaskListProps {
  tasks: TaskWithContext[];
  /** Сегодня (YYYY-MM-DD) — считается на сервере в часовом поясе компании. */
  today: string;
  showAssignee: boolean;
  /** Показывать ссылку на заявку/клиента. */
  showContext: boolean;
  emptyText: string;
}

type TaskChanges = { status?: TaskStatus; due_date?: string | null };

export function TaskList({ tasks, today, showAssignee, showContext, emptyText }: TaskListProps) {
  const router = useRouter();
  const toast = useToast();
  const [overrides, setOverrides] = useState<Record<string, TaskChanges>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const cancelEdit = useRef(false);

  async function save(taskId: string, changes: TaskChanges) {
    setOverrides((current) => ({ ...current, [taskId]: { ...current[taskId], ...changes } })); // оптимистично
    setBusyId(taskId);
    try {
      await api(`/api/tasks/${taskId}`, { method: "PATCH", body: changes });
      router.refresh(); // обновит и счётчик просроченных в меню
    } catch (error) {
      setOverrides((current) => {
        const next = { ...current };
        delete next[taskId];
        return next;
      });
      toast(`Не удалось сохранить задачу: ${errorMessage(error)}`, "error");
    } finally {
      setBusyId(null);
    }
  }

  if (tasks.length === 0) return <EmptyState>{emptyText}</EmptyState>;

  return (
    <ul className="divide-y divide-line">
      {tasks.map((original) => {
        const task = { ...original, ...overrides[original.id] };
        const done = task.status === "done";
        const overdue = !done && task.due_date !== null && task.due_date < today;

        return (
          <li key={task.id} className="flex flex-wrap items-start gap-3 px-5 py-3">
            <input
              type="checkbox"
              checked={done}
              disabled={busyId === task.id}
              onChange={() => save(task.id, { status: done ? "pending" : "done" })}
              aria-label={done ? `Вернуть в работу: ${task.title}` : `Отметить выполненной: ${task.title}`}
              className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]"
            />
            <div className="min-w-0 flex-1">
              <div className={`text-sm ${done ? "text-muted line-through" : "text-ink"}`}>{task.title}</div>
              {(showContext && task.client_name) || showAssignee ? (
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                  {showContext && task.client_name ? (
                    task.lead_id ? (
                      <Link href={`/leads/${task.lead_id}`} className="hover:text-accent">
                        Заявка: {task.client_name}
                      </Link>
                    ) : task.client_id ? (
                      <Link href={`/clients/${task.client_id}`} className="hover:text-accent">
                        Клиент: {task.client_name}
                      </Link>
                    ) : null
                  ) : null}
                  {showAssignee && task.assignee_name ? <span>{task.assignee_name}</span> : null}
                </div>
              ) : null}
            </div>
            <div className="text-sm">
              {editingId === task.id ? (
                <input
                  type="date"
                  defaultValue={task.due_date ?? ""}
                  autoFocus
                  aria-label={`Срок задачи: ${task.title}`}
                  className={`${inputClass} w-40 py-1`}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      cancelEdit.current = true;
                      event.currentTarget.blur();
                    }
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                  onBlur={(event) => {
                    setEditingId(null);
                    if (cancelEdit.current) {
                      cancelEdit.current = false;
                      return;
                    }
                    const nextDate = event.currentTarget.value || null;
                    if (nextDate !== task.due_date) void save(task.id, { due_date: nextDate });
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingId(task.id)}
                  title="Изменить срок"
                  className={`rounded px-1.5 py-0.5 tabular-nums hover:bg-canvas ${
                    overdue ? "font-medium text-red-600" : "text-muted"
                  }`}
                >
                  {task.due_date ? formatDate(task.due_date) : "без срока"}
                  {overdue ? " · просрочено" : ""}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
