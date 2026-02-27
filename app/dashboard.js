import { supabase } from "./supabase.js";

const sb = supabase();

function el(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  el(id).textContent = text || "";
}

function setStatus(id, text) {
  setText(id, text);
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

function genSlug() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function publicLink(slug) {
  if (!slug) return "";
  const u = new URL(`/u/${slug}`, window.location.origin);
  return u.toString();
}

async function requireSession() {
  const { data } = await sb.auth.getSession();
  if (!data?.session) {
    window.location.href = "./index.html";
    return null;
  }
  return data.session;
}

async function loadResumeRow(userId) {
  const { data, error } = await sb
    .from("resumes")
    .select("display_name,title,photo_url,markdown,slug,is_published,updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function ensureRow(userId) {
  const existing = await loadResumeRow(userId);
  if (existing) return existing;

  const { error } = await sb.from("resumes").insert({
    user_id: userId,
    display_name: "",
    title: "",
    photo_url: "",
    markdown: "",
    is_published: false,
  });
  if (error) throw error;
  return await loadResumeRow(userId);
}

function fillForm(row) {
  el("displayName").value = row?.display_name || "";
  el("title").value = row?.title || "";
  el("photoUrl").value = row?.photo_url || "";
  el("markdown").value = row?.markdown || "";
  setAvatar(row?.photo_url || "");

  setText("pubStatus", row?.is_published ? "published" : "private");
  setText("pubLink", row?.is_published && row?.slug ? publicLink(row.slug) : "—");
}

async function saveProfile(userId) {
  const payload = {
    user_id: userId,
    display_name: (el("displayName").value || "").trim(),
    title: (el("title").value || "").trim(),
    photo_url: (el("photoUrl").value || "").trim(),
    updated_at: new Date().toISOString(),
  };
  setStatus("profileStatus", "Сохраняю…");
  try {
    const { error } = await sb.from("resumes").upsert(payload, { onConflict: "user_id" });
    if (error) throw error;
    setAvatar(payload.photo_url);
    setStatus("profileStatus", "Сохранено.");
  } catch (e) {
    console.error(e);
    setStatus("profileStatus", "Ошибка сохранения. Проверь RLS и таблицу resumes.");
  }
}

async function saveMarkdown(userId) {
  const markdown = el("markdown").value || "";
  setStatus("mdStatus", "Сохраняю…");
  try {
    const { error } = await sb
      .from("resumes")
      .update({ markdown, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) throw error;
    setStatus("mdStatus", "Сохранено.");
  } catch (e) {
    console.error(e);
    setStatus("mdStatus", "Ошибка сохранения. Проверь RLS и таблицу resumes.");
  }
}

async function publish(userId) {
  setStatus("pubStatusLine", "Публикую…");
  try {
    let row = await loadResumeRow(userId);
    let slug = row?.slug;
    if (!slug) slug = genSlug();

    // retry in case of slug conflict
    for (let i = 0; i < 3; i++) {
      const { error } = await sb
        .from("resumes")
        .update({ is_published: true, slug, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (!error) break;
      if (String(error.message || "").toLowerCase().includes("duplicate")) {
        slug = genSlug();
        continue;
      }
      throw error;
    }

    row = await loadResumeRow(userId);
    fillForm(row);
    setStatus("pubStatusLine", "Опубликовано.");
  } catch (e) {
    console.error(e);
    setStatus("pubStatusLine", "Ошибка публикации.");
  }
}

async function unpublish(userId) {
  setStatus("pubStatusLine", "Скрываю…");
  try {
    const { error } = await sb
      .from("resumes")
      .update({ is_published: false, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) throw error;
    const row = await loadResumeRow(userId);
    fillForm(row);
    setStatus("pubStatusLine", "Теперь приватно.");
  } catch (e) {
    console.error(e);
    setStatus("pubStatusLine", "Ошибка.");
  }
}

async function copyPublicLink(userId) {
  const row = await loadResumeRow(userId);
  if (!row?.is_published || !row?.slug) {
    setStatus("pubStatusLine", "Сначала нажмите Publish.");
    return;
  }
  const link = publicLink(row.slug);
  try {
    await navigator.clipboard.writeText(link);
    setStatus("pubStatusLine", "Ссылка скопирована.");
  } catch {
    window.prompt("Скопируйте ссылку:", link);
  }
}

async function logout() {
  await sb.auth.signOut();
  window.location.href = "./index.html";
}

async function main() {
  const session = await requireSession();
  if (!session) return;

  setText("userLine", session.user.email || session.user.id);
  el("logoutBtn").addEventListener("click", logout);

  // magic link callback support
  try {
    await sb.auth.exchangeCodeForSession(window.location.href);
  } catch {}

  const userId = session.user.id;
  let row;
  try {
    row = await ensureRow(userId);
  } catch (e) {
    console.error(e);
    setStatus("profileStatus", "Не удалось загрузить данные. Проверь, что ты выполнил SQL из supabase/schema.sql");
    return;
  }

  fillForm(row);

  el("saveBtn").addEventListener("click", () => saveProfile(userId));
  el("saveMarkdownBtn").addEventListener("click", () => saveMarkdown(userId));
  el("publishBtn").addEventListener("click", () => publish(userId));
  el("unpublishBtn").addEventListener("click", () => unpublish(userId));
  el("copyBtn").addEventListener("click", () => copyPublicLink(userId));
}

main();

