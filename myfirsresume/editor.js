import { supabase } from "../app/supabase.js";

const sb = supabase();
const OWNER_SLUG = "home";

function el(id) {
  return document.getElementById(id);
}

function setStatus(id, text) {
  el(id).textContent = text || "";
}

function showEditor(show) {
  el("loginCard").style.display = show ? "none" : "block";
  el("editorCard").style.display = show ? "block" : "none";
}

async function sendMagicLink() {
  const email = (el("email").value || "").trim();
  if (!email) return setStatus("loginStatus", "Введите email.");
  const redirectTo = window.location.href;

  setStatus("loginStatus", "Отправляю ссылку…");
  el("sendBtn").disabled = true;
  try {
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) throw error;
    setStatus("loginStatus", "Проверьте почту и откройте magic link.");
  } catch (e) {
    console.error(e);
    setStatus("loginStatus", "Не удалось отправить ссылку. Проверьте Email provider в Supabase.");
  } finally {
    el("sendBtn").disabled = false;
  }
}

async function ensureRow(userId) {
  const { data, error } = await sb
    .from("resumes")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;

  const { error: insErr } = await sb.from("resumes").insert({
    user_id: userId,
    display_name: "",
    title: "",
    city: "",
    age: null,
    photo_url: "",
    markdown: "",
    about: "",
    experience: "",
    education: "",
    skills: "",
    contacts: "",
    slug: null,
    is_published: false,
  });
  if (insErr) throw insErr;

  const { data: again, error: againErr } = await sb
    .from("resumes")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (againErr) throw againErr;
  return again;
}

function fillForm(row) {
  el("displayName").value = row?.display_name || "";
  el("title").value = row?.title || "";
  el("city").value = row?.city || "";
  el("age").value = row?.age ?? "";
  el("photoUrl").value = row?.photo_url || "";
  el("about").value = row?.about || "";
  el("experience").value = row?.experience || "";
  el("education").value = row?.education || "";
  el("skills").value = row?.skills || "";
  el("contacts").value = row?.contacts || "";
  el("publicLink").textContent = new URL("/", window.location.origin).toString();
}

function normalizeAge(value) {
  const s = String(value || "").trim();
  if (!s) return null;
  const n = Number(s.replace(/[^\d]/g, ""));
  if (!Number.isFinite(n) || n <= 0 || n > 120) return null;
  return Math.trunc(n);
}

function buildMarkdown(p) {
  const lines = [];
  lines.push(`# ${p.display_name || "—"}`);
  if (p.title) lines.push(`**Должность:** ${p.title}`);

  const meta = [];
  if (p.city) meta.push(`Город: ${p.city}`);
  if (p.age != null) meta.push(`Возраст: ${p.age}`);
  if (meta.length) lines.push(`**${meta.join(" • ")}**`);

  if (p.about) {
    lines.push("");
    lines.push("## О себе");
    lines.push(p.about);
  }

  if (p.experience) {
    lines.push("");
    lines.push("## Опыт работы");
    lines.push(p.experience);
  }

  if (p.education) {
    lines.push("");
    lines.push("## Образование");
    lines.push(p.education);
  }

  if (p.skills) {
    lines.push("");
    lines.push("## Навыки");
    lines.push(p.skills);
  }

  if (p.contacts) {
    lines.push("");
    lines.push("## Контакты");
    lines.push(p.contacts);
  }

  return lines.join("\n");
}

async function saveAndPublish(userId) {
  const age = normalizeAge(el("age").value);
  const payload = {
    user_id: userId,
    display_name: (el("displayName").value || "").trim(),
    title: (el("title").value || "").trim(),
    city: (el("city").value || "").trim(),
    age,
    photo_url: (el("photoUrl").value || "").trim(),
    about: (el("about").value || "").trim(),
    experience: (el("experience").value || "").trim(),
    education: (el("education").value || "").trim(),
    skills: (el("skills").value || "").trim(),
    contacts: (el("contacts").value || "").trim(),
    slug: OWNER_SLUG,
    is_published: true,
    updated_at: new Date().toISOString(),
  };

  if (!payload.display_name) {
    setStatus("saveStatus", "Введите имя.");
    return;
  }
  if (!payload.title) {
    setStatus("saveStatus", "Введите заголовок (например, должность).");
    return;
  }

  payload.markdown = buildMarkdown(payload);

  setStatus("saveStatus", "Сохраняю…");
  el("saveBtn").disabled = true;
  try {
    const { error } = await sb.from("resumes").upsert(payload, { onConflict: "user_id" });
    if (error) throw error;
    setStatus("saveStatus", "Сохранено и опубликовано.");
  } catch (e) {
    console.error(e);
    setStatus("saveStatus", "Ошибка сохранения. Обновите таблицу: запустите свежий supabase/schema.sql в SQL Editor.");
  } finally {
    el("saveBtn").disabled = false;
  }
}

async function main() {
  try {
    await sb.auth.exchangeCodeForSession(window.location.href);
  } catch {}

  const { data } = await sb.auth.getSession();
  const session = data?.session;
  if (!session) {
    showEditor(false);
    el("sendBtn").addEventListener("click", sendMagicLink);
    el("email").addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendMagicLink();
    });
    return;
  }

  showEditor(true);
  const row = await ensureRow(session.user.id);
  fillForm(row);
  el("saveBtn").addEventListener("click", () => saveAndPublish(session.user.id));
}

main();

