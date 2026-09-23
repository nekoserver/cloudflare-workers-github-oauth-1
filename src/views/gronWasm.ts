import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

const SAMPLE_JSON = `{
  "name": "neko",
  "active": true,
  "tags": ["worker", "oauth"],
  "nested": { "id": 1 }
}`;

export function getGronWasmPage(username: string): string {
  const safeUsername = escapeHtml(username);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>gron / ungron (WASM) - Cloudflare Workers GitHub OAuth</title>
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
    .container { max-width: 1200px; margin: 0 auto; padding: 32px 20px; }
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
    .mode-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
    .mode-tab {
      background: var(--bg-secondary);
      color: var(--text-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .mode-tab.active { background: #667eea; color: white; border-color: #667eea; }
    .editor-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; }
    .editor-pane { min-width: 0; }
    .pane-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
    .pane-title { color: var(--text-primary); font-size: 13px; font-weight: 700; }
    .live-state { color: var(--text-muted); font-size: 12px; }
    textarea {
      width: 100%;
      min-height: 260px;
      padding: 12px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: var(--bg-secondary);
      color: var(--text-primary);
      font-size: 13px;
      font-family: 'Monaco', 'Courier New', monospace;
      margin-bottom: 12px;
      resize: vertical;
    }
    .hint { font-size: 12px; color: var(--text-muted); margin: -10px 0 16px; }
    .parse-btn {
      background: #667eea;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 12px 24px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .parse-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .parse-btn:hover:not(:disabled) { background: #5568d3; }
    .result-label { font-size: 12px; color: var(--text-muted); margin-bottom: 6px; }
    .result-value {
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 13px;
      white-space: pre-wrap;
      word-break: break-word;
      background: var(--bg-secondary);
      color: var(--text-secondary);
      padding: 12px;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      min-height: 260px;
    }
    .result-value.error { color: #991b1b; }
    @media (max-width: 760px) {
      .navbar { padding: 14px 18px; }
      .user-name { display: none; }
      .card { padding: 22px 18px; }
      .editor-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="navbar-brand">
      <span>🌱</span>
      <span>gron / ungron (WASM)</span>
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
      <div class="title">gron / ungron (WASM)</div>
      <div class="subtitle">gron(https://github.com/tomnomnom/gron)のJSON⇔代入文変換ロジックをGo実装(js/wasmビルド)でブラウザ上のWebAssemblyで実行します。HTTPリクエスト実行・ファイル監視・カラー出力は含まれません。</div>
      <div class="wasm-status loading" id="wasmStatus">WASMモジュールを読み込み中…</div>
      <div class="mode-tabs">
        <button class="mode-tab active" id="modeGron" type="button">JSON → gron</button>
        <button class="mode-tab" id="modeUngron" type="button">gron → JSON</button>
      </div>
      <div class="editor-grid">
        <div class="editor-pane">
          <div class="pane-heading">
            <span class="pane-title" id="inputLabel">JSON</span>
            <span class="live-state" id="liveState" aria-live="polite">WASMの準備待ち</span>
          </div>
          <textarea id="inputText" spellcheck="false" aria-label="入力">${escapeHtml(SAMPLE_JSON)}</textarea>
          <div class="hint">入力から250ms後に自動変換します。</div>
          <button class="parse-btn" id="parseBtn" disabled>今すぐ変換 <span aria-hidden="true">⌘↵</span></button>
        </div>
        <div class="editor-pane">
          <div class="pane-heading">
            <span class="pane-title" id="outputLabel">結果 (gron)</span>
          </div>
          <div class="result-value" id="resultValue" aria-live="polite">WASMモジュールの読み込み後、ここに結果が表示されます。</div>
        </div>
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
    var parseBtn = document.getElementById('parseBtn');
    var inputText = document.getElementById('inputText');
    var resultValue = document.getElementById('resultValue');
    var liveState = document.getElementById('liveState');
    var inputLabel = document.getElementById('inputLabel');
    var outputLabel = document.getElementById('outputLabel');
    var modeGronBtn = document.getElementById('modeGron');
    var modeUngronBtn = document.getElementById('modeUngron');
    var parseTimer = 0;
    var mode = 'gron'; // 'gron' = JSON -> gron, 'ungron' = gron -> JSON

    var SAMPLE_JSON = ${JSON.stringify(SAMPLE_JSON)};
    var SAMPLE_GRON = [
      'json = {};',
      'json.active = true;',
      'json.name = "neko";',
      'json.nested = {};',
      'json.nested.id = 1;',
      'json.tags = [];',
      'json.tags[0] = "worker";',
      'json.tags[1] = "oauth";'
    ].join('\\n');

    function setMode(next) {
      if (mode === next) return;
      mode = next;
      modeGronBtn.classList.toggle('active', mode === 'gron');
      modeUngronBtn.classList.toggle('active', mode === 'ungron');
      if (mode === 'gron') {
        inputLabel.textContent = 'JSON';
        outputLabel.textContent = '結果 (gron)';
        inputText.value = SAMPLE_JSON;
      } else {
        inputLabel.textContent = 'gron';
        outputLabel.textContent = '結果 (JSON)';
        inputText.value = SAMPLE_GRON;
      }
      parseInput();
    }
    modeGronBtn.addEventListener('click', function () { setMode('gron'); });
    modeUngronBtn.addEventListener('click', function () { setMode('ungron'); });

    function parseInput() {
      var fn = mode === 'gron' ? window.gronToGron : window.gronFromGron;
      if (typeof fn !== 'function') return;
      window.clearTimeout(parseTimer);
      liveState.textContent = '変換中…';
      try {
        var out = fn(inputText.value);
        if (typeof out === 'string' && out.indexOf('ERROR: ') === 0) {
          resultValue.textContent = out;
          resultValue.className = 'result-value error';
        } else {
          resultValue.textContent = out;
          resultValue.className = 'result-value';
        }
        liveState.textContent = '変換済み';
      } catch (err) {
        resultValue.textContent = (err && err.message) ? err.message : String(err);
        resultValue.className = 'result-value error';
        liveState.textContent = '変換エラー';
      }
    }

    (async function () {
      try {
        await import('/wasm/gron-wasm_exec.js');
        var go = new Go();
        var result = await WebAssembly.instantiateStreaming(fetch('/wasm/gron.wasm'), go.importObject);
        go.run(result.instance);
        wasmStatus.textContent = 'WASMモジュール読み込み完了';
        wasmStatus.className = 'wasm-status ready';
        parseBtn.disabled = false;
        parseInput();
      } catch (err) {
        wasmStatus.textContent = 'WASMモジュールの読み込みに失敗しました: ' + (err && err.message ? err.message : String(err));
        wasmStatus.className = 'wasm-status error';
        liveState.textContent = 'WASMを利用できません';
      }
    })();

    inputText.addEventListener('input', function() {
      window.clearTimeout(parseTimer);
      liveState.textContent = '入力待ち…';
      parseTimer = window.setTimeout(parseInput, 250);
    });
    inputText.addEventListener('keydown', function(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        parseInput();
      }
    });
    parseBtn.addEventListener('click', parseInput);
  </script>
</body>
</html>`;
}
