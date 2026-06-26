"use strict";

const TABLE_NAME = "fandom_diary_entries";
const CONFIG_KEY = "supernova-logbook:supabase";
const MUSICBRAINZ_RECORDING_SEARCH_URL = "https://musicbrainz.org/ws/2/recording";
const STORAGE_BUCKET = "diary-media";
const STORAGE_URL_PREFIX = `supabase://${STORAGE_BUCKET}/`;
const MAX_IMAGE_UPLOAD_BYTES = 8 * 1024 * 1024;

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
  sparkle: "설렘",
  nostalgic: "아련",
  addictive: "중독",
  proud: "뿌듯",
  shocked: "충격",
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
  musicSearch: $("musicSearch"),
  musicSearchButton: $("musicSearchButton"),
  musicResults: $("musicResults"),
  trackTitle: $("trackTitle"),
  artistName: $("artistName"),
  albumTitle: $("albumTitle"),
  releaseDate: $("releaseDate"),
  musicbrainzRecordingId: $("musicbrainzRecordingId"),
  musicbrainzReleaseId: $("musicbrainzReleaseId"),
  entryDate: $("entryDate"),
  category: $("category"),
  bias: $("bias"),
  era: $("era"),
  mood: $("mood"),
  rating: $("rating"),
  mediaUrl: $("mediaUrl"),
  mediaFile: $("mediaFile"),
  uploadImageButton: $("uploadImageButton"),
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
  els.musicSearchButton.addEventListener("click", handleMusicSearch);
  els.musicSearch.addEventListener("keydown", handleMusicSearchKeydown);
  els.uploadImageButton.addEventListener("click", handleImageUpload);
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
    track_title: nullableText(els.trackTitle.value),
    artist_name: nullableText(els.artistName.value),
    album_title: nullableText(els.albumTitle.value),
    release_date: nullableText(els.releaseDate.value),
    musicbrainz_recording_id: nullableText(els.musicbrainzRecordingId.value),
    musicbrainz_release_id: nullableText(els.musicbrainzReleaseId.value),
    entry_date: els.entryDate.value,
    category: els.category.value,
    bias: nullableText(els.bias.value),
    era: nullableText(els.era.value) || "Supernova",
    mood: nullableText(serializeMoods(getSelectedMoods())),
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
    const previousEntry = state.editingId ? state.entries.find((entry) => entry.id === state.editingId) : null;
    if (state.editingId) {
      result = await state.client.from(TABLE_NAME).update(payload).eq("id", state.editingId);
    } else {
      result = await state.client.from(TABLE_NAME).insert(payload);
    }

    if (result.error) throw result.error;
    if (previousEntry && previousEntry.media_url !== payload.media_url) {
      await removeStorageMedia(previousEntry?.media_url);
    }

    await fetchEntries();
    resetEntryForm();
    showToast("저장했어요.");
  } catch (error) {
    showToast(getDatabaseErrorMessage(error));
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
  const music = card.querySelector(".entry-music");
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
  renderMusicSummary(music, entry);

  setMeta(card.querySelector(".meta-bias"), entry.bias && `최애 ${entry.bias}`);
  setMeta(card.querySelector(".meta-era"), entry.era);
  renderMoodChips(card.querySelector(".meta-mood"), entry.mood);
  setMeta(card.querySelector(".meta-rating"), entry.rating ? `${entry.rating}/5` : "");

  (entry.tags || []).forEach((tag) => {
    const chip = document.createElement("span");
    chip.textContent = `#${tag}`;
    tagList.appendChild(chip);
  });

  card.querySelector(".share-entry").addEventListener("click", () => shareEntryImage(entry.id));
  card.querySelector(".edit-entry").addEventListener("click", () => editEntry(entry.id));
  card.querySelector(".delete-entry").addEventListener("click", () => deleteEntry(entry.id));
  return card;
}

