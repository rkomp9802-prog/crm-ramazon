import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listClients } from "@/lib/clients";
import { formatDate } from "@/lib/format";
import { Card, EmptyState, PageHeader } from "@/components/ui/Layout";
import { Button, buttonClass, Input } from "@/components/ui/fields";
import { NewClientButton } from "@/components/forms/ClientForm";

export const metadata: Metadata = { title: "Клиенты" };

const LIMIT = 200;

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const user = await requireUser();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const clients = await listClients(user, query, LIMIT);

  return (
    <>
      <PageHeader title="Клиенты" description="Общий справочник клиентов компании" actions={<NewClientButton />} />

      <form action="/clients" role="search" className="mb-4 flex flex-wrap gap-2">
        <Input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Поиск по имени или телефону"
          aria-label="Поиск клиентов"
          className="w-full sm:w-80"
        />
        <Button type="submit" variant="secondary">
          Найти
        </Button>
        {query ? (
          <Link href="/clients" className={buttonClass("ghost")}>
            Сбросить
          </Link>
        ) : null}
      </form>

      <Card bodyClassName="">
        {clients.length === 0 ? (
          <EmptyState>{query ? "По запросу никого не нашли" : "Клиентов пока нет"}</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-xs text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Имя</th>
                  <th className="px-5 py-3 font-medium">Телефон</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 text-right font-medium">{user.role === "admin" ? "Заявок" : "Ваших заявок"}</th>
                  <th className="px-5 py-3 font-medium">Добавлен</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-canvas">
                    <td className="px-5 py-3">
                      <Link href={`/clients/${client.id}`} className="font-medium hover:text-accent">
                        {client.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap tabular-nums">{client.phone || "—"}</td>
                    <td className="px-5 py-3 text-muted">{client.email ?? "—"}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{client.leads_count}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-muted">{formatDate(client.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {clients.length === LIMIT ? (
        <p className="mt-3 text-xs text-muted">Показаны первые {LIMIT} клиентов — уточните поиск.</p>
      ) : null}
    </>
  );
}
