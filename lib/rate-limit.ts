import type { InStatement } from "@libsql/client";
import { getDb } from "@/lib/turso";

/**
 * Ограничение перебора паролей. Счётчики хранятся в БД (таблица login_attempts), а не в памяти:
 * на Vercel у каждого экземпляра функции своя память, и счётчик в памяти ничего бы не защищал.
 *
 * Порядок работы: getBlockedUntil → registerAttempt → проверка пароля → при успехе forgiveAttempt.
 * Попытка засчитывается ДО медленной проверки bcrypt: пачка параллельных запросов не проскочит
 * лимит — каждый следующий запрос видит уже увеличенный счётчик.
 */

/** Окно подсчёта попыток и длительность блокировки. */
export const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

export interface LimitRule {
  key: string;
  /** Сколько неудачных попыток в окне допускается; следующая уже отклоняется. */
  max: number;
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

/** Самый поздний момент разблокировки среди ключей — или null, если ни один сейчас не заблокирован. */
export async function getBlockedUntil(keys: string[]): Promise<Date | null> {
  if (keys.length === 0) return null;
  const rs = await getDb().execute({
    sql: `select max(blocked_until) as until from login_attempts
          where key in (${placeholders(keys.length)}) and blocked_until > ?`,
    args: [...keys, new Date().toISOString()],
  });
  const until = rs.rows[0]?.until;
  return until ? new Date(String(until)) : null;
}

/**
 * Засчитать попытку по всем правилам. Если по какому-то правилу попыток стало больше max,
 * этот ключ блокируется на окно, а функция возвращает момент разблокировки — пароль тогда
 * проверять не нужно. Иначе null.
 */
export async function registerAttempt(rules: LimitRule[]): Promise<Date | null> {
  if (rules.length === 0) return null;
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const windowCutoff = new Date(now - ATTEMPT_WINDOW_MS).toISOString();
  const keys = rules.map((rule) => rule.key);

  const statements: InStatement[] = rules.map((rule) => ({
    // Окно истекло — считаем заново, иначе +1. В SQLite правые части SET видят старые значения строки.
    sql: `insert into login_attempts (key, failures, window_start, blocked_until) values (?, 1, ?, null)
          on conflict(key) do update set
            failures = case when window_start < ? then 1 else failures + 1 end,
            window_start = case when window_start < ? then excluded.window_start else window_start end`,
    args: [rule.key, nowIso, windowCutoff, windowCutoff],
  }));
  // Подчищаем записи старше суток, чтобы таблица не росла.
  statements.push({
    sql: "delete from login_attempts where window_start < ? and (blocked_until is null or blocked_until < ?)",
    args: [new Date(now - 24 * 60 * 60 * 1000).toISOString(), nowIso],
  });
  statements.push({
    sql: `select key, failures from login_attempts where key in (${placeholders(keys.length)})`,
    args: keys,
  });

  const results = await getDb().batch(statements, "write");
  const counts = new Map(results[results.length - 1]!.rows.map((row) => [String(row.key), Number(row.failures)]));
  const exceeded = rules.filter((rule) => (counts.get(rule.key) ?? 0) > rule.max).map((rule) => rule.key);
  if (exceeded.length === 0) return null;

  const blockedUntil = new Date(now + ATTEMPT_WINDOW_MS);
  await getDb().execute({
    sql: `update login_attempts set blocked_until = ?
          where key in (${placeholders(exceeded.length)}) and (blocked_until is null or blocked_until < ?)`,
    args: [blockedUntil.toISOString(), ...exceeded, nowIso],
  });
  return blockedUntil;
}

/**
 * Попытка оказалась успешной: снимаем её со счётчиков (это не была ошибка),
 * а ключи из resetKeys обнуляем совсем.
 */
export async function forgiveAttempt(rules: LimitRule[], resetKeys: string[] = []): Promise<void> {
  const decrementKeys = rules.map((rule) => rule.key).filter((key) => !resetKeys.includes(key));
  const statements: InStatement[] = [];
  if (decrementKeys.length) {
    statements.push({
      sql: `update login_attempts set failures = max(failures - 1, 0) where key in (${placeholders(decrementKeys.length)})`,
      args: decrementKeys,
    });
  }
  if (resetKeys.length) {
    statements.push({
      sql: `delete from login_attempts where key in (${placeholders(resetKeys.length)})`,
      args: resetKeys,
    });
  }
  if (statements.length) await getDb().batch(statements, "write");
}

export async function resetAttempts(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await getDb().execute({ sql: `delete from login_attempts where key in (${placeholders(keys.length)})`, args: keys });
}

export function tooManyAttemptsMessage(until: Date): string {
  const minutes = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60_000));
  return `Слишком много неудачных попыток. Попробуйте через ${minutes} мин.`;
}

export function retryAfterSeconds(until: Date): number {
  return Math.max(1, Math.ceil((until.getTime() - Date.now()) / 1000));
}

/**
 * IP клиента или null, если прокси его не передал. На Vercel x-real-ip / x-forwarded-for
 * выставляет сама платформа. Без доверенного прокси заголовок можно подделать — поэтому
 * есть ещё и лимит по email, который от IP не зависит.
 */
export function clientIp(request: Request): string | null {
  const realIp = request.headers.get("x-real-ip")?.trim();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = realIp || forwarded;
  return ip ? ip.slice(0, 64) : null;
}
