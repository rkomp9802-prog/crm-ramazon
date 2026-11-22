"use client";

import { useState } from "react";
import { Button } from "@/components/ui/fields";
import { ROLE_LABELS } from "@/lib/labels";
import type { UserRole } from "@/types/crm.types";

export function TopBar({ name, role }: { name: string; role: UserRole }) {
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
    <header className="flex h-14 items-center justify-end gap-4 border-b border-line bg-surface px-4 md:px-8">
      <div className="text-right leading-tight">
        <div className="text-sm font-medium">{name}</div>
        <div className="text-xs text-muted">{ROLE_LABELS[role]}</div>
      </div>
      <Button variant="secondary" size="sm" onClick={logout} disabled={pending}>
        Выйти
      </Button>
    </header>
  );
}
