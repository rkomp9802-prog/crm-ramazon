// Вызовы API из клиентских компонентов.

interface ApiOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
}

export async function api<T>(url: string, { method = "GET", body }: ApiOptions = {}): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // пустой или не-JSON ответ
  }

  if (!response.ok) {
    if (response.status === 401) window.location.assign("/login");
    const message =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : `Ошибка ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Неизвестная ошибка";
}
