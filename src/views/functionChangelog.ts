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

export interface CatalogFunctionRow {
  file_path: string;
  function_name: string;
  purpose: string;
  is_exported: number;
  is_async: number;
  start_line: number | null;
  end_line: number | null;
  caller_count: number;
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
  catalogRows: CatalogFunctionRow[];
  indexedFiles: string[];
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

  const indexedSet = new Set(input.indexedFiles);
  function buildFileOptgroups(files: string[], selectedVal?: string): string {
    const indexed = files.filter(f => indexedSet.has(f));
    const partial = files.filter(f => !indexedSet.has(f));
    const sel = (f: string) => selectedVal === f ? ' selected' : '';
    const indexedOpts = indexed.map(f =>
      `<option value="${escapeHtml(f)}"${sel(f)}>${escapeHtml(f)}</option>`
    ).join('\n');
    const partialOpts = partial.map(f =>
      `<option value="${escapeHtml(f)}"${sel(f)}>${escapeHtml(f)}</option>`
    ).join('\n');
    let result = '';
    if (indexedOpts) result += `<optgroup label="● インデックス済み">\n${indexedOpts}\n</optgroup>`;
    if (partialOpts) result += `\n<optgroup label="○ 未インデックス" disabled>\n${partialOpts}\n</optgroup>`;
    return result;
  }

