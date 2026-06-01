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
      align-items: flex-start; justify-content: center; padding-top: 80px;
    }
    .kp-overlay.open { display: flex; }
    .kp-modal {
      background: var(--panel, #161b22); border: 1px solid var(--border, #30363d);
      border-radius: 12px; width: min(640px, 96vw); max-height: 72vh;
      display: flex; flex-direction: column; overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    }
    .kp-header {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 16px; border-bottom: 1px solid var(--border, #30363d); flex-shrink: 0;
    }
    .kp-title { font-size: 13px; font-weight: 700; color: var(--text-strong, #f0f6fc); flex: 1; }
    .kp-close-btn {
      border: none; background: none; color: var(--text-muted, #8b949e);
      font-size: 18px; cursor: pointer; padding: 2px 6px; border-radius: 4px;
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
    .kp-body { overflow-y: auto; flex: 1; padding: 0; }
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
    .kp-kw-cell { color: var(--text, #c9d1d9); word-break: break-all; }`;
}

export function renderKeyPickerHtml(): string {
  return `
  <div class="kp-overlay" id="kpOverlay">
    <div class="kp-modal" role="dialog" aria-modal="true">
      <div class="kp-header">
        <span class="kp-title">🔑 検索キーワードを選ぶ</span>
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
      <div class="kp-body" id="kpBody">
        <div class="kp-msg">読み込み中…</div>
      </div>
    </div>
  </div>`;
}

export function renderKeyPickerJs(opts: KeyPickerOptions): string {
  const { targetInputId, triggerBtnId, afterSelectJs = '' } = opts;
  return `
  (function() {
    var kpOverlay   = document.getElementById('kpOverlay');
    var kpCloseBtn  = document.getElementById('kpCloseBtn');
    var kpCats      = document.getElementById('kpCats');
    var kpBody      = document.getElementById('kpBody');
    var triggerBtn  = document.getElementById(${JSON.stringify(triggerBtnId)});
    var targetInput = document.getElementById(${JSON.stringify(targetInputId)});
    if (!kpOverlay || !kpCats || !kpBody || !targetInput) return;

    var KP_ROWS = 20, KP_MIN_COLS = 1, KP_MAX_COLS = 3;
    var kpItems = [];
    var kpActiveLabels = new Set();

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

    function kpApply() {
      var allLabels = kpGetAllLabels();
      var allOn = allLabels.length > 0 && allLabels.every(function(l) { return kpActiveLabels.has(l); });
      var filtered;
      if (allOn) {
        filtered = kpItems;
      } else if (kpActiveLabels.size === 0) {
        filtered = [];
      } else {
        filtered = kpItems.filter(function(i) { return kpActiveLabels.has(i.label || 'uncategorized'); });
      }
      kpRenderGrid(filtered);
    }

    function kpOpen() {
      kpOverlay.classList.add('open');
      if (kpItems.length > 0) { kpApply(); return; }
      kpBody.innerHTML = '<div class="kp-msg">読み込み中…</div>';
      fetch('/api/repositories/search/history', { credentials: 'same-origin', cache: 'no-store' })
        .then(function(res) { return res.ok ? res.json() : Promise.reject(); })
        .then(function(data) {
          kpItems = kpDedupeSort((data && data.history) ? data.history : []);
          kpSyncCats(kpItems);
          kpUpdateCounts(kpItems);
          kpActivateAll();
          kpApply();
        })
        .catch(function() { kpBody.innerHTML = '<div class="kp-msg">取得に失敗しました</div>'; });
    }

    function kpClose() { kpOverlay.classList.remove('open'); }

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
    kpCloseBtn.addEventListener('click', kpClose);
    kpOverlay.addEventListener('click', function(e) { if (e.target === kpOverlay) kpClose(); });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && kpOverlay.classList.contains('open')) { e.stopPropagation(); kpClose(); }
    });
  }());`;
}
