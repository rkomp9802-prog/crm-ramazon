"use client";

import { useDroppable } from "@dnd-kit/core";
import { LeadCard } from "@/components/kanban/LeadCard";
import { STATUS_DOT_CLASSES, STATUS_LABELS } from "@/lib/labels";
import { formatMoney } from "@/lib/format";
import type { LeadStatus, LeadWithClient } from "@/types/crm.types";

interface KanbanColumnProps {
  status: LeadStatus;
  leads: LeadWithClient[];
  showAssignee: boolean;
  shouldSuppressClick: () => boolean;
}

export function KanbanColumn({ status, leads, showAssignee, shouldSuppressClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const total = leads.reduce((sum, lead) => sum + (lead.value ?? 0), 0);

  return (
    <section
      ref={setNodeRef}
      aria-label={STATUS_LABELS[status]}
      className={`flex min-h-[26rem] flex-col rounded-lg border p-2 transition-colors ${
        isOver ? "border-accent bg-accent-soft" : "border-line bg-[#eef0f3]"
      }`}
    >
      <header className="flex items-center justify-between gap-2 px-2 pt-1 pb-2">
        <div className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${STATUS_DOT_CLASSES[status]}`} aria-hidden />
          <h2 className="text-sm font-semibold">{STATUS_LABELS[status]}</h2>
          <span className="text-xs text-muted tabular-nums">{leads.length}</span>
        </div>
        {total > 0 ? <span className="text-xs text-muted tabular-nums">{formatMoney(total)}</span> : null}
      </header>
      <div className="flex flex-1 flex-col gap-2">
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} showAssignee={showAssignee} shouldSuppressClick={shouldSuppressClick} />
        ))}
        {leads.length === 0 ? <p className="px-2 py-8 text-center text-xs text-muted">Перетащите карточку сюда</p> : null}
      </div>
    </section>
  );
}
