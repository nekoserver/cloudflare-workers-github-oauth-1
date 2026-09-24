/**
 * 📋 Jev評価項目一覧ページのHTML。
 * 「どのパターン(入力内容)のときにいくつの質問項目でJevに問い合わせているか」を
 * 一目で把握するためのページ。通常のJev評価(回答/質問文、jev_labels)は
 * 4つの表示グループに分かれるが、実際にJevへ送る質問項目セットは
 * target_type(answer/source_question)によらず常に同じ20件(ループA)。
 * 国名キーワード評価(jev_country_keyword_labels)は完全に別の質問項目セット。
 */
import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

export type JevLabelDetail = { id: number; questionText: string };

export type JevLabelGroupCount = { groupName: string; labelCount: number; labels: JevLabelDetail[] };

export type JevLabelStatsData = {
  groups: JevLabelGroupCount[];
  totalAnswerLabels: number;
  keywordLabelCount: number;
};

export type JevLabelGroupRow = { id: number; name: string };
export type JevLabelRow = { id: number; question_text: string; jev_group_id: number };

/**
 * jev_label_groups(表示グループ)とjev_labels(個別質問項目)の生の行を、
 * グループごとの件数・個別項目一覧にまとめる(DBアクセスを含まない純粋関数、
 * CLAUDE.mdルール15)。
 */
export function buildJevLabelGroupCounts(groupRows: JevLabelGroupRow[], labelRows: JevLabelRow[]): JevLabelGroupCount[] {
  return groupRows.map((g) => {
    const labels = labelRows
      .filter((l) => l.jev_group_id === g.id)
      .map((l) => ({ id: l.id, questionText: l.question_text }));
    return { groupName: g.name, labelCount: labels.length, labels };
  });
}

export function getJevLabelStatsPage(user: { name?: string; username: string }, data: JevLabelStatsData): string {
  const displayName = escapeHtml(user.name || user.username);
  const initials = escapeHtml((user.name || user.username).substring(0, 2).toUpperCase());

  const groupRows = data.groups.length === 0
    ? '<tr class="empty-row"><td colspan="2">グループが登録されていません</td></tr>'
    : data.groups.map((g, i) => {
      const detailItems = g.labels.length === 0
        ? '<li class="detail-empty">質問項目がありません</li>'
        : g.labels.map((l) => `<li>${escapeHtml(l.questionText)}</li>`).join('');
      return `<tr class="group-row" onclick="toggleGroupDetail(${i})" tabindex="0" role="button" aria-expanded="false" aria-controls="groupDetail-${i}">` +
        `<td><span class="group-arrow" id="groupArrow-${i}">▶</span> ${escapeHtml(g.groupName)}</td>` +
        `<td class="num">${g.labelCount}</td>` +
        `</tr>` +
        `<tr class="group-detail-row" id="groupDetail-${i}" style="display:none;">` +
        `<td colspan="2"><ul class="detail-list">${detailItems}</ul></td>` +
        `</tr>`;
    }).join('');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>📋 Jev評価項目一覧 - Cloudflare Workers GitHub OAuth</title>
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
    .container { max-width: 720px; margin: 0 auto; padding: 48px 32px; }
    .card {
      background: var(--card-bg); border-radius: 16px;
      box-shadow: 0 20px 60px var(--card-shadow); padding: 48px; margin-bottom: 32px;
    }
    .title { font-size: 32px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
    .subtitle { font-size: 14px; color: var(--text-muted); margin-bottom: 28px; line-height: 1.6; }
    .section-title { font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 28px 0 4px; }
    .section-note { font-size: 12px; color: var(--text-muted); margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-secondary); }
    th { color: var(--text-muted); font-weight: 600; font-size: 11px; text-transform: uppercase; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
    tfoot td { font-weight: 700; color: var(--text-primary); border-top: 2px solid var(--border-color); border-bottom: none; }
    .empty-row td { text-align: center; color: var(--text-muted); padding: 20px; }
    .group-row { cursor: pointer; }
    .group-row:hover { background: var(--bg-secondary); }
    .group-arrow { display: inline-block; font-size: 10px; color: var(--text-muted); width: 12px; }
    .group-detail-row td { padding: 8px 12px 14px 34px; border-bottom: 1px solid var(--border-color); }
    .detail-list { list-style: disc; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; }
    .detail-list li { font-size: 12.5px; color: var(--text-secondary); line-height: 1.5; }
    .detail-list li.detail-empty { list-style: none; margin-left: -18px; color: var(--text-muted); }
    .stat-tile {
      display: flex; align-items: baseline; justify-content: space-between;
      background: var(--bg-secondary); border-radius: 8px; padding: 14px 16px; margin-top: 4px;
    }
    .stat-tile .stat-label { font-size: 13px; color: var(--text-secondary); }
    .stat-tile .stat-value { font-size: 22px; font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; }
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
      <span>📋</span>
      <span>Jev評価項目一覧</span>
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
      <h1 class="title">📋 Jev評価項目一覧</h1>
      <p class="subtitle">
        Jevへの問い合わせは入力内容のパターンごとに質問項目の数が異なる。
        「回答/質問文の評価」は常に下記4グループ合計の質問項目セットを、
        「国名キーワードの評価」は別セットの質問項目を使う。
      </p>

      <div class="section-title">パターン1: 回答・質問文の評価(jev_labels)</div>
      <div class="section-note">target_type='answer'(回答本文)・'source_question'(質問文そのもの)のどちらも、常にこの同じ質問項目セットを使う。表示上は4グループに分かれるだけ。</div>
      <table>
        <thead><tr><th>表示グループ</th><th class="num">質問項目数</th></tr></thead>
        <tbody>${groupRows}</tbody>
        <tfoot><tr><td>合計</td><td class="num">${data.totalAnswerLabels}</td></tr></tfoot>
      </table>

      <div class="section-title">パターン2: 国名キーワードの評価(jev_country_keyword_labels)</div>
      <div class="section-note">AI分類のキーワードがカタカナの国名だった場合だけ使う、別枠の質問項目セット。</div>
      <div class="stat-tile">
        <span class="stat-label">質問項目数</span>
        <span class="stat-value">${data.keywordLabelCount}</span>
      </div>

      <a href="/welcome" class="back-btn">← ホームに戻る</a>
    </div>
  </div>

  <script>
    ${getThemeToggleScript()}
    function toggleDropdown() {
      document.getElementById('dropdownMenu').classList.toggle('show');
    }
    // グループ行タップで、そのグループ内の個別質問項目一覧を開閉する。
    function toggleGroupDetail(i) {
      var row = document.getElementById('groupDetail-' + i);
      var arrow = document.getElementById('groupArrow-' + i);
      var groupRow = arrow.closest('tr');
      if (!row) return;
      var opening = row.style.display === 'none';
      row.style.display = opening ? 'table-row' : 'none';
      arrow.textContent = opening ? '▼' : '▶';
      if (groupRow) groupRow.setAttribute('aria-expanded', opening ? 'true' : 'false');
    }
    document.querySelectorAll('.group-row').forEach(function(row) {
      row.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          row.click();
        }
      });
    });
    window.addEventListener('click', function(e) {
      var icon = document.querySelector('.user-icon');
      var dd = document.getElementById('dropdownMenu');
      if (!icon.contains(e.target) && !dd.contains(e.target)) dd.classList.remove('show');
    });
  </script>
</body>
</html>`;
}
