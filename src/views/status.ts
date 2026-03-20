/**
 * キャッシュ・DB状況ページのHTML
 * ログイン中のユーザー自身のキャッシュデータとテーブル別マイグレーション状況を表示する
 */
import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

export interface CommitCacheEntry {
  owner: string;
  repo: string;
  year: number;
  month: number;
  totalCommits: number;
  cachedAt: string;
}

export interface InstallationPermEntry {
  installationId: number;
  repoName: string | null;
  repositorySelection: string;
  permissionCount: number;
  updatedAt: string;
}

/** テーブル単位の状況 */
export interface TableStatusEntry {
  name: string;
  exists: boolean;
  rowCount: number | null;
  migration: string;
  description: string;
}

/** ユーザーのチーム・ワークスペースコンテキスト */
export interface UserContextInfo {
  teamName: string | null;
  teamId: string | null;
  workspaceName: string | null;
  workspaceId: string | null;
  role: string | null;
  allWorkspaces: { workspaceId: string; workspaceName: string; teamId: string; teamName: string }[];
}

export interface CacheStatsEntry {
  owner: string;
  repo: string;
  githubFetchCount: number;
  cacheSaveCount: number;
  cacheLookupCount: number;
  cacheHitCount: number;
  lastUpdatedAt: string;
}

export interface CacheStatusData {
  commitCache: {
    totalEntries: number;
    totalCommits: number;
    repos: { owner: string; repo: string; entryCount: number; totalCommits: number }[];
    byMonth: { yearMonth: string; entryCount: number; totalCommits: number }[];
    entries: CommitCacheEntry[];
  };
  installationPerms: {
    totalEntries: number;
    entries: InstallationPermEntry[];
  };
  cacheStats: {
    totalGithubFetch: number;
    totalCacheSave: number;
    totalCacheLookup: number;
    totalCacheHit: number;
    entries: CacheStatsEntry[];
  };
  tables: TableStatusEntry[];
  userContext: UserContextInfo;
}

