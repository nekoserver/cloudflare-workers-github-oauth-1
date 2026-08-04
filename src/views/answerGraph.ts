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
@media (prefers-color-scheme:light) { :root { --bg:#f6f8fa; --fg:#24292f; --card:#fff; --border:#d0d7de; --label:#57606a; --btn-bg:#f3f4f6; --btn-border:#d0d7de; --btn-hover:#e9ecef; --accent:#0969da; --accent-fg:#fff; --answer-color:#0969da; --keyword-color:#c2410c; --danger:#cf222e; } }
@media (prefers-color-scheme:dark) { :root { --bg:#0d1117; --fg:#e6edf3; --card:#161b22; --border:#30363d; --label:#8b949e; --btn-bg:#21262d; --btn-border:#30363d; --btn-hover:#30363d; --accent:#1f6feb; --accent-fg:#fff; --answer-color:#63b3ed; --keyword-color:#f6ad55; --danger:#f85149; } }
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
.fp-controls { display:flex; align-items:center; justify-content:center; gap:16px; }
.fp-btn {
  width:52px; height:52px; border-radius:50%; border:1px solid var(--btn-border); background:var(--btn-bg);
  color:var(--fg); font-size:20px; cursor:pointer;
}
.fp-btn:hover { background:var(--btn-hover); }
.fp-btn-forward { background:var(--accent); color:var(--accent-fg); border-color:var(--accent); }
.fp-hint { font-size:11px; color:var(--label); text-align:center; }
.search-row { display:flex; gap:8px; margin-bottom:10px; }
input[type=search] { flex:1; background:var(--btn-bg); border:1px solid var(--btn-border); border-radius:6px; color:var(--fg); font-size:13px; padding:8px 12px; outline:none; }
input[type=search]:focus { border-color:var(--accent); }
.search-results { display:flex; flex-direction:column; gap:4px; max-height:220px; overflow-y:auto; }
.search-result-item { padding:8px 10px; border:1px solid var(--border); border-radius:6px; cursor:pointer; font-size:12px; background:var(--btn-bg); }
.search-result-item:hover { border-color:var(--accent); }
.search-result-item.selected { border-color:var(--accent); background:rgba(31,111,235,.1); }
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
    <div class="search-row">
      <input type="search" id="seedSearchInput" placeholder="質問・回答のキーワードで検索..." autocomplete="off">
    </div>
    <div class="search-status" id="seedSearchStatus"></div>
    <div class="search-results" id="seedSearchResults"></div>
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
          <div class="fp-horizon"></div>
          <div class="fp-crosshair"></div>
          <div class="fp-nodes" id="fpNodes"></div>
        </div>
        <div class="fp-controls">
          <button type="button" class="fp-btn" id="fpLeftBtn" aria-label="左を見る">←</button>
          <button type="button" class="fp-btn fp-btn-forward" id="fpForwardBtn" aria-label="選択して読む">↑</button>
          <button type="button" class="fp-btn" id="fpRightBtn" aria-label="右を見る">→</button>
        </div>
        <div class="fp-hint">左右にスワイプ、または ←→ ボタンで見渡せます。↑ で中央のノードを選択します</div>
      </div>
    </div>
  </div>
</main>
<div class="node-tooltip" id="nodeTooltip" style="display:none;"></div>
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
  var fpLeftBtn = document.getElementById('fpLeftBtn');
  var fpRightBtn = document.getElementById('fpRightBtn');
  var fpForwardBtn = document.getElementById('fpForwardBtn');
  var canvasWrap = document.querySelector('.canvas-wrap');

  var searchTimer = null;
  var selectedShareId = null;
  var nodePositions = [];
  var currentGraph = null;
  var lastLayout = null;
  var answerModalKeywordsFromDB = [];
  var answerModalHighlightActive = true;
  var fpActive = false;
  var fpHeadingDeg = 0;
  var fpDragStartX = null;
  var fpDragStartHeading = 0;

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
  });

  function doSeedSearch(q) {
    seedSearchStatus.textContent = '検索中...';
    fetch('/api/aichat/shares/search?q=' + encodeURIComponent(q), { credentials: 'same-origin' })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        var results = (d && d.results) || [];
        seedSearchStatus.textContent = results.length + ' 件ヒット';
        seedSearchResults.innerHTML = '';
        results.forEach(function(r) {
          var item = document.createElement('div');
          item.className = 'search-result-item' + (r.id === selectedShareId ? ' selected' : '');
          item.textContent = r.question;
          item.title = r.question;
          item.addEventListener('click', function() {
            selectedShareId = r.id;
            seedSearchResults.querySelectorAll('.search-result-item').forEach(function(el) { el.classList.remove('selected'); });
            item.classList.add('selected');
            loadGraph(r.id);
          });
          seedSearchResults.appendChild(item);
        });
      })
      .catch(function() { seedSearchStatus.textContent = '検索エラー'; });
  }

  seedSearchInput.addEventListener('input', function() {
    var q = seedSearchInput.value.trim();
    clearTimeout(searchTimer);
    if (!q) { seedSearchStatus.textContent = ''; seedSearchResults.innerHTML = ''; return; }
    searchTimer = setTimeout(function() { doSeedSearch(q); }, 350);
  });

  function loadGraph(shareId) {
    graphStatus.textContent = '読み込み中...';
    graphStatus.className = 'graph-status';
    sidePanel.innerHTML = '<span class="empty-hint">ノードをクリックすると詳細がここに表示されます</span>';
    fetch('/api/aichat/answer-propagation-graph', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ shareId: shareId }),
    })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d || d.error) {
          graphStatus.textContent = 'グラフの取得に失敗しました: ' + ((d && d.error) || '不明なエラー');
          graphStatus.className = 'graph-status err';
          currentGraph = null;
          drawGraph();
          if (fpActive) { fpHeadingDeg = 0; renderFirstPersonHere(); renderFirstPersonView(); }
          return;
        }
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
        if (fpActive) { fpHeadingDeg = 0; renderFirstPersonHere(); renderFirstPersonView(); }
      })
      .catch(function() {
        graphStatus.textContent = 'グラフの取得に失敗しました（通信エラー）';
        graphStatus.className = 'graph-status err';
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

    var answerColor = getCssVar('--answer-color') || '#0969da';
    var keywordColor = getCssVar('--keyword-color') || '#c2410c';
    Object.keys(posById).forEach(function(id) {
      var p = posById[id];
      var isAnswer = p.node.type === 'answer';
      var r = isAnswer ? (p.node.depth === 0 ? 10 : 7) : 6;
      var fallbackColor = isAnswer ? answerColor : keywordColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = p.node.color || fallbackColor;
      ctx.fill();
      if (p.node.color) {
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
    if (!currentGraph) { fpHere.innerHTML = ''; return; }
    var seed = currentGraph.nodes.filter(function(n) { return n.depth === 0; })[0];
    if (!seed) { fpHere.innerHTML = ''; return; }
    fpHere.innerHTML = '📍 現在地: <strong class="question-line" data-share-id="' + escHtml(seed.id.slice(2)) + '">' + escHtml(seed.label) + '</strong>';
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

  function rotateFirstPerson(deltaDeg) {
    fpHeadingDeg = normalizeDeg360(fpHeadingDeg + deltaDeg);
    renderFirstPersonView();
  }

  function forwardFirstPerson() {
    if (!fpActive || !lastLayout) return;
    var slots = computeFirstPersonSlots(lastLayout.posById, lastLayout.cx, lastLayout.cy, fpHeadingDeg, FP_FOV_DEG);
    if (slots.length === 0) return;
    var nearestCentered = null;
    slots.forEach(function(slot) {
      if (nearestCentered === null || Math.abs(slot.relativeDeg) < Math.abs(nearestCentered.relativeDeg)) {
        nearestCentered = slot;
      }
    });
    if (!nearestCentered) return;
    selectGraphNode(nearestCentered.node);
    if (nearestCentered.node.type === 'answer') openAnswerModal(nearestCentered.node.id.slice(2));
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
      renderFirstPersonHere();
      renderFirstPersonView();
    }
  }

  fpToggleBtn.addEventListener('click', function() { setFirstPersonActive(!fpActive); });
  fpLeftBtn.addEventListener('click', function() { rotateFirstPerson(-20); });
  fpRightBtn.addEventListener('click', function() { rotateFirstPerson(20); });
  fpForwardBtn.addEventListener('click', forwardFirstPerson);

  fpHere.addEventListener('click', function(e) {
    var q = e.target.closest('.question-line');
    if (q) openAnswerModal(q.getAttribute('data-share-id'));
  });

  fpSky.addEventListener('touchstart', function(e) {
    if (e.touches.length !== 1) return;
    fpDragStartX = e.touches[0].clientX;
    fpDragStartHeading = fpHeadingDeg;
  }, { passive: true });
  fpSky.addEventListener('touchmove', function(e) {
    if (fpDragStartX === null || e.touches.length !== 1) return;
    var deltaX = e.touches[0].clientX - fpDragStartX;
    var deltaDeg = (deltaX / fpSky.clientWidth) * FP_FOV_DEG;
    fpHeadingDeg = normalizeDeg360(fpDragStartHeading - deltaDeg);
    renderFirstPersonView();
  }, { passive: true });
  fpSky.addEventListener('touchend', function() { fpDragStartX = null; });

  fpSky.addEventListener('mousedown', function(e) {
    fpDragStartX = e.clientX;
    fpDragStartHeading = fpHeadingDeg;
  });
  document.addEventListener('mousemove', function(e) {
    if (fpDragStartX === null) return;
    var deltaX = e.clientX - fpDragStartX;
    var deltaDeg = (deltaX / fpSky.clientWidth) * FP_FOV_DEG;
    fpHeadingDeg = normalizeDeg360(fpDragStartHeading - deltaDeg);
    renderFirstPersonView();
  });
  document.addEventListener('mouseup', function() { fpDragStartX = null; });

  document.addEventListener('keydown', function(e) {
    if (!fpActive) return;
    if (e.key === 'ArrowLeft') { rotateFirstPerson(-20); }
    else if (e.key === 'ArrowRight') { rotateFirstPerson(20); }
    else if (e.key === 'ArrowUp') { forwardFirstPerson(); }
  });

  drawGraph();
})();
</script>
</body>
</html>`;
}