function renderMusicSummary(container, entry) {
  const title = entry.track_title;
  const artist = entry.artist_name;
  const album = entry.album_title;
  const release = entry.release_date;
  if (!title && !artist && !album && !release) return;

  const primary = [title, artist].filter(Boolean).join(" - ");
  const secondary = [album, release].filter(Boolean).join(" · ");
  if (primary) {
    const strong = document.createElement("strong");
    strong.textContent = primary;
    container.appendChild(strong);
  }
  if (secondary) {
    const span = document.createElement("span");
    span.textContent = secondary;
    container.appendChild(span);
  }
  container.hidden = false;
}

function renderMedia(container, entry) {
  if (!entry.media_url) return;

  if (isSupabaseStorageUrl(entry.media_url)) {
    renderSupabaseStorageImage(container, entry);
    return;
  }

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
    container.classList.add("is-image");
    container.appendChild(image);
    container.hidden = false;
    return;
  }

  renderMediaLink(container, entry.media_url);
}

async function renderSupabaseStorageImage(container, entry) {
  if (!state.client) return;

  const path = getSupabaseStoragePath(entry.media_url);
  if (!path) return;

  const image = document.createElement("img");
  image.alt = entry.title || "";
  image.decoding = "async";
  image.addEventListener("error", () => {
    image.remove();
    renderMediaLink(container, entry.media_url);
  });

  container.classList.add("is-image");
  container.appendChild(image);
  container.hidden = false;

  const { data, error } = await state.client.storage.from(STORAGE_BUCKET).createSignedUrl(path, 60 * 30);
  if (error || !data?.signedUrl) {
    image.remove();
    renderMediaLink(container, entry.media_url);
    return;
  }

  image.src = data.signedUrl;
}

function renderMediaLink(container, url) {
  if (isSupabaseStorageUrl(url)) {
    const status = document.createElement("div");
    status.className = "media-link media-link-only";
    status.textContent = "업로드 이미지를 열 수 없어요";
    container.appendChild(status);
    container.hidden = false;
    return;
  }

  const link = document.createElement("a");
  link.className = "media-link media-link-only";
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "미디어 열기";
  container.appendChild(link);
  container.hidden = false;
}

async function handleImageUpload() {
  if (!state.client || !state.session) {
    showToast("이미지 업로드는 로그인이 필요해요.");
    return;
  }

  const file = els.mediaFile.files?.[0];
  if (!file) {
    showToast("업로드할 이미지를 선택해 주세요.");
    return;
  }

  if (!file.type.startsWith("image/")) {
    showToast("이미지 파일만 업로드할 수 있어요.");
    return;
  }

  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    showToast("이미지는 8MB 이하로 선택해 주세요.");
    return;
  }

  els.uploadImageButton.disabled = true;

  try {
    const prepared = await prepareImageUpload(file);
    const path = makeStoragePath(prepared.fileName);
    const { error } = await state.client.storage.from(STORAGE_BUCKET).upload(path, prepared.blob, {
      cacheControl: "3600",
      contentType: prepared.contentType,
      upsert: false,
    });

    if (error) throw error;

    els.mediaUrl.value = `${STORAGE_URL_PREFIX}${path}`;
    els.mediaFile.value = "";
    showToast("이미지를 업로드했어요.");
  } catch (error) {
    showToast(getStorageErrorMessage(error));
  } finally {
    els.uploadImageButton.disabled = false;
  }
}

async function prepareImageUpload(file) {
  if (!window.createImageBitmap || file.type === "image/gif") {
    return {
      blob: file,
      contentType: file.type || "application/octet-stream",
      fileName: safeFileName(file.name),
    };
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((nextBlob) => {
        if (nextBlob) resolve(nextBlob);
        else reject(new Error("이미지를 변환하지 못했어요."));
      }, "image/jpeg", 0.86);
    });

    return {
      blob,
      contentType: "image/jpeg",
      fileName: `${removeFileExtension(file.name)}.jpg`,
    };
  } catch {
    return {
      blob: file,
      contentType: file.type || "application/octet-stream",
      fileName: safeFileName(file.name),
    };
  }
}

