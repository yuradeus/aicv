# Cloudflare Worker (AI match)

Этот воркер нужен, чтобы **не хранить AI‑ключ в браузере** (GitHub Pages — статический хостинг).

## Что делает

- `POST /match` — принимает ссылку на вакансию или текст вакансии
- сравнивает с резюме (берёт `RESUME_TEXT` из env)
- возвращает JSON: `{ percent, summary }`

## Деплой (через Wrangler)

1) Установите Wrangler:

```bash
npm i -g wrangler
wrangler login
```

2) Задайте секреты:

```bash
cd worker
wrangler secret put GEMINI_API_KEY
wrangler secret put RESUME_TEXT
```

3) Запуск локально:

```bash
wrangler dev
```

4) Публикация:

```bash
wrangler deploy
```

После деплоя укажите URL воркера в `resume/config.js` → `aiApiBaseUrl`.

