import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export const inputClass =
  "block w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/70 " +
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:bg-canvas disabled:text-muted";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-strong",
  secondary: "border border-line bg-surface text-ink hover:bg-canvas",
  ghost: "text-muted hover:bg-canvas hover:text-ink",
  danger: "border border-red-200 bg-surface text-red-700 hover:bg-red-50",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md"): string {
  return [
    "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    "disabled:pointer-events-none disabled:opacity-50",
    size === "sm" ? "h-8 px-3 text-sm" : "h-9 px-4 text-sm",
    VARIANTS[variant],
  ].join(" ");
}

export function Button({
  variant,
  size,
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={`${buttonClass(variant, size)} ${className}`} {...props} />;
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputClass} ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${inputClass} pr-8 ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${inputClass} min-h-24 ${className}`} {...props} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </p>
  );
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap justify-end gap-2 pt-2">{children}</div>;
}
