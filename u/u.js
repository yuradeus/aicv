import { supabase } from "../app/supabase.js";

const sb = supabase();

function el(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  el(id).textContent = value ?? "";
}

function setStatus(text) {
  el("matchStatus").textContent = text || "";
}

function setAvatar(url) {
  const img = el("avatarImg");
  const u = String(url || "").trim();
  if (!u) {
    img.removeAttribute("src");
    img.style.display = "none";
    return;
  }
  img.src = u;
  img.style.display = "block";
}

function formatDate(value) {
  try {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(d);
  } catch {
    return "—";
  }
}

function getSlug() {
  const u = new URL(window.location.href);
  const fromQuery = u.searchParams.get("slug");
  if (fromQuery) return fromQuery.trim();
  const parts = u.pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("u");
  if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
  return "";
}

function badgeByPercent(pct) {
  if (pct >= 75) return { cls: "badgeGood", label: "Сильный матч" };
  if (pct >= 45) return { cls: "badgeOk", label: "Средний матч" };
  return { cls: "badgeBad", label: "Слабый матч" };
}

function showResult({ percent, summary }) {
  const box = el("resultBox");
  const badge = el("matchBadge");
  const pctEl = el("matchPercent");
  const textEl = el("matchText");

  const pct = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  const b = badgeByPercent(pct);

  badge.classList.remove("badgeGood", "badgeOk", "badgeBad");
  badge.classList.add(b.cls);
  badge.textContent = b.label;
  pctEl.textContent = `${pct}%`;
  textEl.textContent = summary || "—";
  box.style.display = "block";
}

let currentResumeMarkdown = "";

function showWrap(id, show) {
  const w = el(id);
  if (w) w.style.display = show ? "block" : "none";
}

function setBlock(wrapId, outId, text) {
  const t = String(text || "").trim();
  showWrap(wrapId, Boolean(t));
  const out = el(outId);
  if (out) out.textContent = t;
}

function addContact(list, label, href, text) {
  if (!href || !text) return;
  const li = document.createElement("li");
  const a = document.createElement("a");
  a.href = href;
  a.textContent = text;
  if (href.startsWith("http://") || href.startsWith("https://")) {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  }
  li.append(`${label}: `);
  li.appendChild(a);
  list.appendChild(li);
}

async function loadResume() {
  const slug = getSlug();
  if (!slug) {
    setText("subline", "Некорректная ссылка.");
    showWrap("aboutWrap", true);
    setText("aboutOut", "Slug не найден.");
    return;
  }

  setText("subline", "Загружаю…");
  const { data, error } = await sb
    .from("resumes")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error) {
    console.error(error);
    setText("subline", "Ошибка загрузки.");
    showWrap("aboutWrap", true);
    setText("aboutOut", "Ошибка загрузки.");
    return;
  }
  if (!data) {
    setText("subline", "Резюме не найдено или приватно.");
    showWrap("aboutWrap", true);
    setText("aboutOut", "Резюме не найдено.");
    return;
  }

  const first = String(data.display_name || "").trim();
  const last = String(data.last_name || "").trim();
  let position = String(data.title || "").trim();
  let effectiveLast = last;
  if (!effectiveLast && position && /^[А-Яа-яЁё-]{2,}$/.test(position)) {
    effectiveLast = position;
    position = "";
  }
  const fullName = [first, effectiveLast].filter(Boolean).join(" ").trim() || "Кандидат";
  setText("candidateName", fullName);
  setText("candidateTitle", position || "Резюме");
  setAvatar(data.photo_url || "");
  setText("updatedAt", formatDate(data.updated_at));
  setText("subline", "");

  currentResumeMarkdown = data.markdown || "";
  setBlock("aboutWrap", "aboutOut", data.about);
  setBlock("experienceWrap", "experienceOut", data.experience);
  setBlock("educationWrap", "educationOut", data.education);
  setBlock("skillsWrap", "skillsOut", data.skills);

  const list = el("contactsList");
  if (list) list.innerHTML = "";
  const tg = String(data.telegram || "").trim().replace(/^@+/, "");
  const email = String(data.email || "").trim();
  const phoneRaw = String(data.phone || "").trim();
  const phoneDigits = phoneRaw.replace(/[^\d+]/g, "");
  const phoneHref = phoneDigits ? `tel:${phoneDigits}` : "";

  const hasContacts = Boolean(tg || email || phoneRaw || String(data.contacts || "").trim());
  showWrap("contactsWrap", hasContacts);
  if (list) {
    if (tg) addContact(list, "Telegram", `https://t.me/${tg}`, `@${tg}`);
    if (email) addContact(list, "Email", `mailto:${email}`, email);
    if (phoneRaw) addContact(list, "Phone", phoneHref, phoneRaw);

    const other = String(data.contacts || "").trim();
    if (other) {
      const li = document.createElement("li");
      li.className = "classicText";
      li.textContent = other;
      list.appendChild(li);
    }
  }
}

function initCopyLink() {
  el("copyLinkBtn").addEventListener("click", async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      el("copyLinkBtn").textContent = "Скопировано";
      setTimeout(() => (el("copyLinkBtn").textContent = "Скопировать ссылку"), 1200);
    } catch {
      window.prompt("Скопируйте ссылку:", url);
    }
  });
}

function initAiMatch() {
  const matchBtn = el("matchBtn");
  const vacancyUrl = el("vacancyUrl");
  const vacancyText = el("vacancyText");

  matchBtn.addEventListener("click", async () => {
    const payload = {
      vacancyUrl: vacancyUrl.value.trim() || null,
      vacancyText: vacancyText.value.trim() || null,
      resumeText: (currentResumeMarkdown || "").slice(0, 25000),
    };

    if (!payload.resumeText.trim()) {
      setStatus("Резюме пустое.");
      return;
    }
    if (!payload.vacancyUrl && !payload.vacancyText) {
      setStatus("Вставьте ссылку на вакансию или текст описания.");
      return;
    }

    setStatus("Анализирую…");
    matchBtn.disabled = true;
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const out = await res.json();
      showResult(out);
      setStatus("");
    } catch (e) {
      console.error(e);
      setStatus("Не получилось сделать анализ. Попробуйте вставить текст вакансии.");
    } finally {
      matchBtn.disabled = false;
    }
  });
}

initCopyLink();
initAiMatch();
loadResume();

