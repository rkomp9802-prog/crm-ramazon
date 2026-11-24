"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, buttonClass } from "@/components/ui/fields";
import { ROLE_LABELS } from "@/lib/labels";
import type { UserRole } from "@/types/crm.types";

export function LogoutButton() {
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/login");
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={logout} disabled={pending}>
      Выйти
    </Button>
  );
}

export function TopBar({ name, role }: { name: string; role: UserRole }) {
  return (
    <header className="flex h-14 items-center justify-end gap-3 border-b border-line bg-surface px-4 md:px-8">
      <div className="text-right leading-tight">
        <div className="text-sm font-medium">{name}</div>
        <div className="text-xs text-muted">{ROLE_LABELS[role]}</div>
      </div>
      <Link href="/password" className={buttonClass("ghost", "sm")} title="Сменить пароль">
        Пароль
      </Link>
      <LogoutButton />
    </header>
  );
}
