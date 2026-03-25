<?php
session_start();
?>
<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Private Messenger</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <main class="tg-layout">
    <aside class="tg-sidebar">
      <header class="tg-topbar">
        <button id="logoutBtn" class="icon-btn" title="Выйти">
          <span></span>
          <span></span>
          <span></span>
        </button>
        <button id="themeToggleBtn" class="icon-btn theme-btn" title="Сменить тему">☾</button>
        <label class="search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 3a7.5 7.5 0 015.97 12.05l4.24 4.24-1.41 1.41-4.24-4.24A7.5 7.5 0 1110.5 3zm0 2a5.5 5.5 0 100 11 5.5 5.5 0 000-11z"></path></svg>
          <input id="chatSearch" type="search" placeholder="Search" autocomplete="off">
        </label>
      </header>

      <div id="chatList" class="tg-chat-list"></div>

      <div class="wallpaper-tools">
        <button id="setWallpaperBtn" class="wall-btn" type="button" title="Установить свои обои">Обои</button>
        <button id="resetWallpaperBtn" class="wall-btn wall-btn--muted" type="button" title="Сбросить обои">Сброс</button>
        <input id="wallpaperInput" type="file" accept="image/*" hidden>
      </div>

      <button id="newChatBtn" class="fab" title="Новый диалог">✎</button>
    </aside>

    <section class="tg-panel">
      <header id="chatHeader" class="panel-header hidden">
        <button id="backToChatsBtn" class="back-btn" type="button" title="Назад">←</button>
        <div id="chatHeadAvatar" class="chat-head-avatar">🔖</div>
        <div class="chat-head-text">
          <h2 id="chatTitle">Избранное</h2>
          <p id="chatSubtitle">0 сообщений</p>
        </div>
        <button id="chatMenuBtn" class="chat-menu-btn" type="button" title="Меню">⋮</button>
      </header>

      <div id="pinnedBar" class="pinned-bar hidden">
        <div class="pinned-bar__label">Закрепленное сообщение</div>
        <div id="pinnedText" class="pinned-bar__text">Нет закрепленного сообщения</div>
      </div>

      <div id="panelEmpty" class="panel-empty">
        <div class="empty-card">
          <h1>Private Messenger</h1>
          <p>Выберите чат слева или создайте новый диалог.</p>
        </div>
      </div>

      <div id="chatWrap" class="chat-wrap hidden">
        <div id="messages" class="messages"></div>
        <form id="sendForm" class="composer">
          <input id="photoInput" type="file" accept="image/*" hidden>
          <div id="replyPreview" class="reply-preview hidden">
            <div class="reply-preview__meta">
              <span id="replyAuthor">Ответ</span>
              <button id="replyCancelBtn" type="button" class="reply-preview__cancel">✕</button>
            </div>
            <div id="replyText" class="reply-preview__text"></div>
          </div>
          
          <button id="photoBtn" type="button" class="icon-circle-btn icon-attach" title="Отправить фото">📎</button>
          <button id="videoBtn" type="button" class="icon-circle-btn icon-attach" title="Записать видео-кружок">📷</button>
          
          <input id="messageInput" type="text" placeholder="Введите сообщение" maxlength="2000" autocomplete="off">
          <span id="recordState" class="record-state hidden">Идет запись...</span>
          
          <button id="sendBtn" type="submit" class="icon-circle-btn icon-send hidden">➤</button>
          <button id="micBtn" type="button" class="icon-circle-btn icon-mic" title="Записать голосовое">🎤</button>
        </form>
      </div>
    </section>
  </main>

  <div id="authModal" class="modal hidden">
    <div class="modal-card">
      <h3>Вход</h3>
      <p>Войдите в аккаунт или создайте новый.</p>
      <form id="loginForm" class="modal-form">
        <input id="nameInput" type="text" placeholder="Ваше имя" maxlength="40" autocomplete="off" required>
        <input id="passwordInput" type="password" placeholder="Пароль" minlength="4" maxlength="120" autocomplete="off" required>
        <label class="auth-avatar-picker">
          <span>Аватар (для регистрации)</span>
          <input id="avatarInput" type="file" accept="image/*">
        </label>
        <button type="submit">Войти</button>
        <button id="registerBtn" type="button">Создать аккаунт</button>
      </form>
    </div>
  </div>

  <div id="videoRecordOverlay" class="video-overlay hidden">
    <div class="video-overlay__center">
      <video id="videoRecordPreview" autoplay muted playsinline></video>
    </div>
    <div class="video-overlay__bottom">
      <span id="videoRecordTimer">00:00</span>
      <span>Для отмены нажмите вне круга</span>
    </div>
  </div>

  <div id="selectionBar" class="selection-bar hidden">
    <button id="selectionCancelBtn" type="button" class="selection-bar__btn">✕</button>
    <span id="selectionCount">0 сообщений</span>
    <div class="selection-spacer"></div>
    <button id="deleteSelectedBtn" type="button" class="selection-bar__delete">Удалить</button>
  </div>

  <div id="imageLightbox" class="lightbox hidden">
    <img id="lightboxImage" alt="Фото">
  </div>

  <div id="messageContextMenu" class="context-menu hidden">
    <button id="ctxCopyBtn" type="button">Копировать</button>
    <button id="ctxReplyBtn" type="button">Ответить</button>
    <button id="ctxDeleteBtn" type="button" class="danger">Удалить</button>
  </div>

  <div id="userSearchModal" class="modal hidden">
    <div class="modal-card user-search-modal">
      <h3>Найти человека</h3>
      <p>Введите имя пользователя, чтобы начать диалог.</p>
      <input id="userSearchInput" type="text" placeholder="Имя пользователя" maxlength="40" autocomplete="off">
      <div id="userSearchResults" class="user-search-results"></div>
      <button id="userSearchCloseBtn" type="button" class="user-search-close">Закрыть</button>
    </div>
  </div>

  <script src="app.js"></script>
</body>
</html>
