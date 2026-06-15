/**
 * キャッシュ・DB状況ページのHTML
 * ログイン中のユーザー自身のキャッシュデータとテーブル別マイグレーション状況を表示する
 */
import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

export type TableStatusState = 'ok' | 'ng' | 'missing';

export function resolveTableStatus(entry: { exists: boolean; rowCount: number | null }): TableStatusState {
  if (!entry.exists) return 'missing';
  if (entry.rowCount !== null) return 'ok';
  return 'ng';
}

export function renderTableStatusBadge(state: TableStatusState): string {
  switch (state) {
    case 'ok': return '<span class="status-ok">OK</span>';
    case 'ng': return '<span class="status-ng">NG</span>';
    case 'missing': return '<span class="status-missing">未作成</span>';
  }
}

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
  syncPolicy: 'auto' | 'manual' | 'readonly';
  isAutoDetected?: boolean;
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

export interface RepoColorEntry {
  repoName: string;
  colorCode: string;
  displayOrder: number;
  tags: string;
  isVisible: boolean;
}

export interface RepoGroupEntry {
  id: string;
  name: string;
  description: string;
  colorCode: string;
  icon: string;
  slackChannelId: string;
  displayOrder: number;
  repos: string[];
}

export interface CacheStatusData {
  commitCache: {
    totalEntries: number;
    totalCommits: number;
    repos: { owner: string; repo: string; entryCount: number; totalCommits: number }[];
    byMonth: { yearMonth: string; entryCount: number; totalCommits: number }[];
    byMonthByRepo: { yearMonth: string; repo: string; commits: number }[];
    entries: CommitCacheEntry[];
  };
  repoColors: RepoColorEntry[];
  repoGroups: RepoGroupEntry[];
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
  tableGroupMap: Record<string, string>;
  unclassifiedAutoDetectedTables: string[];
  groupLabels: Record<string, string>;
  groupColors: Record<string, string>;
  tableFkPairs: [string, string][];
  userContext: UserContextInfo;
  pendingColumnMigrations: { migration: string; table: string; column: string; sql: string }[];
}

