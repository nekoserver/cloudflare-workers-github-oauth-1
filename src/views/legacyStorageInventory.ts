import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';
import { LEGACY_STORAGE_ENTRIES, type LegacyStorageEntry } from '../data/legacyStorageRegistry';

export function getLegacyStorageInventoryPage(username: string): string {
  const safeUsername = escapeHtml(username);
  const registryJson = JSON.stringify(LEGACY_STORAGE_ENTRIES satisfies LegacyStorageEntry[]);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ブラウザ保存値の移行状況 - Cloudflare Workers GitHub OAuth</title>
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
    .user-name { font-size: 14px; color: var(--text-secondary); font-weight: 500; }
    .container { max-width: 1200px; margin: 0 auto; padding: 32px 20px; }
    .card {
      background: var(--card-bg);
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
      padding: 32px;
    }
    .title { font-size: 22px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
    .subtitle { font-size: 14px; color: var(--text-muted); margin-bottom: 20px; }
    .status-line { font-size: 13px; color: var(--text-muted); margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    thead th {
      text-align: left;
      padding: 8px 10px;
      background: var(--bg-secondary);
      color: var(--text-secondary);
      border-bottom: 2px solid var(--border-color);
      white-space: nowrap;
    }
    tbody td {
      padding: 8px 10px;
      border-bottom: 1px solid var(--border-light);
      color: var(--text-primary);
      vertical-align: top;
    }
    tbody tr:hover { background: var(--bg-secondary); }
    .table-wrap { overflow-x: auto; }
    code { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 12px; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
    }
    .badge-synced { background: #dafbe1; color: #1a7f37; }
    .badge-diverged { background: #ffebe9; color: #cf222e; }
    .badge-restorable { background: #ddf4ff; color: #0969da; }
    .badge-unsupported { background: #f0f0f0; color: #656d76; }
    .badge-storage-cookie { background: #ffebe9; color: #cf222e; }
    .badge-storage-localstorage { background: #dafbe1; color: #1a7f37; }
    button.action-btn {
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
      color: var(--text-primary);
      cursor: pointer;
      margin-right: 4px;
    }
    button.action-btn:hover:not(:disabled) { background: var(--dropdown-hover); }
    button.action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .empty-state { padding: 40px; text-align: center; color: var(--text-muted); }
    .capacity-section { margin-bottom: 28px; }
    .capacity-section-title { font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 2px; }
    .capacity-section-note { font-size: 11px; color: var(--text-faint); margin-bottom: 16px; }
    .capacity-chart { margin-bottom: 20px; }
    .capacity-chart-title { font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 2px; }
    .capacity-summary { font-size: 12px; color: var(--text-muted); margin-bottom: 6px; }
    .capacity-overflow-badge {
      display: inline-block;
      background: #ffebe9;
      color: #cf222e;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 600;
      margin-left: 6px;
    }
    .capacity-gauge-track {
      height: 10px;
      border-radius: 5px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      overflow: hidden;
      margin-bottom: 14px;
    }
    .capacity-gauge-fill { height: 100%; background: var(--accent-color, #667eea); min-width: 2px; }
    .capacity-rank-row { display: flex; align-items: center; gap: 10px; margin-bottom: 5px; font-size: 12px; }
    .capacity-rank-label {
      width: 140px;
      flex-shrink: 0;
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .capacity-rank-track {
      flex: 1;
      height: 16px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      overflow: hidden;
    }
    .capacity-rank-fill { height: 100%; min-width: 2px; }
    .capacity-rank-fill-total { background: var(--accent-color, #667eea); }
    .capacity-rank-value {
      width: 160px;
      flex-shrink: 0;
      text-align: right;
      font-family: 'SFMono-Regular', Consolas, monospace;
      color: var(--text-muted);
      white-space: nowrap;
    }
    .capacity-rank-row-total {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--border-color);
      font-weight: 600;
    }
    .capacity-rank-row-total .capacity-rank-label,
    .capacity-rank-row-total .capacity-rank-value { color: var(--text-primary); }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="navbar-brand">🗄️ ブラウザ保存値の移行状況</div>
    <div class="user-name">${safeUsername}</div>
  </nav>
  ${getThemeToggleHTML()}
  <div class="container">
    <div class="card">
      <div class="title">Cookie / localStorage 個別値の移行状況</div>
      <div class="subtitle">
        このブラウザに現在保存されているCookie・localStorageの値を走査し、どのページの設定なのか、
        D1(user_preferences)への移行先が既にあるか、D1の値とブラウザの値が一致しているか(同期済み/差異あり/復元可能)を一覧表示します。
        値が一致していない状態でパージすると未同期の値が失われるため、パージボタンは「同期済み」の場合のみ有効になります。
      </div>
      <div class="capacity-section">
        <div class="capacity-section-title">ページ別ストレージ占有量(多い順・残り容量含む)</div>
        <div class="capacity-section-note">
          ※ CookieもlocalStorageも仕様上の厳密な総容量はブラウザ実装依存のため、以下は一般的に使われる目安値(Cookie: 4096バイト×180件, localStorage: 5MB)に基づく参考値です。
        </div>
        <div class="capacity-chart">
          <div class="capacity-chart-title">Cookie</div>
          <div id="cookieCapacityChart"></div>
        </div>
        <div class="capacity-chart">
          <div class="capacity-chart-title">localStorage</div>
          <div id="localStorageCapacityChart"></div>
        </div>
      </div>
      <div id="statusLine" class="status-line">読み込み中...</div>
      <div class="table-wrap">
        <table id="inventoryTable">
          <thead>
            <tr>
              <th>キー</th>
              <th>種別</th>
              <th>対象ページ</th>
              <th>説明</th>
              <th>現在の値</th>
              <th>状態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody id="inventoryBody"></tbody>
        </table>
      </div>
      <div id="emptyState" class="empty-state" hidden>現在このブラウザに保存されているCookie/localStorageの値は見つかりませんでした。</div>
    </div>
  </div>
  <script>
    ${getThemeToggleScript()}

    var REGISTRY = ${registryJson};

    // Cookie/localStorageの厳密な総容量はブラウザ実装依存で仕様上定義されていないため、
    // 一般に目安として使われる値を採用する(あくまで参考値であることをUI上にも明記する)。
    var COOKIE_QUOTA_BYTES = 4096 * 180;
    var LOCAL_STORAGE_QUOTA_BYTES = 5 * 1024 * 1024;
    var PAGE_COLORS = ['#6366f1', '#ec4899', '#22c55e', '#f59e0b', '#06b6d4', '#a855f7', '#ef4444', '#84cc16', '#3b82f6', '#eab308'];

    function byteLength(s) {
      try {
        return new TextEncoder().encode(String(s)).length;
      } catch (e) {
        return String(s).length;
      }
    }

    function formatBytes(n) {
      if (n < 1024) return n + ' B';
      return (n / 1024).toFixed(1) + ' KB';
    }

    function computePageUsage(rows, storage) {
      var totals = {};
      rows.forEach(function (row) {
        if (row.storage !== storage) return;
        var pageLabel = row.entry ? row.entry.page : '(不明)';
        var size = byteLength(row.key) + byteLength(row.value);
        totals[pageLabel] = (totals[pageLabel] || 0) + size;
      });
      return Object.keys(totals)
        .map(function (page) { return { page: page, bytes: totals[page] }; })
        .sort(function (a, b) { return b.bytes - a.bytes; });
    }

    // ページ別の占有量を「多い順」のランキング形式の横棒グラフで表示する。
    // ページ間の棒の長さは、そのグラフの中で最も占有量が多いページを基準に
    // 相対比較できるようスケールする(quotaBytesを基準にすると、Cookie/
    // localStorageの一般的な使用量は総容量に対してごく僅かなため、
    // どのページも棒が視認できないほど細くなってしまうことを避けるため)。
    // 残り容量は、別途「使用量ゲージ」として合計使用量とquotaBytesの比で表示する。
    function renderCapacityChart(containerId, usage, quotaBytes) {
      var container = document.getElementById(containerId);
      var totalUsed = usage.reduce(function (sum, u) { return sum + u.bytes; }, 0);
      var remaining = Math.max(quotaBytes - totalUsed, 0);
      var overflow = totalUsed > quotaBytes;
      var rankScale = Math.max(usage.length > 0 ? usage[0].bytes : 0, 1);

      var rowsHtml = usage.map(function (u, i) {
        var pct = Math.min((u.bytes / rankScale) * 100, 100);
        var color = PAGE_COLORS[i % PAGE_COLORS.length];
        var pctOfQuota = quotaBytes > 0 ? (u.bytes / quotaBytes * 100).toFixed(2) : '0.00';
        return '<div class="capacity-rank-row">' +
          '<div class="capacity-rank-label" title="' + escapeHtmlClient(u.page) + '">' + escapeHtmlClient(u.page) + '</div>' +
          '<div class="capacity-rank-track"><div class="capacity-rank-fill" style="width:' + pct.toFixed(2) + '%; background:' + color + ';"></div></div>' +
          '<div class="capacity-rank-value">' + formatBytes(u.bytes) + ' (全体の' + pctOfQuota + '%)</div>' +
        '</div>';
      }).join('');

      // 使用率(%)は必ず「実バイト数 / quotaBytes」の比に100を掛けた値にする。
      // 100を掛け忘れると0〜1の小数(小数点以下の桁がほぼ0の値)がそのまま
      // 「%」表示されてしまい、実際の使用率より大幅に小さい値に見えてしまうため注意。
      var gaugePctRatio = quotaBytes > 0 ? (totalUsed / quotaBytes) : 0;
      var gaugePct = Math.min(gaugePctRatio * 100, 100);
      var totalPct = quotaBytes > 0 ? (gaugePctRatio * 100).toFixed(2) : '0.00';
      var totalRowHtml = '<div class="capacity-rank-row capacity-rank-row-total">' +
        '<div class="capacity-rank-label">合計</div>' +
        '<div class="capacity-rank-track"><div class="capacity-rank-fill capacity-rank-fill-total" style="width:' + gaugePct.toFixed(2) + '%;"></div></div>' +
        '<div class="capacity-rank-value">' + formatBytes(totalUsed) + ' / ' + formatBytes(quotaBytes) + ' (' + totalPct + '%)</div>' +
      '</div>';

      container.innerHTML =
        '<div class="capacity-summary">' + formatBytes(totalUsed) + ' / ' + formatBytes(quotaBytes) + ' 使用(残り ' + formatBytes(remaining) + ')' +
          (overflow ? '<span class="capacity-overflow-badge">目安を超過</span>' : '') +
        '</div>' +
        '<div class="capacity-gauge-track"><div class="capacity-gauge-fill" style="width:' + gaugePct.toFixed(2) + '%;"></div></div>' +
        rowsHtml + totalRowHtml;
    }

    function readCookies() {
      var out = {};
      document.cookie.split(';').forEach(function (part) {
        var idx = part.indexOf('=');
        if (idx === -1) return;
        var name = part.slice(0, idx).trim();
        var value = part.slice(idx + 1).trim();
        if (name) out[name] = decodeURIComponent(value);
      });
      return out;
    }

    function readLocalStorage() {
      var out = {};
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var name = localStorage.key(i);
          if (name !== null) out[name] = localStorage.getItem(name);
        }
      } catch (e) { /* localStorageへのアクセスが拒否される環境ではスキップ */ }
      return out;
    }

    function findRegistryEntry(key, storage) {
      for (var i = 0; i < REGISTRY.length; i++) {
        var entry = REGISTRY[i];
        if (entry.storage !== storage) continue;
        if (entry.isPrefix) {
          if (key.indexOf(entry.key) === 0) return entry;
        } else if (entry.key === key) {
          return entry;
        }
      }
      return null;
    }

    function escapeHtmlClient(s) {
      return String(s).replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
      });
    }

    function deleteCookie(key) {
      document.cookie = key + '=; Max-Age=0; Path=/';
    }

    function buildRows() {
      var cookies = readCookies();
      var ls = readLocalStorage();
      var rows = [];
      Object.keys(cookies).forEach(function (key) {
        rows.push({ key: key, storage: 'cookie', value: cookies[key], entry: findRegistryEntry(key, 'cookie') });
      });
      Object.keys(ls).forEach(function (key) {
        rows.push({ key: key, storage: 'localStorage', value: ls[key], entry: findRegistryEntry(key, 'localStorage') });
      });
      rows.sort(function (a, b) { return a.key < b.key ? -1 : a.key > b.key ? 1 : 0; });
      return rows;
    }

    function renderRow(row) {
      var entry = row.entry;
      var page = entry ? escapeHtmlClient(entry.page) : '(不明)';
      var desc = entry ? escapeHtmlClient(entry.description) : '登録なし(未分類)';
      var storageBadge = row.storage === 'cookie'
        ? '<span class="badge badge-storage-cookie">Cookie</span>'
        : '<span class="badge badge-storage-localstorage">localStorage</span>';
      var valuePreview = escapeHtmlClient(String(row.value).slice(0, 60));
      var rowId = 'row-' + row.storage + '-' + encodeURIComponent(row.key);
      return '<tr id="' + rowId + '" data-key="' + escapeHtmlClient(row.key) + '" data-storage="' + row.storage + '">' +
        '<td><code>' + escapeHtmlClient(row.key) + '</code></td>' +
        '<td>' + storageBadge + '</td>' +
        '<td>' + page + '</td>' +
        '<td>' + desc + '</td>' +
        '<td><code>' + valuePreview + '</code></td>' +
        '<td class="status-cell">判定中...</td>' +
        '<td class="action-cell">' +
          '<button class="action-btn restore-btn" disabled>復元</button>' +
          '<button class="action-btn purge-btn" disabled>パージ</button>' +
        '</td>' +
      '</tr>';
    }

    function setStatus(rowEl, statusHtml, restoreEnabled, purgeEnabled) {
      rowEl.querySelector('.status-cell').innerHTML = statusHtml;
      var restoreBtn = rowEl.querySelector('.restore-btn');
      var purgeBtn = rowEl.querySelector('.purge-btn');
      restoreBtn.disabled = !restoreEnabled;
      purgeBtn.disabled = !purgeEnabled;
    }

    function determineStatus(row, rowEl) {
      var entry = row.entry;
      if (!entry || !entry.migratedPrefKey) {
        setStatus(rowEl, '<span class="badge badge-unsupported">移行未対応</span>', false, false);
        return;
      }
      fetch('/api/preferences/' + encodeURIComponent(entry.migratedPrefKey))
        .then(function (res) {
          if (!res.ok) throw new Error('fetch failed: ' + res.status);
          return res.json();
        })
        .then(function (data) {
          if (data.value === null || data.value === undefined) {
            // D1にまだ値が無い場合、パージするとブラウザ側の値が唯一のコピーのまま
            // 消えてしまうため、復元のみ有効にする
            setStatus(rowEl, '<span class="badge badge-restorable">復元可能</span>', true, false);
          } else if (data.value === row.value) {
            // D1とブラウザの値が完全一致 = 既に安全にパージできる状態
            setStatus(rowEl, '<span class="badge badge-synced">同期済み</span>', false, true);
          } else {
            // D1に値はあるがブラウザの値と異なる = 未同期。ここでパージを許すと
            // ブラウザ側の値が失われる(D1側は古い値のまま)ため、パージは禁止する
            setStatus(rowEl, '<span class="badge badge-diverged">差異あり(未同期)</span>', true, false);
          }
        })
        .catch(function () {
          setStatus(rowEl, '<span class="badge badge-unsupported">判定失敗</span>', false, false);
        });
    }

    function wireActions(row, rowEl) {
      var entry = row.entry;
      rowEl.querySelector('.restore-btn').addEventListener('click', function () {
        if (!entry || !entry.migratedPrefKey) return;
        fetch('/api/preferences/' + encodeURIComponent(entry.migratedPrefKey), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: row.value }),
        })
          .then(function (res) {
            if (!res.ok) throw new Error('restore failed: ' + res.status);
            determineStatus(row, rowEl);
          })
          .catch(function () {
            setStatus(rowEl, '<span class="badge badge-unsupported">復元失敗</span>', true, false);
          });
      });
      rowEl.querySelector('.purge-btn').addEventListener('click', function () {
        if (row.storage === 'cookie') {
          deleteCookie(row.key);
        } else {
          try { localStorage.removeItem(row.key); } catch (e) { /* アクセス拒否環境ではスキップ */ }
        }
        rowEl.remove();
      });
    }

    function init() {
      var rows = buildRows();
      renderCapacityChart('cookieCapacityChart', computePageUsage(rows, 'cookie'), COOKIE_QUOTA_BYTES);
      renderCapacityChart('localStorageCapacityChart', computePageUsage(rows, 'localStorage'), LOCAL_STORAGE_QUOTA_BYTES);
      var body = document.getElementById('inventoryBody');
      var statusLine = document.getElementById('statusLine');
      var emptyState = document.getElementById('emptyState');
      if (rows.length === 0) {
        document.getElementById('inventoryTable').hidden = true;
        emptyState.hidden = false;
        statusLine.textContent = '対象0件';
        return;
      }
      statusLine.textContent = '対象' + rows.length + '件(パージ可能/復元可能の判定にはD1への問い合わせが必要なため少し時間がかかります)';
      body.innerHTML = rows.map(renderRow).join('');
      rows.forEach(function (row) {
        var rowId = 'row-' + row.storage + '-' + encodeURIComponent(row.key);
        var rowEl = document.getElementById(rowId);
        wireActions(row, rowEl);
        determineStatus(row, rowEl);
      });
    }

    init();
  </script>
</body>
</html>`;
}
