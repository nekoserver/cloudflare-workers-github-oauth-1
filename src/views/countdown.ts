import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

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

    .cal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .cal-nav-btn {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      border-radius: 8px;
      padding: 6px 12px;
      cursor: pointer;
      font-size: 14px;
    }
    .cal-title { font-size: 16px; font-weight: 700; color: var(--text-primary); }
    .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
    .cal-dow { text-align: center; font-size: 12px; color: var(--text-muted); padding: 4px 0; }
    .cal-day {
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      font-size: 13px;
      color: var(--text-secondary);
      cursor: pointer;
      position: relative;
    }
    .cal-day:hover { background: var(--bg-secondary); }
    .cal-day.empty { cursor: default; }
    .cal-day.empty:hover { background: none; }
    .cal-day.today { border: 1px solid var(--accent-color, #667eea); font-weight: 700; }
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
    .picker-row { display: flex; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
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
    .picker-date-label { font-size: 13px; color: var(--text-muted); margin-bottom: 8px; }
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
      z-index: 500;
      display: none;
    }
    #countdownWidget.visible { display: block; }
    .widget-label { font-size: 12px; color: var(--text-muted); margin-bottom: 4px; }
    .widget-clock { font-size: 20px; font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; }
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

      <div class="cal-header">
        <button type="button" class="cal-nav-btn" id="calPrevBtn">← 前月</button>
        <div class="cal-title" id="calTitle"></div>
        <button type="button" class="cal-nav-btn" id="calNextBtn">次月 →</button>
      </div>
      <div class="cal-grid" id="calDowRow"></div>
      <div class="cal-grid" id="calGrid"></div>

      <div class="picker-panel" id="pickerPanel">
        <div class="picker-date-label" id="pickerDateLabel"></div>
        <div class="picker-row">
          <input type="time" id="pickerTime" value="09:00">
          <input type="text" id="pickerLabel" placeholder="予定の名前(例: 会議)" maxlength="100">
        </div>
        <button type="button" class="save-btn" id="pickerSaveBtn">この日時で登録する</button>
        <div class="picker-error" id="pickerError"></div>
      </div>
    </div>

    <div class="card">
      <div class="title" style="font-size:16px;">登録済みの予定</div>
      <div class="event-list" id="eventList">
        <div class="empty-hint">読み込み中…</div>
      </div>
    </div>
  </div>

  <div id="countdownWidget">
    <div class="widget-label" id="widgetLabel"></div>
    <div class="widget-clock" id="widgetClock">--:--:--</div>
  </div>

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
    var pickerTime = document.getElementById('pickerTime');
    var pickerLabel = document.getElementById('pickerLabel');
    var pickerSaveBtn = document.getElementById('pickerSaveBtn');
    var pickerError = document.getElementById('pickerError');
    var eventList = document.getElementById('eventList');

    var today = new Date();
    var viewYear = today.getFullYear();
    var viewMonth = today.getMonth(); // 0-11
    var selectedDateStr = null; // 'YYYY-MM-DD'
    var events = [];

    var DOW = ['日', '月', '火', '水', '木', '金', '土'];
    calDowRow.innerHTML = DOW.map(function(d) { return '<div class="cal-dow">' + d + '</div>'; }).join('');

    function pad2(n) { return String(n).padStart(2, '0'); }
    function dateKey(y, m, d) { return y + '-' + pad2(m + 1) + '-' + pad2(d); }

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
        var cls = 'cal-day' + (isToday ? ' today' : '') + (hasEvent[key] ? ' has-event' : '');
        cells.push('<div class="' + cls + '" data-date="' + key + '">' + day + '</div>');
      }
      calGrid.innerHTML = cells.join('');
      calGrid.querySelectorAll('.cal-day[data-date]').forEach(function(el) {
        el.addEventListener('click', function() {
          openPicker(el.getAttribute('data-date'));
        });
      });
    }

    function openPicker(dateStr) {
      selectedDateStr = dateStr;
      var parts = dateStr.split('-');
      pickerDateLabel.textContent = parts[0] + '年' + Number(parts[1]) + '月' + Number(parts[2]) + '日の予定を登録';
      pickerLabel.value = '';
      pickerError.style.display = 'none';
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

    pickerSaveBtn.addEventListener('click', function() {
      if (!selectedDateStr) return;
      var label = pickerLabel.value.trim();
      var time = pickerTime.value || '09:00';
      pickerError.style.display = 'none';
      if (!label) {
        pickerError.textContent = '予定の名前を入力してください';
        pickerError.style.display = 'block';
        return;
      }
      var targetAt = new Date(selectedDateStr + 'T' + time + ':00');
      if (isNaN(targetAt.getTime())) {
        pickerError.textContent = '日時が不正です';
        pickerError.style.display = 'block';
        return;
      }
      pickerSaveBtn.disabled = true;
      fetch('/api/countdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label, targetAt: targetAt.toISOString() }),
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
      if (!events.length) {
        eventList.innerHTML = '<div class="empty-hint">まだ予定が登録されていません</div>';
        return;
      }
      var now = Date.now();
      eventList.innerHTML = events.map(function(ev) {
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
    var widget = document.getElementById('countdownWidget');
    var widgetLabel = document.getElementById('widgetLabel');
    var widgetClock = document.getElementById('widgetClock');
    var nextEvent = null; // { id, label, targetAt }

    function formatRemaining(ms) {
      var totalSeconds = Math.max(0, Math.floor(ms / 1000));
      var days = Math.floor(totalSeconds / 86400);
      var hours = Math.floor((totalSeconds % 86400) / 3600);
      var minutes = Math.floor((totalSeconds % 3600) / 60);
      var seconds = totalSeconds % 60;
      var clock = pad2(hours) + ':' + pad2(minutes) + ':' + pad2(seconds);
      return days > 0 ? (days + '日 ' + clock) : clock;
    }

    function tickWidget() {
      if (!nextEvent) {
        widget.classList.remove('visible');
        return;
      }
      var remaining = new Date(nextEvent.targetAt).getTime() - Date.now();
      if (remaining <= 0) {
        widget.classList.remove('visible');
        fetchNextEvent();
        return;
      }
      widget.classList.add('visible');
      widgetLabel.textContent = nextEvent.label;
      widgetClock.textContent = formatRemaining(remaining);
    }

    function fetchNextEvent() {
      fetch('/api/countdown/next').then(function(res) { return res.json(); }).then(function(data) {
        nextEvent = data.event || null;
        tickWidget();
      }).catch(function() {});
    }

    fetchNextEvent();
    setInterval(tickWidget, 1000);
    setInterval(fetchNextEvent, 30000);
  </script>
</body>
</html>`;
}
