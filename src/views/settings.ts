/**
 * 設定ページのHTML
 */
import { escapeHtml } from '../utils/html';

export function getSettingsPage(user: {
  name?: string;
  email?: string;
  username: string;
  issuedAt: string;
  expiresAt: string;
  expiresAtTimestamp: number;
  timezone?: string;
  sessionDuration?: string;
}): string {
  const displayName = escapeHtml(user.name || user.username);
  const safeUsername = escapeHtml(user.username);
  const safeName = user.name ? escapeHtml(user.name) : null;
  const safeEmail = user.email ? escapeHtml(user.email) : null;
  const initials = escapeHtml((user.name || user.username).substring(0, 2).toUpperCase());
  const currentTimezone = user.timezone || 'UTC';
  const currentSessionDuration = user.sessionDuration || '1h';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>設定 - Cloudflare Workers GitHub OAuth</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
    }
    .navbar {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      padding: 16px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .navbar-brand { font-size: 20px; font-weight: 700; color: #1a202c; display: flex; align-items: center; gap: 8px; }
    .user-menu { display: flex; align-items: center; gap: 12px; }
    .user-name { font-size: 14px; color: #2d3748; font-weight: 500; }
    .user-icon {
      width: 40px; height: 40px; border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: 600; font-size: 16px; cursor: pointer;
    }
    .user-menu-container { position: relative; }
    .dropdown-menu {
      display: none; position: absolute; top: 50px; right: 0;
      background: white; border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 180px; z-index: 1000; overflow: hidden;
    }
    .dropdown-menu.show { display: block; }
    .dropdown-item {
      padding: 12px 20px; color: #2d3748; text-decoration: none;
      display: block; cursor: pointer; border-bottom: 1px solid #e2e8f0;
      transition: background 0.2s ease;
    }
    .dropdown-item:last-child { border-bottom: none; }
    .dropdown-item:hover { background: #f7fafc; }
    .dropdown-item.logout { color: #e53e3e; }
    .container { max-width: 900px; margin: 0 auto; padding: 48px 32px; }
    .settings-card {
      background: white; border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3); padding: 48px; margin-bottom: 32px;
    }
    .settings-title { font-size: 36px; font-weight: 700; color: #1a202c; margin-bottom: 8px; }
    .settings-subtitle { font-size: 18px; color: #718096; margin-bottom: 32px; }
    .section { margin-bottom: 32px; }
    .section-title {
      font-size: 20px; font-weight: 600; color: #1a202c; margin-bottom: 16px;
      padding-bottom: 8px; border-bottom: 2px solid #e2e8f0;
    }
    .info-grid { display: grid; gap: 16px; }
    .info-item {
      background: #f7fafc; border-radius: 8px; padding: 16px;
      display: flex; justify-content: space-between; align-items: center;
    }
    .info-item.disabled { position: relative; }
    .info-item.disabled::after {
      content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(200,200,200,0.5); border-radius: 8px; pointer-events: none;
    }
    .info-label { color: #718096; font-size: 14px; font-weight: 600; }
    .info-value { color: #2d3748; font-size: 14px; font-weight: 500; }
    .status-badge {
      display: inline-block; padding: 4px 12px; border-radius: 12px;
      font-size: 12px; font-weight: 600; background: #48bb78; color: white;
    }
    .back-btn {
      background: #667eea; color: white; border: none; border-radius: 8px;
      padding: 12px 24px; font-size: 14px; font-weight: 600; cursor: pointer;
      margin-top: 24px; text-decoration: none; display: inline-block;
    }
    .back-btn:hover { background: #5a67d8; }
    .timezone-select {
      width: 100%; padding: 10px 12px; border: 1px solid #cbd5e0; border-radius: 6px;
      font-size: 14px; color: #2d3748; background: white; cursor: pointer;
    }
    .timezone-select:disabled { background: #e2e8f0; cursor: not-allowed; opacity: 0.6; }
    .setting-control { display: flex; align-items: center; gap: 12px; flex: 1; }
    .setting-select-wrapper { flex: 1; }
    .setting-checkbox { width: 18px; height: 18px; cursor: pointer; flex-shrink: 0; }
    .success-message {
      background: #48bb78; color: white; padding: 12px 16px; border-radius: 8px;
      margin-top: 16px; display: none; font-size: 14px; font-weight: 500;
    }
    .success-message.show { display: block; }
    .button-container { display: none; margin-top: 16px; gap: 12px; justify-content: flex-start; }
    .button-container.show { display: flex; }
    .btn { padding: 10px 20px; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-save { background: #48bb78; color: white; }
    .btn-save:hover { background: #38a169; }
    .btn-cancel { background: #fc8181; color: white; }
    .btn-cancel:hover { background: #f56565; }
    .time-remaining-warning { color: #e53e3e; font-weight: 600; }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="navbar-brand">
      <span>🔐</span>
      <span>ログイン中</span>
    </div>
    <div class="user-menu">
      <span class="user-name">${displayName}</span>
      <div class="user-menu-container">
        <div class="user-icon" title="${displayName}" onclick="toggleDropdown()">
          ${initials}
        </div>
        <div class="dropdown-menu" id="dropdownMenu">
          <a href="/welcome" class="dropdown-item">🏠 ホーム</a>
          <a href="/repositories" class="dropdown-item">📦 リポジトリ</a>
          <a href="/auth/logout" class="dropdown-item logout">🚪 ログアウト</a>
        </div>
      </div>
    </div>
  </nav>

  <div class="container">
    <div class="settings-card">
      <h1 class="settings-title">⚙️ 設定</h1>
      <p class="settings-subtitle">アカウント情報とログイン状況</p>

      <div class="section">
        <h2 class="section-title">アカウント情報</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">ユーザー名</span>
            <span class="info-value">${safeUsername}</span>
          </div>
          ${safeName ? `
          <div class="info-item">
            <span class="info-label">名前</span>
            <span class="info-value">${safeName}</span>
          </div>` : ''}
          ${safeEmail ? `
          <div class="info-item">
            <span class="info-label">メールアドレス</span>
            <span class="info-value">${safeEmail}</span>
          </div>` : ''}
        </div>
      </div>

      <div class="section">
        <h2 class="section-title">ログイン状況</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">ログイン状態</span>
            <span class="status-badge">✓ ログイン中</span>
          </div>
          <div class="info-item">
            <span class="info-label">ログイン日時</span>
            <span class="info-value">${user.issuedAt}</span>
          </div>
          <div class="info-item">
            <span class="info-label">セッション有効期限</span>
            <span class="info-value">${user.expiresAt}</span>
          </div>
          <div class="info-item">
            <span class="info-label">残り</span>
            <span class="info-value" id="timeRemaining">計算中...</span>
          </div>
          <div class="info-item disabled" id="sessionDurationItem">
            <span class="info-label">次回ログイン時のセッション有効期限</span>
            <div class="setting-control">
              <div class="setting-select-wrapper">
                <select class="timezone-select" id="sessionDurationSelect" onchange="onSessionDurationChange()" disabled>
                  <option value="1h" ${currentSessionDuration === '1h' ? 'selected' : ''}>1時間 (デフォルト)</option>
                  <option value="3h" ${currentSessionDuration === '3h' ? 'selected' : ''}>3時間</option>
                  <option value="8h" ${currentSessionDuration === '8h' ? 'selected' : ''}>8時間</option>
                  <option value="1d" ${currentSessionDuration === '1d' ? 'selected' : ''}>1日</option>
                  <option value="3d" ${currentSessionDuration === '3d' ? 'selected' : ''}>3日</option>
                  <option value="1w" ${currentSessionDuration === '1w' ? 'selected' : ''}>1週間</option>
                </select>
              </div>
              <input type="checkbox" class="setting-checkbox" id="sessionDurationCheckbox" onchange="toggleSessionDurationEdit()">
            </div>
          </div>
        </div>
        <div class="button-container" id="sessionButtonContainer">
          <button class="btn btn-save" onclick="saveSessionDuration()">保存</button>
          <button class="btn btn-cancel" onclick="cancelSessionDuration()">キャンセル</button>
        </div>
        <div class="success-message" id="sessionSuccessMessage">✓ セッション有効期限を変更しました</div>
      </div>

      <div class="section">
        <h2 class="section-title">表示設定</h2>
        <div class="info-grid">
          <div class="info-item disabled" id="timezoneItem">
            <span class="info-label">タイムゾーン</span>
            <div class="setting-control">
              <div class="setting-select-wrapper">
                <select class="timezone-select" id="timezoneSelect" onchange="onTimezoneChange()" disabled>
                  <option value="UTC" ${currentTimezone === 'UTC' ? 'selected' : ''}>UTC (Default)</option>
                  <option value="JST" ${currentTimezone === 'JST' ? 'selected' : ''}>JST (+9)</option>
                </select>
              </div>
              <input type="checkbox" class="setting-checkbox" id="timezoneCheckbox" onchange="toggleTimezoneEdit()">
            </div>
          </div>
        </div>
        <div class="button-container" id="buttonContainer">
          <button class="btn btn-save" onclick="saveTimezone()">保存</button>
          <button class="btn btn-cancel" onclick="cancelTimezone()">キャンセル</button>
        </div>
        <div class="success-message" id="successMessage">✓ タイムゾーンを変更しました</div>
      </div>

      <a href="/welcome" class="back-btn">← ホームに戻る</a>
    </div>
  </div>

  <script>
    let originalTimezone = '${currentTimezone}';
    let originalSessionDuration = '${currentSessionDuration}';
    const expiresAtTimestamp = ${user.expiresAtTimestamp};

    function updateTimeRemaining() {
      const now = Math.floor(Date.now() / 1000);
      const remaining = expiresAtTimestamp - now;
      const el = document.getElementById('timeRemaining');
      if (remaining <= 0) {
        el.textContent = '期限切れ';
        el.classList.add('time-remaining-warning');
        setTimeout(() => { window.location.href = '/'; }, 3000);
        return;
      }
      const hours = Math.floor(remaining / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);
      const seconds = remaining % 60;
      el.textContent = hours > 0 ? \`\${hours}時間 \${minutes}分 \${seconds}秒\`
        : minutes > 0 ? \`\${minutes}分 \${seconds}秒\` : \`\${seconds}秒\`;
      if (remaining <= 60) el.classList.add('time-remaining-warning');
      else el.classList.remove('time-remaining-warning');
    }
    updateTimeRemaining();
    setInterval(updateTimeRemaining, 1000);

    function toggleDropdown() {
      document.getElementById('dropdownMenu').classList.toggle('show');
    }

    function toggleTimezoneEdit() {
      const cb = document.getElementById('timezoneCheckbox');
      const sel = document.getElementById('timezoneSelect');
      const item = document.getElementById('timezoneItem');
      if (cb.checked) { sel.disabled = false; item.classList.remove('disabled'); }
      else { sel.disabled = true; item.classList.add('disabled'); sel.value = originalTimezone; document.getElementById('buttonContainer').classList.remove('show'); }
    }
    function toggleSessionDurationEdit() {
      const cb = document.getElementById('sessionDurationCheckbox');
      const sel = document.getElementById('sessionDurationSelect');
      const item = document.getElementById('sessionDurationItem');
      if (cb.checked) { sel.disabled = false; item.classList.remove('disabled'); }
      else { sel.disabled = true; item.classList.add('disabled'); sel.value = originalSessionDuration; document.getElementById('sessionButtonContainer').classList.remove('show'); }
    }
    function onTimezoneChange() {
      const cb = document.getElementById('timezoneCheckbox');
      const sel = document.getElementById('timezoneSelect');
      if (cb.checked && sel.value !== originalTimezone) document.getElementById('buttonContainer').classList.add('show');
      else document.getElementById('buttonContainer').classList.remove('show');
    }
    function onSessionDurationChange() {
      const cb = document.getElementById('sessionDurationCheckbox');
      const sel = document.getElementById('sessionDurationSelect');
      if (cb.checked && sel.value !== originalSessionDuration) document.getElementById('sessionButtonContainer').classList.add('show');
      else document.getElementById('sessionButtonContainer').classList.remove('show');
    }
    async function saveTimezone() {
      const timezone = document.getElementById('timezoneSelect').value;
      const res = await fetch('/api/settings/timezone', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ timezone }) });
      if (res.ok) {
        originalTimezone = timezone;
        document.getElementById('buttonContainer').classList.remove('show');
        const msg = document.getElementById('successMessage');
        msg.classList.add('show');
        document.getElementById('timezoneCheckbox').checked = false;
        document.getElementById('timezoneSelect').disabled = true;
        document.getElementById('timezoneItem').classList.add('disabled');
        setTimeout(() => { msg.classList.remove('show'); window.location.reload(); }, 1500);
      } else { alert('タイムゾーンの変更に失敗しました'); }
    }
    function cancelTimezone() {
      document.getElementById('timezoneSelect').value = originalTimezone;
      document.getElementById('buttonContainer').classList.remove('show');
      document.getElementById('timezoneCheckbox').checked = false;
      document.getElementById('timezoneSelect').disabled = true;
      document.getElementById('timezoneItem').classList.add('disabled');
    }
    async function saveSessionDuration() {
      const sessionDuration = document.getElementById('sessionDurationSelect').value;
      const res = await fetch('/api/settings/session-duration', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ sessionDuration }) });
      if (res.ok) {
        originalSessionDuration = sessionDuration;
        document.getElementById('sessionButtonContainer').classList.remove('show');
        const msg = document.getElementById('sessionSuccessMessage');
        msg.classList.add('show');
        document.getElementById('sessionDurationCheckbox').checked = false;
        document.getElementById('sessionDurationSelect').disabled = true;
        document.getElementById('sessionDurationItem').classList.add('disabled');
        setTimeout(() => { msg.classList.remove('show'); }, 1500);
      } else { alert('セッション有効期限の変更に失敗しました'); }
    }
    function cancelSessionDuration() {
      document.getElementById('sessionDurationSelect').value = originalSessionDuration;
      document.getElementById('sessionButtonContainer').classList.remove('show');
      document.getElementById('sessionDurationCheckbox').checked = false;
      document.getElementById('sessionDurationSelect').disabled = true;
      document.getElementById('sessionDurationItem').classList.add('disabled');
    }
    window.addEventListener('click', function(e) {
      const icon = document.querySelector('.user-icon');
      const dd = document.getElementById('dropdownMenu');
      if (!icon.contains(e.target) && !dd.contains(e.target)) dd.classList.remove('show');
    });
  </script>
</body>
</html>`;
}
