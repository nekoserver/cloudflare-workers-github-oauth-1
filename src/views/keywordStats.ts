/**
 * 🔑 コミット要約キーワード統計ページのHTML。
 * ai_summary_keywordsから抽出されたキーワードの総数・リポジトリ別分布・
 * 頻出キーワードランキングをざっくり把握するためのページ。
 * CLAUDE.mdルール15に従い、集計処理はDBアクセスを含まない純粋関数として
 * src/index.ts側のクエリ結果を受け取るだけにする。
 */
import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

export type RepoKeywordCountRow = { repoFullName: string | null; keywordCount: number };
export type RepoFileCountRow = { repoFullName: string | null; fileCount: number };
export type FileExtKeywordRow = { fileExt: string; keywordFileCount: number };
export type KeywordFrequencyRow = { keyword: string; occurrenceCount: number };

export type KeywordStatsData = {
  totalKeywordRows: number;
  totalSummaryLogsWithKeywords: number;
  totalProcessedFiles: number;
  byRepo: RepoKeywordCountRow[];
  byRepoFiles: RepoFileCountRow[];
  byFileExt: FileExtKeywordRow[];
  topKeywords: KeywordFrequencyRow[];
};

/**
 * リポジトリ別の件数行を、件数の多い順に並べ替える(DBアクセスを含まない
 * 純粋関数)。repo_full_nameがNULLの行は「(リポジトリ不明)」として最後に
 * まとめる。sortRepoKeywordCounts・sortRepoFileCountsはどちらもこの
 * 共通ロジックを使う。
 */
function sortReposByCountDesc<T extends { repoFullName: string | null }>(rows: T[], countOf: (row: T) => number): T[] {
  const known = rows.filter((r) => r.repoFullName !== null).sort((a, b) => countOf(b) - countOf(a));
  const unknown = rows.filter((r) => r.repoFullName === null);
  return [...known, ...unknown];
}

/** リポジトリ別キーワード件数を、件数の多い順に並べ替える。 */
export function sortRepoKeywordCounts(rows: RepoKeywordCountRow[]): RepoKeywordCountRow[] {
  return sortReposByCountDesc(rows, (r) => r.keywordCount);
}

/** リポジトリ別の処理済みファイル件数を、件数の多い順に並べ替える。 */
export function sortRepoFileCounts(rows: RepoFileCountRow[]): RepoFileCountRow[] {
  return sortReposByCountDesc(rows, (r) => r.fileCount);
}

/**
 * ファイルタイプ(拡張子)別のキーワード分布を、件数の多い順(同数なら
 * 拡張子の昇順)に並べ替える。頻出キーワードランキング(SQL側でORDER BY)と
 * 揃えて、こちらはDBアクセスを含まない純粋関数側でテスト可能にする。
 */
export function sortFileExtKeywordCounts(rows: FileExtKeywordRow[]): FileExtKeywordRow[] {
  return [...rows].sort((a, b) => b.keywordFileCount - a.keywordFileCount || a.fileExt.localeCompare(b.fileExt));
}

