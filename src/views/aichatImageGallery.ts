import { getMarkdownParserScript, getMarkdownPreviewCSS } from '../utils/markdownRenderer';
import { getKeywordHighlightScript } from '../utils/keywordHighlight';

function escH(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * AIチャットの質問文・回答文に含まれるキーワードで、画像添付済みの会話だけを
 * 検索してギャラリー表示する閲覧専用ページ。ai_chat_shares(正式な会話記録)を
 * そのままの出所として使い、新規テーブルは作らない。検索結果は
 * /api/aichat/image-gallery-search から取得し、クライアント側でDOM生成する
 * (data-*属性へ本文を埋め込まないため、属性エスケープ漏れによるXSSの
 * 余地自体が生じない)。
 * modelColorsはAIチャットページ(/aichat)と同じaichat_model_colorsテーブルの
 * 値をそのまま渡し、プレビューモーダルのモデル名表示に同じ色を使う。
 */
export function getAichatImageGalleryPage(username: string, modelColors: Record<string, string> = {}): string {
  const safeUser = escH(username);
  const modelColorsJson = JSON.stringify(modelColors);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#000010">
<title>🖼️ AIチャット画像検索</title>
<style>
:root {
  --text-primary:#e6edf3; --text-muted:#8b949e; --border-color:#30363d;
  --accent-color:#58a6ff; --bg-secondary:#161b22; --code-bg:#0d1117;
}
* { box-sizing:border-box; margin:0; padding:0; }
body { background:#000010; color:#e6edf3; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:13px; min-height:100vh; min-height:100svh; display:flex; flex-direction:column; }
.topbar { background:rgba(0,0,20,0.95); border-bottom:1px solid #1e2a40; padding:8px 18px; display:flex; align-items:center; gap:10px; flex-shrink:0; }
.topbar a { color:#58a6ff; text-decoration:none; font-size:12px; }
.topbar a:hover { text-decoration:underline; }
h1 { font-size:15px; font-weight:700; flex:1; }
.wrap { max-width:1100px; margin:0 auto; padding:24px 18px 60px; width:100%; }
.hint { color:#8b949e; font-size:12px; margin-bottom:14px; }
.search-row { display:flex; gap:8px; margin-bottom:18px; }
.search-input {
  flex:1; background:#0d1424; border:1px solid #30363d; border-radius:6px;
  color:#e6edf3; padding:8px 10px; font-size:13px;
}
.search-input:focus { outline:none; border-color:#58a6ff; }
.search-btn {
  background:#1f4a8c; color:#fff; border:1px solid #1f4a8c; border-radius:6px;
  padding:8px 16px; font-size:13px; cursor:pointer;
}
.search-btn:hover { background:#2a5aa0; }
.search-target-select {
  background:#0d1424; border:1px solid #30363d; border-radius:6px;
  color:#e6edf3; padding:8px 10px; font-size:13px; cursor:pointer;
}
.search-target-select:focus { outline:none; border-color:#58a6ff; }
.status-line { color:#8b949e; font-size:12px; margin-bottom:10px; min-height:16px; }
.gallery {
  display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:10px;
}
.gallery-item {
  background:#0d1424; border:1px solid #1e2a40; border-radius:8px; overflow:hidden;
  cursor:pointer; display:flex; flex-direction:column;
}
.gallery-item:hover { border-color:#58a6ff; }
.gallery-thumb { width:100%; height:120px; object-fit:cover; display:block; background:#000; }
.gallery-caption { padding:6px 8px; font-size:11px; color:#8b949e; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.preview-overlay {
  position:fixed; inset:0; background:rgba(0,0,0,0.65); display:none;
  align-items:center; justify-content:center; z-index:1000; padding:16px;
}
.preview-overlay.open { display:flex; }
.preview-box {
  background:#0d1424; border:1px solid #1e2a40; border-radius:10px;
  width:100%; max-width:640px; max-height:85vh; display:flex; flex-direction:column;
}
.preview-head {
  display:flex; align-items:center; gap:10px; padding:10px 14px;
  border-bottom:1px solid #1e2a40; flex-shrink:0;
}
.preview-title { font-size:13px; font-weight:700; flex:1; }
.preview-meta { font-size:11px; color:#8b949e; }
.preview-close { background:none; border:none; color:#8b949e; font-size:16px; cursor:pointer; padding:2px 6px; }
.preview-close:hover { color:#e6edf3; }
.preview-chat { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:12px; }
.preview-bubble {
  max-width:90%; padding:10px 12px; border-radius:10px; font-size:13px;
  line-height:1.5; white-space:pre-wrap; word-break:break-word;
}
.preview-bubble.user { align-self:flex-end; background:#1f4a8c; color:#fff; border-bottom-right-radius:2px; }
.preview-bubble.assistant { align-self:flex-start; background:#161b22; color:#e6edf3; border:1px solid #30363d; border-bottom-left-radius:2px; }
.preview-bubble.assistant.preview-area { white-space:normal; }
.preview-bubble-image { max-width:220px; max-height:220px; border-radius:6px; display:block; margin-bottom:6px; }
.preview-highlight-toggle { background:none; border:none; color:#8b949e; font-size:14px; cursor:pointer; padding:2px 6px; opacity:0.2; }
.preview-highlight-toggle:hover { color:#e6edf3; }
.preview-branch-toggle { background:#161b22; border:1px solid #30363d; color:#8b949e; font-size:11px; cursor:pointer; padding:4px 8px; border-radius:6px; white-space:nowrap; }
.preview-branch-toggle:hover { color:#e6edf3; border-color:#58a6ff; }
.kw-highlight { background:#fef08a; color:#1a1a1a; border-radius:2px; padding:0 1px; }
.preview-chat.highlights-hidden .kw-highlight { background:transparent; color:inherit; outline:none; }
.branch-overlay {
  position:fixed; inset:0; background:rgba(0,0,0,0.72); display:none;
  align-items:center; justify-content:center; z-index:1100; padding:16px;
}
.branch-overlay.open { display:flex; }
.branch-box {
  background:#0d1424; border:1px solid #1e2a40; border-radius:10px;
  width:100%; max-width:560px; max-height:90vh; display:flex; flex-direction:column;
}
.branch-head {
  display:flex; align-items:center; gap:10px; padding:10px 14px;
  border-bottom:1px solid #1e2a40; flex-shrink:0;
}
.branch-title { font-size:13px; font-weight:700; flex:1; }
.branch-close { background:none; border:none; color:#8b949e; font-size:16px; cursor:pointer; padding:2px 6px; }
.branch-close:hover { color:#e6edf3; }
.branch-body { padding:12px; display:flex; flex-direction:column; gap:10px; align-items:center; overflow-y:auto; }
.branch-body canvas { max-width:100%; touch-action:manipulation; cursor:pointer; }
.branch-panel {
  width:100%; min-height:60px; max-height:220px; overflow-y:auto; background:#161b22;
  border:1px solid #30363d; border-radius:8px; padding:10px 12px; font-size:12px;
  line-height:1.6; color:#8b949e; white-space:pre-wrap; word-break:break-word;
}
${getMarkdownPreviewCSS()}
</style>
</head>
<body>
<div class="topbar">
  <h1>🖼️ AIチャット画像検索</h1>
  <a href="/">ホーム</a>
  <a href="/aichat">AIチャット</a>
</div>
<div class="wrap">
  <div class="hint">${safeUser} さんのAIチャット履歴(ai_chat_shares)のうち、画像添付付きの会話を検索します。検索対象は「llama-4」(質問文・回答文)と「moondream3.1」(画像分析結果)から選べます。画像をタップすると質問(バブル)と回答(バブル)を表示します。</div>
  <div class="search-row">
    <select class="search-target-select" id="gallerySearchTarget">
      <option value="llama-4" selected>llama-4(質問・回答)</option>
      <option value="moondream3.1">moondream3.1(画像分析)</option>
    </select>
    <input class="search-input" id="gallerySearchInput" type="search" placeholder="キーワードを入力..." autocomplete="off">
    <button type="button" class="search-btn" id="gallerySearchBtn">🔍 検索</button>
  </div>
  <div class="status-line" id="galleryStatus"></div>
  <div class="gallery" id="galleryGrid"></div>
</div>
<div class="preview-overlay" id="previewOverlay">
  <div class="preview-box">
    <div class="preview-head">
      <div class="preview-title">🖼️ 画像添付会話のプレビュー</div>
      <div class="preview-meta" id="previewMeta"></div>
      <button type="button" class="preview-highlight-toggle" id="previewHighlightToggle" title="キーワードハイライトON/OFF">🔑</button>
      <button type="button" class="preview-branch-toggle" id="previewBranchToggle" title="この画像に対する全モデルの出力を分派図で見る">🌳 分派を見る</button>
      <button type="button" class="preview-close" id="previewClose" aria-label="閉じる">✕</button>
    </div>
    <div class="preview-chat" id="previewChat"></div>
  </div>
</div>
<div class="branch-overlay" id="branchOverlay">
  <div class="branch-box">
    <div class="branch-head">
      <div class="branch-title">🌳 分派図(このimageIdに紐づく全モデルの出力)</div>
      <button type="button" class="branch-close" id="branchClose" aria-label="閉じる">✕</button>
    </div>
    <div class="branch-body">
      <canvas id="branchCanvas" width="480" height="480"></canvas>
      <div class="branch-panel" id="branchPanel">ノードをタップすると内容を表示します</div>
    </div>
  </div>
</div>
<script>
${getMarkdownParserScript()}
${getKeywordHighlightScript()}
(function() {
  var MODEL_COLORS = ${modelColorsJson};
  var searchTarget = document.getElementById('gallerySearchTarget');
  var searchInput = document.getElementById('gallerySearchInput');
  var searchBtn = document.getElementById('gallerySearchBtn');
  var statusLine = document.getElementById('galleryStatus');
  var galleryGrid = document.getElementById('galleryGrid');
  var previewOverlay = document.getElementById('previewOverlay');
  var previewChat = document.getElementById('previewChat');
  var previewMeta = document.getElementById('previewMeta');
  var previewClose = document.getElementById('previewClose');
  var previewHighlightToggle = document.getElementById('previewHighlightToggle');
  var previewBranchToggle = document.getElementById('previewBranchToggle');
  var branchOverlay = document.getElementById('branchOverlay');
  var branchClose = document.getElementById('branchClose');
  var branchCanvas = document.getElementById('branchCanvas');
  var branchPanel = document.getElementById('branchPanel');

  var currentResults = [];
  var currentSearchKeyword = '';

  // ===== キーワードハイライトON/OFF(AIチャットの詳細プレビューモーダルと共通のapplyKeywordHighlight/clearKeywordHighlightsを使用) =====
  var previewCurrentId = null;
  var previewCurrentImageId = null;
  var previewHighlightActive = false;
  var previewKeywordsFromDB = [];
  var previewDBKeywordsApplied = false;

  function updatePreviewHighlightBtn() {
    var marks = previewChat.querySelectorAll('.kw-highlight');
    if (!marks || marks.length === 0) {
      previewHighlightToggle.style.opacity = '0.2';
      previewHighlightToggle.title = 'クリックでキーワードをハイライト表示';
      return;
    }
    if (previewHighlightActive) {
      previewHighlightToggle.style.opacity = '1';
      previewHighlightToggle.title = '🔑 ハイライト表示中(クリックで非表示)';
    } else {
      previewHighlightToggle.style.opacity = '0.35';
      previewHighlightToggle.title = '🔑 ハイライト非表示(クリックで表示)';
    }
  }

  previewHighlightToggle.addEventListener('click', function(e) {
    e.stopPropagation();
    if (!previewDBKeywordsApplied && previewCurrentId != null) {
      fetch('/api/aichat/share-keywords?shareId=' + encodeURIComponent(String(previewCurrentId)), { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          previewKeywordsFromDB = (d.keywords || []).map(function(k) { return k.keyword; });
          previewDBKeywordsApplied = true;
          var allKws = currentSearchKeyword ? [currentSearchKeyword].concat(previewKeywordsFromDB) : previewKeywordsFromDB.slice();
          previewHighlightActive = true;
          previewChat.classList.remove('highlights-hidden');
          clearKeywordHighlights(previewChat);
          if (allKws.length > 0) applyKeywordHighlight(previewChat, allKws);
          updatePreviewHighlightBtn();
        })
        .catch(function() { updatePreviewHighlightBtn(); });
      return;
    }
    var marks = previewChat.querySelectorAll('.kw-highlight');
    if (!marks || marks.length === 0) return;
    previewHighlightActive = !previewHighlightActive;
    previewChat.classList.toggle('highlights-hidden', !previewHighlightActive);
    updatePreviewHighlightBtn();
  });

  function openPreview(item) {
    previewMeta.innerHTML = '';
    var modelSpan = document.createElement('span');
    var modelColor = MODEL_COLORS[item.model];
    if (modelColor) modelSpan.style.color = modelColor;
    modelSpan.textContent = item.model;
    previewMeta.appendChild(modelSpan);
    previewMeta.appendChild(document.createTextNode('　' + item.created_at));
    previewChat.innerHTML = '';

    var userBubble = document.createElement('div');
    userBubble.className = 'preview-bubble user';
    var img = document.createElement('img');
    img.className = 'preview-bubble-image';
    img.src = item.image_data_url;
    img.alt = '添付画像';
    userBubble.appendChild(img);
    var qText = document.createElement('div');
    qText.textContent = item.question;
    userBubble.appendChild(qText);
    previewChat.appendChild(userBubble);

    var assistantBubble = document.createElement('div');
    assistantBubble.className = 'preview-bubble assistant preview-area';
    assistantBubble.innerHTML = parseMd(item.answer);
    previewChat.appendChild(assistantBubble);

    previewCurrentId = item.id;
    previewCurrentImageId = item.image_id || null;
    branchLastImageUrl = item.image_data_url || null;
    previewKeywordsFromDB = [];
    previewDBKeywordsApplied = false;
    previewChat.classList.remove('highlights-hidden');
    if (currentSearchKeyword) {
      applyKeywordHighlight(previewChat, currentSearchKeyword);
      previewHighlightActive = true;
    } else {
      previewHighlightActive = false;
    }
    updatePreviewHighlightBtn();

    previewOverlay.classList.add('open');
  }

  function closePreview() { previewOverlay.classList.remove('open'); }
  previewClose.addEventListener('click', function(e) { e.stopPropagation(); closePreview(); });
  previewOverlay.addEventListener('click', function(e) { if (e.target === previewOverlay) closePreview(); });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && previewOverlay.classList.contains('open')) closePreview(); });

  // ===== 分派図(閲覧専用): 1枚のimage_idに紐づくllama-4/moondream3.1の全出力を
  // canvasの放射状ツリーで表示する。編集・関係修復UIは一切持たない。 =====

  // 中心(画像サムネイル)を基準に、count個のノードを円周上へ均等配置する純粋関数。
  // count<=0でも例外を投げず空配列を返す。
  function computeRadialLayout(centerX, centerY, radius, count) {
    var positions = [];
    if (count <= 0) return positions;
    for (var i = 0; i < count; i++) {
      var angle = (Math.PI * 2 * i) / count - Math.PI / 2;
      positions.push({
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      });
    }
    return positions;
  }

  // ノードタップ時にポップアップ(branchPanel)へ表示するテキストを選ぶ純粋関数。
  // llama-4行は質問+回答、moondream3.1行はanalysis_text(=answerに詰めて渡す)のみ。
  function selectBranchPopupContent(item) {
    if (!item) return '';
    if (item.modelFamily === 'moondream3.1') {
      return '[' + item.model + '] ' + (item.answer || '');
    }
    var q = item.question || '(質問なし)';
    var a = item.answer || '(回答なし)';
    return '[' + item.model + '] Q: ' + q + '\\nA: ' + a;
  }

  var branchItems = [];
  var branchNodePositions = [];
  var branchLastImageUrl = null;

  function drawBranchDiagram(imageUrl, items) {
    if (!branchCanvas || !branchCanvas.getContext) return;
    var ctx = branchCanvas.getContext('2d');
    if (!ctx) return;
    var w = branchCanvas.width, h = branchCanvas.height;
    var cx = w / 2, cy = h / 2;
    var radius = Math.min(w, h) / 2 - 60;
    ctx.clearRect(0, 0, w, h);

    branchNodePositions = computeRadialLayout(cx, cy, radius, items.length);

    // 中心から各ノードへ、モデル別の色(MODEL_COLORS、未登録なら灰色)で線を引く
    branchNodePositions.forEach(function(pos, i) {
      var item = items[i];
      var color = (MODEL_COLORS && MODEL_COLORS[item.model]) || '#586069';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // 中心ノード(画像サムネイル)は円で代用描画(読み込み待ちを避けるため画像自体は描かない)
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fillStyle = '#1f4a8c';
    ctx.fill();

    branchNodePositions.forEach(function(pos, i) {
      var item = items[i];
      var color = (MODEL_COLORS && MODEL_COLORS[item.model]) || '#586069';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 14, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.fillStyle = '#e6edf3';
      ctx.fillText(item.modelFamily === 'moondream3.1' ? '🌙' : '💬', pos.x - 6, pos.y + 4);
    });
  }

  function findBranchNodeIndexAt(x, y) {
    for (var i = 0; i < branchNodePositions.length; i++) {
      var pos = branchNodePositions[i];
      var dx = x - pos.x, dy = y - pos.y;
      if (Math.sqrt(dx * dx + dy * dy) <= 16) return i;
    }
    return -1;
  }

  if (branchCanvas) {
    branchCanvas.addEventListener('click', function(e) {
      var rect = branchCanvas.getBoundingClientRect();
      var scaleX = branchCanvas.width / rect.width;
      var scaleY = branchCanvas.height / rect.height;
      var x = (e.clientX - rect.left) * scaleX;
      var y = (e.clientY - rect.top) * scaleY;
      var idx = findBranchNodeIndexAt(x, y);
      if (idx < 0) return;
      var content = selectBranchPopupContent(branchItems[idx]);
      branchPanel.textContent = content;
      clearKeywordHighlights(branchPanel);
      if (currentSearchKeyword) applyKeywordHighlight(branchPanel, currentSearchKeyword);
    });
  }

  function openBranchOverlay() {
    if (!previewCurrentImageId) {
      branchPanel.textContent = 'この会話には画像IDが紐づいていないため分派図を表示できません';
      branchOverlay.classList.add('open');
      return;
    }
    branchPanel.textContent = '読み込み中...';
    branchOverlay.classList.add('open');
    fetch('/api/aichat/image-branches?imageId=' + encodeURIComponent(previewCurrentImageId), { credentials: 'same-origin' })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        branchItems = (data && data.items) || [];
        branchPanel.textContent = branchItems.length + ' 件の出力が見つかりました。ノードをタップすると内容を表示します';
        drawBranchDiagram(branchLastImageUrl, branchItems);
      })
      .catch(function() {
        branchPanel.textContent = '分派図の取得に失敗しました';
      });
  }

  function closeBranchOverlay() { branchOverlay.classList.remove('open'); }

  if (previewBranchToggle) {
    previewBranchToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      openBranchOverlay();
    });
  }
  if (branchClose) {
    branchClose.addEventListener('click', function(e) { e.stopPropagation(); closeBranchOverlay(); });
  }
  if (branchOverlay) {
    branchOverlay.addEventListener('click', function(e) { if (e.target === branchOverlay) closeBranchOverlay(); });
  }
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && branchOverlay && branchOverlay.classList.contains('open')) closeBranchOverlay(); });

  function renderGallery(results) {
    currentResults = results;
    galleryGrid.innerHTML = '';
    results.forEach(function(item) {
      var cell = document.createElement('div');
      cell.className = 'gallery-item';
      var thumb = document.createElement('img');
      thumb.className = 'gallery-thumb';
      thumb.src = item.image_data_url;
      thumb.alt = '添付画像';
      var caption = document.createElement('div');
      caption.className = 'gallery-caption';
      caption.textContent = item.question;
      cell.appendChild(thumb);
      cell.appendChild(caption);
      cell.addEventListener('click', function() { openPreview(item); });
      galleryGrid.appendChild(cell);
    });
  }

  // インクリメントサーチでは入力のたびにfetchが飛ぶため、後から送ったリクエスト
  // より先に古いリクエストの応答が返ってくる(ネットワーク遅延の逆転)ことがある。
  // 最新のリクエストのみ結果を反映するよう、リクエストごとに連番を振って
  // 応答時に「自分が最新か」を確認する。
  var searchRequestSeq = 0;
  function doSearch() {
    var q = searchInput.value.trim();
    var seq = ++searchRequestSeq;
    if (!q) { statusLine.textContent = 'キーワードを入力してください'; galleryGrid.innerHTML = ''; return; }
    currentSearchKeyword = q;
    statusLine.textContent = '検索中...';
    var target = searchTarget.value;
    fetch('/api/aichat/image-gallery-search?q=' + encodeURIComponent(q) + '&target=' + encodeURIComponent(target), { credentials: 'same-origin' })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (seq !== searchRequestSeq) return;
        var results = (data && data.results) || [];
        renderGallery(results);
        statusLine.textContent = results.length + ' 件ヒットしました';
      })
      .catch(function() {
        if (seq !== searchRequestSeq) return;
        statusLine.textContent = '検索に失敗しました';
      });
  }

  var INCREMENTAL_SEARCH_DEBOUNCE_MS = 300;
  var incrementalSearchTimer = null;
  searchInput.addEventListener('input', function() {
    if (incrementalSearchTimer) clearTimeout(incrementalSearchTimer);
    incrementalSearchTimer = setTimeout(doSearch, INCREMENTAL_SEARCH_DEBOUNCE_MS);
  });
  searchBtn.addEventListener('click', function() {
    if (incrementalSearchTimer) { clearTimeout(incrementalSearchTimer); incrementalSearchTimer = null; }
    doSearch();
  });
  searchInput.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter') return;
    if (incrementalSearchTimer) { clearTimeout(incrementalSearchTimer); incrementalSearchTimer = null; }
    doSearch();
  });
  searchTarget.addEventListener('change', function() {
    if (!searchInput.value.trim()) return;
    if (incrementalSearchTimer) { clearTimeout(incrementalSearchTimer); incrementalSearchTimer = null; }
    doSearch();
  });
})();
</script>
</body>
</html>`;
}
