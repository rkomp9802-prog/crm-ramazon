"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "md" | "lg";
}

/** Модалка на нативном <dialog>: фокус внутри, закрытие по Esc, подложка. */
export function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // autoFocus у полей срабатывает до showModal(), и браузер ставит фокус на «×».
      // Переносим фокус в первое поле формы.
      bodyRef.current
        ?.querySelector<HTMLElement>("input:not([type=hidden]):not(:disabled), textarea:not(:disabled), select:not(:disabled)")
        ?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="modal-title"
      className={`m-auto w-[calc(100%-2rem)] ${size === "lg" ? "max-w-2xl" : "max-w-lg"} rounded-xl border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-ink/40`}
    >
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
        <h2 id="modal-title" className="text-base font-semibold">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="rounded-md px-2 py-1 text-lg leading-none text-muted hover:bg-canvas hover:text-ink"
        >
          ×
        </button>
      </div>
      <div ref={bodyRef} className="max-h-[75vh] overflow-y-auto px-5 py-4">
        {open ? children : null}
      </div>
    </dialog>
  );
}
