"use strict";

const TABLE_NAME = "fandom_diary_entries";
const CONFIG_KEY = "supernova-logbook:supabase";

const categoryNames = {
  stage: "무대",
  album: "앨범",
  photo: "사진",
  message: "메시지",
  concert: "콘서트",
  daily: "일상",
};

const moodNames = {
  cosmic: "벅참",
  soft: "몽글",
  hype: "흥분",
  teary: "눈물",
  calm: "차분",
};

const state = {
  client: null,
  session: null,
  entries: [],
  editingId: null,
  authSubscription: null,
  toastTimer: null,
};

const $ = (id) => document.getElementById(id);

const els = {
  connectionStatus: $("connectionStatus"),
  refreshEntries: $("refreshEntries"),
  configForm: $("configForm"),
  clearConfig: $("clearConfig"),
  supabaseUrl: $("supabaseUrl"),
  supabaseAnonKey: $("supabaseAnonKey"),
  authBadge: $("authBadge"),
  signedOutView: $("signedOutView"),
  signedInView: $("signedInView"),
  userEmail: $("userEmail"),
  authForm: $("authForm"),
  email: $("email"),
  password: $("password"),
  signUpButton: $("signUpButton"),
  signOutButton: $("signOutButton"),
  totalCount: $("totalCount"),
  monthCount: $("monthCount"),
  streakCount: $("streakCount"),
  topMood: $("topMood"),
  entryForm: $("entryForm"),
  editState: $("editState"),
  resetEntry: $("resetEntry"),
  title: $("title"),
  entryDate: $("entryDate"),
  category: $("category"),
  bias: $("bias"),
  era: $("era"),
  mood: $("mood"),
  rating: $("rating"),
  mediaUrl: $("mediaUrl"),
  tags: $("tags"),
  body: $("body"),
  searchInput: $("searchInput"),
  categoryFilter: $("categoryFilter"),
  sortMode: $("sortMode"),
  entriesList: $("entriesList"),
  entryCardTemplate: $("entryCardTemplate"),
  toast: $("toast"),
};

init();

function init() {
  els.entryDate.value = todayIso();
  bindEvents();
  loadSavedConfig();
  updateAuthView();
  updateStats();
  renderEntries();
  refreshIcons();
}

function bindEvents() {
  els.configForm.addEventListener("submit", handleConfigSave);
  els.clearConfig.addEventListener("click", clearConfig);
  els.authForm.addEventListener("submit", handleSignIn);
  els.signUpButton.addEventListener("click", handleSignUp);
  els.signOutButton.addEventListener("click", handleSignOut);
  els.entryForm.addEventListener("submit", handleEntrySave);
  els.resetEntry.addEventListener("click", resetEntryForm);
  els.refreshEntries.addEventListener("click", fetchEntries);
  els.searchInput.addEventListener("input", renderEntries);
  els.categoryFilter.addEventListener("change", renderEntries);
  els.sortMode.addEventListener("change", renderEntries);
}

function loadSavedConfig() {
  const saved = readConfig();
  if (!saved.url || !saved.anonKey) {
    setConnectionStatus("미연결", "idle");
    setAuthDisabled(true);
    return;
  }

  els.supabaseUrl.value = saved.url;
  els.supabaseAnonKey.value = saved.anonKey;
  connectToSupabase(saved);
}

function readConfig() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}");
  } catch {
    return {};
  }
}

async function handleConfigSave(event) {
  event.preventDefault();
  const config = {
    url: els.supabaseUrl.value.trim(),
    anonKey: els.supabaseAnonKey.value.trim(),
  };

  if (!config.url || !config.anonKey) {
    showToast("Supabase 값을 확인해 주세요.");
    return;
  }

  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  await connectToSupabase(config);
}