  const fileOptions = buildFileOptgroups(availableFiles, input.filterFile);
  const modalFileOptions = buildFileOptgroups(availableFiles);

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
      <td class="col-func"><code class="fn-link" data-func="${escapeHtml(r.function_name)}" data-file="${escapeHtml(r.file_path)}">${escapeHtml(r.function_name)}</code><br><span class="purpose">${escapeHtml(r.purpose)}</span></td>
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
    .col-cat-file{width:220px;word-break:break-all} .col-cat-func{width:180px;word-break:break-all}
    .col-cat-purpose{min-width:200px} .col-cat-lines{width:90px;white-space:nowrap;font-family:'SFMono-Regular',Consolas,monospace;font-size:11px;color:var(--text-muted)}
    .col-cat-linecount{width:70px;text-align:right;font-variant-numeric:tabular-nums;color:var(--text-muted)}
    .col-cat-attrs{width:100px;white-space:nowrap} .col-cat-callers{width:70px;text-align:right;color:var(--text-muted)}
    th.sortable-th { cursor: pointer; user-select: none; }
    th.sortable-th:hover { color: var(--accent); }
    .sort-indicator { font-size: 9px; margin-left: 2px; }
    tr.has-callers td { background: light-dark(#dafbe1, #12261e); }
    tr.has-callers:hover td { background: light-dark(#c8f0d4, #173526); }
    .badge-exp{background:rgba(63,185,80,.2);color:#3fb950} .badge-async{background:rgba(88,166,255,.2);color:#58a6ff}
    .btn-catalog-toggle {
      padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;
      border: 1.5px solid var(--border); color: var(--text-muted); background: transparent;
      cursor: pointer; transition: background 0.15s, color 0.15s, border-color 0.15s;
      white-space: nowrap;
    }
    .btn-catalog-toggle:hover { background: light-dark(#f0f6ff,#1c2333); color: var(--text-strong); border-color: var(--accent); }
    .btn-catalog-toggle.active { border-color: var(--accent); color: var(--accent); background: light-dark(#ddf4ff,#0d2136); }
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
    .h1-row { display: flex; align-items: center; gap: 10px; margin: 0 0 8px; }
    .h1-row h1 { margin: 0; }
    .btn-chart {
      padding: 3px 8px; border-radius: 6px; font-size: 16px; line-height: 1;
      border: 1px solid var(--border); background: transparent;
      color: var(--text-muted); cursor: pointer; transition: background 0.15s, color 0.15s;
      flex-shrink: 0;
    }
    .btn-chart:hover { background: light-dark(#f0f6ff,#1c2333); color: var(--text-strong); }
    #chartOverlay {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.6); align-items: center; justify-content: center;
    }
    #chartOverlay.open { display: flex; }
    #chartModal {
      background: var(--panel); border: 1px solid var(--border); border-radius: 12px;
      width: min(640px, 96vw); max-height: 88vh;
      display: flex; flex-direction: column; overflow: hidden;
      box-shadow: 0 16px 48px rgba(0,0,0,0.45);
    }
    .chart-header {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .chart-title { font-size: 14px; font-weight: 700; color: var(--text-strong); flex: 1; }
    .chart-tab-group { display: flex; gap: 4px; }
    .chart-tab {
      padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;
      border: 1px solid var(--border); background: transparent; cursor: pointer;
      color: var(--text-muted); transition: background 0.15s, color 0.15s;
    }
    .chart-tab:hover { background: light-dark(#f0f6ff,#1c2333); color: var(--text-strong); }
    .chart-tab.active { background: var(--accent); color: #fff; border-color: var(--accent); }
    .chart-close {
      background: none; border: 1px solid var(--border); border-radius: 6px;
      padding: 3px 10px; cursor: pointer; font-size: 13px;
      color: var(--text-muted); flex-shrink: 0;
    }
    .chart-close:hover { background: light-dark(#ffd7d7,#3d1a1a); color: var(--danger); border-color: var(--danger); }
    .chart-body { display: flex; gap: 0; flex: 1; overflow: hidden; }
    .chart-canvas-wrap { flex-shrink: 0; padding: 20px; display: flex; align-items: center; justify-content: center; }
    #pieCanvas { display: block; }
    .chart-legend { flex: 1; overflow-y: auto; padding: 12px 16px 12px 0; }
    .chart-legend::-webkit-scrollbar { width: 4px; }
    .chart-legend::-webkit-scrollbar-track { background: transparent; }
    .chart-legend::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
    .legend-item {
      display: flex; align-items: flex-start; gap: 8px;
      padding: 5px 6px; border-radius: 6px; cursor: default;
      transition: background 0.1s; font-size: 11px; line-height: 1.4;
    }
    .legend-item:hover { background: light-dark(rgba(0,0,0,.04), rgba(255,255,255,.04)); }
    .legend-item.legend-active { background: light-dark(rgba(9,105,218,.1), rgba(88,166,255,.12)); }
    .legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-top: 2px; }
    .legend-label { color: var(--text); word-break: break-all; flex: 1; }
    .legend-val { color: var(--text-muted); white-space: nowrap; margin-left: 4px; font-variant-numeric: tabular-nums; }
    .chart-empty { padding: 40px; text-align: center; color: var(--text-muted); font-size: 13px; }
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
    .source-block .srcview-code-flex { max-height: 60vh; margin-bottom: 8px; }
    .source-block .srcview-code-flex pre {
      border-radius: 0; border: none; overflow: visible; max-height: none;
      background: transparent; font-size: 11px; line-height: 1.6;
    }
    .source-block .srcview-gutter {
      background: light-dark(#eef1f4,#161b22);
      border-right: 1px solid var(--border);
    }
    .source-fallback {
      font-size: 12px; color: var(--text-muted); padding: 14px;
      background: light-dark(#f6f8fa,#161b22); border: 1px solid var(--border);
      border-radius: 8px; line-height: 1.7;
    }
    .source-fallback a { color: var(--accent); }
    .source-loading { font-size: 12px; color: var(--text-muted); padding: 12px 0; }
    /* 関数名クリックリンク */
    .fn-link { cursor: pointer; border-bottom: 1px dotted var(--accent); }
    .fn-link:hover { color: var(--accent); background: light-dark(rgba(9,105,218,.08), rgba(88,166,255,.12)); border-radius: 2px; }
    /* ソースビューアモーダル */
    #srcViewOverlay {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.55); align-items: center; justify-content: center;
    }
    #srcViewOverlay.open { display: flex; }
    #srcViewModal {
      background: var(--panel); border: 1px solid var(--border); border-radius: 12px;
      width: min(860px, 96vw); max-height: 90vh;
      display: flex; flex-direction: column; overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,0.28);
    }
    .srcview-header {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .srcview-title { flex: 1; font-size: 14px; font-weight: 600; color: var(--text-strong); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .srcview-close {
      background: none; border: 1px solid var(--border); border-radius: 6px;
      padding: 3px 10px; cursor: pointer; font-size: 13px;
      color: var(--text-muted); flex-shrink: 0;
    }
    .srcview-close:hover { background: light-dark(#ffd7d7,#3d1a1a); color: var(--danger); border-color: var(--danger); }
    .srcview-settings-btn {
      background: none; border: 1px solid var(--border); border-radius: 6px;
      padding: 3px 9px; cursor: pointer; font-size: 12px;
      color: var(--text-muted); flex-shrink: 0; transition: background 0.15s;
    }
    .srcview-settings-btn:hover { background: light-dark(#f0f6ff,#1c2333); color: var(--text); }
    .srcview-settings-btn.active { background: light-dark(#ddf4ff,#0d2136); color: var(--accent); border-color: var(--accent); }
    .srcview-settings-panel {
      display: none; border-top: 1px solid var(--border); padding: 10px 16px;
      background: var(--th-bg); flex-shrink: 0;
      font-size: 12px; color: var(--text-muted);
      align-items: center; gap: 12px;
    }
    .srcview-settings-panel.open { display: flex; }
    .srcview-settings-label { font-size: 11px; color: var(--text-muted); white-space: nowrap; }
    .srcview-opt-group { display: flex; gap: 6px; }
    .srcview-opt {
      padding: 3px 12px; border-radius: 20px; font-size: 11px; cursor: pointer;
      border: 1px solid var(--border); background: var(--panel); color: var(--text-muted);
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .srcview-opt:hover { background: light-dark(#f0f6ff,#1c2333); color: var(--text); }
    .srcview-opt.selected { background: var(--accent); color: #fff; border-color: var(--accent); font-weight: 600; }
    .srcview-body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
    .srcview-meta { font-size: 11px; color: var(--text-muted); }
    .srcview-meta code { font-size: 11px; color: var(--text); }
    .srcview-purpose {
      font-size: 12px; color: var(--text); padding: 8px 12px;
      background: var(--th-bg); border-left: 3px solid var(--accent); border-radius: 0 6px 6px 0;
    }
    .srcview-purpose.empty { color: var(--text-muted); font-style: italic; }
    .srcview-code-wrap { flex: 1; min-height: 0; }
    .srcview-code-wrap pre {
      margin: 0; padding: 14px; border-radius: 8px; overflow: auto;
      background: light-dark(#f6f8fa,#0d1117); border: 1px solid var(--border);
      font-family: 'SFMono-Regular',Consolas,monospace; font-size: 11.5px;
      line-height: 1.65; color: var(--text); max-height: calc(90vh - 220px);
      tab-size: 2;
    }
    /* 行番号ガター付きコード表示 */
    .srcview-code-flex {
      display: flex; overflow: auto; max-height: calc(90vh - 220px);
      border: 1px solid var(--border); border-radius: 8px;
      background: light-dark(#f6f8fa,#0d1117);
      font-family: 'SFMono-Regular',Consolas,monospace; font-size: 11.5px;
      line-height: 1.65; tab-size: 2;
    }
    .srcview-gutter {
      position: sticky; left: 0; margin: 0; flex-shrink: 0;
      padding: 14px 10px 14px 12px; text-align: right;
      color: var(--text-muted); user-select: none;
      background: light-dark(#eef1f4,#161b22);
      border-right: 1px solid var(--border);
      font-variant-numeric: tabular-nums;
    }
    .srcview-code-flex pre.srcview-code {
      margin: 0; padding: 14px; border: none; background: transparent;
      color: var(--text); flex: 1; overflow: visible; max-height: none;
    }
    .srcview-fallback {
      font-size: 12px; color: var(--text-muted); padding: 14px;
      background: light-dark(#f6f8fa,#161b22); border: 1px solid var(--border);
      border-radius: 8px; line-height: 1.7;
    }
    .srcview-fallback a { color: var(--accent); }
    /* シンタックスハイライト */
    .hl-comment { color: light-dark(#6a737d,#8b949e); font-style: italic; }
    .hl-string  { color: light-dark(#032f62,#a5d6ff); }
    .hl-kw      { color: light-dark(#d73a49,#ff7b72); font-weight: 600; }
    .hl-type    { color: light-dark(#6f42c1,#d2a8ff); }
    .hl-num     { color: light-dark(#005cc5,#79c0ff); }
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
    .btn-layout-toggle {
      padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600;
      border: 1px solid var(--border); background: transparent;
      color: var(--text-muted); cursor: pointer; flex-shrink: 0;
      transition: background 0.15s, color 0.15s;
    }
    .btn-layout-toggle:hover { background: light-dark(#f0f6ff,#1c2333); color: var(--text-strong); }
    .modal-purpose-th {
      padding: 6px 12px; flex-shrink: 0;
      background: var(--th-bg); color: var(--text-muted);
      font-size: 11px; border-bottom: 1px solid var(--border);
      border-left: 1px solid var(--border);
    }
    .modal-purpose-list { overflow-y: auto; flex: 1; border-left: 1px solid var(--border); }
    .purpose-item {
      padding: 7px 14px; font-size: 12px; color: var(--text);
      border-bottom: 1px solid var(--border); cursor: pointer;
      line-height: 1.5; transition: background 0.1s;
    }
    .purpose-item:last-child { border-bottom: none; }
    .purpose-item:hover { background: light-dark(#f0f6ff,#1c2333); }
    .purpose-item.active { background: light-dark(#ddf4ff,#0d2136); border-left: 3px solid var(--accent); }
    .purpose-item-empty { color: var(--text-muted); font-style: italic; }
    .kw-highlight { background: rgba(255,230,80,0.45); border-radius: 2px; padding: 0 1px; }
  </style>
</head>
<body>
  <div class="h1-row">
    <h1>関数変更ログ</h1>
    <button class="btn-chart" id="btnChart" title="行数内訳を円グラフで表示">📈</button>
  </div>

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
    <button class="btn-catalog-toggle" id="btnCatalogToggle"${noRepoSelected ? ' disabled' : ''}>📚 カタログ</button>
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

  <div class="table-wrap" id="catalogWrap" style="display:none; margin-top: 16px;">
    <table id="catalogTable">
      <thead>
        <tr>
          <th class="col-cat-file">ファイル</th>
          <th class="col-cat-func">関数名</th>
          <th class="col-cat-purpose">説明</th>
          <th class="col-cat-linecount sortable-th" id="thCatLineCount" title="タップで行数の多い/少ない順に並び替え">行数</th>
          <th class="col-cat-lines">行</th>
          <th class="col-cat-attrs">属性</th>
          <th class="col-cat-callers sortable-th" id="thCatCallers" title="タップで呼び出し元数の多い/少ない順に並び替え">呼び出し元</th>
        </tr>
      </thead>
      <tbody id="catalogBody">
        <tr><td colspan="7" class="empty-cell">データなし</td></tr>
      </tbody>
    </table>
  </div>

  <div class="footer">
    生成: ${escapeHtml(generatedAt)} &nbsp;/&nbsp;
    <a href="/status">/status</a> &nbsp;/&nbsp;
    データ投入: <code>ts_commit_function_map</code>, <code>ts_function_impact</code>
  </div>

  ${renderKeyPickerHtml()}

  <!-- 円グラフモーダル -->
  <div id="chartOverlay">
    <div id="chartModal" role="dialog" aria-modal="true">
      <div class="chart-header">
        <span class="chart-title">📈 行数内訳</span>
        <div class="chart-tab-group">
          <button class="chart-tab active" id="chartTabFile">ファイル別</button>
          <button class="chart-tab" id="chartTabFunc">関数別</button>
        </div>
        <button class="chart-close" id="chartClose">✕ 閉じる</button>
      </div>
      <div class="chart-body" id="chartBody">
        <div class="chart-canvas-wrap"><canvas id="pieCanvas" width="220" height="220"></canvas></div>
        <div class="chart-legend" id="chartLegend"></div>
      </div>
    </div>
  </div>

  <!-- ソースビューアモーダル -->
  <div id="srcViewOverlay">
    <div id="srcViewModal" role="dialog" aria-modal="true" aria-labelledby="srcViewTitle">
      <div class="srcview-header">
        <span class="srcview-title" id="srcViewTitle">— 関数ソース —</span>
        <button class="srcview-settings-btn" id="srcViewSettingsBtn" title="表示設定">⚙ 設定</button>
        <button class="srcview-close" id="srcViewClose" aria-label="閉じる">✕ 閉じる</button>
      </div>
      <div class="srcview-settings-panel" id="srcViewSettingsPanel">
        <span class="srcview-settings-label">最大表示行数</span>
        <div class="srcview-opt-group" id="srcViewOptGroup">
          <button class="srcview-opt" data-val="10000" id="srcOptDefault">10,000行（デフォルト）</button>
          <button class="srcview-opt" data-val="unlimited" id="srcOptUnlimited">上限なし</button>
        </div>
      </div>
      <div class="srcview-body" id="srcViewBody">
        <div class="srcview-fallback">関数を選択してください</div>
      </div>
    </div>
  </div>

  <!-- 関数履歴モーダル -->
  <div class="modal-overlay" id="historyOverlay">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <div class="modal-header">
        <span class="modal-title" id="modalTitle">🔍 関数を選んで変更履歴を調べる</span>
        ${selectedRepoName ? `<span class="modal-repo-label">現在選択中のリポジトリ: <strong>${escapeHtml(selectedRepoName)}</strong></span>` : ''}
        <button class="btn-layout-toggle" id="btnLayoutToggle" title="2ペイン一覧表示に切り替え">⊞ 一覧</button>
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
              ${modalFileOptions}
            </select>
          </div>
          <div class="modal-func-count" id="funcCount">ファイルを選択すると関数一覧が表示されます</div>
          <ul class="modal-func-list" id="funcList" role="listbox"></ul>
        </div>
        <div class="modal-right" id="modalRight">
          <div class="modal-purpose-th" id="purposeTh" style="display:none;">この関数について</div>
          <div class="modal-purpose-list" id="purposeList" style="display:none;"></div>
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
    var CATALOG_ROWS = ${JSON.stringify(input.catalogRows)};
    var INDEXED_FILES = ${JSON.stringify(input.indexedFiles)};
    var allRows = Array.from(document.querySelectorAll('#tableBody tr[data-file]'));

    // ---- getNextZ ----
    function getNextZ() {
      var staticZDefaults = { historyOverlay: 1000, srcViewOverlay: 1100, chartOverlay: 1200 };
      var max = 900;
      document.querySelectorAll('[style*="z-index"]').forEach(function(el) {
        var z = parseInt(el.style.zIndex, 10);
        if (!isNaN(z) && z > max) max = z;
      });
      Object.keys(staticZDefaults).forEach(function(id) {
        var el = document.getElementById(id);
        if (el && el.style.zIndex) {
          var z = parseInt(el.style.zIndex, 10);
          if (!isNaN(z) && z > max) max = z;
        } else {
          var def = staticZDefaults[id];
          if (def > max) max = def;
        }
      });
      return max + 100;
    }

    // ---- シンタックスハイライター（TypeScript/JavaScript） ----
    function highlightTs(raw) {
      var TOKEN_RE = /(\\/\\/[^\\n]*)|(\\/\\*[\\s\\S]*?\\*\\/)|(\x60[^\x60\\\\]*(?:\\\\.[^\x60\\\\]*)*\x60)|("(?:[^"\\\\\\n]|\\\\.)*")|('(?:[^'\\\\\\n]|\\\\.)*')|\\b(const|let|var|function|async|await|return|export|default|import|from|if|else|for|while|do|switch|case|break|continue|new|this|typeof|instanceof|void|null|undefined|true|false|class|extends|interface|type|enum|implements|abstract|readonly|private|public|protected|static|super|try|catch|finally|throw|in|of|as|keyof|never|unknown|any|declare|namespace|module|satisfies|override)\\b|\\b([A-Z][A-Za-z0-9_]*)\\b|\\b(\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)\\b|([\\s\\S])/g;
      var result = '';
      var m;
      while ((m = TOKEN_RE.exec(raw)) !== null) {
        if      (m[1]) result += '<span class="hl-comment">' + escHtml(m[1]) + '</span>';
        else if (m[2]) result += '<span class="hl-comment">' + escHtml(m[2]) + '</span>';
        else if (m[3]) result += '<span class="hl-string">'  + escHtml(m[3]) + '</span>';
        else if (m[4]) result += '<span class="hl-string">'  + escHtml(m[4]) + '</span>';
        else if (m[5]) result += '<span class="hl-string">'  + escHtml(m[5]) + '</span>';
        else if (m[6]) result += '<span class="hl-kw">'      + escHtml(m[6]) + '</span>';
        else if (m[7]) result += '<span class="hl-type">'    + escHtml(m[7]) + '</span>';
        else if (m[8]) result += '<span class="hl-num">'     + escHtml(m[8]) + '</span>';
        else           result += escHtml(m[9]);
      }
      return result;
    }

    // ---- 行番号ガター生成 ----
    // 各行に「通し番号:ファイル内絶対行番号」を表示する。
    // startLine が null（カタログ未登録）の場合は通し番号のみにフォールバック。
    function buildGutter(lineTotal, startLine) {
      var out = [];
      for (var i = 1; i <= lineTotal; i++) {
        if (startLine !== null && startLine !== undefined) {
          out.push(i + ':' + (startLine + i - 1));
        } else {
          out.push(String(i));
        }
      }
      return out.join('\\n');
    }

    // ---- Cookie ユーティリティ ----
    function getCookie(name) {
      var m = document.cookie.match('(?:^|; )' + name + '=([^;]*)');
      return m ? decodeURIComponent(m[1]) : null;
    }
    function setCookie(name, value) {
      document.cookie = name + '=' + encodeURIComponent(value) + '; path=/; max-age=' + (365 * 24 * 3600);
    }

    // ---- ソースビューアモーダル ----
    var srcViewOverlay      = document.getElementById('srcViewOverlay');
    var srcViewTitle        = document.getElementById('srcViewTitle');
    var srcViewBody         = document.getElementById('srcViewBody');
    var srcViewClose        = document.getElementById('srcViewClose');
    var srcViewSettingsBtn  = document.getElementById('srcViewSettingsBtn');
    var srcViewSettingsPanel = document.getElementById('srcViewSettingsPanel');
    var srcViewOptGroup     = document.getElementById('srcViewOptGroup');

    // Cookie から設定を復元（デフォルト: '10000'）
    var srcMaxLines = getCookie('srcview_maxlines') || '10000';

    function applySrcOptUI() {
      var opts = srcViewOptGroup ? srcViewOptGroup.querySelectorAll('.srcview-opt') : [];
      opts.forEach(function(btn) {
        btn.classList.toggle('selected', btn.dataset.val === srcMaxLines);
      });
    }
    applySrcOptUI();

    if (srcViewSettingsBtn) {
      srcViewSettingsBtn.addEventListener('click', function() {
        var open = srcViewSettingsPanel && srcViewSettingsPanel.classList.toggle('open');
        srcViewSettingsBtn.classList.toggle('active', !!open);
      });
    }

    if (srcViewOptGroup) {
      srcViewOptGroup.addEventListener('click', function(e) {
        var btn = e.target.closest('.srcview-opt');
        if (!btn) return;
        srcMaxLines = btn.dataset.val;
        setCookie('srcview_maxlines', srcMaxLines);
        applySrcOptUI();
      });
    }

    function openSrcViewer(funcName, filePath) {
      srcViewTitle.textContent = funcName + '  (' + filePath + ')';
      srcViewBody.innerHTML = '<div class="source-loading">読み込み中…</div>';
      srcViewOverlay.style.zIndex = String(getNextZ());
      srcViewOverlay.classList.add('open');

      var url = '/api/function-source?repo_id=' + encodeURIComponent(REPO_ID) +
                '&function_name=' + encodeURIComponent(funcName) +
                '&file_path=' + encodeURIComponent(filePath) +
                '&max_lines=' + encodeURIComponent(srcMaxLines);
      fetch(url)
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (!data.ok) {
            srcViewBody.innerHTML = '<div class="srcview-fallback">エラー: ' + escHtml(data.error || '取得失敗') + '</div>';
            return;
          }
          var purposeHtml = data.purpose
            ? '<div class="srcview-purpose">' + escHtml(data.purpose) + '</div>'
            : '<div class="srcview-purpose empty">（説明未登録）</div>';
          var codeHtml;
          if (data.source_snippet) {
            var snippet = data.source_snippet.replace(/\\n$/, '');
            var lineTotal = snippet.split('\\n').length;
            codeHtml =
              '<div class="srcview-code-flex">' +
              '<pre class="srcview-gutter">' + buildGutter(lineTotal, data.start_line) + '</pre>' +
              '<pre class="srcview-code"><code>' + highlightTs(snippet) + '</code></pre>' +
              '</div>';
          } else {
            var linkHtml = data.github_url
              ? '<a href="' + escHtml(data.github_url) + '" target="_blank" rel="noopener">GitHub でファイルを開く →</a>'
              : '';
            codeHtml = '<div class="srcview-fallback">ソースコードが登録されていません。<br>scripts/index-functions.ts を実行して source_snippet を追加すると表示されます。<br><br>' + linkHtml + '</div>';
          }
          srcViewBody.innerHTML =
            '<div class="srcview-meta"><code>' + escHtml(filePath) + '</code></div>' +
            purposeHtml + codeHtml;
        })
        .catch(function(err) {
          srcViewBody.innerHTML = '<div class="srcview-fallback">通信エラー: ' + escHtml(String(err)) + '</div>';
        });
    }

    function closeSrcViewer() {
      srcViewOverlay.classList.remove('open');
    }

    if (srcViewClose) srcViewClose.addEventListener('click', closeSrcViewer);
    srcViewOverlay.addEventListener('click', function(e) {
      if (e.target === srcViewOverlay) closeSrcViewer();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && srcViewOverlay.classList.contains('open')) closeSrcViewer();
    });

    // イベントデリゲーション: 主テーブル
    var tableBodyEl = document.getElementById('tableBody');
    if (tableBodyEl) {
      tableBodyEl.addEventListener('click', function(e) {
        var link = e.target.closest('.fn-link');
        if (!link) return;
        var funcName = link.dataset.func;
        var filePath = link.dataset.file;
        if (funcName && filePath) openSrcViewer(funcName, filePath);
      });
    }

    // イベントデリゲーション: カタログテーブル
    var catalogBodyEl = document.getElementById('catalogBody');
    if (catalogBodyEl) {
      catalogBodyEl.addEventListener('click', function(e) {
        var link = e.target.closest('.fn-link');
        if (!link) return;
        var funcName = link.dataset.func;
        var filePath = link.dataset.file;
        if (funcName && filePath) openSrcViewer(funcName, filePath);
      });
    }

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

    // ---- カタログモード ----
    var catalogMode = false;
    var catalogWrap = document.getElementById('catalogWrap');
    var btnCatalogToggle = document.getElementById('btnCatalogToggle');

    var catalogSortKey = null;
    var catalogSortDir = 'desc';

    function catalogLineCount(r) {
      return (r.start_line && r.end_line) ? (r.end_line - r.start_line + 1) : null;
    }

    function renderCatalogTable() {
      var tbody = document.getElementById('catalogBody');
      var fileVal = filterFile ? filterFile.value : '';
      var filtered = fileVal
        ? CATALOG_ROWS.filter(function(r) { return r.file_path === fileVal; })
        : CATALOG_ROWS.slice();
      if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">データなし — ts_function_catalog にレコードを追加するか、npx tsx scripts/index-functions.ts を実行してください</td></tr>';
        updateCatalogSortIndicators();
        return;
      }
      if (catalogSortKey) {
        var dir = catalogSortDir === 'asc' ? 1 : -1;
        filtered = filtered.slice().sort(function(a, b) {
          var av, bv;
          if (catalogSortKey === 'linecount') {
            av = catalogLineCount(a); bv = catalogLineCount(b);
          } else {
            av = a.caller_count; bv = b.caller_count;
          }
          if (av === null) av = -1;
          if (bv === null) bv = -1;
          return (av - bv) * dir;
        });
      }
      tbody.innerHTML = filtered.map(function(r) {
        var lines = r.start_line ? 'L' + r.start_line + (r.end_line ? '–' + r.end_line : '') : '—';
        var lineCount = catalogLineCount(r);
        var attrs = [
          r.is_exported ? '<span class="badge badge-exp">export</span>' : '',
          r.is_async ? '<span class="badge badge-async">async</span>' : ''
        ].filter(Boolean).join(' ');
        var rowClass = r.caller_count > 0 ? ' class="has-callers"' : '';
        return '<tr' + rowClass + '>' +
          '<td class="col-cat-file"><code>' + escHtml(r.file_path) + '</code></td>' +
          '<td class="col-cat-func"><code class="fn-link" data-func="' + escHtml(r.function_name) + '" data-file="' + escHtml(r.file_path) + '">' + escHtml(r.function_name) + '</code></td>' +
          '<td class="col-cat-purpose"><span class="purpose">' + escHtml(r.purpose || '') + '</span></td>' +
          '<td class="col-cat-linecount">' + (lineCount !== null ? lineCount : '—') + '</td>' +
          '<td class="col-cat-lines">' + lines + '</td>' +
          '<td class="col-cat-attrs">' + (attrs || '—') + '</td>' +
          '<td class="col-cat-callers">' + r.caller_count + '</td>' +
          '</tr>';
      }).join('');
      updateCatalogSortIndicators();
    }

    function updateCatalogSortIndicators() {
      var thLineCount = document.getElementById('thCatLineCount');
      var thCallers = document.getElementById('thCatCallers');
      if (!thLineCount || !thCallers) return;
      var arrow = catalogSortDir === 'asc' ? '↑' : '↓';
      thLineCount.innerHTML = '行数' + (catalogSortKey === 'linecount' ? ' <span class="sort-indicator">' + arrow + '</span>' : '');
      thCallers.innerHTML = '呼び出し元' + (catalogSortKey === 'callers' ? ' <span class="sort-indicator">' + arrow + '</span>' : '');
    }

    function toggleCatalogSort(key) {
      if (catalogSortKey === key) {
        catalogSortDir = catalogSortDir === 'desc' ? 'asc' : 'desc';
      } else {
        catalogSortKey = key;
        catalogSortDir = 'desc';
      }
      renderCatalogTable();
    }

    var thCatLineCount = document.getElementById('thCatLineCount');
    var thCatCallers = document.getElementById('thCatCallers');
    if (thCatLineCount) {
      thCatLineCount.addEventListener('click', function() { toggleCatalogSort('linecount'); });
    }
    if (thCatCallers) {
      thCatCallers.addEventListener('click', function() { toggleCatalogSort('callers'); });
    }

    function enterCatalogMode() {
      catalogMode = true;
      if (btnCatalogToggle) { btnCatalogToggle.textContent = '📋 変更ログ'; btnCatalogToggle.classList.add('active'); }
      if (tableWrap) tableWrap.style.display = 'none';
      if (catalogWrap) { catalogWrap.style.display = ''; renderCatalogTable(); }
    }

    function exitCatalogMode() {
      catalogMode = false;
      if (btnCatalogToggle) { btnCatalogToggle.textContent = '📚 カタログ'; btnCatalogToggle.classList.remove('active'); }
      if (tableWrap) tableWrap.style.display = '';
      if (catalogWrap) catalogWrap.style.display = 'none';
    }

    if (btnCatalogToggle) {
      btnCatalogToggle.addEventListener('click', function() {
        if (catalogMode) exitCatalogMode(); else enterCatalogMode();
      });
    }

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

    var currentStep = 0;
    function setStep(step) {
      currentStep = step;
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
      if (catalogMode) renderCatalogTable();
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
            if (currentStep === 0) setStep(1);
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

    var modalRight       = document.getElementById('modalRight');
    var purposeTh        = document.getElementById('purposeTh');
    var purposeList      = document.getElementById('purposeList');
    var btnLayoutToggle  = document.getElementById('btnLayoutToggle');

    var selectedEntry = null;
    var searchMode = false;
    var layoutMode = '3pane';
    var purposeSpacerTop = null;

    function ensurePurposeSpacerTop() {
      if (!purposeSpacerTop) {
        purposeSpacerTop = document.createElement('div');
        purposeSpacerTop.style.flexShrink = '0';
        modalRight.insertBefore(purposeSpacerTop, purposeTh);
      }
      var searchBoxEl = document.querySelector('.modal-search-box');
      var fileSelectEl = document.querySelector('.modal-file-select');
      var h = (searchBoxEl ? searchBoxEl.offsetHeight : 0) + (fileSelectEl ? fileSelectEl.offsetHeight : 0);
      purposeSpacerTop.style.height = h + 'px';
    }

    function highlightKeyword(text, keyword) {
      if (!keyword || !text) return escHtml(text);
      var lowerText = text.toLowerCase();
      var lowerKw = keyword.toLowerCase();
      var result = '';
      var pos = 0;
      var idx = lowerText.indexOf(lowerKw);
      while (idx !== -1) {
        result += escHtml(text.slice(pos, idx));
        result += '<span class="kw-highlight">' + escHtml(text.slice(idx, idx + keyword.length)) + '</span>';
        pos = idx + keyword.length;
        idx = lowerText.indexOf(lowerKw, pos);
      }
      return result + escHtml(text.slice(pos));
    }

    function syncPurposeList() {
      if (layoutMode !== '2pane') return;
      var lis = Array.from(funcList.querySelectorAll('li'));
      purposeList.innerHTML = '';
      lis.forEach(function(li) { li.style.minHeight = ''; });

      var currentKw = modalSearch ? modalSearch.value.trim() : '';

      lis.forEach(function(li) {
        var file = li.dataset.file || '';
        var func = li.dataset.func || '';
        var entry = ALL_FUNCTIONS.find(function(e) { return e.file === file && e.func === func; });
        var purpose = entry ? (entry.purpose || '') : '';

        var div = document.createElement('div');
        div.className = 'purpose-item' + (li.classList.contains('active') ? ' active' : '');
        div.dataset.file = file;
        div.dataset.func = func;
        if (purpose) {
          div.innerHTML = highlightKeyword(purpose, currentKw);
        } else {
          var s = document.createElement('span');
          s.className = 'purpose-item-empty';
          s.textContent = '（説明未登録）';
          div.appendChild(s);
        }
        div.addEventListener('click', function() {
          var e = ALL_FUNCTIONS.find(function(x) { return x.file === div.dataset.file && x.func === div.dataset.func; });
          if (!e) return;
          document.querySelectorAll('.modal-func-list li').forEach(function(l) { l.classList.remove('active'); });
          var matchLi = Array.from(funcList.querySelectorAll('li')).find(function(l) { return l.dataset.file === e.file && l.dataset.func === e.func; });
          if (matchLi) matchLi.classList.add('active');
          selectedEntry = e;
          switch3Pane();
          showFunctionDetail(e);
        });
        purposeList.appendChild(div);
      });

      requestAnimationFrame(function() {
        var freshLis = Array.from(funcList.querySelectorAll('li'));
        var divs = Array.from(purposeList.querySelectorAll('.purpose-item'));
        var n = Math.min(freshLis.length, divs.length);
        for (var i = 0; i < n; i++) { freshLis[i].style.minHeight = ''; divs[i].style.minHeight = ''; }
        requestAnimationFrame(function() {
          for (var i = 0; i < n; i++) {
            var h = Math.max(freshLis[i].offsetHeight, divs[i].offsetHeight);
            freshLis[i].style.minHeight = h + 'px';
            divs[i].style.minHeight = h + 'px';
          }
        });
      });
    }

    function onFuncScroll() { purposeList.scrollTop = funcList.scrollTop; }
    function onPurposeScroll() { funcList.scrollTop = purposeList.scrollTop; }

    function switch2Pane() {
      layoutMode = '2pane';
      btnLayoutToggle.textContent = '⊟ 詳細';
      btnLayoutToggle.title = '3ペイン詳細表示に切り替え';
      purposeTh.style.display = 'block';
      purposeList.style.display = 'flex';
      purposeList.style.flexDirection = 'column';
      rightHeader.style.display = 'none';
      rightBody.style.display = 'none';
      ensurePurposeSpacerTop();
      syncPurposeList();
      funcList.addEventListener('scroll', onFuncScroll);
      purposeList.addEventListener('scroll', onPurposeScroll);
    }

    function switch3Pane() {
      layoutMode = '3pane';
      btnLayoutToggle.textContent = '⊞ 一覧';
      btnLayoutToggle.title = '2ペイン一覧表示に切り替え';
      purposeTh.style.display = 'none';
      purposeList.style.display = 'none';
      rightHeader.style.display = '';
      rightBody.style.display = '';
      funcList.removeEventListener('scroll', onFuncScroll);
      purposeList.removeEventListener('scroll', onPurposeScroll);
    }

    if (btnLayoutToggle) {
      btnLayoutToggle.addEventListener('click', function() {
        if (layoutMode === '3pane') switch2Pane(); else switch3Pane();
      });
    }

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
          document.querySelectorAll('.purpose-item').forEach(function(d) { d.classList.remove('active'); });
          var matchDiv = Array.from(purposeList.querySelectorAll('.purpose-item')).find(function(d) { return d.dataset.file === e.file && d.dataset.func === e.func; });
          if (matchDiv) matchDiv.classList.add('active');
          selectedEntry = e;
          if (showFile) {
            modalFileSelect.value = e.file;
            modalFileSelect.classList.remove('sel-needed');
            modalFileSelect.classList.add('sel-done');
          }
          if (layoutMode === '2pane') switch3Pane();
          showFunctionDetail(e);
        });
        funcList.appendChild(li);
      });
      syncPurposeList();
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
                '&file_path=' + encodeURIComponent(e.file) +
                '&max_lines=' + encodeURIComponent(srcMaxLines);

      fetch(url)
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (!data.ok) {
            sourceBlock.innerHTML = '<div class="source-fallback">エラー: ' + escHtml(data.error || '取得失敗') + '</div>';
            return;
          }
          if (data.source_snippet) {
            var snippet2 = data.source_snippet.replace(/\\n$/, '');
            var lineTotal2 = snippet2.split('\\n').length;
            sourceBlock.innerHTML =
              '<div class="srcview-code-flex">' +
              '<pre class="srcview-gutter">' + buildGutter(lineTotal2, data.start_line) + '</pre>' +
              '<pre class="srcview-code"><code>' + highlightTs(snippet2) + '</code></pre>' +
              '</div>';
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
      purposeList.innerHTML = '';
      funcCount.textContent = 'ファイルを選択すると関数一覧が表示されます';
      rightHeader.innerHTML = '<div class="fn-placeholder">（左からファイル → 関数の順に選択してください）</div>';
      rightBody.innerHTML = '';
      selectedEntry = null;
      overlay.classList.add('open');
      if (layoutMode === '2pane') {
        requestAnimationFrame(ensurePurposeSpacerTop);
      }
      modalSearch.focus();
    }

    function closeModal() {
      overlay.classList.remove('open');
    }

    ${renderKeyPickerJs({ targetInputId: 'modalSearch', triggerBtnId: 'btnKeyPicker', afterSelectJs: 'if(typeof layoutMode!=="undefined"&&layoutMode==="3pane")switch2Pane()' })}

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

    // ---- 円グラフモーダル ----
    var PIE_COLORS = [
      '#58a6ff','#3fb950','#e3b341','#f85149','#bc8cff','#79c0ff','#ff7b72','#56d364',
      '#ffa657','#d2a8ff','#7ee787','#f0883e','#a5d6ff','#ff9bce','#85e89d','#b392f0'
    ];
    var chartOverlayEl  = document.getElementById('chartOverlay');
    var chartCloseEl    = document.getElementById('chartClose');
    var chartTabFileEl  = document.getElementById('chartTabFile');
    var chartTabFuncEl  = document.getElementById('chartTabFunc');
    var chartLegendEl   = document.getElementById('chartLegend');
    var pieCanvas       = document.getElementById('pieCanvas');
    var pieCtx          = pieCanvas ? pieCanvas.getContext('2d') : null;
    var chartDim        = 'file';
    var hoveredIdx      = -1;

    var chartMetricLabel = '変更件数';

    function buildPieData(dim) {
      var map = {};
      var visibleRows = Array.from(document.querySelectorAll('#tableBody tr[data-file]')).filter(function(tr) {
        return (tr.style.display !== 'none');
      });
      visibleRows.forEach(function(tr) {
        var file = tr.getAttribute('data-file') || '';
        var func = tr.getAttribute('data-func') || '';
        var key = dim === 'file' ? file : (func + ' (' + file + ')');
        if (!key) return;
        map[key] = (map[key] || 0) + 1;
      });
      chartMetricLabel = '変更件数';
      var entries = Object.keys(map).map(function(k) { return { label: k, value: map[k] }; });
      entries.sort(function(a, b) { return b.value - a.value; });
      return entries;
    }

    function drawPie(data, hIdx) {
      if (!pieCtx) return;
      var W = 220, H = 220, cx = W / 2, cy = H / 2, R = 88, IR = 44;
      pieCtx.clearRect(0, 0, W, H);
      var total = data.reduce(function(s, d) { return s + d.value; }, 0);
      if (total === 0) return;
      var angle = -Math.PI / 2;
      var gap = 0.012;
      data.forEach(function(d, i) {
        var slice = (d.value / total) * Math.PI * 2;
        var color = PIE_COLORS[i % PIE_COLORS.length];
        var isHov = i === hIdx;
        var rr = isHov ? R + 7 : R;
        pieCtx.beginPath();
        pieCtx.moveTo(cx, cy);
        pieCtx.arc(cx, cy, rr, angle + gap, angle + slice - gap);
        pieCtx.closePath();
        pieCtx.fillStyle = color;
        pieCtx.globalAlpha = isHov ? 1.0 : 0.85;
        pieCtx.fill();
        pieCtx.globalAlpha = 1.0;
        angle += slice;
      });
      pieCtx.beginPath();
      pieCtx.arc(cx, cy, IR, 0, Math.PI * 2);
      var isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      pieCtx.fillStyle = isDark ? '#161b22' : '#ffffff';
      pieCtx.fill();
      if (hIdx >= 0 && data[hIdx]) {
        var pct = Math.round(data[hIdx].value / total * 100);
        pieCtx.fillStyle = isDark ? '#c9d1d9' : '#1f2328';
        pieCtx.font = 'bold 14px sans-serif';
        pieCtx.textAlign = 'center';
        pieCtx.textBaseline = 'middle';
        pieCtx.fillText(pct + '%', cx, cy);
      }
    }

    function renderChartLegend(data) {
      chartLegendEl.innerHTML = '';
      var total = data.reduce(function(s, d) { return s + d.value; }, 0);
      data.forEach(function(d, i) {
        var color = PIE_COLORS[i % PIE_COLORS.length];
        var pct = total > 0 ? Math.round(d.value / total * 100) : 0;
        var item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML =
          '<div class="legend-dot" style="background:' + color + '"></div>' +
          '<span class="legend-label">' + escHtml(d.label) + '</span>' +
          '<span class="legend-val">' + d.value + chartMetricLabel + ' (' + pct + '%)</span>';
        item.addEventListener('mouseenter', function() {
          hoveredIdx = i;
          drawPie(data, i);
          chartLegendEl.querySelectorAll('.legend-item').forEach(function(el, j) {
            el.classList.toggle('legend-active', j === i);
          });
        });
        item.addEventListener('mouseleave', function() {
          hoveredIdx = -1;
          drawPie(data, -1);
          chartLegendEl.querySelectorAll('.legend-item').forEach(function(el) { el.classList.remove('legend-active'); });
        });
        chartLegendEl.appendChild(item);
      });
    }

    var chartTitleEl = document.querySelector('#chartModal .chart-title');

    function renderChart() {
      var data = buildPieData(chartDim);
      if (chartTitleEl) chartTitleEl.textContent = '📈 ' + (chartDim === 'file' ? 'ファイル別' : '関数別') + chartMetricLabel;
      if (data.length === 0) {
        if (pieCtx) pieCtx.clearRect(0, 0, 220, 220);
        var diagCount = document.querySelectorAll('#tableBody tr[data-file]').length;
        var diagVisible = Array.from(document.querySelectorAll('#tableBody tr[data-file]')).filter(function(tr) { return tr.style.display !== 'none'; }).length;
        chartLegendEl.innerHTML = '<div class="chart-empty">データなし<br><span style="font-size:10px;color:var(--text-muted)">DOM行数: ' + diagCount + ' / 表示中: ' + diagVisible + '</span></div>';
        return;
      }
      drawPie(data, -1);
      renderChartLegend(data);
    }

    function openChartModal() {
      chartOverlayEl.style.zIndex = String(getNextZ());
      chartOverlayEl.classList.add('open');
      renderChart();
    }
    function closeChartModal() {
      chartOverlayEl.classList.remove('open');
    }

    var btnChart = document.getElementById('btnChart');
    if (btnChart) {
      btnChart.addEventListener('click', openChartModal);
    }
    if (chartCloseEl) {
      chartCloseEl.addEventListener('click', closeChartModal);
    }
    chartOverlayEl.addEventListener('click', function(e) {
      if (e.target === chartOverlayEl) closeChartModal();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && chartOverlayEl.classList.contains('open')) closeChartModal();
    });

    chartTabFileEl.addEventListener('click', function() {
      chartDim = 'file';
      chartTabFileEl.classList.add('active');
      chartTabFuncEl.classList.remove('active');
      renderChart();
    });
    chartTabFuncEl.addEventListener('click', function() {
      chartDim = 'func';
      chartTabFuncEl.classList.add('active');
      chartTabFileEl.classList.remove('active');
      renderChart();
    });

    if (pieCanvas) {
      pieCanvas.addEventListener('mousemove', function(e) {
        var data = buildPieData(chartDim);
        var total = data.reduce(function(s, d) { return s + d.value; }, 0);
        if (total === 0) return;
        var rect = pieCanvas.getBoundingClientRect();
        var mx = e.clientX - rect.left - 110, my = e.clientY - rect.top - 110;
        var dist = Math.sqrt(mx * mx + my * my);
        if (dist < 44 || dist > 95) {
          if (hoveredIdx !== -1) { hoveredIdx = -1; drawPie(data, -1); chartLegendEl.querySelectorAll('.legend-item').forEach(function(el) { el.classList.remove('legend-active'); }); }
          return;
        }
        var angle = Math.atan2(my, mx) - (-Math.PI / 2);
        if (angle < 0) angle += Math.PI * 2;
        var cum = 0, found = -1;
        data.forEach(function(d, i) {
          var slice = (d.value / total) * Math.PI * 2;
          if (found === -1 && angle >= cum && angle < cum + slice) found = i;
          cum += slice;
        });
        if (found !== hoveredIdx) {
          hoveredIdx = found;
          drawPie(data, found);
          chartLegendEl.querySelectorAll('.legend-item').forEach(function(el, j) { el.classList.toggle('legend-active', j === found); });
        }
      });
      pieCanvas.addEventListener('mouseleave', function() {
        var data = buildPieData(chartDim);
        hoveredIdx = -1;
        drawPie(data, -1);
        chartLegendEl.querySelectorAll('.legend-item').forEach(function(el) { el.classList.remove('legend-active'); });
      });
    }
  </script>
</body>
</html>`;
}
