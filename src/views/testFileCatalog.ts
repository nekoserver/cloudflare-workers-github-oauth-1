import { escapeHtml } from '../utils/html';

export interface TestFileCatalogRow {
  repo_name: string;
  file_path: string;
  test_count: number;
  test_summary: string;
  test_types: string;
  grade: string;
  created_at: string;
  last_evaluated_at: string;
}

export interface TestFileCatalogInput {
  rows: TestFileCatalogRow[];
  allRepos: string[];
  filterRepo: string | null;
  filterGrade: string | null;
  filterQuery: string;
  sort: string;
}

// A+(14) 〜 E-(0) の15段階。平均値算出・ソートに使う。
const GRADE_LEVELS = ['E-', 'E', 'E+', 'D-', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+'];

export function gradeToScore(grade: string): number {
  const idx = GRADE_LEVELS.indexOf(grade);
  return idx === -1 ? 0 : idx;
}

export function scoreToGrade(score: number): string {
  const idx = Math.max(0, Math.min(GRADE_LEVELS.length - 1, Math.round(score)));
  return GRADE_LEVELS[idx];
}

function gradeClass(grade: string): string {
  const score = gradeToScore(grade);
  if (score >= 12) return 'grade-a';
  if (score >= 9) return 'grade-b';
  if (score >= 6) return 'grade-c';
  if (score >= 3) return 'grade-d';
  return 'grade-e';
}

export type RepoAgg = {
  repo: string;
  count: number;
  totalTests: number;
  avgScore: number;
  gradeCounts: Record<string, number>;
};

export function buildRepoAggregates(rows: TestFileCatalogRow[]): RepoAgg[] {
  const map = new Map<string, RepoAgg>();
  for (const row of rows) {
    let agg = map.get(row.repo_name);
    if (!agg) {
      agg = { repo: row.repo_name, count: 0, totalTests: 0, avgScore: 0, gradeCounts: {} };
      map.set(row.repo_name, agg);
    }
    agg.count += 1;
    agg.totalTests += row.test_count;
    agg.gradeCounts[row.grade] = (agg.gradeCounts[row.grade] ?? 0) + 1;
  }
  for (const agg of map.values()) {
    const sum = Object.entries(agg.gradeCounts).reduce((s, [g, n]) => s + gradeToScore(g) * n, 0);
    agg.avgScore = agg.count > 0 ? sum / agg.count : 0;
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export function buildOverallGradeDistribution(rows: TestFileCatalogRow[]): Array<{ grade: string; count: number }> {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.grade] = (counts[row.grade] ?? 0) + 1;
  return [...GRADE_LEVELS].reverse().map(grade => ({ grade, count: counts[grade] ?? 0 }));
}

export function sortRows(rows: TestFileCatalogRow[], sort: string): TestFileCatalogRow[] {
  const sorted = [...rows];
  switch (sort) {
    case 'grade_asc':
      sorted.sort((a, b) => gradeToScore(a.grade) - gradeToScore(b.grade));
      break;
    case 'grade_desc':
      sorted.sort((a, b) => gradeToScore(b.grade) - gradeToScore(a.grade));
      break;
    case 'test_count_desc':
      sorted.sort((a, b) => b.test_count - a.test_count);
      break;
    case 'test_count_asc':
      sorted.sort((a, b) => a.test_count - b.test_count);
      break;
    case 'last_evaluated_desc':
      sorted.sort((a, b) => b.last_evaluated_at.localeCompare(a.last_evaluated_at));
      break;
    case 'file_path':
    default:
      sorted.sort((a, b) => (a.repo_name + a.file_path).localeCompare(b.repo_name + b.file_path));
  }
  return sorted;
}

export function getTestFileCatalogPage(input: TestFileCatalogInput): string {
  const { rows, allRepos, filterRepo, filterGrade, filterQuery, sort } = input;
  const sortedRows = sortRows(rows, sort);
  const repoAggs = buildRepoAggregates(rows);
  const gradeDist = buildOverallGradeDistribution(rows);
  const overallTotal = rows.length;
  const overallTests = rows.reduce((s, r) => s + r.test_count, 0);
  const overallAvgScore = overallTotal > 0
    ? rows.reduce((s, r) => s + gradeToScore(r.grade), 0) / overallTotal
    : 0;
  const maxGradeCount = Math.max(1, ...gradeDist.map(g => g.count));

  const repoOptions = allRepos.map(repo =>
    `<option value="${escapeHtml(repo)}"${filterRepo === repo ? ' selected' : ''}>${escapeHtml(repo)}</option>`
  ).join('\n');

  const gradeOptions = [...GRADE_LEVELS].reverse().map(g =>
    `<option value="${escapeHtml(g)}"${filterGrade === g ? ' selected' : ''}>${escapeHtml(g)}</option>`
  ).join('\n');

  const sortOptions: Array<[string, string]> = [
    ['file_path', 'リポジトリ・ファイルパス順'],
    ['grade_desc', '評価が高い順'],
    ['grade_asc', '評価が低い順'],
    ['test_count_desc', 'テスト件数が多い順'],
    ['test_count_asc', 'テスト件数が少ない順'],
    ['last_evaluated_desc', '最終評価日が新しい順'],
  ];
  const sortOptionsHtml = sortOptions.map(([value, label]) =>
    `<option value="${value}"${sort === value ? ' selected' : ''}>${escapeHtml(label)}</option>`
  ).join('\n');

  const repoAggRows = repoAggs.map(agg => `
    <tr>
      <td><code>${escapeHtml(agg.repo)}</code></td>
      <td class="num">${agg.count}</td>
      <td class="num">${agg.totalTests}</td>
      <td class="num"><span class="grade-chip ${gradeClass(scoreToGrade(agg.avgScore))}">${escapeHtml(scoreToGrade(agg.avgScore))}</span> <span class="muted">(${agg.avgScore.toFixed(2)})</span></td>
    </tr>`).join('\n');

  const gradeBarRows = gradeDist.map(g => {
    const pct = Math.round((g.count / maxGradeCount) * 100);
    return `
    <div class="grade-bar-row">
      <span class="grade-bar-label grade-chip ${gradeClass(g.grade)}">${escapeHtml(g.grade)}</span>
      <div class="grade-bar-track"><div class="grade-bar-fill ${gradeClass(g.grade)}" style="width:${pct}%"></div></div>
      <span class="grade-bar-count">${g.count}</span>
    </div>`;
  }).join('\n');

  const tableRows = sortedRows.map(r => `
    <tr>
      <td><code class="repo-tag">${escapeHtml(r.repo_name.split('/').pop() ?? r.repo_name)}</code></td>
      <td class="col-file"><code>${escapeHtml(r.file_path)}</code></td>
      <td class="num">${r.test_count}</td>
      <td class="col-summary" title="${escapeHtml(r.test_summary)}">${escapeHtml(r.test_summary.slice(0, 120))}${r.test_summary.length > 120 ? '…' : ''}</td>
      <td class="col-types">${escapeHtml(r.test_types || '—')}</td>
      <td class="num"><span class="grade-chip ${gradeClass(r.grade)}">${escapeHtml(r.grade)}</span></td>
      <td class="col-date">${escapeHtml(r.created_at)}</td>
      <td class="col-date">${escapeHtml(r.last_evaluated_at)}</td>
    </tr>`).join('\n');

  const emptyRow = '<tr><td colspan="8" class="empty-cell">条件に一致するテストファイルがありません</td></tr>';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>テストファイル評価カタログ</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg:         light-dark(#f6f8fa, #0d1117);
      --panel:      light-dark(#ffffff, #161b22);
      --border:     light-dark(#d0d7de, #30363d);
      --text:       light-dark(#1f2328, #c9d1d9);
      --text-muted: light-dark(#636c76, #8b949e);
      --text-strong:light-dark(#1f2328, #f0f6fc);
      --accent:     light-dark(#0969da, #58a6ff);
      --th-bg:      light-dark(#f6f8fa, #1c2128);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 24px;
      background: var(--bg); color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px; line-height: 1.5;
    }
    h1 { color: var(--text-strong); font-size: 20px; margin: 0 0 4px; }
    h2 { color: var(--text-strong); font-size: 15px; margin: 24px 0 10px; }
    .subtitle { color: var(--text-muted); font-size: 12px; margin-bottom: 20px; }
    .panel {
      background: var(--panel); border: 1px solid var(--border); border-radius: 10px;
      padding: 16px; margin-bottom: 20px;
    }
    .stat-row { display: flex; gap: 16px; flex-wrap: wrap; }
    .stat-card {
      flex: 1; min-width: 140px; background: var(--th-bg); border: 1px solid var(--border);
      border-radius: 8px; padding: 12px 16px;
    }
    .stat-card .stat-label { color: var(--text-muted); font-size: 11px; }
    .stat-card .stat-value { font-size: 22px; font-weight: 700; color: var(--text-strong); margin-top: 2px; }
    .filter-form { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; margin-bottom: 4px; }
    .filter-field { display: flex; flex-direction: column; gap: 4px; }
    .filter-field label { font-size: 11px; color: var(--text-muted); }
    .filter-field select, .filter-field input {
      padding: 5px 8px; border-radius: 6px; border: 1px solid var(--border);
      background: var(--panel); color: var(--text); font-size: 12px; min-width: 160px;
    }
    .filter-field button {
      padding: 6px 14px; border-radius: 6px; border: 1px solid var(--accent);
      background: var(--accent); color: #fff; font-size: 12px; cursor: pointer;
    }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { padding: 6px 10px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
    th { background: var(--th-bg); color: var(--text-muted); font-weight: 600; position: sticky; top: 0; }
    td.num, th.num { text-align: right; }
    .muted { color: var(--text-muted); font-size: 11px; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; }
    .repo-tag { color: var(--accent); }
    .col-file code { word-break: break-all; }
    .col-summary { max-width: 360px; }
    .col-types { color: var(--text-muted); font-size: 11px; max-width: 220px; }
    .col-date { white-space: nowrap; color: var(--text-muted); }
    .empty-cell { text-align: center; color: var(--text-muted); padding: 24px; }
    .grade-chip {
      display: inline-block; min-width: 28px; text-align: center; padding: 1px 6px;
      border-radius: 5px; font-weight: 700; font-size: 11px;
    }
    .grade-a { background: light-dark(#dafbe1, #1a3d1f); color: light-dark(#116329, #56d364); }
    .grade-b { background: light-dark(#ddf4ff, #0d2136); color: light-dark(#0550ae, #79c0ff); }
    .grade-c { background: light-dark(#fff8c5, #2d2a00); color: light-dark(#7d4e00, #e3b341); }
    .grade-d { background: light-dark(#fff1e5, #3a2412); color: light-dark(#a04f00, #e8a658); }
    .grade-e { background: light-dark(#ffebe9, #3c1a1a); color: light-dark(#cf222e, #f85149); }
    .grade-bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .grade-bar-label { width: 32px; flex-shrink: 0; }
    .grade-bar-track { flex: 1; height: 14px; background: var(--th-bg); border-radius: 4px; overflow: hidden; }
    .grade-bar-fill { height: 100%; }
    .grade-bar-count { width: 36px; text-align: right; color: var(--text-muted); font-size: 11px; flex-shrink: 0; }
    .table-wrap { overflow: auto; max-height: 70vh; border: 1px solid var(--border); border-radius: 8px; }
  </style>
</head>
<body>
  <h1>テストファイル評価カタログ</h1>
  <p class="subtitle">全リポジトリのテストファイル一覧。何をテストしているか・アサーション種別・評価(A+〜E-)・作成日・最終評価日を集計・検索できます。</p>

  <div class="panel">
    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-label">総テストファイル数</div>
        <div class="stat-value">${overallTotal}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">総テスト件数</div>
        <div class="stat-value">${overallTests}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">平均評価</div>
        <div class="stat-value"><span class="grade-chip ${gradeClass(scoreToGrade(overallAvgScore))}">${escapeHtml(scoreToGrade(overallAvgScore))}</span> <span class="muted">(${overallAvgScore.toFixed(2)})</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">対象リポジトリ数</div>
        <div class="stat-value">${allRepos.length}</div>
      </div>
    </div>
  </div>

  <h2>リポジトリ別集計</h2>
  <div class="panel">
    <table>
      <thead><tr><th>リポジトリ</th><th class="num">ファイル数</th><th class="num">テスト件数合計</th><th class="num">平均評価</th></tr></thead>
      <tbody>${repoAggRows || '<tr><td colspan="4" class="empty-cell">データがありません</td></tr>'}</tbody>
    </table>
  </div>

  <h2>評価分布(全体)</h2>
  <div class="panel">
    ${gradeBarRows}
  </div>

  <h2>テストファイル一覧</h2>
  <div class="panel">
    <form class="filter-form" method="get" action="/test-file-catalog">
      <div class="filter-field">
        <label for="repo">リポジトリ</label>
        <select name="repo" id="repo">
          <option value="">すべて</option>
          ${repoOptions}
        </select>
      </div>
      <div class="filter-field">
        <label for="grade">評価</label>
        <select name="grade" id="grade">
          <option value="">すべて</option>
          ${gradeOptions}
        </select>
      </div>
      <div class="filter-field">
        <label for="q">ファイルパス・テスト内容を検索</label>
        <input type="text" name="q" id="q" value="${escapeHtml(filterQuery)}" placeholder="例: ai-cache, qsearch">
      </div>
      <div class="filter-field">
        <label for="sort">並び順</label>
        <select name="sort" id="sort">
          ${sortOptionsHtml}
        </select>
      </div>
      <div class="filter-field">
        <button type="submit">絞り込む</button>
      </div>
    </form>
  </div>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>リポジトリ</th>
          <th>ファイルパス</th>
          <th class="num">テスト件数</th>
          <th>何をテストしているか</th>
          <th>アサーション種別</th>
          <th class="num">評価</th>
          <th>作成日</th>
          <th>最終評価日</th>
        </tr>
      </thead>
      <tbody>${tableRows || emptyRow}</tbody>
    </table>
  </div>
</body>
</html>`;
}