async function connectToSupabase(config) {
  if (!window.supabase?.createClient) {
    setConnectionStatus("SDK 오류", "error");
    setAuthDisabled(true);
    showToast("Supabase SDK를 불러오지 못했어요.");
    return;
  }

  setConnectionStatus("연결 중", "idle");
  setAuthDisabled(true);

  if (state.authSubscription) {
    state.authSubscription.unsubscribe();
    state.authSubscription = null;
  }

  try {
    state.client = window.supabase.createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

    const { data, error } = await state.client.auth.getSession();
    if (error) throw error;

    state.session = data.session;
    const listener = state.client.auth.onAuthStateChange((_event, nextSession) => {
      state.session = nextSession;
      updateAuthView();
      if (nextSession) {
        fetchEntries();
      } else {
        state.entries = [];
        renderEntries();
        updateStats();
      }
    });
    state.authSubscription = listener.data.subscription;

    setConnectionStatus("연결됨", "online");
    setAuthDisabled(false);
    updateAuthView();

    if (state.session) {
      await fetchEntries();
    } else {
      renderEntries();
      updateStats();
    }
  } catch (error) {
    state.client = null;
    state.session = null;
    state.entries = [];
    setConnectionStatus("연결 실패", "error");
    setAuthDisabled(true);
    updateAuthView();
    updateStats();
    renderEntries();
    showToast(error.message || "Supabase 연결에 실패했어요.");
  }
}

function clearConfig() {
  localStorage.removeItem(CONFIG_KEY);
  if (state.authSubscription) state.authSubscription.unsubscribe();
  state.authSubscription = null;
  state.client = null;
  state.session = null;
  state.entries = [];
  state.editingId = null;
  els.supabaseUrl.value = "";
  els.supabaseAnonKey.value = "";
  setConnectionStatus("미연결", "idle");
  setAuthDisabled(true);
  updateAuthView();
  updateStats();
  resetEntryForm();
  renderEntries();
  showToast("설정을 삭제했어요.");
}

async function handleSignIn(event) {
  event.preventDefault();
  if (!state.client) {
    showToast("DB 연결이 필요해요.");
    return;
  }

  const email = els.email.value.trim();
  const password = els.password.value;
  if (!email || !password) {
    showToast("이메일과 비밀번호를 입력해 주세요.");
    return;
  }

  const { error } = await state.client.auth.signInWithPassword({ email, password });
  if (error) {
    showToast(getAuthErrorMessage(error));
    return;
  }

  els.password.value = "";
  showToast("로그인했어요.");
}

async function handleSignUp() {
  if (!state.client) {
    showToast("DB 연결이 필요해요.");
    return;
  }

  const email = els.email.value.trim();
  const password = els.password.value;
  if (!email || !password) {
    showToast("이메일과 비밀번호를 입력해 주세요.");
    return;
  }

  if (password.length < 6) {
    showToast("비밀번호는 최소 6자로 입력해 주세요.");
    return;
  }

  const { data, error } = await state.client.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getAuthRedirectUrl(),
    },
  });
  if (error) {
    showToast(getAuthErrorMessage(error));
    return;
  }

  els.password.value = "";
  if (data.session) {
    showToast("가입하고 로그인했어요.");
  } else {
    showToast("가입 요청을 보냈어요. 인증 메일을 확인해 주세요.");
  }
}

async function handleSignOut() {
  if (!state.client) return;
  await state.client.auth.signOut();
  showToast("로그아웃했어요.");
}

async function handleEntrySave(event) {
  event.preventDefault();
  if (!state.client || !state.session) {
    showToast("로그인이 필요해요.");
    return;
  }

  const payload = {
    user_id: state.session.user.id,
    title: els.title.value.trim(),
    entry_date: els.entryDate.value,
    category: els.category.value,
    bias: nullableText(els.bias.value),
    era: nullableText(els.era.value) || "Supernova",
    mood: nullableText(els.mood.value),
    rating: parseRating(els.rating.value),
    media_url: nullableText(els.mediaUrl.value),
    tags: parseTags(els.tags.value),
    body: nullableText(els.body.value),
  };

  if (!payload.title || !payload.entry_date) {
    showToast("제목과 날짜를 확인해 주세요.");
    return;
  }

  try {
    let result;
    if (state.editingId) {
      result = await state.client.from(TABLE_NAME).update(payload).eq("id", state.editingId);
    } else {
      result = await state.client.from(TABLE_NAME).insert(payload);
    }

    if (result.error) throw result.error;

    await fetchEntries();
    resetEntryForm();
    showToast("저장했어요.");
  } catch (error) {
    showToast(error.message || "저장하지 못했어요.");
  }
}

