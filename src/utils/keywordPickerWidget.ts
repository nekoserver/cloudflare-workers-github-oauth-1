/**
 * キーワードピッカーウィジェット
 *
 * 検索履歴モーダル（/api/repositories/search/history）からキーワードを選択し、
 * 任意の input 要素に値を注入する再利用可能なオーバーレイウィジェット。
 *
 * 使い方（ビューの HTML 生成関数内）:
 *   1. <head> の <style> 内に renderKeyPickerCss() を埋め込む
 *   2. <body> 末尾に renderKeyPickerHtml() を埋め込む
 *   3. <script> 内に renderKeyPickerJs({ targetInputId: 'mySearchInput', triggerBtnId: 'myBtn' }) を埋め込む
 */

import { getModalRuntimeScript } from './modalRuntime';

export interface KeyPickerOptions {
  /** キーワードが選択されたとき値を注入する input 要素の id */
  targetInputId: string;
  /** ピッカーを開くトリガーボタンの id */
  triggerBtnId: string;
  /**
   * キーワード注入後に追加で実行するコールバック（JS 式の文字列）。
   * 省略時は input イベントのみ発火して終わる。
   * 例: 'applyFilter()' や 'document.getElementById("myForm").submit()'
   */
  afterSelectJs?: string;
}

export function renderKeyPickerCss(): string {
  return `
    .kp-overlay {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.35); z-index: 2000;
      align-items: flex-start; justify-content: center; padding-top: 40px;
    }
    .kp-overlay.open { display: flex; }
    .kp-overlay.kp-maximized { padding-top: 0; align-items: stretch; }
    .kp-modal {
      background: var(--panel, #161b22); border: 1px solid var(--border, #30363d);
      border-radius: 12px; width: min(640px, 96vw); max-height: 88vh;
      display: flex; flex-direction: column; overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      position: relative; user-select: none;
    }
    .kp-overlay.kp-maximized .kp-modal {
      width: 100%; max-height: 100vh; height: 100%;
      border-radius: 0; border: none; box-shadow: none; left: 0 !important; top: 0 !important;
    }
    .kp-modal.kp-floating {
      position: fixed; cursor: default;
    }
    .kp-header {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 16px; border-bottom: 1px solid var(--border, #30363d); flex-shrink: 0;
    }
    .kp-header-draggable { cursor: grab; flex: 1; display: flex; align-items: center; gap: 10px; min-width: 0; }
    .kp-header-draggable:active { cursor: grabbing; }
    .kp-overlay.kp-maximized .kp-header-draggable { cursor: default; }
    .kp-title { font-size: 13px; font-weight: 700; color: var(--text-strong, #f0f6fc); }
    .kp-max-btn {
      border: none; background: none; color: var(--text-muted, #8b949e);
      font-size: 15px; cursor: pointer; padding: 2px 6px; border-radius: 4px; flex-shrink: 0;
    }
    .kp-max-btn:hover { color: var(--text-strong, #f0f6fc); background: light-dark(#eaeef2,#21262d); }
    .kp-close-btn {
      border: none; background: none; color: var(--text-muted, #8b949e);
      font-size: 18px; cursor: pointer; padding: 2px 6px; border-radius: 4px; flex-shrink: 0;
    }
    .kp-close-btn:hover { color: var(--text-strong, #f0f6fc); background: light-dark(#eaeef2,#21262d); }
    .kp-cats {
      padding: 10px 14px; border-bottom: 1px solid var(--border, #30363d);
      display: flex; flex-wrap: wrap; gap: 6px; flex-shrink: 0;
    }
    .kp-cat-btn {
      font-size: 11px; padding: 3px 10px; border-radius: 12px;
      border: 1px solid var(--border, #30363d); background: light-dark(#f6f8fa,#21262d);
      color: var(--text-muted, #8b949e); cursor: pointer; white-space: nowrap;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .kp-cat-btn:hover { border-color: var(--accent, #58a6ff); color: var(--accent, #58a6ff); }
    .kp-cat-btn.active {
      border-color: var(--accent, #58a6ff);
      background: light-dark(#ddf4ff,#0d2136);
      color: var(--accent, #58a6ff); font-weight: 600;
    }
    .kp-body { overflow-y: auto; flex: 1; padding: 0; min-height: 480px; }
    .kp-msg { font-size: 12px; color: var(--text-muted, #8b949e); padding: 20px; text-align: center; }
    .kp-grid-wrap { display: flex; gap: 0; }
    .kp-grid-col { flex: 1; min-width: 0; }
    .kp-grid-col table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .kp-grid-col th {
      background: var(--th-bg, #1c2128); color: var(--text-muted, #8b949e); text-align: left;
      padding: 6px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px;
      border-bottom: 1px solid var(--border, #30363d); border-right: 1px solid var(--border, #30363d);
      position: sticky; top: 0;
    }
    .kp-grid-col th:last-child { border-right: none; }
    .kp-grid-col td {
      padding: 6px 10px; border-bottom: 1px solid var(--border, #30363d);
      border-right: 1px solid var(--border, #30363d); vertical-align: middle;
    }
    .kp-grid-col td:last-child { border-right: none; }
    .kp-grid-col tr:last-child td { border-bottom: none; }
    .kp-grid-col tr { cursor: pointer; }
    .kp-grid-col tr:hover td { background: light-dark(rgba(0,0,0,.04), rgba(255,255,255,.04)); }
    .kp-hit-badge {
      display: inline-block; background: light-dark(#e8f0fe,#1c2d4a); color: light-dark(#1a56db,#60a5fa);
      border-radius: 10px; font-size: 10px; padding: 1px 7px; font-weight: 600; white-space: nowrap;
    }
    .kp-kw-cell { color: var(--text, #c9d1d9); word-break: break-all; }
    .kp-view-toggle-bar {
      padding: 7px 14px; border-bottom: 1px solid var(--border, #30363d); flex-shrink: 0;
    }
    .kp-view-toggle-btn {
      font-size: 11px; padding: 3px 10px; border-radius: 12px;
      border: 1px solid var(--border, #30363d); background: light-dark(#f6f8fa,#21262d);
      color: var(--text-muted, #8b949e); cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .kp-view-toggle-btn:hover { border-color: var(--accent, #58a6ff); color: var(--accent, #58a6ff); }
    .kp-1col-cats { display: flex; flex-wrap: wrap; gap: 4px; padding: 4px 10px; align-items: center; }
    .kp-label-badge {
      font-size: 10px; padding: 2px 8px; border-radius: 10px;
      border: 1px solid light-dark(#3b82f6,#60a5fa);
      background: light-dark(#dbeafe, rgba(59,130,246,0.25));
      color: light-dark(#1d4ed8,#93c5fd); font-weight: 600; white-space: nowrap;
    }
    .kp-label-badge-uncat {
      font-size: 10px; padding: 2px 8px; border-radius: 10px;
      border: 1px solid var(--border, #30363d); background: light-dark(#f6f8fa,#21262d);
      color: var(--text-muted, #8b949e); white-space: nowrap;
    }
  `;
}

