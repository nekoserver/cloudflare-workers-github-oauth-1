import { escapeHtml } from '../utils/html';

export interface FunctionChangeRow {
  commit_at: string;
  commit_hash: string;
  subject: string;
  file_path: string;
  function_name: string;
  purpose: string;
  change_type: 'add' | 'modify' | 'delete';
  lines_added: number;
  lines_deleted: number;
  impact_type: string | null;
  severity: number | null;
  contribution: number | null;
  notes: string | null;
  repo_full_name: string;
}

export interface FunctionChangelogInput {
  rows: FunctionChangeRow[];
  generatedAt: string;
  filterFile?: string;
  filterFunction?: string;
  filterImpact?: string;
}

function changeTypeBadge(t: string): string {
  if (t === 'add')    return '<span class="badge badge-add">追加</span>';
  if (t === 'delete') return '<span class="badge badge-del">削除</span>';
  return '<span class="badge badge-mod">変更</span>';
}

function impactBadge(t: string | null): string {
  if (!t) return '<span class="badge badge-none">—</span>';
  const map: Record<string, string> = {
    feature:  'badge-feature',
    bugfix:   'badge-bugfix',
    regression: 'badge-regression',
    refactor: 'badge-refactor',
    perf:     'badge-perf',
    test:     'badge-test',
    docs:     'badge-docs',
    chore:    'badge-chore',
  };
  const label: Record<string, string> = {
    feature: '機能追加', bugfix: 'バグ修正', regression: 'リグレッション',
    refactor: 'リファクタ', perf: 'パフォーマンス', test: 'テスト',
    docs: 'ドキュメント', chore: 'その他',
  };
  const cls = map[t] ?? 'badge-none';
  return `<span class="badge ${cls}">${label[t] ?? escapeHtml(t)}</span>`;
}

function severityDots(n: number | null): string {
  if (n === null) return '—';
  return '●'.repeat(n) + '○'.repeat(5 - n);
}

