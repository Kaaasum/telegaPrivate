const state = {
  user: null,
  chats: [],
  filteredChats: [],
  currentChatId: null,
  pollTimer: null,
  search: '',
  audioRecording: null,
  videoRecording: null,
  videoTimerInterval: null,
  videoStartedAt: 0,
  replyTo: null,
  typingHideTimer: null,
  contextMessage: null,
  noticeHideTimer: null,
  ws: null,
  wsConnected: false,
  wsReconnectTimer: null,
  typingThrottleUntil: 0,
};

const authModal = document.getElementById('authModal');
const loginForm = document.getElementById('loginForm');
const nameInput = document.getElementById('nameInput');
const passwordInput = document.getElementById('passwordInput');
const avatarInput = document.getElementById('avatarInput');
const registerBtn = document.getElementById('registerBtn');

const chatList = document.getElementById('chatList');
const chatSearch = document.getElementById('chatSearch');
const chatTitle = document.getElementById('chatTitle');
const chatSubtitle = document.getElementById('chatSubtitle');
const chatHeader = document.getElementById('chatHeader');
const pinnedBar = document.getElementById('pinnedBar');
const pinnedText = document.getElementById('pinnedText');
const panelEmpty = document.getElementById('panelEmpty');
const chatWrap = document.getElementById('chatWrap');
const tgPanel = document.querySelector('.tg-panel');
const backToChatsBtn = document.getElementById('backToChatsBtn');

const messagesBox = document.getElementById('messages');
const sendForm = document.getElementById('sendForm');
const messageInput = document.getElementById('messageInput');
const logoutBtn = document.getElementById('logoutBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const newChatBtn = document.getElementById('newChatBtn');
const setWallpaperBtn = document.getElementById('setWallpaperBtn');
const resetWallpaperBtn = document.getElementById('resetWallpaperBtn');
const wallpaperInput = document.getElementById('wallpaperInput');

const photoInput = document.getElementById('photoInput');
const photoBtn = document.getElementById('photoBtn');
const voiceBtn = document.getElementById('voiceBtn');
const videoBtn = document.getElementById('videoBtn');
const sendBtn = document.getElementById('sendBtn');
const micBtn = document.getElementById('micBtn');
const recordState = document.getElementById('recordState');
const videoRecordOverlay = document.getElementById('videoRecordOverlay');
const videoRecordPreview = document.getElementById('videoRecordPreview');
const videoRecordTimer = document.getElementById('videoRecordTimer');
const selectionBar = document.getElementById('selectionBar');
const selectionCount = document.getElementById('selectionCount');
const selectionCancelBtn = document.getElementById('selectionCancelBtn');
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
const replyPreview = document.getElementById('replyPreview');
const replyAuthor = document.getElementById('replyAuthor');
const replyText = document.getElementById('replyText');
const replyCancelBtn = document.getElementById('replyCancelBtn');
const imageLightbox = document.getElementById('imageLightbox');
const lightboxImage = document.getElementById('lightboxImage');
const messageContextMenu = document.getElementById('messageContextMenu');
const ctxCopyBtn = document.getElementById('ctxCopyBtn');
const ctxReplyBtn = document.getElementById('ctxReplyBtn');
const ctxDeleteBtn = document.getElementById('ctxDeleteBtn');
const userSearchModal = document.getElementById('userSearchModal');
const userSearchInput = document.getElementById('userSearchInput');
const userSearchResults = document.getElementById('userSearchResults');
const userSearchCloseBtn = document.getElementById('userSearchCloseBtn');

const WALLPAPER_KEY = 'pm_custom_wallpaper';
const THEME_KEY = 'pm_theme';
const selectedMessageIds = new Set();

function getWsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = window.location.hostname;
  return `${proto}://${host}:8093`;
}

function clearWsReconnect() {
  if (state.wsReconnectTimer) {
    clearTimeout(state.wsReconnectTimer);
    state.wsReconnectTimer = null;
  }
}

function scheduleWsReconnect() {
  clearWsReconnect();
  state.wsReconnectTimer = setTimeout(() => {
    state.wsReconnectTimer = null;
    connectWebSocket();
  }, 1600);
}

function sendWs(payload) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    return;
  }
  state.ws.send(JSON.stringify(payload));
}

function disconnectWebSocket() {
  clearWsReconnect();
  state.wsConnected = false;
  if (state.ws) {
    try {
      state.ws.onopen = null;
      state.ws.onmessage = null;
      state.ws.onerror = null;
      state.ws.onclose = null;
      state.ws.close();
    } catch (_) {
      // ignore
    }
    state.ws = null;
  }
}

