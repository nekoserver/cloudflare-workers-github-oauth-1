import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

export function getFactorWasmPage(username: string): string {
  const safeUsername = escapeHtml(username);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>factor (WASM) - Cloudflare Workers GitHub OAuth</title>
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
    .container { max-width: 720px; margin: 0 auto; padding: 32px 20px; }
    .card {
      background: var(--card-bg);
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
      padding: 32px;
    }
    .title { font-size: 22px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
    .subtitle { font-size: 14px; color: var(--text-muted); margin-bottom: 24px; }
    .wasm-status {
      font-size: 12px;
      padding: 6px 12px;
      border-radius: 6px;
      margin-bottom: 20px;
      display: inline-block;
    }
    .wasm-status.loading { background: var(--bg-secondary); color: var(--text-muted); }
    .wasm-status.ready { background: #dcfce7; color: #166534; }
    .wasm-status.error { background: #fee2e2; color: #991b1b; }
    input[type="text"] {
      width: 100%;
      padding: 12px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: var(--bg-secondary);
      color: var(--text-primary);
      font-size: 14px;
      font-family: 'Monaco', 'Courier New', monospace;
      margin-bottom: 16px;
    }
    .hint { font-size: 12px; color: var(--text-muted); margin: -10px 0 16px; }
    .hash-btn {
      background: #667eea;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 12px 24px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .hash-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .hash-btn:hover:not(:disabled) { background: #5568d3; }
    .result-block { margin-top: 20px; }
    .result-label { font-size: 12px; color: var(--text-muted); margin-bottom: 6px; }
    .result-value {
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 13px;
      word-break: break-all;
      background: var(--bg-secondary);
      color: var(--text-secondary);
      padding: 12px;
      border-radius: 8px;
      border: 1px solid var(--border-color);
    }
    .result-value.error { color: #991b1b; }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="navbar-brand">
      <span>🔢</span>
      <span>factor (WASM)</span>
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
    <div class="card">
      <div class="title">素因数分解 (WASM)</div>
      <div class="subtitle">GNU coreutilsのfactorコマンドを模したRust実装をwasm-bindgenでビルドし、ブラウザ上のWebAssemblyで実行します。</div>
      <div class="wasm-status loading" id="wasmStatus">WASMモジュールを読み込み中…</div>
      <input type="text" id="inputNumber" placeholder="0以上2^53以下の整数を入力してください" inputmode="numeric">
      <div class="hint">対応範囲: 0 〜 9007199254740992 (2<sup>53</sup>)</div>
      <button class="hash-btn" id="factorBtn" disabled>素因数分解する</button>
      <div class="result-block" id="resultBlock" style="display:none;">
        <div class="result-label">結果</div>
        <div class="result-value" id="resultValue"></div>
      </div>
    </div>
  </div>

  <script type="module">
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

    var wasmStatus = document.getElementById('wasmStatus');
    var factorBtn = document.getElementById('factorBtn');
    var inputNumber = document.getElementById('inputNumber');
    var resultBlock = document.getElementById('resultBlock');
    var resultValue = document.getElementById('resultValue');
    var factorFn = null;

    import('/wasm/factor.js').then(function(mod) {
      return mod.default('/wasm/factor_bg.wasm').then(function() {
        factorFn = mod.factor;
        wasmStatus.textContent = 'WASMモジュール読み込み完了';
        wasmStatus.className = 'wasm-status ready';
        factorBtn.disabled = false;
      });
    }).catch(function(err) {
      wasmStatus.textContent = 'WASMモジュールの読み込みに失敗しました: ' + (err && err.message ? err.message : String(err));
      wasmStatus.className = 'wasm-status error';
    });

    factorBtn.addEventListener('click', function() {
      if (!factorFn) return;
      var raw = inputNumber.value.trim();
      var n = Number(raw);
      resultBlock.style.display = 'block';
      if (raw === '' || !Number.isFinite(n)) {
        resultValue.textContent = '数値を入力してください';
        resultValue.className = 'result-value error';
        return;
      }
      try {
        var result = factorFn(n);
        resultValue.textContent = result;
        resultValue.className = 'result-value';
      } catch (err) {
        resultValue.textContent = (err && err.message) ? err.message : String(err);
        resultValue.className = 'result-value error';
      }
    });
  </script>
</body>
</html>`;
}
