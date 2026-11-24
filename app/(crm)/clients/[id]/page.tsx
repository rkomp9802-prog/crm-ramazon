import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getClient } from "@/lib/clients";
import { listLeads } from "@/lib/leads";
import { listTasks } from "@/lib/tasks";
import { listActiveUserOptions } from "@/lib/users";
import { todayISO } from "@/lib/dates";
import { formatDate, formatMoney } from "@/lib/format";
import { SOURCE_LABELS } from "@/lib/labels";
import { Card, EmptyState, PageHeader } from "@/components/ui/Layout";
import { StatusBadge } from "@/components/ui/Badges";
import { EditClientButton } from "@/components/forms/ClientForm";
import { NewLeadButton } from "@/components/forms/LeadForm";
import { NewTaskButton } from "@/components/forms/TaskForm";
import { TaskList } from "@/components/tasks/TaskList";
import type { UserOption } from "@/types/crm.types";

export const metadata: Metadata = { title: "Клиент" };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const isAdmin = user.role === "admin";
  const [leads, tasks, users] = await Promise.all([
    listLeads(user, { clientId: client.id }),
    listTasks(user, { clientId: client.id, scope: "all" }),
    isAdmin ? listActiveUserOptions() : Promise.resolve<UserOption[]>([]),
  ]);

  return (
    <>
      <PageHeader
        back={{ href: "/clients", label: "Клиенты" }}
        title={client.name}
        description={`В базе с ${formatDate(client.created_at)}`}
        actions={
          <>
            <EditClientButton client={client} />
            <NewLeadButton
              isAdmin={isAdmin}
              users={users}
              currentUserId={user.id}
              presetClient={{ id: client.id, name: client.name, phone: client.phone }}
            />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Контакты" className="self-start">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted">Телефон</dt>
              <dd>
                {client.phone ? (
                  <a href={`tel:${client.phone.replace(/[^\d+]/g, "")}`} className="tabular-nums hover:text-accent">
                    {client.phone}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Email</dt>
              <dd>
                {client.email ? (
                  <a href={`mailto:${client.email}`} className="hover:text-accent">
                    {client.email}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Заметки</dt>
              <dd className="whitespace-pre-wrap">{client.notes ?? "—"}</dd>
            </div>
          </dl>
        </Card>

        <Card title={isAdmin ? "История заявок" : "Ваши заявки по клиенту"} className="lg:col-span-2" bodyClassName="">
          {leads.length === 0 ? (
            <EmptyState>Заявок пока нет</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-line text-left text-xs text-muted">
                  <tr>
                    <th className="px-5 py-3 font-medium">Дата</th>
                    <th className="px-5 py-3 font-medium">Статус</th>
                    <th className="px-5 py-3 font-medium">Источник</th>
                    <th className="px-5 py-3 text-right font-medium">Сумма</th>
                    {isAdmin ? <th className="px-5 py-3 font-medium">Ответственный</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-canvas">
                      <td className="px-5 py-3 whitespace-nowrap">
                        <Link href={`/leads/${lead.id}`} className="font-medium hover:text-accent">
                          {formatDate(lead.created_at)}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={lead.status} />
                      </td>
                      <td className="px-5 py-3 text-muted">{SOURCE_LABELS[lead.source]}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{formatMoney(lead.value)}</td>
                      {isAdmin ? <td className="px-5 py-3 text-muted">{lead.assignee_name ?? "Не назначена"}</td> : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card
          title="Задачи"
          className="lg:col-span-3"
          bodyClassName=""
          actions={<NewTaskButton isAdmin={isAdmin} users={users} currentUserId={user.id} clientId={client.id} size="sm" />}
        >
          <TaskList tasks={tasks} today={todayISO()} showAssignee={isAdmin} showContext emptyText="Задач по клиенту пока нет" />
        </Card>
      </div>
    </>
  );
}
