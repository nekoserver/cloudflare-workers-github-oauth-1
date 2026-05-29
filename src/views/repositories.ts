/**
 * リポジトリ一覧ページのHTML
 */
import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

export interface RepositoryListItem {
  owner: string;
  name: string;
  htmlUrl: string;
  description?: string | null;
  language?: string | null;
  stars: number;
  forks: number;
  updatedAt: string;
  isPrivate: boolean;
  latestCommitSha?: string | null;
  latestCommitUrl?: string | null;
}

export interface RepoPermissionInfo {
  permissions: Record<string, string>;
  repositorySelection: string;
}

export interface CloudflareSetupPendingItem {
  id: number;
  repoOwner: string;
  repoName: string;
  repoFullName: string;
  isPrivate: boolean;
  createdAt: string;
}

export function getRepositoriesPage(user: {
  name?: string;
  username: string;
  repositories: RepositoryListItem[];
  errorMessage?: string | null;
  grantedScopes?: string[] | null;
  repoPermissions?: Record<string, RepoPermissionInfo> | null;
  cloudflareLinkedRepos?: Record<string, boolean> | null;
  vercelLinkedRepos?: Record<string, boolean> | null;
  slackLinkedRepos?: Record<string, boolean> | null;
  commitHistoryPageSize: number;
  cloudflareSetupPending?: CloudflareSetupPendingItem[];
}): string {
  const displayName = escapeHtml(user.name || user.username);
  const initials = escapeHtml((user.name || user.username).substring(0, 2).toUpperCase());
  const repoCount = user.repositories.length;
  const scopes = user.grantedScopes ?? [];
  const hasRepoScope = scopes.includes('repo');
  // GitHub App はスコープを返さない（空配列が正常）ため、
  // スコープが空の場合はバナーを出さない（GitHub App のパーミッションで制御される）
  // classic OAuth App でスコープが取得できている場合のみ repo 欠如を警告する
  const missingScopesBanner = scopes.length > 0 && !hasRepoScope;
  const repoPerms = user.repoPermissions ?? {};
  const cfLinked = user.cloudflareLinkedRepos ?? {};
  const vercelLinked = user.vercelLinkedRepos ?? {};
  const slackLinked = user.slackLinkedRepos ?? {};
  const commitHistoryPageSize = Number.isFinite(user.commitHistoryPageSize) && user.commitHistoryPageSize > 0
    ? user.commitHistoryPageSize
    : 10;

  // リポジトリごとのインストール権限をJSON化してクライアントサイドで利用
  const repoPermsJson = JSON.stringify(repoPerms);

  const repoRows = user.repositories.map((repo) => {
    const owner = escapeHtml(repo.owner);
    const name = escapeHtml(repo.name);
    const description = repo.description ? escapeHtml(repo.description) : '説明なし';
    const language = repo.language ? escapeHtml(repo.language) : '不明';
    const updatedAt = escapeHtml(repo.updatedAt);
    const privacyBadge = repo.isPrivate ? '<span class="badge private">Private</span>' : '<span class="badge public">Public</span>';
    const cfBadge = cfLinked[repo.name]
      ? '<span class="badge cf-linked" title="Cloudflare 連携済み">☁️ Cloudflare</span>'
      : '';
    const vercelBadge = vercelLinked[repo.name]
      ? '<span class="badge vercel-linked" title="Vercel 連携済み">▲ Vercel</span>'
      : '';
    const slackBadge = slackLinked[repo.name]
      ? '<span class="badge slack-linked" title="Slack 連携済み">💬 Slack</span>'
      : '';
    const repoLink = `
      <a class="repo-name-link" href="${repo.htmlUrl}" target="_blank" rel="noreferrer">
        ${name}
      </a>
    `;
    const commitLink = repo.latestCommitSha && repo.latestCommitUrl
      ? `<a class="repo-meta-link" href="${repo.latestCommitUrl}" target="_blank" rel="noreferrer">🔗 ${escapeHtml(repo.latestCommitSha.substring(0, 7))}</a>`
      : `<span class="repo-meta-muted">🔗 なし</span>`;
    return `
      <div class="repo-row" data-owner="${owner}" data-repo="${name}" data-updated="${repo.updatedAt}" data-description="${repo.description ? escapeHtml(repo.description) : ''}" data-language="${language}" data-stars="${repo.stars}" data-forks="${repo.forks}" data-private="${repo.isPrivate}" data-commit-sha="${repo.latestCommitSha ? escapeHtml(repo.latestCommitSha.substring(0, 7)) : ''}" data-commit-url="${repo.latestCommitUrl ? escapeHtml(repo.latestCommitUrl) : ''}">
        <div class="repo-main">
          <div class="repo-title">
            <h3 class="repo-name">${repoLink}</h3>
            ${privacyBadge}
            ${cfBadge}
            ${vercelBadge}
            ${slackBadge}
          </div>
          <p class="repo-description">${description}</p>
        </div>
        <div class="repo-meta">
          <span class="repo-meta-item">🧩 ${language}</span>
          <span class="repo-meta-item">⭐ ${repo.stars}</span>
          <span class="repo-meta-item">🍴 ${repo.forks}</span>
          <span class="repo-meta-item">🕒 ${updatedAt}</span>
          <span class="repo-issues-pill repo-meta-item" data-issues-pill="1">🐛 Issue+PR: 取得中...</span>
          <span class="repo-meta-item">${commitLink}</span>
        </div>
      </div>
    `;
  }).join('');

  const errorBanner = user.errorMessage ? `
    <div class="error-banner">${escapeHtml(user.errorMessage)}</div>
  ` : '';

  const currentScopesText = `現在の付与スコープ: ${scopes.join(', ')}`;
  const missingScopeBannerTitle = 'repo スコープが不足しています';
  const missingScopeBannerDesc = `リポジトリの作成・閲覧には <code>repo</code> スコープが必要ですが、付与されていません。再認証して <code>repo</code> スコープを付与してください。（${currentScopesText}）`;
  const missingScopeBannerHtml = missingScopesBanner ? `
    <div class="missing-scope-banner">
      <span class="missing-scope-banner-icon">⚠️</span>
      <div class="missing-scope-banner-text">
        <div class="missing-scope-banner-title">${missingScopeBannerTitle}</div>
        <div class="missing-scope-banner-desc">${missingScopeBannerDesc}</div>
      </div>
      <a href="/auth/github/reauthorize?return_to=/repositories" class="reauth-btn">
        <svg viewBox="0 0 16 16"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
        権限を追加して再認証
      </a>
    </div>
  ` : '';

  // Cloudflare セットアップ通知
  const cfPending = user.cloudflareSetupPending ?? [];
  const cfPendingJson = JSON.stringify(cfPending);

  const cfPendingBannerHtml = cfPending.length > 0 ? `
    <div class="cf-setup-banner" id="cfSetupBanner">
      <div class="cf-setup-banner-icon">☁️</div>
      <div class="cf-setup-banner-content">
        <div class="cf-setup-banner-title">Cloudflare 連携が未設定のリポジトリがあります</div>
        <div class="cf-setup-banner-desc">
          ${cfPending.map((p) => `<strong>${escapeHtml(p.repoName)}</strong>`).join('、')}
          — Cloudflare Pages でビルド＆デプロイを設定できます。
        </div>
        <div class="cf-setup-banner-actions">
          <button class="cf-setup-btn" id="cfSetupOpenBtn" type="button">セットアップを開始する</button>
          <button class="cf-setup-dismiss-btn" id="cfSetupDismissAllBtn" type="button">後で</button>
        </div>
      </div>
    </div>
  ` : '';

  const emptyState = !user.errorMessage && repoCount === 0 ? `
    <div class="empty-state">表示できるリポジトリがありません。</div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>リポジトリ - Cloudflare Workers GitHub OAuth</title>
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
      padding: 12px 24px;
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
    .container { width: 100%; margin: 0 auto; padding: 28px 24px 40px; }
    .page-header {
      background: var(--card-bg); border-radius: 16px;
      box-shadow: 0 20px 60px var(--card-shadow); padding: 24px; margin-bottom: 16px;
    }
    .page-title { font-size: 32px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
    .page-subtitle { font-size: 16px; color: var(--text-muted); }
    .error-banner {
      background: #fed7d7; color: #c53030; border-radius: 12px; padding: 12px 16px;
      font-size: 14px; font-weight: 600; margin-top: 16px;
    }
    .repo-list { display: flex; flex-direction: column; gap: 10px; }
    .repo-list-header {
      display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 16px;
      padding: 0 6px; margin-bottom: 4px; align-items: center;
      color: var(--text-primary); font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;
    }
    .repo-list-header span { opacity: 0.7; }
    .sort-button {
      background: transparent; border: none; padding: 0; color: var(--text-primary);
      font: inherit; font-weight: 800; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;
    }
    .sort-button:hover { color: var(--text-secondary); }
    .sort-indicator {
      display: inline-flex; align-items: center; justify-content: center;
      width: 20px; height: 20px; border-radius: 999px; background: var(--badge-bg);
      font-size: 12px; line-height: 1;
    }
    .repo-row {
      background: var(--card-bg); border-radius: 14px; padding: 16px 18px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.15); color: inherit;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 16px; align-items: center;
    }
    .repo-row:hover { transform: translateY(-2px); box-shadow: 0 16px 36px rgba(0,0,0,0.2); }
    .repo-title { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .repo-name { font-size: 20px; font-weight: 700; color: var(--text-secondary); }
    .repo-name-link {
      color: inherit; text-decoration: none; border-bottom: 2px solid transparent; transition: border-color 0.2s ease;
    }
    .repo-name-link:hover { border-color: var(--accent-color); }
    .badge {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 700;
    }
    .badge.private { background: #feb2b2; color: #9b2c2c; }
    .badge.public { background: #9ae6b4; color: #276749; }
    .badge.cf-linked { background: #fbd38d; color: #744210; }
    .badge.vercel-linked { background: #1a1a1a; color: #ffffff; }
    .badge.slack-linked { background: #4a154b; color: #ffffff; }
    .repo-description { font-size: 14px; color: var(--text-muted); min-height: 22px; }
    .repo-meta { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; color: var(--text-muted); justify-content: flex-end; }
    .repo-meta-item { background: var(--badge-bg); padding: 4px 10px; border-radius: 999px; }
    .repo-issues-pill { padding: 4px 10px; border-radius: 999px; font-weight: 700; }
    .repo-issues-pill.has-issues { background: #fed7e2; color: #97266d; }
    .repo-issues-pill.no-issues { background: #c6f6d5; color: #22543d; }
    .repo-meta-link { color: #2b6cb0; text-decoration: none; font-weight: 700; }
    .repo-meta-link:hover { text-decoration: underline; }
    .repo-meta-muted { color: var(--text-faint); font-weight: 700; }
    @media (max-width: 860px) {
      .container { padding: 22px 16px 32px; }
      .repo-list-header { display: none; }
      .repo-row { grid-template-columns: 1fr; }
      .repo-meta { justify-content: flex-start; }
      .repo-title { flex-wrap: wrap; }
    }
    .empty-state {
      background: var(--card-bg); border-radius: 12px; padding: 16px; text-align: center;
      color: var(--text-muted); font-weight: 600;
    }
    .repo-row { cursor: pointer; }

    /* Group Filter Select */
    .repo-group-filter-select {
      padding: 7px 12px; font-size: 13px; font-weight: 500;
      color: var(--text-primary); background: var(--bg-secondary);
      border: 1px solid var(--border-color); border-radius: 8px;
      cursor: pointer; max-width: 200px;
      transition: border-color 0.15s;
    }
    .repo-group-filter-select:hover { border-color: var(--text-muted); }
    .repo-group-filter-select:focus { outline: none; border-color: var(--accent-color, #667eea); box-shadow: 0 0 0 2px rgba(102,126,234,0.2); }

    /* Create Repo Button */
    .color-assign-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 16px; border-radius: 8px;
      border: 1px solid var(--border-color); background: var(--bg-secondary);
      color: var(--text-primary); font-size: 14px; font-weight: 600; cursor: pointer;
      transition: background 0.2s ease, border-color 0.2s ease;
    }
    .color-assign-btn:hover { background: var(--bg-tertiary, var(--border-color)); border-color: var(--text-muted); }
    .create-repo-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 16px; border-radius: 8px; border: none;
      background: linear-gradient(135deg, #48bb78, #38a169); color: #fff;
      font-size: 14px; font-weight: 700; cursor: pointer;
      transition: opacity 0.2s ease, transform 0.15s ease;
      box-shadow: 0 2px 8px rgba(72,187,120,0.3);
    }
    .create-repo-btn:hover { opacity: 0.9; transform: translateY(-1px); }
    .create-repo-btn:active { transform: translateY(0); }

    /* Color Assignment Modal */
    .color-assign-modal-content {
      background: var(--card-bg); border-radius: 16px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.3); width: 100%; max-width: 640px;
      max-height: 85vh; display: flex; flex-direction: column;
      animation: modalIn 0.2s ease;
    }
    .color-assign-list {
      display: flex; flex-direction: column; gap: 8px;
      overflow-y: auto; max-height: 55vh; padding: 0 24px 24px;
    }
    .color-assign-item {
      display: flex; align-items: center; gap: 12px;
      background: var(--bg-secondary); border-radius: 10px; padding: 10px 14px;
      border: 1px solid var(--border-color); transition: border-color 0.2s;
    }
    .color-assign-item:hover { border-color: var(--text-muted); }
    .color-assign-swatch {
      width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0;
      border: 2px solid rgba(0,0,0,0.1); cursor: pointer; position: relative;
    }
    .color-assign-swatch input[type="color"] {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      opacity: 0; cursor: pointer; border: none;
    }
    .color-assign-repo-name {
      flex: 1; min-width: 0; font-size: 14px; font-weight: 600;
      color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .color-assign-select {
      padding: 5px 8px; border-radius: 6px; border: 1px solid var(--border-color);
      background: var(--card-bg); color: var(--text-primary); font-size: 12px;
      cursor: pointer; min-width: 100px;
    }
    .color-assign-tags {
      padding: 5px 8px; border-radius: 6px; border: 1px solid var(--border-color);
      background: var(--card-bg); color: var(--text-primary); font-size: 12px;
      width: 80px;
    }
    .color-assign-save-status {
      font-size: 11px; color: var(--text-muted); min-width: 50px; text-align: right;
    }
    .color-assign-footer {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 24px; border-top: 1px solid var(--border-color);
    }
    .color-assign-sync-btn {
      padding: 6px 14px; border-radius: 6px; border: none;
      background: linear-gradient(135deg, #667eea, #764ba2); color: #fff;
      font-size: 12px; font-weight: 700; cursor: pointer;
      transition: opacity 0.2s;
    }
    .color-assign-sync-btn:hover { opacity: 0.9; }
    .color-assign-sync-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .page-header-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }

    /* Approval Status Modal */
    .approval-modal-content {
      background: var(--card-bg); border-radius: 16px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.3); width: 100%; max-width: 640px;
      max-height: 85vh; display: flex; flex-direction: column;
      animation: modalIn 0.2s ease;
    }
    .approval-modal-header {
      padding: 20px 24px 14px; border-bottom: 1px solid var(--border-color);
      display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;
    }
    .approval-modal-body {
      padding: 16px 24px 24px; overflow-y: auto; flex: 1; min-height: 0;
    }
    .approval-section { margin-bottom: 20px; }
    .approval-section-title {
      font-size: 13px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;
      letter-spacing: 0.05em; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;
    }
    .approval-card {
      background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 10px;
      padding: 12px 14px; margin-bottom: 8px;
    }
    .approval-card-row {
      display: flex; justify-content: space-between; align-items: center; gap: 8px;
    }
    .approval-card-label { font-size: 13px; font-weight: 600; color: var(--text-primary); }
    .approval-card-value { font-size: 13px; color: var(--text-muted); }
    .approval-badge {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700;
    }
    .approval-badge.ok { background: #c6f6d5; color: #22543d; }
    .approval-badge.warn { background: #fefcbf; color: #744210; }
    .approval-badge.none { background: var(--badge-bg); color: var(--text-muted); }
    .approval-badge.error { background: #fed7d7; color: #9b2c2c; }
    .approval-repo-list {
      display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;
    }
    .approval-repo-chip {
      font-size: 11px; padding: 2px 8px; border-radius: 999px;
      background: var(--badge-bg); color: var(--text-muted); font-weight: 600;
    }
    .approval-repo-chip.clickable {
      cursor: pointer; transition: background 0.15s, color 0.15s;
      border: 1px solid transparent;
    }
    .approval-repo-chip.clickable:hover {
      background: var(--accent-color); color: #fff; border-color: var(--accent-color);
    }
    .approval-repo-chip.active {
      background: #c6f6d5; color: #22543d; border-color: #9ae6b4;
    }

    /* Repo Detail Modal (nested inside approval modal) */
    .repo-detail-overlay {
      position: fixed; inset: 0; z-index: 10001; display: flex;
      align-items: center; justify-content: center; background: rgba(0,0,0,0.45);
      opacity: 0; pointer-events: none; transition: opacity 0.2s;
    }
    .repo-detail-overlay.show { opacity: 1; pointer-events: auto; }
    .repo-detail-content {
      background: var(--card-bg); border-radius: 16px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.35); width: 100%; max-width: 560px;
      max-height: 85vh; display: flex; flex-direction: column;
      animation: modalIn 0.2s ease;
    }
    .repo-detail-header {
      padding: 18px 22px 12px; border-bottom: 1px solid var(--border-color);
      display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;
    }
    .repo-detail-body {
      padding: 16px 22px 22px; overflow-y: auto; flex: 1; min-height: 0;
    }
    .repo-detail-notice {
      background: linear-gradient(135deg, rgba(237,137,54,0.10) 0%, rgba(246,173,85,0.08) 100%);
      border: 1px solid rgba(237,137,54,0.25); border-radius: 10px;
      padding: 14px 16px; margin-top: 16px; font-size: 12px;
      color: var(--text-primary); line-height: 1.6;
    }
    .repo-detail-notice-title {
      font-weight: 700; font-size: 13px; margin-bottom: 6px;
      display: flex; align-items: center; gap: 6px;
    }
    .repo-detail-links {
      margin-top: 14px; display: flex; flex-direction: column; gap: 8px;
    }
    .repo-detail-link {
      display: flex; align-items: center; gap: 8px; padding: 10px 14px;
      background: var(--bg-secondary); border: 1px solid var(--border-color);
      border-radius: 8px; text-decoration: none; color: var(--text-primary);
      font-size: 13px; font-weight: 600; transition: background 0.15s;
    }
    .repo-detail-link:hover { background: var(--card-bg); }
    .repo-detail-link-icon { font-size: 18px; flex-shrink: 0; }
    .repo-detail-link-desc {
      font-size: 11px; font-weight: 400; color: var(--text-muted); margin-top: 2px;
    }
    .approval-refresh-btn {
      padding: 4px 12px; border-radius: 6px; border: 1px solid var(--border-color);
      background: transparent; color: var(--text-muted); font-size: 12px; cursor: pointer;
      transition: background 0.2s;
    }
    .approval-refresh-btn:hover { background: var(--bg-secondary); }

    /* Add OAuth App Modal */
    .add-app-overlay {
      position: fixed; inset: 0; z-index: 10002; display: flex;
      align-items: center; justify-content: center; background: rgba(0,0,0,0.5);
      opacity: 0; pointer-events: none; transition: opacity 0.2s;
    }
    .add-app-overlay.show { opacity: 1; pointer-events: auto; }
    .add-app-dialog {
      background: var(--card-bg); border-radius: 14px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.35); width: 100%; max-width: 420px;
      max-height: 80vh; display: flex; flex-direction: column;
      animation: modalIn 0.15s ease;
    }
    .add-app-dialog-header {
      padding: 16px 20px 12px; border-bottom: 1px solid var(--border-color);
      display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;
    }
    .add-app-dialog-body { padding: 14px 20px 20px; overflow-y: auto; flex: 1; min-height: 0; }
    .add-app-input {
      width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 8px;
      border: 1px solid var(--border-color); background: var(--bg-secondary);
      color: var(--text-primary); font-size: 14px; font-weight: 600;
      outline: none; transition: border-color 0.15s;
    }
    .add-app-input:focus { border-color: var(--accent-color); }
    .add-app-note-input {
      width: 100%; box-sizing: border-box; padding: 8px 12px; border-radius: 8px;
      border: 1px solid var(--border-color); background: var(--bg-secondary);
      color: var(--text-primary); font-size: 12px; outline: none; margin-top: 8px;
    }
    .add-app-repo-list {
      margin-top: 10px; max-height: 220px; overflow-y: auto;
      border: 1px solid var(--border-color); border-radius: 8px;
    }
    .add-app-repo-item {
      padding: 8px 12px; cursor: pointer; font-size: 13px;
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 1px solid var(--border-color); transition: background 0.1s;
    }
    .add-app-repo-item:last-child { border-bottom: none; }
    .add-app-repo-item:hover { background: var(--bg-secondary); }
    .add-app-repo-item.selected { background: #c6f6d5; }
    .add-app-repo-name { font-weight: 600; color: var(--text-primary); }
    .add-app-repo-date { font-size: 11px; color: var(--text-faint); }
    .add-app-sort-toggle {
      display: flex; align-items: center; gap: 6px; margin-top: 8px; margin-bottom: 4px;
      font-size: 11px; color: var(--text-muted);
    }
    .add-app-sort-toggle label { cursor: pointer; display: flex; align-items: center; gap: 4px; }
    .add-app-sort-toggle input[type="checkbox"] {
      width: 32px; height: 18px; appearance: none; -webkit-appearance: none;
      background: var(--border-color); border-radius: 9px; position: relative;
      cursor: pointer; transition: background 0.2s; flex-shrink: 0;
    }
    .add-app-sort-toggle input[type="checkbox"]::after {
      content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px;
      background: white; border-radius: 50%; transition: transform 0.2s;
    }
    .add-app-sort-toggle input[type="checkbox"]:checked { background: var(--accent-color); }
    .add-app-sort-toggle input[type="checkbox"]:checked::after { transform: translateX(14px); }
    .add-app-actions {
      margin-top: 14px; display: flex; gap: 8px; justify-content: flex-end;
    }
    .add-app-btn {
      padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 600;
      cursor: pointer; border: 1px solid var(--border-color); transition: background 0.15s;
    }
    .add-app-btn.primary {
      background: var(--accent-color); color: #fff; border-color: var(--accent-color);
    }
    .add-app-btn.primary:hover { opacity: 0.9; }
    .add-app-btn.cancel { background: transparent; color: var(--text-muted); }
    .add-app-btn.cancel:hover { background: var(--bg-secondary); }

    @media (max-width: 500px) {
    }

    /* Cloudflare Setup Banner */
    .cf-setup-banner {
      display: flex; gap: 14px; align-items: flex-start;
      background: linear-gradient(135deg, rgba(246,173,85,0.12) 0%, rgba(237,137,54,0.10) 100%);
      border: 1px solid rgba(237,137,54,0.3);
      border-radius: 12px; padding: 16px 18px; margin-top: 16px;
    }
    .cf-setup-banner-icon { font-size: 28px; flex-shrink: 0; }
    .cf-setup-banner-content { flex: 1; min-width: 0; }
    .cf-setup-banner-title {
      font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;
    }
    .cf-setup-banner-desc {
      font-size: 13px; color: var(--text-muted); line-height: 1.5; margin-bottom: 12px;
    }
    .cf-setup-banner-actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .cf-setup-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 18px; border-radius: 8px; border: none;
      background: linear-gradient(135deg, #f6ad55, #ed8936); color: #fff;
      font-size: 13px; font-weight: 700; cursor: pointer;
      transition: opacity 0.2s ease, transform 0.15s ease;
      box-shadow: 0 2px 8px rgba(237,137,54,0.3);
    }
    .cf-setup-btn:hover { opacity: 0.9; transform: translateY(-1px); }
    .cf-setup-btn:active { transform: translateY(0); }
    .cf-setup-dismiss-btn {
      padding: 8px 18px; border-radius: 8px;
      border: 1px solid var(--border-color); background: transparent;
      color: var(--text-muted); font-size: 13px; font-weight: 600; cursor: pointer;
      transition: background 0.2s ease;
    }
    .cf-setup-dismiss-btn:hover { background: var(--bg-secondary); }

    /* Cloudflare Setup Modal */
    .cf-setup-modal-content {
      background: var(--card-bg); border-radius: 16px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.3); width: 100%; max-width: 540px;
      max-height: 90vh; overflow-y: auto;
    }
    .cf-setup-repo-list {
      display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px;
    }
    .cf-setup-repo-item {
      display: flex; align-items: center; gap: 12px;
      background: var(--bg-secondary); border-radius: 10px; padding: 12px 16px;
      border: 1px solid var(--border-color); transition: border-color 0.2s;
    }
    .cf-setup-repo-item:hover { border-color: rgba(237,137,54,0.5); }
    .cf-setup-repo-item-icon { font-size: 20px; flex-shrink: 0; }
    .cf-setup-repo-item-info { flex: 1; min-width: 0; }
    .cf-setup-repo-item-name { font-size: 14px; font-weight: 700; color: var(--text-primary); }
    .cf-setup-repo-item-meta { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
    .cf-setup-repo-item-action { flex-shrink: 0; }
    .cf-setup-repo-connect-btn {
      padding: 6px 14px; border-radius: 6px; border: none;
      background: linear-gradient(135deg, #f6ad55, #ed8936); color: #fff;
      font-size: 12px; font-weight: 700; cursor: pointer;
      transition: opacity 0.2s ease;
    }
    .cf-setup-repo-connect-btn:hover { opacity: 0.9; }
    .cf-setup-repo-skip-btn {
      padding: 6px 14px; border-radius: 6px;
      border: 1px solid var(--border-color); background: transparent;
      color: var(--text-muted); font-size: 12px; font-weight: 600; cursor: pointer;
      transition: background 0.2s;
    }
    .cf-setup-repo-skip-btn:hover { background: var(--bg-secondary); }
    .cf-setup-notice {
      background: var(--bg-secondary); border-radius: 8px; padding: 12px 14px;
      font-size: 12px; color: var(--text-muted); line-height: 1.6;
      border: 1px solid var(--border-color); margin-bottom: 16px;
    }
    .cf-setup-notice strong { color: var(--text-primary); }
    .cf-setup-footer {
      display: flex; justify-content: flex-end; gap: 10px; padding-top: 8px;
      border-top: 1px solid var(--border-color);
    }

    /* Create Repo Modal */
    .create-repo-modal-content {
      background: var(--card-bg); border-radius: 16px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.3); width: 100%; max-width: 480px;
      max-height: 90vh; overflow-y: auto;
    }
    .create-repo-form { display: flex; flex-direction: column; gap: 16px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-label { font-size: 13px; font-weight: 700; color: var(--text-primary); }
    .form-input {
      padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color);
      background: var(--input-bg, var(--card-bg)); color: var(--text-primary);
      font-size: 14px; outline: none; transition: border-color 0.2s ease;
    }
    .form-input:focus { border-color: var(--accent-color, #48bb78); }
    .form-input.error { border-color: #e53e3e; }
    .form-error { font-size: 12px; color: #e53e3e; font-weight: 600; min-height: 18px; }
    .radio-group { display: flex; gap: 16px; }
    .radio-label {
      display: flex; align-items: center; gap: 6px; cursor: pointer;
      font-size: 14px; color: var(--text-primary); font-weight: 500;
      padding: 8px 14px; border-radius: 8px; border: 2px solid var(--border-color);
      transition: border-color 0.2s ease, background 0.2s ease;
    }
    .radio-label:has(input:checked) {
      border-color: var(--accent-color, #48bb78); background: rgba(72,187,120,0.08);
    }
    .radio-label input[type="radio"] { accent-color: #48bb78; }
    .create-repo-submit {
      padding: 10px 20px; border-radius: 8px; border: none;
      background: linear-gradient(135deg, #48bb78, #38a169); color: #fff;
      font-size: 14px; font-weight: 700; cursor: pointer;
      transition: opacity 0.2s ease;
    }
    .create-repo-submit:hover { opacity: 0.9; }
    .create-repo-submit:disabled { opacity: 0.5; cursor: not-allowed; }

    /* This Month Commits Bar */
    .this-month-bar {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      margin-top: 14px;
    }
    .this-month-label {
      font-size: 13px; font-weight: 600; color: var(--accent-color, #48bb78);
      background: none; border: none; cursor: pointer; padding: 0;
      text-decoration: underline; text-underline-offset: 2px;
      transition: opacity 0.15s;
    }
    .this-month-label:hover { opacity: 0.75; }
    .this-month-count {
      font-size: 13px; font-weight: 700; color: var(--text-primary);
    }
    .this-month-select {
      padding: 5px 10px; font-size: 13px; border-radius: 8px;
      border: 1px solid var(--border-color); background: var(--bg-secondary);
      color: var(--text-primary); cursor: pointer; max-width: 300px;
    }
    .this-month-select:focus { outline: none; border-color: var(--accent-color, #48bb78); }

    /* Commit Search */
    .commit-search-row {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    }
    .commit-search-input {
      flex: 1; min-width: 200px; padding: 10px 14px; border-radius: 10px;
      border: 2px solid var(--border-color); background: var(--bg-secondary);
      color: var(--text-primary); font-size: 14px; outline: none;
      transition: border-color 0.2s;
    }
    .commit-search-input:focus { border-color: var(--accent-color, #48bb78); }
    .commit-search-input::placeholder { color: var(--text-faint, var(--text-muted)); }
    .commit-search-btn {
      padding: 10px 18px; border-radius: 10px; border: none;
      background: linear-gradient(135deg, #667eea, #764ba2); color: #fff;
      font-size: 14px; font-weight: 700; cursor: pointer;
      transition: opacity 0.2s; white-space: nowrap;
    }
    .commit-search-btn:hover { opacity: 0.9; }
    .commit-search-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    /* Search Results Modal */
    .search-modal-content {
      background: var(--card-bg); border-radius: 16px; max-width: 760px; width: 94%;
      max-height: 85vh; display: flex; flex-direction: column;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      animation: modalIn 0.2s ease;
    }
    .search-modal-header {
      padding: 20px 24px 14px; border-bottom: 1px solid var(--border-color);
      display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;
    }
    .search-modal-title { font-size: 18px; font-weight: 700; color: var(--text-primary); }
    .search-modal-subtitle { font-size: 13px; color: var(--text-muted); margin-top: 2px; }
    .search-modal-body {
      padding: 16px 24px 24px; overflow-y: auto; flex: 1; min-height: 0;
    }
    .search-result-group {
      margin-bottom: 16px;
    }
    .search-result-group-header {
      display: flex; align-items: center; gap: 8px; padding: 8px 0; cursor: pointer; user-select: none;
    }
    .search-result-group-chevron {
      font-size: 10px; transition: transform 0.2s; color: var(--text-muted);
    }
    .search-result-group-header[aria-expanded="true"] .search-result-group-chevron { transform: rotate(90deg); }
    .search-result-group-repo {
      font-size: 14px; font-weight: 700; color: var(--text-secondary);
    }
    .search-result-group-date {
      font-size: 12px; color: var(--text-muted); font-family: monospace;
    }
    .search-result-group-count {
      font-size: 11px; color: var(--text-muted); background: var(--badge-bg);
      padding: 2px 8px; border-radius: 999px; font-weight: 600;
    }
    .search-result-group-body {
      overflow: hidden; transition: max-height 0.25s ease;
    }
    .search-result-group-body.collapsed { max-height: 0 !important; }
    .search-result-commit {
      display: grid; grid-template-columns: 36px 1fr; gap: 10px;
      padding: 10px 12px; border-radius: 10px; margin-bottom: 4px;
      background: var(--bg-secondary); align-items: start;
    }
    .search-result-avatar {
      width: 36px; height: 36px; border-radius: 50%; object-fit: cover;
    }
    .search-result-commit-info { min-width: 0; }
    .search-result-commit-msg {
      font-size: 13px; font-weight: 600; color: var(--text-primary);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .search-result-commit-msg-full {
      font-size: 13px; font-weight: 600; color: var(--text-primary);
      white-space: pre-wrap; word-break: break-word;
    }
    .search-result-commit-meta {
      display: flex; gap: 8px; align-items: center; margin-top: 3px;
      font-size: 11px; color: var(--text-muted);
    }
    .search-result-sha {
      font-family: monospace; color: #2b6cb0; text-decoration: none; font-weight: 700;
    }
    .search-result-sha:hover { text-decoration: underline; }
    .search-result-highlight { background: rgba(237,137,54,0.3); border-radius: 2px; padding: 0 1px; }
    .search-empty {
      text-align: center; padding: 40px 20px; color: var(--text-muted); font-size: 14px;
    }
    .search-loading {
      text-align: center; padding: 40px 20px; color: var(--text-muted); font-size: 14px;
    }

    /* Search History Button */
    .search-history-row {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 10px;
    }
    .search-history-open-btn {
      padding: 8px 16px; border-radius: 10px; border: none;
      background: linear-gradient(135deg, #ed8936, #dd6b20); color: #fff;
      font-size: 13px; font-weight: 700; cursor: pointer;
      transition: opacity 0.2s; white-space: nowrap;
    }
    .search-history-open-btn:hover { opacity: 0.9; }

    /* History Grid Modal */
    .history-modal-content {
      background: var(--card-bg); border-radius: 16px; max-width: 95vw; width: 95vw;
      max-height: 90vh; display: flex; flex-direction: column;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      animation: modalIn 0.2s ease;
    }
    .history-modal-header {
      padding: 20px 24px 14px; border-bottom: 1px solid var(--border-color);
      display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;
    }
    .history-modal-title { font-size: 18px; font-weight: 700; color: var(--text-primary); }
    .history-modal-body {
      padding: 16px 24px 24px; overflow-y: auto; flex: 1; min-height: 0;
    }
    .history-search-bar {
      display: flex; gap: 8px; margin-bottom: 14px; align-items: center; flex-shrink: 0;
      padding: 0 24px;
    }
    .history-search-input {
      flex: 1; max-width: 400px; padding: 8px 14px; border-radius: 10px;
      border: 2px solid var(--border-color); background: var(--bg-secondary);
      color: var(--text-primary); font-size: 13px; outline: none;
      transition: border-color 0.2s;
    }
    .history-search-input:focus { border-color: var(--accent-color, #48bb78); }
    .history-search-btn {
      padding: 8px 18px; border-radius: 10px; border: none;
      background: linear-gradient(135deg, #48bb78, #38a169); color: #fff;
      font-size: 13px; font-weight: 700; cursor: pointer;
      transition: opacity 0.2s; white-space: nowrap;
    }
    .history-search-btn:hover { opacity: 0.9; }
    .history-search-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .history-search-status {
      font-size: 12px; color: var(--text-muted); white-space: nowrap;
    }
    .history-search-status.searching { color: #ed8936; }
    .history-search-status.done { color: #48bb78; }
    .history-search-status.error { color: #e53e3e; }
    .history-grid-wrap {
      display: flex; gap: 12px; flex-wrap: nowrap; overflow-x: auto;
    }
    .history-grid-col {
      flex: 1 1 0; min-width: 180px;
    }
    .history-grid-col table {
      width: 100%; border-collapse: collapse; font-size: 13px;
    }
    .history-grid-col th {
      text-align: left; padding: 6px 10px; border-bottom: 2px solid var(--border-color);
      color: var(--text-muted); font-weight: 700; font-size: 11px; text-transform: uppercase;
      letter-spacing: 0.05em; white-space: nowrap;
    }
    .history-grid-col td {
      padding: 5px 10px; border-bottom: 1px solid var(--border-color);
      color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      max-width: 200px;
    }
    .history-grid-col tr:last-child td { border-bottom: none; }
    .history-hit-badge {
      display: inline-flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #667eea, #764ba2); color: #fff;
      font-size: 12px; font-weight: 700; padding: 2px 10px; border-radius: 999px;
    }
    .history-grid-col tr.history-row-new td {
      animation: historyRowFlash 1.5s ease;
    }
    @keyframes historyRowFlash {
      0% { background: rgba(72,187,120,0.3); }
      100% { background: transparent; }
    }
    .history-grid-col tr.history-row-updated td {
      animation: historyRowUpdate 1.5s ease;
    }
    @keyframes historyRowUpdate {
      0% { background: rgba(237,137,54,0.3); }
      100% { background: transparent; }
    }
    @media (max-width: 900px) {
      .history-modal-content { max-width: 98vw; width: 98vw; }
      .history-grid-wrap { flex-wrap: wrap; }
      .history-grid-col { min-width: 45%; }
    }
    .history-grid-col tr { cursor: pointer; }
    .history-grid-col tr:hover td { background: var(--hover-bg, rgba(0,0,0,0.04)); }
    .history-grid-col tr.selected td { background: rgba(102,126,234,0.12); }
    .history-grid-col tr.history-row-cokey td { color: var(--accent-color, #48bb78) !important; font-weight: 700; }
    .history-grid-col tr.history-row-dimmed td { color: #bbb !important; }
    .history-incr-toggle { font-size:12px; padding:4px 10px; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-secondary); color:var(--text-muted); cursor:pointer; white-space:nowrap; }
    .history-incr-toggle.active { background:var(--accent-color,#48bb78); color:#fff; border-color:var(--accent-color,#48bb78); }
    .history-label-mode-toggle { font-size:12px; padding:4px 10px; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-secondary); color:var(--text-muted); cursor:pointer; white-space:nowrap; transition:background .15s,color .15s,border-color .15s; }
    .history-label-mode-toggle[data-mode="manual-modal"] { background:#ebf4ff; color:#2b6cb0; border-color:#90cdf4; }
    .history-label-mode-toggle[data-mode="auto-classify"] { background:#f0fff4; color:#276749; border-color:#9ae6b4; }
    .history-label-filter { display:flex; gap:6px; padding:0 24px 10px; flex-wrap:wrap; flex-shrink:0; }
    .history-label-btn { font-size:11px; padding:3px 11px; border-radius:12px; border:1px solid var(--border-color); background:var(--bg-secondary); color:var(--text-muted); cursor:pointer; white-space:nowrap; transition:background 0.15s,color 0.15s,border-color 0.15s; }
    .history-label-btn:hover { border-color:var(--accent-color,#48bb78); color:var(--accent-color,#48bb78); }
    .history-label-btn.active { border-color:var(--accent-color,#48bb78); background:var(--accent-color,#48bb78); color:#fff; }
    .history-repo-label { font-size:12px; color:var(--text-muted); white-space:nowrap; margin-left:auto; }
    .history-repo-select {
      font-size:12px; padding:4px 8px; border-radius:6px;
      border:1px solid var(--border-color); background:var(--bg-secondary);
      color:var(--text-primary); cursor:pointer; max-width:160px;
    }

    /* キーワード詳細パネル */
    .keyword-detail-panel {
      margin-top: 12px; border: 1px solid var(--border-color); border-radius: 10px;
      background: var(--bg-secondary, var(--card-bg)); overflow: hidden;
    }
    .keyword-detail-panel-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 14px; background: linear-gradient(135deg, rgba(102,126,234,0.15), rgba(118,75,162,0.1));
      border-bottom: 1px solid var(--border-color);
    }
    .keyword-detail-panel-title {
      font-size: 14px; font-weight: 700; color: var(--text-primary);
    }
    .keyword-detail-panel-close {
      background: none; border: none; font-size: 18px; line-height: 1; cursor: pointer;
      color: var(--text-muted); padding: 0 4px;
    }
    .keyword-detail-body {
      padding: 12px 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
    }
    @media (max-width: 700px) {
      .keyword-detail-body { grid-template-columns: 1fr; }
    }
    .keyword-detail-section { font-size: 13px; }
    .keyword-detail-section-title {
      font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;
      letter-spacing: 0.05em; margin-bottom: 6px;
    }
    .keyword-detail-summary-row {
      display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 8px;
    }
    .keyword-detail-stat {
      display: flex; flex-direction: column; align-items: center;
      background: var(--card-bg); border: 1px solid var(--border-color);
      border-radius: 8px; padding: 6px 14px; min-width: 70px;
    }
    .keyword-detail-stat-value {
      font-size: 18px; font-weight: 800; color: var(--accent-color, #667eea);
    }
    .keyword-detail-stat-label { font-size: 10px; color: var(--text-muted); white-space: nowrap; }
    .keyword-detail-repo-list { list-style: none; margin: 0; padding: 0; }
    .keyword-detail-repo-list li {
      display: flex; align-items: center; justify-content: space-between;
      padding: 3px 0; border-bottom: 1px solid var(--border-color); font-size: 12px;
    }
    .keyword-detail-repo-list li:last-child { border-bottom: none; }
    .keyword-detail-repo-name { color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px; }
    .keyword-detail-repo-count { color: var(--text-muted); font-weight: 700; white-space: nowrap; margin-left: 8px; }
    .keyword-detail-cokey-list { display: flex; flex-wrap: wrap; gap: 6px; }
    .keyword-detail-cokey-tag {
      display: inline-flex; align-items: center; gap: 4px;
      background: var(--card-bg); border: 1px solid var(--border-color);
      border-radius: 999px; padding: 2px 10px; font-size: 11px; cursor: pointer;
      color: var(--text-primary);
    }
    .keyword-detail-cokey-tag:hover { border-color: #667eea; color: #667eea; }
    .keyword-detail-cokey-count { color: var(--text-muted); font-size: 10px; }
    .keyword-detail-graph-wrap { overflow-x: auto; }
    .keyword-detail-graph-wrap svg { display: block; }
    .kd-bar { fill: rgba(102,126,234,0.7); transition: fill 0.15s; }
    .keyword-detail-classify-btn { font-size:11px; padding:3px 11px; border-radius:12px; border:1px solid var(--accent-color,#48bb78); background:transparent; color:var(--accent-color,#48bb78); cursor:pointer; white-space:nowrap; margin-right:8px; transition:background .15s,color .15s; }
    .keyword-detail-classify-btn:hover { background:var(--accent-color,#48bb78); color:#fff; }
    .kd-bar:hover { fill: rgba(102,126,234,1); }
    .kd-label { font-size: 9px; fill: var(--text-muted, #888); }
    .kd-value { font-size: 9px; fill: var(--text-primary, #333); font-weight: 700; }
    .keyword-detail-loading { padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px; }

    /* Permissions Modal */
    .modal-overlay {
      display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: var(--modal-overlay); backdrop-filter: blur(4px);
      z-index: 2000; align-items: center; justify-content: center;
    }
    .modal-overlay.show { display: flex; }
    .modal-content {
      background: var(--card-bg); border-radius: 16px; max-width: 520px; width: 90%;
      max-height: 80vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      animation: modalIn 0.2s ease;
    }
    @keyframes modalIn {
      from { opacity: 0; transform: scale(0.95) translateY(10px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    .modal-header {
      padding: 20px 24px 12px; border-bottom: 1px solid var(--border-color);
      display: flex; justify-content: space-between; align-items: center;
    }
    .modal-title { font-size: 18px; font-weight: 700; color: var(--text-primary); }
    .modal-close {
      width: 32px; height: 32px; border-radius: 8px; border: none; background: var(--bg-secondary);
      font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center;
      color: var(--text-muted); transition: background 0.2s;
    }
    .modal-close:hover { background: var(--border-light); color: var(--text-secondary); }
    .modal-body { padding: 16px 24px 24px; }
    .modal-repo-name-row {
      display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
    }
    .modal-repo-name { font-size: 14px; color: var(--text-muted); font-weight: 600; flex: 1; }
    /* Toggle Switch */
    .toggle-switch {
      position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0; cursor: pointer;
    }
    .toggle-switch input { opacity: 0; width: 0; height: 0; }
    .toggle-slider {
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: var(--input-border); border-radius: 22px; transition: background 0.2s;
    }
    .toggle-slider::before {
      content: ''; position: absolute; width: 16px; height: 16px;
      left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: transform 0.2s;
    }
    .toggle-switch input:checked + .toggle-slider { background: var(--accent-color); }
    .toggle-switch input:checked + .toggle-slider::before { transform: translateX(18px); }
    .modal-repo-summary {
      background: var(--bg-secondary); border-radius: 10px; padding: 14px 16px; margin-bottom: 16px;
      border: 1px solid var(--border-color);
    }
    .modal-repo-summary.hidden { display: none; }
    /* Permission Section Header */
    .perm-section-header {
      display: flex; align-items: center; gap: 10px; margin-bottom: 8px;
    }
    .perm-filter-select {
      font-size: 12px; padding: 3px 8px; border: 1px solid var(--border-color); border-radius: 6px;
      background: var(--bg-secondary); color: var(--text-muted); cursor: pointer; outline: none;
    }
    .perm-filter-select:focus { border-color: var(--accent-color); }
    .modal-repo-desc { font-size: 13px; color: var(--text-muted); margin-bottom: 8px; }
    .modal-repo-desc:empty { display: none; }
    .modal-repo-meta-grid { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; color: var(--text-muted); }
    .modal-repo-meta-item { background: var(--badge-bg); padding: 3px 8px; border-radius: 999px; }
    .modal-repo-meta-link { color: #2b6cb0; text-decoration: none; font-weight: 600; }
    .modal-repo-meta-link:hover { text-decoration: underline; }
    .perm-item {
      border: 1px solid var(--border-color); border-radius: 10px; padding: 12px 14px; margin-bottom: 10px;
      transition: border-color 0.2s;
    }
    .perm-item.active { border-color: #9ae6b4; background: #f0fff4; }
    [data-theme="dark"] .perm-item.active { border-color: #38a169; background: rgba(56,161,105,0.15); }
    .perm-item.inactive { border-color: var(--border-color); background: var(--bg-secondary); opacity: 0.6; }
    .perm-header { display: flex; align-items: center; gap: 8px; }
    .perm-icon { font-size: 18px; }
    .perm-name { font-weight: 600; color: var(--text-secondary); flex: 1; font-size: 14px; }
    .perm-badge {
      padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 700;
    }
    .perm-badge.on { background: #c6f6d5; color: #276749; }
    .perm-badge.off { background: #fed7d7; color: #9b2c2c; }
    .perm-caps {
      margin: 8px 0 0 30px; padding: 0; list-style: none; font-size: 13px; color: var(--text-muted);
    }
    .perm-caps li { padding: 2px 0; }
    .perm-caps li::before { content: '✓ '; color: #38a169; font-weight: 700; }
    .scopes-footer {
      margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border-color);
      font-size: 12px; color: var(--text-faint);
    }
    .scopes-footer code {
      background: var(--code-bg); padding: 1px 5px; border-radius: 4px; font-size: 11px;
    }
    .toast {
      position: fixed; right: 24px; bottom: 24px; z-index: 3000;
      padding: 12px 14px; border-radius: 12px; font-size: 13px; font-weight: 700;
      box-shadow: 0 16px 36px rgba(0,0,0,0.25); display: none; max-width: 360px;
      align-items: center; gap: 12px; justify-content: space-between;
    }
    .toast.show { display: flex; animation: toastIn 0.2s ease; }
    .toast.success { background: #c6f6d5; color: #22543d; }
    .toast.error { background: #fed7e2; color: #97266d; }
    .toast-message { flex: 1; }
    .toast-btn {
      border: none; border-radius: 999px; padding: 4px 10px; font-weight: 800;
      background: rgba(255,255,255,0.7); color: inherit; cursor: pointer; font-size: 12px;
    }
    .toast-btn:hover { background: rgba(255,255,255,0.9); }
    @keyframes toastIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .cache-toast-container {
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
      z-index: 10000; display: flex; flex-direction: column; gap: 8px;
      pointer-events: none;
    }
    .cache-toast {
      padding: 12px 24px; border-radius: 8px; color: white; font-size: 14px; font-weight: 600;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2); pointer-events: auto;
      animation: cacheToastSlideIn 0.3s ease-out; transition: opacity 0.3s ease-out;
    }
    .cache-toast.cache-source { background: #68d391; color: #22543d; }
    .cache-toast.github-source { background: #63b3ed; color: #1a365d; }
    .cache-toast.cache-saved { background: #68d391; color: #22543d; }
    .cache-toast.cache-toast-fade { opacity: 0; }
    @keyframes cacheToastSlideIn {
      from { transform: translateY(-20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .missing-scope-banner {
      background: linear-gradient(135deg, #fefcbf 0%, #fef3c7 100%);
      border: 1px solid #ecc94b;
      border-radius: 12px; padding: 16px 20px; margin-top: 16px;
      display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
    }
    .missing-scope-banner-icon { font-size: 24px; flex-shrink: 0; }
    .missing-scope-banner-text { flex: 1; min-width: 200px; }
    .missing-scope-banner-title { font-size: 14px; font-weight: 700; color: #744210; margin-bottom: 2px; }
    .missing-scope-banner-desc { font-size: 13px; color: #975a16; }
    .reauth-btn {
      display: inline-flex; align-items: center; gap: 6px;
      background: #2d3748; color: white; border: none; border-radius: 8px;
      padding: 10px 20px; font-size: 13px; font-weight: 600; cursor: pointer;
      text-decoration: none; white-space: nowrap; transition: background 0.2s;
    }
    .reauth-btn:hover { background: #1a202c; }
    .reauth-btn svg { width: 16px; height: 16px; fill: currentColor; }
    .perm-section-title {
      font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;
      letter-spacing: 0.05em; margin-bottom: 8px;
    }
    .perm-no-install {
      font-size: 13px; color: var(--text-faint); padding: 10px 14px;
      border: 1px dashed var(--border-color); border-radius: 10px; text-align: center;
    }

    /* Zanzibar Button & Modal */
    .zanzibar-footer {
      margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border-color);
      display: flex; justify-content: flex-end;
    }
    .zanzibar-btn {
      display: inline-flex; align-items: center; gap: 6px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white; border: none; border-radius: 8px;
      padding: 8px 16px; font-size: 13px; font-weight: 600;
      cursor: pointer; transition: opacity 0.2s;
    }
    .zanzibar-btn:hover { opacity: 0.9; }
    .zanzibar-btn-icon { font-size: 14px; }
    .zanzibar-modal-content { max-width: 640px; }
    .zanzibar-header-actions { display: flex; align-items: center; gap: 8px; }
    .zanzibar-copy-btn {
      background: var(--badge-bg); border: 1px solid var(--border-color); border-radius: 6px;
      padding: 4px 10px; font-size: 12px; font-weight: 600; color: var(--text-muted);
      cursor: pointer; transition: background 0.2s;
    }
    .zanzibar-copy-btn:hover { background: var(--border-color); }
    .zanzibar-copy-btn.copied { background: #c6f6d5; border-color: #9ae6b4; color: #276749; }
    .zanzibar-repo-name {
      font-size: 14px; color: var(--text-muted); font-weight: 600; margin-bottom: 12px;
    }
    .zanzibar-tuples {
      background: #1a202c; color: #e2e8f0; border-radius: 10px;
      padding: 16px; font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 12px; line-height: 1.7; overflow-x: auto; white-space: pre;
      max-height: 50vh; overflow-y: auto;
    }
    .zanzibar-tuples .zt-comment { color: #718096; }
    .zanzibar-tuples .zt-object { color: #63b3ed; }
    .zanzibar-tuples .zt-relation { color: #f6ad55; }
    .zanzibar-tuples .zt-subject { color: #68d391; }

    /* Tree View Button */
    .tree-view-btn {
      display: inline-flex; align-items: center; gap: 4px;
      background: linear-gradient(135deg, #38a169 0%, #2f855a 100%);
      color: white; border: none; border-radius: 6px;
      padding: 4px 10px; font-size: 12px; font-weight: 600;
      cursor: pointer; transition: opacity 0.2s; flex-shrink: 0;
    }
    .tree-view-btn:hover { opacity: 0.9; }
    .tree-view-btn-icon { font-size: 12px; }

    /* Tree Modal */
    .tree-modal-content { max-width: 520px; max-height: 92vh; }
    .tree-modal-content .modal-body { max-height: calc(92vh - 60px); overflow-y: auto; }
    .tree-tuples { font-size: 11.5px; line-height: 1.6; max-height: none; overflow-y: visible; }
    .tree-tuples .tt-branch { color: #718096; }
    .tree-tuples .tt-label { color: #e2e8f0; }
    .tree-tuples .tt-type { color: #63b3ed; font-weight: 600; }
    .tree-tuples .tt-relation { color: #f6ad55; }
    .tree-tuples .tt-read { color: #68d391; }
    .tree-tuples .tt-write { color: #f6ad55; }

    /* Inline Heatmap Calendar Section */
    .heatmap-inline-section {
      margin: 12px 0 16px; padding: 12px;
      background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color);
    }
    .heatmap-nav {
      display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 16px;
    }
    .heatmap-nav-btn {
      width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border-color);
      background: var(--bg-secondary); font-size: 16px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      color: var(--text-muted); transition: background 0.2s;
    }
    .heatmap-nav-btn:hover { background: var(--border-light); }
    .heatmap-month-label { font-size: 15px; font-weight: 700; color: var(--text-secondary); min-width: 120px; text-align: center; }
    .heatmap-grid {
      display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px;
    }
    .heatmap-weekday {
      font-size: 10px; font-weight: 700; color: var(--text-faint); text-align: center;
      padding: 4px 0;
    }
    .heatmap-day {
      aspect-ratio: 1; border-radius: 4px;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 600; color: var(--text-muted);
      position: relative; cursor: default;
    }
    .heatmap-day.empty { background: transparent; }
    .heatmap-day.level-0 { background: var(--badge-bg); color: var(--text-faint); }
    .heatmap-day.level-1 { background: #c6f6d5; color: #276749; }
    .heatmap-day.level-2 { background: #68d391; color: #22543d; }
    .heatmap-day.level-3 { background: #38a169; color: white; }
    .heatmap-day.level-4 { background: #276749; color: white; }
    .heatmap-day.today { box-shadow: inset 0 0 0 2px var(--accent-color); }
    .heatmap-day.has-commits { cursor: pointer; }
    .heatmap-day.has-commits:hover { opacity: 0.8; transform: scale(1.1); transition: all 0.15s; }
    .heatmap-legend {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      margin-top: 14px; font-size: 11px; color: var(--text-faint);
    }
    .heatmap-legend-box {
      width: 14px; height: 14px; border-radius: 3px;
    }
    .heatmap-loading {
      text-align: center; padding: 32px 0; font-size: 13px; color: var(--text-faint);
    }
    .heatmap-total {
      text-align: center; margin-top: 10px; font-size: 13px; font-weight: 700; color: var(--text-muted);
    }

    /* Commit Detail Modal */
    .commit-detail-modal-content {
      max-width: 600px; width: 92%; max-height: 80vh;
    }
    .commit-detail-date {
      font-size: 14px; font-weight: 700; color: var(--text-secondary); margin-bottom: 12px;
      padding-bottom: 8px; border-bottom: 1px solid var(--border-color);
    }
    .commit-detail-list {
      overflow-y: auto; max-height: 55vh; display: flex; flex-direction: column; gap: 10px;
    }
    .commit-detail-item {
      border: 1px solid var(--border-color); border-radius: 10px; padding: 12px;
      transition: border-color 0.2s;
    }
    .commit-detail-item:hover { border-color: var(--accent-color); }
    .commit-detail-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 6px;
    }
    .commit-detail-avatar {
      width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
    }
    .commit-detail-author {
      font-size: 13px; font-weight: 600; color: var(--text-secondary);
    }
    .commit-detail-time {
      font-size: 11px; color: var(--text-faint); margin-left: auto;
    }
    .commit-detail-message {
      font-size: 13px; color: var(--text-primary); line-height: 1.5;
      white-space: pre-wrap; word-break: break-word;
    }
    .commit-detail-message-title {
      font-weight: 600;
    }
    .commit-detail-message-body {
      color: var(--text-muted); margin-top: 4px; font-size: 12px;
    }
    .commit-detail-sha {
      display: inline-block; margin-top: 6px; font-size: 11px;
      font-family: monospace; color: var(--accent-color); text-decoration: none;
      background: var(--code-bg); padding: 2px 6px; border-radius: 4px;
    }
    .commit-detail-sha:hover { text-decoration: underline; }
    .commit-detail-loading {
      text-align: center; padding: 40px 0; font-size: 13px; color: var(--text-faint);
    }
    .commit-detail-empty {
      text-align: center; padding: 40px 0; font-size: 13px; color: var(--text-faint);
    }

    .commit-history-btn {
      display: inline-flex; align-items: center; gap: 4px;
      background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%);
      color: white; border: none; border-radius: 6px;
      padding: 4px 10px; font-size: 12px; font-weight: 600;
      cursor: pointer; transition: opacity 0.2s; flex-shrink: 0;
    }
    .commit-history-btn:hover { opacity: 0.9; }
    .commit-history-btn-icon { font-size: 12px; }
    .commit-history-btn-label { white-space: nowrap; }

    .commit-history-modal { z-index: 2600; }
    .commit-history-modal-content { max-width: 640px; max-height: 92vh; }
    .commit-history-modal-content .modal-body { padding-bottom: 20px; }
    .commit-history-meta {
      font-size: 14px; font-weight: 600; color: var(--text-primary);
      display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;
    }
    .commit-history-total { font-weight: 500; color: var(--text-secondary); }
    .commit-history-month-picker {
      margin-bottom: 12px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      font-size: 13px; color: var(--text-secondary);
    }
    .commit-history-months-details {
      font-size: 11px; color: var(--text-muted, var(--text-secondary));
      margin-bottom: 10px; padding: 6px 10px; border-radius: 6px;
      background: var(--bg-secondary); border: 1px solid var(--border-color);
      word-break: break-all;
    }
    .commit-history-cache-summary {
      font-size: 12px; color: var(--text-secondary);
      margin-bottom: 10px; padding: 6px 10px; border-radius: 6px;
      background: var(--bg-secondary); border: 1px solid var(--border-color);
    }
    .commit-history-cache-summary strong { color: var(--text-primary); }
    .commit-history-month-picker label { font-weight: 600; color: var(--text-primary); }
    .commit-history-month-select {
      min-width: 180px; padding: 7px 10px; border-radius: 8px;
      border: 1px solid var(--input-border); background: var(--input-bg); color: var(--text-primary); font-size: 13px;
    }
    .commit-history-stats-btn {
      margin-left: auto;
      padding: 7px 14px; border-radius: 8px; border: 1px solid #3182ce;
      background: #3182ce; color: #fff; font-size: 12px; font-weight: 700;
      cursor: pointer; transition: background 0.15s, opacity 0.15s;
      white-space: nowrap;
    }
    .commit-history-stats-btn:hover { background: #2c5282; }
    .commit-history-stats-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .commit-history-filter-select {
      padding: 6px 8px; border-radius: 8px; border: 1px solid var(--input-border);
      background: var(--input-bg); color: var(--text-primary);
      font-size: 12px; cursor: pointer; max-width: 180px;
    }
    .commit-history-filter-select:hover { border-color: var(--accent-color); }

    .commit-cokey-section {
      padding: 8px 0 4px 0;
      border-top: 1px solid var(--border-color);
    }
    .commit-cokey-label { font-size: 11px; color: var(--text-muted); margin-bottom: 6px; }
    .commit-cokey-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; min-height: 24px; }
    .commit-cokey-tag {
      font-size: 11px; padding: 3px 8px; border-radius: 12px;
      border: 1px solid var(--border-color); background: var(--bg-secondary);
      color: var(--text-secondary); cursor: pointer; white-space: nowrap;
      transition: background 0.12s, color 0.12s;
    }
    .commit-cokey-tag:hover, .commit-cokey-tag.active {
      background: var(--accent-color, #48bb78); color: #fff; border-color: var(--accent-color, #48bb78);
    }
    .commit-cokey-filter-row { display: flex; gap: 6px; align-items: center; }
    .commit-cokey-input {
      flex: 1; padding: 5px 8px; border-radius: 6px;
      border: 1px solid var(--input-border); background: var(--input-bg);
      color: var(--text-primary); font-size: 12px;
    }
    .commit-cokey-clear {
      padding: 5px 10px; border-radius: 6px; border: 1px solid var(--border-color);
      background: var(--bg-secondary); color: var(--text-muted);
      font-size: 12px; cursor: pointer; white-space: nowrap;
    }
    .commit-cokey-clear:hover { border-color: var(--text-muted); }

    .commit-stats-modal-content { max-width: 720px; max-height: 92vh; }
    .commit-stats-modal-content .modal-body { padding-bottom: 20px; }
    .commit-stats-repo {
      font-size: 13px; color: var(--text-secondary); margin-bottom: 6px;
    }
    .commit-stats-repo strong { color: var(--text-primary); font-family: monospace; }
    .commit-stats-period {
      font-size: 13px; color: var(--text-secondary); margin-bottom: 10px;
    }
    .commit-stats-period strong { color: var(--text-primary); }
    .commit-stats-summary {
      font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;
    }
    .commit-stats-source {
      font-size: 12px; color: var(--text-muted, var(--text-secondary)); margin-bottom: 12px;
    }
    .commit-stats-table-wrapper {
      max-height: 60vh; overflow: auto; border: 1px solid var(--border-color); border-radius: 8px;
    }
    .commit-stats-table {
      width: 100%; border-collapse: collapse; font-size: 13px;
    }
    .commit-stats-table thead th {
      position: sticky; top: 0;
      background: var(--bg-secondary); color: var(--text-primary); font-weight: 700; text-align: left;
      padding: 9px 12px; border-bottom: 1px solid var(--border-color);
    }
    .commit-stats-table tbody td {
      padding: 8px 12px; border-bottom: 1px solid var(--border-color); color: var(--text-primary);
    }
    .commit-stats-table tbody tr:last-child td { border-bottom: none; }
    .commit-stats-table td.num, .commit-stats-table th.num {
      text-align: right; font-variant-numeric: tabular-nums;
    }
    .commit-stats-empty {
      text-align: center; color: var(--text-muted, var(--text-secondary)); font-size: 13px; padding: 24px 0;
    }
    .commit-history-list {
      display: flex; flex-direction: column; gap: 10px;
      max-height: 60vh; overflow-y: auto; padding-right: 4px;
    }
    .commit-history-loading,
    .commit-history-empty {
      text-align: center; color: #718096; font-size: 13px; padding: 20px 0;
    }
    .commit-history-entry {
      border-radius: 10px; border: 1px solid #e2e8f0;
      background: #f7fafc; padding: 12px 14px; display: flex; flex-direction: column; gap: 6px;
    }
    .commit-history-entry-title a {
      color: #1a202c; font-weight: 700; text-decoration: none; word-break: break-word;
    }
    .commit-history-entry-title a:hover { text-decoration: underline; }
    .commit-history-entry-meta {
      display: flex; gap: 12px; flex-wrap: wrap;
      font-size: 12px; color: #718096;
    }
    .commit-history-feedback {
      margin-top: 10px; font-size: 13px; color: #e53e3e; min-height: 18px;
    }
    .monthly-status-modal-content { max-width: 720px; max-height: 92vh; }
    .monthly-status-modal-content .modal-body { max-height: 72vh; overflow-y: auto; }
    .monthly-status-subtitle {
      font-size: 14px; color: #718096; font-weight: 600; margin-bottom: 12px;
    }
    .monthly-status-body .heatmap-loading,
    .monthly-status-body .commit-history-empty {
      padding: 28px 0;
    }
  .label-classify-modal{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;}
  .label-classify-content{background:var(--card-bg);border-radius:12px;padding:24px;max-width:420px;width:90%;}
  .label-classify-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;}
  .label-classify-title{font-weight:600;font-size:15px;color:var(--text-primary);}
  .label-classify-query{font-size:13px;color:var(--text-muted);margin-bottom:16px;word-break:break-all;}
  .label-classify-btns{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;}
  .label-classify-btn{padding:5px 13px;border-radius:12px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-muted);cursor:pointer;font-size:12px;transition:background .15s,color .15s;}
  .label-classify-btn:hover,.label-classify-btn.selected{background:var(--accent-color,#48bb78);color:#fff;border-color:var(--accent-color,#48bb78);}
  .label-classify-input{width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:13px;margin-bottom:4px;}
  .label-classify-footer{display:flex;justify-content:flex-end;gap:8px;margin-top:16px;}
  .label-classify-footer button{padding:7px 16px;border-radius:6px;font-size:13px;cursor:pointer;}
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
          <a href="/status" class="dropdown-item">📊 キャッシュ状況</a>
          <a href="/auth/switch" class="dropdown-item switch-account">🔄 別アカウントでログイン</a>
          <a href="/auth/logout" class="dropdown-item logout">🚪 ログアウト</a>
        </div>
      </div>
    </div>
  </nav>

  <div class="container">
    <div class="page-header">
      <div class="page-header-row">
        <div>
          <h1 class="page-title">📦 リポジトリ</h1>
          <p class="page-subtitle">リポジトリ ${repoCount} 件</p>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <select id="repoGroupFilter" class="repo-group-filter-select" title="リポジトリグループでフィルタ">
            <option value="">なし</option>
          </select>
          <button class="color-assign-btn" id="openApprovalStatusModal" type="button">🛡 承認状況</button>
          <button class="color-assign-btn" id="openColorAssignModal" type="button">🎨 色割当て</button>
          <button class="create-repo-btn" id="openCreateRepoModal" type="button">＋ 新規にリポジトリを生成する</button>
        </div>
      </div>
      <div class="this-month-bar" id="thisMonthBar">
        <button type="button" class="this-month-label" id="thisMonthLabel">今月コミットしたリポジトリ</button>
        <span class="this-month-count" id="thisMonthCount"> : --/${repoCount} 件</span>
        <select class="this-month-select" id="thisMonthSelect" style="display:none">
          <option value="">リポジトリを選択...</option>
        </select>
      </div>
      <div class="commit-search-row" style="margin-top: 8px;">
        <input type="text" class="commit-search-input" id="commitSearchInput" placeholder="コミット履歴を検索（メッセージ・作者・SHA）" autocomplete="off" />
        <button class="commit-search-btn" id="commitSearchBtn" type="button">検索</button>
      </div>
      <div class="search-history-row" id="searchHistoryRow" style="display:none;">
        <button class="search-history-open-btn" id="searchHistoryOpenBtn" type="button">検索履歴</button>
      </div>
      ${errorBanner}
      ${missingScopeBannerHtml}
      ${cfPendingBannerHtml}
    </div>

    ${emptyState}
    ${repoRows ? `
      <div class="repo-list-header">
        <span>Repository</span>
        <button class="sort-button" id="sortUpdated" data-order="desc" type="button" aria-label="更新日の並び替え">
          最終更新
          <span class="sort-indicator" id="sortIndicator">▼</span>
        </button>
      </div>
      <div class="repo-list" id="repoList">${repoRows}</div>
    ` : ''}
  </div>

  <!-- Approval Status Modal -->
  <div class="modal-overlay" id="approvalStatusModal">
    <div class="approval-modal-content">
      <div class="approval-modal-header">
        <span class="modal-title">🛡 承認状況</span>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="approval-refresh-btn" id="approvalRefreshBtn" type="button">更新</button>
          <button class="modal-close" id="approvalModalClose" type="button">&times;</button>
        </div>
      </div>
      <div class="approval-modal-body" id="approvalModalBody">
        <div style="text-align:center;padding:24px;color:var(--text-muted)">読み込み中...</div>
      </div>
    </div>
  </div>

  <!-- Add OAuth App Modal -->
  <div class="add-app-overlay" id="addAppModal">
    <div class="add-app-dialog">
      <div class="add-app-dialog-header">
        <span class="modal-title" id="addAppTitle">🔗 OAuth App 追加</span>
        <button class="modal-close" id="addAppClose" type="button">&times;</button>
      </div>
      <div class="add-app-dialog-body">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px" id="addAppGroupLabel"></div>
        <input class="add-app-input" id="addAppNameInput" type="text" placeholder="App名を入力またはリポジトリから選択">
        <input class="add-app-note-input" id="addAppNoteInput" type="text" placeholder="メモ（任意）">
        <div class="add-app-sort-toggle">
          <span>候補:</span>
          <label><input type="checkbox" id="addAppSortToggle"><span id="addAppSortLabel">更新順</span></label>
        </div>
        <div class="add-app-repo-list" id="addAppRepoList"></div>
        <div class="add-app-actions">
          <button class="add-app-btn cancel" id="addAppCancelBtn" type="button">キャンセル</button>
          <button class="add-app-btn primary" id="addAppSubmitBtn" type="button">追加</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Repo Detail Modal (nested, higher z-index) -->
  <div class="repo-detail-overlay" id="repoDetailModal">
    <div class="repo-detail-content">
      <div class="repo-detail-header">
        <span class="modal-title" id="repoDetailTitle">📦 リポジトリ詳細</span>
        <button class="modal-close" id="repoDetailClose" type="button">&times;</button>
      </div>
      <div class="repo-detail-body" id="repoDetailBody">
      </div>
    </div>
  </div>

  <!-- Permissions Modal -->
  <div class="modal-overlay" id="permissionsModal">
    <div class="modal-content">
      <div class="modal-header">
        <span class="modal-title">🔐 有効な権限</span>
        <button class="modal-close" id="modalClose" type="button">&times;</button>
      </div>
      <div class="modal-body">
        <div class="modal-repo-name-row">
          <span class="modal-repo-name" id="modalRepoName"></span>
          <button class="tree-view-btn" id="treeViewBtn" type="button" title="ツリー表示">
            <span class="tree-view-btn-icon">🌳</span>
            ツリー表示
          </button>
          <button class="commit-history-btn" id="commitHistoryBtn" type="button" title="コミット履歴一覧">
            <span class="commit-history-btn-icon">🧾</span>
            <span class="commit-history-btn-label" id="commitHistoryBtnLabel">コミット履歴一覧${commitHistoryPageSize}/--</span>
          </button>
          <label class="toggle-switch" title="リポジトリ詳細の表示切替">
            <input type="checkbox" id="summaryToggle" />
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="modal-repo-summary" id="modalRepoSummary">
          <div class="modal-repo-desc" id="modalRepoDesc"></div>
          <div class="modal-repo-meta-grid" id="modalRepoMetaGrid"></div>
        </div>
        <div class="heatmap-inline-section" id="heatmapInlineSection">
          <div class="heatmap-nav">
            <button class="heatmap-nav-btn" id="heatmapPrev" type="button" title="前月">◀</button>
            <span class="heatmap-month-label" id="heatmapMonthLabel"></span>
            <button class="heatmap-nav-btn" id="heatmapNext" type="button" title="翌月">▶</button>
          </div>
          <div id="heatmapBody"></div>
        </div>
        <div class="perm-section-header">
          <span class="perm-section-title">このアプリに現在付与中の権限</span>
          <select class="perm-filter-select" id="permFilterSelect">
            <option value="all">対象: すべて</option>
            <option value="granted">対象: 許可済み</option>
            <option value="denied">対象: 禁止中</option>
          </select>
        </div>
        <div id="installPermItems"></div>
        <div class="perm-section-title" style="margin-top:16px">OAuth スコープ</div>
        <div id="oauthPermItems"></div>
        <div class="scopes-footer">
          付与スコープ: ${scopes.length > 0 ? scopes.map(s => `<code>${escapeHtml(s)}</code>`).join(' ') : '<span>取得できませんでした</span>'}
        </div>
        <div class="zanzibar-footer">
          <button class="zanzibar-btn" id="zanzibarBtn" type="button">
            <span class="zanzibar-btn-icon">🔗</span>
            Zanzibar タプル表示
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Zanzibar Tuples Modal -->
  <div class="modal-overlay" id="zanzibarModal">
    <div class="modal-content zanzibar-modal-content">
      <div class="modal-header">
        <span class="modal-title">🔗 Zanzibar タプル</span>
        <div class="zanzibar-header-actions">
          <button class="zanzibar-copy-btn" id="zanzibarCopyBtn" type="button" title="コピー">📋 コピー</button>
          <button class="modal-close" id="zanzibarModalClose" type="button">&times;</button>
        </div>
      </div>
      <div class="modal-body">
        <div class="zanzibar-repo-name" id="zanzibarRepoName"></div>
        <pre class="zanzibar-tuples" id="zanzibarTuples"></pre>
      </div>
    </div>
  </div>

  <!-- Zanzibar Tree Modal -->
  <div class="modal-overlay" id="treeModal">
    <div class="modal-content tree-modal-content">
      <div class="modal-header">
        <span class="modal-title">🌳 Zanzibar ツリー</span>
        <div class="zanzibar-header-actions">
          <button class="zanzibar-copy-btn" id="treeCopyBtn" type="button" title="コピー">📋 コピー</button>
          <button class="modal-close" id="treeModalClose" type="button">&times;</button>
        </div>
      </div>
      <div class="modal-body">
        <div class="zanzibar-repo-name" id="treeRepoName"></div>
        <pre class="zanzibar-tuples tree-tuples" id="treeTuples"></pre>
      </div>
    </div>
  </div>

  <!-- Commit Detail Modal -->
  <div class="modal-overlay" id="commitDetailModal">
    <div class="modal-content commit-detail-modal-content">
      <div class="modal-header">
        <span class="modal-title" id="commitDetailTitle"></span>
        <button class="modal-close" id="commitDetailClose" type="button">&times;</button>
      </div>
      <div class="modal-body">
        <div class="commit-detail-date" id="commitDetailDate"></div>
        <div class="commit-detail-list" id="commitDetailList"></div>
      </div>
    </div>
  </div>


  <div class="modal-overlay commit-history-modal" id="commitHistoryModal">
    <div class="modal-content commit-history-modal-content">
      <div class="modal-header">
        <span class="modal-title">🕘 コミット履歴一覧</span>
        <button class="modal-close" id="commitHistoryModalClose" type="button">&times;</button>
      </div>
      <div class="modal-body">
        <div class="commit-history-meta">
          <span>直近のコミット数 : <strong id="commitHistoryCount">0 件</strong></span>
          <span class="commit-history-total" id="commitHistoryTotal">総コミット数: --</span>
        </div>
        <div class="commit-history-month-picker">
          <label for="commitHistoryMonthSelect">月別コミット状況</label>
          <select class="commit-history-month-select" id="commitHistoryMonthSelect">
            <option value="">すべて</option>
          </select>
          <select class="commit-history-filter-select" id="commitHistoryFilterSelect" title="コミットメッセージのフィルタ">
            <option value="no-merge">マージ履歴以外のコミットログ</option>
            <option value="merge-only">マージ履歴のみ</option>
            <option value="all">すべて</option>
          </select>
          <button type="button" class="commit-history-stats-btn" id="commitHistoryStatsBtn" title="現在選択中の期間に対するユーザー別集計を表示">stats</button>
        </div>
        <div class="commit-cokey-section" id="commitCoKeySection" style="display:none">
          <div class="commit-cokey-label">共起キーワード</div>
          <div class="commit-cokey-tags" id="commitCoKeyTags"></div>
          <div class="commit-cokey-filter-row">
            <input type="text" class="commit-cokey-input" id="commitCoKeyInput" placeholder="キーワードでフィルタ...">
            <button type="button" class="commit-cokey-clear" id="commitCoKeyClear">クリア</button>
          </div>
        </div>
        <div class="commit-history-months-details" id="commitHistoryMonthsDetails" style="display:none"></div>
        <div class="commit-history-cache-summary" id="commitHistoryCacheSummary" style="display:none"></div>
        <div class="commit-history-list" id="commitHistoryList"></div>
        <div class="commit-history-feedback" id="commitHistoryFeedback"></div>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="commitStatsModal" style="z-index:2700">
    <div class="modal-content commit-stats-modal-content">
      <div class="modal-header">
        <span class="modal-title">📊 コミット集計</span>
        <button class="modal-close" id="commitStatsModalClose" type="button">&times;</button>
      </div>
      <div class="modal-body">
        <div class="commit-stats-repo" id="commitStatsRepo"></div>
        <div class="commit-stats-period">対象期間 : <strong id="commitStatsPeriod">--</strong></div>
        <div class="commit-stats-summary" id="commitStatsSummary"></div>
        <div class="commit-stats-source" id="commitStatsSource"></div>
        <div class="commit-stats-table-wrapper" id="commitStatsTableWrapper"></div>
      </div>
    </div>
  </div>
  <div class="modal-overlay" id="monthlyStatusModal">
    <div class="modal-content monthly-status-modal-content">
      <div class="modal-header">
        <span class="modal-title">月別コミット状況</span>
        <button class="modal-close" id="monthlyStatusModalClose" type="button">&times;</button>
      </div>
      <div class="modal-body">
        <div class="monthly-status-subtitle" id="monthlyStatusLabel"></div>
        <div class="monthly-status-body" id="monthlyStatusBody"></div>
      </div>
    </div>
  </div>
  <div class="toast" id="repoToast">
    <span class="toast-message" id="repoToastMessage"></span>
    <button class="toast-btn" id="repoToastClose" type="button">OK</button>
  </div>

  <div class="cache-toast-container" id="cacheToastContainer"></div>

  <!-- Color Assignment Modal -->
  <div class="modal-overlay" id="colorAssignModal">
    <div class="color-assign-modal-content">
      <div class="modal-header">
        <span class="modal-title">🎨 リポジトリ色割当て</span>
        <button class="modal-close" id="colorAssignModalClose" type="button">&times;</button>
      </div>
      <div class="modal-body" style="padding-bottom:0;">
        <div class="color-assign-list" id="colorAssignList">
          <div style="text-align:center;color:var(--text-muted);padding:24px 0;">読み込み中...</div>
        </div>
      </div>
      <div class="color-assign-footer">
        <button class="color-assign-sync-btn" id="colorAssignSyncBtn" type="button">未登録リポジトリを同期</button>
        <span class="color-assign-save-status" id="colorAssignStatus"></span>
      </div>
    </div>
  </div>

  <!-- Cloudflare Setup Modal -->
  <div class="modal-overlay" id="cfSetupModal">
    <div class="cf-setup-modal-content">
      <div class="modal-header">
        <span class="modal-title">☁️ Cloudflare Pages セットアップ</span>
        <button class="modal-close" id="cfSetupModalClose" type="button">&times;</button>
      </div>
      <div class="modal-body">
        <div class="cf-setup-notice">
          <strong>Cloudflare Pages</strong> を使うと、GitHub リポジトリに push するたびに自動でビルド＆デプロイが実行されます。
          下記のリポジトリはまだ Cloudflare との連携が設定されていません。
          「接続する」をクリックすると Cloudflare ダッシュボードが開き、ビルド設定を行えます。
        </div>
        <div class="cf-setup-repo-list" id="cfSetupRepoList"></div>
        <div class="cf-setup-footer">
          <button class="cf-setup-dismiss-btn" id="cfSetupModalDismissAll" type="button">すべてスキップ</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Create Repo Modal -->
  <div class="modal-overlay" id="createRepoModal">
    <div class="create-repo-modal-content">
      <div class="modal-header">
        <span class="modal-title">📦 新規リポジトリを作成</span>
        <button class="modal-close" id="createRepoModalClose" type="button">&times;</button>
      </div>
      <div class="modal-body">
        <form class="create-repo-form" id="createRepoForm">
          <div class="form-group">
            <label class="form-label" for="createRepoName">リポジトリ名</label>
            <input class="form-input" id="createRepoName" type="text" placeholder="my-new-repo" autocomplete="off" maxlength="100" />
            <div class="form-error" id="createRepoError"></div>
          </div>
          <div class="form-group">
            <label class="form-label">公開設定</label>
            <div class="radio-group">
              <label class="radio-label">
                <input type="radio" name="repoVisibility" value="public" checked />
                🌐 Public
              </label>
              <label class="radio-label">
                <input type="radio" name="repoVisibility" value="private" />
                🔒 Private
              </label>
            </div>
          </div>
          <button class="create-repo-submit" id="createRepoSubmit" type="submit">作成する</button>
        </form>
      </div>
    </div>
  </div>

  <!-- Commit Search Results Modal -->
  <div class="modal-overlay" id="commitSearchModal">
    <div class="search-modal-content">
      <div class="search-modal-header">
        <div>
          <div class="search-modal-title" id="commitSearchTitle">検索結果</div>
          <div class="search-modal-subtitle" id="commitSearchSubtitle"></div>
        </div>
        <button class="modal-close" id="commitSearchClose" type="button">&times;</button>
      </div>
      <div class="search-modal-body" id="commitSearchBody">
      </div>
    </div>
  </div>

  <!-- Label Classification Modal -->
  <div class="label-classify-modal" id="labelClassifyModal" style="display:none;">
    <div class="label-classify-content">
      <div class="label-classify-header">
        <span class="label-classify-title">新規キーワードのラベルを選択</span>
        <button class="modal-close" id="labelClassifyClose" type="button">&times;</button>
      </div>
      <div class="label-classify-query" id="labelClassifyQuery"></div>
      <div class="label-classify-btns" id="labelClassifyBtns">
        <button class="label-classify-btn" data-label="feature">feature</button>
        <button class="label-classify-btn" data-label="ui">ui</button>
        <button class="label-classify-btn" data-label="tech">tech</button>
        <button class="label-classify-btn" data-label="database">database</button>
        <button class="label-classify-btn" data-label="bugfix">bugfix</button>
        <button class="label-classify-btn" data-label="ops">ops</button>
        <button class="label-classify-btn" data-label="uncategorized">未分類のまま</button>
      </div>
      <p style="font-size:12px;color:var(--text-muted);margin:0 0 6px;">または新しい分類を入力:</p>
      <input type="text" id="labelClassifyInput" class="label-classify-input" placeholder="新しい分類名（例: security）" maxlength="32" />
      <div class="label-classify-footer">
        <button id="labelClassifySkip" style="border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-muted);">スキップ</button>
        <button id="labelClassifyConfirm" style="border:none;background:var(--accent-color,#48bb78);color:#fff;">確定</button>
      </div>
    </div>
  </div>

  <!-- Search History Grid Modal -->
  <div class="modal-overlay" id="searchHistoryModal">
    <div class="history-modal-content">
      <div class="history-modal-header">
        <div>
          <div class="history-modal-title" id="historyModalTitle">検索履歴</div>
        </div>
        <button class="modal-close" id="historyModalClose" type="button">&times;</button>
      </div>
      <div class="history-search-bar">
        <input type="text" class="history-search-input" id="historySearchInput" placeholder="キーワードを入力して検索..." autocomplete="off" />
        <button class="history-search-btn" id="historySearchBtn" type="button">検索</button>
        <button class="history-incr-toggle" id="historyIncrSearchToggle" type="button">インクリメント: OFF</button>
        <button class="history-label-mode-toggle" id="historyLabelModeToggle" type="button" data-mode="uncategorized">新キーワードの分類: 未分類</button>
        <span class="history-search-status" id="historySearchStatus"></span>
        <label class="history-repo-label" for="historyRepoSelect">対象リポジトリ:</label>
        <select id="historyRepoSelect" class="history-repo-select">
          <option value="">すべて</option>
        </select>
      </div>
      <div class="history-label-filter" id="historyLabelFilter">
        <button class="history-label-btn active" data-label="">すべて</button>
        <button class="history-label-btn" data-label="feature">feature</button>
        <button class="history-label-btn" data-label="ui">ui</button>
        <button class="history-label-btn" data-label="tech">tech</button>
        <button class="history-label-btn" data-label="database">database</button>
        <button class="history-label-btn" data-label="bugfix">bugfix</button>
        <button class="history-label-btn" data-label="ops">ops</button>
        <button class="history-label-btn" data-label="uncategorized">未分類</button>
      </div>
      <div class="history-modal-body" id="historyModalBody">
      </div>
      <div id="keywordDetailPanel" style="display:none"></div>
    </div>
  </div>

  <script>
    var toastEl = document.getElementById('repoToast');
    var toastMessageEl = document.getElementById('repoToastMessage');
    var toastCloseBtn = document.getElementById('repoToastClose');
    var toastTimer = null;
    function showToast(message, type, durationMs) {
      if (!toastEl || !toastMessageEl) return;
      toastMessageEl.textContent = message;
      toastEl.classList.remove('success', 'error');
      toastEl.classList.add(type);
      toastEl.classList.add('show');
      if (toastTimer) {
        clearTimeout(toastTimer);
      }
      var ms = typeof durationMs === 'number' ? durationMs : 5000;
      toastTimer = setTimeout(function() {
        toastEl.classList.remove('show');
      }, ms);
    }
    if (toastCloseBtn) {
      toastCloseBtn.addEventListener('click', function() {
        if (toastTimer) {
          clearTimeout(toastTimer);
        }
        toastEl.classList.remove('show');
      });
    }

    function getCacheToastDuration() {
      var m = document.cookie.match('(^|;)\\\\s*user_toast_duration=([^;]*)');
      return m ? parseInt(decodeURIComponent(m[2]), 10) || 10 : 10;
    }
    function showCacheToast(message, cssClass) {
      var container = document.getElementById('cacheToastContainer');
      if (!container) return;
      var toast = document.createElement('div');
      toast.className = 'cache-toast ' + cssClass;
      toast.textContent = message;
      container.appendChild(toast);
      var durationMs = getCacheToastDuration() * 1000;
      setTimeout(function() {
        toast.classList.add('cache-toast-fade');
        setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
      }, durationMs);
    }

    ${getThemeToggleScript()}

    function toggleDropdown() {
      const dropdown = document.getElementById('dropdownMenu');
      dropdown.classList.toggle('show');
    }

    window.addEventListener('click', function(e) {
      const userIcon = document.querySelector('.user-icon');
      const dropdown = document.getElementById('dropdownMenu');
      if (!userIcon.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('show');
      }
    });

    // =============================================
    // リポジトリグループフィルタ
    // =============================================
    var repoGroupFilterData = [];
    var repoGroupFilterSelect = document.getElementById('repoGroupFilter');
    var activeGroupRepos = null;

    function applyRepoGroupFilter() {
      var rows = document.querySelectorAll('.repo-row');
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var owner = row.getAttribute('data-owner') || '';
        var repo = row.getAttribute('data-repo') || '';
        var fullName = owner + '/' + repo;
        if (!activeGroupRepos) {
          row.style.display = '';
        } else {
          row.style.display = activeGroupRepos[fullName] ? '' : 'none';
        }
      }
    }

    (function() {
      if (!repoGroupFilterSelect) return;
      fetch('/api/repo-groups', { credentials: 'same-origin' })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          var groups = (data.groups || []).slice();
          groups.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
          repoGroupFilterData = groups;
          for (var i = 0; i < groups.length; i++) {
            var opt = document.createElement('option');
            opt.value = groups[i].id;
            opt.textContent = groups[i].name;
            repoGroupFilterSelect.appendChild(opt);
          }
        })
        .catch(function() {});

      repoGroupFilterSelect.addEventListener('change', function() {
        var val = repoGroupFilterSelect.value;
        if (!val) {
          activeGroupRepos = null;
        } else {
          activeGroupRepos = {};
          for (var i = 0; i < repoGroupFilterData.length; i++) {
            if (repoGroupFilterData[i].id === val) {
              var repos = repoGroupFilterData[i].repos || [];
              for (var j = 0; j < repos.length; j++) {
                activeGroupRepos[repos[j]] = true;
              }
              break;
            }
          }
        }
        applyRepoGroupFilter();
      });
    })();

    // =============================================
    // 色割当てモーダル
    // =============================================
    (function() {
      var modal = document.getElementById('colorAssignModal');
      var openBtn = document.getElementById('openColorAssignModal');
      var closeBtn = document.getElementById('colorAssignModalClose');
      var listEl = document.getElementById('colorAssignList');
      var syncBtn = document.getElementById('colorAssignSyncBtn');
      var statusEl = document.getElementById('colorAssignStatus');

      var presetColors = [
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

      function escTxt(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

      function renderList(colors) {
        if (!listEl) return;
        if (colors.length === 0) {
          listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:24px 0;">色設定データがありません。「未登録リポジトリを同期」をクリックしてください。</div>';
          return;
        }
        var owners = {};
        colors.forEach(function(c) {
          var idx = c.repoName.indexOf('/');
          if (idx > 0) owners[c.repoName.substring(0, idx)] = true;
        });
        var ownerKeys = Object.keys(owners);
        var colorUniqueOwner = ownerKeys.length === 1 ? ownerKeys[0] : null;
        function displayRepoName(fullName) {
          if (!colorUniqueOwner) return fullName;
          var prefix = colorUniqueOwner + '/';
          return fullName.indexOf(prefix) === 0 ? fullName.substring(prefix.length) : fullName;
        }
        var ownerLabel = colorUniqueOwner
          ? '<div style="font-size:13px; color:var(--text-muted); margin-bottom:10px;">対象ユーザー : <strong style="color:var(--text-primary);">' + escTxt(colorUniqueOwner) + '</strong></div>'
          : '';
        listEl.innerHTML = ownerLabel + colors.map(function(c) {
          var optionsHtml = presetColors.map(function(p) {
            var sel = p.value.toLowerCase() === c.colorCode.toLowerCase() ? ' selected' : '';
            return '<option value="' + escTxt(p.value) + '"' + sel + '>' + escTxt(p.label) + '</option>';
          }).join('');
          var hasCustom = !presetColors.some(function(p) { return p.value.toLowerCase() === c.colorCode.toLowerCase(); });
          if (hasCustom) {
            optionsHtml += '<option value="' + escTxt(c.colorCode) + '" selected>カスタム</option>';
          }
          optionsHtml += '<option value="__custom__">カスタム...</option>';
          return '<div class="color-assign-item" data-repo="' + escTxt(c.repoName) + '">'
            + '<div class="color-assign-swatch" style="background:' + escTxt(c.colorCode) + ';">'
            + '<input type="color" value="' + escTxt(c.colorCode) + '" data-field="swatch" />'
            + '</div>'
            + '<div class="color-assign-repo-name">' + escTxt(displayRepoName(c.repoName)) + '</div>'
            + '<select class="color-assign-select" data-field="preset">' + optionsHtml + '</select>'
            + '<input type="text" class="color-assign-tags" placeholder="タグ" value="' + escTxt(c.tags || '') + '" data-field="tags" />'
            + '<span class="color-assign-save-status" data-field="status"></span>'
            + '</div>';
        }).join('');

        // イベント設定
        listEl.querySelectorAll('.color-assign-item').forEach(function(item) {
          var repo = item.getAttribute('data-repo');
          var swatch = item.querySelector('[data-field="swatch"]');
          var swatchDiv = item.querySelector('.color-assign-swatch');
          var select = item.querySelector('[data-field="preset"]');
          var tagsInput = item.querySelector('[data-field="tags"]');
          var itemStatus = item.querySelector('[data-field="status"]');

          function saveColor(colorCode, extraFields) {
            var body = { colorCode: colorCode };
            if (extraFields) {
              for (var k in extraFields) body[k] = extraFields[k];
            }
            if (itemStatus) itemStatus.textContent = '保存中...';
            fetch('/api/repo-colors/' + encodeURIComponent(repo), {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify(body),
            }).then(function(res) { return res.json(); })
              .then(function(data) {
                if (data.error) {
                  if (itemStatus) itemStatus.textContent = 'エラー';
                } else {
                  if (itemStatus) itemStatus.textContent = '保存済';
                  setTimeout(function() { if (itemStatus) itemStatus.textContent = ''; }, 2000);
                }
              })
              .catch(function() {
                if (itemStatus) itemStatus.textContent = '通信エラー';
              });
          }

          if (select) {
            select.addEventListener('change', function() {
              var val = select.value;
              if (val === '__custom__') {
                if (swatch) swatch.click();
                return;
              }
              if (swatchDiv) swatchDiv.style.background = val;
              if (swatch) swatch.value = val;
              saveColor(val);
            });
          }

          if (swatch) {
            swatch.addEventListener('input', function() {
              if (swatchDiv) swatchDiv.style.background = swatch.value;
            });
            swatch.addEventListener('change', function() {
              var val = swatch.value;
              if (swatchDiv) swatchDiv.style.background = val;
              var hasPreset = false;
              if (select) {
                for (var i = 0; i < select.options.length; i++) {
                  if (select.options[i].value.toLowerCase() === val.toLowerCase() && select.options[i].value !== '__custom__') {
                    select.selectedIndex = i;
                    hasPreset = true;
                    break;
                  }
                }
                if (!hasPreset) {
                  var customOpt = select.querySelector('option[value="__custom__"]');
                  if (customOpt) {
                    customOpt.value = val;
                    customOpt.textContent = 'カスタム';
                    customOpt.selected = true;
                  }
                }
              }
              saveColor(val);
            });
          }

          if (tagsInput) {
            var tagTimer;
            tagsInput.addEventListener('input', function() {
              clearTimeout(tagTimer);
              tagTimer = setTimeout(function() {
                if (itemStatus) itemStatus.textContent = '保存中...';
                fetch('/api/repo-colors/' + encodeURIComponent(repo), {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'same-origin',
                  body: JSON.stringify({ tags: tagsInput.value }),
                }).then(function(res) { return res.json(); })
                  .then(function(data) {
                    if (data.error) {
                      if (itemStatus) itemStatus.textContent = 'エラー';
                    } else {
                      if (itemStatus) itemStatus.textContent = '保存済';
                      setTimeout(function() { if (itemStatus) itemStatus.textContent = ''; }, 2000);
                    }
                  })
                  .catch(function() { if (itemStatus) itemStatus.textContent = '通信エラー'; });
              }, 800);
            });
          }
        });
      }

      function loadColors() {
        if (!listEl) return;
        listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:24px 0;">読み込み中...</div>';
        fetch('/api/repo-colors', { credentials: 'same-origin' })
          .then(function(res) { return res.json(); })
          .then(function(data) {
            if (data.error) {
              listEl.innerHTML = '<div style="text-align:center;color:#e53e3e;padding:24px 0;">' + escTxt(data.error) + '</div>';
            } else {
              var colors = data.colors || [];
              if (activeGroupRepos) {
                colors = colors.filter(function(c) { return activeGroupRepos[c.repoName]; });
              }
              renderList(colors);
            }
          })
          .catch(function() {
            listEl.innerHTML = '<div style="text-align:center;color:#e53e3e;padding:24px 0;">通信エラー</div>';
          });
      }

      if (openBtn) {
        openBtn.addEventListener('click', function() {
          if (modal) { modal.classList.add('show'); loadColors(); }
        });
      }
      if (closeBtn) {
        closeBtn.addEventListener('click', function() {
          if (modal) modal.classList.remove('show');
        });
      }
      if (modal) {
        modal.addEventListener('click', function(e) {
          if (e.target === modal) modal.classList.remove('show');
        });
      }
      if (syncBtn) {
        syncBtn.addEventListener('click', function() {
          syncBtn.disabled = true;
          syncBtn.textContent = '同期中...';
          fetch('/api/repo-colors/sync', { method: 'POST', credentials: 'same-origin' })
            .then(function(res) { return res.json(); })
            .then(function(data) {
              syncBtn.disabled = false;
              syncBtn.textContent = '未登録リポジトリを同期';
              if (statusEl) {
                statusEl.textContent = data.message || '完了';
                setTimeout(function() { statusEl.textContent = ''; }, 3000);
              }
              loadColors();
            })
            .catch(function() {
              syncBtn.disabled = false;
              syncBtn.textContent = '未登録リポジトリを同期';
              if (statusEl) statusEl.textContent = '通信エラー';
            });
        });
      }
    })();

    // =============================================
    // 新規リポジトリ作成モーダル
    // =============================================
    (function() {
      var createModal = document.getElementById('createRepoModal');
      var openBtn = document.getElementById('openCreateRepoModal');
      var closeBtn = document.getElementById('createRepoModalClose');
      var form = document.getElementById('createRepoForm');
      var nameInput = document.getElementById('createRepoName');
      var errorEl = document.getElementById('createRepoError');
      var submitBtn = document.getElementById('createRepoSubmit');

      // 既存リポジトリ名の一覧（小文字化して重複チェックに使用）
      var existingRepoNames = [];
      document.querySelectorAll('.repo-row').forEach(function(row) {
        var owner = (row.getAttribute('data-owner') || '').toLowerCase();
        var repo = (row.getAttribute('data-repo') || '').toLowerCase();
        if (repo) existingRepoNames.push(owner + '/' + repo);
      });
      var currentUser = '${escapeHtml(user.username)}'.toLowerCase();

      function openModal() {
        if (createModal) {
          createModal.classList.add('show');
          if (nameInput) { nameInput.value = ''; nameInput.classList.remove('error'); }
          if (errorEl) errorEl.textContent = '';
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '作成する'; }
        }
      }
      function closeModal() {
        if (createModal) createModal.classList.remove('show');
      }

      if (openBtn) openBtn.addEventListener('click', openModal);
      if (closeBtn) closeBtn.addEventListener('click', closeModal);
      if (createModal) {
        createModal.addEventListener('click', function(e) {
          if (e.target === createModal) closeModal();
        });
      }
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && createModal && createModal.classList.contains('show')) {
          closeModal();
        }
      });

      // 再認証後のフォーム状態復元
      try {
        var savedForm = sessionStorage.getItem('repo_create_form');
        if (savedForm) {
          sessionStorage.removeItem('repo_create_form');
          var parsed = JSON.parse(savedForm);
          if (parsed.name) {
            openModal();
            if (nameInput) nameInput.value = parsed.name;
            if (parsed.isPrivate) {
              var privateRadio = form ? form.querySelector('input[name="repoVisibility"][value="private"]') : null;
              if (privateRadio) privateRadio.checked = true;
            }
          }
        }
      } catch (e) { /* sessionStorage エラーは無視 */ }

      function validateRepoName(name) {
        if (!name) return 'リポジトリ名を入力してください。';
        if (!/^[a-zA-Z0-9._-]+$/.test(name)) return '英数字、ハイフン、ドット、アンダースコアのみ使用できます。';
        if (name.startsWith('.') || name.endsWith('.')) return 'ドットで開始・終了はできません。';
        if (existingRepoNames.indexOf(currentUser + '/' + name.toLowerCase()) !== -1) return 'このリポジトリ名は既に使用されています。';
        return '';
      }

      if (nameInput && errorEl) {
        nameInput.addEventListener('input', function() {
          var err = validateRepoName(nameInput.value.trim());
          errorEl.textContent = err;
          nameInput.classList.toggle('error', !!err);
        });
      }

      if (form) {
        form.addEventListener('submit', function(e) {
          e.preventDefault();
          var name = (nameInput ? nameInput.value.trim() : '');
          var err = validateRepoName(name);
          if (err) {
            if (errorEl) errorEl.textContent = err;
            if (nameInput) nameInput.classList.add('error');
            return;
          }

          var visibilityEl = form.querySelector('input[name="repoVisibility"]:checked');
          var isPrivate = visibilityEl ? visibilityEl.value === 'private' : false;

          if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '作成中...'; }
          if (errorEl) errorEl.textContent = '';

          fetch('/api/repositories', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, isPrivate: isPrivate })
          })
          .then(function(res) {
            return res.json().then(function(data) { return { ok: res.ok, status: res.status, data: data }; });
          })
          .then(function(result) {
            if (!result.ok) {
              var msg = result.data.error || 'リポジトリの作成に失敗しました。';
              if (result.data.requireReauth) {
                // スコープ不足・トークン無効: エラーメッセージ + 再認証リンクを表示
                if (errorEl) {
                  errorEl.innerHTML = msg + ' <a href="/auth/github?return_to=/repositories" style="color:#e53e3e;font-weight:700;text-decoration:underline;">再認証する</a>';
                }
                if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '再認証が必要です'; }
                return;
              }
              if (errorEl) {
                errorEl.textContent = msg;
              }
              if (nameInput) nameInput.classList.add('error');
              if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '作成する'; }
              return;
            }
            closeModal();
            showToast('リポジトリ「' + name + '」を作成しました', 'success', 7000);
            // Cloudflare セットアップ通知がレスポンスに含まれている場合はモーダルを表示
            if (result.data.cloudflareSetupPending) {
              var pending = result.data.cloudflareSetupPending;
              showCfSetupModalForNewRepo(name, pending.id, currentUser);
            } else {
              // 2秒後にページリロードして一覧に反映
              setTimeout(function() { location.reload(); }, 2000);
            }
          })
          .catch(function() {
            if (errorEl) errorEl.textContent = '通信エラーが発生しました。';
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '作成する'; }
          });
        });
      }
    })();

    // =============================================
    // Cloudflare セットアップ通知
    // =============================================
    (function() {
      var cfPendingData = ${cfPendingJson};
      var cfSetupModal = document.getElementById('cfSetupModal');
      var cfSetupModalClose = document.getElementById('cfSetupModalClose');
      var cfSetupRepoList = document.getElementById('cfSetupRepoList');
      var cfSetupBanner = document.getElementById('cfSetupBanner');
      var cfSetupOpenBtn = document.getElementById('cfSetupOpenBtn');
      var cfSetupDismissAllBtn = document.getElementById('cfSetupDismissAllBtn');
      var cfSetupModalDismissAll = document.getElementById('cfSetupModalDismissAll');

      var CF_PAGES_SETUP_URL = 'https://dash.cloudflare.com/select-account/pages/new/provider/github';

      function openCfSetupModal() {
        if (!cfSetupModal) return;
        renderCfSetupRepoList(cfPendingData);
        cfSetupModal.classList.add('show');
      }
      function closeCfSetupModal() {
        if (cfSetupModal) cfSetupModal.classList.remove('show');
      }

      function renderCfSetupRepoList(items) {
        if (!cfSetupRepoList) return;
        if (items.length === 0) {
          cfSetupRepoList.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:16px;">通知はありません</div>';
          return;
        }
        cfSetupRepoList.innerHTML = items.map(function(item) {
          return '<div class="cf-setup-repo-item" data-pending-id="' + item.id + '">' +
            '<div class="cf-setup-repo-item-icon">' + (item.isPrivate ? '🔒' : '📦') + '</div>' +
            '<div class="cf-setup-repo-item-info">' +
              '<div class="cf-setup-repo-item-name">' + escapeForHtml(item.repoFullName || (item.repoOwner + '/' + item.repoName)) + '</div>' +
              '<div class="cf-setup-repo-item-meta">' + (item.isPrivate ? 'Private' : 'Public') + '</div>' +
            '</div>' +
            '<div class="cf-setup-repo-item-action">' +
              '<button class="cf-setup-repo-connect-btn" type="button" data-repo="' + escapeForHtml(item.repoFullName || (item.repoOwner + '/' + item.repoName)) + '" data-id="' + item.id + '">接続する</button>' +
              '<button class="cf-setup-repo-skip-btn" type="button" data-id="' + item.id + '" style="margin-left:6px;">スキップ</button>' +
            '</div>' +
          '</div>';
        }).join('');

        // イベントハンドラをバインド
        cfSetupRepoList.querySelectorAll('.cf-setup-repo-connect-btn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var pendingId = btn.getAttribute('data-id');
            var repoName = btn.getAttribute('data-repo');
            // Cloudflare Pages のセットアップ画面を開く
            window.open(CF_PAGES_SETUP_URL, '_blank');
            // 通知を消化
            dismissPending(pendingId, function() {
              removePendingItem(pendingId);
              showToast(repoName + ' の Cloudflare Pages セットアップ画面を開きました', 'success', 5000);
            });
          });
        });
        cfSetupRepoList.querySelectorAll('.cf-setup-repo-skip-btn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var pendingId = btn.getAttribute('data-id');
            dismissPending(pendingId, function() {
              removePendingItem(pendingId);
            });
          });
        });
      }

      function removePendingItem(pendingId) {
        var el = cfSetupRepoList ? cfSetupRepoList.querySelector('[data-pending-id="' + pendingId + '"]') : null;
        if (el) el.remove();
        // リストが空になったらモーダルとバナーを閉じる
        if (cfSetupRepoList && cfSetupRepoList.querySelectorAll('.cf-setup-repo-item').length === 0) {
          closeCfSetupModal();
          if (cfSetupBanner) cfSetupBanner.style.display = 'none';
        }
      }

      function dismissPending(pendingId, callback) {
        fetch('/api/cloudflare-setup-pending/' + pendingId + '/dismiss', {
          method: 'POST',
          credentials: 'same-origin',
        }).then(function() {
          if (callback) callback();
        }).catch(function() {
          if (callback) callback();
        });
      }

      function dismissAll(callback) {
        fetch('/api/cloudflare-setup-pending/dismiss-all', {
          method: 'POST',
          credentials: 'same-origin',
        }).then(function() {
          if (callback) callback();
        }).catch(function() {
          if (callback) callback();
        });
      }

      function escapeForHtml(str) {
        var d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
      }

      // バナーのイベント
      if (cfSetupOpenBtn) {
        cfSetupOpenBtn.addEventListener('click', openCfSetupModal);
      }
      if (cfSetupDismissAllBtn) {
        cfSetupDismissAllBtn.addEventListener('click', function() {
          dismissAll(function() {
            if (cfSetupBanner) cfSetupBanner.style.display = 'none';
            showToast('通知をスキップしました', 'info', 3000);
          });
        });
      }

      // モーダルのイベント
      if (cfSetupModalClose) {
        cfSetupModalClose.addEventListener('click', closeCfSetupModal);
      }
      if (cfSetupModal) {
        cfSetupModal.addEventListener('click', function(e) {
          if (e.target === cfSetupModal) closeCfSetupModal();
        });
      }
      if (cfSetupModalDismissAll) {
        cfSetupModalDismissAll.addEventListener('click', function() {
          dismissAll(function() {
            closeCfSetupModal();
            if (cfSetupBanner) cfSetupBanner.style.display = 'none';
            showToast('すべての通知をスキップしました', 'info', 3000);
          });
        });
      }

      // リポジトリ作成直後に呼ばれるグローバル関数
      window.showCfSetupModalForNewRepo = function(repoName, pendingId, ownerLogin) {
        var item = {
          id: pendingId,
          repoOwner: ownerLogin,
          repoName: repoName,
          repoFullName: ownerLogin + '/' + repoName,
          isPrivate: false,
        };
        if (cfSetupModal) {
          renderCfSetupRepoList([item]);
          cfSetupModal.classList.add('show');
        }
      };
    })();

    const sortButton = document.getElementById('sortUpdated');
    const repoList = document.getElementById('repoList');
    const sortIndicator = document.getElementById('sortIndicator');
    if (sortButton && repoList) {
      sortButton.addEventListener('click', function() {
        const order = sortButton.getAttribute('data-order') === 'desc' ? 'asc' : 'desc';
        sortButton.setAttribute('data-order', order);
        if (sortIndicator) {
          sortIndicator.textContent = order === 'desc' ? '▼' : '▲';
        }
        const rows = Array.from(repoList.querySelectorAll('.repo-row'));
        rows.sort((a, b) => {
          const aTime = Date.parse(a.getAttribute('data-updated') || '') || 0;
          const bTime = Date.parse(b.getAttribute('data-updated') || '') || 0;
          return order === 'desc' ? bTime - aTime : aTime - bTime;
        });
        rows.forEach((row) => repoList.appendChild(row));
      });
    }

    // ===== Cookie ヘルパー =====
    function getCookie(name) {
      var m = document.cookie.match('(^|;)\\\\s*' + name + '=([^;]*)');
      return m ? decodeURIComponent(m[2]) : null;
    }
    function setCookie(name, value) {
      document.cookie = name + '=' + encodeURIComponent(value) + '; Path=/; SameSite=Lax; Max-Age=31536000';
    }

    function showClassifyDebugModal(debug) {
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10100;display:flex;align-items:center;justify-content:center;';
      var modal = document.createElement('div');
      modal.style.cssText = 'background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border-color);border-radius:12px;padding:24px;max-width:620px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.25);font-size:13px;';
      var esc = function(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };
      var rowStyle = 'margin-bottom:12px;';
      var labelStyle = 'font-weight:600;margin-bottom:4px;color:var(--text-muted);';
      var boxStyle = 'font-family:monospace;background:var(--bg-secondary);padding:8px 10px;border-radius:6px;border:1px solid var(--border-color);';
      var hasFallback = debug.fallback != null;

      var fallbackSection = '';
      if (hasFallback) {
        var fb = debug.fallback;
        var fbHasResponse = fb.rawResponse !== '';
        fallbackSection = '<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border-color);">'
          + '<div style="font-weight:700;margin-bottom:10px;color:#b7791f;">フォールバック試行（プライマリが空レスポンスのため）</div>'
          + '<div style="' + rowStyle + '"><div style="' + labelStyle + '">フォールバックモデル</div>'
          + '<div style="' + boxStyle + '">' + esc(fb.model) + '</div></div>'
          + '<div style="' + rowStyle + '"><div style="' + labelStyle + '">フォールバックからの応答</div>'
          + '<div style="' + boxStyle + (fbHasResponse ? 'color:#276749;' : '') + '">'
          + (fbHasResponse ? esc(fb.rawResponse) : '<em style="color:var(--text-muted);">(空)</em>') + '</div></div>'
          + '<div><div style="' + labelStyle + '">フォールバックの分類結果</div>'
          + '<div style="' + boxStyle + 'font-weight:bold;">' + esc(fb.label) + '</div></div>'
          + '</div>';
      }

      modal.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">'
        + '<strong style="font-size:15px;">AI分類デバッグ情報</strong>'
        + '<button id="classifyDebugClose" style="border:none;background:none;font-size:18px;cursor:pointer;color:var(--text-muted);">×</button>'
        + '</div>'
        + '<div style="' + rowStyle + '"><div style="' + labelStyle + '">プライマリモデル</div>'
        + '<div style="' + boxStyle + '">' + esc(debug.model) + '</div></div>'
        + '<div style="' + rowStyle + '"><div style="' + labelStyle + '">AIへ送ったプロンプト</div>'
        + '<pre style="margin:0;white-space:pre-wrap;word-break:break-word;background:var(--bg-secondary);padding:10px;border-radius:6px;border:1px solid var(--border-color);font-size:12px;line-height:1.6;">' + esc(debug.prompt) + '</pre></div>'
        + '<div style="' + rowStyle + '"><div style="' + labelStyle + '">プライマリからの応答</div>'
        + '<div style="' + boxStyle + '">' + (esc(debug.rawResponse) || '<em style="color:var(--text-muted);">(空)</em>') + '</div></div>'
        + (hasFallback ? fallbackSection : '')
        + '<div style="margin-top:' + (hasFallback ? '16' : '0') + 'px;padding-top:' + (hasFallback ? '14' : '0') + 'px;' + (hasFallback ? 'border-top:1px solid var(--border-color);' : '') + '">'
        + '<div style="' + labelStyle + '">ワーカーが確定したカテゴリ</div>'
        + '<div style="' + boxStyle + 'font-weight:bold;">' + esc(debug.resolvedLabel) + '</div></div>';
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      function close() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
      overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
      modal.querySelector('#classifyDebugClose').addEventListener('click', close);
    }

    // ===== Issues+PR 取得 =====
    var issuesCountCache = {};
    var issuesCountPending = {};
    var permissionToastShown = false;

    function requestIssuesCount(owner, repoName) {
      var key = owner + '/' + repoName;
      if (issuesCountCache.hasOwnProperty(key)) {
        return Promise.resolve(issuesCountCache[key]);
      }
      if (issuesCountPending[key]) {
        return issuesCountPending[key];
      }
      var p = fetch('/api/repositories/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repoName) + '/issues-count', {
        headers: { 'Accept': 'application/json' },
      })
        .then(function(res) {
          if (!res.ok) {
            var err = new Error(res.status === 403 ? 'PERMISSION' : 'FAILED');
            err.status = res.status;
            throw err;
          }
          return res.json();
        })
        .then(function(data) {
          if (typeof data.count === 'number') {
            issuesCountCache[key] = data.count;
            return data.count;
          }
          var err = new Error('FAILED');
          err.status = 500;
          throw err;
        })
        .finally(function() {
          delete issuesCountPending[key];
        });
      issuesCountPending[key] = p;
      return p;
    }

    function handlePermissionToastOnce() {
      if (permissionToastShown) return;
      permissionToastShown = true;
      showToast('Issues+PRの取得権限が不足しています(METADATA : read)', 'error', 20000);
    }

    function updateIssuesPill(pillEl, count) {
      if (!pillEl) return;
      pillEl.textContent = '🐛 Issue+PR: ' + count;
      pillEl.classList.remove('has-issues', 'no-issues');
      if (count > 0) {
        pillEl.classList.add('has-issues');
      } else {
        pillEl.classList.add('no-issues');
      }
    }

    // ===== フィルタ状態の読み込み =====
    var permFilterSelect = document.getElementById('permFilterSelect');
    var savedFilter = getCookie('repo_perm_filter') || 'all';
    if (permFilterSelect) {
      permFilterSelect.value = savedFilter;
      permFilterSelect.addEventListener('change', function() {
        setCookie('repo_perm_filter', permFilterSelect.value);
        if (currentRepoName) renderInstallPerms(currentRepoName);
      });
    }

    // ===== サマリトグル状態の読み込み =====
    var summaryToggle = document.getElementById('summaryToggle');
    var summaryEl = document.getElementById('modalRepoSummary');
    function getSummaryToggles() {
      try { return JSON.parse(getCookie('repo_summary_toggles') || '{}'); } catch(e) { return {}; }
    }
    function saveSummaryToggle(repoName, open) {
      var toggles = getSummaryToggles();
      toggles[repoName] = open;
      setCookie('repo_summary_toggles', JSON.stringify(toggles));
    }
    if (summaryToggle) {
      summaryToggle.addEventListener('change', function() {
        var open = summaryToggle.checked;
        if (summaryEl) summaryEl.classList.toggle('hidden', !open);
        if (currentRepoName) saveSummaryToggle(currentRepoName, open);
      });
    }

    // ===== Approval Status Modal =====
    (function() {
      var approvalModal = document.getElementById('approvalStatusModal');
      var approvalBody = document.getElementById('approvalModalBody');
      var approvalOpenBtn = document.getElementById('openApprovalStatusModal');
      var approvalCloseBtn = document.getElementById('approvalModalClose');
      var approvalRefreshBtn = document.getElementById('approvalRefreshBtn');
      var repoPerms = ${repoPermsJson};
      var scopes = ${JSON.stringify(scopes)};
      var cfLinkedMap = ${JSON.stringify(cfLinked)};
      var vercelLinkedMap = ${JSON.stringify(vercelLinked)};
      var slackLinkedMap = ${JSON.stringify(slackLinked)};
      var repos = ${JSON.stringify(user.repositories.map(r => ({ name: r.name, owner: r.owner, isPrivate: r.isPrivate, updatedAt: r.updatedAt })))};

      function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

      function renderApprovalStatus(permsData, source) {
        if (!approvalBody) return;
        var html = '';

        var repoNames = Object.keys(permsData);
        var allPerms = null;
        try { allPerms = arguments.length > 2 ? arguments[2] : null; } catch(e) {}
        lastPermsData = permsData;
        lastAllPerms = allPerms;

        // 1. OAuth スコープ
        html += '<div class="approval-section">';
        html += '<div class="approval-section-title">OAuth スコープ</div>';
        html += '<div class="approval-card"><div class="approval-card-row">';
        html += '<span class="approval-card-label">付与スコープ</span>';
        if (scopes.length > 0) {
          html += '<span class="approval-badge ok">' + scopes.length + ' 件</span>';
        } else {
          html += '<span class="approval-badge none">なし (GitHub App)</span>';
        }
        html += '</div>';
        if (scopes.length > 0) {
          html += '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px">';
          for (var s = 0; s < scopes.length; s++) {
            html += '<code style="font-size:11px;padding:2px 6px;background:var(--badge-bg);border-radius:4px">' + esc(scopes[s]) + '</code>';
          }
          html += '</div>';
        }
        html += '</div></div>';

        // 2. サービス連携状況
        html += '<div class="approval-section">';
        html += '<div class="approval-section-title">サービス連携</div>';
        var services = [
          { name: 'Cloudflare', icon: '☁️', map: cfLinkedMap },
          { name: 'Vercel', icon: '▲', map: vercelLinkedMap },
          { name: 'Slack', icon: '💬', map: slackLinkedMap }
        ];
        for (var si = 0; si < services.length; si++) {
          var svc = services[si];
          var linked = [];
          for (var rn in svc.map) { if (svc.map[rn]) linked.push(rn); }
          html += '<div class="approval-card"><div class="approval-card-row">';
          html += '<span class="approval-card-label">' + svc.icon + ' ' + esc(svc.name) + '</span>';
          if (linked.length > 0) {
            html += '<span class="approval-badge ok">連携中 (' + linked.length + ')</span>';
          } else {
            html += '<span class="approval-badge none">未連携</span>';
          }
          html += '</div>';
          if (linked.length > 0) {
            html += '<div class="approval-repo-list" style="margin-top:6px">';
            linked.sort();
            for (var li = 0; li < linked.length; li++) {
              html += '<span class="approval-repo-chip">' + esc(linked[li]) + '</span>';
            }
            html += '</div>';
          }
          html += '</div>';
        }
        html += '</div>';

        // 3. グループ別 OAuth App（ユーザー手動管理）
        html += '<div class="approval-section">';
        html += '<div class="approval-section-title">グループ別 OAuth App 認可状況</div>';
        if (groupOAuthData && groupOAuthData.length > 0) {
          for (var gi = 0; gi < groupOAuthData.length; gi++) {
            var grp = groupOAuthData[gi];
            html += '<div class="approval-card">';
            html += '<div class="approval-card-row">';
            html += '<span class="approval-card-label"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + esc(grp.colorCode || '#667eea') + ';margin-right:6px;vertical-align:middle"></span>' + esc(grp.name) + '</span>';
            html += '<span class="approval-badge ' + (grp.apps.length > 0 ? 'ok' : 'none') + '">' + (grp.apps.length > 0 ? grp.apps.length + ' App' : '未登録') + '</span>';
            html += '</div>';
            if (grp.apps.length > 0) {
              html += '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">';
              for (var ai = 0; ai < grp.apps.length; ai++) {
                var app = grp.apps[ai];
                var isAuto = app.auto;
                html += '<span class="approval-repo-chip" title="' + esc(app.app_note || '') + '" style="display:inline-flex;align-items:center;gap:4px' + (isAuto ? ';background:#c6f6d5;color:#22543d' : '') + '">';
                html += (isAuto ? '✅ ' : '🔗 ') + esc(app.app_name);
                if (!isAuto) {
                  html += '<button type="button" class="oauth-app-remove-btn" data-group-id="' + esc(grp.id) + '" data-app-name="' + esc(app.app_name) + '" style="background:none;border:none;cursor:pointer;padding:0 2px;font-size:13px;color:var(--text-faint);line-height:1" title="削除">&times;</button>';
                }
                html += '</span>';
              }
              html += '</div>';
            }
            html += '<div style="margin-top:6px">';
            html += '<button type="button" class="approval-refresh-btn oauth-app-add-btn" data-group-id="' + esc(grp.id) + '" data-group-name="' + esc(grp.name) + '">+ App追加</button>';
            html += '</div>';
            html += '</div>';
          }
        } else {
          html += '<div class="approval-card"><div class="approval-card-row">';
          html += '<span class="approval-card-label">グループ</span>';
          html += '<span class="approval-badge none">未作成</span>';
          html += '</div>';
          html += '<div style="margin-top:6px;font-size:11px;color:var(--text-faint)">リポジトリグループを作成すると、グループ単位でOAuth App認可状況を管理できます</div>';
          html += '</div>';
        }
        html += '<div style="margin-top:8px;padding:10px 12px;background:var(--bg-secondary);border-radius:8px;font-size:11px;color:var(--text-muted);line-height:1.6">';
        html += '<strong>ℹ️ GitHub API の制約を補う機能</strong><br>';
        html += 'GitHub の公式 API は、ユーザーが認可済みの OAuth App 一覧を第三者アプリに開示していません。この機能はその制約を補い、ユーザー自身がグループ単位で認可状況を記録・管理できるようにするものです。各ユーザーは実際に利用しているリポジトリとアプリの組み合わせを登録するため、運用実態に基づいた信頼性の高い情報として活用できます。なお、登録内容の正確性の管理はユーザーの責任となります。';
        html += '</div>';
        html += '</div>';

        // 4. リポジトリ概要
        html += '<div class="approval-section">';
        html += '<div class="approval-section-title">リポジトリ概要</div>';
        html += '<div class="approval-card"><div class="approval-card-row">';
        html += '<span class="approval-card-label">合計</span>';
        html += '<span class="approval-card-value">' + repos.length + ' リポジトリ</span>';
        html += '</div>';
        var privCount = 0;
        for (var ri = 0; ri < repos.length; ri++) { if (repos[ri].isPrivate) privCount++; }
        if (privCount > 0) {
          html += '<div class="approval-card-row" style="margin-top:4px">';
          html += '<span class="approval-card-label" style="font-size:12px">Private</span>';
          html += '<span class="approval-card-value">' + privCount + '</span>';
          html += '</div>';
        }
        html += '</div>';

        // リポジトリ一覧（タップで詳細）
        if (repos.length > 0) {
          var selectedRepoEl = document.getElementById('modalRepoName');
          var selectedRepo = selectedRepoEl ? (selectedRepoEl.textContent || '') : '';
          html += '<div class="approval-card">';
          html += '<div class="approval-card-label" style="margin-bottom:6px">リポジトリ一覧 <span style="font-size:11px;font-weight:400;color:var(--text-faint)">— タップで詳細</span></div>';
          html += '<div class="approval-repo-list">';
          var sortedRepos = repos.slice().sort(function(a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
          for (var rci = 0; rci < sortedRepos.length; rci++) {
            var isActive = sortedRepos[rci].name === selectedRepo;
            html += '<span class="approval-repo-chip clickable' + (isActive ? ' active' : '') + '" data-repo="' + esc(sortedRepos[rci].name) + '">' + esc(sortedRepos[rci].name) + '</span>';
          }
          html += '</div></div>';
        }
        html += '</div>';

        approvalBody.innerHTML = html;
      }

      // App追加・削除ボタンのイベント委任（1回だけ登録）
      if (approvalBody) {
        approvalBody.addEventListener('click', function(ev) {
          var addBtn = ev.target.closest('.oauth-app-add-btn');
          if (addBtn) {
            openAddAppModal(addBtn.dataset.groupId, addBtn.dataset.groupName);
            return;
          }
          var rmBtn = ev.target.closest('.oauth-app-remove-btn');
          if (rmBtn) {
            var gid2 = rmBtn.dataset.groupId;
            var aname = rmBtn.dataset.appName;
            if (!confirm(aname + ' を削除しますか？')) return;
            fetch('/api/repo-groups/' + encodeURIComponent(gid2) + '/oauth-apps/' + encodeURIComponent(aname), {
              method: 'DELETE', credentials: 'same-origin'
            }).then(function() { loadApprovalData(); });
          }
        });
      }

      // --- Add App Modal ---
      var addAppModal = document.getElementById('addAppModal');
      var addAppNameInput = document.getElementById('addAppNameInput');
      var addAppNoteInput = document.getElementById('addAppNoteInput');
      var addAppGroupLabel = document.getElementById('addAppGroupLabel');
      var addAppRepoList = document.getElementById('addAppRepoList');
      var addAppSortToggle = document.getElementById('addAppSortToggle');
      var addAppSortLabel = document.getElementById('addAppSortLabel');
      var addAppSubmitBtn = document.getElementById('addAppSubmitBtn');
      var addAppCancelBtn = document.getElementById('addAppCancelBtn');
      var addAppCloseBtn = document.getElementById('addAppClose');
      var addAppGroupId = '';
      var addAppAlphaSort = false;

      function getReposSorted(alpha) {
        var list = repos.slice();
        if (alpha) {
          list.sort(function(a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
        } else {
          list.sort(function(a, b) {
            var da = a.updatedAt || ''; var db = b.updatedAt || '';
            return da > db ? -1 : da < db ? 1 : 0;
          });
        }
        return list;
      }

      function renderAddAppRepoList() {
        if (!addAppRepoList || !addAppNameInput) return;
        var sorted = getReposSorted(addAppAlphaSort);
        var currentVal = addAppNameInput.value.trim();
        var html = '';
        for (var ri = 0; ri < sorted.length; ri++) {
          var r = sorted[ri];
          var sel = r.name === currentVal ? ' selected' : '';
          var dateStr = r.updatedAt ? r.updatedAt.substring(0, 10) : '';
          html += '<div class="add-app-repo-item' + sel + '" data-name="' + esc(r.name) + '">';
          html += '<span class="add-app-repo-name">' + esc(r.name) + '</span>';
          html += '<span class="add-app-repo-date">' + esc(dateStr) + '</span>';
          html += '</div>';
        }
        addAppRepoList.innerHTML = html;
      }

      function openAddAppModal(groupId, groupName) {
        addAppGroupId = groupId;
        if (addAppGroupLabel) addAppGroupLabel.textContent = '対象グループ: ' + groupName;

        var topRepo = getReposSorted(false);
        if (addAppNameInput) addAppNameInput.value = topRepo.length > 0 ? topRepo[0].name : '';
        if (addAppNoteInput) addAppNoteInput.value = '';

        addAppAlphaSort = false;
        if (addAppSortToggle) addAppSortToggle.checked = false;
        if (addAppSortLabel) addAppSortLabel.textContent = '更新順';
        renderAddAppRepoList();

        if (addAppModal) addAppModal.classList.add('show');
        if (addAppNameInput) addAppNameInput.focus();
      }

      function closeAddAppModal() {
        if (addAppModal) addAppModal.classList.remove('show');
      }

      function submitAddApp() {
        var appName = addAppNameInput ? addAppNameInput.value.trim() : '';
        if (!appName) return;
        var appNote = addAppNoteInput ? addAppNoteInput.value.trim() : '';
        fetch('/api/repo-groups/' + encodeURIComponent(addAppGroupId) + '/oauth-apps', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appName: appName, appNote: appNote })
        }).then(function() {
          closeAddAppModal();
          loadApprovalData();
        });
      }

      if (addAppRepoList) {
        addAppRepoList.addEventListener('click', function(ev) {
          var item = ev.target.closest('.add-app-repo-item');
          if (item && item.dataset.name && addAppNameInput) {
            addAppNameInput.value = item.dataset.name;
            renderAddAppRepoList();
          }
        });
      }

      if (addAppSortToggle) {
        addAppSortToggle.addEventListener('change', function() {
          addAppAlphaSort = addAppSortToggle.checked;
          if (addAppSortLabel) addAppSortLabel.textContent = addAppAlphaSort ? 'ABC順' : '更新順';
          renderAddAppRepoList();
        });
      }

      if (addAppSubmitBtn) addAppSubmitBtn.addEventListener('click', submitAddApp);
      if (addAppCancelBtn) addAppCancelBtn.addEventListener('click', closeAddAppModal);
      if (addAppCloseBtn) addAppCloseBtn.addEventListener('click', closeAddAppModal);
      if (addAppModal) {
        addAppModal.addEventListener('click', function(e) {
          if (e.target === addAppModal) closeAddAppModal();
        });
      }
      if (addAppNameInput) {
        addAppNameInput.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') submitAddApp();
        });
      }

      var groupOAuthData = null;

      function loadApprovalData() {
        if (!approvalBody) return;
        approvalBody.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted)">読み込み中...</div>';

        Promise.all([
          fetch('/api/repo-permissions', { credentials: 'same-origin' }).then(function(r) { return r.json(); }),
          fetch('/api/repo-groups', { credentials: 'same-origin' }).then(function(r) { return r.json(); }).catch(function() { return { groups: [] }; }),
          fetch('/api/repo-oauth-apps', { credentials: 'same-origin' }).then(function(r) { return r.json(); }).catch(function() { return { repoApps: {} }; })
        ]).then(function(results) {
          var permData = results[0];
          var groupData = results[1];
          var repoAppsData = results[2];

          lastRepoApps = repoAppsData.repoApps || {};

          var groups = groupData.groups || [];
          var appPromises = groups.map(function(g) {
            return fetch('/api/repo-groups/' + encodeURIComponent(g.id) + '/oauth-apps', { credentials: 'same-origin' })
              .then(function(r) { return r.json(); })
              .then(function(d) {
                var apps = (d.apps || []).slice();
                var appNames = {};
                for (var ai = 0; ai < apps.length; ai++) appNames[apps[ai].app_name] = true;

                // Slack: グループに slack_channel_id が設定済みなら自動認可
                if (g.slackChannelId && !appNames['Slack']) {
                  apps.push({ app_name: 'Slack', app_note: '自動検出（グループにSlackチャンネル設定済み）', added_at: '', auto: true });
                }

                // Cloudflare/Vercel: グループメンバーのリポジトリが連携済みなら自動認可
                var gRepos = g.repos || [];
                var hasCf = false, hasVercel = false;
                for (var ri = 0; ri < gRepos.length; ri++) {
                  if (!hasCf && cfLinkedMap[gRepos[ri]]) hasCf = true;
                  if (!hasVercel && vercelLinkedMap[gRepos[ri]]) hasVercel = true;
                }
                if (hasCf && !appNames['Cloudflare']) {
                  apps.push({ app_name: 'Cloudflare', app_note: '自動検出（グループ内リポジトリが連携済み）', added_at: '', auto: true });
                }
                if (hasVercel && !appNames['Vercel']) {
                  apps.push({ app_name: 'Vercel', app_note: '自動検出（グループ内リポジトリが連携済み）', added_at: '', auto: true });
                }

                return { id: g.id, name: g.name, colorCode: g.colorCode, apps: apps };
              })
              .catch(function() { return { id: g.id, name: g.name, colorCode: g.colorCode, apps: [] }; });
          });

          return Promise.all(appPromises).then(function(groupApps) {
            groupOAuthData = groupApps;

            // 自動検出分を lastRepoApps にもマージ
            for (var gai = 0; gai < groupApps.length; gai++) {
              var ga = groupApps[gai];
              var gaGroup = null;
              for (var ggi = 0; ggi < groups.length; ggi++) {
                if (groups[ggi].id === ga.id) { gaGroup = groups[ggi]; break; }
              }
              if (!gaGroup) continue;
              var gaRepos = gaGroup.repos || [];
              for (var gri = 0; gri < gaRepos.length; gri++) {
                var rName = gaRepos[gri];
                for (var aai = 0; aai < ga.apps.length; aai++) {
                  var ap = ga.apps[aai];
                  if (!ap.auto) continue;
                  if (!lastRepoApps[rName]) lastRepoApps[rName] = [];
                  var exists = false;
                  for (var exi = 0; exi < lastRepoApps[rName].length; exi++) {
                    if (lastRepoApps[rName][exi].appName === ap.app_name) { exists = true; break; }
                  }
                  if (!exists) {
                    lastRepoApps[rName].push({ appName: ap.app_name, appNote: ap.app_note, groupName: ga.name, colorCode: ga.colorCode });
                  }
                }
              }
            }

            renderApprovalStatus(permData.permissions || {}, permData.source || '', permData.allPermissions || null);
          });
        }).catch(function() {
          groupOAuthData = null;
          lastRepoApps = {};
          renderApprovalStatus(repoPerms, 'cache');
        });
      }

      var lastPermsData = {};
      var lastAllPerms = null;
      var lastRepoApps = {};

      function openApprovalModal() {
        loadApprovalData();
        if (approvalModal) approvalModal.classList.add('show');
      }

      function closeApprovalModal() {
        if (approvalModal) approvalModal.classList.remove('show');
      }

      // --- Repo Detail Modal ---
      var repoDetailModal = document.getElementById('repoDetailModal');
      var repoDetailBody = document.getElementById('repoDetailBody');
      var repoDetailTitle = document.getElementById('repoDetailTitle');
      var repoDetailCloseBtn = document.getElementById('repoDetailClose');

      function findRepoInfo(repoName) {
        for (var i = 0; i < repos.length; i++) {
          if (repos[i].name === repoName) return repos[i];
        }
        return null;
      }

      function renderRepoDetail(repoName) {
        if (!repoDetailBody || !repoDetailTitle) return;
        var info = findRepoInfo(repoName);
        var owner = info ? info.owner : '';
        var fullName = owner ? owner + '/' + repoName : repoName;
        repoDetailTitle.textContent = '📦 ' + repoName;

        var html = '';

        // リポジトリ基本情報
        html += '<div class="approval-section">';
        html += '<div class="approval-section-title">基本情報</div>';
        html += '<div class="approval-card">';
        html += '<div class="approval-card-row"><span class="approval-card-label">リポジトリ</span><span class="approval-card-value">' + esc(fullName) + '</span></div>';
        if (info) {
          html += '<div class="approval-card-row" style="margin-top:4px"><span class="approval-card-label">公開状態</span>';
          html += info.isPrivate ? '<span class="approval-badge warn">Private</span>' : '<span class="approval-badge ok">Public</span>';
          html += '</div>';
        }
        html += '</div></div>';

        // サービス連携
        var svcItems = [
          { name: 'Cloudflare', icon: '☁️', linked: cfLinkedMap[repoName] },
          { name: 'Vercel', icon: '▲', linked: vercelLinkedMap[repoName] },
          { name: 'Slack', icon: '💬', linked: slackLinkedMap[repoName] }
        ];
        html += '<div class="approval-card" style="margin-top:8px">';
        html += '<div class="approval-card-label" style="margin-bottom:6px">サービス連携</div>';
        for (var sv = 0; sv < svcItems.length; sv++) {
          var s = svcItems[sv];
          html += '<div class="approval-card-row" style="margin-top:4px"><span style="font-size:12px">' + s.icon + ' ' + esc(s.name) + '</span>';
          html += s.linked ? '<span class="approval-badge ok">連携中</span>' : '<span class="approval-badge none">未連携</span>';
          html += '</div>';
        }
        html += '</div>';
        html += '</div>';

        // グループ経由の OAuth App 認可状況（/api/repo-oauth-apps で取得したデータ）
        if (lastRepoApps && lastRepoApps[repoName] && lastRepoApps[repoName].length > 0) {
          html += '<div class="approval-section">';
          html += '<div class="approval-section-title">認可済み OAuth App（グループ経由）</div>';
          html += '<div class="approval-card">';
          var rapps = lastRepoApps[repoName];
          for (var rai = 0; rai < rapps.length; rai++) {
            var ra = rapps[rai];
            html += '<div class="approval-card-row" style="margin-top:' + (rai > 0 ? '6' : '0') + 'px">';
            html += '<span style="font-size:12px;font-weight:600">🔗 ' + esc(ra.appName) + '</span>';
            html += '<span style="font-size:11px;color:var(--text-muted)"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + esc(ra.colorCode) + ';margin-right:4px;vertical-align:middle"></span>' + esc(ra.groupName) + '</span>';
            html += '</div>';
            if (ra.appNote) {
              html += '<div style="font-size:11px;color:var(--text-faint);margin-top:2px;padding-left:20px">' + esc(ra.appNote) + '</div>';
            }
          }
          html += '</div>';
          html += '<div style="margin-top:6px;font-size:10px;color:var(--text-faint)">※ GitHub API の制約を補い、ユーザーが運用実態に基づきグループ単位で登録した情報です。</div>';
          html += '</div>';
        }

        // 制約の説明
        html += '<div class="repo-detail-notice">';
        html += '<div class="repo-detail-notice-title">⚠️ 権限変更に関する制約</div>';
        html += 'このアプリから直接リポジトリの権限を変更することはできません。GitHub の仕様により以下の制約があります:';
        html += '<ul style="margin:8px 0 0 16px;padding:0;list-style:disc">';
        html += '<li style="margin-bottom:4px"><strong>GitHub App 権限</strong>: アプリ開発者がマニフェストで定義した権限セットに対し、ユーザーは「承認」か「アンインストール」の二択のみ。個別権限の取り消しは不可</li>';
        html += '<li style="margin-bottom:4px"><strong>OAuth スコープ</strong>: 認可時にリクエストされた全スコープが一括で付与される仕組み。個別スコープの追加・削除は API 上存在しない</li>';
        html += '<li style="margin-bottom:4px"><strong>OAuth グラント取り消し</strong>: <code style="font-size:11px">DELETE /applications/{client_id}/grant</code> はグラント全体を削除し、全機能が停止する。個別スコープの取り消し手段はない</li>';
        html += '</ul></div>';

        // 公式ページへのリンク
        html += '<div class="repo-detail-links">';
        html += '<a class="repo-detail-link" href="https://github.com/settings/installations" target="_blank" rel="noopener">';
        html += '<span class="repo-detail-link-icon">⚙️</span>';
        html += '<div><div>GitHub App インストール管理</div>';
        html += '<div class="repo-detail-link-desc">インストール済みアプリの確認・アンインストール</div></div>';
        html += '</a>';
        html += '<a class="repo-detail-link" href="https://github.com/settings/applications" target="_blank" rel="noopener">';
        html += '<span class="repo-detail-link-icon">🔑</span>';
        html += '<div><div>Authorized OAuth Apps</div>';
        html += '<div class="repo-detail-link-desc">OAuth アプリの認可状況確認・取り消し</div></div>';
        html += '</a>';
        if (owner) {
          html += '<a class="repo-detail-link" href="https://github.com/' + esc(fullName) + '/settings" target="_blank" rel="noopener">';
          html += '<span class="repo-detail-link-icon">📦</span>';
          html += '<div><div>' + esc(repoName) + ' の設定</div>';
          html += '<div class="repo-detail-link-desc">リポジトリ設定・Webhooks・ブランチ保護等</div></div>';
          html += '</a>';
        }
        html += '</div>';

        repoDetailBody.innerHTML = html;
      }

      function openRepoDetail(repoName) {
        renderRepoDetail(repoName);
        if (repoDetailModal) repoDetailModal.classList.add('show');
      }

      function closeRepoDetail() {
        if (repoDetailModal) repoDetailModal.classList.remove('show');
      }

      // チップクリック委任（approvalBody 内）
      if (approvalBody) {
        approvalBody.addEventListener('click', function(e) {
          var chip = e.target.closest('.approval-repo-chip.clickable');
          if (chip && chip.dataset.repo) {
            openRepoDetail(chip.dataset.repo);
          }
        });
      }

      if (repoDetailCloseBtn) repoDetailCloseBtn.addEventListener('click', closeRepoDetail);
      if (repoDetailModal) {
        repoDetailModal.addEventListener('click', function(e) {
          if (e.target === repoDetailModal) closeRepoDetail();
        });
      }

      if (approvalOpenBtn) approvalOpenBtn.addEventListener('click', openApprovalModal);
      if (approvalCloseBtn) approvalCloseBtn.addEventListener('click', closeApprovalModal);
      if (approvalRefreshBtn) approvalRefreshBtn.addEventListener('click', loadApprovalData);
      if (approvalModal) {
        approvalModal.addEventListener('click', function(e) {
          if (e.target === approvalModal) closeApprovalModal();
        });
      }
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
          if (addAppModal && addAppModal.classList.contains('show')) { closeAddAppModal(); return; }
          if (repoDetailModal && repoDetailModal.classList.contains('show')) { closeRepoDetail(); return; }
          if (approvalModal && approvalModal.classList.contains('show')) closeApprovalModal();
        }
      });
    })();

    // ===== Permissions Modal =====
    var modal = document.getElementById('permissionsModal');
    var modalClose = document.getElementById('modalClose');
    var modalRepoName = document.getElementById('modalRepoName');
    var repoPermsData = ${repoPermsJson};
    var oauthScopes = ${JSON.stringify(scopes)};
    var currentRepoName = '';
    var currentRepoOwner = '';
    var currentRepoFullName = '';

    // クライアントサイド HTML エスケープ（XSS 防止）
    function esc(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // 全権限キーの定義（インストール権限に含まれないものも「禁止中」として扱う）
    var allPermKeys = [
      'contents', 'issues', 'pull_requests', 'metadata', 'actions', 'checks',
      'deployments', 'environments', 'pages', 'secrets', 'workflows',
      'administration', 'members', 'statuses', 'vulnerability_alerts',
      'security_events', 'packages', 'webhooks'
    ];

    var permDisplayNames = {
      contents: { name: 'Contents (コード)', icon: '📦', caps: ['リポジトリのコード・ファイルの読み書き', 'コミット履歴の閲覧'] },
      issues: { name: 'Issues', icon: '🐛', caps: ['Issueの作成・編集・クローズ', 'Issueへのコメント追加', 'ラベル・マイルストーンの管理'] },
      pull_requests: { name: 'Pull Requests', icon: '🔀', caps: ['PRの作成・編集・クローズ', 'PRへのレビュー・コメント', 'PRのマージ'] },
      metadata: { name: 'Metadata', icon: '📋', caps: ['リポジトリのメタデータ読み取り'] },
      actions: { name: 'Actions', icon: '⚡', caps: ['ワークフローの管理・実行'] },
      checks: { name: 'Checks', icon: '✅', caps: ['チェック結果の読み書き'] },
      deployments: { name: 'Deployments', icon: '🚀', caps: ['デプロイメントの管理'] },
      environments: { name: 'Environments', icon: '🌍', caps: ['環境の管理'] },
      pages: { name: 'Pages', icon: '📄', caps: ['GitHub Pagesの管理'] },
      secrets: { name: 'Secrets', icon: '🔑', caps: ['シークレットの管理'] },
      workflows: { name: 'Workflows', icon: '🔧', caps: ['ワークフローファイルの編集'] },
      administration: { name: 'Administration', icon: '⚙️', caps: ['リポジトリ設定の管理'] },
      members: { name: 'Members', icon: '👥', caps: ['メンバーの管理'] },
      statuses: { name: 'Statuses', icon: '🔔', caps: ['コミットステータスの管理'] },
      vulnerability_alerts: { name: 'Vulnerability alerts', icon: '🛡️', caps: ['脆弱性アラートの管理'] },
      security_events: { name: 'Security events', icon: '🔒', caps: ['セキュリティイベントの管理'] },
      packages: { name: 'Packages', icon: '📦', caps: ['パッケージの管理'] },
      webhooks: { name: 'Webhooks', icon: '🪝', caps: ['Webhookの管理'] },
    };

    function levelLabel(level) {
      if (level === 'write') return 'Read & Write';
      if (level === 'read') return 'Read';
      if (level === 'admin') return 'Admin';
      return level;
    }

    function renderInstallPerms(repoName) {
      var container = document.getElementById('installPermItems');
      if (!container) return;
      var info = repoPermsData[repoName];
      var grantedPerms = (info && info.permissions) ? info.permissions : {};
      var filter = permFilterSelect ? permFilterSelect.value : 'all';

      // 有効→禁止の順、それぞれアルファベット順にソート
      var sortedKeys = allPermKeys.slice().sort(function(a, b) {
        var aGranted = !!grantedPerms[a];
        var bGranted = !!grantedPerms[b];
        if (aGranted !== bGranted) return aGranted ? -1 : 1;
        return a.localeCompare(b);
      });

      var html = '';
      var count = 0;
      sortedKeys.forEach(function(key) {
        var level = grantedPerms[key];
        var isGranted = !!level;
        // フィルタ適用
        if (filter === 'granted' && !isGranted) return;
        if (filter === 'denied' && isGranted) return;
        count++;
        var display = permDisplayNames[key] || { name: key, icon: '🔧', caps: [] };
        if (isGranted) {
          html += '<div class="perm-item active">';
          html += '<div class="perm-header">';
          html += '<span class="perm-icon">' + esc(display.icon) + '</span>';
          html += '<span class="perm-name">' + esc(display.name) + '</span>';
          html += '<span class="perm-badge on">' + esc(levelLabel(level)) + '</span>';
          html += '</div>';
          if (display.caps.length > 0) {
            html += '<ul class="perm-caps">';
            display.caps.forEach(function(cap) { html += '<li>' + esc(cap) + '</li>'; });
            html += '</ul>';
          }
          html += '</div>';
        } else {
          html += '<div class="perm-item inactive">';
          html += '<div class="perm-header">';
          html += '<span class="perm-icon">' + esc(display.icon) + '</span>';
          html += '<span class="perm-name">' + esc(display.name) + '</span>';
          html += '<span class="perm-badge off">禁止中</span>';
          html += '</div>';
          html += '</div>';
        }
      });
      if (count === 0) {
        html = '<div class="perm-no-install">該当する権限がありません</div>';
      }
      html += '<div style="margin-top:10px;font-size:11px;color:var(--text-faint)">'
        + 'GitHub App の権限はアプリのインストール設定から変更できます → '
        + '<a href="https://github.com/settings/installations" target="_blank" rel="noreferrer" style="color:#2b6cb0;font-weight:600">GitHub Settings</a>'
        + '</div>';
      container.innerHTML = html;
    }

    function renderOAuthPerms() {
      var container = document.getElementById('oauthPermItems');
      if (!container) return;
      var items = [
        { name: 'repo', label: 'リポジトリ全般', icon: '📦' },
        { name: 'public_repo', label: 'パブリックリポジトリ', icon: '🌐' },
        { name: 'read:user', label: 'ユーザー情報 (読み取り)', icon: '👤' },
        { name: 'user', label: 'ユーザー情報', icon: '👤' },
        { name: 'user:email', label: 'メールアドレス', icon: '✉️' },
      ];
      var html = '';
      items.forEach(function(item) {
        var active = oauthScopes.indexOf(item.name) >= 0;
        html += '<div class="perm-item ' + (active ? 'active' : 'inactive') + '">';
        html += '<div class="perm-header">';
        html += '<span class="perm-icon">' + esc(item.icon) + '</span>';
        html += '<span class="perm-name">' + esc(item.label) + '</span>';
        html += '<span class="perm-badge ' + (active ? 'on' : 'off') + '">' + (active ? '有効' : '無効') + '</span>';
        html += '</div>';
        html += '</div>';
      });
      container.innerHTML = html;
    }

    function openPermissionsModal(repoName, owner, rowEl) {
      currentRepoName = repoName;
      currentRepoOwner = owner;
      currentRepoFullName = owner && repoName ? owner + '/' + repoName : '';
      if (commitHistoryBtnLabel) {
        updateCommitHistoryButtonLabel(null);
      }
      if (modalRepoName) {
        modalRepoName.textContent = repoName;
      }

      // サマリトグルの復元
      var toggles = getSummaryToggles();
      var isOpen = toggles[repoName] !== undefined ? toggles[repoName] : true;
      if (summaryToggle) summaryToggle.checked = isOpen;
      if (summaryEl) summaryEl.classList.toggle('hidden', !isOpen);

      var descEl = document.getElementById('modalRepoDesc');
      var metaGrid = document.getElementById('modalRepoMetaGrid');
      if (rowEl && descEl && metaGrid) {
        var desc = rowEl.getAttribute('data-description') || '';
        descEl.textContent = desc || '説明なし';
        var lang = rowEl.getAttribute('data-language') || '不明';
        var stars = rowEl.getAttribute('data-stars') || '0';
        var forks = rowEl.getAttribute('data-forks') || '0';
        var isPrivate = rowEl.getAttribute('data-private') === 'true';
        var updated = rowEl.getAttribute('data-updated') || '';
        var commitSha = rowEl.getAttribute('data-commit-sha') || '';
        var commitUrl = rowEl.getAttribute('data-commit-url') || '';
        var metaHtml = '';
        metaHtml += '<span class="modal-repo-meta-item">' + (isPrivate ? '🔒 Private' : '🌐 Public') + '</span>';
        metaHtml += '<span class="modal-repo-meta-item">🧩 ' + esc(lang) + '</span>';
        metaHtml += '<span class="modal-repo-meta-item">⭐ ' + esc(stars) + '</span>';
        metaHtml += '<span class="modal-repo-meta-item">🍴 ' + esc(forks) + '</span>';
        if (updated) {
          if (commitUrl) {
            metaHtml += '<span class="modal-repo-meta-item"><a class="modal-repo-meta-link" href="' + esc(commitUrl) + '" target="_blank" rel="noreferrer">🕒 ' + esc(updated) + '</a></span>';
          } else {
            metaHtml += '<span class="modal-repo-meta-item">🕒 ' + esc(updated) + '</span>';
          }
        }
        if (commitSha) {
          if (commitUrl) {
            metaHtml += '<span class="modal-repo-meta-item"><a class="modal-repo-meta-link" href="' + esc(commitUrl) + '" target="_blank" rel="noreferrer">🔗 ' + esc(commitSha) + '</a></span>';
          } else {
            metaHtml += '<span class="modal-repo-meta-item">🔗 ' + esc(commitSha) + '</span>';
          }
        }
        metaHtml += '<span class="modal-repo-meta-item" id="modalIssuesCount">🐛 Issue+PR: 取得中...</span>';
        metaGrid.innerHTML = metaHtml;

        var issuesEl = document.getElementById('modalIssuesCount');
        if (issuesEl) {
          if (!owner || !repoName) {
            issuesEl.textContent = '🐛 Issue+PR: 取得不可';
          } else {
            requestIssuesCount(owner, repoName)
              .then(function(count) {
                issuesEl.textContent = '🐛 Issue+PR: ' + count;
                showToast('Issue+PR: ' + count + ' 件', 'success', 5000);
                var pill = rowEl.querySelector('[data-issues-pill=\"1\"]');
                updateIssuesPill(pill, count);
              })
              .catch(function(err) {
                issuesEl.textContent = '🐛 Issue+PR: 取得不可';
                if (err && err.message === 'PERMISSION') {
                  handlePermissionToastOnce();
                }
              });
          }
        }
      }

      // フィルタの復元
      if (permFilterSelect) {
        var saved = getCookie('repo_perm_filter') || 'all';
        permFilterSelect.value = saved;
      }

      renderInstallPerms(repoName);
      renderOAuthPerms();
      // リポジトリ選択時にヒートマップカレンダーを開始
      startHeatmapForRepo(owner);
      if (modal) {
        modal.classList.add('show');
      }
    }

    function closePermissionsModal() {
      currentRepoName = '';
      currentRepoOwner = '';
      currentRepoFullName = '';
      if (modal) {
        modal.classList.remove('show');
      }
    }

    if (modalClose) {
      modalClose.addEventListener('click', closePermissionsModal);
    }
    if (modal) {
      modal.addEventListener('click', function(e) {
        if (e.target === modal) {
          closePermissionsModal();
        }
      });
    }
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        // 月別コミット状況 → コミット詳細 → コミット履歴 → ツリーモーダル → Zanzibar モーダル → 権限モーダルの順に閉じる
        if (monthlyStatusModal && monthlyStatusModal.classList.contains('show')) {
          closeMonthlyStatusModal();
          return;
        }
        if (commitDetailModal && commitDetailModal.classList.contains('show')) {
          commitDetailModal.classList.remove('show');
          return;
        }
        if (commitHistoryModal && commitHistoryModal.classList.contains('show')) {
          closeCommitHistoryModal();
          return;
        }
        if (treeModal && treeModal.classList.contains('show')) {
          closeTreeModal();
          return;
        }
        if (zanzibarModal && zanzibarModal.classList.contains('show')) {
          closeZanzibarModal();
          return;
        }
        closePermissionsModal();
      }
    });

    // リポジトリ行クリックでモーダル表示（リンク・ボタンクリックは除外）
    document.querySelectorAll('.repo-row').forEach(function(row) {
      row.addEventListener('click', function(e) {
        var target = e.target;
        while (target && target !== row) {
          if (target.tagName === 'A' || target.tagName === 'BUTTON') return;
          target = target.parentElement;
        }
        var repoName = row.getAttribute('data-repo') || '';
        var owner = row.getAttribute('data-owner') || '';
        if (!repoName) {
          var nameEl = row.querySelector('.repo-name-link');
          repoName = nameEl ? nameEl.textContent.trim() : '';
        }
        openPermissionsModal(repoName, owner, row);
      });
    });

    // 初回読み込み時に全リポジトリのIssue+PR数を取得
    document.querySelectorAll('.repo-row').forEach(function(row) {
      var repoName = row.getAttribute('data-repo') || '';
      var owner = row.getAttribute('data-owner') || '';
      var pill = row.querySelector('[data-issues-pill=\"1\"]');
      if (!owner || !repoName || !pill) return;
      requestIssuesCount(owner, repoName)
        .then(function(count) {
          updateIssuesPill(pill, count);
        })
        .catch(function(err) {
          pill.textContent = '🐛 Issue+PR: 取得不可';
          if (err && err.message === 'PERMISSION') {
            handlePermissionToastOnce();
          }
        });
    });

    // ===== Zanzibar Tuples Modal =====
    var zanzibarModal = document.getElementById('zanzibarModal');
    var zanzibarModalClose = document.getElementById('zanzibarModalClose');
    var zanzibarBtn = document.getElementById('zanzibarBtn');
    var zanzibarCopyBtn = document.getElementById('zanzibarCopyBtn');
    var zanzibarRepoName = document.getElementById('zanzibarRepoName');
    var zanzibarTuples = document.getElementById('zanzibarTuples');
    var APP_NAME = 'cloudflare-workers-github-oauth-1';

    function generateZanzibarTuples(repoName) {
      var info = repoPermsData[repoName];
      var perms = (info && info.permissions) ? info.permissions : {};
      var selection = (info && info.repositorySelection) ? info.repositorySelection : 'unknown';
      var lines = [];

      // App ↔ Installation
      lines.push({ type: 'comment', text: '# App ↔ Installation' });
      lines.push({
        object: 'github_app:' + APP_NAME,
        relation: 'installation',
        subject: 'installation:' + APP_NAME
      });
      lines.push({ type: 'blank' });

      // Repository ↔ Installation
      lines.push({ type: 'comment', text: '# Repository ↔ Installation' });
      if (selection === 'all') {
        lines.push({ type: 'comment', text: '# repository_selection: all' });
        lines.push({
          object: 'installation:' + APP_NAME,
          relation: 'repository_selection_all',
          subject: 'installation:' + APP_NAME
        });
      } else {
        lines.push({
          object: 'repository:' + repoName,
          relation: 'installed_app',
          subject: 'installation:' + APP_NAME
        });
      }
      lines.push({ type: 'blank' });

      // Permission tuples
      var permKeys = Object.keys(perms).sort();
      if (permKeys.length > 0) {
        lines.push({ type: 'comment', text: '# Permissions' });
        permKeys.forEach(function(key) {
          var level = perms[key];
          var safeKey = key.replace(/-/g, '_');
          var target = selection === 'all'
            ? 'installation:' + APP_NAME
            : 'repository:' + repoName;
          lines.push({
            object: target,
            relation: safeKey + '_' + level,
            subject: 'installation:' + APP_NAME
          });
        });
      } else {
        lines.push({ type: 'comment', text: '# (権限なし)' });
      }

      return lines;
    }

    function renderZanzibarTuples(lines) {
      var htmlParts = [];
      lines.forEach(function(line) {
        if (line.type === 'comment') {
          htmlParts.push('<span class="zt-comment">' + escapeForPre(line.text) + '</span>');
        } else if (line.type === 'blank') {
          htmlParts.push('');
        } else {
          htmlParts.push(
            '<span class="zt-object">' + escapeForPre(line.object) + '</span>' +
            '<span class="zt-relation">#' + escapeForPre(line.relation) + '</span>' +
            '<span class="zt-subject">@' + escapeForPre(line.subject) + '</span>'
          );
        }
      });
      return htmlParts.join('\\n');
    }

    function zanzibarTuplesToPlainText(lines) {
      return lines.map(function(line) {
        if (line.type === 'comment') return line.text;
        if (line.type === 'blank') return '';
        return line.object + '#' + line.relation + '@' + line.subject;
      }).join('\\n');
    }

    function escapeForPre(str) {
      return esc(str);
    }

    function openZanzibarModal() {
      if (!currentRepoName) return;
      if (zanzibarRepoName) zanzibarRepoName.textContent = currentRepoName;
      var lines = generateZanzibarTuples(currentRepoName);
      if (zanzibarTuples) zanzibarTuples.innerHTML = renderZanzibarTuples(lines);
      if (zanzibarModal) zanzibarModal.classList.add('show');
    }

    function closeZanzibarModal() {
      if (zanzibarModal) zanzibarModal.classList.remove('show');
    }

    if (zanzibarBtn) {
      zanzibarBtn.addEventListener('click', openZanzibarModal);
    }
    if (zanzibarModalClose) {
      zanzibarModalClose.addEventListener('click', closeZanzibarModal);
    }
    if (zanzibarModal) {
      zanzibarModal.addEventListener('click', function(e) {
        if (e.target === zanzibarModal) closeZanzibarModal();
      });
    }
    if (zanzibarCopyBtn) {
      zanzibarCopyBtn.addEventListener('click', function() {
        if (!currentRepoName) return;
        var lines = generateZanzibarTuples(currentRepoName);
        var text = zanzibarTuplesToPlainText(lines);
        navigator.clipboard.writeText(text).then(function() {
          zanzibarCopyBtn.textContent = '✅ コピー済み';
          zanzibarCopyBtn.classList.add('copied');
          setTimeout(function() {
            zanzibarCopyBtn.textContent = '📋 コピー';
            zanzibarCopyBtn.classList.remove('copied');
          }, 2000);
        }).catch(function() {});
      });
    }
    // ===== Zanzibar Tree Modal =====
    var treeModal = document.getElementById('treeModal');
    var treeModalClose = document.getElementById('treeModalClose');
    var treeViewBtn = document.getElementById('treeViewBtn');
    var treeCopyBtn = document.getElementById('treeCopyBtn');
    var treeRepoName = document.getElementById('treeRepoName');
    var treeTuples = document.getElementById('treeTuples');

    function generateTreeText(repoName) {
      var info = repoPermsData[repoName];
      var perms = (info && info.permissions) ? info.permissions : {};
      var selection = (info && info.repositorySelection) ? info.repositorySelection : 'unknown';
      var permKeys = Object.keys(perms).sort();
      var readPerms = [];
      var writePerms = [];
      permKeys.forEach(function(key) {
        var level = perms[key];
        var label = key.replace(/-/g, '_');
        if (level === 'read') readPerms.push(label);
        else writePerms.push(label);
      });

      var lines = [];
      lines.push('installation:' + APP_NAME + '  (subject)');
      lines.push('│');
      lines.push('├── github_app:' + APP_NAME);
      lines.push('│   └── #installation');
      lines.push('│');
      if (selection === 'all') {
        lines.push('└── installation:' + APP_NAME);
        lines.push('    ├── #repository_selection_all');
      } else {
        lines.push('└── repository:' + repoName);
        lines.push('    ├── #installed_app');
      }

      if (readPerms.length === 0 && writePerms.length === 0) {
        lines.push('    └── permissions/');
        lines.push('        └── (なし)');
      } else {
        lines.push('    └── permissions/');
        if (readPerms.length > 0 && writePerms.length > 0) {
          lines.push('        ├── read/');
          readPerms.forEach(function(p, i) {
            var connector = (i === readPerms.length - 1) ? '└' : '├';
            lines.push('        │   ' + connector + '── #' + p + '_read');
          });
          lines.push('        └── write/');
          writePerms.forEach(function(p, i) {
            var connector = (i === writePerms.length - 1) ? '└' : '├';
            lines.push('            ' + connector + '── #' + p + '_write');
          });
        } else if (readPerms.length > 0) {
          lines.push('        └── read/');
          readPerms.forEach(function(p, i) {
            var connector = (i === readPerms.length - 1) ? '└' : '├';
            lines.push('            ' + connector + '── #' + p + '_read');
          });
        } else {
          lines.push('        └── write/');
          writePerms.forEach(function(p, i) {
            var connector = (i === writePerms.length - 1) ? '└' : '├';
            lines.push('            ' + connector + '── #' + p + '_write');
          });
        }
      }

      return lines.join('\\n');
    }

    function renderTreeHtml(repoName) {
      var text = generateTreeText(repoName);
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/(installation:|github_app:|repository:)([\\w.-]+)/g,
          '<span class="tt-type">$1$2</span>')
        .replace(/(#[\\w_]+_read)\\b/g, '<span class="tt-read">$1</span>')
        .replace(/(#[\\w_]+_write)\\b/g, '<span class="tt-write">$1</span>')
        .replace(/(#(?:installation|installed_app|repository_selection_all))\\b/g,
          '<span class="tt-relation">$1</span>')
        .replace(/([│├└─┐┤┬┴┼])/g, '<span class="tt-branch">$1</span>')
        .replace(/(\\(subject\\)|\\(なし\\))/g, '<span class="tt-branch">$1</span>');
    }

    function openTreeModal() {
      if (!currentRepoName) return;
      if (treeRepoName) treeRepoName.textContent = currentRepoName;
      if (treeTuples) treeTuples.innerHTML = renderTreeHtml(currentRepoName);
      if (treeModal) treeModal.classList.add('show');
    }

    function closeTreeModal() {
      if (treeModal) treeModal.classList.remove('show');
    }

    if (treeViewBtn) {
      treeViewBtn.addEventListener('click', openTreeModal);
    }
    if (treeModalClose) {
      treeModalClose.addEventListener('click', closeTreeModal);
    }
    if (treeModal) {
      treeModal.addEventListener('click', function(e) {
        if (e.target === treeModal) closeTreeModal();
      });
    }
    if (treeCopyBtn) {
      treeCopyBtn.addEventListener('click', function() {
        if (!currentRepoName) return;
        var text = generateTreeText(currentRepoName);
        navigator.clipboard.writeText(text).then(function() {
          treeCopyBtn.textContent = '✅ コピー済み';
          treeCopyBtn.classList.add('copied');
          setTimeout(function() {
            treeCopyBtn.textContent = '📋 コピー';
            treeCopyBtn.classList.remove('copied');
          }, 2000);
        }).catch(function() {});
      });
    }
    // ===== 今月コミットしたリポジトリバー =====
    (function() {
      var label = document.getElementById('thisMonthLabel');
      var countEl = document.getElementById('thisMonthCount');
      var sel = document.getElementById('thisMonthSelect');
      if (!label || !countEl || !sel) return;

      var totalRepoCount = ${repoCount};
      var selectVisible = false;

      fetch('/api/repositories/this-month-commits', { credentials: 'same-origin' })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          var repos = Array.isArray(data.repos) ? data.repos : [];
          countEl.textContent = ' : ' + repos.length + '/' + totalRepoCount + ' 件';

          sel.innerHTML = '<option value="">リポジトリを選択...</option>';
          repos.forEach(function(r) {
            var opt = document.createElement('option');
            opt.value = r.owner + '/' + r.repo;
            opt.textContent = r.repo + '  （最終: ' + (r.latestDate || '--') + '）';
            sel.appendChild(opt);
          });
        })
        .catch(function() {
          countEl.textContent = ' : 取得失敗';
        });

      label.addEventListener('click', function() {
        selectVisible = !selectVisible;
        sel.style.display = selectVisible ? '' : 'none';
        if (selectVisible) sel.value = '';
      });

      sel.addEventListener('change', function() {
        var val = sel.value;
        if (!val) return;
        var parts = val.split('/');
        var owner = parts[0];
        var repo = parts.slice(1).join('/');
        sel.style.display = 'none';
        selectVisible = false;

        var row = document.querySelector('.repo-row[data-owner="' + owner + '"][data-repo="' + repo + '"]');
        if (!row) return;
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        openPermissionsModal(repo, owner, row);
      });
    })();

    // ===== Commit History Modal =====
    var commitHistoryModal = document.getElementById('commitHistoryModal');
    var commitHistoryModalClose = document.getElementById('commitHistoryModalClose');
    var commitHistoryBtn = document.getElementById('commitHistoryBtn');
    var commitHistoryBtnLabel = document.getElementById('commitHistoryBtnLabel');
    var commitHistoryList = document.getElementById('commitHistoryList');
    var commitHistoryCount = document.getElementById('commitHistoryCount');
    var commitHistoryTotal = document.getElementById('commitHistoryTotal');
    var commitHistoryFeedback = document.getElementById('commitHistoryFeedback');
    var commitHistoryMonthSelect = document.getElementById('commitHistoryMonthSelect');
    var commitHistoryStatsBtn = document.getElementById('commitHistoryStatsBtn');
    var commitStatsModal = document.getElementById('commitStatsModal');
    var commitStatsModalClose = document.getElementById('commitStatsModalClose');
    var commitStatsRepo = document.getElementById('commitStatsRepo');
    var commitStatsPeriod = document.getElementById('commitStatsPeriod');
    var commitStatsSummary = document.getElementById('commitStatsSummary');
    var commitStatsSource = document.getElementById('commitStatsSource');
    var commitStatsTableWrapper = document.getElementById('commitStatsTableWrapper');
    var commitStatsSessionCache = {};
    var monthlyStatusModal = document.getElementById('monthlyStatusModal');
    var monthlyStatusModalClose = document.getElementById('monthlyStatusModalClose');
    var monthlyStatusLabel = document.getElementById('monthlyStatusLabel');
    var monthlyStatusBody = document.getElementById('monthlyStatusBody');
    var COMMIT_HISTORY_PAGE_SIZE = ${commitHistoryPageSize};
    var commitHistoryCache = {};
    var commitMonthsCache = {};
    var commitHistoryIsInitialLoad = false;
    var commitHistoryFilterSelect = document.getElementById('commitHistoryFilterSelect');
    var currentAllCommits = [];
    var commitKeywordFilter = '';
    var commitCoKeySection = document.getElementById('commitCoKeySection');
    var commitCoKeyTags = document.getElementById('commitCoKeyTags');
    var commitCoKeyInput = document.getElementById('commitCoKeyInput');
    var commitCoKeyClear = document.getElementById('commitCoKeyClear');

    function applyCommitKeywordFilter(commits) {
      if (!commitKeywordFilter) return commits;
      var kw = commitKeywordFilter.toLowerCase();
      return commits.filter(function(c) {
        return c.message && c.message.toLowerCase().indexOf(kw) !== -1;
      });
    }

    function loadCommitCoKeywords(owner, repoName) {
      if (!owner || !repoName) return;
      var repo = owner + '/' + repoName;
      fetch('/api/repositories/search/repo-keywords?repo=' + encodeURIComponent(repo), { credentials: 'same-origin' })
        .then(function(res) { return res.ok ? res.json() : null; })
        .then(function(data) {
          if (!commitCoKeyTags) return;
          var keywords = data && Array.isArray(data.keywords) ? data.keywords : [];
          if (keywords.length === 0) {
            if (commitCoKeySection) commitCoKeySection.style.display = 'none';
            return;
          }
          commitCoKeyTags.innerHTML = keywords.map(function(k) {
            return '<button type="button" class="commit-cokey-tag" data-kw="' + esc(k.search_query) + '">'
              + esc(k.search_query) + '</button>';
          }).join('');
          commitCoKeyTags.querySelectorAll('.commit-cokey-tag').forEach(function(btn) {
            btn.addEventListener('click', function() {
              var kw = btn.getAttribute('data-kw') || '';
              commitCoKeyTags.querySelectorAll('.commit-cokey-tag').forEach(function(b) { b.classList.remove('active'); });
              if (commitKeywordFilter === kw) {
                commitKeywordFilter = '';
                if (commitCoKeyInput) commitCoKeyInput.value = '';
              } else {
                commitKeywordFilter = kw;
                if (commitCoKeyInput) commitCoKeyInput.value = kw;
                btn.classList.add('active');
              }
              var filtered = applyCommitKeywordFilter(applyMergeFilter(currentAllCommits));
              if (commitHistoryCount) commitHistoryCount.textContent = filtered.length + ' 件';
              updateCommitHistoryButtonLabel(filtered.length);
              renderCommitHistoryRows(filtered);
            });
          });
          if (commitCoKeySection) commitCoKeySection.style.display = '';
        })
        .catch(function() {});
    }

    function getCommitHistoryMergeFilter() {
      return getCookie('commit_history_merge_filter') || 'no-merge';
    }
    function setCommitHistoryMergeFilter(val) {
      setCookie('commit_history_merge_filter', val);
    }
    function applyMergeFilter(commits) {
      var filter = commitHistoryFilterSelect ? commitHistoryFilterSelect.value : getCommitHistoryMergeFilter();
      if (filter === 'merge-only') {
        return commits.filter(function(c) { return c.message && c.message.indexOf('Merge pull request') !== -1; });
      }
      if (filter === 'no-merge') {
        return commits.filter(function(c) { return !c.message || c.message.indexOf('Merge pull request') === -1; });
      }
      return commits;
    }

    function updateCommitHistoryButtonLabel(count) {
      if (!commitHistoryBtnLabel) return;
      commitHistoryBtnLabel.textContent = typeof count === 'number'
        ? 'コミット履歴 (' + count + ' 件)'
        : 'コミット履歴';
    }

    function formatCommitDate(dateString) {
      if (!dateString) return '不明';
      var date = new Date(dateString);
      if (Number.isNaN(date.getTime())) return '不明';
      return date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false });
    }

    function getTokyoDateParts(date) {
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
      var formatter = new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      var parts = formatter.formatToParts(date);
      var result = {};
      parts.forEach(function(part) {
        if (part.type !== 'literal') result[part.type] = part.value;
      });
      return result;
    }

    function formatTokyoYearMonth(date) {
      var parts = getTokyoDateParts(date);
      if (!parts) return null;
      return parts.year + '-' + parts.month;
    }

    function formatTokyoDateKey(date) {
      var parts = getTokyoDateParts(date);
      if (!parts) return null;
      return parts.year + '-' + parts.month + '-' + parts.day;
    }

    function formatTokyoTime(dateString) {
      if (!dateString) return '';
      var date = new Date(dateString);
      var parts = getTokyoDateParts(date);
      if (!parts) return '';
      return parts.hour + ':' + parts.minute;
    }

    function renderCommitHistoryMonthOptions(months, currentMonth) {
      if (!commitHistoryMonthSelect) return;
      var html = '<option value="">すべて</option>';
      (months || []).forEach(function(m) {
        html += '<option value="' + esc(m) + '">' + esc(m) + (m === currentMonth ? ' (当月)' : '') + '</option>';
      });
      commitHistoryMonthSelect.innerHTML = html;
      commitHistoryMonthSelect.disabled = false;
      if (currentMonth && months && months.indexOf(currentMonth) !== -1) {
        commitHistoryMonthSelect.value = currentMonth;
      } else if (months && months.length > 0) {
        commitHistoryMonthSelect.value = months[0];
      } else {
        commitHistoryMonthSelect.value = '';
      }
    }

    function renderCommitMonthsDetails(details) {
      var el = document.getElementById('commitHistoryMonthsDetails');
      if (!el) return;
      if (!details) { el.textContent = ''; el.style.display = 'none'; return; }
      var parts = [];
      parts.push('状態: ' + (details.status || 'ok'));
      if (details.repoCreatedMonth) parts.push('作成月: ' + details.repoCreatedMonth);
      if (typeof details.candidatesCount === 'number') {
        parts.push('対象月: ' + details.candidatesCount);
        parts.push('キャッシュHIT: ' + (details.cacheHits || 0));
        parts.push('GitHub取得: ' + (details.fetched || 0));
        if (details.inconsistentRefetched) parts.push('不整合再取得: ' + details.inconsistentRefetched);
        if (details.fetchErrors) parts.push('取得失敗: ' + details.fetchErrors);
        parts.push('コミット有: ' + (details.pastMonthsWithCommits || 0));
      }
      if (details.repoInfoError) parts.push('リポジトリ情報エラー: ' + details.repoInfoError);
      if (details.cacheReadError) parts.push('キャッシュ読取エラー: ' + details.cacheReadError);
      el.textContent = parts.join(' / ');
      el.style.display = '';
    }

    function renderCommitHistoryCacheSummary(count) {
      var el = document.getElementById('commitHistoryCacheSummary');
      if (!el) return;
      if (typeof count !== 'number') { el.textContent = ''; el.style.display = 'none'; return; }
      el.innerHTML = '現在コミット履歴がキャッシュ済みのリポジトリ : <strong>' + count + '</strong> 件';
      el.style.display = '';
    }

    function renderCommitHistoryRows(commits) {
      if (!commitHistoryList) return;
      if (!commits || commits.length === 0) {
        commitHistoryList.innerHTML = '<div class="commit-history-empty">コミットが見つかりませんでした。</div>';
        return;
      }
      commitHistoryList.innerHTML = commits.map(function(commit) {
        var shortSha = (commit.sha || '').substring(0, 7);
        var message = commit.message ? commit.message.split('\\n')[0] : shortSha;
        var author = commit.authorName || commit.authorLogin || 'Unknown';
        var dateLabel = formatCommitDate(commit.authoredDate);
        return '<div class="commit-history-entry">' +
          '<div class="commit-history-entry-title"><a href="' + esc(commit.htmlUrl || '#') + '" target="_blank" rel="noreferrer">' + esc(message) + '</a></div>' +
          '<div class="commit-history-entry-meta">' +
            '<span>SHA: ' + esc(shortSha) + '</span>' +
            '<span>by ' + esc(author) + '</span>' +
            '<span>' + esc(dateLabel) + '</span>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    function renderCommitHistoryContent(payload) {
      currentAllCommits = Array.isArray(payload.commits) ? payload.commits : [];
      if (commitHistoryTotal) {
        commitHistoryTotal.textContent = payload.cached ? 'キャッシュ（D1）から取得' : 'GitHub API から取得（リアルタイム）';
      }
      var mergeFiltered = applyMergeFilter(currentAllCommits);
      if (commitHistoryIsInitialLoad && mergeFiltered.length === 0 && commitHistoryMonthSelect && commitHistoryMonthSelect.value !== '') {
        commitHistoryIsInitialLoad = false;
        commitHistoryMonthSelect.value = '';
        var repoKey = currentRepoFullName || (currentRepoOwner + '/' + currentRepoName);
        loadCommitsForSelectedValue(currentRepoOwner, currentRepoName, repoKey, '');
        return;
      }
      commitHistoryIsInitialLoad = false;
      var filtered = applyCommitKeywordFilter(mergeFiltered);
      if (commitHistoryCount) commitHistoryCount.textContent = filtered.length + ' 件';
      updateCommitHistoryButtonLabel(filtered.length);
      renderCommitHistoryRows(filtered);
      if (commitHistoryFeedback) commitHistoryFeedback.textContent = '';
    }

    function renderCommitHistoryError(message) {
      if (commitHistoryList) {
        commitHistoryList.innerHTML = '<div class="commit-history-empty">コミット履歴を取得できませんでした。</div>';
      }
      if (commitHistoryFeedback) {
        commitHistoryFeedback.textContent = message;
      }
      if (commitHistoryCount) commitHistoryCount.textContent = '0 件';
      if (commitHistoryTotal) commitHistoryTotal.textContent = '--';
      updateCommitHistoryButtonLabel(null);
    }

    function showCommitHistoryLoadingState() {
      if (commitHistoryList) {
        commitHistoryList.innerHTML = '<div class="commit-history-loading">コミット履歴を取得中...</div>';
      }
      if (commitHistoryFeedback) commitHistoryFeedback.textContent = '';
      if (commitHistoryCount) commitHistoryCount.textContent = '--';
      if (commitHistoryTotal) commitHistoryTotal.textContent = '--';
    }

    function fetchAllCommits(owner, repoName, repoKey) {
      var cacheKey = repoKey + '|__ALL__';
      if (commitHistoryCache[cacheKey]) {
        renderCommitHistoryContent(commitHistoryCache[cacheKey]);
        return;
      }
      showCommitHistoryLoadingState();
      var url = '/api/repositories/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repoName) + '/commits?per_page=' + COMMIT_HISTORY_PAGE_SIZE;
      fetch(url, { credentials: 'same-origin' })
        .then(function(res) {
          if (!res.ok) return res.json().catch(function() { return null; }).then(function(p) {
            throw new Error(p && p.error ? p.error : '取得に失敗しました');
          });
          return res.json();
        })
        .then(function(data) {
          if (!data || !Array.isArray(data.commits)) throw new Error('取得データが不正です');
          var payload = { commits: data.commits, cached: false, allMode: true, totalCommits: typeof data.totalCommits === 'number' ? data.totalCommits : null };
          commitHistoryCache[cacheKey] = payload;
          renderCommitHistoryContent(payload);
        })
        .catch(function(err) {
          renderCommitHistoryError(err.message || 'コミット履歴を取得できませんでした');
        });
    }

    function loadCommitsForSelectedValue(owner, repoName, repoKey, period) {
      if (!period) {
        fetchAllCommits(owner, repoName, repoKey);
        return;
      }
      var cacheKey = repoKey + '|' + period;
      if (commitHistoryCache[cacheKey]) {
        renderCommitHistoryContent(commitHistoryCache[cacheKey]);
        return;
      }
      showCommitHistoryLoadingState();
      var url = '/api/repositories/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repoName) + '/commits-by-month?period=' + encodeURIComponent(period);
      fetch(url, { credentials: 'same-origin' })
        .then(function(res) {
          if (!res.ok) {
            return res.json().catch(function() { return null; }).then(function(payload) {
              throw new Error(payload && payload.error ? payload.error : '取得に失敗しました');
            });
          }
          return res.json();
        })
        .then(function(data) {
          if (!data || !Array.isArray(data.commits)) throw new Error('取得データが不正です');
          commitHistoryCache[cacheKey] = data;
          renderCommitHistoryContent(data);
        })
        .catch(function(err) {
          renderCommitHistoryError(err.message || 'コミット履歴を取得できませんでした');
        });
    }

    function fetchCommitMonthsAndInit(owner, repoName, repoKey) {
      commitHistoryIsInitialLoad = true;
      if (commitMonthsCache[repoKey]) {
        var mc = commitMonthsCache[repoKey];
        renderCommitHistoryMonthOptions(mc.months, mc.currentMonth);
        renderCommitMonthsDetails(mc.details || null);
        renderCommitHistoryCacheSummary(typeof mc.cachedRepoCount === 'number' ? mc.cachedRepoCount : null);
        var period = commitHistoryMonthSelect ? commitHistoryMonthSelect.value : '';
        if (period) syncInlineHeatmapToMonth(period);
        loadCommitsForSelectedValue(owner, repoName, repoKey, period);
        return;
      }
      showCommitHistoryLoadingState();
      renderCommitMonthsDetails({ status: '月一覧を取得中...（初回はリポジトリ作成月までキャッシュ未登録分を全件取得するため時間がかかります）' });
      var url = '/api/repositories/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repoName) + '/commit-months';
      fetch(url, { credentials: 'same-origin' })
        .then(function(res) {
          if (!res.ok) throw new Error('月別一覧の取得に失敗しました (HTTP ' + res.status + ')');
          return res.json();
        })
        .then(function(data) {
          var months = Array.isArray(data.months) ? data.months : [];
          var currentMonth = data.currentMonth || '';
          if (months.length === 0 && currentMonth) months = [currentMonth];
          var cachedRepoCount = typeof data.cachedRepoCount === 'number' ? data.cachedRepoCount : null;
          commitMonthsCache[repoKey] = { months: months, currentMonth: currentMonth, details: data.details || null, cachedRepoCount: cachedRepoCount };
          renderCommitHistoryMonthOptions(months, currentMonth);
          renderCommitMonthsDetails(data.details || null);
          renderCommitHistoryCacheSummary(cachedRepoCount);
          var period = commitHistoryMonthSelect ? commitHistoryMonthSelect.value : '';
          if (period) syncInlineHeatmapToMonth(period);
          loadCommitsForSelectedValue(owner, repoName, repoKey, period);
        })
        .catch(function(err) {
          renderCommitMonthsDetails({ status: 'error', repoInfoError: err && err.message });
          renderCommitHistoryCacheSummary(null);
          renderCommitHistoryError(err.message || 'コミット履歴を取得できませんでした');
        });
    }

    function openCommitHistoryModal() {
      if (!currentRepoName || !currentRepoOwner) return;
      if (commitHistoryModal) commitHistoryModal.classList.add('show');
      commitKeywordFilter = '';
      if (commitCoKeyInput) commitCoKeyInput.value = '';
      if (commitCoKeyTags) commitCoKeyTags.querySelectorAll('.commit-cokey-tag').forEach(function(b) { b.classList.remove('active'); });
      var repoKey = currentRepoFullName || (currentRepoOwner + '/' + currentRepoName);
      fetchCommitMonthsAndInit(currentRepoOwner, currentRepoName, repoKey);
      loadCommitCoKeywords(currentRepoOwner, currentRepoName);
    }

    function closeCommitHistoryModal() {
      if (commitHistoryModal) commitHistoryModal.classList.remove('show');
      commitKeywordFilter = '';
      if (commitCoKeyInput) commitCoKeyInput.value = '';
      if (commitCoKeySection) commitCoKeySection.style.display = 'none';
      if (commitCoKeyTags) commitCoKeyTags.innerHTML = '';
    }

    function closeMonthlyStatusModal() {
      if (monthlyStatusModal) monthlyStatusModal.classList.remove('show');
    }

    if (commitHistoryBtn) {
      commitHistoryBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        openCommitHistoryModal();
      });
    }
    if (commitHistoryModalClose) {
      commitHistoryModalClose.addEventListener('click', closeCommitHistoryModal);
    }
    if (commitHistoryModal) {
      commitHistoryModal.addEventListener('click', function(e) {
        if (e.target === commitHistoryModal) closeCommitHistoryModal();
      });
    }
    if (monthlyStatusModalClose) {
      monthlyStatusModalClose.addEventListener('click', closeMonthlyStatusModal);
    }
    if (monthlyStatusModal) {
      monthlyStatusModal.addEventListener('click', function(e) {
        if (e.target === monthlyStatusModal) closeMonthlyStatusModal();
      });
    }

    if (commitCoKeyInput) {
      commitCoKeyInput.addEventListener('input', function() {
        commitKeywordFilter = commitCoKeyInput.value.trim();
        if (commitCoKeyTags) {
          commitCoKeyTags.querySelectorAll('.commit-cokey-tag').forEach(function(btn) {
            var kw = btn.getAttribute('data-kw') || '';
            if (commitKeywordFilter && kw === commitKeywordFilter) {
              btn.classList.add('active');
            } else {
              btn.classList.remove('active');
            }
          });
        }
        var filtered = applyCommitKeywordFilter(applyMergeFilter(currentAllCommits));
        if (commitHistoryCount) commitHistoryCount.textContent = filtered.length + ' 件';
        updateCommitHistoryButtonLabel(filtered.length);
        renderCommitHistoryRows(filtered);
      });
    }

    if (commitCoKeyClear) {
      commitCoKeyClear.addEventListener('click', function() {
        commitKeywordFilter = '';
        if (commitCoKeyInput) commitCoKeyInput.value = '';
        if (commitCoKeyTags) {
          commitCoKeyTags.querySelectorAll('.commit-cokey-tag').forEach(function(b) { b.classList.remove('active'); });
        }
        var filtered = applyCommitKeywordFilter(applyMergeFilter(currentAllCommits));
        if (commitHistoryCount) commitHistoryCount.textContent = filtered.length + ' 件';
        updateCommitHistoryButtonLabel(filtered.length);
        renderCommitHistoryRows(filtered);
      });
    }

    // ===== Commit Heatmap Calendar (inline in permissions modal) =====
    var heatmapMonthLabel = document.getElementById('heatmapMonthLabel');
    var heatmapBody = document.getElementById('heatmapBody');
    var heatmapPrev = document.getElementById('heatmapPrev');
    var heatmapNext = document.getElementById('heatmapNext');

    var heatmapYear = 0;
    var heatmapMonth = 0;
    var heatmapOwner = '';
    var heatmapCache = {};
    var heatmapRequestSeq = 0;

    var WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

    function heatmapCacheKey(owner, repo, y, m) {
      return owner + '/' + repo + '/' + y + '/' + m;
    }

    function fetchHeatmapData(owner, repo, year, month) {
      var key = heatmapCacheKey(owner, repo, year, month);
      if (heatmapCache[key]) return Promise.resolve(heatmapCache[key]);
      return fetch('/api/repositories/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) + '/commits-calendar?year=' + year + '&month=' + month, {
        headers: { 'Accept': 'application/json' },
      })
        .then(function(res) { return res.ok ? res.json() : null; })
        .then(function(data) {
          if (data && data.counts) {
            heatmapCache[key] = data.counts;
            return data.counts;
          }
          return {};
        })
        .catch(function() { return {}; });
    }

    function getHeatmapLevel(count) {
      if (count === 0) return 0;
      if (count <= 2) return 1;
      if (count <= 5) return 2;
      if (count <= 10) return 3;
      return 4;
    }

    function buildHeatmapHtml(counts, year, month) {
      var today = new Date();
      var todayStr = formatTokyoDateKey(today);
      var currentYearMonth = formatTokyoYearMonth(today);
      var isCurrentMonth = currentYearMonth === year + '-' + String(month).padStart(2, '0');
      var firstDay = new Date(year, month - 1, 1);
      var daysInMonth = new Date(year, month, 0).getDate();
      var startDow = firstDay.getDay(); // 0=Sun
      var total = 0;
      for (var k in counts) { total += counts[k]; }

      var html = '<div class="heatmap-grid">';
      WEEKDAYS.forEach(function(w) {
        html += '<div class="heatmap-weekday">' + w + '</div>';
      });
      for (var i = 0; i < startDow; i++) {
        html += '<div class="heatmap-day empty"></div>';
      }
      for (var d = 1; d <= daysInMonth; d++) {
        var dateStr = year + '-' + String(month).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        var count = counts[dateStr] || 0;
        var level = getHeatmapLevel(count);
        var isToday = isCurrentMonth && dateStr === todayStr;
        var hasCommits = count > 0;
        var titleText = d + '日: ' + count + 'コミット';
        html += '<div class="heatmap-day level-' + level + (isToday ? ' today' : '') + (hasCommits ? ' has-commits' : '') + '" title="' + esc(titleText) + '"' + (hasCommits ? ' data-date="' + dateStr + '"' : '') + '>' + d + '</div>';
      }
      html += '</div>';
      html += '<div class="heatmap-legend">';
      html += '<span>少</span>';
      html += '<div class="heatmap-legend-box level-0" style="background:#edf2f7"></div>';
      html += '<div class="heatmap-legend-box level-1" style="background:#c6f6d5"></div>';
      html += '<div class="heatmap-legend-box level-2" style="background:#68d391"></div>';
      html += '<div class="heatmap-legend-box level-3" style="background:#38a169"></div>';
      html += '<div class="heatmap-legend-box level-4" style="background:#276749"></div>';
      html += '<span>多</span>';
      html += '</div>';
      html += '<div class="heatmap-total">合計 ' + total + ' コミット</div>';
      return html;
    }

    function renderHeatmap(counts, year, month) {
      if (!heatmapBody) return;
      heatmapBody.innerHTML = buildHeatmapHtml(counts, year, month);
    }

    function renderMonthlyStatusHeatmap(counts, year, month) {
      if (!monthlyStatusBody) return;
      monthlyStatusBody.innerHTML = buildHeatmapHtml(counts, year, month);
    }

    function updateHeatmapMonthLabel() {
      if (heatmapMonthLabel) {
        heatmapMonthLabel.textContent = heatmapYear + '年 ' + heatmapMonth + '月';
      }
    }

    function loadAndRenderHeatmap() {
      if (!heatmapBody || !currentRepoName || !heatmapOwner) return;
      var requestOwner = heatmapOwner;
      var requestRepo = currentRepoName;
      var requestYear = heatmapYear;
      var requestMonth = heatmapMonth;
      var requestSeq = ++heatmapRequestSeq;
      updateHeatmapMonthLabel();
      heatmapBody.innerHTML = '<div class="heatmap-loading">読み込み中...</div>';
      fetchHeatmapData(requestOwner, requestRepo, requestYear, requestMonth).then(function(counts) {
        var isLatestRequest = requestSeq === heatmapRequestSeq;
        var isSameTarget = requestOwner === heatmapOwner
          && requestRepo === currentRepoName
          && requestYear === heatmapYear
          && requestMonth === heatmapMonth;
        if (!isLatestRequest || !isSameTarget) return;
        renderHeatmap(counts, requestYear, requestMonth);
      });
    }

    function syncInlineHeatmapToMonth(monthKey) {
      if (!monthKey || !currentRepoOwner || !currentRepoName) return;
      var parts = monthKey.split('-');
      if (parts.length !== 2) return;
      var year = Number(parts[0]);
      var month = Number(parts[1]);
      if (!year || !month) return;
      heatmapOwner = currentRepoOwner;
      heatmapYear = year;
      heatmapMonth = month;
      loadAndRenderHeatmap();
    }

    function openMonthlyStatusModal(monthKey) {
      if (!monthKey || !currentRepoOwner || !currentRepoName || !monthlyStatusModal || !monthlyStatusBody) return;
      var parts = monthKey.split('-');
      if (parts.length !== 2) return;
      var year = Number(parts[0]);
      var month = Number(parts[1]);
      if (!year || !month) return;
      if (monthlyStatusLabel) {
        monthlyStatusLabel.textContent = currentRepoName + ' / ' + monthKey;
      }
      monthlyStatusBody.innerHTML = '<div class="heatmap-loading">読み込み中...</div>';
      monthlyStatusModal.classList.add('show');
      fetchHeatmapData(currentRepoOwner, currentRepoName, year, month)
        .then(function(counts) {
          renderMonthlyStatusHeatmap(counts, year, month);
        })
        .catch(function() {
          monthlyStatusBody.innerHTML = '<div class="commit-history-empty">月別コミット状況を取得できませんでした。</div>';
        });
    }

    // リポジトリ選択時にヒートマップを開始する（ページ読み込み時には実行しない）
    function startHeatmapForRepo(owner) {
      heatmapOwner = owner;
      var now = new Date();
      var nowParts = getTokyoDateParts(now);
      heatmapYear = nowParts ? Number(nowParts.year) : now.getFullYear();
      heatmapMonth = nowParts ? Number(nowParts.month) : (now.getMonth() + 1);
      loadAndRenderHeatmap();
    }

    if (heatmapPrev) {
      heatmapPrev.addEventListener('click', function() {
        heatmapMonth--;
        if (heatmapMonth < 1) { heatmapMonth = 12; heatmapYear--; }
        loadAndRenderHeatmap();
      });
    }
    if (heatmapNext) {
      heatmapNext.addEventListener('click', function() {
        heatmapMonth++;
        if (heatmapMonth > 12) { heatmapMonth = 1; heatmapYear++; }
        loadAndRenderHeatmap();
      });
    }
    if (commitHistoryMonthSelect) {
      commitHistoryMonthSelect.addEventListener('change', function() {
        var period = commitHistoryMonthSelect.value;
        closeMonthlyStatusModal();
        if (period) syncInlineHeatmapToMonth(period);
        if (commitHistoryModal && commitHistoryModal.classList.contains('show') && currentRepoOwner && currentRepoName) {
          var repoKey = currentRepoFullName || (currentRepoOwner + '/' + currentRepoName);
          loadCommitsForSelectedValue(currentRepoOwner, currentRepoName, repoKey, period);
        }
      });
    }

    if (commitHistoryFilterSelect) {
      var savedMergeFilter = getCommitHistoryMergeFilter();
      commitHistoryFilterSelect.value = savedMergeFilter;
      commitHistoryFilterSelect.addEventListener('change', function() {
        setCommitHistoryMergeFilter(commitHistoryFilterSelect.value);
        var filtered = applyCommitKeywordFilter(applyMergeFilter(currentAllCommits));
        if (commitHistoryCount) commitHistoryCount.textContent = filtered.length + ' 件';
        updateCommitHistoryButtonLabel(filtered.length);
        renderCommitHistoryRows(filtered);
      });
    }

    function renderCommitStatsFromData(data, monthFilter, owner, repoName) {
      var rows = data && Array.isArray(data.rows) ? data.rows : [];
      if (commitStatsRepo) {
        commitStatsRepo.innerHTML = '集計対象リポジトリ : <strong>' + esc(owner + '/' + repoName) + '</strong>';
      }
      if (commitStatsPeriod) commitStatsPeriod.textContent = monthFilter || 'すべて';
      var totalCommits = 0;
      var totalMerges = 0;
      for (var i = 0; i < rows.length; i++) {
        totalCommits += (rows[i].commitCount || 0);
        totalMerges += (rows[i].mergeCount || 0);
      }
      if (commitStatsSummary) {
        if (rows.length === 0) {
          commitStatsSummary.textContent = '対象期間のコミットがありません。';
        } else {
          commitStatsSummary.textContent =
            'ユーザー数 ' + rows.length + ' 名 / コミット ' + totalCommits +
            ' 件（うちマージ承認 ' + totalMerges + ' 件）';
        }
      }
      if (commitStatsSource) {
        commitStatsSource.textContent = data && data.cached ? 'キャッシュ（D1）から取得' : 'GitHub API から取得（リアルタイム）';
      }
      if (!commitStatsTableWrapper) return;
      if (rows.length === 0) {
        commitStatsTableWrapper.innerHTML = '<div class="commit-stats-empty">表示できる集計データがありません。</div>';
        return;
      }
      var html = '<table class="commit-stats-table">' +
        '<thead><tr>' +
          '<th>ユーザー</th>' +
          '<th class="num">コミット回数</th>' +
          '<th class="num">マージ承認回数</th>' +
        '</tr></thead><tbody>';
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var label = row.authorLogin
          ? row.authorLogin + (row.authorName && row.authorName !== row.authorLogin ? ' (' + row.authorName + ')' : '')
          : (row.authorName || 'Unknown');
        html += '<tr>' +
          '<td>' + esc(label) + '</td>' +
          '<td class="num">' + (row.commitCount || 0) + '</td>' +
          '<td class="num">' + (row.mergeCount || 0) + '</td>' +
        '</tr>';
      }
      html += '</tbody></table>';
      commitStatsTableWrapper.innerHTML = html;
    }

    function openCommitStatsModal() {
      if (!commitStatsModal) return;
      var owner = currentRepoOwner;
      var repoName = currentRepoName;
      if (!owner || !repoName) return;
      var monthFilter = commitHistoryMonthSelect ? commitHistoryMonthSelect.value : '';

      commitStatsModal.classList.add('show');
      if (commitStatsPeriod) commitStatsPeriod.textContent = monthFilter || 'すべて';
      if (commitStatsSummary) commitStatsSummary.textContent = '集計中...';
      if (commitStatsTableWrapper) commitStatsTableWrapper.innerHTML = '';

      var cacheKey = owner + '/' + repoName + '|' + monthFilter;
      if (commitStatsSessionCache[cacheKey]) {
        renderCommitStatsFromData(commitStatsSessionCache[cacheKey], monthFilter, owner, repoName);
        return;
      }

      var url = '/api/repositories/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repoName) + '/commit-stats';
      if (monthFilter) url += '?period=' + encodeURIComponent(monthFilter);

      fetch(url, { credentials: 'same-origin' })
        .then(function(res) {
          if (!res.ok) {
            return res.json().catch(function() { return null; }).then(function(payload) {
              throw new Error(payload && payload.error ? payload.error : '取得に失敗しました');
            });
          }
          return res.json();
        })
        .then(function(data) {
          commitStatsSessionCache[cacheKey] = data;
          renderCommitStatsFromData(data, monthFilter, owner, repoName);
        })
        .catch(function(err) {
          if (commitStatsSummary) commitStatsSummary.textContent = 'エラー: ' + (err.message || '取得に失敗しました');
          if (commitStatsTableWrapper) commitStatsTableWrapper.innerHTML = '';
        });
    }

    function closeCommitStatsModal() {
      if (commitStatsModal) commitStatsModal.classList.remove('show');
    }

    if (commitHistoryStatsBtn) {
      commitHistoryStatsBtn.addEventListener('click', openCommitStatsModal);
    }
    if (commitStatsModalClose) {
      commitStatsModalClose.addEventListener('click', closeCommitStatsModal);
    }
    if (commitStatsModal) {
      commitStatsModal.addEventListener('click', function(e) {
        if (e.target === commitStatsModal) closeCommitStatsModal();
      });
    }

    // ===== Commit Detail Modal =====
    var commitDetailModal = document.getElementById('commitDetailModal');
    var commitDetailClose = document.getElementById('commitDetailClose');
    var commitDetailTitle = document.getElementById('commitDetailTitle');
    var commitDetailDate = document.getElementById('commitDetailDate');
    var commitDetailList = document.getElementById('commitDetailList');

    if (commitDetailClose) {
      commitDetailClose.addEventListener('click', function() {
        if (commitDetailModal) commitDetailModal.classList.remove('show');
      });
    }
    if (commitDetailModal) {
      commitDetailModal.addEventListener('click', function(e) {
        if (e.target === commitDetailModal) commitDetailModal.classList.remove('show');
      });
    }

    // ヒートマップ日付セルのクリックイベント（イベント委任）
    // 日付タップ時にコミット一覧のプリフェッチも実行する
    if (heatmapBody) {
      heatmapBody.addEventListener('click', function(e) {
        var target = e.target;
        while (target && target !== heatmapBody) {
          if (target.classList && target.classList.contains('has-commits') && target.getAttribute('data-date')) {
            var date = target.getAttribute('data-date');
            openCommitDetailModal(date);
            return;
          }
          target = target.parentElement;
        }
      });
    }

    function openCommitDetailModal(date) {
      if (!commitDetailModal || !commitDetailList || !commitDetailDate || !commitDetailTitle) return;
      var parts = date.split('-');
      var displayDate = parseInt(parts[0]) + '年' + parseInt(parts[1]) + '月' + parseInt(parts[2]) + '日';
      commitDetailTitle.textContent = 'コミット詳細';
      commitDetailDate.textContent = displayDate + ' のコミット';
      commitDetailList.innerHTML = '<div class="commit-detail-loading">読み込み中...</div>';
      commitDetailModal.classList.add('show');

      var owner = heatmapOwner;
      var repo = currentRepoName;
      fetch('/api/repositories/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) + '/commits-by-date?date=' + encodeURIComponent(date), {
        headers: { 'Accept': 'application/json' },
      })
        .then(function(res) { return res.ok ? res.json() : null; })
        .then(function(data) {
          if (!data || !data.commits || data.commits.length === 0) {
            commitDetailList.innerHTML = '<div class="commit-detail-empty">コミットが見つかりませんでした</div>';
            return;
          }
          var html = '';
          data.commits.forEach(function(commit) {
            var msgLines = (commit.message || '').split('\\n');
            var title = msgLines[0] || '';
            var body = msgLines.slice(1).filter(function(l) { return l.trim() !== ''; }).join('\\n');
            var timeStr = formatTokyoTime(commit.date);

            html += '<div class="commit-detail-item">';
            html += '<div class="commit-detail-header">';
            if (commit.authorAvatarUrl) {
              html += '<img class="commit-detail-avatar" src="' + esc(commit.authorAvatarUrl) + '&s=48" alt="" />';
            }
            html += '<span class="commit-detail-author">' + esc(commit.authorLogin || commit.authorName || 'Unknown') + '</span>';
            if (timeStr) {
              html += '<span class="commit-detail-time">' + esc(timeStr) + '</span>';
            }
            html += '</div>';
            html += '<div class="commit-detail-message">';
            html += '<div class="commit-detail-message-title">' + esc(title) + '</div>';
            if (body) {
              html += '<div class="commit-detail-message-body">' + esc(body) + '</div>';
            }
            html += '</div>';
            if (commit.sha && commit.url) {
              html += '<a class="commit-detail-sha" href="' + esc(commit.url) + '" target="_blank" rel="noopener">' + esc(commit.sha.substring(0, 7)) + '</a>';
            }
            html += '</div>';
          });
          commitDetailList.innerHTML = html;
          // キャッシュ/GitHub ソースに応じたトースト通知
          if (data.source === 'cache') {
            showCacheToast('キャッシュからコミット履歴を取得しました', 'cache-source');
          } else if (data.source === 'github') {
            showCacheToast('GitHub からコミット履歴を取得しました', 'github-source');
          }
        })
        .catch(function() {
          commitDetailList.innerHTML = '<div class="commit-detail-empty">読み込みに失敗しました</div>';
        });
    }

    // ===== コミット全文検索 =====
    (function() {
      var searchInput = document.getElementById('commitSearchInput');
      var searchBtn = document.getElementById('commitSearchBtn');
      var searchModal = document.getElementById('commitSearchModal');
      var searchClose = document.getElementById('commitSearchClose');
      var searchBody = document.getElementById('commitSearchBody');
      var searchTitle = document.getElementById('commitSearchTitle');
      var searchSubtitle = document.getElementById('commitSearchSubtitle');
      if (!searchInput || !searchBtn || !searchModal || !searchBody) return;

      function escapeForHtml(str) {
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }

      function highlightMatch(text, query) {
        if (!query) return escapeForHtml(text);
        var escaped = escapeForHtml(text);
        var qEscaped = escapeForHtml(query);
        var regex = new RegExp('(' + qEscaped.replace(/[.*+?^$\x7b\x7d()|\\[\\]\\\\]/g, '\\\\$&') + ')', 'gi');
        return escaped.replace(regex, '<span class="search-result-highlight">$1</span>');
      }

      function openSearchModal() {
        searchModal.classList.add('show');
        document.body.style.overflow = 'hidden';
      }

      function closeSearchModal() {
        searchModal.classList.remove('show');
        document.body.style.overflow = '';
      }

      if (searchClose) {
        searchClose.addEventListener('click', closeSearchModal);
      }
      searchModal.addEventListener('click', function(e) {
        if (e.target === searchModal) closeSearchModal();
      });
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && searchModal.classList.contains('show')) {
          closeSearchModal();
        }
      });

      function renderSearchResults(data) {
        if (!data.results || data.results.length === 0) {
          return '<div class="search-empty">「' + escapeForHtml(data.query) + '」に一致するコミットは見つかりませんでした。<br><span style="font-size:12px;margin-top:8px;display:block;">キャッシュ済みのコミット履歴のみが検索対象です。<br>先にカレンダーヒートマップを表示してキャッシュを蓄積してください。</span></div>';
        }

        // リポジトリごとにグループ化
        var groups = {};
        var groupOrder = [];
        data.results.forEach(function(item) {
          var key = item.owner + '/' + item.repo;
          if (!groups[key]) {
            groups[key] = [];
            groupOrder.push(key);
          }
          item.commits.forEach(function(c) {
            groups[key].push({ commit: c, date: item.date });
          });
        });

        var html = '';
        groupOrder.forEach(function(repoKey) {
          var commits = groups[repoKey];
          html += '<div class="search-result-group">'
            + '<div class="search-result-group-header" role="button" aria-expanded="true" data-search-group-toggle>'
            + '<span class="search-result-group-chevron">&#9654;</span>'
            + '<span class="search-result-group-repo">' + escapeForHtml(repoKey) + '</span>'
            + '<span class="search-result-group-count">' + commits.length + ' 件</span>'
            + '</div>'
            + '<div class="search-result-group-body">';

          commits.forEach(function(item) {
            var c = item.commit;
            var msgLines = (c.message || '').split('\\n');
            var firstLine = msgLines[0] || '';
            var hasBody = msgLines.length > 1 && msgLines.slice(1).some(function(l) { return l.trim() !== ''; });
            var avatarHtml = c.authorAvatarUrl
              ? '<img class="search-result-avatar" src="' + escapeForHtml(c.authorAvatarUrl) + '&s=72" alt="" loading="lazy" />'
              : '<div class="search-result-avatar" style="background:var(--badge-bg);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:var(--text-muted);">' + escapeForHtml((c.authorName || '?').substring(0, 1).toUpperCase()) + '</div>';
            var shaShort = (c.sha || '').substring(0, 7);
            var dateDisplay = item.date || '';

            html += '<div class="search-result-commit">'
              + avatarHtml
              + '<div class="search-result-commit-info">'
              + '<div class="search-result-commit-msg">' + highlightMatch(firstLine, data.query) + '</div>';

            if (hasBody) {
              var bodyText = msgLines.slice(1).join('\\n').trim();
              html += '<details style="margin-top:4px;"><summary style="font-size:11px;color:var(--text-muted);cursor:pointer;">全文を表示</summary>'
                + '<div class="search-result-commit-msg-full" style="margin-top:4px;font-weight:400;font-size:12px;color:var(--text-muted);">' + highlightMatch(bodyText, data.query) + '</div>'
                + '</details>';
            }

            html += '<div class="search-result-commit-meta">'
              + '<span>' + highlightMatch(c.authorName || c.authorLogin || '', data.query) + '</span>'
              + '<span>' + escapeForHtml(dateDisplay) + '</span>';
            if (c.url) {
              html += '<a class="search-result-sha" href="' + escapeForHtml(c.url) + '" target="_blank" rel="noreferrer">' + highlightMatch(shaShort, data.query) + '</a>';
            } else {
              html += '<span style="font-family:monospace;">' + highlightMatch(shaShort, data.query) + '</span>';
            }
            html += '</div></div></div>';
          });

          html += '</div></div>';
        });

        return html;
      }

      function executeSearch() {
        var query = searchInput.value.trim();
        if (query.length < 2) {
          searchInput.focus();
          return;
        }

        searchTitle.textContent = '検索結果';
        searchSubtitle.textContent = '「' + query + '」を検索中...';
        searchBody.innerHTML = '<div class="search-loading">検索中...</div>';
        openSearchModal();
        searchBtn.disabled = true;

        fetch('/api/repositories/search/commits?q=' + encodeURIComponent(query), { credentials: 'same-origin', cache: 'no-store' })
          .then(function(res) { return res.json(); })
          .then(function(data) {
            searchBtn.disabled = false;
            if (data.error) {
              searchBody.innerHTML = '<div class="search-empty">' + escapeForHtml(data.error) + '</div>';
              searchSubtitle.textContent = '';
              return;
            }
            searchSubtitle.textContent = '「' + escapeForHtml(data.query) + '」— ' + data.total + ' 件のコミットが見つかりました';
            searchBody.innerHTML = renderSearchResults(data);
            if (data.isNewKeyword && data.total > 0) {
              if (data.autoLabel != null) {
                var isSuccess = data.autoLabel !== 'uncategorized';
                var notifMsg = isSuccess
                  ? 'キーワード「' + data.query + '」は「' + data.autoLabel + '」に分類されました'
                  : data.query + 'は適切なカテゴリが存在しないので未分類に分類されました';
                var notif = document.createElement('div');
                notif.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);'
                  + (isSuccess
                    ? 'background:#c6f6d5;color:#276749;border:1px solid #9ae6b4;'
                    : 'background:#fefcbf;color:#744210;border:1px solid #f6e05e;')
                  + 'padding:14px 24px;border-radius:10px;font-size:14px;z-index:10000;text-align:center;'
                  + 'box-shadow:0 4px 16px rgba(0,0,0,0.15);max-width:360px;line-height:1.5;';
                notif.textContent = notifMsg;
                document.body.appendChild(notif);
                setTimeout(function() { if (notif.parentNode) notif.parentNode.removeChild(notif); }, 9000);
                if (data.classifyDebug && getCookie('keyword_classify_debug') === 'on') {
                  showClassifyDebugModal(data.classifyDebug);
                }
                // 自動分類完了後：モーダルが開いていれば即時反映、閉じていれば開いて反映
                window.__pendingAutoLabel = { query: data.query, label: data.autoLabel };
                if (typeof window.__reloadSearchHistory === 'function') window.__reloadSearchHistory();
                return;
              } else {
                window.__pendingNewKeyword = data.query;
              }
            }
            if (typeof window.__reloadSearchHistory === 'function') window.__reloadSearchHistory();
          })
          .catch(function() {
            searchBtn.disabled = false;
            searchBody.innerHTML = '<div class="search-empty">検索に失敗しました</div>';
            searchSubtitle.textContent = '';
          });
      }

      searchBtn.addEventListener('click', executeSearch);
      searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') executeSearch();
      });

      // グループ折りたたみ
      searchBody.addEventListener('click', function(e) {
        var target = e.target;
        if (!(target instanceof Element)) return;
        var header = target.closest('[data-search-group-toggle]');
        if (!header) return;
        var expanded = header.getAttribute('aria-expanded') === 'true';
        header.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        var body = header.nextElementSibling;
        if (body && body.classList.contains('search-result-group-body')) {
          body.classList.toggle('collapsed');
        }
      });
    })();

    // ===== 検索履歴ボタン & グリッドモーダル =====
    (function() {
      var historyRow = document.getElementById('searchHistoryRow');
      var historyOpenBtn = document.getElementById('searchHistoryOpenBtn');
      var historyModal = document.getElementById('searchHistoryModal');
      var historyModalClose = document.getElementById('historyModalClose');
      var historyModalBody = document.getElementById('historyModalBody');
      var historyModalTitle = document.getElementById('historyModalTitle');
      var hSearchInput = document.getElementById('historySearchInput');
      var hSearchBtn = document.getElementById('historySearchBtn');
      var hSearchStatus = document.getElementById('historySearchStatus');
      var hRepoSelect = document.getElementById('historyRepoSelect');
      var hIncrSearchToggle = document.getElementById('historyIncrSearchToggle');
      var historyLabelFilter = document.getElementById('historyLabelFilter');
      if (!historyRow || !historyOpenBtn || !historyModal || !historyModalBody) return;

      var isIncrementalSearchEnabled = getCookie('history_incr_search') === 'on';

      var ROWS_PER_COL = 20;
      var MIN_COLS = 3;
      var MAX_COLS = 5;
      var currentItems = [];
      var activeCokeySet = {};
      var selectedRepo = '';

      function escHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      }

      function applyRepoHighlight() {
        var rows = historyModalBody.querySelectorAll('tr[data-query]');
        var hasFilter = Object.keys(activeCokeySet).length > 0;
        for (var i = 0; i < rows.length; i++) {
          var row = rows[i];
          var q = row.getAttribute('data-query');
          row.classList.remove('history-row-cokey', 'history-row-dimmed');
          if (hasFilter) {
            if (activeCokeySet[q]) {
              row.classList.add('history-row-cokey');
            } else {
              row.classList.add('history-row-dimmed');
            }
          }
        }
      }

      function loadRepoFilter(repo) {
        if (!repo) {
          activeCokeySet = {};
          currentItems.forEach(function(item) { item.repoHitCount = null; });
          currentItems.sort(function(a, b) { return b.total_hits - a.total_hits; });
          refreshGrid(null, null);
          return;
        }
        fetch('/api/repositories/search/repo-keywords?repo=' + encodeURIComponent(repo), { credentials: 'same-origin' })
          .then(function(res) { return res.ok ? res.json() : null; })
          .then(function(data) {
            var countMap = {};
            activeCokeySet = {};
            if (data && data.keywords) {
              data.keywords.forEach(function(k) {
                countMap[k.search_query] = k.repo_hit_count;
                activeCokeySet[k.search_query] = true;
              });
            }
            currentItems.forEach(function(item) {
              item.repoHitCount = (countMap[item.search_query] !== undefined) ? countMap[item.search_query] : 0;
            });
            currentItems.sort(function(a, b) { return b.repoHitCount - a.repoHitCount; });
            refreshGrid(null, null);
          })
          .catch(function() {});
      }

      function checkHistoryExists() {
        fetch('/api/repositories/search/history', { credentials: 'same-origin' })
          .then(function(res) { return res.ok ? res.json() : null; })
          .then(function(data) {
            if (!data || !data.history || data.history.length === 0) {
              historyRow.style.display = 'none';
            } else {
              historyRow.style.display = 'flex';
            }
          })
          .catch(function() { /* ignore */ });
      }

      checkHistoryExists();
      function reloadAndFocusAutoLabel() {
        Promise.all([
          fetch('/api/repositories/search/history', { credentials: 'same-origin' })
            .then(function(res) { return res.ok ? res.json() : null; }),
          fetch('/api/repositories/search/repo-list', { credentials: 'same-origin' })
            .then(function(res) { return res.ok ? res.json() : null; }),
        ]).then(function(results) {
          var hData = results[0];
          var repoData = results[1];
          if (repoData && Array.isArray(repoData.repos)) populateRepoSelect(repoData.repos);
          if (!hData || !hData.history || hData.history.length === 0) {
            currentItems = [];
            historyModalBody.innerHTML = '<div class="search-empty">検索履歴がありません。</div>';
            updateTitle();
            return;
          }
          currentItems = dedupeAndSort(hData.history);
          syncFilterBarFromItems(currentItems);
          updateLabelBadgeCounts(currentItems);
          refreshGrid(null, null);
          var pendingAuto = window.__pendingAutoLabel;
          window.__pendingAutoLabel = null;
          if (pendingAuto && pendingAuto.label && pendingAuto.label !== 'uncategorized') {
            selectLabelFilter(pendingAuto.label);
          } else if (pendingAuto) {
            syncLabelFilterToKeyword(pendingAuto.query);
          }
        }).catch(function() {});
      }

      window.__reloadSearchHistory = function() {
        checkHistoryExists();
        if (historyModal.classList.contains('show')) {
          // モーダルが開いている: currentItems を再取得してフォーカスを反映
          reloadAndFocusAutoLabel();
        } else if (window.__pendingAutoLabel) {
          // モーダルが閉じている + 自動分類完了: モーダルを開いてフォーカスを反映
          historyModalTitle.textContent = '検索履歴';
          historyModalBody.innerHTML = '<div class="search-loading">読み込み中...</div>';
          setSearchStatus('', '');
          if (hSearchInput) hSearchInput.value = '';
          openHistoryModal();
          reloadAndFocusAutoLabel();
        }
      };

      function openHistoryModal() {
        historyModal.classList.add('show');
        document.body.style.overflow = 'hidden';
      }
      function closeHistoryModal() {
        historyModal.classList.remove('show');
        document.body.style.overflow = '';
        selectedLabel = '';
        if (historyLabelFilter) {
          historyLabelFilter.querySelectorAll('.history-label-btn').forEach(function(b, i) {
            b.classList.toggle('active', i === 0);
          });
        }
      }
      if (historyModalClose) {
        historyModalClose.addEventListener('click', closeHistoryModal);
      }
      historyModal.addEventListener('click', function(e) {
        if (e.target === historyModal) closeHistoryModal();
      });
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && historyModal.classList.contains('show')) closeHistoryModal();
      });

      function syncFilterBarFromItems(items) {
        if (!historyLabelFilter) return;
        var existing = new Set(Array.from(historyLabelFilter.querySelectorAll('.history-label-btn[data-label]')).map(function(b) { return b.getAttribute('data-label'); }));
        var uncatBtn = historyLabelFilter.querySelector('[data-label="uncategorized"]');
        items.forEach(function(item) {
          var lbl = item.label;
          if (!lbl || lbl === 'uncategorized' || existing.has(lbl)) return;
          existing.add(lbl);
          var newBtn = document.createElement('button');
          newBtn.className = 'history-label-btn';
          newBtn.setAttribute('data-label', lbl);
          newBtn.setAttribute('data-label-name', lbl);
          newBtn.textContent = lbl;
          if (uncatBtn) historyLabelFilter.insertBefore(newBtn, uncatBtn);
          else historyLabelFilter.appendChild(newBtn);
        });
      }

      var showLabelBadgeCount = getCookie('keyword_badge_count') !== 'off';

      function updateLabelBadgeCounts(items) {
        if (!historyLabelFilter) return;
        var counts = {};
        items.forEach(function(item) {
          var lbl = item.label || 'uncategorized';
          counts[lbl] = (counts[lbl] || 0) + 1;
        });
        var total = items.length;
        historyLabelFilter.querySelectorAll('.history-label-btn').forEach(function(btn) {
          var lbl = btn.getAttribute('data-label');
          if (lbl === null) return;
          var baseName = btn.getAttribute('data-label-name') || btn.textContent.replace(/\s*\(\d+\)$/, '').trim() || btn.textContent;
          if (!btn.getAttribute('data-label-name')) btn.setAttribute('data-label-name', baseName);
          if (showLabelBadgeCount) {
            var cnt = lbl === '' ? total : (counts[lbl] || 0);
            btn.textContent = baseName + ' (' + cnt + ')';
          } else {
            btn.textContent = baseName;
          }
        });
      }

      function dedupeAndSort(history) {
        var map = {};
        history.forEach(function(item) {
          var key = item.search_query;
          if (!map[key] || item.total_hits > map[key].total_hits) {
            map[key] = { search_query: key, total_hits: item.total_hits, repoHitCount: null, label: item.label || 'uncategorized' };
          }
        });
        var arr = [];
        for (var k in map) { if (map.hasOwnProperty(k)) arr.push(map[k]); }
        arr.sort(function(a, b) { return b.total_hits - a.total_hits; });
        return arr;
      }

      var selectedLabel = '';
      var searchLabelMode = (function() {
        var v = getCookie('user_search_label_mode');
        return (v === 'manual-modal' || v === 'auto-classify') ? v : 'uncategorized';
      }());

      function selectLabelFilter(label) {
        selectedLabel = label;
        if (historyLabelFilter) {
          historyLabelFilter.querySelectorAll('.history-label-btn').forEach(function(b) {
            b.classList.toggle('active', (b.getAttribute('data-label') || '') === label);
          });
        }
        refreshGrid(null, null);
      }

      function showLabelClassificationModal(query) {
        var modal = document.getElementById('labelClassifyModal');
        var queryEl = document.getElementById('labelClassifyQuery');
        var btnsContainer = document.getElementById('labelClassifyBtns');
        var input = document.getElementById('labelClassifyInput');
        if (!modal || !queryEl) return;
        queryEl.textContent = '「' + query + '」';
        if (input) input.value = '';
        var selectedBtn = null;

        // フィルタバーの現在のラベルを走査して最新状態でボタンを再描画
        if (btnsContainer && historyLabelFilter) {
          btnsContainer.innerHTML = '';
          historyLabelFilter.querySelectorAll('.history-label-btn[data-label]').forEach(function(filterBtn) {
            var lbl = filterBtn.getAttribute('data-label');
            if (lbl === '') return;
            var btn = document.createElement('button');
            btn.className = 'label-classify-btn';
            btn.setAttribute('data-label', lbl);
            btn.textContent = lbl === 'uncategorized' ? '未分類のまま' : lbl;
            btnsContainer.appendChild(btn);
          });
        }

        modal.querySelectorAll('.label-classify-btn').forEach(function(b) { b.classList.remove('selected'); });
        modal.style.display = 'flex';

        function dismiss() { modal.style.display = 'none'; }

        var closeBtn = document.getElementById('labelClassifyClose');
        var skipBtn = document.getElementById('labelClassifySkip');
        var confirmBtn = document.getElementById('labelClassifyConfirm');

        if (closeBtn) closeBtn.onclick = dismiss;
        if (skipBtn) skipBtn.onclick = dismiss;

        modal.querySelectorAll('.label-classify-btn').forEach(function(btn) {
          btn.onclick = function() {
            modal.querySelectorAll('.label-classify-btn').forEach(function(b) { b.classList.remove('selected'); });
            btn.classList.add('selected');
            selectedBtn = btn.getAttribute('data-label');
            if (input) input.value = '';
          };
        });

        if (confirmBtn) {
          confirmBtn.onclick = function() {
            var label = (input && input.value.trim()) ? input.value.trim() : (selectedBtn || 'uncategorized');
            dismiss();
            fetch('/api/repositories/search/keyword-label', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ search_query: query, label: label })
            }).then(function(res) { return res.ok ? res.json() : Promise.reject(); })
              .then(function() {
                for (var i = 0; i < currentItems.length; i++) {
                  if (currentItems[i].search_query === query) { currentItems[i].label = label; break; }
                }
                var existingLabels = historyLabelFilter ? Array.from(historyLabelFilter.querySelectorAll('.history-label-btn')).map(function(b) { return b.getAttribute('data-label'); }) : [];
                if (label !== 'uncategorized' && !existingLabels.includes(label)) {
                  var newBtn = document.createElement('button');
                  newBtn.className = 'history-label-btn';
                  newBtn.setAttribute('data-label', label);
                  newBtn.setAttribute('data-label-name', label);
                  newBtn.textContent = label;
                  var uncatBtn = historyLabelFilter.querySelector('[data-label="uncategorized"]');
                  if (uncatBtn) historyLabelFilter.insertBefore(newBtn, uncatBtn);
                  else historyLabelFilter.appendChild(newBtn);
                }
                updateLabelBadgeCounts(currentItems);
                selectLabelFilter(label);
              })
              .catch(function() {
                var failMsg = document.createElement('div');
                failMsg.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#e53e3e;color:#fff;padding:8px 18px;border-radius:8px;font-size:13px;z-index:10000;';
                failMsg.textContent = 'ラベルの保存に失敗しました';
                document.body.appendChild(failMsg);
                setTimeout(function() { if (failMsg.parentNode) failMsg.parentNode.removeChild(failMsg); }, 4000);
              });
          };
        }
      }

      if (historyLabelFilter) {
        historyLabelFilter.addEventListener('click', function(e) {
          var btn = e.target.closest('.history-label-btn');
          if (!btn) return;
          selectedLabel = btn.getAttribute('data-label') || '';
          historyLabelFilter.querySelectorAll('.history-label-btn').forEach(function(b) {
            b.classList.toggle('active', b === btn);
          });
          refreshGrid(null, null);
        });
      }

      var selectedKeyword = null;
      var keywordDetailPanel = document.getElementById('keywordDetailPanel');

      if (hRepoSelect) {
        hRepoSelect.addEventListener('change', function() {
          selectedRepo = hRepoSelect.value;
          if (keywordDetailPanel && keywordDetailPanel.style.display !== 'none') {
            keywordDetailPanel.style.display = 'none';
            keywordDetailPanel.innerHTML = '';
            selectedKeyword = null;
            activeCokeySet = {};
          }
          loadRepoFilter(selectedRepo);
        });
      }

      function getIncrementalFilteredItems() {
        var items = currentItems;
        if (selectedLabel) {
          items = items.filter(function(item) { return item.label === selectedLabel; });
        }
        if (!isIncrementalSearchEnabled) return items;
        var val = hSearchInput ? hSearchInput.value.trim().toLowerCase() : '';
        if (!val) return items;
        return items.filter(function(item) {
          return item.search_query.toLowerCase().indexOf(val) !== -1;
        });
      }

      function renderGrid(items, highlightKey, highlightType) {
        if (items.length === 0) return '<div class="search-empty">検索履歴がありません。</div>';
        var numCols = Math.ceil(items.length / ROWS_PER_COL);
        if (numCols < MIN_COLS) numCols = MIN_COLS;
        if (numCols > MAX_COLS) numCols = MAX_COLS;
        var rowsPerCol = Math.ceil(items.length / numCols);
        var html = '<div class="history-grid-wrap">';
        for (var c = 0; c < numCols; c++) {
          var start = c * rowsPerCol;
          var end = Math.min(start + rowsPerCol, items.length);
          html += '<div class="history-grid-col"><table>'
            + '<thead><tr><th>当該</th><th>総ヒット数</th><th>キーワード</th></tr></thead><tbody>';
          for (var r = start; r < end; r++) {
            var rowClasses = [];
            if (highlightKey && items[r].search_query === highlightKey) {
              rowClasses.push(highlightType === 'new' ? 'history-row-new' : 'history-row-updated');
            }
            if (selectedKeyword && items[r].search_query === selectedKeyword) {
              rowClasses.push('selected');
            }
            var rowClass = rowClasses.length > 0 ? ' class="' + rowClasses.join(' ') + '"' : '';
            var repoHit = (items[r].repoHitCount != null) ? items[r].repoHitCount : '-';
            html += '<tr' + rowClass + ' data-query="' + escHtml(items[r].search_query) + '">'
              + '<td>' + repoHit + '</td>'
              + '<td><span class="history-hit-badge">' + items[r].total_hits + '</span></td>'
              + '<td title="' + escHtml(items[r].search_query) + '">' + escHtml(items[r].search_query) + '</td>'
              + '</tr>';
          }
          if (start >= items.length) {
            html += '<tr><td colspan="3" style="color:var(--text-muted);text-align:center;padding:20px 0;font-size:12px;">&mdash;</td></tr>';
          }
          html += '</tbody></table></div>';
        }
        html += '</div>';
        return html;
      }

      function buildTimeseriesChart(series) {
        if (!series || series.length === 0) return '<div style="color:var(--text-muted);font-size:12px;">データなし</div>';
        var maxHits = 0;
        series.forEach(function(d) { if (d.total_hits > maxHits) maxHits = d.total_hits; });
        if (maxHits === 0) maxHits = 1;
        var barW = 28, gap = 4, padL = 28, padB = 28, padT = 10, chartH = 80;
        var svgW = Math.max(padL + series.length * (barW + gap) + 10, 200);
        var svgH = chartH + padB + padT;
        var html = '<svg width="' + svgW + '" height="' + svgH + '" role="img">';
        series.forEach(function(d, i) {
          var x = padL + i * (barW + gap);
          var barH = Math.max(2, Math.round((d.total_hits / maxHits) * chartH));
          var y = padT + chartH - barH;
          var label = d.date ? d.date.substring(5) : '';
          html += '<rect class="kd-bar" x="' + x + '" y="' + y + '" width="' + barW + '" height="' + barH + '" rx="3">'
            + '<title>' + escHtml(d.date) + ': ' + d.total_hits + 'ヒット / ' + d.search_count + '回検索</title>'
            + '</rect>';
          html += '<text class="kd-label" x="' + (x + barW / 2) + '" y="' + (padT + chartH + 14) + '" text-anchor="middle">' + escHtml(label) + '</text>';
          if (d.total_hits > 0) {
            html += '<text class="kd-value" x="' + (x + barW / 2) + '" y="' + (y - 3) + '" text-anchor="middle">' + d.total_hits + '</text>';
          }
        });
        html += '</svg>';
        return html;
      }

      function syncLabelFilterToKeyword(query) {
        var found = currentItems.find(function(item) { return item.search_query === query; });
        var label = (found && found.label) ? found.label : 'uncategorized';
        selectLabelFilter(label);
      }

      function showKeywordDetail(query) {
        selectedKeyword = query;
        syncLabelFilterToKeyword(query);
        if (!keywordDetailPanel) return;
        keywordDetailPanel.style.display = '';
        keywordDetailPanel.innerHTML = '<div class="keyword-detail-panel"><div class="keyword-detail-panel-header">'
          + '<span class="keyword-detail-panel-title">「' + escHtml(query) + '」の詳細集計</span>'
          + '<div style="display:flex;align-items:center;gap:4px;">'
          + '<button class="keyword-detail-classify-btn" id="keywordDetailClassifyBtn" type="button">このキーワードを分類する</button>'
          + '<button class="keyword-detail-panel-close" id="keywordDetailClose" type="button">&times;</button>'
          + '</div>'
          + '</div><div class="keyword-detail-loading">読み込み中...</div></div>';

        var closeBtn = document.getElementById('keywordDetailClose');
        if (closeBtn) {
          closeBtn.addEventListener('click', function() {
            selectedKeyword = null;
            keywordDetailPanel.style.display = 'none';
            keywordDetailPanel.innerHTML = '';
            selectLabelFilter('');
            refreshGrid(null, null);
          });
        }
        var classifyBtn = document.getElementById('keywordDetailClassifyBtn');
        if (classifyBtn) {
          classifyBtn.addEventListener('click', function() { showLabelClassificationModal(query); });
        }

        fetch('/api/repositories/search/keyword-stats?q=' + encodeURIComponent(query), { credentials: 'same-origin', cache: 'no-store' })
          .then(function(res) { return res.ok ? res.json() : null; })
          .then(function(data) {
            if (!data || data.error) {
              keywordDetailPanel.querySelector('.keyword-detail-loading').textContent = '取得に失敗しました';
              return;
            }
            var s = data.summary || {};
            var body = '<div class="keyword-detail-body">';

            // 左列: サマリー + リポジトリ一覧
            body += '<div>';
            body += '<div class="keyword-detail-section">';
            body += '<div class="keyword-detail-section-title">集計サマリー</div>';
            body += '<div class="keyword-detail-summary-row">';
            body += '<div class="keyword-detail-stat"><span class="keyword-detail-stat-value">' + (s.search_count || 0) + '</span><span class="keyword-detail-stat-label">検索回数</span></div>';
            body += '<div class="keyword-detail-stat"><span class="keyword-detail-stat-value">' + (s.search_days || 0) + '</span><span class="keyword-detail-stat-label">検索日数</span></div>';
            body += '<div class="keyword-detail-stat"><span class="keyword-detail-stat-value">' + (s.total_hits || 0) + '</span><span class="keyword-detail-stat-label">総ヒット数</span></div>';
            body += '<div class="keyword-detail-stat"><span class="keyword-detail-stat-value">' + (data.repoStats ? data.repoStats.length : 0) + '</span><span class="keyword-detail-stat-label">対象リポジトリ</span></div>';
            body += '</div>';
            body += '</div>';

            if (data.repoStats && data.repoStats.length > 0) {
              body += '<div class="keyword-detail-section" style="margin-top:10px;">';
              body += '<div class="keyword-detail-section-title">リポジトリ別ヒット数</div>';
              body += '<ul class="keyword-detail-repo-list">';
              data.repoStats.slice(0, 10).forEach(function(r) {
                body += '<li><span class="keyword-detail-repo-name" title="' + escHtml(r.repo_name) + '">' + escHtml(r.repo_name) + '</span>'
                  + '<span class="keyword-detail-repo-count">' + r.total_hit_count + ' ヒット</span></li>';
              });
              body += '</ul></div>';
            }
            body += '</div>';

            // 右列: 共起キーワード + 時系列グラフ
            body += '<div>';
            var coCount = (data.coKeywords && data.coKeywords.length) || 0;
            var totalKw = data.totalKeywordCount || 0;
            var coTitle = '共起キーワード : (' + coCount + '/' + totalKw + ')';
            if (data.coKeywords && data.coKeywords.length > 0) {
              body += '<div class="keyword-detail-section">';
              body += '<div class="keyword-detail-section-title">' + escHtml(coTitle) + '</div>';
              body += '<div class="keyword-detail-cokey-list">';
              data.coKeywords.slice(0, 20).forEach(function(k) {
                body += '<span class="keyword-detail-cokey-tag" data-cokey="' + escHtml(k.search_query) + '" title="共有リポジトリ数: ' + k.shared_repo_count + '">'
                  + escHtml(k.search_query)
                  + '<span class="keyword-detail-cokey-count">×' + k.shared_repo_count + '</span>'
                  + '</span>';
              });
              body += '</div></div>';
            } else {
              body += '<div class="keyword-detail-section"><div class="keyword-detail-section-title">' + escHtml(coTitle) + '</div>'
                + '<div style="font-size:12px;color:var(--text-muted);">なし</div></div>';
            }

            if (data.timeseries && data.timeseries.length > 0) {
              body += '<div class="keyword-detail-section" style="margin-top:12px;">';
              body += '<div class="keyword-detail-section-title">日別ヒット数推移</div>';
              body += '<div class="keyword-detail-graph-wrap">' + buildTimeseriesChart(data.timeseries) + '</div>';
              body += '</div>';
            }
            body += '</div>';
            body += '</div>';

            var panel = keywordDetailPanel.querySelector('.keyword-detail-panel');
            if (panel) {
              panel.innerHTML = '<div class="keyword-detail-panel-header">'
                + '<span class="keyword-detail-panel-title">「' + escHtml(query) + '」の詳細集計</span>'
                + '<div style="display:flex;align-items:center;gap:4px;">'
                + '<button class="keyword-detail-classify-btn" id="keywordDetailClassifyBtn2" type="button">このキーワードを分類する</button>'
                + '<button class="keyword-detail-panel-close" id="keywordDetailClose" type="button">&times;</button>'
                + '</div>'
                + '</div>' + body;
              var closeBtn2 = panel.querySelector('#keywordDetailClose');
              if (closeBtn2) {
                closeBtn2.addEventListener('click', function() {
                  selectedKeyword = null;
                  keywordDetailPanel.style.display = 'none';
                  keywordDetailPanel.innerHTML = '';
                  selectLabelFilter('');
                  refreshGrid(null, null);
                });
              }
              var classifyBtn2 = panel.querySelector('#keywordDetailClassifyBtn2');
              if (classifyBtn2) {
                classifyBtn2.addEventListener('click', function() { showLabelClassificationModal(query); });
              }
              panel.querySelectorAll('[data-cokey]').forEach(function(el) {
                el.addEventListener('click', function() {
                  var cokey = el.getAttribute('data-cokey');
                  if (cokey) showKeywordDetail(cokey);
                });
              });
            }

          })
          .catch(function() {
            var loading = keywordDetailPanel.querySelector('.keyword-detail-loading');
            if (loading) loading.textContent = '取得に失敗しました';
          });

        refreshGrid(null, null);
      }

      function updateTitle() {
        var displayed = getIncrementalFilteredItems().length;
        if (displayed === currentItems.length) {
          historyModalTitle.textContent = '検索履歴 (' + currentItems.length + ' 件)';
        } else {
          historyModalTitle.textContent = '検索履歴 (' + displayed + ' / ' + currentItems.length + ' 件)';
        }
      }

      function refreshGrid(highlightKey, highlightType) {
        updateTitle();
        var displayItems = getIncrementalFilteredItems();
        historyModalBody.innerHTML = renderGrid(displayItems, highlightKey, highlightType);
        historyModalBody.querySelectorAll('tr[data-query]').forEach(function(row) {
          row.addEventListener('click', function() {
            var q = row.getAttribute('data-query');
            if (q) showKeywordDetail(q);
          });
        });
        applyRepoHighlight();
      }

      function setSearchStatus(text, cls) {
        if (!hSearchStatus) return;
        hSearchStatus.textContent = text;
        hSearchStatus.className = 'history-search-status' + (cls ? ' ' + cls : '');
      }

      function mergeResult(query, totalHits) {
        var found = false;
        var highlightType = 'new';
        for (var i = 0; i < currentItems.length; i++) {
          if (currentItems[i].search_query === query) {
            found = true;
            if (totalHits > currentItems[i].total_hits) {
              currentItems[i].total_hits = totalHits;
              highlightType = 'updated';
            } else {
              highlightType = 'updated';
            }
            break;
          }
        }
        if (!found) {
          currentItems.push({ search_query: query, total_hits: totalHits, repoHitCount: null });
        }
        currentItems.sort(function(a, b) { return b.total_hits - a.total_hits; });
        refreshGrid(query, highlightType);
      }

      function executeModalSearch() {
        if (!hSearchInput) return;
        var query = hSearchInput.value.trim();
        if (!query || query.length < 2) {
          setSearchStatus('2文字以上入力してください', 'error');
          return;
        }
        hSearchBtn.disabled = true;
        setSearchStatus('検索中...', 'searching');

        fetch('/api/repositories/search/commits?q=' + encodeURIComponent(query), { credentials: 'same-origin', cache: 'no-store' })
          .then(function(res) { return res.json(); })
          .then(function(data) {
            hSearchBtn.disabled = false;
            if (data.error) {
              setSearchStatus(data.error, 'error');
              return;
            }
            var total = data.total || 0;
            setSearchStatus('「' + query + '」' + total + ' 件ヒット', 'done');
            hSearchInput.value = '';
            // __pendingAutoLabel を先にセットしてから __reloadSearchHistory を呼ぶ
            if (data.isNewKeyword && data.autoLabel != null) {
              var isSuccess = data.autoLabel !== 'uncategorized';
              var notif = document.createElement('div');
              notif.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);'
                + (isSuccess
                  ? 'background:#c6f6d5;color:#276749;border:1px solid #9ae6b4;'
                  : 'background:#fefcbf;color:#744210;border:1px solid #f6e05e;')
                + 'padding:14px 24px;border-radius:10px;font-size:14px;z-index:10000;text-align:center;'
                + 'box-shadow:0 4px 16px rgba(0,0,0,0.15);max-width:360px;line-height:1.5;';
              notif.textContent = isSuccess
                ? 'キーワード「' + data.query + '」は「' + data.autoLabel + '」に分類されました'
                : data.query + 'は適切なカテゴリが存在しないので未分類に分類されました';
              document.body.appendChild(notif);
              setTimeout(function() { if (notif.parentNode) notif.parentNode.removeChild(notif); }, 9000);
              if (data.classifyDebug && getCookie('keyword_classify_debug') === 'on') {
                showClassifyDebugModal(data.classifyDebug);
              }
              window.__pendingAutoLabel = { query: data.query, label: data.autoLabel };
            }
            if (total > 0) {
              mergeResult(query, total);
              if (typeof window.__reloadSearchHistory === 'function') window.__reloadSearchHistory();
            } else {
              mergeResult(query, 0);
            }
          })
          .catch(function() {
            hSearchBtn.disabled = false;
            setSearchStatus('検索に失敗しました', 'error');
          });
      }

      if (hSearchBtn) {
        hSearchBtn.addEventListener('click', executeModalSearch);
      }
      if (hSearchInput) {
        hSearchInput.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') executeModalSearch();
        });
        hSearchInput.addEventListener('input', function() {
          if (isIncrementalSearchEnabled && currentItems.length > 0) {
            refreshGrid(null, null);
          }
        });
      }

      (function() {
        if (!hIncrSearchToggle) return;
        hIncrSearchToggle.textContent = isIncrementalSearchEnabled ? 'インクリメント: ON' : 'インクリメント: OFF';
        if (isIncrementalSearchEnabled) hIncrSearchToggle.classList.add('active');
        hIncrSearchToggle.addEventListener('click', function() {
          isIncrementalSearchEnabled = !isIncrementalSearchEnabled;
          setCookie('history_incr_search', isIncrementalSearchEnabled ? 'on' : 'off');
          hIncrSearchToggle.textContent = isIncrementalSearchEnabled ? 'インクリメント: ON' : 'インクリメント: OFF';
          if (isIncrementalSearchEnabled) {
            hIncrSearchToggle.classList.add('active');
          } else {
            hIncrSearchToggle.classList.remove('active');
          }
          if (currentItems.length > 0) refreshGrid(null, null);
        });
      })();

      (function() {
        var btn = document.getElementById('historyLabelModeToggle');
        if (!btn) return;
        var MODES = ['uncategorized', 'manual-modal', 'auto-classify'];
        var LABELS = { 'uncategorized': '未分類', 'manual-modal': '手動', 'auto-classify': 'AI' };
        function applyMode(mode) {
          searchLabelMode = mode;
          btn.setAttribute('data-mode', mode);
          btn.textContent = '新キーワードの分類: ' + LABELS[mode];
          setCookie('user_search_label_mode', mode);
        }
        applyMode(searchLabelMode);
        btn.addEventListener('click', function() {
          var next = MODES[(MODES.indexOf(searchLabelMode) + 1) % MODES.length];
          applyMode(next);
        });
      })();

      function populateRepoSelect(repos) {
        if (!hRepoSelect) return;
        var prev = hRepoSelect.value;
        var opts = '<option value="">すべて</option>';
        repos.forEach(function(r) {
          opts += '<option value="' + escHtml(r) + '"' + (r === prev ? ' selected' : '') + '>'
            + escHtml(r) + '</option>';
        });
        hRepoSelect.innerHTML = opts;
      }

      historyOpenBtn.addEventListener('click', function() {
        historyModalTitle.textContent = '検索履歴';
        historyModalBody.innerHTML = '<div class="search-loading">読み込み中...</div>';
        setSearchStatus('', '');
        if (hSearchInput) hSearchInput.value = '';
        openHistoryModal();

        Promise.all([
          fetch('/api/repositories/search/history', { credentials: 'same-origin' })
            .then(function(res) { return res.ok ? res.json() : null; }),
          fetch('/api/repositories/search/repo-list', { credentials: 'same-origin' })
            .then(function(res) { return res.ok ? res.json() : null; }),
        ]).then(function(results) {
          var data = results[0];
          var repoData = results[1];
          if (repoData && Array.isArray(repoData.repos)) {
            populateRepoSelect(repoData.repos);
          }
          if (!data || !data.history || data.history.length === 0) {
            currentItems = [];
            historyModalBody.innerHTML = '<div class="search-empty">検索履歴がありません。</div>';
            updateTitle();
            return;
          }
          currentItems = dedupeAndSort(data.history);
          syncFilterBarFromItems(currentItems);
          updateLabelBadgeCounts(currentItems);
          refreshGrid(null, null);
          var pending = window.__pendingNewKeyword;
          window.__pendingNewKeyword = null;
          if (pending && searchLabelMode === 'manual-modal') {
            showLabelClassificationModal(pending);
          } else if (pending && (searchLabelMode === 'uncategorized' || searchLabelMode === 'auto-classify')) {
            selectLabelFilter('uncategorized');
          }
          // 自動分類完了済みのキーワードを分類先カテゴリにフォーカスする
          var pendingAuto = window.__pendingAutoLabel;
          window.__pendingAutoLabel = null;
          if (pendingAuto && pendingAuto.label && pendingAuto.label !== 'uncategorized') {
            selectLabelFilter(pendingAuto.label);
          } else if (pendingAuto) {
            syncLabelFilterToKeyword(pendingAuto.query);
          }
        }).catch(function() {
          currentItems = [];
          historyModalBody.innerHTML = '<div class="search-empty">読み込みに失敗しました。</div>';
        });
      });
    })();

    // ページ読み込み時に最新のインストール権限を1回だけ取得して差分反映
    (function() {
      fetch('/api/repo-permissions', { credentials: 'same-origin' })
        .then(function(res) { return res.ok ? res.json() : null; })
        .then(function(data) {
          if (!data) return;
          var fresh = data.permissions || {};
          var allPerms = data.allPermissions || null;

          // allPermissions がある場合、全リポジトリ行に適用
          if (allPerms) {
            document.querySelectorAll('.repo-row').forEach(function(row) {
              var nameEl = row.querySelector('.repo-name-link');
              var name = nameEl ? nameEl.textContent.trim() : '';
              if (name && !fresh[name]) {
                fresh[name] = { permissions: allPerms, repositorySelection: 'all' };
              }
            });
          }

          repoPermsData = fresh;
        })
        .catch(function() { /* 取得失敗はサーバーレンダリング済みデータで動作 */ });
    })();
  </script>
</body>
</html>`;
}
