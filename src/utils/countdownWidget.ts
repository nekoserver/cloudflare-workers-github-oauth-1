/**
 * 画面右下に常時表示する予定カウントダウンウィジェットの共通パーツ。
 * このリポジトリには全ページ共通のレイアウト機構が無く、各ページが独立した
 * HTMLを返す構造のため（他ページには埋め込まず`/countdown`ページのみで使う場合
 * でも）、`getThemeCSS()`/`getThemeToggleHTML()`/`getThemeToggleScript()`
 * (src/utils/theme.ts)と同じ「CSS・HTML・スクリプトをそれぞれ関数で返し、
 * 埋め込みたいページのテンプレートリテラル内で呼び出す」方式で切り出しておく。
 * これにより、この関数さえ呼べば他の任意のページにも同じウィジェットを
 * そのまま追加できる。
 *
 * 依存API: GET /api/countdown/next（ログイン中ユーザーの未来予定を近い順で返す）。
 * 認証はページ側のCookie/JWTに乗るため、このモジュール自体は認証情報を持たない。
 */

/** 画面内にウィジェットを収めるため、指定位置(left/top基準)をビューポート内にクランプする純粋関数。 */
export function clampCountdownWidgetPosition(
  left: number,
  top: number,
  widgetWidth: number,
  widgetHeight: number,
  viewportWidth: number,
  viewportHeight: number
): { left: number; top: number } {
  const maxLeft = Math.max(0, viewportWidth - widgetWidth);
  const maxTop = Math.max(0, viewportHeight - widgetHeight);
  return {
    left: Math.min(Math.max(0, left), maxLeft),
    top: Math.min(Math.max(0, top), maxTop),
  };
}

/** <style>内に展開する、ウィジェット本体のCSS。 */
export function getCountdownWidgetCSS(): string {
  return `
    #countdownWidget {
      position: fixed;
      right: 20px;
      bottom: 20px;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      padding: 14px 18px;
      min-width: 200px;
      max-height: calc(100vh - 40px);
      overflow-y: auto;
      z-index: 500;
      display: none;
      cursor: grab;
      touch-action: none;
      user-select: none;
    }
    #countdownWidget.visible { display: block; }
    #countdownWidget.dragging { cursor: grabbing; opacity: 0.85; }
    .countdown-widget-titlebar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; font-size: 13px; font-weight: 700; color: var(--text-primary); }
    #countdownWidgetToggle, #countdownWidgetMode, #countdownWidgetSettings { flex: none; width: 28px; height: 28px; padding: 0; border: 1px solid var(--border-color); border-radius: 6px; background: var(--card-bg); color: var(--text-primary); cursor: pointer; font: inherit; touch-action: manipulation; }
    .countdown-widget-actions { display: flex; gap: 6px; }
    #countdownWidgetSettingsDialog { max-width: min(440px, calc(100vw - 32px)); box-sizing: border-box; padding: 24px; border: 1px solid var(--border-color); border-radius: 12px; background: var(--card-bg); color: var(--text-primary); }
    #countdownWidgetSettingsDialog::backdrop { background: rgba(0, 0, 0, 0.5); }
    #countdownWidgetSettingsDialog h2 { margin: 0 0 16px; font-size: 18px; }
    #countdownWidgetSettingsDialog ul { list-style: none; padding: 0; margin: 0 0 20px; }
    #countdownWidgetSettingsDialog label { display: flex; align-items: flex-start; gap: 8px; line-height: 1.6; cursor: pointer; }
    #countdownWidgetSettingsDialog input { flex: none; margin-top: 6px; }
    #countdownWidgetSettingsDialog button { padding: 8px 16px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--card-bg); color: var(--text-primary); cursor: pointer; }
    #countdownWidgetTimers[hidden] { display: none; }
    #countdownWidget.collapsed .countdown-widget-titlebar { margin-bottom: 0; }
    .countdown-widget-timer + .countdown-widget-timer { border-top: 1px solid var(--border-color); margin-top: 10px; padding-top: 10px; }
    .widget-label { font-size: 12px; color: var(--text-muted); margin-bottom: 4px; }
    .widget-label[title] { cursor: help; text-decoration: underline dotted; text-underline-offset: 3px; }
    .widget-cron-label { position: relative; display: inline-flex; align-items: center; gap: 6px; cursor: help; }
    .widget-cron-tooltip {
      visibility: hidden; opacity: 0; position: absolute; right: 0; bottom: calc(100% + 8px);
      z-index: 2; width: min(290px, 78vw); padding: 10px; border-radius: 8px;
      background: var(--text-primary); color: var(--card-bg); line-height: 1.5;
      pointer-events: none; transition: opacity .15s ease;
    }
    .widget-cron-label:hover .widget-cron-tooltip,
    .widget-cron-label:focus-within .widget-cron-tooltip { visibility: visible; opacity: 1; pointer-events: auto; }
    .widget-cron-health {
      display: inline-flex; align-items: center; gap: 6px; margin-bottom: 6px; padding: 3px 8px;
      border-radius: 999px; color: #fff; text-decoration: none; font-weight: 700;
    }
    .widget-cron-health::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
    .widget-cron-health-healthy { background: #1a7f37; }
    .widget-cron-health-warning, .widget-cron-health-unknown { background: #9a6700; }
    .widget-cron-description { display: block; }
    .widget-clock { font-size: 20px; font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; }
    #countdownToast {
      position: fixed;
      right: 20px;
      bottom: 96px;
      background: #d6f4fb;
      color: #0c5c73;
      border: 1px solid #a8e6f5;
      border-radius: 10px;
      padding: 10px 16px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
      z-index: 600;
      opacity: 0;
      pointer-events: auto;
      max-height: 50vh;
      max-width: min(380px, calc(100vw - 40px));
      overflow-y: auto;
      transition: opacity 0.3s ease;
    }
    #countdownToast.visible { opacity: 1; }
    .countdown-toast-item { display: flex; align-items: center; gap: 12px; }
    .countdown-toast-item + .countdown-toast-item { border-top: 1px solid #a8e6f5; margin-top: 8px; padding-top: 8px; }
    .countdown-toast-close { margin-left: auto; cursor: pointer; }
  `;
}

