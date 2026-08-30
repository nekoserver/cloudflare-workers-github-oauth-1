/**
 * 予定登録機能一式(日時+ラベル入力→POST /api/countdown、複数件の一括登録にも対応)を、
 * どのページからでも呼び出せるモーダルとして切り出したもの。/countdownページの
 * カレンダーからの登録とは別に、カレンダー日付を選んでいない状態からでも即座に
 * 日時を指定して登録できるようにする(AIチャットの「次の予定一覧」応答の「登録」
 * ボタン等から使う想定)。
 *
 * getCountdownWidgetCSS/HTML/Script (src/utils/countdownWidget.ts) と同じ
 * 「CSS・HTML・スクリプトをそれぞれ関数で返し、埋め込みたいページの
 * テンプレートリテラル内で呼び出す」方式で提供する。スクリプトは
 * window.openCountdownQuickAddModal(onSaved) をグローバルに公開し、
 * 呼び出し元は保存成功時のコールバック(省略可)だけ渡せばよい。
 *
 * 複数件の一括登録: 「+ もう1件追加」で日時+ラベルの行を増やせる。保存時は
 * 全行を検証してから POST /api/countdown へ {events:[...]}} 形式で一括送信する
 * (サーバー側は2件以上ならまとめて同じgroup_idを割り振り、後で画面右下の
 * ウィジェットがタイマー完了トーストに「index/total」形式で表示できるようにする)。
 */

/** <style>内に展開する、クイック登録モーダルのCSS。 */
export function getCountdownQuickAddModalCSS(): string {
  return `
    #countdownQuickAddOverlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: 2000;
      align-items: center;
      justify-content: center;
    }
    #countdownQuickAddOverlay.open { display: flex; }
    #countdownQuickAddPanel {
      background: var(--card-bg);
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      padding: 20px;
      width: 380px;
      max-width: 90vw;
      max-height: 80vh;
      overflow-y: auto;
    }
    #countdownQuickAddPanel .qa-title { font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 12px; }
    #countdownQaRows { display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px; }
    .qa-row-entry { display: flex; gap: 6px; align-items: center; }
    .qa-row-entry input {
      padding: 8px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: var(--bg-secondary);
      color: var(--text-primary);
      font-size: 13px;
      box-sizing: border-box;
    }
    .qa-row-entry .qa-row-date { flex: 1.1; min-width: 0; }
    .qa-row-entry .qa-row-time { flex: 0.8; min-width: 0; }
    .qa-row-entry .qa-row-label { flex: 1.3; min-width: 0; }
    .qa-row-remove-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 16px;
      cursor: pointer;
      padding: 0 4px;
      line-height: 1;
    }
    .qa-row-remove-btn:hover { color: #ef4444; }
    .qa-add-row-btn {
      background: none;
      border: 1px dashed var(--border-color);
      color: var(--text-secondary);
      border-radius: 8px;
      padding: 6px 10px;
      font-size: 12px;
      cursor: pointer;
      width: 100%;
      margin-bottom: 10px;
    }
    .qa-add-row-btn:hover { color: var(--accent-color, #667eea); border-color: var(--accent-color, #667eea); }
    #countdownQuickAddPanel .qa-error { font-size: 12px; color: #ef4444; margin-bottom: 8px; display: none; }
    #countdownQuickAddPanel .qa-row { display: flex; gap: 8px; justify-content: flex-end; }
    #countdownQuickAddPanel .qa-cancel-btn {
      background: none;
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
      border-radius: 8px;
      padding: 8px 14px;
      font-size: 13px;
      cursor: pointer;
    }
    #countdownQuickAddPanel .qa-save-btn {
      background: #667eea;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 8px 14px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    #countdownQuickAddPanel .qa-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  `;
}

/** <body>内に配置する、クイック登録モーダルのマークアップ。行(日時+ラベル)はJS側で動的に生成する。 */
export function getCountdownQuickAddModalHTML(): string {
  return `
  <div id="countdownQuickAddOverlay">
    <div id="countdownQuickAddPanel">
      <div class="qa-title">予定を登録</div>
      <div id="countdownQaRows"></div>
      <button type="button" class="qa-add-row-btn" id="countdownQaAddRowBtn">+ もう1件追加</button>
      <div class="qa-error" id="countdownQaError"></div>
      <div class="qa-row">
        <button type="button" class="qa-cancel-btn" id="countdownQaCancelBtn">キャンセル</button>
        <button type="button" class="qa-save-btn" id="countdownQaSaveBtn">登録する</button>
      </div>
    </div>
  </div>
  `;
}

/**
 * window.openCountdownQuickAddModal(onSaved) を公開する。onSavedは登録成功時に
 * 呼ばれる任意のコールバック(省略可、一括登録した全イベントの配列を受け取る)。
 * 要素が存在しないページで呼ばれても例外にならないよう、呼び出し時にガードする。
 * 「+ もう1件追加」で行を増やせ、2件以上まとめて保存すると{events:[...]}}形式で
 * POST /api/countdownへ一括送信する(サーバー側が同じgroup_idを割り振る)。
 */
