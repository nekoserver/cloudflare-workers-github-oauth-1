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
    .search-row { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
    .search-box {
      flex: 1;
      min-width: 200px;
      font-size: 15px;
      padding: 12px 14px;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
      color: var(--text-primary);
    }
    .limit-select {
      font-size: 14px;
      padding: 0 10px;
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
    .mask-toggle-btn {
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
      color: var(--text-secondary);
      cursor: pointer;
    }
    .status-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .status-msg { font-size: 13px; color: var(--text-muted); min-height: 18px; }
    .status-msg.error { color: #cf222e; }
    .wine-table-wrap { width: 100%; overflow-x: auto; border: 1px solid var(--border-color); border-radius: 10px; }
    .wine-table { width: 100%; border-collapse: collapse; font-size: 12px; background: var(--card-bg); }
    .wine-table th, .wine-table td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--border-color); white-space: nowrap; }
    .wine-table th { color: var(--text-muted); font-weight: 600; background: var(--bg-secondary); position: sticky; top: 0; }
    .wine-table td { color: var(--text-secondary); }
    .wine-table td.empty { color: var(--text-muted); font-style: italic; }
    .wine-table tr:hover td { background: var(--bg-secondary); }
    .wine-table tr.wine-row { cursor: pointer; }
    .wine-name { font-weight: 700; color: var(--text-primary); cursor: pointer; text-decoration: underline dotted; }
    .similarity-badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #0969da; color: #fff; font-size: 11px; }
    .empty-msg { color: var(--text-muted); font-size: 13px; padding: 24px 0; text-align: center; }
    .wine-table td.masked { color: var(--text-muted); letter-spacing: 2px; }
    .detail-modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .detail-modal-overlay.open { display: flex; }
    .detail-modal {
      background: var(--card-bg);
      border-radius: 12px;
      padding: 20px;
      max-width: 480px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    }
    .detail-modal h3 { font-size: 18px; color: var(--text-primary); margin-bottom: 8px; }
    .detail-modal-meta { font-size: 12px; color: var(--text-muted); margin-bottom: 12px; }
    .detail-modal-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .detail-modal-table td { padding: 4px 6px; border-bottom: 1px solid var(--border-color); color: var(--text-secondary); }
    .detail-modal-table td:first-child { color: var(--text-muted); }
    .detail-modal-close-btn {
      margin-top: 14px;
      font-size: 13px;
      padding: 8px 16px;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
      color: var(--text-primary);
      cursor: pointer;
    }
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

    <div class="temp-admin-box" id="tempAdminBox" hidden>
      <span class="temp-admin-label">⚠️ デバッグモード(?debug=1): 一括登録・診断情報表示</span>
      <button type="button" class="temp-admin-btn" id="bulkRegisterBtn">ワイン埋め込み一括登録を実行</button>
      <span class="temp-admin-result" id="bulkRegisterResult"></span>
      <button type="button" class="temp-admin-btn" id="bulkRegisterMetadataBtn">ワイン個別詳細を一括登録</button>
      <span class="temp-admin-result" id="bulkRegisterMetadataResult"></span>
      <button type="button" class="temp-admin-btn" id="consistencyCheckBtn">シード件数と埋め込み件数の整合性チェック</button>
      <span class="temp-admin-result" id="consistencyCheckResult"></span>
    </div>

    <div class="search-row">
      <input type="text" id="freeword" class="search-box" placeholder="例: 芳醇でコクのある赤ワイン、魚介に合う白ワイン">
      <select id="limitSelect" class="limit-select">
        <option value="20">20件表示</option>
        <option value="30" selected>30件表示</option>
        <option value="50">50件表示</option>
        <option value="100">100件表示</option>
      </select>
      <button type="button" class="search-btn" id="searchBtn">検索</button>
    </div>
    <div class="status-row">
      <div class="status-msg" id="statusMsg"></div>
      <button type="button" class="mask-toggle-btn" id="maskToggleBtn">特性を表示</button>
    </div>

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

  <div class="detail-modal-overlay" id="detailModalOverlay">
    <div class="detail-modal">
      <h3 id="detailModalTitle"></h3>
      <div class="detail-modal-meta" id="detailModalMeta"></div>
      <table class="detail-modal-table" id="detailModalTable"></table>
      <button type="button" class="detail-modal-close-btn" id="detailModalCloseBtn">閉じる</button>
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

    var freewordInput = document.getElementById('freeword');
    var searchBtn = document.getElementById('searchBtn');
    var limitSelect = document.getElementById('limitSelect');
    var statusMsg = document.getElementById('statusMsg');
    var tableWrap = document.getElementById('wineTableWrap');
    var tableBody = document.getElementById('wineTableBody');
    var emptyMsg = document.getElementById('emptyMsg');
    var maskToggleBtn = document.getElementById('maskToggleBtn');
    var isMasked = true;
    var lastResults = [];
    var DETAIL_COLUMN_KEYS = ['fat', 'sweet', 'acid', 'salt', 'spice', 'umami', 'bitter', 'richness', 'red_meat', 'poultry', 'seafood', 'dessert'];
    var DETAIL_COLUMN_LABELS = { fat: '脂肪', sweet: '甘味', acid: '酸味', salt: '塩味', spice: 'スパイス', umami: '旨味', bitter: '苦味', richness: 'コク', red_meat: '赤肉', poultry: '鶏肉', seafood: '魚介', dessert: 'デザート' };
    var METADATA_COLUMN_KEYS = ['katakana_name', 'country', 'production_area', 'wine_type', 'grape_or_style', 'characteristics', 'pairing_foods', 'pairing_reasons', 'source_urls', 'metadata_status'];
    var METADATA_COLUMN_LABELS = { katakana_name: 'カタカナ表記', country: '生産国', production_area: '産地', wine_type: 'タイプ', grape_or_style: '品種/スタイル', characteristics: '特徴', pairing_foods: '合う料理', pairing_reasons: '理由', source_urls: '出典URL', metadata_status: '調査ステータス' };

    var isDebugMode = (function() {
      try { return new URLSearchParams(location.search).get('debug') === '1'; } catch (e) { return false; }
    })();
    if (isDebugMode) {
      document.getElementById('tempAdminBox').hidden = false;
    }

    function fmtScore(v) {
      return (typeof v === 'number') ? v.toFixed(3) : '不明';
    }

    function fmtDetail(details, key) {
      if (isMasked) return '<td class="masked">•••</td>';
      if (!details || typeof details[key] !== 'number') return '<td class="empty">不明</td>';
      return '<td>' + details[key].toFixed(3) + '</td>';
    }

    function renderRow(item) {
      var html = '<tr class="wine-row" data-id="' + item.id + '" data-wine-name="' + escHtml(item.wineName) + '">';
      html += '<td><span class="similarity-badge">' + fmtScore(item.similarity) + '</span></td>';
      html += '<td class="wine-name">' + escHtml(item.wineName) + '</td>';
      var d = item.details;
      for (var i = 0; i < DETAIL_COLUMN_KEYS.length; i++) {
        html += fmtDetail(d, DETAIL_COLUMN_KEYS[i]);
      }
      html += '</tr>';
      return html;
    }

    function renderTable() {
      tableBody.innerHTML = lastResults.map(renderRow).join('');
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
      var limit = parseInt(limitSelect.value, 10) || 30;
      searchBtn.disabled = true;
      setStatus('検索中...', false);
      fetch('/api/wine/search', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: q, limit: limit, debug: isDebugMode }),
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
          lastResults = results;
          var statusText = 'ヒット件数 ' + (res.data.hitCount != null ? res.data.hitCount : '?') + ' 件(類似度' + Math.round((res.data.threshold || 0) * 100) + '%以上) / 表示 ' + results.length + ' 件 / 登録済み ' + (res.data.total || 0) + ' 銘柄';
          if (isDebugMode && res.data.debugQueryDim !== undefined) {
            statusText += ' [デバッグ] query次元:' + res.data.debugQueryDim + ' / 登録済み次元:' + JSON.stringify(res.data.debugCandidateDims) + ' / 生vector型:' + res.data.debugRawVectorType;
          }
          setStatus(statusText, false);
          if (results.length === 0) {
            tableWrap.style.display = 'none';
            emptyMsg.style.display = 'block';
            return;
          }
          emptyMsg.style.display = 'none';
          tableWrap.style.display = 'block';
          renderTable();
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

    maskToggleBtn.addEventListener('click', function() {
      isMasked = !isMasked;
      maskToggleBtn.textContent = isMasked ? '特性を表示' : '特性を隠す';
      renderTable();
    });

    var detailModalOverlay = document.getElementById('detailModalOverlay');
    var detailModalTitle = document.getElementById('detailModalTitle');
    var detailModalMeta = document.getElementById('detailModalMeta');
    var detailModalTable = document.getElementById('detailModalTable');
    var detailModalCloseBtn = document.getElementById('detailModalCloseBtn');

    function getNextZ() {
      var max = 100;
      document.querySelectorAll('[style*="z-index"]').forEach(function(el) {
        var z = parseInt(el.style.zIndex, 10);
        if (!isNaN(z) && z < 9000 && z > max) max = z;
      });
      var staticZDefaults = { detailModalOverlay: 1000 };
      Object.keys(staticZDefaults).forEach(function(id) {
        var el = document.getElementById(id);
        if (el && el.classList.contains('open')) {
          var z = parseInt(el.style.zIndex, 10) || staticZDefaults[id];
          if (z > max) max = z;
        }
      });
      return max + 100;
    }

    function openWineDetailModal(id, wineName) {
      detailModalTitle.textContent = wineName || '読み込み中...';
      detailModalMeta.textContent = '';
      detailModalTable.innerHTML = '';
      detailModalOverlay.style.zIndex = String(getNextZ());
      detailModalOverlay.classList.add('open');
      fetch('/api/wine/' + encodeURIComponent(id), { credentials: 'same-origin' })
        .then(function(r) { return r.json().then(function(data) { return { ok: r.ok, data: data }; }); })
        .then(function(res) {
          if (!res.ok || res.data.error) {
            detailModalTitle.textContent = '取得に失敗しました';
            detailModalMeta.textContent = res.data.error || '';
            return;
          }
          var d = res.data;
          detailModalTitle.textContent = d.wineName;
          detailModalMeta.textContent = 'ID: ' + d.id + ' / モデル: ' + d.model + ' / 次元数: ' + d.dim;
          var rows = '';
          var m = d.metadata;
          for (var j = 0; j < METADATA_COLUMN_KEYS.length; j++) {
            var mkey = METADATA_COLUMN_KEYS[j];
            var mv = m && m[mkey] != null && m[mkey] !== '' ? escHtml(m[mkey]) : '不明';
            rows += '<tr><td>' + (METADATA_COLUMN_LABELS[mkey] || mkey) + '</td><td>' + mv + '</td></tr>';
          }
          for (var i = 0; i < DETAIL_COLUMN_KEYS.length; i++) {
            var key = DETAIL_COLUMN_KEYS[i];
            var v = d.details && typeof d.details[key] === 'number' ? d.details[key].toFixed(4) : '不明';
            rows += '<tr><td>' + (DETAIL_COLUMN_LABELS[key] || key) + '</td><td>' + v + '</td></tr>';
          }
          detailModalTable.innerHTML = rows;
        })
        .catch(function(err) {
          detailModalTitle.textContent = '取得に失敗しました';
          detailModalMeta.textContent = err && err.message ? err.message : String(err);
        });
    }

    tableBody.addEventListener('click', function(e) {
      var row = e.target && e.target.closest ? e.target.closest('.wine-row') : null;
      if (row) {
        openWineDetailModal(row.getAttribute('data-id'), row.getAttribute('data-wine-name'));
      }
    });
    detailModalCloseBtn.addEventListener('click', function() {
      detailModalOverlay.classList.remove('open');
    });
    detailModalOverlay.addEventListener('click', function(e) {
      if (e.target === detailModalOverlay) detailModalOverlay.classList.remove('open');
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
      var allSucceededWines = [];

      function step() {
        bulkRegisterResult.textContent = '実行中... 新規成功' + totalSucceeded + '件 / エラー' + totalErrors.length + '件';
        return bulkRegisterOneBatch().then(function(res) {
          if (!res.ok || res.data.error) {
            throw new Error(res.data.error || 'エラーが発生しました');
          }
          var d = res.data;
          totalSucceeded += d.succeeded;
          totalErrors = totalErrors.concat(d.errors || []);
          allSucceededWines = allSucceededWines.concat(d.succeededWines || []);
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
          if (allSucceededWines.length > 0) {
            msg += '(新規登録: ' + allSucceededWines.slice(0, 5).join('、') + (allSucceededWines.length > 5 ? '…他' + (allSucceededWines.length - 5) + '件' : '') + ')';
          }
          if (totalErrors.length > 0) {
            msg += '(エラー: ' + totalErrors.slice(0, 3).map(function(e) { return e.wine; }).join('、') + (totalErrors.length > 3 ? '…' : '') + ')';
          }
          bulkRegisterResult.textContent = msg;
        })
        .catch(function(err) {
          bulkRegisterBtn.disabled = false;
          bulkRegisterResult.textContent = '失敗: ' + (err && err.message ? err.message : String(err)) + '(新規成功' + totalSucceeded + '件 / エラー' + totalErrors.length + '件まで完了)';
        });
    }
    bulkRegisterBtn.addEventListener('click', runBulkRegister);

    var bulkRegisterMetadataBtn = document.getElementById('bulkRegisterMetadataBtn');
    var bulkRegisterMetadataResult = document.getElementById('bulkRegisterMetadataResult');

    function runBulkRegisterMetadata() {
      bulkRegisterMetadataBtn.disabled = true;
      bulkRegisterMetadataResult.textContent = '実行中...';
      fetch('/api/wine/bulk-register-metadata', {
        method: 'POST',
        credentials: 'same-origin',
      })
        .then(function(r) { return r.json().then(function(data) { return { ok: r.ok, data: data }; }); })
        .then(function(res) {
          bulkRegisterMetadataBtn.disabled = false;
          if (!res.ok || res.data.error) {
            bulkRegisterMetadataResult.textContent = '失敗: ' + (res.data.error || 'エラーが発生しました');
            return;
          }
          var d = res.data;
          var msg = '完了: 成功' + d.succeeded + '件 / スキップ' + d.skipped + '件(未登録の埋め込みあり) / エラー' + (d.errors ? d.errors.length : 0) + '件';
          bulkRegisterMetadataResult.textContent = msg;
        })
        .catch(function(err) {
          bulkRegisterMetadataBtn.disabled = false;
          bulkRegisterMetadataResult.textContent = '失敗: ' + (err && err.message ? err.message : String(err));
        });
    }
    bulkRegisterMetadataBtn.addEventListener('click', runBulkRegisterMetadata);

    var consistencyCheckBtn = document.getElementById('consistencyCheckBtn');
    var consistencyCheckResult = document.getElementById('consistencyCheckResult');

    function runConsistencyCheck() {
      consistencyCheckBtn.disabled = true;
      consistencyCheckResult.textContent = '確認中...';
      fetch('/api/wine/consistency-check', { credentials: 'same-origin' })
        .then(function(r) { return r.json().then(function(data) { return { ok: r.ok, data: data }; }); })
        .then(function(res) {
          consistencyCheckBtn.disabled = false;
          if (!res.ok || res.data.error) {
            consistencyCheckResult.textContent = '失敗: ' + (res.data.error || 'エラーが発生しました');
            return;
          }
          var d = res.data;
          var msg = (d.matches ? '✅ 一致' : '❌ 不一致') + ': シード' + d.seedTotal + '件 / 埋め込み' + d.embeddedTotal + '件';
          if (!d.matches && d.missingSample && d.missingSample.length > 0) {
            msg += '(未埋め込み例: ' + d.missingSample.join('、') + (d.missingCount > d.missingSample.length ? '…他' + (d.missingCount - d.missingSample.length) + '件' : '') + ')';
          }
          consistencyCheckResult.textContent = msg;
        })
        .catch(function(err) {
          consistencyCheckBtn.disabled = false;
          consistencyCheckResult.textContent = '失敗: ' + (err && err.message ? err.message : String(err));
        });
    }
    consistencyCheckBtn.addEventListener('click', runConsistencyCheck);
  </script>
</body>
</html>`;
}
