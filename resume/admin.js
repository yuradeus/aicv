import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

const DEMO = {
  name: "Ваше Имя",
  title: "Должность • Город • Формат работы",
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

## Опыт
**Компания / Роль** — 2024–2026  
- Достижение 1 (цифры/метрики)
- Достижение 2
`,
};

function el(id) {
  return document.getElementById(id);
}

function setStatus(target, text) {
  el(target).textContent = text || "";
}

function requireFirebaseConfig() {
  const ok = firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey !== "REPLACE_ME";
  if (!ok) {
    setStatus("authStatus", "Заполните resume/firebase-config.js (firebaseConfig).");
    return false;
  }
  return true;
}

let app;
let auth;
let db;

function initFirebase() {
  if (!requireFirebaseConfig()) return false;
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  return true;
}

async function loadResume() {
  const ref = doc(db, "public", "resume");
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data();
}

async function saveResume(data) {
  const ref = doc(db, "public", "resume");
  await setDoc(
    ref,
    {
      name: data.name,
      title: data.title,
      resumeMarkdown: data.resumeMarkdown,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

function setEditorEnabled(enabled) {
  el("saveBtn").disabled = !enabled;
  el("loadBtn").disabled = !enabled;
  el("fillDemoBtn").disabled = !enabled;
  el("logoutBtn").style.display = enabled ? "inline-flex" : "none";
}

function readForm() {
  return {
    name: (el("name").value || "").trim(),
    title: (el("title").value || "").trim(),
    resumeMarkdown: el("markdown").value || "",
  };
}

function writeForm(data) {
  el("name").value = data?.name || "";
  el("title").value = data?.title || "";
  el("markdown").value = data?.resumeMarkdown || "";
}

async function handleLogin() {
  if (!initFirebase()) return;
  const email = (el("email").value || "").trim();
  const password = el("password").value || "";
  if (!email || !password) {
    setStatus("authStatus", "Введите email и пароль.");
    return;
  }

  setStatus("authStatus", "Вхожу…");
  try {
    await signInWithEmailAndPassword(auth, email, password);
    setStatus("authStatus", "");
  } catch (e) {
    console.error(e);
    setStatus("authStatus", "Не удалось войти. Проверьте email/пароль и включен ли Email/Password в Firebase.");
  }
}

async function handleLogout() {
  try {
    await signOut(auth);
  } catch (e) {
    console.error(e);
  }
}

async function handleLoad() {
  setStatus("editorStatus", "Загружаю…");
  try {
    const data = await loadResume();
    if (!data) {
      setStatus("editorStatus", "В базе пока нет резюме. Нажмите “Заполнить демо” и “Сохранить”.");
      return;
    }
    writeForm(data);
    setStatus("editorStatus", "Загружено.");
  } catch (e) {
    console.error(e);
    setStatus("editorStatus", "Ошибка загрузки. Проверьте Firestore и Rules.");
  }
}

async function handleSave() {
  const data = readForm();
  if (!data.name || !data.title || !data.resumeMarkdown.trim()) {
    setStatus("editorStatus", "Заполните имя, подзаголовок и Markdown.");
    return;
  }

  setStatus("editorStatus", "Сохраняю…");
  try {
    await saveResume(data);
    setStatus("editorStatus", "Сохранено. Проверьте публичную страницу резюме.");
  } catch (e) {
    console.error(e);
    setStatus("editorStatus", "Ошибка сохранения. Скорее всего, Firestore Rules не разрешают запись.");
  }
}

function handleFillDemo() {
  writeForm(DEMO);
  setStatus("editorStatus", "Демо вставлено. Нажмите “Сохранить”.");
}

function initUi() {
  el("loginBtn").addEventListener("click", handleLogin);
  el("logoutBtn").addEventListener("click", handleLogout);
  el("loadBtn").addEventListener("click", handleLoad);
  el("saveBtn").addEventListener("click", handleSave);
  el("fillDemoBtn").addEventListener("click", handleFillDemo);
  setEditorEnabled(false);
}

function initAuthWatcher() {
  if (!initFirebase()) return;

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      setEditorEnabled(false);
      setStatus("editorStatus", "Войдите, чтобы редактировать.");
      return;
    }
    setEditorEnabled(true);
    setStatus("editorStatus", "Вы вошли. Можно загрузить/сохранить резюме.");
  });
}

initUi();
initAuthWatcher();

