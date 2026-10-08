import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

/**
 * /aichat-cross-model ページ: AIチャットでclaudeとcodexの両方から回答を得ている
 * 質問(question_hashの完全一致、表記揺れは対象外)だけを一覧表示する。
 * データは/api/aichat/cross-model-questions(buildCrossModelQuestionGroups)から取得する。
 */
export function getAichatCrossModelPage(username: string): string {
  const safeUsername = escapeHtml(username);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, interactive-widget=resizes-content">
  <title>claude × codex 両方回答の質問</title>
  ${getThemeInitScript()}
  <style>
    ${getThemeCSS()}
    ${getThemeToggleCSS()}
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg-primary, #f8fafc);
      color: var(--text-primary);
    }
    .navbar {
      position: sticky; top: 0; z-index: 200;
      background: var(--navbar-bg);
      backdrop-filter: blur(10px);
      box-shadow: 0 2px 8px var(--navbar-shadow);
      padding: 0 20px;
      height: 44px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .navbar-brand {
      font-size: 15px; font-weight: 700; color: var(--text-primary); text-decoration: none;
      white-space: nowrap;
    }
    .navbar-spacer { flex: 1; }
    .user-badge { font-size: 11px; color: var(--text-muted); white-space: nowrap; }
    .container { max-width: 880px; margin: 0 auto; padding: 20px 16px 60px; }
    .subtitle { font-size: 12px; color: var(--text-muted); margin-bottom: 16px; }
    .loading, .empty { font-size: 13px; color: var(--text-muted); padding: 24px 0; text-align: center; }
    .error-msg {
      display: none; margin: 12px 0; padding: 10px 14px; border-radius: 6px;
      background: var(--danger-bg, rgba(229,62,62,0.12)); color: var(--danger-color, #e53e3e); font-size: 12px;
    }
    .error-msg.show { display: block; }
    .q-card {
      background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 10px;
      padding: 14px 16px; margin-bottom: 12px;
    }
    .q-text { font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 10px; white-space: pre-wrap; word-break: break-word; }
    .q-answers { display: flex; gap: 10px; flex-wrap: wrap; }
    .q-answer-link {
      display: inline-flex; align-items: center; gap: 6px;
      border: 1px solid var(--border-color); border-radius: 7px;
      padding: 6px 11px; font-size: 12px; color: var(--text-secondary); text-decoration: none;
      background: var(--bg-secondary);
    }
    .q-answer-link:hover { border-color: var(--accent-color, #667eea); color: var(--text-primary); }
    .q-model-tag { font-weight: 700; }
    .q-model-tag.claude { color: #f97316; }
    .q-model-tag.codex { color: var(--accent-color, #667eea); }
    .q-answer-date { color: var(--text-muted); }
    .count-badge { font-size: 11px; color: var(--text-muted); margin-bottom: 14px; }
  </style>
</head>
<body>
  <nav class="navbar">
    <a href="/aichat" class="navbar-brand">🤝 claude × codex 両方回答</a>
    <div class="navbar-spacer"></div>
    ${getThemeToggleHTML()}
    <span class="user-badge">${safeUsername}</span>
  </nav>

  <div class="container">
    <p class="subtitle">/neko askgk claude_prompt="..." と /neko askgk codex_prompt="..." の両方で同じ質問文(完全一致)を送っている質問だけを一覧表示します。表記の違い(言い回し違い)は対象になりません。</p>
    <div class="count-badge" id="countBadge"></div>
    <div class="error-msg" id="errorMsg"></div>
    <div class="loading" id="loadingMsg">読み込み中...</div>
    <div class="empty" id="emptyMsg" style="display:none;">claudeとcodexの両方から回答を得ている質問はまだありません。</div>
    <div id="list"></div>
  </div>

  <script>
    ${getThemeToggleScript()}

    var listEl = document.getElementById('list');
    var loadingEl = document.getElementById('loadingMsg');
    var emptyEl = document.getElementById('emptyMsg');
    var errorEl = document.getElementById('errorMsg');
    var countEl = document.getElementById('countBadge');

    function escHtml(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function formatDate(iso) {
      try {
        var d = new Date(iso);
        return d.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      } catch (e) { return iso; }
    }

    function renderGroups(groups) {
      if (!groups.length) {
        emptyEl.style.display = 'block';
        listEl.innerHTML = '';
        countEl.textContent = '';
        return;
      }
      countEl.textContent = groups.length + '件';
      var html = '';
      groups.forEach(function(g) {
        html += '<div class="q-card">'
          + '<div class="q-text">' + escHtml(g.question) + '</div>'
          + '<div class="q-answers">'
          + '<a class="q-answer-link" href="/s/' + encodeURIComponent(g.claude.userHash) + '/' + encodeURIComponent(g.claude.id) + '">'
          + '<span class="q-model-tag claude">claude</span><span class="q-answer-date">' + escHtml(formatDate(g.claude.createdAt)) + '</span></a>'
          + '<a class="q-answer-link" href="/s/' + encodeURIComponent(g.codex.userHash) + '/' + encodeURIComponent(g.codex.id) + '">'
          + '<span class="q-model-tag codex">codex</span><span class="q-answer-date">' + escHtml(formatDate(g.codex.createdAt)) + '</span></a>'
          + '</div></div>';
      });
      listEl.innerHTML = html;
    }

    fetch('/api/aichat/cross-model-questions')
      .then(function(res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function(data) {
        loadingEl.style.display = 'none';
        renderGroups(data.groups || []);
      })
      .catch(function(err) {
        loadingEl.style.display = 'none';
        errorEl.textContent = '読み込みに失敗しました: ' + (err && err.message ? err.message : err);
        errorEl.classList.add('show');
      });
  </script>
</body>
</html>`;
}
