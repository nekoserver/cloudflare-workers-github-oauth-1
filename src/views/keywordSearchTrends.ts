/**
 * 対象: /keyword-search-trendsページのHTML。dynamicnekoのtree-view検索窓で
 * 記録した(tree_view_keyword_search_log/tree_view_keyword_search_results)
 * クエリごとの時系列(切り出しキー異なり数・AIチャット出現回数合計)を一覧表示する。
 * グラフ化(ユーザー要望2026-10-15、将来対応)を見据え、生の時系列データを
 * そのまま表に出す構成にしている。
 * CLAUDE.mdルール15に従い、集計処理はDBアクセスを含まない純粋関数として
 * src/index.ts側のクエリ結果を受け取るだけにする。
 */
import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';
import type { KeywordSearchSnapshot } from '../utils/treeViewKeywordSearchLog';

export type KeywordSearchTrendQueryRow = {
  repoName: string;
  query: string;
  snapshots: KeywordSearchSnapshot[];
};

export type KeywordSearchTrendsData = {
  queries: KeywordSearchTrendQueryRow[];
};

function formatSearchedAt(iso: string): string {
  return iso.replace('T', ' ').slice(0, 16);
}

export function getKeywordSearchTrendsPage(user: { name?: string; username: string }, data: KeywordSearchTrendsData): string {
  const displayName = escapeHtml(user.name || user.username);
  const initials = escapeHtml((user.name || user.username).substring(0, 2).toUpperCase());

  const queryCards = data.queries.length === 0
    ? '<p class="empty-note">検索ログはまだありません。/tree-viewの検索窓で何か検索すると、ここに記録されます。</p>'
    : data.queries.map((q) => {
      const latest = q.snapshots[q.snapshots.length - 1];
      const previous = q.snapshots.length > 1 ? q.snapshots[q.snapshots.length - 2] : null;
      const keywordCountDelta = previous ? latest.keywordCount - previous.keywordCount : null;
      const occurrenceDelta = previous ? latest.totalOccurrenceCount - previous.totalOccurrenceCount : null;
      const deltaLabel = (delta: number | null) => {
        if (delta === null) return '';
        if (delta > 0) return `<span class="delta-up">+${delta}</span>`;
        if (delta < 0) return `<span class="delta-down">${delta}</span>`;
        return `<span class="delta-flat">±0</span>`;
      };

      const rows = q.snapshots.map((s) => `<tr>` +
        `<td>${escapeHtml(formatSearchedAt(s.searchedAt))}</td>` +
        `<td class="num">${s.fileCount}</td>` +
        `<td class="num">${s.keywordCount}</td>` +
        `<td class="num">${s.totalOccurrenceCount}</td>` +
        `</tr>`).join('');

      return `<div class="query-card" data-file-count="${latest.fileCount}" data-keyword-count="${latest.keywordCount}" data-occurrence-count="${latest.totalOccurrenceCount}">
        <div class="query-card-head">
          <span class="query-repo">${escapeHtml(q.repoName)}</span>
          <span class="query-text">${escapeHtml(q.query)}</span>
          <span class="query-latest-stats">
            切り出しキー ${latest.keywordCount}件 ${deltaLabel(keywordCountDelta)}
            / 出現回数合計 ${latest.totalOccurrenceCount} ${deltaLabel(occurrenceDelta)}
          </span>
        </div>
        <table>
          <thead><tr><th>調査日時</th><th class="num">ファイル数</th><th class="num">切り出しキー異なり数</th><th class="num">出現回数合計</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    }).join('');

  const sortControls = data.queries.length === 0 ? '' : `<div class="sort-controls" role="group" aria-label="並び替え">
    <span class="sort-controls-label">並び替え:</span>
    <button type="button" class="sort-btn" data-sort-field="fileCount">ファイル数</button>
    <button type="button" class="sort-btn" data-sort-field="keywordCount">切り出しキー異なり数</button>
    <button type="button" class="sort-btn is-active" data-sort-field="occurrenceCount" data-sort-dir="desc">出現回数合計</button>
  </div>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>📈 検索キーワード傾向分析 - Cloudflare Workers GitHub OAuth</title>
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
    .container { max-width: 900px; margin: 0 auto; padding: 48px 32px; }
    .card {
      background: var(--card-bg); border-radius: 16px;
      box-shadow: 0 20px 60px var(--card-shadow); padding: 48px; margin-bottom: 32px;
    }
    .title { font-size: 32px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
    .subtitle { font-size: 14px; color: var(--text-muted); margin-bottom: 28px; line-height: 1.6; }
    .empty-note { font-size: 13px; color: var(--text-muted); padding: 20px 0; }
    .sort-controls { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
    .sort-controls-label { font-size: 12px; color: var(--text-muted); margin-right: 4px; }
    .sort-btn {
      border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-secondary);
      border-radius: 6px; padding: 5px 10px; font-size: 12px; cursor: pointer;
    }
    .sort-btn.is-active { border-color: var(--accent-color); color: var(--accent-color); font-weight: 700; }
    .query-card { border: 1px solid var(--border-color); border-radius: 10px; padding: 16px; margin-bottom: 16px; }
    .query-card-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
    .query-repo { font-size: 11px; color: var(--text-muted); }
    .query-text { font-size: 16px; font-weight: 700; color: var(--text-primary); }
    .query-latest-stats { font-size: 12px; color: var(--text-secondary); }
    .delta-up { color: #16a34a; font-weight: 700; }
    .delta-down { color: #dc2626; font-weight: 700; }
    .delta-flat { color: var(--text-muted); }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--border-color); font-size: 12px; color: var(--text-secondary); }
    th { color: var(--text-muted); font-weight: 600; font-size: 11px; text-transform: uppercase; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; width: 120px; }
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
      <span>📈</span>
      <span>検索キーワード傾向分析</span>
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
          <a href="/keyword-stats" class="dropdown-item">🔑 キーワード統計</a>
          <a href="/userinfo" class="dropdown-item">👤 ユーザー情報</a>
          <a href="/auth/switch" class="dropdown-item switch-account">🔄 別アカウントでログイン</a>
          <a href="/auth/logout" class="dropdown-item logout">🚪 ログアウト</a>
        </div>
      </div>
    </div>
  </nav>

  <div class="container">
    <div class="card">
      <h1 class="title">📈 検索キーワード傾向分析</h1>
      <p class="subtitle">
        dynamicnekoの/tree-viewで検索するたびに記録される、クエリごとの「切り出しキー異なり数」
        「AIチャットでの出現回数合計」の時系列。調査を重ねるほどこの件数の変化が
        拡張方向の目安になる(件数が少ない=実装がまだ薄い領域)。
      </p>

      ${sortControls}
      <div id="queryCardsList">${queryCards}</div>

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

    (function() {
      var list = document.getElementById('queryCardsList');
      if (!list) return;
      var sortBtns = Array.prototype.slice.call(document.querySelectorAll('.sort-btn'));

      function attrNameForField(field) {
        if (field === 'fileCount') return 'data-file-count';
        if (field === 'keywordCount') return 'data-keyword-count';
        return 'data-occurrence-count';
      }

      function applySort(field, dir) {
        var attrName = attrNameForField(field);
        var cards = Array.prototype.slice.call(list.querySelectorAll('.query-card'));
        cards.sort(function(a, b) {
          var av = Number(a.getAttribute(attrName)) || 0;
          var bv = Number(b.getAttribute(attrName)) || 0;
          return dir === 'asc' ? av - bv : bv - av;
        });
        cards.forEach(function(card) {
          list.appendChild(card);
        });
      }

      sortBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
          var field = btn.getAttribute('data-sort-field');
          var wasActive = btn.classList.contains('is-active');
          var dir = wasActive && btn.getAttribute('data-sort-dir') === 'desc' ? 'asc' : 'desc';
          sortBtns.forEach(function(b) {
            b.classList.remove('is-active');
            b.removeAttribute('data-sort-dir');
          });
          btn.classList.add('is-active');
          btn.setAttribute('data-sort-dir', dir);
          applySort(field, dir);
        });
      });
    })();
  </script>
</body>
</html>`;
}
