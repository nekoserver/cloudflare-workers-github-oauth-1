/**
 * 🔑キー管理ページのHTML
 * APIキー(トップページのログイン判定に使う)の発行・一覧・失効を行う。
 */
import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

export function getApiKeysPage(user: { name?: string; username: string }): string {
  const displayName = escapeHtml(user.name || user.username);
  const initials = escapeHtml((user.name || user.username).substring(0, 2).toUpperCase());

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🔑 キー管理 - Cloudflare Workers GitHub OAuth</title>
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
    .container { max-width: 900px; margin: 0 auto; padding: 48px 32px; }
    .card {
      background: var(--card-bg); border-radius: 16px;
      box-shadow: 0 20px 60px var(--card-shadow); padding: 48px; margin-bottom: 32px;
    }
    .title { font-size: 36px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
    .subtitle { font-size: 16px; color: var(--text-muted); margin-bottom: 32px; }
    .create-form { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; margin-bottom: 24px; padding: 20px; background: var(--bg-secondary); border-radius: 8px; }
    .form-group { display: flex; flex-direction: column; gap: 4px; }
    .form-group label { font-size: 12px; font-weight: 600; color: var(--text-muted); }
    .form-group input[type="text"], .form-group select {
      padding: 8px 10px; border: 1px solid var(--input-border); border-radius: 6px;
      font-size: 14px; color: var(--text-secondary); background: var(--input-bg);
    }
    .btn { padding: 10px 20px; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-primary { background: var(--accent-color); color: white; }
    .btn-primary:hover { background: var(--accent-hover); }
    .btn-danger {
      background: transparent; color: var(--danger-color); border: 1px solid var(--danger-color);
      border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 600;
      cursor: pointer; transition: background 0.2s, color 0.2s;
    }
    .btn-danger:hover { background: var(--danger-color); color: white; }
    .btn-danger:disabled { opacity: 0.4; cursor: not-allowed; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-secondary); }
    th { color: var(--text-muted); font-weight: 600; font-size: 12px; text-transform: uppercase; }
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .status-active { background: var(--success-color); color: white; }
    .status-revoked { background: var(--danger-color); color: white; }
    .status-expired { background: #a0a0a0; color: white; }
    .empty-row td { text-align: center; color: var(--text-muted); padding: 24px; }
    .key-prefix { font-family: monospace; font-size: 12px; }
    .back-btn {
      background: var(--accent-color); color: white; border: none; border-radius: 8px;
      padding: 12px 24px; font-size: 14px; font-weight: 600; cursor: pointer;
      margin-top: 24px; text-decoration: none; display: inline-block;
    }
    .back-btn:hover { background: var(--accent-hover); }
    .modal-overlay {
      display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5);
      align-items: center; justify-content: center; z-index: 2000;
    }
    .modal-overlay.show { display: flex; }
    .modal-box { background: var(--card-bg); border-radius: 12px; padding: 28px; max-width: 520px; width: 90%; }
    .modal-box h3 { color: var(--text-primary); margin-bottom: 12px; }
    .modal-box p { color: var(--text-muted); font-size: 13px; margin-bottom: 12px; }
    .raw-key-box {
      font-family: monospace; font-size: 13px; word-break: break-all;
      background: var(--bg-secondary); padding: 12px; border-radius: 8px; margin-bottom: 12px;
      color: var(--text-primary);
    }
    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="navbar-brand">
      <span>🔑</span>
      <span>キー管理</span>
    </div>
    <div class="user-menu">
      ${getThemeToggleHTML()}
      <span class="user-name">${displayName}</span>
      <div class="user-menu-container">
        <div class="user-icon" title="${displayName}" onclick="toggleDropdown()">
          ${initials}
        </div>
        <div class="dropdown-menu" id="dropdownMenu">
          <a href="/welcome" class="dropdown-item">🏠 ホーム</a>
          <a href="/aichat" class="dropdown-item">🤖 AI チャット</a>
          <a href="/repositories" class="dropdown-item">📦 リポジトリ</a>
          <a href="/function-changelog" class="dropdown-item">🔖 関数辞典</a>
          <a href="/userinfo" class="dropdown-item">👤 ユーザー情報</a>
          <a href="/status" class="dropdown-item">📊 キャッシュ状況</a>
          <a href="/api-keys" class="dropdown-item">🔑 キー管理</a>
          <a href="/auth/switch" class="dropdown-item switch-account">🔄 別アカウントでログイン</a>
          <a href="/auth/logout" class="dropdown-item logout">🚪 ログアウト</a>
        </div>
      </div>
    </div>
  </nav>

  <div class="container">
    <div class="card">
      <h1 class="title">🔑 キー管理</h1>
      <p class="subtitle">トップページ(GET /)へのAPIキー付きアクセスでログイン判定を行うためのAPIキーを発行・失効できます。生キーは発行直後の一度しか表示されません。</p>

      <div class="create-form">
        <div class="form-group">
          <label for="newKeyLabel">ラベル</label>
          <input type="text" id="newKeyLabel" placeholder="例: 監視用" maxlength="100">
        </div>
        <div class="form-group">
          <label for="newKeyExpiry">有効期限</label>
          <select id="newKeyExpiry">
            <option value="30">30日</option>
            <option value="90">90日</option>
            <option value="null">無期限</option>
          </select>
        </div>
        <button class="btn btn-primary" onclick="createApiKey()">新規発行</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>ラベル</th>
            <th>キー</th>
            <th>状態</th>
            <th>発行日</th>
            <th>有効期限</th>
            <th>最終使用</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="apiKeyTableBody">
          <tr class="empty-row"><td colspan="7">読み込み中...</td></tr>
        </tbody>
      </table>

      <a href="/welcome" class="back-btn">← ホームに戻る</a>
    </div>
  </div>

  <div class="modal-overlay" id="rawKeyModal">
    <div class="modal-box">
      <h3>✅ APIキーを発行しました</h3>
      <p>このキーは今だけ表示されます。安全な場所に保存してください(再表示はできません)。</p>
      <div class="raw-key-box" id="rawKeyText"></div>
      <div class="modal-actions">
        <button class="btn btn-primary" onclick="closeRawKeyModal()">閉じる</button>
      </div>
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

    function escapeHtmlClient(s) {
      return String(s).replace(/[&<>"']/g, function(c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    function formatStatus(item) {
      if (item.revoked_at) return '<span class="status-badge status-revoked">失効済み</span>';
      if (item.expires_at && new Date(item.expires_at).getTime() <= Date.now()) {
        return '<span class="status-badge status-expired">期限切れ</span>';
      }
      return '<span class="status-badge status-active">有効</span>';
    }

    function renderApiKeyTable(keys) {
      var body = document.getElementById('apiKeyTableBody');
      if (!keys || keys.length === 0) {
        body.innerHTML = '<tr class="empty-row"><td colspan="7">まだAPIキーがありません</td></tr>';
        return;
      }
      body.innerHTML = keys.map(function(item) {
        var revoked = !!item.revoked_at;
        return '<tr>' +
          '<td>' + escapeHtmlClient(item.label) + '</td>' +
          '<td class="key-prefix">' + escapeHtmlClient(item.key_prefix) + '</td>' +
          '<td>' + formatStatus(item) + '</td>' +
          '<td>' + escapeHtmlClient(item.created_at) + '</td>' +
          '<td>' + (item.expires_at ? escapeHtmlClient(item.expires_at) : '無期限') + '</td>' +
          '<td>' + (item.last_used_at ? escapeHtmlClient(item.last_used_at) : '未使用') + '</td>' +
          '<td><button class="btn-danger" ' + (revoked ? 'disabled' : '') + ' onclick="revokeApiKey(&#39;' + item.id + '&#39;)">失効</button></td>' +
          '</tr>';
      }).join('');
    }

    function loadApiKeys() {
      fetch('/api/api-keys', { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) { renderApiKeyTable(data.keys || []); })
        .catch(function() {
          document.getElementById('apiKeyTableBody').innerHTML =
            '<tr class="empty-row"><td colspan="7">読み込みに失敗しました</td></tr>';
        });
    }

    function createApiKey() {
      var labelEl = document.getElementById('newKeyLabel');
      var expiryEl = document.getElementById('newKeyExpiry');
      var label = labelEl.value.trim();
      if (!label) {
        alert('ラベルを入力してください');
        return;
      }
      var expiryVal = expiryEl.value;
      var expiresInDays = expiryVal === 'null' ? null : parseInt(expiryVal, 10);

      fetch('/api/api-keys', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label, expiresInDays: expiresInDays }),
      })
        .then(function(r) { return r.json().then(function(data) { return { ok: r.ok, data: data }; }); })
        .then(function(res) {
          if (!res.ok) {
            alert(res.data.error || 'APIキーの発行に失敗しました');
            return;
          }
          labelEl.value = '';
          showRawKeyModal(res.data.rawKey);
          loadApiKeys();
        })
        .catch(function() { alert('APIキーの発行に失敗しました'); });
    }

    function revokeApiKey(id) {
      if (!confirm('このAPIキーを失効させますか?この操作は取り消せません。')) return;
      fetch('/api/api-keys/' + encodeURIComponent(id) + '/revoke', {
        method: 'POST',
        credentials: 'same-origin',
      })
        .then(function(r) { return r.json().then(function(data) { return { ok: r.ok, data: data }; }); })
        .then(function(res) {
          if (!res.ok) {
            alert(res.data.error || 'APIキーの失効に失敗しました');
            return;
          }
          loadApiKeys();
        })
        .catch(function() { alert('APIキーの失効に失敗しました'); });
    }

    function showRawKeyModal(rawKey) {
      document.getElementById('rawKeyText').textContent = rawKey;
      document.getElementById('rawKeyModal').classList.add('show');
    }

    function closeRawKeyModal() {
      document.getElementById('rawKeyModal').classList.remove('show');
    }

    loadApiKeys();
  </script>
</body>
</html>`;
}
