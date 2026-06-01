import { escapeHtml } from '../utils/html';
import { renderKeyPickerCss, renderKeyPickerHtml, renderKeyPickerJs } from '../utils/keywordPickerWidget';

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

export interface RepoOption {
  id: number;
  full_name: string;
}

export interface FileFunctionEntry {
  file_path: string;
  function_name: string;
  purpose: string;
}

export interface FunctionChangelogInput {
  rows: FunctionChangeRow[];
  repos: RepoOption[];
  selectedRepoId: number | null;
  availableFiles: string[];
  availableFunctions: FileFunctionEntry[];
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
    feature: 'badge-feature', bugfix: 'badge-bugfix', regression: 'badge-regression',
    refactor: 'badge-refactor', perf: 'badge-perf', test: 'badge-test',
    docs: 'badge-docs', chore: 'badge-chore',
  };
  const label: Record<string, string> = {
    feature: '機能追加', bugfix: 'バグ修正', regression: 'リグレッション',
    refactor: 'リファクタ', perf: 'パフォーマンス', test: 'テスト',
    docs: 'ドキュメント', chore: 'その他',
  };
  return `<span class="badge ${map[t] ?? 'badge-none'}">${label[t] ?? escapeHtml(t)}</span>`;
}

function severityDots(n: number | null): string {
  if (n === null) return '—';
  return '●'.repeat(n) + '○'.repeat(5 - n);
}

