/**
 * Vercel Serverless Function
 * POST /api/match
 *
 * Env vars:
 * - OPENROUTER_API_KEY (required)
 * - OPENROUTER_MODEL (optional, default: deepseek/deepseek-chat-v3-0324)
 * - OPENROUTER_SITE_URL (optional, for attribution header HTTP-Referer)
 * - OPENROUTER_APP_NAME (optional, for attribution header X-OpenRouter-Title)
 */

const vm = require("vm");

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  return await new Promise((resolve, reject) => {
    let buf = "";
    req.on("data", (chunk) => {
      buf += chunk;
      if (buf.length > 2_000_000) reject(new Error("Payload too large"));
    });
    req.on("end", () => resolve(buf));
    req.on("error", reject);
  });
}

function textToPlain(html) {
  return (
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function zamesinVacancyToText(vacancy) {
  if (!vacancy) return "";
  const parts = [];
  parts.push("ИСТОЧНИК: zamesin.ru");
  if (vacancy.id) parts.push(`ID: ${textToPlain(vacancy.id)}`);
  if (vacancy.title) parts.push(`ВАКАНСИЯ: ${textToPlain(vacancy.title)}`);
  if (vacancy.subtitle) parts.push(`Подзаголовок: ${textToPlain(vacancy.subtitle)}`);
  if (vacancy.description) parts.push(`Коротко: ${textToPlain(vacancy.description)}`);
  if (vacancy.intro) parts.push(`Введение: ${textToPlain(vacancy.intro)}`);
  if (Array.isArray(vacancy.categories) && vacancy.categories.length) {
    parts.push(`Категории: ${vacancy.categories.map(textToPlain).filter(Boolean).join(", ")}`);
  }
  if (Array.isArray(vacancy.tags) && vacancy.tags.length) {
    parts.push(`Теги: ${vacancy.tags.map(textToPlain).filter(Boolean).join(", ")}`);
  }

  const addListSection = (title, items) => {
    const arr = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!arr.length) return;
    parts.push("");
    parts.push(title);
    for (const x of arr) parts.push(`- ${textToPlain(x)}`);
  };

  addListSection("Детали:", vacancy.cardDetails);

  if (Array.isArray(vacancy.sections) && vacancy.sections.length) {
    parts.push("");
    parts.push("Секции:");
    for (const s of vacancy.sections) {
      if (!s) continue;
      const title = textToPlain(s.title || s.name || "Раздел");
      parts.push("");
      parts.push(title);
      if (s.text) parts.push(textToPlain(s.text));
      if (Array.isArray(s.items)) {
        for (const it of s.items) parts.push(`- ${textToPlain(it)}`);
      }
      if (Array.isArray(s.points)) {
        for (const it of s.points) parts.push(`- ${textToPlain(it)}`);
      }
    }
  }

  if (Array.isArray(vacancy.hiringProcess) && vacancy.hiringProcess.length) {
    parts.push("");
    parts.push("Процесс найма:");
    vacancy.hiringProcess.forEach((step, i) => {
      if (step == null) return;
      if (typeof step === "string") {
        parts.push(`${i + 1}. ${textToPlain(step)}`);
        return;
      }
      if (typeof step === "object") {
        const title = textToPlain(step.title || step.name || "");
        const text = textToPlain(step.text || step.description || "");
        if (title && text) parts.push(`${i + 1}. ${title} — ${text}`);
        else if (title) parts.push(`${i + 1}. ${title}`);
        else if (text) parts.push(`${i + 1}. ${text}`);
        return;
      }
      parts.push(`${i + 1}. ${textToPlain(String(step))}`);
    });
  }

  if (vacancy.contactUrl) {
    parts.push("");
    parts.push(`Ссылка для отклика/контакта: ${String(vacancy.contactUrl).trim()}`);
  }

  // "Ничего не упустить": приложим сырой JSON вакансии (обрежется общим лимитом).
  try {
    const raw = JSON.stringify(vacancy);
    if (raw) {
      parts.push("");
      parts.push("RAW_JSON:");
      parts.push(raw);
    }
  } catch {
    // ignore
  }

  return parts.join("\n").trim().slice(0, 60_000);
}

async function fetchZamesinVacancyText(vacancyUrl) {
  const u = new URL(vacancyUrl);
  const id = (u.searchParams.get("id") || "").trim();
  if (!id) throw new Error("Missing id in zamesin vacancy url");

  const jsUrl = new URL("/jobs/data/vacancies.js?v=3", u.origin).toString();
  const res = await fetch(jsUrl, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; ResumeMatchBot/1.0; +https://example.invalid)",
      accept: "*/*",
    },
  });
  const js = await res.text();
  if (!res.ok) throw new Error(`zamesin vacancies.js fetch failed: ${res.status}`);

  // Safe-ish evaluation in isolated context; we only need the `vacancies` array.
  const code = `${js}\n;vacancies`;
  const vacanciesArr = vm.runInNewContext(code, Object.create(null), { timeout: 1000 });
  if (!Array.isArray(vacanciesArr)) throw new Error("zamesin vacancies parse failed");

  const vacancy = vacanciesArr.find((v) => v && String(v.id) === id);
  if (!vacancy) throw new Error(`zamesin vacancy id not found: ${id}`);
  return zamesinVacancyToText(vacancy);
}