async function fetchEntries() {
  if (!state.client || !state.session) {
    renderEntries();
    updateStats();
    return;
  }

  const { data, error } = await state.client
    .from(TABLE_NAME)
    .select("*")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    showToast(error.message);
    return;
  }

  state.entries = data || [];
  renderEntries();
  updateStats();
}

function renderEntries() {
  const entries = getVisibleEntries();
  els.entriesList.replaceChildren();

  if (!state.session) {
    els.entriesList.appendChild(makeEmptyState("로그인하면 기록이 보여요."));
    refreshIcons();
    return;
  }

  if (!entries.length) {
    els.entriesList.appendChild(makeEmptyState("아직 저장된 기록이 없어요."));
    refreshIcons();
    return;
  }

  const fragment = document.createDocumentFragment();
  entries.forEach((entry) => fragment.appendChild(makeEntryCard(entry)));
  els.entriesList.appendChild(fragment);
  refreshIcons();
}

function makeEntryCard(entry) {
  const card = els.entryCardTemplate.content.firstElementChild.cloneNode(true);
  const cover = card.querySelector(".entry-cover");
  const title = card.querySelector("h3");
  const text = card.querySelector(".entry-text");
  const time = card.querySelector("time");
  const category = card.querySelector(".category-chip");
  const tagList = card.querySelector(".tag-list");

  title.textContent = entry.title || "Untitled";
  text.textContent = entry.body || "기록 없음";
  time.textContent = formatDate(entry.entry_date);
  time.dateTime = entry.entry_date || "";
  category.textContent = categoryNames[entry.category] || entry.category || "일상";

  renderMedia(cover, entry);

  setMeta(card.querySelector(".meta-bias"), entry.bias && `최애 ${entry.bias}`);
  setMeta(card.querySelector(".meta-era"), entry.era);
  setMeta(card.querySelector(".meta-mood"), moodNames[entry.mood] || entry.mood);
  setMeta(card.querySelector(".meta-rating"), entry.rating ? `${entry.rating}/5` : "");

  (entry.tags || []).forEach((tag) => {
    const chip = document.createElement("span");
    chip.textContent = `#${tag}`;
    tagList.appendChild(chip);
  });

  card.querySelector(".edit-entry").addEventListener("click", () => editEntry(entry.id));
  card.querySelector(".delete-entry").addEventListener("click", () => deleteEntry(entry.id));
  return card;
}

function renderMedia(container, entry) {
  if (!entry.media_url) return;

  const youtube = getYouTubeMedia(entry.media_url);
  if (youtube.embedUrl) {
    const iframe = document.createElement("iframe");
    iframe.src = youtube.embedUrl;
    iframe.title = entry.title ? `${entry.title} YouTube 영상` : "YouTube 영상";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";

    const fallback = document.createElement("a");
    fallback.className = "media-link";
    fallback.href = youtube.watchUrl;
    fallback.target = "_blank";
    fallback.rel = "noopener noreferrer";
    fallback.textContent = "YouTube에서 열기";

    container.classList.add("is-video");
    container.appendChild(iframe);
    container.appendChild(fallback);
    container.hidden = false;
    return;
  }

  if (looksLikeImage(entry.media_url)) {
    const image = document.createElement("img");
    image.src = entry.media_url;
    image.alt = entry.title || "";
    image.addEventListener("error", () => {
      image.remove();
      renderMediaLink(container, entry.media_url);
    });
    container.appendChild(image);
    container.hidden = false;
    return;
  }

  renderMediaLink(container, entry.media_url);
}

