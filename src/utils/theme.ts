/**
 * ダークモード / ライトモード テーマ共通ユーティリティ
 *
 * 全ページで統一的にテーマを切り替えるための CSS 変数定義、
 * トグルボタン HTML、初期化スクリプトを提供する。
 *
 * テーマ状態は Cookie `user_theme` に保存される（非 HttpOnly）。
 */

/**
 * <head> 内で最初に挿入する CSS 変数定義。
 * data-theme="dark" 時にダークモード色に切り替わる。
 */
export function getThemeCSS(): string {
  return `
    :root {
      --bg-primary: #f8fafc;
      --bg-gradient-start: #667eea;
      --bg-gradient-end: #764ba2;
      --navbar-bg: rgba(255, 255, 255, 0.95);
      --navbar-shadow: rgba(0, 0, 0, 0.1);
      --card-bg: #ffffff;
      --card-shadow: rgba(0, 0, 0, 0.3);
      --card-shadow-light: rgba(0, 0, 0, 0.2);
      --text-primary: #1a202c;
      --text-secondary: #2d3748;
      --text-muted: #718096;
      --text-faint: #a0aec0;
      --bg-secondary: #f7fafc;
      --border-color: #e2e8f0;
      --border-light: #edf2f7;
      --input-bg: #ffffff;
      --input-border: #cbd5e0;
      --dropdown-bg: #ffffff;
      --dropdown-hover: #f7fafc;
      --badge-bg: #edf2f7;
      --success-color: #48bb78;
      --danger-color: #e53e3e;
      --accent-color: #667eea;
      --accent-hover: #5a67d8;
      --code-bg: #edf2f7;
      --modal-overlay: rgba(0, 0, 0, 0.5);
      --chart-bar-bg: #edf2f7;
    }

    [data-theme="dark"] {
      --bg-primary: #111827;
      --bg-gradient-start: #1a1a2e;
      --bg-gradient-end: #16213e;
      --navbar-bg: rgba(26, 32, 44, 0.95);
      --navbar-shadow: rgba(0, 0, 0, 0.3);
      --card-bg: #2d3748;
      --card-shadow: rgba(0, 0, 0, 0.5);
      --card-shadow-light: rgba(0, 0, 0, 0.4);
      --text-primary: #e2e8f0;
      --text-secondary: #cbd5e0;
      --text-muted: #a0aec0;
      --text-faint: #718096;
      --bg-secondary: #1a202c;
      --border-color: #4a5568;
      --border-light: #2d3748;
      --input-bg: #1a202c;
      --input-border: #4a5568;
      --dropdown-bg: #2d3748;
      --dropdown-hover: #4a5568;
      --badge-bg: #4a5568;
      --success-color: #48bb78;
      --danger-color: #fc8181;
      --accent-color: #7f9cf5;
      --accent-hover: #667eea;
      --code-bg: #1a202c;
      --modal-overlay: rgba(0, 0, 0, 0.7);
      --chart-bar-bg: #4a5568;
    }
  `;
}

/**
 * ページ描画前にテーマを適用する <script>。
 * Cookie から user_theme を読み取り、<html> に data-theme を設定する。
 * FOUC（Flash of Unstyled Content）を防ぐため <head> 内で実行する。
 */
export function getThemeInitScript(): string {
  return `<script>
(function(){
  var m = document.cookie.match(/(?:^|;\\s*)user_theme=([^;]*)/);
  var theme = m ? m[1] : 'dark';
  if (theme !== 'light') document.documentElement.setAttribute('data-theme', 'dark');
})();
</script>`;
}

/**
 * ナビバーに配置するテーマトグルボタンの HTML。
 * user-menu の左側（user-name の前）に挿入する想定。
 */
export function getThemeToggleHTML(): string {
  return `<button class="theme-toggle" onclick="toggleTheme()" title="テーマ切替" aria-label="テーマ切替">
      <svg class="theme-icon theme-icon-light" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
      <svg class="theme-icon theme-icon-dark" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
      </svg>
    </button>`;
}

/**
 * テーマトグルボタンのスタイル CSS。
 * 各ページの <style> ブロック内にインクルードする。
 */
export function getThemeToggleCSS(): string {
  return `
    .theme-toggle {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--text-muted);
      transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
      flex-shrink: 0;
    }
    .theme-toggle:hover {
      background: var(--border-color);
      color: var(--text-primary);
    }
    /* ライトモード: 月アイコン表示、太陽非表示 */
    .theme-icon-dark { display: none; }
    [data-theme="dark"] .theme-icon-light { display: none; }
    [data-theme="dark"] .theme-icon-dark { display: block; }
  `;
}

/**
 * テーマ切替の JavaScript。
 * 各ページの </body> 前のスクリプトブロック内にインクルードする。
 */
export function getThemeToggleScript(): string {
  return `
    function toggleTheme() {
      var html = document.documentElement;
      var isDark = html.getAttribute('data-theme') === 'dark';
      var newTheme = isDark ? 'light' : 'dark';
      if (newTheme === 'dark') {
        html.setAttribute('data-theme', 'dark');
      } else {
        html.removeAttribute('data-theme');
      }
      document.cookie = 'user_theme=' + newTheme + '; Path=/; Secure; SameSite=Lax; Max-Age=31536000';
      fetch('/api/settings/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ theme: newTheme })
      }).catch(function(){});
    }
  `;
}
