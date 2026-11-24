"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Button, Select } from "@/components/ui/fields";
import { PasswordResetForm } from "@/components/forms/UserForm";
import { api, errorMessage } from "@/lib/client-api";
import { ROLE_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { USER_ROLES, type User, type UserRole } from "@/types/crm.types";

export function UsersTable({ users, currentUserId }: { users: User[]; currentUserId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);

  async function update(user: User, changes: { role?: UserRole; is_active?: boolean }, success: string) {
    setBusyId(user.id);
    try {
      await api("/api/users", { method: "PATCH", body: { id: user.id, ...changes } });
      toast(success);
      router.refresh();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setBusyId(null);
    }
  }

  function toggleActive(user: User) {
    if (user.is_active) {
      const ok = window.confirm(
        `Деактивировать ${user.name}? Сотрудник не сможет войти, его заявки и задачи сохранятся — их стоит переназначить.`,
      );
      if (!ok) return;
      void update(user, { is_active: false }, `${user.name}: доступ отключён`);
    } else {
      void update(user, { is_active: true }, `${user.name}: доступ восстановлен`);
    }
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Имя</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Роль</th>
              <th className="px-5 py-3 font-medium">Статус</th>
              <th className="px-5 py-3 font-medium">Добавлен</th>
              <th className="px-5 py-3 text-right font-medium">
                <span className="sr-only">Действия</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              const busy = busyId === user.id;
              return (
                <tr key={user.id} className={user.is_active ? "" : "bg-canvas/60 text-muted"}>
                  <td className="px-5 py-3 font-medium">
                    {user.name}
                    {isSelf ? <span className="ml-2 text-xs font-normal text-muted">(вы)</span> : null}
                  </td>
                  <td className="px-5 py-3">{user.email}</td>
                  <td className="px-5 py-3">
                    <Select
                      value={user.role}
                      disabled={isSelf || busy}
                      onChange={(event) => {
                        const role = event.target.value as UserRole;
                        void update(user, { role }, `${user.name}: роль «${ROLE_LABELS[role]}»`);
                      }}
                      aria-label={`Роль: ${user.name}`}
                      className="w-44 py-1.5"
                    >
                      {USER_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        user.is_active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {user.is_active ? "Активен" : "Деактивирован"}
                    </span>
                    {user.must_change_password ? <div className="mt-1 text-xs text-muted">временный пароль</div> : null}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-muted">{formatDate(user.created_at)}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy || isSelf}
                        title={isSelf ? "Свой пароль меняется на странице «Смена пароля»" : undefined}
                        onClick={() => setResetUser(user)}
                      >
                        Новый пароль
                      </Button>
                      <Button
                        variant={user.is_active ? "danger" : "secondary"}
                        size="sm"
                        disabled={isSelf || busy}
                        onClick={() => toggleActive(user)}
                      >
                        {user.is_active ? "Деактивировать" : "Активировать"}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={resetUser !== null} onClose={() => setResetUser(null)} title="Смена пароля">
        {resetUser ? (
          <PasswordResetForm
            user={resetUser}
            onCancel={() => setResetUser(null)}
            onDone={() => {
              toast(`Пароль для ${resetUser.name} изменён`);
              setResetUser(null);
            }}
          />
        ) : null}
      </Modal>
    </>
  );
}
