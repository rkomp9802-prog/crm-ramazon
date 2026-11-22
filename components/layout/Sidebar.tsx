"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/types/crm.types";

const NAV_ITEMS: { href: string; label: string; adminOnly?: boolean }[] = [
  { href: "/dashboard", label: "Дашборд" },
  { href: "/leads", label: "Заявки" },
  { href: "/clients", label: "Клиенты" },
  { href: "/tasks", label: "Задачи" },
  { href: "/users", label: "Сотрудники", adminOnly: true },
];

export function Sidebar({ role, overdueCount }: { role: UserRole; overdueCount: number }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || role === "admin");

  return (
    <aside className="border-b border-line bg-surface md:sticky md:top-0 md:flex md:h-screen md:w-56 md:shrink-0 md:flex-col md:border-r md:border-b-0">
      <div className="flex h-14 items-center px-5">
        <Link href="/dashboard" className="text-base font-semibold tracking-tight">
          CRM
        </Link>
      </div>
      <nav aria-label="Основная навигация" className="flex gap-1 overflow-x-auto px-3 pb-2 md:flex-col md:pb-0">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active ? "bg-accent-soft font-medium text-accent-strong" : "text-muted hover:bg-canvas hover:text-ink"
              }`}
            >
              <span>{item.label}</span>
              {item.href === "/tasks" && overdueCount > 0 ? (
                <span
                  className="min-w-5 rounded-full bg-red-600 px-1.5 text-center text-xs font-semibold leading-5 text-white"
                  title="Просроченные задачи"
                >
                  {overdueCount}
                  <span className="sr-only"> просрочено</span>
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
