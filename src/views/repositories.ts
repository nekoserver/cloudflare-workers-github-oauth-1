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
}): string {
  const displayName = escapeHtml(user.name || user.username);
  const initials = escapeHtml((user.name || user.username).substring(0, 2).toUpperCase());
  const repoCount = user.repositories.length;
  const scopes = user.grantedScopes ?? [];
  const hasRepoScope = scopes.includes('repo');
  const missingScopesBanner = !hasRepoScope && scopes.length > 0 ? true : false;
  const repoPerms = user.repoPermissions ?? {};
  const cfLinked = user.cloudflareLinkedRepos ?? {};
  const vercelLinked = user.vercelLinkedRepos ?? {};
  const slackLinked = user.slackLinkedRepos ?? {};

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

  const missingScopeBannerHtml = missingScopesBanner ? `
    <div class="missing-scope-banner">
      <span class="missing-scope-banner-icon">⚠️</span>
      <div class="missing-scope-banner-text">
        <div class="missing-scope-banner-title">プライベートリポジトリにアクセスできません</div>
        <div class="missing-scope-banner-desc">現在の認証にはプライベートリポジトリへのアクセス権限が含まれていません。権限を追加するには再認証してください。</div>
      </div>
      <a href="/auth/github/reauthorize" class="reauth-btn">
        <svg viewBox="0 0 16 16"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
        権限を追加して再認証
      </a>
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
    .perm-reauth {
      display: inline-flex; align-items: center; gap: 4px;
      color: #2b6cb0; font-size: 12px; font-weight: 600;
      text-decoration: none; margin-left: auto; transition: color 0.2s;
    }
    .perm-reauth:hover { color: #2c5282; text-decoration: underline; }
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

    /* Recent Commits Button */
    .recent-commits-btn {
      display: inline-flex; align-items: center; gap: 4px;
      background: linear-gradient(135deg, #3182ce 0%, #2b6cb0 100%);
      color: white; border: none; border-radius: 6px;
      padding: 4px 10px; font-size: 12px; font-weight: 600;
      cursor: pointer; transition: opacity 0.2s; flex-shrink: 0;
    }
    .recent-commits-btn:hover { opacity: 0.9; }
    .recent-commits-btn-icon { font-size: 12px; }
    .recent-commits-btn-count {
      background: rgba(255,255,255,0.3); padding: 1px 6px; border-radius: 999px;
      font-size: 11px; font-weight: 700; margin-left: 2px;
    }
    .recent-commits-btn-count:empty { display: none; }
    .recent-commits-header-actions {
      display: flex; align-items: center; gap: 8px;
    }
    .recent-commits-settings-link {
      font-size: 11px; color: var(--accent-color); text-decoration: none;
      font-weight: 600; white-space: nowrap; flex-shrink: 0;
      padding: 4px 10px; border: 1px solid var(--border-color); border-radius: 6px;
      background: var(--bg-secondary); transition: background 0.2s;
    }
    .recent-commits-settings-link:hover { background: var(--border-light); text-decoration: underline; }

    /* Recent Commits Modal */
    .recent-commits-modal-content {
      max-width: 640px; width: 92%; max-height: 85vh;
    }
    .recent-commits-modal-content .modal-body {
      padding: 16px 24px 24px; overflow-y: auto; max-height: calc(85vh - 60px);
    }
    .recent-commits-repo-name {
      font-size: 14px; font-weight: 700; color: var(--text-secondary); margin-bottom: 12px;
    }
    .recent-commits-summary {
      font-size: 12px; color: var(--text-faint); margin-bottom: 16px;
      padding-bottom: 8px; border-bottom: 1px solid var(--border-color);
    }
    .recent-commits-date-group {
      margin-bottom: 16px;
    }
    .recent-commits-date-label {
      font-size: 13px; font-weight: 700; color: var(--text-muted);
      margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid var(--border-color);
      display: flex; align-items: center; gap: 8px;
    }
    .recent-commits-date-count {
      font-size: 11px; font-weight: 600; color: var(--text-faint);
      background: var(--badge-bg); padding: 2px 8px; border-radius: 999px;
    }
    .recent-commits-item {
      border: 1px solid var(--border-color); border-radius: 10px; padding: 10px 12px;
      margin-bottom: 8px; transition: border-color 0.2s;
    }
    .recent-commits-item:hover { border-color: var(--accent-color); }
    .recent-commits-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 4px;
    }
    .recent-commits-avatar {
      width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
    }
    .recent-commits-author {
      font-size: 12px; font-weight: 600; color: var(--text-secondary);
    }
    .recent-commits-time {
      font-size: 11px; color: var(--text-faint); margin-left: auto;
    }
    .recent-commits-message {
      font-size: 13px; color: var(--text-primary); line-height: 1.4;
      white-space: pre-wrap; word-break: break-word;
    }
    .recent-commits-message-title { font-weight: 600; }
    .recent-commits-message-body { color: var(--text-muted); margin-top: 2px; font-size: 12px; }
    .recent-commits-sha {
      display: inline-block; margin-top: 4px; font-size: 11px;
      font-family: monospace; color: var(--accent-color); text-decoration: none;
      background: var(--code-bg); padding: 2px 6px; border-radius: 4px;
    }
    .recent-commits-sha:hover { text-decoration: underline; }
    .recent-commits-loading {
      text-align: center; padding: 40px 0; font-size: 13px; color: var(--text-faint);
    }
    .recent-commits-empty {
      text-align: center; padding: 40px 0; font-size: 13px; color: var(--text-faint);
    }
    .recent-commits-pagination {
      display: flex; align-items: center; justify-content: center; gap: 12px;
      margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);
    }
    .recent-commits-page-btn {
      display: inline-flex; align-items: center; gap: 4px;
      background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px;
      padding: 6px 14px; font-size: 12px; font-weight: 600; color: var(--text-secondary);
      cursor: pointer; transition: background 0.2s;
    }
    .recent-commits-page-btn:hover { background: var(--border-light); }
    .recent-commits-page-btn:disabled {
      opacity: 0.4; cursor: not-allowed; background: var(--bg-secondary);
    }
    .recent-commits-page-info {
      font-size: 12px; font-weight: 600; color: var(--text-muted);
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
          <a href="/status" class="dropdown-item">📊 キャッシュ状況</a>
          <a href="/auth/switch" class="dropdown-item switch-account">🔄 別アカウントでログイン</a>
          <a href="/auth/logout" class="dropdown-item logout">🚪 ログアウト</a>
        </div>
      </div>
    </div>
  </nav>

  <div class="container">
    <div class="page-header">
      <h1 class="page-title">📦 リポジトリ</h1>
      <p class="page-subtitle">リポジトリ ${repoCount} 件</p>
      ${errorBanner}
      ${missingScopeBannerHtml}
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
          <button class="recent-commits-btn" id="recentCommitsBtn" type="button" title="最終コミット一覧">
            <span class="recent-commits-btn-icon">📜</span>
            コミット一覧
            <span class="recent-commits-btn-count" id="recentCommitsBtnCount"></span>
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

  <!-- Recent Commits Modal -->
  <div class="modal-overlay" id="recentCommitsModal">
    <div class="modal-content recent-commits-modal-content">
      <div class="modal-header">
        <span class="modal-title">📜 最終コミット一覧</span>
        <div class="recent-commits-header-actions">
          <a href="/settings#recentCommitsCountItem" class="recent-commits-settings-link" title="表示件数変更">表示件数変更</a>
          <button class="modal-close" id="recentCommitsClose" type="button">&times;</button>
        </div>
      </div>
      <div class="modal-body">
        <div class="recent-commits-repo-name" id="recentCommitsRepoName"></div>
        <div class="recent-commits-pagination" id="recentCommitsPagination" style="display:none">
          <button class="recent-commits-page-btn" id="recentCommitsPagePrev" type="button" disabled>◀ 前</button>
          <span class="recent-commits-page-info" id="recentCommitsPageInfo"></span>
          <button class="recent-commits-page-btn" id="recentCommitsPageNext" type="button" disabled>次 ▶</button>
        </div>
        <div class="recent-commits-summary" id="recentCommitsSummary"></div>
        <div id="recentCommitsList"></div>
      </div>
    </div>
  </div>

  <div class="toast" id="repoToast">
    <span class="toast-message" id="repoToastMessage"></span>
    <button class="toast-btn" id="repoToastClose" type="button">OK</button>
  </div>

  <div class="cache-toast-container" id="cacheToastContainer"></div>

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

    // ===== Permissions Modal =====
    var modal = document.getElementById('permissionsModal');
    var modalClose = document.getElementById('modalClose');
    var modalRepoName = document.getElementById('modalRepoName');
    var repoPermsData = ${repoPermsJson};
    var oauthScopes = ${JSON.stringify(scopes)};
    var currentRepoName = '';

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
        if (!active) {
          html += '<a href="/auth/github/reauthorize" class="perm-reauth">権限を追加 →</a>';
        }
        html += '</div>';
        html += '</div>';
      });
      container.innerHTML = html;
    }

    function openPermissionsModal(repoName, owner, rowEl) {
      currentRepoName = repoName;
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
        // 最終コミット一覧 → コミット詳細 → ツリー → Zanzibar → 権限モーダルの順に閉じる
        if (recentCommitsModal && recentCommitsModal.classList.contains('show')) {
          closeRecentCommitsModal();
          return;
        }
        if (commitDetailModal && commitDetailModal.classList.contains('show')) {
          commitDetailModal.classList.remove('show');
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

    // ===== Commit Heatmap Calendar (inline in permissions modal) =====
    var heatmapMonthLabel = document.getElementById('heatmapMonthLabel');
    var heatmapBody = document.getElementById('heatmapBody');
    var heatmapPrev = document.getElementById('heatmapPrev');
    var heatmapNext = document.getElementById('heatmapNext');

    var heatmapYear = 0;
    var heatmapMonth = 0;
    var heatmapOwner = '';
    var heatmapCache = {};

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

    function renderHeatmap(counts, year, month) {
      if (!heatmapBody) return;
      var today = new Date();
      var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
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
        var isToday = dateStr === todayStr;
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
      heatmapBody.innerHTML = html;
    }

    function updateHeatmapMonthLabel() {
      if (heatmapMonthLabel) {
        heatmapMonthLabel.textContent = heatmapYear + '年 ' + heatmapMonth + '月';
      }
    }

    function loadAndRenderHeatmap() {
      if (!heatmapBody || !currentRepoName || !heatmapOwner) return;
      updateHeatmapMonthLabel();
      heatmapBody.innerHTML = '<div class="heatmap-loading">読み込み中...</div>';
      var owner = heatmapOwner;
      var repo = currentRepoName;
      fetchHeatmapData(owner, repo, heatmapYear, heatmapMonth).then(function(counts) {
        renderHeatmap(counts, heatmapYear, heatmapMonth);
      });
    }

    // リポジトリ選択時にヒートマップを開始する（ページ読み込み時には実行しない）
    function startHeatmapForRepo(owner) {
      heatmapOwner = owner;
      var now = new Date();
      heatmapYear = now.getFullYear();
      heatmapMonth = now.getMonth() + 1;
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
            var timeStr = '';
            if (commit.date) {
              var d = new Date(commit.date);
              timeStr = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
            }

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
        })
        .catch(function() {
          commitDetailList.innerHTML = '<div class="commit-detail-empty">読み込みに失敗しました</div>';
        });
    }

    // ===== Recent Commits Modal =====
    var recentCommitsModal = document.getElementById('recentCommitsModal');
    var recentCommitsClose = document.getElementById('recentCommitsClose');
    var recentCommitsBtn = document.getElementById('recentCommitsBtn');
    var recentCommitsBtnCount = document.getElementById('recentCommitsBtnCount');
    var recentCommitsRepoName = document.getElementById('recentCommitsRepoName');
    var recentCommitsSummary = document.getElementById('recentCommitsSummary');
    var recentCommitsList = document.getElementById('recentCommitsList');
    var recentCommitsPagination = document.getElementById('recentCommitsPagination');
    var recentCommitsPagePrev = document.getElementById('recentCommitsPagePrev');
    var recentCommitsPageNext = document.getElementById('recentCommitsPageNext');
    var recentCommitsPageInfo = document.getElementById('recentCommitsPageInfo');

    var rcCurrentPage = 1;
    var rcHasMore = false;
    var rcTotalCount = null;

    function getRecentCommitsCount() {
      var m = document.cookie.match('(^|;)\\\\s*user_recent_commits_count=([^;]*)');
      return m ? parseInt(decodeURIComponent(m[2]), 10) || 20 : 20;
    }

    function openRecentCommitsModal() {
      if (!currentRepoName || !heatmapOwner) return;
      rcCurrentPage = 1;
      rcHasMore = false;
      rcTotalCount = null;
      if (recentCommitsModal) recentCommitsModal.classList.add('show');
      loadRecentCommitsPage(1);
    }

    function loadRecentCommitsPage(page) {
      if (!currentRepoName || !heatmapOwner) return;
      rcCurrentPage = page;
      if (recentCommitsRepoName) recentCommitsRepoName.textContent = heatmapOwner + '/' + currentRepoName;
      if (recentCommitsSummary) recentCommitsSummary.textContent = '読み込み中...';
      if (recentCommitsList) recentCommitsList.innerHTML = '<div class="recent-commits-loading">読み込み中...</div>';
      // ページ遷移時にモーダルをスクロール先頭に戻す
      var modalBody = recentCommitsList ? recentCommitsList.parentElement : null;
      if (modalBody) modalBody.scrollTop = 0;
      updatePaginationControls(false);

      var limit = getRecentCommitsCount();
      var owner = heatmapOwner;
      var repo = currentRepoName;
      fetch('/api/repositories/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) + '/recent-commits?limit=' + limit + '&page=' + page, {
        headers: { 'Accept': 'application/json' },
      })
        .then(function(res) { return res.ok ? res.json() : null; })
        .then(function(data) {
          if (!data || !data.commits || data.commits.length === 0) {
            if (recentCommitsSummary) recentCommitsSummary.textContent = page > 1 ? 'これ以上のコミットはありません' : '';
            if (recentCommitsList) recentCommitsList.innerHTML = '<div class="recent-commits-empty">' + (page > 1 ? 'これ以上のコミットはありません' : 'コミットが見つかりませんでした') + '</div>';
            rcHasMore = false;
            updatePaginationControls(true);
            return;
          }
          rcHasMore = !!data.hasMore;
          if (page === 1 && typeof data.totalCount === 'number' && data.totalCount > 0) {
            rcTotalCount = data.totalCount;
          }
          renderRecentCommits(data.commits, page, limit);
          updatePaginationControls(true);
          // ボタン上の件数バッジを更新（1ページ目のとき）
          if (page === 1 && recentCommitsBtnCount) {
            var badgeText = limit + '件';
            if (rcTotalCount !== null) {
              badgeText = limit + '/' + rcTotalCount + '件';
            }
            recentCommitsBtnCount.textContent = badgeText;
          }
          // キャッシュ/GitHub ソースに応じたトースト通知
          if (data.source === 'cache') {
            showCacheToast('キャッシュからコミット一覧を取得しました', 'cache-source');
          } else if (data.source === 'github') {
            showCacheToast('GitHub からコミット一覧を取得しました', 'github-source');
            if (data.newlyCached) {
              setTimeout(function() {
                showCacheToast('コミット一覧がキャッシュに保存されました', 'cache-saved');
              }, 500);
            }
          }
        })
        .catch(function() {
          if (recentCommitsSummary) recentCommitsSummary.textContent = '';
          if (recentCommitsList) recentCommitsList.innerHTML = '<div class="recent-commits-empty">読み込みに失敗しました</div>';
          updatePaginationControls(true);
        });
    }

    function updatePaginationControls(loaded) {
      if (!recentCommitsPagination) return;
      recentCommitsPagination.style.display = 'flex';
      if (recentCommitsPagePrev) recentCommitsPagePrev.disabled = !loaded || rcCurrentPage <= 1;
      if (recentCommitsPageNext) recentCommitsPageNext.disabled = !loaded || !rcHasMore;
      if (recentCommitsPageInfo) {
        var perPage = getRecentCommitsCount();
        var totalPages = rcTotalCount !== null ? Math.ceil(rcTotalCount / perPage) : null;
        var pageText = rcCurrentPage + ' ページ';
        if (totalPages !== null) {
          pageText = rcCurrentPage + ' / ' + totalPages + ' ページ';
        }
        recentCommitsPageInfo.textContent = pageText;
      }
    }

    function renderRecentCommits(commits, page, perPage) {
      // 日付ごとにグループ化
      var groups = {};
      var groupOrder = [];
      commits.forEach(function(commit) {
        var day = commit.date ? commit.date.substring(0, 10) : 'unknown';
        if (!groups[day]) {
          groups[day] = [];
          groupOrder.push(day);
        }
        groups[day].push(commit);
      });

      if (recentCommitsSummary) {
        var offset = (page - 1) * perPage;
        var rangeText = (offset + 1) + '〜' + (offset + commits.length) + ' 件目';
        if (rcTotalCount !== null) {
          rangeText += '（全 ' + rcTotalCount + ' 件中・' + groupOrder.length + ' 日分）';
        } else {
          rangeText += '（' + groupOrder.length + ' 日分）';
        }
        recentCommitsSummary.textContent = rangeText;
      }

      var html = '';
      groupOrder.forEach(function(day) {
        var dayCommits = groups[day];
        var parts = day.split('-');
        var displayDate = day !== 'unknown' ? parseInt(parts[0]) + '年' + parseInt(parts[1]) + '月' + parseInt(parts[2]) + '日' : '不明';
        html += '<div class="recent-commits-date-group">';
        html += '<div class="recent-commits-date-label">';
        html += '<span>' + esc(displayDate) + '</span>';
        html += '<span class="recent-commits-date-count">' + dayCommits.length + '件</span>';
        html += '</div>';
        dayCommits.forEach(function(commit) {
          var msgLines = (commit.message || '').split('\\n');
          var title = msgLines[0] || '';
          var body = msgLines.slice(1).filter(function(l) { return l.trim() !== ''; }).join('\\n');
          var timeStr = '';
          if (commit.date) {
            var d = new Date(commit.date);
            timeStr = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
          }
          html += '<div class="recent-commits-item">';
          html += '<div class="recent-commits-header">';
          if (commit.authorAvatarUrl) {
            html += '<img class="recent-commits-avatar" src="' + esc(commit.authorAvatarUrl) + '&s=44" alt="" />';
          }
          html += '<span class="recent-commits-author">' + esc(commit.authorLogin || commit.authorName || 'Unknown') + '</span>';
          if (timeStr) {
            html += '<span class="recent-commits-time">' + esc(timeStr) + '</span>';
          }
          html += '</div>';
          html += '<div class="recent-commits-message">';
          html += '<div class="recent-commits-message-title">' + esc(title) + '</div>';
          if (body) {
            html += '<div class="recent-commits-message-body">' + esc(body) + '</div>';
          }
          html += '</div>';
          if (commit.sha && commit.url) {
            html += '<a class="recent-commits-sha" href="' + esc(commit.url) + '" target="_blank" rel="noopener">' + esc(commit.sha.substring(0, 7)) + '</a>';
          }
          html += '</div>';
        });
        html += '</div>';
      });
      if (recentCommitsList) recentCommitsList.innerHTML = html;
    }

    function closeRecentCommitsModal() {
      if (recentCommitsModal) recentCommitsModal.classList.remove('show');
    }

    if (recentCommitsBtn) {
      recentCommitsBtn.addEventListener('click', openRecentCommitsModal);
    }
    if (recentCommitsClose) {
      recentCommitsClose.addEventListener('click', closeRecentCommitsModal);
    }
    if (recentCommitsModal) {
      recentCommitsModal.addEventListener('click', function(e) {
        if (e.target === recentCommitsModal) closeRecentCommitsModal();
      });
    }
    if (recentCommitsPagePrev) {
      recentCommitsPagePrev.addEventListener('click', function() {
        if (rcCurrentPage > 1) loadRecentCommitsPage(rcCurrentPage - 1);
      });
    }
    if (recentCommitsPageNext) {
      recentCommitsPageNext.addEventListener('click', function() {
        if (rcHasMore) loadRecentCommitsPage(rcCurrentPage + 1);
      });
    }

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
