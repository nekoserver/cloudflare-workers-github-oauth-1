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
    .key-cell { display: flex; align-items: center; gap: 6px; }
    .key-textarea {
      font-family: monospace; font-size: 12px; resize: none; overflow: hidden;
      width: 160px; height: 32px; padding: 6px 8px; border: 1px solid var(--input-border);
      border-radius: 6px; background: var(--input-bg); color: var(--text-secondary);
    }
    .key-textarea.key-revoked-bg { background: #ffd6e0; color: #7a1f34; }
    [data-theme="dark"] .key-textarea.key-revoked-bg { background: #4a1c28; color: #ffb3c6; }
    .icon-btn {
      background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px;
      padding: 6px 10px; font-size: 12px; cursor: pointer; color: var(--text-secondary); flex-shrink: 0;
    }
    .icon-btn:hover { background: var(--dropdown-hover); }
    .back-btn {
      background: var(--accent-color); color: white; border: none; border-radius: 8px;
      padding: 12px 24px; font-size: 14px; font-weight: 600; cursor: pointer;
      margin-top: 24px; text-decoration: none; display: inline-block;
    }
    .back-btn:hover { background: var(--accent-hover); }
    .modal-overlay {
      display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5);
      align-items: center; justify-content: center;
    }
    .modal-overlay.show { display: flex; }
    .modal-box { background: var(--card-bg); border-radius: 12px; padding: 28px; max-width: 520px; width: 90%; }
    .modal-box h3 { color: var(--text-primary); margin-bottom: 12px; }
    .modal-box p { color: var(--text-muted); font-size: 13px; margin-bottom: 12px; }
    .countdown-notice { color: var(--text-secondary); font-size: 13px; margin-bottom: 12px; }
    .countdown-notice.countdown-notice-error { color: var(--danger-color); }
    .raw-key-box {
      font-family: monospace; font-size: 13px; word-break: break-all;
      background: var(--bg-secondary); padding: 12px; border-radius: 8px; margin-bottom: 12px;
      color: var(--text-primary);
    }
    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
    .stats-modal-box { max-width: 560px; }
    .stats-total { font-size: 13px; color: var(--text-muted); margin-bottom: 16px; }
    .stats-section-title { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin: 16px 0 8px; }
    .stats-bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .stats-bar-label { width: 150px; flex-shrink: 0; font-size: 12px; color: var(--text-secondary); font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .stats-bar-track { flex: 1; height: 14px; background: var(--bg-secondary); border-radius: 4px; overflow: hidden; }
    .stats-bar-fill { height: 100%; background: var(--accent-color); border-radius: 4px; }
    .stats-bar-count { width: 44px; flex-shrink: 0; text-align: right; font-size: 12px; color: var(--text-secondary); }
    .stats-empty { font-size: 13px; color: var(--text-muted); padding: 8px 0; }
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
          </tr>
        </thead>
        <tbody id="apiKeyTableBody">
          <tr class="empty-row"><td colspan="6">読み込み中...</td></tr>
        </tbody>
      </table>

      <a href="/welcome" class="back-btn">← ホームに戻る</a>
    </div>
  </div>

  <div class="modal-overlay" id="rawKeyModal">
    <div class="modal-box">
      <h3>✅ APIキーを発行しました</h3>
      <p>このキーは今だけ表示されます。安全な場所に保存してください(再表示はできません)。</p>
      <p class="countdown-notice" id="countdownNotice"></p>
      <div class="raw-key-box" id="rawKeyText"></div>
      <div class="modal-actions">
        <button class="btn btn-primary" onclick="closeRawKeyModal()">閉じる</button>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="revokeConfirmModal">
    <div class="modal-box">
      <h3>🗑️ このキーの権限を削除しますか</h3>
      <div class="modal-actions">
        <button class="btn" onclick="closeRevokeConfirmModal()">いいえ</button>
        <button class="btn btn-danger" style="background:var(--danger-color);color:white;border:none" onclick="confirmRevoke()">はい</button>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="statsModal">
    <div class="modal-box stats-modal-box">
      <h3>📊 使用統計</h3>
      <p>このAPIキーで <code>/api/aichat</code> を叩いたリクエストの集計です(セッションでのアクセスは含みません)。</p>
      <div id="statsBody"><div class="stats-empty">読み込み中...</div></div>
      <div class="modal-actions">
        <button class="btn btn-primary" onclick="closeStatsModal()">閉じる</button>
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

    // 一覧表示のキーはただでさえマスク済み(nkapi_+先頭8文字+*)で長いため、
    // さらに前半だけを残して表示する(src/utils/apiKeys.ts の
    // truncateKeyDisplay と同じロジック)。
    function truncateKeyDisplayClient(keyPrefix) {
      var half = Math.ceil(keyPrefix.length / 2);
      return keyPrefix.slice(0, half);
    }

    function getNextZ() {
      var max = 100;
      document.querySelectorAll('[style*="z-index"]').forEach(function(el) {
        var z = parseInt(el.style.zIndex, 10);
        if (!isNaN(z) && z < 9000 && z > max) max = z;
      });
      var staticZDefaults = { rawKeyModal: 2000, revokeConfirmModal: 2000, statsModal: 2000 };
      Object.keys(staticZDefaults).forEach(function(id) {
        var el = document.getElementById(id);
        if (el && el.classList.contains('show')) {
          var z = parseInt(el.style.zIndex, 10) || staticZDefaults[id];
          if (z > max) max = z;
        }
      });
      return max + 100;
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
        body.innerHTML = '<tr class="empty-row"><td colspan="6">まだAPIキーがありません</td></tr>';
        return;
      }
      body.innerHTML = keys.map(function(item) {
        var revoked = !!item.revoked_at;
        var displayKey = truncateKeyDisplayClient(item.key_prefix);
        return '<tr>' +
          '<td>' + escapeHtmlClient(item.label) + '</td>' +
          '<td><div class="key-cell">' +
            '<textarea class="key-textarea' + (revoked ? ' key-revoked-bg' : '') + '" readonly>' + escapeHtmlClient(displayKey) + '</textarea>' +
            '<button class="icon-btn" onclick="copyKeyText(this)">📋 コピー</button>' +
            '<button class="icon-btn" onclick="showStats(&#39;' + item.id + '&#39;)">📊 統計</button>' +
            '<button class="icon-btn" ' + (revoked ? 'disabled' : '') + ' onclick="requestRevoke(&#39;' + item.id + '&#39;)">🗑️ 失効</button>' +
          '</div></td>' +
          '<td>' + formatStatus(item) + '</td>' +
          '<td>' + escapeHtmlClient(item.created_at) + '</td>' +
          '<td>' + (item.expires_at ? escapeHtmlClient(item.expires_at) : '無期限') + '</td>' +
          '<td>' + (item.last_used_at ? escapeHtmlClient(item.last_used_at) : '未使用') + '</td>' +
          '</tr>';
      }).join('');
    }

    function copyKeyText(btn) {
      var textarea = btn.parentElement.querySelector('.key-textarea');
      if (!textarea) return;
      var text = textarea.value;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(function() { fallbackCopy(textarea); });
      } else {
        fallbackCopy(textarea);
      }
    }

    function fallbackCopy(textarea) {
      textarea.removeAttribute('readonly');
      textarea.select();
      try { document.execCommand('copy'); } catch (e) { /* コピー失敗は無視 */ }
      textarea.setAttribute('readonly', 'readonly');
    }

    function loadApiKeys() {
      fetch('/api/api-keys', { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) { renderApiKeyTable(data.keys || []); })
        .catch(function() {
          document.getElementById('apiKeyTableBody').innerHTML =
            '<tr class="empty-row"><td colspan="6">読み込みに失敗しました</td></tr>';
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
          showRawKeyModal(res.data.rawKey, res.data.countdownNotice, res.data.countdown);
          loadApiKeys();
        })
        .catch(function() { alert('APIキーの発行に失敗しました'); });
    }

    var pendingRevokeId = null;

    function requestRevoke(id) {
      pendingRevokeId = id;
      var modal = document.getElementById('revokeConfirmModal');
      modal.style.zIndex = String(getNextZ());
      modal.classList.add('show');
    }

    function closeRevokeConfirmModal() {
      pendingRevokeId = null;
      document.getElementById('revokeConfirmModal').classList.remove('show');
    }

    function confirmRevoke() {
      var id = pendingRevokeId;
      closeRevokeConfirmModal();
      if (!id) return;
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

    function escapeBarLabel(s) {
      return escapeHtmlClient(s);
    }

    function renderStatsBarSection(title, items, labelKey, countKey) {
      if (!items || items.length === 0) {
        return '<div class="stats-section-title">' + escapeHtmlClient(title) + '</div>' +
          '<div class="stats-empty">データがありません</div>';
      }
      var max = items.reduce(function(m, it) { return Math.max(m, it[countKey]); }, 1);
      var rows = items.map(function(it) {
        var pct = Math.max(4, Math.round((it[countKey] / max) * 100));
        return '<div class="stats-bar-row">' +
          '<div class="stats-bar-label" title="' + escapeBarLabel(it[labelKey]) + '">' + escapeBarLabel(it[labelKey]) + '</div>' +
          '<div class="stats-bar-track"><div class="stats-bar-fill" style="width:' + pct + '%"></div></div>' +
          '<div class="stats-bar-count">' + it[countKey] + '</div>' +
          '</div>';
      }).join('');
      return '<div class="stats-section-title">' + escapeHtmlClient(title) + '</div>' + rows;
    }

    function showStats(id) {
      var modal = document.getElementById('statsModal');
      var body = document.getElementById('statsBody');
      body.innerHTML = '<div class="stats-empty">読み込み中...</div>';
      modal.style.zIndex = String(getNextZ());
      modal.classList.add('show');

      fetch('/api/api-keys/' + encodeURIComponent(id) + '/stats', { credentials: 'same-origin' })
        .then(function(r) { return r.json().then(function(data) { return { ok: r.ok, data: data }; }); })
        .then(function(res) {
          if (!res.ok) {
            body.innerHTML = '<div class="stats-empty">' + escapeHtmlClient(res.data.error || '取得に失敗しました') + '</div>';
            return;
          }
          var data = res.data;
          var html = '<div class="stats-total">合計 ' + data.totalCount + ' 回</div>';
          // 直近30日分だけをグラフに使う(古いデータで棒が埋もれるのを防ぐ)
          var recentDays = (data.byDay || []).slice(-30);
          html += renderStatsBarSection('よく使われているエンドポイント', data.byEndpoint, 'endpoint', 'count');
          html += renderStatsBarSection('月別(直近)', data.byMonth, 'month', 'count');
          html += renderStatsBarSection('日別(直近30日)', recentDays, 'day', 'count');
          body.innerHTML = html;
        })
        .catch(function() {
          body.innerHTML = '<div class="stats-empty">通信エラーが発生しました</div>';
        });
    }

    function closeStatsModal() {
      document.getElementById('statsModal').classList.remove('show');
    }

    function showRawKeyModal(rawKey, countdownNotice, countdown) {
      document.getElementById('rawKeyText').textContent = rawKey;
      var noticeEl = document.getElementById('countdownNotice');
      noticeEl.textContent = countdownNotice || '';
      noticeEl.className = 'countdown-notice';
      if (countdown && countdown.ok === false) noticeEl.classList.add('countdown-notice-error');
      var modal = document.getElementById('rawKeyModal');
      modal.style.zIndex = String(getNextZ());
      modal.classList.add('show');
    }

    function closeRawKeyModal() {
      document.getElementById('rawKeyModal').classList.remove('show');
    }

    loadApiKeys();
  </script>
</body>
</html>`;
}
