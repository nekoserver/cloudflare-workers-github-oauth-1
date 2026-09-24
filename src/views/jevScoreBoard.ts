import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';
import { getMarkdownParserScript, getMarkdownPreviewCSS } from '../utils/markdownRenderer';
import { JEV_SCORE_BOARD_LIMIT, type JevScoreBoardShare } from '../utils/jevScoreBoard';

/** 通し番号をゼロ埋め3桁にする(1 -> "001")。質問IDそのものは表に出さない。 */
function padSerialNumber(n: number): string {
  return String(n).padStart(3, '0');
}

export type JevScoreBoardPageInput = {
  keyword: string;
  hitCount: number;
  rows: JevScoreBoardShare[];
  /** aichat_model_colors.model_id -> color。無いモデルは輪郭だけの丸で表示する。 */
  modelColors: Record<string, string>;
};

const LABEL_IDS = Array.from({ length: 20 }, (_, i) => i + 1);

function renderScoreCell(value: number | null): string {
  return value === null ? '<span class="score-empty">-</span>' : escapeHtml(String(value));
}

/**
 * モデル名の代わりに質問文の左に置く色丸。aichat_model_colors由来の色は
 * DBに保存された任意色でありCLAUDE.CSS.mdのテーマトークン対象外のため、
 * そのまま埋め込む(モデルごとに割り当てられる固定色という点でPK/FKバッジの
 * 固定色と同じ性質)。色が未割り当てのモデルはvar(--border-color)の
 * 輪郭だけの丸にする。
 */
function renderModelDot(model: string | null, modelColors: Record<string, string>): string {
  const color = model ? modelColors[model] : undefined;
  const title = escapeHtml(model ?? '(不明)');
  const style = color
    ? `background:${escapeHtml(color)};border-color:${escapeHtml(color)};`
    : 'background:transparent;border-color:var(--border-color);';
  return `<span class="model-dot" style="${style}" title="${title}"></span>`;
}

/**
 * /jev-score-board ページ本体を描画する。質問ID(share)1件=1行、
 * jev_label_id=1〜20(ループA)を横列(L1〜L20)に並べる。/neko jスラッシュ
 * コマンドとは独立したページとして実装しており、そちらのコードは参照しない。
 */
