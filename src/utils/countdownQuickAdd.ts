/**
 * 予定登録機能一式(日時+ラベル入力→POST /api/countdown)を、どのページからでも
 * 呼び出せるモーダルとして切り出したもの。/countdownページのカレンダーからの
 * 登録とは別に、カレンダー日付を選んでいない状態からでも即座に日時を指定して
 * 登録できるようにする(AIチャットの「次の予定一覧」応答の「登録」ボタン等から使う想定)。
 *
 * getCountdownWidgetCSS/HTML/Script (src/utils/countdownWidget.ts) と同じ
 * 「CSS・HTML・スクリプトをそれぞれ関数で返し、埋め込みたいページの
 * テンプレートリテラル内で呼び出す」方式で提供する。スクリプトは
 * window.openCountdownQuickAddModal(onSaved) をグローバルに公開し、
 * 呼び出し元は保存成功時のコールバック(省略可)だけ渡せばよい。
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
      width: 320px;
      max-width: 90vw;
    }
    #countdownQuickAddPanel .qa-title { font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 12px; }
    #countdownQuickAddPanel input {
      width: 100%;
      padding: 10px;
      margin-bottom: 10px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: var(--bg-secondary);
      color: var(--text-primary);
      font-size: 14px;
      box-sizing: border-box;
    }
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

/** <body>内に配置する、クイック登録モーダルのマークアップ。 */
export function getCountdownQuickAddModalHTML(): string {
  return `
  <div id="countdownQuickAddOverlay">
    <div id="countdownQuickAddPanel">
      <div class="qa-title">予定を登録</div>
      <input type="date" id="countdownQaDate">
      <input type="time" id="countdownQaTime" value="09:00">
      <input type="text" id="countdownQaLabel" placeholder="予定の名前(例: 会議)" maxlength="100">
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
 * 呼ばれる任意のコールバック(省略可)。要素が存在しないページで呼ばれても
 * 例外にならないよう、呼び出し時にガードする。
 */
export function getCountdownQuickAddModalScript(): string {
  return `
    (function() {
      var overlay = document.getElementById('countdownQuickAddOverlay');
      var dateInput = document.getElementById('countdownQaDate');
      var timeInput = document.getElementById('countdownQaTime');
      var labelInput = document.getElementById('countdownQaLabel');
      var errorEl = document.getElementById('countdownQaError');
      var saveBtn = document.getElementById('countdownQaSaveBtn');
      var cancelBtn = document.getElementById('countdownQaCancelBtn');
      if (!overlay || !dateInput || !timeInput || !labelInput || !errorEl || !saveBtn || !cancelBtn) {
        window.openCountdownQuickAddModal = function() {};
        return;
      }
      var pendingOnSaved = null;

      function pad2(n) { return String(n).padStart(2, '0'); }

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
        var now = new Date();
        dateInput.value = now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate());
        timeInput.value = '09:00';
        labelInput.value = '';
        errorEl.style.display = 'none';
        saveBtn.disabled = false;
        overlay.classList.add('open');
      };

      cancelBtn.addEventListener('click', closeModal);
      overlay.addEventListener('click', function(ev) {
        if (ev.target === overlay) closeModal();
      });

      saveBtn.addEventListener('click', function() {
        var label = labelInput.value.trim();
        var dateStr = dateInput.value;
        var timeStr = timeInput.value || '09:00';
        errorEl.style.display = 'none';
        if (!label) { showError('予定の名前を入力してください'); return; }
        if (!dateStr) { showError('日付を入力してください'); return; }
        var targetAt = new Date(dateStr + 'T' + timeStr + ':00');
        if (isNaN(targetAt.getTime())) { showError('日時が不正です'); return; }
        saveBtn.disabled = true;
        fetch('/api/countdown', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: label, targetAt: targetAt.toISOString() }),
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