function makeStoragePath(fileName) {
  const userId = state.session.user.id;
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return `${userId}/${unique}-${safeFileName(fileName)}`;
}

function safeFileName(fileName) {
  const cleaned = String(fileName || "image")
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned || "image.jpg";
}

function removeFileExtension(fileName) {
  return safeFileName(fileName).replace(/\.[^.]+$/, "") || "image";
}

function handleMusicSearchKeydown(event) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  handleMusicSearch();
}

async function handleMusicSearch() {
  const query = els.musicSearch.value.trim();
  if (query.length < 2) {
    showToast("검색어를 2자 이상 입력해 주세요.");
    return;
  }

  els.musicSearchButton.disabled = true;
  els.musicResults.hidden = false;
  els.musicResults.replaceChildren(makeMusicResultStatus("검색 중..."));

  try {
    const url = new URL(MUSICBRAINZ_RECORDING_SEARCH_URL);
    url.searchParams.set("query", query);
    url.searchParams.set("fmt", "json");
    url.searchParams.set("limit", "8");

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(response.status === 503 ? "잠시 후 다시 검색해 주세요." : "음악 검색에 실패했어요.");
    }

    const data = await response.json();
    const results = (data.recordings || []).map(normalizeMusicBrainzRecording).filter(Boolean);
    renderMusicResults(results);
  } catch (error) {
    els.musicResults.replaceChildren(makeMusicResultStatus(error.message || "음악 검색에 실패했어요."));
  } finally {
    els.musicSearchButton.disabled = false;
  }
}

function renderMusicResults(results) {
  els.musicResults.replaceChildren();
  els.musicResults.hidden = false;

  if (!results.length) {
    els.musicResults.appendChild(makeMusicResultStatus("검색 결과가 없어요."));
    return;
  }

  results.forEach((result) => {
    const button = document.createElement("button");
    button.className = "music-result";
    button.type = "button";
    button.innerHTML = `
      <strong></strong>
      <span></span>
    `;
    button.querySelector("strong").textContent = [result.trackTitle, result.artistName].filter(Boolean).join(" - ");
    button.querySelector("span").textContent = [result.albumTitle, result.releaseDate].filter(Boolean).join(" · ") || "음반 정보 없음";
    button.addEventListener("click", () => selectMusicResult(result));
    els.musicResults.appendChild(button);
  });
}

function makeMusicResultStatus(message) {
  const status = document.createElement("div");
  status.className = "music-result-status";
  status.textContent = message;
  return status;
}

function selectMusicResult(result) {
  els.trackTitle.value = result.trackTitle || "";
  els.artistName.value = result.artistName || "";
  els.albumTitle.value = result.albumTitle || "";
  els.releaseDate.value = result.releaseDate || "";
  els.musicbrainzRecordingId.value = result.recordingId || "";
  els.musicbrainzReleaseId.value = result.releaseId || "";

  if (!els.title.value.trim()) {
    els.title.value = [result.trackTitle, result.artistName].filter(Boolean).join(" - ");
  }

  els.musicResults.hidden = true;
  showToast("음악 메타데이터를 채웠어요.");
}

function normalizeMusicBrainzRecording(recording) {
  if (!recording?.title) return null;

  const release = [...(recording.releases || [])].sort((a, b) => {
    const aDate = a.date || "9999";
    const bDate = b.date || "9999";
    return aDate.localeCompare(bDate);
  })[0];

  return {
    recordingId: recording.id || "",
    releaseId: release?.id || "",
    trackTitle: recording.title || "",
    artistName: getArtistCreditName(recording["artist-credit"]),
    albumTitle: release?.title || "",
    releaseDate: release?.date || "",
  };
}

