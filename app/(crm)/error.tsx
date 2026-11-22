"use client";

import { Button } from "@/components/ui/fields";

export default function CrmError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-lg font-semibold">Что-то пошло не так</h1>
      <p className="mt-2 text-sm text-muted">Не удалось загрузить страницу. Попробуйте ещё раз.</p>
      <Button className="mt-6" onClick={reset}>
        Повторить
      </Button>
    </div>
  );
}