export function getCacheStatusPage(user: {
  name?: string;
  username: string;
  statusCommitCacheSortMode?: string;
  statusCommitCacheSortState?: string;
  statusChartMode?: string;
  statusChartSortOrder?: string;
  statusIgnoreUnknownUnclassifiedWarning?: string;
}, data: CacheStatusData): string {
  const displayName = escapeHtml(user.name || user.username);
  const safeUsername = escapeHtml(user.username);
  const initials = escapeHtml((user.name || user.username).substring(0, 2).toUpperCase());
  const statusCommitCacheSortMode = user.statusCommitCacheSortMode === 'toggle' ? 'toggle' : 'off';
  const statusCommitCacheSortState = user.statusCommitCacheSortState === 'commit_month_desc'
    ? 'commit_month_desc'
    : 'cached_at_desc';
  const statusChartMode = user.statusChartMode === 'repo' ? 'repo' : 'gradient';
  const statusChartSortOrder = user.statusChartSortOrder === 'date' ? 'date' : 'count';
  const statusIgnoreUnknownUnclassifiedWarning = user.statusIgnoreUnknownUnclassifiedWarning === 'off' ? 'off' : 'on';

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

  // owner が一意かどうか判定（一意ならテーブル内で owner/ プレフィクスを省略）
  const allOwners = new Set<string>();
  for (const r of data.commitCache.repos) allOwners.add(r.owner);
  for (const rc of data.repoColors) {
    const slashIdx = rc.repoName.indexOf('/');
    if (slashIdx > 0) allOwners.add(rc.repoName.substring(0, slashIdx));
  }
  const uniqueOwner = allOwners.size === 1 ? Array.from(allOwners)[0] : null;
  const stripOwner = (fullName: string): string => {
    if (!uniqueOwner) return fullName;
    const prefix = uniqueOwner + '/';
    return fullName.startsWith(prefix) ? fullName.substring(prefix.length) : fullName;
  };

  // グループID→番号マッピング（表示用）
  const groupKeys = [...new Set(Object.values(data.tableGroupMap))];
  groupKeys.sort();
  const groupIdMap: Record<string, number> = {};
  groupKeys.forEach((g, i) => { groupIdMap[g] = i + 1; });

  // グループセレクトメニュー用オプション
  const groupSelectOptions = groupKeys.map(g => {
    const num = groupIdMap[g];
    const label = data.groupLabels[g] || g;
    return `<option value="${num}">${num}: ${escapeHtml(label)}</option>`;
  }).join('') + `<option value="0">0: ${escapeHtml(data.groupLabels['undefined'] || 'Undefined')}</option>`;

  // テーブル状況行
  const syncPolicyLabel: Record<string, { text: string; cls: string }> = {
    auto: { text: '自動', cls: 'sync-auto' },
    manual: { text: '手動', cls: 'sync-manual' },
    readonly: { text: '外部', cls: 'sync-readonly' },
  };
  const statusTables = data.tables.some((t) => t.name === 'commit_agent_log')
    ? data.tables
    : [...data.tables, {
      name: 'commit_agent_log',
      exists: false,
      rowCount: null,
      migration: '0025',
      description: 'コミットエージェント検出ログ',
      syncPolicy: 'auto' as const,
    }];
  const tableRows = statusTables.map(t => {
    const statusIcon = renderTableStatusBadge(resolveTableStatus(t));
    const count = t.exists && t.rowCount !== null ? String(t.rowCount) : '-';
    const policy = syncPolicyLabel[t.syncPolicy] || syncPolicyLabel.auto;
    const groupName = data.tableGroupMap[t.name] || '';
    const groupNum = groupIdMap[groupName] || 0;
    const migrationNum = parseInt(t.migration.replace(/[^0-9]/g, ''), 10) || 0;
    const rowCountNum = t.exists && t.rowCount !== null ? t.rowCount : -1;
    return `<tr data-group-id="${groupNum}" data-migration-num="${migrationNum}" data-row-count="${rowCountNum}" data-migration="${escapeHtml(t.migration)}" data-table-name="${escapeHtml(t.name)}">
      <td class="group-id-cell">${groupNum}</td>
      <td><button type="button" class="status-link-button" data-table-preview="${escapeHtml(t.name)}"><code>${escapeHtml(t.name)}</code></button></td>
      <td class="center">${statusIcon}</td>
      <td class="num">${count}</td>
      <td class="center"><span class="sync-policy-badge ${policy.cls}">${policy.text}</span></td>
      <td class="migration-name"><button type="button" class="status-link-button migration-button" data-migration-sql="${escapeHtml(t.migration)}" data-migration-table="${escapeHtml(t.name)}">${escapeHtml(t.migration)}</button></td>
      <td>${escapeHtml(t.description)}</td>
    </tr>`;
  }).join('');

  // リポジトリ別集計テーブル行
  const repoRows = data.commitCache.repos.map(r =>
    `<tr>
      <td>${escapeHtml(uniqueOwner ? r.repo : `${r.owner}/${r.repo}`)}</td>
      <td class="num">${r.entryCount}</td>
      <td class="num">${r.totalCommits.toLocaleString()}</td>
    </tr>`
  ).join('');

  // コミットキャッシュ詳細行
  const cacheDetailRows = sortedCommitCacheEntries.map(e =>
    `<tr>
      <td>${escapeHtml(uniqueOwner ? e.repo : `${e.owner}/${e.repo}`)}</td>
      <td><button type="button" class="year-month-cell-button" data-year-month="${e.year}-${String(e.month).padStart(2, '0')}">${e.year}-${String(e.month).padStart(2, '0')}</button></td>
      <td class="num">${e.totalCommits}</td>
      <td class="date">${escapeHtml(e.cachedAt)}</td>
    </tr>`
  ).join('');
  const commitCacheEntriesJson = JSON.stringify(data.commitCache.entries);
  const unclassifiedAutoDetectedTablesJson = JSON.stringify(data.unclassifiedAutoDetectedTables);

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

  // 月別コミット量チャート（並び順は statusChartSortOrder で切り替え）
  const sortByOrder = (rows: typeof data.commitCache.byMonth) => {
    return statusChartSortOrder === 'date'
      ? rows.slice().sort((a, b) => a.yearMonth.localeCompare(b.yearMonth))
      : rows.slice().sort((a, b) => b.totalCommits - a.totalCommits);
  };
  const chartData = sortByOrder(data.commitCache.byMonth);
  const maxCommits = Math.max(...chartData.map(d => d.totalCommits), 1);

  // リポジトリ別カラーパレット（DB登録済みの色を優先、未登録はフォールバック）
  const repoColorFallback = [
    '#667eea', '#e53e3e', '#38a169', '#ed8936', '#9f7aea',
    '#dd6b20', '#319795', '#d53f8c', '#3182ce', '#d69e2e',
    '#805ad5', '#2b6cb0', '#c53030', '#2f855a', '#b7791f',
  ];
  const dbColorMap = new Map<string, string>();
  for (const rc of data.repoColors) {
    dbColorMap.set(rc.repoName, rc.colorCode);
  }
  const allRepos = Array.from(new Set(data.commitCache.byMonthByRepo.map(r => r.repo)));
  const repoTotalCommits = new Map<string, number>();
  for (const r of data.commitCache.byMonthByRepo) {
    repoTotalCommits.set(r.repo, (repoTotalCommits.get(r.repo) || 0) + r.commits);
  }
  allRepos.sort((a, b) => (repoTotalCommits.get(b) || 0) - (repoTotalCommits.get(a) || 0));
  const repoColorMap: Record<string, string> = {};
  allRepos.forEach((repo, i) => {
    repoColorMap[repo] = dbColorMap.get(repo) || repoColorFallback[i % repoColorFallback.length];
  });

  // グラデーションモード用バー
  const gradientBars = chartData.map(d => {
    const pct = Math.round((d.totalCommits / maxCommits) * 100);
    return `<div class="chart-bar-wrapper">
      <div class="chart-label">${escapeHtml(d.yearMonth)}</div>
      <div class="chart-bar-container">
        <div class="chart-bar" style="width: ${pct}%"></div>
      </div>
      <div class="chart-value">${d.totalCommits}</div>
    </div>`;
  }).join('');

  // リポジトリ色分けモード用バー（chartData の並び順を継承）
  const repoBars = chartData.map(d => {
    const pct = Math.round((d.totalCommits / maxCommits) * 100);
    const monthRepos = data.commitCache.byMonthByRepo
      .filter(r => r.yearMonth === d.yearMonth)
      .sort((a, b) => (repoTotalCommits.get(b.repo) || 0) - (repoTotalCommits.get(a.repo) || 0));
    const segments = monthRepos.map(r => {
      const segPct = d.totalCommits > 0 ? (r.commits / d.totalCommits * 100) : 0;
      return `<div class="chart-bar-segment" style="width:${segPct.toFixed(2)}%;background:${repoColorMap[r.repo]}" title="${escapeHtml(stripOwner(r.repo))}: ${r.commits}"></div>`;
    }).join('');
    return `<div class="chart-bar-wrapper">
      <div class="chart-label">${escapeHtml(d.yearMonth)}</div>
      <div class="chart-bar-container">
        <div class="chart-bar-stacked" style="width: ${pct}%">${segments}</div>
      </div>
      <div class="chart-value">${d.totalCommits}</div>
    </div>`;
  }).join('');

  // リポジトリ凡例
  const repoLegend = allRepos.map(repo => {
    const total = repoTotalCommits.get(repo) || 0;
    return `<span class="chart-legend-item"><span class="chart-legend-dot" style="background:${repoColorMap[repo]}"></span>${escapeHtml(stripOwner(repo))} (${total})</span>`;
  }).join('');

  const chartBars = statusChartMode === 'repo' ? repoBars : gradientBars;

  // グループフィルタ用セレクトボックスのオプション
  const sortedGroups = data.repoGroups.slice().sort((a, b) => a.name.localeCompare(b.name));
  const groupFilterOptions = sortedGroups.map(g =>
    `<option value="${escapeHtml(g.id)}">${escapeHtml(g.name)}</option>`
  ).join('');

  // クライアント側再描画用のデータ
  const byMonthByRepoJson = JSON.stringify(data.commitCache.byMonthByRepo);
  const repoColorMapJson = JSON.stringify(repoColorMap);
  const repoGroupsJson = JSON.stringify(sortedGroups.map(g => ({ id: g.id, name: g.name, repos: g.repos })));
  const chartModeJson = JSON.stringify(statusChartMode);
  const chartSortOrderJson = JSON.stringify(statusChartSortOrder);

  // 今月のコミット内訳パイチャート用データ
  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthRepos = data.commitCache.byMonthByRepo
    .filter(r => r.yearMonth === currentYearMonth)
    .sort((a, b) => b.commits - a.commits);
  const currentMonthTotal = currentMonthRepos.reduce((sum, r) => sum + r.commits, 0);

  // パイチャート SVG 生成（サーバーサイド初期描画）
  const buildPieChartSvg = (repos: { repo: string; commits: number }[], total: number): string => {
    if (total === 0 || repos.length === 0) {
      return '<div class="empty-message">今月のコミットデータがありません</div>';
    }
    const size = 220;
    const cx = size / 2;
    const cy = size / 2;
    const r = 90;
    let cumAngle = -Math.PI / 2;
    const slices = repos.map(item => {
      const pct = item.commits / total;
      const angle = pct * 2 * Math.PI;
      const startAngle = cumAngle;
      cumAngle += angle;
      const endAngle = cumAngle;
      const largeArc = angle > Math.PI ? 1 : 0;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const color = repoColorMap[item.repo] || '#667eea';
      if (repos.length === 1) {
        return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`;
      }
      return `<path d="M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${largeArc} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="${color}"><title>${escapeHtml(stripOwner(item.repo))}: ${item.commits} (${(pct * 100).toFixed(1)}%)</title></path>`;
    }).join('');
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="pie-chart-svg">${slices}</svg>`;
  };

  const pieSvgInitial = buildPieChartSvg(currentMonthRepos, currentMonthTotal);
  const pieLegendInitial = currentMonthRepos.map(item => {
    const pct = currentMonthTotal > 0 ? (item.commits / currentMonthTotal * 100).toFixed(1) : '0.0';
    const color = repoColorMap[item.repo] || '#667eea';
    return `<span class="chart-legend-item"><span class="chart-legend-dot" style="background:${color}"></span>${escapeHtml(stripOwner(item.repo))} (${item.commits} / ${pct}%)</span>`;
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
      <td>${escapeHtml(uniqueOwner ? e.repo : `${e.owner}/${e.repo}`)}</td>
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
    label: uniqueOwner ? e.repo : `${e.owner}/${e.repo}`,
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
      label: uniqueOwner ? e.repo : `${e.owner}/${e.repo}`,
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
    .status-toast {
      position: fixed; right: 20px; bottom: 20px; z-index: 2100;
      background: #fed7e2; color: #97266d; border: 1px solid #f687b3;
      border-radius: 10px; box-shadow: 0 10px 24px rgba(0,0,0,0.18);
      padding: 12px 14px; max-width: min(420px, calc(100vw - 32px));
      font-size: 13px; line-height: 1.5; display: none;
    }
    .status-toast.show { display: block; }
    [data-theme="dark"] .status-toast {
      background: #702459; color: #ffd2e8; border-color: #b83280;
    }

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
    .section-count {
      font-size: 14px; font-weight: 400; color: var(--text-secondary);
    }
    .section-title-row {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid var(--border-color);
    }
    .section-title-row .section-title {
      margin-bottom: 0; padding-bottom: 0; border-bottom: none;
    }
    .sync-policy-badge {
      display: inline-block; padding: 2px 8px; font-size: 11px; font-weight: 600;
      border-radius: 10px; letter-spacing: 0.3px; line-height: 1.4;
    }
    .sync-auto { background: #c6f6d5; color: #22543d; }
    .sync-manual { background: #fefcbf; color: #744210; }
    .sync-readonly { background: #e2e8f0; color: #4a5568; }
    [data-theme="dark"] .sync-auto { background: #22543d; color: #c6f6d5; }
    [data-theme="dark"] .sync-manual { background: #744210; color: #fefcbf; }
    [data-theme="dark"] .sync-readonly { background: #4a5568; color: #e2e8f0; }
    .sync-repo-colors-btn {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 6px 14px; font-size: 13px; font-weight: 500;
      color: var(--text-primary); background: var(--bg-secondary);
      border: 1px solid var(--border-color); border-radius: 6px;
      cursor: pointer; white-space: nowrap; transition: background 0.15s, border-color 0.15s;
    }
    .sync-repo-colors-btn:hover { background: var(--bg-tertiary, var(--border-color)); }
    .sync-repo-colors-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .sync-repo-colors-btn .sync-icon { font-size: 15px; }
    .chart-sort-toggle {
      display: inline-flex; border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden;
    }
    .chart-sort-toggle-btn {
      padding: 6px 12px; font-size: 13px; font-weight: 500;
      color: var(--text-primary); background: var(--bg-secondary);
      border: none; cursor: pointer; transition: background 0.15s;
    }
    .chart-sort-toggle-btn + .chart-sort-toggle-btn { border-left: 1px solid var(--border-color); }
    .chart-sort-toggle-btn:hover { background: var(--bg-tertiary, var(--border-color)); }
    .chart-sort-toggle-btn.active { background: var(--accent-color, #667eea); color: #fff; }
    .sync-repo-colors-btn.syncing .sync-icon {
      animation: spin-sync 0.8s linear infinite;
    }
    @keyframes spin-sync { to { transform: rotate(360deg); } }

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
    .data-table .group-id-cell { text-align: center; font-size: 11px; font-weight: 700; color: var(--text-faint); width: 30px; }
    .data-table code { background: var(--code-bg); padding: 2px 6px; border-radius: 4px; font-size: 13px; }
    .all-repos { color: var(--accent-color); font-weight: 600; font-size: 12px; }
    .status-ok { color: #48bb78; font-weight: 700; font-size: 12px; }
    .status-ng { color: #fc8181; font-weight: 700; font-size: 12px; background: rgba(252,129,129,0.15); padding: 1px 6px; border-radius: 4px; }
    .status-missing { color: var(--danger-color); font-weight: 700; font-size: 12px; }
    .status-warning-toast {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 1100;
      min-width: 320px;
      max-width: 460px;
      background: #ffd6ea;
      color: #702459;
      border: 1px solid #ff9dcb;
      border-radius: 10px;
      box-shadow: 0 10px 24px rgba(112, 36, 89, 0.2);
      padding: 12px 14px;
      font-size: 12px;
      line-height: 1.55;
      display: none;
    }
    .status-warning-toast strong { font-size: 13px; }
    .status-warning-toast code {
      background: rgba(112, 36, 89, 0.08);
      border-radius: 4px;
      padding: 1px 4px;
    }
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
    .chart-bar-stacked {
      height: 100%; display: flex; border-radius: 4px; overflow: hidden;
      min-width: 2px; transition: width 0.3s ease;
    }
    .chart-bar-segment {
      height: 100%; min-width: 1px; transition: width 0.3s ease;
    }
    .chart-bar-segment:first-child { border-radius: 4px 0 0 4px; }
    .chart-bar-segment:last-child { border-radius: 0 4px 4px 0; }
    .chart-bar-segment:only-child { border-radius: 4px; }
    .chart-legend {
      display: flex; flex-wrap: wrap; gap: 8px 16px; margin-bottom: 12px;
      padding: 8px 12px; background: var(--bg-secondary); border-radius: 8px;
    }
    .chart-legend-item {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 12px; color: var(--text-secondary); white-space: nowrap;
    }
    .chart-legend-dot {
      display: inline-block; width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0;
    }
    .chart-value {
      min-width: 50px; font-size: 13px; color: var(--text-secondary); font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .group-filter-select {
      padding: 5px 10px; font-size: 13px; font-weight: 500;
      color: var(--text-primary); background: var(--bg-secondary);
      border: 1px solid var(--border-color); border-radius: 6px;
      cursor: pointer; max-width: 200px;
      transition: border-color 0.15s;
    }
    .group-filter-select:hover { border-color: var(--accent-color); }
    .group-filter-select:focus { outline: none; border-color: var(--accent-color); box-shadow: 0 0 0 2px rgba(102,126,234,0.2); }

    /* パイチャート */
    .pie-chart-container {
      display: flex; align-items: flex-start; gap: 24px; flex-wrap: wrap;
    }
    .pie-chart-svg-area { flex-shrink: 0; }
    .pie-chart-svg path:hover, .pie-chart-svg circle:hover { opacity: 0.8; cursor: pointer; }
    .pie-chart-legend-area {
      flex: 1; min-width: 180px;
    }
    .pie-chart-legend {
      display: flex; flex-direction: column; gap: 6px;
      padding: 8px 12px; background: var(--bg-secondary); border-radius: 8px;
    }
    .pie-chart-total {
      font-size: 13px; color: var(--text-muted); margin-bottom: 8px;
    }
    .pie-chart-total strong { color: var(--text-primary); font-size: 20px; font-weight: 700; }

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
    .ym-calendar-card {
      width: min(760px, 100%); background: var(--card-bg);
      border: 1px solid var(--border-color); border-radius: 16px;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.25);
      overflow: hidden; display: flex; flex-direction: column;
    }
    .ym-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
    .ym-cal-day-header { text-align: center; font-size: 11px; font-weight: 600; color: var(--text-muted); padding: 4px 0; }
    .ym-cal-day-header.sun { color: #e53e3e; }
    .ym-cal-day-header.sat { color: #3182ce; }
    .ym-cal-cell { min-height: 52px; border-radius: 6px; padding: 4px 6px; font-size: 11px; border: 1px solid var(--border-color); background: var(--bg-secondary); display: flex; flex-direction: column; gap: 2px; }
    .ym-cal-cell.empty { background: transparent; border-color: transparent; }
    .ym-cal-cell-date { font-weight: 600; color: var(--text-secondary); font-size: 12px; }
    .ym-cal-cell-date.sun { color: #e53e3e; }
    .ym-cal-cell-date.sat { color: #3182ce; }
    .ym-cal-cell-count { font-size: 11px; font-weight: 700; text-align: center; border-radius: 4px; padding: 1px 4px; }
    .ym-cal-cell.heat0 { background: var(--bg-secondary); }
    .ym-cal-cell.heat1 { background: #d6f5d6; border-color: #9be9a8; }
    .ym-cal-cell.heat2 { background: #9be9a8; border-color: #40c463; }
    .ym-cal-cell.heat3 { background: #40c463; border-color: #30a14e; }
    .ym-cal-cell.heat4 { background: #216e39; border-color: #1a5b30; }
    .ym-cal-cell.heat1 .ym-cal-cell-count { color: #1a6321; }
    .ym-cal-cell.heat2 .ym-cal-cell-count { color: #0d4a16; }
    .ym-cal-cell.heat3 .ym-cal-cell-count { color: #fff; }
    .ym-cal-cell.heat4 .ym-cal-cell-count { color: #fff; }
    .ym-select-section { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border-color); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .ym-select-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); white-space: nowrap; }
    .ym-select { font-size: 13px; padding: 4px 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--card-bg); color: var(--text-primary); cursor: pointer; }
    .modal-header {
      display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
      padding: 20px 24px; border-bottom: 1px solid var(--border-color);
      background: var(--bg-secondary);
    }
    .modal-title-wrap { min-width: 0; }
    .modal-title { font-size: 18px; font-weight: 700; color: var(--text-primary); }
    .modal-subtitle { margin-top: 6px; font-size: 13px; color: var(--text-muted); display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
    .er-tablelist-toggle { position:relative; display:inline-block; width:32px; height:18px; cursor:pointer; vertical-align:middle; flex-shrink:0; }
    .er-tablelist-toggle input { opacity:0; width:0; height:0; }
    .er-tablelist-toggle-slider { position:absolute; top:0; left:0; right:0; bottom:0; background:var(--input-border); border-radius:18px; transition:background 0.2s; }
    .er-tablelist-toggle-slider::before { content:''; position:absolute; width:12px; height:12px; left:3px; bottom:3px; background:white; border-radius:50%; transition:transform 0.2s; }
    .er-tablelist-toggle input:checked + .er-tablelist-toggle-slider { background:var(--accent-color); }
    .er-tablelist-toggle input:checked + .er-tablelist-toggle-slider::before { transform:translateX(14px); }
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
    .code-card-actions {
      display: flex; gap: 6px; align-items: center;
    }
    .copy-button {
      background: var(--accent-color); color: white; border: 0; border-radius: 8px;
      padding: 8px 10px; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap;
    }
    .copy-button:hover { background: var(--accent-hover); }
    .copy-button.copied { background: #2f855a; }
    .exec-button {
      border: 0; border-radius: 8px;
      padding: 8px 10px; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap;
      transition: background 0.15s, opacity 0.15s;
    }
    .exec-button:disabled { background: #a0aec0 !important; color: white !important; cursor: not-allowed; opacity: 0.7; }
    .exec-button.running { background: #dd6b20 !important; color: white !important; }
    .exec-button.method-get { background: #e6ffed; color: #22543d; border: 1px solid #9ae6b4; }
    .exec-button.method-get:hover { background: #c6f6d5; }
    .exec-button.method-post { background: #fff5f5; color: #9b2c2c; border: 1px solid #feb2b2; }
    .exec-button.method-post:hover { background: #fed7d7; }
    .exec-button.method-put { background: #fffaf0; color: #975a16; border: 1px solid #fbd38d; }
    .exec-button.method-put:hover { background: #fefcbf; }
    .exec-button.method-delete { background: #fff5f5; color: #742a2a; border: 1px solid #fc8181; }
    .exec-button.method-delete:hover { background: #fed7d7; }
    /* Exec collapse-all button */
    .exec-collapse-all-row {
      display: flex; justify-content: flex-end; margin-bottom: 6px;
    }
    .exec-collapse-all-button {
      background: var(--bg-secondary); color: var(--text-muted); border: 1px solid var(--border-color);
      border-radius: 6px; padding: 4px 10px; font-size: 11px; font-weight: 600;
      cursor: pointer; white-space: nowrap;
    }
    .exec-collapse-all-button:hover { background: var(--bg-tertiary, var(--bg-secondary)); color: var(--text-primary); }
    /* API endpoint description in left panel */
    .endpoint-docs {
      margin-top: 14px;
    }
    .endpoint-docs-toggle {
      display: flex; align-items: center; gap: 6px; width: 100%;
      padding: 8px 12px; background: var(--bg-secondary); border: 1px solid var(--border-color);
      border-radius: 8px; cursor: pointer; user-select: none;
      font-size: 12px; font-weight: 700; color: var(--text-primary);
    }
    .endpoint-docs-toggle:hover { background: var(--bg-tertiary, var(--bg-secondary)); }
    .endpoint-docs-chevron {
      font-size: 10px; transition: transform 0.2s; color: var(--text-muted);
    }
    .endpoint-docs-toggle[aria-expanded="true"] .endpoint-docs-chevron { transform: rotate(90deg); }
    .endpoint-docs-body {
      overflow: hidden; transition: max-height 0.25s ease;
    }
    .endpoint-docs-body.collapsed { max-height: 0 !important; }
    .endpoint-docs-content {
      padding: 12px; border: 1px solid var(--border-color); border-top: 0;
      border-radius: 0 0 8px 8px; background: var(--card-bg);
    }
    .endpoint-doc-item {
      margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);
    }
    .endpoint-doc-item:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
    .endpoint-doc-method {
      display: inline-block; padding: 2px 6px; border-radius: 4px;
      font-size: 10px; font-weight: 800; font-family: monospace; margin-right: 6px;
    }
    .endpoint-doc-method.get { background: #e6ffed; color: #22543d; }
    .endpoint-doc-method.post { background: #fff5f5; color: #9b2c2c; }
    .endpoint-doc-path {
      font-size: 12px; font-weight: 600; font-family: monospace; color: var(--text-primary);
    }
    .endpoint-doc-desc {
      margin-top: 4px; font-size: 11px; line-height: 1.5; color: var(--text-muted);
    }
    .endpoint-doc-response {
      margin-top: 4px; font-size: 10px; color: var(--text-faint); font-family: monospace;
    }
    /* Exec result area */
    .exec-result {
      margin-top: 8px; border: 1px solid var(--border-color); border-radius: 8px;
      overflow: hidden; background: var(--card-bg);
    }
    .exec-result-header {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 8px 12px; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);
      cursor: pointer; user-select: none;
    }
    .exec-result-header:hover { background: var(--bg-tertiary, var(--bg-secondary)); }
    .exec-result-summary {
      display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600;
    }
    .exec-result-chevron {
      font-size: 10px; transition: transform 0.2s; color: var(--text-muted);
    }
    .exec-result-header[aria-expanded="true"] .exec-result-chevron { transform: rotate(90deg); }
    .exec-status-badge {
      display: inline-block; padding: 2px 8px; border-radius: 4px;
      font-size: 11px; font-weight: 700; font-family: monospace;
    }
    .exec-status-badge.success { background: #c6f6d5; color: #22543d; }
    .exec-status-badge.error { background: #fed7d7; color: #742a2a; }
    .exec-status-badge.info { background: #bee3f8; color: #2a4365; }
    .exec-result-meta {
      font-size: 11px; color: var(--text-muted); font-family: monospace;
    }
    .exec-result-body {
      overflow: hidden; transition: max-height 0.25s ease;
    }
    .exec-result-body.collapsed { max-height: 0 !important; }
    .exec-result-body pre {
      margin: 0; padding: 12px; font-size: 12px; line-height: 1.5;
      overflow-x: auto; white-space: pre-wrap; word-break: break-all;
    }
    .exec-result-section {
      border-top: 1px solid var(--border-color);
    }
    .exec-result-section:first-child { border-top: none; }
    .exec-result-section-header {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 12px; font-size: 11px; font-weight: 700; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: 0.04em;
      cursor: pointer; user-select: none; background: var(--bg-secondary);
    }
    .exec-result-section-header:hover { background: var(--bg-tertiary, var(--bg-secondary)); }
    .exec-result-section-chevron {
      font-size: 9px; transition: transform 0.2s; color: var(--text-muted);
    }
    .exec-result-section-header[aria-expanded="true"] .exec-result-section-chevron { transform: rotate(90deg); }
    .exec-result-section-body {
      overflow: hidden; transition: max-height 0.2s ease;
    }
    .exec-result-section-body.collapsed { max-height: 0 !important; }
    .code-note {
      margin: 8px 0 0; font-size: 12px; line-height: 1.5; color: var(--text-muted);
    }

    /* UML ボタン */
    .uml-button-row {
      display: flex; justify-content: flex-end; margin-bottom: 12px;
    }
    .uml-button {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white; border: none; border-radius: 8px;
      padding: 10px 20px; font-size: 13px; font-weight: 600;
      cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
      transition: opacity 0.2s;
    }
    .uml-button:hover { opacity: 0.85; }

    .uml-refresh-button {
      background: linear-gradient(135deg, #38b2ac 0%, #319795 100%);
      color: white; border: none; border-radius: 8px;
      padding: 10px 20px; font-size: 13px; font-weight: 600;
      cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
      transition: opacity 0.2s;
    }
    .uml-refresh-button:hover { opacity: 0.85; }
    .uml-refresh-button:disabled { opacity: 0.5; cursor: not-allowed; }
    .uml-refresh-button .spin { animation: uml-spin 0.8s linear infinite; }
    @keyframes uml-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

    .uml-export-button {
      background: #48bb78; color: white; border: none; border-radius: 8px;
      padding: 8px 16px; font-size: 12px; font-weight: 600;
      cursor: pointer; display: inline-flex; align-items: center; gap: 5px;
      transition: background 0.2s; white-space: nowrap;
    }
    .uml-export-button:hover { background: #38a169; }
    .uml-export-button:disabled { background: #a0aec0; cursor: not-allowed; }

    .uml-collist-button {
      background: #4299e1; color: white; border: none; border-radius: 8px;
      padding: 8px 16px; font-size: 12px; font-weight: 600;
      cursor: pointer; display: inline-flex; align-items: center; gap: 5px;
      transition: background 0.2s; white-space: nowrap;
    }
    .uml-collist-button:hover { background: #3182ce; }

    .uml-view-toggle {
      display: inline-flex; border: 1px solid var(--border-color);
      border-radius: 8px; overflow: hidden; background: var(--card-bg);
    }
    .uml-view-toggle button {
      background: transparent; color: var(--text-secondary);
      border: none; padding: 7px 12px;
      font-size: 12px; font-weight: 600; cursor: pointer;
      white-space: nowrap; border-radius: 0; transition: background 0.2s;
    }
    .uml-view-toggle button + button { border-left: 1px solid var(--border-color); }
    .uml-view-toggle button.active { background: #4299e1; color: white; }
    .uml-view-toggle button:not(.active):hover { background: rgba(66, 153, 225, 0.12); }

    /* 座標出力 / 座標入力ボタン */
    .uml-pos-button {
      background: #718096; color: white; border: none; border-radius: 8px;
      padding: 8px 14px; font-size: 12px; font-weight: 600;
      cursor: pointer; display: inline-flex; align-items: center; gap: 4px;
      transition: background 0.2s; white-space: nowrap;
    }
    .uml-pos-button:hover { background: #4a5568; }

    /* 座標出力 / 座標入力 モーダル */
    .uml-pos-modal-overlay {
      display: none; position: fixed; inset: 0;
      background: rgba(15,23,42,0.65);
      align-items: center; justify-content: center;
      z-index: 10010;
    }
    .uml-pos-modal-overlay.show { display: flex; }
    .uml-pos-modal {
      background: var(--card-bg); border: 1px solid var(--border-color);
      border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      width: 92%; max-width: 560px;
      display: flex; flex-direction: column; overflow: hidden;
    }
    .uml-pos-modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 18px 10px; border-bottom: 1px solid var(--border-color);
    }
    .uml-pos-modal-title { font-size: 14px; font-weight: 700; color: var(--text-primary); }
    .uml-pos-modal-close {
      border: none; background: none; font-size: 20px; cursor: pointer;
      color: var(--text-muted); line-height: 1; padding: 0 4px;
    }
    .uml-pos-modal-close:hover { color: var(--text-primary); }
    .uml-pos-modal-body { padding: 16px 18px; }
    .uml-pos-textarea {
      width: 100%; height: 280px; font-family: monospace; font-size: 12px;
      padding: 10px; border: 1px solid var(--border-color); border-radius: 8px;
      background: var(--input-bg); color: var(--text-primary);
      resize: vertical; outline: none; box-sizing: border-box;
    }
    .uml-pos-textarea:focus { border-color: #4299e1; }
    .uml-pos-textarea.pos-error { border-color: #f85149; }
    .uml-pos-feedback {
      margin-top: 8px; font-size: 12px; min-height: 18px; color: var(--text-muted);
    }
    .uml-pos-feedback.pos-error { color: #f85149; }
    .uml-pos-feedback.pos-warn { color: #d29922; }
    .uml-pos-feedback.pos-ok { color: #48bb78; }
    .uml-pos-modal-footer {
      display: flex; align-items: center; gap: 8px; justify-content: flex-end;
      padding: 10px 18px 14px; border-top: 1px solid var(--border-color);
    }
    .uml-pos-modal-footer button {
      font-size: 13px; padding: 7px 16px; border: 1px solid var(--border-color);
      border-radius: 6px; background: var(--card-bg); color: var(--text-primary);
      cursor: pointer; transition: background 0.15s;
    }
    .uml-pos-modal-footer button:hover { background: rgba(66,153,225,0.1); }
    .uml-pos-modal-footer .pos-btn-primary {
      background: #4299e1; color: #fff; border-color: #4299e1;
    }
    .uml-pos-modal-footer .pos-btn-primary:hover { background: #3182ce; }

    /* カラム名一覧モーダル */
    .collist-modal-card {
      width: min(960px, 100%); max-height: min(90vh, 960px);
      background: var(--card-bg); border: 1px solid var(--border-color);
      border-radius: 16px; box-shadow: 0 24px 80px rgba(0, 0, 0, 0.25);
      overflow: hidden; display: flex; flex-direction: column;
    }
    .collist-filters {
      display: flex; gap: 8px; padding: 12px 24px; flex-wrap: wrap;
      border-bottom: 1px solid var(--border-color); background: var(--card-bg);
    }
    .collist-filter-group {
      display: flex; flex-direction: column; gap: 2px; min-width: 140px;
    }
    .collist-filter-group label {
      font-size: 10px; font-weight: 600; color: var(--text-faint);
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .collist-filter-group select {
      padding: 5px 8px; font-size: 12px; border: 1px solid var(--input-border);
      border-radius: 6px; background: var(--input-bg); color: var(--text-primary);
      cursor: pointer; min-width: 120px;
    }
    .collist-actions {
      display: flex; gap: 8px; padding: 8px 24px; align-items: center;
      border-bottom: 1px solid var(--border-color); background: var(--card-bg);
    }
    .collist-uml-btn {
      background: #805ad5; color: white; border: none; border-radius: 8px;
      padding: 7px 14px; font-size: 12px; font-weight: 600;
      cursor: pointer; display: inline-flex; align-items: center; gap: 5px;
      transition: background 0.2s, opacity 0.2s; white-space: nowrap;
    }
    .collist-uml-btn:hover:not(:disabled) { background: #6b46c1; }
    .collist-uml-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .collist-uml-hint {
      font-size: 11px; color: var(--text-faint); margin-left: 4px;
    }
    .collist-body {
      overflow: auto; flex: 1; padding: 0;
    }
    .collist-table {
      width: 100%; border-collapse: collapse; font-size: 13px;
    }
    .collist-table thead { position: sticky; top: 0; z-index: 1; }
    .collist-table th {
      background: var(--bg-secondary); border-bottom: 2px solid var(--border-color);
      padding: 10px 14px; text-align: left; font-weight: 600; cursor: pointer;
      user-select: none; white-space: nowrap; color: var(--text-primary);
    }
    .collist-table th:hover { background: var(--dropdown-hover); }
    .collist-table th .sort-indicator { margin-left: 4px; opacity: 0.4; font-size: 11px; }
    .collist-table th .sort-indicator.active { opacity: 1; }
    .collist-table td {
      padding: 8px 14px; border-bottom: 1px solid var(--border-color);
      color: var(--text-secondary);
    }
    .collist-table tr:hover td { background: var(--dropdown-hover); }
    .collist-table .key-badge {
      display: inline-block; padding: 1px 6px; border-radius: 4px;
      font-size: 10px; font-weight: 700; color: white; margin-right: 3px;
    }
    .collist-table .key-badge.pk { background: #e53e3e; }
    .collist-table .key-badge.fk { background: #ed8936; }
    .collist-table .key-badge.uk { background: #48bb78; }
    .collist-table .key-badge.idx { background: #4299e1; }
    .collist-count {
      display: flex; justify-content: space-between; align-items: center;
      padding: 8px 24px; font-size: 12px; color: var(--text-faint);
      border-top: 1px solid var(--border-color);
    }

    /* フィルタ済みUMLモーダル */
    .filtered-uml-modal-card {
      width: min(1600px, 96vw); max-height: min(92vh, 1080px);
      background: var(--card-bg); border: 1px solid var(--border-color);
      border-radius: 16px; box-shadow: 0 24px 80px rgba(0, 0, 0, 0.25);
      overflow: hidden; display: flex; flex-direction: column;
    }

    /* UML モーダル */
    .uml-modal-card {
      width: min(1600px, 96vw); max-height: min(92vh, 1080px);
      background: var(--card-bg); border: 1px solid var(--border-color);
      border-radius: 16px; box-shadow: 0 24px 80px rgba(0, 0, 0, 0.25);
      overflow: hidden; display: flex; flex-direction: column;
    }
    .uml-canvas-wrapper {
      position: relative; overflow: auto; min-height: 400px;
      padding: 24px;
    }
    .uml-er-container {
      position: relative; min-width: 1500px; min-height: 900px;
    }
    .uml-table-card {
      position: absolute; background: var(--card-bg);
      border: 2px solid var(--border-color); border-radius: 10px;
      min-width: 170px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      font-size: 12px; overflow: hidden; z-index: 1;
    }
    .uml-table-card .uml-table-header {
      background: #8b949e;
      color: white; padding: 8px 12px; font-weight: 700; font-size: 13px;
      display: flex; align-items: center; gap: 6px;
      cursor: pointer; user-select: none;
    }
    .uml-table-card .uml-table-header:hover { filter: brightness(1.15); }
    .uml-modal-card, .filtered-uml-modal-card { position: relative; }
    .uml-group-legend-wrap {
      position: absolute; bottom: 56px; left: 16px; z-index: 30;
      user-select: none; pointer-events: all;
    }
    .uml-group-legend-box {
      background: var(--card-bg); border: 1px solid var(--border-color);
      border-radius: 8px; padding: 6px 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15); min-width: 160px;
      font-size: 12px;
    }
    .uml-group-legend-header {
      display: flex; align-items: center; justify-content: space-between;
      font-weight: 600; gap: 8px; color: var(--text-primary); cursor: pointer;
    }
    .uml-group-legend-items { margin-top: 6px; display: flex; flex-direction: column; gap: 4px; }
    .uml-group-legend-row { display: flex; align-items: center; gap: 8px; cursor: pointer; border-radius: 4px; padding: 1px 2px; }
    .uml-group-legend-row:hover { background: var(--bg-secondary); }
    .uml-group-legend-swatch { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }
    .uml-group-legend-name { flex: 1; font-size: 11px; color: var(--text-secondary); }
    .uml-group-legend-code { font-size: 10px; font-family: monospace; color: var(--text-muted); }
    .uml-table-card .uml-table-body {
      padding: 6px 0;
    }
    .uml-col-row {
      display: flex; align-items: center; gap: 6px;
      padding: 3px 12px; font-family: 'Monaco', 'Courier New', monospace;
      font-size: 11px; color: var(--text-secondary);
    }
    .uml-col-row:hover { background: var(--bg-secondary); }
    .uml-col-key {
      font-size: 9px; font-weight: 700; border-radius: 3px;
      padding: 1px 4px; color: white; flex-shrink: 0;
    }
    .uml-col-key.pk { background: #e53e3e; }
    .uml-col-key.fk { background: #ed8936; }
    .uml-col-key.uk { background: #48bb78; }
    .uml-col-key.idx { background: #4299e1; }
    .uml-col-name { flex: 1; }
    .uml-col-type { color: var(--text-faint); font-size: 10px; }
    .uml-svg-overlay {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 2; overflow: visible;
    }
    .uml-bottom-panel {
      position: relative;
    }
    .uml-canvas-wrapper { flex: 1; }
    .uml-panel-handle {
      display: flex; align-items: center; justify-content: center;
      padding: 6px 0 2px; cursor: ns-resize; user-select: none; -webkit-user-select: none;
      border-top: 1px solid var(--border-color);
    }
    .uml-panel-handle:active { cursor: ns-resize; }
    .uml-panel-handle-bar {
      width: 40px; height: 4px; border-radius: 2px;
      background: var(--text-faint); opacity: 0.5; transition: opacity 0.2s;
    }
    .uml-panel-handle:hover .uml-panel-handle-bar { opacity: 0.8; }
    .uml-panel-handle-hint {
      font-size: 10px; color: var(--text-faint); margin-left: 8px;
    }
    .uml-panel-body {
      overflow: hidden; transition: max-height 0.25s ease;
    }
    .uml-panel-toggle {
      background: none; border: 1px solid var(--border-color); border-radius: 4px;
      padding: 2px 8px; font-size: 10px; color: var(--text-muted); cursor: pointer;
      margin-left: 6px; line-height: 1.4; white-space: nowrap;
      transition: background 0.15s, color 0.15s;
    }
    .uml-panel-toggle:hover { background: var(--bg-secondary); color: var(--text-primary); }
    .uml-legend {
      display: flex; flex-wrap: wrap; gap: 16px; padding: 16px 24px;
      font-size: 12px;
      color: var(--text-muted); align-items: center;
    }
    .uml-legend-item {
      display: inline-flex; align-items: center; gap: 6px;
    }
    .uml-legend-color {
      width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0;
    }
    .uml-normalization-note {
      padding: 12px 24px 20px; font-size: 12px; color: var(--text-muted);
      line-height: 1.7;
    }
    .uml-normalization-note strong { color: var(--text-primary); }
    .uml-normalization-note .nf-badge {
      display: inline-block; background: #48bb78; color: white;
      font-size: 10px; font-weight: 700; padding: 2px 6px;
      border-radius: 4px; margin-right: 4px; vertical-align: middle;
    }

    /* キー種別ツールチップ */
    .uml-legend-item.has-tooltip {
      position: relative; cursor: pointer;
    }
    .uml-legend-item.has-tooltip:hover .key-tooltip,
    .uml-legend-item.has-tooltip:focus .key-tooltip {
      display: block;
    }
    .key-tooltip {
      display: none; position: absolute; bottom: calc(100% + 8px); left: 50%;
      transform: translateX(-50%); width: 320px; padding: 14px 16px;
      background: var(--card-bg); border: 1px solid var(--border-color);
      border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      font-size: 12px; line-height: 1.65; color: var(--text-secondary);
      z-index: 100; pointer-events: none; text-align: left;
    }
    .key-tooltip::after {
      content: ''; position: absolute; top: 100%; left: 50%;
      transform: translateX(-50%); border: 6px solid transparent;
      border-top-color: var(--border-color);
    }
    .key-tooltip strong { color: var(--text-primary); display: block; margin-bottom: 4px; font-size: 13px; }
    .key-tooltip .tooltip-section { margin-top: 6px; }
    .key-tooltip .tooltip-label { font-weight: 600; color: var(--text-muted); font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }

    /* キーカラム一覧 */
    .uml-key-summary {
      padding: 12px 24px 16px; border-top: 1px solid var(--border-color);
      max-height: 180px; overflow-y: auto;
    }
    .uml-key-summary-title {
      font-size: 12px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;
    }
    .uml-key-cols {
      display: flex; flex-wrap: wrap; gap: 6px;
    }
    .uml-key-col-item {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 10px; border-radius: 6px; font-size: 11px;
      background: var(--bg-secondary); border: 1px solid var(--border-color);
      color: var(--text-secondary); white-space: nowrap;
    }
    .uml-key-col-item .kc-badge {
      display: inline-block; padding: 1px 5px; border-radius: 3px;
      font-size: 9px; font-weight: 700; color: white;
    }
    .uml-key-col-item .kc-badge.pk { background: #e53e3e; }
    .uml-key-col-item .kc-badge.fk { background: #ed8936; }
    .uml-key-col-item .kc-badge.uk { background: #48bb78; }
    .uml-key-col-item .kc-badge.idx { background: #4299e1; }
    .uml-key-col-item .kc-table { color: var(--text-faint); font-size: 10px; }

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
          <a href="/aichat" class="dropdown-item">🤖 AI チャット</a>
          <a href="/repositories" class="dropdown-item">📦 リポジトリ</a>
          <a href="/function-changelog" class="dropdown-item">🔖 関数辞典</a>
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

      ${data.pendingColumnMigrations.length > 0 ? `
      <!-- カラムマイグレーション未適用バナー -->
      <div style="background:#4d1a1a;border:2px solid #cf222e;border-radius:8px;padding:14px 18px;margin-bottom:18px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="font-size:18px">⚠️</span>
          <strong style="color:#ff8182;font-size:14px">カラムマイグレーション未適用（${data.pendingColumnMigrations.length}件）</strong>
        </div>
        <p style="color:#ffa0a0;font-size:12px;margin-bottom:10px">
          以下のカラムが D1 に存在しません。Worker は旧スキーマで動作中のため一部機能が無効になっています。<br>
          D1 コンソールまたは <code style="background:#2d1117;padding:1px 4px;border-radius:3px">wrangler d1 execute</code> で SQL を実行してください。
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr style="color:#ffa0a0;">
              <th style="text-align:left;padding:4px 8px;border-bottom:1px solid #7f1d1d;">migration</th>
              <th style="text-align:left;padding:4px 8px;border-bottom:1px solid #7f1d1d;">テーブル</th>
              <th style="text-align:left;padding:4px 8px;border-bottom:1px solid #7f1d1d;">不足カラム</th>
              <th style="text-align:left;padding:4px 8px;border-bottom:1px solid #7f1d1d;">実行SQL</th>
            </tr>
          </thead>
          <tbody>
            ${data.pendingColumnMigrations.map(m => `
            <tr>
              <td style="padding:4px 8px;color:#fc8181;font-weight:600">${escapeHtml(m.migration)}</td>
              <td style="padding:4px 8px;color:#e5e7eb">${escapeHtml(m.table)}</td>
              <td style="padding:4px 8px;color:#fbbf24;font-family:monospace">${escapeHtml(m.column)}</td>
              <td style="padding:4px 8px"><code style="background:#2d1117;padding:2px 6px;border-radius:3px;color:#fca5a5;font-family:monospace;font-size:11px;user-select:all">${escapeHtml(m.sql)}</code></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}

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
        <h2 class="section-title">テーブル別マイグレーション状況 <span class="section-count">(${statusTables.length})</span></h2>
        <div class="uml-button-row">
          <button type="button" class="uml-button" id="openUmlButton">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="5" height="6" rx="1" stroke="white" stroke-width="1.5"/><rect x="10" y="9" width="5" height="6" rx="1" stroke="white" stroke-width="1.5"/><path d="M6 4h2.5a1.5 1.5 0 011.5 1.5V12" stroke="white" stroke-width="1.5"/></svg>
            UML を表示
          </button>
          <button type="button" class="uml-button" id="openCommitAgentLogButton">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="white" stroke-width="1.5"/><path d="M4.5 6h7M4.5 8h7M4.5 10h4" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>
            0025(commit_agent_log) を開く
          </button>
          <button type="button" class="uml-refresh-button" id="refreshUmlButton">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M14 8A6 6 0 114 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M4 0.5V4h3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            手動で更新する
          </button>
        </div>
        <div class="table-scroll">
          <table class="data-table" id="statusTablesTable">
            <thead>
              <tr>
                <th>G <select id="groupFilterSelect" style="font-size:10px;padding:1px 2px;border-radius:3px;border:1px solid #888;background:transparent;color:inherit;cursor:pointer;max-width:60px"><option value="">ALL</option>${groupSelectOptions}</select></th>
                <th style="cursor:pointer;user-select:none" id="tableNameSortTh">テーブル名 ⇅</th>
                <th style="text-align:center">状態</th>
                <th style="text-align:right;cursor:pointer;user-select:none" id="rowCountSortTh">レコード数 ⇅</th>
                <th style="text-align:center">更新</th>
                <th style="cursor:pointer;user-select:none" id="migrationSortTh">マイグレーション ⇅</th>
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
      <div class="section" id="commitChartSection">
        <div class="section-title-row">
          <h2 class="section-title">月別コミット量</h2>
          <div class="chart-sort-toggle" role="group" aria-label="並び順">
            <button type="button" class="chart-sort-toggle-btn ${statusChartSortOrder === 'count' ? 'active' : ''}" data-sort-order="count">件数順</button>
            <button type="button" class="chart-sort-toggle-btn ${statusChartSortOrder === 'date' ? 'active' : ''}" data-sort-order="date">日付順</button>
          </div>
          <select id="groupFilter" class="group-filter-select" title="グループでフィルタ">
            <option value="">すべて</option>
            ${groupFilterOptions}
          </select>
          <button type="button" class="sync-repo-colors-btn" id="openRepoGroupModal" title="リポジトリグループを管理">
            <span class="sync-icon">&#x1F4C1;</span> グループ管理
          </button>
          <button type="button" class="sync-repo-colors-btn" id="syncRepoColorsBtn" title="コミットキャッシュからリポジトリ色設定を同期">
            <span class="sync-icon">&#x21bb;</span> 色設定を同期
          </button>
        </div>
        ${uniqueOwner ? `<div style="font-size:13px; color:var(--text-muted); margin-bottom:8px;">対象ユーザー : <strong style="color:var(--text-primary);">${escapeHtml(uniqueOwner)}</strong></div>` : ''}
        <div id="chartLegendArea">${statusChartMode === 'repo' && allRepos.length > 0 ? `<div class="chart-legend">${repoLegend}</div>` : ''}</div>
        <div class="chart-section" id="chartBarsArea">
          ${chartBars}
        </div>
      </div>
      ` : ''}

      <!-- 今月のコミット総数の内訳パイチャート -->
      <div class="section" id="pieChartSection">
        <div class="section-title-row">
          <h2 class="section-title">今月のコミット総数の内訳</h2>
          <select id="pieGroupFilter" class="group-filter-select" title="グループでフィルタ">
            <option value="">すべて</option>
            ${groupFilterOptions}
          </select>
        </div>
        ${uniqueOwner ? `<div style="font-size:13px; color:var(--text-muted); margin-bottom:8px;">対象ユーザー : <strong style="color:var(--text-primary);">${escapeHtml(uniqueOwner)}</strong></div>` : ''}
        <div class="pie-chart-total">対象月: <strong>${escapeHtml(currentYearMonth)}</strong> &mdash; 合計: <strong>${currentMonthTotal}</strong> commits</div>
        <div class="pie-chart-container">
          <div class="pie-chart-svg-area" id="pieChartSvgArea">
            ${pieSvgInitial}
          </div>
          <div class="pie-chart-legend-area" id="pieChartLegendArea">
            ${currentMonthRepos.length > 0 ? `<div class="pie-chart-legend">${pieLegendInitial}</div>` : ''}
          </div>
        </div>
      </div>

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

  <div class="modal-backdrop" id="umlModal" aria-hidden="true">
    <div class="uml-modal-card" role="dialog" aria-modal="true" aria-labelledby="umlModalTitle">
      <div class="modal-header">
        <div class="modal-title-wrap">
          <div class="modal-title" id="umlModalTitle">ER図 — テーブルリレーション</div>
          <div class="modal-subtitle">テーブル間の外部キー・参照関係と正規化状況を表示しています</div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <div class="uml-view-toggle" role="group" aria-label="表示モード">
            <button type="button" id="umlViewModeFocus" title="画面左上にフォーカス（等倍表示）">フォーカス</button>
            <button type="button" id="umlViewModeOverview" title="画面全体を俯瞰（全テーブルを画面に収める）">俯瞰</button>
          </div>
          <button type="button" class="uml-collist-button" id="umlFkVerifyBtn" title="FK関係の実データを検証">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6.5 12a5.5 5.5 0 100-11 5.5 5.5 0 000 11zM15 15l-3.6-3.6" stroke="white" stroke-width="1.5" stroke-linecap="round"/><path d="M5 6.5l2 2 3.5-3.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            FK検証
          </button>
          <button type="button" class="uml-collist-button" id="umlColListBtn">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h12M2 12h8" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>
            カラム名での表一覧
          </button>
          <button type="button" class="uml-pos-button" id="umlExportPosBtn">座標を出力</button>
          <button type="button" class="uml-pos-button" id="umlImportPosBtn">座標入力</button>
          <button type="button" class="uml-export-button" id="umlExportPng">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1v9M8 10L4.5 6.5M8 10l3.5-3.5M2 12v2h12v-2" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            画像出力
          </button>
          <button type="button" class="modal-close" id="umlModalClose" aria-label="閉じる">&times;</button>
        </div>
      </div>
      <div class="uml-canvas-wrapper" id="umlCanvasWrapper"></div>
      <div class="uml-group-legend-wrap" id="umlGroupLegendWrap">
        <div class="uml-group-legend-box" id="umlGroupLegendBox">
          <div class="uml-group-legend-header" id="umlGroupLegendHeader">
            <span>グループ凡例</span>
            <span id="umlGroupLegendArrow">▲</span>
          </div>
          <div class="uml-group-legend-items" id="umlGroupLegendItems"></div>
        </div>
      </div>
      <div class="uml-bottom-panel" id="umlBottomPanel">
        <div class="uml-panel-handle" id="umlPanelHandle">
          <div class="uml-panel-handle-bar"></div>
          <span class="uml-panel-handle-hint">上下にドラッグで開閉</span>
        </div>
        <div class="uml-legend">
          <div class="uml-legend-item has-tooltip" tabindex="0"><div class="uml-legend-color" style="background:#e53e3e"></div>PK — 主キー
            <div class="key-tooltip">
              <strong>PK（Primary Key / 主キー）</strong>
              <div class="tooltip-section"><span class="tooltip-label">用法</span><br>テーブル内の各行を一意に識別するカラム。NULL不可・重複不可。</div>
              <div class="tooltip-section"><span class="tooltip-label">使用場面</span><br>ユーザーID、注文番号など、レコードを特定する必要がある全テーブルで必須。</div>
              <div class="tooltip-section"><span class="tooltip-label">メリット</span><br>データの一意性を保証し、外部キーの参照先となる。自動的にインデックスが作成されるためJOINや検索が高速。</div>
            </div>
          </div>
          <div class="uml-legend-item has-tooltip" tabindex="0"><div class="uml-legend-color" style="background:#ed8936"></div>FK — 外部キー
            <div class="key-tooltip">
              <strong>FK（Foreign Key / 外部キー）</strong>
              <div class="tooltip-section"><span class="tooltip-label">用法</span><br>他テーブルの主キーを参照するカラム。テーブル間の親子関係を定義する。</div>
              <div class="tooltip-section"><span class="tooltip-label">使用場面</span><br>workspaces.team_id → teams.id のように、所属関係・参照関係を表現する場面。</div>
              <div class="tooltip-section"><span class="tooltip-label">メリット</span><br>参照整合性を保証し、存在しない親レコードへの参照を防止。JOINクエリの論理的根拠となる。</div>
            </div>
          </div>
          <div class="uml-legend-item has-tooltip" tabindex="0"><div class="uml-legend-color" style="background:#48bb78"></div>UK — ユニーク制約
            <div class="key-tooltip">
              <strong>UK（Unique Key / ユニーク制約）</strong>
              <div class="tooltip-section"><span class="tooltip-label">用法</span><br>PKとは別に、カラムまたはカラムの組み合わせの値が重複しないことを保証する。</div>
              <div class="tooltip-section"><span class="tooltip-label">使用場面</span><br>メールアドレス、ユーザー名など「PKではないが一意であるべき」値。複合ユニーク制約（例: workspace_id + owner + repo）にも使用。</div>
              <div class="tooltip-section"><span class="tooltip-label">メリット</span><br>ビジネスロジック上の重複を防止。自動的にインデックスが作成され、検索性能も向上。</div>
            </div>
          </div>
          <div class="uml-legend-item has-tooltip" tabindex="0"><div class="uml-legend-color" style="background:#4299e1"></div>IDX — インデックス
            <div class="key-tooltip">
              <strong>IDX（Index / インデックス）</strong>
              <div class="tooltip-section"><span class="tooltip-label">用法</span><br>検索・ソート・フィルタリングの頻度が高いカラムに付与し、クエリの実行速度を向上させる。</div>
              <div class="tooltip-section"><span class="tooltip-label">使用場面</span><br>WHERE句やORDER BY句で頻繁に参照されるカラム（日付、ステータス等）。</div>
              <div class="tooltip-section"><span class="tooltip-label">メリット</span><br>フルテーブルスキャンを回避し、O(log n) のB-Tree検索で高速にデータを取得。書き込み時のオーバーヘッドとのトレードオフ。</div>
            </div>
          </div>
          <div class="uml-legend-item has-tooltip" tabindex="0"><div class="uml-legend-color" style="background:transparent; border:1.5px dashed #ed8936; width:12px; height:12px; box-sizing:border-box; border-radius:3px;"></div>論理FK — 論理外部キー
            <div class="key-tooltip">
              <strong>論理FK（Logical Foreign Key / 論理外部キー）</strong>
              <div class="tooltip-section"><span class="tooltip-label">用法</span><br>DBレベルの <code>FOREIGN KEY</code> 制約は貼られていないが、アプリケーション上は他テーブルのカラムを参照していることが明確なカラム。ER図上は破線の関連線で表現する。</div>
              <div class="tooltip-section"><span class="tooltip-label">使用場面</span><br>例: <code>commit_agent_log.request_id</code> / <code>ai_summary_link_access_log.request_id</code> は <code>ai_summary_log.request_id</code> を参照するが、CASCADE削除や書き込み順序の制約を避けるため DB 制約は設けていない。同名カラムで緩く繋がる監査ログ・キャッシュ系テーブルで典型的。</div>
              <div class="tooltip-section"><span class="tooltip-label">メリット</span><br>書き込みタイミングが親子で独立しているテーブルでも JOIN 可能な関連として明示できる。CASCADE 連鎖の副作用を避けつつ、テーブル間の意味的な参照関係をドキュメント化できる。</div>
            </div>
          </div>
          <div class="uml-legend-item" style="margin-left:auto; color:var(--text-faint)">ドラッグで移動可 <button type="button" class="uml-panel-toggle" id="umlPanelToggle">close</button></div>
        </div>
        <div class="uml-panel-body" id="umlPanelBody">
          <div class="uml-key-summary" id="umlKeySummary"></div>
          <div class="uml-normalization-note">
            <strong>正規化状況:</strong><br>
            <span class="nf-badge">3NF</span><code>teams</code> <code>workspaces</code> <code>team_members</code> — 第3正規形。非キー属性が主キーにのみ関数従属。<br>
            <span class="nf-badge">3NF</span><code>user_sessions</code> — user_id UNIQUE で実質的な候補キー。設定カラム (timezone, session_duration) は user_id にのみ従属。<br>
            <span class="nf-badge">2NF</span><code>commit_calendar_cache</code> <code>commit_list_cache</code> — counts / commits_json が JSON 文字列格納（非原子値）。運用上のキャッシュ用途として許容。<br>
            <span class="nf-badge">3NF</span><code>cache_stats</code> — 全カウンタが (user_id, owner, repo) 複合キーにのみ従属。<br>
            <span class="nf-badge">2NF</span><code>installation_permissions</code> — permissions が JSON 文字列格納。GitHub API レスポンスのキャッシュとして非正規化を許容。
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 座標出力モーダル -->
  <div class="uml-pos-modal-overlay" id="umlExportPosModal">
    <div class="uml-pos-modal" onclick="event.stopPropagation()">
      <div class="uml-pos-modal-header">
        <span class="uml-pos-modal-title">各エンティティの座標（JSON）</span>
        <button class="uml-pos-modal-close" id="umlExportPosClose">&times;</button>
      </div>
      <div class="uml-pos-modal-body">
        <textarea class="uml-pos-textarea" id="umlExportPosTextarea" readonly></textarea>
      </div>
      <div class="uml-pos-modal-footer">
        <button id="umlExportPosCopyBtn">コピー</button>
        <button id="umlExportPosCloseBtn">閉じる</button>
      </div>
    </div>
  </div>

  <!-- 座標入力モーダル -->
  <div class="uml-pos-modal-overlay" id="umlImportPosModal">
    <div class="uml-pos-modal" onclick="event.stopPropagation()">
      <div class="uml-pos-modal-header">
        <span class="uml-pos-modal-title">座標を入力（JSON）</span>
        <button class="uml-pos-modal-close" id="umlImportPosClose">&times;</button>
      </div>
      <div class="uml-pos-modal-body">
        <textarea class="uml-pos-textarea" id="umlImportPosTextarea"
          placeholder='{"teams":{"x":80,"y":40},"workspaces":{"x":80,"y":260},...}'></textarea>
        <div class="uml-pos-feedback" id="umlImportPosFeedback"></div>
      </div>
      <div class="uml-pos-modal-footer">
        <button id="umlImportPosCancelBtn">キャンセル</button>
        <button class="pos-btn-primary" id="umlImportPosApplyBtn">適用</button>
      </div>
    </div>
  </div>

  <div class="modal-backdrop" id="fkVerifyModal" aria-hidden="true" style="z-index:10002">
    <div class="collist-modal-card" role="dialog" aria-modal="true" aria-labelledby="fkVerifyModalTitle">
      <div class="modal-header">
        <div class="modal-title-wrap">
          <div class="modal-title" id="fkVerifyModalTitle">FK検証 — 実データサンプリング</div>
          <div class="modal-subtitle">リレーションごとにJOINで実データを検証し、孤立レコード(orphan)を検出します</div>
        </div>
        <button type="button" class="modal-close" id="fkVerifyModalClose" aria-label="閉じる">&times;</button>
      </div>
      <div id="fkVerifyBody" style="padding:1rem;overflow-y:auto;max-height:70vh;"></div>
    </div>
  </div>

  <div class="modal-backdrop" id="colListModal" aria-hidden="true">
    <div class="collist-modal-card" role="dialog" aria-modal="true" aria-labelledby="colListModalTitle">
      <div class="modal-header">
        <div class="modal-title-wrap">
          <div class="modal-title" id="colListModalTitle">カラム名での表一覧</div>
          <div class="modal-subtitle">全テーブルのカラム定義をキー種別・テーブル名で絞り込み・ソートできます</div>
        </div>
        <button type="button" class="modal-close" id="colListModalClose" aria-label="閉じる">&times;</button>
      </div>
      <div class="collist-filters" id="colListFilters"></div>
      <div class="collist-actions" id="colListActions">
        <button type="button" class="collist-uml-btn" id="colListUmlBtn" disabled>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 2h5v5H2zM9 2h5v5H9zM5.5 9.5v3m0 0H3m2.5 0h2.5M11.5 9.5v3m0 0H9m2.5 0h2.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          UMLを作成
        </button>
        <span class="collist-uml-hint" id="colListUmlHint">フィルタを選択すると有効になります</span>
      </div>
      <div class="collist-body">
        <table class="collist-table">
          <thead id="colListThead"></thead>
          <tbody id="colListTbody"></tbody>
        </table>
      </div>
      <div class="collist-count" id="colListCount"></div>
    </div>
  </div>

  <div class="modal-backdrop" id="filteredUmlModal" aria-hidden="true">
    <div class="filtered-uml-modal-card" role="dialog" aria-modal="true" aria-labelledby="filteredUmlModalTitle">
      <div class="modal-header">
        <div class="modal-title-wrap">
          <div class="modal-title" id="filteredUmlModalTitle">フィルタ済み ER図</div>
          <div class="modal-subtitle" id="filteredUmlModalSubtitle">
            <span id="fUmlSubtitleSummary"></span>
            <label class="er-tablelist-toggle" title="テーブル一覧を展開表示"><input type="checkbox" id="fUmlTablelistToggle"><span class="er-tablelist-toggle-slider"></span></label>
            <span id="fUmlSubtitleDetail" style="display:none"></span>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <div class="uml-view-toggle" role="group" aria-label="表示モード">
            <button type="button" id="filteredUmlViewModeFocus" title="画面左上にフォーカス（等倍表示）">フォーカス</button>
            <button type="button" id="filteredUmlViewModeOverview" title="画面全体を俯瞰（全テーブルを画面に収める）">俯瞰</button>
          </div>
          <button type="button" class="modal-close" id="filteredUmlModalClose" aria-label="閉じる">&times;</button>
        </div>
      </div>
      <div class="uml-canvas-wrapper" id="filteredUmlCanvasWrapper"></div>
      <div class="uml-group-legend-wrap" id="filteredUmlGroupLegendWrap">
        <div class="uml-group-legend-box" id="filteredUmlGroupLegendBox">
          <div class="uml-group-legend-header" id="filteredUmlGroupLegendHeader">
            <span>グループ凡例</span>
            <span id="filteredUmlGroupLegendArrow">▲</span>
          </div>
          <div class="uml-group-legend-items" id="filteredUmlGroupLegendItems"></div>
        </div>
      </div>
      <div class="uml-bottom-panel" id="filteredUmlBottomPanel">
        <div class="uml-panel-handle" id="filteredUmlPanelHandle">
          <div class="uml-panel-handle-bar"></div>
          <span class="uml-panel-handle-hint">上下にドラッグで開閉</span>
        </div>
        <div class="uml-legend">
          <div class="uml-legend-item has-tooltip" tabindex="0"><div class="uml-legend-color" style="background:#e53e3e"></div>PK — 主キー
            <div class="key-tooltip">
              <strong>PK（Primary Key / 主キー）</strong>
              <div class="tooltip-section"><span class="tooltip-label">用法</span><br>テーブル内の各行を一意に識別するカラム。NULL不可・重複不可。</div>
              <div class="tooltip-section"><span class="tooltip-label">使用場面</span><br>ユーザーID、注文番号など、レコードを特定する必要がある全テーブルで必須。</div>
              <div class="tooltip-section"><span class="tooltip-label">メリット</span><br>データの一意性を保証し、外部キーの参照先となる。自動的にインデックスが作成されるためJOINや検索が高速。</div>
            </div>
          </div>
          <div class="uml-legend-item has-tooltip" tabindex="0"><div class="uml-legend-color" style="background:#ed8936"></div>FK — 外部キー
            <div class="key-tooltip">
              <strong>FK（Foreign Key / 外部キー）</strong>
              <div class="tooltip-section"><span class="tooltip-label">用法</span><br>他テーブルの主キーを参照するカラム。テーブル間の親子関係を定義する。</div>
              <div class="tooltip-section"><span class="tooltip-label">使用場面</span><br>workspaces.team_id → teams.id のように、所属関係・参照関係を表現する場面。</div>
              <div class="tooltip-section"><span class="tooltip-label">メリット</span><br>参照整合性を保証し、存在しない親レコードへの参照を防止。JOINクエリの論理的根拠となる。</div>
            </div>
          </div>
          <div class="uml-legend-item has-tooltip" tabindex="0"><div class="uml-legend-color" style="background:#48bb78"></div>UK — ユニーク制約
            <div class="key-tooltip">
              <strong>UK（Unique Key / ユニーク制約）</strong>
              <div class="tooltip-section"><span class="tooltip-label">用法</span><br>PKとは別に、カラムまたはカラムの組み合わせの値が重複しないことを保証する。</div>
              <div class="tooltip-section"><span class="tooltip-label">使用場面</span><br>メールアドレス、ユーザー名など「PKではないが一意であるべき」値。複合ユニーク制約にも使用。</div>
              <div class="tooltip-section"><span class="tooltip-label">メリット</span><br>ビジネスロジック上の重複を防止。自動的にインデックスが作成され、検索性能も向上。</div>
            </div>
          </div>
          <div class="uml-legend-item has-tooltip" tabindex="0"><div class="uml-legend-color" style="background:#4299e1"></div>IDX — インデックス
            <div class="key-tooltip">
              <strong>IDX（Index / インデックス）</strong>
              <div class="tooltip-section"><span class="tooltip-label">用法</span><br>検索・ソート・フィルタリングの頻度が高いカラムに付与し、クエリの実行速度を向上させる。</div>
              <div class="tooltip-section"><span class="tooltip-label">使用場面</span><br>WHERE句やORDER BY句で頻繁に参照されるカラム（日付、ステータス等）。</div>
              <div class="tooltip-section"><span class="tooltip-label">メリット</span><br>フルテーブルスキャンを回避し、O(log n) のB-Tree検索で高速にデータを取得。</div>
            </div>
          </div>
          <div class="uml-legend-item has-tooltip" tabindex="0"><div class="uml-legend-color" style="background:transparent; border:1.5px dashed #ed8936; width:12px; height:12px; box-sizing:border-box; border-radius:3px;"></div>論理FK — 論理外部キー
            <div class="key-tooltip">
              <strong>論理FK（Logical Foreign Key / 論理外部キー）</strong>
              <div class="tooltip-section"><span class="tooltip-label">用法</span><br>DBレベルの <code>FOREIGN KEY</code> 制約は貼られていないが、アプリケーション上は他テーブルのカラムを参照していることが明確なカラム。ER図上は破線の関連線で表現する。</div>
              <div class="tooltip-section"><span class="tooltip-label">使用場面</span><br>例: <code>commit_agent_log.request_id</code> / <code>ai_summary_link_access_log.request_id</code> は <code>ai_summary_log.request_id</code> を参照するが、CASCADE削除や書き込み順序の制約を避けるため DB 制約は設けていない。同名カラムで緩く繋がる監査ログ・キャッシュ系テーブルで典型的。</div>
              <div class="tooltip-section"><span class="tooltip-label">メリット</span><br>書き込みタイミングが親子で独立しているテーブルでも JOIN 可能な関連として明示できる。CASCADE 連鎖の副作用を避けつつ、テーブル間の意味的な参照関係をドキュメント化できる。</div>
            </div>
          </div>
          <div class="uml-legend-item" style="margin-left:auto; color:var(--text-faint)">ドラッグで移動可 <button type="button" class="uml-panel-toggle" id="filteredUmlPanelToggle">close</button></div>
        </div>
        <div class="uml-panel-body" id="filteredUmlPanelBody">
          <div class="uml-key-summary" id="filteredUmlKeySummary"></div>
        </div>
      </div>
    </div>
  </div>

  <div class="modal-backdrop" id="ymCalendarModal" aria-hidden="true" style="z-index:4000">
    <div class="ym-calendar-card" role="dialog" aria-modal="true" aria-labelledby="ymCalendarTitle">
      <div class="modal-header">
        <div class="modal-title-wrap">
          <div class="modal-title" id="ymCalendarTitle">カレンダー</div>
          <div class="modal-subtitle" id="ymCalendarSubtitle"></div>
        </div>
        <button type="button" class="modal-close" id="ymCalendarClose" aria-label="閉じる">&times;</button>
      </div>
      <div class="modal-body" id="ymCalendarBody" style="padding:16px"></div>
    </div>
  </div>

  <div class="modal-backdrop" id="repoGroupModal" aria-hidden="true">
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="repoGroupModalTitle" style="max-width:640px;">
      <div class="modal-header">
        <div class="modal-title-wrap">
          <div class="modal-title" id="repoGroupModalTitle">リポジトリグループ管理</div>
          <div class="modal-subtitle">リポジトリをグループに分類して管理します</div>
        </div>
        <button type="button" class="modal-close" id="repoGroupModalClose" aria-label="閉じる">&times;</button>
      </div>
      <div class="modal-body" id="repoGroupModalBody" style="max-height:70vh; overflow-y:auto;">
        <div id="repoGroupList" style="margin-bottom:16px;"></div>
        <div style="border-top:1px solid var(--border-color); padding-top:16px;">
          <h3 style="margin:0 0 12px; font-size:14px; font-weight:600; color:var(--text-primary);">新規グループ作成</h3>
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            <input type="text" id="newGroupName" placeholder="グループ名" style="flex:1; min-width:160px; padding:6px 10px; border:1px solid var(--border-color); border-radius:6px; background:var(--bg-secondary); color:var(--text-primary); font-size:13px;">
            <input type="color" id="newGroupColor" value="#667eea" style="width:36px; height:32px; border:1px solid var(--border-color); border-radius:6px; cursor:pointer; padding:2px;">
            <button type="button" id="createGroupBtn" style="padding:6px 14px; background:#667eea; color:#fff; border:none; border-radius:6px; font-size:13px; cursor:pointer; white-space:nowrap;">作成</button>
          </div>
          <input type="text" id="newGroupDesc" placeholder="説明（任意）" style="width:100%; margin-top:8px; padding:6px 10px; border:1px solid var(--border-color); border-radius:6px; background:var(--bg-secondary); color:var(--text-primary); font-size:13px; box-sizing:border-box;">
        </div>
      </div>
    </div>
  </div>

  <div id="unclassifiedWarningToast" class="status-toast" role="status" aria-live="polite"></div>

  <script>
    ${getThemeToggleScript()}

    var commitCacheSortMode = ${JSON.stringify(statusCommitCacheSortMode)};
    var commitCacheSortState = ${JSON.stringify(statusCommitCacheSortState)};
    var commitCacheEntries = ${commitCacheEntriesJson};
    var unclassifiedAutoDetectedTables = ${unclassifiedAutoDetectedTablesJson};
    var allRepoNames = ${JSON.stringify(data.repoColors.map(rc => rc.repoName).sort())};
    var uniqueOwner = ${uniqueOwner ? JSON.stringify(uniqueOwner) : 'null'};
    var activeCommitCacheYearMonth = null;

    var byMonthByRepo = ${byMonthByRepoJson};
    var repoColorMap = ${repoColorMapJson};
    var repoGroupsForFilter = ${repoGroupsJson};
    var currentChartMode = ${chartModeJson};
    var currentChartSortOrder = ${chartSortOrderJson};
    var ignoreUnknownUnclassifiedWarning = ${JSON.stringify(statusIgnoreUnknownUnclassifiedWarning)};
    var tableGroupMap = ${JSON.stringify(data.tableGroupMap)};
    var groupLabels = ${JSON.stringify(data.groupLabels)};
    var groupColors = ${JSON.stringify(data.groupColors)};
    var tableFkPairs = ${JSON.stringify(data.tableFkPairs)};

    function escapeHtmlText(value) {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function getUmlGroupColorsForTable(tableName) {
      var gKey = tableGroupMap[tableName];
      if (!gKey) return ['#8b949e'];
      var keys = gKey.split(',').map(function(k) { return k.trim(); });
      return keys.map(function(k) { return groupColors[k] || '#8b949e'; });
    }

    function applyUmlHeaderColor(headerEl, tableName) {
      var colors = getUmlGroupColorsForTable(tableName);
      if (colors.length === 1) {
        headerEl.style.background = colors[0];
      } else {
        var stops = colors.map(function(c, i) {
          var pct0 = Math.round((i / colors.length) * 100);
          var pct1 = Math.round(((i + 1) / colors.length) * 100);
          return c + ' ' + pct0 + '%, ' + c + ' ' + pct1 + '%';
        });
        headerEl.style.background = 'linear-gradient(90deg, ' + stops.join(', ') + ')';
      }
    }

    function getToastDurationSeconds() {
      var m = document.cookie.match('(^|;)\\\\s*user_toast_duration=([^;]*)');
      var raw = m ? decodeURIComponent(m[2]) : '10';
      var parsed = parseInt(raw, 10);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 60) return 10;
      return parsed;
    }

    function showUnclassifiedWarningToast(message) {
      var toast = document.getElementById('unclassifiedWarningToast');
      if (!toast) return;
      toast.textContent = message;
      toast.classList.add('show');
      var duration = getToastDurationSeconds() * 1000;
      setTimeout(function() {
        toast.classList.remove('show');
      }, duration);
    }

    function checkUnclassifiedTableWarnings() {
      var table = document.getElementById('statusTablesTable');
      if (!table) return;
      var rows = Array.prototype.slice.call(table.querySelectorAll('tbody tr'));
      var unclassified = rows.filter(function(row) {
        var groupId = row.getAttribute('data-group-id') || '';
        if (groupId !== '0') return false;
        var migration = (row.getAttribute('data-migration') || '').toLowerCase();
        if (ignoreUnknownUnclassifiedWarning === 'on' && migration === 'unknown') return false;
        return true;
      });
      if (unclassified.length === 0) return;
      var tableNames = unclassified.map(function(row) {
        var codeEl = row.querySelector('td:nth-child(2) code');
        return codeEl ? codeEl.textContent : '(unknown)';
      }).filter(function(v) { return !!v; });
      var preview = tableNames.slice(0, 3).join(', ');
      var suffix = tableNames.length > 3 ? ' ほか' + (tableNames.length - 3) + '件' : '';
      showUnclassifiedWarningToast('未分類テーブルを検出: ' + preview + suffix);
    }

    function stripOwnerName(fullName) {
      if (!uniqueOwner) return fullName;
      var prefix = uniqueOwner + '/';
      return fullName.indexOf(prefix) === 0 ? fullName.substring(prefix.length) : fullName;
    }

    function showUnclassifiedTableToast() {
      if (!unclassifiedAutoDetectedTables || unclassifiedAutoDetectedTables.length === 0) return;
      var toast = document.getElementById('unclassifiedTableToast');
      if (!toast) return;
      var previewList = unclassifiedAutoDetectedTables.slice(0, 4).map(function(t) { return '<code>' + escapeHtmlText(t) + '</code>'; }).join(', ');
      var rest = unclassifiedAutoDetectedTables.length > 4
        ? ' ほか ' + (unclassifiedAutoDetectedTables.length - 4) + ' 件'
        : '';
      toast.innerHTML =
        '<strong>未分類テーブルがあります（グループID: 0）</strong><br>' +
        '自動検出された新規テーブルのうち、分類できなかったものがあります。' +
        '<br>' + previewList + rest +
        '<br>/status のグループ設計（table_catalog/TABLE_GROUP_MAP）へ追加してください。';
      toast.style.display = 'block';
      setTimeout(function() {
        toast.style.display = 'none';
      }, 12000);
    }
    showUnclassifiedTableToast();

    function renderCommitChart(filterGroupId) {
      var chartBarsArea = document.getElementById('chartBarsArea');
      var chartLegendArea = document.getElementById('chartLegendArea');
      if (!chartBarsArea) return;

      var allowedRepos = null;
      if (filterGroupId) {
        for (var g = 0; g < repoGroupsForFilter.length; g++) {
          if (repoGroupsForFilter[g].id === filterGroupId) {
            allowedRepos = {};
            for (var r = 0; r < repoGroupsForFilter[g].repos.length; r++) {
              allowedRepos[repoGroupsForFilter[g].repos[r]] = true;
            }
            break;
          }
        }
        if (!allowedRepos) { allowedRepos = {}; }
      }

      var filtered = byMonthByRepo;
      if (allowedRepos) {
        filtered = byMonthByRepo.filter(function(r) { return allowedRepos[r.repo]; });
      }

      var byMonthMap = {};
      for (var i = 0; i < filtered.length; i++) {
        var ym = filtered[i].yearMonth;
        if (!byMonthMap[ym]) byMonthMap[ym] = 0;
        byMonthMap[ym] += filtered[i].commits;
      }
      var chartData = [];
      for (var ym in byMonthMap) {
        chartData.push({ yearMonth: ym, totalCommits: byMonthMap[ym] });
      }
      if (currentChartSortOrder === 'date') {
        chartData.sort(function(a, b) { return a.yearMonth.localeCompare(b.yearMonth); });
      } else {
        chartData.sort(function(a, b) { return b.totalCommits - a.totalCommits; });
      }

      var maxCommits = 1;
      for (var i = 0; i < chartData.length; i++) {
        if (chartData[i].totalCommits > maxCommits) maxCommits = chartData[i].totalCommits;
      }

      var visibleRepos = {};
      var repoTotals = {};
      for (var i = 0; i < filtered.length; i++) {
        var repo = filtered[i].repo;
        visibleRepos[repo] = true;
        if (!repoTotals[repo]) repoTotals[repo] = 0;
        repoTotals[repo] += filtered[i].commits;
      }
      var repoList = Object.keys(visibleRepos);
      repoList.sort(function(a, b) { return (repoTotals[b] || 0) - (repoTotals[a] || 0); });

      var html = '';
      if (currentChartMode === 'repo') {
        for (var i = 0; i < chartData.length; i++) {
          var d = chartData[i];
          var pct = Math.round((d.totalCommits / maxCommits) * 100);
          var monthRepos = filtered.filter(function(r) { return r.yearMonth === d.yearMonth; });
          monthRepos.sort(function(a, b) { return (repoTotals[b.repo] || 0) - (repoTotals[a.repo] || 0); });
          var segments = '';
          for (var j = 0; j < monthRepos.length; j++) {
            var mr = monthRepos[j];
            var segPct = d.totalCommits > 0 ? (mr.commits / d.totalCommits * 100) : 0;
            var color = repoColorMap[mr.repo] || '#667eea';
            segments += '<div class="chart-bar-segment" style="width:' + segPct.toFixed(2) + '%;background:' + color + '" title="' + escapeHtmlText(stripOwnerName(mr.repo)) + ': ' + mr.commits + '"></div>';
          }
          html += '<div class="chart-bar-wrapper"><div class="chart-label">' + escapeHtmlText(d.yearMonth) + '</div><div class="chart-bar-container"><div class="chart-bar-stacked" style="width: ' + pct + '%">' + segments + '</div></div><div class="chart-value">' + d.totalCommits + '</div></div>';
        }
      } else {
        for (var i = 0; i < chartData.length; i++) {
          var d = chartData[i];
          var pct = Math.round((d.totalCommits / maxCommits) * 100);
          html += '<div class="chart-bar-wrapper"><div class="chart-label">' + escapeHtmlText(d.yearMonth) + '</div><div class="chart-bar-container"><div class="chart-bar" style="width: ' + pct + '%"></div></div><div class="chart-value">' + d.totalCommits + '</div></div>';
        }
      }

      if (chartData.length === 0) {
        html = '<div class="empty-message">該当するデータがありません</div>';
      }
      chartBarsArea.innerHTML = html;

      if (chartLegendArea) {
        if (currentChartMode === 'repo' && repoList.length > 0) {
          var legendHtml = '<div class="chart-legend">';
          for (var i = 0; i < repoList.length; i++) {
            var repo = repoList[i];
            var color = repoColorMap[repo] || '#667eea';
            var total = repoTotals[repo] || 0;
            legendHtml += '<span class="chart-legend-item"><span class="chart-legend-dot" style="background:' + color + '"></span>' + escapeHtmlText(stripOwnerName(repo)) + ' (' + total + ')</span>';
          }
          legendHtml += '</div>';
          chartLegendArea.innerHTML = legendHtml;
        } else {
          chartLegendArea.innerHTML = '';
        }
      }
    }

    var currentYearMonth = ${JSON.stringify(currentYearMonth)};

    function renderPieChart(filterGroupId) {
      var svgArea = document.getElementById('pieChartSvgArea');
      var legendArea = document.getElementById('pieChartLegendArea');
      if (!svgArea) return;

      var allowedRepos = null;
      if (filterGroupId) {
        for (var g = 0; g < repoGroupsForFilter.length; g++) {
          if (repoGroupsForFilter[g].id === filterGroupId) {
            allowedRepos = {};
            for (var r = 0; r < repoGroupsForFilter[g].repos.length; r++) {
              allowedRepos[repoGroupsForFilter[g].repos[r]] = true;
            }
            break;
          }
        }
        if (!allowedRepos) { allowedRepos = {}; }
      }

      var monthData = [];
      for (var i = 0; i < byMonthByRepo.length; i++) {
        var item = byMonthByRepo[i];
        if (item.yearMonth !== currentYearMonth) continue;
        if (allowedRepos && !allowedRepos[item.repo]) continue;
        monthData.push(item);
      }
      monthData.sort(function(a, b) { return b.commits - a.commits; });

      var total = 0;
      for (var i = 0; i < monthData.length; i++) total += monthData[i].commits;

      var totalEl = document.querySelector('.pie-chart-total');
      if (totalEl) {
        totalEl.innerHTML = '対象月: <strong>' + escapeHtmlText(currentYearMonth) + '</strong> &mdash; 合計: <strong>' + total + '</strong> commits';
      }

      if (total === 0 || monthData.length === 0) {
        svgArea.innerHTML = '<div class="empty-message">今月のコミットデータがありません</div>';
        if (legendArea) legendArea.innerHTML = '';
        return;
      }

      var size = 220, cx = size / 2, cy = size / 2, r = 90;
      var cumAngle = -Math.PI / 2;
      var slices = '';
      for (var i = 0; i < monthData.length; i++) {
        var pct = monthData[i].commits / total;
        var angle = pct * 2 * Math.PI;
        var startAngle = cumAngle;
        cumAngle += angle;
        var endAngle = cumAngle;
        var color = repoColorMap[monthData[i].repo] || '#667eea';
        if (monthData.length === 1) {
          slices += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + color + '"/>';
        } else {
          var largeArc = angle > Math.PI ? 1 : 0;
          var x1 = cx + r * Math.cos(startAngle);
          var y1 = cy + r * Math.sin(startAngle);
          var x2 = cx + r * Math.cos(endAngle);
          var y2 = cy + r * Math.sin(endAngle);
          slices += '<path d="M' + cx + ',' + cy + ' L' + x1.toFixed(2) + ',' + y1.toFixed(2) + ' A' + r + ',' + r + ' 0 ' + largeArc + ' 1 ' + x2.toFixed(2) + ',' + y2.toFixed(2) + ' Z" fill="' + color + '"><title>' + escapeHtmlText(stripOwnerName(monthData[i].repo)) + ': ' + monthData[i].commits + ' (' + (pct * 100).toFixed(1) + '%)</title></path>';
        }
      }
      svgArea.innerHTML = '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" class="pie-chart-svg">' + slices + '</svg>';

      if (legendArea) {
        var lhtml = '<div class="pie-chart-legend">';
        for (var i = 0; i < monthData.length; i++) {
          var pct = (monthData[i].commits / total * 100).toFixed(1);
          var color = repoColorMap[monthData[i].repo] || '#667eea';
          lhtml += '<span class="chart-legend-item"><span class="chart-legend-dot" style="background:' + color + '"></span>' + escapeHtmlText(stripOwnerName(monthData[i].repo)) + ' (' + monthData[i].commits + ' / ' + pct + '%)</span>';
        }
        lhtml += '</div>';
        legendArea.innerHTML = lhtml;
      }
    }

    (function() {
      var groupFilter = document.getElementById('groupFilter');
      if (groupFilter) {
        groupFilter.addEventListener('change', function() {
          renderCommitChart(groupFilter.value);
        });
      }
      var chartSortBtns = document.querySelectorAll('.chart-sort-toggle-btn');
      for (var i = 0; i < chartSortBtns.length; i++) {
        chartSortBtns[i].addEventListener('click', function(e) {
          var order = e.currentTarget.getAttribute('data-sort-order');
          if (!order || order === currentChartSortOrder) return;
          currentChartSortOrder = order;
          for (var j = 0; j < chartSortBtns.length; j++) {
            if (chartSortBtns[j].getAttribute('data-sort-order') === order) chartSortBtns[j].classList.add('active');
            else chartSortBtns[j].classList.remove('active');
          }
          document.cookie = 'user_status_chart_sort_order=' + encodeURIComponent(order) + '; Path=/; Max-Age=31536000; SameSite=Lax';
          fetch('/api/settings/status-chart-sort-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ order: order })
          }).catch(function() { /* Cookie 側は手動でも設定済みなので継続描画は問題なし */ });
          renderCommitChart(groupFilter ? groupFilter.value : '');
        });
      }
      var pieGroupFilter = document.getElementById('pieGroupFilter');
      if (pieGroupFilter) {
        pieGroupFilter.addEventListener('change', function() {
          renderPieChart(pieGroupFilter.value);
        });
      }
    })();

    function buildKeySummary(targetId, tablesData) {
      var container = document.getElementById(targetId);
      if (!container) return;
      container.innerHTML = '';
      var keyOrder = ['pk', 'fk', 'uk', 'idx'];
      var keyLabels = { pk: 'PK', fk: 'FK', uk: 'UK', idx: 'IDX' };
      var items = [];
      for (var t = 0; t < tablesData.length; t++) {
        var tbl = tablesData[t];
        for (var c = 0; c < tbl.cols.length; c++) {
          var col = tbl.cols[c];
          if (col.keys.length === 0) continue;
          for (var k = 0; k < col.keys.length; k++) {
            items.push({ key: col.keys[k], col: col.name, table: tbl.name });
          }
        }
      }
      items.sort(function(a, b) {
        var ai = keyOrder.indexOf(a.key), bi = keyOrder.indexOf(b.key);
        if (ai !== bi) return ai - bi;
        if (a.table < b.table) return -1;
        if (a.table > b.table) return 1;
        if (a.col < b.col) return -1;
        if (a.col > b.col) return 1;
        return 0;
      });
      if (items.length === 0) return;
      var title = document.createElement('div');
      title.className = 'uml-key-summary-title';
      title.textContent = 'キー・インデックス一覧 (' + items.length + ' 件)';
      container.appendChild(title);
      var wrap = document.createElement('div');
      wrap.className = 'uml-key-cols';
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var el = document.createElement('span');
        el.className = 'uml-key-col-item';
        var badge = document.createElement('span');
        badge.className = 'kc-badge ' + it.key;
        badge.textContent = keyLabels[it.key] || it.key.toUpperCase();
        el.appendChild(badge);
        var colText = document.createTextNode(' ' + it.col + ' ');
        el.appendChild(colText);
        var tblSpan = document.createElement('span');
        tblSpan.className = 'kc-table';
        tblSpan.textContent = '(' + it.table + ')';
        el.appendChild(tblSpan);
        wrap.appendChild(el);
      }
      container.appendChild(wrap);
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
      elements.title.removeAttribute('style');
      elements.subtitle.textContent = subtitle || '';
      elements.body.className = 'modal-body' + (bodyClassName ? ' ' + bodyClassName : '');
      elements.body.innerHTML = bodyHtml;
      elements.modal.style.zIndex = '3000';
      elements.modal.classList.add('show');
      elements.modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    function closeStatusModal() {
      var elements = getStatusModalElements();
      if (!elements.modal) return;
      elements.modal.classList.remove('show');
      elements.modal.setAttribute('aria-hidden', 'true');
      elements.modal.style.zIndex = '';
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

    function renderCopyableCodeCard(label, code, copyText, execPath, execMethod) {
      var method = (execMethod || 'GET').toUpperCase();
      var methodClass = 'method-' + method.toLowerCase();
      var execButton = execPath
        ? '<button type="button" class="exec-button ' + methodClass + '" data-exec-path="' + escapeHtmlText(execPath) + '" data-exec-method="' + escapeHtmlText(method) + '">' + escapeHtmlText(method) + '</button>'
        : '';
      return '<div class="code-card">'
        + '<div class="code-card-header">'
        + '<div class="code-card-label">' + escapeHtmlText(label) + '</div>'
        + '<div class="code-card-actions">'
        + '<button type="button" class="copy-button" data-copy-text="' + escapeHtmlText(copyText) + '">コピー</button>'
        + execButton
        + '</div>'
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

    function renderExecResultSectionHtml(title, content, startExpanded) {
      var expanded = startExpanded ? 'true' : 'false';
      var collapsedClass = startExpanded ? '' : ' collapsed';
      return '<div class="exec-result-section">'
        + '<div class="exec-result-section-header" role="button" aria-expanded="' + expanded + '">'
        + '<span class="exec-result-section-chevron">&#9654;</span>'
        + '<span>' + escapeHtmlText(title) + '</span>'
        + '</div>'
        + '<div class="exec-result-section-body' + collapsedClass + '">'
        + content
        + '</div>'
        + '</div>';
    }

    function renderExecResult(method, status, statusText, headers, body, elapsed) {
      var isSuccess = status >= 200 && status < 300;
      var badgeClass = isSuccess ? 'success' : 'error';
      var badgeText = status + ' ' + statusText;
      var methodLower = (method || 'GET').toLowerCase();
      var methodBadgeClass = (methodLower === 'get') ? 'get' : 'post';

      // Response headers section
      var headerLines = [];
      if (headers) {
        headers.forEach(function(value, key) {
          headerLines.push(escapeHtmlText(key) + ': ' + escapeHtmlText(value));
        });
      }
      var headersHtml = '<pre>' + (headerLines.length > 0 ? headerLines.join('\\n') : '(none)') + '</pre>';

      // Response body section - try to format JSON
      var bodyHtml = '';
      var parsedJson = null;
      try {
        parsedJson = JSON.parse(body);
      } catch (_e) { /* not json */ }

      if (parsedJson !== null) {
        if (Array.isArray(parsedJson)) {
          // Array: show summary + each item collapsible
          bodyHtml = '<pre style="padding:8px 12px;margin:0;font-size:11px;color:var(--text-muted);">'
            + 'Array (' + parsedJson.length + ' items)</pre>';
          parsedJson.forEach(function(item, index) {
            var itemJson = JSON.stringify(item, null, 2);
            bodyHtml += renderExecResultSectionHtml(
              '[' + index + ']',
              '<pre>' + escapeHtmlText(itemJson) + '</pre>',
              index < 3
            );
          });
        } else if (typeof parsedJson === 'object') {
          // Object: show each top-level key as collapsible
          var keys = Object.keys(parsedJson);
          keys.forEach(function(key) {
            var val = parsedJson[key];
            var isComplex = (typeof val === 'object' && val !== null);
            var valStr = isComplex
              ? JSON.stringify(val, null, 2)
              : JSON.stringify(val);
            var shouldExpand = !isComplex || (Array.isArray(val) && val.length <= 3);
            bodyHtml += renderExecResultSectionHtml(
              key + (Array.isArray(val) ? ' (' + val.length + ')' : ''),
              '<pre>' + escapeHtmlText(valStr) + '</pre>',
              shouldExpand
            );
          });
        }
      } else {
        bodyHtml = '<pre>' + escapeHtmlText(body || '(empty)') + '</pre>';
      }

      return '<div class="exec-collapse-all-row">'
        + '<button type="button" class="exec-collapse-all-button" data-collapse-all="true">すべて閉じる</button>'
        + '</div>'
        + '<div class="exec-result">'
        + '<div class="exec-result-header" role="button" aria-expanded="true">'
        + '<div class="exec-result-summary">'
        + '<span class="exec-result-chevron">&#9654;</span>'
        + '<span class="endpoint-doc-method ' + methodBadgeClass + '">' + escapeHtmlText(method) + '</span>'
        + '<span class="exec-status-badge ' + badgeClass + '">' + badgeText + '</span>'
        + '<span class="exec-result-meta">' + elapsed + 'ms</span>'
        + '</div>'
        + '</div>'
        + '<div class="exec-result-body">'
        + renderExecResultSectionHtml('Response Headers', headersHtml, false)
        + renderExecResultSectionHtml('Response Body', bodyHtml, true)
        + '</div>'
        + '</div>';
    }

    function renderExecError(message) {
      return '<div class="exec-result">'
        + '<div class="exec-result-header" role="button" aria-expanded="true">'
        + '<div class="exec-result-summary">'
        + '<span class="exec-result-chevron">&#9654;</span>'
        + '<span class="exec-status-badge error">ERROR</span>'
        + '</div>'
        + '</div>'
        + '<div class="exec-result-body">'
        + '<pre style="padding:12px;color:#e53e3e;">' + escapeHtmlText(message) + '</pre>'
        + '</div>'
        + '</div>';
    }

    async function handleExecClick(button) {
      var path = button.getAttribute('data-exec-path');
      if (!path) return;
      var method = (button.getAttribute('data-exec-method') || 'GET').toUpperCase();

      // Find or create result container (sibling after the code-card)
      var codeCard = button.closest('.code-card');
      if (!codeCard) return;
      var resultContainer = codeCard.nextElementSibling;
      if (!resultContainer || !resultContainer.classList.contains('exec-result-container')) {
        resultContainer = document.createElement('div');
        resultContainer.className = 'exec-result-container';
        codeCard.parentNode.insertBefore(resultContainer, codeCard.nextSibling);
      }

      button.disabled = true;
      button.classList.add('running');
      var originalText = button.textContent;
      button.textContent = '実行中...';
      resultContainer.innerHTML = '';

      var startTime = Date.now();
      try {
        var fetchOptions = { method: method };
        var response = await fetch(path, fetchOptions);
        var elapsed = Date.now() - startTime;
        var body = await response.text();
        resultContainer.innerHTML = renderExecResult(
          method, response.status, response.statusText, response.headers, body, elapsed
        );
      } catch (err) {
        resultContainer.innerHTML = renderExecError(
          err && err.message ? err.message : 'リクエストに失敗しました'
        );
      } finally {
        button.disabled = false;
        button.classList.remove('running');
        button.textContent = originalText;
      }
    }

    function collapseAllExecResults(container) {
      var sections = container.querySelectorAll('.exec-result-section-header[aria-expanded="true"]');
      sections.forEach(function(header) {
        header.setAttribute('aria-expanded', 'false');
        var body = header.nextElementSibling;
        if (body) body.classList.add('collapsed');
      });
      var resultHeaders = container.querySelectorAll('.exec-result-header[aria-expanded="true"]');
      resultHeaders.forEach(function(header) {
        header.setAttribute('aria-expanded', 'false');
        var body = header.nextElementSibling;
        if (body) body.classList.add('collapsed');
      });
    }

    function renderEndpointDocs(data) {
      var endpoints = [
        {
          method: 'GET',
          path: data.endpoints.migrationDetailPath,
          desc: 'テーブルのマイグレーション詳細を返す。テーブル定義 SQL、クエリ例、関連 API パスを含む JSON レスポンス。',
          response: '{ table, migration, description, migrationSql, queryExample, endpoints }'
        },
        {
          method: 'GET',
          path: data.endpoints.migrationSqlPath,
          desc: 'マイグレーション番号に対応する CREATE TABLE 文の SQL テキストのみを返す。',
          response: '{ migration, sql }'
        },
        {
          method: 'GET',
          path: data.endpoints.tableRowsPath,
          desc: 'テーブルの保存データを最大 20 行までプレビュー表示する。ワークスペース・ユーザーのスコープでフィルタされる。',
          response: '{ table, migration, description, columns, rows, limit }'
        }
      ];

      var itemsHtml = endpoints.map(function(ep) {
        var methodClass = ep.method.toLowerCase();
        return '<div class="endpoint-doc-item">'
          + '<div>'
          + '<span class="endpoint-doc-method ' + methodClass + '">' + escapeHtmlText(ep.method) + '</span>'
          + '<span class="endpoint-doc-path">' + escapeHtmlText(ep.path) + '</span>'
          + '</div>'
          + '<div class="endpoint-doc-desc">' + escapeHtmlText(ep.desc) + '</div>'
          + '<div class="endpoint-doc-response">Response: ' + escapeHtmlText(ep.response) + '</div>'
          + '</div>';
      }).join('');

      return '<div class="endpoint-docs">'
        + '<button type="button" class="endpoint-docs-toggle" aria-expanded="false" data-endpoint-docs-toggle="true">'
        + '<span class="endpoint-docs-chevron">&#9654;</span>'
        + '<span>API エンドポイント仕様</span>'
        + '</button>'
        + '<div class="endpoint-docs-body collapsed">'
        + '<div class="endpoint-docs-content">'
        + itemsHtml
        + '</div>'
        + '</div>'
        + '</div>';
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
        + renderEndpointDocs(data)
        + '</section>'
        + '<section class="panel-block panel-block-secondary">'
        + '<div class="panel-title">右: 読み出し方法</div>'
        + '<div class="panel-stack">'
        + queryBlock
        + renderCopyableCodeCard('curl: migration detail', detailCookieCurl, detailCookieCurl, data.endpoints.migrationDetailPath)
        + renderCopyableCodeCard('curl: migration detail (Bearer)', detailBearerCurl, detailBearerCurl, data.endpoints.migrationDetailPath)
        + renderCopyableCodeCard('curl: migration sql only', migrationSqlCurl, migrationSqlCurl, data.endpoints.migrationSqlPath)
        + renderCopyableCodeCard('curl: table rows preview', rowsCookieCurl, rowsCookieCurl, data.endpoints.tableRowsPath)
        + renderCopyableCodeCard('curl: table rows preview (Bearer)', rowsBearerCurl, rowsBearerCurl, data.endpoints.tableRowsPath)
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

    function isCommitRelatedTable(tableName) {
      if (!tableName) return false;
      if (tableName === 'commit_agent_log') return true;
      return tableName.indexOf('commit_') === 0;
    }

    function formatCellValue(column, value, tableName) {
      if (value && typeof value === 'string') {
        if (column === 'request_id' && (tableName === 'ai_summary_log' || isCommitRelatedTable(tableName))) {
          return '<a href="/ai-summary/' + encodeURIComponent(value) + '" target="_blank" style="color:#6cb4ee;word-break:break-all">' + escapeHtmlText(value) + '</a>';
        }
        if (column === 'summary_request_id' && tableName === 'ai_summary_reviews') {
          return '<a href="/ai-summary/' + encodeURIComponent(value) + '" target="_blank" style="color:#6cb4ee;word-break:break-all">' + escapeHtmlText(value) + '</a>';
        }
      }
      return formatPreviewValue(value);
    }

    function renderColumnKeyBadge(keyType) {
      if (!keyType) return '';
      var s = 'font-size:9px;font-weight:700;padding:0 4px;border-radius:3px;color:#fff;';
      if (keyType === 'pk') return ' <span style="' + s + 'background:#e53e3e">PK</span>';
      if (keyType === 'fk') return ' <span style="' + s + 'background:#ed8936">FK</span>';
      if (keyType === 'pk+fk') return ' <span style="' + s + 'background:#e53e3e">PK</span><span style="' + s + 'background:#ed8936;margin-left:2px">FK</span>';
      if (keyType === 'uk') return ' <span style="' + s + 'background:#48bb78">UK</span>';
      if (keyType === 'idx') return ' <span style="' + s + 'background:#4299e1">IDX</span>';
      return '';
    }

    function getUniqueValues(rows, columnName) {
      var seen = {};
      var result = [];
      for (var i = 0; i < rows.length; i++) {
        var val = rows[i][columnName];
        if (val != null && !seen[val]) {
          seen[val] = true;
          result.push(String(val));
        }
      }
      return result.sort();
    }

    function renderStatusTablePreview(columns, rows, limit, tableName, columnKeyInfo, filterableColumns) {
      if (!rows || rows.length === 0) {
        return '<div class="modal-empty">表示できる保存データがありません</div>';
      }
      var keyInfo = columnKeyInfo || {};
      var filterable = filterableColumns || [];
      var headerHtml = columns.map(function(column) {
        var badge = renderColumnKeyBadge(keyInfo[column]);
        if (filterable.indexOf(column) !== -1) {
          var uniqueVals = getUniqueValues(rows, column);
          var optionsHtml = '<option value="">すべて</option>' + uniqueVals.map(function(v) {
            return '<option value="' + escapeHtmlText(v) + '">' + escapeHtmlText(v) + '</option>';
          }).join('');
          return '<th>' + escapeHtmlText(column) + badge
            + ' <select class="th-filter-select" data-filter-column="' + escapeHtmlText(column) + '" style="font-size:10px;padding:1px 2px;border-radius:3px;border:1px solid #888;background:transparent;color:inherit;cursor:pointer;max-width:80px">'
            + optionsHtml + '</select></th>';
        }
        if (column === 'last_updated_at') {
          var ymThSelectId = 'ym-th-select-' + tableName.replace(/[^a-zA-Z0-9_]/g, '');
          return '<th>' + escapeHtmlText(column) + badge
            + ' <select id="' + escapeHtmlText(ymThSelectId) + '"'
            + ' style="font-size:10px;padding:1px 2px;border-radius:3px;border:1px solid #888;background:transparent;color:inherit;cursor:pointer;max-width:100px">'
            + '<option value="">読み込み中...</option>'
            + '</select></th>';
        }
        return '<th>' + escapeHtmlText(column) + badge + '</th>';
      }).join('');
      var bodyHtml = rows.map(function(row, idx) {
        var dataAttrs = '';
        for (var f = 0; f < filterable.length; f++) {
          var fCol = filterable[f];
          dataAttrs += ' data-filter-' + fCol + '="' + escapeHtmlText(String(row[fCol] != null ? row[fCol] : '')) + '"';
        }
        return '<tr' + dataAttrs + '>' + columns.map(function(column) {
          return '<td>' + formatCellValue(column, row[column], tableName) + '</td>';
        }).join('') + '</tr>';
      }).join('');
      var tableId = 'preview-table-' + tableName.replace(/[^a-zA-Z0-9_]/g, '');
      var html = '<div class="modal-note">最新 ' + escapeHtmlText(String(limit)) + ' 件を表示しています。値は D1 に保存されている内容をそのまま確認しやすい形で表示しています。</div>'
        + '<div class="table-scroll"><table id="' + tableId + '" class="preview-table"><thead><tr>' + headerHtml + '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>';
      return html;
    }

    function bindFilterSelects(tableId) {
      var tbl = document.getElementById(tableId);
      if (!tbl) return;
      var selects = tbl.querySelectorAll('.th-filter-select');
      if (!selects.length) return;
      function applyFilters() {
        var trs = tbl.querySelectorAll('tbody tr');
        for (var i = 0; i < trs.length; i++) {
          var show = true;
          for (var j = 0; j < selects.length; j++) {
            var col = selects[j].getAttribute('data-filter-column');
            var val = selects[j].value;
            if (val && trs[i].getAttribute('data-filter-' + col) !== val) { show = false; break; }
          }
          trs[i].style.display = show ? '' : 'none';
        }
      }
      for (var k = 0; k < selects.length; k++) { selects[k].addEventListener('change', applyFilters); }
    }

    function renderGroupErDiagram(erData) {
      var html = '<div style="display:flex;flex-wrap:wrap;gap:16px;padding:8px">';
      for (var i = 0; i < erData.tables.length; i++) {
        var tbl = erData.tables[i];
        html += '<div style="border:1px solid #555;border-radius:6px;min-width:220px;max-width:320px;flex:1">';
        html += '<div style="padding:6px 10px;font-weight:700;font-size:13px;border-bottom:1px solid #555;background:' + escapeHtmlText(erData.groupColor) + '22;border-radius:6px 6px 0 0">'
          + escapeHtmlText(tbl.tableName)
          + '</div>';
        if (tbl.description) {
          html += '<div style="padding:3px 10px;font-size:11px;color:#888;border-bottom:1px solid #333">' + escapeHtmlText(tbl.description) + '</div>';
        }
        for (var j = 0; j < tbl.columns.length; j++) {
          var col = tbl.columns[j];
          html += '<div style="padding:2px 10px;font-size:12px;display:flex;align-items:center;gap:4px">';
          html += '<code style="font-size:11px">' + escapeHtmlText(col.name) + '</code>';
          html += renderColumnKeyBadge(col.keyType);
          if (col.fkTarget) {
            html += ' <span style="font-size:10px;color:#888">&rarr; ' + escapeHtmlText(col.fkTarget) + '</span>';
          }
          html += '</div>';
        }
        html += '</div>';
      }
      html += '</div>';
      return html;
    }

    function normalizeGroupErToUml(erData) {
      var tableNameSet = {};
      var umlTables = [];
      for (var i = 0; i < erData.tables.length; i++) {
        var srcTable = erData.tables[i];
        tableNameSet[srcTable.tableName] = true;
        var cols = [];
        for (var j = 0; j < srcTable.columns.length; j++) {
          var col = srcTable.columns[j];
          var keys = [];
          if (col.keyType) {
            if (col.keyType.indexOf('+') !== -1) {
              var parts = col.keyType.split('+');
              for (var p = 0; p < parts.length; p++) keys.push(parts[p]);
            } else {
              keys.push(col.keyType);
            }
          }
          // DB制約としてのFKがなくても COLUMN_FK_TARGETS で論理FKが宣言されていれば
          // FK バッジを表示して参照先テーブルとの関係を示す
          if (col.fkTarget && keys.indexOf('fk') === -1) {
            keys.push('fk');
          }
          cols.push({ name: col.name, type: '', keys: keys });
        }
        umlTables.push({ name: srcTable.tableName, cols: cols, x: 0, y: 0 });
      }

      // FK参照先のカラムが参照先テーブルのPK (id) と異なる場合のマッピング
      var fkTargetColMap = {
        'ai_summary_reviews.summary_request_id': 'request_id',
        'commit_agent_log.request_id': 'request_id',
        'ai_summary_link_access_log.request_id': 'request_id',
        'table_column_keys.table_name': 'table_name'
      };

      var umlRelations = [];
      var relationSet = {};
      for (var ti = 0; ti < erData.tables.length; ti++) {
        var tbl = erData.tables[ti];
        for (var ci = 0; ci < tbl.columns.length; ci++) {
          var column = tbl.columns[ci];
          // fkTarget が解決されている列は、keyType に 'fk' が含まれていなくても
          // 論理FK (COLUMN_FK_TARGETS) として関係線を描画する
          if (!column.fkTarget || !tableNameSet[column.fkTarget]) continue;
          var relKey = tbl.tableName + '.' + column.name + '->' + column.fkTarget;
          if (relationSet[relKey]) continue;
          relationSet[relKey] = true;
          var fkColKey = tbl.tableName + '.' + column.name;
          var targetCol = fkTargetColMap[fkColKey] || 'id';
          umlRelations.push([tbl.tableName, column.name, column.fkTarget, targetCol, '多:1']);
        }
      }

      return { tables: umlTables, relations: umlRelations };
    }

    async function openGroupEr(tableName) {
      var title = tableName + ' のグループ ER 図';
      showStatusModalLoading(title, 'グループ情報を取得しています');
      try {
        var response = await fetch('/api/status/tables/' + encodeURIComponent(tableName) + '/group-er');
        if (!response.ok) {
          throw new Error('group er request failed');
        }
        var erData = await response.json();
        var umlData = normalizeGroupErToUml(erData);
        var openFilteredUmlModal = window.openFilteredUmlModal;
        if (typeof openFilteredUmlModal === 'function') {
          closeStatusModal();
          var tableNames = umlData.tables.map(function(tbl) { return tbl.name; });
          openFilteredUmlModal(tableNames, umlData.tables, umlData.relations);
          return;
        }

        openStatusModal(
          erData.groupLabel + ' グループ ER 図',
          tableName + ' が属するグループ「' + erData.groupLabel + '」の全テーブル構造',
          renderGroupErDiagram(erData)
        );
      } catch (_error) {
        showStatusModalError(title, '', 'グループ情報の取得に失敗しました');
      }
    }

    function applyTableGroupColorToModalTitle(tableName) {
      var titleEl = document.getElementById('statusDetailTitle');
      if (!titleEl) return;
      applyUmlHeaderColor(titleEl, tableName);
      titleEl.style.color = 'white';
      titleEl.style.padding = '2px 10px';
      titleEl.style.borderRadius = '5px';
      titleEl.style.display = 'inline-block';
    }

    async function openTablePreview(tableName) {
      var title = tableName + ' の保存データ';
      showStatusModalLoading(title, '最新 20 件を取得しています');
      applyTableGroupColorToModalTitle(tableName);
      try {
        var response = await fetch('/api/status/tables/' + encodeURIComponent(tableName) + '/rows');
        if (!response.ok) {
          throw new Error('table preview request failed');
        }
        var data = await response.json();
        var columns = data.columns || [];
        var groupErButton = '<div style="margin-bottom:8px">'
          + '<button type="button" data-group-er-table="' + escapeHtmlText(tableName) + '" '
          + 'style="font-size:12px;padding:4px 12px;border:1px solid #666;border-radius:4px;background:transparent;color:inherit;cursor:pointer">'
          + 'このテーブルが属するグループのテーブル構造を確認する</button></div>';
        var previewHtml = renderStatusTablePreview(columns, data.rows || [], data.limit || 20, tableName, data.columnKeyInfo || {}, data.filterableColumns || []);
        openStatusModal(
          tableName + ' の保存データ',
          (data.description || '') + (data.migration ? ' / マイグレーション ' + data.migration : ''),
          groupErButton + previewHtml
        );
        applyTableGroupColorToModalTitle(tableName);
        var tableId = 'preview-table-' + tableName.replace(/[^a-zA-Z0-9_]/g, '');
        bindFilterSelects(tableId);
        var erBtn = document.querySelector('[data-group-er-table]');
        if (erBtn) {
          erBtn.addEventListener('click', function() {
            openGroupEr(tableName);
          });
        }
        loadYmSelect(tableName);
      } catch (_error) {
        showStatusModalError(title, '', '保存データの取得に失敗しました');
        applyTableGroupColorToModalTitle(tableName);
      }
    }

    async function loadYmSelect(tableName) {
      var thSelectId = 'ym-th-select-' + tableName.replace(/[^a-zA-Z0-9_]/g, '');
      try {
        var res = await fetch('/api/status/tables/' + encodeURIComponent(tableName) + '/ym-summary');
        if (!res.ok) throw new Error('ym-summary fetch failed');
        var ymData = await res.json();
        var ymList = ymData.ym || [];
        var thSel = document.getElementById(thSelectId);
        if (!thSel) return;
        if (ymList.length === 0) {
          thSel.parentNode && thSel.parentNode.removeChild(thSel);
          return;
        }
        thSel.innerHTML = '<option value="">-- 月を選択 --</option>'
          + ymList.map(function(item) {
            return '<option value="' + escapeHtmlText(item.ym) + '">'
              + escapeHtmlText(String(item.cnt)) + '件 ' + escapeHtmlText(item.ym)
              + '</option>';
          }).join('');
        thSel.addEventListener('change', function() {
          if (thSel.value) openYmCalendarModal(tableName, thSel.value);
        });
      } catch (_e) {
        var thSel = document.getElementById(thSelectId);
        if (thSel && thSel.parentNode) thSel.parentNode.removeChild(thSel);
      }
    }

    async function openYmCalendarModal(tableName, ym) {
      var calModal = document.getElementById('ymCalendarModal');
      var calTitle = document.getElementById('ymCalendarTitle');
      var calSubtitle = document.getElementById('ymCalendarSubtitle');
      var calBody = document.getElementById('ymCalendarBody');
      if (!calModal || !calTitle || !calBody) return;
      calTitle.textContent = ym + ' カレンダー';
      if (calSubtitle) calSubtitle.textContent = tableName + ' の last_updated_at 日別件数';
      if (calBody) calBody.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">読み込み中...</div>';
      calModal.classList.add('show');
      calModal.setAttribute('aria-hidden', 'false');
      try {
        var res = await fetch('/api/status/tables/' + encodeURIComponent(tableName) + '/calendar?ym=' + encodeURIComponent(ym));
        if (!res.ok) throw new Error('calendar fetch failed');
        var calData = await res.json();
        if (calBody) calBody.innerHTML = renderYmCalendar(ym, calData.days || []);
      } catch (_e) {
        if (calBody) calBody.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">カレンダーデータの取得に失敗しました</div>';
      }
    }

    function renderYmCalendar(ym, days) {
      var parts = ym.split('-');
      var year = parseInt(parts[0], 10);
      var month = parseInt(parts[1], 10);
      var daysInMonth = new Date(year, month, 0).getDate();
      var firstDow = new Date(year, month - 1, 1).getDay();

      var dayCountMap = {};
      for (var i = 0; i < days.length; i++) {
        dayCountMap[parseInt(days[i].day, 10)] = days[i].cnt;
      }
      var maxCount = 0;
      for (var d in dayCountMap) {
        if (dayCountMap[d] > maxCount) maxCount = dayCountMap[d];
      }

      function heatLevel(cnt) {
        if (!cnt || cnt === 0) return 0;
        if (maxCount <= 0) return 1;
        var ratio = cnt / maxCount;
        if (ratio <= 0.25) return 1;
        if (ratio <= 0.5) return 2;
        if (ratio <= 0.75) return 3;
        return 4;
      }

      var dayHeaders = ['日', '月', '火', '水', '木', '金', '土'];
      var html = '<div class="ym-cal-grid">';
      for (var h = 0; h < 7; h++) {
        var hClass = h === 0 ? 'sun' : (h === 6 ? 'sat' : '');
        html += '<div class="ym-cal-day-header ' + hClass + '">' + dayHeaders[h] + '</div>';
      }
      for (var pre = 0; pre < firstDow; pre++) {
        html += '<div class="ym-cal-cell empty"></div>';
      }
      for (var day = 1; day <= daysInMonth; day++) {
        var dow = (firstDow + day - 1) % 7;
        var cnt = dayCountMap[day] || 0;
        var level = heatLevel(cnt);
        var dateClass = dow === 0 ? 'sun' : (dow === 6 ? 'sat' : '');
        html += '<div class="ym-cal-cell heat' + level + '">'
          + '<div class="ym-cal-cell-date ' + dateClass + '">' + day + '</div>'
          + (cnt > 0 ? '<div class="ym-cal-cell-count">' + cnt + '</div>' : '')
          + '</div>';
      }
      html += '</div>';
      return html;
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
        var repoName = uniqueOwner ? escapeHtmlText(entry.repo) : escapeHtmlText(entry.owner) + '/' + escapeHtmlText(entry.repo);
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

          // Collapse all button handler
          var collapseAllBtn = target.closest('[data-collapse-all]');
          if (collapseAllBtn) {
            var resultContainer = collapseAllBtn.closest('.exec-result-container');
            if (resultContainer) {
              collapseAllExecResults(resultContainer);
            }
            return;
          }

          // Endpoint docs toggle handler
          var docsToggle = target.closest('[data-endpoint-docs-toggle]');
          if (docsToggle) {
            var dExpanded = docsToggle.getAttribute('aria-expanded') === 'true';
            docsToggle.setAttribute('aria-expanded', dExpanded ? 'false' : 'true');
            var docsBody = docsToggle.nextElementSibling;
            if (docsBody && docsBody.classList.contains('endpoint-docs-body')) {
              docsBody.classList.toggle('collapsed');
            }
            return;
          }

          // Exec button handler
          var execButton = target.closest('[data-exec-path]');
          if (execButton) {
            handleExecClick(execButton);
            return;
          }

          // Collapsible exec result header toggle
          var resultHeader = target.closest('.exec-result-header');
          if (resultHeader) {
            var expanded = resultHeader.getAttribute('aria-expanded') === 'true';
            resultHeader.setAttribute('aria-expanded', expanded ? 'false' : 'true');
            var resultBody = resultHeader.nextElementSibling;
            if (resultBody && resultBody.classList.contains('exec-result-body')) {
              resultBody.classList.toggle('collapsed');
            }
            return;
          }

          // Collapsible exec result section toggle
          var sectionHeader = target.closest('.exec-result-section-header');
          if (sectionHeader) {
            var sExpanded = sectionHeader.getAttribute('aria-expanded') === 'true';
            sectionHeader.setAttribute('aria-expanded', sExpanded ? 'false' : 'true');
            var sectionBody = sectionHeader.nextElementSibling;
            if (sectionBody && sectionBody.classList.contains('exec-result-section-body')) {
              sectionBody.classList.toggle('collapsed');
            }
            return;
          }

          // Copy button handler
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
          var calMod = document.getElementById('ymCalendarModal');
          if (calMod && calMod.classList.contains('show')) {
            calMod.classList.remove('show');
            calMod.setAttribute('aria-hidden', 'true');
            return;
          }
          closeStatusModal();
        }
      });
      (function() {
        var calModal = document.getElementById('ymCalendarModal');
        var calClose = document.getElementById('ymCalendarClose');
        if (calClose) {
          calClose.addEventListener('click', function() {
            if (calModal) { calModal.classList.remove('show'); calModal.setAttribute('aria-hidden', 'true'); }
          });
        }
        if (calModal) {
          calModal.addEventListener('click', function(e) {
            if (e.target === calModal) { calModal.classList.remove('show'); calModal.setAttribute('aria-hidden', 'true'); }
          });
        }
      })();
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
      var openCommitAgentLogButton = document.getElementById('openCommitAgentLogButton');
      if (openCommitAgentLogButton) {
        openCommitAgentLogButton.addEventListener('click', function() {
          openTablePreview('commit_agent_log');
        });
      }
      var groupFilterSelect = document.getElementById('groupFilterSelect');
      var migrationSortTh = document.getElementById('migrationSortTh');
      var tableNameSortTh = document.getElementById('tableNameSortTh');
      var rowCountSortTh = document.getElementById('rowCountSortTh');
      var groupSortState = 'none';
      var migrationSortState = 'none';
      var tableNameSortState = 'none';
      var rowCountSortState = 'none';

      function getStatusTableRows() {
        if (!statusTablesTable) return [];
        return Array.prototype.slice.call(statusTablesTable.querySelectorAll('tbody tr'));
      }

      function applyGroupFilter() {
        var filterVal = groupFilterSelect ? groupFilterSelect.value : '';
        var rows = getStatusTableRows();
        for (var i = 0; i < rows.length; i++) {
          var gid = rows[i].getAttribute('data-group-id');
          rows[i].style.display = (!filterVal || gid === filterVal) ? '' : 'none';
        }
      }

      function sortTableRows(attr, direction) {
        if (!statusTablesTable) return;
        var tbody = statusTablesTable.querySelector('tbody');
        if (!tbody) return;
        var rows = getStatusTableRows();
        rows.sort(function(a, b) {
          var va = parseInt(a.getAttribute(attr) || '0', 10);
          var vb = parseInt(b.getAttribute(attr) || '0', 10);
          return direction === 'asc' ? va - vb : vb - va;
        });
        for (var i = 0; i < rows.length; i++) {
          tbody.appendChild(rows[i]);
        }
        applyGroupFilter();
      }

      function sortTableRowsByString(attr, direction) {
        if (!statusTablesTable) return;
        var tbody = statusTablesTable.querySelector('tbody');
        if (!tbody) return;
        var rows = getStatusTableRows();
        rows.sort(function(a, b) {
          var va = (a.getAttribute(attr) || '').toLowerCase();
          var vb = (b.getAttribute(attr) || '').toLowerCase();
          if (va < vb) return direction === 'asc' ? -1 : 1;
          if (va > vb) return direction === 'asc' ? 1 : -1;
          return 0;
        });
        for (var i = 0; i < rows.length; i++) {
          tbody.appendChild(rows[i]);
        }
        applyGroupFilter();
      }

      if (groupFilterSelect) {
        groupFilterSelect.addEventListener('change', function() {
          applyGroupFilter();
          if (groupFilterSelect.value) {
            groupSortState = groupSortState === 'none' ? 'asc' : groupSortState;
          }
        });
      }

      if (migrationSortTh) {
        migrationSortTh.addEventListener('click', function() {
          migrationSortState = migrationSortState === 'asc' ? 'desc' : 'asc';
          migrationSortTh.textContent = 'マイグレーション ' + (migrationSortState === 'asc' ? '↑' : '↓');
          if (tableNameSortTh) tableNameSortTh.textContent = 'テーブル名 ⇅';
          if (rowCountSortTh) rowCountSortTh.textContent = 'レコード数 ⇅';
          tableNameSortState = 'none';
          rowCountSortState = 'none';
          sortTableRows('data-migration-num', migrationSortState);
        });
      }

      if (tableNameSortTh) {
        tableNameSortTh.addEventListener('click', function() {
          tableNameSortState = tableNameSortState === 'asc' ? 'desc' : 'asc';
          tableNameSortTh.textContent = 'テーブル名 ' + (tableNameSortState === 'asc' ? '↑' : '↓');
          if (migrationSortTh) migrationSortTh.textContent = 'マイグレーション ⇅';
          if (rowCountSortTh) rowCountSortTh.textContent = 'レコード数 ⇅';
          migrationSortState = 'none';
          rowCountSortState = 'none';
          sortTableRowsByString('data-table-name', tableNameSortState);
        });
      }

      if (rowCountSortTh) {
        rowCountSortTh.addEventListener('click', function() {
          rowCountSortState = rowCountSortState === 'asc' ? 'desc' : 'asc';
          rowCountSortTh.textContent = 'レコード数 ' + (rowCountSortState === 'asc' ? '↑' : '↓');
          if (migrationSortTh) migrationSortTh.textContent = 'マイグレーション ⇅';
          if (tableNameSortTh) tableNameSortTh.textContent = 'テーブル名 ⇅';
          migrationSortState = 'none';
          tableNameSortState = 'none';
          sortTableRows('data-row-count', rowCountSortState);
        });
      }

      checkUnclassifiedTableWarnings();

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

    // UML ER図モーダル
    (function() {
      var umlModal = document.getElementById('umlModal');
      var umlCloseBtn = document.getElementById('umlModalClose');
      var openUmlBtn = document.getElementById('openUmlButton');
      var refreshUmlBtn = document.getElementById('refreshUmlButton');
      var umlWrapper = document.getElementById('umlCanvasWrapper');
      if (!umlModal || !umlWrapper || !openUmlBtn) return;

      var umlRendered = false;
      var UML_VIEW_MODE_KEY = 'er-uml-view-mode';

      function getUmlViewMode() {
        var v = null;
        try { v = localStorage.getItem(UML_VIEW_MODE_KEY); } catch (_e) {}
        return v === 'focus' ? 'focus' : 'overview';
      }

      function updateUmlViewToggleButtons() {
        var mode = getUmlViewMode();
        var focusBtn = document.getElementById('umlViewModeFocus');
        var overviewBtn = document.getElementById('umlViewModeOverview');
        if (focusBtn) focusBtn.classList.toggle('active', mode === 'focus');
        if (overviewBtn) overviewBtn.classList.toggle('active', mode === 'overview');
      }

      function applyUmlViewMode(mode) {
        if (typeof window.__umlApplyViewMode === 'function') {
          window.__umlApplyViewMode(mode);
        }
      }

      function setUmlViewMode(mode) {
        if (mode !== 'focus' && mode !== 'overview') return;
        try { localStorage.setItem(UML_VIEW_MODE_KEY, mode); } catch (_e) {}
        updateUmlViewToggleButtons();
        applyUmlViewMode(mode);
      }

      var umlFocusBtnEl = document.getElementById('umlViewModeFocus');
      var umlOverviewBtnEl = document.getElementById('umlViewModeOverview');
      if (umlFocusBtnEl) umlFocusBtnEl.addEventListener('click', function() { setUmlViewMode('focus'); });
      if (umlOverviewBtnEl) umlOverviewBtnEl.addEventListener('click', function() { setUmlViewMode('overview'); });
      updateUmlViewToggleButtons();

      function openUmlModal() {
        umlModal.classList.add('show');
        umlModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        if (!umlRendered) {
          var wrapper = document.getElementById('umlCanvasWrapper');
          if (wrapper) {
            wrapper.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-secondary)">ER図を読み込み中...</div>';
          }
          fetch('/api/status/schema')
            .then(function(res) { return res.json(); })
            .then(function(schemaData) {
              if (schemaData.tables && schemaData.relations) {
                layoutTablesRelational(schemaData.tables, schemaData.relations);
                tables = schemaData.tables;
                relations = schemaData.relations;
                window.__erTables = tables;
                window.__erRelations = relations;
              }
              if (wrapper) wrapper.innerHTML = '';
              renderErDiagram(tables, relations);
              buildKeySummary('umlKeySummary', tables);
              if (window.__refreshColList) window.__refreshColList(tables);
              umlRendered = true;
              setTimeout(function() { applyUmlViewMode(getUmlViewMode()); }, 50);
            })
            .catch(function() {
              if (wrapper) wrapper.innerHTML = '';
              renderErDiagram(tables, relations);
              buildKeySummary('umlKeySummary', tables);
              umlRendered = true;
              setTimeout(function() { applyUmlViewMode(getUmlViewMode()); }, 50);
            });
        }
        updateUmlViewToggleButtons();
        if (umlRendered) {
          setTimeout(function() { applyUmlViewMode(getUmlViewMode()); }, 50);
        }
      }

      if (refreshUmlBtn) {
        refreshUmlBtn.addEventListener('click', function() {
          refreshUmlBtn.disabled = true;
          var svgIcon = refreshUmlBtn.querySelector('svg');
          if (svgIcon) svgIcon.classList.add('spin');
          var origText = refreshUmlBtn.lastChild;
          if (origText) origText.textContent = ' 取得中...';

          fetch('/api/status/schema')
            .then(function(res) { return res.json(); })
            .then(function(data) {
              if (data.tables && data.relations) {
                layoutTablesRelational(data.tables, data.relations);
                tables = data.tables;
                relations = data.relations;
                window.__erTables = tables;
                window.__erRelations = relations;
                renderErDiagram(tables, relations);
                buildKeySummary('umlKeySummary', tables);
                umlRendered = true;
                if (window.__refreshColList) window.__refreshColList(tables);
                setTimeout(function() { applyUmlViewMode(getUmlViewMode()); }, 50);

                if (umlModal.classList.contains('show')) {
                  // already open
                } else {
                  openUmlModal();
                }
              }
            })
            .catch(function(err) {
              console.error('Schema fetch failed', err);
            })
            .finally(function() {
              refreshUmlBtn.disabled = false;
              if (svgIcon) svgIcon.classList.remove('spin');
              if (origText) origText.textContent = ' 手動で更新する';
            });
        });
      }

      function closeUmlModal() {
        umlModal.classList.remove('show');
        umlModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
      }

      openUmlBtn.addEventListener('click', openUmlModal);
      if (umlCloseBtn) umlCloseBtn.addEventListener('click', closeUmlModal);
      umlModal.addEventListener('click', function(e) { if (e.target === umlModal) closeUmlModal(); });
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && umlModal.classList.contains('show')) closeUmlModal();
        if (e.key === 'Escape') { closeUmlExportPosModal(); closeUmlImportPosModal(); }
      });

      // ===== 座標出力モーダル =====
      var umlExportPosModal = document.getElementById('umlExportPosModal');
      var umlImportPosModal = document.getElementById('umlImportPosModal');

      function getUmlCurrentPositionsJson() {
        var rects = window.__umlCardRects;
        var names = window.__umlTableNames;
        if (!rects || !names) return '{}';
        var m = document.cookie.match('(^|;)\\s*er_json_include_group=([^;]*)');
        var includeGroup = m ? decodeURIComponent(m[2]) !== 'off' : true;
        var out = {};
        names.forEach(function(n) {
          var r = rects[n];
          if (!r) return;
          var entry = { x: Math.round(r.x), y: Math.round(r.y) };
          if (includeGroup) {
            var gVal = tableGroupMap[n];
            if (gVal) {
              var keys = gVal.split(',').map(function(k) { return k.trim(); }).filter(Boolean);
              var colors = keys.map(function(k) { return groupColors[k] || '#8b949e'; });
              entry.groups = keys;
              entry.colors = colors;
            }
          }
          out[n] = entry;
        });
        return JSON.stringify(out, null, 2);
      }

      function closeUmlExportPosModal() {
        if (umlExportPosModal) umlExportPosModal.classList.remove('show');
      }

      function closeUmlImportPosModal() {
        if (umlImportPosModal) umlImportPosModal.classList.remove('show');
      }

      var exportPosBtn = document.getElementById('umlExportPosBtn');
      if (exportPosBtn) {
        exportPosBtn.addEventListener('click', function() {
          var ta = document.getElementById('umlExportPosTextarea');
          if (ta) ta.value = getUmlCurrentPositionsJson();
          var copyBtn = document.getElementById('umlExportPosCopyBtn');
          if (copyBtn) copyBtn.textContent = 'コピー';
          if (umlExportPosModal) umlExportPosModal.classList.add('show');
        });
      }

      var exportPosCopyBtn = document.getElementById('umlExportPosCopyBtn');
      if (exportPosCopyBtn) {
        exportPosCopyBtn.addEventListener('click', function() {
          var ta = document.getElementById('umlExportPosTextarea');
          if (!ta) return;
          navigator.clipboard.writeText(ta.value).then(function() {
            exportPosCopyBtn.textContent = 'コピーしました ✓';
            setTimeout(function() { exportPosCopyBtn.textContent = 'コピー'; }, 2000);
          }).catch(function() { ta.select(); document.execCommand('copy'); });
        });
      }

      var exportPosCloseBtn = document.getElementById('umlExportPosCloseBtn');
      if (exportPosCloseBtn) exportPosCloseBtn.addEventListener('click', closeUmlExportPosModal);
      var exportPosCloseX = document.getElementById('umlExportPosClose');
      if (exportPosCloseX) exportPosCloseX.addEventListener('click', closeUmlExportPosModal);
      if (umlExportPosModal) umlExportPosModal.addEventListener('click', function(e) {
        if (e.target === umlExportPosModal) closeUmlExportPosModal();
      });

      // ===== 座標入力モーダル =====
      var importPosBtn = document.getElementById('umlImportPosBtn');
      if (importPosBtn) {
        importPosBtn.addEventListener('click', function() {
          var ta = document.getElementById('umlImportPosTextarea');
          var fb = document.getElementById('umlImportPosFeedback');
          if (ta) { ta.value = ''; ta.className = 'uml-pos-textarea'; }
          if (fb) { fb.textContent = ''; fb.className = 'uml-pos-feedback'; }
          if (umlImportPosModal) umlImportPosModal.classList.add('show');
          if (ta) setTimeout(function() { ta.focus(); }, 50);
        });
      }

      function validateUmlPositionJson(text) {
        if (!text.trim()) return { ok: false, error: 'JSONが入力されていません' };
        var parsed;
        try { parsed = JSON.parse(text); } catch (e) {
          return { ok: false, error: 'JSONの構文エラー: ' + e.message };
        }
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          return { ok: false, error: 'JSONはオブジェクト形式 { "テーブル名": { "x": 数値, "y": 数値 }, ... } で入力してください' };
        }
        var tableNames = window.__umlTableNames || [];
        var unknownTables = [];
        var invalidEntries = [];
        Object.keys(parsed).forEach(function(key) {
          var val = parsed[key];
          if (tableNames.indexOf(key) === -1) {
            unknownTables.push(key);
          } else if (
            typeof val !== 'object' || val === null ||
            typeof val.x !== 'number' || typeof val.y !== 'number' ||
            !isFinite(val.x) || !isFinite(val.y)
          ) {
            invalidEntries.push(key);
          }
        });
        if (invalidEntries.length > 0) {
          return { ok: false, error: '以下のエントリで x / y が数値ではありません: ' + invalidEntries.join(', ') };
        }
        var matchedCount = Object.keys(parsed).filter(function(k) { return tableNames.indexOf(k) !== -1; }).length;
        if (matchedCount === 0) {
          return { ok: false, error: '既知のテーブル名と一致するエントリがありません。テーブル名を確認してください' };
        }
        return { ok: true, data: parsed, unknownTables: unknownTables, matchedCount: matchedCount };
      }

      var importPosApplyBtn = document.getElementById('umlImportPosApplyBtn');
      if (importPosApplyBtn) {
        importPosApplyBtn.addEventListener('click', function() {
          var ta = document.getElementById('umlImportPosTextarea');
          var fb = document.getElementById('umlImportPosFeedback');
          if (!ta || !fb) return;
          var result = validateUmlPositionJson(ta.value);
          if (!result.ok) {
            fb.textContent = '⚠ ' + result.error;
            fb.className = 'uml-pos-feedback pos-error';
            ta.className = 'uml-pos-textarea pos-error';
            ta.focus();
            return;
          }
          ta.className = 'uml-pos-textarea';
          var rects = window.__umlCardRects;
          var elements = window.__umlCardElements;
          var draw = window.__umlDrawRelations;
          if (!rects || !elements || !draw) {
            fb.textContent = '⚠ ER図がまだ描画されていません。先にER図を開いてください';
            fb.className = 'uml-pos-feedback pos-error';
            return;
          }
          Object.keys(result.data).forEach(function(name) {
            if (rects[name]) {
              rects[name].x = result.data[name].x;
              rects[name].y = result.data[name].y;
              if (elements[name]) {
                elements[name].style.left = result.data[name].x + 'px';
                elements[name].style.top = result.data[name].y + 'px';
              }
            }
          });
          draw();
          var warnMsg = result.unknownTables.length > 0
            ? '⚠ 不明なテーブル名（スキップ）: ' + result.unknownTables.join(', ')
            : '';
          if (warnMsg) {
            fb.textContent = warnMsg;
            fb.className = 'uml-pos-feedback pos-warn';
          } else {
            fb.textContent = '✓ ' + result.matchedCount + ' 件のエンティティ座標を適用しました';
            fb.className = 'uml-pos-feedback pos-ok';
            setTimeout(closeUmlImportPosModal, 1200);
          }
        });
      }

      var importPosCancelBtn = document.getElementById('umlImportPosCancelBtn');
      if (importPosCancelBtn) importPosCancelBtn.addEventListener('click', closeUmlImportPosModal);
      var importPosCloseX = document.getElementById('umlImportPosClose');
      if (importPosCloseX) importPosCloseX.addEventListener('click', closeUmlImportPosModal);
      if (umlImportPosModal) umlImportPosModal.addEventListener('click', function(e) {
        if (e.target === umlImportPosModal) closeUmlImportPosModal();
      });

      // ===== グループ凡例 =====
      (function() {
        function getUmlLegendVisible() {
          var m = document.cookie.match('(^|;)\\\\s*er_legend_visible=([^;]*)');
          return m ? decodeURIComponent(m[2]) !== 'off' : true;
        }

        function setUmlLegendVisible(visible) {
          document.cookie = 'er_legend_visible=' + (visible ? 'on' : 'off') + '; Path=/; Secure; SameSite=Lax; Max-Age=31536000';
          applyUmlLegendVisible(visible);
        }

        function applyUmlLegendVisible(visible) {
          ['umlGroupLegendItems', 'filteredUmlGroupLegendItems'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.style.display = visible ? '' : 'none';
          });
          ['umlGroupLegendArrow', 'filteredUmlGroupLegendArrow'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.textContent = visible ? '▲' : '▼';
          });
        }

        function expandByFk(primarySet) {
          var expanded = {};
          Object.keys(primarySet).forEach(function(t) { expanded[t] = true; });
          var changed = true;
          while (changed) {
            changed = false;
            for (var i = 0; i < tableFkPairs.length; i++) {
              var from = tableFkPairs[i][0], to = tableFkPairs[i][1];
              if (expanded[from] && !expanded[to]) { expanded[to] = true; changed = true; }
              if (expanded[to] && !expanded[from]) { expanded[from] = true; changed = true; }
            }
          }
          return Object.keys(expanded);
        }

        function buildUmlLegendItems(containerId) {
          var container = document.getElementById(containerId);
          if (!container || container.children.length > 0) return;

          // 「すべて」行
          var allRow = document.createElement('div');
          allRow.className = 'uml-group-legend-row';
          var allSwatch = document.createElement('div');
          allSwatch.className = 'uml-group-legend-swatch';
          allSwatch.style.background = 'linear-gradient(135deg,#388bfd,#3fb950,#d29922,#f85149,#a371f7)';
          var allName = document.createElement('span');
          allName.className = 'uml-group-legend-name';
          allName.textContent = 'すべて';
          allRow.appendChild(allSwatch);
          allRow.appendChild(allName);
          allRow.addEventListener('click', function(e) {
            e.stopPropagation();
            var allNames = (window.__erTables || []).map(function(t) { return t.name; });
            if (allNames.length === 0) allNames = Object.keys(tableGroupMap);
            var openFn = window.openFilteredUmlModal;
            if (typeof openFn === 'function') {
              openFn(allNames, window.__erTables || [], window.__erRelations || []);
            }
          });
          container.appendChild(allRow);

          Object.keys(groupColors).forEach(function(key) {
            var row = document.createElement('div');
            row.className = 'uml-group-legend-row';
            var swatch = document.createElement('div');
            swatch.className = 'uml-group-legend-swatch';
            swatch.style.background = groupColors[key];
            var name = document.createElement('span');
            name.className = 'uml-group-legend-name';
            name.textContent = groupLabels[key] || key;
            var code = document.createElement('span');
            code.className = 'uml-group-legend-code';
            code.textContent = groupColors[key];
            row.appendChild(swatch);
            row.appendChild(name);
            row.appendChild(code);
            row.addEventListener('click', function(e) {
              e.stopPropagation();
              var primarySet = {};
              if (key === 'undefined') {
                (window.__erTables || []).forEach(function(t) {
                  if (!tableGroupMap[t.name]) primarySet[t.name] = true;
                });
              } else {
                Object.keys(tableGroupMap).forEach(function(t) {
                  var gVal = tableGroupMap[t];
                  if (!gVal) return;
                  if (gVal.split(',').map(function(k) { return k.trim(); }).indexOf(key) !== -1) {
                    primarySet[t] = true;
                  }
                });
              }
              var expandedNames = expandByFk(primarySet);
              if (expandedNames.length === 0) return;
              var openFn = window.openFilteredUmlModal;
              if (typeof openFn === 'function') {
                openFn(expandedNames, window.__erTables || [], window.__erRelations || []);
              }
            });
            container.appendChild(row);
          });
        }

        buildUmlLegendItems('umlGroupLegendItems');
        buildUmlLegendItems('filteredUmlGroupLegendItems');
        applyUmlLegendVisible(getUmlLegendVisible());

        ['umlGroupLegendHeader', 'filteredUmlGroupLegendHeader'].forEach(function(id) {
          var header = document.getElementById(id);
          if (header) {
            header.addEventListener('click', function(e) {
              e.stopPropagation();
              setUmlLegendVisible(!getUmlLegendVisible());
            });
          }
        });
      })();

      // テーブル定義
      window.__erTables = null;
      var tables = [
        {
          name: 'teams', x: 80, y: 40, cols: [
            { name: 'id', type: 'TEXT', keys: ['pk'] },
            { name: 'name', type: 'TEXT', keys: [] },
            { name: 'created_at', type: 'TEXT', keys: [] }
          ]
        },
        {
          name: 'workspaces', x: 80, y: 260, cols: [
            { name: 'id', type: 'TEXT', keys: ['pk'] },
            { name: 'team_id', type: 'TEXT', keys: ['fk'] },
            { name: 'name', type: 'TEXT', keys: [] },
            { name: 'created_at', type: 'TEXT', keys: [] }
          ]
        },
        {
          name: 'team_members', x: 350, y: 40, cols: [
            { name: 'team_id', type: 'TEXT', keys: ['pk', 'fk'] },
            { name: 'user_id', type: 'TEXT', keys: ['pk'] },
            { name: 'role', type: 'TEXT', keys: [] },
            { name: 'joined_at', type: 'TEXT', keys: [] }
          ]
        },
        {
          name: 'user_sessions', x: 600, y: 40, cols: [
            { name: 'id', type: 'INTEGER', keys: ['pk'] },
            { name: 'user_id', type: 'TEXT', keys: ['uk'] },
            { name: 'current_workspace_id', type: 'TEXT', keys: ['fk'] },
            { name: 'timezone', type: 'TEXT', keys: [] },
            { name: 'session_duration', type: 'TEXT', keys: [] },
            { name: 'display_name', type: 'TEXT', keys: [] },
            { name: 'github_access_token', type: 'TEXT', keys: [] },
            { name: 'last_login_at', type: 'TEXT', keys: [] },
            { name: 'current_login_at', type: 'TEXT', keys: [] },
            { name: 'updated_at', type: 'TEXT', keys: [] }
          ]
        },
        {
          name: 'commit_calendar_cache', x: 350, y: 260, cols: [
            { name: 'id', type: 'INTEGER', keys: ['pk'] },
            { name: 'workspace_id', type: 'TEXT', keys: ['fk', 'uk'] },
            { name: 'owner', type: 'TEXT', keys: ['uk'] },
            { name: 'repo', type: 'TEXT', keys: ['uk'] },
            { name: 'year', type: 'INTEGER', keys: ['uk'] },
            { name: 'month', type: 'INTEGER', keys: ['uk'] },
            { name: 'user_id', type: 'TEXT', keys: [] },
            { name: 'counts', type: 'TEXT (JSON)', keys: [] },
            { name: 'cached_at', type: 'TEXT', keys: [] }
          ]
        },
        {
          name: 'commit_list_cache', x: 350, y: 540, cols: [
            { name: 'workspace_id', type: 'TEXT', keys: ['fk', 'uk'] },
            { name: 'owner', type: 'TEXT', keys: ['uk'] },
            { name: 'repo', type: 'TEXT', keys: ['uk'] },
            { name: 'date', type: 'TEXT', keys: ['uk'] },
            { name: 'commits_json', type: 'TEXT (JSON)', keys: [] },
            { name: 'commit_count', type: 'INTEGER', keys: [] },
            { name: 'cached_at', type: 'TEXT', keys: [] }
          ]
        },
        {
          name: 'cache_stats', x: 600, y: 400, cols: [
            { name: 'user_id', type: 'TEXT', keys: ['uk'] },
            { name: 'owner', type: 'TEXT', keys: ['uk'] },
            { name: 'repo', type: 'TEXT', keys: ['uk'] },
            { name: 'github_fetch_count', type: 'INTEGER', keys: [] },
            { name: 'cache_save_count', type: 'INTEGER', keys: [] },
            { name: 'cache_lookup_count', type: 'INTEGER', keys: [] },
            { name: 'cache_hit_count', type: 'INTEGER', keys: [] },
            { name: 'last_updated_at', type: 'TEXT', keys: [] }
          ]
        },
        {
          name: 'installation_permissions', x: 870, y: 40, cols: [
            { name: 'id', type: 'INTEGER', keys: ['pk'] },
            { name: 'installation_id', type: 'INTEGER', keys: ['uk'] },
            { name: 'repo_name', type: 'TEXT', keys: ['uk'] },
            { name: 'repository_selection', type: 'TEXT', keys: [] },
            { name: 'permissions', type: 'TEXT (JSON)', keys: [] },
            { name: 'updated_at', type: 'TEXT', keys: ['idx'] }
          ]
        },
        { name: 'column_concepts', x: 1150, y: 40,  cols: [] },
        { name: 'repo_cache',      x: 1150, y: 200, cols: [] },
        { name: 'user_cache',      x: 1150, y: 360, cols: [] }
      ];

      // リレーション定義: [fromTable, fromCol, toTable, toCol, label]
      var relations = [
        ['workspaces', 'team_id', 'teams', 'id', '多:1'],
        ['team_members', 'team_id', 'teams', 'id', '多:1'],
        ['user_sessions', 'current_workspace_id', 'workspaces', 'id', '多:1'],
        ['commit_calendar_cache', 'workspace_id', 'workspaces', 'id', '多:1'],
        ['commit_list_cache', 'workspace_id', 'workspaces', 'id', '多:1']
      ];

      window.__erTables = tables;
      window.__erRelations = relations;

      function layoutTablesRelational(tbls, rels) {
        var adj = {};
        for (var i = 0; i < tbls.length; i++) adj[tbls[i].name] = [];
        for (var r = 0; r < rels.length; r++) {
          var from = rels[r][0], to = rels[r][2];
          if (adj[from]) adj[from].push(to);
          if (adj[to]) adj[to].push(from);
        }
        var tblByName = {};
        for (var i = 0; i < tbls.length; i++) tblByName[tbls[i].name] = tbls[i];

        var scored = tbls.map(function(t) {
          return { name: t.name, score: (adj[t.name] || []).length };
        });
        scored.sort(function(a, b) { return b.score - a.score; });

        var placed = {};
        var colWidth = 260;
        var rowGap = 30;

        function estimateHeight(t) { return 34 + t.cols.length * 22 + 8; }

        var layers = [];
        var visited = {};

        function bfs(startName) {
          var queue = [startName];
          visited[startName] = true;
          var layerIdx = layers.length;
          while (queue.length > 0) {
            var nextQueue = [];
            if (!layers[layerIdx]) layers[layerIdx] = [];
            for (var q = 0; q < queue.length; q++) {
              var name = queue[q];
              layers[layerIdx].push(name);
              var neighbors = adj[name] || [];
              for (var n = 0; n < neighbors.length; n++) {
                if (!visited[neighbors[n]]) {
                  visited[neighbors[n]] = true;
                  nextQueue.push(neighbors[n]);
                }
              }
            }
            layerIdx++;
            queue = nextQueue;
          }
        }

        for (var s = 0; s < scored.length; s++) {
          if (!visited[scored[s].name]) bfs(scored[s].name);
        }

        var currentX = 40;
        for (var l = 0; l < layers.length; l++) {
          var layer = layers[l];
          var currentY = 40;
          var maxW = 0;
          for (var m = 0; m < layer.length; m++) {
            var tbl = tblByName[layer[m]];
            if (!tbl) continue;
            var w = getTableCardWidth(tbl);
            var h = estimateHeight(tbl);
            tbl.x = currentX;
            tbl.y = currentY;
            currentY += h + rowGap;
            if (w > maxW) maxW = w;
          }
          currentX += maxW + 60;
        }
      }

      function getTableCardWidth(table) {
        var maxLen = table.name.length;
        for (var i = 0; i < table.cols.length; i++) {
          var len = table.cols[i].name.length + table.cols[i].type.length + table.cols[i].keys.length * 3 + 2;
          if (len > maxLen) maxLen = len;
        }
        return Math.max(180, Math.min(240, maxLen * 8 + 40));
      }

      function getTableCardHeight(table) {
        return 34 + table.cols.length * 22 + 8;
      }

      function renderErDiagram(tablesData, relationsData) {
        var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        var container = document.createElement('div');
        container.className = 'uml-er-container';

        // リレーション配色パレット
        var relColors = isDark
          ? ['#f6ad55','#68d391','#63b3ed','#fc8181','#b794f4','#f687b3','#4fd1c5','#ecc94b','#9ae6b4','#feb2b2']
          : ['#c05621','#276749','#2b6cb0','#c53030','#6b46c1','#b83280','#2c7a7b','#975a16','#22543d','#9b2c2c'];

        // カラム→色マッピング: { "tableName.colName": colorIndex }
        var colColorMap = {};
        for (var ri = 0; ri < relationsData.length; ri++) {
          var colorIdx = ri % relColors.length;
          var fromKey = relationsData[ri][0] + '.' + relationsData[ri][1];
          var toKey = relationsData[ri][2] + '.' + relationsData[ri][3];
          if (!(fromKey in colColorMap)) colColorMap[fromKey] = colorIdx;
          if (!(toKey in colColorMap)) colColorMap[toKey] = colorIdx;
        }

        // テーブルカード座標を保存
        var cardRects = {};
        var cardElements = {};

        for (var t = 0; t < tablesData.length; t++) {
          var tbl = tablesData[t];
          var w = getTableCardWidth(tbl);
          var h = getTableCardHeight(tbl);
          cardRects[tbl.name] = { x: tbl.x, y: tbl.y, w: w, h: h };

          var card = document.createElement('div');
          card.className = 'uml-table-card';
          card.style.left = tbl.x + 'px';
          card.style.top = tbl.y + 'px';
          card.style.width = w + 'px';
          card.setAttribute('data-uml-table', tbl.name);

          var header = document.createElement('div');
          header.className = 'uml-table-header';
          header.textContent = tbl.name;
          applyUmlHeaderColor(header, tbl.name);
          header.addEventListener('mouseup', function(e) {
            if (hasDragged) return;
            var parentCard = e.currentTarget.parentElement;
            if (!parentCard) return;
            var hName = parentCard.getAttribute('data-uml-table');
            if (!hName) return;
            var tapM = document.cookie.match('(^|;)\\s*er_header_tap_mode=([^;]*)');
            var tapMode = tapM ? decodeURIComponent(tapM[2]) : 'on';
            if (tapMode !== 'off') openTablePreview(hName);
          });
          card.appendChild(header);

          var body = document.createElement('div');
          body.className = 'uml-table-body';
          for (var c = 0; c < tbl.cols.length; c++) {
            var col = tbl.cols[c];
            var row = document.createElement('div');
            row.className = 'uml-col-row';
            for (var k = 0; k < col.keys.length; k++) {
              var badge = document.createElement('span');
              badge.className = 'uml-col-key ' + col.keys[k];
              badge.textContent = col.keys[k].toUpperCase();
              row.appendChild(badge);
            }
            var nameSpan = document.createElement('span');
            nameSpan.className = 'uml-col-name';
            nameSpan.textContent = col.name;
            var colKey = tbl.name + '.' + col.name;
            if (colKey in colColorMap) {
              nameSpan.style.color = relColors[colColorMap[colKey]];
              nameSpan.style.fontWeight = '700';
              row.style.borderLeft = '3px solid ' + relColors[colColorMap[colKey]];
              row.style.paddingLeft = '5px';
            }
            row.appendChild(nameSpan);
            var typeSpan = document.createElement('span');
            typeSpan.className = 'uml-col-type';
            typeSpan.textContent = col.type;
            row.appendChild(typeSpan);
            body.appendChild(row);
          }
          card.appendChild(body);
          container.appendChild(card);
          cardElements[tbl.name] = card;
        }

        // SVG for relationship lines
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('uml-svg-overlay');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');

        container.appendChild(svg);
        umlWrapper.innerHTML = '';
        umlWrapper.appendChild(container);

        // 接続線描画
        function drawRelations() {
          while (svg.firstChild) svg.removeChild(svg.firstChild);

          var arrowSize = 10;

          for (var r = 0; r < relationsData.length; r++) {
            var rel = relationsData[r];
            var fromRect = cardRects[rel[0]];
            var toRect = cardRects[rel[2]];
            if (!fromRect || !toRect) continue;

            var relColorIdx = r % relColors.length;
            var lineColor = relColors[relColorIdx];
            var arrowColor = relColors[relColorIdx];
            var labelColor = relColors[relColorIdx];

            // カードのエッジから接続点を計算
            var fromCx = fromRect.x + fromRect.w / 2;
            var fromCy = fromRect.y + fromRect.h / 2;
            var toCx = toRect.x + toRect.w / 2;
            var toCy = toRect.y + toRect.h / 2;

            // from 側の接続点
            var fx, fy;
            if (toCx < fromRect.x) { fx = fromRect.x; fy = fromCy; }
            else if (toCx > fromRect.x + fromRect.w) { fx = fromRect.x + fromRect.w; fy = fromCy; }
            else if (toCy < fromRect.y) { fx = fromCx; fy = fromRect.y; }
            else { fx = fromCx; fy = fromRect.y + fromRect.h; }

            // to 側の接続点
            var tx, ty;
            if (fromCx < toRect.x) { tx = toRect.x; ty = toCy; }
            else if (fromCx > toRect.x + toRect.w) { tx = toRect.x + toRect.w; ty = toCy; }
            else if (fromCy < toRect.y) { tx = toCx; ty = toRect.y; }
            else { tx = toCx; ty = toRect.y + toRect.h; }

            var dx = tx - fx, dy = ty - fy;
            var len = Math.sqrt(dx * dx + dy * dy);
            var lineX2 = tx, lineY2 = ty;
            var bx1 = 0, by1 = 0, bx2 = 0, by2 = 0;
            var hasArrow = len > 0;
            if (hasArrow) {
              var ux = dx / len, uy = dy / len;
              lineX2 = tx - arrowSize * ux;
              lineY2 = ty - arrowSize * uy;
              bx1 = lineX2 + (arrowSize / 2.5) * uy;
              by1 = lineY2 - (arrowSize / 2.5) * ux;
              bx2 = lineX2 - (arrowSize / 2.5) * uy;
              by2 = lineY2 + (arrowSize / 2.5) * ux;
            }
            var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', String(fx));
            line.setAttribute('y1', String(fy));
            line.setAttribute('x2', String(lineX2));
            line.setAttribute('y2', String(lineY2));
            line.setAttribute('stroke', lineColor);
            line.setAttribute('stroke-width', '2');
            svg.appendChild(line);
            if (hasArrow) {
              var poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
              poly.setAttribute('points', tx + ',' + ty + ' ' + bx1 + ',' + by1 + ' ' + bx2 + ',' + by2);
              poly.setAttribute('fill', arrowColor);
              svg.appendChild(poly);
            }

            // ラベル
            var mx = (fx + tx) / 2;
            var my = (fy + ty) / 2;
            var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', String(mx));
            text.setAttribute('y', String(my - 6));
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-size', '11');
            text.setAttribute('fill', labelColor);
            text.setAttribute('font-weight', '600');
            text.textContent = rel[4];
            svg.appendChild(text);
          }
        }

        drawRelations();

        // ドラッグ
        var dragTarget = null;
        var dragOffsetX = 0;
        var dragOffsetY = 0;
        var dragStartX = 0;
        var dragStartY = 0;
        var dragStartIsHeader = false;
        var hasDragged = false;

        function clientToContainer(clientX, clientY) {
          var wrapperRect = umlWrapper.getBoundingClientRect();
          return {
            x: clientX - wrapperRect.left + umlWrapper.scrollLeft,
            y: clientY - wrapperRect.top + umlWrapper.scrollTop
          };
        }

        container.addEventListener('mousedown', function(e) {
          var card = e.target.closest('[data-uml-table]');
          if (!card) return;
          var tName = card.getAttribute('data-uml-table');
          if (!tName || !cardRects[tName]) return;
          dragTarget = tName;
          dragStartX = e.clientX;
          dragStartY = e.clientY;
          dragStartIsHeader = !!e.target.closest('.uml-table-header');
          hasDragged = false;
          var pos = clientToContainer(e.clientX, e.clientY);
          dragOffsetX = pos.x - cardRects[tName].x;
          dragOffsetY = pos.y - cardRects[tName].y;
        });

        container.addEventListener('dragstart', function(e) { e.preventDefault(); });

        document.addEventListener('mousemove', function(e) {
          if (!dragTarget) return;
          var dx = e.clientX - dragStartX;
          var dy = e.clientY - dragStartY;
          if (Math.sqrt(dx * dx + dy * dy) > 4) hasDragged = true;
          var rect = cardRects[dragTarget];
          var pos = clientToContainer(e.clientX, e.clientY);
          rect.x = pos.x - dragOffsetX;
          rect.y = pos.y - dragOffsetY;
          var el = cardElements[dragTarget];
          if (el) {
            el.style.left = rect.x + 'px';
            el.style.top = rect.y + 'px';
          }
          drawRelations();
        });

        document.addEventListener('mouseup', function() {
          dragTarget = null;
        });

        // ピンチズーム
        var currentScale = 1;
        var pinchStartDist = 0;
        var pinchStartScale = 1;
        container.style.transformOrigin = '0 0';

        function getTouchDist(t1, t2) {
          var dx = t1.clientX - t2.clientX;
          var dy = t1.clientY - t2.clientY;
          return Math.sqrt(dx * dx + dy * dy);
        }

        function applyZoom(newScale) {
          currentScale = Math.max(0.3, Math.min(3, newScale));
          container.style.transform = 'scale(' + currentScale + ')';
        }

        function computeUmlBBox() {
          var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          var found = false;
          for (var name in cardRects) {
            var r = cardRects[name];
            if (r.x < minX) minX = r.x;
            if (r.y < minY) minY = r.y;
            if (r.x + r.w > maxX) maxX = r.x + r.w;
            if (r.y + r.h > maxY) maxY = r.y + r.h;
            found = true;
          }
          if (!found) return null;
          return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
        }

        window.__umlApplyViewMode = function(mode) {
          if (mode === 'overview') {
            var bbox = computeUmlBBox();
            if (bbox) {
              var pad = 48;
              var availW = umlWrapper.clientWidth - pad;
              var availH = umlWrapper.clientHeight - pad;
              if (availW > 0 && availH > 0) {
                var sx = availW / (bbox.x + bbox.w);
                var sy = availH / (bbox.y + bbox.h);
                applyZoom(Math.min(sx, sy, 1));
              }
            }
            umlWrapper.scrollLeft = 0;
            umlWrapper.scrollTop = 0;
          } else {
            applyZoom(1);
            umlWrapper.scrollLeft = 0;
            umlWrapper.scrollTop = 0;
          }
        };

        // タッチ対応（ドラッグ＋ピンチズーム）
        container.addEventListener('touchstart', function(e) {
          if (e.touches.length === 2) {
            dragTarget = null;
            pinchStartDist = getTouchDist(e.touches[0], e.touches[1]);
            pinchStartScale = currentScale;
            e.preventDefault();
            return;
          }
          if (e.touches.length !== 1) return;
          var touch = e.touches[0];
          var el = document.elementFromPoint(touch.clientX, touch.clientY);
          var card = el ? el.closest('[data-uml-table]') : null;
          if (!card) return;
          var tName = card.getAttribute('data-uml-table');
          if (!tName || !cardRects[tName]) return;
          dragTarget = tName;
          dragStartX = touch.clientX;
          dragStartY = touch.clientY;
          dragStartIsHeader = !!(el && el.closest('.uml-table-header'));
          hasDragged = false;
          var pos = clientToContainer(touch.clientX, touch.clientY);
          dragOffsetX = pos.x - cardRects[tName].x;
          dragOffsetY = pos.y - cardRects[tName].y;
          e.preventDefault();
        }, { passive: false });

        document.addEventListener('touchmove', function(e) {
          if (e.touches.length === 2 && pinchStartDist > 0) {
            var dist = getTouchDist(e.touches[0], e.touches[1]);
            applyZoom(pinchStartScale * (dist / pinchStartDist));
            e.preventDefault();
            return;
          }
          if (!dragTarget) return;
          var touch = e.touches[0];
          var dx = touch.clientX - dragStartX;
          var dy = touch.clientY - dragStartY;
          if (Math.sqrt(dx * dx + dy * dy) > 4) hasDragged = true;
          var rect = cardRects[dragTarget];
          var pos = clientToContainer(touch.clientX, touch.clientY);
          rect.x = pos.x - dragOffsetX;
          rect.y = pos.y - dragOffsetY;
          var el = cardElements[dragTarget];
          if (el) {
            el.style.left = rect.x + 'px';
            el.style.top = rect.y + 'px';
          }
          drawRelations();
          e.preventDefault();
        }, { passive: false });

        document.addEventListener('touchend', function(e) {
          if (e.touches.length < 2) pinchStartDist = 0;
          if (dragTarget && dragStartIsHeader && !hasDragged) {
            var tName = dragTarget;
            dragTarget = null;
            var tapM = document.cookie.match('(^|;)\\s*er_header_tap_mode=([^;]*)');
            var tapMode = tapM ? decodeURIComponent(tapM[2]) : 'on';
            if (tapMode !== 'off') openTablePreview(tName);
            return;
          }
          dragTarget = null;
        });

        // ホイールズーム（Ctrl+ホイール or トラックパッドピンチ）
        umlWrapper.addEventListener('wheel', function(e) {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            var delta = e.deltaY > 0 ? 0.9 : 1.1;
            applyZoom(currentScale * delta);
          }
        }, { passive: false });

        // PNG出力
        var exportBtn = document.getElementById('umlExportPng');
        if (exportBtn) {
          exportBtn.addEventListener('click', function() {
            exportErDiagramAsPng(cardRects, isDark);
          });
        }

        // 座標出力/入力ボタン用に cardRects・cardElements・drawRelations を公開
        window.__umlCardRects = cardRects;
        window.__umlCardElements = cardElements;
        window.__umlDrawRelations = drawRelations;
        window.__umlTableNames = tablesData.map(function(t) { return t.name; });
      }

      var keyColorMap = { pk: '#e53e3e', fk: '#ed8936', uk: '#48bb78', idx: '#4299e1' };

      function exportErDiagramAsPng(cardRects, isDark) {
        var exportBtn = document.getElementById('umlExportPng');
        if (exportBtn) {
          exportBtn.disabled = true;
          exportBtn.textContent = '出力中...';
        }

        try {
          // キャンバスサイズ算出（全テーブルカードのバウンディングボックス + 余白）
          var pad = 40;
          var minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
          for (var t = 0; t < tables.length; t++) {
            var r = cardRects[tables[t].name];
            if (!r) continue;
            if (r.x < minX) minX = r.x;
            if (r.y < minY) minY = r.y;
            if (r.x + r.w > maxX) maxX = r.x + r.w;
            if (r.y + r.h > maxY) maxY = r.y + r.h;
          }
          // 正規化ノート領域
          var noteHeight = 120;
          var legendHeight = 36;

          var canvasW = maxX - minX + pad * 2;
          var canvasH = maxY - minY + pad * 2 + legendHeight + noteHeight;
          var offsetX = -minX + pad;
          var offsetY = -minY + pad;

          var dpr = 2;
          var canvas = document.createElement('canvas');
          canvas.width = canvasW * dpr;
          canvas.height = canvasH * dpr;
          var ctx = canvas.getContext('2d');
          ctx.scale(dpr, dpr);

          // 背景
          ctx.fillStyle = isDark ? '#1a202c' : '#ffffff';
          ctx.fillRect(0, 0, canvasW, canvasH);

          // リレーション線を先に描画
          var cRelColors = isDark
            ? ['#f6ad55','#68d391','#63b3ed','#fc8181','#b794f4','#f687b3','#4fd1c5','#ecc94b','#9ae6b4','#feb2b2']
            : ['#c05621','#276749','#2b6cb0','#c53030','#6b46c1','#b83280','#2c7a7b','#975a16','#22543d','#9b2c2c'];
          var cColColorMap = {};
          for (var ci = 0; ci < relations.length; ci++) {
            var cIdx = ci % cRelColors.length;
            var cFromKey = relations[ci][0] + '.' + relations[ci][1];
            var cToKey = relations[ci][2] + '.' + relations[ci][3];
            if (!(cFromKey in cColColorMap)) cColColorMap[cFromKey] = cIdx;
            if (!(cToKey in cColColorMap)) cColColorMap[cToKey] = cIdx;
          }
          var labelColor = isDark ? '#a0aec0' : '#4a5568';

          for (var ri = 0; ri < relations.length; ri++) {
            var rel = relations[ri];
            var fromRect = cardRects[rel[0]];
            var toRect = cardRects[rel[2]];
            if (!fromRect || !toRect) continue;

            var rColorIdx = ri % cRelColors.length;
            var rColor = cRelColors[rColorIdx];

            var fromCx = fromRect.x + fromRect.w / 2 + offsetX;
            var fromCy = fromRect.y + fromRect.h / 2 + offsetY;
            var toCx = toRect.x + toRect.w / 2 + offsetX;
            var toCy = toRect.y + toRect.h / 2 + offsetY;

            var fx, fy;
            if (toCx < fromRect.x + offsetX) { fx = fromRect.x + offsetX; fy = fromCy; }
            else if (toCx > fromRect.x + fromRect.w + offsetX) { fx = fromRect.x + fromRect.w + offsetX; fy = fromCy; }
            else if (toCy < fromRect.y + offsetY) { fx = fromCx; fy = fromRect.y + offsetY; }
            else { fx = fromCx; fy = fromRect.y + fromRect.h + offsetY; }

            var tx, ty;
            if (fromCx < toRect.x + offsetX) { tx = toRect.x + offsetX; ty = toCy; }
            else if (fromCx > toRect.x + toRect.w + offsetX) { tx = toRect.x + toRect.w + offsetX; ty = toCy; }
            else if (fromCy < toRect.y + offsetY) { tx = toCx; ty = toRect.y + offsetY; }
            else { tx = toCx; ty = toRect.y + toRect.h + offsetY; }

            // 線
            ctx.strokeStyle = rColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(fx, fy);
            ctx.lineTo(tx, ty);
            ctx.stroke();

            // 矢印
            var angle = Math.atan2(ty - fy, tx - fx);
            var arrowLen = 10;
            ctx.fillStyle = rColor;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx - arrowLen * Math.cos(angle - 0.35), ty - arrowLen * Math.sin(angle - 0.35));
            ctx.lineTo(tx - arrowLen * Math.cos(angle + 0.35), ty - arrowLen * Math.sin(angle + 0.35));
            ctx.closePath();
            ctx.fill();

            // カーディナリティラベル
            var mx = (fx + tx) / 2;
            var my = (fy + ty) / 2;
            ctx.fillStyle = rColor;
            ctx.font = '600 11px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(rel[4], mx, my - 4);
          }

          // テーブルカード描画
          var cardBg = isDark ? '#2d3748' : '#ffffff';
          var cardBorder = isDark ? '#4a5568' : '#e2e8f0';
          var colText = isDark ? '#cbd5e0' : '#4a5568';
          var typeText = isDark ? '#718096' : '#a0aec0';
          var colRowH = 22;
          var headerH = 34;

          for (var t = 0; t < tables.length; t++) {
            var tbl = tables[t];
            var rect = cardRects[tbl.name];
            if (!rect) continue;
            var cx = rect.x + offsetX;
            var cy = rect.y + offsetY;
            var cw = rect.w;
            var ch = rect.h;

            // カード影
            ctx.shadowColor = 'rgba(0,0,0,0.12)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 2;

            // カード背景
            ctx.fillStyle = cardBg;
            ctx.beginPath();
            ctx.roundRect(cx, cy, cw, ch, 10);
            ctx.fill();

            // カードボーダー
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.strokeStyle = cardBorder;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(cx, cy, cw, ch, 10);
            ctx.stroke();

            // ヘッダー背景（グループカラー）
            var tblColors = getUmlGroupColorsForTable(tbl.name);
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(cx + 10, cy);
            ctx.lineTo(cx + cw - 10, cy);
            ctx.quadraticCurveTo(cx + cw, cy, cx + cw, cy + 10);
            ctx.lineTo(cx + cw, cy + headerH);
            ctx.lineTo(cx, cy + headerH);
            ctx.lineTo(cx, cy + 10);
            ctx.quadraticCurveTo(cx, cy, cx + 10, cy);
            ctx.closePath();
            ctx.clip();
            if (tblColors.length === 1) {
              ctx.fillStyle = tblColors[0];
              ctx.fillRect(cx, cy, cw, headerH);
            } else {
              var segW = cw / tblColors.length;
              for (var si = 0; si < tblColors.length; si++) {
                ctx.fillStyle = tblColors[si];
                ctx.fillRect(cx + si * segW, cy, segW + 1, headerH);
              }
            }
            ctx.restore();

            // ヘッダーテキスト
            ctx.fillStyle = '#ffffff';
            ctx.font = '700 13px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(tbl.name, cx + 12, cy + headerH / 2);

            // カラム行
            for (var c = 0; c < tbl.cols.length; c++) {
              var col = tbl.cols[c];
              var rowY = cy + headerH + 6 + c * colRowH;
              var colX = cx + 12;

              // キーバッジ
              for (var k = 0; k < col.keys.length; k++) {
                var badgeW = 22;
                var badgeH = 13;
                ctx.fillStyle = keyColorMap[col.keys[k]] || '#a0aec0';
                ctx.beginPath();
                ctx.roundRect(colX, rowY + 2, badgeW, badgeH, 3);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.font = '700 8px -apple-system, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(col.keys[k].toUpperCase(), colX + badgeW / 2, rowY + 2 + badgeH / 2);
                colX += badgeW + 4;
              }

              // カラム名
              var cColKey = tbl.name + '.' + col.name;
              if (cColKey in cColColorMap) {
                ctx.fillStyle = cRelColors[cColColorMap[cColKey]];
                ctx.font = '700 11px Monaco, Courier New, monospace';
              } else {
                ctx.fillStyle = colText;
                ctx.font = '11px Monaco, Courier New, monospace';
              }
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.fillText(col.name, colX, rowY + 9);

              // 型
              ctx.fillStyle = typeText;
              ctx.font = '10px Monaco, Courier New, monospace';
              ctx.textAlign = 'right';
              ctx.fillText(col.type, cx + cw - 10, rowY + 9);
            }
          }

          // 凡例
          var legendY = maxY - minY + pad * 2 + 8;
          var legendItems = [
            { label: 'PK — 主キー', color: '#e53e3e' },
            { label: 'FK — 外部キー', color: '#ed8936' },
            { label: 'UK — ユニーク制約', color: '#48bb78' },
            { label: 'IDX — インデックス', color: '#4299e1' }
          ];
          var lx = pad;
          for (var li = 0; li < legendItems.length; li++) {
            ctx.fillStyle = legendItems[li].color;
            ctx.fillRect(lx, legendY, 12, 12);
            ctx.fillStyle = labelColor;
            ctx.font = '12px -apple-system, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(legendItems[li].label, lx + 16, legendY + 6);
            lx += ctx.measureText(legendItems[li].label).width + 36;
          }

          // 正規化ノート
          var noteY = legendY + legendHeight;
          ctx.fillStyle = labelColor;
          ctx.font = '700 12px -apple-system, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText('正規化状況:', pad, noteY);
          ctx.font = '11px -apple-system, sans-serif';
          var noteLines = [
            '[3NF] teams, workspaces, team_members — 第3正規形',
            '[3NF] user_sessions — user_id UNIQUE で実質的な候補キー',
            '[2NF] commit_calendar_cache, commit_list_cache — JSON 文字列格納 (キャッシュ用途)',
            '[3NF] cache_stats — 全カウンタが複合キーにのみ従属',
            '[2NF] installation_permissions — permissions が JSON 格納 (APIキャッシュ)'
          ];
          for (var ni = 0; ni < noteLines.length; ni++) {
            ctx.fillText(noteLines[ni], pad, noteY + 18 + ni * 18);
          }

          // ダウンロード
          var link = document.createElement('a');
          link.download = 'er-diagram-' + new Date().toISOString().slice(0, 10) + '.png';
          link.href = canvas.toDataURL('image/png');
          link.click();
        } catch (err) {
          console.error('PNG export failed', err);
        } finally {
          if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1v9M8 10L4.5 6.5M8 10l3.5-3.5M2 12v2h12v-2" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> 画像出力';
          }
        }
      }
    })();

    // FK検証モーダル
    (function() {
      var fkVerifyBtn = document.getElementById('umlFkVerifyBtn');
      var fkVerifyModal = document.getElementById('fkVerifyModal');
      var fkVerifyClose = document.getElementById('fkVerifyModalClose');
      var fkVerifyBody = document.getElementById('fkVerifyBody');
      if (!fkVerifyBtn || !fkVerifyModal || !fkVerifyBody) return;

      function closeFkVerify() {
        fkVerifyModal.classList.remove('show');
        fkVerifyModal.setAttribute('aria-hidden', 'true');
      }
      if (fkVerifyClose) fkVerifyClose.addEventListener('click', closeFkVerify);
      fkVerifyModal.addEventListener('click', function(e) { if (e.target === fkVerifyModal) closeFkVerify(); });

      fkVerifyBtn.addEventListener('click', async function() {
        var relations = window.__erRelations || [];
        if (relations.length === 0) {
          fkVerifyBody.innerHTML = '<p style="color:#a0aec0">リレーションが見つかりません</p>';
          fkVerifyModal.classList.add('show');
          fkVerifyModal.setAttribute('aria-hidden', 'false');
          return;
        }
        fkVerifyBody.innerHTML = '<p style="color:#a0aec0">検証中...</p>';
        fkVerifyModal.classList.add('show');
        fkVerifyModal.setAttribute('aria-hidden', 'false');

        var html = '';
        for (var i = 0; i < relations.length; i++) {
          var rel = relations[i];
          try {
            var res = await fetch('/api/status/fk-verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fromTable: rel[0], fromCol: rel[1], toTable: rel[2], toCol: rel[3] })
            });
            var data = await res.json();
            if (data.error) {
              html += '<div style="margin-bottom:1.5rem;border:1px solid #4a5568;border-radius:8px;padding:1rem;">';
              html += '<div style="font-weight:700;color:#fc8181;margin-bottom:0.5rem">' + rel[0] + '.' + rel[1] + ' → ' + rel[2] + '.' + rel[3] + '</div>';
              html += '<div style="color:#fc8181">エラー: ' + data.error + '</div></div>';
              continue;
            }
            var orphanRate = data.totalFromRows > 0 ? (data.orphanCount / data.totalFromRows * 100).toFixed(1) : '0.0';
            var statusColor = data.orphanCount === 0 ? '#68d391' : '#fc8181';
            var statusLabel = data.orphanCount === 0 ? '正常' : '孤立あり';

            html += '<div style="margin-bottom:1.5rem;border:1px solid #4a5568;border-radius:8px;padding:1rem;">';
            html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:0.5rem">';
            html += '<span style="font-weight:700;color:#e2e8f0">' + rel[0] + '.' + rel[1] + ' → ' + rel[2] + '.' + rel[3] + '</span>';
            html += '<span style="font-size:0.8rem;padding:2px 8px;border-radius:4px;background:' + statusColor + '20;color:' + statusColor + ';font-weight:600">' + statusLabel + '</span>';
            html += '</div>';
            html += '<div style="font-size:0.85rem;color:#a0aec0;margin-bottom:0.75rem">';
            html += rel[0] + ' 全' + data.totalFromRows + '行 / 孤立: ' + data.orphanCount + '行 (' + orphanRate + '%)';
            if (data.orphanSamples && data.orphanSamples.length > 0) {
              html += ' — 孤立値: ' + data.orphanSamples.map(function(v) { return '<code style="background:#2d3748;padding:1px 4px;border-radius:3px">' + v + '</code>'; }).join(', ');
            }
            html += '</div>';

            if (data.samples && data.samples.length > 0) {
              for (var s = 0; s < data.samples.length; s++) {
                var sample = data.samples[s];
                html += '<details style="margin-bottom:0.5rem"' + (s === 0 ? ' open' : '') + '>';
                html += '<summary style="cursor:pointer;font-size:0.85rem;color:#63b3ed">サンプル #' + (s + 1) + ' (FK値: <code>' + (sample.fromRow[rel[1]] ?? '?') + '</code>)</summary>';
                html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:0.5rem">';

                html += '<div style="background:#1a202c;border:1px solid #4a5568;border-radius:6px;padding:0.5rem">';
                html += '<div style="font-weight:700;color:#f6ad55;font-size:0.8rem;margin-bottom:0.25rem">' + rel[0] + '</div>';
                var fromKeys = Object.keys(sample.fromRow);
                for (var fk = 0; fk < fromKeys.length; fk++) {
                  var isFK = fromKeys[fk] === rel[1];
                  html += '<div style="font-size:0.8rem;' + (isFK ? 'color:#f6ad55;font-weight:700' : 'color:#cbd5e0') + '">';
                  html += '<span style="color:#718096">' + fromKeys[fk] + ':</span> ' + (sample.fromRow[fromKeys[fk]] ?? 'NULL') + '</div>';
                }
                html += '</div>';

                html += '<div style="background:#1a202c;border:1px solid #4a5568;border-radius:6px;padding:0.5rem">';
                html += '<div style="font-weight:700;color:#68d391;font-size:0.8rem;margin-bottom:0.25rem">' + rel[2] + '</div>';
                var toKeys = Object.keys(sample.toRow);
                for (var tk = 0; tk < toKeys.length; tk++) {
                  var isPK = toKeys[tk] === rel[3];
                  html += '<div style="font-size:0.8rem;' + (isPK ? 'color:#68d391;font-weight:700' : 'color:#cbd5e0') + '">';
                  html += '<span style="color:#718096">' + toKeys[tk] + ':</span> ' + (sample.toRow[toKeys[tk]] ?? 'NULL') + '</div>';
                }
                html += '</div>';
                html += '</div></details>';
              }
            } else {
              html += '<div style="font-size:0.85rem;color:#718096">JOINに該当するレコードがありません</div>';
            }
            html += '</div>';
          } catch (err) {
            html += '<div style="margin-bottom:1rem;color:#fc8181">通信エラー: ' + rel[0] + '.' + rel[1] + ' → ' + rel[2] + '.' + rel[3] + '</div>';
          }
        }
        fkVerifyBody.innerHTML = html;
      });
    })();

    // カラム名一覧モーダル
    (function() {
      var colListModal = document.getElementById('colListModal');
      var colListCloseBtn = document.getElementById('colListModalClose');
      var colListBtn = document.getElementById('umlColListBtn');
      var colListThead = document.getElementById('colListThead');
      var colListTbody = document.getElementById('colListTbody');
      var colListFilters = document.getElementById('colListFilters');
      var colListCount = document.getElementById('colListCount');
      var colListUmlBtn = document.getElementById('colListUmlBtn');
      var colListUmlHint = document.getElementById('colListUmlHint');
      if (!colListModal || !colListBtn || !colListTbody) return;

      var repoName = ${JSON.stringify('cloudflare-workers-github-oauth-1')};
      var colHeaders = [
        { key: 'keys', label: 'キー種別' },
        { key: 'colName', label: 'カラム名' },
        { key: 'tableName', label: '定義済テーブル' },
        { key: 'repoName', label: 'リポジトリ名' }
      ];

      var allRows = [];
      var sortCol = 'colName';
      var sortAsc = true;
      var filters = { keys: '', colName: '', tableName: '', repoName: '' };
      var colListBuilt = false;

      function buildRows(tablesData) {
        allRows = [];
        for (var t = 0; t < tablesData.length; t++) {
          var tbl = tablesData[t];
          for (var c = 0; c < tbl.cols.length; c++) {
            var col = tbl.cols[c];
            var keyLabel = '';
            if (col.keys.length > 1) {
              keyLabel = col.keys.map(function(k) { return k.toUpperCase(); }).join('+');
            } else if (col.keys.length === 1) {
              keyLabel = col.keys[0].toUpperCase();
            } else {
              keyLabel = '-';
            }
            allRows.push({
              keys: keyLabel,
              keysArr: col.keys.slice(),
              colName: col.name,
              tableName: tbl.name,
              repoName: repoName
            });
          }
        }
      }

      function hasActiveFilter() {
        for (var f in filters) {
          if (filters[f]) return true;
        }
        return false;
      }

      function updateUmlButton() {
        if (!colListUmlBtn) return;
        var active = hasActiveFilter();
        colListUmlBtn.disabled = !active;
        if (colListUmlHint) {
          colListUmlHint.textContent = active
            ? getFilteredSorted().length + ' 件のカラムを含むテーブルのUMLを表示'
            : 'フィルタを選択すると有効になります';
        }
      }

      function getFilteredSorted() {
        var filtered = allRows.filter(function(row) {
          for (var f in filters) {
            if (filters[f] && row[f] !== filters[f]) return false;
          }
          return true;
        });
        filtered.sort(function(a, b) {
          var va = a[sortCol] || '';
          var vb = b[sortCol] || '';
          if (va < vb) return sortAsc ? -1 : 1;
          if (va > vb) return sortAsc ? 1 : -1;
          return 0;
        });
        return filtered;
      }

      function getUniqueValues(key) {
        var seen = {};
        var vals = [];
        for (var i = 0; i < allRows.length; i++) {
          var v = allRows[i][key];
          if (!seen[v]) { seen[v] = true; vals.push(v); }
        }
        vals.sort();
        return vals;
      }

      function renderFilters() {
        colListFilters.innerHTML = '';
        for (var h = 0; h < colHeaders.length; h++) {
          var hdr = colHeaders[h];
          var group = document.createElement('div');
          group.className = 'collist-filter-group';
          var label = document.createElement('label');
          label.textContent = hdr.label;
          group.appendChild(label);
          var sel = document.createElement('select');
          sel.setAttribute('data-filter-key', hdr.key);
          var optAll = document.createElement('option');
          optAll.value = '';
          optAll.textContent = 'すべて';
          sel.appendChild(optAll);
          var vals = getUniqueValues(hdr.key);
          for (var v = 0; v < vals.length; v++) {
            var opt = document.createElement('option');
            opt.value = vals[v];
            opt.textContent = vals[v];
            sel.appendChild(opt);
          }
          sel.value = filters[hdr.key] || '';
          sel.addEventListener('change', (function(key) {
            return function(e) {
              filters[key] = e.target.value;
              renderTable();
              updateUmlButton();
            };
          })(hdr.key));
          group.appendChild(sel);
          colListFilters.appendChild(group);
        }
      }

      function renderThead() {
        colListThead.innerHTML = '';
        var tr = document.createElement('tr');
        for (var h = 0; h < colHeaders.length; h++) {
          var th = document.createElement('th');
          var hdr = colHeaders[h];
          var textSpan = document.createTextNode(hdr.label + ' ');
          th.appendChild(textSpan);
          var indicator = document.createElement('span');
          indicator.className = 'sort-indicator' + (sortCol === hdr.key ? ' active' : '');
          if (sortCol === hdr.key) {
            indicator.textContent = sortAsc ? '\u25B2' : '\u25BC';
          } else {
            indicator.textContent = '\u25B2';
          }
          th.appendChild(indicator);
          th.addEventListener('click', (function(key) {
            return function() {
              if (sortCol === key) {
                sortAsc = !sortAsc;
              } else {
                sortCol = key;
                sortAsc = true;
              }
              renderThead();
              renderTable();
            };
          })(hdr.key));
          tr.appendChild(th);
        }
        colListThead.appendChild(tr);
      }

      function renderTable() {
        var rows = getFilteredSorted();
        colListTbody.innerHTML = '';
        for (var i = 0; i < rows.length; i++) {
          var row = rows[i];
          var tr = document.createElement('tr');

          var tdKey = document.createElement('td');
          if (row.keysArr.length > 0) {
            for (var k = 0; k < row.keysArr.length; k++) {
              var badge = document.createElement('span');
              badge.className = 'key-badge ' + row.keysArr[k];
              badge.textContent = row.keysArr[k].toUpperCase();
              tdKey.appendChild(badge);
            }
          } else {
            tdKey.textContent = '-';
          }
          tr.appendChild(tdKey);

          var tdCol = document.createElement('td');
          tdCol.textContent = row.colName;
          tr.appendChild(tdCol);

          var tdTbl = document.createElement('td');
          tdTbl.textContent = row.tableName;
          tr.appendChild(tdTbl);

          var tdRepo = document.createElement('td');
          tdRepo.textContent = row.repoName;
          tr.appendChild(tdRepo);

          colListTbody.appendChild(tr);
        }
        if (colListCount) {
          colListCount.textContent = rows.length + ' / ' + allRows.length + ' 件表示';
        }
      }

      function openColListModal(tablesData) {
        if (!colListBuilt || allRows.length === 0) {
          buildRows(tablesData);
          renderFilters();
          renderThead();
          renderTable();
          updateUmlButton();
          colListBuilt = true;
        }
        colListModal.classList.add('show');
        colListModal.setAttribute('aria-hidden', 'false');
      }

      function closeColListModal() {
        colListModal.classList.remove('show');
        colListModal.setAttribute('aria-hidden', 'true');
      }

      colListBtn.addEventListener('click', function() {
        openColListModal(window.__erTables || []);
      });
      if (colListCloseBtn) colListCloseBtn.addEventListener('click', closeColListModal);
      colListModal.addEventListener('click', function(e) { if (e.target === colListModal) closeColListModal(); });
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && colListModal.classList.contains('show')) {
          var fUml = document.getElementById('filteredUmlModal');
          if (fUml && fUml.classList.contains('show')) return;
          closeColListModal();
        }
      });

      // UMLを作成ボタン
      if (colListUmlBtn) {
        colListUmlBtn.addEventListener('click', function() {
          if (colListUmlBtn.disabled) return;
          var filteredRows = getFilteredSorted();
          var tableNameSet = {};
          for (var i = 0; i < filteredRows.length; i++) {
            tableNameSet[filteredRows[i].tableName] = true;
          }
          var tableNames = Object.keys(tableNameSet);
          if (tableNames.length === 0) return;
          openFilteredUmlModal(tableNames, window.__erTables || [], window.__erRelations || []);
        });
      }

      window.__refreshColList = function(tablesData) {
        colListBuilt = false;
        filters = { keys: '', colName: '', tableName: '', repoName: '' };
        sortCol = 'colName';
        sortAsc = true;
        buildRows(tablesData);
        renderFilters();
        renderThead();
        renderTable();
        updateUmlButton();
        colListBuilt = true;
      };
    })();

    // フィルタ済みUMLモーダル
    (function() {
      var fUmlModal = document.getElementById('filteredUmlModal');
      var fUmlCloseBtn = document.getElementById('filteredUmlModalClose');
      var fUmlWrapper = document.getElementById('filteredUmlCanvasWrapper');
      var fUmlTitle = document.getElementById('filteredUmlModalTitle');
      var fUmlSubtitle = document.getElementById('filteredUmlModalSubtitle');
      if (!fUmlModal || !fUmlWrapper) return;

      function closeFilteredUmlModal() {
        fUmlModal.classList.remove('show');
        fUmlModal.setAttribute('aria-hidden', 'true');
      }

      if (fUmlCloseBtn) fUmlCloseBtn.addEventListener('click', closeFilteredUmlModal);
      fUmlModal.addEventListener('click', function(e) { if (e.target === fUmlModal) closeFilteredUmlModal(); });
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && fUmlModal.classList.contains('show')) closeFilteredUmlModal();
      });

      (function() {
        var toggleEl = document.getElementById('fUmlTablelistToggle');
        if (!toggleEl) return;
        toggleEl.addEventListener('change', function() {
          var on = this.checked;
          document.cookie = 'er_tablelist_expand=' + (on ? 'on' : 'off') + '; Path=/; Secure; SameSite=Lax; Max-Age=31536000';
          var detailEl = document.getElementById('fUmlSubtitleDetail');
          if (detailEl) detailEl.style.display = on ? '' : 'none';
        });
      })();

      var FILTERED_UML_VIEW_MODE_KEY = 'er-filtered-uml-view-mode';

      function getFilteredUmlViewMode() {
        var v = null;
        try { v = localStorage.getItem(FILTERED_UML_VIEW_MODE_KEY); } catch (_e) {}
        return v === 'focus' ? 'focus' : 'overview';
      }

      function updateFilteredUmlViewToggleButtons() {
        var mode = getFilteredUmlViewMode();
        var focusBtn = document.getElementById('filteredUmlViewModeFocus');
        var overviewBtn = document.getElementById('filteredUmlViewModeOverview');
        if (focusBtn) focusBtn.classList.toggle('active', mode === 'focus');
        if (overviewBtn) overviewBtn.classList.toggle('active', mode === 'overview');
      }

      function applyFilteredUmlViewMode(mode) {
        if (typeof window.__filteredUmlApplyViewMode === 'function') {
          window.__filteredUmlApplyViewMode(mode);
        }
      }

      function setFilteredUmlViewMode(mode) {
        if (mode !== 'focus' && mode !== 'overview') return;
        try { localStorage.setItem(FILTERED_UML_VIEW_MODE_KEY, mode); } catch (_e) {}
        updateFilteredUmlViewToggleButtons();
        applyFilteredUmlViewMode(mode);
      }

      var fUmlFocusBtnEl = document.getElementById('filteredUmlViewModeFocus');
      var fUmlOverviewBtnEl = document.getElementById('filteredUmlViewModeOverview');
      if (fUmlFocusBtnEl) fUmlFocusBtnEl.addEventListener('click', function() { setFilteredUmlViewMode('focus'); });
      if (fUmlOverviewBtnEl) fUmlOverviewBtnEl.addEventListener('click', function() { setFilteredUmlViewMode('overview'); });
      updateFilteredUmlViewToggleButtons();

      window.openFilteredUmlModal = function(tableNames, allTables, allRelations) {
        var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        var primarySet = {};
        for (var i = 0; i < tableNames.length; i++) primarySet[tableNames[i]] = true;

        var expandedSet = {};
        for (var n in primarySet) expandedSet[n] = true;
        for (var r = 0; r < allRelations.length; r++) {
          var rel = allRelations[r];
          if (primarySet[rel[0]] && !expandedSet[rel[2]]) expandedSet[rel[2]] = true;
          if (primarySet[rel[2]] && !expandedSet[rel[0]]) expandedSet[rel[0]] = true;
        }

        var filteredTables = [];
        for (var t = 0; t < allTables.length; t++) {
          if (expandedSet[allTables[t].name]) {
            filteredTables.push({
              name: allTables[t].name,
              cols: allTables[t].cols.slice(),
              x: 0, y: 0
            });
          }
        }

        var filteredRelations = [];
        for (var r = 0; r < allRelations.length; r++) {
          var rel = allRelations[r];
          if (expandedSet[rel[0]] && expandedSet[rel[2]]) {
            filteredRelations.push(rel);
          }
        }

        var primaryNames = tableNames.slice().sort();
        var addedNames = [];
        for (var n in expandedSet) {
          if (!primarySet[n]) addedNames.push(n);
        }
        addedNames.sort();

        var summaryText = primaryNames.length + ' テーブル';
        if (addedNames.length > 0) summaryText += '  +  関連 ' + addedNames.length + ' テーブル';

        var detailText = primaryNames.join(', ');
        if (addedNames.length > 0) detailText += '  +  関連: ' + addedNames.join(', ');

        var groupSet = {};
        for (var gi = 0; gi < tableNames.length; gi++) {
          var gKey = tableGroupMap[tableNames[gi]];
          if (gKey) groupSet[gKey] = true;
        }
        var groupKeys = Object.keys(groupSet).sort();
        var groupTitle;
        if (groupKeys.length === 0) {
          groupTitle = 'フィルタ済み ER図';
        } else {
          var labels = groupKeys.map(function(k) { return groupLabels[k] || k; });
          groupTitle = labels.join(' / ');
        }

        if (fUmlTitle) fUmlTitle.textContent = groupTitle + ' (' + filteredTables.length + ' テーブル)';
        var summaryEl = document.getElementById('fUmlSubtitleSummary');
        var detailEl = document.getElementById('fUmlSubtitleDetail');
        var tablelistToggleEl = document.getElementById('fUmlTablelistToggle');
        if (summaryEl) summaryEl.textContent = summaryText;
        if (detailEl) detailEl.textContent = detailText;
        var isTablelistExpanded = (function() {
          var m = document.cookie.match('(^|;)\\s*er_tablelist_expand=([^;]*)');
          return m ? m[2] === 'on' : false;
        })();
        if (detailEl) detailEl.style.display = isTablelistExpanded ? '' : 'none';
        if (tablelistToggleEl) tablelistToggleEl.checked = isTablelistExpanded;

        layoutFilteredTables(filteredTables, filteredRelations);
        renderFilteredErDiagram(filteredTables, filteredRelations, isDark);
        buildKeySummary('filteredUmlKeySummary', filteredTables);

        fUmlModal.classList.add('show');
        fUmlModal.setAttribute('aria-hidden', 'false');
        updateFilteredUmlViewToggleButtons();
        setTimeout(function() { applyFilteredUmlViewMode(getFilteredUmlViewMode()); }, 50);
      };

      function getTableCardWidth(table) {
        var maxLen = table.name.length;
        for (var i = 0; i < table.cols.length; i++) {
          var len = table.cols[i].name.length + table.cols[i].type.length + table.cols[i].keys.length * 3 + 2;
          if (len > maxLen) maxLen = len;
        }
        return Math.max(180, Math.min(240, maxLen * 8 + 40));
      }

      function getTableCardHeight(table) {
        return 34 + table.cols.length * 22 + 8;
      }

      function layoutFilteredTables(tbls, rels) {
        var adj = {};
        for (var i = 0; i < tbls.length; i++) adj[tbls[i].name] = [];
        for (var r = 0; r < rels.length; r++) {
          var from = rels[r][0], to = rels[r][2];
          if (adj[from]) adj[from].push(to);
          if (adj[to]) adj[to].push(from);
        }
        var tblByName = {};
        for (var i = 0; i < tbls.length; i++) tblByName[tbls[i].name] = tbls[i];

        var scored = tbls.map(function(t) {
          return { name: t.name, score: (adj[t.name] || []).length };
        });
        scored.sort(function(a, b) { return b.score - a.score; });

        var layers = [];
        var visited = {};

        function bfs(startName) {
          var queue = [startName];
          visited[startName] = true;
          var layerIdx = layers.length;
          while (queue.length > 0) {
            var nextQueue = [];
            if (!layers[layerIdx]) layers[layerIdx] = [];
            for (var q = 0; q < queue.length; q++) {
              var name = queue[q];
              layers[layerIdx].push(name);
              var neighbors = adj[name] || [];
              for (var n = 0; n < neighbors.length; n++) {
                if (!visited[neighbors[n]]) {
                  visited[neighbors[n]] = true;
                  nextQueue.push(neighbors[n]);
                }
              }
            }
            layerIdx++;
            queue = nextQueue;
          }
        }

        for (var s = 0; s < scored.length; s++) {
          if (!visited[scored[s].name]) bfs(scored[s].name);
        }

        var currentX = 40;
        var rowGap = 30;
        for (var l = 0; l < layers.length; l++) {
          var layer = layers[l];
          var currentY = 40;
          var maxW = 0;
          for (var m = 0; m < layer.length; m++) {
            var tbl = tblByName[layer[m]];
            if (!tbl) continue;
            var w = getTableCardWidth(tbl);
            var h = getTableCardHeight(tbl);
            tbl.x = currentX;
            tbl.y = currentY;
            currentY += h + rowGap;
            if (w > maxW) maxW = w;
          }
          currentX += maxW + 60;
        }
      }

      function renderFilteredErDiagram(tablesData, relationsData, isDark) {
        var container = document.createElement('div');
        container.className = 'uml-er-container';

        // リレーション配色パレット
        var fRelColors = isDark
          ? ['#f6ad55','#68d391','#63b3ed','#fc8181','#b794f4','#f687b3','#4fd1c5','#ecc94b','#9ae6b4','#feb2b2']
          : ['#c05621','#276749','#2b6cb0','#c53030','#6b46c1','#b83280','#2c7a7b','#975a16','#22543d','#9b2c2c'];

        var fColColorMap = {};
        for (var fri = 0; fri < relationsData.length; fri++) {
          var fci = fri % fRelColors.length;
          var fFromKey = relationsData[fri][0] + '.' + relationsData[fri][1];
          var fToKey = relationsData[fri][2] + '.' + relationsData[fri][3];
          if (!(fFromKey in fColColorMap)) fColColorMap[fFromKey] = fci;
          if (!(fToKey in fColColorMap)) fColColorMap[fToKey] = fci;
        }

        var cardRects = {};
        var cardElements = {};
        var keyColorMap = { pk: '#e53e3e', fk: '#ed8936', uk: '#48bb78', idx: '#4299e1' };

        for (var t = 0; t < tablesData.length; t++) {
          var tbl = tablesData[t];
          var w = getTableCardWidth(tbl);
          var h = getTableCardHeight(tbl);
          cardRects[tbl.name] = { x: tbl.x, y: tbl.y, w: w, h: h };

          var card = document.createElement('div');
          card.className = 'uml-table-card';
          card.style.left = tbl.x + 'px';
          card.style.top = tbl.y + 'px';
          card.style.width = w + 'px';
          card.setAttribute('data-uml-table', tbl.name);

          var header = document.createElement('div');
          header.className = 'uml-table-header';
          header.textContent = tbl.name;
          applyUmlHeaderColor(header, tbl.name);
          card.appendChild(header);

          var body = document.createElement('div');
          body.className = 'uml-table-body';
          for (var c = 0; c < tbl.cols.length; c++) {
            var col = tbl.cols[c];
            var row = document.createElement('div');
            row.className = 'uml-col-row';
            for (var k = 0; k < col.keys.length; k++) {
              var badge = document.createElement('span');
              badge.className = 'uml-col-key ' + col.keys[k];
              badge.textContent = col.keys[k].toUpperCase();
              row.appendChild(badge);
            }
            var nameSpan = document.createElement('span');
            nameSpan.className = 'uml-col-name';
            nameSpan.textContent = col.name;
            var fColKey = tbl.name + '.' + col.name;
            if (fColKey in fColColorMap) {
              nameSpan.style.color = fRelColors[fColColorMap[fColKey]];
              nameSpan.style.fontWeight = '700';
              row.style.borderLeft = '3px solid ' + fRelColors[fColColorMap[fColKey]];
              row.style.paddingLeft = '5px';
            }
            row.appendChild(nameSpan);
            var typeSpan = document.createElement('span');
            typeSpan.className = 'uml-col-type';
            typeSpan.textContent = col.type;
            row.appendChild(typeSpan);
            body.appendChild(row);
          }
          card.appendChild(body);
          container.appendChild(card);
          cardElements[tbl.name] = card;
        }

        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('uml-svg-overlay');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');

        container.appendChild(svg);
        fUmlWrapper.innerHTML = '';
        fUmlWrapper.appendChild(container);

        function drawRelations() {
          while (svg.firstChild) svg.removeChild(svg.firstChild);
          var arrowSize = 10;

          for (var r = 0; r < relationsData.length; r++) {
            var rel = relationsData[r];
            var fromRect = cardRects[rel[0]];
            var toRect = cardRects[rel[2]];
            if (!fromRect || !toRect) continue;

            var fRelIdx = r % fRelColors.length;
            var lineColor = fRelColors[fRelIdx];
            var arrowColor = fRelColors[fRelIdx];
            var labelColor = fRelColors[fRelIdx];

            var fromCx = fromRect.x + fromRect.w / 2;
            var fromCy = fromRect.y + fromRect.h / 2;
            var toCx = toRect.x + toRect.w / 2;
            var toCy = toRect.y + toRect.h / 2;

            var fx, fy;
            if (toCx < fromRect.x) { fx = fromRect.x; fy = fromCy; }
            else if (toCx > fromRect.x + fromRect.w) { fx = fromRect.x + fromRect.w; fy = fromCy; }
            else if (toCy < fromRect.y) { fx = fromCx; fy = fromRect.y; }
            else { fx = fromCx; fy = fromRect.y + fromRect.h; }

            var tx, ty;
            if (fromCx < toRect.x) { tx = toRect.x; ty = toCy; }
            else if (fromCx > toRect.x + toRect.w) { tx = toRect.x + toRect.w; ty = toCy; }
            else if (fromCy < toRect.y) { tx = toCx; ty = toRect.y; }
            else { tx = toCx; ty = toRect.y + toRect.h; }

            var dx = tx - fx, dy = ty - fy;
            var len = Math.sqrt(dx * dx + dy * dy);
            var lineX2 = tx, lineY2 = ty;
            var bx1 = 0, by1 = 0, bx2 = 0, by2 = 0;
            var hasArrow = len > 0;
            if (hasArrow) {
              var ux = dx / len, uy = dy / len;
              lineX2 = tx - arrowSize * ux;
              lineY2 = ty - arrowSize * uy;
              bx1 = lineX2 + (arrowSize / 2.5) * uy;
              by1 = lineY2 - (arrowSize / 2.5) * ux;
              bx2 = lineX2 - (arrowSize / 2.5) * uy;
              by2 = lineY2 + (arrowSize / 2.5) * ux;
            }
            var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', String(fx));
            line.setAttribute('y1', String(fy));
            line.setAttribute('x2', String(lineX2));
            line.setAttribute('y2', String(lineY2));
            line.setAttribute('stroke', lineColor);
            line.setAttribute('stroke-width', '2');
            svg.appendChild(line);
            if (hasArrow) {
              var poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
              poly.setAttribute('points', tx + ',' + ty + ' ' + bx1 + ',' + by1 + ' ' + bx2 + ',' + by2);
              poly.setAttribute('fill', arrowColor);
              svg.appendChild(poly);
            }

            var mx = (fx + tx) / 2;
            var my = (fy + ty) / 2;
            var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', String(mx));
            text.setAttribute('y', String(my - 6));
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-size', '11');
            text.setAttribute('fill', labelColor);
            text.setAttribute('font-weight', '600');
            text.textContent = rel[4];
            svg.appendChild(text);
          }
        }

        drawRelations();

        var dragTarget = null;
        var dragOffsetX = 0;
        var dragOffsetY = 0;

        function clientToContainer(clientX, clientY) {
          var wrapperRect = fUmlWrapper.getBoundingClientRect();
          return {
            x: clientX - wrapperRect.left + fUmlWrapper.scrollLeft,
            y: clientY - wrapperRect.top + fUmlWrapper.scrollTop
          };
        }

        container.addEventListener('mousedown', function(e) {
          var card = e.target.closest('[data-uml-table]');
          if (!card) return;
          var tName = card.getAttribute('data-uml-table');
          if (!tName || !cardRects[tName]) return;
          dragTarget = tName;
          var pos = clientToContainer(e.clientX, e.clientY);
          dragOffsetX = pos.x - cardRects[tName].x;
          dragOffsetY = pos.y - cardRects[tName].y;
          e.preventDefault();
        });

        container.addEventListener('mousemove', function(e) {
          if (!dragTarget) return;
          var rect = cardRects[dragTarget];
          var pos = clientToContainer(e.clientX, e.clientY);
          rect.x = pos.x - dragOffsetX;
          rect.y = pos.y - dragOffsetY;
          var el = cardElements[dragTarget];
          if (el) {
            el.style.left = rect.x + 'px';
            el.style.top = rect.y + 'px';
          }
          drawRelations();
        });

        document.addEventListener('mouseup', function() {
          dragTarget = null;
        });

        // ピンチズーム
        var currentScale = 1;
        var pinchStartDist = 0;
        var pinchStartScale = 1;
        container.style.transformOrigin = '0 0';

        function getTouchDist(t1, t2) {
          var dx = t1.clientX - t2.clientX;
          var dy = t1.clientY - t2.clientY;
          return Math.sqrt(dx * dx + dy * dy);
        }

        function applyZoom(newScale) {
          currentScale = Math.max(0.3, Math.min(3, newScale));
          container.style.transform = 'scale(' + currentScale + ')';
        }

        function computeFUmlBBox() {
          var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          var found = false;
          for (var name in cardRects) {
            var r = cardRects[name];
            if (r.x < minX) minX = r.x;
            if (r.y < minY) minY = r.y;
            if (r.x + r.w > maxX) maxX = r.x + r.w;
            if (r.y + r.h > maxY) maxY = r.y + r.h;
            found = true;
          }
          if (!found) return null;
          return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
        }

        window.__filteredUmlApplyViewMode = function(mode) {
          if (mode === 'overview') {
            var bbox = computeFUmlBBox();
            if (bbox) {
              var pad = 48;
              var availW = fUmlWrapper.clientWidth - pad;
              var availH = fUmlWrapper.clientHeight - pad;
              if (availW > 0 && availH > 0) {
                var sx = availW / (bbox.x + bbox.w);
                var sy = availH / (bbox.y + bbox.h);
                applyZoom(Math.min(sx, sy, 1));
              }
            }
            fUmlWrapper.scrollLeft = 0;
            fUmlWrapper.scrollTop = 0;
          } else {
            applyZoom(1);
            fUmlWrapper.scrollLeft = 0;
            fUmlWrapper.scrollTop = 0;
          }
        };

        // タッチ対応（ドラッグ＋ピンチズーム）
        container.addEventListener('touchstart', function(e) {
          if (e.touches.length === 2) {
            dragTarget = null;
            pinchStartDist = getTouchDist(e.touches[0], e.touches[1]);
            pinchStartScale = currentScale;
            e.preventDefault();
            return;
          }
          if (e.touches.length !== 1) return;
          var touch = e.touches[0];
          var card = document.elementFromPoint(touch.clientX, touch.clientY);
          if (card) card = card.closest('[data-uml-table]');
          if (!card) return;
          var tName = card.getAttribute('data-uml-table');
          if (!tName || !cardRects[tName]) return;
          dragTarget = tName;
          var pos = clientToContainer(touch.clientX, touch.clientY);
          dragOffsetX = pos.x - cardRects[tName].x;
          dragOffsetY = pos.y - cardRects[tName].y;
          e.preventDefault();
        }, { passive: false });

        document.addEventListener('touchmove', function(e) {
          if (e.touches.length === 2 && pinchStartDist > 0) {
            var dist = getTouchDist(e.touches[0], e.touches[1]);
            applyZoom(pinchStartScale * (dist / pinchStartDist));
            e.preventDefault();
            return;
          }
          if (!dragTarget) return;
          var touch = e.touches[0];
          var rect = cardRects[dragTarget];
          var pos = clientToContainer(touch.clientX, touch.clientY);
          rect.x = pos.x - dragOffsetX;
          rect.y = pos.y - dragOffsetY;
          var el = cardElements[dragTarget];
          if (el) {
            el.style.left = rect.x + 'px';
            el.style.top = rect.y + 'px';
          }
          drawRelations();
          e.preventDefault();
        }, { passive: false });

        document.addEventListener('touchend', function(e) {
          if (e.touches.length < 2) pinchStartDist = 0;
          dragTarget = null;
        });

        // ホイールズーム（Ctrl+ホイール or トラックパッドピンチ）
        fUmlWrapper.addEventListener('wheel', function(e) {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            var delta = e.deltaY > 0 ? 0.9 : 1.1;
            applyZoom(currentScale * delta);
          }
        }, { passive: false });
      }
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

    (function() {
      var btn = document.getElementById('syncRepoColorsBtn');
      if (!btn) return;
      btn.addEventListener('click', function() {
        if (btn.disabled) return;
        btn.disabled = true;
        btn.classList.add('syncing');
        var origText = btn.innerHTML;
        btn.innerHTML = '<span class="sync-icon">&#x21bb;</span> 同期中...';
        fetch('/api/repo-colors/sync', { method: 'POST', credentials: 'same-origin' })
          .then(function(res) { return res.json(); })
          .then(function(data) {
            btn.classList.remove('syncing');
            if (data.error) {
              btn.innerHTML = '<span class="sync-icon">&#x21bb;</span> ' + escapeHtmlText(data.error);
              setTimeout(function() { btn.innerHTML = origText; btn.disabled = false; }, 3000);
            } else {
              btn.innerHTML = '<span class="sync-icon">&#x21bb;</span> ' + escapeHtmlText(data.message);
              setTimeout(function() { location.reload(); }, 1500);
            }
          })
          .catch(function() {
            btn.classList.remove('syncing');
            btn.innerHTML = '<span class="sync-icon">&#x21bb;</span> 通信エラー';
            setTimeout(function() { btn.innerHTML = origText; btn.disabled = false; }, 3000);
          });
      });
    })();

    // リポジトリグループ管理モーダル
    (function() {
      var modal = document.getElementById('repoGroupModal');
      var openBtn = document.getElementById('openRepoGroupModal');
      var closeBtn = document.getElementById('repoGroupModalClose');
      var listEl = document.getElementById('repoGroupList');
      var createBtn = document.getElementById('createGroupBtn');
      if (!modal || !openBtn) return;

      function showModal() {
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
        loadGroups();
      }
      function hideModal() {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
      }
      openBtn.addEventListener('click', showModal);
      if (closeBtn) closeBtn.addEventListener('click', hideModal);
      modal.addEventListener('click', function(e) {
        if (e.target === modal) hideModal();
      });

      function loadGroups() {
        if (!listEl) return;
        listEl.innerHTML = '<div style="color:var(--text-muted); font-size:13px;">読み込み中...</div>';
        fetch('/api/repo-groups', { credentials: 'same-origin' })
          .then(function(res) { return res.json(); })
          .then(function(data) {
            if (!data.groups || data.groups.length === 0) {
              listEl.innerHTML = '<div style="color:var(--text-muted); font-size:13px;">グループがありません。下のフォームから作成してください。</div>';
              return;
            }
            var html = '';
            data.groups.forEach(function(g) {
              var repoList = (g.repos || []).map(function(r) {
                return '<span style="display:inline-block; padding:2px 8px; background:var(--bg-tertiary, var(--bg-secondary)); border-radius:4px; font-size:12px; margin:2px;">' + escapeHtmlText(r) + '</span>';
              }).join('');
              html += '<div style="border:1px solid var(--border-color); border-radius:8px; padding:12px; margin-bottom:10px;" data-group-id="' + escapeHtmlText(g.id) + '">'
                + '<div class="repo-group-header" style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">'
                + '<div class="repo-group-color-swatch" style="width:16px; height:16px; border-radius:4px; background:' + escapeHtmlText(g.colorCode) + '; flex-shrink:0;"></div>'
                + '<strong style="font-size:14px; color:var(--text-primary);">' + escapeHtmlText(g.name) + '</strong>'
                + (g.description ? '<span style="color:var(--text-muted); font-size:12px;"> — ' + escapeHtmlText(g.description) + '</span>' : '')
                + '<button type="button" class="repo-group-edit-btn" data-id="' + escapeHtmlText(g.id) + '" style="padding:2px 8px; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:4px; font-size:11px; color:var(--text-primary); cursor:pointer;">編集</button>'
                + '<button type="button" class="repo-group-delete-btn" data-id="' + escapeHtmlText(g.id) + '" style="margin-left:auto; background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:16px; padding:2px 6px;" title="削除">&times;</button>'
                + '</div>'
                + '<div class="repo-group-member-area" style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">'
                + '<span style="font-size:12px; color:var(--text-muted);">メンバー:</span>'
                + (repoList || '<span style="font-size:12px; color:var(--text-faint);">なし</span>')
                + '</div>'
                + '</div>';
            });
            listEl.innerHTML = html;

            listEl.querySelectorAll('.repo-group-delete-btn').forEach(function(btn) {
              btn.addEventListener('click', function() {
                var id = btn.getAttribute('data-id');
                if (!confirm('このグループを削除しますか？')) return;
                fetch('/api/repo-groups/' + encodeURIComponent(id), {
                  method: 'DELETE',
                  credentials: 'same-origin',
                }).then(function() { loadGroups(); });
              });
            });

            var groupColorPresets = [
              { label: '青', value: '#667eea' },
              { label: '赤', value: '#e53e3e' },
              { label: '緑', value: '#38a169' },
              { label: 'オレンジ', value: '#ed8936' },
              { label: '紫', value: '#9f7aea' },
              { label: '茶', value: '#dd6b20' },
              { label: 'ティール', value: '#319795' },
              { label: 'ピンク', value: '#d53f8c' },
              { label: '水色', value: '#3182ce' },
              { label: '黄', value: '#d69e2e' },
              { label: '藤', value: '#805ad5' },
              { label: '紺', value: '#2b6cb0' },
              { label: '深赤', value: '#c53030' },
              { label: '深緑', value: '#2f855a' },
              { label: '琥珀', value: '#b7791f' },
            ];

            listEl.querySelectorAll('.repo-group-edit-btn').forEach(function(btn) {
              btn.addEventListener('click', function() {
                var id = btn.getAttribute('data-id');
                var group = data.groups.find(function(g) { return g.id === id; });
                if (!group) return;
                var card = btn.closest('[data-group-id]');
                if (!card) return;
                var headerArea = card.querySelector('.repo-group-header');
                var memberArea = card.querySelector('.repo-group-member-area');
                if (!headerArea || !memberArea) return;
                var currentRepos = (group.repos || []).slice();
                var currentColor = group.colorCode || '#667eea';

                function renderEditHeader() {
                  var presetOpts = groupColorPresets.map(function(p) {
                    var sel = p.value.toLowerCase() === currentColor.toLowerCase() ? ' selected' : '';
                    return '<option value="' + escapeHtmlText(p.value) + '"' + sel + '>' + escapeHtmlText(p.label) + '</option>';
                  }).join('');
                  var hasCustom = !groupColorPresets.some(function(p) { return p.value.toLowerCase() === currentColor.toLowerCase(); });
                  if (hasCustom) {
                    presetOpts += '<option value="' + escapeHtmlText(currentColor) + '" selected>カスタム</option>';
                  }
                  presetOpts += '<option value="__custom__">カスタム...</option>';

                  headerArea.innerHTML = '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">'
                    + '<div class="edit-color-swatch" style="width:24px; height:24px; border-radius:4px; background:' + escapeHtmlText(currentColor) + '; flex-shrink:0; position:relative; cursor:pointer; border:1px solid var(--border-color);">'
                    + '<input type="color" class="edit-color-picker" value="' + escapeHtmlText(currentColor) + '" style="position:absolute; top:0; left:0; width:100%; height:100%; opacity:0; cursor:pointer;">'
                    + '</div>'
                    + '<select class="edit-color-preset" style="padding:4px 8px; border:1px solid var(--border-color); border-radius:4px; background:var(--bg-secondary); color:var(--text-primary); font-size:12px;">'
                    + presetOpts
                    + '</select>'
                    + '<input type="text" class="edit-color-hex" value="' + escapeHtmlText(currentColor) + '" style="width:80px; padding:4px 8px; border:1px solid var(--border-color); border-radius:4px; background:var(--bg-secondary); color:var(--text-primary); font-size:12px; font-family:monospace;" placeholder="#000000">'
                    + '<span style="flex:1;"></span>'
                    + '<strong style="font-size:14px; color:var(--text-primary);">' + escapeHtmlText(group.name) + '</strong>'
                    + (group.description ? '<span style="color:var(--text-muted); font-size:12px;"> — ' + escapeHtmlText(group.description) + '</span>' : '')
                    + '<button type="button" class="repo-group-delete-btn" data-id="' + escapeHtmlText(id) + '" style="margin-left:auto; background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:16px; padding:2px 6px;" title="削除">&times;</button>'
                    + '</div>';

                  function updateColor(newColor) {
                    if (!/^#[0-9a-fA-F]{6}$/.test(newColor)) return;
                    currentColor = newColor;
                    var swatch = headerArea.querySelector('.edit-color-swatch');
                    var picker = headerArea.querySelector('.edit-color-picker');
                    var hexInput = headerArea.querySelector('.edit-color-hex');
                    var preset = headerArea.querySelector('.edit-color-preset');
                    if (swatch) swatch.style.background = newColor;
                    if (picker) picker.value = newColor;
                    if (hexInput) hexInput.value = newColor;
                    if (preset) {
                      var matched = false;
                      for (var i = 0; i < preset.options.length; i++) {
                        if (preset.options[i].value.toLowerCase() === newColor.toLowerCase()) {
                          preset.selectedIndex = i;
                          matched = true;
                          break;
                        }
                      }
                      if (!matched) {
                        var customOpt = preset.querySelector('option[value="__custom__"]');
                        if (customOpt) {
                          customOpt.value = newColor;
                          customOpt.textContent = 'カスタム';
                          customOpt.selected = true;
                        }
                      }
                    }
                  }

                  var picker = headerArea.querySelector('.edit-color-picker');
                  if (picker) picker.addEventListener('input', function() { updateColor(picker.value); });

                  var preset = headerArea.querySelector('.edit-color-preset');
                  if (preset) {
                    preset.addEventListener('change', function() {
                      if (preset.value === '__custom__') {
                        if (picker) picker.click();
                        return;
                      }
                      updateColor(preset.value);
                    });
                  }

                  var hexInput = headerArea.querySelector('.edit-color-hex');
                  if (hexInput) {
                    hexInput.addEventListener('change', function() {
                      var val = hexInput.value.trim();
                      if (/^[0-9a-fA-F]{6}$/.test(val)) val = '#' + val;
                      updateColor(val);
                    });
                  }

                  var delBtn = headerArea.querySelector('.repo-group-delete-btn');
                  if (delBtn) {
                    delBtn.addEventListener('click', function() {
                      if (!confirm('このグループを削除しますか？')) return;
                      fetch('/api/repo-groups/' + encodeURIComponent(id), {
                        method: 'DELETE', credentials: 'same-origin',
                      }).then(function() { loadGroups(); });
                    });
                  }
                }

                function renderEditMembers() {
                  var badgesHtml = currentRepos.map(function(r) {
                    return '<span style="display:inline-flex; align-items:center; gap:4px; padding:2px 8px; background:var(--bg-tertiary, var(--bg-secondary)); border-radius:4px; font-size:12px; margin:2px;">'
                      + escapeHtmlText(r)
                      + '<button type="button" class="repo-member-remove" data-repo="' + escapeHtmlText(r) + '" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:14px; padding:0 2px; line-height:1;" title="除外">&times;</button>'
                      + '</span>';
                  }).join('');

                  var availableRepos = (typeof allRepoNames !== 'undefined' ? allRepoNames : []).filter(function(r) {
                    return currentRepos.indexOf(r) === -1;
                  });
                  var selectHtml = '<select class="repo-member-select" style="padding:4px 8px; border:1px solid var(--border-color); border-radius:4px; background:var(--bg-secondary); color:var(--text-primary); font-size:12px; max-width:220px;">'
                    + '<option value="">リポジトリを選択...</option>'
                    + availableRepos.map(function(r) { return '<option value="' + escapeHtmlText(r) + '">' + escapeHtmlText(r) + '</option>'; }).join('')
                    + '</select>';

                  memberArea.innerHTML = '<div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-bottom:8px;">'
                    + '<span style="font-size:12px; color:var(--text-muted);">メンバー:</span>'
                    + (badgesHtml || '<span style="font-size:12px; color:var(--text-faint);">なし</span>')
                    + '</div>'
                    + '<div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">'
                    + selectHtml
                    + '<button type="button" class="repo-member-add-btn" style="padding:4px 10px; background:#667eea; color:#fff; border:none; border-radius:4px; font-size:12px; cursor:pointer;">追加</button>'
                    + '<input type="text" class="repo-member-text" placeholder="手入力で追加" style="padding:4px 8px; border:1px solid var(--border-color); border-radius:4px; background:var(--bg-secondary); color:var(--text-primary); font-size:12px; width:150px;">'
                    + '<button type="button" class="repo-member-text-add-btn" style="padding:4px 10px; background:var(--bg-secondary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; font-size:12px; cursor:pointer;">追加</button>'
                    + '<span style="flex:1;"></span>'
                    + '<button type="button" class="repo-member-save-btn" style="padding:4px 12px; background:#38a169; color:#fff; border:none; border-radius:4px; font-size:12px; cursor:pointer;">保存</button>'
                    + '<button type="button" class="repo-member-cancel-btn" style="padding:4px 10px; background:var(--bg-secondary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; font-size:12px; cursor:pointer;">キャンセル</button>'
                    + '</div>';

                  memberArea.querySelectorAll('.repo-member-remove').forEach(function(rb) {
                    rb.addEventListener('click', function() {
                      var repo = rb.getAttribute('data-repo');
                      currentRepos = currentRepos.filter(function(r) { return r !== repo; });
                      renderEditMembers();
                    });
                  });

                  var addBtn = memberArea.querySelector('.repo-member-add-btn');
                  var sel = memberArea.querySelector('.repo-member-select');
                  if (addBtn && sel) {
                    addBtn.addEventListener('click', function() {
                      var val = sel.value;
                      if (val && currentRepos.indexOf(val) === -1) {
                        currentRepos.push(val);
                        renderEditMembers();
                      }
                    });
                    sel.addEventListener('change', function() {
                      var val = sel.value;
                      if (val && currentRepos.indexOf(val) === -1) {
                        currentRepos.push(val);
                        renderEditMembers();
                      }
                    });
                  }

                  var textInput = memberArea.querySelector('.repo-member-text');
                  var textAddBtn = memberArea.querySelector('.repo-member-text-add-btn');
                  function addFromText() {
                    if (!textInput) return;
                    var val = textInput.value.trim();
                    if (val && currentRepos.indexOf(val) === -1) {
                      currentRepos.push(val);
                      renderEditMembers();
                    }
                  }
                  if (textAddBtn) textAddBtn.addEventListener('click', addFromText);
                  if (textInput) textInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); addFromText(); } });

                  var saveBtn = memberArea.querySelector('.repo-member-save-btn');
                  if (saveBtn) {
                    saveBtn.addEventListener('click', function() {
                      saveBtn.disabled = true;
                      saveBtn.textContent = '保存中...';
                      var patchBody = { repos: currentRepos };
                      if (currentColor !== group.colorCode) patchBody.colorCode = currentColor;
                      fetch('/api/repo-groups/' + encodeURIComponent(id), {
                        method: 'PATCH',
                        credentials: 'same-origin',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(patchBody),
                      }).then(function() { loadGroups(); });
                    });
                  }

                  var cancelBtn = memberArea.querySelector('.repo-member-cancel-btn');
                  if (cancelBtn) cancelBtn.addEventListener('click', function() { loadGroups(); });
                }

                renderEditHeader();
                renderEditMembers();
              });
            });
          })
          .catch(function() {
            listEl.innerHTML = '<div style="color:#e53e3e; font-size:13px;">読み込みに失敗しました</div>';
          });
      }

      if (createBtn) {
        createBtn.addEventListener('click', function() {
          var nameInput = document.getElementById('newGroupName');
          var colorInput = document.getElementById('newGroupColor');
          var descInput = document.getElementById('newGroupDesc');
          var name = nameInput ? nameInput.value.trim() : '';
          if (!name) { alert('グループ名を入力してください'); return; }
          var body = {
            name: name,
            colorCode: colorInput ? colorInput.value : '#667eea',
            description: descInput ? descInput.value.trim() : '',
          };
          createBtn.disabled = true;
          fetch('/api/repo-groups', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
            .then(function(res) { return res.json(); })
            .then(function(data) {
              createBtn.disabled = false;
              if (data.error) { alert(data.error); return; }
              if (nameInput) nameInput.value = '';
              if (descInput) descInput.value = '';
              loadGroups();
            })
            .catch(function() {
              createBtn.disabled = false;
              alert('作成に失敗しました');
            });
        });
      }
    })();

    /* ============ ボトムパネル開閉 + ドラッグ + 傾き検知 ============ */
    (function() {
      function getCookie(name) {
        var m = document.cookie.match('(^|;)\\\\s*' + name + '=([^;]*)');
        return m ? decodeURIComponent(m[2]) : null;
      }

      function setupPanel(bodyId, handleId, toggleId) {
        var body = document.getElementById(bodyId);
        var handle = document.getElementById(handleId);
        var toggleBtn = document.getElementById(toggleId);
        if (!body || !handle) return null;

        var isOpen = true;
        var naturalHeight = 0;
        var currentMaxH = 0;
        var startY = 0;
        var startMaxH = 0;
        var dragging = false;

        function measureNatural() {
          body.style.transition = 'none';
          body.style.maxHeight = 'none';
          naturalHeight = body.scrollHeight;
          body.style.maxHeight = naturalHeight + 'px';
          body.offsetHeight;
          body.style.transition = '';
        }

        function setOpen(open, animate) {
          isOpen = open;
          if (animate === false) body.style.transition = 'none';
          if (open) {
            measureNatural();
            currentMaxH = naturalHeight;
            body.style.maxHeight = naturalHeight + 'px';
          } else {
            currentMaxH = 0;
            body.style.maxHeight = '0px';
          }
          if (animate === false) { body.offsetHeight; body.style.transition = ''; }
          if (toggleBtn) toggleBtn.textContent = open ? 'close' : 'open';
        }

        function setMaxH(h) {
          if (naturalHeight === 0) measureNatural();
          currentMaxH = Math.max(0, Math.min(h, naturalHeight));
          body.style.transition = 'none';
          body.style.maxHeight = currentMaxH + 'px';
          isOpen = currentMaxH > 0;
          if (toggleBtn) toggleBtn.textContent = isOpen ? 'close' : 'open';
        }

        function onStart(clientY) {
          if (naturalHeight === 0) measureNatural();
          startY = clientY;
          startMaxH = currentMaxH;
          dragging = true;
        }
        function onMove(clientY) {
          if (!dragging) return;
          var dy = startY - clientY;
          setMaxH(startMaxH + dy);
        }
        function onEnd() {
          if (!dragging) return;
          dragging = false;
          body.style.transition = '';
          if (currentMaxH < 20) {
            setOpen(false, true);
          } else if (currentMaxH > naturalHeight - 20) {
            setOpen(true, true);
          }
        }

        handle.addEventListener('mousedown', function(e) { e.preventDefault(); onStart(e.clientY); });
        document.addEventListener('mousemove', function(e) { if (dragging) { e.preventDefault(); onMove(e.clientY); } });
        document.addEventListener('mouseup', onEnd);
        handle.addEventListener('touchstart', function(e) { if (e.touches.length === 1) onStart(e.touches[0].clientY); }, { passive: true });
        document.addEventListener('touchmove', function(e) { if (dragging && e.touches.length === 1) onMove(e.touches[0].clientY); }, { passive: false });
        document.addEventListener('touchend', onEnd);

        if (toggleBtn) {
          toggleBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            setOpen(!isOpen, true);
          });
        }

        setTimeout(function() { measureNatural(); currentMaxH = naturalHeight; }, 100);

        return { setOpen: setOpen };
      }

      var mainCtrl = setupPanel('umlPanelBody', 'umlPanelHandle', 'umlPanelToggle');
      var filteredCtrl = setupPanel('filteredUmlPanelBody', 'filteredUmlPanelHandle', 'filteredUmlPanelToggle');

      /* ============ デバイス傾き検知 ============ */
      var tiltEnabled = getCookie('er_tilt_enabled') === 'on';
      var lastTiltPos = null;

      function handleOrientation(event) {
        if (!tiltEnabled) return;
        var beta = event.beta;
        if (beta === null || beta === undefined) return;
        var open;
        if (beta < 30) {
          open = true;
        } else if (beta > 60) {
          open = false;
        } else {
          return;
        }
        var pos = open ? 'open' : 'closed';
        if (pos === lastTiltPos) return;
        lastTiltPos = pos;
        if (mainCtrl) mainCtrl.setOpen(open, true);
        if (filteredCtrl) filteredCtrl.setOpen(open, true);
      }

      if (tiltEnabled && window.DeviceOrientationEvent) {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
          document.addEventListener('click', function reqPerm() {
            DeviceOrientationEvent.requestPermission().then(function(state) {
              if (state === 'granted') {
                window.addEventListener('deviceorientation', handleOrientation);
              }
            }).catch(function(){});
            document.removeEventListener('click', reqPerm);
          }, { once: true });
        } else {
          window.addEventListener('deviceorientation', handleOrientation);
        }
      }

      window.__erTiltUpdate = function(enabled) {
        tiltEnabled = enabled;
        if (enabled && window.DeviceOrientationEvent) {
          if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission().then(function(state) {
              if (state === 'granted') {
                window.addEventListener('deviceorientation', handleOrientation);
              }
            }).catch(function(){});
          } else {
            window.addEventListener('deviceorientation', handleOrientation);
          }
        } else {
          window.removeEventListener('deviceorientation', handleOrientation);
          lastTiltPos = null;
        }
      };
    })();
  </script>
</body>
</html>`;
}