function getArtistCreditName(artistCredit) {
  if (!Array.isArray(artistCredit)) return "";
  return artistCredit
    .map((credit) => credit.name || credit.artist?.name || "")
    .filter(Boolean)
    .join(", ");
}

function setMeta(element, value) {
  if (!value) {
    element.hidden = true;
    return;
  }
  element.textContent = value;
}

function getSelectedMoods() {
  return [...els.mood.querySelectorAll("input[name='mood']:checked")].map((input) => input.value);
}

function setSelectedMoods(moods) {
  const selected = new Set(parseMoods(moods));
  els.mood.querySelectorAll("input[name='mood']").forEach((input) => {
    input.checked = selected.has(input.value);
  });
}

function parseMoods(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(",");
  const seen = new Set();
  return values
    .map(normalizeMood)
    .filter(Boolean)
    .filter((mood) => {
      if (seen.has(mood)) return false;
      seen.add(mood);
      return true;
    })
    .slice(0, 10);
}

function normalizeMood(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (moodNames[trimmed]) return trimmed;

  const matched = Object.entries(moodNames).find(([, label]) => label === trimmed);
  return matched?.[0] || trimmed;
}

function serializeMoods(moods) {
  return parseMoods(moods).join(",");
}

function moodLabel(mood) {
  return moodNames[mood] || mood;
}

function renderMoodChips(container, moodValue) {
  const moods = parseMoods(moodValue);
  container.replaceChildren();

  if (!moods.length) {
    container.hidden = true;
    return;
  }

  moods.forEach((mood) => {
    const chip = document.createElement("span");
    chip.textContent = moodLabel(mood);
    container.appendChild(chip);
  });
  container.hidden = false;
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
      entry.track_title,
      entry.artist_name,
      entry.album_title,
      entry.release_date,
      entry.body,
      entry.bias,
      entry.era,
      entry.category,
      entry.mood,
      ...parseMoods(entry.mood).map(moodLabel),
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
  els.trackTitle.value = entry.track_title || "";
  els.artistName.value = entry.artist_name || "";
  els.albumTitle.value = entry.album_title || "";
  els.releaseDate.value = entry.release_date || "";
  els.musicbrainzRecordingId.value = entry.musicbrainz_recording_id || "";
  els.musicbrainzReleaseId.value = entry.musicbrainz_release_id || "";
  els.entryDate.value = entry.entry_date || todayIso();
  els.category.value = entry.category || "daily";
  els.bias.value = entry.bias || "";
  els.era.value = entry.era || "Supernova";
  setSelectedMoods(parseMoods(entry.mood));
  els.rating.value = entry.rating ?? "";
  els.mediaUrl.value = entry.media_url || "";
  els.tags.value = (entry.tags || []).join(", ");
  els.body.value = entry.body || "";
  els.entryForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteEntry(id) {
  if (!state.client || !state.session) return;
  const ok = window.confirm("이 기록을 삭제할까요?");
  if (!ok) return;

  const entry = state.entries.find((item) => item.id === id);
  const { error } = await state.client.from(TABLE_NAME).delete().eq("id", id);
  if (error) {
    showToast(error.message);
    return;
  }

  await removeStorageMedia(entry?.media_url);
  if (state.editingId === id) resetEntryForm();
  await fetchEntries();
  showToast("삭제했어요.");
}

async function shareEntryImage(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;

  try {
    const blob = await createShareCardBlob(entry);
    const fileName = makeShareFileName(entry);
    const file = new File([blob], fileName, { type: "image/png" });

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: entry.title || "dreamtaKU DIARIES",
        text: "dreamtaKU DIARIES 감상 카드",
      });
      showToast("이미지 공유를 열었어요.");
      return;
    }

    downloadBlob(blob, fileName);
    showToast("감상 카드를 저장했어요.");
  } catch (error) {
    if (error.name === "AbortError") return;
    showToast(error.message || "이미지 생성에 실패했어요.");
  }
}

