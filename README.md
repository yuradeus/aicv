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

## Настройка AI (Cloudflare Worker)

1) Установите и залогиньтесь в Wrangler:

```bash
npm i -g wrangler
wrangler login
```

2) Перейдите в `worker/` и задайте секреты:

```bash
cd worker
wrangler secret put GEMINI_API_KEY
```

3) Деплой воркера:

```bash
wrangler deploy
```

4) Впишите URL воркера в `resume/config.js`:
- `aiApiBaseUrl: "https://<your-worker>.<your-subdomain>.workers.dev"`

## Деплой фронтенда на GitHub Pages

1) Создайте новый репозиторий на новом GitHub аккаунте.
2) Запушьте содержимое папки `HH AI` в этот репозиторий.
3) В репозитории GitHub → Settings → Pages:
- Source: Deploy from a branch
- Branch: `main`, folder `/ (root)`

Сайт будет доступен по ссылке GitHub Pages, а резюме по пути `/resume/`.

