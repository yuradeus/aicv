import { supabase } from "../app/supabase.js";

const sb = supabase();
const OWNER_SLUG = "home";

function el(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const node = el(id);
  if (node) node.textContent = value ?? "";
}

function setAvatar(url) {
  const img = el("avatarImg");
  if (!img) return;
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

function badgeByPercent(pct) {
  if (pct >= 75) return { cls: "badgeGood", label: "Сильный матч" };
  if (pct >= 45) return { cls: "badgeOk", label: "Средний матч" };
  return { cls: "badgeBad", label: "Слабый матч" };
}

function setStatus(text) {
  const s = el("matchStatus");
  if (s) s.textContent = text || "";
}

function showResult({ percent, summary }) {
  const box = el("resultBox");
  const badge = el("matchBadge");
  const pctEl = el("matchPercent");
  const textEl = el("matchText");
  if (!box || !badge || !pctEl || !textEl) return;

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

async function loadResume() {
  setText("resumeContent", "Загружаю…");

  const { data, error } = await sb
    .from("resumes")
    .select("*")
    .eq("slug", OWNER_SLUG)
    .eq("is_published", true)
    .maybeSingle();

  if (error) {
    console.error(error);
    setText("resumeContent", "Ошибка загрузки.");
    return;
  }
  if (!data) {
    setText("resumeContent", "Резюме ещё не опубликовано.");
    return;
  }

  setText("candidateName", data.display_name || "Кандидат");
  setText("candidateTitle", data.title || "Резюме");
  setText("updatedAt", formatDate(data.updated_at));
  setAvatar(data.photo_url || "");

  currentResumeMarkdown = data.markdown || "";
  el("resumeContent").innerHTML = window.marked.parse(currentResumeMarkdown || "");

  const meta = [];
  if (data.city) meta.push(`Город: ${data.city}`);
  if (data.age) meta.push(`Возраст: ${data.age}`);
  setText("metaLine", meta.join(" • "));
}

function initAiMatch() {
  const matchBtn = el("matchBtn");
  const vacancyUrl = el("vacancyUrl");
  const vacancyText = el("vacancyText");
  if (!matchBtn || !vacancyUrl || !vacancyText) return;

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

initAiMatch();
loadResume();