async function fetchVacancyText(url) {
  const u = new URL(url);
  if (u.hostname === "zamesin.ru" && u.pathname === "/jobs/vacancy.html") {
    return await fetchZamesinVacancyText(url);
  }

  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; ResumeMatchBot/1.0; +https://example.invalid)",
      accept: "text/html,application/xhtml+xml",
    },
  });
  const ct = res.headers.get("content-type") || "";
  const body = await res.text();
  if (!res.ok) throw new Error(`Vacancy fetch failed: ${res.status}`);
  if (!ct.includes("text/html")) return body.slice(0, 60_000);
  return textToPlain(body).slice(0, 60_000);
}

function clampPct(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function safeSummary(s) {
  const str = String(s || "").trim();
  return str.length > 0 ? str.slice(0, 900) : "—";
}

function safeResumeText(s) {
  const str = String(s || "").trim();
  return str.length > 0 ? str.slice(0, 25_000) : "";
}

async function openRouterMatch({ apiKey, model, siteUrl, appName, resumeText, vacancyText }) {
  const system = [
    "Ты — помощник рекрутера.",
    "Оцени, насколько кандидат подходит под вакансию.",
    "Верни ответ СТРОГО в JSON без markdown, без лишних полей:",
    '{ "percent": number, "summary": string }',
    "percent: 0..100",
    "summary: 2–4 коротких предложения на русском: сильные стороны + риски/пробелы",
    "Если данных мало — снижай уверенность и процент.",
  ].join("\n");

  const user = `РЕЗЮМЕ:\n${resumeText}\n\nВАКАНСИЯ:\n${vacancyText}`.slice(0, 120_000);

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
  };
  if (siteUrl) headers["HTTP-Referer"] = siteUrl;
  if (appName) headers["X-OpenRouter-Title"] = appName;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 400,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`OpenRouter error ${res.status}: ${JSON.stringify(data).slice(0, 350)}`);
  }

  const text = data?.choices?.[0]?.message?.content || "";
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const m = String(text).match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : null;
  }
  if (!parsed) throw new Error("Failed to parse model JSON");

  return {
    percent: clampPct(parsed.percent),
    summary: safeSummary(parsed.summary),
  };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Use POST" });
  }

  const apiKey = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) return sendJson(res, 500, { error: "Missing OPENROUTER_API_KEY" });

  const model = (process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat-v3-0324").trim();
  const siteUrl = (process.env.OPENROUTER_SITE_URL || "").trim();
  const appName = (process.env.OPENROUTER_APP_NAME || "ResumeMatch").trim();

  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (e) {
    return sendJson(res, 400, { error: "Invalid JSON", details: String(e?.message || e) });
  }

  const vacancyUrl = typeof body?.vacancyUrl === "string" ? body.vacancyUrl.trim() : "";
  const vacancyTextInput = typeof body?.vacancyText === "string" ? body.vacancyText.trim() : "";
  const resumeText = safeResumeText(body?.resumeText);

  if (!resumeText) return sendJson(res, 400, { error: "resumeText required" });
  if (!vacancyUrl && !vacancyTextInput) {
    return sendJson(res, 400, { error: "vacancyUrl or vacancyText required" });
  }

  let vacancyText = vacancyTextInput;
  if (!vacancyText && vacancyUrl) {
    try {
      vacancyText = await fetchVacancyText(vacancyUrl);
    } catch (e) {
      return sendJson(res, 400, {
        error: "Не удалось загрузить вакансию по ссылке. Вставьте текст вакансии вручную.",
        details: String(e?.message || e),
      });
    }
  }

  try {
    const out = await openRouterMatch({
      apiKey,
      model,
      siteUrl,
      appName,
      resumeText,
      vacancyText,
    });
    return sendJson(res, 200, out);
  } catch (e) {
    return sendJson(res, 502, { error: "AI request failed", details: String(e?.message || e) });
  }
};

