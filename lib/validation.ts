import { HttpError } from "@/lib/errors";

interface StringOptions {
  label: string;
  required?: boolean;
  max?: number;
}

export function has(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

/** Строка с trim. Пустая строка → null (или ошибка, если поле обязательное). */
export function readString(value: unknown, { label, required = false, max = 1000 }: StringOptions): string | null {
  if (value === undefined || value === null) {
    if (required) throw new HttpError(400, `Заполните поле «${label}»`);
    return null;
  }
  if (typeof value !== "string") throw new HttpError(400, `Поле «${label}» должно быть строкой`);
  const trimmed = value.trim();
  if (!trimmed) {
    if (required) throw new HttpError(400, `Заполните поле «${label}»`);
    return null;
  }
  if (trimmed.length > max) throw new HttpError(400, `Поле «${label}» длиннее ${max} символов`);
  return trimmed;
}

export function readRequiredString(value: unknown, options: Omit<StringOptions, "required">): string {
  return readString(value, { ...options, required: true }) as string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function readEmail(value: unknown, required = false): string | null {
  const email = readString(value, { label: "Email", required, max: 254 });
  if (email === null) return null;
  const normalized = email.toLowerCase();
  if (!EMAIL_RE.test(normalized)) throw new HttpError(400, "Некорректный email");
  return normalized;
}

export function readPhone(value: unknown): string {
  const phone = readRequiredString(value, { label: "Телефон", max: 50 });
  if ((phone.match(/\d/g) ?? []).length < 5) {
    throw new HttpError(400, "Телефон должен содержать хотя бы 5 цифр");
  }
  return phone;
}

export function readEnum<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new HttpError(400, `Недопустимое значение поля «${label}»`);
  }
  return value as T;
}

export function readMoney(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/\s/g, "").replace(",", "."))
        : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1e12) {
    throw new HttpError(400, "Сумма должна быть неотрицательным числом");
  }
  return Math.round(parsed * 100) / 100;
}

export function readDate(value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new HttpError(400, `Некорректная дата в поле «${label}»`);
  }
  return value;
}

export function readId(value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 64) {
    throw new HttpError(400, `Некорректный идентификатор: ${label}`);
  }
  return value;
}

export function readBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new HttpError(400, `Поле «${label}» должно быть true/false`);
  return value;
}

/** bcrypt учитывает только первые 72 байта — длиннее не принимаем. */
export function readNewPassword(value: unknown, minLength: number): string {
  if (typeof value !== "string" || value.length < minLength) {
    throw new HttpError(400, `Пароль должен быть не короче ${minLength} символов`);
  }
  if (new TextEncoder().encode(value).length > 72) {
    throw new HttpError(400, "Пароль слишком длинный (максимум 72 байта)");
  }
  return value;
}
