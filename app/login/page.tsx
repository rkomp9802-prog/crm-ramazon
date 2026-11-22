import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "@/components/forms/LoginForm";

export const metadata: Metadata = { title: "Вход" };

/** Разрешаем возвращаться только на внутренние пути — без open redirect. */
function safeNext(value: string | string[] | undefined): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\") ||
    value.startsWith("/login")
  ) {
    return "/dashboard";
  }
  return value;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <div className="text-2xl font-semibold tracking-tight">CRM</div>
          <p className="mt-1 text-sm text-muted">Войдите в рабочий аккаунт</p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-6 shadow-sm">
          <LoginForm next={safeNext(next)} />
        </div>
        <p className="mt-6 text-xs text-muted">Нет доступа или забыли пароль? Обратитесь к администратору.</p>
      </div>
    </main>
  );
}
