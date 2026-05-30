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
  const isConfigured = user.aiChatModelConfigured !== false;
  const safeFallback = escapeHtml(user.fallbackModel ?? '@cf/meta/llama-3.1-8b-instruct-fp8');
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

    html, body {
      height: 100%;
      overflow: hidden;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-primary, #f8fafc);
      color: var(--text-primary);
      display: flex;
      flex-direction: column;
    }

    /* ======= ナビバー（幅を約80%に縮小・中央寄せ） ======= */
    .navbar-outer {
      position: sticky;
      top: 0;
      z-index: 200;
      background: var(--navbar-bg);
      backdrop-filter: blur(10px);
      box-shadow: 0 2px 10px var(--navbar-shadow);
      flex-shrink: 0;
    }
    .navbar {
      max-width: 80%;
      margin: 0 auto;
      padding: 14px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .navbar-brand {
      font-size: 20px;
      font-weight: 700;
      color: var(--text-primary);
      text-decoration: none;
      display: flex;
      align-items: baseline;
      gap: 8px;
    }
    .navbar-model {
      font-size: 11px;
      font-weight: 400;
      color: var(--text-muted);
    }
    .user-menu { display: flex; align-items: center; gap: 12px; }
    .user-name { font-size: 14px; color: var(--text-secondary); font-weight: 500; }
    .user-icon {
      width: 38px; height: 38px; border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: 600; font-size: 15px; cursor: pointer;
      transition: transform 0.2s ease;
      box-shadow: 0 2px 8px rgba(102,126,234,0.3);
    }
    .user-icon:hover { transform: scale(1.05); }
    .user-menu-container { position: relative; }
    .dropdown-menu {
      display: none; position: absolute; top: 48px; right: 0;
      background: var(--dropdown-bg); border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 180px; z-index: 1000; overflow: hidden;
    }
    .dropdown-menu.show { display: block; }
    .dropdown-item {
      padding: 12px 20px; color: var(--text-secondary); text-decoration: none;
      display: block; transition: background 0.2s ease; cursor: pointer;
      border-bottom: 1px solid var(--border-color);
    }
    .dropdown-item:last-child { border-bottom: none; }
    .dropdown-item:hover { background: var(--dropdown-hover); }
    .dropdown-item.logout { color: var(--danger-color); }

    /* ======= サイドバートグルボタン ======= */
    .sidebar-toggle {
      position: fixed;
      top: 60px;
      left: 12px;
      z-index: 300;
      width: 36px; height: 36px;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      background: var(--card-bg);
      color: var(--text-muted);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      font-size: 16px;
      transition: background 0.2s, color 0.2s, box-shadow 0.2s;
      box-shadow: 0 2px 6px rgba(0,0,0,0.1);
    }
    .sidebar-toggle:hover { background: var(--bg-secondary); color: var(--text-primary); }
    .sidebar-toggle.active { background: var(--accent-color, #667eea); color: #fff; border-color: var(--accent-color, #667eea); }

    /* ======= 左サイドバー ======= */
    .sidebar {
      position: fixed;
      top: 54px;
      left: 0;
      width: 260px;
      bottom: 0;
      background: var(--card-bg);
      border-right: 1px solid var(--border-color);
      z-index: 250;
      display: flex;
      flex-direction: column;
      transform: translateX(-100%);
      transition: transform 0.25s ease;
      box-shadow: 2px 0 12px rgba(0,0,0,0.1);
    }
    .sidebar.open { transform: translateX(0); }

    .sidebar-head {
      padding: 12px 14px 10px;
      border-bottom: 1px solid var(--border-color);
      flex-shrink: 0;
    }
    .sidebar-search-wrap {
      position: relative;
    }
    .sidebar-search {
      width: 100%;
      padding: 8px 32px 8px 10px;
      border-radius: 6px;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
      color: var(--text-primary);
      font-size: 13px;
      font-family: inherit;
      outline: none;
      transition: border-color 0.15s;
    }
    .sidebar-search:focus { border-color: var(--accent-color, #667eea); }
    .sidebar-search-clear {
      position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
      background: none; border: none; color: var(--text-muted); cursor: pointer;
      font-size: 14px; display: none; padding: 0 2px;
    }
    .sidebar-search-clear.visible { display: block; }

    .sidebar-status {
      font-size: 11px; color: var(--text-muted);
      padding: 6px 14px 4px;
      flex-shrink: 0;
    }

    .sidebar-results {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0;
    }
    .sidebar-result-item {
      padding: 10px 14px;
      border-bottom: 1px solid var(--border-color);
      cursor: pointer;
      transition: background 0.15s;
    }
    .sidebar-result-item:hover { background: var(--bg-secondary); }
    .sidebar-result-item.selected { background: var(--accent-color, #667eea); }
    .sidebar-result-item.selected .result-q,
    .sidebar-result-item.selected .result-meta { color: #fff; }
    .result-q {
      font-size: 12px; color: var(--text-primary);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      margin-bottom: 3px;
    }
    .result-meta { font-size: 10px; color: var(--text-muted); }

    /* ======= 検索結果 詳細パネル（画面下、全幅） ======= */
    .results-panel {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      height: 42%;
      background: var(--card-bg);
      border-top: 2px solid var(--accent-color, #667eea);
      z-index: 400;
      display: flex;
      flex-direction: column;
      transform: translateY(100%);
      transition: transform 0.3s ease;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
    }
    .results-panel.open { transform: translateY(0); }

    .results-panel-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 16px 8px;
      border-bottom: 1px solid var(--border-color);
      flex-shrink: 0;
    }
    .results-panel-title {
      font-size: 13px; font-weight: 600; color: var(--text-primary);
    }
    .results-panel-close {
      background: none; border: none; color: var(--text-muted);
      cursor: pointer; font-size: 18px; padding: 0 4px;
      line-height: 1;
    }
    .results-panel-close:hover { color: var(--text-primary); }

    .results-panel-body {
      flex: 1; overflow-y: auto;
      display: grid; grid-template-columns: 1fr 1fr; gap: 0;
    }
    .results-panel-col {
      padding: 14px 18px;
      overflow-y: auto;
    }
    .results-panel-col + .results-panel-col {
      border-left: 1px solid var(--border-color);
    }
    .results-col-label {
      font-size: 10px; font-weight: 700; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px;
    }
    .results-col-text {
      font-size: 13px; color: var(--text-primary);
      line-height: 1.65; white-space: pre-wrap; word-break: break-word;
    }
    .results-panel-footer {
      flex-shrink: 0;
      padding: 8px 16px;
      border-top: 1px solid var(--border-color);
      display: flex; align-items: center; justify-content: space-between;
      font-size: 11px; color: var(--text-muted);
    }
    .results-panel-link {
      font-size: 11px; color: var(--accent-color, #667eea);
      text-decoration: none;
    }
    .results-panel-link:hover { text-decoration: underline; }

    /* ======= チャット本体 ======= */
    .main-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-height: 0;
    }

    .chat-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      max-width: 640px;
      width: 100%;
      margin: 0 auto;
      padding: 12px 16px 0;
      overflow: hidden;
      min-height: 0;
    }

    .chat-log {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding-bottom: 16px;
    }

    .chat-bubble {
      max-width: 85%;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .chat-bubble.user {
      align-self: flex-end;
      background: var(--accent-color, #667eea);
      color: #fff;
      border-bottom-right-radius: 3px;
    }
    .chat-bubble.assistant {
      align-self: flex-start;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      border-bottom-left-radius: 3px;
    }
    .chat-bubble.error {
      align-self: flex-start;
      background: rgba(207,34,46,0.08);
      border: 1px solid rgba(207,34,46,0.3);
      color: #cf222e;
    }
    [data-theme="dark"] .chat-bubble.error {
      background: rgba(252,129,129,0.12);
      border: 1px solid rgba(252,129,129,0.4);
      color: #fc8181;
    }
    .chat-bubble.thinking {
      align-self: flex-start;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      color: var(--text-muted);
      font-style: italic;
    }

    .chat-share-row { align-self: flex-start; margin-top: -8px; }
    .chat-share-btn {
      background: none;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 11px;
      color: var(--text-muted);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: background 0.15s, color 0.15s;
    }
    .chat-share-btn:hover { background: var(--bg-secondary); color: var(--text-primary); }
    .chat-share-btn.copied { color: var(--success-color, #48bb78); border-color: var(--success-color, #48bb78); }

    .chat-form-area {
      flex-shrink: 0;
      background: var(--bg-primary, #f8fafc);
      padding: 12px 0 20px;
      border-top: 1px solid var(--border-color);
    }
    .chat-form { display: flex; gap: 8px; align-items: flex-end; }
    .chat-input {
      flex: 1; padding: 10px 14px; border-radius: 8px;
      border: 1px solid var(--border-color);
      background: var(--card-bg); color: var(--text-primary);
      font-size: 14px; resize: none; min-height: 42px; max-height: 160px;
      overflow-y: auto; font-family: inherit; line-height: 1.5;
    }
    .chat-input:focus { outline: none; border-color: var(--accent-color, #667eea); }
    .chat-send-btn {
      padding: 10px 18px; border-radius: 8px; border: none;
      background: var(--accent-color, #667eea); color: #fff;
      font-size: 14px; font-weight: 600; cursor: pointer;
      white-space: nowrap; transition: opacity 0.15s; height: 42px;
    }
    .chat-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .chat-send-btn:not(:disabled):hover { opacity: 0.85; }
  </style>
</head>
<body>
  <!-- ナビバー外枠（全幅背景）-->
  <div class="navbar-outer">
    <nav class="navbar">
      <a href="/welcome" class="navbar-brand">🤖 AI チャット<span class="navbar-model">${modelShortName}</span></a>
      <div class="user-menu">
        ${getThemeToggleHTML()}
        <span class="user-name">${displayName}</span>
        <div class="user-menu-container">
          <div class="user-icon" id="userIcon">${initials}</div>
          <div class="dropdown-menu" id="dropdownMenu">
            <a href="/welcome" class="dropdown-item">🏠 ホーム</a>
            <a href="/aichat" class="dropdown-item">🤖 AI チャット</a>
            <a href="/repositories" class="dropdown-item">📦 リポジトリ</a>
            <a href="/userinfo" class="dropdown-item">👤 ユーザー情報</a>
            <a href="/settings" class="dropdown-item">⚙️ 設定</a>
            <a href="/status" class="dropdown-item">📊 キャッシュ状況</a>
            <a href="/auth/switch" class="dropdown-item">🔄 別アカウントでログイン</a>
            <a href="/auth/logout" class="dropdown-item logout">🚪 ログアウト</a>
          </div>
        </div>
      </div>
    </nav>
  </div>

  <!-- サイドバートグルボタン -->
  <button class="sidebar-toggle" id="sidebarToggle" title="履歴検索">☰</button>

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
  </div>

  <!-- メインエリア -->
  <div class="main-area">
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

  <!-- 検索結果詳細パネル（画面下全幅） -->
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
        <div class="results-col-text" id="resultsPanelA"></div>
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
    if (userIcon && dropdownMenu) {
      userIcon.addEventListener('click', function(e) {
        e.stopPropagation();
        dropdownMenu.classList.toggle('show');
      });
      document.addEventListener('click', function() { dropdownMenu.classList.remove('show'); });
    }

    // ===== サイドバー =====
    var sidebarToggle = document.getElementById('sidebarToggle');
    var sidebar = document.getElementById('sidebar');
    var sidebarSearch = document.getElementById('sidebarSearch');
    var sidebarClear = document.getElementById('sidebarClear');
    var sidebarStatus = document.getElementById('sidebarStatus');
    var sidebarResults = document.getElementById('sidebarResults');
    var sidebarOpen = false;

    sidebarToggle.addEventListener('click', function() {
      sidebarOpen = !sidebarOpen;
      sidebar.classList.toggle('open', sidebarOpen);
      sidebarToggle.classList.toggle('active', sidebarOpen);
      if (sidebarOpen) setTimeout(function() { sidebarSearch.focus(); }, 260);
    });

    // サイドバー外クリックで閉じる
    document.addEventListener('click', function(e) {
      if (sidebarOpen && !sidebar.contains(e.target) && e.target !== sidebarToggle) {
        sidebarOpen = false;
        sidebar.classList.remove('open');
        sidebarToggle.classList.remove('active');
      }
    });

    // ===== 検索 =====
    var searchTimer = null;
    var currentResults = [];
    var selectedIdx = -1;

    sidebarSearch.addEventListener('input', function() {
      var q = sidebarSearch.value.trim();
      sidebarClear.classList.toggle('visible', q.length > 0);
      clearTimeout(searchTimer);
      if (!q) {
        sidebarStatus.textContent = '';
        sidebarResults.innerHTML = '';
        currentResults = [];
        return;
      }
      sidebarStatus.textContent = '検索中...';
      searchTimer = setTimeout(function() { doSearch(q); }, 350);
    });

    sidebarClear.addEventListener('click', function() {
      sidebarSearch.value = '';
      sidebarClear.classList.remove('visible');
      sidebarStatus.textContent = '';
      sidebarResults.innerHTML = '';
      currentResults = [];
      sidebarSearch.focus();
    });

    function doSearch(q) {
      fetch('/api/aichat/shares/search?q=' + encodeURIComponent(q), { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          currentResults = data.results || [];
          selectedIdx = -1;
          renderSidebarResults();
          sidebarStatus.textContent = currentResults.length > 0
            ? currentResults.length + ' 件ヒット'
            : '一致なし';
        })
        .catch(function() { sidebarStatus.textContent = '検索エラー'; });
    }

    function renderSidebarResults() {
      sidebarResults.innerHTML = '';
      currentResults.forEach(function(r, i) {
        var item = document.createElement('div');
        item.className = 'sidebar-result-item' + (i === selectedIdx ? ' selected' : '');
        var qEl = document.createElement('div');
        qEl.className = 'result-q';
        qEl.textContent = r.question;
        var meta = document.createElement('div');
        meta.className = 'result-meta';
        meta.textContent = r.created_at.slice(0, 16).replace('T', ' ') + '　' + r.model.split('/').pop();
        item.appendChild(qEl);
        item.appendChild(meta);
        item.addEventListener('click', function() {
          selectedIdx = i;
          renderSidebarResults();
          showResultsPanel(r);
        });
        sidebarResults.appendChild(item);
      });
    }

    // ===== 結果パネル =====
    var resultsPanel = document.getElementById('resultsPanel');
    var resultsPanelTitle = document.getElementById('resultsPanelTitle');
    var resultsPanelQ = document.getElementById('resultsPanelQ');
    var resultsPanelA = document.getElementById('resultsPanelA');
    var resultsPanelMeta = document.getElementById('resultsPanelMeta');
    var resultsPanelShareLink = document.getElementById('resultsPanelShareLink');
    var resultsPanelClose = document.getElementById('resultsPanelClose');

    function showResultsPanel(r) {
      resultsPanelQ.textContent = r.question;
      resultsPanelA.textContent = r.answer;
      resultsPanelTitle.textContent = '検索結果';
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
      el.className = 'chat-bubble ' + role;
      el.textContent = text;
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
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: question, answer: answer, model: model })
        })
          .then(function(r) { return r.json(); })
          .then(function(d) {
            if (d.shareUrl) {
              navigator.clipboard.writeText(d.shareUrl).then(function() {
                btn.innerHTML = '✓ コピーしました';
                btn.classList.add('copied');
                setTimeout(function() {
                  btn.innerHTML = '🔗 リンクをコピー';
                  btn.classList.remove('copied');
                }, 2000);
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
        method: 'POST',
        credentials: 'same-origin',
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
        .catch(function() {
          thinking.remove();
          appendBubble('通信エラーが発生しました', 'error');
        })
        .finally(function() {
          chatSendBtn.disabled = false;
          chatInput.focus();
        });
    });

    chatInput.focus();
  </script>
</body>
</html>`;
}
