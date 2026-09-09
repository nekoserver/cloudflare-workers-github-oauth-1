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
  last_commit_at: string | null;
};

export type D1QueryCatalogTableClassification = {
  group: string;
  groupLabel: string;
  color: string;
  fkRole: 'none' | 'source' | 'target' | 'both';
};

function commitLink(hash: string): string {
  const short = escapeHtml(hash.slice(0, 7));
  const url = `https://github.com/${OWNER_REPO}/commit/${escapeHtml(hash)}`;
  return `<a href="${url}" target="_blank" rel="noopener noreferrer"><code>${short}</code></a>`;
}

const SQL_KEYWORDS = new Set([
  'ABORT', 'ACTION', 'ADD', 'AFTER', 'ALL', 'ALTER', 'ANALYZE', 'AND', 'AS', 'ASC', 'ATTACH',
  'AUTOINCREMENT', 'BEFORE', 'BEGIN', 'BETWEEN', 'BY', 'CASCADE', 'CASE', 'CAST', 'CHECK',
  'COLLATE', 'COLUMN', 'COMMIT', 'CONFLICT', 'CONSTRAINT', 'CREATE', 'CROSS', 'CURRENT_DATE',
  'CURRENT_TIME', 'CURRENT_TIMESTAMP', 'DATABASE', 'DEFAULT', 'DEFERRABLE', 'DEFERRED', 'DELETE',
  'DESC', 'DETACH', 'DISTINCT', 'DO', 'DROP', 'EACH', 'ELSE', 'END', 'ESCAPE', 'EXCEPT',
  'EXCLUDE', 'EXCLUSIVE', 'EXISTS', 'EXPLAIN', 'FAIL', 'FILTER', 'FIRST', 'FOLLOWING', 'FOR',
  'FOREIGN', 'FROM', 'FULL', 'GENERATED', 'GLOB', 'GROUP', 'GROUPS', 'HAVING', 'IF', 'IGNORE',
  'IMMEDIATE', 'IN', 'INDEX', 'INDEXED', 'INITIALLY', 'INNER', 'INSERT', 'INSTEAD', 'INTERSECT',
  'INTO', 'IS', 'ISNULL', 'JOIN', 'KEY', 'LAST', 'LEFT', 'LIKE', 'LIMIT', 'MATCH', 'MATERIALIZED',
  'NATURAL', 'NO', 'NOT', 'NOTHING', 'NOTNULL', 'NULL', 'NULLS', 'OF', 'OFFSET', 'ON', 'OR',
  'ORDER', 'OTHERS', 'OUTER', 'OVER', 'PARTITION', 'PLAN', 'PRAGMA', 'PRECEDING', 'PRIMARY',
  'QUERY', 'RAISE', 'RANGE', 'RECURSIVE', 'REFERENCES', 'REGEXP', 'REINDEX', 'RELEASE', 'RENAME',
  'REPLACE', 'RESTRICT', 'RETURNING', 'RIGHT', 'ROLLBACK', 'ROW', 'ROWS', 'SAVEPOINT', 'SELECT',
  'SET', 'TABLE', 'TEMP', 'TEMPORARY', 'THEN', 'TIES', 'TO', 'TRANSACTION', 'TRIGGER', 'UNBOUNDED',
  'UNION', 'UNIQUE', 'UPDATE', 'USING', 'VACUUM', 'VALUES', 'VIEW', 'VIRTUAL', 'WHEN', 'WHERE',
  'WINDOW', 'WITH', 'WITHOUT',
]);

