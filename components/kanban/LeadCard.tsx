"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { useDraggable } from "@dnd-kit/core";
import { SOURCE_LABELS } from "@/lib/labels";
import { formatDate, formatMoney } from "@/lib/format";
import type { LeadWithClient } from "@/types/crm.types";

interface LeadCardContentProps {
  lead: LeadWithClient;
  showAssignee: boolean;
  overlay?: boolean;
  onLinkClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

/** Внешний вид карточки — общий для доски и для «призрака» при перетаскивании. */
export function LeadCardContent({ lead, showAssignee, overlay = false, onLinkClick }: LeadCardContentProps) {
  return (
    <div
      className={`rounded-md border border-line bg-surface p-3 text-left ${
        overlay ? "rotate-1 cursor-grabbing shadow-lg" : "shadow-xs hover:border-[#cfd4dc]"
      }`}
    >
      <Link
        href={`/leads/${lead.id}`}
        onClick={onLinkClick}
        draggable={false}
        className="block truncate text-sm font-medium text-ink hover:text-accent"
      >
        {lead.client_name}
      </Link>
      <div className="mt-1 text-xs text-muted">
        {SOURCE_LABELS[lead.source]} · {formatDate(lead.created_at)}
      </div>
      {showAssignee || lead.value != null ? (
        <div className="mt-2 flex items-baseline justify-between gap-2 text-xs">
          <span className="min-w-0 truncate text-muted">{showAssignee ? (lead.assignee_name ?? "Не назначена") : null}</span>
          {lead.value != null ? (
            <span className="shrink-0 text-sm font-medium tabular-nums text-ink">{formatMoney(lead.value)}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function LeadCard({
  lead,
  showAssignee,
  shouldSuppressClick,
}: {
  lead: LeadWithClient;
  showAssignee: boolean;
  shouldSuppressClick: () => boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      aria-label={`Заявка: ${lead.client_name}. Пробел — взять, стрелки — переместить.`}
      className={`rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        isDragging ? "opacity-40" : "cursor-grab"
      }`}
    >
      <LeadCardContent
        lead={lead}
        showAssignee={showAssignee}
        onLinkClick={(event) => {
          if (shouldSuppressClick()) event.preventDefault();
        }}
      />
    </div>
  );
}
