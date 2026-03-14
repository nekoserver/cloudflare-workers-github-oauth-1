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

export function getRepositoriesPage(user: {
  name?: string;
  username: string;
  repositories: RepositoryListItem[];
  errorMessage?: string | null;
}): string {
  const displayName = escapeHtml(user.name || user.username);
  const initials = escapeHtml((user.name || user.username).substring(0, 2).toUpperCase());
  const repoCount = user.repositories.length;

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
      <div class="repo-row" data-updated="${repo.updatedAt}">
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
  </script>
</body>
</html>`;
}