export function getKeywordStatsPage(user: { name?: string; username: string }, data: KeywordStatsData): string {
  const displayName = escapeHtml(user.name || user.username);
  const initials = escapeHtml((user.name || user.username).substring(0, 2).toUpperCase());

  const byRepoSorted = sortRepoKeywordCounts(data.byRepo);
  const maxRepoCount = byRepoSorted.length > 0 ? Math.max(...byRepoSorted.map((r) => r.keywordCount)) : 0;

  const repoRows = byRepoSorted.length === 0
    ? '<tr class="empty-row"><td colspan="3">キーワードはまだありません</td></tr>'
    : byRepoSorted.map((r) => {
      const label = r.repoFullName ? escapeHtml(r.repoFullName) : '(リポジトリ不明)';
      const barWidth = maxRepoCount > 0 ? Math.round((r.keywordCount / maxRepoCount) * 100) : 0;
      return `<tr>` +
        `<td>${label}</td>` +
        `<td class="num">${r.keywordCount}</td>` +
        `<td class="bar-cell"><div class="bar-track"><div class="bar-fill" style="width:${barWidth}%"></div></div></td>` +
        `</tr>`;
    }).join('');

  const byRepoFilesSorted = sortRepoFileCounts(data.byRepoFiles);
  const maxRepoFileCount = byRepoFilesSorted.length > 0 ? Math.max(...byRepoFilesSorted.map((r) => r.fileCount)) : 0;

  const repoFileRows = byRepoFilesSorted.length === 0
    ? '<tr class="empty-row"><td colspan="3">処理済みファイルはまだありません</td></tr>'
    : byRepoFilesSorted.map((r) => {
      const label = r.repoFullName ? escapeHtml(r.repoFullName) : '(リポジトリ不明)';
      const barWidth = maxRepoFileCount > 0 ? Math.round((r.fileCount / maxRepoFileCount) * 100) : 0;
      return `<tr>` +
        `<td>${label}</td>` +
        `<td class="num">${r.fileCount}</td>` +
        `<td class="bar-cell"><div class="bar-track"><div class="bar-fill" style="width:${barWidth}%"></div></div></td>` +
        `</tr>`;
    }).join('');

  const byFileExtSorted = sortFileExtKeywordCounts(data.byFileExt);
  const maxFileExtCount = byFileExtSorted.length > 0 ? Math.max(...byFileExtSorted.map((r) => r.keywordFileCount)) : 0;

  const fileExtRows = byFileExtSorted.length === 0
    ? '<tr class="empty-row"><td colspan="3">ファイルタイプ別の分布はまだありません</td></tr>'
    : byFileExtSorted.map((r) => {
      const barWidth = maxFileExtCount > 0 ? Math.round((r.keywordFileCount / maxFileExtCount) * 100) : 0;
      const extLabel = r.fileExt.startsWith('(') ? r.fileExt : `.${r.fileExt}`;
      return `<tr>` +
        `<td>${escapeHtml(extLabel)}</td>` +
        `<td class="num">${r.keywordFileCount}</td>` +
        `<td class="bar-cell"><div class="bar-track"><div class="bar-fill" style="width:${barWidth}%"></div></div></td>` +
        `</tr>`;
    }).join('');

  const topKeywordRows = data.topKeywords.length === 0
    ? '<tr class="empty-row"><td colspan="2">キーワードはまだありません</td></tr>'
    : data.topKeywords.map((k) => `<tr><td>${escapeHtml(k.keyword)}</td><td class="num">${k.occurrenceCount}</td></tr>`).join('');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🔑 コミット要約キーワード統計 - Cloudflare Workers GitHub OAuth</title>
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
      background: var(--navbar-bg); backdrop-filter: blur(10px);
      box-shadow: 0 2px 10px var(--navbar-shadow); padding: 16px 32px;
      display: flex; justify-content: space-between; align-items: center;
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
      display: none; position: absolute; top: 50px; right: 0;
      background: var(--dropdown-bg); border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 180px; z-index: 1000; overflow: hidden;
    }
    .dropdown-menu.show { display: block; }
    .dropdown-item {
      padding: 12px 20px; color: var(--text-secondary); text-decoration: none;
      display: block; cursor: pointer; border-bottom: 1px solid var(--border-color);
    }
    .dropdown-item:last-child { border-bottom: none; }
    .dropdown-item:hover { background: var(--dropdown-hover); }
    .dropdown-item.switch-account { color: var(--accent-color); }
    .dropdown-item.logout { color: var(--danger-color); }
    .container { max-width: 760px; margin: 0 auto; padding: 48px 32px; }
    .card {
      background: var(--card-bg); border-radius: 16px;
      box-shadow: 0 20px 60px var(--card-shadow); padding: 48px; margin-bottom: 32px;
    }
    .title { font-size: 32px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
    .subtitle { font-size: 14px; color: var(--text-muted); margin-bottom: 28px; line-height: 1.6; }
    .section-title { font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 28px 0 4px; }
    .section-note { font-size: 12px; color: var(--text-muted); margin-bottom: 12px; }
    .stat-tiles { display: flex; gap: 12px; flex-wrap: wrap; }
    .stat-tile {
      flex: 1; min-width: 160px;
      display: flex; flex-direction: column; gap: 4px;
      background: var(--bg-secondary); border-radius: 8px; padding: 14px 16px;
    }
    .stat-tile .stat-label { font-size: 13px; color: var(--text-secondary); }
    .stat-tile .stat-value { font-size: 26px; font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-secondary); }
    th { color: var(--text-muted); font-weight: 600; font-size: 11px; text-transform: uppercase; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; width: 80px; }
    .empty-row td { text-align: center; color: var(--text-muted); padding: 20px; }
    .bar-cell { width: 160px; }
    .bar-track { background: var(--border-color); border-radius: 4px; height: 8px; overflow: hidden; }
    .bar-fill { background: var(--accent-color); height: 100%; border-radius: 4px; }
    .back-btn {
      background: var(--accent-color); color: white; border: none; border-radius: 8px;
      padding: 12px 24px; font-size: 14px; font-weight: 600; cursor: pointer;
      margin-top: 24px; text-decoration: none; display: inline-block;
    }
    .back-btn:hover { background: var(--accent-hover); }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="navbar-brand">
      <span>🔑</span>
      <span>コミット要約キーワード統計</span>
    </div>
    <div class="user-menu">
      ${getThemeToggleHTML()}
      <span class="user-name">${displayName}</span>
      <div class="user-menu-container">
        <div class="user-icon" title="${displayName}" onclick="toggleDropdown()">
          ${initials}
        </div>
        <div class="dropdown-menu" id="dropdownMenu">
          <a href="/welcome" class="dropdown-item">🏠 ホーム</a>
          <a href="/aichat" class="dropdown-item">🤖 AI チャット</a>
          <a href="/repositories" class="dropdown-item">📦 リポジトリ</a>
          <a href="/function-changelog" class="dropdown-item">🔖 関数辞典</a>
          <a href="/userinfo" class="dropdown-item">👤 ユーザー情報</a>
          <a href="/status" class="dropdown-item">📊 キャッシュ状況</a>
          <a href="/api-keys" class="dropdown-item">🔑 キー管理</a>
          <a href="/auth/switch" class="dropdown-item switch-account">🔄 別アカウントでログイン</a>
          <a href="/auth/logout" class="dropdown-item logout">🚪 ログアウト</a>
        </div>
      </div>
    </div>
  </nav>

  <div class="container">
    <div class="card">
      <h1 class="title">🔑 コミット要約キーワード統計</h1>
      <p class="subtitle">
        PRマージ・push・要約ボタン押下時にGemma-4で抽出されたキーワード(ai_summary_keywords)・
        変更ファイル一覧(ai_summary_files)のざっくりした傾向。デプロイ前に生成された既存の要約は
        キーワード・ファイル一覧とも未抽出の場合があるため、ここでの総数は「抽出済みのものだけ」の集計。
      </p>

      <div class="stat-tiles">
        <div class="stat-tile">
          <span class="stat-label">キーワード総数</span>
          <span class="stat-value">${data.totalKeywordRows}</span>
        </div>
        <div class="stat-tile">
          <span class="stat-label">処理済みファイル総数</span>
          <span class="stat-value">${data.totalProcessedFiles}</span>
        </div>
        <div class="stat-tile">
          <span class="stat-label">キーワード付き要約の件数</span>
          <span class="stat-value">${data.totalSummaryLogsWithKeywords}</span>
        </div>
      </div>

      <div class="section-title">リポジトリ別の分布(キーワード)</div>
      <div class="section-note">リポジトリごとのキーワード抽出件数(多い順)。</div>
      <table>
        <thead><tr><th>リポジトリ</th><th class="num">件数</th><th></th></tr></thead>
        <tbody>${repoRows}</tbody>
      </table>

      <div class="section-title">リポジトリ別の分布(処理済みファイル)</div>
      <div class="section-note">リポジトリごとの処理済みファイル件数(多い順)。</div>
      <table>
        <thead><tr><th>リポジトリ</th><th class="num">件数</th><th></th></tr></thead>
        <tbody>${repoFileRows}</tbody>
      </table>

      <div class="section-title">ファイルタイプ別のキーワード分布</div>
      <div class="section-note">
        同じ要約に含まれるキーワードと変更ファイルの拡張子を掛け合わせた、ざっくりした傾向
        (例: スタイル変更が多ければcss/scssの件数が多くなる)。1つの要約に複数のキーワード・
        複数のファイルがある場合は全ての組み合わせを数えるため、厳密な「このキーワードはこの
        ファイルに対応する」という対応関係ではない点に注意。
      </div>
      <table>
        <thead><tr><th>拡張子</th><th class="num">件数</th><th></th></tr></thead>
        <tbody>${fileExtRows}</tbody>
      </table>

      <div class="section-title">頻出キーワード(上位20件)</div>
      <div class="section-note">全リポジトリを通して、同じキーワードが何回抽出されたか。</div>
      <table>
        <thead><tr><th>キーワード</th><th class="num">回数</th></tr></thead>
        <tbody>${topKeywordRows}</tbody>
      </table>

      <a href="/welcome" class="back-btn">← ホームに戻る</a>
    </div>
  </div>

  <script>
    ${getThemeToggleScript()}
    function toggleDropdown() {
      document.getElementById('dropdownMenu').classList.toggle('show');
    }
    window.addEventListener('click', function(e) {
      var icon = document.querySelector('.user-icon');
      var dd = document.getElementById('dropdownMenu');
      if (!icon.contains(e.target) && !dd.contains(e.target)) dd.classList.remove('show');
    });
  </script>
</body>
</html>`;
}
