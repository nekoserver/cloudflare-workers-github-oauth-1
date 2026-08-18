import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

export function getWasmModulesPage(username: string): string {
  const safeUsername = escapeHtml(username);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WASMモジュール一覧 - Cloudflare Workers GitHub OAuth</title>
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
      display: none;
      position: absolute;
      top: 48px;
      right: 0;
      background: var(--card-bg);
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      min-width: 200px;
      overflow: hidden;
      z-index: 100;
    }
    .dropdown-menu.open { display: block; }
    .dropdown-item {
      display: block;
      padding: 12px 16px;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 14px;
    }
    .dropdown-item:hover { background: var(--bg-secondary); }
    .dropdown-item.logout { color: #e53e3e; }
    .dropdown-item.switch-account { color: var(--accent-color, #667eea); }
    .container { max-width: 820px; margin: 0 auto; padding: 32px 20px; }
    .title { font-size: 22px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
    .subtitle { font-size: 14px; color: var(--text-muted); margin-bottom: 24px; }
    .note {
      font-size: 12px;
      color: var(--text-muted);
      background: var(--bg-secondary);
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 20px;
      line-height: 1.6;
    }
    .module-card {
      background: var(--card-bg);
      border-radius: 12px;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
      padding: 20px 24px;
      margin-bottom: 16px;
    }
    .module-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .module-name { font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
    .module-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 10px; }
    .module-meta { font-size: 12px; color: var(--text-muted); display: flex; flex-wrap: wrap; gap: 4px 16px; }
    .module-meta code { font-family: 'Monaco', 'Courier New', monospace; }
    .toggle-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary); white-space: nowrap; }
    .toggle-label input { width: 18px; height: 18px; cursor: pointer; }
    .updated-info { font-size: 11px; color: var(--text-faint, var(--text-muted)); margin-top: 8px; }
    .save-btn {
      background: #667eea;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 8px;
    }
    .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .save-btn:hover:not(:disabled) { background: #5568d3; }
    .status-msg { font-size: 13px; margin-top: 10px; }
    .status-msg.ok { color: #166534; }
    .status-msg.error { color: #991b1b; }
    .empty { color: var(--text-muted); padding: 20px; text-align: center; }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="navbar-brand">
      <span>🧩</span>
      <span>WASMモジュール一覧</span>
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
    <div class="title">WASMモジュール一覧</div>
    <div class="subtitle">リポジトリに組み込まれているWASMモジュールと、起動時の読み込みON/OFF設定</div>
    <div class="note">
      Cloudflare Workersにはファイルシステムの一覧取得APIが無いため、この一覧はコード側の手動カタログ(wasm/README.md参照)です。
      設定を変更しても、既に起動中のWorker isolateには反映されません。次にisolateが新規に立ち上がったタイミング(次回のコールドスタート)から反映されます。
    </div>
    <div id="moduleList"></div>
    <button class="save-btn" id="saveBtn" disabled>設定を保存</button>
    <div class="status-msg" id="statusMsg"></div>
  </div>

  <script>
    ${getThemeToggleScript()}

    function toggleDropdown() {
      document.getElementById('dropdownMenu').classList.toggle('open');
    }
    window.toggleDropdown = toggleDropdown;
    document.addEventListener('click', function(e) {
      var menu = document.getElementById('dropdownMenu');
      var container = document.querySelector('.user-menu-container');
      if (menu.classList.contains('open') && container && !container.contains(e.target)) {
        menu.classList.remove('open');
      }
    });

    function escHtml(s) {
      return String(s).replace(/[&<>"']/g, function(c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    var moduleListEl = document.getElementById('moduleList');
    var saveBtn = document.getElementById('saveBtn');
    var statusMsg = document.getElementById('statusMsg');
    var loadedModules = [];

    function renderModules(modules) {
      loadedModules = modules;
      if (modules.length === 0) {
        moduleListEl.innerHTML = '<div class="empty">登録されているWASMモジュールがありません</div>';
        saveBtn.disabled = true;
        return;
      }
      var html = '';
      modules.forEach(function(m) {
        html += '<div class="module-card" data-module-id="' + escHtml(m.id) + '">';
        html += '<div class="module-head">';
        html += '<div><div class="module-name">' + escHtml(m.name) + '</div><div class="module-desc">' + escHtml(m.description) + '</div></div>';
        html += '<label class="toggle-label"><input type="checkbox" class="module-toggle"' + (m.enabled ? ' checked' : '') + '> 起動時に読み込む</label>';
        html += '</div>';
        html += '<div class="module-meta">';
        html += '<span>ID: <code>' + escHtml(m.id) + '</code></span>';
        html += '<span>バイナリ: <code>' + escHtml(m.wasmPath) + '</code></span>';
        html += '<span>ソース: <code>' + escHtml(m.sourceDir) + '</code></span>';
        html += '<span>サイズ目安: ' + escHtml(m.approxSize) + '</span>';
        html += '</div>';
        if (m.updatedAt) {
          html += '<div class="updated-info">最終更新: ' + escHtml(m.updatedAt) + (m.updatedBy ? ' (' + escHtml(m.updatedBy) + ')' : '') + '</div>';
        }
        html += '</div>';
      });
      moduleListEl.innerHTML = html;
      saveBtn.disabled = false;
    }

    function loadModules() {
      moduleListEl.innerHTML = '<div class="empty">読み込み中…</div>';
      fetch('/api/wasm-modules', { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) { renderModules(data.modules || []); })
        .catch(function(err) {
          moduleListEl.innerHTML = '<div class="empty">読み込みに失敗しました: ' + escHtml(err && err.message ? err.message : String(err)) + '</div>';
        });
    }

    saveBtn.addEventListener('click', function() {
      var cards = moduleListEl.querySelectorAll('.module-card');
      var updates = [];
      cards.forEach(function(card) {
        var moduleId = card.getAttribute('data-module-id');
        var checked = card.querySelector('.module-toggle').checked;
        updates.push({ moduleId: moduleId, enabled: checked });
      });
      saveBtn.disabled = true;
      statusMsg.textContent = '保存中…';
      statusMsg.className = 'status-msg';
      Promise.all(updates.map(function(u) {
        return fetch('/api/wasm-modules', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(u),
        }).then(function(r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        });
      })).then(function() {
        statusMsg.textContent = '保存しました(次回のisolateコールドスタートから反映されます)';
        statusMsg.className = 'status-msg ok';
        loadModules();
      }).catch(function(err) {
        statusMsg.textContent = '保存に失敗しました: ' + (err && err.message ? err.message : String(err));
        statusMsg.className = 'status-msg error';
        saveBtn.disabled = false;
      });
    });

    loadModules();
  </script>
</body>
</html>`;
}
