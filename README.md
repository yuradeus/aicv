# Resume site + admin + AI matching

Это отдельный репозиторий для сайта‑визитки (резюме), админки для редактирования и AI‑функции “насколько кандидат подходит под вакансию”.

## Структура

- `resume/` — публичная страница резюме + виджет AI‑матчинга + админка
- `worker/` — Cloudflare Worker (API), чтобы не светить AI‑ключ в браузере

## Быстрый старт (локально)

- Откройте `resume/index.html` в браузере — пока будет показан демо‑контент.
- Для админки откройте `resume/admin.html` (после настройки Firebase).

## Деплой бесплатно

- **Фронтенд**: GitHub Pages (папка репозитория)
- **Админка/данные**: Firebase (Auth + Firestore, бесплатный Spark)
- **AI API**: Cloudflare Worker (бесплатный tier) + любой AI‑провайдер по API‑ключу

## Настройка Firebase (Auth + Firestore)

1) Создайте проект в Firebase Console.

2) Создайте Web App и скопируйте конфиг в `resume/firebase-config.js`.

3) Включите Authentication:
- Sign-in method → **Email/Password** → Enable
- Создайте пользователя (ваш email + пароль) в Authentication → Users

4) Создайте Firestore Database (режим Production).

5) Firestore Rules (идея):
- чтение документа `public/resume` разрешить всем
- запись разрешить только авторизованным пользователям

Минимальный вариант правил (вставить в Firebase Console → Firestore → Rules):

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /public/resume {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

После этого:
- зайдите в `resume/admin.html`, выполните вход
- нажмите “Заполнить демо” → “Сохранить”
- откройте `resume/index.html` и убедитесь, что источник стал `firestore`

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

## Альтернатива: GitHub Pages + внешний API

Если хотите оставить GitHub Pages, то понадобится внешний API (например Cloudflare Worker). Тогда в `resume/config.js` задайте `aiApiBaseUrl`.

## Деплой фронтенда на GitHub Pages

1) Создайте новый репозиторий на новом GitHub аккаунте.
2) Запушьте содержимое папки `HH AI` в этот репозиторий.
3) В репозитории GitHub → Settings → Pages:
- Source: Deploy from a branch
- Branch: `main`, folder `/ (root)`

Сайт будет доступен по ссылке GitHub Pages, а резюме по пути `/resume/`.

