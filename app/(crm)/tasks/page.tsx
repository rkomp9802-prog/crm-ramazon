import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listTasks } from "@/lib/tasks";
import { listActiveUserOptions } from "@/lib/users";
import { todayISO } from "@/lib/dates";
import { Card, PageHeader } from "@/components/ui/Layout";
import { NewTaskButton } from "@/components/forms/TaskForm";
import { TaskList } from "@/components/tasks/TaskList";
import type { UserOption } from "@/types/crm.types";

export const metadata: Metadata = { title: "Задачи" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const { scope: requestedScope } = await searchParams;
  const scope = isAdmin && requestedScope === "all" ? "all" : "mine";

  const [tasks, users] = await Promise.all([
    listTasks(user, { scope }),
    isAdmin ? listActiveUserOptions() : Promise.resolve<UserOption[]>([]),
  ]);
  const today = todayISO();
  const pending = tasks.filter((task) => task.status === "pending");
  const overdue = pending.filter((task) => task.due_date !== null && task.due_date < today).length;

  return (
    <>
      <PageHeader
        title="Задачи"
        description={`Активных: ${pending.length}${overdue ? ` · просрочено: ${overdue}` : ""}`}
        actions={<NewTaskButton isAdmin={isAdmin} users={users} currentUserId={user.id} />}
      />

      {isAdmin ? (
        <nav aria-label="Фильтр задач" className="mb-4 inline-flex rounded-md border border-line bg-surface p-0.5">
          {(
            [
              ["mine", "Мои задачи", "/tasks"],
              ["all", "Все", "/tasks?scope=all"],
            ] as const
          ).map(([value, label, href]) => (
            <Link
              key={value}
              href={href}
              aria-current={scope === value ? "page" : undefined}
              className={`rounded px-3 py-1.5 text-sm transition-colors ${
                scope === value ? "bg-accent-soft font-medium text-accent-strong" : "text-muted hover:text-ink"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      ) : null}

      <Card bodyClassName="">
        <TaskList
          tasks={tasks}
          today={today}
          showAssignee={scope === "all"}
          showContext
          emptyText={scope === "all" ? "Задач пока нет" : "У вас нет задач"}
        />
      </Card>
    </>
  );
}