export function getFunctionChangelogPage(input: FunctionChangelogInput): string {
  const { rows, repos, selectedRepoId, availableFiles, availableFunctions, generatedAt } = input;
  const noRepoSelected = selectedRepoId === null;
  const selectedRepoName = repos.find(r => r.id === selectedRepoId)?.full_name ?? null;

  const repoOptions = repos.map(r =>
    `<option value="${r.id}"${selectedRepoId === r.id ? ' selected' : ''}>${escapeHtml(r.full_name)}</option>`
  ).join('\n');

  const fileOptions = availableFiles.map(f =>
    `<option value="${escapeHtml(f)}"${input.filterFile === f ? ' selected' : ''}>${escapeHtml(f)}</option>`
  ).join('\n');

  const tableRows = rows.map(r => {
    const shortHash = r.commit_hash.slice(0, 7);
    const diffStr = r.lines_added || r.lines_deleted
      ? `<span class="lines-add">+${r.lines_added}</span> <span class="lines-del">-${r.lines_deleted}</span>`
      : '—';
    const notesCell = r.notes
      ? `<span class="notes-text" title="${escapeHtml(r.notes)}">${escapeHtml(r.notes.slice(0, 60))}${r.notes.length > 60 ? '…' : ''}</span>`
      : '—';
    return `<tr data-file="${escapeHtml(r.file_path)}" data-func="${escapeHtml(r.function_name)}" data-impact="${escapeHtml(r.impact_type ?? '')}">
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

  let repoBanner = '';
  if (repos.length === 0) {
    repoBanner = `
  <div class="banner banner--error" id="repoBanner">
    <span class="banner-icon">🚫</span>
    <span class="banner-text">このページは事前にデータベース上に任意のリポジトリに定義済みの関数データが存在しなければ正常動作しません。</span>
  </div>`;
  } else if (noRepoSelected) {
    repoBanner = `
  <div class="banner banner--warn" id="repoBanner">
    <span class="banner-icon">⚠️</span>
    <span class="banner-text">このページの表示にはデータベース内に登録済みのプロジェクト（リポジトリ）の選択が必要です。右上のドロップダウンからプロジェクトを選択してください。現在 <strong>${repos.length}</strong> 件のプロジェクトが登録されています。</span>
  </div>`;
  } else {
    repoBanner = `
  <div class="banner banner--info" id="repoBanner">
    <span class="banner-text">現在 <strong>${repos.length}</strong> 件のプロジェクトが登録されています。</span>
  </div>`;
  }

  const allFunctionsJson = JSON.stringify(
    availableFunctions.map(f => ({ file: f.file_path, func: f.function_name, purpose: f.purpose }))
  );

  const dis = noRepoSelected ? ' disabled' : '';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>関数変更ログ</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg:           light-dark(#f6f8fa, #0d1117);
      --panel:        light-dark(#ffffff, #161b22);
      --border:       light-dark(#d0d7de, #30363d);
      --text:         light-dark(#1f2328, #c9d1d9);
      --text-muted:   light-dark(#636c76, #8b949e);
      --text-strong:  light-dark(#1f2328, #f0f6fc);
      --accent:       light-dark(#0969da, #58a6ff);
      --th-bg:        light-dark(#f6f8fa, #1c2128);
      --add-fg:       light-dark(#1a7f37, #3fb950);
      --del-fg:       light-dark(#cf222e, #f85149);
      --danger:       light-dark(#cf222e, #f85149);
      --danger-glow:  light-dark(rgba(207,34,46,.18), rgba(248,81,73,.22));
      --info-bg:      light-dark(#ddf4ff, #0d2136);
      --info-border:  light-dark(#54aeff, #1f6feb);
      --info-text:    light-dark(#0550ae, #79c0ff);
      --info-glow:    light-dark(rgba(84,174,255,.18), rgba(31,111,235,.22));
      --warn-bg:      light-dark(#fff8c5, #2d2a00);
      --warn-border:  light-dark(#d4a72c, #9e6a03);
      --warn-text:    light-dark(#7d4e00, #e3b341);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 24px;
      background: var(--bg); color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px; line-height: 1.5;
    }
    h1 { color: var(--text-strong); font-size: 20px; margin: 0 0 8px; }
    .subtitle-row {
      display: flex; align-items: center; gap: 12px;
      margin-bottom: 20px; flex-wrap: wrap;
    }
    .subtitle { color: var(--text-muted); font-size: 12px; flex: 1; min-width: 0; }
    .repo-selector-wrap { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .repo-selector-label { color: var(--text-muted); font-size: 12px; white-space: nowrap; }
    #repoSelect {
      padding: 5px 10px; border-radius: 6px;
      border: 2px solid var(--border);
      background: var(--panel); color: var(--text);
      font-size: 12px; min-width: 240px; transition: border-color 0.2s, box-shadow 0.2s;
    }
    #repoSelect.sel-needed {
      border-color: var(--danger);
      box-shadow: 0 0 0 3px var(--danger-glow);
      animation: pulse 1.5s ease-in-out 3;
    }
    .banner {
      display: flex; align-items: flex-start; gap: 10px;
      border-radius: 8px; padding: 10px 14px; margin-bottom: 16px;
      font-size: 12px; line-height: 1.6;
      transition: opacity 0.6s ease, max-height 0.6s ease, padding 0.6s ease, margin 0.6s ease;
      max-height: 100px; overflow: hidden;
    }
    .banner--warn  { background: var(--warn-bg); border: 1px solid var(--warn-border); color: var(--warn-text); }
    .banner--info  { background: var(--info-bg); border: 1px solid var(--info-border); color: var(--info-text); }
    .banner--error { background: light-dark(#fff0ee,#2d0e0a); border: 1px solid var(--danger); color: light-dark(#82071e,#ff7b72); }
    .banner.fading { opacity: 0; max-height: 0; padding-top: 0; padding-bottom: 0; margin-bottom: 0; }
    .banner-icon { font-size: 15px; flex-shrink: 0; margin-top: 1px; }
    .toolbar {
      display: flex; gap: 8px; flex-wrap: wrap;
      margin-bottom: 0; align-items: center;
    }
    .toolbar label { color: var(--text-muted); font-size: 12px; }
    .toolbar select {
      padding: 5px 8px; border-radius: 6px;
      border: 2px solid var(--border);
      background: var(--panel); color: var(--text);
      font-size: 12px; transition: border-color 0.2s, box-shadow 0.2s;
    }
    .toolbar select:disabled { opacity: 0.4; cursor: not-allowed; }
    #filterFile  { min-width: 260px; }
    #filterFunc  { min-width: 200px; }
    #filterImpact { min-width: 120px; }
    .sel-needed {
      border-color: var(--danger) !important;
      box-shadow: 0 0 0 3px var(--danger-glow) !important;
      animation: pulse 1.5s ease-in-out 3;
    }
    .sel-done {
      border-color: var(--info-border) !important;
      box-shadow: 0 0 0 2px var(--info-glow) !important;
    }
    @keyframes pulse {
      0%,100% { box-shadow: 0 0 0 3px var(--danger-glow); }
      50%      { box-shadow: 0 0 0 5px light-dark(rgba(207,34,46,.3),rgba(248,81,73,.35)); }
    }
    .step-banner {
      display: none; border-radius: 8px; padding: 10px 14px; margin: 12px 0;
      font-size: 12px; line-height: 1.6;
      transition: background 0.4s, border-color 0.4s, color 0.4s;
    }
    .step-banner.visible { display: block; }
    .step-banner--warn { background: var(--warn-bg); border: 1px solid var(--warn-border); color: var(--warn-text); }
    .step-banner--info { background: var(--info-bg); border: 1px solid var(--info-border); color: var(--info-text); }
    .table-wrap { opacity: ${noRepoSelected ? '0.35' : '1'}; pointer-events: ${noRepoSelected ? 'none' : 'auto'}; margin-top: 16px; }
    table { width: 100%; border-collapse: collapse; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
    th { background: var(--th-bg); color: var(--text-muted); text-align: left; padding: 8px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 1px solid var(--border); white-space: nowrap; }
    td { padding: 8px 12px; border-bottom: 1px solid var(--border); vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: light-dark(rgba(0,0,0,.03),rgba(255,255,255,.03)); }
    code { background: light-dark(#eaeef2,#0d1117); padding: 1px 5px; border-radius: 4px; font-family: 'SFMono-Regular',Consolas,monospace; font-size: 11px; }
    .subject { font-size: 11px; color: var(--text-muted); display: block; margin-top: 2px; }
    .purpose { font-size: 11px; color: var(--text-muted); display: block; margin-top: 2px; }
    .notes-text { color: var(--text-muted); font-size: 11px; }
    .lines-add { color: var(--add-fg); font-variant-numeric: tabular-nums; }
    .lines-del { color: var(--del-fg); font-variant-numeric: tabular-nums; }
    .col-date{width:90px;white-space:nowrap} .col-hash{width:160px} .col-file{width:200px;word-break:break-all}
    .col-func{width:200px;word-break:break-all} .col-change{width:90px;white-space:nowrap}
    .col-impact{width:110px} .col-severity{width:100px;font-size:11px;letter-spacing:-1px;color:var(--text-muted)} .col-notes{min-width:160px}
    .badge { display:inline-block; padding:2px 7px; border-radius:10px; font-size:10px; font-weight:600; white-space:nowrap; }
    .badge-add{background:rgba(63,185,80,.2);color:#3fb950} .badge-mod{background:rgba(88,166,255,.2);color:#58a6ff}
    .badge-del{background:rgba(248,81,73,.2);color:#f85149} .badge-feature{background:rgba(63,185,80,.2);color:#3fb950}
    .badge-bugfix{background:rgba(248,81,73,.2);color:#f85149} .badge-regression{background:rgba(210,30,30,.35);color:#ff7b72}
    .badge-refactor{background:rgba(88,166,255,.2);color:#58a6ff} .badge-perf{background:rgba(210,153,34,.2);color:#e3b341}
    .badge-test{background:rgba(130,80,255,.2);color:#bc8cff} .badge-docs{background:rgba(139,148,158,.2);color:#8b949e}
    .badge-chore{background:rgba(139,148,158,.15);color:#8b949e} .badge-none{color:var(--text-muted);background:none;padding:0}
    .count-label { color: var(--text-muted); font-size: 12px; margin-left: auto; }
    .empty-cell { text-align:center; color:var(--text-muted); padding:32px; }
    .footer { margin-top:20px; color:var(--text-muted); font-size:11px; border-top:1px solid var(--border); padding-top:12px; }
    a { color: var(--accent); }
    .btn-history {
      padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;
      border: 1.5px solid var(--accent); color: var(--accent); background: transparent;
      cursor: pointer; transition: background 0.15s, color 0.15s;
      white-space: nowrap;
    }
    .btn-history:hover { background: var(--accent); color: var(--panel); }
    .btn-history:disabled { opacity: 0.35; cursor: not-allowed; }
    .modal-overlay {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.55); z-index: 1000;
      align-items: flex-start; justify-content: center; padding-top: 60px;
    }
    .modal-overlay.open { display: flex; }
    .btn-key-picker {
      padding: 5px 8px; border-radius: 6px; font-size: 13px;
      border: 1px solid var(--border); background: transparent;
      color: var(--text-muted); cursor: pointer; flex-shrink: 0;
      transition: background 0.15s, color 0.15s;
    }
    .btn-key-picker:hover { background: light-dark(#f0f6ff,#1c2333); color: var(--text-strong); }
    ${renderKeyPickerCss()}
    .modal {
      background: var(--panel); border: 1px solid var(--border);
      border-radius: 12px; width: min(800px, 96vw); max-height: 80vh;
      display: flex; flex-direction: column; overflow: hidden;
      box-shadow: 0 16px 48px rgba(0,0,0,0.4);
    }
    .modal-header {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 18px; border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .modal-title { font-size: 14px; font-weight: 700; color: var(--text-strong); flex: 1; }
    .modal-repo-label {
      font-size: 11px; color: var(--text-muted); white-space: nowrap;
      flex-shrink: 0;
    }
    .modal-repo-label strong { color: var(--accent); }
    .modal-close {
      border: none; background: none; color: var(--text-muted);
      font-size: 18px; cursor: pointer; padding: 2px 6px; border-radius: 4px;
    }
    .modal-close:hover { color: var(--text-strong); background: light-dark(#eaeef2,#21262d); }
    .modal-body { display: flex; flex: 1; overflow: hidden; }
    .modal-left {
      width: 300px; flex-shrink: 0; border-right: 1px solid var(--border);
      display: flex; flex-direction: column; overflow: hidden;
    }
    .modal-file-select {
      padding: 10px 12px; border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .modal-search-box {
      padding: 10px 12px; border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .modal-search-box input {
      width: 100%; padding: 6px 10px; border-radius: 6px;
      border: 1px solid var(--border); background: var(--bg); color: var(--text);
      font-size: 12px;
    }
    .modal-file-select label {
      display: block; font-size: 10px; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 5px;
    }
    .modal-file-select select {
      width: 100%; padding: 6px 8px; border-radius: 6px;
      border: 1.5px solid var(--border); background: var(--bg); color: var(--text);
      font-size: 11px;
    }
    .modal-file-select select.sel-needed {
      border-color: var(--danger);
      box-shadow: 0 0 0 2px var(--danger-glow);
      animation: pulse 1.5s ease-in-out 3;
    }
    .modal-func-list {
      overflow-y: auto; flex: 1; list-style: none; margin: 0; padding: 6px 0;
    }
    .modal-func-list li {
      padding: 7px 14px; cursor: pointer; font-size: 12px;
      border-left: 3px solid transparent;
      transition: background 0.1s;
    }
    .modal-func-list li:hover { background: light-dark(#f0f6ff,#1c2333); }
    .modal-func-list li.active {
      background: light-dark(#ddf4ff,#0d2136);
      border-left-color: var(--accent);
      color: var(--accent); font-weight: 600;
    }
    .modal-func-name { display: block; }
    .modal-func-file { display: block; font-size: 10px; color: var(--text-muted); margin-top: 1px; word-break: break-all; }
    .modal-right {
      flex: 1; display: flex; flex-direction: column; overflow: hidden;
    }
    .modal-right-header {
      padding: 12px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .modal-right-header .fn-name {
      font-size: 14px; font-weight: 700; color: var(--text-strong);
      font-family: 'SFMono-Regular',Consolas,monospace;
    }
    .modal-right-header .fn-file {
      font-size: 11px; color: var(--text-muted); margin-top: 2px; word-break: break-all;
    }
    .modal-right-header .fn-placeholder {
      font-size: 12px; color: var(--text-muted);
    }
    .modal-right-body { overflow-y: auto; flex: 1; padding: 16px; display: flex; flex-direction: column; gap: 16px; }
    .purpose-block {
      background: light-dark(#f6f8fa, #161b22);
      border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px;
    }
    .purpose-label {
      font-size: 10px; color: var(--text-muted); text-transform: uppercase;
      letter-spacing: 0.5px; margin-bottom: 8px;
    }
    .purpose-text {
      font-size: 13px; color: var(--text-strong); line-height: 1.7;
    }
    .purpose-empty { font-size: 12px; color: var(--text-muted); font-style: italic; }
    .btn-view-source {
      align-self: flex-start; padding: 7px 16px; border-radius: 6px; font-size: 12px;
      font-weight: 600; border: 1.5px solid var(--accent); color: var(--accent);
      background: transparent; cursor: pointer; transition: background 0.15s, color 0.15s;
    }
    .btn-view-source:hover { background: var(--accent); color: var(--panel); }
    .source-block { flex: 1; }
    .source-block pre {
      margin: 0; padding: 14px; border-radius: 8px; overflow: auto;
      background: light-dark(#f6f8fa,#0d1117); border: 1px solid var(--border);
      font-family: 'SFMono-Regular',Consolas,monospace; font-size: 11px;
      line-height: 1.6; color: var(--text); max-height: 320px;
    }
    .source-fallback {
      font-size: 12px; color: var(--text-muted); padding: 14px;
      background: light-dark(#f6f8fa,#161b22); border: 1px solid var(--border);
      border-radius: 8px; line-height: 1.7;
    }
    .source-fallback a { color: var(--accent); }
    .source-loading { font-size: 12px; color: var(--text-muted); padding: 12px 0; }
    .history-section { flex: 1; }
    .history-section-label {
      font-size: 10px; color: var(--text-muted); text-transform: uppercase;
      letter-spacing: 0.5px; margin-bottom: 8px;
    }
    .history-empty { font-size: 12px; color: var(--text-muted); padding: 12px 0; }
    .history-loading { font-size: 12px; color: var(--text-muted); padding: 12px 0; }
    .history-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .history-table th {
      background: var(--th-bg); color: var(--text-muted); text-align: left;
      padding: 6px 10px; font-size: 10px; text-transform: uppercase;
      letter-spacing: 0.4px; border-bottom: 1px solid var(--border);
    }
    .history-table td { padding: 7px 10px; border-bottom: 1px solid var(--border); vertical-align: top; }
    .history-table tr:last-child td { border-bottom: none; }
    .h-date { white-space: nowrap; color: var(--text-muted); }
    .h-hash { font-family: 'SFMono-Regular',Consolas,monospace; font-size: 11px; color: var(--accent); }
    .h-branch { font-size: 10px; color: var(--text-muted); }
    .h-type { white-space: nowrap; }
    .h-diff-add { color: var(--add-fg); }
    .h-diff-del { color: var(--del-fg); }
    .modal-func-count { padding: 6px 12px; font-size: 11px; color: var(--text-muted); border-bottom: 1px solid var(--border); flex-shrink: 0; }
  </style>
</head>
<body>
  <h1>関数変更ログ</h1>

  <div class="subtitle-row">
    <div class="subtitle">
      いつ・どのプロジェクト（リポジトリ）のどのファイルのどの関数に・どういう変更を加え・結果はどうだったかについての可視化が可能
    </div>
    <div class="repo-selector-wrap">
      <span class="repo-selector-label">プロジェクト</span>
      <select id="repoSelect" class="${noRepoSelected ? 'sel-needed' : 'sel-done'}">
        <option value="">— 選択してください —</option>
        ${repoOptions}
      </select>
    </div>
  </div>

  ${repoBanner}

  <div class="toolbar">
    <label>ファイル</label>
    <select id="filterFile"${dis}>
      <option value="">すべて</option>
      ${fileOptions}
    </select>
    <label>関数名</label>
    <select id="filterFunc"${dis}>
      <option value="">すべて</option>
    </select>
    <label>インパクト</label>
    <select id="filterImpact"${dis}>
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
    <span class="count-label" id="rowCount">${noRepoSelected ? '—' : rows.length + ' 件'}</span>
    <button class="btn-history" id="btnHistory"${noRepoSelected ? ' disabled' : ''}>🔍 関数を選んで履歴を調べる</button>
  </div>

  <div class="step-banner" id="stepBanner"></div>

  <div class="table-wrap" id="tableWrap">
    <table id="changelogTable">
      <thead>
        <tr>
          <th>日付</th><th>コミット</th><th>ファイル</th><th>関数</th>
          <th>変更種別</th><th>インパクト</th><th>重要度</th><th>備考</th>
        </tr>
      </thead>
      <tbody id="tableBody">
        ${tableRows || emptyRow}
      </tbody>
    </table>
  </div>

  <div class="footer">
    生成: ${escapeHtml(generatedAt)} &nbsp;/&nbsp;
    <a href="/status">/status</a> &nbsp;/&nbsp;
    データ投入: <code>ts_commit_function_map</code>, <code>ts_function_impact</code>
  </div>

  ${renderKeyPickerHtml()}

  <!-- 関数履歴モーダル -->
  <div class="modal-overlay" id="historyOverlay">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <div class="modal-header">
        <span class="modal-title" id="modalTitle">🔍 関数を選んで変更履歴を調べる</span>
        ${selectedRepoName ? `<span class="modal-repo-label">現在選択中のリポジトリ: <strong>${escapeHtml(selectedRepoName)}</strong></span>` : ''}
        <button class="modal-close" id="modalClose" aria-label="閉じる">✕</button>
      </div>
      <div class="modal-body">
        <div class="modal-left">
          <div class="modal-search-box" style="display:flex;gap:6px;align-items:center;">
            <input type="search" id="modalSearch" placeholder="関数名・説明で絞り込み…" autocomplete="off" style="flex:1;min-width:0;">
            <button class="btn-key-picker" id="btnKeyPicker" title="コミット検索キーワードから選ぶ">🔑</button>
          </div>
          <div class="modal-file-select">
            <label for="modalFileSelect">① ファイルを選択</label>
            <select id="modalFileSelect" class="sel-needed">
              <option value="">— ファイルを選んでください —</option>
              ${availableFiles.map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('\n              ')}
            </select>
          </div>
          <div class="modal-func-count" id="funcCount">ファイルを選択すると関数一覧が表示されます</div>
          <ul class="modal-func-list" id="funcList" role="listbox"></ul>
        </div>
        <div class="modal-right">
          <div class="modal-right-header" id="rightHeader">
            <div class="fn-placeholder">（左からファイル → 関数の順に選択してください）</div>
          </div>
          <div class="modal-right-body" id="rightBody"></div>
        </div>
      </div>
    </div>
  </div>

  <script>
    var ALL_FUNCTIONS = ${allFunctionsJson};
    var allRows = Array.from(document.querySelectorAll('#tableBody tr[data-file]'));

    var repoSelect   = document.getElementById('repoSelect');
    var filterFile   = document.getElementById('filterFile');
    var filterFunc   = document.getElementById('filterFunc');
    var filterImpact = document.getElementById('filterImpact');
    var stepBanner   = document.getElementById('stepBanner');
    var repoBanner   = document.getElementById('repoBanner');
    var tableWrap    = document.getElementById('tableWrap');
    var rowCount     = document.getElementById('rowCount');

    repoSelect.addEventListener('change', function() {
      var val = repoSelect.value;
      var url = new URL(window.location.href);
      if (val) { url.searchParams.set('repo', val); } else { url.searchParams.delete('repo'); }
      window.location.href = url.toString();
    });

    function populateFuncOptions(fileVal) {
      var prev = filterFunc.value;
      filterFunc.innerHTML = '<option value="">すべて</option>';
      var funcs = fileVal
        ? ALL_FUNCTIONS.filter(function(e) { return e.file === fileVal; })
        : ALL_FUNCTIONS;
      var seen = {};
      funcs.forEach(function(e) {
        if (!seen[e.func]) {
          seen[e.func] = true;
          var opt = document.createElement('option');
          opt.value = e.func;
          opt.textContent = e.func;
          if (e.func === prev) opt.selected = true;
          filterFunc.appendChild(opt);
        }
      });
    }

    function applyFilter() {
      var file   = filterFile.value;
      var func   = filterFunc.value;
      var impact = filterImpact.value;
      var visible = 0;
      allRows.forEach(function(tr) {
        var f = tr.getAttribute('data-file') || '';
        var n = tr.getAttribute('data-func') || '';
        var i = tr.getAttribute('data-impact') || '';
        var show = (!file || f === file)
                && (!func || n === func)
                && (!impact || i === impact);
        tr.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      rowCount.textContent = visible + ' 件';
    }

    function setStep(step) {
      if (step === 1) {
        stepBanner.className = 'step-banner visible step-banner--warn';
        stepBanner.textContent = '次にこの左上にあるファイル選択リスト内から対象ファイル（すべて指定可能）を選択してください。';
        filterFile.classList.add('sel-needed');
        filterFile.classList.remove('sel-done');
        filterFunc.classList.remove('sel-needed', 'sel-done');
        filterFile.focus();
      } else if (step === 2) {
        var label = filterFile.value === '' ? 'すべてのファイル' : filterFile.value;
        stepBanner.className = 'step-banner visible step-banner--info';
        stepBanner.textContent = label + ' が選択されました。次にそれらのファイル群にある調べたい関数を選択してください。';
        filterFile.classList.remove('sel-needed');
        filterFile.classList.add('sel-done');
        filterFunc.classList.add('sel-needed');
        filterFunc.classList.remove('sel-done');
        filterFunc.focus();
      } else if (step === 3) {
        stepBanner.className = 'step-banner visible step-banner--info';
        var fLabel = filterFile.value === '' ? 'すべてのファイル' : filterFile.value;
        var nLabel = filterFunc.value === '' ? 'すべての関数' : filterFunc.value;
        stepBanner.textContent = fLabel + ' / ' + nLabel + ' が選択されました。';
        filterFunc.classList.remove('sel-needed');
        filterFunc.classList.add('sel-done');
      }
    }

    filterFile.addEventListener('change', function() {
      populateFuncOptions(filterFile.value);
      applyFilter();
      setStep(2);
    });

    filterFunc.addEventListener('change', function() {
      applyFilter();
      if (filterFunc.value !== '') setStep(3);
    });

    filterImpact.addEventListener('change', applyFilter);

    var repoSelected = ${!noRepoSelected};
    if (repoSelected) {
      populateFuncOptions('');

      if (repoBanner) {
        setTimeout(function() {
          repoBanner.classList.add('fading');
          repoBanner.addEventListener('transitionend', function() {
            repoBanner.style.display = 'none';
            setStep(1);
          }, { once: true });
        }, 9000);
      }
    }

    // ---- 関数履歴モーダル ----
    var REPO_ID = ${selectedRepoId ?? 'null'};
    var overlay         = document.getElementById('historyOverlay');
    var modalClose      = document.getElementById('modalClose');
    var modalSearch     = document.getElementById('modalSearch');
    var modalFileSelect = document.getElementById('modalFileSelect');
    var funcList        = document.getElementById('funcList');
    var funcCount       = document.getElementById('funcCount');
    var rightHeader     = document.getElementById('rightHeader');
    var rightBody       = document.getElementById('rightBody');
    var btnHistory      = document.getElementById('btnHistory');

    var selectedEntry = null;
    var searchMode = false;

    function escHtml(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function changeTypeBadgeHtml(t) {
      if (t === 'add')    return '<span class="badge badge-add">追加</span>';
      if (t === 'delete') return '<span class="badge badge-del">削除</span>';
      return '<span class="badge badge-mod">変更</span>';
    }

    function renderFuncList(items, showFile) {
      funcList.innerHTML = '';
      if (items.length === 0) {
        var msg = searchMode ? '一致する関数が見つかりません' : 'このファイルに関数が登録されていません';
        funcCount.textContent = msg;
        return;
      }
      var label = searchMode ? '検索結果 (' + items.length + ' 件)' : '② 関数を選択 (' + items.length + ' 件)';
      funcCount.textContent = label;
      items.forEach(function(e) {
        var li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.dataset.file = e.file;
        li.dataset.func = e.func;
        var inner = '<span class="modal-func-name">' + escHtml(e.func) + '</span>';
        if (showFile) {
          inner += '<span class="modal-func-file">' + escHtml(e.file) + '</span>';
        }
        li.innerHTML = inner;
        li.addEventListener('click', function() {
          document.querySelectorAll('.modal-func-list li').forEach(function(el) { el.classList.remove('active'); });
          li.classList.add('active');
          selectedEntry = e;
          if (showFile) {
            modalFileSelect.value = e.file;
            modalFileSelect.classList.remove('sel-needed');
            modalFileSelect.classList.add('sel-done');
          }
          showFunctionDetail(e);
        });
        funcList.appendChild(li);
      });
    }

    function showFunctionDetail(e) {
      rightHeader.innerHTML =
        '<div class="fn-name">' + escHtml(e.func) + '</div>' +
        '<div class="fn-file">' + escHtml(e.file) + '</div>';

      var purposeText = e.purpose
        ? '<p class="purpose-text">' + escHtml(e.purpose) + '</p>'
        : '<p class="purpose-empty">purpose 未登録（ts_function_catalog に purpose を入力してください）</p>';

      rightBody.innerHTML =
        '<div class="purpose-block">' +
          '<div class="purpose-label">この関数について</div>' +
          purposeText +
        '</div>' +
        '<button class="btn-view-source" id="btnViewSource">実装内容を見る</button>' +
        '<div class="source-block" id="sourceBlock"></div>';

      document.getElementById('btnViewSource').addEventListener('click', function() {
        loadSource(e);
      });
    }

    function loadSource(e) {
      var sourceBlock = document.getElementById('sourceBlock');
      sourceBlock.innerHTML = '<div class="source-loading">読み込み中…</div>';

      var url = '/api/function-source?repo_id=' + encodeURIComponent(REPO_ID) +
                '&function_name=' + encodeURIComponent(e.func) +
                '&file_path=' + encodeURIComponent(e.file);

      fetch(url)
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (!data.ok) {
            sourceBlock.innerHTML = '<div class="source-fallback">エラー: ' + escHtml(data.error || '取得失敗') + '</div>';
            return;
          }
          if (data.source_snippet) {
            sourceBlock.innerHTML =
              '<pre><code>' + escHtml(data.source_snippet) + '</code></pre>';
          } else {
            var linkHtml = data.github_url
              ? '<a href="' + escHtml(data.github_url) + '" target="_blank" rel="noopener">GitHub でファイルを開く →</a>'
              : '';
            sourceBlock.innerHTML =
              '<div class="source-fallback">' +
              'ソースコードが登録されていません。<br>' +
              'ts_function_catalog の <code>source_snippet</code> カラムに内容を追加すると表示されます。<br><br>' +
              linkHtml +
              '</div>';
          }
        })
        .catch(function(err) {
          sourceBlock.innerHTML = '<div class="source-fallback">通信エラー: ' + escHtml(String(err)) + '</div>';
        });
    }

    function openModal() {
      modalSearch.value = '';
      searchMode = false;
      modalFileSelect.value = '';
      modalFileSelect.classList.add('sel-needed');
      modalFileSelect.classList.remove('sel-done');
      funcList.innerHTML = '';
      funcCount.textContent = 'ファイルを選択すると関数一覧が表示されます';
      rightHeader.innerHTML = '<div class="fn-placeholder">（左からファイル → 関数の順に選択してください）</div>';
      rightBody.innerHTML = '';
      selectedEntry = null;
      overlay.classList.add('open');
      modalSearch.focus();
    }

    function closeModal() {
      overlay.classList.remove('open');
    }

    ${renderKeyPickerJs({ targetInputId: 'modalSearch', triggerBtnId: 'btnKeyPicker' })}

    modalSearch.addEventListener('input', function() {
      var q = modalSearch.value.trim().toLowerCase();
      if (q === '') {
        searchMode = false;
        var fileVal = modalFileSelect.value;
        if (fileVal) {
          var funcs = ALL_FUNCTIONS.filter(function(e) { return e.file === fileVal; });
          renderFuncList(funcs, false);
        } else {
          funcList.innerHTML = '';
          funcCount.textContent = 'ファイルを選択すると関数一覧が表示されます';
        }
        return;
      }
      searchMode = true;
      var results = ALL_FUNCTIONS.filter(function(e) {
        return e.func.toLowerCase().includes(q) || (e.purpose && e.purpose.toLowerCase().includes(q));
      });
      renderFuncList(results, true);
    });

    modalFileSelect.addEventListener('change', function() {
      var fileVal = modalFileSelect.value;
      if (!fileVal) {
        modalFileSelect.classList.add('sel-needed');
        modalFileSelect.classList.remove('sel-done');
        if (!searchMode) {
          funcList.innerHTML = '';
          funcCount.textContent = 'ファイルを選択すると関数一覧が表示されます';
        }
        return;
      }
      modalFileSelect.classList.remove('sel-needed');
      modalFileSelect.classList.add('sel-done');
      if (!searchMode) {
        var funcs = ALL_FUNCTIONS.filter(function(e) { return e.file === fileVal; });
        renderFuncList(funcs, false);
      }
    });

    if (btnHistory) {
      btnHistory.addEventListener('click', openModal);
    }
    if (modalClose) {
      modalClose.addEventListener('click', closeModal);
    }
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal();
    });
  </script>
</body>
</html>`;
}
