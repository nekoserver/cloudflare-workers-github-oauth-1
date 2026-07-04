/**
 * キーワード分類パネル（🔑ハイライト切替 + 📝分類モード + キーワードチップ + 新規カテゴリ登録モーダル）
 *
 * 「AIチャットで使用中のAIチャットの詳細プレビュー」(src/views/aichat.ts の
 * historyModal) にある、キーワードチップのハイライトON/OFF・未分類キーワードを
 * 新しいカテゴリへ登録できる機能を、他のAIチャット詳細プレビュー（例: 世界遺産
 * アクセスランキング左サイドパネルの hist-detail モーダル）でも呼び出せるように
 * 関数化したもの。
 *
 * 使い方（ビューの HTML 生成関数内）:
 *   1. <style> 内に renderKeywordClassifyPanelCss() を埋め込む
 *   2. モーダルのヘッダー内に renderKeywordEditToggleButtonHtml(toggleBtnId) を、
 *      フッター等に renderHighlightToggleButtonHtml(highlightToggleBtnId) を、
 *      チャット本文の直後に renderKeywordChipsContainerHtml(chipsContainerId) を埋め込む
 *   3. <script> 内（対象モーダルの chat 要素・escHtml・getNextZ を定義した後）に
 *      renderKeywordClassifyPanelJs({ toggleBtnId, highlightToggleBtnId, chipsContainerId, chatElExpr, instanceName }) を埋め込む
 *   4. モーダルを開く処理で window[instanceName].reset() → window[instanceName].loadForShare(shareId) を呼ぶ
 *
 * renderKeywordClassifyPanelJs が生成するコードは escHtml / getNextZ という
 * 呼び出し元スクリプト側のグローバル関数に依存する（両関数とも呼び出し元で定義済みであること）。
 */

export interface KeywordClassifyPanelOptions {
  /** 📝トグルボタンの id */
  toggleBtnId: string;
  /** 🔑ハイライトON/OFFトグルボタンの id */
  highlightToggleBtnId: string;
  /** キーワードチップを描画するコンテナ要素の id */
  chipsContainerId: string;
  /** ハイライト対象のチャット表示要素を指す JS 式（例: 'histDetailChat'） */
  chatElExpr: string;
  /** loadForShare(shareId) / reset() を公開するグローバル変数名 */
  instanceName: string;
}

export function renderKeywordClassifyPanelCss(): string {
  return `
    .kwcls-chip { display:inline-block; padding:3px 9px; border-radius:12px; font-size:11px; white-space:nowrap; cursor:pointer; box-sizing:border-box; }
    .kwcls-chip-cls { border:1.5px solid var(--kw-pal-cls,#7c3aed); color:var(--kw-pal-cls,#7c3aed); background:transparent; }
    .kwcls-chip-unc { background:var(--kw-pal-unc-bg,rgba(0,0,0,0.07)); color:var(--kw-pal-unc-fg,var(--text-secondary,#6b7280)); border:1.5px solid transparent; }
    [data-theme="dark"] .kwcls-chip-unc { background:var(--kw-pal-unc-bg,rgba(255,255,255,0.1)); color:var(--kw-pal-unc-fg,var(--text-secondary,#9ca3af)); }
    .kwcls-chip-active { background:var(--kw-pal-act,#6366f1) !important; color:#fff !important; border-color:var(--kw-pal-act,#6366f1) !important; }
    .kwcls-edit-toggle-btn { background:#21262d; border:1px solid #30363d; color:#8b949e; border-radius:6px; padding:2px 7px; font-size:12px; cursor:pointer; opacity:0.4; margin-right:6px; vertical-align:middle; flex-shrink:0; }
    .kwcls-highlight-toggle-btn { background:none; border:none; color:#8b949e; padding:3px 7px; font-size:14px; opacity:0.2; cursor:pointer; flex-shrink:0; }
    .kw-highlight { background:#fef08a; color:#1a1a1a; border-radius:2px; padding:0 1px; }
    .kwcls-hl-hidden .kw-highlight { background:transparent; color:inherit; outline:none; }
  `;
}

