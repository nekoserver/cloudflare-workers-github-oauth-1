import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

const OWNER_REPO = 'nekoserver/cloudflare-workers-github-oauth-1';

export type D1QueryCatalogRow = {
  query_name: string;
  command: string;
  command_confirmed: number;
  table_name: string | null;
  source_file: string;
  source_line: number;
  sql_text: string;
  migration_file: string | null;
  last_commit_hash: string | null;
};

function commitLink(hash: string): string {
  const short = escapeHtml(hash.slice(0, 7));
  const url = `https://github.com/${OWNER_REPO}/commit/${escapeHtml(hash)}`;
  return `<a href="${url}" target="_blank" rel="noopener noreferrer"><code>${short}</code></a>`;
}

// sqlVerb: SQL本文の先頭キーワードから発行SQL種別(INSERT/SELECT/UPDATE/DELETE/CREATE)を
// 判定する。テーブル名(table_name)は不明・動的なクエリでも、発行SQLの種別は
// 文字列の先頭を見るだけで必ず判定できるため、テーブル名で決め打ちせず横断的に
// 絞り込むための独立したフィルタ軸として使う。
function sqlVerb(sql: string): string {
  const s = sql.trim().toUpperCase();
  if (s.startsWith('SELECT')) return 'SELECT';
  if (s.startsWith('INSERT')) return 'INSERT';
  if (s.startsWith('UPDATE')) return 'UPDATE';
  if (s.startsWith('DELETE')) return 'DELETE';
  if (s.startsWith('CREATE')) return 'CREATE';
  if (s.startsWith('PRAGMA')) return 'PRAGMA';
  return 'OTHER';
}

// verbCounts: 発行SQL種別ごとの出現回数を、多い順に並べる。
// セレクトボックスの選択肢順(=よく使われる操作から選べる)に使う。
function verbCounts(rows: D1QueryCatalogRow[]): { verb: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const v = sqlVerb(row.sql_text);
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([verb, count]) => ({ verb, count }))
    .sort((a, b) => b.count - a.count);
}

// tableCounts: テーブル名ごとの出現回数を、多い順に並べる。
// テーブル選択パネル内のチェックボックスの並び順に使う。
function tableCounts(rows: D1QueryCatalogRow[]): { table: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const t = row.table_name ?? '(不明)';
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([table, count]) => ({ table, count }))
    .sort((a, b) => b.count - a.count);
}

function renderRow(row: D1QueryCatalogRow): string {
  const badge = row.command_confirmed
    ? '<span class="badge badge-confirmed">確定</span>'
    : '<span class="badge badge-inferred">推測</span>';
  const verb = escapeHtml(sqlVerb(row.sql_text));
  const sqlOneLine = escapeHtml(row.sql_text.replace(/\s+/g, ' ').trim().slice(0, 200));
  const migration = row.migration_file ? escapeHtml(row.migration_file) : '(なし)';
  const commit = row.last_commit_hash ? commitLink(row.last_commit_hash) : '(なし)';
  return `<tr data-verb="${verb}">
    <td>${escapeHtml(row.query_name)}</td>
    <td>:${escapeHtml(row.command)} ${badge}</td>
    <td class="sql-cell"><code>${sqlOneLine}</code></td>
    <td>${migration}</td>
    <td>${commit}</td>
    <td>${row.source_file}:${row.source_line}</td>
  </tr>`;
}

// renderTableBand: 1テーブル分のクエリ一覧を「帯(見出しバー)+その下のミニ表」として
// 描画する。行ごとに繰り返していたテーブル名を帯へ集約し、テーブル単位で
// パネルのチェックボックス選択(data-table)・全体の折りたたみ表示に使う。
function renderTableBand(table: string, rows: D1QueryCatalogRow[]): string {
  const rowsHtml = rows.map(renderRow).join('\n');
  return `<section class="table-band" data-table="${escapeHtml(table)}">
    <div class="band-header">
      <span class="band-name">${escapeHtml(table)}</span>
      <span class="band-count">${rows.length}件</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>クエリ名</th>
            <th>コマンド</th>
            <th>SQL</th>
            <th>migration</th>
            <th>最終変更コミット</th>
            <th>位置</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  </section>`;
}

