import { getMarkdownParserScript, getMarkdownPreviewCSS } from '../utils/markdownRenderer';

// dynamicneko の Slash Command Input(/samples)を設定値として組み立てる編集ページ。
// 保存はせず、結果はJSONで出力する(コピー・ダウンロード・読み込み)。
// 注意: template literal 内の <script> にはバックスラッシュ系エスケープと正規表現
// リテラルを書かない(CLAUDE.md ルール29)。改行は String.fromCharCode(10) を使う。
export function getMentionEditorPage(username: string): string {
  void username;
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mention Editor</title>
<style>
:root {
  color-scheme: light dark;
  --bg:          light-dark(#f6f8fa, #0d1117);
  --panel:       light-dark(#ffffff, #161b22);
  --border:      light-dark(#d0d7de, #30363d);
  --text:        light-dark(#1f2328, #c9d1d9);
  --text-muted:  light-dark(#636c76, #8b949e);
  --text-strong: light-dark(#1f2328, #f0f6fc);
  --accent:      light-dark(#0969da, #58a6ff);
  --accent-fg:   light-dark(#ffffff, #0d1117);
  --input-bg:    light-dark(#ffffff, #0d1117);
  --hover:       light-dark(#f3f4f6, #21262d);
  --danger:      light-dark(#cf222e, #f85149);
  --ok:          light-dark(#1a7f37, #3fb950);
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 24px;
  background: var(--bg); color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px; line-height: 1.5;
  max-width: 1100px; margin-left: auto; margin-right: auto;
}
h1 { color: var(--text-strong); font-size: 20px; margin: 0 0 4px; }
.subtitle { color: var(--text-muted); font-size: 12px; margin-bottom: 18px; }
.layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; }
@media (max-width: 800px) { .layout { grid-template-columns: minmax(0, 1fr); } }
.panel {
  background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
  padding: 14px 16px; margin-bottom: 14px; min-width: 0;
}
.panel h2 { font-size: 13px; color: var(--text-muted); margin: 0 0 10px; }
.panel-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
.panel-heading h2 { margin: 0; }
.row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.row label { min-width: 110px; color: var(--text-muted); }
input, select, textarea {
  background: var(--input-bg); color: var(--text);
  border: 1px solid var(--border); border-radius: 6px; padding: 5px 8px; font-size: 13px;
}
input[type=number] { width: 90px; }
.btn {
  background: var(--panel); border: 1px solid var(--border); border-radius: 6px;
  color: var(--text); font-size: 12px; padding: 5px 10px; cursor: pointer;
}
.btn:hover { background: var(--hover); }
.btn.primary { background: var(--accent); color: var(--accent-fg); border-color: var(--accent); }
.saved-row { display: flex; gap: 8px; margin-bottom: 10px; }
.saved-row select { flex: 1; min-width: 0; }
.save-modal { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,.55); display: grid; place-items: center; padding: 20px; }
.save-modal[hidden] { display: none; }
.save-dialog { width: min(420px, 100%); background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 18px; box-shadow: 0 12px 40px rgba(0,0,0,.3); }
.save-dialog label { display: block; color: var(--text-strong); margin-bottom: 6px; }
.save-dialog input { width: 100%; }
.tab-edit { position: relative; border: 1px solid var(--border); border-radius: 6px; padding: 8px; margin-bottom: 8px; touch-action: pan-y; }
.tab-edit.dragging {
  border: 2px dashed var(--danger); opacity: .72; z-index: 10;
  cursor: grabbing; user-select: none; pointer-events: none;
}
.tab-edit.drop-before::before, .tab-edit.drop-after::after {
  content: ''; position: absolute; left: 0; right: 0; border-top: 2px dashed var(--danger);
}
.tab-edit.drop-before::before { top: -6px; }
.tab-edit.drop-after::after { bottom: -6px; }
.drag-handle { cursor: grab; font-size: 16px; line-height: 1; padding: 5px 8px; touch-action: none; }
.drag-handle:active { cursor: grabbing; }
.tab-edit textarea { width: 100%; min-height: 70px; overflow-y: hidden; font-family: ui-monospace, Menlo, Consolas, monospace; }
.hint { color: var(--text-muted); font-size: 11px; }
#jsonOut { width: 100%; min-height: 220px; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px; }
#status { font-size: 12px; min-height: 18px; }
#status.error { color: var(--danger); }
#status.ok { color: var(--ok); }
.preview-wrap { padding: 4px; }
.preview-anchor { position: relative; display: flex; align-items: center; gap: 6px; }
#previewArea { resize: none; max-width: 100%; }
#nekoResult {
  margin-top: 10px; padding: 10px 12px; min-height: 44px; overflow-wrap: anywhere;
  border: 1px solid var(--border); border-radius: 6px; background: var(--input-bg);
}
#nekoResult[hidden] { display: none; }
#nekoResult.error { color: var(--danger); white-space: pre-wrap; }
#nekoResult > :first-child { margin-top: 0; }
#nekoResult > :last-child { margin-bottom: 0; }
${getMarkdownPreviewCSS()}
#previewInput { flex: 1; min-width: 0; margin-top: 6px; }
#previewSlashButton { flex: 0 0 auto; margin-top: 6px; }
.slash-panel {
  position: absolute; left: 0; right: 0; z-index: 5;
  background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
.slash-panel.top { bottom: 100%; margin-bottom: 4px; }
.slash-panel.bottom { top: 100%; margin-top: 4px; }
.slash-tabs { display: flex; border-bottom: 1px solid var(--border); }
.slash-tabs button {
  flex: 1; background: none; border: none; border-bottom: 2px solid transparent;
  color: var(--text-muted); padding: 5px; cursor: pointer; font-size: 12px;
}
.slash-tabs button[aria-selected=true] { color: var(--text-strong); border-bottom-color: var(--accent); }
.slash-body { display: flex; align-items: stretch; }
.slash-body > button { background: none; border: none; color: var(--text-muted); padding: 0 8px; cursor: pointer; }
.slash-body > button:disabled { opacity: 0.3; cursor: default; }
.slash-list { flex: 1; min-height: 5rem; list-style: none; margin: 0; padding: 4px 0; touch-action: pan-y; user-select: none; }
.slash-list button { width: 100%; text-align: left; background: none; border: none; color: var(--text); padding: 3px 6px; cursor: pointer; }
.slash-list button:hover { background: var(--hover); }
.slash-empty { color: var(--text-muted); padding: 3px 6px; }
.slash-page { text-align: center; color: var(--text-muted); font-size: 11px; padding-bottom: 3px; }
.typewriter-box { margin-top: 10px; border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; cursor: pointer; }
.typewriter-box:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.typewriter-box[hidden] { display: none; }
.typewriter-line { margin: 0; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 13px; min-height: 1.4em; }
.typewriter-cursor { display: inline-block; margin-left: 1px; animation: typewriter-blink 1s step-end infinite; }
@keyframes typewriter-blink { 50% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .typewriter-cursor { animation: none; } }
</style>
</head>
<body>
<h1>Mention Editor</h1>
<div class="subtitle">Slash Command Input の設定を編集して JSON で出力します</div>

<div class="layout">
<div>
  <div class="panel">
    <h2>テキストエリア</h2>
    <div class="row">
      <label for="widthValue">横幅</label>
      <input type="number" id="widthValue" value="40" min="1">
      <select id="widthUnit"><option value="ch">半角文字数(ch)</option><option value="px">px</option></select>
    </div>
    <div class="row">
      <label for="heightValue">高さ</label>
      <input type="number" id="heightValue" value="15" min="1">
      <select id="heightUnit"><option value="rows">行数(rows)</option><option value="px">px</option></select>
    </div>
    <div class="hint">範囲: 横 10〜200ch / 100〜2000px、高さ 1〜100行 / 40〜2000px</div>
  </div>

  <div class="panel">
    <h2>候補リスト</h2>
    <div class="row">
      <label for="triggerKey">トリガーキー</label>
      <select id="triggerKey"><option value="/">/</option><option value="@">@</option></select>
    </div>
    <div class="row">
      <label for="position">出現位置</label>
      <select id="position"><option value="top">上(入力窓の上)</option><option value="bottom">下(入力窓の下)</option></select>
    </div>
  </div>

  <div class="panel">
    <h2>タブと候補</h2>
    <div id="tabsEditor"></div>
    <button type="button" class="btn" id="addTab">＋ タブを追加</button>
    <div class="hint">候補は1行に1つ。候補内の半角スペースも使用できます。</div>
  </div>
</div>

<div>
  <div class="panel">
    <div class="panel-heading">
      <h2>プレビュー</h2>
      <button type="button" id="copyModeToggle" class="btn" role="switch" aria-label="default/typewriterを切り替える" aria-checked="false" data-testid="copy-mode-toggle">default</button>
    </div>
    <div class="preview-wrap">
      <textarea id="previewArea" readonly aria-label="テキストエリア(プレビュー)">本文エリア</textarea>
      <div id="nekoResult" class="preview-area" aria-live="polite" aria-label="コマンド実行結果" hidden></div>
      <div class="preview-anchor" id="previewAnchor">
        <button type="button" class="btn" id="previewSlashButton" aria-label="入力をスラッシュに置き換える" hidden>/</button>
        <input id="previewInput" placeholder="/ でコマンド" autocomplete="off" aria-label="コマンド入力欄">
      </div>
      <div class="typewriter-box" id="typewriterOutput" role="button" tabindex="0" aria-label="表示されたコマンドをコマンド入力欄へコピー" hidden>
        <p class="typewriter-line"><span id="typewriterText" data-testid="typewriter-text"></span><span class="typewriter-cursor" aria-hidden="true">▌</span></p>
      </div>
    </div>
  </div>

  <div class="panel">
    <h2>JSON</h2>
    <div class="saved-row">
      <select id="savedDocuments" aria-label="保存済み設定"><option value="">新規設定</option></select>
      <button type="button" class="btn" id="btnLoadSaved">読み込む</button>
    </div>
    <textarea id="jsonOut" spellcheck="false" aria-label="設定JSON"></textarea>
    <div class="row" style="margin-top:8px">
      <button type="button" class="btn primary" id="btnCopy">コピー</button>
      <button type="button" class="btn" id="btnDownload">ダウンロード</button>
      <button type="button" class="btn" id="btnImport">JSONを読み込む</button>
      <button type="button" class="btn primary" id="btnSave">データベースに保存</button>
    </div>
    <div id="status" role="status"></div>
  </div>
</div>
</div>

<div class="save-modal" id="saveModal" hidden role="dialog" aria-modal="true" aria-labelledby="saveModalTitle">
  <div class="save-dialog">
    <h2 id="saveModalTitle">保存タイトル</h2>
    <label for="saveTitle">この設定を識別するタイトル</label>
    <input id="saveTitle" maxlength="100" autocomplete="off">
    <div id="titleStatus" class="hint" role="alert"></div>
    <div class="row" style="margin-top:12px">
      <button type="button" class="btn primary" id="btnConfirmSave">保存</button>
      <button type="button" class="btn" id="btnCancelSave">キャンセル</button>
    </div>
  </div>
</div>

<script>
${getMarkdownParserScript()}
(function() {
  var NL = String.fromCharCode(10);
  var savedDocuments = [];
  var currentDocumentId = null;
  var COPY_MODE_COOKIE = 'mentionEditorCopyMode';

  // 候補選択時の動作の設定値。Cookieから読んだ値が 'typewriter' 以外は
  // すべて 'default' として扱う(未設定・壊れた値・past仕様の値を含む)。
  function resolveCopyMode(raw) {
    return raw === 'typewriter' ? 'typewriter' : 'default';
  }

  function nextCopyMode(mode) {
    return mode === 'typewriter' ? 'default' : 'typewriter';
  }

  // Typewriter Text(dynamicneko /samples)と同じ「1文字ずつ増える」表示コマ割りを
  // 純粋関数として切り出す(DOM・タイマーに依存しないのでテストしやすい)。
  function typewriterFrames(value) {
    var frames = [];
    for (var i = 0; i <= value.length; i++) frames.push(value.slice(0, i));
    return frames;
  }

  function readCookie(name) {
    var raw = document.cookie || '';
    var parts = raw.length ? raw.split('; ') : [];
    for (var i = 0; i < parts.length; i++) {
      var eq = parts[i].indexOf('=');
      if (eq === -1) continue;
      if (parts[i].slice(0, eq) === name) return decodeURIComponent(parts[i].slice(eq + 1));
    }
    return '';
  }

  function writeCookie(name, value) {
    document.cookie = name + '=' + encodeURIComponent(value) + '; path=/; max-age=31536000; SameSite=Lax';
  }

  function normalizeConfig(raw) {
    var LIM = {
      width: { ch: [10, 200], px: [100, 2000] },
      height: { rows: [1, 100], px: [40, 2000] }
    };
    function ng(code, detail) { return { ok: false, errorCode: code, detail: detail }; }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ng('NOT_OBJECT', '設定がオブジェクトではありません');
    if (raw.trigger !== '/' && raw.trigger !== '@') return ng('BAD_TRIGGER', 'トリガーキーは / か @ のみです');
    if (raw.position !== 'top' && raw.position !== 'bottom') return ng('BAD_POSITION', '出現位置は top か bottom のみです');
    var ta = raw.textarea;
    if (!ta || typeof ta !== 'object') return ng('BAD_SIZE', 'textarea の指定がありません');
    var axes = ['width', 'height'];
    var size = {};
    for (var a = 0; a < axes.length; a++) {
      var axis = axes[a];
      var s = ta[axis];
      var range = s && LIM[axis][s.unit];
      if (!range) return ng('BAD_SIZE', axis + ' の単位が不正です');
      var v = s.value;
      if (typeof v !== 'number' || !isFinite(v) || v < range[0] || v > range[1]) {
        return ng('BAD_SIZE', axis + ' は ' + range[0] + '〜' + range[1] + s.unit + ' で指定してください');
      }
      size[axis] = { value: Math.round(v), unit: s.unit };
    }
    if (!Array.isArray(raw.tabs) || raw.tabs.length < 1 || raw.tabs.length > 20) return ng('BAD_TABS', 'タブは1〜20個にしてください');
    var tabs = [];
    for (var i = 0; i < raw.tabs.length; i++) {
      var t = raw.tabs[i] || {};
      var label = typeof t.label === 'string' ? t.label.trim() : '';
      if (!label || label.length > 30) return ng('BAD_TAB_LABEL', (i + 1) + '番目のタブ名は1〜30文字にしてください');
      if (!Array.isArray(t.items) || t.items.length < 1 || t.items.length > 100) {
        return ng('BAD_ITEMS', 'タブ「' + label + '」の候補は1〜100個にしてください');
      }
      var items = [];
      for (var j = 0; j < t.items.length; j++) {
        var it = t.items[j];
        if (typeof it !== 'string' || !it || it.length > 50 || it.trim() !== it || it.split(String.fromCharCode(10)).length > 1 || it.split(String.fromCharCode(13)).length > 1 || it.split(String.fromCharCode(9)).length > 1) {
          return ng('BAD_ITEMS', 'タブ「' + label + '」の候補「' + String(it) + '」はタブ・改行なしの1〜50文字にしてください');
        }
        items.push(it);
      }
      tabs.push({ label: label, items: items });
    }
    return {
      ok: true,
      value: { version: 1, trigger: raw.trigger, position: raw.position, textarea: size, tabs: tabs }
    };
  }

  function findTriggerQuery(text, trigger) {
    if (!text) return null;
    var cut = Math.max(text.lastIndexOf(' '), text.lastIndexOf(String.fromCharCode(10)), text.lastIndexOf(String.fromCharCode(9)));
    var token = text.slice(cut + 1);
    if (token.charAt(0) !== trigger) return null;
    return token.slice(1);
  }

  function validateSaveTitle(title, documents) {
    var normalized = String(title || '').trim();
    if (!normalized || normalized.length > 100) return 'タイトルは1〜100文字で入力してください';
    for (var i = 0; i < documents.length; i++) {
      if (normalized.localeCompare(documents[i].title, undefined, { sensitivity: 'accent' }) === 0) {
        return '同じタイトルが既に登録されています';
      }
    }
    return '';
  }

  function sizeToStyle(t) {
    return {
      width: t.width.value + t.width.unit,
      height: t.height.unit === 'px' ? t.height.value + 'px' : '',
      rows: t.height.unit === 'rows' ? t.height.value : null
    };
  }

  var $ = function(id) { return document.getElementById(id); };
  var widthValue = $('widthValue'), widthUnit = $('widthUnit');
  var heightValue = $('heightValue'), heightUnit = $('heightUnit');
  var triggerKey = $('triggerKey'), positionSel = $('position');
  var tabsEditor = $('tabsEditor'), jsonOut = $('jsonOut'), statusEl = $('status');
  var previewArea = $('previewArea'), previewInput = $('previewInput'), previewAnchor = $('previewAnchor');
  var previewSlashButton = $('previewSlashButton');
  var copyModeToggle = $('copyModeToggle');
  var typewriterOutput = $('typewriterOutput');
  var typewriterText = $('typewriterText');

  var copyMode = resolveCopyMode(readCookie(COPY_MODE_COOKIE));
  var typewriterTimer = null;
  var typewriterValue = '';
  var current = null;
  var page = 0;
  var swipeStart = null;
  var panel = null;
  var draggedTab = null;
  var tabDragPointerId = null;
  var tabDragSource = null;
  var tabDragStartX = 0;
  var tabDragStartY = 0;
  var tabDragCurrentX = 0;
  var tabDragCurrentY = 0;
  var tabDragLongPress = null;

  function setStatus(msg, kind) {
    statusEl.textContent = msg;
    statusEl.className = kind || '';
  }

  function itemTextareaRows(value) {
    return Math.max(4, String(value).split(String.fromCharCode(10)).length);
  }

  function resizeItemsInput(list) {
    list.rows = itemTextareaRows(list.value);
  }

  function addTabRow(label, items) {
    var box = document.createElement('div');
    box.className = 'tab-edit';
    var row = document.createElement('div');
    row.className = 'row';
    var handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'btn drag-handle';
    handle.textContent = '≡';
    handle.title = 'ドラッグして並べ替え';
    handle.setAttribute('aria-label', 'タブと候補をドラッグして並べ替え');
    var name = document.createElement('input');
    name.className = 'tab-label';
    name.placeholder = 'タブ名';
    name.value = label;
    name.setAttribute('aria-label', 'タブ名');
    var del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn';
    del.textContent = '削除';
    del.addEventListener('click', function() { box.remove(); refresh(); });
    row.appendChild(handle);
    row.appendChild(name);
    row.appendChild(del);
    var list = document.createElement('textarea');
    list.className = 'tab-items';
    list.setAttribute('aria-label', '候補(1行に1つ)');
    list.value = items.join(NL);
    resizeItemsInput(list);
    list.addEventListener('input', function() { resizeItemsInput(list); });
    box.appendChild(row);
    box.appendChild(list);
    tabsEditor.appendChild(box);

    handle.addEventListener('pointerdown', function(e) { beginTabPointerDrag(e, box, true); });
    box.addEventListener('pointerdown', function(e) {
      if (e.target === handle || e.target.closest('button, select')) return;
      beginTabPointerDrag(e, box, false);
    });
  }

  function clearDropMarkers() {
    var boxes = tabsEditor.querySelectorAll('.tab-edit');
    for (var i = 0; i < boxes.length; i++) boxes[i].classList.remove('drop-before', 'drop-after');
  }

  function activateTabDrag() {
    if (!tabDragSource || draggedTab) return;
    draggedTab = tabDragSource;
    draggedTab.classList.add('dragging');
    var focused = document.activeElement;
    if (focused && draggedTab.contains(focused) && focused.blur) focused.blur();
    moveDraggedTabToPointer();
  }

  function moveDraggedTabToPointer() {
    if (!draggedTab) return;
    var dx = tabDragCurrentX - tabDragStartX;
    var dy = tabDragCurrentY - tabDragStartY;
    draggedTab.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
  }

  function beginTabPointerDrag(e, box, fromHandle) {
    if (tabDragPointerId !== null || (e.button !== undefined && e.button !== 0)) return;
    tabDragPointerId = e.pointerId;
    tabDragSource = box;
    tabDragStartX = e.clientX;
    tabDragStartY = e.clientY;
    tabDragCurrentX = e.clientX;
    tabDragCurrentY = e.clientY;
    if (box.setPointerCapture) box.setPointerCapture(e.pointerId);
    if (fromHandle) {
      e.preventDefault();
      activateTabDrag();
    } else {
      tabDragLongPress = setTimeout(activateTabDrag, 450);
    }
  }

  function moveTabPointerDrag(e) {
    if (e.pointerId !== tabDragPointerId) return;
    tabDragCurrentX = e.clientX;
    tabDragCurrentY = e.clientY;
    if (!draggedTab) {
      if (Math.hypot(e.clientX - tabDragStartX, e.clientY - tabDragStartY) > 8) cancelTabPointerDrag();
      return;
    }
    e.preventDefault();
    moveDraggedTabToPointer();
    clearDropMarkers();
    var boxes = tabsEditor.querySelectorAll('.tab-edit');
    for (var i = 0; i < boxes.length; i++) {
      if (boxes[i] === draggedTab) continue;
      var rect = boxes[i].getBoundingClientRect();
      if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
        boxes[i].classList.add(e.clientY >= rect.top + rect.height / 2 ? 'drop-after' : 'drop-before');
        break;
      }
    }
  }

  function endTabPointerDrag(e) {
    if (e.pointerId !== tabDragPointerId) return;
    e.preventDefault();
    if (draggedTab) {
      var target = tabsEditor.querySelector('.drop-before, .drop-after');
      if (target) {
        var after = target.classList.contains('drop-after');
        tabsEditor.insertBefore(draggedTab, after ? target.nextSibling : target);
        refresh();
      }
    }
    finishTabDrag();
  }

  function cancelTabPointerDrag() {
    if (tabDragLongPress !== null) clearTimeout(tabDragLongPress);
    tabDragLongPress = null;
    tabDragPointerId = null;
    tabDragSource = null;
    finishTabDrag();
  }

  function finishTabDrag() {
    if (draggedTab) {
      draggedTab.classList.remove('dragging');
      draggedTab.style.transform = '';
    }
    clearDropMarkers();
    draggedTab = null;
    if (tabDragLongPress !== null) clearTimeout(tabDragLongPress);
    tabDragLongPress = null;
    tabDragPointerId = null;
    tabDragSource = null;
  }

  tabsEditor.addEventListener('pointermove', moveTabPointerDrag);
  tabsEditor.addEventListener('pointerup', endTabPointerDrag);
  tabsEditor.addEventListener('pointercancel', cancelTabPointerDrag);

  function readForm() {
    var tabs = [];
    var boxes = tabsEditor.querySelectorAll('.tab-edit');
    for (var i = 0; i < boxes.length; i++) {
      var lines = boxes[i].querySelector('.tab-items').value.split(NL);
      var items = [];
      for (var j = 0; j < lines.length; j++) {
        var l = lines[j].trim();
        if (l) items.push(l);
      }
      tabs.push({ label: boxes[i].querySelector('.tab-label').value, items: items });
    }
    return {
      version: 1,
      trigger: triggerKey.value,
      position: positionSel.value,
      textarea: {
        width: { value: Number(widthValue.value), unit: widthUnit.value },
        height: { value: Number(heightValue.value), unit: heightUnit.value }
      },
      tabs: tabs
    };
  }

  function writeForm(cfg) {
    widthValue.value = cfg.textarea.width.value;
    widthUnit.value = cfg.textarea.width.unit;
    heightValue.value = cfg.textarea.height.value;
    heightUnit.value = cfg.textarea.height.unit;
    triggerKey.value = cfg.trigger;
    positionSel.value = cfg.position;
    while (tabsEditor.firstChild) tabsEditor.removeChild(tabsEditor.firstChild);
    for (var i = 0; i < cfg.tabs.length; i++) addTabRow(cfg.tabs[i].label, cfg.tabs[i].items);
  }

  function applyPreview(cfg) {
    var st = sizeToStyle(cfg.textarea);
    previewArea.style.width = st.width;
    previewArea.style.height = st.height;
    if (st.rows !== null) previewArea.rows = st.rows;
    previewInput.placeholder = cfg.trigger + ' でコマンド';
    if (page > cfg.tabs.length - 1) page = cfg.tabs.length - 1;
    renderPanel();
  }

  function refresh() {
    var r = normalizeConfig(readForm());
    if (!r.ok) {
      setStatus('[' + r.errorCode + '] ' + r.detail, 'error');
      return;
    }
    current = r.value;
    jsonOut.value = JSON.stringify(current, null, 2);
    setStatus('');
    applyPreview(current);
  }

  function runTypewriter(value) {
    if (typewriterTimer !== null) { clearTimeout(typewriterTimer); typewriterTimer = null; }
    typewriterValue = value;
    var frames = typewriterFrames(value);
    typewriterOutput.hidden = false;
    var i = 0;
    function step() {
      typewriterText.textContent = frames[i];
      i++;
      if (i >= frames.length) { typewriterTimer = null; return; }
      typewriterTimer = setTimeout(step, 60);
    }
    step();
  }

  function copyTypewriterToInput() {
    if (!typewriterValue) return;
    if (typewriterTimer !== null) { clearTimeout(typewriterTimer); typewriterTimer = null; }
    previewInput.value += typewriterValue;
    typewriterValue = '';
    typewriterText.textContent = '';
    typewriterOutput.hidden = true;
    previewInput.focus();
    renderPanel();
  }

  typewriterOutput.addEventListener('click', copyTypewriterToInput);
  typewriterOutput.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    copyTypewriterToInput();
  });

  function pick(cmd) {
    var text = previewInput.value;
    var q = findTriggerQuery(text, current.trigger);
    if (q === null) return;
    var base = text.slice(0, text.length - q.length - 1);
    var value = current.trigger + cmd + ' ';
    if (copyMode === 'typewriter') {
      previewInput.value = base;
      runTypewriter(value);
    } else {
      previewInput.value = base + value;
      previewInput.focus();
    }
    renderPanel();
  }

  function go(delta) {
    var last = current.tabs.length - 1;
    page = Math.min(last, Math.max(0, page + delta));
    renderPanel();
  }

  function renderPanel() {
    if (panel) { panel.remove(); panel = null; }
    if (!current) return;
    var q = findTriggerQuery(previewInput.value, current.trigger);
    if (q === null) return;
    var tab = current.tabs[page];
    var last = current.tabs.length - 1;
    panel = document.createElement('div');
    panel.className = 'slash-panel ' + current.position;
    panel.setAttribute('data-testid', 'slash-panel');

    var tabsBar = document.createElement('div');
    tabsBar.className = 'slash-tabs';
    tabsBar.setAttribute('role', 'tablist');
    current.tabs.forEach(function(t, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(i === page));
      b.textContent = t.label;
      b.addEventListener('mousedown', function(e) { e.preventDefault(); });
      b.addEventListener('click', function() { page = i; renderPanel(); });
      tabsBar.appendChild(b);
    });
    panel.appendChild(tabsBar);

    var body = document.createElement('div');
    body.className = 'slash-body';
    var prev = document.createElement('button');
    prev.type = 'button';
    prev.textContent = '<';
    prev.setAttribute('aria-label', '前の候補リスト');
    prev.disabled = page === 0;
    prev.addEventListener('mousedown', function(e) { e.preventDefault(); });
    prev.addEventListener('click', function() { go(-1); });
    var list = document.createElement('ul');
    list.className = 'slash-list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', tab.label);
    var hit = tab.items.filter(function(c) { return c.indexOf(q) === 0; });
    hit.forEach(function(c) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', 'false');
      b.textContent = current.trigger + c;
      b.addEventListener('mousedown', function(e) { e.preventDefault(); });
      b.addEventListener('click', function() { pick(c); });
      li.appendChild(b);
      list.appendChild(li);
    });
    if (hit.length === 0) {
      var empty = document.createElement('li');
      empty.className = 'slash-empty';
      empty.textContent = 'このタブに該当なし';
      list.appendChild(empty);
    }
    list.addEventListener('pointerdown', function(e) { swipeStart = e.clientX; });
    list.addEventListener('pointercancel', function() { swipeStart = null; });
    list.addEventListener('pointerup', function(e) {
      if (swipeStart === null) return;
      var dx = e.clientX - swipeStart;
      swipeStart = null;
      if (Math.abs(dx) >= 40) go(dx < 0 ? 1 : -1);
    });
    var next = document.createElement('button');
    next.type = 'button';
    next.textContent = '>';
    next.setAttribute('aria-label', '次の候補リスト');
    next.disabled = page === last;
    next.addEventListener('mousedown', function(e) { e.preventDefault(); });
    next.addEventListener('click', function() { go(1); });
    body.appendChild(prev);
    body.appendChild(list);
    body.appendChild(next);
    panel.appendChild(body);

    var pageEl = document.createElement('div');
    pageEl.className = 'slash-page';
    pageEl.textContent = (page + 1) + ' / ' + current.tabs.length;
    panel.appendChild(pageEl);

    previewAnchor.appendChild(panel);
  }

  function updatePreviewInput() {
    previewSlashButton.hidden = previewInput.value.length === 0;
    renderPanel();
  }

  function isNekoCommand(value) {
    var command = String(value || '').trim();
    return command === '/neko' || command.indexOf('/neko ') === 0;
  }

  function executeNekoCommand() {
    var command = previewInput.value.trim();
    if (!isNekoCommand(command) || previewInput.disabled) return Promise.resolve(false);
    previewInput.disabled = true;
    previewSlashButton.disabled = true;
    var resultArea = $('nekoResult');
    resultArea.hidden = false;
    resultArea.className = 'preview-area';
    resultArea.textContent = '実行中…';
    renderPanel();
    return fetch('/api/aichat', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ message: command, source: 'textbox' })
    }).then(function(response) {
      return response.text().then(function(body) {
        var data;
        try { data = JSON.parse(body); } catch (_) {
          throw new Error('サーバーからJSONではない応答が返りました (HTTP ' + response.status + ')');
        }
        if (!response.ok) throw new Error(data.error || 'コマンドを実行できませんでした (HTTP ' + response.status + ')');
        var markdown = data.response || '（応答なし）';
        resultArea.innerHTML = parseMd(markdown);
        return true;
      });
    }).catch(function(err) {
      resultArea.className = 'preview-area error';
      resultArea.textContent = '実行に失敗しました。通信状態を確認して再度お試しください。' + NL + '詳細: ' + (err.message || err);
      return false;
    }).then(function(result) {
      previewInput.disabled = false;
      previewSlashButton.disabled = false;
      previewInput.focus();
      return result;
    });
  }

  document.querySelector('.layout').addEventListener('input', function(e) {
    if (e.target === jsonOut || e.target === previewInput) return;
    refresh();
  });
  document.querySelector('.layout').addEventListener('change', function(e) {
    if (e.target === jsonOut || e.target === previewInput) return;
    refresh();
  });
  previewInput.addEventListener('input', updatePreviewInput);
  previewInput.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter' || !isNekoCommand(previewInput.value)) return;
    e.preventDefault();
    executeNekoCommand();
  });
  previewSlashButton.addEventListener('click', function() {
    previewInput.value = '/';
    updatePreviewInput();
    previewInput.focus();
  });

  function applyCopyModeToggle() {
    copyModeToggle.textContent = copyMode;
    copyModeToggle.setAttribute('aria-checked', String(copyMode === 'typewriter'));
  }
  applyCopyModeToggle();
  copyModeToggle.addEventListener('click', function() {
    copyMode = nextCopyMode(copyMode);
    writeCookie(COPY_MODE_COOKIE, copyMode);
    applyCopyModeToggle();
  });

  $('addTab').addEventListener('click', function() {
    addTabRow('新しいタブ', ['item']);
    refresh();
  });

  $('btnCopy').addEventListener('click', function() {
    navigator.clipboard.writeText(jsonOut.value).then(function() {
      setStatus('コピーしました', 'ok');
    }, function(err) {
      setStatus('コピーに失敗しました: ' + err, 'error');
    });
  });

  $('btnDownload').addEventListener('click', function() {
    var blob = new Blob([jsonOut.value], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mention-editor.json';
    a.click();
    setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000);
  });

  $('btnImport').addEventListener('click', function() {
    var parsed;
    try {
      parsed = JSON.parse(jsonOut.value);
    } catch (err) {
      setStatus('[BAD_JSON] JSONとして読めません: ' + err.message, 'error');
      return;
    }
    var r = normalizeConfig(parsed);
    if (!r.ok) {
      setStatus('[' + r.errorCode + '] ' + r.detail, 'error');
      return;
    }
    writeForm(r.value);
    currentDocumentId = null;
    $('savedDocuments').value = '';
    page = 0;
    refresh();
    setStatus('読み込みました', 'ok');
  });

  function renderSavedDocuments() {
    var select = $('savedDocuments');
    while (select.options.length > 1) select.remove(1);
    for (var i = 0; i < savedDocuments.length; i++) {
      var option = document.createElement('option');
      option.value = savedDocuments[i].id;
      option.textContent = savedDocuments[i].title;
      select.appendChild(option);
    }
    select.value = currentDocumentId || '';
  }

  function loadSavedDocuments() {
    return fetch('/api/mention-editor/documents').then(function(response) {
      if (!response.ok) throw new Error('保存済みデータを取得できませんでした');
      return response.json();
    }).then(function(data) {
      savedDocuments = data.documents || [];
      renderSavedDocuments();
    }).catch(function(err) {
      setStatus(err.message, 'error');
    });
  }

  function saveDocument(title) {
    var parsed;
    try { parsed = JSON.parse(jsonOut.value); } catch (err) {
      setStatus('[BAD_JSON] JSONとして読めません: ' + err.message, 'error');
      return Promise.resolve();
    }
    var checked = normalizeConfig(parsed);
    if (!checked.ok) {
      setStatus('[' + checked.errorCode + '] ' + checked.detail, 'error');
      return Promise.resolve();
    }
    var payload = currentDocumentId
      ? { id: currentDocumentId, config: checked.value }
      : { title: title, config: checked.value };
    $('btnConfirmSave').disabled = true;
    return fetch('/api/mention-editor/documents', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    }).then(function(response) {
      return response.json().then(function(data) {
        if (!response.ok) throw new Error(data.error || '保存に失敗しました');
        currentDocumentId = data.id;
        $('saveModal').hidden = true;
        setStatus('データベースに保存しました', 'ok');
        return loadSavedDocuments();
      });
    }).catch(function(err) {
      $('titleStatus').textContent = err.message;
      setStatus(err.message, 'error');
    }).then(function() { $('btnConfirmSave').disabled = false; });
  }

  $('btnLoadSaved').addEventListener('click', function() {
    var id = $('savedDocuments').value;
    var documentData = savedDocuments.find(function(item) { return item.id === id; });
    if (!documentData) { setStatus('読み込む保存データを選択してください', 'error'); return; }
    writeForm(documentData.config);
    currentDocumentId = documentData.id;
    page = 0;
    refresh();
    setStatus('「' + documentData.title + '」を読み込みました', 'ok');
  });

  $('btnSave').addEventListener('click', function() {
    if (currentDocumentId) { saveDocument(''); return; }
    $('saveTitle').value = '';
    $('titleStatus').textContent = '';
    $('saveModal').hidden = false;
    $('saveTitle').focus();
  });
  $('btnCancelSave').addEventListener('click', function() { $('saveModal').hidden = true; });
  $('btnConfirmSave').addEventListener('click', function() {
    var error = validateSaveTitle($('saveTitle').value, savedDocuments);
    $('titleStatus').textContent = error;
    if (!error) saveDocument($('saveTitle').value.trim());
  });

  writeForm({
    version: 1,
    trigger: '/',
    position: 'top',
    textarea: { width: { value: 40, unit: 'ch' }, height: { value: 15, unit: 'rows' } },
    tabs: [
      { label: 'テキスト', items: ['bold', 'italic', 'code', 'quote'] },
      { label: '挿入', items: ['image', 'table', 'link', 'divider'] },
      { label: 'AI', items: ['summarize', 'translate', 'explain'] }
    ]
  });
  refresh();
  loadSavedDocuments();
})();
</script>
</body>
</html>`;
}
