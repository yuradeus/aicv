# CV AI: резюме + AI‑матчинг + платформа

Это репозиторий для:
- личного сайта‑резюме (статические файлы)
- AI‑фичи “насколько кандидат подходит под вакансию”
- (опционально) платформы, где пользователи создают/публикуют своё резюме через Supabase

## Структура

- `resume/` — личная публичная страница резюме (статическая) + AI‑виджет
- `api/` — Vercel serverless function `/api/match` (ключи OpenRouter остаются на сервере)
- `app/` — вход по email + кабинет (Supabase)
- `u/` — публичная страница резюме по ссылке `/u/<slug>` (Supabase)
- `supabase/schema.sql` — SQL для таблицы и RLS

## Быстрый старт (локально)

- Откройте `resume/index.html` в браузере — будет показан контент из `resume/profile.json` и `resume/resume.md`.

## Деплой бесплатно

- **Сайт + API**: Vercel (рекомендуется, потому что нужен `/api/match` для AI)
- **Платформа резюме пользователей**: Supabase (Auth + Postgres + RLS)

## Редактирование резюме (только владелец)

Резюме хранится прямо в репозитории:

- `resume/profile.json` — имя/заголовок/ссылка на фото
- `resume/resume.md` — текст резюме в Markdown

Чтобы обновить резюме:
- отредактируйте эти файлы на GitHub (кнопка ✏️ Edit) или локально
- сделайте commit → Vercel/GitHub Pages автоматически обновят сайт

Фото можно положить в репозиторий как `resume/avatar.jpg` и указать в `resume/profile.json`:

```json
{ "photoUrl": "./avatar.jpg" }
```

## Настройка AI (Vercel + OpenRouter)

Мы используем OpenRouter (OpenAI‑совместимый endpoint) и модель DeepSeek V3.

Документация OpenRouter:
- API chat completions: `https://openrouter.ai/docs/api-reference/chat-completion`
- Быстрый старт: `https://openrouter.ai/docs/quick-start`

На Vercel функция находится в `api/match.js` и вызывается фронтендом по `POST /api/match`.

### Переменные окружения на Vercel

- `OPENROUTER_API_KEY` — **обязательно**
- `OPENROUTER_MODEL` — опционально (по умолчанию `deepseek/deepseek-chat-v3-0324`)
- `OPENROUTER_SITE_URL` — опционально (для заголовка `HTTP-Referer`)
- `OPENROUTER_APP_NAME` — опционально (для заголовка `X-OpenRouter-Title`)

## Деплой на Vercel (рекомендуется)

1) Зайдите на Vercel и импортируйте репозиторий GitHub `yuradeus/aicv`.
2) Framework preset: **Other** (без сборки).
3) Добавьте Environment Variables (см. выше).
4) Deploy.

После деплоя AI‑кнопка начнёт работать автоматически (через `/api/match`).

## Платформа: пользователи создают своё резюме (Supabase)

1) В Supabase создайте проект и включите Email provider (magic link/OTP).
2) Выполните SQL из `supabase/schema.sql` в Supabase SQL Editor.
3) В Supabase Auth → URL Configuration добавьте Site URL и Redirect URLs для вашего домена Vercel.

Страницы:
- `/app/` — вход по email
- `/app/dashboard.html` — редактор и Publish/Unpublish
- `/u/<slug>` — публичная страница (доступна только после Publish)

## Деплой на Vercel

Импортируйте репозиторий в Vercel (preset **Other**) и добавьте env vars OpenRouter (см. выше).

