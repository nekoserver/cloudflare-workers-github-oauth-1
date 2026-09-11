import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

// 公式ビルド済みWASMパッケージ(CRuby WASI版)を使う。C言語のコード生成を
// 含むCRubyはこの環境ではwasm32-unknown-unknownへ自前ビルドできない
// (NOTICE.cloudflare-workers-github-oauth-1.rust-WASM.md 3節と同じ制約)。
// バイナリ本体(ruby+stdlib.wasm、約30MB)はリポジトリに含めず、公式npm
// パッケージ(@ruby/3.4-wasm-wasi)をjsDelivr CDN経由でブラウザから直接
// 読み込む。他のwasm/*-wasmクレートのように自前Rust実装+public/wasm配下の
// 静的配信ではない、この機能固有の構成であることに注意。
// dist/esm/browser.js は"@bjorn3/browser_wasi_shim"のようなbare specifier
// (パッケージ名のみのimport)を含んでおり、import mapを使わないブラウザの
// 素のESM importでは "does not resolve to a valid URL" エラーになる。
// jsDelivrの"+esm"サフィックスはパッケージ直下(例: pkg@version+esm)では
// 依存解決済みバンドルを返すが、dist/esm/browser.jsのような任意の
// サブパスに付けても効かず生ファイルがそのまま返ってくることを実機で確認した
// (2026-08-31、修正後も同じエラーが再現)。そのためesm.sh
// (bare specifierを解決済みURLへ自動的に書き換えてくれるCDN)に切り替える。
const RUBY_WASM_JS_URL = 'https://esm.sh/@ruby/wasm-wasi@2.10.1/dist/esm/browser.js';
const RUBY_WASM_BINARY_URL = 'https://cdn.jsdelivr.net/npm/@ruby/3.4-wasm-wasi@2.10.1/dist/ruby+stdlib.wasm';

export type RubyWasmVersionInfo = {
  /** @ruby/{X.Y}-wasm-wasi のビルドライン(パッケージのメジャー.マイナー)。
   *  実際のCRubyパッチバージョン(例: 3.4.2)はwasmバイナリ内部にしか無く、
   *  Worker側からは(ブラウザでWASMを実行しない限り)取得できないため、
   *  ここではパッケージ名に埋め込まれたビルドラインのみを返す。 */
  rubyBuildLine: string;
  /** @ruby/wasm-wasi (jsグルーコード)およびruby+stdlib.wasmパッケージのバージョン。 */
  wasmWasiPackageVersion: string;
};

/**
 * `@ruby/{X.Y}-wasm-wasi@{version}/dist/ruby+stdlib.wasm` 形式のURLから
 * ビルドライン・パッケージバージョンを取り出す純粋関数。
 * `/neko rubyver` スラッシュコマンドが表示する内容の元データになる。
 */
