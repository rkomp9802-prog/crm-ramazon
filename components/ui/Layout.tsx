import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClass } from "@/components/ui/fields";

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6">
      {back ? (
        <Link href={back.href} className="mb-2 inline-block text-sm text-muted hover:text-ink">
          ← {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function Card({
  title,
  actions,
  children,
  className = "",
  bodyClassName = "p-5",
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`rounded-lg border border-line bg-surface ${className}`}>
      {title || actions ? (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          {title ? <h2 className="text-sm font-semibold text-ink">{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-5 py-10 text-center text-sm text-muted">{children}</p>;
}

export function NoAccess({ message = "У вас нет доступа к этой записи." }: { message?: string }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-sm font-medium text-muted">403</p>
      <h1 className="mt-2 text-lg font-semibold">Нет доступа</h1>
      <p className="mt-2 text-sm text-muted">{message}</p>
      <Link href="/dashboard" className={`${buttonClass("secondary")} mt-6`}>
        На дашборд
      </Link>
    </div>
  );
}
