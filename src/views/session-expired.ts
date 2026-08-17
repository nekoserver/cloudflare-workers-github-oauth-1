/**
 * セッション期限切れページのHTML
 */
import { getThemeCSS, getThemeInitScript } from '../utils/theme';
import { validateReturnTo } from '../utils/returnTo';

export function getSessionExpiredPage(returnTo?: string | null): string {
  const validReturnTo = validateReturnTo(returnTo);
  const loginHref = validReturnTo ? `/?return_to=${encodeURIComponent(validReturnTo)}` : '/';
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>セッション期限切れ</title>
  ${getThemeInitScript()}
  <style>
    ${getThemeCSS()}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%);
      min-height: 100vh;
    }
    .toast {
      position: fixed;
      top: 20px;
      left: 20px;
      background: #FF8FAB;
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      display: flex;
      align-items: center;
      gap: 16px;
      z-index: 9999;
      max-width: 520px;
      font-size: 14px;
      font-weight: 500;
    }
    .toast-message {
      flex: 1;
    }
    .toast-btn {
      background: white;
      color: #FF8FAB;
      border: none;
      border-radius: 6px;
      padding: 8px 16px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .toast-btn:hover {
      background: #f0f0f0;
    }
  </style>
</head>
<body>
  <div class="toast" id="sessionToast">
    <span class="toast-message">セッションが期限切れなので再ログインしてください</span>
    <button class="toast-btn" onclick="redirectToLogin()">了解</button>
  </div>
  <script>
    function redirectToLogin() {
      window.location.href = ${JSON.stringify(loginHref)};
    }
    setTimeout(redirectToLogin, 10000);
  </script>
</body>
</html>`;
}
