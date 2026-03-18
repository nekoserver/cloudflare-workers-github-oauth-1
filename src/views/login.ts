/**
 * GitHub OAuth ログインページのHTML
 */
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

export function getLoginPage(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ログイン - Cloudflare Workers GitHub OAuth</title>
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
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .container {
      background: var(--card-bg);
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 450px;
      width: 100%;
      padding: 48px 40px;
      text-align: center;
    }

    .logo {
      width: 80px;
      height: 80px;
      margin: 0 auto 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
    }

    h1 {
      color: var(--text-primary);
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 12px;
    }

    .subtitle {
      color: var(--text-muted);
      font-size: 16px;
      margin-bottom: 40px;
    }

    .github-btn {
      background: #24292e;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 16px 32px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      transition: all 0.3s ease;
      text-decoration: none;
    }

    .github-btn:hover {
      background: #1a1f24;
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
    }

    .github-btn:active {
      transform: translateY(0);
    }

    .github-icon {
      width: 24px;
      height: 24px;
    }

    .divider {
      margin: 32px 0;
      text-align: center;
      position: relative;
    }

    .divider::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      width: 100%;
      height: 1px;
      background: var(--border-color);
    }

    .divider span {
      background: var(--card-bg);
      padding: 0 16px;
      color: var(--text-faint);
      font-size: 14px;
      position: relative;
    }

    .api-info {
      background: var(--bg-secondary);
      border-radius: 8px;
      padding: 20px;
      text-align: left;
      margin-top: 24px;
    }

    .api-info h3 {
      color: var(--text-secondary);
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
    }

    .api-info code {
      background: var(--code-bg);
      color: var(--text-secondary);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 13px;
      font-family: 'Monaco', 'Courier New', monospace;
    }

    .api-info p {
      color: var(--text-secondary);
      font-size: 13px;
      line-height: 1.6;
      margin-bottom: 8px;
    }

    .api-info ul {
      list-style: none;
      margin-top: 8px;
    }

    .api-info li {
      color: var(--text-secondary);
      font-size: 13px;
      padding: 4px 0;
      padding-left: 20px;
      position: relative;
    }

    .api-info li::before {
      content: '→';
      position: absolute;
      left: 0;
      color: var(--accent-color);
    }
    .theme-toggle-fixed {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 100;
    }
  </style>
</head>
<body>
  <div class="theme-toggle-fixed">
    ${getThemeToggleHTML()}
  </div>
  <div class="container">
    <div class="logo">🔐</div>
    <h1>ようこそ</h1>
    <p class="subtitle">Cloudflare Workers GitHub OAuth</p>

    <a href="/auth/github" class="github-btn">
      <svg class="github-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
      </svg>
      GitHubアカウントでログイン
    </a>

    <div class="divider">
      <span>または</span>
    </div>

    <div class="api-info">
      <h3>API経由でアクセス</h3>
      <p>開発者向け：以下のAPIエンドポイントが利用可能です</p>
      <ul>
        <li><code>GET /auth/github</code> - GitHub OAuth開始</li>
        <li><code>GET /api/profile</code> - プロフィール取得</li>
        <li><code>GET /api/protected</code> - 保護リソース</li>
      </ul>
    </div>
  </div>

  <script>
    ${getThemeToggleScript()}
  </script>
</body>
</html>`;
}
