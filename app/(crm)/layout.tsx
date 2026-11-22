import { requireUser } from "@/lib/session";
import { countOverdueTasks } from "@/lib/tasks";
import { todayISO } from "@/lib/dates";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { ToastProvider } from "@/components/ui/Toast";

export default async function CrmLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const overdueCount = await countOverdueTasks(user, todayISO());

  return (
    <ToastProvider>
      <div className="min-h-screen md:flex">
        <Sidebar role={user.role} overdueCount={overdueCount} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar name={user.name} role={user.role} />
          <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
