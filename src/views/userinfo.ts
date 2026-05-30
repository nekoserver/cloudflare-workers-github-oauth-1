/**
 * ユーザー情報ページのHTML
 */
import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

export function getUserInfoPage(user: {
  name?: string;
  email?: string;
  username: string;
  githubId?: number;
}): string {
  const displayName = escapeHtml(user.name || user.username);
  const safeUsername = escapeHtml(user.username);
  const safeName = user.name ? escapeHtml(user.name) : null;
  const safeEmail = user.email ? escapeHtml(user.email) : null;
  const initials = escapeHtml((user.name || user.username).substring(0, 2).toUpperCase());
  const githubIdStr = user.githubId != null ? String(user.githubId) : null;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ユーザー情報 - Cloudflare Workers GitHub OAuth</title>
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
    .userinfo-card {
      background: var(--card-bg); border-radius: 16px;
      box-shadow: 0 20px 60px var(--card-shadow); padding: 48px; margin-bottom: 32px;
    }
    .userinfo-title { font-size: 36px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
    .userinfo-subtitle { font-size: 18px; color: var(--text-muted); margin-bottom: 32px; }
    .section { margin-bottom: 32px; }
    .section-title {
      font-size: 20px; font-weight: 600; color: var(--text-primary); margin-bottom: 16px;
      padding-bottom: 8px; border-bottom: 2px solid var(--border-color);
    }
    .info-grid { display: grid; gap: 16px; }
    .info-item {
      background: var(--bg-secondary); border-radius: 8px; padding: 16px;
      display: flex; justify-content: space-between; align-items: center;
    }
    .info-label { color: var(--text-muted); font-size: 14px; font-weight: 600; }
    .info-value { color: var(--text-secondary); font-size: 14px; font-weight: 500; }
    .info-value-mono { color: var(--text-secondary); font-size: 14px; font-weight: 500; font-family: 'Monaco', 'Courier New', monospace; }
    .back-btn {
      background: var(--accent-color); color: white; border: none; border-radius: 8px;
      padding: 12px 24px; font-size: 14px; font-weight: 600; cursor: pointer;
      margin-top: 24px; text-decoration: none; display: inline-block;
    }
    .back-btn:hover { background: var(--accent-hover); }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="navbar-brand">
      <span>🔐</span>
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
          <a href="/welcome" class="dropdown-item">🏠 ホーム</a>
          <a href="/aichat" class="dropdown-item">🤖 AI チャット</a>
          <a href="/repositories" class="dropdown-item">📦 リポジトリ</a>
          <a href="/settings" class="dropdown-item">⚙️ 設定</a>
          <a href="/status" class="dropdown-item">📊 キャッシュ状況</a>
          <a href="/auth/switch" class="dropdown-item switch-account">🔄 別アカウントでログイン</a>
          <a href="/auth/logout" class="dropdown-item logout">🚪 ログアウト</a>
        </div>
      </div>
    </div>
  </nav>

  <div class="container">
    <div class="userinfo-card">
      <h1 class="userinfo-title">👤 ユーザー情報</h1>
      <p class="userinfo-subtitle">GitHubアカウントの情報</p>

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
          ${githubIdStr ? `
          <div class="info-item">
            <span class="info-label">GitHub User ID</span>
            <span class="info-value-mono">${githubIdStr}</span>
          </div>` : ''}
        </div>
      </div>

      <a href="/welcome" class="back-btn">← ホームに戻る</a>
    </div>
  </div>

  <script>
    ${getThemeToggleScript()}

    function toggleDropdown() {
      document.getElementById('dropdownMenu').classList.toggle('show');
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
