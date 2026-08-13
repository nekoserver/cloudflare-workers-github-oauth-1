import { getMarkdownParserScript, getMarkdownPreviewCSS } from '../utils/markdownRenderer';

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
  <div class="hint">${safeUser} さんのAIチャット履歴(ai_chat_shares)のうち、画像添付付きの会話を質問文・回答文のキーワードで検索します。画像をタップすると質問(バブル)と回答(バブル)を表示します。</div>
  <div class="search-row">
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
      <button type="button" class="preview-close" id="previewClose" aria-label="閉じる">✕</button>
    </div>
    <div class="preview-chat" id="previewChat"></div>
  </div>
</div>
<script>
${getMarkdownParserScript()}
(function() {
  var MODEL_COLORS = ${modelColorsJson};
  var searchInput = document.getElementById('gallerySearchInput');
  var searchBtn = document.getElementById('gallerySearchBtn');
  var statusLine = document.getElementById('galleryStatus');
  var galleryGrid = document.getElementById('galleryGrid');
  var previewOverlay = document.getElementById('previewOverlay');
  var previewChat = document.getElementById('previewChat');
  var previewMeta = document.getElementById('previewMeta');
  var previewClose = document.getElementById('previewClose');

  var currentResults = [];

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

    previewOverlay.classList.add('open');
  }

  function closePreview() { previewOverlay.classList.remove('open'); }
  previewClose.addEventListener('click', function(e) { e.stopPropagation(); closePreview(); });
  previewOverlay.addEventListener('click', function(e) { if (e.target === previewOverlay) closePreview(); });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && previewOverlay.classList.contains('open')) closePreview(); });

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
    statusLine.textContent = '検索中...';
    fetch('/api/aichat/image-gallery-search?q=' + encodeURIComponent(q), { credentials: 'same-origin' })
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
})();
</script>
</body>
</html>`;
}
