/**
 * Cloudflare Worker: POST /match
 *
 * Secrets (set via `wrangler secret put ...`):
 * - GEMINI_API_KEY
 *
 * Input JSON:
 * - vacancyUrl?: string | null
 * - vacancyText?: string | null
 * - resumeText?: string | null
 *
 * Output JSON:
 * - percent: number
 * - summary: string
 */

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    },
    ...init,
  });
}

function textToPlain(html) {
  return (
    html
      // remove scripts/styles
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      // strip tags
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

async function fetchVacancyText(url) {
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
  if (!ct.includes("text/html")) {
    // still try to treat as text
    return body.slice(0, 60_000);
  }
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

async function geminiMatch({ apiKey, resumeText, vacancyText }) {
  const prompt = `
Ты — помощник рекрутера. Твоя задача: оценить, насколько кандидат подходит под вакансию.

Верни ответ СТРОГО в JSON без markdown, без лишних полей:
{
  "percent": number,        // 0..100
  "summary": string         // 2-4 коротких предложения на русском: сильные стороны, риски/пробелы
}

Критерии:
- Сначала требования/стек/опыт из вакансии → потом сравнение с резюме.
- Если данных мало — снижай уверенность и процент.

РЕЗЮМЕ (текст):
${resumeText}

ВАКАНСИЯ (текст):
${vacancyText}
`.trim();

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
    encodeURIComponent(apiKey);

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 500,
        responseMimeType: "application/json",
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Gemini error: ${res.status} ${JSON.stringify(data).slice(0, 300)}`
    );
  }

  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") || "";

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    // fallback: try to find JSON object
    const m = text.match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : null;
  }
  if (!parsed) throw new Error("Failed to parse Gemini JSON output");

  return {
    percent: clampPct(parsed.percent),
    summary: safeSummary(parsed.summary),
  };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return json({ ok: true });
    if (request.method !== "POST") return json({ error: "Use POST" }, { status: 405 });

    const url = new URL(request.url);
    if (url.pathname !== "/match") return json({ error: "Not found" }, { status: 404 });

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, { status: 400 });
    }

    const vacancyUrl = typeof body?.vacancyUrl === "string" ? body.vacancyUrl.trim() : "";
    const vacancyTextInput = typeof body?.vacancyText === "string" ? body.vacancyText.trim() : "";
    const resumeTextInput = safeResumeText(body?.resumeText);

    if (!vacancyUrl && !vacancyTextInput) {
      return json({ error: "vacancyUrl or vacancyText required" }, { status: 400 });
    }

    if (!resumeTextInput) {
      return json({ error: "resumeText required" }, { status: 400 });
    }

    let vacancyText = vacancyTextInput;
    if (!vacancyText && vacancyUrl) {
      try {
        vacancyText = await fetchVacancyText(vacancyUrl);
      } catch (e) {
        return json(
          {
            error:
              "Не удалось загрузить вакансию по ссылке. Вставьте текст вакансии вручную.",
            details: String(e?.message || e),
          },
          { status: 400 }
        );
      }
    }

    const apiKey = (env.GEMINI_API_KEY || "").trim();
    if (!apiKey) {
      return json(
        { error: "Worker not configured: set GEMINI_API_KEY secret." },
        { status: 500 }
      );
    }

    try {
      const out = await geminiMatch({ apiKey, resumeText: resumeTextInput, vacancyText });
      return json(out);
    } catch (e) {
      return json(
        { error: "AI request failed", details: String(e?.message || e) },
        { status: 502 }
      );
    }
  },
};

