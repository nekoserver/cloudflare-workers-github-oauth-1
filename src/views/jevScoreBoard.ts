import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';
import type { JevScoreBoardShare } from '../utils/jevScoreBoard';

export type JevScoreBoardPageInput = {
  keyword: string;
  hitCount: number;
  rows: JevScoreBoardShare[];
};

const LABEL_IDS = Array.from({ length: 20 }, (_, i) => i + 1);

function renderScoreCell(value: number | null): string {
  return value === null ? '<span class="score-empty">-</span>' : escapeHtml(String(value));
}

/**
 * /jev-score-board ページ本体を描画する。質問ID(share)1件=1行、
 * jev_label_id=1〜20(ループA)を横列(L1〜L20)に並べる。/neko jスラッシュ
 * コマンドとは独立したページとして実装しており、そちらのコードは参照しない。
 */
export function renderJevScoreBoardPage(input: JevScoreBoardPageInput): string {
  const { keyword, hitCount, rows } = input;
  const labelHeaderCells = LABEL_IDS.map(
    (id) => `<th class="col-label sortable-th" data-label-id="${id}" title="タップでラベル${id}のスコア上位20件を表示">L${id}</th>`
  ).join('\n');

  const bodyRows = rows.length === 0
    ? `<tr><td colspan="${3 + LABEL_IDS.length}" class="empty-cell">${hitCount === 0 ? '該当データがありません' : '読み込み中...'}</td></tr>`
    : rows.map((r) => {
        const valueByLabelId = new Map(r.values.map((v) => [v.jevLabelId, v.value]));
        const scoreCells = LABEL_IDS.map((id) => `<td class="col-score">${renderScoreCell(valueByLabelId.get(id) ?? null)}</td>`).join('\n');
        return `<tr>
          <td class="col-share-id"><a href="#" class="share-id-link" data-share-id="${escapeHtml(r.shareId)}">${escapeHtml(r.shareId)}</a></td>
          <td class="col-question">${escapeHtml(r.question)}</td>
          <td class="col-model">${escapeHtml(r.model ?? '(不明)')}</td>
          ${scoreCells}
        </tr>`;
      }).join('\n');

  const limitNote = hitCount > rows.length
    ? `<p class="limit-note">先頭${rows.length}件のみ表示。全${hitCount}件</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Jevスコアボード</title>
${getThemeInitScript()}
<style>
  ${getThemeCSS()}
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: var(--bg-primary);
    color: var(--text-primary);
  }
  #topbar {
    position: sticky; top: 0; z-index: 10;
    height: 44px;
    background: var(--navbar-bg);
    border-bottom: 1px solid var(--border-color);
    display: flex; align-items: center; gap: 8px;
    padding: 0 12px;
  }
  #topbar h1 { font-size: 14px; margin: 0; flex-shrink: 0; }
  #topbar .theme-toggle { width: 30px; height: 30px; }
  #topbar .theme-toggle svg { width: 15px; height: 15px; }
  main { padding: 16px; max-width: 100%; overflow-x: auto; }
  .search-bar { display: flex; gap: 8px; margin-bottom: 12px; max-width: 480px; }
  .search-bar input[type="text"] {
    flex: 1;
    background: var(--input-bg);
    color: var(--text-primary);
    border: 1px solid var(--input-border);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 13px;
  }
  .search-bar button {
    background: var(--accent-color);
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 13px;
    cursor: pointer;
  }
  .search-bar button:hover { background: var(--accent-hover); }
  table { border-collapse: collapse; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; font-size: 12px; }
  th { background: var(--bg-secondary); color: var(--text-muted); text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--border-color); white-space: nowrap; }
  td { padding: 6px 10px; border-bottom: 1px solid var(--border-color); color: var(--text-primary); white-space: nowrap; }
  .col-question { white-space: normal; max-width: 320px; }
  th.sortable-th { cursor: pointer; user-select: none; }
  th.sortable-th:hover { color: var(--accent-color); }
  .score-empty { color: var(--text-faint); }
  .empty-cell { text-align: center; color: var(--text-muted); padding: 32px; white-space: normal; }
  .limit-note { color: var(--text-muted); font-size: 12px; }
  .share-id-link { color: var(--accent-color); text-decoration: none; cursor: pointer; }
  .share-id-link:hover { text-decoration: underline; }
  .modal-backdrop {
    display: none;
    position: fixed; inset: 0;
    background: var(--modal-overlay);
    align-items: flex-start; justify-content: center;
    padding-top: 60px;
  }
  .modal-backdrop.open { display: flex; }
  .modal-box {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 16px;
    max-width: 640px;
    width: 92%;
    max-height: 80vh;
    overflow-y: auto;
  }
  .modal-box h2 { font-size: 14px; margin: 0 0 8px; color: var(--text-primary); }
  .modal-close { float: right; cursor: pointer; color: var(--text-muted); background: none; border: none; font-size: 16px; }
  .qa-block { margin-bottom: 12px; }
  .qa-label { font-size: 11px; color: var(--text-muted); margin-bottom: 4px; }
  .qa-body { white-space: pre-wrap; word-break: break-word; color: var(--text-primary); background: var(--bg-secondary); border-radius: 6px; padding: 8px; }
  .top-row { padding: 6px 0; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; gap: 8px; }
  .top-row .top-value { color: var(--text-muted); font-variant-numeric: tabular-nums; flex-shrink: 0; }
  ${getThemeToggleCSS()}
</style>
</head>
<body>
  <div id="topbar">
    <h1>Jevスコアボード</h1>
    ${getThemeToggleHTML()}
  </div>
  <main>
    <div class="search-bar">
      <input type="text" id="keywordInput" placeholder="検索キーワード(質問文・回答文)" value="${escapeHtml(keyword)}">
      <button id="searchBtn">検索</button>
    </div>
    <div id="hitCountLabel" style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">${hitCount}件</div>
    <table id="boardTable">
      <thead>
        <tr>
          <th>質問ID</th>
          <th>質問文</th>
          <th>モデル</th>
          ${labelHeaderCells}
        </tr>
      </thead>
      <tbody id="boardTableBody">
        ${bodyRows}
      </tbody>
    </table>
    <div id="limitNoteContainer">${limitNote}</div>
  </main>

  <div class="modal-backdrop" id="answerModalBackdrop" data-overlay>
    <div class="modal-box">
      <button class="modal-close" id="answerModalClose">&times;</button>
      <h2>質問・回答詳細</h2>
      <div class="qa-block">
        <div class="qa-label">質問文</div>
        <div class="qa-body" id="answerModalQuestion"></div>
      </div>
      <div class="qa-block">
        <div class="qa-label">回答文</div>
        <div class="qa-body" id="answerModalAnswer"></div>
      </div>
    </div>
  </div>

  <div class="modal-backdrop" id="topModalBackdrop" data-overlay>
    <div class="modal-box">
      <button class="modal-close" id="topModalClose">&times;</button>
      <h2 id="topModalTitle">上位20件</h2>
      <div id="topModalBody"></div>
    </div>
  </div>

<script>
function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function getNextZ() {
  var max = 700;
  document.querySelectorAll('[data-overlay]').forEach(function(el) {
    var z = parseInt(el.style.zIndex, 10) || 0;
    if (z > max && z < 9000) max = z;
  });
  return max + 100;
}

var LABEL_IDS = ${JSON.stringify(LABEL_IDS)};

function renderRows(hitCount, rows) {
  document.getElementById('hitCountLabel').textContent = hitCount + '件';
  var tbody = document.getElementById('boardTableBody');
  if (!rows || rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="' + (3 + LABEL_IDS.length) + '" class="empty-cell">' + (hitCount === 0 ? '該当データがありません' : '読み込み中...') + '</td></tr>';
  } else {
    tbody.innerHTML = rows.map(function(r) {
      var valueByLabelId = {};
      (r.values || []).forEach(function(v) { valueByLabelId[v.jevLabelId] = v.value; });
      var scoreCells = LABEL_IDS.map(function(id) {
        var v = valueByLabelId[id];
        return '<td class="col-score">' + (v === null || v === undefined ? '<span class="score-empty">-</span>' : escHtml(String(v))) + '</td>';
      }).join('');
      return '<tr>' +
        '<td class="col-share-id"><a href="#" class="share-id-link" data-share-id="' + escHtml(r.shareId) + '">' + escHtml(r.shareId) + '</a></td>' +
        '<td class="col-question">' + escHtml(r.question) + '</td>' +
        '<td class="col-model">' + escHtml(r.model || '(不明)') + '</td>' +
        scoreCells +
        '</tr>';
    }).join('');
  }
  var limitNoteContainer = document.getElementById('limitNoteContainer');
  limitNoteContainer.innerHTML = hitCount > rows.length ? ('<p class="limit-note">先頭' + rows.length + '件のみ表示。全' + hitCount + '件</p>') : '';
  bindShareIdLinks();
}

function bindShareIdLinks() {
  document.querySelectorAll('.share-id-link').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.preventDefault();
      openAnswerModal(el.getAttribute('data-share-id'));
    });
  });
}

function runSearch() {
  var keyword = document.getElementById('keywordInput').value;
  fetch('/api/jev-score-board/rows?keyword=' + encodeURIComponent(keyword), { credentials: 'same-origin' })
    .then(function(r) { return r.json(); })
    .then(function(d) { renderRows(d.hitCount || 0, d.rows || []); })
    .catch(function() { renderRows(0, []); });
}

document.getElementById('searchBtn').addEventListener('click', runSearch);
document.getElementById('keywordInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') runSearch();
});

var answerModalBackdrop = document.getElementById('answerModalBackdrop');
var answerModalQuestion = document.getElementById('answerModalQuestion');
var answerModalAnswer = document.getElementById('answerModalAnswer');
function openAnswerModal(shareId) {
  answerModalQuestion.textContent = '読み込み中...';
  answerModalAnswer.textContent = '';
  answerModalBackdrop.style.zIndex = String(getNextZ());
  answerModalBackdrop.classList.add('open');
  fetch('/api/jev-score-board/answer?shareId=' + encodeURIComponent(shareId), { credentials: 'same-origin' })
    .then(function(r) {
      if (!r.ok) throw new Error('not found');
      return r.json();
    })
    .then(function(d) {
      answerModalQuestion.textContent = d.question || '';
      answerModalAnswer.textContent = d.answer || '';
    })
    .catch(function() {
      answerModalQuestion.textContent = '取得に失敗しました';
      answerModalAnswer.textContent = '';
    });
}
document.getElementById('answerModalClose').addEventListener('click', function() {
  answerModalBackdrop.classList.remove('open');
});
answerModalBackdrop.addEventListener('click', function(e) {
  if (e.target === answerModalBackdrop) answerModalBackdrop.classList.remove('open');
});

var topModalBackdrop = document.getElementById('topModalBackdrop');
var topModalTitle = document.getElementById('topModalTitle');
var topModalBody = document.getElementById('topModalBody');
function openTopModal(labelId) {
  topModalTitle.textContent = 'L' + labelId + ' スコア上位20件';
  topModalBody.innerHTML = '読み込み中...';
  topModalBackdrop.style.zIndex = String(getNextZ());
  topModalBackdrop.classList.add('open');
  fetch('/api/jev-score-board/top-by-label?labelId=' + encodeURIComponent(labelId), { credentials: 'same-origin' })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var rows = d.rows || [];
      if (rows.length === 0) {
        topModalBody.innerHTML = '<div class="empty-cell">データがありません</div>';
        return;
      }
      topModalBody.innerHTML = rows.map(function(r) {
        return '<div class="top-row">' +
          '<a href="#" class="share-id-link" data-share-id="' + escHtml(r.shareId) + '">' + escHtml(r.shareId) + ' - ' + escHtml(r.question) + '</a>' +
          '<span class="top-value">' + escHtml(String(r.value)) + '</span>' +
          '</div>';
      }).join('');
      bindShareIdLinks();
      document.querySelectorAll('#topModalBody .share-id-link').forEach(function(el) {
        el.addEventListener('click', function(e) {
          e.preventDefault();
          openAnswerModal(el.getAttribute('data-share-id'));
        });
      });
    })
    .catch(function() {
      topModalBody.innerHTML = '<div class="empty-cell">取得に失敗しました</div>';
    });
}
document.getElementById('topModalClose').addEventListener('click', function() {
  topModalBackdrop.classList.remove('open');
});
topModalBackdrop.addEventListener('click', function(e) {
  if (e.target === topModalBackdrop) topModalBackdrop.classList.remove('open');
});

document.querySelectorAll('th.sortable-th').forEach(function(th) {
  th.addEventListener('click', function() {
    openTopModal(th.getAttribute('data-label-id'));
  });
});

bindShareIdLinks();
${getThemeToggleScript()}
</script>
</body>
</html>`;
}