export function renderKeywordEditToggleButtonHtml(toggleBtnId: string): string {
  return `<button class="kwcls-edit-toggle-btn" id="${toggleBtnId}" type="button" title="キーワード分類モード: 未分類のキーワードをタップするとキーワード分類モーダルが開きます">📝</button>`;
}

export function renderHighlightToggleButtonHtml(highlightToggleBtnId: string): string {
  return `<button class="kwcls-highlight-toggle-btn" id="${highlightToggleBtnId}" type="button" title="キーワードハイライトなし">🔑</button>`;
}

export function renderKeywordChipsContainerHtml(chipsContainerId: string): string {
  return `<div id="${chipsContainerId}" style="display:none;padding:6px 16px 4px;flex-wrap:wrap;gap:4px;border-top:1px solid #21262d;flex-shrink:0;"></div>`;
}

export function renderKeywordClassifyPanelJs(opts: KeywordClassifyPanelOptions): string {
  const { toggleBtnId, highlightToggleBtnId, chipsContainerId, chatElExpr, instanceName } = opts;
  return `
  (function() {
    var KW_CAT_COLORS = [
      '#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e',
      '#10b981','#14b8a6','#06b6d4','#0ea5e9','#3b82f6','#6366f1',
      '#8b5cf6','#a855f7','#d946ef','#ec4899','#f43f5e','#64748b',
      '#6b7280','#1e293b'
    ];

    function kwPanelHighlightApply(el, keyword) {
      if (!keyword || !el) return;
      var kwList = Array.isArray(keyword) ? keyword.filter(Boolean) : [keyword];
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

    function kwPanelHighlightClear(container) {
      if (!container) return;
      var marks = container.querySelectorAll('.kw-highlight');
      marks.forEach(function(mark) {
        if (mark.parentNode) {
          mark.parentNode.replaceChild(document.createTextNode(mark.textContent), mark);
        }
      });
      if (container.normalize) container.normalize();
    }

    function openKwClassifyModal(keyword, onSaved) {
      var overlay = document.createElement('div');
      overlay.setAttribute('data-overlay', '');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:' + getNextZ() + ';display:flex;align-items:flex-start;justify-content:center;padding-top:60px;';

      var box = document.createElement('div');
      box.style.cssText = 'background:var(--bg-secondary,#161b22);border-radius:12px;width:min(520px,94vw);max-height:80vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.22);';

      var head = document.createElement('div');
      head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--border-color,#30363d);flex-shrink:0;';
      var titleEl = document.createElement('span');
      titleEl.textContent = '🔑 分類: ' + keyword;
      titleEl.style.cssText = 'font-weight:700;font-size:14px;color:var(--text-primary,#e6edf3);';
      var closeBtn = document.createElement('button');
      closeBtn.textContent = '✕';
      closeBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:16px;color:var(--text-muted,#8b949e);padding:0 4px;';
      closeBtn.addEventListener('click', function() { document.body.removeChild(overlay); });
      head.appendChild(titleEl);
      head.appendChild(closeBtn);
      box.appendChild(head);

      var body = document.createElement('div');
      body.style.cssText = 'padding:16px 18px;overflow-y:auto;flex:1;';

      var catsSection = document.createElement('div');
      catsSection.style.cssText = 'margin-bottom:14px;min-height:24px;line-height:2;';
      body.appendChild(catsSection);

      var registerLabel = document.createElement('div');
      registerLabel.textContent = '新しいカテゴリを登録';
      registerLabel.style.cssText = 'font-size:11px;font-weight:600;color:var(--text-muted,#8b949e);letter-spacing:0.05em;margin-bottom:6px;';
      body.appendChild(registerLabel);

      var selectedColor = KW_CAT_COLORS[11];
      var colorRow = document.createElement('div');
      colorRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px;';
      KW_CAT_COLORS.forEach(function(col) {
        var swatch = document.createElement('span');
        swatch.dataset.color = col;
        swatch.style.cssText = 'display:inline-block;width:22px;height:22px;border-radius:50%;background:' + col + ';cursor:pointer;box-sizing:border-box;border:2.5px solid ' + (col === selectedColor ? '#fff' : 'transparent') + ';box-shadow:0 0 0 1px rgba(0,0,0,0.15);transition:border-color 0.1s;';
        swatch.addEventListener('click', function() {
          selectedColor = col;
          colorRow.querySelectorAll('span').forEach(function(s) {
            s.style.borderColor = s.dataset.color === selectedColor ? '#fff' : 'transparent';
          });
        });
        colorRow.appendChild(swatch);
      });
      body.appendChild(colorRow);

      var inputRow = document.createElement('div');
      inputRow.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:14px;';
      var catInput = document.createElement('input');
      catInput.type = 'text';
      catInput.placeholder = 'カテゴリ名を入力…';
      catInput.style.cssText = 'flex:1;padding:6px 10px;border:1px solid var(--border-color,#30363d);border-radius:6px;font-size:13px;background:var(--bg-primary,#0d1117);color:var(--text-primary,#e6edf3);';
      var addCatBtn = document.createElement('button');
      addCatBtn.textContent = '登録';
      addCatBtn.disabled = true;
      addCatBtn.style.cssText = 'padding:6px 14px;border-radius:6px;border:none;background:var(--accent-color,#667eea);color:#fff;font-size:13px;cursor:pointer;opacity:0.4;';
      inputRow.appendChild(catInput);
      inputRow.appendChild(addCatBtn);
      body.appendChild(inputRow);

      var foot = document.createElement('div');
      foot.style.cssText = 'padding:12px 18px;border-top:1px solid var(--border-color,#30363d);display:flex;justify-content:flex-end;gap:8px;flex-shrink:0;';
      var cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'キャンセル';
      cancelBtn.style.cssText = 'padding:7px 16px;border-radius:6px;border:1px solid var(--border-color,#30363d);background:transparent;color:var(--text-muted,#8b949e);font-size:13px;cursor:pointer;';
      cancelBtn.addEventListener('click', function() { document.body.removeChild(overlay); });
      var decideBtn = document.createElement('button');
      decideBtn.textContent = '分類決定';
      decideBtn.disabled = true;
      decideBtn.style.cssText = 'padding:7px 16px;border-radius:6px;border:none;background:var(--accent-color,#667eea);color:#fff;font-size:13px;cursor:pointer;opacity:0.4;';
      foot.appendChild(cancelBtn);
      foot.appendChild(decideBtn);

      box.appendChild(body);
      box.appendChild(foot);
      overlay.appendChild(box);
      overlay.addEventListener('click', function(e) { if (e.target === overlay) document.body.removeChild(overlay); });
      document.body.appendChild(overlay);

      var selectedCatIds = [];

      function updateDecideBtn() {
        var ok = selectedCatIds.length > 0 || catInput.value.trim().length > 0;
        decideBtn.disabled = !ok;
        decideBtn.style.opacity = ok ? '1' : '0.4';
      }

      function renderCatBadge(cat) {
        var badge = document.createElement('span');
        badge.textContent = cat.name;
        var col = cat.color || '#6366f1';
        badge.style.cssText = 'display:inline-block;padding:3px 12px;margin:2px 4px;border-radius:6px;font-size:12px;cursor:pointer;border:2px solid ' + col + ';background:transparent;color:' + col + ';user-select:none;font-weight:600;';
        badge.dataset.catId = String(cat.id);
        if (cat.is_mapped) {
          badge.style.background = col;
          badge.style.color = '#fff';
          selectedCatIds.push(cat.id);
        }
        badge.addEventListener('click', function() {
          var id = cat.id;
          var sel = selectedCatIds.indexOf(id) >= 0;
          if (sel) {
            selectedCatIds = selectedCatIds.filter(function(x) { return x !== id; });
            badge.style.background = 'transparent';
            badge.style.color = col;
          } else {
            selectedCatIds.push(id);
            badge.style.background = col;
            badge.style.color = '#fff';
          }
          updateDecideBtn();
        });
        return badge;
      }

      function loadCategories() {
        selectedCatIds = [];
        fetch('/api/aichat/keyword-categories?keyword=' + encodeURIComponent(keyword), { credentials: 'same-origin' })
          .then(function(r) { return r.json(); })
          .then(function(d) {
            var cats = d.categories || [];
            catsSection.innerHTML = '';
            if (cats.length === 0) {
              catsSection.style.display = 'none';
            } else {
              catsSection.style.display = '';
              cats.forEach(function(cat) { catsSection.appendChild(renderCatBadge(cat)); });
            }
            updateDecideBtn();
          })
          .catch(function() { catsSection.textContent = '読み込みに失敗しました'; });
      }

      loadCategories();

      catInput.addEventListener('input', function() {
        var val = catInput.value.trim();
        updateDecideBtn();
        if (!val) { addCatBtn.disabled = true; addCatBtn.style.opacity = '0.4'; return; }
        var exists = Array.from(catsSection.querySelectorAll('[data-cat-id]')).some(function(el) {
          return el.textContent === val;
        });
        if (exists) { addCatBtn.disabled = true; addCatBtn.style.opacity = '0.4'; return; }
        addCatBtn.disabled = false;
        addCatBtn.style.opacity = '1';
      });

      addCatBtn.addEventListener('click', function() {
        var val = catInput.value.trim();
        if (!val) return;
        addCatBtn.disabled = true;
        addCatBtn.style.opacity = '0.4';
        fetch('/api/aichat/keyword-categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ name: val, color: selectedColor }),
        })
          .then(function(r) { return r.json(); })
          .then(function() {
            catInput.value = '';
            loadCategories();
          })
          .catch(function() {
            addCatBtn.disabled = false;
            addCatBtn.style.opacity = '1';
          });
      });

      decideBtn.addEventListener('click', function() {
        var pendingName = catInput.value.trim();
        if (selectedCatIds.length === 0 && !pendingName) return;
        decideBtn.disabled = true;
        decideBtn.style.opacity = '0.4';

        function restoreDecideBtn() {
          decideBtn.disabled = false;
          decideBtn.style.opacity = '1';
        }

        function saveMapping(catIds) {
          if (catIds.length === 0) { restoreDecideBtn(); return; }
          fetch('/api/aichat/keyword-category-map', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ keyword: keyword, category_ids: catIds }),
          })
            .then(function(r) { return r.json(); })
            .then(function() {
              document.body.removeChild(overlay);
              if (typeof renderKwClassifyList === 'function') renderKwClassifyList();
              if (typeof onSaved === 'function') onSaved();
            })
            .catch(restoreDecideBtn);
        }

        if (!pendingName) { saveMapping(selectedCatIds); return; }

        var existingEl = Array.from(catsSection.querySelectorAll('[data-cat-id]')).filter(function(el) {
          return el.textContent === pendingName;
        })[0];
        if (existingEl) {
          var existingId = parseInt(existingEl.dataset.catId, 10);
          if (selectedCatIds.indexOf(existingId) < 0) selectedCatIds.push(existingId);
          saveMapping(selectedCatIds);
          return;
        }

        fetch('/api/aichat/keyword-categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ name: pendingName, color: selectedColor }),
        })
          .then(function(r) { return r.json(); })
          .then(function(d) {
            if (d && d.category && typeof d.category.id === 'number') {
              if (selectedCatIds.indexOf(d.category.id) < 0) selectedCatIds.push(d.category.id);
              saveMapping(selectedCatIds);
            } else {
              restoreDecideBtn();
            }
          })
          .catch(restoreDecideBtn);
      });
    }

    var kwPanelChipsEl = document.getElementById(${JSON.stringify(chipsContainerId)});
    var kwPanelToggleBtn = document.getElementById(${JSON.stringify(toggleBtnId)});
    var kwHighlightToggleBtn = document.getElementById(${JSON.stringify(highlightToggleBtnId)});
    var kwPanelEditMode = false;
    var kwPanelKeywords = [];
    var kwPanelActiveKeyword = '';
    var kwPanelCurrentShareId = null;
    var kwPanelChipsPinned = false;
    var kwPanelHighlightActive = true;
    var kwPanelDbApplied = false;

    if (kwPanelToggleBtn) {
      kwPanelToggleBtn.addEventListener('click', function() {
        kwPanelEditMode = !kwPanelEditMode;
        kwPanelToggleBtn.style.opacity = kwPanelEditMode ? '1' : '0.4';
        kwPanelToggleBtn.style.background = kwPanelEditMode ? 'var(--accent-color,#667eea)' : '';
        kwPanelToggleBtn.style.color = kwPanelEditMode ? '#fff' : '';
      });
    }

    function kwPanelBuildAllKeywords() {
      var all = [];
      kwPanelKeywords.forEach(function(k) {
        var kw = k && typeof k === 'object' ? k.keyword : k;
        if (kw && all.indexOf(kw) === -1) all.push(kw);
      });
      return all;
    }

    function kwPanelRender(show) {
      if (!kwPanelChipsEl) return;
      if (!show || kwPanelKeywords.length === 0) {
        kwPanelChipsEl.style.display = 'none';
        kwPanelChipsEl.innerHTML = '';
        return;
      }
      kwPanelChipsEl.innerHTML = '';
      kwPanelChipsEl.style.display = 'flex';
      var sorted = kwPanelKeywords.slice().sort(function(a, b) { return (b.count || 0) - (a.count || 0); });
      sorted.forEach(function(item) {
        var kw = item.keyword;
        var cnt = item.count;
        var isClassified = !!item.is_classified;
        var isActive = kw === kwPanelActiveKeyword;
        var chip = document.createElement('span');
        chip.className = 'kwcls-chip ' + (isClassified ? 'kwcls-chip-cls' : 'kwcls-chip-unc') + (isActive ? ' kwcls-chip-active' : '');
        chip.innerHTML = escHtml(kw) + (cnt != null ? ' <span style="opacity:0.6">(' + cnt + ')</span>' : '');
        chip.title = kw + (cnt != null ? ' (全回答から抽出した数字(重要): ' + cnt + ')' : '') + (isClassified ? ' [分類済]' : ' [未分類]');
        chip.addEventListener('click', function() {
          if (kwPanelEditMode && !isClassified) {
            openKwClassifyModal(kw, function() {
              if (kwPanelCurrentShareId) kwPanelLoadForShare(kwPanelCurrentShareId);
            });
            return;
          }
          kwPanelChipsPinned = true;
          kwPanelActiveKeyword = kw;
          var chatEl = ${chatElExpr};
          if (chatEl) {
            kwPanelHighlightClear(chatEl);
            kwPanelHighlightApply(chatEl, kw);
            chatEl.classList.remove('kwcls-hl-hidden');
          }
          kwPanelHighlightActive = true;
          if (chatEl) {
            var first = chatEl.querySelector('.kw-highlight');
            if (first && first.scrollIntoView) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          kwPanelChipsEl.querySelectorAll('.kwcls-chip').forEach(function(c) { c.classList.remove('kwcls-chip-active'); });
          chip.classList.add('kwcls-chip-active');
          kwPanelUpdateHighlightToggleBtn();
        });
        kwPanelChipsEl.appendChild(chip);
      });
    }

    function kwPanelUpdateHighlightToggleBtn() {
      var chatEl = ${chatElExpr};
      var marks = chatEl ? chatEl.querySelectorAll('.kw-highlight') : [];
      var highlightsVisible = marks && marks.length > 0 && kwPanelHighlightActive;
      kwPanelRender(!highlightsVisible || kwPanelChipsPinned);
      if (!kwHighlightToggleBtn) return;
      if (!marks || marks.length === 0) {
        if (kwPanelKeywords.length > 0) {
          kwHighlightToggleBtn.style.opacity = '1';
          kwHighlightToggleBtn.title = '🔑 クリックでキーワードをハイライト表示';
        } else {
          kwHighlightToggleBtn.style.opacity = '0.2';
          kwHighlightToggleBtn.title = 'キーワードハイライトなし';
        }
        return;
      }
      if (kwPanelHighlightActive) {
        kwHighlightToggleBtn.style.opacity = '1';
        kwHighlightToggleBtn.title = '🔑 ハイライト表示中（クリックで非表示）';
      } else {
        kwHighlightToggleBtn.style.opacity = '0.35';
        kwHighlightToggleBtn.title = '🔑 ハイライト非表示（クリックで表示）';
      }
    }

    function kwPanelApplyAllDbKeywordHighlights() {
      kwPanelHighlightActive = true;
      var chatEl = ${chatElExpr};
      if (chatEl) {
        chatEl.classList.remove('kwcls-hl-hidden');
        kwPanelHighlightClear(chatEl);
        var allKws = kwPanelBuildAllKeywords();
        if (allKws.length > 0) kwPanelHighlightApply(chatEl, allKws);
      }
      kwPanelDbApplied = true;
      kwPanelUpdateHighlightToggleBtn();
    }

    if (kwHighlightToggleBtn) {
      kwHighlightToggleBtn.addEventListener('click', function() {
        if (kwPanelKeywords.length > 0 && !kwPanelDbApplied) {
          kwPanelChipsPinned = false;
          kwPanelApplyAllDbKeywordHighlights();
          return;
        }
        if (!kwPanelDbApplied && kwPanelCurrentShareId) {
          kwPanelLoadForShare(kwPanelCurrentShareId, kwPanelApplyAllDbKeywordHighlights);
          return;
        }
        var chatEl = ${chatElExpr};
        var marks = chatEl ? chatEl.querySelectorAll('.kw-highlight') : [];
        if (!marks || marks.length === 0) return;
        kwPanelHighlightActive = !kwPanelHighlightActive;
        if (kwPanelHighlightActive) {
          kwPanelChipsPinned = false;
          if (chatEl) chatEl.classList.remove('kwcls-hl-hidden');
        } else {
          if (chatEl) chatEl.classList.add('kwcls-hl-hidden');
        }
        kwPanelUpdateHighlightToggleBtn();
      });
    }

    function kwPanelLoadForShare(shareId, cb) {
      kwPanelCurrentShareId = shareId;
      fetch('/api/aichat/share-keywords?shareId=' + encodeURIComponent(String(shareId)), { credentials: 'same-origin' })
        .then(function(res) { return res.json(); })
        .then(function(d) {
          kwPanelKeywords = d.keywords || [];
          kwPanelUpdateHighlightToggleBtn();
          if (typeof cb === 'function') cb();
        })
        .catch(function() {
          kwPanelKeywords = [];
          kwPanelUpdateHighlightToggleBtn();
          if (typeof cb === 'function') cb();
        });
    }

    function kwPanelReset() {
      kwPanelCurrentShareId = null;
      kwPanelKeywords = [];
      kwPanelActiveKeyword = '';
      kwPanelEditMode = false;
      kwPanelChipsPinned = false;
      kwPanelHighlightActive = true;
      kwPanelDbApplied = false;
      if (kwPanelToggleBtn) {
        kwPanelToggleBtn.style.opacity = '0.4';
        kwPanelToggleBtn.style.background = '';
        kwPanelToggleBtn.style.color = '';
      }
      var chatEl = ${chatElExpr};
      if (chatEl) chatEl.classList.remove('kwcls-hl-hidden');
      kwPanelUpdateHighlightToggleBtn();
    }

    window[${JSON.stringify(instanceName)}] = { loadForShare: kwPanelLoadForShare, reset: kwPanelReset };
  }());`;
}