export function parseRubyWasmVersionInfo(binaryUrl: string): RubyWasmVersionInfo | null {
  const match = binaryUrl.match(/@ruby\/(\d+(?:\.\d+)*)-wasm-wasi@([^/]+)\//);
  if (!match) return null;
  return { rubyBuildLine: match[1], wasmWasiPackageVersion: match[2] };
}

/** このリポジトリの/ruby-wasmページが実際に読み込んでいるRuby/WASMのバージョン情報。 */
export function getRubyWasmVersionInfo(): RubyWasmVersionInfo {
  const info = parseRubyWasmVersionInfo(RUBY_WASM_BINARY_URL);
  if (!info) {
    throw new Error(`RUBY_WASM_BINARY_URLの形式が想定と異なります: ${RUBY_WASM_BINARY_URL}`);
  }
  return info;
}

export function getRubyWasmPage(username: string): string {
  const safeUsername = escapeHtml(username);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ruby (WASM) - Cloudflare Workers GitHub OAuth</title>
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
    .subtitle { font-size: 14px; color: var(--text-muted); margin-bottom: 12px; }
    .notice { font-size: 12px; color: var(--text-muted); margin-bottom: 20px; }
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
    textarea {
      width: 100%;
      min-height: 160px;
      padding: 12px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: var(--bg-secondary);
      color: var(--text-primary);
      font-size: 14px;
      font-family: 'Monaco', 'Courier New', monospace;
      resize: vertical;
      margin-bottom: 16px;
    }
    .run-btn {
      background: #667eea;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 12px 24px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .run-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .run-btn:hover:not(:disabled) { background: #5568d3; }
    .result-block { margin-top: 20px; }
    .result-label { font-size: 12px; color: var(--text-muted); margin-bottom: 6px; }
    .result-value {
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 13px;
      white-space: pre-wrap;
      word-break: break-all;
      background: var(--bg-secondary);
      color: var(--text-secondary);
      padding: 12px;
      border-radius: 8px;
      border: 1px solid var(--border-color);
    }
    .result-value.error { color: #991b1b; }
    .theme-toggle-inline { display: flex; align-items: center; }
    .snippet-picker { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .snippet-picker select {
      flex: 1; min-width: 200px;
      background: var(--bg-secondary); color: var(--text-primary);
      border: 1px solid var(--border-color); border-radius: 6px;
      padding: 8px 10px; font-size: 13px;
    }
    .snippet-picker button {
      background: var(--bg-secondary); color: var(--text-primary);
      border: 1px solid var(--border-color); border-radius: 6px;
      padding: 8px 14px; font-size: 13px; cursor: pointer;
    }
    .snippet-picker button:disabled { opacity: 0.5; cursor: not-allowed; }
    .snippet-note { font-size: 11px; color: var(--text-muted); margin: -6px 0 14px; }
    .verify-row { display: flex; align-items: center; gap: 8px; margin-top: 10px; font-size: 12px; color: var(--text-secondary); flex-wrap: wrap; }
    .verify-row button {
      background: var(--bg-secondary); color: var(--text-primary);
      border: 1px solid var(--border-color); border-radius: 6px;
      padding: 5px 10px; font-size: 12px; cursor: pointer;
    }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="navbar-brand">
      <span>💎</span>
      <span>Ruby (WASM)</span>
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
      <div class="title">Ruby コード実行 (WASM)</div>
      <div class="subtitle">CRubyの公式WASM(WASI)ビルドをブラウザ上のWebAssemblyで実行します。</div>
      <div class="notice">初回読み込みはRuby本体(約30MB、jsDelivr CDN配信)を取得するため数秒〜数十秒かかります。</div>
      <div class="wasm-status loading" id="wasmStatus">WASMモジュールを読み込み中…</div>
      <div class="snippet-picker">
        <select id="snippetSelect"><option value="">保存済みコードを読み込む…</option></select>
        <button type="button" id="snippetLoadBtn" disabled>読み込む</button>
        <button type="button" id="snippetReloadBtn">🔄</button>
      </div>
      <div class="snippet-note" id="snippetNote">/kimi-code ページの「コードを保管」ボタンで保存したRubyコードをここから呼び出せます</div>
      <textarea id="inputCode" placeholder="puts 'hello world'">puts 'hello world'</textarea>
      <button class="run-btn" id="runBtn" disabled>Rubyコードを実行</button>
      <div class="result-block" id="resultBlock" style="display:none;">
        <div class="result-label">実行結果</div>
        <div class="result-value" id="resultValue"></div>
        <div class="verify-row" id="verifyRow" style="display:none;">
          <span>保存済みコードの動作確認を記録:</span>
          <button type="button" id="verifyOkBtn">👍 動いた</button>
          <button type="button" id="verifyNgBtn">👎 動かなかった</button>
          <span id="verifyNote"></span>
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
    var runBtn = document.getElementById('runBtn');
    var inputCode = document.getElementById('inputCode');
    var resultBlock = document.getElementById('resultBlock');
    var resultValue = document.getElementById('resultValue');
    var rubyVM = null;

    var snippetSelect = document.getElementById('snippetSelect');
    var snippetLoadBtn = document.getElementById('snippetLoadBtn');
    var snippetReloadBtn = document.getElementById('snippetReloadBtn');
    var snippetNote = document.getElementById('snippetNote');
    var snippetNoteDefault = snippetNote.textContent;
    var verifyRow = document.getElementById('verifyRow');
    var verifyOkBtn = document.getElementById('verifyOkBtn');
    var verifyNgBtn = document.getElementById('verifyNgBtn');
    var verifyNote = document.getElementById('verifyNote');
    // 読み込んだ保存済みスニペットのid。コードを手動編集したら、実行結果が
    // もう「保存されたコードそのもの」の動作確認ではなくなるためクリアする。
    var loadedSnippetId = null;
    inputCode.addEventListener('input', function() {
      loadedSnippetId = null;
      verifyRow.style.display = 'none';
    });

    function loadSnippetList() {
      snippetSelect.innerHTML = '<option value="">読み込み中…</option>';
      snippetSelect.disabled = true;
      snippetLoadBtn.disabled = true;
      fetch('/api/ruby-wasm/snippets', { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          var snippets = (d && d.snippets) || [];
          snippetSelect.innerHTML = '';
          var placeholder = document.createElement('option');
          placeholder.value = '';
          placeholder.textContent = snippets.length === 0
            ? '保存済みコードはありません'
            : '保存済みコードを読み込む…';
          snippetSelect.appendChild(placeholder);
          snippets.forEach(function(s) {
            var opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.title + '(' + s.created_at + ')';
            snippetSelect.appendChild(opt);
          });
          snippetSelect.disabled = false;
        })
        .catch(function() {
          snippetSelect.innerHTML = '<option value="">一覧の取得に失敗しました</option>';
        });
    }

    snippetSelect.addEventListener('change', function() {
      snippetLoadBtn.disabled = !snippetSelect.value;
    });

    snippetLoadBtn.addEventListener('click', function() {
      var id = snippetSelect.value;
      if (!id) return;
      snippetNote.textContent = '読み込み中…';
      snippetLoadBtn.disabled = true;
      fetch('/api/ruby-wasm/snippets/' + encodeURIComponent(id), { credentials: 'same-origin' })
        .then(function(r) { return r.json().then(function(d) { return { status: r.status, data: d }; }); })
        .then(function(res) {
          if (res.status === 200 && res.data && typeof res.data.code === 'string') {
            inputCode.value = res.data.code;
            loadedSnippetId = res.data.id;
            verifyRow.style.display = 'none';
            snippetNote.textContent = '✅ 「' + res.data.title + '」を読み込みました';
          } else {
            snippetNote.textContent = '❌ 読み込みに失敗しました: ' + (res.data && res.data.error ? res.data.error : 'HTTP ' + res.status);
          }
        })
        .catch(function(err) {
          snippetNote.textContent = '❌ 通信エラー: ' + ((err && err.message) || '不明');
        })
        .then(function() {
          snippetLoadBtn.disabled = !snippetSelect.value;
          setTimeout(function() { snippetNote.textContent = snippetNoteDefault; }, 4000);
        });
    });

    snippetReloadBtn.addEventListener('click', loadSnippetList);
    loadSnippetList();

    import('${RUBY_WASM_JS_URL}').then(function(mod) {
      return fetch('${RUBY_WASM_BINARY_URL}').then(function(res) {
        if (!res.ok) throw new Error('Rubyバイナリの取得に失敗しました: HTTP ' + res.status);
        return WebAssembly.compileStreaming(res);
      }).then(function(compiled) {
        return mod.DefaultRubyVM(compiled, { consolePrint: false });
      }).then(function(result) {
        rubyVM = result.vm;
        wasmStatus.textContent = 'WASMモジュール読み込み完了';
        wasmStatus.className = 'wasm-status ready';
        runBtn.disabled = false;
      });
    }).catch(function(err) {
      wasmStatus.textContent = 'WASMモジュールの読み込みに失敗しました: ' + (err && err.message ? err.message : String(err));
      wasmStatus.className = 'wasm-status error';
    });

    runBtn.addEventListener('click', function() {
      if (!rubyVM) return;
      resultBlock.style.display = 'block';
      resultValue.classList.remove('error');
      try {
        var wrapped =
          "require 'stringio'\\n" +
          "__out = StringIO.new\\n" +
          "__orig_stdout = $stdout\\n" +
          "$stdout = __out\\n" +
          "begin\\n" +
          inputCode.value + "\\n" +
          "ensure\\n" +
          "  $stdout = __orig_stdout\\n" +
          "end\\n" +
          "__out.string";
        var output = rubyVM.eval(wrapped).toString();
        resultValue.textContent = output.length > 0 ? output : '(出力なし)';
      } catch (err) {
        resultValue.classList.add('error');
        resultValue.textContent = err && err.message ? err.message : String(err);
      }
      if (loadedSnippetId) {
        verifyNote.textContent = '';
        verifyRow.style.display = 'flex';
      } else {
        verifyRow.style.display = 'none';
      }
    });

    function recordVerification(verified) {
      if (!loadedSnippetId) return;
      verifyOkBtn.disabled = true;
      verifyNgBtn.disabled = true;
      verifyNote.textContent = '記録中...';
      fetch('/api/ruby-wasm/snippets/' + encodeURIComponent(loadedSnippetId) + '/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ verified: verified })
      })
        .then(function(r) { return r.json().then(function(d) { return { status: r.status, data: d }; }); })
        .then(function(res) {
          if (res.status === 200) {
            verifyNote.textContent = '✅ Ruby ' + res.data.rubyVersion + ' 系で' + (verified ? '動作した' : '動作しなかった') + '記録を保存しました';
          } else {
            verifyNote.textContent = '❌ ' + (res.data && res.data.error ? res.data.error : 'HTTP ' + res.status);
          }
        })
        .catch(function(err) {
          verifyNote.textContent = '❌ 通信エラー: ' + ((err && err.message) || '不明');
        })
        .then(function() {
          verifyOkBtn.disabled = false;
          verifyNgBtn.disabled = false;
        });
    }

    verifyOkBtn.addEventListener('click', function() { recordVerification(true); });
    verifyNgBtn.addEventListener('click', function() { recordVerification(false); });
  </script>
</body>
</html>`;
}