export function getCacheStatusPage(user: {
  name?: string;
  username: string;
  statusCommitCacheSortMode?: string;
  statusCommitCacheSortState?: string;
}, data: CacheStatusData): string {
  const displayName = escapeHtml(user.name || user.username);
  const safeUsername = escapeHtml(user.username);
  const initials = escapeHtml((user.name || user.username).substring(0, 2).toUpperCase());
  const statusCommitCacheSortMode = user.statusCommitCacheSortMode === 'toggle' ? 'toggle' : 'off';
  const statusCommitCacheSortState = user.statusCommitCacheSortState === 'commit_month_desc'
    ? 'commit_month_desc'
    : 'cached_at_desc';

  const getCachedAtEpoch = (cachedAt: string): number => {
    const epoch = Date.parse(cachedAt);
    if (!Number.isNaN(epoch)) return epoch;
    const normalizedEpoch = Date.parse(cachedAt.replace(' ', 'T'));
    return Number.isNaN(normalizedEpoch) ? 0 : normalizedEpoch;
  };

  const sortedCommitCacheEntries = data.commitCache.entries.slice().sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    if (a.month !== b.month) return b.month - a.month;
    const cachedAtDiff = getCachedAtEpoch(b.cachedAt) - getCachedAtEpoch(a.cachedAt);
    if (cachedAtDiff !== 0) return cachedAtDiff;
    const ownerDiff = a.owner.localeCompare(b.owner);
    if (ownerDiff !== 0) return ownerDiff;
    return a.repo.localeCompare(b.repo);
  });

  const ctx = data.userContext;
  const safeTeamName = ctx.teamName ? escapeHtml(ctx.teamName) : null;
  const safeWorkspaceName = ctx.workspaceName ? escapeHtml(ctx.workspaceName) : null;
  const safeRole = ctx.role ? escapeHtml(ctx.role) : null;

  // テーブル状況行
  const tableRows = data.tables.map(t => {
    const statusIcon = t.exists ? '<span class="status-ok">OK</span>' : '<span class="status-missing">未作成</span>';
    const count = t.exists && t.rowCount !== null ? String(t.rowCount) : '-';
    return `<tr>
      <td><button type="button" class="status-link-button" data-table-preview="${escapeHtml(t.name)}"><code>${escapeHtml(t.name)}</code></button></td>
      <td class="center">${statusIcon}</td>
      <td class="num">${count}</td>
      <td class="migration-name"><button type="button" class="status-link-button migration-button" data-migration-sql="${escapeHtml(t.migration)}" data-migration-table="${escapeHtml(t.name)}">${escapeHtml(t.migration)}</button></td>
      <td>${escapeHtml(t.description)}</td>
    </tr>`;
  }).join('');

  // リポジトリ別集計テーブル行
  const repoRows = data.commitCache.repos.map(r =>
    `<tr>
      <td>${escapeHtml(r.owner)}/${escapeHtml(r.repo)}</td>
      <td class="num">${r.entryCount}</td>
      <td class="num">${r.totalCommits.toLocaleString()}</td>
    </tr>`
  ).join('');

  // コミットキャッシュ詳細行
  const cacheDetailRows = sortedCommitCacheEntries.map(e =>
    `<tr>
      <td>${escapeHtml(e.owner)}/${escapeHtml(e.repo)}</td>
      <td><button type="button" class="year-month-cell-button" data-year-month="${e.year}-${String(e.month).padStart(2, '0')}">${e.year}-${String(e.month).padStart(2, '0')}</button></td>
      <td class="num">${e.totalCommits}</td>
      <td class="date">${escapeHtml(e.cachedAt)}</td>
    </tr>`
  ).join('');
  const commitCacheEntriesJson = JSON.stringify(data.commitCache.entries);

  // インストール権限行
  const permRows = data.installationPerms.entries.map(e =>
    `<tr>
      <td>${e.installationId}</td>
      <td>${e.repoName ? escapeHtml(e.repoName) : '<span class="all-repos">全リポジトリ</span>'}</td>
      <td>${escapeHtml(e.repositorySelection)}</td>
      <td class="num">${e.permissionCount}</td>
      <td class="date">${escapeHtml(e.updatedAt)}</td>
    </tr>`
  ).join('');

  // 月別コミット量チャート
  const chartData = data.commitCache.byMonth
    .slice()
    .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
  const maxCommits = Math.max(...chartData.map(d => d.totalCommits), 1);

  const chartBars = chartData.map(d => {
    const pct = Math.round((d.totalCommits / maxCommits) * 100);
    return `<div class="chart-bar-wrapper">
      <div class="chart-label">${escapeHtml(d.yearMonth)}</div>
      <div class="chart-bar-container">
        <div class="chart-bar" style="width: ${pct}%"></div>
      </div>
      <div class="chart-value">${d.totalCommits}</div>
    </div>`;
  }).join('');

  // キャッシュ統計：リポジトリ別テーブル行
  const cs = data.cacheStats;
  const cacheHitRate = cs.totalCacheLookup > 0
    ? ((cs.totalCacheHit / cs.totalCacheLookup) * 100).toFixed(1)
    : '-';

  const cacheStatsRows = cs.entries.map(e => {
    const hitRate = e.cacheLookupCount > 0
      ? ((e.cacheHitCount / e.cacheLookupCount) * 100).toFixed(1) + '%'
      : '-';
    return `<tr>
      <td>${escapeHtml(e.owner)}/${escapeHtml(e.repo)}</td>
      <td class="num">${e.githubFetchCount}</td>
      <td class="num">${e.cacheSaveCount}</td>
      <td class="num">${e.cacheLookupCount}</td>
      <td class="num">${e.cacheHitCount}</td>
      <td class="num">${hitRate}</td>
      <td class="date">${escapeHtml(e.lastUpdatedAt)}</td>
    </tr>`;
  }).join('');

  // キャッシュ統計：棒グラフ用データ（リポジトリ別の4指標）
  const statsChartData = cs.entries.map(e => ({
    label: `${e.owner}/${e.repo}`,
    githubFetch: e.githubFetchCount,
    cacheSave: e.cacheSaveCount,
    cacheLookup: e.cacheLookupCount,
    cacheHit: e.cacheHitCount,
  }));
  const statsChartDataJson = JSON.stringify(statsChartData);

  // キャッシュヒット率：リポジトリ別の折れ線チャート用データ
  const hitRateChartData = cs.entries
    .filter(e => e.cacheLookupCount > 0)
    .map(e => ({
      label: `${e.owner}/${e.repo}`,
      rate: parseFloat(((e.cacheHitCount / e.cacheLookupCount) * 100).toFixed(1)),
    }));
  const hitRateChartDataJson = JSON.stringify(hitRateChartData);

  // ワークスペース一覧行
  const wsRows = ctx.allWorkspaces.map(ws => {
    const isCurrent = ws.workspaceId === ctx.workspaceId;
    return `<tr${isCurrent ? ' class="current-row"' : ''}>
      <td>${escapeHtml(ws.teamName)}</td>
      <td>${escapeHtml(ws.workspaceName)}</td>
      <td class="mono">${escapeHtml(ws.workspaceId)}</td>
      <td class="center">${isCurrent ? '<span class="status-ok">選択中</span>' : ''}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DB・キャッシュ状況 - Cloudflare Workers GitHub OAuth</title>
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
      display: none; position: absolute; top: 50px; right: 0;
      background: var(--dropdown-bg); border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 180px; z-index: 1000; overflow: hidden;
    }
    .dropdown-menu.show { display: block; }
    .dropdown-item {
      padding: 12px 20px; color: var(--text-secondary); text-decoration: none;
      display: block; cursor: pointer; border-bottom: 1px solid var(--border-color);
      transition: background 0.2s ease;
    }
    .dropdown-item:last-child { border-bottom: none; }
    .dropdown-item:hover { background: var(--dropdown-hover); }
    .dropdown-item.switch-account { color: var(--accent-color); }
    .dropdown-item.logout { color: var(--danger-color); }
    .container { max-width: 1200px; margin: 0 auto; padding: 48px 32px; }
    .page-card {
      background: var(--card-bg); border-radius: 16px;
      box-shadow: 0 20px 60px var(--card-shadow); padding: 48px; margin-bottom: 32px;
    }
    .page-title { font-size: 36px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
    .page-subtitle { font-size: 18px; color: var(--text-muted); margin-bottom: 32px; }

    /* ユーザーコンテキスト */
    .context-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px; margin-bottom: 32px;
    }
    .context-card {
      background: var(--bg-secondary); border-radius: 10px; padding: 16px;
      border: 1px solid var(--border-color);
    }
    .context-card .label { font-size: 11px; color: var(--text-faint); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
    .context-card .value { font-size: 15px; font-weight: 600; color: var(--text-primary); word-break: break-all; }
    .context-card .value.mono { font-family: 'Monaco', 'Courier New', monospace; font-size: 12px; color: var(--text-muted); }

    /* サマリーカード */
    .summary-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px; margin-bottom: 32px;
    }
    .summary-card {
      background: var(--bg-secondary); border-radius: 12px; padding: 20px; text-align: center;
      border: 1px solid var(--border-color);
    }
    .summary-card .label { font-size: 13px; color: var(--text-muted); font-weight: 600; margin-bottom: 8px; }
    .summary-card .value { font-size: 32px; font-weight: 700; color: var(--text-secondary); }
    .summary-card .value.accent { color: var(--accent-color); }

    /* セクション */
    .section { margin-bottom: 32px; }
    .section-title {
      font-size: 20px; font-weight: 600; color: var(--text-primary); margin-bottom: 16px;
      padding-bottom: 8px; border-bottom: 2px solid var(--border-color);
    }

    /* テーブル */
    .data-table {
      width: 100%; border-collapse: collapse; font-size: 14px;
    }
    .data-table th {
      background: var(--bg-secondary); padding: 10px 12px; text-align: left;
      font-weight: 600; color: var(--text-muted); border-bottom: 2px solid var(--border-color);
      white-space: nowrap;
    }
    .data-table th.sortable {
      cursor: pointer; user-select: none;
    }
    .data-table th.sortable:hover {
      color: var(--text-primary);
    }
    .sort-header-button {
      display: inline-flex; align-items: center; gap: 6px;
      background: transparent; border: 0; padding: 0; margin: 0;
      color: inherit; font: inherit; cursor: pointer;
    }
    .status-link-button {
      background: transparent; border: 0; padding: 0; margin: 0;
      color: var(--accent-color); font: inherit; cursor: pointer;
      text-align: left;
    }
    .status-link-button:hover {
      color: var(--accent-hover); text-decoration: underline;
    }
    .migration-button {
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 11px;
    }
    .year-month-cell-button {
      background: transparent; border: 0; padding: 0; margin: 0;
      color: var(--accent-color); font: inherit; cursor: pointer;
      font-variant-numeric: tabular-nums;
    }
    .year-month-cell-button:hover {
      color: var(--accent-hover); text-decoration: underline;
    }
    .sort-header-indicator {
      font-size: 11px; color: var(--text-faint);
    }
    .data-table td {
      padding: 10px 12px; border-bottom: 1px solid var(--border-color); color: var(--text-secondary);
    }
    .data-table tr:hover { background: var(--bg-secondary); }
    .data-table .num { text-align: right; font-variant-numeric: tabular-nums; }
    .data-table .center { text-align: center; }
    .data-table .date { font-size: 12px; color: var(--text-muted); white-space: nowrap; }
    .data-table .mono { font-family: 'Monaco', 'Courier New', monospace; font-size: 12px; color: var(--text-muted); }
    .data-table .migration-name { font-family: 'Monaco', 'Courier New', monospace; font-size: 11px; color: var(--text-faint); white-space: nowrap; }
    .data-table code { background: var(--code-bg); padding: 2px 6px; border-radius: 4px; font-size: 13px; }
    .all-repos { color: var(--accent-color); font-weight: 600; font-size: 12px; }
    .status-ok { color: #48bb78; font-weight: 700; font-size: 12px; }
    .status-missing { color: var(--danger-color); font-weight: 700; font-size: 12px; }
    .current-row { background: rgba(102, 126, 234, 0.08); }
    [data-theme="dark"] .current-row { background: rgba(127, 156, 245, 0.12); }

    /* 棒グラフ */
    .chart-section { margin-bottom: 32px; }
    .chart-bar-wrapper {
      display: flex; align-items: center; gap: 8px; margin-bottom: 6px;
    }
    .chart-label {
      min-width: 80px; font-size: 13px; color: var(--text-muted); text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .chart-bar-container {
      flex: 1; height: 22px; background: var(--chart-bar-bg); border-radius: 4px; overflow: hidden;
    }
    .chart-bar {
      height: 100%; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      border-radius: 4px; min-width: 2px; transition: width 0.3s ease;
    }
    .chart-value {
      min-width: 50px; font-size: 13px; color: var(--text-secondary); font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .empty-message {
      padding: 24px; text-align: center; color: var(--text-faint); font-size: 14px;
    }

    .back-btn {
      background: var(--accent-color); color: white; border: none; border-radius: 8px;
      padding: 12px 24px; font-size: 14px; font-weight: 600; cursor: pointer;
      text-decoration: none; display: inline-block;
    }
    .back-btn:hover { background: var(--accent-hover); }

    .canvas-wrapper { width: 100%; overflow-x: auto; }
    .canvas-wrapper canvas { display: block; }
    .table-scroll { overflow-x: auto; }
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(15, 23, 42, 0.52);
      display: none; align-items: center; justify-content: center;
      padding: 24px; z-index: 2000;
    }
    .modal-backdrop.show { display: flex; }
    .modal-card {
      width: min(1100px, 100%); max-height: min(85vh, 900px);
      background: var(--card-bg); border: 1px solid var(--border-color);
      border-radius: 16px; box-shadow: 0 24px 80px rgba(0, 0, 0, 0.25);
      overflow: hidden; display: flex; flex-direction: column;
    }
    .modal-header {
      display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
      padding: 20px 24px; border-bottom: 1px solid var(--border-color);
      background: var(--bg-secondary);
    }
    .modal-title-wrap { min-width: 0; }
    .modal-title { font-size: 18px; font-weight: 700; color: var(--text-primary); }
    .modal-subtitle { margin-top: 6px; font-size: 13px; color: var(--text-muted); }
    .modal-close {
      background: transparent; border: 0; color: var(--text-muted);
      font-size: 26px; line-height: 1; cursor: pointer;
    }
    .modal-close:hover { color: var(--text-primary); }
    .modal-body {
      padding: 24px; overflow: auto; color: var(--text-secondary);
      min-height: 0;
    }
    .migration-detail-body {
      overflow: hidden;
    }
    .modal-loading, .modal-empty {
      padding: 32px 12px; text-align: center; color: var(--text-faint);
    }
    .modal-note {
      margin-bottom: 16px; font-size: 13px; color: var(--text-muted);
    }
    .preview-table {
      width: 100%; border-collapse: collapse; font-size: 13px;
    }
    .preview-table th, .preview-table td {
      padding: 10px 12px; border-bottom: 1px solid var(--border-color); vertical-align: top;
    }
    .preview-table th {
      position: sticky; top: 0; background: var(--bg-secondary);
      text-align: left; color: var(--text-muted); z-index: 1;
    }
    .preview-value {
      max-width: 320px; white-space: pre-wrap; word-break: break-word;
      font-family: 'Monaco', 'Courier New', monospace; font-size: 12px;
    }
    .preview-value.null { color: var(--text-faint); font-style: italic; }
    .sql-view {
      margin: 0; padding: 18px; overflow: auto; border-radius: 12px;
      background: var(--bg-secondary); border: 1px solid var(--border-color);
      color: var(--text-primary); font-size: 12px; line-height: 1.6;
      font-family: 'Monaco', 'Courier New', monospace; white-space: pre-wrap;
      word-break: break-word;
    }
    .split-panel {
      display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 20px; align-items: start;
    }
    .migration-detail-layout {
      height: min(68vh, 720px);
      min-height: 0;
    }
    .panel-block {
      min-width: 0;
    }
    .migration-detail-layout .panel-block {
      min-height: 0;
    }
    .migration-detail-layout .panel-block-secondary {
      height: 100%;
      overflow-y: auto;
      padding-right: 4px;
    }
    .panel-title {
      margin-bottom: 10px; font-size: 14px; font-weight: 700; color: var(--text-primary);
    }
    .panel-stack {
      display: grid; gap: 14px;
    }
    .code-card {
      border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden;
      background: var(--card-bg);
    }
    .code-card-header {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 10px 14px; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);
    }
    .code-card-label {
      font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em;
    }
    .copy-button {
      background: var(--accent-color); color: white; border: 0; border-radius: 8px;
      padding: 8px 10px; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap;
    }
    .copy-button:hover { background: var(--accent-hover); }
    .copy-button.copied { background: #2f855a; }
    .code-note {
      margin: 8px 0 0; font-size: 12px; line-height: 1.5; color: var(--text-muted);
    }

    @media (max-width: 768px) {
      .container { padding: 24px 16px; }
      .page-card { padding: 24px; }
      .page-title { font-size: 28px; }
      .summary-grid { grid-template-columns: repeat(2, 1fr); }
      .context-grid { grid-template-columns: 1fr 1fr; }
      .split-panel { grid-template-columns: 1fr; }
      .migration-detail-layout { height: auto; }
      .migration-detail-body { overflow: auto; }
      .migration-detail-layout .panel-block-secondary {
        height: auto;
        overflow: visible;
        padding-right: 0;
      }
      .modal-backdrop { padding: 12px; }
      .modal-header, .modal-body { padding: 16px; }
      .preview-table th, .preview-table td { padding: 8px; }
    }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="navbar-brand">
      <span>🔐</span>
      <span>ログイン中</span>
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
          <a href="/repositories" class="dropdown-item">📦 リポジトリ</a>
          <a href="/userinfo" class="dropdown-item">👤 ユーザー情報</a>
          <a href="/settings" class="dropdown-item">⚙️ 設定</a>
          <a href="/auth/switch" class="dropdown-item switch-account">🔄 別アカウントでログイン</a>
          <a href="/auth/logout" class="dropdown-item logout">🚪 ログアウト</a>
        </div>
      </div>
    </div>
  </nav>

  <div class="container">
    <div class="page-card">
      <h1 class="page-title">📊 DB・キャッシュ状況</h1>
      <p class="page-subtitle">${safeUsername} のデータ状況</p>

      <!-- ユーザーコンテキスト -->
      <div class="section">
        <h2 class="section-title">ユーザーコンテキスト</h2>
        <div class="context-grid">
          <div class="context-card">
            <div class="label">ユーザー</div>
            <div class="value">${safeUsername}</div>
          </div>
          <div class="context-card">
            <div class="label">チーム</div>
            <div class="value">${safeTeamName || '<span style="color:var(--text-faint)">未設定</span>'}</div>
          </div>
          <div class="context-card">
            <div class="label">ワークスペース</div>
            <div class="value">${safeWorkspaceName || '<span style="color:var(--text-faint)">未設定</span>'}</div>
          </div>
          <div class="context-card">
            <div class="label">ロール</div>
            <div class="value">${safeRole || '<span style="color:var(--text-faint)">-</span>'}</div>
          </div>
          ${ctx.workspaceId ? `
          <div class="context-card">
            <div class="label">Workspace ID</div>
            <div class="value mono">${escapeHtml(ctx.workspaceId)}</div>
          </div>` : ''}
          ${ctx.teamId ? `
          <div class="context-card">
            <div class="label">Team ID</div>
            <div class="value mono">${escapeHtml(ctx.teamId)}</div>
          </div>` : ''}
        </div>

        ${ctx.allWorkspaces.length > 1 ? `
        <h3 style="font-size:16px; font-weight:600; color:var(--text-primary); margin: 16px 0 12px;">所属ワークスペース一覧</h3>
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>チーム</th>
                <th>ワークスペース</th>
                <th>ID</th>
                <th style="text-align:center">状態</th>
              </tr>
            </thead>
            <tbody>${wsRows}</tbody>
          </table>
        </div>
        ` : ''}
      </div>

      <!-- テーブル別マイグレーション状況 -->
      <div class="section">
        <h2 class="section-title">テーブル別マイグレーション状況</h2>
        <div class="table-scroll">
          <table class="data-table" id="statusTablesTable">
            <thead>
              <tr>
                <th>テーブル名</th>
                <th style="text-align:center">状態</th>
                <th style="text-align:right">レコード数</th>
                <th>マイグレーション</th>
                <th>説明</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </div>

      <!-- サマリー -->
      <div class="summary-grid">
        <div class="summary-card">
          <div class="label">コミットキャッシュ件数</div>
          <div class="value accent">${data.commitCache.totalEntries}</div>
        </div>
        <div class="summary-card">
          <div class="label">キャッシュ済みコミット総数</div>
          <div class="value">${data.commitCache.totalCommits.toLocaleString()}</div>
        </div>
        <div class="summary-card">
          <div class="label">権限キャッシュ件数</div>
          <div class="value accent">${data.installationPerms.totalEntries}</div>
        </div>
      </div>

      <!-- キャッシュ統計サマリー -->
      <div class="summary-grid">
        <div class="summary-card">
          <div class="label">GitHub API 問い合わせ</div>
          <div class="value">${cs.totalGithubFetch}</div>
        </div>
        <div class="summary-card">
          <div class="label">キャッシュ保存</div>
          <div class="value">${cs.totalCacheSave}</div>
        </div>
        <div class="summary-card">
          <div class="label">キャッシュ参照</div>
          <div class="value">${cs.totalCacheLookup}</div>
        </div>
        <div class="summary-card">
          <div class="label">キャッシュヒット</div>
          <div class="value accent">${cs.totalCacheHit}</div>
        </div>
        <div class="summary-card">
          <div class="label">キャッシュヒット率</div>
          <div class="value accent">${cacheHitRate}${cacheHitRate !== '-' ? '%' : ''}</div>
        </div>
      </div>

      <!-- 月別コミット量チャート -->
      ${chartData.length > 0 ? `
      <div class="section">
        <h2 class="section-title">月別コミット量</h2>
        <div class="chart-section">
          ${chartBars}
        </div>
      </div>
      ` : ''}

      <!-- リポジトリ別集計 -->
      <div class="section">
        <h2 class="section-title">リポジトリ別コミットキャッシュ</h2>
        ${data.commitCache.repos.length > 0 ? `
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>リポジトリ</th>
                <th style="text-align:right">キャッシュ月数</th>
                <th style="text-align:right">コミット総数</th>
              </tr>
            </thead>
            <tbody>${repoRows}</tbody>
          </table>
        </div>
        ` : '<div class="empty-message">コミットキャッシュデータがありません</div>'}
      </div>

      <!-- 月別集計テーブル -->
      <div class="section">
        <h2 class="section-title">月別コミットキャッシュ詳細</h2>
        ${data.commitCache.entries.length > 0 ? `
        <div class="table-scroll">
          <table class="data-table" id="commitCacheDetailTable">
            <thead>
              <tr>
                <th>リポジトリ</th>
                <th class="sortable">
                  <button type="button" class="sort-header-button" id="commitCacheMonthSortButton">
                    <span>年月</span>
                    <span class="sort-header-indicator" id="commitCacheMonthSortIndicator"></span>
                  </button>
                </th>
                <th style="text-align:right">コミット数</th>
                <th class="${statusCommitCacheSortMode === 'toggle' ? 'sortable' : ''}">
                  <button type="button" class="sort-header-button" id="commitCacheSortToggle" ${statusCommitCacheSortMode === 'toggle' ? '' : 'disabled aria-disabled="true"'}>
                    <span id="commitCacheSortLabel">キャッシュ日時</span>
                    <span class="sort-header-indicator" id="commitCacheSortIndicator"></span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody id="commitCacheDetailBody">${cacheDetailRows}</tbody>
          </table>
        </div>
        ` : '<div class="empty-message">コミットキャッシュデータがありません</div>'}
      </div>

      <!-- インストール権限 -->
      <div class="section">
        <h2 class="section-title">GitHub App インストール権限キャッシュ</h2>
        ${data.installationPerms.entries.length > 0 ? `
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>Installation ID</th>
                <th>リポジトリ</th>
                <th>選択方式</th>
                <th style="text-align:right">権限数</th>
                <th>更新日時</th>
              </tr>
            </thead>
            <tbody>${permRows}</tbody>
          </table>
        </div>
        ` : '<div class="empty-message">インストール権限キャッシュがありません</div>'}
      </div>

      <!-- キャッシュ統計：累計棒グラフ -->
      ${cs.entries.length > 0 ? `
      <div class="section">
        <h2 class="section-title">リポジトリ別キャッシュ累計</h2>
        <div class="canvas-wrapper">
          <canvas id="statsBarChart" width="800" height="${Math.max(200, cs.entries.length * 80 + 60)}"></canvas>
        </div>
      </div>
      ` : ''}

      <!-- キャッシュヒット率：折れ線チャート -->
      ${hitRateChartData.length > 0 ? `
      <div class="section">
        <h2 class="section-title">リポジトリ別キャッシュヒット率</h2>
        <div class="canvas-wrapper">
          <canvas id="hitRateChart" width="800" height="300"></canvas>
        </div>
      </div>
      ` : ''}

      <!-- キャッシュ統計詳細テーブル -->
      <div class="section">
        <h2 class="section-title">コミット一覧キャッシュ統計（リポジトリ別）</h2>
        ${cs.entries.length > 0 ? `
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>リポジトリ</th>
                <th style="text-align:right">GitHub問い合わせ</th>
                <th style="text-align:right">キャッシュ保存</th>
                <th style="text-align:right">キャッシュ参照</th>
                <th style="text-align:right">キャッシュヒット</th>
                <th style="text-align:right">ヒット率</th>
                <th>最終更新</th>
              </tr>
            </thead>
            <tbody>${cacheStatsRows}</tbody>
          </table>
        </div>
        ` : '<div class="empty-message">キャッシュ統計データがありません</div>'}
      </div>

      <a href="/welcome" class="back-btn">← ホームに戻る</a>
    </div>
  </div>

  <div class="modal-backdrop" id="statusDetailModal" aria-hidden="true">
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="statusDetailTitle">
      <div class="modal-header">
        <div class="modal-title-wrap">
          <div class="modal-title" id="statusDetailTitle">詳細</div>
          <div class="modal-subtitle" id="statusDetailSubtitle"></div>
        </div>
        <button type="button" class="modal-close" id="statusDetailClose" aria-label="閉じる">&times;</button>
      </div>
      <div class="modal-body" id="statusDetailBody">
        <div class="modal-loading">読み込み中...</div>
      </div>
    </div>
  </div>

  <script>
    ${getThemeToggleScript()}

    var commitCacheSortMode = ${JSON.stringify(statusCommitCacheSortMode)};
    var commitCacheSortState = ${JSON.stringify(statusCommitCacheSortState)};
    var commitCacheEntries = ${commitCacheEntriesJson};
    var activeCommitCacheYearMonth = null;

    function escapeHtmlText(value) {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function setCookie(name, value) {
      document.cookie = name + '=' + encodeURIComponent(value) + '; Path=/; Secure; SameSite=Lax; Max-Age=31536000';
    }

    function getStatusModalElements() {
      return {
        modal: document.getElementById('statusDetailModal'),
        title: document.getElementById('statusDetailTitle'),
        subtitle: document.getElementById('statusDetailSubtitle'),
        body: document.getElementById('statusDetailBody')
      };
    }

    function openStatusModal(title, subtitle, bodyHtml, bodyClassName) {
      var elements = getStatusModalElements();
      if (!elements.modal || !elements.title || !elements.subtitle || !elements.body) return;
      elements.title.textContent = title;
      elements.subtitle.textContent = subtitle || '';
      elements.body.className = 'modal-body' + (bodyClassName ? ' ' + bodyClassName : '');
      elements.body.innerHTML = bodyHtml;
      elements.modal.classList.add('show');
      elements.modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    function closeStatusModal() {
      var elements = getStatusModalElements();
      if (!elements.modal) return;
      elements.modal.classList.remove('show');
      elements.modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    function showStatusModalLoading(title, subtitle) {
      var elements = getStatusModalElements();
      if (elements.body) elements.body.className = 'modal-body';
      openStatusModal(title, subtitle, '<div class="modal-loading">読み込み中...</div>');
    }

    function showStatusModalError(title, subtitle, message) {
      var elements = getStatusModalElements();
      if (elements.body) elements.body.className = 'modal-body';
      openStatusModal(title, subtitle, '<div class="modal-empty">' + escapeHtmlText(message) + '</div>');
    }

    function renderCopyableCodeCard(label, code, copyText) {
      return '<div class="code-card">'
        + '<div class="code-card-header">'
        + '<div class="code-card-label">' + escapeHtmlText(label) + '</div>'
        + '<button type="button" class="copy-button" data-copy-text="' + escapeHtmlText(copyText) + '">コピー</button>'
        + '</div>'
        + '<pre class="sql-view">' + escapeHtmlText(code) + '</pre>'
        + '</div>';
    }

    function renderQueryExample(example) {
      if (!example) {
        return '<div class="modal-empty">このテーブルに対応する読み出しクエリ例はありません</div>';
      }
      var paramsText = (example.params || []).length > 0
        ? '-- bind params: ' + example.params.join(', ') + '\\n'
        : '';
      var queryCode = example.sql + (paramsText ? '\\n' + paramsText : '');
      var noteHtml = example.note
        ? '<p class="code-note">' + escapeHtmlText(example.note) + '</p>'
        : '';
      return renderCopyableCodeCard('SELECT Query', queryCode, queryCode) + noteHtml;
    }

    function buildCurlWithCookie(origin, path) {
      return [
        'curl -sS \\\\',
        '  -H "Cookie: auth_token=<YOUR_AUTH_TOKEN>" \\\\',
        '  "' + origin + path + '"'
      ].join('\\n');
    }

    function buildCurlWithBearer(origin, path) {
      return [
        'curl -sS \\\\',
        '  -H "Authorization: Bearer <YOUR_AUTH_TOKEN>" \\\\',
        '  "' + origin + path + '"'
      ].join('\\n');
    }

    function renderMigrationDetailLayout(data) {
      var origin = window.location.origin;
      var queryBlock = renderQueryExample(data.queryExample || null);
      var detailCookieCurl = buildCurlWithCookie(origin, data.endpoints.migrationDetailPath);
      var detailBearerCurl = buildCurlWithBearer(origin, data.endpoints.migrationDetailPath);
      var migrationSqlCurl = buildCurlWithCookie(origin, data.endpoints.migrationSqlPath);
      var rowsCookieCurl = buildCurlWithCookie(origin, data.endpoints.tableRowsPath);
      var rowsBearerCurl = buildCurlWithBearer(origin, data.endpoints.tableRowsPath);
      return '<div class="split-panel migration-detail-layout">'
        + '<section class="panel-block panel-block-primary">'
        + '<div class="panel-title">左: テーブル定義 SQL</div>'
        + renderCopyableCodeCard('Migration SQL', data.migrationSql || '', data.migrationSql || '')
        + '</section>'
        + '<section class="panel-block panel-block-secondary">'
        + '<div class="panel-title">右: 読み出し方法</div>'
        + '<div class="panel-stack">'
        + queryBlock
        + renderCopyableCodeCard('curl: migration detail', detailCookieCurl, detailCookieCurl)
        + renderCopyableCodeCard('curl: migration detail (Bearer)', detailBearerCurl, detailBearerCurl)
        + renderCopyableCodeCard('curl: migration sql only', migrationSqlCurl, migrationSqlCurl)
        + renderCopyableCodeCard('curl: table rows preview', rowsCookieCurl, rowsCookieCurl)
        + renderCopyableCodeCard('curl: table rows preview (Bearer)', rowsBearerCurl, rowsBearerCurl)
        + '<p class="code-note">&#96;/api/status/*&#96; は認証必須です。ブラウザでは Cookie、CLI では Cookie または Bearer トークンで呼び出せます。</p>'
        + '</div>'
        + '</section>'
        + '</div>';
    }

    function isJsonLikeString(value) {
      if (typeof value !== 'string') return false;
      var trimmed = value.trim();
      return (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'));
    }

    function formatPreviewValue(value) {
      if (value === null || typeof value === 'undefined') {
        return '<span class="preview-value null">NULL</span>';
      }
      if (typeof value === 'string' && isJsonLikeString(value)) {
        try {
          return '<pre class="preview-value">' + escapeHtmlText(JSON.stringify(JSON.parse(value), null, 2)) + '</pre>';
        } catch (_error) {
          return '<pre class="preview-value">' + escapeHtmlText(value) + '</pre>';
        }
      }
      if (typeof value === 'object') {
        return '<pre class="preview-value">' + escapeHtmlText(JSON.stringify(value, null, 2)) + '</pre>';
      }
      return '<pre class="preview-value">' + escapeHtmlText(String(value)) + '</pre>';
    }

    function renderStatusTablePreview(columns, rows, limit) {
      if (!rows || rows.length === 0) {
        return '<div class="modal-empty">表示できる保存データがありません</div>';
      }
      var headerHtml = columns.map(function(column) {
        return '<th>' + escapeHtmlText(column) + '</th>';
      }).join('');
      var bodyHtml = rows.map(function(row) {
        return '<tr>' + columns.map(function(column) {
          return '<td>' + formatPreviewValue(row[column]) + '</td>';
        }).join('') + '</tr>';
      }).join('');
      return '<div class="modal-note">最新 ' + escapeHtmlText(String(limit)) + ' 件を表示しています。値は D1 に保存されている内容をそのまま確認しやすい形で表示しています。</div>'
        + '<div class="table-scroll"><table class="preview-table"><thead><tr>' + headerHtml + '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>';
    }

    async function openTablePreview(tableName) {
      var title = tableName + ' の保存データ';
      showStatusModalLoading(title, '最新 20 件を取得しています');
      try {
        var response = await fetch('/api/status/tables/' + encodeURIComponent(tableName) + '/rows');
        if (!response.ok) {
          throw new Error('table preview request failed');
        }
        var data = await response.json();
        openStatusModal(
          tableName + ' の保存データ',
          (data.description || '') + (data.migration ? ' / マイグレーション ' + data.migration : ''),
          renderStatusTablePreview(data.columns || [], data.rows || [], data.limit || 20)
        );
      } catch (_error) {
        showStatusModalError(title, '', '保存データの取得に失敗しました');
      }
    }

    async function openMigrationSql(migration, tableName) {
      var title = 'マイグレーション ' + migration;
      showStatusModalLoading(title, 'SQL を取得しています');
      try {
        var response = await fetch('/api/status/tables/' + encodeURIComponent(tableName) + '/migration-details');
        if (!response.ok) {
          throw new Error('migration sql request failed');
        }
        var data = await response.json();
        openStatusModal(
          'マイグレーション ' + migration + ' / ' + tableName,
          '左にテーブル定義 SQL、右に読み出しクエリと curl 例を表示しています',
          renderMigrationDetailLayout(data),
          'migration-detail-body'
        );
      } catch (_error) {
        showStatusModalError(title, '', 'SQL の取得に失敗しました');
      }
    }

    function renderCommitCacheDetailRows(entries) {
      return entries.map(function(entry) {
        var repoName = escapeHtmlText(entry.owner) + '/' + escapeHtmlText(entry.repo);
        var ym = String(entry.year) + '-' + String(entry.month).padStart(2, '0');
        return '<tr>'
          + '<td>' + repoName + '</td>'
          + '<td><button type="button" class="year-month-cell-button" data-year-month="' + escapeHtmlText(ym) + '">' + escapeHtmlText(ym) + '</button></td>'
          + '<td class="num">' + Number(entry.totalCommits).toLocaleString() + '</td>'
          + '<td class="date">' + escapeHtmlText(entry.cachedAt) + '</td>'
          + '</tr>';
      }).join('');
    }

    function getCommitCacheYearMonth(entry) {
      return String(entry.year) + '-' + String(entry.month).padStart(2, '0');
    }

    function getCommitCacheCachedAtEpoch(cachedAt) {
      var epoch = Date.parse(String(cachedAt));
      if (!Number.isNaN(epoch)) return epoch;
      var normalizedEpoch = Date.parse(String(cachedAt).replace(' ', 'T'));
      return Number.isNaN(normalizedEpoch) ? 0 : normalizedEpoch;
    }

    function sortCommitCacheEntries(entries, sortState) {
      return entries.slice().sort(function(a, b) {
        if (sortState === 'commit_month_desc') {
          if (a.year !== b.year) return b.year - a.year;
          if (a.month !== b.month) return b.month - a.month;
          var monthCachedAtDiff = getCommitCacheCachedAtEpoch(b.cachedAt) - getCommitCacheCachedAtEpoch(a.cachedAt);
          if (monthCachedAtDiff !== 0) return monthCachedAtDiff;
          var ownerDiff = String(a.owner).localeCompare(String(b.owner));
          if (ownerDiff !== 0) return ownerDiff;
          return String(a.repo).localeCompare(String(b.repo));
        }
        var cachedAtDiff = getCommitCacheCachedAtEpoch(b.cachedAt) - getCommitCacheCachedAtEpoch(a.cachedAt);
        if (cachedAtDiff !== 0) return cachedAtDiff;
        if (a.year !== b.year) return b.year - a.year;
        if (a.month !== b.month) return b.month - a.month;
        var repoOwnerDiff = String(a.owner).localeCompare(String(b.owner));
        if (repoOwnerDiff !== 0) return repoOwnerDiff;
        return String(a.repo).localeCompare(String(b.repo));
      });
    }

    function updateCommitCacheSortHeader() {
      var label = document.getElementById('commitCacheSortLabel');
      var indicator = document.getElementById('commitCacheSortIndicator');
      var monthIndicator = document.getElementById('commitCacheMonthSortIndicator');
      if (!label || !indicator) return;
      if (monthIndicator) {
        monthIndicator.textContent = activeCommitCacheYearMonth ? activeCommitCacheYearMonth + ' 表示中' : '新しい順';
      }
      if (commitCacheSortMode !== 'toggle') {
        label.textContent = 'キャッシュ日時';
        indicator.textContent = '';
        return;
      }
      if (commitCacheSortState === 'commit_month_desc') {
        label.textContent = 'キャッシュ日時';
        indicator.textContent = '月順';
      } else {
        label.textContent = 'キャッシュ日時';
        indicator.textContent = 'キャッシュ順';
      }
    }

    function getDisplayedCommitCacheEntries() {
      var entries = activeCommitCacheYearMonth
        ? commitCacheEntries.filter(function(entry) {
            return getCommitCacheYearMonth(entry) === activeCommitCacheYearMonth;
          })
        : commitCacheEntries.slice();
      var sortState = activeCommitCacheYearMonth ? 'cached_at_desc' : commitCacheSortState;
      return sortCommitCacheEntries(entries, sortState);
    }

    function applyCommitCacheSort(sortState, shouldPersist) {
      var body = document.getElementById('commitCacheDetailBody');
      if (!body || commitCacheEntries.length === 0) return;
      commitCacheSortState = sortState === 'commit_month_desc' ? 'commit_month_desc' : 'cached_at_desc';
      activeCommitCacheYearMonth = null;
      body.innerHTML = renderCommitCacheDetailRows(getDisplayedCommitCacheEntries());
      updateCommitCacheSortHeader();
      if (shouldPersist) {
        setCookie('user_status_commit_cache_sort_state', commitCacheSortState);
      }
    }

    function applyCommitCacheYearMonthFilter(yearMonth) {
      var body = document.getElementById('commitCacheDetailBody');
      if (!body || commitCacheEntries.length === 0) return;
      activeCommitCacheYearMonth = yearMonth;
      body.innerHTML = renderCommitCacheDetailRows(getDisplayedCommitCacheEntries());
      updateCommitCacheSortHeader();
    }

    function toggleDropdown() {
      document.getElementById('dropdownMenu').classList.toggle('show');
    }
    window.addEventListener('click', function(e) {
      const icon = document.querySelector('.user-icon');
      const dd = document.getElementById('dropdownMenu');
      if (!icon.contains(e.target) && !dd.contains(e.target)) dd.classList.remove('show');
    });

    (function() {
      var sortButton = document.getElementById('commitCacheSortToggle');
      var monthSortButton = document.getElementById('commitCacheMonthSortButton');
      var detailBody = document.getElementById('commitCacheDetailBody');
      var statusTablesTable = document.getElementById('statusTablesTable');
      var modal = document.getElementById('statusDetailModal');
      var modalCloseButton = document.getElementById('statusDetailClose');
      updateCommitCacheSortHeader();
      if (modalCloseButton) {
        modalCloseButton.addEventListener('click', closeStatusModal);
      }
      if (modal) {
        modal.addEventListener('click', function(event) {
          if (event.target === modal) {
            closeStatusModal();
          }
        });
      }
      var modalBody = document.getElementById('statusDetailBody');
      if (modalBody) {
        modalBody.addEventListener('click', async function(event) {
          var target = event.target;
          if (!(target instanceof Element)) return;
          var copyButton = target.closest('[data-copy-text]');
          if (!copyButton) return;
          var text = copyButton.getAttribute('data-copy-text');
          if (!text) return;
          try {
            await navigator.clipboard.writeText(text);
            var originalText = copyButton.textContent || 'コピー';
            copyButton.textContent = 'コピー済み';
            copyButton.classList.add('copied');
            window.setTimeout(function() {
              copyButton.textContent = originalText;
              copyButton.classList.remove('copied');
            }, 1200);
          } catch (_error) {
            copyButton.textContent = '失敗';
          }
        });
      }
      document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
          closeStatusModal();
        }
      });
      if (statusTablesTable) {
        statusTablesTable.addEventListener('click', function(event) {
          var target = event.target;
          if (!(target instanceof Element)) return;
          var tableButton = target.closest('[data-table-preview]');
          if (tableButton) {
            var tableName = tableButton.getAttribute('data-table-preview');
            if (tableName) {
              openTablePreview(tableName);
            }
            return;
          }
          var migrationButton = target.closest('[data-migration-sql]');
          if (!migrationButton) return;
          var migration = migrationButton.getAttribute('data-migration-sql');
          var tableName = migrationButton.getAttribute('data-migration-table');
          if (migration && tableName) {
            openMigrationSql(migration, tableName);
          }
        });
      }
      if (commitCacheEntries.length === 0) return;
      applyCommitCacheSort(commitCacheSortState, false);
      if (monthSortButton) {
        monthSortButton.addEventListener('click', function() {
          applyCommitCacheSort('commit_month_desc', true);
        });
      }
      if (detailBody) {
        detailBody.addEventListener('click', function(event) {
          var target = event.target;
          if (!(target instanceof Element)) return;
          var yearMonthButton = target.closest('[data-year-month]');
          if (!yearMonthButton) return;
          var yearMonth = yearMonthButton.getAttribute('data-year-month');
          if (!yearMonth) return;
          applyCommitCacheYearMonthFilter(yearMonth);
        });
      }
      if (!sortButton || commitCacheSortMode !== 'toggle') return;
      sortButton.addEventListener('click', function() {
        var nextState = commitCacheSortState === 'cached_at_desc' ? 'commit_month_desc' : 'cached_at_desc';
        applyCommitCacheSort(nextState, true);
      });
    })();

    // Canvas チャート描画
    (function() {
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      var textColor = isDark ? '#a0aec0' : '#4a5568';
      var gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
      var bgColor = isDark ? '#2d3748' : '#ffffff';
      var barColors = ['#667eea', '#48bb78', '#ed8936', '#e53e3e'];
      var barLabels = ['GitHub問い合わせ', 'キャッシュ保存', 'キャッシュ参照', 'キャッシュヒット'];

      var statsData = ${statsChartDataJson};
      var hitRateData = ${hitRateChartDataJson};

      // ── 累計棒グラフ ──
      var barCanvas = document.getElementById('statsBarChart');
      if (barCanvas && statsData.length > 0) {
        var ctx = barCanvas.getContext('2d');
        var dpr = window.devicePixelRatio || 1;
        var w = barCanvas.parentElement.clientWidth;
        var rowH = 80;
        var h = Math.max(200, statsData.length * rowH + 60);
        barCanvas.width = w * dpr;
        barCanvas.height = h * dpr;
        barCanvas.style.width = w + 'px';
        barCanvas.style.height = h + 'px';
        ctx.scale(dpr, dpr);

        var padL = 180, padR = 80, padT = 40, padB = 30;
        var chartW = w - padL - padR;

        // 最大値
        var maxVal = 1;
        for (var i = 0; i < statsData.length; i++) {
          var d = statsData[i];
          var vals = [d.githubFetch, d.cacheSave, d.cacheLookup, d.cacheHit];
          for (var j = 0; j < vals.length; j++) {
            if (vals[j] > maxVal) maxVal = vals[j];
          }
        }

        // グリッド
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        var gridSteps = 5;
        for (var g = 0; g <= gridSteps; g++) {
          var gx = padL + (chartW / gridSteps) * g;
          ctx.beginPath();
          ctx.moveTo(gx, padT);
          ctx.lineTo(gx, h - padB);
          ctx.stroke();
          ctx.fillStyle = textColor;
          ctx.font = '11px -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(String(Math.round(maxVal / gridSteps * g)), gx, h - padB + 16);
        }

        // 棒グラフ描画
        var barH = 14;
        var groupGap = rowH;
        for (var i = 0; i < statsData.length; i++) {
          var d = statsData[i];
          var vals = [d.githubFetch, d.cacheSave, d.cacheLookup, d.cacheHit];
          var baseY = padT + i * groupGap;

          // ラベル
          ctx.fillStyle = textColor;
          ctx.font = '13px -apple-system, sans-serif';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          var labelText = d.label.length > 22 ? d.label.substring(0, 20) + '..' : d.label;
          ctx.fillText(labelText, padL - 8, baseY + (barH * 4 + 6) / 2);

          for (var j = 0; j < 4; j++) {
            var bw = vals[j] > 0 ? Math.max(2, (vals[j] / maxVal) * chartW) : 0;
            var by = baseY + j * (barH + 2);
            ctx.fillStyle = barColors[j];
            ctx.beginPath();
            ctx.roundRect(padL, by, bw, barH, 3);
            ctx.fill();
            if (vals[j] > 0) {
              ctx.fillStyle = textColor;
              ctx.font = '11px -apple-system, sans-serif';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.fillText(String(vals[j]), padL + bw + 4, by + barH / 2);
            }
          }
        }

        // 凡例
        var legendY = 12;
        var legendX = padL;
        ctx.font = '12px -apple-system, sans-serif';
        ctx.textBaseline = 'middle';
        for (var j = 0; j < 4; j++) {
          ctx.fillStyle = barColors[j];
          ctx.fillRect(legendX, legendY - 5, 12, 12);
          ctx.fillStyle = textColor;
          ctx.textAlign = 'left';
          ctx.fillText(barLabels[j], legendX + 16, legendY + 1);
          legendX += ctx.measureText(barLabels[j]).width + 32;
        }
      }

      // ── キャッシュヒット率折れ線 ──
      var lineCanvas = document.getElementById('hitRateChart');
      if (lineCanvas && hitRateData.length > 0) {
        var ctx2 = lineCanvas.getContext('2d');
        var dpr2 = window.devicePixelRatio || 1;
        var w2 = lineCanvas.parentElement.clientWidth;
        var h2 = 300;
        lineCanvas.width = w2 * dpr2;
        lineCanvas.height = h2 * dpr2;
        lineCanvas.style.width = w2 + 'px';
        lineCanvas.style.height = h2 + 'px';
        ctx2.scale(dpr2, dpr2);

        var pL = 50, pR = 30, pT = 30, pB = 60;
        var cW = w2 - pL - pR;
        var cH = h2 - pT - pB;

        // Y軸グリッド (0-100%)
        ctx2.strokeStyle = gridColor;
        ctx2.lineWidth = 1;
        ctx2.font = '11px -apple-system, sans-serif';
        ctx2.fillStyle = textColor;
        ctx2.textAlign = 'right';
        ctx2.textBaseline = 'middle';
        for (var y = 0; y <= 100; y += 20) {
          var yy = pT + cH - (y / 100) * cH;
          ctx2.beginPath();
          ctx2.moveTo(pL, yy);
          ctx2.lineTo(w2 - pR, yy);
          ctx2.stroke();
          ctx2.fillText(y + '%', pL - 6, yy);
        }

        // データ点とライン
        var lineColor = '#667eea';
        var pointColor = '#764ba2';
        var n = hitRateData.length;
        var stepX = n > 1 ? cW / (n - 1) : cW / 2;

        // 塗り
        ctx2.fillStyle = isDark ? 'rgba(102,126,234,0.15)' : 'rgba(102,126,234,0.1)';
        ctx2.beginPath();
        ctx2.moveTo(pL, pT + cH);
        for (var i = 0; i < n; i++) {
          var px = n > 1 ? pL + i * stepX : pL + cW / 2;
          var py = pT + cH - (hitRateData[i].rate / 100) * cH;
          ctx2.lineTo(px, py);
        }
        ctx2.lineTo(n > 1 ? pL + (n - 1) * stepX : pL + cW / 2, pT + cH);
        ctx2.closePath();
        ctx2.fill();

        // 線
        ctx2.strokeStyle = lineColor;
        ctx2.lineWidth = 2.5;
        ctx2.lineJoin = 'round';
        ctx2.beginPath();
        for (var i = 0; i < n; i++) {
          var px = n > 1 ? pL + i * stepX : pL + cW / 2;
          var py = pT + cH - (hitRateData[i].rate / 100) * cH;
          if (i === 0) ctx2.moveTo(px, py);
          else ctx2.lineTo(px, py);
        }
        ctx2.stroke();

        // ポイントとラベル
        for (var i = 0; i < n; i++) {
          var px = n > 1 ? pL + i * stepX : pL + cW / 2;
          var py = pT + cH - (hitRateData[i].rate / 100) * cH;

          ctx2.fillStyle = bgColor;
          ctx2.beginPath();
          ctx2.arc(px, py, 5, 0, Math.PI * 2);
          ctx2.fill();
          ctx2.strokeStyle = pointColor;
          ctx2.lineWidth = 2;
          ctx2.stroke();

          // 率ラベル
          ctx2.fillStyle = textColor;
          ctx2.font = 'bold 12px -apple-system, sans-serif';
          ctx2.textAlign = 'center';
          ctx2.textBaseline = 'bottom';
          ctx2.fillText(hitRateData[i].rate + '%', px, py - 8);

          // X軸ラベル
          ctx2.save();
          ctx2.translate(px, pT + cH + 8);
          ctx2.rotate(Math.PI / 6);
          ctx2.fillStyle = textColor;
          ctx2.font = '11px -apple-system, sans-serif';
          ctx2.textAlign = 'left';
          ctx2.textBaseline = 'top';
          var lbl = hitRateData[i].label;
          if (lbl.length > 20) lbl = lbl.substring(0, 18) + '..';
          ctx2.fillText(lbl, 0, 0);
          ctx2.restore();
        }
      }
    })();
  </script>
</body>
</html>`;
}
