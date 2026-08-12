function escH(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(s: string): string {
  return escH(s).replace(/"/g, '&quot;');
}

export type MoondreamAnalyzeLogRow = {
  id: number;
  status: string;
  model: string;
  prompt_length: number;
  image_bytes: number;
  error_message: string | null;
  created_at: string;
  image_data_url: string | null;
  prompt_text: string | null;
  analysis_text: string | null;
};

export function buildMoondreamAnalyzeLogRowsHtml(rows: MoondreamAnalyzeLogRow[]): string {
  if (rows.length === 0) {
    return '<div class="empty">ログがありません</div>';
  }
  return rows.map((row) => {
    const statusClass = row.status === 'ok' ? 'status-ok' : 'status-error';
    const statusLabel = row.status === 'ok' ? 'OK' : 'ERROR';
    const errorCell = row.error_message ? escH(row.error_message) : '-';
    const imageCell = row.image_data_url
      ? `<a href="${escH(row.image_data_url)}" download="moondream-log-${row.id}.png" target="_blank" rel="noopener"><img class="thumb" src="${escH(row.image_data_url)}" alt="添付画像"></a>`
      : '-';
    return `<div class="log-item" data-id="${row.id}">
      <button type="button" class="log-delete-btn">削除</button>
      <div class="log-swipe-inner" tabindex="0" role="button"
        data-preview="1"
        data-status="${escAttr(row.status)}"
        data-model="${escAttr(row.model)}"
        data-created="${escAttr(row.created_at)}"
        data-prompt="${escAttr(row.prompt_text || '')}"
        data-analysis="${escAttr(row.analysis_text || '')}"
        data-error="${escAttr(row.error_message || '')}"
        data-image="${row.image_data_url ? escAttr(row.image_data_url) : ''}">
        <div class="log-cell log-cell-date">${escH(row.created_at)}</div>
        <div class="log-cell log-cell-status"><span class="badge ${statusClass}">${statusLabel}</span></div>
        <div class="log-cell log-cell-model">${escH(row.model)}</div>
        <div class="log-cell log-cell-plen">${row.prompt_length}</div>
        <div class="log-cell log-cell-bytes">${row.image_bytes}</div>
        <div class="log-cell log-cell-image">${imageCell}</div>
        <div class="log-cell log-cell-error">${errorCell}</div>
      </div>
    </div>`;
  }).join('\n');
}

export function getMoondreamAnalyzeLogPage(username: string, rows: MoondreamAnalyzeLogRow[]): string {
  const safeUser = escH(username);
  const rowsHtml = buildMoondreamAnalyzeLogRowsHtml(rows);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#000010">
<title>📋 Moondream 分析ログ</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { background:#000010; color:#e6edf3; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:13px; min-height:100vh; min-height:100svh; display:flex; flex-direction:column; }
.topbar { background:rgba(0,0,20,0.95); border-bottom:1px solid #1e2a40; padding:8px 18px; display:flex; align-items:center; gap:10px; flex-shrink:0; }
.topbar a { color:#58a6ff; text-decoration:none; font-size:12px; }
.topbar a:hover { text-decoration:underline; }
h1 { font-size:15px; font-weight:700; flex:1; }
.wrap { max-width:960px; margin:0 auto; padding:24px 18px 60px; width:100%; overflow-x:auto; }
.hint { color:#8b949e; font-size:12px; margin-bottom:14px; }
.log-list { min-width:820px; font-size:12px; }
.log-header, .log-cell-row { display:grid; grid-template-columns: 150px 70px 170px 90px 90px 90px 1fr; }
.log-header { color:#8b949e; font-weight:600; background:rgba(20,25,45,0.6); border-bottom:1px solid #1e2a40; }
.log-header > div { padding:6px 8px; }
.log-item { position:relative; overflow:hidden; border-bottom:1px solid #1e2a40; touch-action:pan-y; }
.log-delete-btn {
  position:absolute; top:0; right:0; height:100%; width:72px;
  background:#b91c1c; color:#fff; border:none; font-size:12px; cursor:pointer;
  opacity:0; pointer-events:none; transition:opacity 0.15s ease;
}
.log-item.swipe-open .log-delete-btn { opacity:1; pointer-events:auto; }
.log-swipe-inner {
  display:grid; grid-template-columns: 150px 70px 170px 90px 90px 90px 1fr;
  background:#000010; position:relative; z-index:1; cursor:pointer;
}
.log-swipe-inner:hover { background:#0a1120; }
.log-cell { padding:6px 8px; vertical-align:top; white-space:nowrap; }
.log-cell-error { white-space:pre-wrap; color:#ff7b72; max-width:420px; }
.empty { color:#8b949e; text-align:center; padding:20px; }
.thumb { max-width:80px; max-height:80px; border-radius:4px; display:block; border:1px solid #30363d; }
.badge { display:inline-block; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:600; }
.status-ok { background:#0d2818; color:#3fb950; }
.status-error { background:#2a0f10; color:#ff7b72; }
.confirm-overlay {
  position:fixed; inset:0; background:rgba(0,0,0,0.6); display:none;
  align-items:center; justify-content:center; z-index:1000;
}
.confirm-overlay.open { display:flex; }
.confirm-box {
  background:#0d1424; border:1px solid #1e2a40; border-radius:8px; padding:18px 20px;
  min-width:240px; text-align:center;
}
.confirm-box p { margin-bottom:14px; }
.confirm-box .buttons { display:flex; gap:10px; justify-content:center; }
.confirm-box button { padding:6px 16px; border-radius:6px; border:1px solid #30363d; cursor:pointer; font-size:12px; }
.confirm-ok { background:#b91c1c; color:#fff; border-color:#b91c1c; }
.confirm-cancel { background:#161b22; color:#e6edf3; }
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
.preview-close {
  background:none; border:none; color:#8b949e; font-size:16px; cursor:pointer; padding:2px 6px;
}
.preview-close:hover { color:#e6edf3; }
.preview-chat { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:12px; }
.preview-bubble {
  max-width:90%; padding:10px 12px; border-radius:10px; font-size:13px;
  line-height:1.5; white-space:pre-wrap; word-break:break-word;
}
.preview-bubble.user { align-self:flex-end; background:#1f4a8c; color:#fff; border-bottom-right-radius:2px; }
.preview-bubble.assistant { align-self:flex-start; background:#161b22; color:#e6edf3; border:1px solid #30363d; border-bottom-left-radius:2px; }
.preview-bubble.error { align-self:flex-start; background:#2a0f10; color:#ff7b72; border:1px solid #6e2426; border-bottom-left-radius:2px; }
.preview-bubble-image { max-width:220px; max-height:220px; border-radius:6px; display:block; margin-bottom:6px; }
</style>
</head>
<body>
<div class="topbar">
  <h1>📋 Moondream 分析ログ</h1>
  <a href="/">ホーム</a>
  <a href="/moondream-vlm">Moondream VLM</a>
</div>
<div class="wrap">
  <div class="hint">/api/moondream-analyze の呼び出し履歴(直近100件・新しい順)。${safeUser} さんの分析履歴を表示しています。サムネイルをクリックすると元画像を新しいタブで開けます。行を左スワイプ(またはドラッグ)すると削除ボタンが表示され、確認後にデータベースから該当行を削除します。</div>
  <div class="log-list" id="logList">
    <div class="log-header">
      <div>日時</div>
      <div>結果</div>
      <div>モデル</div>
      <div>プロンプト長</div>
      <div>画像バイト数</div>
      <div>添付画像</div>
      <div>エラー内容</div>
    </div>
    <div id="logItems">
${rowsHtml}
    </div>
  </div>
</div>
<div class="confirm-overlay" id="deleteConfirmOverlay">
  <div class="confirm-box">
    <p>このログを削除しますか?</p>
    <div class="buttons">
      <button type="button" class="confirm-ok" id="deleteConfirmOk">削除</button>
      <button type="button" class="confirm-cancel" id="deleteConfirmCancel">キャンセル</button>
    </div>
  </div>
</div>
<div class="preview-overlay" id="previewOverlay">
  <div class="preview-box">
    <div class="preview-head">
      <div class="preview-title">🔍 分析ログの詳細</div>
      <div class="preview-meta" id="previewMeta"></div>
      <button type="button" class="preview-close" id="previewClose" aria-label="閉じる">✕</button>
    </div>
    <div class="preview-chat" id="previewChat"></div>
  </div>
</div>
<script>
(function() {
  var logItems = document.getElementById('logItems');
  var deleteConfirmOverlay = document.getElementById('deleteConfirmOverlay');
  var deleteConfirmOk = document.getElementById('deleteConfirmOk');
  var deleteConfirmCancel = document.getElementById('deleteConfirmCancel');
  if (!logItems) return;

  var swipeOpenItem = null;
  var swipeOpenInner = null;
  var pendingDeleteId = null;
  var pendingDeleteItem = null;

  function closeSwipeOpen() {
    if (swipeOpenInner) {
      swipeOpenInner.style.transition = 'transform 0.2s ease';
      swipeOpenInner.style.transform = 'translateX(0)';
    }
    if (swipeOpenItem) swipeOpenItem.classList.remove('swipe-open');
    swipeOpenItem = null; swipeOpenInner = null;
  }

  function showDeleteConfirm(id, item) {
    pendingDeleteId = id; pendingDeleteItem = item;
    deleteConfirmOverlay.classList.add('open');
  }

  function hideDeleteConfirm() {
    deleteConfirmOverlay.classList.remove('open');
    if (pendingDeleteItem) {
      var inner = pendingDeleteItem.querySelector('.log-swipe-inner');
      if (inner) { inner.style.transition = 'transform 0.2s ease'; inner.style.transform = 'translateX(0)'; }
      pendingDeleteItem.classList.remove('swipe-open');
      if (swipeOpenItem === pendingDeleteItem) { swipeOpenItem = null; swipeOpenInner = null; }
    }
    pendingDeleteId = null; pendingDeleteItem = null;
  }

  function animateDeleteItem(item) {
    item.style.overflow = 'hidden';
    var h = item.offsetHeight;
    item.style.height = h + 'px';
    item.style.transition = 'opacity 0.25s ease';
    item.style.opacity = '0';
    setTimeout(function() {
      item.style.transition = 'height 0.3s ease, border 0.3s ease';
      item.style.height = '0';
      item.style.borderBottomWidth = '0';
      setTimeout(function() {
        item.remove();
        if (!logItems.querySelector('.log-item')) {
          var empty = document.createElement('div');
          empty.className = 'empty';
          empty.textContent = 'ログがありません';
          logItems.appendChild(empty);
        }
      }, 320);
    }, 260);
  }

  deleteConfirmCancel.addEventListener('click', function(e) { e.stopPropagation(); hideDeleteConfirm(); });
  deleteConfirmOk.addEventListener('click', function(e) {
    e.stopPropagation();
    var id = pendingDeleteId; var item = pendingDeleteItem;
    if (!id || !item) return;
    hideDeleteConfirm();
    fetch('/api/moondream-analyze-log/' + encodeURIComponent(id), { method: 'DELETE', credentials: 'same-origin' })
      .then(function(res) { if (!res.ok) throw new Error('failed'); animateDeleteItem(item); })
      .catch(function() { alert('削除に失敗しました'); });
  });
  deleteConfirmOverlay.addEventListener('click', function(e) {
    if (e.target === deleteConfirmOverlay) hideDeleteConfirm();
  });

  function addSwipeBehavior(item, inner) {
    var startX = 0, dragging = false, moved = false;
    var THRESHOLD = 50, BTN_W = 72;
    function isOpen() { return swipeOpenItem === item; }
    function onStart(x) { startX = x; dragging = true; moved = false; }
    function onMove(x) {
      if (!dragging) return;
      var dx = x - startX;
      if (Math.abs(dx) < 4) return;
      moved = true;
      var base = isOpen() ? -BTN_W : 0;
      var tx = Math.max(-BTN_W, Math.min(0, base + dx));
      inner.style.transition = 'none';
      inner.style.transform = 'translateX(' + tx + 'px)';
    }
    function onEnd(x) {
      if (!dragging) return;
      dragging = false;
      var dx = x - startX;
      inner.style.transition = 'transform 0.2s ease';
      if (!moved) return;
      if (isOpen()) {
        if (dx > BTN_W / 2) { closeSwipeOpen(); }
        else { inner.style.transform = 'translateX(-' + BTN_W + 'px)'; }
      } else {
        if (-dx > THRESHOLD) {
          if (swipeOpenItem && swipeOpenItem !== item) closeSwipeOpen();
          inner.style.transform = 'translateX(-' + BTN_W + 'px)';
          item.classList.add('swipe-open');
          swipeOpenItem = item; swipeOpenInner = inner;
        } else {
          inner.style.transform = 'translateX(0)';
        }
      }
    }
    item.addEventListener('touchstart', function(e) { onStart(e.touches[0].clientX); }, { passive: true });
    item.addEventListener('touchmove', function(e) { onMove(e.touches[0].clientX); }, { passive: true });
    item.addEventListener('touchend', function(e) { onEnd(e.changedTouches[0].clientX); });
    var mouseDown = false;
    inner.addEventListener('mousedown', function(e) { if (e.button !== 0) return; mouseDown = true; onStart(e.clientX); });
    document.addEventListener('mousemove', function(e) { if (!mouseDown) return; onMove(e.clientX); });
    document.addEventListener('mouseup', function(e) { if (!mouseDown) return; mouseDown = false; onEnd(e.clientX); });
  }

  // AIチャットの「詳細プレビュー」(historyModal)と同様に、行をタップすると
  // その分析ログ1件をユーザー(プロンプト)/アシスタント(分析結果 or エラー)の
  // チャットバブル形式で表示する。データは行のdata-*属性にサーバー側で埋め込み
  // 済みのため、追加のfetchなしで即座に開ける。
  var previewOverlay = document.getElementById('previewOverlay');
  var previewChat = document.getElementById('previewChat');
  var previewMeta = document.getElementById('previewMeta');
  var previewClose = document.getElementById('previewClose');

  function openPreview(inner) {
    var status = inner.getAttribute('data-status');
    var model = inner.getAttribute('data-model');
    var created = inner.getAttribute('data-created');
    var prompt = inner.getAttribute('data-prompt');
    var analysis = inner.getAttribute('data-analysis');
    var errorMessage = inner.getAttribute('data-error');
    var image = inner.getAttribute('data-image');

    previewMeta.textContent = model + '　' + created;
    previewChat.innerHTML = '';

    var userBubble = document.createElement('div');
    userBubble.className = 'preview-bubble user';
    if (image) {
      var img = document.createElement('img');
      img.className = 'preview-bubble-image';
      img.src = image;
      img.alt = '添付画像';
      userBubble.appendChild(img);
    }
    var promptText = document.createElement('div');
    promptText.textContent = prompt || '(プロンプトが記録されていません)';
    userBubble.appendChild(promptText);
    previewChat.appendChild(userBubble);

    var assistantBubble = document.createElement('div');
    if (status === 'ok') {
      assistantBubble.className = 'preview-bubble assistant';
      assistantBubble.textContent = analysis || '(分析結果が記録されていません)';
    } else {
      assistantBubble.className = 'preview-bubble error';
      assistantBubble.textContent = errorMessage || 'エラーが発生しました';
    }
    previewChat.appendChild(assistantBubble);

    previewOverlay.classList.add('open');
  }

  function closePreview() {
    previewOverlay.classList.remove('open');
  }

  previewClose.addEventListener('click', function(e) { e.stopPropagation(); closePreview(); });
  previewOverlay.addEventListener('click', function(e) { if (e.target === previewOverlay) closePreview(); });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && previewOverlay.classList.contains('open')) closePreview(); });

  var items = logItems.querySelectorAll('.log-item');
  items.forEach(function(item) {
    var inner = item.querySelector('.log-swipe-inner');
    var delBtn = item.querySelector('.log-delete-btn');
    var id = item.getAttribute('data-id');
    if (delBtn) {
      delBtn.addEventListener('click', function(e) { e.stopPropagation(); showDeleteConfirm(id, item); });
    }
    if (inner) {
      addSwipeBehavior(item, inner);
      inner.addEventListener('click', function(e) {
        if (e.target && e.target.closest && e.target.closest('a')) return;
        if (swipeOpenItem === item) return;
        openPreview(inner);
      });
    }
  });
})();
</script>
</body>
</html>`;
}
