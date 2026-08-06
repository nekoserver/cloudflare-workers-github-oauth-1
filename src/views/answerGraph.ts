import { getMarkdownParserScript } from '../utils/markdownRenderer';

function escAG(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function getAnswerGraphPage(username: string, modelColors: Record<string, string> = {}): string {
  const safeUser = escAG(username);
  const modelColorsJson = JSON.stringify(modelColors);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>回答伝播グラフ</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { background:var(--bg,#0d1117); color:var(--fg,#e6edf3); font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:14px; min-height:100vh; display:flex; flex-direction:column; }
@media (prefers-color-scheme:light) { :root { --bg:#f6f8fa; --fg:#24292f; --card:#fff; --border:#d0d7de; --label:#57606a; --btn-bg:#f3f4f6; --btn-border:#d0d7de; --btn-hover:#e9ecef; --accent:#0969da; --accent-fg:#fff; --answer-color:#0969da; --keyword-color:#c2410c; --danger:#cf222e; --fp-focus-bg:#d1f5d3; --fp-focus-border:#2f9e52; --fp-focus-fg:#0b3d17; } }
@media (prefers-color-scheme:dark) { :root { --bg:#0d1117; --fg:#e6edf3; --card:#161b22; --border:#30363d; --label:#8b949e; --btn-bg:#21262d; --btn-border:#30363d; --btn-hover:#30363d; --accent:#1f6feb; --accent-fg:#fff; --answer-color:#63b3ed; --keyword-color:#f6ad55; --danger:#f85149; --fp-focus-bg:#1c4c2e; --fp-focus-border:#4caf6a; --fp-focus-fg:#86efac; } }
.topbar { background:var(--card); border-bottom:1px solid var(--border); padding:10px 20px; display:flex; align-items:center; gap:12px; flex-shrink:0; }
.topbar h1 { font-size:16px; font-weight:700; flex:1; }
.topbar a { color:var(--accent); text-decoration:none; font-size:12px; }
.topbar a:hover { text-decoration:underline; }
.user-badge { font-size:11px; background:rgba(31,111,235,.15); color:var(--accent); border-radius:12px; padding:2px 10px; }
main { flex:1; max-width:1100px; width:100%; margin:0 auto; padding:24px 16px; display:flex; flex-direction:column; gap:16px; }
.card { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:18px 20px; }
.card-title { font-size:13px; font-weight:600; color:var(--label); margin-bottom:14px; text-transform:uppercase; letter-spacing:.04em; }
.card-title-row { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:14px; }
.card-title-row .card-title { margin-bottom:0; }
.mode-toggle-btn { background:var(--btn-bg); border:1px solid var(--btn-border); color:var(--fg); border-radius:6px; padding:6px 12px; font-size:12px; cursor:pointer; white-space:nowrap; }
.mode-toggle-btn:hover { background:var(--btn-hover); }
.mode-toggle-btn.active { background:var(--accent); color:var(--accent-fg); border-color:var(--accent); }
.fp-view { width:100%; display:flex; flex-direction:column; gap:8px; user-select:none; }
.fp-here { font-size:12px; color:var(--label); }
.fp-here strong { color:var(--fg); cursor:pointer; text-decoration:none; }
.fp-here strong:hover { color:var(--accent); }
.fp-sky {
  position:relative; width:100%; aspect-ratio:21/9; border-radius:10px; overflow:hidden;
  background:linear-gradient(to bottom, var(--btn-bg) 0%, var(--btn-bg) 37%, var(--border) 37%, var(--border) 39%, var(--card) 39%, var(--card) 100%);
  touch-action:pan-y; cursor:grab;
}
.fp-sky:active { cursor:grabbing; }
.fp-horizon { position:absolute; left:0; right:0; top:38%; height:1px; background:var(--label); opacity:.5; }
.fp-crosshair {
  position:absolute; left:50%; top:38%; width:22px; height:22px; margin:-11px 0 0 -11px;
  border:1.5px solid var(--label); border-radius:50%; opacity:.55; pointer-events:none;
}
.fp-crosshair::before, .fp-crosshair::after { content:''; position:absolute; background:var(--label); opacity:.55; }
.fp-crosshair::before { left:50%; top:-5px; width:1px; height:6px; margin-left:-.5px; }
.fp-crosshair::after { left:-5px; top:50%; width:6px; height:1px; margin-top:-.5px; }
.fp-filmstrip {
  position:absolute; left:0; right:0; top:0; height:38px; z-index:20; overflow:hidden;
  background:linear-gradient(to bottom, rgba(0,0,0,.18), rgba(0,0,0,0));
}
.fp-film-chip {
  position:absolute; top:50%; transform:translate(-50%,-50%);
  font-size:11px; padding:4px 10px; border-radius:6px; border:1.5px solid var(--label);
  background:transparent; color:var(--fg); white-space:nowrap; cursor:pointer;
  transition:left .18s ease;
}
.fp-film-chip:hover { filter:brightness(1.15); }
.fp-film-chip.fp-film-chip-focused { background:color-mix(in srgb, var(--fp-film-color, var(--label)) 25%, transparent); border-width:2px; font-weight:600; }
.fp-nodes { position:absolute; inset:0; }
.fp-node {
  position:absolute; transform:translate(-50%,-50%); display:flex; flex-direction:column; align-items:center;
  gap:3px; cursor:pointer; transition:left .12s linear, top .12s linear;
}
.fp-node-dot { width:16px; height:16px; border-radius:50%; box-shadow:0 0 0 2px var(--card); }
.fp-node-label {
  font-size:11px; padding:2px 7px; border-radius:10px; background:var(--card); border:1px solid var(--border);
  color:var(--fg); white-space:nowrap; max-width:140px; overflow:hidden; text-overflow:ellipsis;
}
.fp-node.fp-node-centered .fp-node-label { border-color:var(--accent); color:var(--accent); font-weight:600; }
.fp-answer-list { display:flex; flex-direction:column; gap:4px; max-height:160px; overflow-y:auto; padding:2px; }
.fp-answer-row { display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:6px; cursor:pointer; font-size:12px; color:var(--fg); }
.fp-answer-row:hover { background:var(--btn-hover); }
.fp-answer-row-dot { width:9px; height:9px; border-radius:50%; flex:0 0 auto; }
.fp-answer-row-label { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.fp-answer-list-empty { font-size:11px; color:var(--label); padding:4px 2px; }
.fp-controls { display:flex; align-items:center; justify-content:center; gap:16px; }
.fp-btn {
  width:52px; height:52px; border-radius:50%; border:1px solid var(--btn-border); background:var(--btn-bg);
  color:var(--fg); font-size:20px; cursor:pointer;
}
.fp-btn:hover { background:var(--btn-hover); }
.fp-btn-forward { background:var(--accent); color:var(--accent-fg); border-color:var(--accent); }
.fp-controls-vertical { display:flex; flex-direction:column; gap:8px; align-items:center; }
.fp-btn-backward { width:40px; height:40px; font-size:16px; }
.fp-hint { font-size:11px; color:var(--label); text-align:center; }
.cat-quick-nav { margin-bottom:10px; }
.cat-quick-groups { display:flex; flex-wrap:wrap; align-items:center; gap:10px 14px; margin-bottom:8px; }
.cat-quick-group-label {
  display:inline-flex; align-items:center; gap:5px; font-size:12px; cursor:pointer; color:var(--fg);
  white-space:nowrap; padding:4px 12px; border-radius:999px; border:2px solid var(--border); background:transparent;
}
.cat-quick-group-label.checked { background:color-mix(in srgb, var(--cat-quick-color, var(--border)) 15%, transparent); }
.cat-quick-group-label input[type=radio] { cursor:pointer; margin:0; accent-color:var(--cat-quick-color, var(--accent)); }
.cat-quick-cats { display:flex; flex-wrap:wrap; gap:8px; }
.cat-quick-cat-select { background:transparent; border:2px solid var(--btn-border); border-radius:6px; color:var(--fg); font-size:12px; padding:5px 8px; cursor:pointer; max-width:220px; }
.search-row { display:flex; gap:8px; margin-bottom:10px; }
input[type=search] { flex:1; background:var(--btn-bg); border:1px solid var(--btn-border); border-radius:6px; color:var(--fg); font-size:13px; padding:8px 12px; outline:none; }
input[type=search]:focus { border-color:var(--accent); }
.search-results-wrap { max-height:260px; overflow-y:auto; border:1px solid var(--border); border-radius:6px; }
.search-results-table { width:100%; border-collapse:collapse; font-size:12px; }
.search-results-table thead th {
  position:sticky; top:0; background:var(--btn-bg); color:var(--label); text-align:left;
  padding:6px 10px; border-bottom:1px solid var(--border); font-weight:600; white-space:nowrap;
}
.search-results-table th.sortable-th { cursor:pointer; user-select:none; }
.search-results-table th.sortable-th:hover { color:var(--fg); }
.search-results-table th:nth-child(1), .search-results-table th:nth-child(2) { width:1%; }
.search-results-table td { padding:6px 10px; border-bottom:1px solid var(--border); color:var(--fg); }
.search-results-table td.search-result-count { text-align:right; color:var(--label); white-space:nowrap; width:1%; padding:6px 6px; }
.search-results-table td.search-result-date { color:var(--label); white-space:nowrap; width:1%; padding:6px 6px; }
.search-results-table td.search-result-question { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:1px; }
.search-results-table tbody tr { cursor:pointer; }
.search-results-table tbody tr:hover { background:var(--btn-hover); }
.search-results-table tbody tr.selected { background:rgba(31,111,235,.1); }
.search-results-table tbody tr.zero-keyword-row { background:color-mix(in srgb, var(--danger) 15%, transparent); }
.search-results-table tbody tr.zero-keyword-row:hover { background:color-mix(in srgb, var(--danger) 25%, transparent); }
.seed-zero-tooltip {
  position:fixed; z-index:9999; max-width:260px; padding:8px 10px; border-radius:6px;
  background:var(--card); border:1px solid var(--danger); color:var(--fg); font-size:12px;
  line-height:1.5; box-shadow:0 4px 12px rgba(0,0,0,.2); pointer-events:none;
}
.search-status { font-size:11px; color:var(--label); }
.graph-layout { display:flex; flex-direction:column; gap:12px; }
.canvas-wrap { width:100%; overflow:auto; border:1px solid var(--border); border-radius:8px; background:var(--btn-bg); }
#graphCanvas { display:block; cursor:pointer; }
.side-panel { width:100%; border:1px solid var(--border); border-radius:8px; padding:12px 14px; font-size:12px; min-height:60px; }
.side-panel .empty-hint { color:var(--label); }
.legend { display:flex; width:100%; gap:14px; font-size:11px; color:var(--label); margin-bottom:14px; flex-wrap:wrap; }
.legend-dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:4px; vertical-align:middle; }
.node-type-label { font-size:11px; padding:2px 8px; border-radius:10px; display:inline-block; margin-bottom:6px; font-weight:600; }
.node-type-answer { background:rgba(9,105,218,.15); color:var(--answer-color); }
.node-type-keyword { background:rgba(194,65,12,.15); color:var(--keyword-color); }
.graph-status { font-size:12px; color:var(--label); margin-bottom:8px; }
.graph-status.err { color:var(--danger); }
.seed-loading-spinner {
  display:none; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:9999;
  width:44px; height:44px; border-radius:50%; border:4px solid var(--border); border-top-color:var(--accent);
  animation:seed-loading-spin .8s linear infinite; pointer-events:none;
}
.seed-loading-spinner.active { display:block; }
@keyframes seed-loading-spin { to { transform:translate(-50%,-50%) rotate(360deg); } }
.node-tooltip { position:absolute; z-index:500; max-width:260px; background:var(--card); border:1px solid var(--border); border-radius:8px; padding:10px 12px; font-size:12px; box-shadow:0 6px 20px rgba(0,0,0,.25); }
.node-tooltip .node-type-label { margin-bottom:4px; }
.question-line { cursor:pointer; text-decoration:none; }
.question-line:hover { color:var(--accent); }
.answer-modal-backdrop {
  position:fixed; inset:0; z-index:1000; display:none;
  align-items:center; justify-content:center; padding:28px 16px;
  background:rgba(15,23,42,.48); backdrop-filter:blur(4px);
}
.answer-modal-backdrop.open { display:flex; }
.answer-modal {
  width:min(720px,100%); max-height:min(86vh,760px);
  background:var(--bg); border:1px solid var(--border);
  border-radius:16px; box-shadow:0 24px 80px rgba(0,0,0,.28);
  display:flex; flex-direction:column; overflow:hidden;
}
.answer-modal-head {
  flex-shrink:0; display:flex; align-items:flex-start; justify-content:space-between; gap:8px;
  padding:10px 16px; background:var(--card); border-bottom:1px solid var(--border);
}
.answer-modal-head-left { display:flex; flex-direction:column; gap:3px; min-width:0; flex:1; }
.answer-modal-question-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.answer-modal-title { font-size:11px; font-weight:700; color:var(--label); text-transform:uppercase; letter-spacing:.03em; }
.answer-modal-date { font-size:11px; color:var(--label); }
.answer-modal-question { font-size:14px; font-weight:600; color:var(--fg); word-break:break-word; }
.answer-modal-head button {
  width:30px; height:30px; border:none; border-radius:8px; flex-shrink:0;
  background:transparent; color:var(--label); cursor:pointer; font-size:18px; line-height:1;
}
.answer-modal-head button:hover { background:var(--btn-hover); color:var(--fg); }
.answer-modal-body {
  flex:1; min-height:0; overflow-y:auto; padding:18px 18px 20px;
  display:flex; flex-direction:column; gap:14px;
}
.highlights-hidden .kw-highlight { background:transparent; color:inherit; }
.answer-modal-foot {
  flex-shrink:0; padding:9px 16px; border-top:1px solid var(--border);
  background:var(--card); display:flex; align-items:center; gap:12px;
  font-size:11px; color:var(--label); flex-wrap:wrap;
}
.answer-modal-highlight-btn { background:none; border:none; cursor:pointer; font-size:14px; padding:2px 4px; opacity:.2; }
.answer-modal-model-dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:4px; vertical-align:middle; }
.answer-modal-link { font-size:11px; color:var(--accent); text-decoration:none; white-space:nowrap; margin-left:auto; }
.answer-modal-link:hover { text-decoration:underline; }
.kw-highlight { background:#fef08a; color:#1a1a1a; border-radius:2px; padding:0 1px; }
.answer-modal-body .chat-bubble {
  max-width:88%; padding:10px 14px; border-radius:12px;
  font-size:14px; line-height:1.6; white-space:pre-wrap; word-break:break-word;
}
.answer-modal-body .chat-bubble.assistant {
  align-self:flex-end; background:var(--card); border:1px solid var(--border); color:var(--fg);
  border-bottom-left-radius:12px; border-bottom-right-radius:3px; white-space:normal;
}
/* ======= Markdownプレビュー(AIチャットページの履歴モーダルと同じスタイル) ======= */
.preview-area h1 { font-size:1.4em; font-weight:700; margin:12px 0 8px; padding-bottom:4px; border-bottom:1px solid var(--border); }
.preview-area h2 { font-size:1.2em; font-weight:600; margin:10px 0 6px; padding-bottom:3px; border-bottom:1px solid var(--border); }
.preview-area h3 { font-size:1.1em; font-weight:600; margin:8px 0 4px; }
.preview-area h4, .preview-area h5, .preview-area h6 { font-size:1em; font-weight:600; margin:6px 0 4px; }
.preview-area p { margin:0 0 10px; }
.preview-area ul, .preview-area ol { margin:0 0 10px; padding-left:1.5em; }
.preview-area li { margin:2px 0; }
.preview-area code { background:var(--btn-bg); padding:1px 5px; border-radius:3px; font-size:.88em; font-family:ui-monospace,monospace; }
.preview-area pre { background:var(--btn-bg); padding:10px 12px; border-radius:6px; overflow-x:auto; margin:0 0 10px; }
.preview-area pre code { background:none; padding:0; font-size:.85em; }
.preview-area blockquote { border-left:3px solid var(--border); margin:0 0 10px; padding:4px 0 4px 12px; color:var(--label); }
.preview-area table { border-collapse:collapse; width:100%; margin:0 0 10px; font-size:12px; }
.preview-area th, .preview-area td { border:1px solid var(--border); padding:4px 8px; }
.preview-area th { background:var(--btn-bg); font-weight:600; }
.preview-area hr { border:none; border-top:1px solid var(--border); margin:12px 0; }
.preview-area a { color:var(--accent); }
.preview-area img { max-width:100%; }
.preview-area input[type="checkbox"] { margin-right:4px; }
</style>
</head>
<body>
<div class="topbar">
  <h1>🕸️ 回答伝播グラフ</h1>
  <a href="/aichat">AIチャット</a>
  <a href="/welcome">ホーム</a>
  <span class="user-badge">${safeUser}</span>
</div>
<main>
  <div class="card">
    <div class="card-title">起点にする回答を検索</div>
    <div class="cat-quick-nav">
      <div class="cat-quick-groups" id="catQuickGroups"></div>
      <div class="cat-quick-cats" id="catQuickCats"></div>
    </div>
    <div class="search-row">
      <input type="search" id="seedSearchInput" placeholder="質問・回答のキーワードで検索..." autocomplete="off">
    </div>
    <div class="search-status" id="seedSearchStatus"></div>
    <div class="search-results-wrap">
      <table class="search-results-table">
        <thead>
          <tr>
            <th id="searchKeywordCountTh" class="sortable-th" tabindex="0" role="button" aria-label="キーワード総数で並べ替え" title="キーワード数">🔑</th>
            <th id="searchDateTh" class="sortable-th" tabindex="0" role="button" aria-label="質問日時で並べ替え">質問日時</th>
            <th>質問</th>
          </tr>
        </thead>
        <tbody id="seedSearchResults"></tbody>
      </table>
    </div>
  </div>

  <div class="card">
    <div class="card-title-row">
      <div class="card-title">どんな質問と回答が広がっていくか</div>
      <button type="button" class="mode-toggle-btn" id="fpToggleBtn">🧑‍🚶 一人称モード</button>
    </div>
    <div class="legend">
      <span><span class="legend-dot" style="background:var(--answer-color);"></span>回答（質問）</span>
      <span><span class="legend-dot" style="background:var(--keyword-color);"></span>キーワード</span>
      <span>中心 = 起点として選んだ回答。外側の輪ほど深い階層。</span>
    </div>
    <div class="legend" id="categoryLegend"></div>
    <div class="graph-status" id="graphStatus">起点を選ぶとここにグラフが表示されます</div>
    <div class="graph-layout">
      <div class="side-panel" id="sidePanel"><span class="empty-hint">ノードをクリックすると詳細がここに表示されます</span></div>
      <div class="canvas-wrap">
        <canvas id="graphCanvas" width="800" height="600"></canvas>
      </div>
      <div class="fp-view" id="fpView" style="display:none;">
        <div class="fp-here" id="fpHere"></div>
        <div class="fp-sky" id="fpSky">
          <div class="fp-filmstrip" id="fpFilmstrip"></div>
          <div class="fp-horizon"></div>
          <div class="fp-crosshair"></div>
          <div class="fp-nodes" id="fpNodes"></div>
        </div>
        <div class="fp-answer-list" id="fpAnswerList"></div>
        <div class="fp-controls">
          <button type="button" class="fp-btn" id="fpLeftBtn" aria-label="左を見る">←</button>
          <div class="fp-controls-vertical">
            <button type="button" class="fp-btn fp-btn-forward" id="fpForwardBtn" aria-label="選んだキーワードの先の回答へ進む">↑</button>
            <button type="button" class="fp-btn fp-btn-backward" id="fpBackwardBtn" aria-label="ひとつ前の回答へ戻る">↓</button>
          </div>
          <button type="button" class="fp-btn" id="fpRightBtn" aria-label="右を見る">→</button>
        </div>
        <div class="fp-hint">今立っている回答文に含まれるキーワードが目の前に並びます。左右にスワイプ、または ←→ ボタンでキーワードを選び、↑ でその先の回答へ、↓ でひとつ前の回答へ進みます</div>
      </div>
    </div>
  </div>
</main>
<div class="node-tooltip" id="nodeTooltip" style="display:none;"></div>
<div class="seed-loading-spinner" id="seedLoadingSpinner" role="status" aria-label="読み込み中"></div>
<div class="answer-modal-backdrop" id="answerModalBackdrop" aria-hidden="true">
  <div class="answer-modal" role="dialog" aria-modal="true" aria-labelledby="answerModalTitle">
    <div class="answer-modal-head">
      <div class="answer-modal-head-left">
        <div class="answer-modal-question-row">
          <span class="answer-modal-title" id="answerModalTitle">質問文</span>
          <span class="answer-modal-date"><span id="answerModalDate"></span><span id="answerModalTime"></span></span>
        </div>
        <div class="answer-modal-question" id="answerModalQuestion"></div>
      </div>
      <button type="button" id="answerModalClose" aria-label="閉じる">✕</button>
    </div>
    <div class="answer-modal-body" id="answerModalBody"></div>
    <div class="answer-modal-foot">
      <button type="button" class="answer-modal-highlight-btn" id="answerModalHighlightToggleBtn" title="キーワードハイライトなし">🔑</button>
      <span id="answerModalMeta"></span>
      <span id="answerModalTokens"></span>
      <a class="answer-modal-link" id="answerModalShareLink" href="#" target="_blank" rel="noopener noreferrer">🔗 共有ページを開く</a>
    </div>
  </div>
</div>
<script>
(function() {
  var seedSearchInput = document.getElementById('seedSearchInput');
  var seedSearchStatus = document.getElementById('seedSearchStatus');
  var seedSearchResults = document.getElementById('seedSearchResults');
  var searchKeywordCountTh = document.getElementById('searchKeywordCountTh');
  var searchDateTh = document.getElementById('searchDateTh');
  var seedLoadingSpinner = document.getElementById('seedLoadingSpinner');
  var catQuickGroups = document.getElementById('catQuickGroups');
  var catQuickCats = document.getElementById('catQuickCats');
  var graphStatus = document.getElementById('graphStatus');
  var canvas = document.getElementById('graphCanvas');
  var ctx = canvas.getContext('2d');
  var sidePanel = document.getElementById('sidePanel');
  var categoryLegend = document.getElementById('categoryLegend');
  var nodeTooltip = document.getElementById('nodeTooltip');
  var answerModalBackdrop = document.getElementById('answerModalBackdrop');
  var answerModalBody = document.getElementById('answerModalBody');
  var answerModalClose = document.getElementById('answerModalClose');
  var answerModalQuestion = document.getElementById('answerModalQuestion');
  var answerModalDate = document.getElementById('answerModalDate');
  var answerModalTime = document.getElementById('answerModalTime');
  var answerModalMeta = document.getElementById('answerModalMeta');
  var answerModalTokens = document.getElementById('answerModalTokens');
  var answerModalShareLink = document.getElementById('answerModalShareLink');
  var answerModalHighlightToggleBtn = document.getElementById('answerModalHighlightToggleBtn');
  var MODEL_COLORS = ${modelColorsJson};
  var fpToggleBtn = document.getElementById('fpToggleBtn');
  var fpView = document.getElementById('fpView');
  var fpHere = document.getElementById('fpHere');
  var fpSky = document.getElementById('fpSky');
  var fpNodes = document.getElementById('fpNodes');
  var fpFilmstrip = document.getElementById('fpFilmstrip');
  var fpAnswerList = document.getElementById('fpAnswerList');
  var fpLeftBtn = document.getElementById('fpLeftBtn');
  var fpRightBtn = document.getElementById('fpRightBtn');
  var fpForwardBtn = document.getElementById('fpForwardBtn');
  var fpBackwardBtn = document.getElementById('fpBackwardBtn');
  var canvasWrap = document.querySelector('.canvas-wrap');

  var searchTimer = null;
  var searchResultsRaw = [];
  var searchSortMode = 'date';
  var selectedShareId = null;
  var nodePositions = [];
  var currentGraph = null;
  var lastLayout = null;
  var selectedNodeId = null;
  var currentAnswerNode = null;
  var keywordCountMap = {};
  var answerModalKeywordsFromDB = [];
  var answerModalHighlightActive = true;
  var fpActive = false;
  var fpHeadingDeg = 0;
  var fpDragStartX = null;
  var fpDragStartHeading = 0;
  var fpDragAccumX = 0;
  var fpNearKeywords = [];
  var fpFocusIdx = 0;
  var fpWheelAccumX = 0;
  var fpWheelTimer = null;
  var FP_SWIPE_STEP_PX = 40;

  function escHtml(s) {
    return String(s == null ? '' : s)
      .split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;')
      .split('"').join('&quot;').split("'").join('&#39;');
  }

  function shortModelName(model) {
    return model ? (model.split('/').pop() || model) : '';
  }

  function applyKeywordHighlight(el, keywords) {
    var kwList = Array.isArray(keywords) ? keywords.filter(Boolean) : [keywords];
    if (kwList.length === 0) return;
    var escaped = kwList.map(function(k) { return k.replace(/[.*+?^$\{}()|[\]\\]/g, '\\$&'); });
    var re = new RegExp(escaped.join('|'), 'gi');
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    var n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function(tn) {
      if (!re.test(tn.nodeValue)) { re.lastIndex = 0; return; }
      re.lastIndex = 0;
      var frag = document.createDocumentFragment();
      var last = 0, m;
      while ((m = re.exec(tn.nodeValue)) !== null) {
        if (m.index > last) frag.appendChild(document.createTextNode(tn.nodeValue.slice(last, m.index)));
        var mark = document.createElement('mark');
        mark.className = 'kw-highlight';
        mark.textContent = m[0];
        frag.appendChild(mark);
        last = re.lastIndex;
      }
      if (last < tn.nodeValue.length) frag.appendChild(document.createTextNode(tn.nodeValue.slice(last)));
      tn.parentNode.replaceChild(frag, tn);
    });
  }

  function clearKeywordHighlights(container) {
    var marks = container.querySelectorAll('.kw-highlight');
    marks.forEach(function(mark) {
      if (mark.parentNode) {
        mark.parentNode.replaceChild(document.createTextNode(mark.textContent), mark);
      }
    });
    if (container.normalize) container.normalize();
  }

  function updateAnswerModalHighlightBtn() {
    if (answerModalKeywordsFromDB.length === 0) {
      answerModalHighlightToggleBtn.style.opacity = '0.2';
      answerModalHighlightToggleBtn.title = 'キーワードハイライトなし';
      return;
    }
    if (answerModalHighlightActive) {
      answerModalHighlightToggleBtn.style.opacity = '1';
      answerModalHighlightToggleBtn.title = '🔑 ハイライト表示中（クリックで非表示）';
    } else {
      answerModalHighlightToggleBtn.style.opacity = '0.35';
      answerModalHighlightToggleBtn.title = '🔑 ハイライト非表示（クリックで表示）';
    }
  }

  answerModalHighlightToggleBtn.addEventListener('click', function() {
    if (answerModalKeywordsFromDB.length === 0) return;
    answerModalHighlightActive = !answerModalHighlightActive;
    if (answerModalHighlightActive) {
      answerModalQuestion.classList.remove('highlights-hidden');
      answerModalBody.classList.remove('highlights-hidden');
    } else {
      answerModalQuestion.classList.add('highlights-hidden');
      answerModalBody.classList.add('highlights-hidden');
    }
    updateAnswerModalHighlightBtn();
  });

  function loadAnswerModalKeywords(shareId) {
    fetch('/api/aichat/share-keywords?shareId=' + encodeURIComponent(shareId), { credentials: 'same-origin' })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        answerModalKeywordsFromDB = (d.keywords || []).map(function(k) { return k.keyword; });
        clearKeywordHighlights(answerModalQuestion);
        clearKeywordHighlights(answerModalBody);
        if (answerModalKeywordsFromDB.length > 0 && answerModalHighlightActive) {
          applyKeywordHighlight(answerModalQuestion, answerModalKeywordsFromDB);
          applyKeywordHighlight(answerModalBody, answerModalKeywordsFromDB);
        }
        updateAnswerModalHighlightBtn();
      })
      .catch(function() {});
  }

  ${getMarkdownParserScript()}

  function appendAnswerModalBubble(text) {
    var el = document.createElement('div');
    el.className = 'chat-bubble assistant preview-area';
    el.innerHTML = parseMd(text);
    answerModalBody.appendChild(el);
  }

  function openAnswerModal(shareId) {
    answerModalQuestion.textContent = '';
    answerModalQuestion.classList.remove('highlights-hidden');
    answerModalDate.textContent = '';
    answerModalTime.textContent = '';
    answerModalMeta.textContent = '';
    answerModalTokens.textContent = '';
    answerModalShareLink.href = '#';
    answerModalKeywordsFromDB = [];
    answerModalHighlightActive = true;
    answerModalBody.classList.remove('highlights-hidden');
    answerModalBody.textContent = '読み込み中...';
    answerModalBackdrop.classList.add('open');
    fetch('/api/aichat/shares/' + encodeURIComponent(shareId), { credentials: 'same-origin' })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d || d.error) { answerModalBody.textContent = '回答の取得に失敗しました: ' + ((d && d.error) || '不明なエラー'); return; }
        answerModalQuestion.textContent = d.question;
        if (d.created_at) {
          answerModalDate.textContent = String(d.created_at).slice(0, 10);
          answerModalTime.textContent = ' ' + String(d.created_at).slice(11, 16);
        }
        var dotColor = MODEL_COLORS[d.model] || '';
        var dotHtml = dotColor ? '<span class="answer-modal-model-dot" style="background:' + dotColor + ';"></span>' : '';
        answerModalMeta.innerHTML = dotHtml + escHtml(shortModelName(d.model)) + '　👁 ' + (d.access_count || 0);
        var tokenParts = [];
        if (d.input_tokens != null) tokenParts.push('in:' + d.input_tokens);
        if (d.output_tokens != null) tokenParts.push('out:' + d.output_tokens);
        answerModalTokens.textContent = tokenParts.length > 0 ? '📊 ' + tokenParts.join(' / ') : '';
        if (d.user_hash) answerModalShareLink.href = '/s/' + d.user_hash + '/' + d.id;
        answerModalBody.innerHTML = '';
        appendAnswerModalBubble(d.answer);
        loadAnswerModalKeywords(shareId);
      })
      .catch(function() { answerModalBody.textContent = '回答の取得に失敗しました（通信エラー）'; });
  }

  function closeAnswerModal() {
    answerModalBackdrop.classList.remove('open');
  }

  answerModalClose.addEventListener('click', closeAnswerModal);
  answerModalBackdrop.addEventListener('click', function(e) { if (e.target === answerModalBackdrop) closeAnswerModal(); });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && answerModalBackdrop.classList.contains('open')) closeAnswerModal();
  });

  function hideNodeTooltip() {
    nodeTooltip.style.display = 'none';
  }

  function buildNodeLabelLine(node) {
    return node.type === 'answer'
      ? '<div class="question-line" style="word-break:break-word;" data-share-id="' + escHtml(node.id.slice(2)) + '">' + escHtml(node.label) + '</div>'
      : '<div style="word-break:break-word;">' + escHtml(node.label) + '</div>';
  }

  function showNodeTooltip(node, pageX, pageY) {
    var typeLabelClass = node.type === 'answer' ? 'node-type-answer' : 'node-type-keyword';
    var typeLabelText = node.type === 'answer' ? '回答（質問）' : 'キーワード';
    var categoryLine = node.dominantCategory
      ? '<div style="margin-bottom:4px;"><span class="legend-dot" style="background:' + escHtml(node.color || '#888888') + ';"></span>分類: ' + escHtml(node.dominantCategory) + '</div>'
      : '';
    nodeTooltip.innerHTML = '<span class="node-type-label ' + typeLabelClass + '">' + typeLabelText + '</span>'
      + '<div style="margin-bottom:4px;color:var(--label);">深さ: ' + node.depth + '</div>'
      + categoryLine
      + buildNodeLabelLine(node);
    nodeTooltip.style.display = 'block';
    var tipWidth = nodeTooltip.offsetWidth || 260;
    var left = pageX + 12;
    if (left + tipWidth > window.scrollX + document.documentElement.clientWidth) {
      left = pageX - tipWidth - 12;
    }
    nodeTooltip.style.left = Math.max(4, left) + 'px';
    nodeTooltip.style.top = (pageY + 12) + 'px';
  }

  document.addEventListener('click', function(e) {
    var q = e.target.closest('.question-line');
    if (q) { openAnswerModal(q.getAttribute('data-share-id')); return; }
    if (e.target === canvas) return;
    if (nodeTooltip.contains(e.target)) return;
    hideNodeTooltip();
    if (!e.target.closest('.zero-keyword-row')) hideSeedZeroTooltip();
  });

  var ZERO_KEYWORD_TOOLTIP_MS = 7000;
  var seedZeroTooltipEl = null;
  var seedZeroTooltipTimer = null;

  function hideSeedZeroTooltip() {
    if (seedZeroTooltipTimer) { clearTimeout(seedZeroTooltipTimer); seedZeroTooltipTimer = null; }
    if (seedZeroTooltipEl) { seedZeroTooltipEl.remove(); seedZeroTooltipEl = null; }
  }

  function showSeedZeroTooltip(x, y) {
    hideSeedZeroTooltip();
    var el = document.createElement('div');
    el.className = 'seed-zero-tooltip';
    el.textContent = 'この質問の回答結果から1つでもいいのでキーワードを切り出して登録しないとノードの描画が行えません';
    document.body.appendChild(el);
    var left = x + 12;
    var top = y + 12;
    var maxLeft = window.scrollX + document.documentElement.clientWidth - el.offsetWidth - 8;
    if (left > maxLeft) left = Math.max(4, maxLeft);
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    seedZeroTooltipEl = el;
    seedZeroTooltipTimer = setTimeout(hideSeedZeroTooltip, ZERO_KEYWORD_TOOLTIP_MS);
  }

  function sortSearchResults(results, mode) {
    var arr = (results || []).slice();
    if (mode === 'count-desc') {
      arr.sort(function(a, b) { return (b.keywordCount || 0) - (a.keywordCount || 0); });
    } else if (mode === 'count-asc') {
      arr.sort(function(a, b) { return (a.keywordCount || 0) - (b.keywordCount || 0); });
    } else if (mode === 'date-asc') {
      arr.sort(function(a, b) { return new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); });
    } else {
      arr.sort(function(a, b) { return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); });
    }
    return arr;
  }

  function formatSearchResultDateTime(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso || '';
    var pad = function(n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function updateSearchSortIndicator() {
    var countLabel = searchSortMode === 'count-desc' ? '🔑 ▼' : searchSortMode === 'count-asc' ? '🔑 ▲' : '🔑';
    searchKeywordCountTh.textContent = countLabel;
    var isDateMode = searchSortMode === 'date' || searchSortMode === 'date-asc';
    var dateLabel = !isDateMode ? '質問日時' : (searchSortMode === 'date-asc' ? '質問日時 ▲' : '質問日時 ▼');
    searchDateTh.textContent = dateLabel;
  }

  function renderSearchResultsTable() {
    var sorted = sortSearchResults(searchResultsRaw, searchSortMode);
    seedSearchResults.innerHTML = '';
    sorted.forEach(function(r) {
      var isZeroKeyword = !(r.keywordCount || 0);
      var row = document.createElement('tr');
      row.className = 'search-result-row' + (isZeroKeyword ? ' zero-keyword-row' : '') + (r.id === selectedShareId ? ' selected' : '');
      var countTd = document.createElement('td');
      countTd.className = 'search-result-count';
      countTd.textContent = String(r.keywordCount || 0);
      var dateTd = document.createElement('td');
      dateTd.className = 'search-result-date';
      dateTd.textContent = formatSearchResultDateTime(r.created_at);
      var qTd = document.createElement('td');
      qTd.className = 'search-result-question';
      qTd.textContent = r.question;
      qTd.title = isZeroKeyword
        ? 'この質問の回答結果から1つでもいいのでキーワードを切り出して登録しないとノードの描画が行えません'
        : r.question;
      row.appendChild(countTd);
      row.appendChild(dateTd);
      row.appendChild(qTd);
      row.addEventListener('click', function(e) {
        if (isZeroKeyword) { showSeedZeroTooltip(e.clientX, e.clientY); return; }
        selectedShareId = r.id;
        seedSearchResults.querySelectorAll('.search-result-row').forEach(function(el) { el.classList.remove('selected'); });
        row.classList.add('selected');
        loadGraph(r.id);
      });
      seedSearchResults.appendChild(row);
    });
    updateSearchSortIndicator();
  }

  function cycleSearchSortMode() {
    searchSortMode = searchSortMode === 'date' ? 'count-desc' : searchSortMode === 'count-desc' ? 'count-asc' : 'date';
    renderSearchResultsTable();
  }

  function cycleDateSortMode() {
    searchSortMode = searchSortMode === 'date-asc' ? 'date' : 'date-asc';
    renderSearchResultsTable();
  }

  searchKeywordCountTh.addEventListener('click', cycleSearchSortMode);
  searchKeywordCountTh.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycleSearchSortMode(); }
  });

  searchDateTh.addEventListener('click', cycleDateSortMode);
  searchDateTh.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycleDateSortMode(); }
  });

  function doSeedSearch(q) {
    seedSearchStatus.textContent = '検索中...';
    fetch('/api/aichat/shares/search?q=' + encodeURIComponent(q), { credentials: 'same-origin' })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        var results = (d && d.results) || [];
        seedSearchStatus.textContent = results.length + ' 件ヒット';
        searchResultsRaw = results;
        searchSortMode = 'date';
        renderSearchResultsTable();
      })
      .catch(function() { seedSearchStatus.textContent = '検索エラー'; });
  }

  seedSearchInput.addEventListener('input', function() {
    var q = seedSearchInput.value.trim();
    clearTimeout(searchTimer);
    if (!q) { seedSearchStatus.textContent = ''; searchResultsRaw = []; renderSearchResultsTable(); return; }
    searchTimer = setTimeout(function() { doSeedSearch(q); }, 350);
  });

  // ===== 大分類/中分類からのキーワードすばやい絞り込み =====
  var catQuickData = null;

  function renderCatQuickCats(group) {
    catQuickCats.innerHTML = '';
    if (!catQuickData || !group) return;
    var catIds = (group.category_ids || []).map(String);
    var cats = catIds.map(function(cid) { return catQuickData.catMap[cid]; }).filter(Boolean);
    cats = sortByKwCountDesc(cats);
    cats.forEach(function(cat) {
      var select = document.createElement('select');
      select.className = 'cat-quick-cat-select';
      select.style.borderColor = cat.color || '#6366f1';
      var placeholderOpt = document.createElement('option');
      placeholderOpt.value = '';
      placeholderOpt.textContent = cat.name + ' (' + (cat.kw_count || 0) + ')';
      select.appendChild(placeholderOpt);
      var kws = catQuickData.keywordsByCat[String(cat.id)] || [];
      kws.forEach(function(kw) {
        var opt = document.createElement('option');
        opt.value = kw.keyword;
        opt.textContent = kw.keyword + ' (' + kw.cnt + ')';
        select.appendChild(opt);
      });
      select.addEventListener('change', function() {
        if (!select.value) return;
        var chosen = select.value;
        seedSearchInput.value = chosen;
        seedSearchStatus.textContent = '検索中...';
        doSeedSearch(chosen);
        select.value = '';
      });
      catQuickCats.appendChild(select);
    });
  }

  // AIチャットページ(src/views/aichat.ts の getDailyStatsGroupColor)と同じ
  // 大分類カテゴリ→色の対応を用いる。テンプレートリテラルが別ファイルに
  // 分かれているため関数を共有できず、判定ロジックを複製している。
  var CAT_QUICK_GROUP_COLOR_FALLBACK_PALETTE = ['#f59e0b', '#ec4899', '#a855f7', '#f97316', '#14b8a6', '#eab308'];
  function getCatQuickGroupColor(name, index) {
    var n = String(name || '');
    if (n.indexOf('Travel') !== -1 || n.indexOf('旅行') !== -1) return '#38bdf8';
    if (n.indexOf('Coding') !== -1 || n.indexOf('コーディング') !== -1 || n.indexOf('コード') !== -1) return '#86efac';
    if (n.indexOf('MyApps') !== -1 || n.indexOf('My Apps') !== -1) return '#16a34a';
    return CAT_QUICK_GROUP_COLOR_FALLBACK_PALETTE[index % CAT_QUICK_GROUP_COLOR_FALLBACK_PALETTE.length];
  }

  function renderCatQuickGroups() {
    catQuickGroups.innerHTML = '';
    if (!catQuickData) return;
    var groups = sortByKwCountDesc(catQuickData.groups);
    groups.forEach(function(g, gi) {
      var color = getCatQuickGroupColor(g.group_name, gi);
      var label = document.createElement('label');
      label.className = 'cat-quick-group-label';
      label.style.setProperty('--cat-quick-color', color);
      label.style.borderColor = color;
      var radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'catQuickGroupRadio';
      radio.value = g.id;
      radio.addEventListener('change', function() {
        catQuickGroups.querySelectorAll('.cat-quick-group-label').forEach(function(el) { el.classList.remove('checked'); });
        label.classList.add('checked');
        renderCatQuickCats(g);
      });
      label.appendChild(radio);
      var span = document.createElement('span');
      span.textContent = '(' + (g.kw_count || 0) + ') ' + g.group_name;
      label.appendChild(span);
      catQuickGroups.appendChild(label);
    });
  }

  function loadCatQuickNav() {
    Promise.allSettled([
      fetch('/api/aichat/category-groups', { credentials: 'same-origin' }).then(function(r) { return r.json(); }),
      fetch('/api/aichat/keyword-categories-summary', { credentials: 'same-origin' }).then(function(r) { return r.json(); }),
      fetch('/api/aichat/all-keywords', { credentials: 'same-origin' }).then(function(r) { return r.json(); })
    ]).then(function(results) {
      var groupData = results[0].status === 'fulfilled' ? results[0].value : {};
      var catData = results[1].status === 'fulfilled' ? results[1].value : {};
      var kwData = results[2].status === 'fulfilled' ? results[2].value : {};
      var groups = groupData.groups || [];
      var cats = catData.categories || [];
      var keywords = kwData.keywords || [];
      var catMap = {};
      cats.forEach(function(cat) { catMap[String(cat.id)] = cat; });
      catQuickData = { groups: groups, catMap: catMap, keywordsByCat: computeKeywordsByCategory(keywords) };
      renderCatQuickGroups();
      // AIチャットページでの各キーワードの出現回数(select_countの合計)。
      // 俯瞰グラフビューのキーワードノードの円の大きさに使う。この取得は
      // グラフ本体の読み込みと非同期で並行するため、既にグラフが表示済み
      // なら再描画して反映する。
      keywordCountMap = {};
      keywords.forEach(function(kw) { keywordCountMap[kw.keyword] = kw.cnt || 0; });
      if (currentGraph) drawGraph();
    });
  }

  // レスポンスがJSONでない場合(サーバーの未捕捉500等)でも原因を画面に出せるよう、
  // HTTPステータスと本文先頭を含めたエラーメッセージへ変換する純粋関数。
  function parseGraphResponse(status, text) {
    var d = null;
    try { d = JSON.parse(text); } catch (e) { d = null; }
    if (d && !d.error) return { data: d, error: null };
    if (d && d.error) return { data: null, error: String(d.error) };
    var snippet = String(text == null ? '' : text).slice(0, 120);
    return { data: null, error: 'HTTP ' + status + (snippet ? ' / ' + snippet : '') };
  }

  function loadGraph(shareId) {
    graphStatus.textContent = '読み込み中...';
    graphStatus.className = 'graph-status';
    sidePanel.innerHTML = '<span class="empty-hint">ノードをクリックすると詳細がここに表示されます</span>';
    seedLoadingSpinner.classList.add('active');
    fetch('/api/aichat/answer-propagation-graph', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ shareId: shareId }),
    })
      .then(function(r) {
        return r.text().then(function(t) { return parseGraphResponse(r.status, t); });
      })
      .then(function(parsed) {
        currentAnswerNode = null;
        selectedNodeId = null;
        if (parsed.error !== null) {
          graphStatus.textContent = 'グラフの取得に失敗しました: ' + parsed.error;
          graphStatus.className = 'graph-status err';
          currentGraph = null;
          drawGraph();
          if (fpActive) { fpHeadingDeg = 0; refreshFirstPersonFocus(); renderFirstPersonHere(); renderFirstPersonView(); renderFilmstrip(); renderFpAnswerList(); }
          return;
        }
        var d = parsed.data;
        currentGraph = d;
        var statusText = 'ノード ' + d.nodes.length + ' 件 / エッジ ' + d.edges.length + ' 件';
        if (d._colorWarning) {
          statusText += '　※色分け無効: ' + d._colorWarning;
          graphStatus.className = 'graph-status err';
        } else {
          graphStatus.className = 'graph-status';
        }
        graphStatus.textContent = statusText;
        drawGraph();
        if (fpActive) { fpHeadingDeg = 0; refreshFirstPersonFocus(); renderFirstPersonHere(); renderFirstPersonView(); renderFilmstrip(); renderFpAnswerList(); }
      })
      .catch(function(err) {
        graphStatus.textContent = 'グラフの取得に失敗しました（通信エラー: ' + ((err && err.message) || '不明') + '）';
        graphStatus.className = 'graph-status err';
      })
      .then(function() {
        seedLoadingSpinner.classList.remove('active');
      });
  }

  function renderCategoryLegend() {
    if (!currentGraph) { categoryLegend.innerHTML = ''; return; }
    var seen = {};
    var items = [];
    currentGraph.nodes.forEach(function(n) {
      if (!n.dominantCategory || !n.color) return;
      var key = n.dominantCategory + '|' + n.color;
      if (seen[key]) return;
      seen[key] = true;
      items.push({ label: n.dominantCategory, color: n.color });
    });
    if (items.length === 0) { categoryLegend.innerHTML = ''; return; }
    var html = '<span>分類の色（類似度によるブレンド）:</span>';
    items.forEach(function(it) {
      html += '<span><span class="legend-dot" style="background:' + escHtml(it.color) + ';"></span>' + escHtml(it.label) + '</span>';
    });
    categoryLegend.innerHTML = html;
  }

  function computeRadialLayout(nodes, ringSpacing) {
    var maxDepth = 0;
    nodes.forEach(function(n) { if (n.depth > maxDepth) maxDepth = n.depth; });
    var size = Math.max(500, (maxDepth + 1) * ringSpacing * 2 + 80);
    var cx = size / 2, cy = size / 2;

    var byDepth = {};
    nodes.forEach(function(n) {
      if (!byDepth[n.depth]) byDepth[n.depth] = [];
      byDepth[n.depth].push(n);
    });

    var posById = {};
    Object.keys(byDepth).forEach(function(depthKey) {
      var depth = parseInt(depthKey, 10);
      var group = byDepth[depthKey];
      var radius = depth * ringSpacing;
      group.forEach(function(n, i) {
        var angle = (i / group.length) * Math.PI * 2 - Math.PI / 2;
        var x = depth === 0 ? cx : cx + radius * Math.cos(angle);
        var y = depth === 0 ? cy : cy + radius * Math.sin(angle);
        posById[n.id] = { x: x, y: y, node: n };
      });
    });

    return { size: size, cx: cx, cy: cy, posById: posById };
  }

  function normalizeDeg360(deg) {
    var d = deg % 360;
    if (d < 0) d += 360;
    return d;
  }

  function normalizeDegSigned(deg) {
    var d = normalizeDeg360(deg);
    return d > 180 ? d - 360 : d;
  }

  function computeFirstPersonSlots(posById, cx, cy, headingDeg, fovDeg, horizonPercent, groundPercent) {
    if (horizonPercent === undefined) horizonPercent = 38;
    if (groundPercent === undefined) groundPercent = 90;
    var entries = [];
    var maxDistance = 1;
    Object.keys(posById).forEach(function(id) {
      var p = posById[id];
      if (p.node.depth === 0) return;
      var dx = p.x - cx, dy = p.y - cy;
      var distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > maxDistance) maxDistance = distance;
      var bearingDeg = normalizeDeg360(Math.atan2(dy, dx) * 180 / Math.PI);
      entries.push({ id: id, node: p.node, bearingDeg: bearingDeg, distance: distance });
    });
    var halfFov = fovDeg / 2;
    var visible = [];
    entries.forEach(function(entry) {
      var relativeDeg = normalizeDegSigned(entry.bearingDeg - headingDeg);
      if (Math.abs(relativeDeg) > halfFov) return;
      var distanceRatio = Math.min(1, entry.distance / maxDistance);
      var scale = Math.max(0.35, 1 - distanceRatio * 0.65);
      // 同じ目線の高さ(=距離0)のノードほど地平線から遠い手前(画面下)に、
      // 遠いノードほど地平線に近づく(奥行きの錯覚を作る)
      var topPercent = horizonPercent + (1 - distanceRatio) * (groundPercent - horizonPercent);
      visible.push({
        id: entry.id,
        node: entry.node,
        bearingDeg: entry.bearingDeg,
        relativeDeg: relativeDeg,
        distance: entry.distance,
        screenX: 0.5 + (relativeDeg / halfFov) * 0.5,
        topPercent: topPercent,
        scale: scale,
      });
    });
    visible.sort(function(a, b) { return b.distance - a.distance; });
    return visible;
  }

  // 一人称モードでは常に「回答文ノードの上」に立ち、その回答文に含まれる
  // (=辺で直接繋がっている)キーワード群が目の前(フィルムストリップ)に
  // 展開される、というテイにする。answerNodeに直結するキーワードノードだけを
  // 方位順に並べて返す。
  function computeAnswerKeywordSlots(posById, cx, cy, edges, answerNode) {
    var keywordIds = {};
    (edges || []).forEach(function(e) {
      var otherId = e.from === answerNode.id ? e.to : (e.to === answerNode.id ? e.from : null);
      if (!otherId) return;
      var p = posById[otherId];
      if (p && p.node.type === 'keyword') keywordIds[otherId] = true;
    });
    var slots = [];
    Object.keys(keywordIds).forEach(function(id) {
      var p = posById[id];
      var dx = p.x - cx, dy = p.y - cy;
      var bearingDeg = normalizeDeg360(Math.atan2(dy, dx) * 180 / Math.PI);
      slots.push({ id: id, node: p.node, bearingDeg: bearingDeg });
    });
    slots.sort(function(a, b) { return a.bearingDeg - b.bearingDeg; });
    return slots;
  }

  // 回答文ノードに含まれる(=直結する)キーワード数。ノードの円の直径を
  // 「多くのキーが拾えるオアシス」ほど大きく見せるために使う。
  function countAnswerKeywordDegree(posById, edges, answerId) {
    var seen = {};
    var count = 0;
    (edges || []).forEach(function(e) {
      var otherId = e.from === answerId ? e.to : (e.to === answerId ? e.from : null);
      if (!otherId || seen[otherId]) return;
      var p = posById[otherId];
      if (p && p.node.type === 'keyword') { seen[otherId] = true; count++; }
    });
    return count;
  }

  // 回答文ノードの円の半径。含まれるキーワード数が多いほど大きく(オアシス)、
  // 少ないほど小さく(砂漠)。さらに奥(depthが大きい)ほど遠近感で小さくする。
  function computeAnswerNodeRadius(keywordCount, depth) {
    var BASE_R = 6, MAX_EXTRA = 10, KW_STEP = 1.5;
    var baseR = BASE_R + Math.min(MAX_EXTRA, (keywordCount || 0) * KW_STEP);
    var DEPTH_FALLOFF = 0.08, MIN_SCALE = 0.4;
    var depthScale = Math.max(MIN_SCALE, 1 - (depth || 0) * DEPTH_FALLOFF);
    return baseR * depthScale;
  }

  // キーワードノードの円の半径。AIチャットページでのそのキーワードの
  // 出現回数(select_countの合計、keywordCountMap)に比例して大きくする。
  function computeKeywordNodeRadius(occurrenceCount) {
    var BASE_R = 4, MAX_EXTRA = 10, STEP = 1;
    return BASE_R + Math.min(MAX_EXTRA, (occurrenceCount || 0) * STEP);
  }

  function computeFilmstripOffsets(widths, focusIdx, gapPx) {
    if (gapPx === undefined) gapPx = 1;
    var offsets = new Array(widths.length);
    if (!widths.length) return offsets;
    offsets[focusIdx] = 0;
    var cursor = 0;
    for (var i = focusIdx + 1; i < widths.length; i++) {
      cursor += widths[i - 1] / 2 + gapPx + widths[i] / 2;
      offsets[i] = cursor;
    }
    cursor = 0;
    for (var i = focusIdx - 1; i >= 0; i--) {
      cursor -= widths[i + 1] / 2 + gapPx + widths[i] / 2;
      offsets[i] = cursor;
    }
    return offsets;
  }

  function computeAnswersForKeyword(keywordId, posById, edges) {
    var results = [];
    var seen = {};
    (edges || []).forEach(function(e) {
      var otherId = null;
      if (e.from === keywordId) otherId = e.to;
      else if (e.to === keywordId) otherId = e.from;
      if (!otherId || seen[otherId]) return;
      var p = posById[otherId];
      if (!p || p.node.type !== 'answer') return;
      seen[otherId] = true;
      results.push(p.node);
    });
    return results;
  }

  // フォーカス中のキーワード(keywordId)を含む回答のうち、今立っている
  // 回答文ノード(currentAnswerNode)より奥(depthが大きい)にあるものだけを
  // 「先に進める候補」として返す。単純に「今立っているノード以外」で
  // 絞り込むと、そのキーワードを生んだ親の回答へ逆戻りしてしまい
  // (↓ボタンの役目と競合し、行き止まり判定も壊れる)、↑ボタンが常に
  // 前進する保証が無くなるため、depthで方向を固定する。
  function computeForwardAnswerCandidates(keywordId, posById, edges, currentAnswerNode) {
    return computeAnswersForKeyword(keywordId, posById, edges)
      .filter(function(n) { return n.depth > currentAnswerNode.depth; });
  }

  // answerNodeを見つけ出した「入口」のキーワード(depth-1)を経由して、
  // その親にあたる回答文ノード(depth-2)を1件だけ辿る。BFSで構築した
  // グラフは各ノードにつき経路が1本の木構造のため、親は必ず高々1件に
  // 定まる(rootに近づきすぎて親が無ければnullを返す=それ以上戻れない壁)。
  function findParentAnswer(posById, edges, answerNode) {
    if (!answerNode || answerNode.depth < 2) return null;
    var parentKeywordId = null;
    (edges || []).forEach(function(e) {
      if (parentKeywordId) return;
      var otherId = e.from === answerNode.id ? e.to : (e.to === answerNode.id ? e.from : null);
      if (!otherId) return;
      var p = posById[otherId];
      if (p && p.node.type === 'keyword' && p.node.depth === answerNode.depth - 1) parentKeywordId = otherId;
    });
    if (!parentKeywordId) return null;
    var parentAnswerId = null;
    (edges || []).forEach(function(e) {
      if (parentAnswerId) return;
      var otherId = e.from === parentKeywordId ? e.to : (e.to === parentKeywordId ? e.from : null);
      if (!otherId) return;
      var p = posById[otherId];
      if (p && p.node.type === 'answer' && p.node.depth === answerNode.depth - 2) parentAnswerId = otherId;
    });
    return parentAnswerId ? posById[parentAnswerId].node : null;
  }

  function computeKeywordsByCategory(keywords) {
    var byCat = {};
    (keywords || []).forEach(function(kw) {
      var ids = [];
      if (kw.category_pairs) {
        String(kw.category_pairs).split(',').forEach(function(pair) {
          var sep = pair.indexOf(':');
          if (sep > 0) ids.push(pair.slice(0, sep));
        });
      } else if (kw.category_id != null) {
        ids.push(String(kw.category_id));
      }
      ids.forEach(function(cid) {
        if (!byCat[cid]) byCat[cid] = [];
        byCat[cid].push({ keyword: kw.keyword, cnt: kw.cnt });
      });
    });
    Object.keys(byCat).forEach(function(cid) {
      byCat[cid].sort(function(a, b) { return b.cnt - a.cnt; });
    });
    return byCat;
  }

  function sortByKwCountDesc(items) {
    return (items || []).slice().sort(function(a, b) { return (b.kw_count || 0) - (a.kw_count || 0); });
  }

  function drawGraph() {
    nodePositions = [];
    renderCategoryLegend();
    if (!currentGraph || currentGraph.nodes.length === 0) {
      canvas.width = 800; canvas.height = 400;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      lastLayout = null;
      return;
    }
    var nodes = currentGraph.nodes;
    var edges = currentGraph.edges;
    var ringSpacing = 80;
    var layout = computeRadialLayout(nodes, ringSpacing);
    lastLayout = layout;
    var size = layout.size, cx = layout.cx, cy = layout.cy, posById = layout.posById;
    canvas.width = size;
    canvas.height = size;

    ctx.clearRect(0, 0, size, size);

    var lineColor = getComputedLineColor();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    edges.forEach(function(e) {
      var from = posById[e.from], to = posById[e.to];
      if (!from || !to) return;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    });

    // 現在選択中の質問ノード(selectedNodeId)、および一人称モードで
    // 「今立っている」回答文ノード(currentAnswerNode)から、その回答文内に
    // 含まれる(=辺で直接繋がっている)各キーワードノードまでを強調線で結ぶ。
    // 両者が同じノードを指す場合は二重に描画しない。
    var highlightSourceIds = {};
    if (selectedNodeId && posById[selectedNodeId] && posById[selectedNodeId].node.type === 'answer') {
      highlightSourceIds[selectedNodeId] = true;
    }
    if (currentAnswerNode && posById[currentAnswerNode.id]) {
      highlightSourceIds[currentAnswerNode.id] = true;
    }
    var highlightColor = getCssVar('--accent') || '#0969da';
    Object.keys(highlightSourceIds).forEach(function(srcId) {
      var src = posById[srcId];
      ctx.strokeStyle = highlightColor;
      ctx.lineWidth = 2.5;
      edges.forEach(function(e) {
        var otherId = e.from === srcId ? e.to : (e.to === srcId ? e.from : null);
        if (!otherId) return;
        var other = posById[otherId];
        if (!other || other.node.type !== 'keyword') return;
        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(other.x, other.y);
        ctx.stroke();
      });
    });

    var answerColor = getCssVar('--answer-color') || '#0969da';
    var keywordColor = getCssVar('--keyword-color') || '#c2410c';
    var currentBg = getCssVar('--fp-focus-bg') || '#d1f5d3';
    var currentBorder = getCssVar('--fp-focus-border') || '#2f9e52';
    var currentAnswerId = currentAnswerNode ? currentAnswerNode.id : null;
    Object.keys(posById).forEach(function(id) {
      var p = posById[id];
      var isAnswer = p.node.type === 'answer';
      var isCurrentAnswer = isAnswer && id === currentAnswerId;
      var r = isAnswer
        ? computeAnswerNodeRadius(countAnswerKeywordDegree(posById, edges, id), p.node.depth)
        : computeKeywordNodeRadius(keywordCountMap[p.node.label]);
      var fallbackColor = isAnswer ? answerColor : keywordColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = isCurrentAnswer ? currentBg : (p.node.color || fallbackColor);
      ctx.fill();
      if (isCurrentAnswer) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = currentBorder;
        ctx.stroke();
      } else if (p.node.color) {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = fallbackColor;
        ctx.stroke();
      }
      nodePositions.push({ x: p.x, y: p.y, r: r + 4, node: p.node });
    });
  }

  function getCssVar(name) {
    return getComputedStyle(document.body).getPropertyValue(name).trim();
  }

  function getComputedLineColor() {
    var c = getCssVar('--border');
    return c || '#888';
  }

  function selectGraphNode(node) {
    var typeLabelClass = node.type === 'answer' ? 'node-type-answer' : 'node-type-keyword';
    var typeLabelText = node.type === 'answer' ? '回答（質問）' : 'キーワード';
    var categoryLine = node.dominantCategory
      ? '<div style="margin-bottom:6px;"><span class="legend-dot" style="background:' + escHtml(node.color || '#888888') + ';"></span>分類: ' + escHtml(node.dominantCategory) + '</div>'
      : '';
    sidePanel.innerHTML = '<span class="node-type-label ' + typeLabelClass + '">' + typeLabelText + '</span>'
      + '<div style="margin-bottom:6px;color:var(--label);">深さ: ' + node.depth + '</div>'
      + categoryLine
      + buildNodeLabelLine(node);
    selectedNodeId = node.id;
    if (!fpActive) drawGraph();
  }

  canvas.addEventListener('click', function(e) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width / rect.width;
    var scaleY = canvas.height / rect.height;
    var x = (e.clientX - rect.left) * scaleX;
    var y = (e.clientY - rect.top) * scaleY;
    var hit = null;
    for (var i = 0; i < nodePositions.length; i++) {
      var p = nodePositions[i];
      var dx = p.x - x, dy = p.y - y;
      if (Math.sqrt(dx * dx + dy * dy) <= p.r) { hit = p.node; break; }
    }
    if (!hit) return;
    selectGraphNode(hit);
    showNodeTooltip(hit, e.pageX, e.pageY);
  });

  // ===== 一人称モード（ストリートビュー風パノラマ） =====
  var FP_FOV_DEG = 100;
  var FP_HORIZON_PERCENT = 38;
  var FP_GROUND_PERCENT = 90;

  function renderFirstPersonHere() {
    if (!currentAnswerNode) { fpHere.innerHTML = ''; return; }
    fpHere.innerHTML = '📍 現在地: <strong class="question-line" data-share-id="' + escHtml(currentAnswerNode.id.slice(2)) + '">' + escHtml(currentAnswerNode.label) + '</strong>';
  }

  function renderFirstPersonView() {
    if (!fpActive || !lastLayout) { fpNodes.innerHTML = ''; return; }
    var slots = computeFirstPersonSlots(lastLayout.posById, lastLayout.cx, lastLayout.cy, fpHeadingDeg, FP_FOV_DEG, FP_HORIZON_PERCENT, FP_GROUND_PERCENT);
    var answerColor = getCssVar('--answer-color') || '#0969da';
    var keywordColor = getCssVar('--keyword-color') || '#c2410c';
    fpNodes.innerHTML = '';
    slots.forEach(function(slot) {
      var isAnswer = slot.node.type === 'answer';
      var fallbackColor = isAnswer ? answerColor : keywordColor;
      var color = slot.node.color || fallbackColor;
      var centered = Math.abs(slot.relativeDeg) <= 6;
      var el = document.createElement('div');
      el.className = 'fp-node' + (centered ? ' fp-node-centered' : '');
      el.style.left = (slot.screenX * 100) + '%';
      el.style.top = slot.topPercent + '%';
      el.style.zIndex = String(Math.round((1 - slot.distance / 1e6) * 100) + 100);
      el.style.opacity = String(0.4 + slot.scale * 0.6);
      var dot = document.createElement('div');
      dot.className = 'fp-node-dot';
      dot.style.background = color;
      dot.style.width = dot.style.height = (16 * slot.scale + 8) + 'px';
      var label = document.createElement('div');
      label.className = 'fp-node-label';
      label.textContent = slot.node.label;
      label.style.fontSize = (11 * Math.max(slot.scale, 0.7)) + 'px';
      el.appendChild(dot);
      el.appendChild(label);
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        selectGraphNode(slot.node);
        if (slot.node.type === 'answer') openAnswerModal(slot.node.id.slice(2));
      });
      fpNodes.appendChild(el);
    });
  }

  var FP_FILM_CHIP_GAP_PX = 1;

  function renderFilmstrip() {
    fpFilmstrip.innerHTML = '';
    var keywordColor = getCssVar('--keyword-color') || '#c2410c';
    var chips = fpNearKeywords.map(function(slot, idx) {
      var color = slot.node.color || keywordColor;
      var chip = document.createElement('div');
      chip.className = 'fp-film-chip' + (idx === fpFocusIdx ? ' fp-film-chip-focused' : '');
      chip.textContent = slot.node.label;
      chip.style.borderColor = color;
      chip.style.setProperty('--fp-film-color', color);
      chip.addEventListener('click', function(e) {
        e.stopPropagation();
        focusNearKeyword(idx);
      });
      fpFilmstrip.appendChild(chip);
      return chip;
    });
    var widths = chips.map(function(chip) { return chip.offsetWidth; });
    var offsets = computeFilmstripOffsets(widths, fpFocusIdx, FP_FILM_CHIP_GAP_PX);
    chips.forEach(function(chip, idx) {
      chip.style.left = 'calc(50% + ' + offsets[idx] + 'px)';
    });
  }

  // フォーカス中のキーワードを含む、今立っている回答文ノード以外の回答
  // (=そのキーワードを辿って進める先の候補)を一覧表示する。クリックすると
  // その回答文ノードへ実際に移動しつつ内容を読める(モーダルを開く)。
  function renderFpAnswerList() {
    fpAnswerList.innerHTML = '';
    if (!fpNearKeywords.length || !lastLayout || !currentGraph || !currentAnswerNode) return;
    var keyword = fpNearKeywords[fpFocusIdx];
    var answers = computeForwardAnswerCandidates(keyword.id, lastLayout.posById, currentGraph.edges, currentAnswerNode);
    if (!answers.length) {
      var empty = document.createElement('div');
      empty.className = 'fp-answer-list-empty';
      empty.textContent = 'このキーワードの先に進める回答はありません';
      fpAnswerList.appendChild(empty);
      return;
    }
    var answerColor = getCssVar('--answer-color') || '#0969da';
    answers.forEach(function(node) {
      var row = document.createElement('div');
      row.className = 'fp-answer-row';
      var dot = document.createElement('span');
      dot.className = 'fp-answer-row-dot';
      dot.style.background = node.color || answerColor;
      var label = document.createElement('span');
      label.className = 'fp-answer-row-label';
      label.textContent = node.label;
      row.appendChild(dot);
      row.appendChild(label);
      row.addEventListener('click', function() {
        moveToAnswerNode(node);
        openAnswerModal(node.id.slice(2));
      });
      fpAnswerList.appendChild(row);
    });
  }

  // answerNodeの上に立った状態にする。その回答文に含まれるキーワード群を
  // fpNearKeywords(=目の前に展開される一覧)として再計算する。
  function enterAnswerNode(answerNode) {
    currentAnswerNode = answerNode;
    if (!lastLayout || !answerNode) { fpNearKeywords = []; fpFocusIdx = 0; return; }
    fpNearKeywords = computeAnswerKeywordSlots(lastLayout.posById, lastLayout.cx, lastLayout.cy, currentGraph ? currentGraph.edges : [], answerNode);
    if (!fpNearKeywords.length) { fpFocusIdx = 0; return; }
    var bestIdx = 0, bestDiff = Infinity;
    fpNearKeywords.forEach(function(slot, idx) {
      var diff = Math.abs(normalizeDegSigned(slot.bearingDeg - fpHeadingDeg));
      if (diff < bestDiff) { bestDiff = diff; bestIdx = idx; }
    });
    fpFocusIdx = bestIdx;
  }

  function moveToAnswerNode(answerNode) {
    enterAnswerNode(answerNode);
    renderFirstPersonHere();
    renderFirstPersonView();
    renderFilmstrip();
    renderFpAnswerList();
  }

  // 一人称モードに入る/グラフを読み込み直した直後の初期化。既に立っている
  // 回答文ノード(currentAnswerNode)があればそこを維持し、無ければ起点
  // (depth 0)から始める。
  function refreshFirstPersonFocus() {
    if (!lastLayout) { fpNearKeywords = []; fpFocusIdx = 0; currentAnswerNode = null; return; }
    if (!currentAnswerNode) {
      var seedId = Object.keys(lastLayout.posById).filter(function(id) { return lastLayout.posById[id].node.depth === 0; })[0];
      currentAnswerNode = seedId ? lastLayout.posById[seedId].node : null;
    }
    enterAnswerNode(currentAnswerNode);
  }

  function focusNearKeyword(idx) {
    if (!fpNearKeywords.length) return;
    fpFocusIdx = ((idx % fpNearKeywords.length) + fpNearKeywords.length) % fpNearKeywords.length;
    fpHeadingDeg = fpNearKeywords[fpFocusIdx].bearingDeg;
    renderFirstPersonView();
    renderFilmstrip();
    renderFpAnswerList();
  }

  function stepFirstPersonFocus(direction) {
    if (!fpNearKeywords.length) return;
    focusNearKeyword(fpFocusIdx + direction);
  }

  // フォーカス中のキーワード(fpNearKeywords[fpFocusIdx])を含む、今立っている
  // 回答文ノードとは別の回答文ノードへ進む(=そのキーワードの先にある回答を読みに行く)。
  // 候補が複数あれば最初の1件へ進む(他の候補はfpAnswerListから個別に選べる)。
  // 候補が無ければそこが行き止まり(壁)であり、現状のキーワードを選択する
  // だけで視点は動かさない。
  function forwardFirstPerson() {
    if (!fpActive || !lastLayout || !fpNearKeywords.length || !currentAnswerNode || !currentGraph) return;
    var focused = fpNearKeywords[fpFocusIdx];
    if (!focused) return;
    var candidates = computeForwardAnswerCandidates(focused.id, lastLayout.posById, currentGraph.edges, currentAnswerNode);
    if (candidates.length === 0) {
      selectGraphNode(focused.node);
      return;
    }
    moveToAnswerNode(candidates[0]);
  }

  // 今立っている回答文ノードを見つけ出した入口のキーワードを経由して、
  // その親にあたる回答文ノードへ戻る。親が無ければ(起点付近まで戻っていれば)
  // それ以上戻れない壁であり、視点は動かさない。
  function backwardFirstPerson() {
    if (!fpActive || !lastLayout || !currentAnswerNode) return;
    var parent = findParentAnswer(lastLayout.posById, currentGraph ? currentGraph.edges : [], currentAnswerNode);
    if (!parent) {
      selectGraphNode(currentAnswerNode);
      return;
    }
    moveToAnswerNode(parent);
  }

  function setFirstPersonActive(active) {
    fpActive = active;
    fpToggleBtn.classList.toggle('active', active);
    fpToggleBtn.textContent = active ? '🗺️ 俯瞰モードに戻る' : '🧑‍🚶 一人称モード';
    fpView.style.display = active ? 'flex' : 'none';
    canvasWrap.style.display = active ? 'none' : '';
    sidePanel.style.display = active ? 'none' : '';
    if (active) {
      fpHeadingDeg = 0;
      refreshFirstPersonFocus();
      renderFirstPersonHere();
      renderFirstPersonView();
      renderFilmstrip();
      renderFpAnswerList();
    } else {
      // 俯瞰ビューに戻ったとき、一人称モードで立っている回答文ノードの
      // 薄緑色ハイライトを反映するため再描画する。
      drawGraph();
    }
  }

  fpToggleBtn.addEventListener('click', function() { setFirstPersonActive(!fpActive); });
  fpLeftBtn.addEventListener('click', function() { stepFirstPersonFocus(1); });
  fpRightBtn.addEventListener('click', function() { stepFirstPersonFocus(-1); });
  fpForwardBtn.addEventListener('click', forwardFirstPerson);
  fpBackwardBtn.addEventListener('click', backwardFirstPerson);

  fpHere.addEventListener('click', function(e) {
    var q = e.target.closest('.question-line');
    if (q) openAnswerModal(q.getAttribute('data-share-id'));
  });

  fpSky.addEventListener('touchstart', function(e) {
    if (e.touches.length !== 1) return;
    fpDragStartX = e.touches[0].clientX;
    fpDragAccumX = 0;
  }, { passive: true });
  fpSky.addEventListener('touchmove', function(e) {
    if (fpDragStartX === null || e.touches.length !== 1) return;
    var x = e.touches[0].clientX;
    fpDragAccumX += x - fpDragStartX;
    fpDragStartX = x;
    while (Math.abs(fpDragAccumX) >= FP_SWIPE_STEP_PX) {
      stepFirstPersonFocus(fpDragAccumX < 0 ? 1 : -1);
      fpDragAccumX += fpDragAccumX < 0 ? FP_SWIPE_STEP_PX : -FP_SWIPE_STEP_PX;
    }
  }, { passive: true });
  fpSky.addEventListener('touchend', function() { fpDragStartX = null; fpDragAccumX = 0; });

  fpSky.addEventListener('mousedown', function(e) {
    fpDragStartX = e.clientX;
    fpDragAccumX = 0;
  });
  document.addEventListener('mousemove', function(e) {
    if (fpDragStartX === null) return;
    var x = e.clientX;
    fpDragAccumX += x - fpDragStartX;
    fpDragStartX = x;
    while (Math.abs(fpDragAccumX) >= FP_SWIPE_STEP_PX) {
      stepFirstPersonFocus(fpDragAccumX < 0 ? 1 : -1);
      fpDragAccumX += fpDragAccumX < 0 ? FP_SWIPE_STEP_PX : -FP_SWIPE_STEP_PX;
    }
  });
  document.addEventListener('mouseup', function() { fpDragStartX = null; fpDragAccumX = 0; });

  fpSky.addEventListener('wheel', function(e) {
    if (!fpActive) return;
    var deltaX = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0;
    if (!deltaX) return;
    e.preventDefault();
    fpWheelAccumX += deltaX;
    while (Math.abs(fpWheelAccumX) >= FP_SWIPE_STEP_PX) {
      stepFirstPersonFocus(fpWheelAccumX < 0 ? 1 : -1);
      fpWheelAccumX += fpWheelAccumX < 0 ? FP_SWIPE_STEP_PX : -FP_SWIPE_STEP_PX;
    }
    if (fpWheelTimer) clearTimeout(fpWheelTimer);
    fpWheelTimer = setTimeout(function() { fpWheelAccumX = 0; }, 300);
  }, { passive: false });

  document.addEventListener('keydown', function(e) {
    if (!fpActive) return;
    if (e.key === 'ArrowLeft') { stepFirstPersonFocus(1); }
    else if (e.key === 'ArrowRight') { stepFirstPersonFocus(-1); }
    else if (e.key === 'ArrowUp') { forwardFirstPerson(); }
    else if (e.key === 'ArrowDown') { backwardFirstPerson(); }
  });

  loadCatQuickNav();
  drawGraph();
})();
</script>
</body>
</html>`;
}
