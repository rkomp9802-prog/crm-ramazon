import Link from "next/link";
import { buttonClass } from "@/components/ui/fields";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium text-muted">404</p>
      <h1 className="mt-2 text-xl font-semibold">Страница не найдена</h1>
      <p className="mt-2 text-sm text-muted">Возможно, запись удалена или ссылка указана неверно.</p>
      <Link href="/dashboard" className={`${buttonClass("secondary")} mt-6`}>
        На дашборд
      </Link>
    </main>
  );
}
