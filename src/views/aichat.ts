/**
 * AI チャットページのHTML
 */
import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

export function getAiChatPage(user: {
  name?: string;
  username: string;
  avatar?: string;
  aiChatModel: string;
  aiChatModelConfigured?: boolean;
  fallbackModel?: string;
}): string {
  const displayName = escapeHtml(user.name || user.username);
  const initials = escapeHtml((user.name || user.username).substring(0, 2).toUpperCase());
  const safeModel = escapeHtml(user.aiChatModel);
  const modelShortName = escapeHtml(user.aiChatModel.split('/').pop() ?? user.aiChatModel);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI チャット</title>
  ${getThemeInitScript()}
  <style>
    ${getThemeCSS()}
    ${getThemeToggleCSS()}

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html, body { height: 100%; overflow: hidden; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-primary, #f8fafc);
      color: var(--text-primary);
      display: flex;
      flex-direction: column;
    }

    /* ======= ナビバー（全幅・縦幅縮小） ======= */
    .navbar {
      position: sticky; top: 0; z-index: 200;
      background: var(--navbar-bg);
      backdrop-filter: blur(10px);
      box-shadow: 0 2px 8px var(--navbar-shadow);
      padding: 0 20px;
      height: 44px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }

    /* サイドバートグル — ナビバー内左端 */
    .sidebar-toggle {
      width: 32px; height: 32px;
      border-radius: 7px;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
      color: var(--text-muted);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; font-size: 15px; flex-shrink: 0;
      transition: background 0.15s, color 0.15s;
    }
    .sidebar-toggle:hover { background: var(--border-color); color: var(--text-primary); }
    .sidebar-toggle.active { background: var(--accent-color, #667eea); color: #fff; border-color: var(--accent-color, #667eea); }

    .navbar-brand {
      font-size: 17px; font-weight: 700;
      color: var(--text-primary); text-decoration: none;
      display: flex; align-items: baseline; gap: 7px;
      white-space: nowrap;
    }
    .navbar-model { font-size: 11px; font-weight: 400; color: var(--text-muted); }

    .navbar-spacer { flex: 1; }

    .user-menu { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
    .user-name { font-size: 13px; color: var(--text-secondary); font-weight: 500; }
    .user-icon {
      width: 32px; height: 32px; border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: 600; font-size: 13px; cursor: pointer;
      transition: transform 0.2s; flex-shrink: 0;
    }
    .user-icon:hover { transform: scale(1.05); }
    .user-menu-container { position: relative; }
    .dropdown-menu {
      display: none; position: absolute; top: 40px; right: 0;
      background: var(--dropdown-bg); border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 180px; z-index: 1000; overflow: hidden;
    }
    .dropdown-menu.show { display: block; }
    .dropdown-item {
      padding: 11px 18px; color: var(--text-secondary); text-decoration: none;
      display: block; transition: background 0.15s; cursor: pointer;
      border-bottom: 1px solid var(--border-color); font-size: 13px;
    }
    .dropdown-item:last-child { border-bottom: none; }
    .dropdown-item:hover { background: var(--dropdown-hover); }
    .dropdown-item.logout { color: var(--danger-color); }

    /* ======= レイアウト本体 ======= */
    .body-area {
      flex: 1; display: flex; overflow: hidden; min-height: 0;
    }

    /* ======= 左サイドバー ======= */
    .sidebar {
      width: 0; flex-shrink: 0;
      background: var(--card-bg);
      border-right: 1px solid var(--border-color);
      display: flex; flex-direction: column;
      overflow: hidden;
      transition: width 0.25s ease;
    }
    .sidebar.open { width: 260px; }

    .sidebar-head {
      padding: 10px 12px 8px; border-bottom: 1px solid var(--border-color); flex-shrink: 0;
    }
    .sidebar-search-wrap { position: relative; }
    .sidebar-search {
      width: 100%; padding: 7px 28px 7px 9px;
      border-radius: 6px; border: 1px solid var(--border-color);
      background: var(--bg-secondary); color: var(--text-primary);
      font-size: 12px; font-family: inherit; outline: none;
      transition: border-color 0.15s;
    }
    .sidebar-search:focus { border-color: var(--accent-color, #667eea); }
    .sidebar-search-clear {
      position: absolute; right: 7px; top: 50%; transform: translateY(-50%);
      background: none; border: none; color: var(--text-muted); cursor: pointer;
      font-size: 13px; display: none; padding: 0 2px; line-height: 1;
    }
    .sidebar-search-clear.visible { display: block; }
    .sidebar-status { font-size: 10px; color: var(--text-muted); padding: 5px 12px 3px; flex-shrink: 0; }

    .sidebar-results {
      flex: 1; overflow-y: auto; display: flex; flex-direction: column;
    }
    .sidebar-result-item {
      padding: 9px 12px; border-bottom: 1px solid var(--border-color);
      cursor: pointer; transition: background 0.12s; display: flex; gap: 7px; align-items: flex-start;
    }
    .sidebar-result-item:hover { background: var(--bg-secondary); }
    .sidebar-result-item.selected { background: var(--accent-color, #667eea); }
    .sidebar-result-item.selected .result-q,
    .sidebar-result-item.selected .result-meta { color: rgba(255,255,255,0.9); }
    .result-num { font-size: 10px; color: var(--text-muted); font-weight: 600; flex-shrink: 0; padding-top: 1px; min-width: 18px; }
    .sidebar-result-item.selected .result-num { color: rgba(255,255,255,0.7); }
    .result-body { min-width: 0; flex: 1; }
    .result-q { font-size: 12px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px; }
    .result-meta { font-size: 10px; color: var(--text-muted); }

    /* ======= カレンダーヒートマップ ======= */
    .sidebar-calendar {
      flex-shrink: 0; border-top: 1px solid var(--border-color);
      padding: 10px 10px 12px;
      background: var(--bg-secondary);
    }
    .cal-head {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 7px;
    }
    .cal-title { font-size: 11px; font-weight: 600; color: var(--text-secondary); }
    .cal-nav { display: flex; gap: 4px; }
    .cal-nav-btn {
      background: none; border: none; color: var(--text-muted); cursor: pointer;
      font-size: 13px; padding: 0 3px; line-height: 1; border-radius: 3px;
    }
    .cal-nav-btn:hover { background: var(--border-color); color: var(--text-primary); }
    .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
    .cal-dow {
      font-size: 9px; color: var(--text-muted); text-align: center;
      padding-bottom: 2px; font-weight: 600;
    }
    .cal-cell {
      aspect-ratio: 1; border-radius: 3px;
      background: var(--border-color);
      cursor: default; position: relative;
      transition: transform 0.1s;
    }
    .cal-cell.empty { background: transparent; cursor: default; }
    .cal-cell.has-data { cursor: pointer; }
    .cal-cell.has-data:hover { transform: scale(1.15); z-index: 1; }
    .cal-cell.selected-day { outline: 2px solid var(--accent-color, #667eea); outline-offset: 1px; }
    /* ヒートマップ強度 */
    .cal-cell[data-lvl="1"] { background: rgba(102,126,234,0.25); }
    .cal-cell[data-lvl="2"] { background: rgba(102,126,234,0.45); }
    .cal-cell[data-lvl="3"] { background: rgba(102,126,234,0.65); }
    .cal-cell[data-lvl="4"] { background: rgba(102,126,234,0.85); }
    [data-theme="dark"] .cal-cell[data-lvl="1"] { background: rgba(127,156,245,0.25); }
    [data-theme="dark"] .cal-cell[data-lvl="2"] { background: rgba(127,156,245,0.45); }
    [data-theme="dark"] .cal-cell[data-lvl="3"] { background: rgba(127,156,245,0.65); }
    [data-theme="dark"] .cal-cell[data-lvl="4"] { background: rgba(127,156,245,0.85); }
    .cal-cell-tip {
      display: none; position: absolute; bottom: calc(100% + 4px); left: 50%;
      transform: translateX(-50%); background: var(--dropdown-bg);
      border: 1px solid var(--border-color); border-radius: 4px;
      font-size: 10px; color: var(--text-primary); padding: 3px 6px;
      white-space: nowrap; z-index: 10; pointer-events: none;
    }
    .cal-cell:hover .cal-cell-tip { display: block; }

    /* ======= 結果詳細パネル（全幅・下） ======= */
    .results-panel {
      position: fixed; bottom: 0; left: 0; right: 0; height: 42%;
      background: var(--card-bg); border-top: 2px solid var(--accent-color, #667eea);
      z-index: 400; display: flex; flex-direction: column;
      transform: translateY(100%); transition: transform 0.3s ease;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
    }
    .results-panel.open { transform: translateY(0); }
    .results-panel-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 16px; border-bottom: 1px solid var(--border-color); flex-shrink: 0;
    }
    .results-panel-title { font-size: 13px; font-weight: 600; color: var(--text-primary); }
    .results-panel-close {
      background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 18px; padding: 0 4px; line-height: 1;
    }
    .results-panel-close:hover { color: var(--text-primary); }
    .results-panel-body {
      flex: 1; overflow-y: auto; display: grid; grid-template-columns: 1fr 1fr; gap: 0;
    }
    .results-panel-col { padding: 12px 16px; overflow-y: auto; }
    .results-panel-col + .results-panel-col { border-left: 1px solid var(--border-color); }
    .results-col-label { font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
    .results-col-text { font-size: 13px; color: var(--text-primary); line-height: 1.65; white-space: pre-wrap; word-break: break-word; }
    .results-panel-footer {
      flex-shrink: 0; padding: 6px 16px; border-top: 1px solid var(--border-color);
      display: flex; align-items: center; justify-content: space-between;
      font-size: 11px; color: var(--text-muted);
    }
    .results-panel-link { font-size: 11px; color: var(--accent-color, #667eea); text-decoration: none; }
    .results-panel-link:hover { text-decoration: underline; }

    /* ======= Markdownプレビュー ======= */
    .results-col-text.preview-area { white-space: normal; }
    .chat-bubble.assistant.preview-area { white-space: normal; }
    .preview-area h1 { font-size: 1.4em; font-weight: 700; margin: 12px 0 8px; padding-bottom: 4px; border-bottom: 1px solid var(--border-color); }
    .preview-area h2 { font-size: 1.2em; font-weight: 600; margin: 10px 0 6px; padding-bottom: 3px; border-bottom: 1px solid var(--border-color); }
    .preview-area h3 { font-size: 1.1em; font-weight: 600; margin: 8px 0 4px; }
    .preview-area h4, .preview-area h5, .preview-area h6 { font-size: 1em; font-weight: 600; margin: 6px 0 4px; }
    .preview-area p { margin: 0 0 10px; }
    .preview-area ul, .preview-area ol { margin: 0 0 10px; padding-left: 1.5em; }
    .preview-area li { margin: 2px 0; }
    .preview-area code { background: var(--bg-secondary); padding: 1px 5px; border-radius: 3px; font-size: 0.88em; font-family: ui-monospace, monospace; }
    .preview-area pre { background: var(--bg-secondary); padding: 10px 12px; border-radius: 6px; overflow-x: auto; margin: 0 0 10px; }
    .preview-area pre code { background: none; padding: 0; font-size: 0.85em; }
    .preview-area blockquote { border-left: 3px solid var(--border-color); margin: 0 0 10px; padding: 4px 0 4px 12px; color: var(--text-muted); }
    .preview-area table { border-collapse: collapse; width: 100%; margin: 0 0 10px; font-size: 12px; }
    .preview-area th, .preview-area td { border: 1px solid var(--border-color); padding: 4px 8px; }
    .preview-area th { background: var(--bg-secondary); font-weight: 600; }
    .preview-area hr { border: none; border-top: 1px solid var(--border-color); margin: 12px 0; }
    .preview-area a { color: var(--accent-color, #667eea); }
    .preview-area img { max-width: 100%; }
    .preview-area input[type="checkbox"] { margin-right: 4px; }

    /* ======= チャット本体 ======= */
    .chat-wrapper {
      flex: 1; display: flex; flex-direction: column;
      max-width: 640px; width: 100%; margin: 0 auto;
      padding: 12px 16px 0; overflow: hidden; min-height: 0;
    }
    .chat-log {
      flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; padding-bottom: 14px;
    }
    .chat-bubble {
      max-width: 85%; padding: 10px 14px; border-radius: 12px;
      font-size: 14px; line-height: 1.6; white-space: pre-wrap; word-break: break-word;
    }
    .chat-bubble.user {
      align-self: flex-end; background: var(--accent-color, #667eea); color: #fff; border-bottom-right-radius: 3px;
    }
    .chat-bubble.assistant {
      align-self: flex-start; background: var(--card-bg); border: 1px solid var(--border-color); color: var(--text-primary); border-bottom-left-radius: 3px;
    }
    .chat-bubble.error {
      align-self: flex-start; background: rgba(207,34,46,0.08); border: 1px solid rgba(207,34,46,0.3); color: #cf222e;
    }
    [data-theme="dark"] .chat-bubble.error {
      background: rgba(252,129,129,0.12); border-color: rgba(252,129,129,0.4); color: #fc8181;
    }
    .chat-bubble.thinking {
      align-self: flex-start; background: var(--card-bg); border: 1px solid var(--border-color); color: var(--text-muted); font-style: italic;
    }
    .chat-share-row { align-self: flex-start; margin-top: -6px; }
    .chat-share-btn {
      background: none; border: 1px solid var(--border-color); border-radius: 6px;
      padding: 3px 9px; font-size: 11px; color: var(--text-muted); cursor: pointer;
      display: inline-flex; align-items: center; gap: 4px; transition: background 0.15s, color 0.15s;
    }
    .chat-share-btn:hover { background: var(--bg-secondary); color: var(--text-primary); }
    .chat-share-btn.copied { color: var(--success-color, #48bb78); border-color: var(--success-color, #48bb78); }
    .chat-form-area {
      flex-shrink: 0; background: var(--bg-primary, #f8fafc); padding: 10px 0 18px; border-top: 1px solid var(--border-color);
    }
    .chat-form { display: flex; gap: 8px; align-items: flex-end; }
    .chat-input {
      flex: 1; padding: 9px 13px; border-radius: 8px; border: 1px solid var(--border-color);
      background: var(--card-bg); color: var(--text-primary); font-size: 14px; resize: none;
      min-height: 40px; max-height: 160px; overflow-y: auto; font-family: inherit; line-height: 1.5;
    }
    .chat-input:focus { outline: none; border-color: var(--accent-color, #667eea); }
    .chat-send-btn {
      padding: 9px 16px; border-radius: 8px; border: none;
      background: var(--accent-color, #667eea); color: #fff; font-size: 14px; font-weight: 600;
      cursor: pointer; white-space: nowrap; transition: opacity 0.15s; height: 40px;
    }
    .chat-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .chat-send-btn:not(:disabled):hover { opacity: 0.85; }
  </style>
</head>
<body>
  <!-- ナビバー -->
  <nav class="navbar">
    <button class="sidebar-toggle" id="sidebarToggle" title="履歴検索">☰</button>
    <a href="/welcome" class="navbar-brand">🤖 AI チャット<span class="navbar-model">${modelShortName}</span></a>
    <div class="navbar-spacer"></div>
    <div class="user-menu">
      ${getThemeToggleHTML()}
      <span class="user-name">${displayName}</span>
      <div class="user-menu-container">
        <div class="user-icon" id="userIcon">${initials}</div>
        <div class="dropdown-menu" id="dropdownMenu">
          <a href="/welcome" class="dropdown-item">🏠 ホーム</a>
          <a href="/aichat" class="dropdown-item">🤖 AI チャット</a>
          <a href="/repositories" class="dropdown-item">📦 リポジトリ</a>
          <a href="/function-changelog" class="dropdown-item">🔖 関数辞典</a>
          <a href="/userinfo" class="dropdown-item">👤 ユーザー情報</a>
          <a href="/settings" class="dropdown-item">⚙️ 設定</a>
          <a href="/status" class="dropdown-item">📊 キャッシュ状況</a>
          <a href="/auth/switch" class="dropdown-item">🔄 別アカウントでログイン</a>
          <a href="/auth/logout" class="dropdown-item logout">🚪 ログアウト</a>
        </div>
      </div>
    </div>
  </nav>

  <!-- ボディエリア（サイドバー + チャット） -->
  <div class="body-area">
    <!-- 左サイドバー -->
    <div class="sidebar" id="sidebar">
      <div class="sidebar-head">
        <div class="sidebar-search-wrap">
          <input class="sidebar-search" id="sidebarSearch" type="search" placeholder="履歴を検索..." autocomplete="off">
          <button class="sidebar-search-clear" id="sidebarClear" tabindex="-1">✕</button>
        </div>
      </div>
      <div class="sidebar-status" id="sidebarStatus"></div>
      <div class="sidebar-results" id="sidebarResults"></div>

      <!-- カレンダーヒートマップ -->
      <div class="sidebar-calendar" id="sidebarCalendar">
        <div class="cal-head">
          <span class="cal-title" id="calTitle"></span>
          <div class="cal-nav">
            <button class="cal-nav-btn" id="calPrev" title="前月">‹</button>
            <button class="cal-nav-btn" id="calNext" title="翌月">›</button>
          </div>
        </div>
        <div class="cal-grid" id="calGrid"></div>
      </div>
    </div>

    <!-- チャット本体 -->
    <div class="chat-wrapper">
      <div class="chat-log" id="chatLog"></div>
      <div class="chat-form-area">
        <form class="chat-form" id="chatForm">
          <textarea class="chat-input" id="chatInput" placeholder="メッセージを入力... (Shift+Enter で改行)" rows="1"></textarea>
          <button type="submit" class="chat-send-btn" id="chatSendBtn">送信</button>
        </form>
      </div>
    </div>
  </div>

  <!-- 詳細パネル（全幅・下） -->
  <div class="results-panel" id="resultsPanel">
    <div class="results-panel-head">
      <span class="results-panel-title" id="resultsPanelTitle">詳細</span>
      <button class="results-panel-close" id="resultsPanelClose">✕</button>
    </div>
    <div class="results-panel-body">
      <div class="results-panel-col">
        <div class="results-col-label">質問</div>
        <div class="results-col-text" id="resultsPanelQ"></div>
      </div>
      <div class="results-panel-col">
        <div class="results-col-label">回答</div>
        <div class="results-col-text preview-area" id="resultsPanelA"></div>
      </div>
    </div>
    <div class="results-panel-footer">
      <span id="resultsPanelMeta"></span>
      <a class="results-panel-link" id="resultsPanelShareLink" href="#" target="_blank">🔗 共有ページを開く</a>
    </div>
  </div>

  <script>
    ${getThemeToggleScript()}

    // ===== ドロップダウン =====
    var userIcon = document.getElementById('userIcon');
    var dropdownMenu = document.getElementById('dropdownMenu');
    userIcon.addEventListener('click', function(e) { e.stopPropagation(); dropdownMenu.classList.toggle('show'); });
    document.addEventListener('click', function() { dropdownMenu.classList.remove('show'); });

    // ===== サイドバー =====
    var sidebarToggle = document.getElementById('sidebarToggle');
    var sidebar = document.getElementById('sidebar');
    var sidebarSearch = document.getElementById('sidebarSearch');
    var sidebarClear = document.getElementById('sidebarClear');
    var sidebarStatus = document.getElementById('sidebarStatus');
    var sidebarResults = document.getElementById('sidebarResults');
    var sidebarOpen = false;

    function isTapCloseEnabled() {
      var m = document.cookie.match(/(?:^|;\s*)aichat_sidebar_tap_close=([^;]*)/);
      return !m || m[1] !== 'off';
    }

    function closeSidebar() {
      sidebarOpen = false;
      sidebar.classList.remove('open');
      sidebarToggle.classList.remove('active');
    }

    sidebarToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      sidebarOpen = !sidebarOpen;
      sidebar.classList.toggle('open', sidebarOpen);
      sidebarToggle.classList.toggle('active', sidebarOpen);
      if (sidebarOpen) {
        setTimeout(function() { sidebarSearch.focus(); }, 260);
        loadCalendar(calCurrentMonth);
      }
    });

    document.addEventListener('click', function(e) {
      if (sidebarOpen && isTapCloseEnabled() && !sidebar.contains(e.target) && e.target !== sidebarToggle) {
        closeSidebar();
      }
    });

    // ===== キーワード検索 =====
    var searchTimer = null;
    var currentResults = [];
    var selectedIdx = -1;
    var currentMode = 'search'; // 'search' | 'date'
    var currentDateLabel = '';

    sidebarSearch.addEventListener('input', function() {
      var q = sidebarSearch.value.trim();
      sidebarClear.classList.toggle('visible', q.length > 0);
      clearTimeout(searchTimer);
      currentMode = 'search';
      currentDateLabel = '';
      if (!q) { sidebarStatus.textContent = ''; sidebarResults.innerHTML = ''; currentResults = []; return; }
      sidebarStatus.textContent = '検索中...';
      searchTimer = setTimeout(function() { doSearch(q); }, 350);
    });

    sidebarClear.addEventListener('click', function() {
      sidebarSearch.value = '';
      sidebarClear.classList.remove('visible');
      sidebarStatus.textContent = '';
      sidebarResults.innerHTML = '';
      currentResults = [];
      currentMode = 'search';
      currentDateLabel = '';
      clearSelectedDay();
      sidebarSearch.focus();
    });

    function doSearch(q) {
      fetch('/api/aichat/shares/search?q=' + encodeURIComponent(q), { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          currentResults = data.results || [];
          selectedIdx = -1;
          renderSidebarResults();
          sidebarStatus.textContent = currentResults.length > 0 ? currentResults.length + ' 件ヒット' : '一致なし';
        })
        .catch(function() { sidebarStatus.textContent = '検索エラー'; });
    }

    function doDateLoad(date) {
      sidebarStatus.textContent = '読み込み中...';
      fetch('/api/aichat/shares/by-date?date=' + encodeURIComponent(date), { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          currentResults = data.results || [];
          selectedIdx = -1;
          currentMode = 'date';
          currentDateLabel = date;
          renderSidebarResults();
          sidebarStatus.textContent = date + '：' + currentResults.length + ' 件';
        })
        .catch(function() { sidebarStatus.textContent = '読み込みエラー'; });
    }

    function renderSidebarResults() {
      sidebarResults.innerHTML = '';
      currentResults.forEach(function(r, i) {
        var item = document.createElement('div');
        item.className = 'sidebar-result-item' + (i === selectedIdx ? ' selected' : '');
        var num = document.createElement('div');
        num.className = 'result-num';
        num.textContent = (i + 1) + '.';
        var body = document.createElement('div');
        body.className = 'result-body';
        var qEl = document.createElement('div');
        qEl.className = 'result-q';
        qEl.textContent = r.question;
        var meta = document.createElement('div');
        meta.className = 'result-meta';
        meta.textContent = r.created_at.slice(0, 16).replace('T', ' ') + '　' + r.model.split('/').pop();
        body.appendChild(qEl);
        body.appendChild(meta);
        item.appendChild(num);
        item.appendChild(body);
        item.addEventListener('click', function() {
          selectedIdx = i;
          renderSidebarResults();
          showResultsPanel(r);
        });
        sidebarResults.appendChild(item);
      });
    }

    // ===== カレンダーヒートマップ =====
    var calCurrentMonth = new Date().toISOString().slice(0, 7);
    var calDayData = {};
    var calSelectedDay = null;

    document.getElementById('calPrev').addEventListener('click', function() {
      var d = new Date(calCurrentMonth + '-01');
      d.setMonth(d.getMonth() - 1);
      calCurrentMonth = d.toISOString().slice(0, 7);
      loadCalendar(calCurrentMonth);
    });
    document.getElementById('calNext').addEventListener('click', function() {
      var d = new Date(calCurrentMonth + '-01');
      d.setMonth(d.getMonth() + 1);
      calCurrentMonth = d.toISOString().slice(0, 7);
      loadCalendar(calCurrentMonth);
    });

    function loadCalendar(month) {
      fetch('/api/aichat/shares/calendar?month=' + encodeURIComponent(month), { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          calDayData = {};
          (data.days || []).forEach(function(d) { calDayData[d.date] = d.count; });
          renderCalendar(month);
        })
        .catch(function() {});
    }

    function renderCalendar(month) {
      var titleEl = document.getElementById('calTitle');
      var grid = document.getElementById('calGrid');
      var parts = month.split('-');
      var year = parseInt(parts[0], 10);
      var mon = parseInt(parts[1], 10) - 1;
      titleEl.textContent = year + '年' + (mon + 1) + '月';
      grid.innerHTML = '';

      var dows = ['日','月','火','水','木','金','土'];
      dows.forEach(function(d) {
        var el = document.createElement('div');
        el.className = 'cal-dow';
        el.textContent = d;
        grid.appendChild(el);
      });

      var firstDay = new Date(year, mon, 1).getDay();
      var daysInMonth = new Date(year, mon + 1, 0).getDate();
      var maxCount = Math.max.apply(null, Object.values(calDayData).concat([1]));

      for (var i = 0; i < firstDay; i++) {
        var empty = document.createElement('div');
        empty.className = 'cal-cell empty';
        grid.appendChild(empty);
      }

      for (var day = 1; day <= daysInMonth; day++) {
        var dateStr = month + '-' + String(day).padStart(2, '0');
        var count = calDayData[dateStr] || 0;
        var cell = document.createElement('div');
        cell.className = 'cal-cell' + (count > 0 ? ' has-data' : '') + (calSelectedDay === dateStr ? ' selected-day' : '');
        if (count > 0) {
          var lvl = count >= maxCount * 0.75 ? 4 : count >= maxCount * 0.5 ? 3 : count >= maxCount * 0.25 ? 2 : 1;
          cell.setAttribute('data-lvl', lvl);
          cell.title = day + '日: ' + count + '件';
          var tip = document.createElement('span');
          tip.className = 'cal-cell-tip';
          tip.textContent = day + '日: ' + count + '件';
          cell.appendChild(tip);
          (function(ds) {
            cell.addEventListener('click', function(e) {
              e.stopPropagation();
              calSelectedDay = ds;
              sidebarSearch.value = '';
              sidebarClear.classList.remove('visible');
              renderCalendar(calCurrentMonth);
              doDateLoad(ds);
            });
          })(dateStr);
        } else {
          cell.title = day + '日';
        }
        var label = document.createElement('span');
        label.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--text-muted);';
        label.textContent = day;
        cell.style.position = 'relative';
        cell.appendChild(label);
        grid.appendChild(cell);
      }
    }

    function clearSelectedDay() {
      calSelectedDay = null;
      renderCalendar(calCurrentMonth);
    }

    // ===== Markdownパーサー =====
    function mdEsc(s) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function mdInline(text) {
      text = text.replace(/!\\[([^\\]]*)\\]\\(([^)]+)\\)/g, '<img src="$2" alt="$1">');
      text = text.replace(/\\[([^\\]]*)\\]\\(([^)]+)\\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
      text = text.replace(/\\*\\*\\*(.+?)\\*\\*\\*/g, '<strong><em>$1</em></strong>');
      text = text.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
      text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
      text = text.replace(/\\*(.+?)\\*/g, '<em>$1</em>');
      text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');
      text = text.replace(/\\n/g, '<br>');
      return text;
    }
    function mdSplitRow(line) {
      return line.replace(/^\\|\\s*/, '').replace(/\\s*\\|$/, '').split(/\\s*\\|\\s*/);
    }
    function mdParseList(lines, start, tag) {
      var items = [];
      var i = start;
      var pat = tag === 'ul' ? /^\\s*[-*+]\\s(.*)/ : /^\\s*\\d+\\.\\s(.*)/;
      while (i < lines.length) {
        var m = lines[i].match(pat);
        if (!m) break;
        var txt = m[1];
        var task = txt.match(/^\\[([ xX])\\]\\s(.*)/);
        if (task) {
          items.push('<li><input type="checkbox"' + (task[1] !== ' ' ? ' checked' : '') + ' disabled> ' + mdInline(task[2]) + '</li>');
        } else {
          items.push('<li>' + mdInline(txt) + '</li>');
        }
        i++;
      }
      return '<' + tag + '>' + items.join('') + '</' + tag + '>';
    }
    function parseMd(src) {
      src = src.replace(/\\r\\n?/g, '\\n');
      var codeBlocks = [];
      src = src.replace(/\`\`\`(\\w*)\\n([\\s\\S]*?)\`\`\`/g, function(_, lang, code) {
        var idx = codeBlocks.length;
        codeBlocks.push('<pre><code' + (lang ? ' class="language-' + lang + '"' : '') + '>' + mdEsc(code.replace(/\\n$/, '')) + '</code></pre>');
        return '\\x00CB' + idx + '\\x00';
      });
      var inlineCodes = [];
      src = src.replace(/\`([^\`]+)\`/g, function(_, code) {
        var idx = inlineCodes.length;
        inlineCodes.push('<code>' + mdEsc(code) + '</code>');
        return '\\x00IC' + idx + '\\x00';
      });
      var lines = src.split('\\n');
      var html = '';
      var i = 0;
      while (i < lines.length) {
        var line = lines[i];
        if (line.trim() === '') { i++; continue; }
        var cbM = line.match(/^\\x00CB(\\d+)\\x00$/);
        if (cbM) { html += codeBlocks[parseInt(cbM[1])]; i++; continue; }
        var hM = line.match(/^(#{1,6})\\s+(.+)$/);
        if (hM) { var lv = hM[1].length; html += '<h' + lv + '>' + mdInline(hM[2]) + '</h' + lv + '>'; i++; continue; }
        if (/^(\\*{3,}|-{3,}|_{3,})\\s*$/.test(line)) { html += '<hr>'; i++; continue; }
        if (i + 1 < lines.length && /^\\|/.test(line) && /^[\\|\\s:-]+$/.test(lines[i + 1])) {
          var tbl = '<table><thead><tr>';
          mdSplitRow(line).forEach(function(h) { tbl += '<th>' + mdInline(h.trim()) + '</th>'; });
          tbl += '</tr></thead><tbody>';
          i += 2;
          while (i < lines.length && /^\\|/.test(lines[i])) {
            tbl += '<tr>';
            mdSplitRow(lines[i]).forEach(function(c) { tbl += '<td>' + mdInline(c.trim()) + '</td>'; });
            tbl += '</tr>'; i++;
          }
          tbl += '</tbody></table>'; html += tbl; continue;
        }
        if (/^>\\s?/.test(line)) {
          var bq = [];
          while (i < lines.length && /^>\\s?/.test(lines[i])) { bq.push(lines[i].replace(/^>\\s?/, '')); i++; }
          html += '<blockquote>' + parseMd(bq.join('\\n')) + '</blockquote>'; continue;
        }
        if (/^\\s*[-*+]\\s/.test(line)) {
          html += mdParseList(lines, i, 'ul');
          while (i < lines.length && /^\\s*[-*+]\\s/.test(lines[i])) i++;
          continue;
        }
        if (/^\\s*\\d+\\.\\s/.test(line)) {
          html += mdParseList(lines, i, 'ol');
          while (i < lines.length && /^\\s*\\d+\\.\\s/.test(lines[i])) i++;
          continue;
        }
        var pLines = [];
        while (i < lines.length && lines[i].trim() !== '' && !/^#{1,6}\\s/.test(lines[i]) && !/^(\\*{3,}|-{3,}|_{3,})\\s*$/.test(lines[i]) && !/^>\\s?/.test(lines[i]) && !/^\\|/.test(lines[i]) && !/^\\x00CB/.test(lines[i])) {
          pLines.push(lines[i]); i++;
        }
        if (pLines.length) html += '<p>' + mdInline(pLines.join('\\n')) + '</p>';
      }
      html = html.replace(/\\x00IC(\\d+)\\x00/g, function(_, idx) { return inlineCodes[parseInt(idx)]; });
      return html;
    }

    // ===== 詳細パネル =====
    var resultsPanel = document.getElementById('resultsPanel');
    var resultsPanelQ = document.getElementById('resultsPanelQ');
    var resultsPanelA = document.getElementById('resultsPanelA');
    var resultsPanelMeta = document.getElementById('resultsPanelMeta');
    var resultsPanelShareLink = document.getElementById('resultsPanelShareLink');
    var resultsPanelClose = document.getElementById('resultsPanelClose');

    function showResultsPanel(r) {
      resultsPanelQ.textContent = r.question;
      resultsPanelA.innerHTML = parseMd(r.answer);
      resultsPanelMeta.textContent = r.created_at.slice(0, 16).replace('T', ' ') + '　' + r.model + '　👁 ' + (r.access_count || 0);
      resultsPanelShareLink.href = '/s/' + r.user_hash + '/' + r.id;
      resultsPanel.classList.add('open');
    }

    resultsPanelClose.addEventListener('click', function() {
      resultsPanel.classList.remove('open');
      selectedIdx = -1;
      renderSidebarResults();
    });

    // ===== チャット =====
    var chatLog = document.getElementById('chatLog');
    var chatForm = document.getElementById('chatForm');
    var chatInput = document.getElementById('chatInput');
    var chatSendBtn = document.getElementById('chatSendBtn');

    chatInput.addEventListener('input', function() {
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + 'px';
    });
    chatInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!chatSendBtn.disabled) chatForm.dispatchEvent(new Event('submit'));
      }
    });

    function appendBubble(text, role) {
      var el = document.createElement('div');
      if (role === 'assistant') {
        el.className = 'chat-bubble ' + role + ' preview-area';
        el.innerHTML = parseMd(text);
      } else {
        el.className = 'chat-bubble ' + role;
        el.textContent = text;
      }
      chatLog.appendChild(el);
      chatLog.scrollTop = chatLog.scrollHeight;
      return el;
    }

    function appendShareBtn(question, answer, model) {
      var row = document.createElement('div');
      row.className = 'chat-share-row';
      var btn = document.createElement('button');
      btn.className = 'chat-share-btn';
      btn.innerHTML = '🔗 リンクをコピー';
      btn.onclick = function() {
        fetch('/api/aichat/share', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: question, answer: answer, model: model })
        })
          .then(function(r) { return r.json(); })
          .then(function(d) {
            if (d.shareUrl) {
              navigator.clipboard.writeText(d.shareUrl).then(function() {
                btn.innerHTML = '✓ コピーしました';
                btn.classList.add('copied');
                setTimeout(function() { btn.innerHTML = '🔗 リンクをコピー'; btn.classList.remove('copied'); }, 2000);
              });
            }
          })
          .catch(function() {});
      };
      row.appendChild(btn);
      chatLog.appendChild(row);
      chatLog.scrollTop = chatLog.scrollHeight;
    }

    var lastModel = ${JSON.stringify(safeModel)};

    chatForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var msg = chatInput.value.trim();
      if (!msg) return;
      appendBubble(msg, 'user');
      chatInput.value = '';
      chatInput.style.height = 'auto';
      chatSendBtn.disabled = true;
      var currentMsg = msg;
      var thinking = appendBubble('考え中...', 'thinking');
      fetch('/api/aichat', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          thinking.remove();
          if (data.error) {
            appendBubble('エラー: ' + data.error, 'error');
          } else {
            var responseText = data.response || '(応答なし)';
            appendBubble(responseText, 'assistant');
            appendShareBtn(currentMsg, responseText, data.usedModel || lastModel);
          }
        })
        .catch(function() { thinking.remove(); appendBubble('通信エラーが発生しました', 'error'); })
        .finally(function() { chatSendBtn.disabled = false; chatInput.focus(); });
    });

    chatInput.focus();
  </script>
</body>
</html>`;
}