export function renderJevScoreBoardPage(input: JevScoreBoardPageInput): string {
  const { keyword, hitCount, rows, modelColors } = input;
  const labelHeaderCells = LABEL_IDS.map(
    (id) => `<th class="col-label sortable-th" data-label-id="${id}" title="タップでラベル${id}のスコア上位${JEV_SCORE_BOARD_LIMIT}件を表示">L${id}</th>`
  ).join('\n');

  const bodyRows = rows.length === 0
    ? `<tr><td colspan="${2 + LABEL_IDS.length}" class="empty-cell">${hitCount === 0 ? '該当データがありません' : '読み込み中...'}</td></tr>`
    : rows.map((r, i) => {
        const valueByLabelId = new Map(r.values.map((v) => [v.jevLabelId, v.value]));
        const scoreCells = LABEL_IDS.map((id) => `<td class="col-score">${renderScoreCell(valueByLabelId.get(id) ?? null)}</td>`).join('\n');
        return `<tr>
          <td class="col-no">${padSerialNumber(i + 1)}</td>
          <td class="col-question">${renderModelDot(r.model, modelColors)}<a href="#" class="question-link" data-share-id="${escapeHtml(r.shareId)}">${escapeHtml(r.question)}</a></td>
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
  #topbar .theme-toggle { width: 30px; height: 30px; margin-left: auto; }
  #topbar .theme-toggle svg { width: 15px; height: 15px; }
  main { padding: 16px; max-width: 100%; overflow-x: auto; }
  .search-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; max-width: 560px; }
  .live-pulse { margin-bottom: 12px; padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--card-bg); max-width: 900px; }
  .live-pulse-head { display: flex; align-items: center; gap: 7px; color: var(--text-muted); font-size: 12px; margin-bottom: 7px; }
  .live-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,.16); }
  .pulse-items { display: flex; flex-wrap: wrap; gap: 7px; }
  .pulse-chip { font-size: 12px; padding: 5px 8px; border-radius: 999px; background: var(--bg-secondary); }
  .pulse-up { color: #16a34a; } .pulse-down { color: #dc2626; } .pulse-new { color: var(--text-muted); }
  .th-mode-toggle { display: flex; border: 1px solid var(--input-border); border-radius: 6px; overflow: hidden; flex-shrink: 0; }
  .th-mode-btn {
    background: var(--input-bg);
    color: var(--text-muted);
    border: none;
    padding: 6px 10px;
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
  }
  .th-mode-btn + .th-mode-btn { border-left: 1px solid var(--input-border); }
  .th-mode-btn.active { background: var(--accent-color); color: #fff; }
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
  .col-no { color: var(--text-muted); font-variant-numeric: tabular-nums; text-align: right; }
  .col-question { white-space: normal; max-width: 320px; }
  .model-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; border: 1px solid; margin-right: 6px; vertical-align: middle; }
  .top-row .model-dot { margin-right: 8px; }
  .top-label-text { color: var(--text-secondary); font-size: 12px; margin-bottom: 10px; }
  th.sortable-th { cursor: pointer; user-select: none; }
  th.sortable-th:hover { color: var(--accent-color); }
  .score-empty { color: var(--text-faint); }
  .empty-cell { text-align: center; color: var(--text-muted); padding: 32px; white-space: normal; }
  .limit-note { color: var(--text-muted); font-size: 12px; }
  .question-link { color: var(--accent-color); text-decoration: none; cursor: pointer; }
  .question-link:hover { text-decoration: underline; }
  .modal-backdrop {
    display: none;
    position: fixed; inset: 0;
    background: var(--modal-overlay);
  }
  .modal-backdrop.open { display: block; }
  .modal-box {
    position: fixed;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    width: min(92vw, 640px);
    min-width: min(300px, calc(100vw - 16px));
    min-height: 180px;
    max-width: calc(100vw - 16px);
    max-height: calc(100vh - 16px);
    overflow: hidden;
    box-shadow: 0 18px 48px rgba(0, 0, 0, .28);
  }
  .modal-titlebar {
    min-height: 44px;
    padding: 12px 14px;
    display: flex; align-items: center; justify-content: space-between;
    cursor: move; cursor: grab; user-select: none; touch-action: none;
    border-bottom: 1px solid var(--border-color);
  }
  .modal-titlebar:active { cursor: grabbing; }
  .modal-box h2 { font-size: 14px; margin: 0; color: var(--text-primary); }
  .modal-close { cursor: pointer; color: var(--text-muted); background: none; border: none; font-size: 20px; line-height: 1; padding: 2px 5px; }
  .modal-content { height: calc(100% - 44px); overflow: auto; padding: 14px; }
  .modal-resize-handle {
    position: absolute; width: 60px; height: 60px; z-index: 2;
    border-radius: 50%; touch-action: none;
  }
  .modal-resize-handle[data-dir="nw"] { left: -30px; top: -30px; cursor: nwse-resize; }
  .modal-resize-handle[data-dir="ne"] { right: -30px; top: -30px; cursor: nesw-resize; }
  .modal-resize-handle[data-dir="sw"] { left: -30px; bottom: -30px; cursor: nesw-resize; }
  .modal-resize-handle[data-dir="se"] { right: -30px; bottom: -30px; cursor: nwse-resize; }
  .qa-block { margin-bottom: 12px; }
  .qa-label { font-size: 11px; color: var(--text-muted); margin-bottom: 4px; }
  .qa-body { word-break: break-word; color: var(--text-primary); background: var(--bg-secondary); border-radius: 6px; padding: 8px; }
  .top-row { padding: 6px 0; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; gap: 8px; }
  .top-row .top-value { color: var(--text-muted); font-variant-numeric: tabular-nums; flex-shrink: 0; }
  ${getThemeToggleCSS()}
  ${getMarkdownPreviewCSS()}
  .qa-body.preview-area { word-break: break-word; }
</style>
</head>
<body>
  <div id="topbar">
    <h1>Jevスコアボード</h1>
    ${getThemeToggleHTML()}
  </div>
  <main>
    <section class="live-pulse" aria-live="polite">
      <div class="live-pulse-head"><span class="live-dot"></span><strong>Jev Live Pulse</strong><span id="pulseUpdated">接続中...</span></div>
      <div id="pulseItems" class="pulse-items">直近1時間の評価を集計しています</div>
    </section>
    <div class="search-bar">
      <input type="text" id="keywordInput" placeholder="検索キーワード(質問文・回答文)" value="${escapeHtml(keyword)}">
      <button id="searchBtn">検索</button>
      <div class="th-mode-toggle" role="group" aria-label="ラベル列見出しの表記切替">
        <button type="button" id="thModeCurrent" class="th-mode-btn active">現行</button>
        <button type="button" id="thModeJapanese" class="th-mode-btn">日本語</button>
      </div>
    </div>
    <div id="hitCountLabel" style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">${hitCount}件</div>
    <table id="boardTable">
      <thead>
        <tr>
          <th>No.</th>
          <th>質問文</th>
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
      <div class="modal-titlebar"><h2>質問・回答詳細</h2><button class="modal-close" id="answerModalClose" aria-label="閉じる">&times;</button></div>
      <div class="modal-content">
        <div class="qa-block">
          <div class="qa-label">質問文</div>
          <div class="qa-body preview-area" id="answerModalQuestion"></div>
        </div>
        <div class="qa-block">
          <div class="qa-label">回答文</div>
          <div class="qa-body preview-area" id="answerModalAnswer"></div>
        </div>
      </div>
      <span class="modal-resize-handle" data-dir="nw"></span><span class="modal-resize-handle" data-dir="ne"></span>
      <span class="modal-resize-handle" data-dir="sw"></span><span class="modal-resize-handle" data-dir="se"></span>
    </div>
  </div>

  <div class="modal-backdrop" id="topModalBackdrop" data-overlay>
    <div class="modal-box">
      <div class="modal-titlebar"><h2 id="topModalTitle">上位20件</h2><button class="modal-close" id="topModalClose" aria-label="閉じる">&times;</button></div>
      <div class="modal-content"><div id="topModalLabelText" class="top-label-text"></div><div id="topModalBody"></div></div>
      <span class="modal-resize-handle" data-dir="nw"></span><span class="modal-resize-handle" data-dir="ne"></span>
      <span class="modal-resize-handle" data-dir="sw"></span><span class="modal-resize-handle" data-dir="se"></span>
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

// 表の横幅を基準に初期サイズを決め、タイトルバー移動と四隅30px範囲の
// Pointer Eventsによるリサイズを各モーダルへ追加する。
function prepareModal(backdrop) {
  var box = backdrop.querySelector('.modal-box');
  var maxWidth = Math.max(300, window.innerWidth - 16);
  var tableWidth = document.getElementById('boardTable').scrollWidth;
  var width = Math.min(maxWidth, Math.max(300, tableWidth));
  box.style.width = width + 'px';
  box.style.height = Math.min(Math.max(240, box.scrollHeight), window.innerHeight - 16) + 'px';
  box.style.left = Math.max(8, (window.innerWidth - width) / 2) + 'px';
  box.style.top = Math.max(8, Math.min(60, window.innerHeight - box.offsetHeight - 8)) + 'px';
}

function makeModalInteractive(backdrop) {
  var box = backdrop.querySelector('.modal-box');
  var titlebar = box.querySelector('.modal-titlebar');
  var action = null;

  function start(e, mode, dir) {
    if (e.button !== undefined && e.button !== 0) return;
    if (mode === 'move' && e.target.closest('.modal-close')) return;
    var rect = box.getBoundingClientRect();
    action = { mode: mode, dir: dir || '', x: e.clientX, y: e.clientY,
      left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  titlebar.addEventListener('pointerdown', function(e) { start(e, 'move', ''); });
  box.querySelectorAll('.modal-resize-handle').forEach(function(handle) {
    handle.addEventListener('pointerdown', function(e) { start(e, 'resize', handle.getAttribute('data-dir')); });
  });

  box.addEventListener('pointermove', function(e) {
    if (!action) return;
    var dx = e.clientX - action.x;
    var dy = e.clientY - action.y;
    if (action.mode === 'move') {
      box.style.left = Math.min(window.innerWidth - 40, Math.max(40 - action.width, action.left + dx)) + 'px';
      box.style.top = Math.min(window.innerHeight - 40, Math.max(0, action.top + dy)) + 'px';
      return;
    }
    var left = action.left, top = action.top, width = action.width, height = action.height;
    if (action.dir.indexOf('e') !== -1) width += dx;
    if (action.dir.indexOf('s') !== -1) height += dy;
    if (action.dir.indexOf('w') !== -1) { width -= dx; left += dx; }
    if (action.dir.indexOf('n') !== -1) { height -= dy; top += dy; }
    var minWidth = Math.min(300, window.innerWidth - 16), minHeight = 180;
    if (width < minWidth) { if (action.dir.indexOf('w') !== -1) left -= minWidth - width; width = minWidth; }
    if (height < minHeight) { if (action.dir.indexOf('n') !== -1) top -= minHeight - height; height = minHeight; }
    width = Math.min(width, window.innerWidth - 16);
    height = Math.min(height, window.innerHeight - 16);
    left = Math.min(window.innerWidth - width - 8, Math.max(8, left));
    top = Math.min(window.innerHeight - height - 8, Math.max(8, top));
    box.style.left = left + 'px'; box.style.top = top + 'px';
    box.style.width = width + 'px'; box.style.height = height + 'px';
  });
  box.addEventListener('pointerup', function() { action = null; });
  box.addEventListener('pointercancel', function() { action = null; });
}

// ===== Markdownパーサー(モーダル内の質問文・回答文をMarkdownとして描画する) =====
${getMarkdownParserScript()}

function padSerialNumber(n) {
  return String(n).padStart(3, '0');
}

var LABEL_IDS = ${JSON.stringify(LABEL_IDS)};
var MODEL_COLORS = ${JSON.stringify(input.modelColors)};
var LABEL_TOP_LIMIT = ${JEV_SCORE_BOARD_LIMIT};

function modelDotHtml(model) {
  var color = model ? MODEL_COLORS[model] : undefined;
  var title = escHtml(model || '(不明)');
  var style = color
    ? 'background:' + escHtml(color) + ';border-color:' + escHtml(color) + ';'
    : 'background:transparent;border-color:var(--border-color);';
  return '<span class="model-dot" style="' + style + '" title="' + title + '"></span>';
}

function renderRows(hitCount, rows) {
  document.getElementById('hitCountLabel').textContent = hitCount + '件';
  var tbody = document.getElementById('boardTableBody');
  if (!rows || rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="' + (2 + LABEL_IDS.length) + '" class="empty-cell">' + (hitCount === 0 ? '該当データがありません' : '読み込み中...') + '</td></tr>';
  } else {
    tbody.innerHTML = rows.map(function(r, i) {
      var valueByLabelId = {};
      (r.values || []).forEach(function(v) { valueByLabelId[v.jevLabelId] = v.value; });
      var scoreCells = LABEL_IDS.map(function(id) {
        var v = valueByLabelId[id];
        return '<td class="col-score">' + (v === null || v === undefined ? '<span class="score-empty">-</span>' : escHtml(String(v))) + '</td>';
      }).join('');
      return '<tr>' +
        '<td class="col-no">' + padSerialNumber(i + 1) + '</td>' +
        '<td class="col-question">' + modelDotHtml(r.model) + '<a href="#" class="question-link" data-share-id="' + escHtml(r.shareId) + '">' + escHtml(r.question) + '</a></td>' +
        scoreCells +
        '</tr>';
    }).join('');
  }
  var limitNoteContainer = document.getElementById('limitNoteContainer');
  limitNoteContainer.innerHTML = hitCount > rows.length ? ('<p class="limit-note">先頭' + rows.length + '件のみ表示。全' + hitCount + '件</p>') : '';
  bindQuestionLinks();
}

function bindQuestionLinks() {
  document.querySelectorAll('.question-link').forEach(function(el) {
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

function refreshLivePulse() {
  fetch('/api/jev-score-board/live-pulse', { credentials: 'same-origin' })
    .then(function(r) { if (!r.ok) throw new Error('pulse'); return r.json(); })
    .then(function(d) {
      document.getElementById('pulseUpdated').textContent = '直近1時間 / ' + new Date(d.generatedAt).toLocaleTimeString() + '更新';
      var items = d.items || [];
      document.getElementById('pulseItems').innerHTML = items.length ? items.map(function(item) {
        var deltaText = item.delta === null ? 'NEW' : ((item.delta >= 0 ? '+' : '') + item.delta.toFixed(2));
        var deltaClass = item.delta === null ? 'pulse-new' : (item.delta >= 0 ? 'pulse-up' : 'pulse-down');
        return '<span class="pulse-chip">' + escHtml(item.label) + ' <b>' + item.average.toFixed(2) + '</b> <span class="' + deltaClass + '">' + deltaText + '</span> · ' + item.sampleCount + '件</span>';
      }).join('') : '<span class="pulse-new">直近1時間の評価はまだありません</span>';
    })
    .catch(function() { document.getElementById('pulseUpdated').textContent = '再接続待ち'; });
}

refreshLivePulse();
setInterval(refreshLivePulse, 10000);

document.getElementById('searchBtn').addEventListener('click', runSearch);
document.getElementById('keywordInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') runSearch();
});

var answerModalBackdrop = document.getElementById('answerModalBackdrop');
makeModalInteractive(answerModalBackdrop);
var answerModalQuestion = document.getElementById('answerModalQuestion');
var answerModalAnswer = document.getElementById('answerModalAnswer');
function openAnswerModal(shareId) {
  answerModalQuestion.innerHTML = '読み込み中...';
  answerModalAnswer.innerHTML = '';
  answerModalBackdrop.style.zIndex = String(getNextZ());
  answerModalBackdrop.classList.add('open');
  prepareModal(answerModalBackdrop);
  fetch('/api/jev-score-board/answer?shareId=' + encodeURIComponent(shareId), { credentials: 'same-origin' })
    .then(function(r) {
      if (!r.ok) throw new Error('not found');
      return r.json();
    })
    .then(function(d) {
      answerModalQuestion.innerHTML = parseMd(d.question || '');
      answerModalAnswer.innerHTML = parseMd(d.answer || '');
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
makeModalInteractive(topModalBackdrop);
var topModalTitle = document.getElementById('topModalTitle');
var topModalLabelText = document.getElementById('topModalLabelText');
var topModalBody = document.getElementById('topModalBody');
function openTopModal(labelId) {
  topModalTitle.textContent = 'L' + labelId + ' スコア上位' + LABEL_TOP_LIMIT + '件';
  topModalLabelText.textContent = '';
  topModalBody.innerHTML = '読み込み中...';
  topModalBackdrop.style.zIndex = String(getNextZ());
  topModalBackdrop.classList.add('open');
  prepareModal(topModalBackdrop);
  fetch('/api/jev-score-board/top-by-label?labelId=' + encodeURIComponent(labelId), { credentials: 'same-origin' })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      topModalLabelText.textContent = d.labelText ? ('このラベルの内容: ' + d.labelText) : 'このラベルの内容: (未登録)';
      var rows = d.rows || [];
      if (rows.length === 0) {
        topModalBody.innerHTML = '<div class="empty-cell">データがありません</div>';
        return;
      }
      topModalBody.innerHTML = rows.map(function(r) {
        return '<div class="top-row">' +
          '<a href="#" class="question-link" data-share-id="' + escHtml(r.shareId) + '">' + modelDotHtml(r.model) + escHtml(r.question) + '</a>' +
          '<span class="top-value">' + escHtml(String(r.value)) + '</span>' +
          '</div>';
      }).join('');
      document.querySelectorAll('#topModalBody .question-link').forEach(function(el) {
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

// ===== th見出しの表記切替(現行のL1〜L20 / 日本語ラベル名) =====
// 日本語ラベル名は初回切替時だけ取得し、以降は配列(オブジェクト)への
// キャッシュ参照で賄う(切替のたびに再フェッチしない)。
// トグル状態はCookieに保存し、ページを再訪した際も直前の選択を維持する。
// Cookie未設定時のデフォルトは「日本語」。
var TH_MODE_COOKIE = 'jev_score_board_th_mode';

function readThModeCookie() {
  var m = document.cookie.match(new RegExp('(?:^|; )' + TH_MODE_COOKIE + '=([^;]*)'));
  if (!m) return null;
  var v = decodeURIComponent(m[1]);
  return (v === 'current' || v === 'japanese') ? v : null;
}

function writeThModeCookie(mode) {
  document.cookie = TH_MODE_COOKIE + '=' + encodeURIComponent(mode) + '; path=/; max-age=' + (60 * 60 * 24 * 365) + '; SameSite=Lax';
}

var thMode = 'current';
var labelNameCache = null;
var thModeCurrentBtn = document.getElementById('thModeCurrent');
var thModeJapaneseBtn = document.getElementById('thModeJapanese');

function applyThMode() {
  document.querySelectorAll('th.sortable-th').forEach(function(th) {
    var id = th.getAttribute('data-label-id');
    if (thMode === 'japanese' && labelNameCache && labelNameCache[id]) {
      th.textContent = labelNameCache[id];
    } else {
      th.textContent = 'L' + id;
    }
  });
}

function setThMode(mode) {
  thMode = mode;
  writeThModeCookie(mode);
  thModeCurrentBtn.classList.toggle('active', mode === 'current');
  thModeJapaneseBtn.classList.toggle('active', mode === 'japanese');
  if (mode === 'japanese' && !labelNameCache) {
    applyThMode();
    fetch('/api/jev-score-board/label-names', { credentials: 'same-origin' })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        labelNameCache = d.labels || {};
        applyThMode();
      })
      .catch(function() {
        labelNameCache = {};
      });
  } else {
    applyThMode();
  }
}

thModeCurrentBtn.addEventListener('click', function() { setThMode('current'); });
thModeJapaneseBtn.addEventListener('click', function() { setThMode('japanese'); });
setThMode(readThModeCookie() || 'japanese');

bindQuestionLinks();
${getThemeToggleScript()}
</script>
</body>
</html>`;
}
