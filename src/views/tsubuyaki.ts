import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

export function getTsubuyakiPage(username: string): string {
  const safeUsername = escapeHtml(username);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>つぶやき投稿 - Cloudflare Workers GitHub OAuth</title>
  ${getThemeInitScript()}
  <style>
    ${getThemeCSS()}
    ${getThemeToggleCSS()}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%);
      min-height: 100vh;
    }
    .navbar {
      background: var(--navbar-bg);
      backdrop-filter: blur(10px);
      box-shadow: 0 2px 10px var(--navbar-shadow);
      padding: 16px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .navbar-brand { font-size: 20px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px; }
    .user-menu { display: flex; align-items: center; gap: 12px; }
    .user-name { font-size: 14px; color: var(--text-secondary); font-weight: 500; }
    .user-icon {
      width: 40px; height: 40px; border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: 600; font-size: 16px; cursor: pointer;
    }
    .user-menu-container { position: relative; }
    .dropdown-menu {
      display: none; position: absolute; top: 50px; right: 0;
      background: var(--dropdown-bg); border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 180px; z-index: 1000; overflow: hidden;
    }
    .dropdown-menu.show { display: block; }
    .dropdown-item {
      padding: 12px 20px; color: var(--text-secondary); text-decoration: none;
      display: block; cursor: pointer; border-bottom: 1px solid var(--border-color);
      transition: background 0.2s ease;
    }
    .dropdown-item:last-child { border-bottom: none; }
    .dropdown-item:hover { background: var(--dropdown-hover); }
    .dropdown-item.switch-account { color: var(--accent-color); }
    .dropdown-item.logout { color: var(--danger-color); }
    .container { max-width: 640px; margin: 0 auto; padding: 48px 32px; }
    .post-card {
      background: var(--card-bg); border-radius: 16px;
      box-shadow: 0 20px 60px var(--card-shadow); padding: 48px;
    }
    .post-title { font-size: 32px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
    .post-subtitle { font-size: 15px; color: var(--text-muted); margin-bottom: 28px; }
    textarea {
      width: 100%; min-height: 160px; resize: vertical;
      background: var(--input-bg); color: var(--text-primary);
      border: 1px solid var(--input-border); border-radius: 10px;
      padding: 14px; font-size: 15px; font-family: inherit; line-height: 1.6;
    }
    textarea:focus { outline: none; border-color: var(--accent-color); }
    .char-count { text-align: right; font-size: 12px; color: var(--text-muted); margin-top: 6px; }
    .char-count.over { color: var(--danger-color); font-weight: 600; }
    .post-btn {
      margin-top: 20px; width: 100%;
      background: var(--accent-color); color: white; border: none; border-radius: 10px;
      padding: 14px 24px; font-size: 15px; font-weight: 700; cursor: pointer;
      transition: background 0.15s ease;
    }
    .post-btn:hover:not(:disabled) { background: var(--accent-hover); }
    .post-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .status-msg {
      margin-top: 16px; padding: 12px 16px; border-radius: 8px; font-size: 14px;
      display: none;
    }
    .status-msg.show { display: block; }
    .status-msg.success { background: rgba(72, 187, 120, 0.15); color: var(--success-color); }
    .status-msg.error { background: rgba(229, 62, 62, 0.15); color: var(--danger-color); }
    .back-link {
      display: inline-block; margin-top: 24px; color: var(--accent-color); text-decoration: none; font-size: 14px;
    }
    .back-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="navbar-brand">
      <span>📮</span>
      <span>つぶやき投稿</span>
    </div>
    <div class="user-menu">
      ${getThemeToggleHTML()}
      <span class="user-name">${safeUsername}</span>
      <div class="user-menu-container">
        <div class="user-icon" title="${safeUsername}" onclick="toggleDropdown()">
          ${escapeHtml(username.substring(0, 2).toUpperCase())}
        </div>
        <div class="dropdown-menu" id="dropdownMenu">
          <a href="/welcome" class="dropdown-item">🏠 ホーム</a>
          <a href="/aichat" class="dropdown-item">🤖 AI チャット</a>
          <a href="/repositories" class="dropdown-item">📦 リポジトリ</a>
          <a href="/settings" class="dropdown-item">⚙️ 設定</a>
          <a href="/api-keys" class="dropdown-item">🔑 キー管理</a>
          <a href="/auth/switch" class="dropdown-item switch-account">🔄 別アカウントでログイン</a>
          <a href="/auth/logout" class="dropdown-item logout">🚪 ログアウト</a>
        </div>
      </div>
    </div>
  </nav>

  <div class="container">
    <div class="post-card">
      <h1 class="post-title">📮 つぶやき投稿</h1>
      <p class="post-subtitle">自由に書いた一言をSlackに投稿できます。</p>

      <textarea id="freeText" placeholder="ここに投稿したい内容を書いてください…" maxlength="3000"></textarea>
      <div class="char-count" id="charCount">0 / 3000</div>
      <button class="post-btn" id="postBtn" onclick="postToSlack()">📮 Slackに投稿する</button>
      <div class="status-msg" id="statusMsg"></div>

      <a href="/welcome" class="back-link">← ホームに戻る</a>
    </div>
  </div>

  <script>
    ${getThemeToggleScript()}

    function toggleDropdown() {
      document.getElementById('dropdownMenu').classList.toggle('show');
    }
    window.addEventListener('click', function(e) {
      var icon = document.querySelector('.user-icon');
      var dd = document.getElementById('dropdownMenu');
      if (!icon.contains(e.target) && !dd.contains(e.target)) dd.classList.remove('show');
    });

    var freeTextEl = document.getElementById('freeText');
    var charCountEl = document.getElementById('charCount');
    var postBtnEl = document.getElementById('postBtn');
    var statusMsgEl = document.getElementById('statusMsg');
    var MAX_LEN = 3000;

    freeTextEl.addEventListener('input', function() {
      var len = freeTextEl.value.length;
      charCountEl.textContent = len + ' / ' + MAX_LEN;
      charCountEl.classList.toggle('over', len > MAX_LEN);
    });

    function showStatus(kind, text) {
      statusMsgEl.textContent = text;
      statusMsgEl.className = 'status-msg show ' + kind;
    }

    function postToSlack() {
      var text = freeTextEl.value.trim();
      if (!text) {
        showStatus('error', '本文が空です');
        return;
      }
      postBtnEl.disabled = true;
      postBtnEl.textContent = '投稿中…';
      fetch('/api/tsubuyaki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: text })
      }).then(function(r) { return r.json().then(function(data) { return { status: r.status, data: data }; }); })
        .then(function(res) {
          if (res.status >= 200 && res.status < 300 && res.data.ok) {
            showStatus('success', '✅ Slackに投稿しました');
            freeTextEl.value = '';
            charCountEl.textContent = '0 / ' + MAX_LEN;
            charCountEl.classList.remove('over');
          } else {
            showStatus('error', '❌ ' + (res.data.error || '投稿に失敗しました'));
          }
        })
        .catch(function() {
          showStatus('error', '❌ 通信エラーが発生しました');
        })
        .finally(function() {
          postBtnEl.disabled = false;
          postBtnEl.textContent = '📮 Slackに投稿する';
        });
    }
  </script>
</body>
</html>`;
}
