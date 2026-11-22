import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { canAccessLead, getLead } from "@/lib/leads";
import { getClient } from "@/lib/clients";
import { listTasks } from "@/lib/tasks";
import { listActiveUserOptions } from "@/lib/users";
import { todayISO } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { SOURCE_LABELS } from "@/lib/labels";
import { Card, NoAccess, PageHeader } from "@/components/ui/Layout";
import { StatusBadge } from "@/components/ui/Badges";
import { LeadDetails } from "@/components/leads/LeadDetails";
import { TaskList } from "@/components/tasks/TaskList";
import { NewTaskButton } from "@/components/forms/TaskForm";
import type { UserOption } from "@/types/crm.types";

export const metadata: Metadata = { title: "Заявка" };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();
  if (!canAccessLead(user, lead)) {
    return <NoAccess message="Эта заявка назначена на другого сотрудника." />;
  }

  const isAdmin = user.role === "admin";
  const [client, tasks, users] = await Promise.all([
    getClient(lead.client_id),
    listTasks(user, { leadId: lead.id, scope: "all" }),
    isAdmin ? listActiveUserOptions() : Promise.resolve<UserOption[]>([]),
  ]);

  return (
    <>
      <PageHeader
        back={{ href: "/leads", label: "Заявки" }}
        title={
          <Link href={`/clients/${lead.client_id}`} className="hover:text-accent">
            {lead.client_name}
          </Link>
        }
        description={`Заявка от ${formatDate(lead.created_at)} · ${SOURCE_LABELS[lead.source]}`}
        actions={<StatusBadge status={lead.status} />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Детали заявки">
            <LeadDetails lead={lead} isAdmin={isAdmin} users={users} />
          </Card>
          <Card
            title="Задачи по заявке"
            bodyClassName=""
            actions={
              <NewTaskButton
                isAdmin={isAdmin}
                users={users}
                currentUserId={user.id}
                leadId={lead.id}
                defaultAssignee={lead.assigned_to ?? undefined}
                size="sm"
              />
            }
          >
            <TaskList tasks={tasks} today={todayISO()} showAssignee={isAdmin} showContext={false} emptyText="Задач по этой заявке пока нет" />
          </Card>
        </div>

        <Card title="Клиент" className="self-start">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted">Имя</dt>
              <dd className="font-medium">{lead.client_name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Телефон</dt>
              <dd>
                <a href={`tel:${lead.client_phone.replace(/[^\d+]/g, "")}`} className="tabular-nums hover:text-accent">
                  {lead.client_phone}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Email</dt>
              <dd>
                {client?.email ? (
                  <a href={`mailto:${client.email}`} className="hover:text-accent">
                    {client.email}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
          <Link href={`/clients/${lead.client_id}`} className="mt-4 inline-block text-sm text-accent hover:underline">
            Карточка клиента →
          </Link>
        </Card>
      </div>
    </>
  );
}
