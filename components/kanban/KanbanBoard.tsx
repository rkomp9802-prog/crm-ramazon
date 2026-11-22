"use client";

import { useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/kanban/KanbanColumn";
import { LeadCardContent } from "@/components/kanban/LeadCard";
import { NewLeadButton } from "@/components/forms/LeadForm";
import { Modal } from "@/components/ui/Modal";
import { Button, Field, FormActions, Input, Select, Textarea } from "@/components/ui/fields";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/client-api";
import { STATUS_LABELS } from "@/lib/labels";
import { LEAD_STATUSES, type LeadStatus, type LeadWithClient, type UserOption } from "@/types/crm.types";

interface KanbanBoardProps {
  initialLeads: LeadWithClient[];
  isAdmin: boolean;
  currentUserId: string;
  users: UserOption[];
}

export function KanbanBoard({ initialLeads, isAdmin, currentUserId, users }: KanbanBoardProps) {
  const [leads, setLeads] = useState(initialLeads);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [lostLeadId, setLostLeadId] = useState<string | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [query, setQuery] = useState("");
  const [assignee, setAssignee] = useState("all");
  const lastDragEnd = useRef(0);
  const toast = useToast();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const visibleLeads = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return leads.filter((lead) => {
      if (isAdmin && assignee !== "all") {
        if (assignee === "none" ? lead.assigned_to !== null : lead.assigned_to !== assignee) return false;
      }
      if (!q) return true;
      return (
        lead.client_name.toLowerCase().includes(q) ||
        (digits.length >= 3 && lead.client_phone.replace(/\D/g, "").includes(digits))
      );
    });
  }, [leads, query, assignee, isAdmin]);

  const columns = useMemo(
    () => LEAD_STATUSES.map((status) => ({ status, leads: visibleLeads.filter((lead) => lead.status === status) })),
    [visibleLeads],
  );
  const activeLead = activeId ? (leads.find((lead) => lead.id === activeId) ?? null) : null;

  async function moveLead(leadId: string, status: LeadStatus, reason?: string) {
    const lead = leads.find((item) => item.id === leadId);
    if (!lead || lead.status === status) return;
    const previousStatus = lead.status;

    // Оптимистично: карточка сразу оказывается в новой колонке.
    setLeads((current) => current.map((item) => (item.id === leadId ? { ...item, status } : item)));
    try {
      const { lead: updated } = await api<{ lead: LeadWithClient }>(`/api/leads/${leadId}`, {
        method: "PATCH",
        body: { status, ...(reason ? { append_note: `Причина отказа: ${reason}` } : {}) },
      });
      setLeads((current) => current.map((item) => (item.id === leadId ? updated : item)));
    } catch (error) {
      // Откат — UI не должен показывать статус, которого нет в базе.
      setLeads((current) => current.map((item) => (item.id === leadId ? { ...item, status: previousStatus } : item)));
      toast(`Не удалось перенести заявку: ${errorMessage(error)}`, "error");
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    lastDragEnd.current = Date.now();
    const status = event.over?.id as LeadStatus | undefined;
    const lead = leads.find((item) => item.id === event.active.id);
    if (!status || !lead || lead.status === status) return;
    if (status === "lost") {
      setLostReason("");
      setLostLeadId(lead.id);
      return;
    }
    void moveLead(lead.id, status);
  }

  function confirmLost() {
    if (!lostLeadId) return;
    const leadId = lostLeadId;
    setLostLeadId(null);
    void moveLead(leadId, "lost", lostReason.trim() || undefined);
  }

  // После перетаскивания браузер может прислать click по ссылке внутри карточки — гасим его.
  const shouldSuppressClick = () => Date.now() - lastDragEnd.current < 300;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск по клиенту или телефону"
          aria-label="Поиск заявок"
          className="w-full sm:w-72"
        />
        {isAdmin ? (
          <Select
            value={assignee}
            onChange={(event) => setAssignee(event.target.value)}
            aria-label="Фильтр по ответственному"
            className="w-full sm:w-56"
          >
            <option value="all">Все сотрудники</option>
            <option value="none">Не назначены</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </Select>
        ) : null}
        <div className="sm:ml-auto">
          <NewLeadButton
            isAdmin={isAdmin}
            users={users}
            currentUserId={currentUserId}
            onCreated={(lead) => setLeads((current) => [lead, ...current])}
          />
        </div>
      </div>

      <DndContext
        id="leads-board"
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="grid auto-cols-[minmax(13.25rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-4">
          {columns.map((column) => (
            <KanbanColumn
              key={column.status}
              status={column.status}
              leads={column.leads}
              showAssignee={isAdmin}
              shouldSuppressClick={shouldSuppressClick}
            />
          ))}
        </div>
        {/* Без анимации сброса: она прячет исходную карточку (opacity: 0) и при отмене переноса в «Отказ» не всегда её возвращает. */}
        <DragOverlay dropAnimation={null}>{activeLead ? <LeadCardContent lead={activeLead} showAssignee={isAdmin} overlay /> : null}</DragOverlay>
      </DndContext>

      <Modal open={lostLeadId !== null} onClose={() => setLostLeadId(null)} title="Причина отказа">
        <div className="space-y-4">
          <Field label="Почему клиент отказался?" htmlFor="lost-reason" hint="Необязательно. Запишется в заметки заявки.">
            <Textarea
              id="lost-reason"
              value={lostReason}
              onChange={(event) => setLostReason(event.target.value)}
              maxLength={2000}
              autoFocus
            />
          </Field>
          <FormActions>
            <Button variant="secondary" onClick={() => setLostLeadId(null)}>
              Отмена
            </Button>
            <Button onClick={confirmLost}>Перенести в «{STATUS_LABELS.lost}»</Button>
          </FormActions>
        </div>
      </Modal>
    </div>
  );
}
