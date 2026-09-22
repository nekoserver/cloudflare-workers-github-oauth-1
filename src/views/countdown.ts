import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';
import { getCountdownWidgetCSS, getCountdownWidgetHTML, getCountdownWidgetScript } from '../utils/countdownWidget';

/**
 * /countdownページ: カレンダーの日付タップから予定日時(ラベル・目標日時)を登録し、
 * ログイン中は画面右下に常時表示するカウントダウンウィジェットで残り時間を確認できる。
 * 実データはD1のcountdown_eventsテーブル(migration 0115)。
 */
export function getCountdownPage(username: string): string {
  const safeUsername = escapeHtml(username);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>カウントダウン - Cloudflare Workers GitHub OAuth</title>
  ${getThemeInitScript()}
  <style>
    ${getThemeCSS()}
    ${getThemeToggleCSS()}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%);
      min-height: 100vh;
    }
    .navbar {
      background: var(--navbar-bg);
      backdrop-filter: blur(10px);
      box-shadow: 0 2px 10px var(--navbar-shadow);
      padding: 16px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .navbar-brand { font-size: 20px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px; }
    .user-menu { display: flex; align-items: center; gap: 12px; }
    .user-name { font-size: 14px; color: var(--text-secondary); font-weight: 500; }
    .user-icon {
      width: 40px; height: 40px; border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: 600; font-size: 16px; cursor: pointer;
    }
    .user-menu-container { position: relative; }
    .dropdown-menu {
      display: none;
      position: absolute;
      top: 48px;
      right: 0;
      background: var(--card-bg);
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      min-width: 200px;
      overflow: hidden;
      z-index: 100;
    }
    .dropdown-menu.open { display: block; }
    .dropdown-item {
      display: block;
      padding: 12px 16px;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 14px;
    }
    .dropdown-item:hover { background: var(--bg-secondary); }
    .dropdown-item.logout { color: #e53e3e; }
    .dropdown-item.switch-account { color: var(--accent-color, #667eea); }
    .container { max-width: 720px; margin: 0 auto; padding: 32px 20px 120px; }
    .card {
      background: var(--card-bg);
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
      padding: 32px;
      margin-bottom: 20px;
    }
    .title { font-size: 22px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
    .subtitle { font-size: 14px; color: var(--text-muted); margin-bottom: 24px; }

    .cal-wrap { max-width: 320px; margin: 0 auto; }
    .cal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .cal-nav-btn {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      border-radius: 8px;
      padding: 4px 10px;
      cursor: pointer;
      font-size: 12px;
    }
    .cal-title { font-size: 14px; font-weight: 700; color: var(--text-primary); }
    .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
    .cal-dow { text-align: center; font-size: 11px; color: var(--text-muted); padding: 2px 0; }
    .cal-day {
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      font-size: 11px;
      color: var(--text-secondary);
      cursor: pointer;
      position: relative;
    }
    .cal-day:hover { background: var(--bg-secondary); }
    .cal-day.empty { cursor: default; }
    .cal-day.empty:hover { background: none; }
    .cal-day.today { border: 1px solid var(--accent-color, #667eea); font-weight: 700; }
    .cal-day.selected { background: var(--accent-color, #667eea); color: #fff; font-weight: 700; }
    .cal-day.has-event::after {
      content: '';
      position: absolute;
      bottom: 4px;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #667eea;
    }

    .picker-panel { display: none; margin-top: 16px; padding: 16px; background: var(--bg-secondary); border-radius: 10px; }
    .picker-panel.open { display: block; }
    .picker-row { display: flex; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; align-items: center; }
    .picker-row input {
      flex: 1;
      min-width: 140px;
      padding: 10px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: var(--card-bg);
      color: var(--text-primary);
      font-size: 14px;
    }
    .picker-row-remove-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 18px;
      cursor: pointer;
      padding: 0 4px;
      line-height: 1;
    }
    .picker-row-remove-btn:hover { color: #ef4444; }
    .picker-add-row-btn {
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
    .picker-add-row-btn:hover { color: var(--accent-color, #667eea); border-color: var(--accent-color, #667eea); }
    .picker-date-label { font-size: 13px; color: var(--text-muted); margin-bottom: 8px; }
    .cron-tooltip {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      margin-left: 6px;
      border: 1px solid var(--border-color);
      border-radius: 50%;
      color: var(--accent-color, #667eea);
      font-size: 12px;
      font-weight: 700;
      cursor: help;
      vertical-align: middle;
    }
    .cron-tooltip-text {
      visibility: hidden;
      opacity: 0;
      position: absolute;
      left: 50%;
      bottom: calc(100% + 8px);
      z-index: 20;
      width: min(280px, 75vw);
      padding: 9px 11px;
      transform: translateX(-50%);
      border-radius: 8px;
      background: var(--text-primary);
      color: var(--card-bg);
      font-size: 12px;
      font-weight: 400;
      line-height: 1.5;
      text-align: left;
      pointer-events: none;
      transition: opacity .15s ease;
    }
    .cron-tooltip:hover .cron-tooltip-text,
    .cron-tooltip:focus .cron-tooltip-text { visibility: visible; opacity: 1; }
    .save-btn {
      background: #667eea;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .save-btn:hover:not(:disabled) { background: #5568d3; }
    .picker-error { font-size: 12px; color: #ef4444; margin-top: 8px; display: none; }

    .event-list-filter-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 12px;
      margin-top: 8px;
      background: var(--bg-secondary);
      border-radius: 8px;
      font-size: 12px;
      color: var(--text-secondary);
    }
    .event-list-filter-clear-btn {
      background: none;
      border: 1px solid var(--border-color);
      color: var(--accent-color, #667eea);
      border-radius: 6px;
      padding: 3px 10px;
      font-size: 12px;
      cursor: pointer;
    }
    .event-list-filter-clear-btn:hover { background: var(--card-bg); }
    .event-list { margin-top: 8px; }
    .event-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      border-radius: 8px;
      background: var(--bg-secondary);
      margin-bottom: 8px;
      font-size: 13px;
    }
    .event-row.past { opacity: 0.5; }
    .event-info { display: flex; flex-direction: column; gap: 2px; }
    .event-label { color: var(--text-primary); font-weight: 600; }
    .event-at { color: var(--text-muted); font-size: 12px; }
    .event-delete-btn {
      background: none;
      border: none;
      color: #ef4444;
      cursor: pointer;
      font-size: 13px;
    }
    .empty-hint { color: var(--text-muted); font-size: 13px; padding: 12px 0; }

    ${getCountdownWidgetCSS()}
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="navbar-brand">
      <span>⏳</span>
      <span>カウントダウン</span>
    </div>
    <div class="user-menu">
      ${getThemeToggleHTML()}
      <span class="user-name">${safeUsername}</span>
      <div class="user-menu-container">
        <div class="user-icon" title="${safeUsername}" onclick="toggleDropdown()">
          ${escapeHtml(username.substring(0, 2).toUpperCase())}
        </div>
        <div class="dropdown-menu" id="dropdownMenu">
          <a href="/welcome" class="dropdown-item">🏠 ホーム</a>
          <a href="/aichat" class="dropdown-item">🤖 AI チャット</a>
          <a href="/repositories" class="dropdown-item">📦 リポジトリ</a>
          <a href="/settings" class="dropdown-item">⚙️ 設定</a>
          <a href="/api-keys" class="dropdown-item">🔑 キー管理</a>
          <a href="/auth/switch" class="dropdown-item switch-account">🔄 別アカウントでログイン</a>
          <a href="/auth/logout" class="dropdown-item logout">🚪 ログアウト</a>
        </div>
      </div>
    </div>
  </nav>

  <div class="container">
    <div class="card">
      <div class="title">カウントダウン</div>
      <div class="subtitle">カレンダーの日付をタップして予定日時を登録すると、ログイン中は画面右下に常に残り時間が表示されます。</div>

      <div class="cal-wrap">
        <div class="cal-header">
          <button type="button" class="cal-nav-btn" id="calPrevBtn">← 前月</button>
          <div class="cal-title" id="calTitle"></div>
          <button type="button" class="cal-nav-btn" id="calNextBtn">次月 →</button>
        </div>
        <div class="cal-grid" id="calDowRow"></div>
        <div class="cal-grid" id="calGrid"></div>
      </div>

      <div class="picker-panel" id="pickerPanel">
        <div class="picker-date-label">
          <span id="pickerDateLabel"></span>
          <button type="button" class="cron-tooltip" aria-label="tree-view cron更新について" aria-describedby="treeViewCronTooltipText">?
            <span class="cron-tooltip-text" role="tooltip" id="treeViewCronTooltipText"></span>
          </button>
        </div>
        <div id="pickerRows"></div>
        <button type="button" class="picker-add-row-btn" id="pickerAddRowBtn">+ この日にもう1件追加</button>
        <button type="button" class="save-btn" id="pickerSaveBtn">この日時で登録する</button>
        <div class="picker-error" id="pickerError"></div>
      </div>
    </div>

    <div class="card">
      <div class="title" style="font-size:16px;">登録済みの予定</div>
      <div class="event-list-filter-bar" id="eventListFilterBar" style="display:none;">
        <span id="eventListFilterLabel"></span>
        <button type="button" class="event-list-filter-clear-btn" id="eventListFilterClearBtn">すべて表示</button>
      </div>
      <div class="event-list" id="eventList">
        <div class="empty-hint">読み込み中…</div>
      </div>
    </div>
  </div>

  ${getCountdownWidgetHTML()}

  <script type="module">
    ${getThemeToggleScript()}

    function toggleDropdown() {
      document.getElementById('dropdownMenu').classList.toggle('open');
    }
    window.toggleDropdown = toggleDropdown;
    document.addEventListener('click', function(e) {
      var menu = document.getElementById('dropdownMenu');
      var container = document.querySelector('.user-menu-container');
      if (menu.classList.contains('open') && container && !container.contains(e.target)) {
        menu.classList.remove('open');
      }
    });

    // ===== カレンダー =====
    var calTitle = document.getElementById('calTitle');
    var calDowRow = document.getElementById('calDowRow');
    var calGrid = document.getElementById('calGrid');
    var pickerPanel = document.getElementById('pickerPanel');
    var pickerDateLabel = document.getElementById('pickerDateLabel');
    var pickerRows = document.getElementById('pickerRows');
    var pickerAddRowBtn = document.getElementById('pickerAddRowBtn');
    var pickerSaveBtn = document.getElementById('pickerSaveBtn');
    var pickerError = document.getElementById('pickerError');
    var eventList = document.getElementById('eventList');
    var eventListFilterBar = document.getElementById('eventListFilterBar');
    var eventListFilterLabel = document.getElementById('eventListFilterLabel');
    var eventListFilterClearBtn = document.getElementById('eventListFilterClearBtn');
    var treeViewCronTooltipText = document.getElementById('treeViewCronTooltipText');

    var today = new Date();
    var viewYear = today.getFullYear();
    var viewMonth = today.getMonth(); // 0-11
    var selectedDateStr = null; // 'YYYY-MM-DD'(登録picker用)
    var filterDateStr = null; // 'YYYY-MM-DD'(登録済みの予定一覧の絞り込み用)
    var events = [];

    var DOW = ['日', '月', '火', '水', '木', '金', '土'];
    calDowRow.innerHTML = DOW.map(function(d) { return '<div class="cal-dow">' + d + '</div>'; }).join('');

    function pad2(n) { return String(n).padStart(2, '0'); }
    function dateKey(y, m, d) { return y + '-' + pad2(m + 1) + '-' + pad2(d); }

    // Workerの6時間ごとのcronと同じ次回UTC境界を表示する。
    // カウントダウン予定はcron実行のたびに同じ日時へ自動更新される。
    function nextTreeViewCronAt(now) {
      var next = new Date(now.getTime());
      next.setUTCMinutes(0, 0, 0);
      next.setUTCHours(Math.floor(now.getUTCHours() / 6) * 6 + 6);
      return next;
    }
    if (treeViewCronTooltipText) {
      var nextTreeViewUpdate = nextTreeViewCronAt(new Date());
      treeViewCronTooltipText.textContent = 'tree-viewは6時間ごと（UTC 00:00 / 06:00 / 12:00 / 18:00）に更新されます。次回: '
        + nextTreeViewUpdate.toLocaleString() + '（' + nextTreeViewUpdate.toISOString() + '）';
    }

    // カレンダーで選択した日付(dateKey形式)でイベント一覧を絞り込む純粋関数。
    // dateStrがnullなら絞り込まず全件を返す(「すべて表示」状態)。
    function filterEventsByDate(list, dateStr) {
      if (!dateStr) return list;
      return list.filter(function(ev) {
        var at = new Date(ev.target_at);
        if (isNaN(at.getTime())) return false;
        return dateKey(at.getFullYear(), at.getMonth(), at.getDate()) === dateStr;
      });
    }

    function setFilterDate(dateStr) {
      filterDateStr = dateStr;
      renderCalendar();
      renderEventList();
    }

    eventListFilterClearBtn.addEventListener('click', function() { setFilterDate(null); });

    function eventDatesInMonth() {
      var set = {};
      events.forEach(function(ev) {
        var d = new Date(ev.target_at);
        if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) {
          set[dateKey(d.getFullYear(), d.getMonth(), d.getDate())] = true;
        }
      });
      return set;
    }

    function renderCalendar() {
      calTitle.textContent = viewYear + '年' + (viewMonth + 1) + '月';
      var firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
      var daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
      var hasEvent = eventDatesInMonth();
      var cells = [];
      for (var i = 0; i < firstWeekday; i++) {
        cells.push('<div class="cal-day empty"></div>');
      }
      for (var day = 1; day <= daysInMonth; day++) {
        var key = dateKey(viewYear, viewMonth, day);
        var isToday = viewYear === today.getFullYear() && viewMonth === today.getMonth() && day === today.getDate();
        var isSelected = key === filterDateStr;
        var cls = 'cal-day' + (isToday ? ' today' : '') + (hasEvent[key] ? ' has-event' : '') + (isSelected ? ' selected' : '');
        cells.push('<div class="' + cls + '" data-date="' + key + '">' + day + '</div>');
      }
      calGrid.innerHTML = cells.join('');
      calGrid.querySelectorAll('.cal-day[data-date]').forEach(function(el) {
        el.addEventListener('click', function() {
          var dateStr = el.getAttribute('data-date');
          openPicker(dateStr);
          setFilterDate(dateStr);
        });
      });
    }

    // ===== 予定入力行(同じ日に複数件を一括登録できるよう、時刻+ラベルの行を動的に増やせる) =====
    function updatePickerRemoveButtonsVisibility() {
      var rows = pickerRows.querySelectorAll('.picker-row');
      rows.forEach(function(row) {
        var removeBtn = row.querySelector('.picker-row-remove-btn');
        if (removeBtn) removeBtn.style.visibility = rows.length > 1 ? 'visible' : 'hidden';
      });
    }

    function addPickerRow() {
      var row = document.createElement('div');
      row.className = 'picker-row';

      var timeInput = document.createElement('input');
      timeInput.type = 'time';
      timeInput.className = 'picker-row-time';
      timeInput.value = '09:00';

      var labelInput = document.createElement('input');
      labelInput.type = 'text';
      labelInput.className = 'picker-row-label';
      labelInput.placeholder = '予定の名前';
      labelInput.value = 'cf-auth 期限まで';
      labelInput.maxLength = 100;

      var removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'picker-row-remove-btn';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', function() {
        if (pickerRows.querySelectorAll('.picker-row').length > 1) {
          row.remove();
          updatePickerRemoveButtonsVisibility();
        }
      });

      row.appendChild(timeInput);
      row.appendChild(labelInput);
      row.appendChild(removeBtn);
      pickerRows.appendChild(row);
      updatePickerRemoveButtonsVisibility();
      return row;
    }

    if (pickerAddRowBtn) pickerAddRowBtn.addEventListener('click', function() { addPickerRow(); });

    function openPicker(dateStr) {
      selectedDateStr = dateStr;
      var parts = dateStr.split('-');
      pickerDateLabel.textContent = parts[0] + '年' + Number(parts[1]) + '月' + Number(parts[2]) + '日の予定を登録';
      if (pickerSaveBtn) {
        pickerRows.innerHTML = '';
        addPickerRow();
        pickerError.style.display = 'none';
      }
      pickerPanel.classList.add('open');
    }

    document.getElementById('calPrevBtn').addEventListener('click', function() {
      viewMonth -= 1;
      if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
      renderCalendar();
    });
    document.getElementById('calNextBtn').addEventListener('click', function() {
      viewMonth += 1;
      if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
      renderCalendar();
    });

    // 選択中の日付に対する全行を検証し、events配列を組み立てる。1行でも不正なら
    // nullを返し、どの行が問題かをpickerErrorに表示する(部分登録を避けるため)。
    function collectPickerEvents() {
      var rowEls = pickerRows.querySelectorAll('.picker-row');
      var items = [];
      for (var i = 0; i < rowEls.length; i++) {
        var rowNumber = i + 1;
        var label = rowEls[i].querySelector('.picker-row-label').value.trim();
        var time = rowEls[i].querySelector('.picker-row-time').value || '09:00';
        if (!label) {
          pickerError.textContent = (rowEls.length > 1 ? (rowNumber + '件目: ') : '') + '予定の名前を入力してください';
          pickerError.style.display = 'block';
          return null;
        }
        var targetAt = new Date(selectedDateStr + 'T' + time + ':00');
        if (isNaN(targetAt.getTime())) {
          pickerError.textContent = (rowEls.length > 1 ? (rowNumber + '件目: ') : '') + '日時が不正です';
          pickerError.style.display = 'block';
          return null;
        }
        items.push({ label: label, targetAt: targetAt.toISOString() });
      }
      return items;
    }

    if (pickerSaveBtn) pickerSaveBtn.addEventListener('click', function() {
      if (!selectedDateStr) return;
      pickerError.style.display = 'none';
      var events = collectPickerEvents();
      if (!events) return;
      pickerSaveBtn.disabled = true;
      fetch('/api/countdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: events }),
      }).then(function(res) { return res.json(); }).then(function(data) {
        pickerSaveBtn.disabled = false;
        if (data.error) {
          pickerError.textContent = data.error;
          pickerError.style.display = 'block';
          return;
        }
        pickerPanel.classList.remove('open');
        loadEvents();
      }).catch(function() {
        pickerSaveBtn.disabled = false;
        pickerError.textContent = '登録に失敗しました(通信エラー)';
        pickerError.style.display = 'block';
      });
    });

    // ===== 登録済み予定一覧 =====
    function renderEventList() {
      if (filterDateStr) {
        var parts = filterDateStr.split('-');
        eventListFilterLabel.textContent = parts[0] + '年' + Number(parts[1]) + '月' + Number(parts[2]) + '日の予定のみ表示中';
        eventListFilterBar.style.display = 'flex';
      } else {
        eventListFilterBar.style.display = 'none';
      }

      var filteredEvents = filterEventsByDate(events, filterDateStr);
      if (!filteredEvents.length) {
        eventList.innerHTML = '<div class="empty-hint">'
          + (filterDateStr ? 'この日に登録されている予定はありません' : 'まだ予定が登録されていません')
          + '</div>';
        return;
      }
      var now = Date.now();
      eventList.innerHTML = filteredEvents.map(function(ev) {
        var at = new Date(ev.target_at);
        var isPast = at.getTime() < now;
        var label = String(ev.label).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return '<div class="event-row' + (isPast ? ' past' : '') + '">'
          + '<div class="event-info"><span class="event-label">' + label + '</span>'
          + '<span class="event-at">' + at.getFullYear() + '/' + pad2(at.getMonth() + 1) + '/' + pad2(at.getDate()) + ' ' + pad2(at.getHours()) + ':' + pad2(at.getMinutes()) + '</span></div>'
          + '<button type="button" class="event-delete-btn" data-id="' + ev.id + '">削除</button></div>';
      }).join('');
      eventList.querySelectorAll('.event-delete-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          fetch('/api/countdown/' + btn.getAttribute('data-id'), { method: 'DELETE' })
            .then(function() { loadEvents(); });
        });
      });
    }

    function loadEvents() {
      fetch('/api/countdown').then(function(res) { return res.json(); }).then(function(data) {
        events = data.events || [];
        renderCalendar();
        renderEventList();
      }).catch(function() {
        eventList.innerHTML = '<div class="empty-hint">読み込みに失敗しました</div>';
      });
    }

    renderCalendar();
    loadEvents();

    // ===== 画面右下の常時カウントダウンウィジェット =====
    ${getCountdownWidgetScript()}
  </script>
</body>
</html>`;
}
