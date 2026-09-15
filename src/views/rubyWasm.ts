import { escapeHtml } from '../utils/html';
import { getRubyWasmLoaderScript, getRubyWasmPreloadTags, rubyWasmBinaryCacheName } from '../utils/rubyWasmLoader';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

// 公式ビルド済みWASMパッケージ(CRuby WASI版)を使う。C言語のコード生成を
// 含むCRubyはこの環境ではwasm32-unknown-unknownへ自前ビルドできない
// (NOTICE.cloudflare-workers-github-oauth-1.rust-WASM.md 3節と同じ制約)。
// バイナリ本体(ruby+stdlib.wasm、4.0は非圧縮約32MB)はリポジトリに含めず、公式npm
// パッケージ(@ruby/4.0-wasm-wasi)をjsDelivr CDN経由でブラウザから直接
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
// export: /kimi-code/markdown/:id(src/views/kimiCodeMarkdown.ts)でもRuby/WASMを
// 実行するため、同じCDN URL(バージョン固定)をここから再利用しバージョンの
// 食い違いを防ぐ。
export const RUBY_WASM_JS_URL = 'https://esm.sh/@ruby/wasm-wasi@2.10.1/dist/esm/browser.js';
export const RUBY_WASM_BINARY_URL = 'https://cdn.jsdelivr.net/npm/@ruby/4.0-wasm-wasi@2.10.1/dist/ruby+stdlib.wasm';

