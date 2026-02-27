const DEMO = {
  name: "Ваше Имя",
  title: "Должность • Город • Формат работы",
  updatedAt: null,
  photoUrl: null,
  resumeMarkdown: `# Ваше Имя

**Коротко:** 2–4 предложения о себе, опыте и сильных сторонах.

## Контакты
- Telegram: @username
- Email: you@example.com
- GitHub: https://github.com/you

## Навыки
- JavaScript/TypeScript
- Node.js
- SQL
- ...

## Опыт
**Компания / Роль** — 2024–2026  
- Достижение 1 (цифры/метрики)
- Достижение 2

## Проекты
- Проект 1 — ссылка + 1–2 строки
- Проект 2 — ссылка + 1–2 строки
`,
};

let currentResumeMarkdown = DEMO.resumeMarkdown;

function cfg() {
  return window.__RESUME_CONFIG__ || { aiApiBaseUrl: "" };
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "";
}

function formatDate(value) {
  try {
    if (!value) return "—";
    const d = typeof value === "string" ? new Date(value) : new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(d);
  } catch {
    return "—";
  }
}

function setAvatarPhoto(url) {
  const img = document.getElementById("avatarImg");
  if (!img) return;
  const u = typeof url === "string" ? url.trim() : "";
  if (!u) {
    img.removeAttribute("src");
    img.style.display = "none";
    return;
  }
  img.src = u;
  img.style.display = "block";
}

function renderResume(data, sourceLabel) {
  setText("candidateName", data?.name || DEMO.name);
  setText("candidateTitle", data?.title || DEMO.title);
  setText("dataSource", sourceLabel);
  setText("updatedAt", formatDate(data?.updatedAt || null));
  setAvatarPhoto(data?.photoUrl || null);

  const content = document.getElementById("resumeContent");
  const md = data?.resumeMarkdown || DEMO.resumeMarkdown;
  currentResumeMarkdown = md;
  content.innerHTML = window.marked.parse(md);
}

async function fetchJson(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return await res.json();
}

async function fetchText(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return await res.text();
}

async function initResume() {
  try {
    const profile = await fetchJson("./profile.json");
    const md = await fetchText("./resume.md");
    return renderResume(
      {
        name: profile?.name,
        title: profile?.title,
        photoUrl: profile?.photoUrl,
        updatedAt: profile?.updatedAt || null,
        resumeMarkdown: md,
      },
      "static"
    );
  } catch (e) {
    console.warn("Failed to load resume from static files:", e);
    renderResume(DEMO, "demo");
  }
}

function initCopyLink() {
  const btn = document.getElementById("copyLinkBtn");
  btn.addEventListener("click", async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      btn.textContent = "Ссылка скопирована";
      setTimeout(() => (btn.textContent = "Скопировать ссылку"), 1300);
    } catch {
      window.prompt("Скопируйте ссылку вручную:", url);
    }
  });
}

function badgeByPercent(pct) {
  if (pct >= 75) return { cls: "badgeGood", label: "Сильный матч" };
  if (pct >= 45) return { cls: "badgeOk", label: "Средний матч" };
  return { cls: "badgeBad", label: "Слабый матч" };
}

function setStatus(text) {
  const el = document.getElementById("matchStatus");
  el.textContent = text || "";
}

function showResult({ percent, summary }) {
  const box = document.getElementById("resultBox");
  const badge = document.getElementById("matchBadge");
  const pctEl = document.getElementById("matchPercent");
  const textEl = document.getElementById("matchText");

  const pct = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  const b = badgeByPercent(pct);

  badge.classList.remove("badgeGood", "badgeOk", "badgeBad");
  badge.classList.add(b.cls);
  badge.textContent = b.label;
  pctEl.textContent = `${pct}%`;
  textEl.textContent = summary || "—";
  box.style.display = "block";
}

async function initAiMatch() {
  const matchBtn = document.getElementById("matchBtn");
  const vacancyUrl = document.getElementById("vacancyUrl");
  const vacancyText = document.getElementById("vacancyText");

  matchBtn.addEventListener("click", async () => {
    const base = (cfg().aiApiBaseUrl || "").trim().replace(/\/+$/, "");
    const endpoint = base ? `${base}/match` : "/api/match";

    const payload = {
      vacancyUrl: vacancyUrl.value.trim() || null,
      vacancyText: vacancyText.value.trim() || null,
      resumeText: (currentResumeMarkdown || "").slice(0, 25000),
    };

    if (!payload.vacancyUrl && !payload.vacancyText) {
      setStatus("Вставьте ссылку на вакансию или текст описания.");
      return;
    }

    setStatus("Анализирую…");
    matchBtn.disabled = true;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status} ${res.statusText}: ${text}`);
      }

      const out = await res.json();
      showResult(out);
      setStatus("");
    } catch (e) {
      console.error(e);
      setStatus("Не получилось сделать анализ. Если ссылка не открывается — вставьте текст вакансии.");
    } finally {
      matchBtn.disabled = false;
    }
  });
}

setText("buildInfo", "resume-v1");
initCopyLink();
initResume();
initAiMatch();