export function getFunctionChangelogPage(input: FunctionChangelogInput): string {
  const { rows, generatedAt } = input;

  const tableRows = rows.map(r => {
    const shortHash = r.commit_hash.slice(0, 7);
    const diffStr = r.lines_added || r.lines_deleted
      ? `<span class="lines-add">+${r.lines_added}</span> <span class="lines-del">-${r.lines_deleted}</span>`
      : '—';
    const notesCell = r.notes
      ? `<span class="notes-text" title="${escapeHtml(r.notes)}">${escapeHtml(r.notes.slice(0, 60))}${r.notes.length > 60 ? '…' : ''}</span>`
      : '—';
    return `<tr data-file="${escapeHtml(r.file_path.toLowerCase())}" data-func="${escapeHtml(r.function_name.toLowerCase())}" data-impact="${escapeHtml(r.impact_type ?? '')}">
      <td class="col-date">${escapeHtml(r.commit_at.slice(0, 10))}</td>
      <td class="col-hash"><code title="${escapeHtml(r.commit_hash)}">${escapeHtml(shortHash)}</code><br><span class="subject">${escapeHtml(r.subject)}</span></td>
      <td class="col-file"><code>${escapeHtml(r.file_path)}</code></td>
      <td class="col-func"><code>${escapeHtml(r.function_name)}</code><br><span class="purpose">${escapeHtml(r.purpose)}</span></td>
      <td class="col-change">${changeTypeBadge(r.change_type)}<br>${diffStr}</td>
      <td class="col-impact">${impactBadge(r.impact_type)}</td>
      <td class="col-severity">${severityDots(r.severity)}</td>
      <td class="col-notes">${notesCell}</td>
    </tr>`;
  }).join('\n');

  const emptyRow = '<tr><td colspan="8" class="empty-cell">データなし — ts_commit_function_map にレコードを追加してください</td></tr>';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>関数変更ログ</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg:          light-dark(#f6f8fa, #0d1117);
      --panel:       light-dark(#ffffff, #161b22);
      --border:      light-dark(#d0d7de, #30363d);
      --text:        light-dark(#1f2328, #c9d1d9);
      --text-muted:  light-dark(#636c76, #8b949e);
      --text-strong: light-dark(#1f2328, #f0f6fc);
      --accent:      light-dark(#0969da, #58a6ff);
      --th-bg:       light-dark(#f6f8fa, #1c2128);
      --add-fg:      light-dark(#1a7f37, #3fb950);
      --del-fg:      light-dark(#cf222e, #f85149);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 24px;
      background: var(--bg); color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px; line-height: 1.5;
    }
    h1 { color: var(--text-strong); font-size: 20px; margin: 0 0 4px; }
    .subtitle { color: var(--text-muted); font-size: 12px; margin-bottom: 20px; }
    .toolbar {
      display: flex; gap: 10px; flex-wrap: wrap;
      margin-bottom: 16px; align-items: center;
    }
    .toolbar input, .toolbar select {
      padding: 6px 10px; border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--panel); color: var(--text);
      font-size: 12px;
    }
    .toolbar input { width: 220px; }
    .toolbar label { color: var(--text-muted); font-size: 12px; }
    table {
      width: 100%; border-collapse: collapse;
      background: var(--panel); border: 1px solid var(--border);
      border-radius: 8px; overflow: hidden;
    }
    th {
      background: var(--th-bg); color: var(--text-muted);
      text-align: left; padding: 8px 12px;
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }
    td {
      padding: 8px 12px; border-bottom: 1px solid var(--border);
      vertical-align: top;
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: light-dark(rgba(0,0,0,.03), rgba(255,255,255,.03)); }
    code {
      background: light-dark(#eaeef2, #0d1117);
      padding: 1px 5px; border-radius: 4px;
      font-family: 'SFMono-Regular', Consolas, monospace; font-size: 11px;
    }
    .subject { font-size: 11px; color: var(--text-muted); display: block; margin-top: 2px; }
    .purpose { font-size: 11px; color: var(--text-muted); display: block; margin-top: 2px; }
    .notes-text { color: var(--text-muted); font-size: 11px; }
    .lines-add { color: var(--add-fg); font-variant-numeric: tabular-nums; }
    .lines-del { color: var(--del-fg); font-variant-numeric: tabular-nums; }
    .col-date     { width: 90px; white-space: nowrap; }
    .col-hash     { width: 160px; }
    .col-file     { width: 200px; word-break: break-all; }
    .col-func     { width: 200px; word-break: break-all; }
    .col-change   { width: 90px; white-space: nowrap; }
    .col-impact   { width: 110px; }
    .col-severity { width: 100px; font-size: 11px; letter-spacing: -1px; color: var(--text-muted); }
    .col-notes    { min-width: 160px; }
    .badge {
      display: inline-block; padding: 2px 7px; border-radius: 10px;
      font-size: 10px; font-weight: 600; white-space: nowrap;
    }
    .badge-add        { background: rgba(63,185,80,.2);  color: #3fb950; }
    .badge-mod        { background: rgba(88,166,255,.2); color: #58a6ff; }
    .badge-del        { background: rgba(248,81,73,.2);  color: #f85149; }
    .badge-feature    { background: rgba(63,185,80,.2);  color: #3fb950; }
    .badge-bugfix     { background: rgba(248,81,73,.2);  color: #f85149; }
    .badge-regression { background: rgba(210,30,30,.35); color: #ff7b72; }
    .badge-refactor   { background: rgba(88,166,255,.2); color: #58a6ff; }
    .badge-perf       { background: rgba(210,153,34,.2); color: #e3b341; }
    .badge-test       { background: rgba(130,80,255,.2); color: #bc8cff; }
    .badge-docs       { background: rgba(139,148,158,.2);color: #8b949e; }
    .badge-chore      { background: rgba(139,148,158,.15);color:#8b949e; }
    .badge-none       { color: var(--text-muted); background: none; padding: 0; }
    .empty-cell { text-align: center; color: var(--text-muted); padding: 32px; }
    .footer {
      margin-top: 20px; color: var(--text-muted); font-size: 11px;
      border-top: 1px solid var(--border); padding-top: 12px;
    }
    a { color: var(--accent); }
    .count-label { color: var(--text-muted); font-size: 12px; margin-left: auto; }
  </style>
</head>
<body>
  <h1>関数変更ログ</h1>
  <div class="subtitle">いつ・どのファイルのどの関数に・どういう変更を加え・結果はどうだったか</div>

  <div class="toolbar">
    <label>ファイル</label>
    <input type="text" id="filterFile" placeholder="src/utils/github.ts" value="${escapeHtml(input.filterFile ?? '')}">
    <label>関数名</label>
    <input type="text" id="filterFunc" placeholder="getGitHubUser" value="${escapeHtml(input.filterFunction ?? '')}">
    <label>インパクト</label>
    <select id="filterImpact">
      <option value="">すべて</option>
      <option value="feature"${input.filterImpact === 'feature' ? ' selected' : ''}>機能追加</option>
      <option value="bugfix"${input.filterImpact === 'bugfix' ? ' selected' : ''}>バグ修正</option>
      <option value="regression"${input.filterImpact === 'regression' ? ' selected' : ''}>リグレッション</option>
      <option value="refactor"${input.filterImpact === 'refactor' ? ' selected' : ''}>リファクタ</option>
      <option value="perf"${input.filterImpact === 'perf' ? ' selected' : ''}>パフォーマンス</option>
      <option value="test"${input.filterImpact === 'test' ? ' selected' : ''}>テスト</option>
      <option value="docs"${input.filterImpact === 'docs' ? ' selected' : ''}>ドキュメント</option>
      <option value="chore"${input.filterImpact === 'chore' ? ' selected' : ''}>その他</option>
    </select>
    <span class="count-label" id="rowCount">${rows.length} 件</span>
  </div>

  <table id="changelogTable">
    <thead>
      <tr>
        <th>日付</th>
        <th>コミット</th>
        <th>ファイル</th>
        <th>関数</th>
        <th>変更種別</th>
        <th>インパクト</th>
        <th>重要度</th>
        <th>備考</th>
      </tr>
    </thead>
    <tbody id="tableBody">
      ${tableRows || emptyRow}
    </tbody>
  </table>

  <div class="footer">
    生成: ${escapeHtml(generatedAt)} &nbsp;/&nbsp;
    <a href="/status">/status</a> &nbsp;/&nbsp;
    データ投入: <code>ts_commit_function_map</code>, <code>ts_function_impact</code>
  </div>

  <script>
    var allRows = Array.from(document.querySelectorAll('#tableBody tr[data-file]'));

    function applyFilter() {
      var file   = document.getElementById('filterFile').value.toLowerCase();
      var func   = document.getElementById('filterFunc').value.toLowerCase();
      var impact = document.getElementById('filterImpact').value;
      var visible = 0;
      allRows.forEach(function(tr) {
        var f = tr.getAttribute('data-file') || '';
        var n = tr.getAttribute('data-func') || '';
        var i = tr.getAttribute('data-impact') || '';
        var show = (!file || f.indexOf(file) !== -1)
                && (!func || n.indexOf(func) !== -1)
                && (!impact || i === impact);
        tr.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      document.getElementById('rowCount').textContent = visible + ' 件';
    }

    document.getElementById('filterFile').addEventListener('input', applyFilter);
    document.getElementById('filterFunc').addEventListener('input', applyFilter);
    document.getElementById('filterImpact').addEventListener('change', applyFilter);
  </script>
</body>
</html>`;
}
