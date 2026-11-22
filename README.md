# CRM

Внутренняя CRM: заявки (Kanban), клиенты, задачи, дашборд с графиками, управление сотрудниками.
Стек: Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Turso (libSQL) · JWT в httpOnly-cookie · @dnd-kit · recharts.

## Быстрый старт (локально)

```bash
npm install
cp .env.example .env.local   # заполните JWT_SECRET и ADMIN_PASSWORD
npm run seed:admin           # создаст таблицы и первого администратора
npm run seed:demo            # необязательно: демо-менеджеры, клиенты, заявки, задачи
npm run dev                  # http://localhost:3000
```

Локально база — файл `local.db` (`TURSO_DATABASE_URL=file:local.db`), Turso-аккаунт не нужен.

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | dev-сервер |
| `npm run build` / `npm start` | продакшен-сборка и запуск |
| `npm run typecheck` | проверка типов |
| `npm run db:migrate` | применить схему (идемпотентно, `create table if not exists`) |
| `npm run seed:admin` | создать admin из `ADMIN_EMAIL` / `ADMIN_PASSWORD`, если его ещё нет |
| `npm run seed:demo` | демо-данные; только в локальную базу и только если заявок ещё нет (`--force`, `--allow-remote`) |

## Деплой на Vercel + Turso

1. `turso db create crm` → `turso db show crm --url` и `turso db tokens create crm`.
2. Локально с этими значениями в `.env.local` выполните `npm run seed:admin` — создаст схему и админа в Turso.
3. В Vercel задайте переменные `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `JWT_SECRET`, `APP_TIMEZONE`.

## Роли

- **admin** — все заявки, клиенты, задачи; управление сотрудниками; полная аналитика с разбивкой по сотрудникам.
- **manager** — только свои заявки и задачи (назначенные на него); может создавать клиентов и заявки; аналитика только по себе.

Права проверяются в каждом API route (`lib/http.ts` → `requireApiUser`, `assertAdmin`), а не только скрытием кнопок.
`proxy.ts` (в Next.js 16 так называется бывший `middleware.ts`) делает быструю проверку подписи JWT и закрывает `/users` для не-админов.

## Отличия от спецификации

- `proxy.ts` вместо `middleware.ts` — переименование в Next.js 16.
- Роль и активность пользователя на каждом запросе берутся из БД, а не из JWT: деактивированный сотрудник теряет доступ сразу, а не через 7 дней.
- Две служебные колонки: `clients.search` (поиск по кириллице без учёта регистра — `LIKE` в SQLite этого не умеет) и `leads.closed_at` (для «среднего времени закрытия»).
- Страницы приложения лежат в группе маршрутов `app/(crm)/…` — общий layout с меню; URL такие же, как в спецификации.
- Изменяющие запросы к API с чужого `Origin` отклоняются (защита от CSRF).

## Осознанные упрощения (MVP)

- Нет rate limiting на `/api/auth/login`.
- Нет истории изменений заявки — только текущее состояние и свободные заметки.
- Нет email/Telegram-напоминаний — только подсветка просроченных задач и счётчик в меню.
- Нет смены пароля самим сотрудником — пароль меняет администратор на странице «Сотрудники».
- Интеграции с формой сайта и Telegram-ботом (раздел 13 спецификации) не реализованы; точка входа — `lib/leads.ts` → `createLead`.