function groupByTable(rows: D1QueryCatalogRow[]): [string, D1QueryCatalogRow[]][] {
  const byTable = new Map<string, D1QueryCatalogRow[]>();
  for (const row of rows) {
    const t = row.table_name ?? '(不明)';
    if (!byTable.has(t)) byTable.set(t, []);
    byTable.get(t)!.push(row);
  }
  return [...byTable.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export function getD1QueryCatalogPage(username: string, rows: D1QueryCatalogRow[]): string {
  const safeUsername = escapeHtml(username);
  const confirmedCount = rows.filter(r => r.command_confirmed).length;
  const reportUrl = `https://github.com/${OWNER_REPO}/blob/main/REPORT.cloudflare-workers-github-oauth-1.D1QUERYCATALOG.20260906.md`;
  const verbOptionsHtml = verbCounts(rows)
    .map(({ verb, count }) => `<option value="${escapeHtml(verb)}">${escapeHtml(verb)} (${count})</option>`)
    .join('\n');
  const tableCheckboxesHtml = tableCounts(rows)
    .map(({ table, count }) => {
      const safeTable = escapeHtml(table);
      return `<label class="table-checkbox"><input type="checkbox" value="${safeTable}"> ${safeTable} <span class="table-checkbox-count">(${count})</span></label>`;
    })
    .join('\n');
  const bandsHtml = groupByTable(rows)
    .map(([table, tableRows]) => renderTableBand(table, tableRows))
    .join('\n');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>D1クエリカタログ - Cloudflare Workers GitHub OAuth</title>
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
    .subtitle { font-size: 14px; color: var(--text-muted); margin-bottom: 16px; }
    .subtitle a { color: var(--accent-color, #667eea); }
    .summary { font-size: 13px; color: var(--text-muted); margin-bottom: 16px; }
    .filter-label { font-size: 12px; color: var(--text-muted); margin-bottom: 4px; }
    .panel-toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      max-width: 320px;
      padding: 10px 12px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: var(--bg-secondary);
      color: var(--text-primary);
      font-size: 14px;
      font-family: inherit;
      cursor: pointer;
      margin-bottom: 8px;
      text-align: left;
    }
    .panel-toggle:hover { background: var(--border-color); }
    .panel-toggle-arrow { margin-left: auto; transition: transform 0.15s; }
    .panel-toggle[aria-expanded="true"] .panel-toggle-arrow { transform: rotate(180deg); }
    .filter-panel {
      max-width: 320px;
      max-height: 260px;
      overflow-y: auto;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: var(--bg-secondary);
      padding: 8px 12px;
      margin-bottom: 8px;
    }
    .table-checkbox {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 0;
      font-size: 13px;
      color: var(--text-primary);
      cursor: pointer;
    }
    .table-checkbox-count { color: var(--text-muted); margin-left: auto; }
    select#verbFilter {
      width: 100%;
      max-width: 320px;
      padding: 6px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: var(--bg-secondary);
      color: var(--text-primary);
      font-size: 13px;
      font-family: 'Monaco', 'Courier New', monospace;
      margin-bottom: 16px;
    }
    select#verbFilter option { padding: 4px 6px; }
    .filter-hint { font-size: 12px; color: var(--text-muted); margin: -4px 0 12px; }
    .table-band { margin-bottom: 20px; }
    .band-header {
      display: flex;
      align-items: baseline;
      gap: 8px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px 8px 0 0;
      padding: 8px 12px;
    }
    .band-name { font-family: 'Monaco', 'Courier New', monospace; font-weight: 700; color: var(--text-primary); font-size: 14px; }
    .band-count { font-size: 12px; color: var(--text-muted); }
    .table-band .table-wrap {
      border: 1px solid var(--border-color);
      border-top: none;
      border-radius: 0 0 8px 8px;
    }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 8px 10px; border-bottom: 1px solid var(--border-color); text-align: left; vertical-align: top; }
    th { color: var(--text-muted); font-weight: 600; white-space: nowrap; }
    td { color: var(--text-primary); }
    td code { font-family: 'Monaco', 'Courier New', monospace; font-size: 12px; color: var(--text-secondary); }
    .sql-cell { white-space: nowrap; }
    .badge {
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
      margin-left: 4px;
    }
    .badge-confirmed { background: #dcfce7; color: #166534; }
    .badge-inferred { background: #fef3c7; color: #92400e; }
    .empty-state { color: var(--text-muted); font-size: 13px; padding: 24px 0; text-align: center; }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="navbar-brand">
      <span>🗂️</span>
      <span>D1クエリカタログ</span>
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
      <div class="title">D1クエリカタログ</div>
      <div class="subtitle">
        <code>src/index.ts</code> の <code>db.prepare()</code> 呼び出しから合成した sqlc 風アノテーション一覧。
        migrationファイル・変更コミットとの詳細な突き合わせは
        <a href="${reportUrl}" target="_blank" rel="noopener noreferrer">REPORT.cloudflare-workers-github-oauth-1.D1QUERYCATALOG.20260906.md</a>
        を参照。
      </div>
      <div class="summary">${rows.length}件中、コマンド種別確定済み${confirmedCount}件(sqlcパーサーで検証済み)</div>

      <button type="button" class="panel-toggle" id="tablePanelToggle" aria-expanded="false" aria-controls="tablePanel">
        <span>テーブルで絞り込み(出現回数の多い順、複数選択可)</span>
        <span class="panel-toggle-arrow">▾</span>
      </button>
      <div class="filter-panel" id="tablePanel" hidden>
        ${tableCheckboxesHtml}
      </div>

      <div class="filter-label">発行SQLで横断検索(出現回数の多い順、複数選択可)</div>
      <select id="verbFilter" multiple size="6">
        ${verbOptionsHtml}
      </select>
      <div class="filter-hint">テーブル名を決め打ちせず、発行しているSQL種別(INSERT/SELECT/UPDATE等)だけで全テーブル横断検索する場合はこちらを使う。両方指定した場合はAND条件になる</div>

      <div id="tableBands">
        ${bandsHtml}
      </div>
      ${rows.length === 0 ? '<div class="empty-state">データがありません。migrations/0129_create_d1_query_catalog.sql適用後、カタログデータのINSERTを実行してください。</div>' : ''}
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

    var tablePanelToggle = document.getElementById('tablePanelToggle');
    var tablePanel = document.getElementById('tablePanel');
    tablePanelToggle.addEventListener('click', function() {
      var expanded = tablePanelToggle.getAttribute('aria-expanded') === 'true';
      tablePanelToggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      tablePanel.hidden = expanded;
    });

    var tableCheckboxes = Array.prototype.slice.call(tablePanel.querySelectorAll('input[type="checkbox"]'));
    var verbFilter = document.getElementById('verbFilter');

    function applyFilters() {
      var selectedTables = tableCheckboxes.filter(function(cb) { return cb.checked; }).map(function(cb) { return cb.value; });
      var selectedVerbs = Array.prototype.filter.call(verbFilter.options, function(o) { return o.selected; })
        .map(function(o) { return o.value; });

      document.querySelectorAll('.table-band').forEach(function(band) {
        var table = band.getAttribute('data-table') || '';
        var tableMatches = (selectedTables.length === 0 || selectedTables.indexOf(table) !== -1);
        var anyRowVisible = false;
        band.querySelectorAll('tbody tr').forEach(function(row) {
          var verb = row.getAttribute('data-verb') || '';
          var verbMatches = (selectedVerbs.length === 0 || selectedVerbs.indexOf(verb) !== -1);
          var visible = tableMatches && verbMatches;
          row.style.display = visible ? '' : 'none';
          if (visible) anyRowVisible = true;
        });
        band.hidden = !anyRowVisible;
      });
    }

    tableCheckboxes.forEach(function(cb) { cb.addEventListener('change', applyFilters); });
    verbFilter.addEventListener('change', applyFilters);
  </script>
</body>
</html>`;
}