/** <body>内に配置する、ウィジェットのマークアップ。 */
export function getCountdownWidgetHTML(): string {
  return `
  <div id="countdownWidget">
    <div class="countdown-widget-titlebar"><span><button id="countdownWidgetMode" type="button" aria-label="曜日・時刻表示に切り替える" aria-pressed="false">⏳</button> カウントダウン</span><span class="countdown-widget-actions"><button id="countdownWidgetSettings" type="button" aria-label="カウントダウン設定を開く" aria-haspopup="dialog" aria-controls="countdownWidgetSettingsDialog">⚙️</button><button id="countdownWidgetToggle" type="button" aria-controls="countdownWidgetTimers" aria-expanded="true" aria-label="すべてのカウントダウンを閉じる">▲</button></span></div>
    <div id="countdownWidgetTimers"></div>
  </div>
  <dialog id="countdownWidgetSettingsDialog" aria-labelledby="countdownWidgetSettingsTitle">
    <h2 id="countdownWidgetSettingsTitle">カウントダウン設定</h2>
    <ul><li><label><input id="countdownWidgetShowUrgent" type="checkbox" checked>ウィジェットクローズ時も3日以内のタイマーを表示する</label></li></ul>
    <form method="dialog"><button type="submit">閉じる</button></form>
  </dialog>
  <div id="countdownToast" role="log" aria-live="polite" aria-label="カウントダウン完了通知"></div>
  `;
}

/**
 * ウィジェットの挙動(1秒ごとの残り時間表示更新・30秒ごとの/api/countdown/next
 * 再取得)。呼び出し元ページの<script type="module">内にそのまま展開する想定。
 * 呼び出し元のスクリプトが独自に`pad2`等の同名変数を持っていても衝突しないよう、
 * このスクリプト内で完結させ外部のグローバル関数には依存しない。
 */
