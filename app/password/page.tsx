import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { PasswordChangeForm } from "@/components/forms/PasswordChangeForm";
import { LogoutButton } from "@/components/layout/TopBar";

export const metadata: Metadata = { title: "Смена пароля" };

// Страница вне группы (crm): сюда requireUser() отправляет сотрудника с временным паролем,
// и меню с остальными разделами ему пока не нужно.
export default async function PasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const forced = user.must_change_password;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {forced ? null : (
          <Link href="/dashboard" className="mb-4 inline-block text-sm text-muted hover:text-ink">
            ← На дашборд
          </Link>
        )}
        <h1 className="text-xl font-semibold tracking-tight">Смена пароля</h1>
        <p className="mt-1 text-sm text-muted">
          {forced
            ? "Вы вошли с временным паролем от администратора. Придумайте свой, чтобы продолжить."
            : `${user.name} · ${user.email}`}
        </p>
        <div className="mt-6 rounded-lg border border-line bg-surface p-6 shadow-sm">
          <PasswordChangeForm />
        </div>
        <div className="mt-4 flex items-center justify-between gap-4 text-xs text-muted">
          <span>Остальные ваши сеансы будут завершены.</span>
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
