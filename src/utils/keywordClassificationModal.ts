/** AIチャットとCodex質問ツリーで共有するキーワード分類モーダル。 */
export function getKeywordClassificationModalScript(includePalette = false): string {
  return (includePalette ? String.raw`    var KW_CAT_COLORS = [
      '#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e',
      '#10b981','#14b8a6','#06b6d4','#0ea5e9','#3b82f6','#6366f1',
      '#8b5cf6','#a855f7','#d946ef','#ec4899','#f43f5e','#64748b',
      '#6b7280','#1e293b'
    ];

` : '') + String.raw`    function openKwClassifyModal(keyword, onSaved) {
      var options = arguments[2];
      var selectedColor = KW_CAT_COLORS[11];
      var overlay = document.createElement(options && options.topLayer ? 'dialog' : 'div');
      overlay.setAttribute('aria-label', 'キーワード分類: ' + keyword);
      overlay.setAttribute('data-overlay', '');
      overlay.style.cssText = 'position:fixed;inset:0;background:var(--modal-overlay);z-index:' + getNextZ() + ';display:flex;align-items:flex-start;justify-content:center;padding-top:60px;';

      var box = document.createElement('div');
      box.style.cssText = 'background:var(--bg-secondary);border-radius:12px;width:min(520px,94vw);max-height:80vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.22);';

      var head = document.createElement('div');
      head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--border-color);flex-shrink:0;';
      var titleEl = document.createElement('span');
      titleEl.textContent = '🔑 分類: ' + keyword;
      titleEl.style.cssText = 'font-weight:700;font-size:14px;';
      var closeBtn = document.createElement('button');
      closeBtn.textContent = '✕';
      closeBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:16px;color:var(--text-muted);padding:0 4px;';
      closeBtn.addEventListener('click', function() { document.body.removeChild(overlay); });
      head.appendChild(titleEl);
      head.appendChild(closeBtn);
      box.appendChild(head);

      var body = document.createElement('div');
      body.style.cssText = 'padding:16px 18px;overflow-y:auto;flex:1;';

      var suggestBadge = document.createElement('div');
      suggestBadge.style.cssText = 'font-size:11px;color:var(--text-muted);margin-bottom:8px;min-height:16px;';
      body.appendChild(suggestBadge);

      var catsSection = document.createElement('div');
      catsSection.style.cssText = 'margin-bottom:14px;min-height:24px;line-height:2;';
      body.appendChild(catsSection);

      var colorEditorStatus = document.createElement('div');
      colorEditorStatus.style.cssText = 'font-size:11px;margin-bottom:6px;min-height:14px;color:var(--text-muted);';
      body.appendChild(colorEditorStatus);
      var colorEditorPanel = document.createElement('div');
      colorEditorPanel.style.cssText = 'display:none;flex-wrap:wrap;gap:5px;margin-bottom:10px;padding:8px;border:1px dashed var(--border-color);border-radius:6px;';
      body.appendChild(colorEditorPanel);

      function openColorEditor(catId, currentColor) {
        colorEditorStatus.textContent = 'この分類の識別色を選択してください';
        colorEditorPanel.innerHTML = '';
        colorEditorPanel.style.display = 'flex';
        KW_CAT_COLORS.forEach(function(col) {
          var sw = document.createElement('span');
          sw.className = 'kwcat-color-edit-swatch';
          sw.dataset.color = col;
          sw.style.cssText = 'display:inline-block;width:22px;height:22px;border-radius:50%;background:' + col + ';cursor:pointer;box-sizing:border-box;border:2.5px solid ' + (col === currentColor ? '#fff' : 'transparent') + ';box-shadow:0 0 0 1px rgba(0,0,0,0.15);';
          sw.addEventListener('click', function() {
            colorEditorStatus.textContent = '保存中…';
            fetch('/api/aichat/keyword-categories/' + catId, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ color: col }),
            })
              .then(function(r) {
                return r.json().catch(function() { return {}; }).then(function(d) {
                  if (!r.ok) throw new Error((d && d.error) || ('HTTP ' + r.status));
                  return d;
                });
              })
              .then(function() {
                colorEditorStatus.textContent = '';
                colorEditorPanel.style.display = 'none';
                loadCategories();
              })
              .catch(function(err) {
                colorEditorStatus.textContent = '色の変更を保存できませんでした: ' + (err && err.message ? err.message : '不明なエラー');
              });
          });
          colorEditorPanel.appendChild(sw);
        });
      }

      var registerLabel = document.createElement('div');
      registerLabel.textContent = '新しいカテゴリを登録';
      registerLabel.style.cssText = 'font-size:11px;font-weight:600;color:var(--text-muted);letter-spacing:0.05em;margin-bottom:6px;';
      body.appendChild(registerLabel);

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
      catInput.style.cssText = 'flex:1;padding:6px 10px;border:1px solid var(--border-color);border-radius:6px;font-size:13px;background:var(--bg-primary);color:var(--text-primary);';
      var addCatBtn = document.createElement('button');
      addCatBtn.textContent = '登録';
      addCatBtn.disabled = true;
      addCatBtn.style.cssText = 'padding:6px 14px;border-radius:6px;border:none;background:var(--accent-color,#667eea);color:#fff;font-size:13px;cursor:pointer;opacity:0.4;';
      inputRow.appendChild(catInput);
      inputRow.appendChild(addCatBtn);
      body.appendChild(inputRow);

      var foot = document.createElement('div');
      foot.style.cssText = 'padding:12px 18px;border-top:1px solid var(--border-color);display:flex;justify-content:flex-end;gap:8px;flex-shrink:0;';
      var cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'キャンセル';
      cancelBtn.style.cssText = 'padding:7px 16px;border-radius:6px;border:1px solid var(--border-color);background:transparent;color:var(--text-muted);font-size:13px;cursor:pointer;';
      cancelBtn.addEventListener('click', function() { document.body.removeChild(overlay); });
      var decideBtn = document.createElement('button');
      decideBtn.className = 'kwcat-decide-btn';
      decideBtn.textContent = '分類決定';
      decideBtn.disabled = true;
      decideBtn.style.cssText = 'padding:7px 16px;border-radius:6px;border:none;background:var(--accent-color,#667eea);color:#fff;font-size:13px;cursor:pointer;opacity:0.4;';
      foot.appendChild(cancelBtn);
      foot.appendChild(decideBtn);

      box.appendChild(body);
      box.appendChild(foot);
      overlay.appendChild(box);
      overlay.addEventListener('click', function(e) { if (e.target === overlay) document.body.removeChild(overlay); });
      if (options && options.topLayer) {
        overlay.style.color = 'var(--text-primary)'; overlay.style.width = '100vw'; overlay.style.maxWidth = 'none'; overlay.style.height = '100vh'; overlay.style.maxHeight = 'none'; overlay.style.margin = '0'; overlay.style.border = '0';
        overlay.addEventListener('cancel', function(event) { event.preventDefault(); overlay.remove(); });
      }
      document.body.appendChild(overlay);
      if (options && options.topLayer) overlay.showModal();

      function readClassificationJson(r) {
        return r.json().then(function(d) {
          if (r.ok === false || (d && d.error)) throw new Error((d && d.error) || ('HTTP ' + r.status));
          return d;
        });
      }
      var selectedCatIds = [];

      function updateDecideBtn() {
        var ok = selectedCatIds.length > 0 || catInput.value.trim().length > 0;
        decideBtn.disabled = !ok;
        decideBtn.style.opacity = ok ? '1' : '0.4';
      }

      function renderCatBadge(cat) {
        var badge = document.createElement('span');
        var col = cat.color || '#6366f1';
        badge.style.cssText = 'display:inline-block;padding:3px 12px;margin:2px 4px;border-radius:6px;font-size:12px;cursor:pointer;border:2px solid ' + col + ';background:transparent;color:' + col + ';user-select:none;font-weight:600;';
        badge.dataset.catId = String(cat.id);
        badge.dataset.catName = cat.name;

        var nameSpan = document.createElement('span');
        nameSpan.textContent = cat.name;
        badge.appendChild(nameSpan);

        var editDot = document.createElement('span');
        editDot.className = 'kwcat-color-edit-dot';
        editDot.textContent = ' 🎨';
        editDot.title = 'この分類の識別色を変更';
        editDot.style.cssText = 'cursor:pointer;';
        editDot.addEventListener('click', function(e) {
          e.stopPropagation();
          openColorEditor(cat.id, col);
        });
        badge.appendChild(editDot);

        if (cat.is_mapped) {
          badge.style.background = col;
          badge.style.color = '#fff';
          selectedCatIds.push(cat.id);
        }
        nameSpan.addEventListener('click', function() {
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
          .then(readClassificationJson)
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

      fetch('/api/aichat/keyword-category-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ keyword: keyword }),
      })
        .then(readClassificationJson)
        .then(function(d) {
          if (d && d.suggestion) {
            var pct = Math.round(d.suggestion.similarity * 100);
            suggestBadge.textContent = '🤖 推定: ' + d.suggestion.name + '（類似度' + pct + '%・参考情報であり自動では反映されません）';
          }
        })
        .catch(function() {});

      catInput.addEventListener('input', function() {
        var val = catInput.value.trim();
        updateDecideBtn();
        if (!val) { addCatBtn.disabled = true; addCatBtn.style.opacity = '0.4'; return; }
        var exists = Array.from(catsSection.querySelectorAll('[data-cat-id]')).some(function(el) {
          return el.dataset.catName === val;
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
          .then(readClassificationJson)
          .then(function() {
            catInput.value = '';
            loadCategories();
          })
          .catch(function(error) {
            colorEditorStatus.textContent = 'カテゴリを登録できませんでした: ' + error.message;
            addCatBtn.disabled = false;
            addCatBtn.style.opacity = '1';
          });
      });

      decideBtn.addEventListener('click', function() {
        var pendingName = catInput.value.trim();
        if (selectedCatIds.length === 0 && !pendingName) return;
        decideBtn.disabled = true;
        decideBtn.style.opacity = '0.4';

        function restoreDecideBtn(error) {
          if (error) colorEditorStatus.textContent = '分類を保存できませんでした: ' + error.message;
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
            .then(readClassificationJson)
            .then(function() {
              document.body.removeChild(overlay);
              if (typeof renderKwClassifyList === 'function') renderKwClassifyList();
              if (typeof onSaved === 'function') onSaved();
            })
            .catch(restoreDecideBtn);
        }

        if (!pendingName) { saveMapping(selectedCatIds); return; }

        var existingEl = Array.from(catsSection.querySelectorAll('[data-cat-id]')).filter(function(el) {
          return el.dataset.catName === pendingName;
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
          .then(readClassificationJson)
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
`;
}
