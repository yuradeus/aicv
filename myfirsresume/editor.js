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
    .select("display_name,title,photo_url,markdown,slug,is_published,updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;

  const { error: insErr } = await sb.from("resumes").insert({
    user_id: userId,
    display_name: "",
    title: "",
    photo_url: "",
    markdown: "",
    slug: null,
    is_published: false,
  });
  if (insErr) throw insErr;

  const { data: again, error: againErr } = await sb
    .from("resumes")
    .select("display_name,title,photo_url,markdown,slug,is_published,updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (againErr) throw againErr;
  return again;
}

function fillForm(row) {
  el("displayName").value = row?.display_name || "";
  el("title").value = row?.title || "";
  el("photoUrl").value = row?.photo_url || "";
  el("markdown").value = row?.markdown || "";
  el("publicLink").textContent = new URL("/", window.location.origin).toString();
}

async function saveAndPublish(userId) {
  const payload = {
    user_id: userId,
    display_name: (el("displayName").value || "").trim(),
    title: (el("title").value || "").trim(),
    photo_url: (el("photoUrl").value || "").trim(),
    markdown: el("markdown").value || "",
    slug: OWNER_SLUG,
    is_published: true,
    updated_at: new Date().toISOString(),
  };

  if (!payload.markdown.trim()) {
    setStatus("saveStatus", "Markdown не должен быть пустым.");
    return;
  }

  setStatus("saveStatus", "Сохраняю…");
  el("saveBtn").disabled = true;
  try {
    const { error } = await sb.from("resumes").upsert(payload, { onConflict: "user_id" });
    if (error) throw error;
    setStatus("saveStatus", "Сохранено и опубликовано.");
  } catch (e) {
    console.error(e);
    setStatus("saveStatus", "Ошибка сохранения. Проверьте, что выполнен SQL из supabase/schema.sql");
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

