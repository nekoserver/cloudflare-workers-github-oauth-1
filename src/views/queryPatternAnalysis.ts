/**
 * クエリパターン分析ページのHTML
 *
 * 全テーブルに対する判断材料A〜L(WHERE/IN/LIKE/HAVING等のSQLパターンを
 * そのテーブルに適用すべきかを判定する12個の質問、チャットでの合意事項)の
 * Jevスコアを一覧表示し、未投入のテーブルへその場でシード投入できるページ。
 * `scripts/evaluate-table-pattern-scores.ts`(CLI版)と同じ判断材料・同じ
 * `src/utils/queryPatternAnalysis.ts`のロジックを使う。
 */
import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';
import { JUDGMENT_LABELS } from '../utils/queryPatternAnalysis';

export type QueryPatternTableRow = {
  tableName: string;
  description: string | null;
  sql: string;
  scores: Partial<Record<string, number>>;
};

export function getQueryPatternAnalysisPage(
  user: { name?: string; username: string },
  rows: QueryPatternTableRow[],
): string {
  const displayName = escapeHtml(user.name || user.username);
  const codes = JUDGMENT_LABELS.map((l) => l.code);
  const scoredCount = rows.filter((r) => codes.some((code) => r.scores[code] !== undefined)).length;

  const legendHtml = JUDGMENT_LABELS.map(
    (l) => `<div class="legend-item"><span class="legend-code">${escapeHtml(l.code)}</span><span class="legend-text">${escapeHtml(l.question_text)}</span></div>`,
  ).join('');

  const headerCells = codes.map((code) => `<th title="${escapeHtml(JUDGMENT_LABELS.find((l) => l.code === code)!.question_text)}">${escapeHtml(code)}</th>`).join('');

  const rowsHtml = rows
    .map((row) => {
      const cells = codes
        .map((code) => {
          const score = row.scores[code];
          if (score === undefined) return `<td class="cell-empty" data-code="${escapeHtml(code)}">—</td>`;
          const cls = score >= 0.5 ? 'cell-yes' : 'cell-no';
          return `<td class="${cls}" data-code="${escapeHtml(code)}">${score.toFixed(2)}</td>`;
        })
        .join('');
      const isScored = codes.some((code) => row.scores[code] !== undefined);
      const seedButton = isScored
        ? `<button class="btn-reseed" data-table="${escapeHtml(row.tableName)}">再投入</button>`
        : `<button class="btn-seed" data-table="${escapeHtml(row.tableName)}">シード投入</button>`;
      return `<tr data-row-table="${escapeHtml(row.tableName)}">
        <th class="row-table-name" title="${escapeHtml(row.description ?? '')}"><a class="table-sql-link" href="#table-sql-dialog" data-table="${escapeHtml(row.tableName)}" data-sql="${escapeHtml(row.sql)}" aria-label="${escapeHtml(row.tableName)} のJev評価SQLを表示">${escapeHtml(row.tableName)}</a></th>
        ${cells}
        <td class="cell-action">${seedButton}<span class="row-status"></span></td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>クエリパターン分析 - Cloudflare Workers GitHub OAuth</title>
  ${getThemeInitScript()}
  <style>
    ${getThemeCSS()}
    ${getThemeToggleCSS()}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg-secondary);
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
    .navbar-brand { font-size: 18px; font-weight: 700; color: var(--text-primary); }
    .navbar-user { font-size: 13px; color: var(--text-secondary); }
    .container { max-width: 1400px; margin: 0 auto; padding: 32px; }
    .card {
      background: var(--card-bg); border-radius: 12px;
      box-shadow: 0 8px 30px var(--card-shadow); padding: 32px; margin-bottom: 24px;
    }
    .title { font-size: 26px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; }
    .subtitle { font-size: 14px; color: var(--text-muted); margin-bottom: 20px; line-height: 1.6; }
    .stat-bar { display: flex; gap: 24px; margin-bottom: 20px; font-size: 13px; color: var(--text-secondary); }
    .stat-bar strong { color: var(--text-primary); font-size: 18px; }
    .legend {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 6px 16px; margin-bottom: 24px; padding: 16px; background: var(--bg-secondary); border-radius: 8px;
    }
    .legend-item { display: flex; gap: 8px; align-items: baseline; font-size: 12px; color: var(--text-secondary); }
    .legend-code {
      display: inline-flex; align-items: center; justify-content: center;
      width: 20px; height: 20px; border-radius: 4px; background: var(--accent-color); color: white;
      font-weight: 700; font-size: 11px; flex-shrink: 0;
    }
    .table-wrap { overflow-x: auto; border: 1px solid var(--border-color); border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    thead th {
      position: sticky; top: 0; background: var(--bg-secondary); color: var(--text-muted);
      font-weight: 600; text-transform: uppercase; font-size: 11px;
      padding: 10px 8px; text-align: center; border-bottom: 1px solid var(--border-color); white-space: nowrap;
    }
    thead th:first-child { text-align: left; left: 0; z-index: 2; }
    tbody th {
      text-align: left; padding: 8px 12px; font-family: monospace; font-size: 12px;
      color: var(--text-primary); white-space: nowrap; position: sticky; left: 0;
      background: var(--card-bg); border-right: 1px solid var(--border-color);
    }
    .table-sql-link { color: var(--accent-color); text-decoration: underline; text-underline-offset: 2px; }
    .table-sql-link:hover { text-decoration-thickness: 2px; }
    tbody tr:nth-child(even) th, tbody tr:nth-child(even) td { background: var(--bg-secondary); }
    tbody td { padding: 8px; text-align: center; border-bottom: 1px solid var(--border-color); color: var(--text-secondary); }
    .cell-empty { color: var(--text-muted); }
    .cell-yes { color: var(--success-color); font-weight: 600; }
    .cell-no { color: var(--text-muted); }
    .cell-action { text-align: right; white-space: nowrap; }
    .btn-seed, .btn-reseed {
      padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer;
      border: 1px solid var(--accent-color); background: transparent; color: var(--accent-color);
    }
    .btn-seed:hover, .btn-reseed:hover { background: var(--accent-color); color: white; }
    .btn-seed:disabled, .btn-reseed:disabled { opacity: 0.5; cursor: not-allowed; }
    .row-status { margin-left: 6px; font-size: 11px; color: var(--text-muted); }
    .row-status.error { color: var(--danger-color); }
    .row-status.success { color: var(--success-color); }
    .sql-dialog {
      width: min(900px, calc(100vw - 32px)); max-height: calc(100vh - 32px);
      margin: auto; padding: 0; border: 1px solid var(--border-color); border-radius: 12px;
      background: var(--card-bg); color: var(--text-primary); box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
    }
    .sql-dialog::backdrop { background: rgba(0, 0, 0, 0.68); backdrop-filter: blur(3px); }
    .sql-dialog-header {
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      padding: 16px 20px; border-bottom: 1px solid var(--border-color);
    }
    .sql-dialog-title { font-size: 16px; font-weight: 700; overflow-wrap: anywhere; }
    .sql-dialog-close {
      border: 0; border-radius: 6px; padding: 6px 10px; cursor: pointer;
      background: var(--bg-secondary); color: var(--text-primary); font-size: 18px; line-height: 1;
    }
    .sql-code {
      margin: 0; padding: 20px; overflow: auto; font: 13px/1.65 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      color: var(--text-primary); background: var(--bg-secondary); white-space: pre;
    }
    .sql-keyword { color: #c678dd; font-weight: 700; }
    .sql-type { color: #56b6c2; }
    .sql-string { color: #98c379; }
    .sql-number { color: #d19a66; }
    .sql-comment { color: var(--text-muted); font-style: italic; }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="navbar-brand">クエリパターン分析</div>
    <div class="navbar-user">${displayName}${getThemeToggleHTML()}</div>
  </nav>
  <div class="container">
    <div class="card">
      <div class="title">クエリパターン分析</div>
      <div class="subtitle">
        全${rows.length}テーブルに対して、WHERE/IN/LIKE/HAVING等のSQLパターンをそのテーブルに適用すべきかを判定する
        12個の判断材料(A〜L)をJev APIへ問い合わせたスコア一覧。テーブル行の「シード投入」から、
        その場で1テーブル分(12問)を評価してD1へ保存できる。値は0〜1のスコアで、0.5以上を「はい」寄りとして色分けしている。
      </div>
      <div class="stat-bar">
        <div>投入済み: <strong>${scoredCount}</strong> / ${rows.length}テーブル</div>
      </div>
      <div class="legend">${legendHtml}</div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>テーブル名</th>
              ${headerCells}
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <dialog id="table-sql-dialog" class="sql-dialog" aria-labelledby="table-sql-dialog-title">
    <div class="sql-dialog-header">
      <h2 id="table-sql-dialog-title" class="sql-dialog-title"></h2>
      <button type="button" class="sql-dialog-close" aria-label="閉じる">×</button>
    </div>
    <pre class="sql-code"><code id="table-sql-code"></code></pre>
  </dialog>
  ${getThemeToggleScript()}
  <script>
    var sqlDialog = document.getElementById('table-sql-dialog');
    var sqlDialogTitle = document.getElementById('table-sql-dialog-title');
    var sqlCode = document.getElementById('table-sql-code');

    function highlightSql(sql) {
      var tokenPattern = /(--[^\\n]*|'(?:''|[^'])*'|\\b(?:CREATE|TABLE|PRIMARY|KEY|FOREIGN|REFERENCES|UNIQUE|NOT|NULL|DEFAULT|CHECK|CONSTRAINT|IF|EXISTS|ON|DELETE|UPDATE|CASCADE|AUTOINCREMENT|COLLATE)\\b|\\b(?:INTEGER|TEXT|REAL|BLOB|NUMERIC|BOOLEAN|DATETIME|TIMESTAMP)\\b|\\b\\d+(?:\\.\\d+)?\\b)/gi;
      var position = 0;
      sqlCode.replaceChildren();
      sql.replace(tokenPattern, function(token, _match, offset) {
        sqlCode.append(document.createTextNode(sql.slice(position, offset)));
        var span = document.createElement('span');
        if (token.slice(0, 2) === '--') span.className = 'sql-comment';
        else if (token.charAt(0) === "'") span.className = 'sql-string';
        else if (/^\\d/.test(token)) span.className = 'sql-number';
        else if (/^(INTEGER|TEXT|REAL|BLOB|NUMERIC|BOOLEAN|DATETIME|TIMESTAMP)$/i.test(token)) span.className = 'sql-type';
        else span.className = 'sql-keyword';
        span.textContent = token;
        sqlCode.append(span);
        position = offset + token.length;
        return token;
      });
      sqlCode.append(document.createTextNode(sql.slice(position)));
    }

    document.querySelectorAll('.table-sql-link').forEach(function(link) {
      link.addEventListener('click', function(event) {
        event.preventDefault();
        sqlDialogTitle.textContent = link.dataset.table + ' — Jev評価SQL';
        highlightSql(link.dataset.sql || '');
        sqlDialog.showModal();
      });
    });
    sqlDialog.querySelector('.sql-dialog-close').addEventListener('click', function() { sqlDialog.close(); });
    sqlDialog.addEventListener('click', function(event) {
      if (event.target === sqlDialog) sqlDialog.close();
    });

    document.querySelectorAll('.btn-seed, .btn-reseed').forEach(function(btn) {
      btn.addEventListener('click', function() {
        seedTable(btn.dataset.table, btn);
      });
    });

    function seedTable(tableName, btn) {
      var row = document.querySelector('tr[data-row-table="' + tableName + '"]');
      var status = row.querySelector('.row-status');
      btn.disabled = true;
      status.className = 'row-status';
      status.textContent = '評価中...';

      fetch('/api/query-pattern-analysis/seed', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableName: tableName }),
      })
        .then(function(r) { return r.json().then(function(data) { return { ok: r.ok, data: data }; }); })
        .then(function(res) {
          btn.disabled = false;
          if (!res.ok) {
            status.className = 'row-status error';
            status.textContent = res.data.error || '失敗しました';
            return;
          }
          status.className = 'row-status success';
          status.textContent = '完了';
          (res.data.scores || []).forEach(function(s) {
            var cell = row.querySelector('td[data-code="' + s.code + '"]');
            if (!cell) return;
            cell.textContent = s.score.toFixed(2);
            cell.className = s.score >= 0.5 ? 'cell-yes' : 'cell-no';
          });
          btn.textContent = '再投入';
          btn.className = 'btn-reseed';
        })
        .catch(function() {
          btn.disabled = false;
          status.className = 'row-status error';
          status.textContent = '通信エラー';
        });
    }
  </script>
</body>
</html>`;
}
