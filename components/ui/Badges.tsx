import { ROLE_LABELS, SOURCE_LABELS, STATUS_BADGE_CLASSES, STATUS_LABELS } from "@/lib/labels";
import type { LeadSource, LeadStatus, UserRole } from "@/types/crm.types";

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function SourceLabel({ source }: { source: LeadSource }) {
  return <span className="text-xs text-muted">{SOURCE_LABELS[source]}</span>;
}

export function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        role === "admin" ? "bg-accent-soft text-accent-strong" : "bg-slate-100 text-slate-700"
      }`}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}