function resetEntryForm() {
  state.editingId = null;
  els.entryForm.reset();
  els.musicResults.replaceChildren();
  els.musicResults.hidden = true;
  els.musicbrainzRecordingId.value = "";
  els.musicbrainzReleaseId.value = "";
  els.entryDate.value = todayIso();
  els.era.value = "Supernova";
  els.rating.value = "";
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
  const mood = mostCommon(entries.flatMap((entry) => parseMoods(entry.mood)));

  els.totalCount.textContent = String(entries.length);
  els.monthCount.textContent = String(monthCount);
  els.streakCount.textContent = String(getStreak(entries));
  els.topMood.textContent = mood ? moodLabel(mood) : "-";
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

function getDatabaseErrorMessage(error) {
  const message = String(error?.message || "");
  const lower = message.toLowerCase();

  if (
    lower.includes("track_title") ||
    lower.includes("artist_name") ||
    lower.includes("album_title") ||
    lower.includes("musicbrainz")
  ) {
    return "음악 메타데이터 컬럼이 필요해요. supabase-music-migration.sql을 먼저 실행해 주세요.";
  }

  return message || "저장하지 못했어요.";
}

function getStorageErrorMessage(error) {
  const message = String(error?.message || "");
  const lower = message.toLowerCase();

  if (lower.includes("bucket not found") || lower.includes("not found")) {
    return "diary-media 버킷이 필요해요. supabase-storage-setup.sql을 먼저 실행해 주세요.";
  }
  if (lower.includes("row-level security") || lower.includes("policy") || lower.includes("unauthorized")) {
    return "Storage 정책을 확인해 주세요. 본인 폴더에만 업로드할 수 있어요.";
  }
  if (lower.includes("mime") || lower.includes("file extension")) {
    return "지원하는 이미지 형식을 확인해 주세요.";
  }
  if (lower.includes("payload") || lower.includes("too large") || lower.includes("size")) {
    return "이미지는 8MB 이하로 선택해 주세요.";
  }

  return message || "이미지 업로드에 실패했어요.";
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

async function createShareCardBlob(entry) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const ink = "#161817";
  const muted = "#68716d";
  const cyan = "#28c2d1";
  const lime = "#b9e83d";
  const coral = "#ff6b59";
  const shareImage = await getShareImage(entry);

  ctx.fillStyle = "#f4f7ef";
  ctx.fillRect(0, 0, width, height);
  drawGrid(ctx, width, height);

  drawRoundRect(ctx, 70, 70, width - 140, height - 140, 28, "#fffefa", "#161817", 6);
  drawRoundRect(ctx, 108, 108, width - 216, 190, 22, "#161817", "", 0);

  ctx.fillStyle = lime;
  ctx.beginPath();
  ctx.arc(174, 172, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = cyan;
  ctx.fillRect(230, 142, 72, 72);
  ctx.fillStyle = coral;
  ctx.beginPath();
  ctx.moveTo(340, 218);
  ctx.lineTo(382, 138);
  ctx.lineTo(424, 218);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 42px system-ui, sans-serif";
  ctx.fillText("dreamtaKU DIARIES", 108, 360);
  ctx.fillStyle = coral;
  ctx.font = "800 24px system-ui, sans-serif";
  ctx.fillText("MUSIC FANDOM NOTE", 108, 400);

  const category = categoryNames[entry.category] || entry.category || "감상";
  const date = entry.entry_date ? formatDate(entry.entry_date) : todayIso();
  drawPill(ctx, date, 108, 442, "#e7f8fa", "#05727b");
  drawPill(ctx, category, 108 + measurePill(ctx, date) + 14, 442, "#fff1ef", "#9d372c");

  ctx.fillStyle = ink;
  ctx.font = "900 64px system-ui, sans-serif";
  const displayTitle = entry.track_title || entry.title || "Untitled";
  const titleLines = getWrappedLines(ctx, displayTitle, 840, 2);
  let y = 545;
  titleLines.forEach((line) => {
    ctx.fillText(line, 108, y);
    y += 78;
  });

  const musicLine = [entry.artist_name, entry.album_title, entry.release_date].filter(Boolean).join(" · ");
  if (musicLine) {
    ctx.fillStyle = muted;
    ctx.font = "800 30px system-ui, sans-serif";
    getWrappedLines(ctx, musicLine, 840, 2).forEach((line) => {
      ctx.fillText(line, 108, y);
      y += 42;
    });
  }

  const meta = [
    entry.bias && `최애 ${entry.bias}`,
    entry.era || "Supernova",
    ...parseMoods(entry.mood).map(moodLabel),
    entry.rating && `${entry.rating}/5`,
  ].filter(Boolean);

  y += 8;
  let x = 108;
  meta.forEach((item) => {
    const nextWidth = measurePill(ctx, item);
    if (x + nextWidth > width - 108) {
      x = 108;
      y += 52;
    }
    drawPill(ctx, item, x, y, "#f7f8f3", muted);
    x += nextWidth + 12;
  });

  y += 72;
  const media = getShareMediaLabel(entry.media_url);
  if (shareImage) {
    const imageTop = y - 28;
    const imageHeight = Math.min(320, Math.max(180, height - imageTop - 300));
    drawRoundRect(ctx, 108, imageTop, width - 216, imageHeight, 18, "#f8fbfa", "#d9ded7", 3);
    drawImageContain(ctx, shareImage.image, 136, imageTop + 24, width - 272, imageHeight - 48);
    y = imageTop + imageHeight + 58;
  } else if (media) {
    drawRoundRect(ctx, 108, y - 28, width - 216, 104, 18, "#eaf5f2", "#d9ded7", 3);
    ctx.fillStyle = cyan;
    ctx.font = "900 24px system-ui, sans-serif";
    ctx.fillText(media.label, 136, y + 8);
    ctx.fillStyle = ink;
    ctx.font = "750 28px system-ui, sans-serif";
    getWrappedLines(ctx, media.value, 760, 1).forEach((line) => ctx.fillText(line, 136, y + 50));
    y += 140;
  }

  ctx.fillStyle = ink;
  ctx.font = "800 30px system-ui, sans-serif";
  ctx.fillText("감상 메모", 108, y);
  y += 54;

  ctx.fillStyle = "#333a37";
  ctx.font = "500 34px system-ui, sans-serif";
  const body = entry.body || "기록 없음";
  const bodyMaxLines = Math.max(1, Math.min(5, Math.floor(Math.max(48, height - 210 - y) / 48)));
  const bodyLines = getWrappedLines(ctx, body.replace(/\s+/g, " "), 840, bodyMaxLines);
  bodyLines.forEach((line) => {
    ctx.fillText(line, 108, y);
    y += 48;
  });

  const tags = (entry.tags || []).slice(0, 8).map((tag) => `#${tag}`);
  if (tags.length) {
    y = Math.min(y + 40, height - 206);
    x = 108;
    tags.forEach((tag) => {
      const nextWidth = measurePill(ctx, tag);
      if (x + nextWidth > width - 108) {
        x = 108;
        y += 52;
      }
      drawPill(ctx, tag, x, y, "#fff1ef", "#9d372c");
      x += nextWidth + 12;
    });
  }

  ctx.fillStyle = muted;
  ctx.font = "800 22px system-ui, sans-serif";
  ctx.fillText("exported from dreamtaKU DIARIES", 108, height - 118);

  try {
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("이미지를 만들지 못했어요."));
      }, "image/png");
    });
  } finally {
    shareImage?.cleanup?.();
  }
}

