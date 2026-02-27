import { supabase } from "./supabase.js";

const sb = supabase();

function el(id) {
  return document.getElementById(id);
}

function setStatus(text) {
  el("status").textContent = text || "";
}

async function maybeRedirectIfLoggedIn() {
  const { data } = await sb.auth.getSession();
  if (data?.session) {
    window.location.href = "./dashboard.html";
  }
}

async function sendMagicLink() {
  const email = (el("email").value || "").trim();
  if (!email) return setStatus("Введите email.");

  const redirectTo = new URL("./dashboard.html", window.location.href).toString();
  setStatus("Отправляю ссылку…");
  el("sendBtn").disabled = true;
  try {
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) throw error;
    setStatus("Готово. Проверьте почту и откройте ссылку для входа.");
  } catch (e) {
    console.error(e);
    setStatus("Не удалось отправить ссылку. Проверьте настройки Email в Supabase.");
  } finally {
    el("sendBtn").disabled = false;
  }
}

el("sendBtn").addEventListener("click", sendMagicLink);
el("email").addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMagicLink();
});

maybeRedirectIfLoggedIn();

