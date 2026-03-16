/**
 * リポジトリ一覧ページのHTML
 */
import { escapeHtml } from '../utils/html';

export interface RepositoryListItem {
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
}): string {
  const displayName = escapeHtml(user.name || user.username);
  const initials = escapeHtml((user.name || user.username).substring(0, 2).toUpperCase());
  const repoCount = user.repositories.length;
  const scopes = user.grantedScopes ?? [];
  const hasRepoScope = scopes.includes('repo');
  const missingScopesBanner = !hasRepoScope && scopes.length > 0 ? true : false;
  const repoPerms = user.repoPermissions ?? {};

  // リポジトリごとのインストール権限をJSON化してクライアントサイドで利用
  const repoPermsJson = JSON.stringify(repoPerms);

  const repoRows = user.repositories.map((repo) => {
    const name = escapeHtml(repo.name);
    const description = repo.description ? escapeHtml(repo.description) : '説明なし';
    const language = repo.language ? escapeHtml(repo.language) : '不明';
    const updatedAt = escapeHtml(repo.updatedAt);
    const privacyBadge = repo.isPrivate ? '<span class="badge private">Private</span>' : '<span class="badge public">Public</span>';
    const repoLink = `
      <a class="repo-name-link" href="${repo.htmlUrl}" target="_blank" rel="noreferrer">
        ${name}
      </a>
    `;
    const commitLink = repo.latestCommitSha && repo.latestCommitUrl
      ? `<a class="repo-meta-link" href="${repo.latestCommitUrl}" target="_blank" rel="noreferrer">🔗 ${escapeHtml(repo.latestCommitSha.substring(0, 7))}</a>`
      : `<span class="repo-meta-muted">🔗 なし</span>`;
    return `
      <div class="repo-row" data-updated="${repo.updatedAt}" data-description="${repo.description ? escapeHtml(repo.description) : ''}" data-language="${language}" data-stars="${repo.stars}" data-forks="${repo.forks}" data-private="${repo.isPrivate}" data-commit-sha="${repo.latestCommitSha ? escapeHtml(repo.latestCommitSha.substring(0, 7)) : ''}" data-commit-url="${repo.latestCommitUrl ? escapeHtml(repo.latestCommitUrl) : ''}">
        <div class="repo-main">
          <div class="repo-title">
            <h3 class="repo-name">${repoLink}</h3>
            ${privacyBadge}
          </div>
          <p class="repo-description">${description}</p>
        </div>
        <div class="repo-meta">
          <span class="repo-meta-item">🧩 ${language}</span>
          <span class="repo-meta-item">⭐ ${repo.stars}</span>
          <span class="repo-meta-item">🍴 ${repo.forks}</span>
          <span class="repo-meta-item">🕒 ${updatedAt}</span>
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
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
    }
    .navbar {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .navbar-brand { font-size: 20px; font-weight: 700; color: #1a202c; display: flex; align-items: center; gap: 8px; }
    .user-menu { display: flex; align-items: center; gap: 12px; }
    .user-name { font-size: 14px; color: #2d3748; font-weight: 500; }
    .user-icon {
      width: 40px; height: 40px; border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: 600; font-size: 16px; cursor: pointer;
    }
    .user-menu-container { position: relative; }
    .dropdown-menu {
      display: none; position: absolute; top: 50px; right: 0;
      background: white; border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 180px; z-index: 1000; overflow: hidden;
    }
    .dropdown-menu.show { display: block; }
    .dropdown-item {
      padding: 12px 20px; color: #2d3748; text-decoration: none;
      display: block; cursor: pointer; border-bottom: 1px solid #e2e8f0;
      transition: background 0.2s ease;
    }
    .dropdown-item:last-child { border-bottom: none; }
    .dropdown-item:hover { background: #f7fafc; }
    .dropdown-item.logout { color: #e53e3e; }
    .container { width: 100%; margin: 0 auto; padding: 28px 24px 40px; }
    .page-header {
      background: white; border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3); padding: 24px; margin-bottom: 16px;
    }
    .page-title { font-size: 32px; font-weight: 700; color: #1a202c; margin-bottom: 8px; }
    .page-subtitle { font-size: 16px; color: #718096; }
    .error-banner {
      background: #fed7d7; color: #c53030; border-radius: 12px; padding: 12px 16px;
      font-size: 14px; font-weight: 600; margin-top: 16px;
    }
    .repo-list { display: flex; flex-direction: column; gap: 10px; }
    .repo-list-header {
      display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 16px;
      padding: 0 6px; margin-bottom: 4px; align-items: center;
      color: #1a202c; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;
    }
    .repo-list-header span { opacity: 0.7; }
    .sort-button {
      background: transparent; border: none; padding: 0; color: #1a202c;
      font: inherit; font-weight: 800; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;
    }
    .sort-button:hover { color: #2d3748; }
    .sort-indicator {
      display: inline-flex; align-items: center; justify-content: center;
      width: 20px; height: 20px; border-radius: 999px; background: rgba(26,32,44,0.08);
      font-size: 12px; line-height: 1;
    }
    .repo-row {
      background: white; border-radius: 14px; padding: 16px 18px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.15); color: inherit;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 16px; align-items: center;
    }
    .repo-row:hover { transform: translateY(-2px); box-shadow: 0 16px 36px rgba(0,0,0,0.2); }
    .repo-title { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .repo-name { font-size: 20px; font-weight: 700; color: #2d3748; }
    .repo-name-link {
      color: inherit; text-decoration: none; border-bottom: 2px solid transparent; transition: border-color 0.2s ease;
    }
    .repo-name-link:hover { border-color: #667eea; }
    .badge {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 700;
    }
    .badge.private { background: #feb2b2; color: #9b2c2c; }
    .badge.public { background: #9ae6b4; color: #276749; }
    .repo-description { font-size: 14px; color: #4a5568; min-height: 22px; }
    .repo-meta { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; color: #718096; justify-content: flex-end; }
    .repo-meta-item { background: #edf2f7; padding: 4px 10px; border-radius: 999px; }
    .repo-meta-link { color: #2b6cb0; text-decoration: none; font-weight: 700; }
    .repo-meta-link:hover { text-decoration: underline; }
    .repo-meta-muted { color: #a0aec0; font-weight: 700; }
    @media (max-width: 860px) {
      .container { padding: 22px 16px 32px; }
      .repo-list-header { display: none; }
      .repo-row { grid-template-columns: 1fr; }
      .repo-meta { justify-content: flex-start; }
      .repo-title { flex-wrap: wrap; }
    }
    .empty-state {
      background: rgba(255,255,255,0.9); border-radius: 12px; padding: 16px; text-align: center;
      color: #4a5568; font-weight: 600;
    }
    .repo-row { cursor: pointer; }

    /* Permissions Modal */
    .modal-overlay {
      display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
      z-index: 2000; align-items: center; justify-content: center;
    }
    .modal-overlay.show { display: flex; }
    .modal-content {
      background: white; border-radius: 16px; max-width: 520px; width: 90%;
      max-height: 80vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      animation: modalIn 0.2s ease;
    }
    @keyframes modalIn {
      from { opacity: 0; transform: scale(0.95) translateY(10px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    .modal-header {
      padding: 20px 24px 12px; border-bottom: 1px solid #e2e8f0;
      display: flex; justify-content: space-between; align-items: center;
    }
    .modal-title { font-size: 18px; font-weight: 700; color: #1a202c; }
    .modal-close {
      width: 32px; height: 32px; border-radius: 8px; border: none; background: #f7fafc;
      font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center;
      color: #718096; transition: background 0.2s;
    }
    .modal-close:hover { background: #edf2f7; color: #2d3748; }
    .modal-body { padding: 16px 24px 24px; }
    .modal-repo-name { font-size: 14px; color: #718096; margin-bottom: 12px; font-weight: 600; }
    .modal-repo-summary {
      background: #f7fafc; border-radius: 10px; padding: 14px 16px; margin-bottom: 16px;
      border: 1px solid #e2e8f0;
    }
    .modal-repo-desc { font-size: 13px; color: #4a5568; margin-bottom: 8px; }
    .modal-repo-desc:empty { display: none; }
    .modal-repo-meta-grid { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; color: #718096; }
    .modal-repo-meta-item { background: #edf2f7; padding: 3px 8px; border-radius: 999px; }
    .modal-repo-meta-link { color: #2b6cb0; text-decoration: none; font-weight: 600; }
    .modal-repo-meta-link:hover { text-decoration: underline; }
    .perm-item {
      border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; margin-bottom: 10px;
      transition: border-color 0.2s;
    }
    .perm-item.active { border-color: #9ae6b4; background: #f0fff4; }
    .perm-item.inactive { border-color: #e2e8f0; background: #f7fafc; opacity: 0.6; }
    .perm-header { display: flex; align-items: center; gap: 8px; }
    .perm-icon { font-size: 18px; }
    .perm-name { font-weight: 600; color: #2d3748; flex: 1; font-size: 14px; }
    .perm-badge {
      padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 700;
    }
    .perm-badge.on { background: #c6f6d5; color: #276749; }
    .perm-badge.off { background: #fed7d7; color: #9b2c2c; }
    .perm-caps {
      margin: 8px 0 0 30px; padding: 0; list-style: none; font-size: 13px; color: #4a5568;
    }
    .perm-caps li { padding: 2px 0; }
    .perm-caps li::before { content: '✓ '; color: #38a169; font-weight: 700; }
    .scopes-footer {
      margin-top: 16px; padding-top: 12px; border-top: 1px solid #e2e8f0;
      font-size: 12px; color: #a0aec0;
    }
    .scopes-footer code {
      background: #edf2f7; padding: 1px 5px; border-radius: 4px; font-size: 11px;
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
      font-size: 12px; font-weight: 700; color: #718096; text-transform: uppercase;
      letter-spacing: 0.05em; margin-bottom: 8px;
    }
    .perm-no-install {
      font-size: 13px; color: #a0aec0; padding: 10px 14px;
      border: 1px dashed #e2e8f0; border-radius: 10px; text-align: center;
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
      <span class="user-name">${displayName}</span>
      <div class="user-menu-container">
        <div class="user-icon" title="${displayName}" onclick="toggleDropdown()">
          ${initials}
        </div>
        <div class="dropdown-menu" id="dropdownMenu">
          <a href="/welcome" class="dropdown-item">🏠 ホーム</a>
          <a href="/repositories" class="dropdown-item">📦 リポジトリ</a>
          <a href="/settings" class="dropdown-item">⚙️ 設定</a>
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
        <div class="modal-repo-name" id="modalRepoName"></div>
        <div class="modal-repo-summary" id="modalRepoSummary">
          <div class="modal-repo-desc" id="modalRepoDesc"></div>
          <div class="modal-repo-meta-grid" id="modalRepoMetaGrid"></div>
        </div>
        <div class="perm-section-title">GitHub App インストール権限</div>
        <div id="installPermItems"></div>
        <div class="perm-section-title" style="margin-top:16px">OAuth スコープ</div>
        <div id="oauthPermItems"></div>
        <div class="scopes-footer">
          付与スコープ: ${scopes.length > 0 ? scopes.map(s => `<code>${escapeHtml(s)}</code>`).join(' ') : '<span>取得できませんでした</span>'}
        </div>
      </div>
    </div>
  </div>

  <script>
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

    // Permissions Modal
    var modal = document.getElementById('permissionsModal');
    var modalClose = document.getElementById('modalClose');
    var modalRepoName = document.getElementById('modalRepoName');
    var repoPermsData = ${repoPermsJson};
    var oauthScopes = ${JSON.stringify(scopes)};

    // GitHub App インストール権限の表示名マッピング
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
      if (!info || !info.permissions) {
        container.innerHTML = '<div class="perm-no-install">このリポジトリには GitHub App がインストールされていません</div>';
        return;
      }
      var perms = info.permissions;
      var keys = Object.keys(perms);
      if (keys.length === 0) {
        container.innerHTML = '<div class="perm-no-install">インストール権限が設定されていません</div>';
        return;
      }
      var html = '';
      keys.forEach(function(key) {
        var level = perms[key];
        var display = permDisplayNames[key] || { name: key, icon: '🔧', caps: [] };
        html += '<div class="perm-item active">';
        html += '<div class="perm-header">';
        html += '<span class="perm-icon">' + display.icon + '</span>';
        html += '<span class="perm-name">' + display.name + '</span>';
        html += '<span class="perm-badge on">' + levelLabel(level) + '</span>';
        html += '</div>';
        if (display.caps.length > 0) {
          html += '<ul class="perm-caps">';
          display.caps.forEach(function(c) { html += '<li>' + c + '</li>'; });
          html += '</ul>';
        }
        html += '</div>';
      });
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
        html += '<span class="perm-icon">' + item.icon + '</span>';
        html += '<span class="perm-name">' + item.label + '</span>';
        html += '<span class="perm-badge ' + (active ? 'on' : 'off') + '">' + (active ? '有効' : '無効') + '</span>';
        if (!active) {
          html += '<a href="/auth/github/reauthorize" class="perm-reauth">権限を追加 →</a>';
        }
        html += '</div>';
        html += '</div>';
      });
      container.innerHTML = html;
    }

    function openPermissionsModal(repoName, rowEl) {
      if (modalRepoName) {
        modalRepoName.textContent = repoName;
      }
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
        metaHtml += '<span class="modal-repo-meta-item">🧩 ' + lang + '</span>';
        metaHtml += '<span class="modal-repo-meta-item">⭐ ' + stars + '</span>';
        metaHtml += '<span class="modal-repo-meta-item">🍴 ' + forks + '</span>';
        if (updated) {
          metaHtml += '<span class="modal-repo-meta-item">🕒 ' + updated + '</span>';
        }
        if (commitSha) {
          if (commitUrl) {
            metaHtml += '<span class="modal-repo-meta-item"><a class="modal-repo-meta-link" href="' + commitUrl + '" target="_blank" rel="noreferrer">🔗 ' + commitSha + '</a></span>';
          } else {
            metaHtml += '<span class="modal-repo-meta-item">🔗 ' + commitSha + '</span>';
          }
        }
        metaGrid.innerHTML = metaHtml;
      }
      renderInstallPerms(repoName);
      renderOAuthPerms();
      if (modal) {
        modal.classList.add('show');
      }
    }

    function closePermissionsModal() {
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
        var nameEl = row.querySelector('.repo-name-link');
        var repoName = nameEl ? nameEl.textContent.trim() : '';
        openPermissionsModal(repoName, row);
      });
    });
  </script>
</body>
</html>`;
}
