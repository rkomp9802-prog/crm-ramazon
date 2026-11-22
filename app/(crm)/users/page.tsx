import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { listUsers } from "@/lib/users";
import { Card, PageHeader } from "@/components/ui/Layout";
import { NewUserButton } from "@/components/forms/UserForm";
import { UsersTable } from "@/components/users/UsersTable";

export const metadata: Metadata = { title: "Сотрудники" };

export default async function UsersPage() {
  const admin = await requireAdmin();
  const users = await listUsers();

  return (
    <>
      <PageHeader
        title="Сотрудники"
        description="Сотрудников не удаляем: деактивированный не может войти, но его заявки и задачи остаются в истории."
        actions={<NewUserButton />}
      />
      <Card bodyClassName="">
        <UsersTable users={users} currentUserId={admin.id} />
      </Card>
    </>
  );
}
