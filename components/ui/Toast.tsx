"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type ToastKind = "success" | "error";
type PushToast = (message: string, kind?: ToastKind) => void;

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

const ToastContext = createContext<PushToast>(() => {});
let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback<PushToast>((message, kind = "success") => {
    const id = ++nextId;
    setToasts((current) => [...current, { id, message, kind }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), kind === "error" ? 6000 : 3500);
  }, []);

  return (
    <ToastContext value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.kind === "error" ? "alert" : "status"}
            className={`pointer-events-auto max-w-sm rounded-lg px-4 py-3 text-sm shadow-lg ${
              toast.kind === "error" ? "bg-red-700 text-white" : "bg-ink text-white"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext>
  );
}

export function useToast(): PushToast {
  return useContext(ToastContext);
}
