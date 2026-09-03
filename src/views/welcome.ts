/**
 * ウェルカムページのHTML
 */
import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';
import { loginMethodLabel, LOGIN_METHOD_PUBLIC_KEY } from '../utils/loginHistory';

export function getWelcomePage(user: {
  name?: string;
  email?: string;
  username: string;
  avatar?: string;
  lastLoginAt?: string | null;
  showWelcomeMessage?: boolean;
  /** 今回のログインで使われた方式(login_method Cookie由来、1回のログインにつき1回だけ渡ってくる) */
  loginMethod?: string | null;
  /** user_sessions.last_login_method由来。ページを開くたびに表示する永続的な値 */
  lastLoginMethod?: string | null;
  repoCount?: number | null;
  expiresAt?: string;
  expiresAtTimestamp?: number;
  sessionDuration?: string;
}): string {
  const displayName = escapeHtml(user.name || user.username);
  const safeUsername = escapeHtml(user.username);
  const safeEmail = user.email ? escapeHtml(user.email) : null;
  const initials = escapeHtml((user.name || user.username).substring(0, 2).toUpperCase());

  const sessionDurationLabel = (d?: string): string => {
    switch (d) {
      case '1h': return '1時間';
      case '3h': return '3時間';
      case '8h': return '8時間';
      case '1d': return '1日';
      case '3d': return '3日';
      case '1w': return '1週間';
      default: return '1時間';
    }
  };

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome - Cloudflare Workers GitHub OAuth</title>
  ${getThemeInitScript()}
  <style>
    ${getThemeCSS()}
    ${getThemeToggleCSS()}
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
        'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
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

    .navbar-brand {
      font-size: 20px;
      font-weight: 700;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .navbar-brand .logo {
      font-size: 24px;
    }

    .user-menu {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .user-name {
      font-size: 14px;
      color: var(--text-secondary);
      font-weight: 500;
    }

    .user-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      font-size: 16px;
      cursor: pointer;
      transition: transform 0.2s ease;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    }

    .user-icon:hover {
      transform: scale(1.05);
    }

    .user-menu-container {
      position: relative;
    }

    .dropdown-menu {
      display: none;
      position: absolute;
      top: 50px;
      right: 0;
      background: var(--dropdown-bg);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      min-width: 180px;
      z-index: 1000;
      overflow: hidden;
    }

    .dropdown-menu.show {
      display: block;
    }

    .dropdown-item {
      padding: 12px 20px;
      color: var(--text-secondary);
      text-decoration: none;
      display: block;
      transition: background 0.2s ease;
      cursor: pointer;
      border-bottom: 1px solid var(--border-color);
    }

    .dropdown-item:last-child {
      border-bottom: none;
    }

    .dropdown-item:hover {
      background: var(--dropdown-hover);
    }

    .dropdown-item.switch-account { color: var(--accent-color); }
    .dropdown-item.logout {
      color: var(--danger-color);
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 48px 32px;
    }

    .welcome-card {
      background: var(--card-bg);
      border-radius: 16px;
      box-shadow: 0 20px 60px var(--card-shadow);
      padding: 48px;
      margin-bottom: 32px;
    }

    .welcome-title {
      font-size: 36px;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 16px;
    }

    .welcome-subtitle {
      font-size: 18px;
      color: var(--text-muted);
      margin-bottom: 32px;
    }

    .login-method-badge {
      display: inline-block;
      font-size: 13px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 12px;
      vertical-align: middle;
    }
    .login-method-badge-passkey {
      background: var(--accent-color);
      color: white;
    }

    .countdown-register-btn {
      margin-left: 8px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 12px;
      color: var(--text-secondary);
      cursor: pointer;
    }
    .countdown-register-btn:hover { background: var(--dropdown-hover); }
    .countdown-register-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .user-info {
      background: var(--bg-secondary);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 32px;
    }

    .user-info h3 {
      color: var(--text-secondary);
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid var(--border-color);
    }

    .info-row:last-child {
      border-bottom: none;
    }

    .info-label {
      color: var(--text-muted);
      font-size: 14px;
      white-space: nowrap;
    }

    .info-value {
      color: var(--text-secondary);
      font-size: 14px;
      font-weight: 500;
      white-space: nowrap;
    }

    .api-section {
      background: var(--card-bg);
      border-radius: 16px;
      box-shadow: 0 10px 30px var(--card-shadow-light);
      padding: 32px;
    }

    .api-section h2 {
      color: var(--text-primary);
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 16px;
    }

    .api-endpoints {
      display: grid;
      gap: 12px;
    }

    .endpoint {
      background: var(--bg-secondary);
      border-radius: 8px;
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .endpoint-method {
      background: var(--accent-color);
      color: white;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      min-width: 50px;
      text-align: center;
    }

    .endpoint-method.put {
      background: #ed8936;
    }

    .endpoint-path {
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 14px;
      color: var(--text-secondary);
    }

    .time-remaining-warning {
      color: var(--danger-color, #e53e3e) !important;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="navbar-brand">
      <span class="logo">🔐</span>
      <span>ログイン中</span>
    </div>
    <div class="user-menu">
      ${getThemeToggleHTML()}
      <span class="user-name">${displayName}</span>
      <div class="user-menu-container">
        <div class="user-icon" title="${displayName}" onclick="toggleDropdown()">
          ${initials}
        </div>
        <div class="dropdown-menu" id="dropdownMenu">
          <a href="/aichat" class="dropdown-item">🤖 AI チャット</a>
          <a href="/repositories" class="dropdown-item">📦 リポジトリ</a>
          <a href="/function-changelog" class="dropdown-item">🔖 関数辞典</a>
          <a href="/harness-log" class="dropdown-item">🪝 Harnessフックログ</a>
          <a href="/base64" class="dropdown-item">🔡 Base64変換</a>
          <a href="/userinfo" class="dropdown-item">👤 ユーザー情報</a>
          <a href="/settings" class="dropdown-item">⚙️ 設定</a>
          <a href="/status" class="dropdown-item">📊 キャッシュ状況</a>
          <a href="/api-keys" class="dropdown-item">🔑 キー管理</a>
          <a href="/auth/switch" class="dropdown-item switch-account">🔄 別アカウントでログイン</a>
          <a href="/auth/logout" class="dropdown-item logout">🚪 ログアウト</a>
        </div>
      </div>
    </div>
  </nav>

  <div class="container">
    <div class="welcome-card">
      ${user.showWelcomeMessage ? `<h1 class="welcome-title">ようこそ、${displayName}さん！</h1>
      <p class="welcome-subtitle">ログインに成功しました${user.loginMethod === LOGIN_METHOD_PUBLIC_KEY ? ' <span class="login-method-badge login-method-badge-passkey">🔐 パスキーでログイン</span>' : ''}</p>` : ''}

      <div class="user-info">
        <h3>ユーザー情報</h3>
        <div class="info-row">
          <span class="info-label">ユーザー名</span>
          <span class="info-value">${safeUsername}</span>
        </div>
        ${safeEmail ? `
        <div class="info-row">
          <span class="info-label">メール</span>
          <span class="info-value">${safeEmail}</span>
        </div>
        ` : ''}
        ${user.lastLoginAt ? `
        <div class="info-row">
          <span class="info-label">前回ログイン日時</span>
          <span class="info-value">${user.lastLoginAt}</span>
        </div>
        ` : ''}
        ${user.lastLoginMethod ? `
        <div class="info-row">
          <span class="info-label">ログイン方法</span>
          <span class="info-value">${escapeHtml(loginMethodLabel(user.lastLoginMethod))}</span>
        </div>
        ` : ''}
        ${user.repoCount != null ? `
        <div class="info-row">
          <span class="info-label">リポジトリ総数</span>
          <span class="info-value">${user.repoCount}</span>
        </div>
        ` : ''}
        ${user.expiresAt ? `
        <div class="info-row">
          <span class="info-label">セッションの有効期限</span>
          <span class="info-value">${escapeHtml(user.expiresAt)}（${sessionDurationLabel(user.sessionDuration)}）
            <button type="button" class="countdown-register-btn" id="countdownRegisterBtn" onclick="registerExpiryCountdown()">⏱️ カウントダウンに登録</button>
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">残り</span>
          <span class="info-value" id="timeRemaining">計算中...</span>
        </div>
        ` : ''}
      </div>
    </div>

    <div class="api-section">
      <h2>利用可能なAPIエンドポイント</h2>
      <div class="api-endpoints">
        <div class="endpoint">
          <span class="endpoint-method">GET</span>
          <span class="endpoint-path">/api/profile</span>
        </div>
        <div class="endpoint">
          <span class="endpoint-method">GET</span>
          <span class="endpoint-path">/api/protected</span>
        </div>
        <div class="endpoint">
          <span class="endpoint-method put">PUT</span>
          <span class="endpoint-path">/api/profile</span>
        </div>
      </div>
    </div>
  </div>

  <script>
    ${getThemeToggleScript()}

    function toggleDropdown() {
      const dropdown = document.getElementById('dropdownMenu');
      dropdown.classList.toggle('show');
    }

    window.addEventListener('click', function(e) {
      const userIcon = document.querySelector('.user-icon');
      const dropdown = document.getElementById('dropdownMenu');
      if (!userIcon.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('show');
      }
    });

    ${user.expiresAtTimestamp ? `
    (function() {
      var expiresAtTimestamp = ${user.expiresAtTimestamp};
      function updateTimeRemaining() {
        var now = Math.floor(Date.now() / 1000);
        var remaining = expiresAtTimestamp - now;
        var el = document.getElementById('timeRemaining');
        if (!el) return;
        if (remaining <= 0) {
          el.textContent = '期限切れ';
          el.classList.add('time-remaining-warning');
          return;
        }
        var hours = Math.floor(remaining / 3600);
        var minutes = Math.floor((remaining % 3600) / 60);
        var seconds = remaining % 60;
        el.textContent = hours > 0 ? hours + '時間 ' + minutes + '分 ' + seconds + '秒'
          : minutes > 0 ? minutes + '分 ' + seconds + '秒' : seconds + '秒';
        if (remaining <= 60) el.classList.add('time-remaining-warning');
        else el.classList.remove('time-remaining-warning');
      }
      updateTimeRemaining();
      setInterval(updateTimeRemaining, 1000);

      // セッション有効期限をそのまま/countdownページのカウントダウンタイマーとして登録する。
      // targetAtにはこのページで計算済みのexpiresAtTimestamp(UNIX秒)をそのまま使う
      // (再計算による誤差を避けるため)。
      window.registerExpiryCountdown = function() {
        var btn = document.getElementById('countdownRegisterBtn');
        if (btn) btn.disabled = true;
        fetch('/api/countdown', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: 'セッション有効期限',
            targetAt: new Date(expiresAtTimestamp * 1000).toISOString(),
          }),
        })
          .then(function(r) { return r.json().then(function(data) { return { ok: r.ok, data: data }; }); })
          .then(function(res) {
            if (!res.ok) {
              alert(res.data.error || 'カウントダウンへの登録に失敗しました');
              if (btn) btn.disabled = false;
              return;
            }
            if (btn) {
              btn.textContent = '✅ 登録しました';
            }
            if (confirm('カウントダウンに登録しました。/countdownページを開きますか?')) {
              window.location.href = '/countdown';
            }
          })
          .catch(function() {
            alert('カウントダウンへの登録に失敗しました');
            if (btn) btn.disabled = false;
          });
      };
    })();
    ` : ''}
  </script>
</body>
</html>`;
}