export function renderKeyPickerHtml(): string {
  return `
  <div class="kp-overlay" id="kpOverlay">
    <div class="kp-modal" role="dialog" aria-modal="true" aria-labelledby="kpTitle">
      <div class="kp-header">
        <div class="kp-header-draggable" id="kpDragHandle">
          <span class="kp-title" id="kpTitle">🔑 検索キーワードを選ぶ</span>
        </div>
        <button class="kp-max-btn" id="kpMaxBtn" aria-label="最大化">⛶</button>
        <button class="kp-close-btn" id="kpCloseBtn" aria-label="閉じる">✕</button>
      </div>
      <div class="kp-cats" id="kpCats">
        <button class="kp-cat-btn active" data-label="" data-label-name="すべて">すべて</button>
        <button class="kp-cat-btn" data-label="feature" data-label-name="feature">feature</button>
        <button class="kp-cat-btn" data-label="ui" data-label-name="ui">ui</button>
        <button class="kp-cat-btn" data-label="tech" data-label-name="tech">tech</button>
        <button class="kp-cat-btn" data-label="database" data-label-name="database">database</button>
        <button class="kp-cat-btn" data-label="bugfix" data-label-name="bugfix">bugfix</button>
        <button class="kp-cat-btn" data-label="ops" data-label-name="ops">ops</button>
        <button class="kp-cat-btn" data-label="uncategorized" data-label-name="未分類">未分類</button>
      </div>
      <div class="kp-groups" id="kpGroups" style="display:none;"></div>
      <div class="kp-view-toggle-bar" id="kpViewToggleBar">
        <button id="kpViewToggleBtn" class="kp-view-toggle-btn" type="button">一列表示に切り替える</button>
      </div>
      <div class="kp-body" id="kpBody">
        <div class="kp-msg">読み込み中…</div>
      </div>
    </div>
  </div>`;
}

