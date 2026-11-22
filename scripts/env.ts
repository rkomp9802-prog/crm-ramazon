import { existsSync } from "node:fs";

// Скрипты запускаются вне Next.js, поэтому .env.local подгружаем сами.
// Уже заданные переменные окружения не перезаписываются, .env.local важнее .env.
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}