function drawGrid(ctx, width, height) {
  ctx.strokeStyle = "rgba(40, 194, 209, 0.14)";
  ctx.lineWidth = 2;
  for (let x = 0; x <= width; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255, 107, 89, 0.12)";
  for (let y = 0; y <= height; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawRoundRect(ctx, x, y, width, height, radius, fill, stroke, lineWidth) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke && lineWidth) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function drawImageContain(ctx, image, x, y, width, height) {
  const imageWidth = image.naturalWidth || image.width || 1;
  const imageHeight = image.naturalHeight || image.height || 1;
  const scale = Math.min(width / imageWidth, height / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function drawPill(ctx, text, x, y, fill, color) {
  const width = measurePill(ctx, text);
  drawRoundRect(ctx, x, y - 30, width, 40, 20, fill, "", 0);
  ctx.fillStyle = color;
  ctx.font = "850 22px system-ui, sans-serif";
  ctx.fillText(text, x + 18, y - 3);
}

function measurePill(ctx, text) {
  ctx.font = "850 22px system-ui, sans-serif";
  return Math.ceil(ctx.measureText(text).width) + 36;
}

function getWrappedLines(ctx, text, maxWidth, maxLines) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      return;
    }

    if (line) lines.push(line);
    line = word;
  });

  if (line) lines.push(line);

  if (lines.length > maxLines) {
    const clipped = lines.slice(0, maxLines);
    clipped[maxLines - 1] = `${clipped[maxLines - 1].replace(/[.。…]+$/, "")}...`;
    return clipped;
  }

  return lines;
}

