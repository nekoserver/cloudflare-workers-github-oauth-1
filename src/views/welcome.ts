/**
 * ウェルカムページのHTML
 */
import { escapeHtml } from '../utils/html';

export function getWelcomePage(user: {
  name?: string;
  email?: string;
  username: string;
  avatar?: string;
  lastLoginAt?: string | null;
  showWelcomeMessage?: boolean;
}): string {
  const displayName = escapeHtml(user.name || user.username);
  const safeUsername = escapeHtml(user.username);
  const safeEmail = user.email ? escapeHtml(user.email) : null;
  const initials = escapeHtml((user.name || user.username).substring(0, 2).toUpperCase());

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome - Cloudflare Workers GitHub OAuth</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
        'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
    }

    .navbar {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      padding: 16px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .navbar-brand {
      font-size: 20px;
      font-weight: 700;
      color: #1a202c;
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
      color: #2d3748;
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
      background: white;
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
      color: #2d3748;
      text-decoration: none;
      display: block;
      transition: background 0.2s ease;
      cursor: pointer;
      border-bottom: 1px solid #e2e8f0;
    }

    .dropdown-item:last-child {
      border-bottom: none;
    }

    .dropdown-item:hover {
      background: #f7fafc;
    }

    .dropdown-item.logout {
      color: #e53e3e;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 48px 32px;
    }

    .welcome-card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      padding: 48px;
      margin-bottom: 32px;
    }

    .welcome-title {
      font-size: 36px;
      font-weight: 700;
      color: #1a202c;
      margin-bottom: 16px;
    }

    .welcome-subtitle {
      font-size: 18px;
      color: #718096;
      margin-bottom: 32px;
    }

    .user-info {
      background: #f7fafc;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 32px;
    }

    .user-info h3 {
      color: #2d3748;
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #e2e8f0;
    }

    .info-row:last-child {
      border-bottom: none;
    }

    .info-label {
      color: #718096;
      font-size: 14px;
      white-space: nowrap;
    }

    .info-value {
      color: #2d3748;
      font-size: 14px;
      font-weight: 500;
      white-space: nowrap;
    }

    .api-section {
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      padding: 32px;
    }

    .api-section h2 {
      color: #1a202c;
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 16px;
    }

    .api-endpoints {
      display: grid;
      gap: 12px;
    }

    .endpoint {
      background: #f7fafc;
      border-radius: 8px;
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .endpoint-method {
      background: #667eea;
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
      color: #2d3748;
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
      <span class="user-name">${displayName}</span>
      <div class="user-menu-container">
        <div class="user-icon" title="${displayName}" onclick="toggleDropdown()">
          ${initials}
        </div>
        <div class="dropdown-menu" id="dropdownMenu">
          <a href="/repositories" class="dropdown-item">📦 リポジトリ</a>
          <a href="/settings" class="dropdown-item">⚙️ 設定</a>
          <a href="/auth/logout" class="dropdown-item logout">🚪 ログアウト</a>
        </div>
      </div>
    </div>
  </nav>

  <div class="container">
    <div class="welcome-card">
      ${user.showWelcomeMessage ? `<h1 class="welcome-title">ようこそ、${displayName}さん！</h1>
      <p class="welcome-subtitle">ログインに成功しました</p>` : ''}

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
  </script>
</body>
</html>`;
}
