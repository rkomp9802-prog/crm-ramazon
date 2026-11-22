import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { listLeads } from "@/lib/leads";
import { listActiveUserOptions } from "@/lib/users";
import { PageHeader } from "@/components/ui/Layout";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import type { UserOption } from "@/types/crm.types";

export const metadata: Metadata = { title: "Заявки" };

export default async function LeadsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const [leads, users] = await Promise.all([
    listLeads(user),
    isAdmin ? listActiveUserOptions() : Promise.resolve<UserOption[]>([]),
  ]);

  return (
    <>
      <PageHeader
        title="Заявки"
        description={
          isAdmin
            ? "Все заявки команды. Перетащите карточку в другую колонку, чтобы сменить статус."
            : "Ваши заявки. Перетащите карточку в другую колонку, чтобы сменить статус."
        }
      />
      <KanbanBoard initialLeads={leads} isAdmin={isAdmin} currentUserId={user.id} users={users} />
    </>
  );
}