export type RubyWasmVersionInfo = {
  /** @ruby/{X.Y}-wasm-wasi のビルドライン(パッケージのメジャー.マイナー)。
   *  実際のCRubyパッチバージョン(例: 4.0.0)はwasmバイナリ内部にしか無く、
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
  const versionInfo = getRubyWasmVersionInfo();
  const wasmCacheName = rubyWasmBinaryCacheName(versionInfo.rubyBuildLine, versionInfo.wasmWasiPackageVersion);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ruby (WASM) - Cloudflare Workers GitHub OAuth</title>
  ${getRubyWasmPreloadTags(RUBY_WASM_JS_URL, RUBY_WASM_BINARY_URL)}
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
    .toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
    .btn-secondary {
      background: var(--bg-secondary); color: var(--text-primary);
      border: 1px solid var(--border-color); border-radius: 8px;
      padding: 12px 20px; font-size: 14px; font-weight: 600; cursor: pointer;
    }
    .btn-secondary:hover { opacity: 0.85; }
    .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
    .save-btn { background: #16a34a; color: #fff; border: none; }
    .save-btn:hover { background: #15803d; }
    .save-note { font-size: 11px; color: var(--text-muted); margin-top: -10px; margin-bottom: 14px; }
    /* モーダルのz-indexは固定値を書かず、常にgetNextZ()で算出した値を
       JSからstyle.zIndexへ設定する(CLAUDE.mdルール26)。ここではCSS上の
       初期値だけ与えておき、実際の値は開く直前にJSで上書きする。 */
    .modal-overlay {
      display: none; position: fixed; inset: 0;
      background: rgba(0, 0, 0, 0.5);
      align-items: center; justify-content: center;
    }
    .modal-overlay.open { display: flex; }
    .modal-box {
      background: var(--card-bg); color: var(--text-primary); border-radius: 12px; padding: 24px;
      width: min(560px, 92vw); max-height: 84vh; overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
    }
    .modal-box h2 {
      font-size: 16px; margin: 0 0 14px; color: var(--text-primary);
      display: flex; justify-content: space-between; align-items: center;
    }
    .modal-close { background: none; border: none; font-size: 18px; cursor: pointer; color: var(--text-muted); }
    .modal-snippet-list { list-style: none; padding: 0; margin: 0 0 14px; max-height: 220px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px; }
    .modal-snippet-list li { font-size: 13px; border-bottom: 1px solid var(--border-color); }
    .modal-snippet-list li:last-child { border-bottom: none; }
    /* プレースホルダー行(読み込み中・0件・エラー)。swipe行ではないので
       通常通りpaddingを持たせる。 */
    .modal-snippet-list > li:not(.snippet-swipe-row) { padding: 10px 12px; color: var(--text-muted); }
    .modal-snippet-meta { font-size: 11px; color: var(--text-muted); }
    .modal-snippet-list li.snippet-swipe-row { position: relative; overflow: hidden; padding: 0; touch-action: pan-y; }
    .snippet-swipe-content { position: relative; z-index: 1; padding: 10px 12px; background: var(--card-bg); transition: transform 0.2s ease; }
    .snippet-swipe-row.selected .snippet-swipe-content, .snippet-swipe-content:hover { background: var(--bg-secondary); }
    .snippet-delete-btn { position: absolute; inset: 0 0 0 auto; width: 72px; border: none; background: var(--danger-color); color: #fff; font-weight: 700; cursor: pointer; opacity: 0; pointer-events: none; transition: opacity 0.15s ease; }
    .snippet-swipe-row.swipe-open .snippet-delete-btn { opacity: 1; pointer-events: auto; }
    .delete-confirm-box { width: min(380px, 92vw); text-align: center; }
    .delete-confirm-box p { margin: 0 0 18px; color: var(--text-secondary); overflow-wrap: anywhere; }
    .delete-confirm-actions { display: flex; justify-content: center; gap: 10px; }
    .delete-confirm-actions button { border-radius: 8px; padding: 10px 18px; font-weight: 600; cursor: pointer; }
    .delete-confirm-ok { border: none; background: var(--danger-color); color: #fff; }
    #modalCodeTextarea { min-height: 140px; }
    #modalResultValue {
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 13px; white-space: pre-wrap; word-break: break-all;
      background: var(--bg-secondary); color: var(--text-secondary);
      padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);
    }
    #modalResultValue.error { color: #991b1b; }
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
      <div class="notice">初回はRuby本体(非圧縮約32MB)をCDNから取得します。通信状況により数十秒かかることがあります。進捗は下のステータスに出ます。2回目以降はブラウザキャッシュを使います。</div>
      <div class="wasm-status loading" id="wasmStatus">WASMモジュールを読み込み中…</div>
      <div class="toolbar">
        <button type="button" class="btn-secondary" id="openListBtn">📚 保存済みスニペット一覧</button>
      </div>
      <textarea id="inputCode" placeholder="puts 'hello world'">puts 'hello world'</textarea>
      <div class="toolbar">
        <button class="run-btn" id="runBtn" disabled>Rubyコードを実行</button>
        <button type="button" class="btn-secondary" id="clearBtn">🧹 クリア</button>
        <button type="button" class="btn-secondary save-btn" id="saveBtn" style="display:none;">💾 保存</button>
      </div>
      <div class="save-note" id="saveNote"></div>
      <div class="result-block" id="resultBlock" style="display:none;">
        <div class="result-label">実行結果</div>
        <div class="result-value" id="resultValue"></div>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="listModalOverlay">
    <div class="modal-box">
      <h2>📚 保存済みスニペット一覧 <button type="button" class="modal-close" id="listModalCloseBtn">✕</button></h2>
      <ul class="modal-snippet-list" id="modalSnippetList"><li>読み込み中…</li></ul>
      <textarea id="modalCodeTextarea" placeholder="一覧から選ぶとここにコードが読み込まれます(編集可能)"></textarea>
      <div class="toolbar" style="margin-top:10px;margin-bottom:0;">
        <button type="button" class="run-btn" id="modalRunBtn" disabled>▶ 実行</button>
      </div>
      <div class="save-note" id="modalNote"></div>
    </div>
  </div>

  <div class="modal-overlay" id="resultModalOverlay">
    <div class="modal-box">
      <h2>実行結果 <button type="button" class="modal-close" id="resultModalCloseBtn">✕</button></h2>
      <div id="modalResultValue"></div>
    </div>
  </div>

  <div class="modal-overlay" id="deleteConfirmOverlay" role="dialog" aria-modal="true" aria-labelledby="deleteConfirmTitle">
    <div class="modal-box delete-confirm-box">
      <h2 id="deleteConfirmTitle">スニペットを削除しますか？</h2>
      <p id="deleteConfirmMessage"></p>
      <div class="delete-confirm-actions">
        <button type="button" class="delete-confirm-ok" id="deleteConfirmOkBtn">削除</button>
        <button type="button" class="btn-secondary" id="deleteConfirmCancelBtn">キャンセル</button>
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
    var clearBtn = document.getElementById('clearBtn');
    var saveBtn = document.getElementById('saveBtn');
    var saveNote = document.getElementById('saveNote');
    var inputCode = document.getElementById('inputCode');
    var resultBlock = document.getElementById('resultBlock');
    var resultValue = document.getElementById('resultValue');
    var rubyVM = null;

    // 複数のモーダル・オーバーレイが同時に開いた際、後から開いた方が必ず
    // 手前に来るようz-indexを動的に算出する(固定値は書かない。CLAUDE.mdルール26)。
    function getNextZ() {
      var els = document.querySelectorAll('[style*="z-index"]');
      var max = 100;
      for (var i = 0; i < els.length; i++) {
        var z = parseInt(els[i].style.zIndex, 10);
        if (!isNaN(z) && z > max) max = z;
      }
      return max + 100;
    }

    // メインの実行エリア・モーダル双方の「実行」から共通で使う、Rubyコード
    // 実行ロジック。stdoutをキャプチャしてtoStringで文字列化する。
    function runRubyCode(code) {
      if (!rubyVM) return { ok: false, output: 'WASMモジュールを読み込み中です。しばらく待ってから再度お試しください' };
      try {
        var wrapped =
          "require 'stringio'\\n" +
          "__out = StringIO.new\\n" +
          "__orig_stdout = $stdout\\n" +
          "$stdout = __out\\n" +
          "begin\\n" +
          code + "\\n" +
          "ensure\\n" +
          "  $stdout = __orig_stdout\\n" +
          "end\\n" +
          "__out.string";
        var output = rubyVM.eval(wrapped).toString();
        return { ok: true, output: output.length > 0 ? output : '(出力なし)' };
      } catch (err) {
        return { ok: false, output: err && err.message ? err.message : String(err) };
      }
    }

    clearBtn.addEventListener('click', function() {
      inputCode.value = '';
      resultBlock.style.display = 'none';
      saveBtn.style.display = 'none';
      saveNote.textContent = '';
    });

    runBtn.addEventListener('click', function() {
      if (!rubyVM) return;
      resultBlock.style.display = 'block';
      saveNote.textContent = '';
      var result = runRubyCode(inputCode.value);
      resultValue.classList.toggle('error', !result.ok);
      resultValue.textContent = result.output;
      // 実行結果が正常(例外なし)の場合のみ保存ボタンを表示する。新しく
      // 実行し直した分は前回保存済みとは別物なので、以前の保存成功で
      // 無効化されたままになっていても、ここで必ず有効化し直す。
      saveBtn.style.display = result.ok ? 'inline-block' : 'none';
      if (result.ok) saveBtn.disabled = false;
    });

    saveBtn.addEventListener('click', function() {
      var code = inputCode.value;
      if (!code.trim()) return;
      var saveSucceeded = false;
      saveBtn.disabled = true;
      saveNote.textContent = '保存中...';
      fetch('/api/ruby-wasm/snippets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        // 保存ボタンはrunRubyCode()が成功した場合にのみ表示される(runBtnの
        // クリックハンドラ参照)。実際にRubyとして実行できたことを
        // サーバー側へ伝え、構文ヒューリスティックによる誤判定で保存を
        // 拒否されないようにする。
        body: JSON.stringify({ code: code, executedSuccessfully: true })
      })
        .then(function(r) { return r.json().then(function(d) { return { status: r.status, data: d }; }); })
        .then(function(res) {
          if (res.status !== 200 || !res.data || !res.data.id) {
            saveNote.textContent = '❌ 保存に失敗しました: ' + (res.data && res.data.error ? res.data.error : 'HTTP ' + res.status);
            return;
          }
          // 保存直前にこのコードは正常実行を確認済みなので、保存と同時に
          // 「動作確認済み」も記録する(手動での👍/👎操作を挟まない)。
          return fetch('/api/ruby-wasm/snippets/' + encodeURIComponent(res.data.id) + '/verifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ verified: true })
          }).then(function() {
            saveSucceeded = true;
            saveNote.textContent = '✅ 「' + res.data.title + '」として保存し、動作確認済みとして記録しました';
          });
        })
        .catch(function(err) {
          saveNote.textContent = '❌ 通信エラー: ' + ((err && err.message) || '不明');
        })
        .then(function() {
          // 保存に成功した場合は、同じコードを誤って重複登録してしまわない
          // よう保存ボタンを無効化(グレーアウト)したままにする。失敗時
          // のみ再度押せるよう有効化する。
          if (!saveSucceeded) saveBtn.disabled = false;
        });
    });

    // ---- 保存済みスニペット一覧モーダル ----
    var openListBtn = document.getElementById('openListBtn');
    var listModalOverlay = document.getElementById('listModalOverlay');
    var listModalCloseBtn = document.getElementById('listModalCloseBtn');
    var modalSnippetList = document.getElementById('modalSnippetList');
    var modalCodeTextarea = document.getElementById('modalCodeTextarea');
    var modalRunBtn = document.getElementById('modalRunBtn');
    var modalNote = document.getElementById('modalNote');

    // ---- 実行結果モーダル(一覧モーダルよりさらに上のレイヤー) ----
    var resultModalOverlay = document.getElementById('resultModalOverlay');
    var resultModalCloseBtn = document.getElementById('resultModalCloseBtn');
    var modalResultValue = document.getElementById('modalResultValue');
    var deleteConfirmOverlay = document.getElementById('deleteConfirmOverlay');
    var deleteConfirmMessage = document.getElementById('deleteConfirmMessage');
    var deleteConfirmOkBtn = document.getElementById('deleteConfirmOkBtn');
    var deleteConfirmCancelBtn = document.getElementById('deleteConfirmCancelBtn');
    var openSwipeRow = null;

    ${getRubyWasmLoaderScript()}
    loadRubyWasmVm('${RUBY_WASM_JS_URL}', '${RUBY_WASM_BINARY_URL}', '${wasmCacheName}', {
      expectedBuildLine: '${versionInfo.rubyBuildLine}',
      onStatus: function(text) {
        wasmStatus.textContent = text;
        wasmStatus.className = 'wasm-status loading';
      },
      onReady: function(vm, ver) {
        rubyVM = vm;
        wasmStatus.textContent = ver
          ? 'WASMモジュール読み込み完了 (' + ver + ')'
          : 'WASMモジュール読み込み完了';
        wasmStatus.className = 'wasm-status ready';
        runBtn.disabled = false;
        modalRunBtn.disabled = false;
      },
      onError: function(err) {
        wasmStatus.textContent = 'WASMモジュールの読み込みに失敗しました: ' + (err && err.message ? err.message : String(err));
        wasmStatus.className = 'wasm-status error';
      }
    });

    function openModal(overlay) {
      overlay.style.zIndex = String(getNextZ());
      overlay.classList.add('open');
    }
    function closeModal(overlay) {
      overlay.classList.remove('open');
    }

    // 呼び出し側にはモーダル操作を漏らさず、ユーザーの承認結果だけを返す。
    function requestDeleteConfirmation(title) {
      deleteConfirmMessage.textContent = '「' + title + '」を削除すると元に戻せません。';
      openModal(deleteConfirmOverlay);
      return new Promise(function(resolve) {
        var settled = false;
        function finish(approved) {
          if (settled) return;
          settled = true;
          closeModal(deleteConfirmOverlay);
          deleteConfirmOkBtn.removeEventListener('click', approve);
          deleteConfirmCancelBtn.removeEventListener('click', cancel);
          deleteConfirmOverlay.removeEventListener('click', backdrop);
          resolve(approved);
        }
        function approve() { finish(true); }
        function cancel() { finish(false); }
        function backdrop(e) { if (e.target === deleteConfirmOverlay) finish(false); }
        deleteConfirmOkBtn.addEventListener('click', approve);
        deleteConfirmCancelBtn.addEventListener('click', cancel);
        deleteConfirmOverlay.addEventListener('click', backdrop);
        deleteConfirmCancelBtn.focus();
      });
    }

    // 任意の行・前面コンテンツ・アクションボタンに再利用できるスワイプ検知。
    function setupSwipeReveal(row, content, actionButton) {
      var startX = 0;
      var dragging = false;
      var moved = false;
      var buttonWidth = 72;
      function close() {
        content.style.transform = 'translateX(0)';
        row.classList.remove('swipe-open');
        if (openSwipeRow === row) openSwipeRow = null;
      }
      function start(x) { startX = x; dragging = true; moved = false; }
      function move(x) {
        if (!dragging) return;
        var dx = x - startX;
        if (Math.abs(dx) < 4) return;
        moved = true;
        var base = row.classList.contains('swipe-open') ? -buttonWidth : 0;
        content.style.transition = 'none';
        content.style.transform = 'translateX(' + Math.max(-buttonWidth, Math.min(0, base + dx)) + 'px)';
      }
      function end(x) {
        if (!dragging) return;
        dragging = false;
        content.style.transition = 'transform 0.2s ease';
        if (!moved) return;
        var dx = x - startX;
        var shouldOpen = row.classList.contains('swipe-open') ? dx < buttonWidth / 2 : -dx > 50;
        if (!shouldOpen) { close(); return; }
        if (openSwipeRow && openSwipeRow !== row) {
          openSwipeRow.classList.remove('swipe-open');
          var previous = openSwipeRow.querySelector('.snippet-swipe-content');
          if (previous) previous.style.transform = 'translateX(0)';
        }
        content.style.transform = 'translateX(-' + buttonWidth + 'px)';
        row.classList.add('swipe-open');
        openSwipeRow = row;
      }
      row.addEventListener('touchstart', function(e) { start(e.touches[0].clientX); }, { passive: true });
      row.addEventListener('touchmove', function(e) { move(e.touches[0].clientX); }, { passive: true });
      row.addEventListener('touchend', function(e) { end(e.changedTouches[0].clientX); });
      content.addEventListener('mousedown', function(e) { if (e.button === 0) start(e.clientX); });
      content.addEventListener('mousemove', function(e) { if (dragging) move(e.clientX); });
      content.addEventListener('mouseup', function(e) { end(e.clientX); });
      content.addEventListener('mouseleave', function(e) { if (dragging) end(e.clientX); });
      actionButton.addEventListener('click', function(e) { e.stopPropagation(); });
    }

    function loadModalSnippetList() {
      openSwipeRow = null;
      modalSnippetList.innerHTML = '<li>読み込み中…</li>';
      fetch('/api/ruby-wasm/snippets', { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          var snippets = (d && d.snippets) || [];
          modalSnippetList.innerHTML = '';
          if (snippets.length === 0) {
            modalSnippetList.innerHTML = '<li>保存済みスニペットはありません</li>';
            return;
          }
          snippets.forEach(function(s) {
            var li = document.createElement('li');
            var row = li;
            li.className = 'snippet-swipe-row';
            var deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'snippet-delete-btn';
            deleteBtn.textContent = '削除';
            deleteBtn.setAttribute('aria-label', s.title + 'を削除');
            var content = document.createElement('div');
            content.className = 'snippet-swipe-content';
            var titleSpan = document.createElement('div');
            titleSpan.textContent = s.title;
            var metaSpan = document.createElement('div');
            metaSpan.className = 'modal-snippet-meta';
            metaSpan.textContent = 'Ruby ' + s.ruby_version + ' ・ ' + s.created_at;
            content.appendChild(titleSpan);
            content.appendChild(metaSpan);
            li.appendChild(deleteBtn);
            li.appendChild(content);
            content.addEventListener('click', function() {
              Array.prototype.forEach.call(modalSnippetList.children, function(el) { el.classList.remove('selected'); });
              li.classList.add('selected');
              modalNote.textContent = '読み込み中…';
              fetch('/api/ruby-wasm/snippets/' + encodeURIComponent(s.id), { credentials: 'same-origin' })
                .then(function(r) { return r.json().then(function(dd) { return { status: r.status, data: dd }; }); })
                .then(function(res) {
                  if (res.status === 200 && res.data && typeof res.data.code === 'string') {
                    // 選択したスニペットのコードで、リスト下のコード入力
                    // エリアを上書きする(編集可能な状態のまま)。
                    modalCodeTextarea.value = res.data.code;
                    modalNote.textContent = '「' + res.data.title + '」を読み込みました。編集してから実行することもできます';
                  } else {
                    modalNote.textContent = '❌ 読み込みに失敗しました: ' + (res.data && res.data.error ? res.data.error : 'HTTP ' + res.status);
                  }
                })
                .catch(function(err) {
                  modalNote.textContent = '❌ 通信エラー: ' + ((err && err.message) || '不明');
                });
            });
            setupSwipeReveal(li, content, deleteBtn);
            deleteBtn.addEventListener('click', function() {
              requestDeleteConfirmation(s.title).then(function(approved) {
                if (!approved) return;
                deleteBtn.disabled = true;
                modalNote.textContent = '削除中…';
                fetch('/api/ruby-wasm/snippets/' + encodeURIComponent(s.id), {
                  method: 'DELETE', credentials: 'same-origin'
                }).then(function(r) {
                  return r.json().then(function(dd) { return { status: r.status, data: dd }; });
                }).then(function(res) {
                  if (res.status !== 200 || !res.data || res.data.ok !== true) {
                    throw new Error(res.data && res.data.error ? res.data.error : 'HTTP ' + res.status);
                  }
                  row.remove();
                  modalCodeTextarea.value = '';
                  modalNote.textContent = '✅ 「' + s.title + '」を削除しました';
                  if (!modalSnippetList.children.length) modalSnippetList.innerHTML = '<li>保存済みスニペットはありません</li>';
                }).catch(function(err) {
                  deleteBtn.disabled = false;
                  modalNote.textContent = '❌ 削除に失敗しました: ' + ((err && err.message) || '不明');
                });
              });
            });
            modalSnippetList.appendChild(li);
          });
        })
        .catch(function() {
          modalSnippetList.innerHTML = '<li>一覧の取得に失敗しました</li>';
        });
    }

    openListBtn.addEventListener('click', function() {
      loadModalSnippetList();
      modalCodeTextarea.value = '';
      modalNote.textContent = '';
      openModal(listModalOverlay);
    });
    listModalCloseBtn.addEventListener('click', function() { closeModal(listModalOverlay); });
    listModalOverlay.addEventListener('click', function(e) {
      if (e.target === listModalOverlay) closeModal(listModalOverlay);
    });

    modalRunBtn.addEventListener('click', function() {
      var code = modalCodeTextarea.value;
      if (!code.trim()) {
        modalNote.textContent = '❌ コードを入力してください';
        return;
      }
      var result = runRubyCode(code);
      modalResultValue.classList.toggle('error', !result.ok);
      modalResultValue.textContent = result.output;
      // 実行結果は、一覧モーダルよりさらに上のレイヤーのモーダルに表示する。
      openModal(resultModalOverlay);
    });

    resultModalCloseBtn.addEventListener('click', function() { closeModal(resultModalOverlay); });
    resultModalOverlay.addEventListener('click', function(e) {
      if (e.target === resultModalOverlay) closeModal(resultModalOverlay);
    });
  </script>
</body>
</html>`;
}
