import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

const SAMPLE_BEFORE = `{
  "service": "api",
  "replicas": 2,
  "features": { "audit": false, "search": true },
  "regions": ["nrt", "sin"]
}`;

const SAMPLE_AFTER = `{
  "regions": ["nrt", "sin", "fra"],
  "features": { "search": true, "audit": true },
  "replicas": 3,
  "service": "api"
}`;

export function getJsonStructuralDiffPage(username: string): string {
  const safeUsername = escapeHtml(username);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JSON構造差分 - gron × go-diff</title>
  ${getThemeInitScript()}
  <style>
    ${getThemeCSS()}
    ${getThemeToggleCSS()}
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: linear-gradient(135deg, var(--bg-gradient-start), var(--bg-gradient-end)); }
    .navbar { padding: 16px 32px; display: flex; align-items: center; justify-content: space-between; background: var(--navbar-bg); box-shadow: 0 2px 10px var(--navbar-shadow); }
    .brand { color: var(--text-primary); font-size: 20px; font-weight: 700; }
    .user { display: flex; align-items: center; gap: 12px; color: var(--text-secondary); font-size: 14px; }
    .home { color: var(--text-secondary); text-decoration: none; }
    .container { max-width: 1240px; margin: 0 auto; padding: 32px 20px; }
    .card { padding: 30px; border-radius: 16px; background: var(--card-bg); box-shadow: 0 10px 30px rgba(0,0,0,.15); }
    h1 { margin: 0 0 8px; color: var(--text-primary); font-size: 24px; }
    .lead { margin: 0 0 20px; color: var(--text-muted); line-height: 1.6; font-size: 14px; }
    .pipeline { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 20px; color: var(--text-secondary); font-size: 13px; }
    .step { padding: 7px 10px; border: 1px solid var(--border-color); border-radius: 999px; background: var(--bg-secondary); }
    .status { display: inline-block; margin-bottom: 18px; padding: 7px 11px; border-radius: 7px; color: var(--text-muted); background: var(--bg-secondary); font-size: 12px; }
    .status.ready { color: #166534; background: #dcfce7; }
    .status.error { color: #991b1b; background: #fee2e2; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    label { display: block; margin-bottom: 7px; color: var(--text-primary); font-size: 13px; font-weight: 700; }
    textarea { width: 100%; min-height: 235px; padding: 13px; resize: vertical; border: 1px solid var(--border-color); border-radius: 9px; color: var(--text-primary); background: var(--bg-secondary); font: 13px/1.55 Monaco, 'Courier New', monospace; }
    .actions { display: flex; gap: 12px; align-items: center; margin: 18px 0; }
    button { padding: 11px 20px; border: 0; border-radius: 8px; color: white; background: #667eea; font-weight: 700; cursor: pointer; }
    button:disabled { opacity: .5; cursor: not-allowed; }
    .live { color: var(--text-muted); font-size: 12px; }
    .result-title { margin-bottom: 7px; color: var(--text-primary); font-size: 13px; font-weight: 700; }
    pre { min-height: 190px; margin: 0; padding: 14px; overflow: auto; border: 1px solid var(--border-color); border-radius: 9px; color: var(--text-secondary); background: var(--bg-secondary); font: 13px/1.55 Monaco, 'Courier New', monospace; white-space: pre-wrap; }
    pre.error { color: #991b1b; }
    @media (max-width: 760px) { .navbar { padding: 14px 18px; } .username { display: none; } .card { padding: 22px 18px; } .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="brand">🧬 JSON構造差分</div>
    <div class="user">${getThemeToggleHTML()}<span class="username">${safeUsername}</span><a class="home" href="/welcome">ホーム</a></div>
  </nav>
  <main class="container">
    <section class="card">
      <h1>gron × go-diff</h1>
      <p class="lead">JSONをgronの代入文へ展開してからgo-diffで比較します。オブジェクトのキー順や整形の違いを無視し、値・配列・プロパティの構造的な変更を見つけられます。</p>
      <div class="pipeline" aria-label="処理の流れ"><span class="step">JSON A / B</span><span>→</span><span class="step">gronで正規化</span><span>→</span><span class="step">go-diffで比較</span></div>
      <div class="status" id="wasmStatus">2つのWASMモジュールを読み込み中…</div>
      <div class="grid">
        <div><label for="beforeJson">変更前 JSON</label><textarea id="beforeJson" spellcheck="false">${escapeHtml(SAMPLE_BEFORE)}</textarea></div>
        <div><label for="afterJson">変更後 JSON</label><textarea id="afterJson" spellcheck="false">${escapeHtml(SAMPLE_AFTER)}</textarea></div>
      </div>
      <div class="actions"><button id="compareBtn" disabled>構造を比較</button><span class="live" id="liveState" aria-live="polite">WASMの準備待ち</span></div>
      <div class="result-title">構造差分（gron形式）</div>
      <pre id="result" aria-live="polite">読み込み完了後に自動で比較します。</pre>
    </section>
  </main>
  <script type="module">
    ${getThemeToggleScript()}
    var status = document.getElementById('wasmStatus');
    var before = document.getElementById('beforeJson');
    var after = document.getElementById('afterJson');
    var button = document.getElementById('compareBtn');
    var result = document.getElementById('result');
    var live = document.getElementById('liveState');
    var timer = 0;

    function compare() {
      if (typeof window.gronToGron !== 'function' || typeof window.goDiffText !== 'function') return;
      window.clearTimeout(timer);
      live.textContent = '比較中…';
      try {
        var left = window.gronToGron(before.value);
        var right = window.gronToGron(after.value);
        if (left.indexOf('ERROR: ') === 0) throw new Error('変更前JSON: ' + left.slice(7));
        if (right.indexOf('ERROR: ') === 0) throw new Error('変更後JSON: ' + right.slice(7));
        result.textContent = window.goDiffText(left, right);
        result.className = '';
        live.textContent = '比較済み';
      } catch (err) {
        result.textContent = err && err.message ? err.message : String(err);
        result.className = 'error';
        live.textContent = '入力エラー';
      }
    }

    async function loadGoWasm(glue, binary) {
      await import(glue);
      var runtime = new Go();
      var module = await WebAssembly.instantiateStreaming(fetch(binary), runtime.importObject);
      runtime.run(module.instance);
    }

    (async function () {
      try {
        await loadGoWasm('/wasm/gron-wasm_exec.js', '/wasm/gron.wasm');
        await loadGoWasm('/wasm/go-diff-wasm_exec.js', '/wasm/go-diff.wasm');
        status.textContent = 'gron / go-diff WASM 読み込み完了';
        status.className = 'status ready';
        button.disabled = false;
        compare();
      } catch (err) {
        status.textContent = 'WASMの読み込みに失敗しました: ' + (err && err.message ? err.message : String(err));
        status.className = 'status error';
        live.textContent = 'WASMを利用できません';
      }
    })();

    [before, after].forEach(function (input) {
      input.addEventListener('input', function () {
        window.clearTimeout(timer);
        live.textContent = '入力待ち…';
        timer = window.setTimeout(compare, 300);
      });
      input.addEventListener('keydown', function (event) {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); compare(); }
      });
    });
    button.addEventListener('click', compare);
  </script>
</body>
</html>`;
}