/** Escapes SQL and wraps SQLite tokens without ever interpreting SQL as HTML. */
function highlightSql(sql: string): string {
  const tokenPattern = /(--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[(?:\]\]|[^\]])*\]|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b|[?:@$][A-Za-z0-9_]*)/g;
  let result = '';
  let lastIndex = 0;
  for (const match of sql.matchAll(tokenPattern)) {
    const token = match[0];
    const index = match.index ?? 0;
    result += escapeHtml(sql.slice(lastIndex, index));
    let type = '';
    if (token.startsWith('--') || token.startsWith('/*')) type = 'comment';
    else if (/^['"`\[]/.test(token)) type = 'string';
    else if (/^\d/.test(token)) type = 'number';
    else if (/^[?:@$]/.test(token)) type = 'parameter';
    else if (SQL_KEYWORDS.has(token.toUpperCase())) type = 'keyword';
    result += type ? `<span class="sql-token sql-${type}">${escapeHtml(token)}</span>` : escapeHtml(token);
    lastIndex = index + token.length;
  }
  return result + escapeHtml(sql.slice(lastIndex));
}

function sourceColor(sourceFile: string): string {
  let hash = 0;
  for (let i = 0; i < sourceFile.length; i += 1) hash = ((hash * 31) + sourceFile.charCodeAt(i)) >>> 0;
  // ファイル名から色相を直接作ることで、固定パレットより衝突しにくく、再描画しても同色になる。
  return `hsl(${hash % 360} 68% 43%)`;
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
// テーブル選択パネル内のバッジの並び順に使う。
function tableCounts(rows: D1QueryCatalogRow[]): { table: string; count: number; sourceFile: string }[] {
  const counts = new Map<string, { count: number; sources: Map<string, number> }>();
  for (const row of rows) {
    const t = row.table_name ?? '(不明)';
    const entry = counts.get(t) ?? { count: 0, sources: new Map<string, number>() };
    entry.count += 1;
    entry.sources.set(row.source_file, (entry.sources.get(row.source_file) ?? 0) + 1);
    counts.set(t, entry);
  }
  return [...counts.entries()]
    .map(([table, entry]) => ({
      table,
      count: entry.count,
      sourceFile: [...entry.sources.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0],
    }))
    .sort((a, b) => b.count - a.count);
}

function categoryCounts(
  rows: D1QueryCatalogRow[],
  classifications: Record<string, D1QueryCatalogTableClassification>,
): { group: string; label: string; count: number; color: string }[] {
  const counts = new Map<string, { label: string; tables: Set<string>; color: string }>();
  for (const table of new Set(rows.map(row => row.table_name ?? '(不明)'))) {
    const classification = classifications[table];
    if (!classification) continue;
    const entry = counts.get(classification.group) ?? {
      label: classification.groupLabel,
      tables: new Set<string>(),
      color: classification.color,
    };
    entry.tables.add(table);
    counts.set(classification.group, entry);
  }
  return [...counts.entries()]
    .map(([group, entry]) => ({ group, label: entry.label, count: entry.tables.size, color: entry.color }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function renderRow(row: D1QueryCatalogRow): string {
  const badge = row.command_confirmed
    ? '<span class="badge badge-confirmed">確定</span>'
    : '<span class="badge badge-inferred">推測</span>';
  const verb = escapeHtml(sqlVerb(row.sql_text));
  const sqlOneLine = highlightSql(row.sql_text.replace(/\s+/g, ' ').trim().slice(0, 200));
  const migration = row.migration_file ? escapeHtml(row.migration_file) : '(なし)';
  const commit = row.last_commit_hash ? commitLink(row.last_commit_hash) : '(なし)';
  const commitAt = row.last_commit_at ? escapeHtml(row.last_commit_at) : '(なし)';
  const table = row.table_name ? escapeHtml(row.table_name) : '(不明)';
  return `<tr data-verb="${verb}">
    <td><span class="query-detail-name">${escapeHtml(row.query_name)}</span></td>
    <td>:<span class="query-detail-command">${escapeHtml(row.command)}</span> ${badge}<span class="query-detail-confirmed" hidden>${row.command_confirmed ? '確定' : '推測'}</span></td>
    <td class="commit-at-cell"><code>${commitAt}</code></td>
    <td class="sql-cell"><button type="button" class="sql-detail-button" aria-haspopup="dialog" aria-controls="sqlDetailDialog" aria-label="${escapeHtml(row.query_name)}のSQL詳細を表示"><code>${sqlOneLine}</code></button><span class="query-detail-sql" hidden>${escapeHtml(row.sql_text)}</span><span class="query-detail-sql-highlighted" hidden>${highlightSql(row.sql_text)}</span></td>
    <td><span class="query-detail-migration">${migration}</span></td>
    <td>${commit}</td>
    <td><span class="query-detail-source">${escapeHtml(row.source_file)}:${row.source_line}</span><span class="query-detail-table" hidden>${table}</span><span class="query-detail-commit-at" hidden>${commitAt}</span></td>
  </tr>`;
}

// renderTableBand: 1テーブル分のクエリ一覧を「帯(見出しバー)+その下のミニ表」として
// 描画する。行ごとに繰り返していたテーブル名を帯へ集約し、テーブル単位で
// パネルのチェックボックス選択(data-table)・全体の折りたたみ表示に使う。
function renderTableBand(table: string, rows: D1QueryCatalogRow[], classification?: D1QueryCatalogTableClassification): string {
  const rowsHtml = rows.map(renderRow).join('\n');
  const color = classification?.color ?? '#8b949e';
  const groupBadge = classification
    ? `<span class="table-group-badge" data-group="${escapeHtml(classification.group)}">${escapeHtml(classification.groupLabel)}</span>`
    : '';
  const fkLabel = classification?.fkRole === 'both' ? 'FK 参照元・先'
    : classification?.fkRole === 'source' ? 'FK 参照元'
      : classification?.fkRole === 'target' ? 'FK 参照先' : '';
  const fkBadge = fkLabel ? `<span class="table-fk-badge table-fk-${classification!.fkRole}">${fkLabel}</span>` : '';
  const headerStyle = classification ? ` style="--table-color:${escapeHtml(color)}"` : '';
  return `<section class="table-band" data-table="${escapeHtml(table)}" data-count="${rows.length}">
    <button type="button" class="band-header" aria-expanded="false"${headerStyle}>
      <span class="band-count">${rows.length}件</span>
      <span class="band-name">${escapeHtml(table)}</span>
      ${groupBadge}${fkBadge}
      <span class="band-toggle-arrow">▾</span>
    </button>
    <div class="table-wrap" hidden>
      <table>
        <thead>
          <tr>
            <th>クエリ名</th>
            <th>コマンド</th>
            <th>最終コミット日時</th>
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

export function getD1QueryCatalogPage(
  username: string,
  rows: D1QueryCatalogRow[],
  initialSort: 'name' | 'count' = 'count',
  columnCounts: Record<string, number> = {},
  singleTableSelection = true,
  tableClassifications: Record<string, D1QueryCatalogTableClassification> = {},
): string {
  const safeUsername = escapeHtml(username);
  const confirmedCount = rows.filter(r => r.command_confirmed).length;
  const verbOptionsHtml = verbCounts(rows)
    .map(({ verb, count }) => `<option value="${escapeHtml(verb)}">${escapeHtml(verb)} (${count})</option>`)
    .join('\n');
  const tableBadgesHtml = tableCounts(rows)
    .map(({ table, count, sourceFile }) => {
      const safeTable = escapeHtml(table);
      const safeSourceFile = escapeHtml(sourceFile);
      const columnCount = columnCounts[table] ?? 0;
      const classification = tableClassifications[table];
      const tableColor = classification?.color ?? sourceColor(sourceFile);
      const classificationTitle = classification
        ? ` / 分類: ${escapeHtml(classification.groupLabel)} / FK: ${classification.fkRole}`
        : '';
      return `<button type="button" class="table-filter-badge" style="--source-color:${escapeHtml(tableColor)};--origin-source-color:${sourceColor(sourceFile)}" data-table="${safeTable}" data-source-file="${safeSourceFile}" data-group="${escapeHtml(classification?.group ?? 'undefined')}" data-fk-role="${escapeHtml(classification?.fkRole ?? 'none')}" data-occurrence-count="${count}" data-column-count="${columnCount}" aria-pressed="false" title="呼び出し元: ${safeSourceFile}${classificationTitle}"><span class="table-badge-count">${count}</span><span class="table-badge-name">${safeTable}</span><span class="table-column-count" aria-label="${columnCount}カラム">${columnCount}</span></button>`;
    })
    .join('\n');
  const categoryBadgesHtml = categoryCounts(rows, tableClassifications)
    .map(({ group, label, count, color }) => `<button type="button" class="category-filter-badge" style="--category-color:${escapeHtml(color)}" data-group="${escapeHtml(group)}" aria-pressed="false"><span class="category-filter-count">${count}</span><span class="category-filter-name">${escapeHtml(label)}</span></button>`)
    .join('\n');
  const groupedTables = groupByTable(rows);
  if (initialSort === 'count') {
    groupedTables.sort((a, b) => b[1].length - a[1].length);
  }
  const bandsHtml = groupedTables
    .map(([table, tableRows]) => renderTableBand(table, tableRows, tableClassifications[table]))
    .join('\n');
  const nameSortPressed = initialSort === 'name' ? 'true' : 'false';
  const countSortPressed = initialSort === 'count' ? 'true' : 'false';
  const tableSelectionMode = singleTableSelection ? 'single' : 'multiple';

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
      position: sticky;
      top: 0;
      z-index: 200;
      background: var(--navbar-bg);
      backdrop-filter: blur(10px);
      box-shadow: 0 2px 10px var(--navbar-shadow);
      padding: 0 20px;
      height: 44px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .navbar-brand { font-size: 20px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px; }
    .user-menu { display: flex; align-items: center; gap: 12px; }
    .user-name { font-size: 14px; color: var(--text-secondary); font-weight: 500; }
    .user-icon {
      width: 32px; height: 32px; border-radius: 50%;
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
    .container { max-width: 1200px; margin: 0 auto; padding: 8px 20px 20px; }
    .card {
      background: var(--card-bg);
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
      padding: 12px 16px 16px;
    }
    .catalog-layout { display: grid; grid-template-columns: minmax(170px, 220px) minmax(0, 1fr); gap: 16px; align-items: start; }
    .category-filter-sidebar { position: sticky; top: 56px; min-width: 0; padding: 12px; border: 1px solid var(--border-color); border-radius: 10px; background: var(--bg-secondary); }
    .category-filter-title { margin-bottom: 9px; color: var(--text-secondary); font-size: 12px; font-weight: 700; }
    .category-filter-list { display: flex; flex-direction: column; gap: 6px; }
    .category-filter-badge { display: flex; align-items: center; width: 100%; min-width: 0; padding: 0; border: 1px solid var(--category-color); border-radius: 999px; background: color-mix(in srgb, var(--category-color) 12%, var(--card-bg)); color: var(--text-primary); cursor: pointer; font-family: inherit; text-align: left; }
    .category-filter-badge:hover, .category-filter-badge:focus-visible { outline: none; box-shadow: 0 0 0 2px color-mix(in srgb, var(--category-color) 35%, transparent); }
    .category-filter-badge[aria-pressed="true"] { background: var(--category-color); color: white; }
    .category-filter-count { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; flex: 0 0 28px; border-right: 1px solid var(--category-color); border-radius: 50%; font-size: 11px; font-weight: 800; font-variant-numeric: tabular-nums; }
    .category-filter-name { min-width: 0; padding: 5px 8px; overflow: hidden; font-size: 12px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
    .category-filter-empty { color: var(--text-muted); font-size: 12px; line-height: 1.5; }
    .catalog-main { min-width: 0; }
    .summary { font-size: 13px; color: var(--text-muted); margin-bottom: 8px; }
    .filter-label { font-size: 12px; color: var(--text-muted); margin-bottom: 4px; }
    .catalog-filter-toolbar { display: flex; align-items: flex-start; justify-content: flex-start; gap: 12px; margin-bottom: 8px; }
    .verb-filter-control { flex: 0 1 320px; min-width: 0; }
    .panel-toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      width: auto;
      padding: 10px 12px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: var(--bg-secondary);
      color: var(--text-primary);
      font-size: 14px;
      font-family: inherit;
      cursor: pointer;
      margin-top: 20px;
      text-align: left;
    }
    .panel-toggle:hover { border-color: var(--accent-color); }
    .panel-toggle[aria-pressed="true"] { background: var(--accent-color, #667eea); color: white; border-color: var(--accent-color, #667eea); }
    .panel-toggle-arrow { margin-left: auto; transition: transform 0.15s; }
    .panel-toggle[aria-expanded="true"] .panel-toggle-arrow { transform: rotate(180deg); }
    .filter-panel {
      width: 100%;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: color-mix(in srgb, var(--card-bg) 88%, var(--accent-color, #667eea));
      padding: 12px;
      margin: 0 0 12px;
      box-shadow: inset 0 1px 0 color-mix(in srgb, white 35%, transparent);
    }
    .filter-panel-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
    .filter-panel-header .filter-label { margin-bottom: 0; }
    .filter-panel-actions { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; }
    .table-filter-clear, .panel-sort-toggle { padding: 4px 9px; border: 1px solid var(--border-color); border-radius: 999px; background: var(--card-bg); color: var(--text-primary); cursor: pointer; font-size: 12px; }
    .table-filter-clear:hover, .table-filter-clear:focus-visible, .panel-sort-toggle:hover, .panel-sort-toggle:focus-visible { border-color: var(--accent-color); }
    .table-badge-list {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-start;
      column-gap: 8px;
      row-gap: 1px;
    }
    .table-filter-badge {
      --badge-middle: color-mix(in srgb, var(--source-color) 48%, var(--card-bg));
      --badge-foreground: color-mix(in srgb, var(--source-color) 72%, var(--text-primary));
      border: 0;
      background: transparent;
      padding: 1px;
      font-size: 11px;
      color: var(--text-primary);
      font-family: 'Monaco', 'Courier New', monospace;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.16));
    }
    .table-filter-badge:hover, .table-filter-badge:focus-visible { filter: brightness(1.12) drop-shadow(0 2px 2px rgba(0, 0, 0, 0.2)); outline: none; }
    .table-filter-badge[aria-pressed="true"] .table-badge-name,
    .table-filter-badge[aria-pressed="true"] .table-badge-count,
    .table-filter-badge[aria-pressed="true"] .table-column-count { background: var(--source-color); color: white; }
    .table-badge-list.has-selection .table-filter-badge:not([aria-pressed="true"]) {
      --source-color: color-mix(in srgb, var(--text-muted) 42%, var(--card-bg));
      --badge-middle: color-mix(in srgb, var(--text-muted) 24%, var(--card-bg));
      --badge-foreground: var(--text-muted);
      filter: grayscale(1);
      opacity: 0.68;
    }
    .table-badge-count {
      width: 29px; height: 29px; border: 2px solid var(--source-color); border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto;
      padding: 1px; background: var(--badge-middle); color: var(--badge-foreground); font-weight: 800; z-index: 1;
    }
    .table-badge-name {
      min-height: 29px; display: inline-flex; align-items: center; padding: 1px;
      margin-left: -5px; background: var(--badge-middle); color: var(--badge-foreground);
      border: 2px solid var(--source-color); border-radius: 0 999px 999px 0; font-weight: 700;
    }
    .table-column-count {
      min-width: 22px; min-height: 22px; margin-left: 3px; padding: 1px 4px;
      display: inline-flex; align-items: center; justify-content: center;
      border: 1px solid var(--source-color); border-radius: 999px;
      background: var(--badge-middle); color: var(--badge-foreground);
      font: 8px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
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
      margin-bottom: 0;
    }
    select#verbFilter option { padding: 4px 6px; }
    .filter-hint { font-size: 12px; color: var(--text-muted); margin: 0 0 8px; }
    .band-sort-controls { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .sort-btn {
      padding: 4px 10px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: var(--bg-secondary);
      color: var(--text-secondary);
      font-size: 12px;
      font-family: inherit;
      cursor: pointer;
    }
    .sort-btn[aria-pressed="true"] { background: var(--accent-color, #667eea); color: white; border-color: var(--accent-color, #667eea); }
    .table-band { margin-bottom: 1px; }
    .band-header {
      display: flex;
      align-items: baseline;
      gap: 8px;
      width: 100%;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 8px 12px;
      font-family: inherit;
      cursor: pointer;
    }
    .band-header:hover { background: var(--border-color); }
    .band-header[aria-expanded="true"] { border-radius: 8px 8px 0 0; }
    .band-name { font-family: 'Monaco', 'Courier New', monospace; font-weight: 700; color: var(--table-color, var(--text-primary)); font-size: 14px; }
    .table-group-badge, .table-fk-badge {
      border-radius: 999px; padding: 2px 7px; font-size: 10px; font-weight: 700;
    }
    .table-group-badge { color: var(--table-color); border: 1px solid var(--table-color); background: color-mix(in srgb, var(--table-color) 12%, transparent); }
    .table-fk-badge { color: light-dark(#9a4d00, #ffb86b); border: 1px solid #ed8936; background: light-dark(#fff3e6, #382515); }
    .table-fk-target { border-style: dashed; }
    .table-fk-both { box-shadow: inset 0 -2px 0 #ed8936; }
    .band-count {
      font-size: 12px;
      color: var(--text-muted);
      min-width: 48px;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .band-toggle-arrow { margin-left: auto; color: var(--text-muted); transition: transform 0.15s; }
    .band-header[aria-expanded="true"] .band-toggle-arrow { transform: rotate(180deg); }
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
    .sql-token { font-weight: 600; }
    .sql-keyword { color: #7c3aed; font-weight: 800; }
    .sql-string { color: #047857; }
    .sql-number { color: #c2410c; }
    .sql-comment { color: var(--text-muted); font-style: italic; }
    .sql-parameter { color: #0369a1; font-weight: 700; }
    [data-theme="dark"] .sql-keyword { color: #c4b5fd; }
    [data-theme="dark"] .sql-string { color: #6ee7b7; }
    [data-theme="dark"] .sql-number { color: #fdba74; }
    [data-theme="dark"] .sql-parameter { color: #7dd3fc; }
    .sql-cell { white-space: nowrap; }
    .sql-detail-button { appearance: none; border: 0; background: transparent; color: inherit; padding: 0; cursor: pointer; text-align: left; }
    .sql-detail-button:hover code, .sql-detail-button:focus-visible code { color: var(--accent-color); text-decoration: underline; }
    .commit-at-cell { white-space: nowrap; }
    .badge {
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
      margin-left: 4px;
    }
    .badge-confirmed { background: #dcfce7; color: #166534; }
    .badge-inferred { background: #fef3c7; color: #92400e; }
    .empty-state { color: var(--text-muted); font-size: 13px; padding: 24px 0; text-align: center; }
    .sql-detail-dialog { width: min(760px, calc(100vw - 32px)); max-height: calc(100vh - 48px); margin: auto; padding: 0; border: 1px solid var(--border-color); border-radius: 14px; background: var(--card-bg); color: var(--text-primary); box-shadow: 0 18px 50px var(--card-shadow); }
    .sql-detail-dialog::backdrop { background: var(--modal-overlay); }
    .sql-detail-header, .sql-detail-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 20px; background: var(--bg-secondary); }
    .sql-detail-header { border-bottom: 1px solid var(--border-color); }
    .sql-detail-footer { border-top: 1px solid var(--border-color); justify-content: flex-end; flex-wrap: wrap; }
    .sql-detail-title { font-size: 18px; }
    .sql-detail-body { padding: 20px; overflow-y: auto; }
    .sql-detail-meta { display: grid; grid-template-columns: 150px 1fr; gap: 8px 12px; margin-bottom: 18px; font-size: 13px; }
    .sql-detail-meta dt { color: var(--text-muted); }
    .sql-detail-meta dd { color: var(--text-primary); word-break: break-word; }
    .sql-detail-section { margin-top: 16px; }
    .sql-detail-section-title { font-size: 12px; color: var(--text-muted); margin-bottom: 6px; }
    .sql-detail-help { font-size: 12px; line-height: 1.6; color: var(--text-muted); margin-bottom: 8px; }
    .sql-detail-code { margin: 0; padding: 12px; overflow: auto; border: 1px solid var(--border-color); border-radius: 8px; background: var(--code-bg); color: var(--text-primary); white-space: pre-wrap; word-break: break-word; font: 12px/1.6 'Monaco', 'Courier New', monospace; }
    .sql-detail-status { font-size: 13px; color: var(--text-muted); }
    .sql-detail-status.ready { color: var(--success-color); }
    .sql-detail-status.error { color: var(--danger-color); }
    .sql-detail-tools { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
    .sql-detail-tool { border: 1px solid var(--accent-color); border-radius: 7px; padding: 8px 12px; background: var(--bg-secondary); color: var(--text-primary); cursor: pointer; font: 12px/1.4 'Monaco', 'Courier New', monospace; }
    .sql-detail-tool:hover, .sql-detail-tool:focus-visible { background: var(--accent-color); color: white; }
    .sql-detail-tool:disabled { cursor: wait; opacity: 0.7; }
    .sql-dialect-result { margin-top: 10px; }
    .sql-dialect-result-title { margin: 12px 0 6px; color: var(--text-muted); font-size: 12px; }
    .sql-dialect-legend { margin: 0 0 6px; color: var(--text-muted); font-size: 12px; }
    .sql-dialect-difference { padding: 1px 2px; border-radius: 3px; background: #fde047; color: #713f12; box-shadow: inset 0 -2px 0 #e11d48; font-weight: 800; }
    [data-theme="dark"] .sql-dialect-difference { background: #9a3412; color: #fff7ed; box-shadow: inset 0 -2px 0 #fbbf24; }
    .sql-detail-action, .sql-detail-close { border: 1px solid var(--border-color); border-radius: 7px; padding: 8px 12px; background: var(--bg-secondary); color: var(--text-primary); cursor: pointer; font-family: inherit; }
    .sql-detail-action:hover, .sql-detail-close:hover { border-color: var(--accent-color); }
    @media (max-width: 600px) {
      .catalog-layout { grid-template-columns: 1fr; gap: 10px; }
      .category-filter-sidebar { position: static; }
      .category-filter-list { flex-flow: row wrap; }
      .category-filter-badge { width: auto; max-width: 100%; }
      .catalog-filter-toolbar { flex-wrap: wrap; gap: 4px 8px; }
      .verb-filter-control { flex-basis: calc(100% - 8px); }
      .panel-toggle { margin-top: 0; }
      .sql-detail-meta { grid-template-columns: 1fr; gap: 2px; }
      .sql-detail-meta dd { margin-bottom: 8px; }
    }
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
      <div class="catalog-layout">
        <aside class="category-filter-sidebar" aria-label="外部キー分類カテゴリによる絞り込み">
          <div class="category-filter-title">外部キー分類カテゴリ</div>
          <div class="category-filter-list">
            ${categoryBadgesHtml || '<div class="category-filter-empty">分類カテゴリがありません</div>'}
          </div>
        </aside>
        <main class="catalog-main">
      <div class="catalog-filter-toolbar">
        <div class="verb-filter-control">
          <div class="filter-label">発行SQLで横断検索(出現回数の多い順、複数選択可)</div>
          <select id="verbFilter" multiple size="6">
            ${verbOptionsHtml}
          </select>
        </div>
        <button type="button" class="panel-toggle" id="tablePanelToggle" aria-expanded="false" aria-pressed="false" aria-controls="tablePanel">
          <span>テーブルで絞り込み</span>
          <span class="panel-toggle-arrow">▾</span>
        </button>
      </div>
      <div class="filter-panel" id="tablePanel" hidden>
        <div class="filter-panel-header">
          <div class="filter-label">出現回数（テーブル名・カラム数）— <span id="tableSelectionRule">${singleTableSelection ? '1つのみ選択可（デフォルト）' : '複数選択可'}</span></div>
          <div class="filter-panel-actions">
            <button type="button" class="table-filter-clear" id="tableFilterClear">すべて解除</button>
            <button type="button" class="panel-sort-toggle" id="tableBadgeSortToggle" data-sort="occurrence" aria-label="テーブルの並び替え基準を切り替える">出現回数 / カラム数</button>
          </div>
        </div>
        <div class="table-badge-list">
          ${tableBadgesHtml}
        </div>
      </div>

      <div class="filter-hint">テーブル名を決め打ちせず、発行しているSQL種別(INSERT/SELECT/UPDATE等)だけで全テーブル横断検索する場合はこちらを使う。両方指定した場合はAND条件になる</div>
      <div class="summary">${rows.length}件中、コマンド種別確定済み${confirmedCount}件(sqlcパーサーで検証済み)</div>

      <div class="band-sort-controls">
        <span class="filter-label">並び替え:</span>
        <button type="button" class="sort-btn" data-sort="name" aria-pressed="${nameSortPressed}">テーブル名順</button>
        <button type="button" class="sort-btn" data-sort="count" aria-pressed="${countSortPressed}">件数の多い順</button>
      </div>
      <div id="tableBands">
        ${bandsHtml}
      </div>
      ${rows.length === 0 ? '<div class="empty-state">データがありません。migrations/0129_create_d1_query_catalog.sql適用後、カタログデータのINSERTを実行してください。</div>' : ''}
        </main>
      </div>
    </div>
  </div>

  <dialog id="sqlDetailDialog" class="sql-detail-dialog" aria-labelledby="sqlDetailTitle">
    <div class="sql-detail-header">
      <h2 class="sql-detail-title" id="sqlDetailTitle">SQL詳細・sqlc/WASM軽量チェック</h2>
      <button type="button" class="sql-detail-close" id="closeSqlDetailButton" aria-label="SQL詳細を閉じる">閉じる</button>
    </div>
    <div class="sql-detail-body">
      <dl class="sql-detail-meta">
        <dt>クエリ名</dt><dd id="sqlDetailName"></dd>
        <dt>コマンド</dt><dd id="sqlDetailCommand"></dd>
        <dt>テーブル</dt><dd id="sqlDetailTable"></dd>
        <dt>ソース位置</dt><dd id="sqlDetailSource"></dd>
        <dt>migration</dt><dd id="sqlDetailMigration"></dd>
        <dt>最終コミット日時</dt><dd id="sqlDetailCommitAt"></dd>
      </dl>
      <div class="sql-detail-section">
        <div class="sql-detail-section-title">SQL全文</div>
        <pre class="sql-detail-code" id="sqlDetailSql"></pre>
      </div>
      <div class="sql-detail-section">
        <div class="sql-detail-section-title">sqlc parse・方言比較</div>
        <p class="sql-detail-help">SQLite(D1)の解析出力を表示するか、同じクエリをPostgreSQLで使う場合のプレースホルダーと代表的な方言差をモーダル内で確認できます。ブラウザ版は軽量検査であり、DBへの問い合わせ、スキーマ照合、完全なsqlc構文解析は行いません。</p>
        <div class="sql-detail-tools">
          <button type="button" class="sql-detail-tool" id="parseD1SqlButton">sqlc parse --dialect SQLite(D1) ▶</button>
          <button type="button" class="sql-detail-tool" id="comparePostgresButton">PostgreSQLとの差分を調べる</button>
        </div>
        <div class="sql-detail-status" id="sqlDetailWasmStatus" aria-live="polite">実行する検査を選択してください。</div>
        <pre class="sql-detail-code" id="sqlDetailResult" hidden></pre>
        <div class="sql-dialect-result" id="postgresComparison" hidden>
          <div class="sql-dialect-result-title">PostgreSQL向けクエリ候補</div>
          <p class="sql-dialect-legend"><span class="sql-dialect-difference">強調表示</span> はD1クエリから変換された箇所、またはPostgreSQLとの方言差がある箇所です。</p>
          <pre class="sql-detail-code" id="postgresSql"></pre>
          <div class="sql-dialect-result-title">検出した差分・確認事項</div>
          <ul class="sql-detail-help" id="postgresDifferences"></ul>
        </div>
      </div>
    </div>
    <div class="sql-detail-footer">
      <button type="button" class="sql-detail-action" id="copySqlButton">SQLをコピー</button>
      <button type="button" class="sql-detail-action" id="copySqlcButton">sqlc形式をコピー</button>
    </div>
  </dialog>

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

    var sqlDetailDialog = document.getElementById('sqlDetailDialog');
    var sqlDetailWasmStatus = document.getElementById('sqlDetailWasmStatus');
    var sqlDetailResult = document.getElementById('sqlDetailResult');
    var parseD1SqlButton = document.getElementById('parseD1SqlButton');
    var postgresComparison = document.getElementById('postgresComparison');
    var currentSql = '';
    var currentSqlcInput = '';
    var lastSqlDetailTrigger = null;
    var sqlcWasmPromise = null;
    var sqlDetailRequestId = 0;

    function getNextZ() {
      var staticZDefaults = { sqlDetailDialog: 1000 };
      var max = 900;
      document.querySelectorAll('*').forEach(function(el) {
        if (window.getComputedStyle(el).position !== 'fixed') return;
        var z = parseInt(window.getComputedStyle(el).zIndex, 10);
        if (!isNaN(z) && z > max) max = z;
      });
      Object.keys(staticZDefaults).forEach(function(id) {
        var el = document.getElementById(id);
        var z = el ? parseInt(el.style.zIndex, 10) : NaN;
        if (!isNaN(z) && z > max) max = z;
        if (isNaN(z) && staticZDefaults[id] > max) max = staticZDefaults[id];
      });
      return max + 100;
    }

    function ensureSqlcWasm() {
      if (typeof globalThis.sqlcParseQueryAnnotations === 'function') return Promise.resolve();
      if (!sqlcWasmPromise) {
        sqlcWasmPromise = (async function() {
          await import('/wasm/sqlc-wasm_exec.js');
          var go = new Go();
          var result = await WebAssembly.instantiateStreaming(fetch('/wasm/sqlc.wasm'), go.importObject);
          go.run(result.instance);
          if (typeof globalThis.sqlcParseQueryAnnotations !== 'function') {
            throw new Error('sqlcParseQueryAnnotationsが登録されませんでした');
          }
        })().catch(function(error) {
          sqlcWasmPromise = null;
          throw error;
        });
      }
      return sqlcWasmPromise;
    }

    function rowText(row, selector) {
      var el = row.querySelector(selector);
      return el ? (el.textContent || '') : '';
    }

    async function runD1Parse() {
      var requestId = ++sqlDetailRequestId;
      var sqlcInput = currentSqlcInput;
      parseD1SqlButton.disabled = true;
      sqlDetailResult.hidden = true;
      sqlDetailWasmStatus.textContent = 'sqlc/WASMを読み込み、SQLite(D1)として軽量検査しています…';
      sqlDetailWasmStatus.className = 'sql-detail-status';
      try {
        await ensureSqlcWasm();
        if (requestId !== sqlDetailRequestId) return;
        var markdown = globalThis.sqlcParseQueryAnnotations(sqlcInput);
        sqlDetailResult.textContent = markdown;
        sqlDetailResult.hidden = false;
        sqlDetailWasmStatus.textContent = markdown.indexOf('エラー:') === -1 ? 'SQLite(D1)軽量検査完了: アノテーションエラーはありません。' : 'SQLite(D1)軽量検査完了: エラーがあります。';
        sqlDetailWasmStatus.className = markdown.indexOf('エラー:') === -1 ? 'sql-detail-status ready' : 'sql-detail-status error';
      } catch (error) {
        if (requestId !== sqlDetailRequestId) return;
        sqlDetailWasmStatus.textContent = 'sqlc/WASMの読み込みまたは検査に失敗しました: ' + (error && error.message ? error.message : String(error));
        sqlDetailWasmStatus.className = 'sql-detail-status error';
      } finally {
        if (requestId === sqlDetailRequestId) parseD1SqlButton.disabled = false;
      }
    }

    function postgresCandidate(sql) {
      var parameterIndex = 0;
      var outputDelta = 0;
      var ranges = [];
      var candidate = sql.replace(/\\?(\\d+)?/g, function(match, explicitIndex, inputOffset) {
        var replacement;
        if (explicitIndex) replacement = '$' + explicitIndex;
        else {
          parameterIndex += 1;
          replacement = '$' + parameterIndex;
        }
        var outputOffset = inputOffset + outputDelta;
        ranges.push({ start: outputOffset, end: outputOffset + replacement.length });
        outputDelta += replacement.length - match.length;
        return replacement;
      });
      return { sql: candidate, ranges: ranges };
    }

    function addDialectRanges(sql, ranges) {
      [
        /\\bINSERT\\s+OR\\s+(?:IGNORE|REPLACE)\\b/gi,
        /\\b(?:datetime|date|strftime)\\s*\\(/gi,
        /\\bgroup_concat\\s*\\(/gi,
        /\\bjson_(?:extract|array_length|each)\\s*\\(/gi,
        /\\bAUTOINCREMENT\\b/gi,
        /\\bCOLLATE\\s+NOCASE\\b/gi
      ].forEach(function(pattern) {
        var match;
        while ((match = pattern.exec(sql)) !== null) ranges.push({ start: match.index, end: match.index + match[0].length });
      });
      return ranges.sort(function(a, b) { return a.start - b.start; });
    }

    function appendSqlTokens(container, sql) {
      var keywords = new Set(${JSON.stringify([...SQL_KEYWORDS])});
      var pattern = /(--[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/|'(?:''|[^'])*'|"(?:""|[^"])*"|\\x60(?:\\x60\\x60|[^\\x60])*\\x60|\\[(?:\\]\\]|[^\\]])*\\]|\\b\\d+(?:\\.\\d+)?\\b|\\b[A-Za-z_][A-Za-z0-9_]*\\b|[?:@$][A-Za-z0-9_]*)/g;
      var lastIndex = 0;
      var match;
      while ((match = pattern.exec(sql)) !== null) {
        container.appendChild(document.createTextNode(sql.slice(lastIndex, match.index)));
        var token = match[0];
        var type = '';
        if (token.indexOf('--') === 0 || token.indexOf('/*') === 0) type = 'comment';
        else if (/^['"\\x60\\[]/.test(token)) type = 'string';
        else if (/^\\d/.test(token)) type = 'number';
        else if (/^[?:@$]/.test(token)) type = 'parameter';
        else if (keywords.has(token.toUpperCase())) type = 'keyword';
        var tokenNode = document.createElement('span');
        if (type) tokenNode.className = 'sql-token sql-' + type;
        tokenNode.textContent = token;
        container.appendChild(tokenNode);
        lastIndex = match.index + token.length;
      }
      container.appendChild(document.createTextNode(sql.slice(lastIndex)));
    }

    function renderPostgresSql(sql, ranges) {
      var container = document.getElementById('postgresSql');
      container.replaceChildren();
      var boundaries = [0, sql.length];
      ranges.forEach(function(range) { boundaries.push(range.start, range.end); });
      boundaries = Array.from(new Set(boundaries)).sort(function(a, b) { return a - b; });
      for (var index = 0; index < boundaries.length - 1; index += 1) {
        var start = boundaries[index];
        var end = boundaries[index + 1];
        if (start === end) continue;
        var differs = ranges.some(function(range) { return start >= range.start && end <= range.end; });
        var target = container;
        if (differs) {
          target = document.createElement('mark');
          target.className = 'sql-dialect-difference';
          target.title = 'D1クエリとの差分';
          container.appendChild(target);
        }
        appendSqlTokens(target, sql.slice(start, end));
      }
    }

    function compareWithPostgres() {
      var differences = [];
      var candidate = postgresCandidate(currentSql);
      if (/\\?(?:\\d+)?/.test(currentSql)) differences.push('バインド変数を SQLite の ? / ?NNN から PostgreSQL の $1, $2, … 形式へ変換しました。');
      if (/\\bINSERT\\s+OR\\s+(?:IGNORE|REPLACE)\\b/i.test(currentSql)) differences.push('INSERT OR IGNORE / REPLACE はPostgreSQLでそのまま使えません。ON CONFLICT句へ書き換え、競合キーを確認してください。');
      if (/\\b(?:datetime|date|strftime)\\s*\\(/i.test(currentSql)) differences.push('SQLiteの日付関数を検出しました。PostgreSQLのCURRENT_TIMESTAMP、date_trunc、to_char等への置換を確認してください。');
      if (/\\bgroup_concat\\s*\\(/i.test(currentSql)) differences.push('group_concatはPostgreSQLでは通常string_aggへ置き換えます。区切り文字とORDER BYを確認してください。');
      if (/\\bjson_(?:extract|array_length|each)\\s*\\(/i.test(currentSql)) differences.push('SQLite JSON関数を検出しました。PostgreSQLのjsonb演算子・jsonb_*関数との戻り型の違いを確認してください。');
      if (/\\bAUTOINCREMENT\\b/i.test(currentSql)) differences.push('AUTOINCREMENTはPostgreSQLではIDENTITY列またはsequenceを使用します。');
      if (/\\bCOLLATE\\s+NOCASE\\b/i.test(currentSql)) differences.push('COLLATE NOCASEはPostgreSQLに同名の照合順序がありません。citext、ILIKE、適切なcollationを検討してください。');
      if (!differences.length) differences.push('この軽量比較で既知の表層差は検出されませんでした。型、関数、RETURNING、NULL順序、大小文字、スキーマは実際のPostgreSQLで別途検証してください。');
      renderPostgresSql(candidate.sql, addDialectRanges(candidate.sql, candidate.ranges));
      var list = document.getElementById('postgresDifferences');
      list.replaceChildren();
      differences.forEach(function(message) {
        var item = document.createElement('li');
        item.textContent = message;
        list.appendChild(item);
      });
      postgresComparison.hidden = false;
      sqlDetailWasmStatus.textContent = 'PostgreSQLとの差分候補を表示しました（軽量な表層比較）。';
      sqlDetailWasmStatus.className = 'sql-detail-status ready';
    }

    function openSqlDetail(button) {
      var row = button.closest('tr');
      if (!row) return;
      lastSqlDetailTrigger = button;
      currentSql = rowText(row, '.query-detail-sql');
      var queryName = rowText(row, '.query-detail-name');
      var command = rowText(row, '.query-detail-command');
      currentSqlcInput = '-- name: ' + queryName + ' :' + command + '\\n' + currentSql;
      ++sqlDetailRequestId;
      document.getElementById('sqlDetailName').textContent = queryName;
      document.getElementById('sqlDetailCommand').textContent = ':' + command + ' (' + rowText(row, '.query-detail-confirmed') + ')';
      document.getElementById('sqlDetailTable').textContent = rowText(row, '.query-detail-table');
      document.getElementById('sqlDetailSource').textContent = rowText(row, '.query-detail-source');
      document.getElementById('sqlDetailMigration').textContent = rowText(row, '.query-detail-migration');
      document.getElementById('sqlDetailCommitAt').textContent = rowText(row, '.query-detail-commit-at');
      var highlightedSql = row.querySelector('.query-detail-sql-highlighted');
      document.getElementById('sqlDetailSql').innerHTML = highlightedSql ? highlightedSql.innerHTML : '';
      sqlDetailResult.hidden = true;
      sqlDetailResult.textContent = '';
      postgresComparison.hidden = true;
      document.getElementById('postgresSql').textContent = '';
      document.getElementById('postgresDifferences').replaceChildren();
      parseD1SqlButton.disabled = false;
      sqlDetailWasmStatus.textContent = '実行する検査を選択してください。';
      sqlDetailWasmStatus.className = 'sql-detail-status';
      sqlDetailDialog.style.zIndex = String(getNextZ());
      if (!sqlDetailDialog.open) sqlDetailDialog.showModal();
    }

    document.querySelectorAll('.sql-detail-button').forEach(function(button) {
      button.addEventListener('click', function() { openSqlDetail(button); });
    });
    document.getElementById('closeSqlDetailButton').addEventListener('click', function() { sqlDetailDialog.close(); });
    parseD1SqlButton.addEventListener('click', runD1Parse);
    document.getElementById('comparePostgresButton').addEventListener('click', compareWithPostgres);
    sqlDetailDialog.addEventListener('close', function() {
      if (lastSqlDetailTrigger) lastSqlDetailTrigger.focus();
    });

    async function copySqlDetail(text, label) {
      try {
        await navigator.clipboard.writeText(text);
        sqlDetailWasmStatus.textContent = label + 'をコピーしました。';
        sqlDetailWasmStatus.className = 'sql-detail-status ready';
      } catch (error) {
        sqlDetailWasmStatus.textContent = label + 'のコピーに失敗しました: ' + (error && error.message ? error.message : String(error));
        sqlDetailWasmStatus.className = 'sql-detail-status error';
      }
    }
    document.getElementById('copySqlButton').addEventListener('click', function() { copySqlDetail(currentSql, 'SQL'); });
    document.getElementById('copySqlcButton').addEventListener('click', function() { copySqlDetail(currentSqlcInput, 'sqlc形式'); });

    var tablePanelToggle = document.getElementById('tablePanelToggle');
    var tablePanel = document.getElementById('tablePanel');
    function setTablePanelExpanded(expanded) {
      tablePanelToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      tablePanelToggle.setAttribute('aria-pressed', expanded ? 'true' : 'false');
      tablePanel.hidden = !expanded;
    }
    tablePanelToggle.addEventListener('click', function() {
      var expanded = tablePanelToggle.getAttribute('aria-expanded') === 'true';
      setTablePanelExpanded(!expanded);
    });
    document.addEventListener('click', function(event) {
      if (tablePanel.hidden || tablePanel.contains(event.target) || tablePanelToggle.contains(event.target)) return;
      setTablePanelExpanded(false);
    });

    var tableBadges = Array.prototype.slice.call(tablePanel.querySelectorAll('.table-filter-badge'));
    var tableBadgeList = tablePanel.querySelector('.table-badge-list');
    var verbFilter = document.getElementById('verbFilter');
    var categoryBadges = Array.prototype.slice.call(document.querySelectorAll('.category-filter-badge'));

    categoryBadges.forEach(function(badge) {
      badge.addEventListener('click', function() {
        var wasPressed = badge.getAttribute('aria-pressed') === 'true';
        categoryBadges.forEach(function(other) { other.setAttribute('aria-pressed', 'false'); });
        badge.setAttribute('aria-pressed', wasPressed ? 'false' : 'true');
        applyFilters();
      });
    });

    var tableSelectionMode = '${tableSelectionMode}';
    // 既定は単一選択。設定ページで複数選択へ変更されている場合だけ、
    // 押したバッジそれぞれの選択状態を保持する。
    tableBadges.forEach(function(badge) {
      badge.addEventListener('click', function() {
        var wasPressed = badge.getAttribute('aria-pressed') === 'true';
        if (tableSelectionMode === 'single') {
          tableBadges.forEach(function(other) { other.setAttribute('aria-pressed', 'false'); });
          badge.setAttribute('aria-pressed', wasPressed ? 'false' : 'true');
        } else {
          badge.setAttribute('aria-pressed', wasPressed ? 'false' : 'true');
        }
        applyFilters();
      });
    });

    document.getElementById('tableFilterClear').addEventListener('click', function() {
      tableBadges.forEach(function(badge) { badge.setAttribute('aria-pressed', 'false'); });
      applyFilters();
    });

    var tableBadgeSortToggle = document.getElementById('tableBadgeSortToggle');
    tableBadgeSortToggle.addEventListener('click', function() {
      var nextSort = tableBadgeSortToggle.getAttribute('data-sort') === 'occurrence' ? 'columns' : 'occurrence';
      tableBadgeSortToggle.setAttribute('data-sort', nextSort);
      tableBadgeSortToggle.setAttribute('aria-pressed', nextSort === 'columns' ? 'true' : 'false');
      tableBadgeSortToggle.textContent = nextSort === 'columns' ? 'カラム数 / 出現回数' : '出現回数 / カラム数';
      tableBadges.sort(function(a, b) {
        var attr = nextSort === 'columns' ? 'data-column-count' : 'data-occurrence-count';
        var difference = Number(b.getAttribute(attr)) - Number(a.getAttribute(attr));
        return difference || (a.getAttribute('data-table') || '').localeCompare(b.getAttribute('data-table') || '');
      });
      tableBadges.forEach(function(badge) { badge.parentNode.appendChild(badge); });
    });

    // 帯(テーブル名の見出しバー)はページ読み込み時すべて閉じている。
    // ヘッダークリックで個別に開閉できる。
    function setBandExpanded(band, expanded) {
      var header = band.querySelector('.band-header');
      var wrap = band.querySelector('.table-wrap');
      header.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      wrap.hidden = !expanded;
    }

    document.querySelectorAll('.table-band').forEach(function(band) {
      var header = band.querySelector('.band-header');
      header.addEventListener('click', function() {
        var expanded = header.getAttribute('aria-expanded') === 'true';
        setBandExpanded(band, !expanded);
      });
    });

    function applyFilters() {
      var selectedCategoryBadge = categoryBadges.find(function(badge) { return badge.getAttribute('aria-pressed') === 'true'; });
      var selectedGroup = selectedCategoryBadge ? selectedCategoryBadge.getAttribute('data-group') : null;
      var selectedTables = tableBadges.filter(function(badge) { return badge.getAttribute('aria-pressed') === 'true'; })
        .map(function(badge) { return badge.getAttribute('data-table'); });
      tableBadgeList.classList.toggle('has-selection', selectedTables.length > 0);
      var selectedBadge = tableBadges.find(function(badge) { return badge.getAttribute('aria-pressed') === 'true'; });
      var selectedTable = selectedBadge ? selectedBadge.getAttribute('data-table') : null;
      var selectedVerbs = Array.prototype.filter.call(verbFilter.options, function(o) { return o.selected; })
        .map(function(o) { return o.value; });
      var filtersActive = selectedGroup !== null || selectedTables.length > 0 || selectedVerbs.length > 0;

      document.querySelectorAll('.table-band').forEach(function(band) {
        var table = band.getAttribute('data-table') || '';
        var groupBadge = band.querySelector('.table-group-badge');
        var groupMatches = selectedGroup === null || (groupBadge && groupBadge.getAttribute('data-group') === selectedGroup);
        var tableMatches = (selectedTable === null || selectedTable === table);
        if (tableSelectionMode === 'multiple') {
          tableMatches = selectedTables.length === 0 || selectedTables.indexOf(table) !== -1;
        }
        var anyRowVisible = false;
        band.querySelectorAll('tbody tr').forEach(function(row) {
          var verb = row.getAttribute('data-verb') || '';
          var verbMatches = (selectedVerbs.length === 0 || selectedVerbs.indexOf(verb) !== -1);
          var visible = groupMatches && tableMatches && verbMatches;
          row.style.display = visible ? '' : 'none';
          if (visible) anyRowVisible = true;
        });
        band.hidden = !anyRowVisible;
        // フィルタで絞り込んだ結果を確認するたびに手動で開く手間を省くため、
        // 何らかの条件を選択して該当した帯だけは自動的に開く。
        if (filtersActive && anyRowVisible) {
          setBandExpanded(band, true);
        }
      });
    }

    verbFilter.addEventListener('change', applyFilters);

    // 帯の並び替え: テーブル名順(data-table)/ 件数の多い順(data-count、既定)。
    // 選択結果はPOST /api/preferences/d1_query_catalog_sort でD1(user_preferences)へ
    // 永続化する。次回アクセス時はサーバー側がD1の値を読んで初期表示に反映するため、
    // Cookie/localStorageは使わない(SPEC.cloudflare-workers-github-oauth-1.20260907.user-preferences.md参照)。
    var tableBandsContainer = document.getElementById('tableBands');
    var sortButtons = Array.prototype.slice.call(document.querySelectorAll('.sort-btn'));

    function persistSort(key) {
      fetch('/api/preferences/d1_query_catalog_sort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: key }),
      }).catch(function() { /* 保存に失敗しても表示上の並び替え自体は継続する */ });
    }

    function applySort(sortKey, persist) {
      var btn = null;
      for (var i = 0; i < sortButtons.length; i++) {
        if (sortButtons[i].getAttribute('data-sort') === sortKey) { btn = sortButtons[i]; break; }
      }
      if (!btn) return;
      var bands = Array.prototype.slice.call(tableBandsContainer.querySelectorAll('.table-band'));
      bands.sort(function(a, b) {
        if (sortKey === 'count') {
          return Number(b.getAttribute('data-count')) - Number(a.getAttribute('data-count'));
        }
        return (a.getAttribute('data-table') || '').localeCompare(b.getAttribute('data-table') || '');
      });
      bands.forEach(function(band) { tableBandsContainer.appendChild(band); });
      sortButtons.forEach(function(b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
      if (persist) persistSort(sortKey);
    }

    sortButtons.forEach(function(btn) {
      btn.addEventListener('click', function() {
        applySort(btn.getAttribute('data-sort'), true);
      });
    });
  </script>
</body>
</html>`;
}
