import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

export function getWasmModulesPage(username: string, initialViewMode: 'panel' | 'list' = 'list'): string {
  const safeUsername = escapeHtml(username);
  const isInitialPanel = initialViewMode === 'panel';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#0d1117">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="WASMモジュール">
  <link rel="manifest" href="/manifest-wasm-modules.json">
  <title>WASMモジュール一覧 - Cloudflare Workers GitHub OAuth</title>
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
    @media (display-mode: standalone) { .pwa-hide { display: none !important; } }
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
    .container { max-width: 1000px; margin: 0 auto; padding: 32px 20px; }
    .title-bar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 4px; }
    .title { font-size: 22px; font-weight: 700; color: var(--text-primary); }
    .mode-toggle { display: flex; gap: 6px; }
    .mode-btn {
      font-size: 13px;
      padding: 6px 14px;
      border-radius: 999px;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
      color: var(--text-secondary);
      cursor: pointer;
    }
    .mode-btn.active { background: #0969da; color: #fff; border-color: #0969da; }
    .module-card {
      background: var(--card-bg);
      border-radius: 12px;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
      padding: 20px 24px;
      margin-bottom: 16px;
    }
    .module-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .module-name { font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
    .module-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 10px; }
    .module-meta { font-size: 12px; color: var(--text-muted); display: flex; flex-wrap: wrap; gap: 4px 16px; }
    .module-meta code { font-family: 'Monaco', 'Courier New', monospace; }
    .source-link {
      font-family: 'Monaco', 'Courier New', monospace;
      color: #0969da;
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      text-decoration: none;
      font-size: inherit;
    }
    .toggle-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary); white-space: nowrap; }
    .toggle-label input { width: 18px; height: 18px; cursor: pointer; }
    .updated-info { font-size: 11px; color: var(--text-faint, var(--text-muted)); margin-top: 8px; }
    .save-btn {
      background: #667eea;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 8px;
    }
    .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .save-btn:hover:not(:disabled) { background: #5568d3; }
    .status-msg { font-size: 13px; margin-top: 10px; }
    .status-msg.ok { color: #166534; }
    .status-msg.error { color: #991b1b; }
    .empty { color: var(--text-muted); padding: 20px; text-align: center; }

    .wasm-table-wrap { width: 100%; overflow-x: auto; border: 1px solid var(--border-color); border-radius: 10px; margin-bottom: 16px; }
    .wasm-table { width: 100%; border-collapse: collapse; font-size: 12px; background: var(--card-bg); }
    .wasm-table th, .wasm-table td { padding: 8px 10px; border-bottom: 1px solid var(--border-color); white-space: nowrap; }
    .wasm-table th { color: var(--text-muted); font-weight: 600; background: var(--bg-secondary); text-align: center; cursor: pointer; position: relative; user-select: none; }
    .wasm-table th:hover { color: var(--text-primary); }
    .wasm-table th.enabled-th { cursor: pointer; font-size: 14px; }
    .wasm-table td { color: var(--text-secondary); text-align: left; }
    .wasm-table td code { font-family: 'Monaco', 'Courier New', monospace; }
    .wasm-row { cursor: pointer; }
    .wasm-row:hover td { background: var(--bg-secondary); }

    .th-tooltip {
      display: none;
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      margin-top: 6px;
      width: 260px;
      max-width: 60vw;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      padding: 10px 12px;
      font-size: 11px;
      font-weight: 400;
      color: var(--text-secondary);
      text-align: left;
      white-space: normal;
      z-index: 10;
    }
    .th-tooltip.open { display: block; }

    .modal-overlay {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.45);
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .modal-overlay.open { display: flex; }
    .modal-box {
      background: var(--card-bg);
      border-radius: 10px;
      max-width: 640px;
      width: 100%;
      max-height: 80vh;
      overflow-y: auto;
      padding: 20px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.3);
    }
    .modal-close {
      float: right;
      font-size: 13px;
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
      color: var(--text-secondary);
      cursor: pointer;
    }
    .modal-title { font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 12px; clear: both; }

    .source-modal-box { max-width: 900px; }
    .source-modal-path { font-family: 'Monaco', 'Courier New', monospace; font-size: 12px; color: var(--text-muted); margin-bottom: 4px; word-break: break-all; }
    .source-modal-meta { font-size: 11px; color: var(--text-muted); margin-bottom: 10px; }
    .source-modal-meta a { color: #0969da; }
    .source-code-wrap { border: 1px solid var(--border-color); border-radius: 8px; overflow: auto; max-height: 60vh; background: var(--bg-secondary); }
    .source-code {
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.6;
      white-space: pre;
      color: var(--text-primary);
    }
    .src-line { display: flex; }
    .src-lineno {
      flex-shrink: 0;
      width: 44px;
      text-align: right;
      padding-right: 10px;
      color: var(--text-muted);
      user-select: none;
      border-right: 1px solid var(--border-color);
      margin-right: 10px;
    }
    .src-code { white-space: pre; }
    .tok-kw { color: #cf222e; font-weight: 600; }
    .tok-str { color: #0a3069; }
    .tok-num { color: #953800; }
    .tok-com { color: #6e7781; font-style: italic; }
    .tok-macro { color: #8250df; }
    [data-theme="dark"] .tok-kw { color: #ff7b72; }
    [data-theme="dark"] .tok-str { color: #a5d6ff; }
    [data-theme="dark"] .tok-num { color: #ffa657; }
    [data-theme="dark"] .tok-com { color: #8b949e; }
    [data-theme="dark"] .tok-macro { color: #d2a8ff; }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="navbar-brand">
      <span>🧩</span>
      <span>WASMモジュール一覧</span>
    </div>
    <div class="user-menu">
      ${getThemeToggleHTML()}
      <span class="user-name">${safeUsername}</span>
      <div class="user-menu-container pwa-hide">
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
    <div class="title-bar">
      <div class="title">リンクタップで各WASMファイルのソースコードを読むことができます</div>
      <div class="mode-toggle">
        <button type="button" class="mode-btn${isInitialPanel ? ' active' : ''}" id="modePanelBtn" data-mode="panel">🗂 パネル表示</button>
        <button type="button" class="mode-btn${isInitialPanel ? '' : ' active'}" id="modeListBtn" data-mode="list">📋 リスト表示</button>
      </div>
    </div>
    <div id="moduleList"></div>
    <div class="wasm-table-wrap" id="wasmTableWrap" style="display:none;">
      <table class="wasm-table">
        <thead>
          <tr>
            <th data-sort-key="id">ID</th>
            <th data-sort-key="wasmPath">バイナリ</th>
            <th data-sort-key="sourceFile">ソース</th>
            <th data-sort-key="approxSize">サイズ</th>
            <th class="enabled-th" id="enabledTh">
              ⬜︎
              <div class="th-tooltip" id="enabledThTooltip">
                起動時にこのモジュールを読み込むかどうかの設定です。チェックを変更して「設定を保存」を押しても、既に起動中のWorker isolateには反映されません。次にisolateが新規に立ち上がったタイミング(次回のコールドスタート)から反映されます。
              </div>
            </th>
            <th data-sort-key="sourceUpdatedAt">最終更新日時</th>
            <th data-sort-key="wasmBuiltAt">最新ビルド日時</th>
          </tr>
        </thead>
        <tbody id="wasmTableBody"></tbody>
      </table>
    </div>
    <button class="save-btn" id="saveBtn" disabled>設定を保存</button>
    <div class="status-msg" id="statusMsg"></div>
  </div>

  <div class="modal-overlay" id="detailModalOverlay">
    <div class="modal-box" id="detailModalBox">
      <button type="button" class="modal-close" id="detailModalCloseBtn">✕ 閉じる</button>
      <div class="modal-title" id="detailModalTitle"></div>
      <div id="detailModalBody"></div>
    </div>
  </div>

  <div class="modal-overlay" id="sourceModalOverlay">
    <div class="modal-box source-modal-box" id="sourceModalBox">
      <button type="button" class="modal-close" id="sourceModalCloseBtn">✕ 閉じる</button>
      <div class="modal-title" id="sourceModalTitle"></div>
      <div class="source-modal-path" id="sourceModalPath"></div>
      <div class="source-modal-meta" id="sourceModalMeta"></div>
      <div class="source-code-wrap"><div class="source-code" id="sourceModalCode"></div></div>
    </div>
  </div>

  <script>
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

    function escHtml(s) {
      return String(s).replace(/[&<>"']/g, function(c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    function fmtDate(iso) {
      if (!iso) return '不明';
      try {
        var d = new Date(iso);
        if (isNaN(d.getTime())) return '不明';
        return d.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      } catch (e) {
        return '不明';
      }
    }

    function getNextZ() {
      var maxZ = 0;
      document.querySelectorAll('*').forEach(function(el) {
        var cs = window.getComputedStyle(el);
        if (cs.position === 'fixed') {
          var z = parseInt(cs.zIndex, 10);
          if (!isNaN(z) && z > maxZ) maxZ = z;
        }
      });
      var staticZDefaults = { detailModalOverlay: 1000, sourceModalOverlay: 1000 };
      Object.keys(staticZDefaults).forEach(function(id) {
        if (staticZDefaults[id] > maxZ) maxZ = staticZDefaults[id];
      });
      return maxZ + 100;
    }

    var moduleListEl = document.getElementById('moduleList');
    var wasmTableWrap = document.getElementById('wasmTableWrap');
    var wasmTableBody = document.getElementById('wasmTableBody');
    var modePanelBtn = document.getElementById('modePanelBtn');
    var modeListBtn = document.getElementById('modeListBtn');
    var saveBtn = document.getElementById('saveBtn');
    var statusMsg = document.getElementById('statusMsg');
    var loadedModules = [];
    var viewMode = '${initialViewMode}';

    function saveViewModeCookie(mode) {
      fetch('/api/settings/wasm-modules-view-mode', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: mode }),
      }).catch(function() {
        // Cookie保存に失敗しても表示切替自体はこのページ内で完結しているため、
        // ここではUIをブロックしない(次回アクセス時のデフォルトが今回選択した
        // モードに更新されないだけで、機能自体は使い続けられる)。
      });
    }

    modePanelBtn.addEventListener('click', function() {
      viewMode = 'panel';
      modePanelBtn.classList.add('active');
      modeListBtn.classList.remove('active');
      renderCurrentMode();
      saveViewModeCookie('panel');
    });
    modeListBtn.addEventListener('click', function() {
      viewMode = 'list';
      modeListBtn.classList.add('active');
      modePanelBtn.classList.remove('active');
      renderCurrentMode();
      saveViewModeCookie('list');
    });

    function renderCurrentMode() {
      moduleListEl.style.display = viewMode === 'panel' ? 'block' : 'none';
      wasmTableWrap.style.display = viewMode === 'list' ? 'block' : 'none';
      if (viewMode === 'panel') {
        renderPanel(loadedModules);
      } else {
        renderList(loadedModules);
      }
    }

    function sourceLinkHtml(m) {
      return '<button type="button" class="source-link" data-source-open="' + escHtml(m.id) + '">' + escHtml(m.sourceFile) + '</button>';
    }

    var WASM_PREFIX = 'public/wasm/';
    function displayWasmPath(path) {
      if (typeof path === 'string' && path.indexOf(WASM_PREFIX) === 0) {
        return path.slice(WASM_PREFIX.length);
      }
      return path;
    }

    function renderPanel(modules) {
      if (modules.length === 0) {
        moduleListEl.innerHTML = '<div class="empty">登録されているWASMモジュールがありません</div>';
        return;
      }
      var html = '';
      modules.forEach(function(m) {
        html += '<div class="module-card" data-module-id="' + escHtml(m.id) + '">';
        html += '<div class="module-head">';
        html += '<div><div class="module-name">' + escHtml(m.name) + '</div><div class="module-desc">' + escHtml(m.description) + '</div></div>';
        html += '<label class="toggle-label"><input type="checkbox" class="module-toggle"' + (m.enabled ? ' checked' : '') + '> 起動時に読み込む</label>';
        html += '</div>';
        html += '<div class="module-meta">';
        html += '<span>ID: <code>' + escHtml(m.id) + '</code></span>';
        html += '<span>バイナリ: <code>' + escHtml(m.wasmPath) + '</code></span>';
        html += '<span>ソース: ' + sourceLinkHtml(m) + '</span>';
        html += '<span>サイズ目安: ' + escHtml(m.approxSize) + '</span>';
        html += '</div>';
        html += '<div class="updated-info">最終更新日時: ' + escHtml(fmtDate(m.sourceUpdatedAt)) + ' / 最新ビルド日時: ' + escHtml(fmtDate(m.wasmBuiltAt)) + '</div>';
        if (m.updatedAt) {
          html += '<div class="updated-info">設定の最終更新: ' + escHtml(m.updatedAt) + (m.updatedBy ? ' (' + escHtml(m.updatedBy) + ')' : '') + '</div>';
        }
        html += '</div>';
      });
      moduleListEl.innerHTML = html;
    }

    var listSortKey = null;
    var listSortDir = 1;

    function sortValueFor(m, key) {
      if (key === 'wasmPath') return displayWasmPath(m.wasmPath) || '';
      var v = m[key];
      return v === null || v === undefined ? '' : v;
    }

    function sortedModulesForList(modules) {
      if (!listSortKey) return modules;
      var copy = modules.slice();
      copy.sort(function(a, b) {
        var av = sortValueFor(a, listSortKey);
        var bv = sortValueFor(b, listSortKey);
        if (av < bv) return -1 * listSortDir;
        if (av > bv) return 1 * listSortDir;
        return 0;
      });
      return copy;
    }

    function renderList(modules) {
      var sorted = sortedModulesForList(modules);
      if (sorted.length === 0) {
        wasmTableBody.innerHTML = '<tr><td colspan="7" class="empty">登録されているWASMモジュールがありません</td></tr>';
        return;
      }
      var html = '';
      sorted.forEach(function(m) {
        html += '<tr class="wasm-row" data-module-id="' + escHtml(m.id) + '">';
        html += '<td><code>' + escHtml(m.id) + '</code></td>';
        html += '<td><code>' + escHtml(displayWasmPath(m.wasmPath)) + '</code></td>';
        html += '<td>' + sourceLinkHtml(m) + '</td>';
        html += '<td>' + escHtml(m.approxSize) + '</td>';
        html += '<td><label class="toggle-label"><input type="checkbox" class="module-toggle"' + (m.enabled ? ' checked' : '') + '></label></td>';
        html += '<td>' + escHtml(fmtDate(m.sourceUpdatedAt)) + '</td>';
        html += '<td>' + escHtml(fmtDate(m.wasmBuiltAt)) + '</td>';
        html += '</tr>';
      });
      wasmTableBody.innerHTML = html;
    }

    document.querySelectorAll('.wasm-table th[data-sort-key]').forEach(function(th) {
      th.addEventListener('click', function() {
        var key = th.getAttribute('data-sort-key');
        if (listSortKey === key) {
          listSortDir = listSortDir * -1;
        } else {
          listSortKey = key;
          listSortDir = 1;
        }
        renderList(loadedModules);
      });
    });

    var enabledTh = document.getElementById('enabledTh');
    var enabledThTooltip = document.getElementById('enabledThTooltip');
    enabledTh.addEventListener('click', function(e) {
      e.stopPropagation();
      enabledThTooltip.classList.toggle('open');
    });
    document.addEventListener('click', function(e) {
      if (enabledThTooltip.classList.contains('open') && !enabledTh.contains(e.target)) {
        enabledThTooltip.classList.remove('open');
      }
    });

    function findModuleById(id) {
      return loadedModules.filter(function(m) { return m.id === id; })[0];
    }

    // リストモードでは行の空白部分(チェックボックス・ソースリンク以外)をタップすると
    // モジュール詳細モーダルを開く。
    wasmTableBody.addEventListener('click', function(e) {
      if (e.target.closest('.module-toggle') || e.target.closest('[data-source-open]')) return;
      var row = e.target.closest('.wasm-row');
      if (!row) return;
      openDetailModal(row.getAttribute('data-module-id'));
    });

    var detailModalOverlay = document.getElementById('detailModalOverlay');
    var detailModalTitle = document.getElementById('detailModalTitle');
    var detailModalBody = document.getElementById('detailModalBody');

    function openDetailModal(moduleId) {
      var m = findModuleById(moduleId);
      if (!m) return;
      detailModalTitle.textContent = m.name;
      var html = '';
      html += '<div class="module-desc">' + escHtml(m.description) + '</div>';
      html += '<div class="module-meta" style="margin-top:10px;">';
      html += '<span>ID: <code>' + escHtml(m.id) + '</code></span>';
      html += '<span>バイナリ: <code>' + escHtml(m.wasmPath) + '</code></span>';
      html += '<span>ソース: ' + sourceLinkHtml(m) + '</span>';
      html += '<span>サイズ目安: ' + escHtml(m.approxSize) + '</span>';
      html += '</div>';
      html += '<div class="updated-info" style="margin-top:10px;">最終更新日時: ' + escHtml(fmtDate(m.sourceUpdatedAt)) + ' / 最新ビルド日時: ' + escHtml(fmtDate(m.wasmBuiltAt)) + '</div>';
      detailModalBody.innerHTML = html;
      detailModalOverlay.style.zIndex = String(getNextZ());
      detailModalOverlay.classList.add('open');
    }

    document.getElementById('detailModalCloseBtn').addEventListener('click', function() {
      detailModalOverlay.classList.remove('open');
    });
    detailModalOverlay.addEventListener('click', function(e) {
      if (e.target === detailModalOverlay) detailModalOverlay.classList.remove('open');
    });
    detailModalBody.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-source-open]');
      if (btn) openSourceModal(btn.getAttribute('data-source-open'));
    });

    // Rustソースの簡易シンタックスハイライト(コメント・文字列・数値・キーワード・マクロ呼び出し)。
    // template literal内にbackslash多用の正規表現リテラルを書くと、outer template literalの
    // エスケープ処理で\\bや\\dが壊れる(CLAUDE.mdルール29)ため、regexは使わず文字走査で実装する。
    var RUST_KEYWORDS = ['fn', 'pub', 'let', 'mut', 'const', 'struct', 'enum', 'impl', 'trait', 'use', 'mod',
      'return', 'match', 'if', 'else', 'for', 'while', 'loop', 'break', 'continue', 'self', 'Self', 'super',
      'crate', 'as', 'in', 'where', 'unsafe', 'dyn', 'move', 'ref', 'static', 'type', 'async', 'await', 'extern'];
    var RUST_KEYWORD_SET = {};
    RUST_KEYWORDS.forEach(function(k) { RUST_KEYWORD_SET[k] = true; });

    function isWordStartChar(ch) {
      return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
    }
    function isWordChar(ch) {
      return isWordStartChar(ch) || (ch >= '0' && ch <= '9');
    }
    function isDigitChar(ch) {
      return ch >= '0' && ch <= '9';
    }

    function highlightRustLine(line) {
      var out = '';
      var i = 0;
      var n = line.length;
      var BACKSLASH = String.fromCharCode(92);
      while (i < n) {
        var ch = line.charAt(i);
        if (ch === '/' && line.charAt(i + 1) === '/') {
          out += '<span class="tok-com">' + escHtml(line.slice(i)) + '</span>';
          break;
        }
        if (ch === '"') {
          var j = i + 1;
          while (j < n) {
            if (line.charAt(j) === BACKSLASH) { j += 2; continue; }
            if (line.charAt(j) === '"') { j += 1; break; }
            j += 1;
          }
          out += '<span class="tok-str">' + escHtml(line.slice(i, j)) + '</span>';
          i = j;
          continue;
        }
        if (ch === "'") {
          var k = i + 1;
          if (line.charAt(k) === BACKSLASH) k += 2; else k += 1;
          if (line.charAt(k) === "'") {
            out += '<span class="tok-str">' + escHtml(line.slice(i, k + 1)) + '</span>';
            i = k + 1;
            continue;
          }
          out += escHtml(ch);
          i += 1;
          continue;
        }
        if (isDigitChar(ch)) {
          var m = i + 1;
          while (m < n && (isDigitChar(line.charAt(m)) || line.charAt(m) === '_' || line.charAt(m) === '.')) m += 1;
          out += '<span class="tok-num">' + escHtml(line.slice(i, m)) + '</span>';
          i = m;
          continue;
        }
        if (isWordStartChar(ch)) {
          var e = i + 1;
          while (e < n && isWordChar(line.charAt(e))) e += 1;
          var word = line.slice(i, e);
          if (line.charAt(e) === '!') {
            out += '<span class="tok-macro">' + escHtml(word + '!') + '</span>';
            i = e + 1;
            continue;
          }
          if (RUST_KEYWORD_SET[word]) {
            out += '<span class="tok-kw">' + escHtml(word) + '</span>';
          } else {
            out += escHtml(word);
          }
          i = e;
          continue;
        }
        out += escHtml(ch);
        i += 1;
      }
      return out;
    }

    function renderSourceCode(content) {
      var lines = content.split(String.fromCharCode(10));
      var html = '';
      lines.forEach(function(line, i) {
        html += '<div class="src-line"><span class="src-lineno">' + (i + 1) + '</span><span class="src-code">' + highlightRustLine(line) + '</span></div>';
      });
      return html;
    }

    var sourceModalOverlay = document.getElementById('sourceModalOverlay');
    var sourceModalTitle = document.getElementById('sourceModalTitle');
    var sourceModalPath = document.getElementById('sourceModalPath');
    var sourceModalMeta = document.getElementById('sourceModalMeta');
    var sourceModalCode = document.getElementById('sourceModalCode');

    function openSourceModal(moduleId) {
      var m = findModuleById(moduleId);
      if (!m) return;
      sourceModalTitle.textContent = m.name + ' のソース';
      sourceModalPath.textContent = m.sourceFile;
      sourceModalMeta.innerHTML = '最終更新日時: ' + escHtml(fmtDate(m.sourceUpdatedAt)) + ' / 最新ビルド日時: ' + escHtml(fmtDate(m.wasmBuiltAt));
      sourceModalCode.innerHTML = '<div class="empty">読み込み中…</div>';
      sourceModalOverlay.style.zIndex = String(getNextZ());
      sourceModalOverlay.classList.add('open');
      fetch('/api/wasm-modules/source?id=' + encodeURIComponent(moduleId), { credentials: 'same-origin' })
        .then(function(r) { return r.json().then(function(data) { return { ok: r.ok, data: data }; }); })
        .then(function(res) {
          if (!res.ok) {
            sourceModalCode.innerHTML = '<div class="empty">' + escHtml(res.data && res.data.error ? res.data.error : 'ソースの取得に失敗しました') + '</div>';
            return;
          }
          if (res.data.githubUrl) {
            sourceModalMeta.innerHTML += ' / <a href="' + escHtml(res.data.githubUrl) + '" target="_blank" rel="noopener noreferrer">GitHubで見る</a>';
          }
          sourceModalCode.innerHTML = renderSourceCode(res.data.content || '');
        })
        .catch(function(err) {
          sourceModalCode.innerHTML = '<div class="empty">読み込みに失敗しました: ' + escHtml(err && err.message ? err.message : String(err)) + '</div>';
        });
    }

    document.getElementById('sourceModalCloseBtn').addEventListener('click', function() {
      sourceModalOverlay.classList.remove('open');
    });
    sourceModalOverlay.addEventListener('click', function(e) {
      if (e.target === sourceModalOverlay) sourceModalOverlay.classList.remove('open');
    });

    // パネルモード・詳細モーダルの両方から使う「ソース」リンククリックの共通配線
    moduleListEl.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-source-open]');
      if (btn) openSourceModal(btn.getAttribute('data-source-open'));
    });
    wasmTableBody.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-source-open]');
      if (btn) openSourceModal(btn.getAttribute('data-source-open'));
    });

    function loadModules() {
      moduleListEl.innerHTML = '<div class="empty">読み込み中…</div>';
      fetch('/api/wasm-modules', { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          loadedModules = data.modules || [];
          saveBtn.disabled = loadedModules.length === 0;
          renderCurrentMode();
        })
        .catch(function(err) {
          var msg = '<div class="empty">読み込みに失敗しました: ' + escHtml(err && err.message ? err.message : String(err)) + '</div>';
          moduleListEl.innerHTML = msg;
        });
    }

    function collectUpdatesFromDom() {
      var updates = [];
      var seen = {};
      document.querySelectorAll('[data-module-id]').forEach(function(el) {
        var moduleId = el.getAttribute('data-module-id');
        if (seen[moduleId]) return;
        var checkbox = el.querySelector('.module-toggle');
        if (!checkbox) return;
        seen[moduleId] = true;
        updates.push({ moduleId: moduleId, enabled: checkbox.checked });
      });
      return updates;
    }

    saveBtn.addEventListener('click', function() {
      var updates = collectUpdatesFromDom();
      saveBtn.disabled = true;
      statusMsg.textContent = '保存中…';
      statusMsg.className = 'status-msg';
      Promise.all(updates.map(function(u) {
        return fetch('/api/wasm-modules', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(u),
        }).then(function(r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        });
      })).then(function() {
        statusMsg.textContent = '保存しました(次回のisolateコールドスタートから反映されます)';
        statusMsg.className = 'status-msg ok';
        loadModules();
      }).catch(function(err) {
        statusMsg.textContent = '保存に失敗しました: ' + (err && err.message ? err.message : String(err));
        statusMsg.className = 'status-msg error';
        saveBtn.disabled = false;
      });
    });

    loadModules();
  </script>
</body>
</html>`;
}