export function renderKeyPickerJs(opts: KeyPickerOptions): string {
  const { targetInputId, triggerBtnId, afterSelectJs = '' } = opts;
  return `
  ${getModalRuntimeScript()}
  (function() {
    var kpOverlay   = document.getElementById('kpOverlay');
    var kpModal     = kpOverlay ? kpOverlay.querySelector('.kp-modal') : null;
    var kpCloseBtn  = document.getElementById('kpCloseBtn');
    var kpMaxBtn    = document.getElementById('kpMaxBtn');
    var kpDragHandle= document.getElementById('kpDragHandle');
    var kpCats           = document.getElementById('kpCats');
    var kpGroups         = document.getElementById('kpGroups');
    var kpBody           = document.getElementById('kpBody');
    var kpViewToggleBtn  = document.getElementById('kpViewToggleBtn');
    var triggerBtn  = document.getElementById(${JSON.stringify(triggerBtnId)});
    var targetInput = document.getElementById(${JSON.stringify(targetInputId)});
    if (!kpOverlay || !kpModal || !kpCats || !kpBody || !targetInput) return;
    if (triggerBtn) {
      triggerBtn.setAttribute('aria-controls', 'kpOverlay');
      triggerBtn.setAttribute('aria-expanded', 'false');
    }

    var kpViewMode = 'multi';
    var kpMultiLabelsMap = null;

    var kpIsMaximized = false;
    var kpController = window.ModalRuntime.register({
      id: 'keyword-picker',
      overlay: kpOverlay,
      closeButtons: kpCloseBtn ? [kpCloseBtn] : [],
      onOpen: function() { if (triggerBtn) triggerBtn.setAttribute('aria-expanded', 'true'); },
      onClose: function() { if (triggerBtn) triggerBtn.setAttribute('aria-expanded', 'false'); },
    });

    function kpToggleMaximize() {
      kpIsMaximized = !kpIsMaximized;
      if (kpIsMaximized) {
        kpModal.classList.remove('kp-floating');
        kpModal.style.left = '';
        kpModal.style.top = '';
        kpOverlay.classList.add('kp-maximized');
        kpMaxBtn.textContent = '⊡';
        kpMaxBtn.setAttribute('aria-label', '元のサイズに戻す');
      } else {
        kpOverlay.classList.remove('kp-maximized');
        kpMaxBtn.textContent = '⛶';
        kpMaxBtn.setAttribute('aria-label', '最大化');
      }
    }

    if (kpMaxBtn) kpMaxBtn.addEventListener('click', kpToggleMaximize);

    // ドラッグ移動（通常サイズ時のみ）
    var kpDragging = false;
    var kpDragOffX = 0, kpDragOffY = 0;

    if (kpDragHandle) {
      kpDragHandle.addEventListener('mousedown', function(e) {
        if (kpIsMaximized) return;
        kpDragging = true;
        var rect = kpModal.getBoundingClientRect();
        kpDragOffX = e.clientX - rect.left;
        kpDragOffY = e.clientY - rect.top;
        kpModal.classList.add('kp-floating');
        kpModal.style.left = rect.left + 'px';
        kpModal.style.top  = rect.top  + 'px';
        kpOverlay.style.pointerEvents = 'none';
        kpModal.style.pointerEvents = 'auto';
        e.preventDefault();
      });
    }

    document.addEventListener('mousemove', function(e) {
      if (!kpDragging) return;
      var x = e.clientX - kpDragOffX;
      var y = e.clientY - kpDragOffY;
      var maxX = window.innerWidth  - kpModal.offsetWidth;
      var maxY = window.innerHeight - kpModal.offsetHeight;
      kpModal.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
      kpModal.style.top  = Math.max(0, Math.min(y, maxY)) + 'px';
    });

    document.addEventListener('mouseup', function() {
      if (!kpDragging) return;
      kpDragging = false;
      kpOverlay.style.pointerEvents = '';
      kpModal.style.pointerEvents = '';
    });

    var KP_ROWS = 20, KP_MIN_COLS = 1, KP_MAX_COLS = 3;
    var kpItems = [];
    var kpActiveLabels = new Set();
    var kpCachedGroups = null;
    var kpSelectedGroupId = null;

    function kpEsc(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function kpDedupeSort(history) {
      var map = {};
      history.forEach(function(item) {
        var k = item.search_query;
        if (!map[k] || item.total_hits > map[k].total_hits)
          map[k] = { search_query: k, total_hits: item.total_hits, label: item.label || 'uncategorized' };
      });
      var arr = Object.keys(map).map(function(k) { return map[k]; });
      return arr.sort(function(a, b) { return b.total_hits - a.total_hits; });
    }

    function kpShouldHideZeroHits() {
      var m = document.cookie.match('(^|;)\\s*kp_hide_zero_hits=([^;]*)');
      return m ? decodeURIComponent(m[2]) === 'on' : false;
    }

    function kpGroupOffClearsBadges() {
      var m = document.cookie.match('(^|;)\\s*cg_group_off_clears_badges=([^;]*)');
      return m ? decodeURIComponent(m[2]) !== 'off' : true;
    }

    function kpGetAllLabels() {
      return Array.from(kpCats.querySelectorAll('.kp-cat-btn[data-label]'))
        .map(function(b) { return b.getAttribute('data-label'); })
        .filter(function(l) { return l !== ''; });
    }

    function kpSyncBtnStyles() {
      var allLabels = kpGetAllLabels();
      var allOn = allLabels.length > 0 && allLabels.every(function(l) { return kpActiveLabels.has(l); });
      kpCats.querySelectorAll('.kp-cat-btn').forEach(function(btn) {
        var lbl = btn.getAttribute('data-label');
        if (lbl === '') {
          btn.classList.toggle('active', allOn);
        } else {
          btn.classList.toggle('active', kpActiveLabels.has(lbl));
        }
      });
      kpSyncGroupSelection();
    }

    function kpRenderGroupList(groups) {
      if (!kpGroups) return;
      if (!groups || groups.length === 0) { kpGroups.style.display = 'none'; return; }
      var groupsWithCount = groups.map(function(g) {
        var count = new Set(
          kpItems.filter(function(item) { return g.categories.indexOf(item.label) !== -1; })
                 .map(function(item) { return item.search_query; })
        ).size;
        return { g: g, count: count };
      });
      groupsWithCount.sort(function(a, b) { return b.count - a.count; });
      var html = '<span class="kp-list-label">既存のキーワードグループ : </span>';
      groupsWithCount.forEach(function(entry) {
        var g = entry.g;
        var isActive = kpSelectedGroupId === g.id;
        html += '<button type="button" class="kp-group-btn' + (isActive ? ' active' : '') + '" data-group-id="' + kpEsc(g.id) + '" data-group-cats="' + kpEsc(JSON.stringify(g.categories)) + '">' + kpEsc(g.group_name) + ' (' + entry.count + ')</button>';
      });
      kpGroups.innerHTML = html;
      kpGroups.style.display = '';
      kpGroups.querySelectorAll('.kp-group-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var gid = btn.getAttribute('data-group-id');
          if (kpSelectedGroupId === gid) {
            kpSelectedGroupId = null;
            if (kpGroupOffClearsBadges()) {
              kpActiveLabels = new Set();
              kpSyncBtnStyles();
              kpApply();
            } else {
              kpActivateAll();
            }
          } else {
            kpSelectedGroupId = gid;
            try {
              var cats = JSON.parse(btn.getAttribute('data-group-cats') || '[]');
              kpActiveLabels = new Set();
              cats.forEach(function(l) { kpActiveLabels.add(l); });
              kpSyncBtnStyles();
              kpApply();
            } catch (e) { /* ignore */ }
          }
          kpRenderGroupList(kpCachedGroups);
        });
      });
    }

    function kpSyncGroupSelection() {
      if (!kpCachedGroups) return;
      var labels = Array.from(kpActiveLabels).sort();
      var matched = kpCachedGroups.find(function(g) {
        var sorted = g.categories.slice().sort();
        return sorted.length === labels.length && sorted.every(function(v, i) { return v === labels[i]; });
      });
      kpSelectedGroupId = matched ? matched.id : null;
      kpRenderGroupList(kpCachedGroups);
    }

    function kpLoadGroups() {
      fetch('/api/repositories/search/category-groups', { credentials: 'same-origin', cache: 'no-store' })
        .then(function(res) { return res.ok ? res.json() : null; })
        .then(function(data) {
          kpCachedGroups = (data && Array.isArray(data.groups)) ? data.groups : [];
          kpSyncGroupSelection();
        })
        .catch(function() {});
    }

    function kpActivateAll() {
      kpGetAllLabels().forEach(function(l) { kpActiveLabels.add(l); });
      kpSyncBtnStyles();
    }

    function kpSyncCats(items) {
      var existing = new Set(Array.from(kpCats.querySelectorAll('.kp-cat-btn[data-label]')).map(function(b) { return b.getAttribute('data-label'); }));
      var uncatBtn = kpCats.querySelector('[data-label="uncategorized"]');
      items.forEach(function(item) {
        var lbl = item.label;
        if (!lbl || lbl === 'uncategorized' || existing.has(lbl)) return;
        existing.add(lbl);
        var btn = document.createElement('button');
        btn.className = 'kp-cat-btn';
        btn.setAttribute('data-label', lbl);
        btn.setAttribute('data-label-name', lbl);
        btn.textContent = lbl;
        if (uncatBtn) kpCats.insertBefore(btn, uncatBtn); else kpCats.appendChild(btn);
      });
    }

    function kpUpdateCounts(items) {
      var counts = {}, total = items.length;
      items.forEach(function(item) { var l = item.label || 'uncategorized'; counts[l] = (counts[l] || 0) + 1; });
      kpCats.querySelectorAll('.kp-cat-btn').forEach(function(btn) {
        var lbl = btn.getAttribute('data-label');
        if (lbl === null) return;
        var base = btn.getAttribute('data-label-name') || btn.textContent.replace(/\\s*\\(\\d+\\)$/, '').trim();
        if (!btn.getAttribute('data-label-name')) btn.setAttribute('data-label-name', base);
        var cnt = lbl === '' ? total : (counts[lbl] || 0);
        btn.textContent = base + ' (' + cnt + ')';
      });
    }

    function kpRenderGrid(items) {
      if (items.length === 0) { kpBody.innerHTML = '<div class="kp-msg">このカテゴリにキーワードがありません</div>'; return; }
      var numCols = Math.min(KP_MAX_COLS, Math.max(KP_MIN_COLS, Math.ceil(items.length / KP_ROWS)));
      var rpc = Math.ceil(items.length / numCols);
      var html = '<div class="kp-grid-wrap">';
      for (var c = 0; c < numCols; c++) {
        var s = c * rpc, e = Math.min(s + rpc, items.length);
        html += '<div class="kp-grid-col"><table><thead><tr><th>総ヒット数</th><th>キーワード</th></tr></thead><tbody>';
        for (var r = s; r < e; r++)
          html += '<tr data-kw="' + kpEsc(items[r].search_query) + '">'
            + '<td><span class="kp-hit-badge">' + items[r].total_hits + '</span></td>'
            + '<td class="kp-kw-cell">' + kpEsc(items[r].search_query) + '</td></tr>';
        html += '</tbody></table></div>';
      }
      kpBody.innerHTML = html + '</div>';
      kpBody.querySelectorAll('tr[data-kw]').forEach(function(row) {
        row.addEventListener('click', function() {
          var kw = row.getAttribute('data-kw');
          if (!kw) return;
          targetInput.value = kw;
          targetInput.dispatchEvent(new Event('input'));
          ${afterSelectJs ? afterSelectJs + ';' : ''}
          kpClose();
        });
      });
    }

    function kpRenderGrid1Col(items) {
      if (items.length === 0) { kpBody.innerHTML = '<div class="kp-msg">このカテゴリにキーワードがありません</div>'; return; }
      var thStyle = 'background:var(--th-bg,#1c2128);color:var(--text-muted,#8b949e);text-align:left;padding:6px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border,#30363d);position:sticky;top:0;';
      var html = '<table style="width:100%;border-collapse:collapse;font-size:12px;">';
      html += '<thead><tr><th style="' + thStyle + 'width:70px;">総ヒット数</th><th style="' + thStyle + 'width:40%;">キーワード</th><th style="' + thStyle + '">カテゴリ</th></tr></thead><tbody>';
      items.forEach(function(item) {
        var kw = item.search_query;
        var catsHtml = '';
        if (kpMultiLabelsMap !== null && kpMultiLabelsMap[kw] && kpMultiLabelsMap[kw].length > 0) {
          kpMultiLabelsMap[kw].forEach(function(cat) {
            var cls = cat === 'uncategorized' ? 'kp-label-badge-uncat' : 'kp-label-badge';
            catsHtml += '<span class="' + cls + '">' + kpEsc(cat) + '</span> ';
          });
        } else {
          var lbl = item.label || 'uncategorized';
          var cls = lbl === 'uncategorized' ? 'kp-label-badge-uncat' : 'kp-label-badge';
          catsHtml = '<span class="' + cls + '">' + kpEsc(lbl) + '</span>';
        }
        html += '<tr data-kw="' + kpEsc(kw) + '" style="cursor:pointer;">'
          + '<td style="padding:6px 10px;border-bottom:1px solid var(--border,#30363d);vertical-align:middle;"><span class="kp-hit-badge">' + item.total_hits + '</span></td>'
          + '<td style="padding:6px 10px;border-bottom:1px solid var(--border,#30363d);vertical-align:middle;" class="kp-kw-cell">' + kpEsc(kw) + '</td>'
          + '<td style="padding:6px 10px;border-bottom:1px solid var(--border,#30363d);vertical-align:middle;"><div class="kp-1col-cats">' + catsHtml + '</div></td>'
          + '</tr>';
      });
      html += '</tbody></table>';
      kpBody.innerHTML = html;
      kpBody.querySelectorAll('tr[data-kw]').forEach(function(row) {
        row.addEventListener('click', function() {
          var kw = row.getAttribute('data-kw');
          if (!kw) return;
          targetInput.value = kw;
          targetInput.dispatchEvent(new Event('input'));
          ${afterSelectJs ? afterSelectJs + ';' : ''}
          kpClose();
        });
      });
    }

    function kpLoadMultiLabels(callback) {
      if (kpMultiLabelsMap !== null) { callback(); return; }
      fetch('/api/repositories/search/keyword-multi-labels-all', { credentials: 'same-origin', cache: 'no-store' })
        .then(function(res) { return res.ok ? res.json() : null; })
        .then(function(d) {
          kpMultiLabelsMap = {};
          if (d && Array.isArray(d.items)) {
            d.items.forEach(function(entry) {
              kpMultiLabelsMap[entry.search_query] = Array.isArray(entry.categories) ? entry.categories : [];
            });
          }
          callback();
        })
        .catch(function() { kpMultiLabelsMap = {}; callback(); });
    }

    if (kpViewToggleBtn) {
      kpViewToggleBtn.addEventListener('click', function() {
        if (kpViewMode === 'multi') {
          kpViewMode = 'single';
          kpViewToggleBtn.textContent = '複数列表示に切り替える';
          kpLoadMultiLabels(function() { kpApply(); });
        } else {
          kpViewMode = 'multi';
          kpViewToggleBtn.textContent = '一列表示に切り替える';
          kpApply();
        }
      });
    }

    function kpApply() {
      var allLabels = kpGetAllLabels();
      var allOn = allLabels.length > 0 && allLabels.every(function(l) { return kpActiveLabels.has(l); });
      var base;
      if (allOn) {
        base = kpItems;
      } else if (kpActiveLabels.size === 0) {
        base = [];
      } else {
        base = kpItems.filter(function(i) { return kpActiveLabels.has(i.label || 'uncategorized'); });
      }
      if (kpShouldHideZeroHits()) {
        base = base.filter(function(i) { return i.total_hits > 0; });
      }
      if (kpViewMode === 'single') {
        kpRenderGrid1Col(base);
      } else {
        kpRenderGrid(base);
      }
    }

    function kpOpen() {
      kpController.open();
      if (kpItems.length > 0) {
        kpSyncGroupSelection();
        kpApply();
        return;
      }
      kpBody.innerHTML = '<div class="kp-msg">読み込み中…</div>';
      Promise.all([
        fetch('/api/repositories/search/history', { credentials: 'same-origin', cache: 'no-store' })
          .then(function(res) { return res.ok ? res.json() : Promise.reject(); }),
        fetch('/api/repositories/search/category-groups', { credentials: 'same-origin', cache: 'no-store' })
          .then(function(res) { return res.ok ? res.json() : null; })
          .catch(function() { return null; })
      ]).then(function(results) {
        var data = results[0];
        var groupData = results[1];
        kpItems = kpDedupeSort((data && data.history) ? data.history : []);
        kpCachedGroups = (groupData && Array.isArray(groupData.groups)) ? groupData.groups : [];
        kpSyncCats(kpItems);
        kpUpdateCounts(kpItems);
        kpActivateAll();
        kpApply();
      }).catch(function() { kpBody.innerHTML = '<div class="kp-msg">取得に失敗しました</div>'; });
    }

    function kpClose() {
      kpController.close();
    }

    kpCats.addEventListener('click', function(e) {
      var btn = e.target.closest('.kp-cat-btn');
      if (!btn) return;
      var lbl = btn.getAttribute('data-label');
      if (lbl === '') {
        var allLabels = kpGetAllLabels();
        var allOn = allLabels.length > 0 && allLabels.every(function(l) { return kpActiveLabels.has(l); });
        if (allOn) {
          kpActiveLabels = new Set();
        } else {
          allLabels.forEach(function(l) { kpActiveLabels.add(l); });
        }
      } else {
        if (kpActiveLabels.has(lbl)) {
          kpActiveLabels.delete(lbl);
        } else {
          kpActiveLabels.add(lbl);
        }
      }
      kpSyncBtnStyles();
      kpApply();
    });
    if (triggerBtn) triggerBtn.addEventListener('click', kpOpen);
  }());`;
}
