import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

export function getWineSearchPage(username: string): string {
  const safeUsername = escapeHtml(username);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ワイン銘柄検索 - Cloudflare Workers GitHub OAuth</title>
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
    .container { max-width: 1100px; margin: 0 auto; padding: 24px 20px; }
    .title { font-size: 22px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
    .subtitle { font-size: 14px; color: var(--text-muted); margin-bottom: 16px; }
    .search-row { display: flex; gap: 8px; margin-bottom: 16px; }
    .search-box {
      flex: 1;
      font-size: 15px;
      padding: 12px 14px;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
      color: var(--text-primary);
    }
    .search-btn {
      font-size: 14px;
      padding: 0 20px;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      background: #0969da;
      color: #fff;
      cursor: pointer;
    }
    .search-btn:disabled { opacity: 0.6; cursor: default; }
    .status-msg { font-size: 13px; color: var(--text-muted); margin-bottom: 12px; min-height: 18px; }
    .status-msg.error { color: #cf222e; }
    .wine-table-wrap { width: 100%; overflow-x: auto; border: 1px solid var(--border-color); border-radius: 10px; }
    .wine-table { width: 100%; border-collapse: collapse; font-size: 12px; background: var(--card-bg); }
    .wine-table th, .wine-table td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--border-color); white-space: nowrap; }
    .wine-table th { color: var(--text-muted); font-weight: 600; background: var(--bg-secondary); position: sticky; top: 0; }
    .wine-table td { color: var(--text-secondary); }
    .wine-table td.empty { color: var(--text-muted); font-style: italic; }
    .wine-table tr:hover td { background: var(--bg-secondary); }
    .wine-name { font-weight: 700; color: var(--text-primary); }
    .similarity-badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #0969da; color: #fff; font-size: 11px; }
    .empty-msg { color: var(--text-muted); font-size: 13px; padding: 24px 0; text-align: center; }
    .temp-admin-box {
      border: 1px dashed #d29922;
      background: var(--bg-secondary);
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .temp-admin-label { font-size: 12px; color: #9a6700; font-weight: 700; }
    .temp-admin-btn {
      font-size: 13px;
      padding: 6px 14px;
      border-radius: 6px;
      border: 1px solid #d29922;
      background: #fff8c5;
      color: #9a6700;
      cursor: pointer;
    }
    .temp-admin-btn:disabled { opacity: 0.6; cursor: default; }
    .temp-admin-result { font-size: 12px; color: var(--text-muted); }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="navbar-brand">
      <span>🍷</span>
      <span>ワイン銘柄検索</span>
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
    <div class="title">ワイン銘柄検索</div>
    <div class="subtitle">フリーワードをplamo-embedding-1bでベクタ化し、登録済みワイン銘柄とのコサイン類似度が高い順に表示します</div>

    <div class="temp-admin-box" id="tempAdminBox">
      <span class="temp-admin-label">⚠️ 一時ボタン(初回データ投入用・後で削除予定)</span>
      <button type="button" class="temp-admin-btn" id="bulkRegisterBtn">ワイン埋め込み一括登録を実行</button>
      <span class="temp-admin-result" id="bulkRegisterResult"></span>
    </div>

    <div class="search-row">
      <input type="text" id="freeword" class="search-box" placeholder="例: 芳醇でコクのある赤ワイン、魚介に合う白ワイン">
      <button type="button" class="search-btn" id="searchBtn">検索</button>
    </div>
    <div class="status-msg" id="statusMsg"></div>

    <div class="wine-table-wrap" id="wineTableWrap" style="display:none;">
      <table class="wine-table">
        <thead>
          <tr>
            <th>類似度</th>
            <th>銘柄</th>
            <th>脂肪</th>
            <th>甘味</th>
            <th>酸味</th>
            <th>塩味</th>
            <th>スパイス</th>
            <th>旨味</th>
            <th>苦味</th>
            <th>コク</th>
            <th>赤肉</th>
            <th>鶏肉</th>
            <th>魚介</th>
            <th>デザート</th>
          </tr>
        </thead>
        <tbody id="wineTableBody"></tbody>
      </table>
    </div>
    <div class="empty-msg" id="emptyMsg" style="display:none;">検索結果がありません。</div>
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

    var freewordInput = document.getElementById('freeword');
    var searchBtn = document.getElementById('searchBtn');
    var statusMsg = document.getElementById('statusMsg');
    var tableWrap = document.getElementById('wineTableWrap');
    var tableBody = document.getElementById('wineTableBody');
    var emptyMsg = document.getElementById('emptyMsg');

    function fmtScore(v) {
      return (typeof v === 'number') ? v.toFixed(3) : '不明';
    }

    function fmtDetail(details, key) {
      if (!details || typeof details[key] !== 'number') return '<td class="empty">不明</td>';
      return '<td>' + details[key].toFixed(3) + '</td>';
    }

    function renderRow(item) {
      var html = '<tr>';
      html += '<td><span class="similarity-badge">' + fmtScore(item.similarity) + '</span></td>';
      html += '<td class="wine-name">' + escHtml(item.wineName) + '</td>';
      var d = item.details;
      html += fmtDetail(d, 'fat');
      html += fmtDetail(d, 'sweet');
      html += fmtDetail(d, 'acid');
      html += fmtDetail(d, 'salt');
      html += fmtDetail(d, 'spice');
      html += fmtDetail(d, 'umami');
      html += fmtDetail(d, 'bitter');
      html += fmtDetail(d, 'richness');
      html += fmtDetail(d, 'red_meat');
      html += fmtDetail(d, 'poultry');
      html += fmtDetail(d, 'seafood');
      html += fmtDetail(d, 'dessert');
      html += '</tr>';
      return html;
    }

    function setStatus(text, isError) {
      statusMsg.textContent = text || '';
      statusMsg.classList.toggle('error', !!isError);
    }

    function runSearch() {
      var q = freewordInput.value.trim();
      if (!q) {
        setStatus('検索文字列を入力してください', true);
        return;
      }
      searchBtn.disabled = true;
      setStatus('検索中...', false);
      fetch('/api/wine/search', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: q }),
      })
        .then(function(r) { return r.json().then(function(data) { return { ok: r.ok, data: data }; }); })
        .then(function(res) {
          searchBtn.disabled = false;
          if (!res.ok || res.data.error) {
            setStatus(res.data.error || '検索に失敗しました', true);
            tableWrap.style.display = 'none';
            emptyMsg.style.display = 'none';
            return;
          }
          var results = res.data.results || [];
          var debugInfo = ' [デバッグ] query次元:' + res.data.debugQueryDim + ' / 登録済み次元:' + JSON.stringify(res.data.debugCandidateDims);
          setStatus(results.length + ' 件 / 登録済み ' + (res.data.total || 0) + ' 銘柄' + debugInfo, false);
          if (results.length === 0) {
            tableWrap.style.display = 'none';
            emptyMsg.style.display = 'block';
            return;
          }
          emptyMsg.style.display = 'none';
          tableWrap.style.display = 'block';
          tableBody.innerHTML = results.map(renderRow).join('');
        })
        .catch(function(err) {
          searchBtn.disabled = false;
          setStatus('検索に失敗しました: ' + (err && err.message ? err.message : String(err)), true);
        });
    }

    searchBtn.addEventListener('click', runSearch);
    freewordInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') runSearch();
    });

    var bulkRegisterBtn = document.getElementById('bulkRegisterBtn');
    var bulkRegisterResult = document.getElementById('bulkRegisterResult');
    var BULK_REGISTER_BATCH_SIZE = 10;

    function bulkRegisterOneBatch() {
      return fetch('/api/wine/bulk-register', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: BULK_REGISTER_BATCH_SIZE }),
      }).then(function(r) { return r.json().then(function(data) { return { ok: r.ok, data: data }; }); });
    }

    function runBulkRegister() {
      bulkRegisterBtn.disabled = true;
      var totalSucceeded = 0;
      var totalErrors = [];
      var totalSeed = 0;

      function step() {
        bulkRegisterResult.textContent = '実行中... 新規成功' + totalSucceeded + '件 / エラー' + totalErrors.length + '件';
        return bulkRegisterOneBatch().then(function(res) {
          if (!res.ok || res.data.error) {
            throw new Error(res.data.error || 'エラーが発生しました');
          }
          var d = res.data;
          totalSucceeded += d.succeeded;
          totalErrors = totalErrors.concat(d.errors || []);
          totalSeed = d.totalSeed;
          var processedSoFar = totalSeed - d.remaining;
          bulkRegisterResult.textContent = '処理中: ' + processedSoFar + ' / ' + totalSeed + ' 件(残り' + d.remaining + '件) / 新規成功' + totalSucceeded + '件 / エラー' + totalErrors.length + '件';
          if (d.remaining > 0) {
            return step();
          }
          return null;
        });
      }

      step()
        .then(function() {
          bulkRegisterBtn.disabled = false;
          var msg = '完了: 新規成功' + totalSucceeded + '件 / エラー' + totalErrors.length + '件';
          if (totalErrors.length > 0) {
            msg += '(' + totalErrors.slice(0, 3).map(function(e) { return e.wine; }).join('、') + (totalErrors.length > 3 ? '…' : '') + ')';
          }
          bulkRegisterResult.textContent = msg;
        })
        .catch(function(err) {
          bulkRegisterBtn.disabled = false;
          bulkRegisterResult.textContent = '失敗: ' + (err && err.message ? err.message : String(err)) + '(新規成功' + totalSucceeded + '件 / エラー' + totalErrors.length + '件まで完了)';
        });
    }
    bulkRegisterBtn.addEventListener('click', runBulkRegister);
  </script>
</body>
</html>`;
}
