/**
 * キャッシュ状況ページのHTML
 * ログイン中のユーザー自身のキャッシュデータのみを表示する
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
}

export function getCacheStatusPage(user: {
  name?: string;
  username: string;
  workspaceName?: string | null;
  teamName?: string | null;
}, data: CacheStatusData): string {
  const displayName = escapeHtml(user.name || user.username);
  const safeUsername = escapeHtml(user.username);
  const initials = escapeHtml((user.name || user.username).substring(0, 2).toUpperCase());
  const safeTeamName = user.teamName ? escapeHtml(user.teamName) : null;
  const safeWorkspaceName = user.workspaceName ? escapeHtml(user.workspaceName) : null;

  // リポジトリ別集計テーブル行
  const repoRows = data.commitCache.repos.map(r =>
    `<tr>
      <td>${escapeHtml(r.owner)}/${escapeHtml(r.repo)}</td>
      <td class="num">${r.entryCount}</td>
      <td class="num">${r.totalCommits.toLocaleString()}</td>
    </tr>`
  ).join('');

  // コミットキャッシュ詳細行
  const cacheDetailRows = data.commitCache.entries.map(e =>
    `<tr>
      <td>${escapeHtml(e.owner)}/${escapeHtml(e.repo)}</td>
      <td>${e.year}-${String(e.month).padStart(2, '0')}</td>
      <td class="num">${e.totalCommits}</td>
      <td class="date">${escapeHtml(e.cachedAt)}</td>
    </tr>`
  ).join('');

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

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>キャッシュ状況 - Cloudflare Workers GitHub OAuth</title>
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
    .dropdown-item.logout { color: var(--danger-color); }
    .container { max-width: 1200px; margin: 0 auto; padding: 48px 32px; }
    .page-card {
      background: var(--card-bg); border-radius: 16px;
      box-shadow: 0 20px 60px var(--card-shadow); padding: 48px; margin-bottom: 32px;
    }
    .page-title { font-size: 36px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
    .page-subtitle { font-size: 18px; color: var(--text-muted); margin-bottom: 32px; }

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
    .data-table td {
      padding: 10px 12px; border-bottom: 1px solid var(--border-color); color: var(--text-secondary);
    }
    .data-table tr:hover { background: var(--bg-secondary); }
    .data-table .num { text-align: right; font-variant-numeric: tabular-nums; }
    .data-table .date { font-size: 12px; color: var(--text-muted); white-space: nowrap; }
    .all-repos { color: var(--accent-color); font-weight: 600; font-size: 12px; }

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

    .table-scroll { overflow-x: auto; }

    @media (max-width: 768px) {
      .container { padding: 24px 16px; }
      .page-card { padding: 24px; }
      .page-title { font-size: 28px; }
      .summary-grid { grid-template-columns: repeat(2, 1fr); }
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
          <a href="/auth/logout" class="dropdown-item logout">🚪 ログアウト</a>
        </div>
      </div>
    </div>
  </nav>

  <div class="container">
    <div class="page-card">
      <h1 class="page-title">📊 キャッシュ状況</h1>
      <p class="page-subtitle">${safeTeamName && safeWorkspaceName
        ? `${safeTeamName} / ${safeWorkspaceName}`
        : `${safeUsername}`} のキャッシュデータ</p>

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
          <table class="data-table">
            <thead>
              <tr>
                <th>リポジトリ</th>
                <th>年月</th>
                <th style="text-align:right">コミット数</th>
                <th>キャッシュ日時</th>
              </tr>
            </thead>
            <tbody>${cacheDetailRows}</tbody>
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

      <a href="/welcome" class="back-btn">← ホームに戻る</a>
    </div>
  </div>

  <script>
    ${getThemeToggleScript()}

    function toggleDropdown() {
      document.getElementById('dropdownMenu').classList.toggle('show');
    }
    window.addEventListener('click', function(e) {
      const icon = document.querySelector('.user-icon');
      const dd = document.getElementById('dropdownMenu');
      if (!icon.contains(e.target) && !dd.contains(e.target)) dd.classList.remove('show');
    });
  </script>
</body>
</html>`;
}
