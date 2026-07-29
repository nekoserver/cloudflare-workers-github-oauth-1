import { escapeHtml } from '../utils/html';

export interface HarnessHookLogRow {
  id: number;
  hook_event: string;
  check_name: string;
  tool_name: string | null;
  file_path: string | null;
  result: string;
  detail: string | null;
  session_id: string | null;
  created_at: string;
}

export interface HarnessLogResultCounts {
  ok: number;
  ng: number;
  error: number;
}

export interface HarnessLogPageInput {
  rows: HarnessHookLogRow[];
  counts: HarnessLogResultCounts;
  selectedResult: string;
  tableMissing: boolean;
}

function resultBadge(result: string): string {
  if (result === 'ok') return '<span class="badge badge-ok">OK</span>';
  if (result === 'ng') return '<span class="badge badge-ng">NG</span>';
  if (result === 'error') return '<span class="badge badge-error">ERROR</span>';
  return `<span class="badge badge-none">${escapeHtml(result)}</span>`;
}

function formatTimestamp(ts: string): string {
  return ts.replace('T', ' ').slice(0, 19);
}

export function getHarnessLogPage(input: HarnessLogPageInput): string {
  const { rows, counts, selectedResult, tableMissing } = input;

  const resultOptions = ['all', 'ok', 'ng', 'error'].map((v) => {
    const label = v === 'all' ? `すべて (${counts.ok + counts.ng + counts.error})` : v === 'ok' ? `OK (${counts.ok})` : v === 'ng' ? `NG (${counts.ng})` : `ERROR (${counts.error})`;
    return `<option value="${v}"${selectedResult === v ? ' selected' : ''}>${label}</option>`;
  }).join('\n');

  const tableRows = rows.map((r) => `
    <tr>
      <td class="col-ts">${escapeHtml(formatTimestamp(r.created_at))}</td>
      <td>${resultBadge(r.result)}</td>
      <td>${escapeHtml(r.hook_event)}</td>
      <td>${escapeHtml(r.check_name)}</td>
      <td>${r.tool_name ? escapeHtml(r.tool_name) : '—'}</td>
      <td class="col-path">${r.file_path ? escapeHtml(r.file_path) : '—'}</td>
      <td class="col-detail">${r.detail ? escapeHtml(r.detail) : '—'}</td>
      <td class="col-session">${r.session_id ? escapeHtml(r.session_id) : '—'}</td>
    </tr>`).join('\n');

  const bodyContent = tableMissing
    ? `<div class="empty-state">
        <p>harness_hook_log テーブルがまだ存在しません。</p>
        <p class="empty-hint">migrations/0083_create_harness_hook_log.sql のSQLをD1コンソールで実行してください。</p>
      </div>`
    : rows.length === 0
      ? `<div class="empty-state"><p>該当するログがありません。</p></div>`
      : `<div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>日時</th>
                <th>結果</th>
                <th>イベント</th>
                <th>チェック名</th>
                <th>ツール</th>
                <th>ファイル</th>
                <th>詳細</th>
                <th>セッション</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Harnessフックログ</title>
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
      --ok-bg:       light-dark(#dafbe1, #0d2818);
      --ok-fg:       light-dark(#1a7f37, #3fb950);
      --ng-bg:       light-dark(#ffebe9, #2d0e0a);
      --ng-fg:       light-dark(#cf222e, #f85149);
      --error-bg:    light-dark(#fff8c5, #2d2a00);
      --error-fg:    light-dark(#7d4e00, #e3b341);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 24px;
      background: var(--bg); color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px; line-height: 1.5;
    }
    h1 { color: var(--text-strong); font-size: 20px; margin: 0 0 6px; }
    .subtitle { color: var(--text-muted); font-size: 12px; margin-bottom: 18px; }
    .toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
    .toolbar label { color: var(--text-muted); font-size: 12px; }
    .toolbar select {
      padding: 5px 8px; border-radius: 6px;
      border: 2px solid var(--border);
      background: var(--panel); color: var(--text);
      font-size: 12px;
    }
    .table-wrap {
      overflow-x: auto; border: 1px solid var(--border); border-radius: 8px;
      background: var(--panel);
    }
    table { border-collapse: collapse; width: 100%; min-width: 900px; }
    th {
      background: var(--th-bg); color: var(--text-muted);
      text-align: left; font-weight: 600; font-size: 11px;
      text-transform: uppercase; letter-spacing: .03em;
      padding: 8px 10px; border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }
    td {
      padding: 7px 10px; border-bottom: 1px solid var(--border);
      color: var(--text); vertical-align: top;
    }
    tr:last-child td { border-bottom: none; }
    .col-ts { white-space: nowrap; color: var(--text-muted); font-variant-numeric: tabular-nums; }
    .col-path, .col-detail { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; word-break: break-word; }
    .col-session { color: var(--text-muted); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; }
    .badge {
      display: inline-block; font-size: 11px; font-weight: 700;
      padding: 2px 8px; border-radius: 10px; white-space: nowrap;
    }
    .badge-ok { background: var(--ok-bg); color: var(--ok-fg); }
    .badge-ng { background: var(--ng-bg); color: var(--ng-fg); }
    .badge-error { background: var(--error-bg); color: var(--error-fg); }
    .badge-none { background: var(--th-bg); color: var(--text-muted); }
    .empty-state {
      border: 1px solid var(--border); border-radius: 8px; background: var(--panel);
      padding: 32px 16px; text-align: center; color: var(--text-muted);
    }
    .empty-hint { font-size: 12px; margin-top: 6px; }
  </style>
</head>
<body>
  <h1>🪝 Harnessフックログ</h1>
  <p class="subtitle">PostToolUseフック（migrationファイルのテーブル登録チェック等）の発火結果ログ</p>

  <form class="toolbar" method="get" action="/harness-log">
    <label for="resultSelect">結果:</label>
    <select id="resultSelect" name="result" onchange="this.form.submit()">
      ${resultOptions}
    </select>
  </form>

  ${bodyContent}
</body>
</html>`;
}