export function getCountdownWidgetScript(cronHealth: { state: string; label: string } = {
  state: 'unknown',
  label: '確認できません',
}, username = ''): string {
  const safeState = JSON.stringify(cronHealth.state);
  const safeLabel = JSON.stringify(cronHealth.label);
  const safeStorageKey = JSON.stringify('countdownNotifications:' + username).replace(/</g, '\\u003c');
  return `
    (function() {
      var widget = document.getElementById('countdownWidget');
      var timersEl = document.getElementById('countdownWidgetTimers');
      var toggleEl = document.getElementById('countdownWidgetToggle');
      var modeEl = document.getElementById('countdownWidgetMode');
      var settingsEl = document.getElementById('countdownWidgetSettings');
      var settingsDialog = document.getElementById('countdownWidgetSettingsDialog');
      var showUrgentEl = document.getElementById('countdownWidgetShowUrgent');
      var SHOW_URGENT_COOKIE = 'countdownWidgetShowUrgent';
      var showUrgentWhenCollapsed = !document.cookie.split(';').some(function(cookie) {
        return cookie.trim() === SHOW_URGENT_COOKIE + '=0';
      });
      var calendarMode = false;
      var collapsed = false;
      var toastEl = document.getElementById('countdownToast');
      if (!widget || !timersEl) return;
      if (showUrgentEl) {
        showUrgentEl.checked = showUrgentWhenCollapsed;
        showUrgentEl.addEventListener('change', function() {
          showUrgentWhenCollapsed = showUrgentEl.checked;
          document.cookie = SHOW_URGENT_COOKIE + '=' + (showUrgentWhenCollapsed ? '1' : '0') + '; Path=/; Max-Age=31536000; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
          tickWidget();
        });
      }
      if (settingsEl && settingsDialog) {
        settingsEl.addEventListener('click', function() { settingsDialog.showModal(); });
        settingsDialog.addEventListener('click', function(event) {
          if (event.target !== settingsDialog) return;
          var rect = settingsDialog.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) settingsDialog.close();
        });
      }
      var upcomingEvents = []; // [{ id, label, targetAt, groupIndex, groupTotal }]
      var POSITION_STORAGE_KEY = 'countdownWidgetPosition';
      var NOTIFICATION_STORAGE_KEY = ${safeStorageKey};
      var notifications = [];
      var completedKeys = [];
      try {
        var savedNotifications = JSON.parse(window.localStorage.getItem(NOTIFICATION_STORAGE_KEY) || '{}');
        if (Array.isArray(savedNotifications.notifications)) notifications = savedNotifications.notifications;
        if (Array.isArray(savedNotifications.completedKeys)) completedKeys = savedNotifications.completedKeys;
        if (Array.isArray(savedNotifications.upcomingEvents)) upcomingEvents = savedNotifications.upcomingEvents;
      } catch (e) { console.warn('カウントダウン通知の復元に失敗しました', e); }
      var cronHealthState = ${safeState};
      var cronHealthLabel = ${safeLabel};

      function clampPosition(left, top, widgetWidth, widgetHeight, viewportWidth, viewportHeight) {
        var maxLeft = Math.max(0, viewportWidth - widgetWidth);
        var maxTop = Math.max(0, viewportHeight - widgetHeight);
        return {
          left: Math.min(Math.max(0, left), maxLeft),
          top: Math.min(Math.max(0, top), maxTop),
        };
      }

      function applyPosition(left, top) {
        widget.style.left = left + 'px';
        widget.style.top = top + 'px';
        widget.style.right = 'auto';
        widget.style.bottom = 'auto';
      }

      function restorePosition() {
        var saved = null;
        try {
          var raw = window.localStorage.getItem(POSITION_STORAGE_KEY);
          saved = raw ? JSON.parse(raw) : null;
        } catch (e) {
          saved = null;
        }
        if (!saved || typeof saved.left !== 'number' || typeof saved.top !== 'number') return;
        var rect = widget.getBoundingClientRect();
        var clamped = clampPosition(saved.left, saved.top, rect.width, rect.height, window.innerWidth, window.innerHeight);
        applyPosition(clamped.left, clamped.top);
      }

      function savePosition(left, top) {
        try {
          window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify({ left: left, top: top }));
        } catch (e) {}
      }

      var dragState = null; // { pointerId, offsetX, offsetY }

      function onPointerDown(ev) {
        if (ev.target.closest('button, a') || ev.button !== 0) return;
        var rect = widget.getBoundingClientRect();
        dragState = {
          pointerId: ev.pointerId,
          offsetX: ev.clientX - rect.left,
          offsetY: ev.clientY - rect.top,
        };
        widget.classList.add('dragging');
        widget.setPointerCapture(ev.pointerId);
      }

      function onPointerMove(ev) {
        if (!dragState || ev.pointerId !== dragState.pointerId) return;
        var rect = widget.getBoundingClientRect();
        var clamped = clampPosition(
          ev.clientX - dragState.offsetX,
          ev.clientY - dragState.offsetY,
          rect.width,
          rect.height,
          window.innerWidth,
          window.innerHeight
        );
        applyPosition(clamped.left, clamped.top);
      }

      function onPointerUp(ev) {
        if (!dragState || ev.pointerId !== dragState.pointerId) return;
        var rect = widget.getBoundingClientRect();
        savePosition(rect.left, rect.top);
        widget.classList.remove('dragging');
        dragState = null;
      }

      widget.addEventListener('pointerdown', onPointerDown);
      widget.addEventListener('pointermove', onPointerMove);
      widget.addEventListener('pointerup', onPointerUp);
      widget.addEventListener('pointercancel', onPointerUp);
      restorePosition();

      if (toggleEl) toggleEl.addEventListener('click', function() {
        var open = collapsed;
        collapsed = !open;
        tickWidget();
        widget.classList.toggle('collapsed', !open);
        toggleEl.textContent = open ? '▲' : '▼';
        toggleEl.setAttribute('aria-expanded', String(open));
        toggleEl.setAttribute('aria-label', open ? 'すべてのカウントダウンを閉じる' : 'すべてのカウントダウンを開く');
        var rect = widget.getBoundingClientRect();
        var clamped = clampPosition(rect.left, rect.top, rect.width, rect.height, window.innerWidth, window.innerHeight);
        applyPosition(clamped.left, clamped.top);
        savePosition(clamped.left, clamped.top);
      });

      if (modeEl) modeEl.addEventListener('click', function() {
        calendarMode = !calendarMode;
        modeEl.textContent = calendarMode ? '📅' : '⏳';
        modeEl.setAttribute('aria-pressed', String(calendarMode));
        modeEl.setAttribute('aria-label', calendarMode ? '残り時間表示に切り替える' : '曜日・時刻表示に切り替える');
        tickWidget();
      });

      function formatSchedule(date) {
        return ['日', '月', '火', '水', '木', '金', '土'][date.getDay()] + '曜日の' + pad2(date.getHours()) + ':' + pad2(date.getMinutes()) + '時';
      }

      function pad2(n) { return String(n).padStart(2, '0'); }

      function formatRemaining(ms) {
        var totalSeconds = Math.max(0, Math.floor(ms / 1000));
        var days = Math.floor(totalSeconds / 86400);
        var hours = Math.floor((totalSeconds % 86400) / 3600);
        var minutes = Math.floor((totalSeconds % 3600) / 60);
        var seconds = totalSeconds % 60;
        var clock = pad2(hours) + ':' + pad2(minutes) + ':' + pad2(seconds);
        return days > 0 ? (days + '日 ' + clock) : clock;
      }

      function saveNotifications() {
        try {
          window.localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify({ notifications: notifications, completedKeys: completedKeys, upcomingEvents: upcomingEvents }));
        } catch (e) { console.warn('カウントダウン通知の保存に失敗しました', e); }
      }

      function renderNotifications() {
        if (!toastEl) return;
        toastEl.innerHTML = '';
        notifications.forEach(function(item) {
          var row = document.createElement('div');
          row.className = 'countdown-toast-item';
          var text = document.createElement('span');
          text.textContent = item.text;
          var close = document.createElement('button');
          close.type = 'button';
          close.className = 'countdown-toast-close';
          close.textContent = '×';
          close.setAttribute('aria-label', '通知を閉じる: ' + item.text);
          close.addEventListener('click', function() {
            notifications = notifications.filter(function(n) { return n.key !== item.key; });
            saveNotifications();
            renderNotifications();
          });
          row.appendChild(text);
          row.appendChild(close);
          toastEl.appendChild(row);
        });
        toastEl.classList.toggle('visible', notifications.length > 0);
        toastEl.hidden = notifications.length === 0;
      }

      // 完了通知は予定日時ごとに積み重ね、個別に閉じるまで保持する。
      function showCountdownToast(completedEvent) {
        if (!toastEl) return;
        var key = String(completedEvent.id) + ':' + completedEvent.targetAt;
        if (completedKeys.indexOf(key) !== -1) return;
        completedKeys.push(key);
        var idLabel = completedEvent.groupTotal
          ? (completedEvent.groupIndex + '/' + completedEvent.groupTotal)
          : ('#' + completedEvent.id);
        notifications.push({ key: key, text: idLabel + ' ok — ' + completedEvent.label + ' (' + new Date(completedEvent.targetAt).toLocaleString() + ')' });
        saveNotifications();
        renderNotifications();
      }

      // タイマー完了時の処理エントリポイント。将来的にここへ、完了したタイマーに
      // 割り当てたカスタム処理(フック)を呼び出し、その結果を受け取る仕組みを
      // 追加できるようにしておく。現時点ではフック機構は未実装のため、
      // トースト表示のみ行いスキップする。
      function onTimerCompleted(completedEvent) {
        // TODO: フック機構(タイマー登録時に割り当てた処理を呼び出し、結果を
        // 受け取る仕組み)は未実装。実装するまではトースト表示のみでスキップする。
        showCountdownToast(completedEvent);
      }

      function renderTimers() {
        timersEl.innerHTML = '';
        upcomingEvents.forEach(function(event) {
          var timer = document.createElement('div');
          timer.className = 'countdown-widget-timer';
          timer.setAttribute('data-event-id', String(event.id));
          var label = document.createElement('div');
          label.className = 'widget-label';
          label.textContent = event.label;
          if (event.label === 'tree-view cron更新') {
            label.classList.add('widget-cron-label');
            label.tabIndex = 0;
            label.setAttribute('aria-label', label.textContent + '。Cronステータス: ' + cronHealthLabel);
            var tooltip = document.createElement('span');
            tooltip.className = 'widget-cron-tooltip';
            tooltip.setAttribute('role', 'tooltip');
            var health = document.createElement('a');
            health.href = '/cron-status';
            health.className = 'widget-cron-health widget-cron-health-' + cronHealthState;
            health.textContent = 'Health: ' + cronHealthLabel;
            health.setAttribute('aria-label', 'Cron稼働状況を開く: ' + cronHealthLabel);
            var description = document.createElement('span');
            description.className = 'widget-cron-description';
            description.textContent = 'tree-viewは6時間ごと（UTC 00:00 / 06:00 / 12:00 / 18:00）に自動更新されます。表示中の残り時間は次回cron開始までです。';
            tooltip.appendChild(health);
            tooltip.appendChild(description);
            label.appendChild(tooltip);
          }
          var clock = document.createElement('div');
          clock.className = 'widget-clock';
          timer.appendChild(label);
          timer.appendChild(clock);
          var remaining = document.createElement('div');
          remaining.className = 'widget-remaining widget-label';
          timer.appendChild(remaining);
          timersEl.appendChild(timer);
        });
      }

      function tickWidget() {
        if (!upcomingEvents.length) {
          widget.classList.remove('visible');
          return;
        }
        var completed = upcomingEvents.filter(function(event) {
          return new Date(event.targetAt).getTime() <= Date.now();
        });
        if (completed.length) {
          upcomingEvents = upcomingEvents.filter(function(event) {
            return new Date(event.targetAt).getTime() > Date.now();
          });
          completed.forEach(onTimerCompleted);
          saveNotifications();
          renderTimers();
          fetchNextEvent();
        }
        widget.classList.toggle('visible', upcomingEvents.length > 0);
        var now = Date.now();
        var hasUrgent = false;
        upcomingEvents.forEach(function(event) {
          var timer = timersEl.querySelector('[data-event-id="' + event.id + '"]');
          var clock = timer && timer.querySelector('.widget-clock');
          var target = new Date(event.targetAt);
          var ms = target.getTime() - now;
          var urgent = ms > 0 && ms < 3 * 86400000;
          hasUrgent = hasUrgent || urgent;
          if (timer) timer.hidden = collapsed && !(showUrgentWhenCollapsed && calendarMode && urgent);
          if (clock) clock.textContent = calendarMode ? formatSchedule(target) : formatRemaining(ms);
          var remaining = timer && timer.querySelector('.widget-remaining');
          if (remaining) {
            remaining.hidden = !calendarMode || !urgent;
            remaining.textContent = calendarMode && urgent ? 'あと ' + formatRemaining(ms) : '';
          }
        });
        timersEl.hidden = collapsed && !(showUrgentWhenCollapsed && calendarMode && hasUrgent);
      }

      function fetchNextEvent() {
        fetch('/api/countdown/next').then(function(res) { return res.json(); }).then(function(data) {
          // Deleted schedules must disappear from both running timers and
          // persisted completion notifications, without firing completion.
          var deletedIds = Array.isArray(data.deletedIds) ? data.deletedIds.map(String) : [];
          upcomingEvents = upcomingEvents.filter(function(event) { return deletedIds.indexOf(String(event.id)) === -1; });
          notifications = notifications.filter(function(item) { return deletedIds.indexOf(String(item.key).split(':')[0]) === -1; });
          renderNotifications();
          // Polling can arrive after a deadline and after cron replaced its DB row.
          // Complete the previously observed events before replacing the list.
          upcomingEvents.filter(function(event) { return new Date(event.targetAt).getTime() <= Date.now(); }).forEach(onTimerCompleted);
          // events未対応の旧APIでも直近1件は引き続き表示できる。
          upcomingEvents = Array.isArray(data.events) ? data.events : (data.event ? [data.event] : []);
          saveNotifications();
          renderTimers();
          tickWidget();
        }).catch(function() {});
      }

      renderNotifications();
      tickWidget();
      fetchNextEvent();
      setInterval(tickWidget, 1000);
      setInterval(fetchNextEvent, 30000);
    })();
  `;
}