function renderMediaLink(container, url) {
  const link = document.createElement("a");
  link.className = "media-link media-link-only";
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "미디어 열기";
  container.appendChild(link);
  container.hidden = false;
}

function setMeta(element, value) {
  if (!value) {
    element.hidden = true;
    return;
  }
  element.textContent = value;
}

function makeEmptyState(message) {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.textContent = message;
  return empty;
}

function getVisibleEntries() {
  const query = els.searchInput.value.trim().toLowerCase();
  const category = els.categoryFilter.value;
  const sortMode = els.sortMode.value;

  const filtered = state.entries.filter((entry) => {
    const haystack = [
      entry.title,
      entry.body,
      entry.bias,
      entry.era,
      entry.category,
      entry.mood,
      ...(entry.tags || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (!query || haystack.includes(query)) && (category === "all" || entry.category === category);
  });

  return filtered.sort((a, b) => {
    if (sortMode === "date-asc") {
      return String(a.entry_date).localeCompare(String(b.entry_date));
    }
    if (sortMode === "rating-desc") {
      return (b.rating || 0) - (a.rating || 0);
    }
    return String(b.entry_date).localeCompare(String(a.entry_date));
  });
}

function editEntry(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;

  state.editingId = id;
  els.editState.textContent = "EDIT";
  els.title.value = entry.title || "";
  els.entryDate.value = entry.entry_date || todayIso();
  els.category.value = entry.category || "daily";
  els.bias.value = entry.bias || "";
  els.era.value = entry.era || "Supernova";
  els.mood.value = entry.mood || "cosmic";
  els.rating.value = entry.rating || 5;
  els.mediaUrl.value = entry.media_url || "";
  els.tags.value = (entry.tags || []).join(", ");
  els.body.value = entry.body || "";
  els.entryForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteEntry(id) {
  if (!state.client || !state.session) return;
  const ok = window.confirm("이 기록을 삭제할까요?");
  if (!ok) return;

  const { error } = await state.client.from(TABLE_NAME).delete().eq("id", id);
  if (error) {
    showToast(error.message);
    return;
  }

  if (state.editingId === id) resetEntryForm();
  await fetchEntries();
  showToast("삭제했어요.");
}

function resetEntryForm() {
  state.editingId = null;
  els.entryForm.reset();
  els.entryDate.value = todayIso();
  els.era.value = "Supernova";
  els.rating.value = 5;
  els.editState.textContent = "NEW";
}

function updateAuthView() {
  const signedIn = Boolean(state.session?.user);
  els.authBadge.textContent = signedIn ? "ON" : "OFF";
  els.signedOutView.hidden = signedIn;
  els.signedInView.hidden = !signedIn;
  els.userEmail.textContent = state.session?.user?.email || "-";
}

function setAuthDisabled(disabled) {
  [els.email, els.password, els.signUpButton].forEach((element) => {
    element.disabled = disabled;
  });
  els.authForm.querySelector("button[type='submit']").disabled = disabled;
}

function updateStats() {
  const entries = state.entries;
  const currentMonth = todayIso().slice(0, 7);
  const monthCount = entries.filter((entry) => String(entry.entry_date || "").startsWith(currentMonth)).length;
  const mood = mostCommon(entries.map((entry) => entry.mood).filter(Boolean));

  els.totalCount.textContent = String(entries.length);
  els.monthCount.textContent = String(monthCount);
  els.streakCount.textContent = String(getStreak(entries));
  els.topMood.textContent = mood ? moodNames[mood] || mood : "-";
}

function getStreak(entries) {
  const dates = [...new Set(entries.map((entry) => entry.entry_date).filter(Boolean))].sort().reverse();
  if (!dates.length) return 0;

  let streak = 0;
  const cursor = parseLocalDate(dates[0]);

  for (const date of dates) {
    const current = parseLocalDate(date);
    if (current.getTime() !== cursor.getTime()) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function mostCommon(values) {
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function setConnectionStatus(text, mode) {
  const dot = document.createElement("span");
  dot.className = "status-dot";
  els.connectionStatus.replaceChildren(dot, document.createTextNode(text));
  els.connectionStatus.classList.toggle("is-online", mode === "online");
  els.connectionStatus.classList.toggle("is-error", mode === "error");
}

function showToast(message) {
  window.clearTimeout(state.toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  state.toastTimer = window.setTimeout(() => {
    els.toast.classList.remove("is-visible");
  }, 3200);
}

function getAuthRedirectUrl() {
  const url = new URL(window.location.href);
  url.hash = "";
  url.search = "";
  return url.toString();
}

function getAuthErrorMessage(error) {
  const message = String(error?.message || "");
  const lower = message.toLowerCase();

  if (lower.includes("email not confirmed")) {
    return "이메일 인증이 아직 안 됐어요. 인증 메일을 먼저 확인해 주세요.";
  }
  if (lower.includes("invalid login credentials")) {
    return "이메일이나 비밀번호가 맞지 않아요. 가입/인증 여부도 확인해 주세요.";
  }
  if (lower.includes("signup disabled")) {
    return "Supabase Auth에서 가입이 꺼져 있어요.";
  }
  if (lower.includes("password")) {
    return "비밀번호 조건을 확인해 주세요. 기본은 최소 6자예요.";
  }
  if (lower.includes("fetch") || lower.includes("failed to fetch")) {
    return "Supabase URL 또는 anon key를 확인해 주세요.";
  }

  return message || "인증 처리에 실패했어요.";
}

function parseTags(value) {
  return value
    .split(",")
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean)
    .slice(0, 12);
}

function parseRating(value) {
  const rating = Number.parseInt(value, 10);
  if (Number.isNaN(rating)) return null;
  return Math.max(1, Math.min(5, rating));
}

function nullableText(value) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

function formatDate(value) {
  if (!value) return "-";
  return parseLocalDate(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

function parseLocalDate(value) {
  return new Date(`${value}T00:00:00`);
}

function todayIso() {
  const date = new Date();
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}

function looksLikeImage(url) {
  return /\.(avif|gif|jpe?g|png|webp)(\?.*)?$/i.test(url);
}

function getYouTubeMedia(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return { embedUrl: "", watchUrl: "" };
  }

  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
  const isYouTube = host === "youtube.com" || host === "music.youtube.com" || host === "youtu.be";
  if (!isYouTube) return { embedUrl: "", watchUrl: "" };

  let videoId = "";
  if (host === "youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0] || "";
  } else if (url.pathname === "/watch") {
    videoId = url.searchParams.get("v") || "";
  } else {
    const parts = url.pathname.split("/").filter(Boolean);
    if (["embed", "shorts", "live"].includes(parts[0])) {
      videoId = parts[1] || "";
    }
  }

  videoId = normalizeYouTubeVideoId(videoId || value);
  if (!videoId) return { embedUrl: "", watchUrl: "" };

  const embed = new URL(`https://www.youtube.com/embed/${videoId}`);
  const start = parseYouTubeStart(url.searchParams.get("start") || url.searchParams.get("t"));
  if (start) embed.searchParams.set("start", String(start));
  return {
    embedUrl: embed.toString(),
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

function normalizeYouTubeVideoId(value) {
  const match = String(value).match(/[\w-]{11}/);
  return match ? match[0] : "";
}

function parseYouTubeStart(value) {
  if (!value) return 0;
  if (/^\d+$/.test(value)) return Number(value);

  const match = String(value).match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?/i);
  if (!match) return 0;

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function refreshIcons() {
  if (window.lucide?.createIcons) {
    window.lucide.createIcons();
  }
}
