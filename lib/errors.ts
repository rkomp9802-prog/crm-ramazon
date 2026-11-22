/** Ошибка, которую API route превращает в JSON-ответ с нужным статусом. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
