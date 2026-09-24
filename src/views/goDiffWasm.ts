import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

const SAMPLE_A = `line one
line two
line three
`;
const SAMPLE_B = `line one
line two (edited)
line three
line four
`;

export function getGoDiffWasmPage(username: string): string {
  const safeUsername = escapeHtml(username);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>go-diff (WASM) - Cloudflare Workers GitHub OAuth</title>
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
    .editor-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; margin-bottom: 20px; }
    .editor-pane { min-width: 0; }
    .pane-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
    .pane-title { color: var(--text-primary); font-size: 13px; font-weight: 700; }
    .live-state { color: var(--text-muted); font-size: 12px; }
    textarea {
      width: 100%;
      min-height: 200px;
      padding: 12px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: var(--bg-secondary);
      color: var(--text-primary);
      font-size: 13px;
      font-family: 'Monaco', 'Courier New', monospace;
      resize: vertical;
    }
    .hint { font-size: 12px; color: var(--text-muted); margin: 12px 0 16px; }
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
    .result-label { font-size: 12px; color: var(--text-muted); margin: 20px 0 6px; }
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
      min-height: 160px;
    }
    .result-value.error { color: #991b1b; }
    /* 追加/削除行の色は「緑=追加, 赤=削除」という差分表示の普遍的な意味を
       持つ固定色(CLAUDE.CSS.mdの例外規定: バッジ等の意味的に色が固定される
       もの)。.wasm-status.ready/.error と同じ配色を再利用する。 */
    .diff-line { display: block; }
    .diff-line.diff-add { background: #dcfce7; color: #166534; }
    .diff-line.diff-del { background: #fee2e2; color: #991b1b; }
    .diff-line.diff-ctx { color: var(--text-secondary); }
    .diff-line.diff-meta { color: var(--text-muted); }
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
      <span>🔀</span>
      <span>go-diff (WASM)</span>
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
      <div class="title">go-diff (WASM)</div>
      <div class="subtitle">go-diff(https://github.com/sergi/go-diff、Googleのdiff-match-patchアルゴリズムのGo移植)をGo実装(js/wasmビルド)でブラウザ上のWebAssemblyで実行し、2つのテキストの行単位の差分を表示します。パッチ生成・適用機能は含まれません。</div>
      <div class="wasm-status loading" id="wasmStatus">WASMモジュールを読み込み中…</div>
      <div class="editor-grid">
        <div class="editor-pane">
          <div class="pane-heading">
            <span class="pane-title">テキストA</span>
          </div>
          <textarea id="inputA" spellcheck="false" aria-label="テキストA">${escapeHtml(SAMPLE_A)}</textarea>
        </div>
        <div class="editor-pane">
          <div class="pane-heading">
            <span class="pane-title">テキストB</span>
            <span class="live-state" id="liveState" aria-live="polite">WASMの準備待ち</span>
          </div>
          <textarea id="inputB" spellcheck="false" aria-label="テキストB">${escapeHtml(SAMPLE_B)}</textarea>
        </div>
      </div>
      <div class="hint">入力から250ms後に自動差分表示します。</div>
      <button class="parse-btn" id="parseBtn" disabled>今すぐ比較 <span aria-hidden="true">⌘↵</span></button>
      <div class="result-label">差分</div>
      <div class="result-value" id="resultValue" aria-live="polite">WASMモジュールの読み込み後、ここに結果が表示されます。</div>
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
    var inputA = document.getElementById('inputA');
    var inputB = document.getElementById('inputB');
    var resultValue = document.getElementById('resultValue');
    var liveState = document.getElementById('liveState');
    var parseTimer = 0;

    function escapeForHtml(s) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // go-diff-wasm(DiffText)の出力は「N行追加, M行削除」等のサマリ行、
    // diffフェンス、本体行("+ "=追加, "- "=削除, "  "=変更なし)からなる。
    // 行頭の接頭辞ごとに色分けし、変更点(追加/削除)と不変な行を見分けやすくする。
    function renderDiffOutput(out) {
      return out.split('\\n').map(function (line) {
        var cls = 'diff-meta';
        if (line.indexOf('+ ') === 0) cls = 'diff-add';
        else if (line.indexOf('- ') === 0) cls = 'diff-del';
        else if (line.indexOf('  ') === 0) cls = 'diff-ctx';
        return '<span class="diff-line ' + cls + '">' + escapeForHtml(line) + '</span>';
      }).join('\\n');
    }

    function parseInput() {
      if (typeof window.goDiffText !== 'function') return;
      window.clearTimeout(parseTimer);
      liveState.textContent = '比較中…';
      try {
        var out = window.goDiffText(inputA.value, inputB.value);
        if (typeof out === 'string' && out.indexOf('ERROR: ') === 0) {
          resultValue.textContent = out;
          resultValue.className = 'result-value error';
        } else {
          resultValue.innerHTML = renderDiffOutput(out);
          resultValue.className = 'result-value';
        }
        liveState.textContent = '比較済み';
      } catch (err) {
        resultValue.textContent = (err && err.message) ? err.message : String(err);
        resultValue.className = 'result-value error';
        liveState.textContent = '比較エラー';
      }
    }

    (async function () {
      try {
        await import('/wasm/go-diff-wasm_exec.js');
        var go = new Go();
        var result = await WebAssembly.instantiateStreaming(fetch('/wasm/go-diff.wasm'), go.importObject);
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

    [inputA, inputB].forEach(function (el) {
      el.addEventListener('input', function() {
        window.clearTimeout(parseTimer);
        liveState.textContent = '入力待ち…';
        parseTimer = window.setTimeout(parseInput, 250);
      });
      el.addEventListener('keydown', function(e) {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          parseInput();
        }
      });
    });
    parseBtn.addEventListener('click', parseInput);
  </script>
</body>
</html>`;
}