function connectWebSocket() {
  if (!state.user) {
    return;
  }
  if (state.ws && (state.ws.readyState === WebSocket.OPEN || state.ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  let ws;
  try {
    ws = new WebSocket(getWsUrl());
  } catch (_) {
    scheduleWsReconnect();
    return;
  }

  state.ws = ws;

  ws.onopen = () => {
    state.wsConnected = true;
    sendWs({ type: 'auth', user: state.user });
  };

  ws.onmessage = (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch (_) {
      return;
    }
    if (!data || typeof data !== 'object') {
      return;
    }

    if (data.type === 'chat_updated') {
      const sameChat = state.currentChatId && data.chatId && state.currentChatId === data.chatId;
      loadChats().catch(() => {});
      if (sameChat) {
        loadMessages().catch(() => {});
      }
      return;
    }

    if (data.type === 'typing') {
      if (
        data.chatId &&
        state.currentChatId &&
        data.chatId === state.currentChatId &&
        data.from &&
        data.from !== state.user
      ) {
        setTypingIndicator(true);
      }
    }
  };

  ws.onerror = () => {
    // wait close
  };

  ws.onclose = () => {
    state.wsConnected = false;
    state.ws = null;
    scheduleWsReconnect();
  };
}

async function api(path, options = {}) {
  const response = await fetch(`api/${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.error || 'Ошибка запроса');
  }

  return data;
}

async function registerAccount(name, password, avatarFile) {
  const formData = new FormData();
  formData.append('name', name);
  formData.append('password', password);
  if (avatarFile) {
    formData.append('avatar', avatarFile);
  }

  const response = await fetch('api/register.php', {
    method: 'POST',
    body: formData,
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.error || 'Ошибка регистрации');
  }
  return data;
}

async function uploadMedia(file, kind) {
  if (!state.currentChatId) {
    throw new Error('Сначала выберите чат');
  }

  const formData = new FormData();
  formData.append('chat', state.currentChatId);
  formData.append('kind', kind);
  formData.append('file', file);

  const response = await fetch('api/upload_media.php', {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.error || 'Ошибка отправки файла');
  }

  return data;
}

async function deleteMessages(ids) {
  if (!state.currentChatId || !Array.isArray(ids) || ids.length === 0) {
    return;
  }

  return api('delete_messages.php', {
    method: 'POST',
    body: JSON.stringify({ chat: state.currentChatId, ids }),
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getInitials(title) {
  const words = String(title).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '?';
  }
  if (words.length === 1) {
    return words[0].slice(0, 1).toUpperCase();
  }
  return (words[0].slice(0, 1) + words[1].slice(0, 1)).toUpperCase();
}

function formatTime(ts) {
  if (!ts) return '';
  const date = new Date(ts * 1000);
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function detectTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark' || saved === 'light') {
    return saved;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.body.classList.toggle('dark-theme', theme === 'dark');
  document.body.classList.toggle('light-theme', theme === 'light');
  if (themeToggleBtn) {
    themeToggleBtn.textContent = theme === 'dark' ? '☀' : '☾';
    themeToggleBtn.title = theme === 'dark' ? 'Светлая тема' : 'Тёмная тема';
  }
}

function getMessagePlainText(msg) {
  const type = msg.type || 'text';
  if (type === 'text') {
    return String(msg.text || '').replace(/\s+/g, ' ').trim();
  }
  if (type === 'image') return 'Фото';
  if (type === 'audio') return 'Голосовое сообщение';
  if (type === 'video') return 'Видео-кружок';
  return String(msg.text || '');
}

function setReplyMessage(msg) {
  if (!msg) {
    state.replyTo = null;
    replyPreview.classList.add('hidden');
    return;
  }

  state.replyTo = {
    id: msg.id || '',
    author: msg.author || '',
    text: getMessagePlainText(msg).slice(0, 140),
  };

  replyAuthor.textContent = `Ответ: ${state.replyTo.author || 'пользователь'}`;
  replyText.textContent = state.replyTo.text || 'Сообщение';
  replyPreview.classList.remove('hidden');
}

function closeContextMenu() {
  state.contextMessage = null;
  messageContextMenu.classList.add('hidden');
}

function renderUserSearchItems(items) {
  userSearchResults.innerHTML = '';
  if (!Array.isArray(items) || items.length === 0) {
    userSearchResults.innerHTML = '<div class="user-search-empty">Ничего не найдено.</div>';
    return;
  }

  for (const item of items) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'user-search-item';
    const avatarHtml = item.avatar
      ? `<img src="${encodeURI(item.avatar)}" alt="">`
      : escapeHtml(getInitials(item.username || '?'));
    row.innerHTML = `
      <span class="user-search-item__avatar">${avatarHtml}</span>
      <span class="user-search-item__name">${escapeHtml(item.username || '')}</span>
      <span class="user-search-item__hint">${item.chatId ? 'Открыть' : 'Новый чат'}</span>
    `;
    row.addEventListener('click', async () => {
      try {
        const payload = item.chatId
          ? { chat: { id: item.chatId } }
          : await api('create_chat.php', {
            method: 'POST',
            body: JSON.stringify({ peer: item.username }),
          });

        await loadChats();
        if (payload?.chat?.id) {
          state.currentChatId = payload.chat.id;
          await loadMessages();
          renderChats();
        }
        userSearchModal.classList.add('hidden');
      } catch (error) {
        alert(error.message || 'Не удалось открыть чат');
      }
    });
    userSearchResults.appendChild(row);
  }
}

async function fetchUsersForSearch() {
  const q = userSearchInput.value.trim();
  const data = await api(`users.php?q=${encodeURIComponent(q)}`, { method: 'GET' });
  renderUserSearchItems(data.items || []);
}

function openContextMenu(event, msg) {
  state.contextMessage = msg;
  const x = Math.max(10, Math.min(event.clientX, window.innerWidth - 200));
  const y = Math.max(10, Math.min(event.clientY, window.innerHeight - 160));
  messageContextMenu.style.left = `${x}px`;
  messageContextMenu.style.top = `${y}px`;
  messageContextMenu.classList.remove('hidden');
}

function setTypingIndicator(active) {
  if (active) {
    chatSubtitle.innerHTML = '<span class="typing"><span></span><span></span><span></span></span> печатает...';
    if (state.typingHideTimer) {
      clearTimeout(state.typingHideTimer);
    }
    state.typingHideTimer = setTimeout(() => {
      state.typingHideTimer = null;
      if (state.currentChatId) {
        loadMessages().catch(() => {});
      }
    }, 1600);
    return;
  }

  if (state.typingHideTimer) {
    clearTimeout(state.typingHideTimer);
    state.typingHideTimer = null;
  }
}

function applyWallpaper(dataUrl) {
  if (!tgPanel) return;
  if (dataUrl) {
    tgPanel.style.backgroundImage = `url("${dataUrl}")`;
    tgPanel.style.backgroundColor = '#ffffff';
    tgPanel.classList.add('with-wallpaper');
    return;
  }

  tgPanel.style.backgroundImage = '';
  tgPanel.classList.remove('with-wallpaper');
}

function applyFilter() {
  const query = state.search.trim().toLowerCase();
  if (!query) {
    state.filteredChats = [...state.chats];
    return;
  }

  state.filteredChats = state.chats.filter((chat) => {
    const title = String(chat.title || '').toLowerCase();
    const preview = String(chat.lastMessage || '').toLowerCase();
    return title.includes(query) || preview.includes(query);
  });
}

function renderChats() {
  applyFilter();
  chatList.innerHTML = '';

  for (const chat of state.filteredChats) {
    const avatarHtml = chat.avatar
      ? `<img class="chat-avatar__img" src="${encodeURI(chat.avatar)}" alt="">`
      : escapeHtml(getInitials(chat.title || 'Chat'));

    const item = document.createElement('button');
    item.type = 'button';
    item.className = `chat-item ${chat.id === state.currentChatId ? 'active' : ''}`;
    item.innerHTML = `
      <div class="chat-avatar">${avatarHtml}</div>
      <div class="chat-main">
        <div class="chat-item__title">${escapeHtml(chat.title || 'Без названия')}</div>
        <div class="chat-item__preview">${escapeHtml(chat.lastMessage || 'Нет сообщений')}</div>
      </div>
      <div class="chat-meta">${escapeHtml(formatTime(chat.updatedAt))}</div>
    `;
    item.addEventListener('click', () => selectChat(chat.id));
    chatList.appendChild(item);
  }
}

function renderPanelMode() {
  const hasChat = Boolean(state.currentChatId);
  chatHeader.classList.toggle('hidden', !hasChat);
  chatWrap.classList.toggle('hidden', !hasChat);
  pinnedBar.classList.toggle('hidden', !hasChat);
  panelEmpty.classList.toggle('hidden', hasChat);

  if (window.matchMedia('(max-width: 1024px)').matches) {
    document.body.classList.toggle('mobile-chat-open', hasChat);
  }
}

function formatMessageCount(count) {
  if (count === 1) return '1 сообщение';
  if (count >= 2 && count <= 4) return `${count} сообщения`;
  return `${count} сообщений`;
}

function updateSelectionBar() {
  const count = selectedMessageIds.size;
  selectionCount.textContent = formatMessageCount(count);
  selectionBar.classList.toggle('hidden', count === 0);
  document.body.classList.toggle('mobile-select-mode', count > 0);
}

function clearSelection() {
  selectedMessageIds.clear();
  updateSelectionBar();
}

function renderMessageContent(msg) {
  const type = msg.type || 'text';
  const media = msg.media || null;
  const reply = (msg.reply && typeof msg.reply === 'object') ? msg.reply : null;
  const replyHtml = reply
    ? `
      <div class="message-reply">
        <div class="message-reply__author">${escapeHtml(reply.author || 'Пользователь')}</div>
        <div class="message-reply__text">${escapeHtml(reply.text || '')}</div>
      </div>
    `
    : '';

  if (type === 'image' && media?.url) {
    return `${replyHtml}<img class="message-media" src="${encodeURI(media.url)}" alt="Фото">`;
  }

  if (type === 'audio' && media?.url) {
    const bars = Array.from({ length: 20 }, (_, i) => {
      const h = 20 + ((i * 37) % 70);
      return `<span class="voice-player__bar" style="--h:${h}%"></span>`;
    }).join('');

    return `
      ${replyHtml}
      <div class="voice-player" data-audio-player>
        <button type="button" class="voice-player__btn" data-audio-toggle>▶</button>
        <div class="voice-player__wave">${bars}</div>
        <div class="voice-player__time" data-audio-time>00:00</div>
        <audio preload="metadata" src="${encodeURI(media.url)}"></audio>
      </div>
    `;
  }

  if (type === 'video' && media?.url) {
    return `${replyHtml}<div class="message-video-circle"><video autoplay muted loop playsinline preload="metadata" src="${encodeURI(media.url)}"></video></div>`;
  }

  return `${replyHtml}<div>${escapeHtml(msg.text || '')}</div>`;
}

async function loadChats() {
  const data = await api('chats.php');
  state.chats = data.items || [];

  if (state.currentChatId && !state.chats.some((c) => c.id === state.currentChatId)) {
    state.currentChatId = null;
  }

  const isMobile = window.matchMedia('(max-width: 1024px)').matches;
  if (!state.currentChatId && state.chats.length > 0 && !isMobile) {
    state.currentChatId = state.chats[0].id;
  }

  renderChats();
  renderPanelMode();
}

async function loadMessages() {
  if (!state.currentChatId) {
    messagesBox.innerHTML = '';
    chatTitle.textContent = 'Избранное';
    chatSubtitle.textContent = '0 сообщений';
    pinnedText.textContent = 'Нет закрепленного сообщения';
    renderPanelMode();
    clearSelection();
    return;
  }

  const chat = state.chats.find((c) => c.id === state.currentChatId);
  chatTitle.textContent = chat?.title || 'Избранное';

  const data = await api(`messages.php?chat=${encodeURIComponent(state.currentChatId)}`, {
    method: 'GET',
  });
  const items = data.items || [];
  chatSubtitle.textContent = formatMessageCount(items.length);
  const lastText = items.length > 0 ? (items[items.length - 1].text || 'Нет сообщений') : 'Нет сообщений';
  pinnedText.textContent = lastText;

  const isNearBottom = messagesBox.scrollTop + messagesBox.clientHeight >= messagesBox.scrollHeight - 80;

  messagesBox.innerHTML = '';
  for (const msg of items) {
    const mine = msg.author === state.user;
    const selected = selectedMessageIds.has(msg.id);
    const safeAuthor = escapeHtml(msg.author || '');
    const safeTime = escapeHtml(formatTime(msg.createdAt));
    const showAuthor = !mine && (msg.type || 'text') !== 'video';

    const node = document.createElement('article');
    node.className = `message ${mine ? 'message--mine' : 'message--other'}`;
    node.classList.add('selectable');
    node.dataset.messageId = msg.id || '';
    if (selected) {
      node.classList.add('selected');
    }
    if ((msg.type || 'text') === 'video') {
      node.classList.add('message--video');
    }
    node.innerHTML = `
      <span class="message-selection-dot">${selected ? '✓' : ''}</span>
      <div class="message__author ${showAuthor ? '' : 'hidden'}">${safeAuthor}</div>
      ${renderMessageContent(msg)}
      <div class="message__time">${safeTime}</div>
    `;
    node.addEventListener('click', () => {
      if (selectedMessageIds.size === 0) {
        return;
      }
      if (!mine) {
        return;
      }
      if (selectedMessageIds.has(msg.id)) {
        selectedMessageIds.delete(msg.id);
      } else {
        selectedMessageIds.add(msg.id);
      }
      loadMessages().catch(() => {});
      updateSelectionBar();
    });

    node.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      openContextMenu(event, { ...msg, mine });
    });

    let pressTimer = null;
    let touchStartX = 0;
    let touchStartY = 0;
    let swipeTriggered = false;
    node.addEventListener('touchstart', (event) => {
      touchStartX = event.touches?.[0]?.clientX || 0;
      touchStartY = event.touches?.[0]?.clientY || 0;
      swipeTriggered = false;
      pressTimer = setTimeout(() => {
        openContextMenu({
          clientX: touchStartX || 24,
          clientY: touchStartY || 24,
        }, { ...msg, mine });
      }, 420);
    }, { passive: true });
    node.addEventListener('touchend', () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    });
    node.addEventListener('touchmove', (event) => {
      const touchX = event.touches?.[0]?.clientX || 0;
      const touchY = event.touches?.[0]?.clientY || 0;
      const dx = touchX - touchStartX;
      const dy = Math.abs(touchY - touchStartY);
      if (!swipeTriggered && dx > 70 && dy < 36) {
        swipeTriggered = true;
        setReplyMessage(msg);
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
      }
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    });

    const image = node.querySelector('.message-media');
    if (image) {
      image.addEventListener('click', () => {
        lightboxImage.src = image.src;
        imageLightbox.classList.remove('hidden');
      });
    }

    const audioRoot = node.querySelector('[data-audio-player]');
    if (audioRoot) {
      const audioEl = audioRoot.querySelector('audio');
      const toggleBtn = audioRoot.querySelector('[data-audio-toggle]');
      const timeEl = audioRoot.querySelector('[data-audio-time]');
      const bars = Array.from(audioRoot.querySelectorAll('.voice-player__bar'));
      const syncBars = () => {
        const duration = Number(audioEl.duration) || 1;
        const progress = Math.max(0, Math.min(1, audioEl.currentTime / duration));
        const activeCount = Math.round(progress * bars.length);
        bars.forEach((bar, i) => bar.classList.toggle('active', i < activeCount));
      };

      toggleBtn.addEventListener('click', () => {
        const others = messagesBox.querySelectorAll('[data-audio-player] audio');
        others.forEach((other) => {
          if (other !== audioEl) other.pause();
        });
        if (audioEl.paused) {
          audioEl.play().catch(() => {});
        } else {
          audioEl.pause();
        }
      });

      audioEl.addEventListener('play', () => {
        toggleBtn.textContent = '❚❚';
      });
      audioEl.addEventListener('pause', () => {
        toggleBtn.textContent = '▶';
      });
      audioEl.addEventListener('timeupdate', () => {
        const sec = Math.floor(audioEl.currentTime || 0);
        const mm = String(Math.floor(sec / 60)).padStart(2, '0');
        const ss = String(sec % 60).padStart(2, '0');
        timeEl.textContent = `${mm}:${ss}`;
        syncBars();
      });
      audioEl.addEventListener('ended', () => {
        timeEl.textContent = '00:00';
        syncBars();
      });
      syncBars();
    }

    messagesBox.appendChild(node);
  }

  if (isNearBottom) {
    messagesBox.scrollTop = messagesBox.scrollHeight;
  }

  setTypingIndicator(false);
  renderPanelMode();
  updateSelectionBar();
}

function startPolling() {
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
  }

  state.pollTimer = setInterval(async () => {
    if (state.wsConnected) {
      return;
    }
    try {
      await loadChats();
      await loadMessages();
    } catch (_) {
      // Ignore transient polling failures.
    }
  }, 4000);
}

async function selectChat(chatId) {
  clearSelection();
  setReplyMessage(null);
  closeContextMenu();
  state.currentChatId = chatId;
  renderChats();
  await loadMessages();
}

function closeMobileChatView() {
  if (!window.matchMedia('(max-width: 1024px)').matches) {
    return;
  }

  state.currentChatId = null;
  clearSelection();
  setReplyMessage(null);
  closeContextMenu();
  messagesBox.innerHTML = '';
  chatTitle.textContent = 'Чат';
  renderChats();
  renderPanelMode();
}

function pickSupportedMime(candidates) {
  if (!window.MediaRecorder) {
    return '';
  }

  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return '';
}

function setRecordingUi({ voice = false, video = false, text = '' } = {}) {
  // Убрали переключатель удаленной кнопки voiceBtn
  videoBtn.classList.toggle('active', video);
  micBtn.classList.toggle('active', voice);

  if (text) {
    recordState.textContent = text;
    recordState.classList.remove('hidden');
  } else {
    recordState.classList.add('hidden');
  }
}

function showUiNotice(text) {
  if (!text) return;
  if (state.noticeHideTimer) {
    clearTimeout(state.noticeHideTimer);
    state.noticeHideTimer = null;
  }
  recordState.textContent = text;
  recordState.classList.remove('hidden');
  state.noticeHideTimer = setTimeout(() => {
    state.noticeHideTimer = null;
    if (!state.audioRecording && !state.videoRecording) {
      recordState.classList.add('hidden');
    }
  }, 2600);
}

function hasMediaSupport(kind) {
  if (!window.MediaRecorder || !navigator.mediaDevices?.getUserMedia) {
    return false;
  }
  if (kind === 'video') {
    return isSecureContext;
  }
  return true;
}

function applyMediaSupportState() {
  const voiceOk = hasMediaSupport('audio');
  const videoOk = hasMediaSupport('video');

  micBtn.disabled = !voiceOk;
  videoBtn.disabled = !videoOk;
  micBtn.classList.toggle('is-disabled', !voiceOk);
  videoBtn.classList.toggle('is-disabled', !videoOk);

  if (!voiceOk) {
    micBtn.title = 'Голосовые недоступны: нужен HTTPS и поддержка браузера';
  }
  if (!videoOk) {
    videoBtn.title = 'Видео-кружки недоступны: нужен HTTPS и поддержка браузера';
  }
}

function updateComposerButtons() {
  const hasText = messageInput.value.trim().length > 0;
  sendBtn.classList.toggle('hidden', !hasText);
  micBtn.classList.toggle('hidden', hasText);
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function startVideoTimer() {
  state.videoStartedAt = Date.now();
  videoRecordTimer.textContent = '00:00';
  if (state.videoTimerInterval) {
    clearInterval(state.videoTimerInterval);
  }

  state.videoTimerInterval = setInterval(() => {
    videoRecordTimer.textContent = formatDuration(Date.now() - state.videoStartedAt);
  }, 250);
}

function stopVideoTimer() {
  if (state.videoTimerInterval) {
    clearInterval(state.videoTimerInterval);
    state.videoTimerInterval = null;
  }
}

function showVideoOverlay(stream) {
  videoRecordPreview.srcObject = stream;
  videoRecordOverlay.classList.remove('hidden');
  videoRecordPreview.play().catch(() => {});
  startVideoTimer();
}

function hideVideoOverlay() {
  stopVideoTimer();
  videoRecordOverlay.classList.add('hidden');
  videoRecordPreview.pause();
  videoRecordPreview.srcObject = null;
}

async function stopVoiceRecording() {
  if (!state.audioRecording) {
    return;
  }

  const rec = state.audioRecording;
  state.audioRecording = null;
  setRecordingUi();
  if (rec.recorder.state !== 'inactive') {
    rec.recorder.stop();
  }
  rec.stream.getTracks().forEach((t) => t.stop());
}

async function stopVideoRecording(discard = false) {
  if (!state.videoRecording) {
    return;
  }

  const rec = state.videoRecording;
  rec.discard = discard;
  rec.recorder.discard = discard;
  state.videoRecording = null;
  setRecordingUi();
  hideVideoOverlay();
  if (rec.recorder.state !== 'inactive') {
    rec.recorder.stop();
  }
  rec.stream.getTracks().forEach((t) => t.stop());
}

async function startVoiceRecording() {
  if (!state.currentChatId) {
    alert('Сначала выберите чат');
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    showUiNotice('Голосовые недоступны в этом браузере');
    return;
  }

  await stopVideoRecording();

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickSupportedMime(['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm']) || undefined;
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  recorder.onstop = async () => {
    if (state.videoRecording?.discard || recorder.discard) {
      return;
    }

    if (chunks.length === 0) {
      return;
    }

    const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
    const ext = blob.type.includes('ogg') ? 'ogg' : (blob.type.includes('wav') ? 'wav' : 'webm');
    const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: blob.type });
    try {
      await uploadMedia(file, 'audio');
      sendWs({ type: 'message', chatId: state.currentChatId });
      await loadChats();
      await loadMessages();
    } catch (error) {
      alert(error.message || 'Не удалось отправить голосовое');
    }
  };

  state.audioRecording = { recorder, stream };
  recorder.start();
  setRecordingUi({ voice: true, text: 'Идет запись голосового...' });
}

async function startVideoRecording() {
  if (!state.currentChatId) {
    alert('Сначала выберите чат');
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    showUiNotice('Видео-кружки недоступны в этом браузере');
    return;
  }
  if (!isSecureContext) {
    showUiNotice('Для записи видео нужен HTTPS');
    return;
  }

  await stopVoiceRecording();

  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  const mimeType = pickSupportedMime(['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']) || undefined;
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  recorder.onstop = async () => {
    if (chunks.length === 0) {
      return;
    }

    const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const file = new File([blob], `circle_${Date.now()}.${ext}`, { type: blob.type });
    try {
      await uploadMedia(file, 'video');
      sendWs({ type: 'message', chatId: state.currentChatId });
      await loadChats();
      await loadMessages();
    } catch (error) {
      alert(error.message || 'Не удалось отправить видео-кружок');
    }
  };

  state.videoRecording = { recorder, stream, discard: false };
  recorder.start();
  showVideoOverlay(stream);
  setRecordingUi({ video: true, text: 'Идет запись видео-кружка...' });
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  const password = passwordInput ? passwordInput.value : '';
  if (!name || !password) return;

  try {
    const result = await api('login.php', {
      method: 'POST',
      body: JSON.stringify({ name, password }),
    });

    state.user = result.user || name;
    authModal.classList.add('hidden');
    await loadChats();
    await loadMessages();
    connectWebSocket();
    startPolling();
  } catch (error) {
    alert(error.message || 'Ошибка входа');
  }
});

if (registerBtn) {
  registerBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    const password = passwordInput ? passwordInput.value : '';
    if (!name || !password) {
      alert('Введите имя и пароль');
      return;
    }

    const avatarFile = avatarInput && avatarInput.files && avatarInput.files[0]
      ? avatarInput.files[0]
      : null;

    try {
      const result = await registerAccount(name, password, avatarFile);
      state.user = result.user || name;
      authModal.classList.add('hidden');
      await loadChats();
      await loadMessages();
      connectWebSocket();
      startPolling();
    } catch (error) {
      alert(error.message || 'Ошибка регистрации');
    }
  });
}

sendForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text || !state.currentChatId) return;

  const replyPayload = state.replyTo
    ? {
      id: state.replyTo.id || '',
      author: state.replyTo.author || '',
      text: (state.replyTo.text || '').slice(0, 200),
    }
    : null;

  await api('send.php', {
    method: 'POST',
    body: JSON.stringify({ chat: state.currentChatId, text, reply: replyPayload }),
  });
  sendWs({ type: 'message', chatId: state.currentChatId });

  messageInput.value = '';
  setReplyMessage(null);
  updateComposerButtons();
  await loadChats();
  await loadMessages();
});

messageInput.addEventListener('input', () => {
  updateComposerButtons();
  if (messageInput.value.trim()) {
    setTypingIndicator(true);
    const now = Date.now();
    if (now >= state.typingThrottleUntil && state.currentChatId) {
      state.typingThrottleUntil = now + 1000;
      sendWs({ type: 'typing', chatId: state.currentChatId });
    }
  } else {
    setTypingIndicator(false);
    if (state.currentChatId) {
      loadMessages().catch(() => {});
    }
  }
});

photoBtn.addEventListener('click', () => {
  if (!state.currentChatId) {
    alert('Сначала выберите чат');
    return;
  }
  photoInput.click();
});

photoInput.addEventListener('change', async () => {
  const file = photoInput.files && photoInput.files[0];
  if (!file) {
    return;
  }

  try {
    await uploadMedia(file, 'image');
    sendWs({ type: 'message', chatId: state.currentChatId });
    await loadChats();
    await loadMessages();
  } catch (error) {
    alert(error.message || 'Не удалось отправить фото');
  } finally {
    photoInput.value = '';
  }
});

micBtn.addEventListener('click', async () => {
  try {
    if (state.audioRecording) {
      await stopVoiceRecording();
      return;
    }
    await startVoiceRecording();
  } catch (error) {
    setRecordingUi();
    showUiNotice(error.message || 'Не удалось записать голосовое');
  }
});

videoBtn.addEventListener('click', async () => {
  try {
    if (state.videoRecording) {
      await stopVideoRecording(false);
      return;
    }
    await startVideoRecording();
  } catch (error) {
    setRecordingUi();
    showUiNotice(error.message || 'Не удалось записать видео-кружок');
  }
});

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    const next = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });
}

replyCancelBtn.addEventListener('click', () => {
  setReplyMessage(null);
});

imageLightbox.addEventListener('click', () => {
  imageLightbox.classList.add('hidden');
  lightboxImage.removeAttribute('src');
});

ctxCopyBtn.addEventListener('click', async () => {
  const text = getMessagePlainText(state.contextMessage || {});
  if (text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      // ignore clipboard issues
    }
  }
  closeContextMenu();
});

ctxReplyBtn.addEventListener('click', () => {
  if (state.contextMessage) {
    setReplyMessage(state.contextMessage);
  }
  closeContextMenu();
});

ctxDeleteBtn.addEventListener('click', async () => {
  const msg = state.contextMessage;
  closeContextMenu();
  if (!msg?.mine || !msg?.id) {
    return;
  }
  try {
    await deleteMessages([msg.id]);
    sendWs({ type: 'message', chatId: state.currentChatId });
    await loadChats();
    await loadMessages();
  } catch (error) {
    alert(error.message || 'Не удалось удалить сообщение');
  }
});

document.addEventListener('click', (event) => {
  if (!messageContextMenu.classList.contains('hidden') && !messageContextMenu.contains(event.target)) {
    closeContextMenu();
  }
});

logoutBtn.addEventListener('click', async () => {
  await api('logout.php', { method: 'POST', body: '{}' });

  await stopVoiceRecording();
  await stopVideoRecording(true);

  state.user = null;
  state.chats = [];
  state.filteredChats = [];
  state.currentChatId = null;
  state.search = '';
  setReplyMessage(null);
  closeContextMenu();
  setTypingIndicator(false);
  clearSelection();

  chatList.innerHTML = '';
  messagesBox.innerHTML = '';
  chatTitle.textContent = 'Чат';
  chatSubtitle.textContent = '0 сообщений';
  renderPanelMode();
  updateComposerButtons();

  authModal.classList.remove('hidden');
  disconnectWebSocket();
  if (state.pollTimer) clearInterval(state.pollTimer);
});

videoRecordOverlay.addEventListener('click', async (event) => {
  if (!state.videoRecording) {
    return;
  }

  if (event.target === videoRecordOverlay) {
    await stopVideoRecording(true);
  }
});

document.addEventListener('visibilitychange', async () => {
  if (document.hidden) {
    await stopVoiceRecording();
    await stopVideoRecording(true);
  }
});

window.addEventListener('beforeunload', () => {
  if (state.audioRecording) {
    state.audioRecording.stream.getTracks().forEach((t) => t.stop());
  }
  if (state.videoRecording) {
    state.videoRecording.stream.getTracks().forEach((t) => t.stop());
  }
});

newChatBtn.addEventListener('click', async () => {
  if (!state.user) return;
  userSearchModal.classList.remove('hidden');
  userSearchInput.value = '';
  await fetchUsersForSearch();
  userSearchInput.focus();
});

backToChatsBtn.addEventListener('click', () => {
  closeMobileChatView();
});

selectionCancelBtn.addEventListener('click', () => {
  clearSelection();
  loadMessages().catch(() => {});
});

deleteSelectedBtn.addEventListener('click', async () => {
  if (selectedMessageIds.size === 0) {
    return;
  }

  try {
    await deleteMessages(Array.from(selectedMessageIds));
    sendWs({ type: 'message', chatId: state.currentChatId });
    clearSelection();
    await loadChats();
    await loadMessages();
  } catch (error) {
    alert(error.message || 'Не удалось удалить сообщения');
  }
});

chatSearch.addEventListener('input', () => {
  state.search = chatSearch.value || '';
  renderChats();
});

userSearchInput.addEventListener('input', () => {
  fetchUsersForSearch().catch(() => {});
});

userSearchCloseBtn.addEventListener('click', () => {
  userSearchModal.classList.add('hidden');
});

userSearchModal.addEventListener('click', (event) => {
  if (event.target === userSearchModal) {
    userSearchModal.classList.add('hidden');
  }
});

setWallpaperBtn.addEventListener('click', () => {
  wallpaperInput.click();
});

wallpaperInput.addEventListener('change', () => {
  const file = wallpaperInput.files && wallpaperInput.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('Нужен файл изображения.');
    wallpaperInput.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const result = typeof reader.result === 'string' ? reader.result : '';
    if (!result) return;

    localStorage.setItem(WALLPAPER_KEY, result);
    applyWallpaper(result);
    wallpaperInput.value = '';
  };
  reader.readAsDataURL(file);
});

resetWallpaperBtn.addEventListener('click', () => {
  localStorage.removeItem(WALLPAPER_KEY);
  applyWallpaper('');
});

async function init() {
  applyTheme(detectTheme());
  applyWallpaper(localStorage.getItem(WALLPAPER_KEY) || '');
  applyMediaSupportState();

  try {
    const me = await api('me.php', { method: 'GET' });
    state.user = me.user || null;

    if (!state.user) {
      authModal.classList.remove('hidden');
      return;
    }

    authModal.classList.add('hidden');
    updateComposerButtons();
    await loadChats();
    await loadMessages();
    connectWebSocket();
    startPolling();
  } catch (_) {
    authModal.classList.remove('hidden');
  }
}

init();

window.addEventListener('resize', () => {
  if (!window.matchMedia('(max-width: 1024px)').matches) {
    document.body.classList.remove('mobile-chat-open');
  } else {
    document.body.classList.toggle('mobile-chat-open', Boolean(state.currentChatId));
  }
});

const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
systemThemeQuery.addEventListener('change', () => {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark' || saved === 'light') {
    return;
  }
  applyTheme(systemThemeQuery.matches ? 'dark' : 'light');
});