async function getShareImage(entry) {
  const src = await getShareImageSource(entry.media_url);
  if (!src) return null;

  try {
    return await loadCanvasImage(src);
  } catch {
    return null;
  }
}

async function getShareImageSource(url) {
  if (!url) return "";

  if (isSupabaseStorageUrl(url)) {
    if (!state.client) return "";
    const path = getSupabaseStoragePath(url);
    if (!path) return "";
    const { data, error } = await state.client.storage.from(STORAGE_BUCKET).createSignedUrl(path, 60 * 10);
    if (error || !data?.signedUrl) return "";
    return data.signedUrl;
  }

  return looksLikeImage(url) ? url : "";
}

async function loadCanvasImage(src) {
  const response = await fetch(src, { mode: "cors" });
  if (!response.ok) throw new Error("이미지를 불러오지 못했어요.");

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = await loadImageElement(objectUrl);
    return {
      image,
      cleanup: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(new Error("이미지를 불러오지 못했어요.")), { once: true });
    image.src = src;
  });
}

function getShareMediaLabel(url) {
  if (!url) return null;
  if (isSupabaseStorageUrl(url)) {
    return { label: "UPLOADED IMAGE", value: "Supabase Storage" };
  }
  const youtube = getYouTubeMedia(url);
  if (youtube.watchUrl) {
    return { label: "YOUTUBE", value: youtube.watchUrl };
  }
  if (looksLikeImage(url)) {
    return { label: "IMAGE LINK", value: url };
  }
  return { label: "LINK", value: url };
}

function makeShareFileName(entry) {
  const date = entry.entry_date || todayIso();
  const slug = String(entry.track_title || entry.title || "dreamtaku")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
  return `dreamtaku-${date}-${slug || "diary"}.png`;
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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

function isSupabaseStorageUrl(value) {
  return String(value || "").startsWith(STORAGE_URL_PREFIX);
}

function getSupabaseStoragePath(value) {
  if (!isSupabaseStorageUrl(value)) return "";
  try {
    return decodeURIComponent(String(value).slice(STORAGE_URL_PREFIX.length).replace(/^\/+/, ""));
  } catch {
    return "";
  }
}

async function removeStorageMedia(value) {
  const path = getSupabaseStoragePath(value);
  if (!path || !state.client) return;
  await state.client.storage.from(STORAGE_BUCKET).remove([path]).catch(() => {});
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