export function getCountdownQuickAddModalScript(): string {
  return `
    (function() {
      var overlay = document.getElementById('countdownQuickAddOverlay');
      var rowsContainer = document.getElementById('countdownQaRows');
      var addRowBtn = document.getElementById('countdownQaAddRowBtn');
      var errorEl = document.getElementById('countdownQaError');
      var saveBtn = document.getElementById('countdownQaSaveBtn');
      var cancelBtn = document.getElementById('countdownQaCancelBtn');
      if (!overlay || !rowsContainer || !addRowBtn || !errorEl || !saveBtn || !cancelBtn) {
        window.openCountdownQuickAddModal = function() {};
        return;
      }
      var pendingOnSaved = null;

      function pad2(n) { return String(n).padStart(2, '0'); }

      function todayStr() {
        var now = new Date();
        return now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate());
      }

      function updateRemoveButtonsVisibility() {
        var rows = rowsContainer.querySelectorAll('.qa-row-entry');
        for (var i = 0; i < rows.length; i++) {
          var removeBtn = rows[i].querySelector('.qa-row-remove-btn');
          if (removeBtn) removeBtn.style.visibility = rows.length > 1 ? 'visible' : 'hidden';
        }
      }

      function addRow() {
        var row = document.createElement('div');
        row.className = 'qa-row-entry';

        var dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.className = 'qa-row-date';
        dateInput.value = todayStr();

        var timeInput = document.createElement('input');
        timeInput.type = 'time';
        timeInput.className = 'qa-row-time';
        timeInput.value = '09:00';

        var labelInput = document.createElement('input');
        labelInput.type = 'text';
        labelInput.className = 'qa-row-label';
        labelInput.placeholder = '予定の名前(例: 会議)';
        labelInput.maxLength = 100;

        var removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'qa-row-remove-btn';
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', function() {
          if (rowsContainer.querySelectorAll('.qa-row-entry').length > 1) {
            row.remove();
            updateRemoveButtonsVisibility();
          }
        });

        row.appendChild(dateInput);
        row.appendChild(timeInput);
        row.appendChild(labelInput);
        row.appendChild(removeBtn);
        rowsContainer.appendChild(row);
        updateRemoveButtonsVisibility();
        return row;
      }

      addRowBtn.addEventListener('click', function() { addRow(); });

      function resetRows() {
        rowsContainer.innerHTML = '';
        addRow();
      }

      function closeModal() {
        overlay.classList.remove('open');
        pendingOnSaved = null;
      }

      function showError(message) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
      }

      window.openCountdownQuickAddModal = function(onSaved) {
        pendingOnSaved = typeof onSaved === 'function' ? onSaved : null;
        resetRows();
        errorEl.style.display = 'none';
        saveBtn.disabled = false;
        overlay.classList.add('open');
      };

      cancelBtn.addEventListener('click', closeModal);
      overlay.addEventListener('click', function(ev) {
        if (ev.target === overlay) closeModal();
      });

      // 各行を検証してevents配列を組み立てる。1件でも不正ならnullを返し、
      // showError()でどの行が問題かを伝える(部分登録を避けるため全件検証してから送信する)。
      function collectEvents() {
        var rowEls = rowsContainer.querySelectorAll('.qa-row-entry');
        var events = [];
        for (var i = 0; i < rowEls.length; i++) {
          var rowNumber = i + 1;
          var label = rowEls[i].querySelector('.qa-row-label').value.trim();
          var dateStr = rowEls[i].querySelector('.qa-row-date').value;
          var timeStr = rowEls[i].querySelector('.qa-row-time').value || '09:00';
          if (!label) { showError((rowEls.length > 1 ? (rowNumber + '件目: ') : '') + '予定の名前を入力してください'); return null; }
          if (!dateStr) { showError((rowEls.length > 1 ? (rowNumber + '件目: ') : '') + '日付を入力してください'); return null; }
          var targetAt = new Date(dateStr + 'T' + timeStr + ':00');
          if (isNaN(targetAt.getTime())) { showError((rowEls.length > 1 ? (rowNumber + '件目: ') : '') + '日時が不正です'); return null; }
          events.push({ label: label, targetAt: targetAt.toISOString() });
        }
        return events;
      }

      saveBtn.addEventListener('click', function() {
        errorEl.style.display = 'none';
        var events = collectEvents();
        if (!events) return;
        saveBtn.disabled = true;
        fetch('/api/countdown', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: events }),
        }).then(function(res) { return res.json(); }).then(function(data) {
          saveBtn.disabled = false;
          if (data.error) { showError(data.error); return; }
          var cb = pendingOnSaved;
          closeModal();
          if (cb) cb(data);
        }).catch(function() {
          saveBtn.disabled = false;
          showError('登録に失敗しました(通信エラー)');
        });
      });
    })();
  `;
}
