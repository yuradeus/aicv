import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

const DEMO = {
  name: "Ваше Имя",
  title: "Должность • Город • Формат работы",
  updatedAt: null,
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

function renderResume(data, sourceLabel) {
  setText("candidateName", data?.name || DEMO.name);
  setText("candidateTitle", data?.title || DEMO.title);
  setText("dataSource", sourceLabel);
  setText("updatedAt", formatDate(data?.updatedAt || null));

  const content = document.getElementById("resumeContent");
  const md = data?.resumeMarkdown || DEMO.resumeMarkdown;
  currentResumeMarkdown = md;
  content.innerHTML = window.marked.parse(md);
}

async function tryLoadFromFirestore() {
  if (!firebaseConfig || firebaseConfig.apiKey === "REPLACE_ME") return null;
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const ref = doc(db, "public", "resume");
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data();
}

async function initResume() {
  try {
    const data = await tryLoadFromFirestore();
    if (!data) return renderResume(DEMO, "demo");
    return renderResume(data, "firestore");
  } catch (e) {
    console.warn("Failed to load resume from Firestore:", e);
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
  const clearBtn = document.getElementById("clearBtn");
  const vacancyUrl = document.getElementById("vacancyUrl");
  const vacancyText = document.getElementById("vacancyText");

  clearBtn.addEventListener("click", () => {
    vacancyUrl.value = "";
    vacancyText.value = "";
    setStatus("");
    document.getElementById("resultBox").style.display = "none";
  });

  matchBtn.addEventListener("click", async () => {
    const base = (cfg().aiApiBaseUrl || "").trim().replace(/\/+$/, "");
    if (!base) {
      setStatus("AI пока не настроен. Владельцу: разверните Cloudflare Worker и укажите aiApiBaseUrl в resume/config.js");
      return;
    }

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
      const res = await fetch(`${base}/match`, {
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

