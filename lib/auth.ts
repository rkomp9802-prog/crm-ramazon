import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { UserRole } from "@/types/crm.types";

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 дней

export const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_ROUNDS = 10;

export interface SessionPayload {
  userId: string;
  role: UserRole;
  /**
   * Версия сессий пользователя (users.session_version). Смена или сброс пароля увеличивает её —
   * все ранее выданные токены перестают приниматься.
   */
  sessionVersion: number;
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET не задан или короче 32 символов");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ userId: payload.userId, role: payload.role, sv: payload.sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

/** Возвращает payload валидного токена или null. Ошибку конфигурации (нет секрета) не глушит. */
export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const secret = getSecret();
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    const { userId, role, sv } = payload as Record<string, unknown>;
    if (typeof userId !== "string" || (role !== "admin" && role !== "manager")) return null;
    // Токены, выданные до появления версий сессий, считаются версией 0.
    return { userId, role, sessionVersion: typeof sv === "number" ? sv : 0 };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

let dummyHash: Promise<string> | undefined;

/**
 * Хэш-пустышка: если пользователя нет, всё равно делаем bcrypt.compare,
 * чтобы по времени ответа нельзя было понять, существует ли email.
 */
export function getDummyHash(): Promise<string> {
  dummyHash ??= bcrypt.hash("timing-equalizer-not-a-real-password", BCRYPT_ROUNDS);
  return dummyHash;
}
