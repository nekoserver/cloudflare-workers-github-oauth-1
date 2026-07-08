function escH(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function getWebGLSolarPage(username: string): string {
  const safeUser = escH(username);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#000010">
<title>🪐 太陽系</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { background:#000010; color:#e6edf3; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:13px; height:100vh; height:100dvh; display:flex; flex-direction:column; overflow:hidden; }
.topbar { background:rgba(0,0,20,0.95); border-bottom:1px solid #1e2a40; padding:8px 18px; display:flex; align-items:center; gap:10px; flex-shrink:0; }
.topbar a { color:#58a6ff; text-decoration:none; font-size:12px; }
.topbar a:hover { text-decoration:underline; }
h1 { font-size:15px; font-weight:700; flex:1; }
.canvas-wrap { position:relative; flex:1; min-height:0; overflow:hidden; background:#000010; }
canvas { display:block; width:100%; height:100%; cursor:crosshair; touch-action:none; }
.ctrl-bar { background:rgba(0,0,20,0.95); border-top:1px solid #1e2a40; padding:8px 18px; display:flex; align-items:center; gap:16px; flex-shrink:0; flex-wrap:wrap; }
.ctrl-group { display:flex; align-items:center; gap:8px; }
.ctrl-label { font-size:11px; color:#8b949e; }
input[type=range] { accent-color:#fdb813; width:120px; }
.sval { font-family:monospace; font-size:11px; color:#fdb813; min-width:32px; }
.btn { background:rgba(30,42,64,0.8); border:1px solid #30363d; border-radius:6px; color:#e6edf3; font-size:11px; padding:5px 12px; cursor:pointer; transition:background .15s,border-color .15s,color .15s; }
.btn:hover { background:rgba(30,42,64,1); border-color:#fdb813; }
.btn.active { background:#2a2000; border-color:#fdb813; color:#fdb813; }
#tooltip { position:fixed; background:rgba(5,10,30,0.97); border:1px solid #fdb813; border-radius:8px; padding:8px 14px; font-size:12px; color:#e6edf3; pointer-events:none; opacity:0; transition:opacity .15s; z-index:100; max-width:240px; line-height:1.8; }
#tooltip .tt-name { font-size:14px; font-weight:700; color:#fdb813; }
#tooltip .tt-type { font-size:11px; color:#8b949e; }
#tooltip .tt-fact { font-size:12px; margin-top:4px; color:#c9d1d9; }
.calendar-wrap { position:relative; }
#calendarPanel { position:fixed; left:18px; bottom:58px; width:248px; background:rgba(5,10,30,0.97); border:1px solid #fdb813; border-radius:10px; padding:10px; box-shadow:0 10px 28px rgba(0,0,0,.45); z-index:20; display:none; user-select:none; touch-action:none; }
#calendarPanel.open { display:block; }
.cal-title { font-size:12px; font-weight:700; color:#fdb813; margin-bottom:8px; text-align:center; cursor:grab; }
.cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:3px; font-size:10px; text-align:center; }
.cal-head { color:#8b949e; padding:2px 0; }
.cal-day { border:1px solid rgba(255,255,255,.08); border-radius:4px; padding:4px 0; color:#c9d1d9; background:rgba(255,255,255,.03); }
.cal-day:not(.empty) { cursor:pointer; }
.cal-day:not(.empty):hover { border-color:#58a6ff; color:#58a6ff; background:rgba(88,166,255,.12); }
.cal-day.empty { border-color:transparent; background:transparent; }
.cal-day.today { border-color:#fdb813; color:#fdb813; background:rgba(253,184,19,.14); font-weight:700; }
.calendar-actions { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:10px; }
.calendar-actions .btn { width:100%; padding-left:6px; padding-right:6px; }
.cal-eclipse-caption { font-size:10px; color:#8b949e; margin:10px 0 6px; text-align:center; }
.cal-eclipse-date-btn { width:100%; margin-bottom:6px; }
</style>
</head>
<body>
<div class="topbar">
  <h1>🪐 太陽系</h1>
  <a href="/">ホーム</a>
  <a href="/webgl">地球儀</a>
  <a href="/webgl-heritage">世界遺産</a>
</div>
<div class="canvas-wrap">
  <canvas id="c"></canvas>
  <div id="tooltip"></div>
</div>
<div class="ctrl-bar">
  <div class="ctrl-group">
    <span class="ctrl-label">速度</span>
    <input type="range" id="speedSlider" min="0.1" max="5" step="0.1" value="1">
    <span class="sval" id="speedVal">1.0x</span>
  </div>
  <button class="btn active" id="btnOrbits">軌道を表示</button>
  <button class="btn active" id="btnLabels">恒星ラベル</button>
  <button class="btn active" id="btnPlanetLabels">惑星ラベル</button>
  <button class="btn" id="btnConst">星座線</button>
  <button class="btn" id="btnEarth">🌍 地球目線</button>
  <button class="btn" id="btnMoon">🌑 月面着陸</button>
  <button class="btn" id="btnISS">🛸 ISS</button>
  <button class="btn" id="btnSolstice">🌞 夏至</button>
  <button class="btn" id="btnToday">🌟 今日の空</button>
  <div class="calendar-wrap">
    <button class="btn" id="btnCalendar" aria-expanded="false" aria-controls="calendarPanel">📅</button>
    <div id="calendarPanel" role="dialog" aria-label="今月のカレンダー">
      <div class="cal-title" id="calTitle"></div>
      <div class="cal-grid" id="calGrid"></div>
      <div class="calendar-actions">
        <button class="btn" id="btnWeekReplay">今日から7日間</button>
        <button class="btn" id="btnTwoWeekReplay">8/13まで</button>
      </div>
      <div class="cal-eclipse-caption">🌑 日食モード (2026/8/12)</div>
      <button class="btn cal-eclipse-date-btn" id="btnEclipseDate">📅 8月12(13)日</button>
      <div class="calendar-actions">
        <button class="btn" id="btnEclipseIceland">🇮🇸 アイスランド</button>
        <button class="btn" id="btnEclipseSpain">🇪🇸 スペイン</button>
      </div>
    </div>
  </div>
  <button class="btn" id="btnPole">🧭 地軸固定</button>
  <button class="btn" id="btnSpin">🌀 自転</button>
  <button class="btn" id="btnMeteors">☄️ 流星群</button>
  <button class="btn" id="btnGrid">グリッド</button>
  <button class="btn" id="btnShot">📷 スクショ</button>
</div>

<script>
(function() {
  var canvas = document.getElementById('c');
  var ctx = canvas.getContext('2d');
  var tooltip = document.getElementById('tooltip');
  var speedSlider = document.getElementById('speedSlider');
  var speedVal = document.getElementById('speedVal');
  var btnOrbits = document.getElementById('btnOrbits');
  var btnLabels = document.getElementById('btnLabels');
  var btnPlanetLabels = document.getElementById('btnPlanetLabels');
  var btnConst = document.getElementById('btnConst');
  var btnEarth = document.getElementById('btnEarth');
  var btnMoon = document.getElementById('btnMoon');
  var btnISS = document.getElementById('btnISS');
  var btnSolstice = document.getElementById('btnSolstice');
  var btnCalendar = document.getElementById('btnCalendar');
  var calendarPanel = document.getElementById('calendarPanel');
  var calTitle = document.getElementById('calTitle');
  var calGrid = document.getElementById('calGrid');
  var btnWeekReplay = document.getElementById('btnWeekReplay');
  var btnTwoWeekReplay = document.getElementById('btnTwoWeekReplay');
  var btnEclipseDate = document.getElementById('btnEclipseDate');
  var btnEclipseIceland = document.getElementById('btnEclipseIceland');
  var btnEclipseSpain = document.getElementById('btnEclipseSpain');
  var btnToday = document.getElementById('btnToday');
  var btnPole = document.getElementById('btnPole');
  var btnSpin = document.getElementById('btnSpin');
  var btnGrid = document.getElementById('btnGrid');
  var btnMeteors = document.getElementById('btnMeteors');
  var btnShot = document.getElementById('btnShot');

  var SOL_SV = Math.sin(35 * Math.PI / 180);
  var SOL_CV = Math.cos(35 * Math.PI / 180);
  var SOL_TSIN = Math.sin(23.4 * Math.PI / 180);
  var SOL_TCOS = Math.cos(23.4 * Math.PI / 180);
  // Canvas coordinates grow downward, so invert orbital Y to keep prograde
  // solar-system motion counterclockwise when viewed from ecliptic north.
  var ORBIT_Y_SIGN = -1;
  var solsticeOrbAngle = 0;
  var solsticeSpinT = 0;
  var solsticeZoom = 1.0;
  var solsticeZoomStart = 1.0;

  var showOrbits = true;
  var showStarLabels = true;
  var showPlanetLabels = true;
  var showConstellations = false;
  var speed = 1.0;
  var t = 0;
  var skyViewMode = '';
  var viewAngle = 0;
  var viewElev = 0;
  var fovH = Math.PI * 2 / 3;
  var pinchStartDist = 0;
  var pinchStartFov = Math.PI * 2 / 3;
  var dragActive = false;
  var dragStartX = 0;
  var dragStartY = 0;
  var dragStartAngle = 0;
  var dragStartElev = 0;
  var weekReplayActive = false;
  var weekReplayStartJD = 0;
  var weekReplayJD = 0;
  var weekReplayElapsed = 0;
  var weekReplayDuration = 18;
  var weekReplayDays = 7;
  var weekReplayLabel = '今日から7日後まで';
  var selectedSkyJD = null;

  // 2026年8月12日 皆既日食(Wikipedia "Solar eclipse of August 12, 2026"、timeanddate.com、
  // adventures.is 調べ)。各地の第1〜第4接触をUT(協定世界時)の小数時で保持する。
  // 太陽・月の位置式(sunLonReal/moonLonLat)は低精度近似(誤差1度弱)のため、
  // 実際の皆既(角距離0.5度未満)を再現するには精度が足りない。そのためこのモードは
  // 出典に基づく実際の接触時刻から欠け具合を直接補間する簡易アニメーションとする。
  var eclipseSites = {
    iceland: {
      key: 'iceland', flag: '🇮🇸', name: 'アイスランド(レイキャビク)',
      c1: 16 + 47 / 60, c2: 17 + 48 / 60 + 19 / 3600, c3: 17 + 49 / 60 + 18 / 3600, c4: 18 + 47 / 60,
      tzOffsetH: 0, tzLabel: 'UTC+0',
      magnitude: 1.02,
      note: '1954年6月30日以来72年ぶり、アイスランドで見られる皆既日食(次回は2196年)'
    },
    spain: {
      key: 'spain', flag: '🇪🇸', name: 'スペイン(サラゴサ)',
      c1: 17 + 35 / 60, c2: 18 + 29 / 60, c3: 18 + 29 / 60 + 85 / 3600, c4: 19 + 23 / 60,
      tzOffsetH: 2, tzLabel: 'CEST(UTC+2)',
      magnitude: 1.02,
      note: '日没の約1時間前に皆既となる。マドリードとバルセロナは皆既帯のわずかに外側'
    }
  };
  var ECLIPSE_REPLAY_DURATION = 24;
  var eclipseSite = null;
  var eclipseStartJD = 0;
  var eclipseRangeDays = 0;
  var eclipseElapsed = 0;

  btnOrbits.addEventListener('click', function() {
    showOrbits = !showOrbits;
    btnOrbits.classList.toggle('active', showOrbits);
  });
  btnLabels.addEventListener('click', function() {
    showStarLabels = !showStarLabels;
    btnLabels.classList.toggle('active', showStarLabels);
  });
  btnPlanetLabels.addEventListener('click', function() {
    showPlanetLabels = !showPlanetLabels;
    btnPlanetLabels.classList.toggle('active', showPlanetLabels);
  });
  speedSlider.addEventListener('input', function() {
    speed = parseFloat(speedSlider.value);
    speedVal.textContent = speed.toFixed(1) + 'x';
  });

  btnConst.addEventListener('click', function() {
    showConstellations = !showConstellations;
    btnConst.classList.toggle('active', showConstellations);
  });

  var showGrid = false;
  btnGrid.addEventListener('click', function() {
    showGrid = !showGrid;
    btnGrid.classList.toggle('active', showGrid);
  });

  var showMeteors = false;
  var meteors = [];
  var meteorSpawnTimer = 0;
  var PERS_LON = 46 * Math.PI / 180;
  var PERS_LAT = 58 * Math.PI / 180;

  btnMeteors.addEventListener('click', function() {
    showMeteors = !showMeteors;
    btnMeteors.classList.toggle('active', showMeteors);
    if (!showMeteors) meteors = [];
  });

  var _md = new Date();
  if (_md.getMonth() === 7 && _md.getDate() >= 10 && _md.getDate() <= 14) {
    showMeteors = true;
    btnMeteors.classList.add('active');
  }

  function setSkyMode(mode) {
    if (mode !== 'today') { weekReplayActive = false; selectedSkyJD = null; }
    if (mode === 'today' && skyViewMode !== 'today') {
      var jdNow = todayJD();
      var sLonNow = sunLonReal(jdNow) * Math.PI / 180;
      viewAngle = eclipticToEquatorial(sLonNow, 0).ra;
      viewElev = 0.18;
      fovH = Math.PI * 0.7;
    }
    if (mode === 'pole' && skyViewMode !== 'pole') {
      viewAngle = 0;
      viewElev = Math.PI * 0.44;
      fovH = Math.PI * 0.6;
    }
    if (mode === 'spin' && skyViewMode !== 'spin') {
      viewAngle = 0;
      viewElev = 0.55;
      fovH = Math.PI * 0.65;
    }
    if (mode === 'solstice' && skyViewMode !== 'solstice') {
      solsticeOrbAngle = 0;
      solsticeSpinT = 0;
      solsticeZoom = 1.0;
    }
    skyViewMode = (skyViewMode === mode) ? '' : mode;
    btnEarth.classList.toggle('active', skyViewMode === 'earth');
    btnMoon.classList.toggle('active', skyViewMode === 'moon');
    btnISS.classList.toggle('active', skyViewMode === 'iss');
    btnSolstice.classList.toggle('active', skyViewMode === 'solstice');
    btnToday.classList.toggle('active', skyViewMode === 'today');
    btnPole.classList.toggle('active', skyViewMode === 'pole');
    btnSpin.classList.toggle('active', skyViewMode === 'spin');
    btnEclipseIceland.classList.remove('active');
    btnEclipseSpain.classList.remove('active');
    hideTooltip();
  }

  function startEclipse(siteKey) {
    var site = eclipseSites[siteKey];
    eclipseSite = site;
    eclipseStartJD = julianDate(2026, 8, 12, site.c1);
    eclipseRangeDays = julianDate(2026, 8, 12, site.c4) - eclipseStartJD;
    eclipseElapsed = 0;
    weekReplayActive = false;
    selectedSkyJD = null;
    skyViewMode = 'eclipse';
    btnEarth.classList.remove('active');
    btnMoon.classList.remove('active');
    btnISS.classList.remove('active');
    btnSolstice.classList.remove('active');
    btnToday.classList.remove('active');
    btnPole.classList.remove('active');
    btnSpin.classList.remove('active');
    btnEclipseIceland.classList.toggle('active', siteKey === 'iceland');
    btnEclipseSpain.classList.toggle('active', siteKey === 'spain');
    hideTooltip();
    syncCalendarToJD(eclipseStartJD, true);
  }

  // 引数を渡すと、実際の「今日」の代わりにその日付を月表示・黄色枠の基準にする。
  // 今日の空(週間再現)・日食モードで月や金星が1日ごとに進むのに合わせて
  // カレンダーパネルの黄色い枠も追従させるために使う(syncCalendarToJD参照)。
  function renderCalendar(dateOverride) {
    var now = dateOverride || new Date();
    var y = now.getFullYear();
    var m = now.getMonth();
    calTitle.textContent = y + '-' + String(m + 1).padStart(2, '0');
    calGrid.innerHTML = '';
    ['日','月','火','水','木','金','土'].forEach(function(d) {
      var h = document.createElement('div'); h.className = 'cal-head'; h.textContent = d; calGrid.appendChild(h);
    });
    var first = new Date(y, m, 1);
    var last = new Date(y, m + 1, 0).getDate();
    for (var i = 0; i < first.getDay(); i++) {
      var e = document.createElement('div'); e.className = 'cal-day empty'; calGrid.appendChild(e);
    }
    for (var day = 1; day <= last; day++) {
      var cell = document.createElement('div');
      cell.className = 'cal-day' + (day === now.getDate() ? ' today' : '');
      cell.textContent = String(day);
      cell.dataset.date = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      calGrid.appendChild(cell);
    }
  }

  // カレンダーパネルが開いている間、今表示中のシミュレーション日付が変わった
  // フレームでだけ再描画する(黄色い枠を追従させつつ、無駄な再構築を避ける)。
  var lastCalendarDateKey = '';
  function currentSimulatedJD() {
    if (skyViewMode === 'today' && weekReplayActive) return weekReplayJD;
    if (skyViewMode === 'today' && selectedSkyJD !== null) return selectedSkyJD;
    if (skyViewMode === 'eclipse' && eclipseSite) {
      var eP = Math.min(1, eclipseElapsed / ECLIPSE_REPLAY_DURATION);
      return eclipseStartJD + eP * eclipseRangeDays;
    }
    return null;
  }
  function syncCalendarToJD(jd, force) {
    if (!calendarPanel.classList.contains('open')) return;
    var d = jd !== null ? jdToDate(jd) : new Date();
    var key = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
    if (!force && key === lastCalendarDateKey) return;
    lastCalendarDateKey = key;
    renderCalendar(d);
  }

  function startWeekReplay(days) {
    weekReplayDays = days;
    weekReplayLabel = '今日から' + days + '日後まで';
    weekReplayStartJD = todayJD();
    weekReplayJD = weekReplayStartJD;
    weekReplayElapsed = 0;
    weekReplayActive = true;
    selectedSkyJD = null;
    if (skyViewMode !== 'today') setSkyMode('today');
    syncCalendarToJD(weekReplayJD, true);
  }

  function startReplayUntilDate(y, mo, d) {
    weekReplayStartJD = todayJD();
    var endJD = julianDate(y, mo, d, 23.999);
    weekReplayDays = Math.max(0, endJD - weekReplayStartJD);
    weekReplayLabel = mo + '/' + d + 'まで';
    weekReplayJD = weekReplayStartJD;
    weekReplayElapsed = 0;
    weekReplayActive = true;
    selectedSkyJD = null;
    if (skyViewMode !== 'today') setSkyMode('today');
    syncCalendarToJD(weekReplayJD, true);
  }

  function showEclipseDateInCalendar() {
    // 皆既の代表時刻(UT正午)を閲覧者のローカル日付に変換して表示する。
    // タイムゾーンによっては8/12ではなく8/13として表示されるため
    // ボタンのラベルは「8月12(13)日」としている。
    syncCalendarToJD(julianDate(2026, 8, 12, 12), true);
  }

  function readCookie(name) {
    var parts = document.cookie ? document.cookie.split('; ') : [];
    for (var ci = 0; ci < parts.length; ci++) {
      var eq = parts[ci].indexOf('=');
      var k = eq >= 0 ? parts[ci].slice(0, eq) : parts[ci];
      if (decodeURIComponent(k) === name) return decodeURIComponent(eq >= 0 ? parts[ci].slice(eq + 1) : '');
    }
    return '';
  }
  function writeCookie(name, value) {
    document.cookie = encodeURIComponent(name) + '=' + encodeURIComponent(value) + '; Max-Age=31536000; Path=/; SameSite=Lax';
  }
  function clampCalendarPosition(x, y) {
    var rect = calendarPanel.getBoundingClientRect();
    var w = rect.width || 248;
    var h = rect.height || 240;
    return {
      x: Math.max(0, Math.min(window.innerWidth - w, x)),
      y: Math.max(0, Math.min(window.innerHeight - h, y))
    };
  }
  function setCalendarPosition(x, y, persist) {
    var pos = clampCalendarPosition(x, y);
    calendarPanel.style.left = pos.x + 'px';
    calendarPanel.style.top = pos.y + 'px';
    calendarPanel.style.bottom = 'auto';
    if (persist) writeCookie('solar_calendar_pos', Math.round(pos.x) + ',' + Math.round(pos.y));
  }
  function restoreCalendarPosition() {
    var raw = readCookie('solar_calendar_pos');
    if (!raw) return;
    var parts = raw.split(',');
    if (parts.length !== 2) return;
    var x = parseFloat(parts[0]), y = parseFloat(parts[1]);
    if (isFinite(x) && isFinite(y)) setCalendarPosition(x, y, false);
  }
  var calendarDrag = null;
  function isCalendarInteractive(el) {
    return !!(el && el.closest && el.closest('button, .cal-day:not(.empty)'));
  }
  calendarPanel.addEventListener('pointerdown', function(e) {
    if (isCalendarInteractive(e.target)) return;
    var r = calendarPanel.getBoundingClientRect();
    calendarDrag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    calendarPanel.setPointerCapture(e.pointerId);
    calTitle.style.cursor = 'grabbing';
    e.preventDefault();
  });
  calendarPanel.addEventListener('pointermove', function(e) {
    if (!calendarDrag) return;
    setCalendarPosition(e.clientX - calendarDrag.dx, e.clientY - calendarDrag.dy, false);
    e.preventDefault();
  });
  function endCalendarDrag(e) {
    if (!calendarDrag) return;
    calendarDrag = null;
    calTitle.style.cursor = 'grab';
    var r = calendarPanel.getBoundingClientRect();
    setCalendarPosition(r.left, r.top, true);
    if (e && calendarPanel.hasPointerCapture && calendarPanel.hasPointerCapture(e.pointerId)) calendarPanel.releasePointerCapture(e.pointerId);
  }
  calendarPanel.addEventListener('pointerup', endCalendarDrag);
  calendarPanel.addEventListener('pointercancel', endCalendarDrag);
  window.addEventListener('resize', function() {
    var r = calendarPanel.getBoundingClientRect();
    setCalendarPosition(r.left, r.top, true);
  });
  calGrid.addEventListener('click', function(e) {
    var cell = e.target && e.target.closest ? e.target.closest('.cal-day:not(.empty)') : null;
    if (!cell || !cell.dataset.date) return;
    var parts = cell.dataset.date.split('-').map(function(v) { return parseInt(v, 10); });
    selectedSkyJD = julianDate(parts[0], parts[1], parts[2], 12);
    weekReplayActive = false;
    if (skyViewMode !== 'today') setSkyMode('today');
    syncCalendarToJD(selectedSkyJD, true);
  });
  restoreCalendarPosition();

  btnCalendar.addEventListener('click', function() {
    var open = !calendarPanel.classList.contains('open');
    calendarPanel.classList.toggle('open', open);
    btnCalendar.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) syncCalendarToJD(currentSimulatedJD(), true);
  });
  btnWeekReplay.addEventListener('click', function() { startWeekReplay(7); });
  btnTwoWeekReplay.addEventListener('click', function() { startReplayUntilDate(2026, 8, 13); });
  btnEclipseDate.addEventListener('click', showEclipseDateInCalendar);
  btnEclipseIceland.addEventListener('click', function() { startEclipse('iceland'); });
  btnEclipseSpain.addEventListener('click', function() { startEclipse('spain'); });
  btnEarth.addEventListener('click', function() { setSkyMode('earth'); });
  btnMoon.addEventListener('click', function() { setSkyMode('moon'); });
  btnISS.addEventListener('click', function() { setSkyMode('iss'); });
  btnSolstice.addEventListener('click', function() { setSkyMode('solstice'); });
  btnToday.addEventListener('click', function() { setSkyMode('today'); });
  btnPole.addEventListener('click', function() { setSkyMode('pole'); });
  btnSpin.addEventListener('click', function() { setSkyMode('spin'); });
  btnShot.addEventListener('click', function() {
    canvas.toBlob(function(blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      var now2 = new Date();
      a.download = 'sky_' + now2.getFullYear() + '_' + (now2.getMonth()+1) + '_' + now2.getDate() + '.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    });
  });

  function startDrag(clientX, clientY) {
    if (skyViewMode === '') return;
    dragActive = true;
    dragStartX = clientX;
    dragStartY = clientY;
    dragStartAngle = viewAngle;
    dragStartElev = viewElev;
  }
  function moveDrag(clientX, clientY) {
    if (!dragActive) return;
    var dx = clientX - dragStartX;
    var dy = clientY - dragStartY;
    var sensitivity = fovH / W;
    viewAngle = dragStartAngle - dx * sensitivity;
    viewElev = Math.max(-Math.PI * 0.45, Math.min(Math.PI * 0.45, dragStartElev + dy * sensitivity));
  }
  function endDrag(clientX, clientY) {
    var dx = clientX - dragStartX;
    var dy = clientY - dragStartY;
    if (dragActive && Math.abs(dx) < 5 && Math.abs(dy) < 5) {
      var pos = getCanvasPos({ clientX: clientX, clientY: clientY });
      var item = hitTest(pos.x, pos.y);
      if (item) { showTooltip(item, clientX, clientY); activeItem = item; }
      else hideTooltip();
    }
    dragActive = false;
  }

  canvas.addEventListener('mousedown', function(e) { startDrag(e.clientX, e.clientY); });
  canvas.addEventListener('mousemove', function(e) { moveDrag(e.clientX, e.clientY); });
  canvas.addEventListener('mouseup', function(e) { endDrag(e.clientX, e.clientY); });
  canvas.addEventListener('mouseleave', function() { dragActive = false; });

  canvas.addEventListener('wheel', function(e) {
    if (skyViewMode === '') return;
    e.preventDefault();
    if (skyViewMode === 'solstice') {
      solsticeZoom = Math.max(0.3, Math.min(5.0, solsticeZoom * (1 - e.deltaY * 0.001)));
    } else {
      fovH = Math.max(Math.PI / 8, Math.min(Math.PI * 0.85, fovH + e.deltaY * 0.0015));
    }
  }, { passive: false });

  canvas.addEventListener('touchstart', function(e) {
    if (e.touches.length === 2) {
      dragActive = false;
      var ddx = e.touches[0].clientX - e.touches[1].clientX;
      var ddy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDist = Math.sqrt(ddx * ddx + ddy * ddy);
      pinchStartFov = fovH;
      solsticeZoomStart = solsticeZoom;
    } else if (e.touches.length === 1) {
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', function(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      var ddx = e.touches[0].clientX - e.touches[1].clientX;
      var ddy = e.touches[0].clientY - e.touches[1].clientY;
      var d = Math.sqrt(ddx * ddx + ddy * ddy);
      if (pinchStartDist > 0) {
        if (skyViewMode === 'solstice') {
          solsticeZoom = Math.max(0.3, Math.min(5.0, solsticeZoomStart * d / pinchStartDist));
        } else {
          fovH = Math.max(Math.PI / 8, Math.min(Math.PI * 0.85, pinchStartFov * pinchStartDist / d));
        }
      }
    } else if (e.touches.length === 1) {
      e.preventDefault();
      moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });
  canvas.addEventListener('touchend', function(e) {
    if (e.changedTouches.length > 0 && e.touches.length === 0) {
      endDrag(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    }
  });

  var skyStars = [];
  for (var si3 = 0; si3 < 600; si3++) {
    var ssLon = pseudoRand() * Math.PI * 2;
    var ssLat = Math.asin(pseudoRand() * 2 - 1);
    skyStars.push({ lon: ssLon, lat: ssLat, r: pseudoRand() < 0.25 ? 2 : 1, twinkle: pseudoRand() < 0.18, phase: pseudoRand() * Math.PI * 2 });
  }

  // starLon/starLat は J2000 の黄道座標(λ, β)をラジアンで格納する。
  // 自転モード(projectSky)・今日の空モード(projectEclipticSky)の両方が黄道座標を
  // 前提とするため、赤道座標(RA/Dec)をそのまま入れると星座が最大約23°歪む。
  var starLon = [1.817, 1.53, 1.38, 1.22, 4.34, 4.99, 5.267, 5.853, 3.558, 3.565, 1.977, 1.428, 1.927, 2.2227, 3.254, 3.349, 3.277, 3.208, 1.0471, 2.6146, 0.5929, 0.6573, 0.5792, 0.5128, 6.0840, 0.4842, 1.4412, 1.4798];
  var starLat = [-0.691, -0.28, -0.54, -0.09, -0.09, 1.08, 0.511, 1.046, -0.036, 0.536, 0.116, 0.400, 0.176, 0.0223, -1.101, -1.042, -0.997, -1.025, 0.0707, 0.00798, 0.1481, 0.1739, 0.1250, -0.1581, 0.1580, -0.0283, 0.0940, -0.0383];
  var skyConstellationLines = [
    { name: 'おうし座', color: 'rgba(255,170,90,0.48)', indices: [18, 3, 26, 3, 27] },
    { name: 'おひつじ座', color: 'rgba(255,210,130,0.48)', indices: [21, 20, 22] },
    { name: 'うお座', color: 'rgba(150,200,255,0.45)', indices: [23, 24, 23, 25, 20] }
  ];

  var bigDipper = [
    { lon: 2.360, lat: 0.868 },
    { lon: 2.433, lat: 0.784 },
    { lon: 2.625, lat: 0.822 },
    { lon: 2.637, lat: 0.901 },
    { lon: 2.774, lat: 0.946 },
    { lon: 2.895, lat: 0.982 },
    { lon: 3.087, lat: 0.944 }
  ];
  var bigDipperLines = [[0,1],[1,2],[2,3],[3,0],[3,4],[4,5],[5,6]];
  var summerTriIdx = [5, 6, 7];
  var cruxLines = [[14,16],[17,15]];
  var iss = { name: 'ISS', jaName: 'ISS', type: '宇宙ステーション', orbitR: 14, radius: 2, period: 0.004, color: '#88ffcc', angle: 1.2, fact: '国際宇宙ステーション。高度約400kmを約90分で一周。常時6名が滞在しています' };


  function drawSkyConstellationLines(projector) {
    if (!showConstellations) return;
    projector = projector || projectSky;
    ctx.save();
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    for (var sci = 0; sci < skyConstellationLines.length; sci++) {
      var scl = skyConstellationLines[sci];
      var labelPos = null;
      ctx.strokeStyle = scl.color;
      ctx.beginPath();
      var started = false;
      for (var sii = 0; sii < scl.indices.length; sii++) {
        var sidx = scl.indices[sii];
        var spp = projector(starLon[sidx], starLat[sidx]);
        if (!spp) { started = false; continue; }
        if (!labelPos) labelPos = spp;
        if (!started) { ctx.moveTo(spp.x, spp.y); started = true; }
        else ctx.lineTo(spp.x, spp.y);
      }
      ctx.stroke();
      if (showStarLabels && labelPos) {
        ctx.setLineDash([]);
        ctx.font = '10px sans-serif';
        ctx.fillStyle = scl.color.replace(/0\.4[58]/, '0.78');
        ctx.fillText(scl.name, labelPos.x + 12, labelPos.y - 12);
        ctx.setLineDash([4, 4]);
      }
    }
    ctx.restore();
  }

  function julianDate(y, mo, d, h) {
    var aa = Math.floor((14-mo)/12), yy = y+4800-aa, mm = mo+12*aa-3;
    return d + Math.floor((153*mm+2)/5) + 365*yy + Math.floor(yy/4) - Math.floor(yy/100) + Math.floor(yy/400) - 32045.5 + h/24;
  }
  function todayJD() {
    var now = new Date();
    var h = now.getUTCHours() + now.getUTCMinutes()/60 + now.getUTCSeconds()/3600;
    return julianDate(now.getUTCFullYear(), now.getUTCMonth()+1, now.getUTCDate(), h);
  }
  function normD(deg) { return ((deg % 360) + 360) % 360; }
  function sunLonReal(jd) {
    var n = jd - 2451545.0;
    var L = normD(280.46646 + 0.9856474*n);
    var M = normD(357.52911 + 0.9856003*n) * Math.PI / 180;
    return normD(L + 1.914602*Math.sin(M) + 0.019993*Math.sin(2*M));
  }
  function helioXY(L0, dL, ecc, sma, jd) {
    var n = jd - 2451545.0;
    var L = normD(L0 + dL*n) * Math.PI / 180;
    var lon = L + 2*ecc*Math.sin(L);
    return { x: sma*Math.cos(lon), y: sma*Math.sin(lon) };
  }
  function geoLonDeg(px, py, ex, ey) {
    return normD(Math.atan2(py-ey, px-ex) * 180 / Math.PI);
  }
  function moonLonLat(jd) {
    var n = jd - 2451545.0;
    var L = normD(218.3165 + 13.1763966*n);
    var D  = normD(297.8502 + 12.1907491*n) * Math.PI / 180;
    var Mm = normD(134.9634 + 13.0649929*n) * Math.PI / 180;
    var Ms = normD(357.5291 + 0.9856003*n) * Math.PI / 180;
    var F  = normD( 93.2721 + 13.2293505*n) * Math.PI / 180;
    // 月の黄経は太陽からの平均離角 D を主項に使う。
    // ここを昇交点引数 F で代用すると、満月へ向かう位相なのに月が太陽手前を
    // 横切るように描かれることがあるため、簡易章動項も含めて黄経と位相を整合させる。
    var lon = normD(L
      + 6.289*Math.sin(Mm)
      + 1.274*Math.sin(2*D-Mm)
      + 0.658*Math.sin(2*D)
      + 0.214*Math.sin(2*Mm)
      - 0.186*Math.sin(Ms));
    var lat = 5.128*Math.sin(F)
      + 0.2806*Math.sin(Mm+F)
      + 0.2777*Math.sin(Mm-F)
      + 0.1732*Math.sin(2*D-F);
    return { lon: lon*Math.PI/180, lat: lat*Math.PI/180 };
  }


  // Canvas の右方向は天球上の西向きとして投影されるため、
  // 黄道座標を赤道座標へ回す地軸傾きは画面投影系に合わせて符号を反転する。
  // これにより「今日の空」で月が時間経過に対して右上から左下へ動く。
  var earthObliquity = -23.43928 * Math.PI / 180;
  function eclipticVector(lon, lat) {
    var cb = Math.cos(lat), sb = Math.sin(lat);
    var cl = Math.cos(lon), sl = Math.sin(lon);
    var ce = Math.cos(earthObliquity), se = Math.sin(earthObliquity);
    return {
      x: cb * cl,
      y: cb * sl * ce - sb * se,
      z: cb * sl * se + sb * ce
    };
  }
  function eclipticToEquatorial(lon, lat) {
    var v = eclipticVector(lon, lat);
    return { ra: Math.atan2(v.y, v.x), dec: Math.asin(Math.max(-1, Math.min(1, v.z))) };
  }
  function projectEclipticSky(lon, lat) {
    var v = eclipticVector(lon, lat);
    return project3D(v.x, v.y, v.z);
  }

  function drawGrid() {
    if (!showGrid) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(100,180,255,0.18)';
    ctx.lineWidth = 1;
    var steps = 24;
    for (var gi = 0; gi < steps; gi++) {
      var glon = gi * Math.PI * 2 / steps;
      var prev = null;
      for (var gj = -80; gj <= 80; gj += 2.5) {
        var glat = gj * Math.PI / 180;
        var gp = projectSky(glon, glat);
        if (gp && prev) { ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(gp.x, gp.y); ctx.stroke(); }
        prev = gp;
      }
    }
    var latLines = skyViewMode === 'spin' || skyViewMode === 'pole'
      ? [-60,-30,0,30,60,75,80,85,88]
      : [-60,-30,0,30,60];
    for (var li2 = 0; li2 < latLines.length; li2++) {
      var latDeg2 = latLines[li2];
      var glat2 = latDeg2 * Math.PI / 180;
      var prev2 = null;
      var lonStep2 = Math.abs(latDeg2) >= 75 ? 2 : 3;
      ctx.strokeStyle = Math.abs(latDeg2) >= 75 ? 'rgba(100,180,255,0.24)' : 'rgba(100,180,255,0.18)';
      for (var gk = 0; gk <= 360; gk += lonStep2) {
        var glon2 = gk * Math.PI / 180;
        var gp2 = projectSky(glon2, glat2);
        if (gp2 && prev2) { ctx.beginPath(); ctx.moveTo(prev2.x, prev2.y); ctx.lineTo(gp2.x, gp2.y); ctx.stroke(); }
        prev2 = gp2;
      }
      if (showStarLabels && latDeg2 <= 75) {
        var labelPt = projectSky(viewAngle, glat2);
        if (labelPt) {
          ctx.font = '10px sans-serif';
          ctx.fillStyle = 'rgba(100,180,255,0.5)';
          ctx.fillText((latDeg2 >= 0 ? '+' : '') + latDeg2 + '\xb0', labelPt.x + 4, labelPt.y);
        }
      }
    }
    ctx.restore();
  }

  function jdToDate(jd) {
    return new Date((jd - 2440587.5) * 86400000);
  }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function drawTodaySky(jdOverride) {
    var jd = jdOverride || todayJD();
    var sLon = sunLonReal(jd);
    var sLonR = sLon * Math.PI / 180;
    var ePos = helioXY(100.46446, 0.985647, 0.016709, 1.000014, jd);
    var realPlanets = [
      { jaName: '金星', h: helioXY(181.979801, 1.602136, 0.006773, 0.723330, jd), color: '#fffce0', fact: '地球から最も明るく見える惑星。最大光度は-4.6等' },
      { jaName: '火星', h: helioXY(355.433275, 0.524039, 0.093405, 1.523688, jd), color: '#c1440e', fact: '赤い惑星。太陽系最大の火山オリンポス山があります' },
      { jaName: '木星', h: helioXY( 34.351469, 0.083086, 0.048498, 5.202534, jd), color: '#c88b3a', fact: '太陽系最大の惑星。大赤斑という嵐が300年以上続いています' },
      { jaName: '土星', h: helioXY( 50.077444, 0.033460, 0.055546, 9.537070, jd), color: '#e4d191', fact: '美しいリングを持つ惑星', hasRings: true },
      { jaName: '水星', h: helioXY(252.250906, 4.092335, 0.205636, 0.387098, jd), color: '#b5b5b5', fact: '太陽系最小の惑星。最大離角は約28度' }
    ];
    var mll = moonLonLat(jd);

    // 平射投影(project3D の dome 分岐)と同じ式系で水平線位置を近似する
    var horizonY = H / 2 - Math.tan(viewElev / 2) * (W / 2) / Math.tan(fovH / 4);

    var skyGrad = ctx.createLinearGradient(0, 0, 0, Math.max(0, horizonY));
    skyGrad.addColorStop(0, '#000018'); skyGrad.addColorStop(1, '#000c28');
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, H);
    if (horizonY < H) { ctx.fillStyle = '#060e06'; ctx.fillRect(0, Math.max(0, horizonY), W, H); }

    for (var si5 = 0; si5 < skyStars.length; si5++) {
      var ss5 = skyStars[si5];
      if (ss5.lat < -0.02) continue;
      var sp5 = projectSky(ss5.lon, ss5.lat);
      if (!sp5) continue;
      var alp5 = ss5.twinkle ? 0.5 + 0.5*Math.sin(t*3+ss5.phase) : 1;
      ctx.beginPath(); ctx.arc(sp5.x, sp5.y, ss5.r, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(255,255,255,'+alp5.toFixed(2)+')'; ctx.fill();
    }
    drawGrid();
    starScreenPos = [];
    for (var ni5 = 0; ni5 < namedStars.length; ni5++) {
      var ns5 = namedStars[ni5];
      var np5 = projectEclipticSky(starLon[ni5], starLat[ni5]);
      if (!np5) continue;
      if (ns5.isPleiades) { drawPleiadesCluster(np5.x, np5.y, ns5.color); } else if (ns5.isCluster) { drawCluster(np5.x, np5.y, ns5.color); } else { ctx.beginPath(); ctx.arc(np5.x, np5.y, 4, 0, Math.PI*2); ctx.fillStyle = ns5.color; ctx.fill(); }
      if (showStarLabels) { ctx.font = '10px sans-serif'; ctx.fillStyle = ns5.color; ctx.fillText(ns5.name, np5.x+8, np5.y+3); }
      starScreenPos.push({ x: np5.x, y: np5.y, item: ns5 });
    }
    drawSkyConstellationLines(projectEclipticSky);
    if (showConstellations) {
      ctx.lineWidth = 1; ctx.setLineDash([4,4]); ctx.strokeStyle = 'rgba(180,220,255,0.35)';
      // このモードの恒星ドット(上のループ)・skyConstellationLines(599行目)は
      // いずれも projectEclipticSky(黄道→赤道の地軸傾き回転込み)で投影される。
      // ここだけ projectSky(回転なし)を使うと、夏の大三角形・南十字の線が
      // 実際の星の位置(ドット)からずれ、viewAngle が動くたびに独立して
      // 動いているように見える不具合になるため、同じ投影関数に揃える。
      var stPtsT = [];
      for (var sti2 = 0; sti2 < summerTriIdx.length; sti2++) stPtsT.push(projectEclipticSky(starLon[summerTriIdx[sti2]], starLat[summerTriIdx[sti2]]));
      for (var stliT = 0; stliT < 3; stliT++) {
        var paT = stPtsT[stliT], pbT = stPtsT[(stliT+1)%3];
        if (paT && pbT) { ctx.beginPath(); ctx.moveTo(paT.x, paT.y); ctx.lineTo(pbT.x, pbT.y); ctx.stroke(); }
      }
      ctx.strokeStyle = 'rgba(180,255,220,0.35)';
      for (var cliT = 0; cliT < cruxLines.length; cliT++) {
        var cpaT = projectEclipticSky(starLon[cruxLines[cliT][0]], starLat[cruxLines[cliT][0]]);
        var cpbT = projectEclipticSky(starLon[cruxLines[cliT][1]], starLat[cruxLines[cliT][1]]);
        if (cpaT && cpbT) { ctx.beginPath(); ctx.moveTo(cpaT.x, cpaT.y); ctx.lineTo(cpbT.x, cpbT.y); ctx.stroke(); }
      }
      ctx.setLineDash([]);
    }
    var sunPos5 = projectEclipticSky(sLonR, 0);
    if (sunPos5) {
      drawGlow(sunPos5.x, sunPos5.y, 32, '#fdb813');
      var sg5 = ctx.createRadialGradient(sunPos5.x-6, sunPos5.y-6, 3, sunPos5.x, sunPos5.y, 30);
      sg5.addColorStop(0,'#fff5a0'); sg5.addColorStop(0.5,'#fdb813'); sg5.addColorStop(1,'#f57c00');
      ctx.beginPath(); ctx.arc(sunPos5.x, sunPos5.y, 30, 0, Math.PI*2); ctx.fillStyle = sg5; ctx.fill();
      if (showPlanetLabels) { ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#fdb813'; ctx.fillText('太陽', sunPos5.x+34, sunPos5.y+4); }
      planetScreenPos.push({ x: sunPos5.x, y: sunPos5.y, item: { name: '太陽', type: '恒星', fact: '太陽系の中心恒星' } });
    }
    for (var rpi = 0; rpi < realPlanets.length; rpi++) {
      var rp = realPlanets[rpi];
      var rLon = geoLonDeg(rp.h.x, rp.h.y, ePos.x, ePos.y);
      var rLonR = rLon * Math.PI / 180;
      var rpPos = projectEclipticSky(rLonR, 0);
      if (!rpPos) continue;
      var rElonga = Math.abs(normD(rLon - sLon));
      if (rElonga > 180) rElonga = 360 - rElonga;
      if (rElonga < 3 && rp.jaName !== '金星' && rp.jaName !== '水星') continue;
      if (rp.hasRings) drawRings(rpPos.x, rpPos.y, 8);
      drawPlanet(rpPos.x, rpPos.y, rp.jaName === '木星' ? 9 : (rp.jaName === '土星' ? 8 : 5), rp.color);
      if (showPlanetLabels) { ctx.font = '11px sans-serif'; ctx.fillStyle = '#c9d1d9'; ctx.fillText(rp.jaName, rpPos.x+10, rpPos.y+4); }
      planetScreenPos.push({ x: rpPos.x, y: rpPos.y, item: { name: rp.jaName, type: '惑星', fact: rp.fact } });
    }
    var moonPosT = projectEclipticSky(mll.lon, mll.lat);
    if (moonPosT) {
      var mPhaseT = ((mll.lon - sLonR) % (Math.PI*2) + Math.PI*2) % (Math.PI*2);
      drawMoonPhase(moonPosT.x, moonPosT.y, 16, mPhaseT / (Math.PI*2));
      if (showPlanetLabels) { ctx.font = '11px sans-serif'; ctx.fillStyle = '#aaa'; ctx.fillText('月', moonPosT.x+20, moonPosT.y+4); }
      planetScreenPos.push({ x: moonPosT.x, y: moonPosT.y, item: { name: '月', type: '衛星', fact: '地球の天然衛星。29.5日で満ち欠けを繰り返します' } });
    }
    if (horizonY > 0 && horizonY < H) {
      ctx.beginPath(); ctx.moveTo(0,horizonY); ctx.lineTo(W,horizonY);
      ctx.strokeStyle = 'rgba(80,160,80,0.4)'; ctx.lineWidth = 1; ctx.stroke();
    }
    var nowD = jdOverride ? jdToDate(jd) : new Date();
    var yy2 = nowD.getFullYear(), mm2 = nowD.getMonth()+1, dd2 = nowD.getDate();
    var hh2 = nowD.getHours(), mn2 = nowD.getMinutes();
    var mn2s = pad2(mn2);
    ctx.font = '12px sans-serif'; ctx.fillStyle = 'rgba(100,220,255,0.8)';
    var replayText = weekReplayActive ? '  ' + weekReplayLabel + '再現中' : '';
    ctx.fillText('🌟 今日の空  ' + yy2 + '/' + mm2 + '/' + dd2 + ' ' + pad2(hh2) + ':' + mn2s + replayText + '  地軸傾き23.4°反映  ドラッグ:視点回転', 10, 28);
  }

  function drawPoleView() {
    // 平射投影(project3D の dome 分岐)と同じ式系で水平線位置を近似する
    var horizonY = H / 2 - Math.tan(viewElev / 2) * (W / 2) / Math.tan(fovH / 4);

    ctx.fillStyle = '#000010'; ctx.fillRect(0, 0, W, H);

    for (var si6 = 0; si6 < skyStars.length; si6++) {
      var ss6 = skyStars[si6];
      var sp6 = projectSky(ss6.lon, ss6.lat);
      if (!sp6) continue;
      var alp6 = ss6.twinkle ? 0.5 + 0.5*Math.sin(t*3+ss6.phase) : 1;
      ctx.beginPath(); ctx.arc(sp6.x, sp6.y, ss6.r, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(255,255,255,'+alp6.toFixed(2)+')'; ctx.fill();
    }
    drawGrid();
    starScreenPos = [];
    for (var ni6 = 0; ni6 < namedStars.length; ni6++) {
      var ns6 = namedStars[ni6];
      var np6 = projectSky(starLon[ni6], starLat[ni6]);
      if (!np6) continue;
      if (ns6.isPleiades) { drawPleiadesCluster(np6.x, np6.y, ns6.color); } else if (ns6.isCluster) { drawCluster(np6.x, np6.y, ns6.color); } else { ctx.beginPath(); ctx.arc(np6.x, np6.y, 5, 0, Math.PI*2); ctx.fillStyle = ns6.color; ctx.fill(); ctx.beginPath(); ctx.arc(np6.x, np6.y, 8, 0, Math.PI*2); ctx.strokeStyle = ns6.color+'44'; ctx.lineWidth = 2; ctx.stroke(); }
      if (showStarLabels) { ctx.font = '11px sans-serif'; ctx.fillStyle = ns6.color; ctx.fillText(ns6.name, np6.x+10, np6.y+4); }
      starScreenPos.push({ x: np6.x, y: np6.y, item: ns6 });
    }
    drawSkyConstellationLines(projectSky);
    if (showConstellations) {
      ctx.lineWidth = 1; ctx.setLineDash([4,4]); ctx.strokeStyle = 'rgba(180,220,255,0.4)';
      var stPtsP = [];
      for (var stiP = 0; stiP < summerTriIdx.length; stiP++) stPtsP.push(projectSky(starLon[summerTriIdx[stiP]], starLat[summerTriIdx[stiP]]));
      for (var stliP = 0; stliP < 3; stliP++) {
        var paP = stPtsP[stliP], pbP = stPtsP[(stliP+1)%3];
        if (paP && pbP) { ctx.beginPath(); ctx.moveTo(paP.x, paP.y); ctx.lineTo(pbP.x, pbP.y); ctx.stroke(); }
      }
      ctx.strokeStyle = 'rgba(255,220,150,0.4)';
      for (var bliP = 0; bliP < bigDipperLines.length; bliP++) {
        var bpaP = projectSky(bigDipper[bigDipperLines[bliP][0]].lon, bigDipper[bigDipperLines[bliP][0]].lat);
        var bpbP = projectSky(bigDipper[bigDipperLines[bliP][1]].lon, bigDipper[bigDipperLines[bliP][1]].lat);
        if (bpaP && bpbP) { ctx.beginPath(); ctx.moveTo(bpaP.x, bpaP.y); ctx.lineTo(bpbP.x, bpbP.y); ctx.stroke(); }
      }
      ctx.strokeStyle = 'rgba(180,255,220,0.4)';
      for (var cliP = 0; cliP < cruxLines.length; cliP++) {
        var cpaP = projectSky(starLon[cruxLines[cliP][0]], starLat[cruxLines[cliP][0]]);
        var cpbP = projectSky(starLon[cruxLines[cliP][1]], starLat[cruxLines[cliP][1]]);
        if (cpaP && cpbP) { ctx.beginPath(); ctx.moveTo(cpaP.x, cpaP.y); ctx.lineTo(cpbP.x, cpbP.y); ctx.stroke(); }
      }
      ctx.setLineDash([]);
      for (var bdiP = 0; bdiP < bigDipper.length; bdiP++) {
        var bdpP = projectSky(bigDipper[bdiP].lon, bigDipper[bdiP].lat);
        if (!bdpP) continue;
        ctx.beginPath(); ctx.arc(bdpP.x, bdpP.y, 2.5, 0, Math.PI*2); ctx.fillStyle = '#ffdd88'; ctx.fill();
      }
    }
    var polePos = projectSky(0, Math.PI/2);
    if (polePos) {
      ctx.beginPath(); ctx.arc(polePos.x, polePos.y, 6, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(100,200,255,0.8)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.font = '11px sans-serif'; ctx.fillStyle = 'rgba(100,200,255,0.9)';
      ctx.fillText('北天極', polePos.x+9, polePos.y+4);
    }
    var polaris = projectSky(0.662, 1.527);
    if (polaris) {
      ctx.beginPath(); ctx.arc(polaris.x, polaris.y, 5, 0, Math.PI*2); ctx.fillStyle = '#e8f0ff'; ctx.fill();
      if (showStarLabels) { ctx.font = '11px sans-serif'; ctx.fillStyle = '#e8f0ff'; ctx.fillText('ポラリス(北極星)', polaris.x+8, polaris.y+4); }
    }
    ctx.font = '12px sans-serif'; ctx.fillStyle = 'rgba(100,180,255,0.65)';
    ctx.fillText('🧭 地軸固定  北天極を中心に星が回転  ドラッグ:視点調整', 10, 28);
  }

  function drawSpinView() {
    ctx.fillStyle = '#000010'; ctx.fillRect(0, 0, W, H);

    for (var si7 = 0; si7 < skyStars.length; si7++) {
      var ss7 = skyStars[si7];
      var sp7 = projectSky(ss7.lon, ss7.lat);
      if (!sp7) continue;
      var alp7 = ss7.twinkle ? 0.5 + 0.5*Math.sin(t*3+ss7.phase) : 1;
      ctx.beginPath(); ctx.arc(sp7.x, sp7.y, ss7.r, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(255,255,255,'+alp7.toFixed(2)+')'; ctx.fill();
    }
    drawGrid();
    starScreenPos = [];
    for (var ni7 = 0; ni7 < namedStars.length; ni7++) {
      var ns7 = namedStars[ni7];
      var np7 = projectSky(starLon[ni7], starLat[ni7]);
      if (!np7) continue;
      if (ns7.isPleiades) { drawPleiadesCluster(np7.x, np7.y, ns7.color); } else if (ns7.isCluster) { drawCluster(np7.x, np7.y, ns7.color); } else { ctx.beginPath(); ctx.arc(np7.x, np7.y, 5, 0, Math.PI*2); ctx.fillStyle = ns7.color; ctx.fill(); ctx.beginPath(); ctx.arc(np7.x, np7.y, 8, 0, Math.PI*2); ctx.strokeStyle = ns7.color+'44'; ctx.lineWidth = 2; ctx.stroke(); }
      if (showStarLabels) { ctx.font = '11px sans-serif'; ctx.fillStyle = ns7.color; ctx.fillText(ns7.name, np7.x+10, np7.y+4); }
      starScreenPos.push({ x: np7.x, y: np7.y, item: ns7 });
    }
    drawSkyConstellationLines(projectSky);
    if (showConstellations) {
      ctx.lineWidth = 1; ctx.setLineDash([4,4]); ctx.strokeStyle = 'rgba(180,220,255,0.4)';
      var stPtsS = [];
      for (var stiS = 0; stiS < summerTriIdx.length; stiS++) stPtsS.push(projectSky(starLon[summerTriIdx[stiS]], starLat[summerTriIdx[stiS]]));
      for (var stliS = 0; stliS < 3; stliS++) {
        var paS = stPtsS[stliS], pbS = stPtsS[(stliS+1)%3];
        if (paS && pbS) { ctx.beginPath(); ctx.moveTo(paS.x, paS.y); ctx.lineTo(pbS.x, pbS.y); ctx.stroke(); }
      }
      ctx.strokeStyle = 'rgba(255,220,150,0.4)';
      for (var bliS = 0; bliS < bigDipperLines.length; bliS++) {
        var bpaS = projectSky(bigDipper[bigDipperLines[bliS][0]].lon, bigDipper[bigDipperLines[bliS][0]].lat);
        var bpbS = projectSky(bigDipper[bigDipperLines[bliS][1]].lon, bigDipper[bigDipperLines[bliS][1]].lat);
        if (bpaS && bpbS) { ctx.beginPath(); ctx.moveTo(bpaS.x, bpaS.y); ctx.lineTo(bpbS.x, bpbS.y); ctx.stroke(); }
      }
      ctx.strokeStyle = 'rgba(180,255,220,0.4)';
      for (var cliS = 0; cliS < cruxLines.length; cliS++) {
        var cpaS = projectSky(starLon[cruxLines[cliS][0]], starLat[cruxLines[cliS][0]]);
        var cpbS = projectSky(starLon[cruxLines[cliS][1]], starLat[cruxLines[cliS][1]]);
        if (cpaS && cpbS) { ctx.beginPath(); ctx.moveTo(cpaS.x, cpaS.y); ctx.lineTo(cpbS.x, cpbS.y); ctx.stroke(); }
      }
      ctx.setLineDash([]);
      for (var bdiS = 0; bdiS < bigDipper.length; bdiS++) {
        var bdpS = projectSky(bigDipper[bdiS].lon, bigDipper[bdiS].lat);
        if (!bdpS) continue;
        ctx.beginPath(); ctx.arc(bdpS.x, bdpS.y, 2.5, 0, Math.PI*2); ctx.fillStyle = '#ffdd88'; ctx.fill();
      }
    }
    var polaris7 = projectSky(0.662, 1.527);
    if (polaris7) {
      ctx.beginPath(); ctx.arc(polaris7.x, polaris7.y, 5, 0, Math.PI*2); ctx.fillStyle = '#e8f0ff'; ctx.fill();
      ctx.beginPath(); ctx.arc(polaris7.x, polaris7.y, 9, 0, Math.PI*2); ctx.strokeStyle = 'rgba(100,200,255,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
      if (showStarLabels) { ctx.font = '11px sans-serif'; ctx.fillStyle = '#e8f0ff'; ctx.fillText('ポラリス', polaris7.x+11, polaris7.y+4); }
    }
    ctx.font = '12px sans-serif'; ctx.fillStyle = 'rgba(100,180,255,0.65)';
    ctx.fillText('🌀 自転  地球の自転で星が回転  ドラッグ:視点調整  速度スライダー対応', 10, 28);
  }

  function drawSolsticeView() {
    ctx.fillStyle = '#000010'; ctx.fillRect(0, 0, W, H);
    var cx = W / 2, cy = H / 2;
    var sc9 = Math.min(W, H) / 900 * solsticeZoom;
    var sunR = Math.max(22, 34 * sc9);
    var orbitR = Math.max(120, 220 * sc9);
    var earthR = Math.max(16, 26 * sc9);

    for (var si9 = 0; si9 < stars.length; si9++) {
      var st9 = stars[si9];
      var sx9 = cx + st9.x * 0.45, sy9 = cy + st9.y * 0.45;
      if (sx9 < -5 || sx9 > W + 5 || sy9 < -5 || sy9 > H + 5) continue;
      ctx.beginPath(); ctx.arc(sx9, sy9, st9.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
    }

    ctx.beginPath();
    ctx.ellipse(cx, cy, orbitR, orbitR * SOL_SV, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1; ctx.stroke();

    var seas9 = [
      { angle: 0,             label: '夏至', sub: '6/21 今日', color: '#ffd700', big: true  },
      { angle: Math.PI / 2,   label: '秋分', sub: '9/23',     color: '#88bbff', big: false },
      { angle: Math.PI,       label: '冬至', sub: '12/21',    color: '#aaddff', big: false },
      { angle: -Math.PI / 2,  label: '春分', sub: '3/20',     color: '#90ee90', big: false }
    ];
    seas9.forEach(function(s) {
      var mx = cx + orbitR * Math.cos(s.angle);
      var my = cy + ORBIT_Y_SIGN * orbitR * Math.sin(s.angle) * SOL_SV;
      ctx.beginPath(); ctx.arc(mx, my, s.big ? 6 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = s.color; ctx.fill();
      if (s.big) {
        ctx.beginPath(); ctx.arc(mx, my, 10, 0, Math.PI * 2);
        ctx.strokeStyle = s.color + '55'; ctx.lineWidth = 1.5; ctx.stroke();
      }
      ctx.textAlign = 'center';
      ctx.font = (s.big ? 'bold ' : '') + '11px sans-serif'; ctx.fillStyle = s.color;
      var lx = cx + (orbitR + 24) * Math.cos(s.angle);
      var ly = cy + ORBIT_Y_SIGN * (orbitR + 24) * Math.sin(s.angle) * SOL_SV + 4;
      ctx.fillText(s.label, lx, ly);
      ctx.font = '9px sans-serif'; ctx.fillStyle = s.color + 'bb';
      ctx.fillText(s.sub, lx, ly + 13);
      ctx.textAlign = 'left';
    });

    for (var ray9 = 0; ray9 < 16; ray9++) {
      var rA9 = ray9 * Math.PI / 8 + t * 0.03;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(rA9) * sunR * 1.5, cy + Math.sin(rA9) * sunR * 1.5 * SOL_SV);
      ctx.lineTo(cx + Math.cos(rA9) * sunR * 3.2, cy + Math.sin(rA9) * sunR * 3.2 * SOL_SV);
      ctx.strokeStyle = 'rgba(253,184,19,0.11)'; ctx.lineWidth = 2; ctx.stroke();
    }

    drawGlow(cx, cy, sunR, '#fdb813');
    ctx.beginPath(); ctx.arc(cx, cy, sunR, 0, Math.PI * 2);
    var sg9 = ctx.createRadialGradient(cx - sunR * 0.2, cy - sunR * 0.2, sunR * 0.1, cx, cy, sunR);
    sg9.addColorStop(0, '#fff5a0'); sg9.addColorStop(0.5, '#fdb813'); sg9.addColorStop(1, '#f57c00');
    ctx.fillStyle = sg9; ctx.fill();
    if (showPlanetLabels) {
      ctx.textAlign = 'center'; ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#fdb813';
      ctx.fillText('太陽', cx, cy + sunR + 15); ctx.textAlign = 'left';
    }
    planetScreenPos.push({ x: cx, y: cy, item: { name: '太陽', type: '恒星', fact: '夏至のとき太陽は黄経90°(黄道最北端)。北半球で昼が最長になります' } });

    var th9 = solsticeOrbAngle;
    var ex9 = cx + orbitR * Math.cos(th9);
    var ey9 = cy + ORBIT_Y_SIGN * orbitR * Math.sin(th9) * SOL_SV;

    var toSunA9 = Math.atan2(cy - ey9, cx - ex9);

    var rayDirX = Math.cos(toSunA9), rayDirY = Math.sin(toSunA9);
    var perpX9 = -rayDirY, perpY9 = rayDirX;
    ctx.strokeStyle = 'rgba(253,184,19,0.07)'; ctx.lineWidth = 1.5;
    for (var pr9 = -4; pr9 <= 4; pr9++) {
      var ox9 = perpX9 * pr9 * 10, oy9 = perpY9 * pr9 * 10;
      ctx.beginPath();
      ctx.moveTo(cx + rayDirX * sunR + ox9, cy + rayDirY * sunR + oy9);
      ctx.lineTo(ex9 - rayDirX * earthR * 1.4 + ox9, ey9 - rayDirY * earthR * 1.4 + oy9);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(ex9, ey9);

    ctx.beginPath(); ctx.arc(0, 0, earthR, 0, Math.PI * 2);
    ctx.fillStyle = '#0d1b35'; ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, earthR, toSunA9 - Math.PI / 2, toSunA9 + Math.PI / 2);
    ctx.lineTo(0, 0); ctx.closePath();
    ctx.fillStyle = '#2a7de1'; ctx.fill();

    var atm9 = ctx.createRadialGradient(0, 0, earthR * 0.85, 0, 0, earthR * 1.28);
    atm9.addColorStop(0, 'rgba(80,140,255,0.22)');
    atm9.addColorStop(1, 'rgba(80,140,255,0)');
    ctx.beginPath(); ctx.arc(0, 0, earthR * 1.28, 0, Math.PI * 2);
    ctx.fillStyle = atm9; ctx.fill();

    ctx.beginPath(); ctx.arc(0, 0, earthR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(100,180,255,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();

    var axLen9 = earthR * 1.7;
    var npOx = -Math.cos(th9) * SOL_TSIN;
    var npOy = -Math.sin(th9) * SOL_TSIN;
    var npOz = SOL_TCOS;
    var npSx = npOx * axLen9;
    var npSy = (npOy * SOL_SV - npOz * SOL_CV) * axLen9;

    ctx.beginPath(); ctx.moveTo(-npSx, -npSy); ctx.lineTo(npSx, npSy);
    ctx.strokeStyle = 'rgba(255,255,180,0.92)'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
    ctx.stroke(); ctx.setLineDash([]);

    ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = '#ffffaa';
    ctx.fillText('N', npSx + 3, npSy + 4);
    ctx.fillStyle = '#888'; ctx.fillText('S', -npSx - 13, -npSy + 4);
    ctx.font = '9px sans-serif'; ctx.fillStyle = 'rgba(255,255,140,0.75)';
    ctx.fillText('23.4deg', npSx * 0.45 + 4, npSy * 0.45 - 3);

    var e1Ox9 = Math.sin(th9), e1Oy9 = -Math.cos(th9);
    ctx.beginPath();
    ctx.moveTo(-e1Ox9 * earthR, -e1Oy9 * earthR * SOL_SV);
    ctx.lineTo(e1Ox9 * earthR, e1Oy9 * earthR * SOL_SV);
    ctx.strokeStyle = 'rgba(255,130,50,0.6)'; ctx.lineWidth = 1; ctx.stroke();

    var tropSx = Math.cos(toSunA9) * earthR * 0.88;
    var tropSy = Math.sin(toSunA9) * earthR * 0.88;
    ctx.beginPath(); ctx.arc(tropSx, tropSy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd700'; ctx.fill();
    ctx.font = '8px sans-serif'; ctx.fillStyle = '#ffd700';
    ctx.fillText('北回帰線', tropSx + 5, tropSy - 4);

    var e2Ox9 = Math.cos(th9) * SOL_TCOS, e2Oy9 = Math.sin(th9) * SOL_TCOS, e2Oz9 = SOL_TSIN;
    var mPhi9 = solsticeSpinT;
    var mOx9 = e1Ox9 * Math.cos(mPhi9) + e2Ox9 * Math.sin(mPhi9);
    var mOy9 = e1Oy9 * Math.cos(mPhi9) + e2Oy9 * Math.sin(mPhi9);
    var mOz9 = e2Oz9 * Math.sin(mPhi9);
    var mDot9 = mOx9 * (-Math.cos(th9)) + mOy9 * (-Math.sin(th9));
    var spinR9 = earthR * 0.88;
    if (mDot9 > 0) {
      var mSx9 = mOx9 * spinR9;
      var mSy9 = (mOy9 * SOL_SV - mOz9 * SOL_CV) * spinR9;
      ctx.beginPath(); ctx.arc(mSx9, mSy9, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#aaffaa'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(mSx9, mSy9);
      for (var tr9 = 1; tr9 <= 7; tr9++) {
        var tphi9 = mPhi9 - tr9 * 0.15;
        var tOx9 = e1Ox9 * Math.cos(tphi9) + e2Ox9 * Math.sin(tphi9);
        var tOy9 = e1Oy9 * Math.cos(tphi9) + e2Oy9 * Math.sin(tphi9);
        var tOz9 = e2Oz9 * Math.sin(tphi9);
        var tDot9 = tOx9 * (-Math.cos(th9)) + tOy9 * (-Math.sin(th9));
        if (tDot9 > 0) ctx.lineTo(tOx9 * spinR9, (tOy9 * SOL_SV - tOz9 * SOL_CV) * spinR9);
      }
      ctx.strokeStyle = 'rgba(170,255,170,0.35)'; ctx.lineWidth = 1; ctx.stroke();
    }

    ctx.restore();

    if (showPlanetLabels) {
      ctx.font = '11px sans-serif'; ctx.fillStyle = '#c9d1d9';
      ctx.fillText('地球', ex9 + earthR + 6, ey9 + 4);
    }
    planetScreenPos.push({ x: ex9, y: ey9, item: { name: '地球', type: '岩石惑星', fact: '夏至(6/21): 地軸の傾き23.4°で北半球が太陽に最接近。北極圏は白夜、南極圏は極夜になります' } });

    ctx.font = '12px sans-serif'; ctx.fillStyle = 'rgba(255,220,100,0.9)';
    ctx.fillText('🌞 夏至 (Summer Solstice) — 公転 + 自転 + 地軸傾き 23.4°  スクロール/ピンチ:ズーム', 10, 28);
    ctx.font = '11px sans-serif'; ctx.fillStyle = 'rgba(180,220,255,0.7)';
    ctx.fillText('黄点線=地軸  橙線=赤道  金点=北回帰線(太陽直上)  緑点=自転マーカー', 10, 46);

    var infoL = ['夏至のポイント', '・北半球: 昼が1年で最長', '・北回帰線(23.4°N)に太陽が真上', '・北極圏: 白夜  南極圏: 極夜', '・地軸傾き23.4°(N極→太陽方向)'];
    var iy9 = H - infoL.length * 16 - 14;
    ctx.fillStyle = 'rgba(0,0,20,0.72)';
    ctx.fillRect(6, iy9 - 8, 252, infoL.length * 16 + 12);
    for (var ili9 = 0; ili9 < infoL.length; ili9++) {
      ctx.font = '10px sans-serif';
      ctx.fillStyle = ili9 === 0 ? '#ffd700' : 'rgba(200,220,255,0.82)';
      ctx.fillText(infoL[ili9], 12, iy9 + ili9 * 16 + 4);
    }
  }

  // 出典に基づく第1〜第4接触の時刻から、太陽・月中心間の画面上の距離(sep)を
  // 区分線形補間する純粋関数。第2〜第3接触間(皆既中)は中間時刻でsep=0になるよう
  // 折り返す。drawEclipseView から分離してあるのは、この計算だけを canvas を
  // 介さずに検証できるようにするため。
  function eclipsePhaseAt(jd, site, maxSep, minSep) {
    var c1JD = julianDate(2026, 8, 12, site.c1);
    var c2JD = julianDate(2026, 8, 12, site.c2);
    var c3JD = julianDate(2026, 8, 12, site.c3);
    var c4JD = julianDate(2026, 8, 12, site.c4);

    if (jd <= c1JD) return { sep: maxSep, inTotality: false, phaseLabel: '開始前' };
    if (jd < c2JD) return { sep: maxSep - (maxSep - minSep) * (jd - c1JD) / (c2JD - c1JD), inTotality: false, phaseLabel: '部分食 進行中' };
    if (jd <= c3JD) {
      var mid = (c2JD + c3JD) / 2;
      var half = (c3JD - c2JD) / 2 || 1e-9;
      return { sep: minSep * Math.abs(jd - mid) / half, inTotality: true, phaseLabel: '🌑 皆既日食!' };
    }
    if (jd < c4JD) return { sep: minSep + (maxSep - minSep) * (jd - c3JD) / (c4JD - c3JD), inTotality: false, phaseLabel: '部分食 進行中' };
    return { sep: maxSep, inTotality: false, phaseLabel: '終了' };
  }

  function drawEclipseView(jd, site) {
    var cx = W / 2, cy = H / 2;
    var c1JD = julianDate(2026, 8, 12, site.c1);
    var c2JD = julianDate(2026, 8, 12, site.c2);
    var c3JD = julianDate(2026, 8, 12, site.c3);
    var c4JD = julianDate(2026, 8, 12, site.c4);

    var sunPxR = Math.min(W, H) * 0.16;
    var moonPxR = sunPxR * site.magnitude;
    var maxSep = sunPxR + moonPxR;
    var minSep = Math.abs(sunPxR - moonPxR);

    var ph = eclipsePhaseAt(jd, site, maxSep, minSep);
    var sep = ph.sep, inTotality = ph.inTotality, phaseLabel = ph.phaseLabel;

    // 太陽に対する月の相対移動方向は出典データに含まれないため、見た目のための
    // 固定値とする(実際の経路角ではない簡易表現)。
    var dirAngle = -2.3;
    var mx = cx + Math.cos(dirAngle) * sep;
    var my = cy + Math.sin(dirAngle) * sep;

    var darkness = inTotality ? 1 : Math.max(0, 1 - sep / maxSep) * 0.9;
    var topColor = darkness > 0.05
      ? 'rgb(' + Math.round(70 * (1 - darkness)) + ',' + Math.round(120 * (1 - darkness)) + ',' + Math.round(200 * (1 - darkness) + 10) + ')'
      : '#4678c8';
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, topColor);
    grad.addColorStop(1, darkness > 0.5 ? '#04040a' : '#0a1830');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    if (darkness > 0.4) {
      var starAlpha = (darkness - 0.4) / 0.6;
      for (var si10 = 0; si10 < stars.length; si10++) {
        var st10 = stars[si10];
        var sx10 = cx + st10.x * 0.3, sy10 = cy + st10.y * 0.3;
        if (sx10 < 0 || sx10 > W || sy10 < 0 || sy10 > H) continue;
        ctx.beginPath(); ctx.arc(sx10, sy10, st10.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,' + (starAlpha * 0.8).toFixed(2) + ')'; ctx.fill();
      }
    }

    drawGlow(cx, cy, sunPxR * 1.15, '#fdb813');
    ctx.beginPath(); ctx.arc(cx, cy, sunPxR, 0, Math.PI * 2);
    var sg10 = ctx.createRadialGradient(cx - sunPxR * 0.2, cy - sunPxR * 0.2, sunPxR * 0.1, cx, cy, sunPxR);
    sg10.addColorStop(0, '#fff5a0'); sg10.addColorStop(0.5, '#fdb813'); sg10.addColorStop(1, '#f57c00');
    ctx.fillStyle = sg10; ctx.fill();

    if (inTotality) {
      var corona = ctx.createRadialGradient(cx, cy, sunPxR * 0.97, cx, cy, sunPxR * 1.7);
      corona.addColorStop(0, 'rgba(255,255,255,0.9)');
      corona.addColorStop(0.5, 'rgba(230,240,255,0.35)');
      corona.addColorStop(1, 'rgba(230,240,255,0)');
      ctx.beginPath(); ctx.arc(cx, cy, sunPxR * 1.7, 0, Math.PI * 2);
      ctx.fillStyle = corona; ctx.fill();
    }

    ctx.beginPath(); ctx.arc(mx, my, moonPxR, 0, Math.PI * 2);
    ctx.fillStyle = '#050505'; ctx.fill();

    var utcHour = (jd - julianDate(2026, 8, 12, 0)) * 24;
    var localHour = (utcHour + site.tzOffsetH + 24) % 24;
    var lh = Math.floor(localHour);
    var lm = Math.floor((localHour - lh) * 60);
    var ls = Math.floor((((localHour - lh) * 60) - lm) * 60);
    var pad2e = function(n) { return n < 10 ? '0' + n : '' + n; };
    var clockText = pad2e(lh) + ':' + pad2e(lm) + ':' + pad2e(ls) + ' ' + site.tzLabel;

    ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#fdb813';
    ctx.fillText(site.flag + ' ' + site.name + '  2026/8/12  ' + clockText, 10, 26);
    ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = inTotality ? '#ffffff' : 'rgba(230,240,255,0.85)';
    ctx.fillText(phaseLabel, 10, 48);
    ctx.font = '11px sans-serif'; ctx.fillStyle = 'rgba(200,220,255,0.75)';
    ctx.fillText('食分 約' + site.magnitude.toFixed(2) + '  ' + site.note, 10, H - 14);

    var barX = 10, barY = H - 34, barW = W - 20, barH = 6;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(barX, barY, barW, barH);
    var barProgress = Math.max(0, Math.min(1, (jd - c1JD) / (c4JD - c1JD)));
    ctx.fillStyle = '#fdb813';
    ctx.fillRect(barX, barY, barW * barProgress, barH);
    var c2X = barX + barW * (c2JD - c1JD) / (c4JD - c1JD);
    var c3X = barX + barW * (c3JD - c1JD) / (c4JD - c1JD);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(c2X - 1, barY - 2, 2, barH + 4);
    ctx.fillRect(c3X - 1, barY - 2, 2, barH + 4);
  }

  function project3D(dX, dY, dZ) {
    var cy2 = Math.cos(viewAngle), sy2 = Math.sin(viewAngle);
    var cp2 = Math.cos(viewElev), sp2 = Math.sin(viewElev);
    var dotFw = dX * cy2 * cp2 + dY * sy2 * cp2 + dZ * sp2;
    var dotRt = dX * sy2 - dY * cy2;
    var dotUp = -dX * cy2 * sp2 - dY * sy2 * sp2 + dZ * cp2;
    var sx, sy3;
    if (skyViewMode !== '' && skyViewMode !== 'solstice') {
      // 直線透視(ピンホール)投影は視野角が広いほど周辺の拡大率が際限なく
      // 増加し(θ→90°でdotFw→0に発散)、画面の左右端に近づくほど歪みが
      // 大きくなる。天球を見上げる全モード(今日の空・地軸固定・自転・
      // 地球目線・月面・ISS、いずれも fovH が最大 0.85π まで広がりうる)を
      // 平射(ステレオ)投影 r = k*tan(θ/2) に統一し、拡大率の増加を
      // sec^2(θ/2) 程度に抑えて周辺の歪みを緩和する。夏至モードはこの関数を
      // 使わない別視点(3人称の公転図)のため対象外。
      if (dotFw <= -0.5) return null;
      var domeScale = (W / 2) / Math.tan(fovH / 4) / (1 + dotFw);
      sx = W / 2 + dotRt * domeScale;
      sy3 = H / 2 - dotUp * domeScale;
    } else {
      if (dotFw <= 0.01) return null;
      var focal = (W / 2) / Math.tan(fovH / 2);
      sx = W / 2 + dotRt / dotFw * focal;
      sy3 = H / 2 - dotUp / dotFw * focal;
    }
    if (sx < -80 || sx > W + 80 || sy3 < -80 || sy3 > H + 80) return null;
    return { x: sx, y: sy3 };
  }

  function projectSky(lon, lat) {
    var dX = Math.cos(lat) * Math.cos(lon);
    var dY = Math.cos(lat) * Math.sin(lon);
    var dZ = Math.sin(lat);
    return project3D(dX, dY, dZ);
  }

  function getEarthPos() {
    var ep = planets[2];
    var ea = ep.angle + t / ep.period;
    return { x: Math.cos(ea) * ep.orbitR, y: ORBIT_Y_SIGN * Math.sin(ea) * ep.orbitR };
  }

  function drawMoonPhase(x, y, r, phaseNorm) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#e8e8d8';
    ctx.fill();
    var theta = phaseNorm * Math.PI * 2;
    var c = Math.cos(theta);
    ctx.beginPath();
    if (phaseNorm < 0.5) {
      ctx.arc(x, y, r, Math.PI / 2, 3 * Math.PI / 2);
      ctx.ellipse(x, y, Math.abs(c) * r, r, 0, 3 * Math.PI / 2, Math.PI / 2, c < 0);
    } else {
      ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2);
      ctx.ellipse(x, y, Math.abs(c) * r, r, 0, Math.PI / 2, -Math.PI / 2, c > 0);
    }
    ctx.closePath();
    ctx.fillStyle = '#060614';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(200,200,200,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawSkyView() {
    var ep = getEarthPos();
    var moonEaSV = planets[2].angle + t / planets[2].period;
    var mEXsv = Math.cos(moonEaSV) * planets[2].orbitR;
    var mEYsv = ORBIT_Y_SIGN * Math.sin(moonEaSV) * planets[2].orbitR;
    var moonAngSV = moon.angle + t / moon.period;
    var moonAbsX = mEXsv + moon.orbitR * Math.cos(moonAngSV);
    var moonAbsY = mEYsv + ORBIT_Y_SIGN * moon.orbitR * Math.sin(moonAngSV);
    var issAngSV = iss.angle + t / iss.period;
    var issAbsX = mEXsv + iss.orbitR * Math.cos(issAngSV);
    var issAbsY = mEYsv + ORBIT_Y_SIGN * iss.orbitR * Math.sin(issAngSV);

    var camX, camY;
    if (skyViewMode === 'moon') { camX = moonAbsX; camY = moonAbsY; }
    else if (skyViewMode === 'iss') { camX = issAbsX; camY = issAbsY; }
    else { camX = ep.x; camY = ep.y; }

    var sunLon = Math.atan2(-camY, -camX);
    // 平射投影(project3D の dome 分岐)と同じ式系で水平線位置を近似する
    var horizonY = H / 2 - Math.tan(viewElev / 2) * (W / 2) / Math.tan(fovH / 4);

    var skyTop = skyViewMode === 'moon' ? '#000008' : (skyViewMode === 'iss' ? '#000005' : '#000018');
    var skyHor  = skyViewMode === 'moon' ? '#000015' : (skyViewMode === 'iss' ? '#000018' : '#000c28');
    var grad = ctx.createLinearGradient(0, 0, 0, Math.max(0, horizonY));
    grad.addColorStop(0, skyTop);
    grad.addColorStop(1, skyHor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    if (horizonY < H) {
      if (skyViewMode === 'moon') {
        var moonSurf = ctx.createLinearGradient(0, Math.max(0, horizonY), 0, H);
        moonSurf.addColorStop(0, '#2a2518');
        moonSurf.addColorStop(1, '#1a170f');
        ctx.fillStyle = moonSurf;
      } else if (skyViewMode === 'iss') {
        var issSurf = ctx.createLinearGradient(0, Math.max(0, horizonY), 0, H);
        issSurf.addColorStop(0, '#0a2050');
        issSurf.addColorStop(1, '#061030');
        ctx.fillStyle = issSurf;
      } else {
        ctx.fillStyle = '#060e06';
      }
      ctx.fillRect(0, Math.max(0, horizonY), W, H);
    }

    for (var si4 = 0; si4 < skyStars.length; si4++) {
      var ss = skyStars[si4];
      if (ss.lat < -0.02) continue;
      var sPos = projectSky(ss.lon, ss.lat);
      if (!sPos) continue;
      var alp = 1;
      if (ss.twinkle) alp = 0.5 + 0.5 * Math.sin(t * 3 + ss.phase);
      ctx.beginPath();
      ctx.arc(sPos.x, sPos.y, ss.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,' + alp.toFixed(2) + ')';
      ctx.fill();
    }

    starScreenPos = [];
    for (var ni3 = 0; ni3 < namedStars.length; ni3++) {
      var ns3 = namedStars[ni3];
      var nPos = projectSky(starLon[ni3], starLat[ni3]);
      if (!nPos) continue;
      if (ns3.isPleiades) { drawPleiadesCluster(nPos.x, nPos.y, ns3.color); } else if (ns3.isCluster) { drawCluster(nPos.x, nPos.y, ns3.color); } else { ctx.beginPath(); ctx.arc(nPos.x, nPos.y, 5, 0, Math.PI * 2); ctx.fillStyle = ns3.color; ctx.fill(); ctx.beginPath(); ctx.arc(nPos.x, nPos.y, 8, 0, Math.PI * 2); ctx.strokeStyle = ns3.color + '44'; ctx.lineWidth = 2; ctx.stroke(); }
      if (showStarLabels) {
        ctx.font = '11px sans-serif'; ctx.fillStyle = ns3.color;
        ctx.fillText(ns3.name, nPos.x + 10, nPos.y + 4);
      }
      starScreenPos.push({ x: nPos.x, y: nPos.y, item: ns3 });
    }

    drawSkyConstellationLines(projectSky);

    if (showConstellations) {
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(180,220,255,0.4)';
      var stPts = [];
      for (var sti = 0; sti < summerTriIdx.length; sti++) {
        stPts.push(projectSky(starLon[summerTriIdx[sti]], starLat[summerTriIdx[sti]]));
      }
      for (var stli = 0; stli < 3; stli++) {
        var pa = stPts[stli], pb = stPts[(stli + 1) % 3];
        if (pa && pb) { ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke(); }
      }
      if (stPts[0] && showStarLabels) {
        ctx.setLineDash([]);
        ctx.font = '10px sans-serif'; ctx.fillStyle = 'rgba(180,220,255,0.7)';
        ctx.fillText('夏の大三角', stPts[0].x + 12, stPts[0].y - 14);
      }
      ctx.strokeStyle = 'rgba(255,220,150,0.4)';
      ctx.setLineDash([4, 4]);
      for (var bli2 = 0; bli2 < bigDipperLines.length; bli2++) {
        var bpa = projectSky(bigDipper[bigDipperLines[bli2][0]].lon, bigDipper[bigDipperLines[bli2][0]].lat);
        var bpb = projectSky(bigDipper[bigDipperLines[bli2][1]].lon, bigDipper[bigDipperLines[bli2][1]].lat);
        if (bpa && bpb) { ctx.beginPath(); ctx.moveTo(bpa.x, bpa.y); ctx.lineTo(bpb.x, bpb.y); ctx.stroke(); }
      }
      ctx.strokeStyle = 'rgba(180,255,220,0.4)';
      ctx.setLineDash([4, 4]);
      for (var cli2 = 0; cli2 < cruxLines.length; cli2++) {
        var cpa2 = projectSky(starLon[cruxLines[cli2][0]], starLat[cruxLines[cli2][0]]);
        var cpb2 = projectSky(starLon[cruxLines[cli2][1]], starLat[cruxLines[cli2][1]]);
        if (cpa2 && cpb2) { ctx.beginPath(); ctx.moveTo(cpa2.x, cpa2.y); ctx.lineTo(cpb2.x, cpb2.y); ctx.stroke(); }
      }
      ctx.setLineDash([]);
      for (var bdi2 = 0; bdi2 < bigDipper.length; bdi2++) {
        var bdp = projectSky(bigDipper[bdi2].lon, bigDipper[bdi2].lat);
        if (!bdp) continue;
        ctx.beginPath(); ctx.arc(bdp.x, bdp.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffdd88'; ctx.fill();
      }
      if (showStarLabels) {
        var bd0 = projectSky(bigDipper[0].lon, bigDipper[0].lat);
        if (bd0) {
          ctx.font = '10px sans-serif'; ctx.fillStyle = 'rgba(255,220,150,0.7)';
          ctx.fillText('北斗七星', bd0.x - 10, bd0.y - 14);
        }
        var cruxTop = projectSky(starLon[16], starLat[16]);
        if (cruxTop) {
          ctx.font = '10px sans-serif'; ctx.fillStyle = 'rgba(180,255,220,0.7)';
          ctx.fillText('南十字星', cruxTop.x + 10, cruxTop.y - 10);
        }
      }
    }

    drawGrid();

    var sunPos = projectSky(sunLon, 0);
    if (sunPos) {
      drawGlow(sunPos.x, sunPos.y, 32, '#fdb813');
      var sg3 = ctx.createRadialGradient(sunPos.x - 6, sunPos.y - 6, 3, sunPos.x, sunPos.y, 30);
      sg3.addColorStop(0, '#fff5a0'); sg3.addColorStop(0.5, '#fdb813'); sg3.addColorStop(1, '#f57c00');
      ctx.beginPath(); ctx.arc(sunPos.x, sunPos.y, 30, 0, Math.PI * 2);
      ctx.fillStyle = sg3; ctx.fill();
      if (showPlanetLabels) {
        ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#fdb813';
        ctx.fillText('太陽', sunPos.x + 34, sunPos.y + 4);
      }
      planetScreenPos.push({ x: sunPos.x, y: sunPos.y, item: { name: '太陽', type: '恒星', fact: '太陽系の中心恒星。直径は地球の約109倍、質量は太陽系全体の99.86%を占めます' } });
    }

    for (var pi3 = 0; pi3 < planets.length; pi3++) {
      var pl3 = planets[pi3];
      var pa3 = pl3.angle + t / pl3.period;
      var plx3 = Math.cos(pa3) * pl3.orbitR;
      var ply3 = ORBIT_Y_SIGN * Math.sin(pa3) * pl3.orbitR;
      if (pl3.name === '地球') {
        if (skyViewMode !== 'earth') {
          var edx = plx3 - camX, edy = ply3 - camY;
          var eLon = Math.atan2(edy, edx);
          var ePos = projectSky(eLon, 0);
          if (ePos) {
            var eAppRad = skyViewMode === 'iss' ? 0.52 : 0.16;
            var ePixR = Math.tan(eAppRad) * focal;
            var eGrad = ctx.createRadialGradient(ePos.x - ePixR * 0.3, ePos.y - ePixR * 0.2, ePixR * 0.05, ePos.x, ePos.y, ePixR);
            eGrad.addColorStop(0, '#90d0ff'); eGrad.addColorStop(0.35, '#4fa3e0');
            eGrad.addColorStop(0.7, '#2060a0'); eGrad.addColorStop(1, '#0a2040');
            ctx.beginPath(); ctx.arc(ePos.x, ePos.y, ePixR, 0, Math.PI * 2);
            ctx.fillStyle = eGrad; ctx.fill();
            ctx.save();
            ctx.beginPath(); ctx.arc(ePos.x, ePos.y, ePixR, 0, Math.PI * 2); ctx.clip();
            ctx.fillStyle = 'rgba(55,140,45,0.4)';
            ctx.beginPath();
            ctx.ellipse(ePos.x - ePixR * 0.15, ePos.y - ePixR * 0.05, ePixR * 0.22, ePixR * 0.38, 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(ePos.x + ePixR * 0.2, ePos.y + ePixR * 0.18, ePixR * 0.28, ePixR * 0.22, -0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.beginPath();
            ctx.ellipse(ePos.x - ePixR * 0.1, ePos.y - ePixR * 0.35, ePixR * 0.5, ePixR * 0.12, 0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            drawGlow(ePos.x, ePos.y, ePixR * 0.7, '#4fa3e0');
            if (showPlanetLabels) {
              ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#4fa3e0';
              ctx.fillText('地球', ePos.x + ePixR + 6, ePos.y + 4);
            }
            planetScreenPos.push({ x: ePos.x, y: ePos.y, item: pl3 });
          }
        }
        continue;
      }
      var dx3 = plx3 - camX, dy3 = ply3 - camY;
      var dist3 = Math.sqrt(dx3 * dx3 + dy3 * dy3);
      var plon3 = Math.atan2(dy3, dx3);
      var pPos = projectSky(plon3, 0);
      if (!pPos) continue;
      var appR = Math.max(4, pl3.radius * 120 / Math.max(dist3, 20));
      if (pl3.hasRings) drawRings(pPos.x, pPos.y, appR);
      drawPlanet(pPos.x, pPos.y, appR, pl3.color);
      if (showPlanetLabels) {
        ctx.font = '11px sans-serif'; ctx.fillStyle = '#c9d1d9';
        ctx.fillText(pl3.jaName, pPos.x + appR + 4, pPos.y + 4);
      }
      planetScreenPos.push({ x: pPos.x, y: pPos.y, item: pl3 });
    }

    if (skyViewMode !== 'moon') {
      var mDxSV = moonAbsX - camX, mDySV = moonAbsY - camY;
      var mLonSV = Math.atan2(mDySV, mDxSV);
      var mPosSV = projectSky(mLonSV, 0.05);
      if (mPosSV) {
        var phaseAng = ((mLonSV - sunLon) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        drawMoonPhase(mPosSV.x, mPosSV.y, 16, phaseAng / (Math.PI * 2));
        if (showPlanetLabels) {
          ctx.font = '11px sans-serif'; ctx.fillStyle = '#aaa';
          ctx.fillText('月', mPosSV.x + 20, mPosSV.y + 4);
        }
        planetScreenPos.push({ x: mPosSV.x, y: mPosSV.y, item: moon });
      }
    }

    if (skyViewMode !== 'iss') {
      var iDxSV = issAbsX - camX, iDySV = issAbsY - camY;
      var iLonSV = Math.atan2(iDySV, iDxSV);
      var iPosSV = projectSky(iLonSV, 0.09);
      if (iPosSV) {
        var issAlpSV = 0.5 + 0.5 * Math.sin(t * 25);
        ctx.strokeStyle = 'rgba(136,255,204,' + issAlpSV.toFixed(2) + ')';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(iPosSV.x - 6, iPosSV.y); ctx.lineTo(iPosSV.x + 6, iPosSV.y);
        ctx.moveTo(iPosSV.x, iPosSV.y - 6); ctx.lineTo(iPosSV.x, iPosSV.y + 6);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(iPosSV.x, iPosSV.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(136,255,204,' + issAlpSV.toFixed(2) + ')'; ctx.fill();
        if (showPlanetLabels) {
          ctx.font = '10px sans-serif'; ctx.fillStyle = 'rgba(136,255,204,0.9)';
          ctx.fillText('ISS', iPosSV.x + 8, iPosSV.y - 3);
        }
        planetScreenPos.push({ x: iPosSV.x, y: iPosSV.y, item: iss });
      }
    }

    if (skyViewMode === 'moon' && horizonY > 0 && horizonY < H) {
      for (var ci = 0; ci < 12; ci++) {
        var cx2 = W * ci / 11;
        var cr = 8 + pseudoRand() * 14;
        var cy2 = horizonY + cr * 0.4;
        ctx.beginPath(); ctx.arc(cx2, cy2, cr, 0, Math.PI * 2);
        ctx.fillStyle = '#252018'; ctx.fill();
      }
    }

    if (horizonY > 0 && horizonY < H) {
      ctx.beginPath(); ctx.moveTo(0, horizonY); ctx.lineTo(W, horizonY);
      ctx.strokeStyle = skyViewMode === 'moon' ? 'rgba(160,150,110,0.6)' :
                        (skyViewMode === 'iss' ? 'rgba(40,140,255,0.5)' : 'rgba(80,160,80,0.4)');
      ctx.lineWidth = 1; ctx.stroke();
    }

    var hudText = skyViewMode === 'moon' ? '🌑 月面  ドラッグ:視点回転  ピンチ/スクロール:ズーム' :
                  (skyViewMode === 'iss' ? '🛸 ISS  ドラッグ:視点回転  ピンチ/スクロール:ズーム' :
                  '🌍 地球目線  ドラッグ:視点回転  ピンチ/スクロール:ズーム');
    ctx.font = '12px sans-serif'; ctx.fillStyle = 'rgba(100,180,255,0.65)';
    ctx.fillText(hudText, 10, 28);
  }

  var planets = [
    { name: '水星', jaName: '水星', type: '岩石惑星', orbitR: 80, radius: 4, period: 0.24, color: '#b5b5b5', angle: 0, fact: '太陽系最小の惑星。表面温度は-180°Cから430°Cと激しく変動します' },
    { name: '金星', jaName: '金星', type: '岩石惑星', orbitR: 120, radius: 8, period: 0.62, color: '#e8cda0', angle: 1.0, fact: '地球から最も明るく見える惑星。厚い大気で温室効果が強烈です' },
    { name: '地球', jaName: '地球', type: '岩石惑星', orbitR: 170, radius: 9, period: 1.0, color: '#4fa3e0', angle: 2.0, fact: '生命が存在する唯一確認されている惑星。表面の71%が海です', hasMoon: true },
    { name: '火星', jaName: '火星', type: '岩石惑星', orbitR: 230, radius: 6, period: 1.88, color: '#c1440e', angle: 3.5, fact: '赤い惑星。太陽系最大の火山「オリンポス山」があります' },
    { name: '木星', jaName: '木星', type: 'ガス惑星', orbitR: 320, radius: 20, period: 11.86, color: '#c88b3a', angle: 0.5, fact: '太陽系最大の惑星。大赤斑という巨大嵐が300年以上続いています' },
    { name: '土星', jaName: '土星', type: 'ガス惑星', orbitR: 420, radius: 16, period: 29.46, color: '#e4d191', angle: 4.0, fact: '美しいリングを持つ惑星。平均密度が水より低く、海に浮かびます', hasRings: true },
    { name: '天王星', jaName: '天王星', type: '氷巨星', orbitR: 510, radius: 11, period: 84.0, color: '#7de8e8', angle: 1.5, fact: '自転軸が約98度傾いており、横倒しになって公転しています' },
    { name: '海王星', jaName: '海王星', type: '氷巨星', orbitR: 590, radius: 10, period: 165.0, color: '#4b70dd', angle: 2.8, fact: '太陽系最強の風速を持つ惑星。風速は2100km/hに達します' }
  ];

  var moon = { name: '月', type: '衛星', orbitR: 22, radius: 3, period: 0.075, color: '#cccccc', angle: 0, fact: '地球の唯一の天然衛星。地球の潮汐に影響を与えています' };

  var namedStars = [
    { name: 'シリウス', color: '#b0d4ff', ox: -680, oy: 200, fact: '全天で最も明るい恒星。おおいぬ座にあります' },
    { name: 'ベテルギウス', color: '#ff7043', ox: 650, oy: -180, fact: 'オリオン座の赤色超巨星。近い将来超新星爆発の可能性があります' },
    { name: 'リゲル', color: '#cce0ff', ox: 700, oy: 280, fact: 'オリオン座の青白色超巨星。太陽の約120倍の質量を持ちます' },
    { name: 'アルデバラン', color: '#ff8c42', ox: -600, oy: -320, fact: 'おうし座の赤色巨星。太陽の約44倍の直径です' },
    { name: 'アンタレス', color: '#ff5252', ox: 500, oy: 400, fact: 'さそり座の赤色超巨星。その名は「火星に対抗するもの」の意味です' },
    { name: 'ベガ', color: '#e8eaff', ox: -200, oy: -650, fact: 'こと座の白色星・七夕の織姫星。太陽の約2.5倍の質量です' },
    { name: 'アルタイル', color: '#fff5e0', ox: 300, oy: -620, fact: 'わし座の星・七夕の彦星。自転が非常に速く赤道付近が膨らんでいます' },
    { name: 'デネブ', color: '#ddeeff', ox: -500, oy: 500, fact: 'はくちょう座の白色超巨星。地球からの距離は約1400光年です' },
    { name: 'スピカ', color: '#aad4ff', ox: 600, oy: -450, fact: 'おとめ座の青白色連星。2つの星が互いを公転する連星系です' },
    { name: 'アークトゥルス', color: '#ffad42', ox: -680, oy: -150, fact: 'うしかい座のオレンジ色巨星。北天で最も明るい星のひとつです' },
    { name: 'ポルックス', color: '#ffd080', ox: -480, oy: 320, fact: 'ふたご座の最も明るい星。オレンジ色の巨星で少なくとも1つの惑星を持ちます' },
    { name: 'カペラ', color: '#fff0a0', ox: 460, oy: -370, fact: 'ぎょしゃ座の一等星。2つの巨星が互いを公転する連星系で、全天6番目の明るさです' },
    { name: 'カストル', color: '#d0e8ff', ox: -420, oy: 280, fact: 'ふたご座αで、ポルックスとペアを成す。実際は6つの星からなる多重連星系です' },
    { name: 'プレセペ星団', color: '#ffe8c0', ox: -120, oy: 370, fact: 'かに座の散開星団（M44/蜂の巣星団）。約1000個の星が集まり肉眼でも見える。距離は約577光年', isCluster: true },
    { name: 'アクルックス', color: '#b0d4ff', ox: 470, oy: 640, fact: '南十字座α星・最輝星。2等星の青白色連星で、南天の指標として航海に使われました。距離は約321光年' },
    { name: 'ミモサ', color: '#9bc4ff', ox: 565, oy: 555, fact: '南十字座β星。南十字の右腕に位置する青白色巨星です。距離は約280光年' },
    { name: 'ガクルックス', color: '#ff7755', ox: 460, oy: 490, fact: '南十字座γ星・頂点の星。南十字の最北端に位置する赤色巨星。距離は約88光年' },
    { name: 'デルタクルキス', color: '#aac8ff', ox: 360, oy: 565, fact: '南十字座δ星。南十字の左腕に位置する青色巨星です。距離は約364光年' },
    { name: 'プレアデス星団', color: '#99bbff', ox: -390, oy: -480, fact: 'おうし座の散開星団（M45・昴）。七姉妹とも呼ばれる。約445光年先にある約1000個の星の集団。肉眼で6〜7個の星が識別でき、日本では「すばる」として古来親しまれてきました', isCluster: true, isPleiades: true },
    { name: 'レグルス', color: '#c8dcff', ox: -760, oy: 30, fact: 'しし座α星。黄道に近い一等星で「小さな王」を意味する名を持ちます' },
    { name: 'シェラタン', color: '#fff0cc', ox: -210, oy: -230, fact: 'おひつじ座β星。ハマルと並び、おひつじ座の頭部を形づくる星です' },
    { name: 'ハマル', color: '#ffd28a', ox: -300, oy: -260, fact: 'おひつじ座α星。おひつじ座で最も明るいオレンジ色巨星です' },
    { name: 'メサルティム', color: '#e8f0ff', ox: -150, oy: -180, fact: 'おひつじ座γ星。古くから知られる二重星で、おひつじ座の星座線を結びます' },
    { name: 'アルレシャ', color: '#d8e8ff', ox: 150, oy: -330, fact: 'うお座α星。2匹の魚を結ぶ結び目にあたる二重星です' },
    { name: 'フム・アル・サマカー', color: '#f0f4ff', ox: 270, oy: -430, fact: 'うお座β星。うお座の西側の魚をたどる目印の星です' },
    { name: 'トルクラー', color: '#fff2d0', ox: 260, oy: -190, fact: 'うお座ο星。うお座のゆるやかな星座線上にある星です' },
    { name: 'エルナト', color: '#d5e8ff', ox: -520, oy: -420, fact: 'おうし座β星。おうし座の角の先に輝く青白い星です' },
    { name: 'ゼータ・タウリ', color: '#bcd8ff', ox: -700, oy: -250, fact: 'おうし座ζ星。おうし座のもう一方の角の先にあたる星です' }
  ];

  var constellationLines = [
    { name: 'おうし座', color: 'rgba(255,170,90,0.48)', points: [[-390, -480], [-600, -320], [-520, -420], [-600, -320], [-700, -250]], label: [-610, -430] },
    { name: 'おひつじ座', color: 'rgba(255,210,130,0.48)', points: [[-300, -260], [-210, -230], [-150, -180]], label: [-265, -205] },
    { name: 'うお座', color: 'rgba(150,200,255,0.45)', points: [[150, -330], [270, -430], [150, -330], [260, -190], [60, -120], [-120, -90], [-210, -230]], label: [120, -250] }
  ];

  var stars = [];
  var rng = 12345;
  function pseudoRand() {
    rng = (rng * 1664525 + 1013904223) & 0xffffffff;
    return (rng >>> 0) / 4294967296;
  }
  for (var i = 0; i < 200; i++) {
    stars.push({
      x: (pseudoRand() - 0.5) * 3000,
      y: (pseudoRand() - 0.5) * 3000,
      r: pseudoRand() < 0.3 ? 2 : 1,
      twinkle: pseudoRand() < 0.2,
      phase: pseudoRand() * Math.PI * 2
    });
  }

  var W, H, scale;
  function resize() {
    W = canvas.offsetWidth;
    H = canvas.offsetHeight;
    canvas.width = W;
    canvas.height = H;
    scale = Math.min(W, H) / 1400;
  }
  resize();
  window.addEventListener('resize', resize);

  function drawGlow(x, y, r, color) {
    var grad = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 2.5);
    grad.addColorStop(0, color);
    grad.addColorStop(0.4, color + '88');
    grad.addColorStop(1, color + '00');
    ctx.beginPath();
    ctx.arc(x, y, r * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  var clusterOffsets = [[0,0],[5,-4],[-4,-5],[6,2],[-5,3],[2,6],[-2,-7],[7,-2],[-6,5],[1,7],[4,5],[-3,6]];
  function drawCluster(x, y, color) {
    for (var ci = 0; ci < clusterOffsets.length; ci++) {
      ctx.beginPath();
      ctx.arc(x + clusterOffsets[ci][0], y + clusterOffsets[ci][1], 1.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.strokeStyle = color + '33';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  var pleiadesOffsets = [[0,0],[8,12],[-12,4],[-4,-10],[6,-8],[-8,-4],[10,8],[3,15],[-6,10],[12,-5],[-10,-8],[2,-14],[14,2],[-2,18]];
  var pleiadesSizes =   [2.5,  2.0,  2.0,   1.8,    1.8,   1.8,   1.8,   1.3,   1.3,   1.3,   1.2,   1.2,   1.2,   1.2];
  function drawPleiadesCluster(x, y, color) {
    var nebGrad = ctx.createRadialGradient(x, y, 2, x, y, 22);
    nebGrad.addColorStop(0, 'rgba(100,150,255,0.28)');
    nebGrad.addColorStop(0.5, 'rgba(80,120,255,0.10)');
    nebGrad.addColorStop(1, 'rgba(60,100,255,0)');
    ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fillStyle = nebGrad; ctx.fill();
    for (var pi2 = 0; pi2 < pleiadesOffsets.length; pi2++) {
      ctx.beginPath();
      ctx.arc(x + pleiadesOffsets[pi2][0], y + pleiadesOffsets[pi2][1], pleiadesSizes[pi2] || 1.2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.beginPath(); ctx.arc(x, y, 24, 0, Math.PI * 2);
    ctx.strokeStyle = color + '22';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawPlanet(x, y, r, color) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawRings(x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.35);
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(228,209,145,0.55)';
    ctx.lineWidth = r * 0.6;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(228,209,145,0.3)';
    ctx.lineWidth = r * 0.3;
    ctx.stroke();
    ctx.restore();
  }

  function drawOrbit(cx, cy, r) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  var activeItem = null;

  function showTooltip(item, screenX, screenY) {
    tooltip.innerHTML =
      '<div class="tt-name">' + item.name + '</div>' +
      '<div class="tt-type">' + (item.type || '恒星') + '</div>' +
      '<div class="tt-fact">' + item.fact + '</div>';
    tooltip.style.opacity = '1';
    var tx = screenX + 16;
    var ty = screenY - 60;
    if (tx + 250 > window.innerWidth) tx = screenX - 260;
    if (ty < 0) ty = screenY + 16;
    tooltip.style.left = tx + 'px';
    tooltip.style.top = ty + 'px';
  }

  function hideTooltip() {
    tooltip.style.opacity = '0';
    activeItem = null;
  }

  function getCanvasPos(e) {
    var rect = canvas.getBoundingClientRect();
    var cx = e.clientX - rect.left;
    var cy = e.clientY - rect.top;
    return { x: cx, y: cy };
  }

  var planetScreenPos = [];
  var starScreenPos = [];

  function hitTest(screenX, screenY) {
    var hitR = 18;
    for (var i = 0; i < planetScreenPos.length; i++) {
      var p = planetScreenPos[i];
      var dx = screenX - p.x;
      var dy = screenY - p.y;
      if (dx * dx + dy * dy < hitR * hitR) return p.item;
    }
    hitR = 14;
    for (var j = 0; j < starScreenPos.length; j++) {
      var s = starScreenPos[j];
      var dx2 = screenX - s.x;
      var dy2 = screenY - s.y;
      if (dx2 * dx2 + dy2 * dy2 < hitR * hitR) return s.item;
    }
    return null;
  }

  canvas.addEventListener('click', function(e) {
    if (skyViewMode !== '') return;
    var pos = getCanvasPos(e);
    var item = hitTest(pos.x, pos.y);
    if (item) { showTooltip(item, e.clientX, e.clientY); activeItem = item; }
    else hideTooltip();
  });

  function drawMeteors(dt) {
    if (!showMeteors || skyViewMode === '' || skyViewMode === 'solstice') return;
    var persPos = projectSky(PERS_LON, PERS_LAT);
    var persX = persPos ? persPos.x : W * 0.35;
    var persY = persPos ? persPos.y : H * 0.22;
    meteorSpawnTimer -= dt;
    if (meteorSpawnTimer <= 0) {
      meteorSpawnTimer = 0.07 + Math.random() * 0.12;
      var ang = Math.random() * Math.PI * 2;
      var spd = 180 + Math.random() * 220;
      var lif = 0.35 + Math.random() * 0.4;
      var dist = 15 + Math.random() * 60;
      meteors.push({
        x: persX + Math.cos(ang) * dist,
        y: persY + Math.sin(ang) * dist,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: lif, maxLife: lif,
        len: 25 + Math.random() * 55
      });
    }
    for (var mi = meteors.length - 1; mi >= 0; mi--) {
      var m = meteors[mi];
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.life -= dt;
      if (m.life <= 0 || m.x < -60 || m.x > W + 60 || m.y < -60 || m.y > H + 60) {
        meteors.splice(mi, 1);
        continue;
      }
      var alp = m.life / m.maxLife;
      var spd2 = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
      var dx2 = m.vx / spd2, dy2 = m.vy / spd2;
      var tailLen = m.len * alp;
      var tx = m.x - dx2 * tailLen;
      var ty = m.y - dy2 * tailLen;
      var grad = ctx.createLinearGradient(tx, ty, m.x, m.y);
      grad.addColorStop(0, 'rgba(200,230,255,0)');
      grad.addColorStop(1, 'rgba(255,255,255,' + (alp * 0.9).toFixed(2) + ')');
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(m.x, m.y);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(m.x, m.y, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(220,240,255,' + (alp * 0.95).toFixed(2) + ')';
      ctx.fill();
      ctx.restore();
    }
    if (persPos) {
      ctx.font = '10px sans-serif';
      ctx.fillStyle = 'rgba(180,220,255,0.65)';
      ctx.fillText('ペルセウス座 (輻射点)', persPos.x + 9, persPos.y - 9);
    }
    ctx.font = '11px sans-serif';
    ctx.fillStyle = 'rgba(180,220,255,0.8)';
    ctx.fillText('☄️ ペルセウス座流星群  毎年8月中旬が極大', 10, H - 14);
  }

  var lastTime = null;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!lastTime) lastTime = now;
    var dt = (now - lastTime) / 1000;
    lastTime = now;
    dt = Math.min(dt, 0.1);
    t += dt * speed;

    ctx.clearRect(0, 0, W, H);

    planetScreenPos = [];
    starScreenPos = [];

    if (skyViewMode === 'today') {
      if (weekReplayActive) {
        weekReplayElapsed += dt * speed;
        var progress = Math.min(1, weekReplayElapsed / weekReplayDuration);
        weekReplayJD = weekReplayStartJD + progress * weekReplayDays;
        if (progress >= 1) weekReplayActive = false;
        drawTodaySky(weekReplayJD);
        syncCalendarToJD(weekReplayJD, false);
      } else if (selectedSkyJD !== null) {
        drawTodaySky(selectedSkyJD);
      } else {
        drawTodaySky();
      }
      drawMeteors(dt);
      return;
    }
    if (skyViewMode === 'pole') {
      viewAngle += dt * 0.003 * speed;
      drawPoleView();
      drawMeteors(dt);
      return;
    }
    if (skyViewMode === 'spin') {
      viewAngle += dt * 0.009 * speed;
      drawSpinView();
      drawMeteors(dt);
      return;
    }
    if (skyViewMode === 'solstice') {
      solsticeOrbAngle += dt * 0.22 * speed;
      solsticeSpinT += dt * 1.8 * speed;
      drawSolsticeView();
      return;
    }
    if (skyViewMode === 'eclipse') {
      if (eclipseSite) {
        eclipseElapsed += dt * speed;
        var eProgress = Math.min(1, eclipseElapsed / ECLIPSE_REPLAY_DURATION);
        var eJD = eclipseStartJD + eProgress * eclipseRangeDays;
        drawEclipseView(eJD, eclipseSite);
        syncCalendarToJD(eJD, false);
      }
      return;
    }
    if (skyViewMode !== '') {
      drawSkyView();
      drawMeteors(dt);
      return;
    }

    ctx.fillStyle = '#000010';
    ctx.fillRect(0, 0, W, H);

    var cx = W / 2;
    var cy = H / 2;

    for (var si = 0; si < stars.length; si++) {
      var star = stars[si];
      var sx = cx + star.x;
      var sy = cy + star.y;
      if (sx < -5 || sx > W + 5 || sy < -5 || sy > H + 5) continue;
      var alpha = 1;
      if (star.twinkle) {
        alpha = 0.5 + 0.5 * Math.sin(t * 3 + star.phase);
      }
      ctx.beginPath();
      ctx.arc(sx, sy, star.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,' + alpha.toFixed(2) + ')';
      ctx.fill();
    }

    var sc = scale || 1;

    if (showConstellations) {
      for (var cli = 0; cli < constellationLines.length; cli++) {
        var line = constellationLines[cli];
        ctx.save();
        ctx.strokeStyle = line.color;
        ctx.lineWidth = 1.4;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        for (var cpi = 0; cpi < line.points.length; cpi++) {
          var lp = line.points[cpi];
          var lpx = cx + lp[0] * sc;
          var lpy = cy + lp[1] * sc;
          if (cpi === 0) ctx.moveTo(lpx, lpy);
          else ctx.lineTo(lpx, lpy);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        if (showStarLabels) {
          ctx.font = '12px sans-serif';
          ctx.fillStyle = line.color.replace(/0\.4[58]/, '0.85');
          ctx.fillText(line.name, cx + line.label[0] * sc, cy + line.label[1] * sc);
        }
        ctx.restore();
      }
    }

    for (var ni = 0; ni < namedStars.length; ni++) {
      var ns = namedStars[ni];
      var nsx = cx + ns.ox * sc;
      var nsy = cy + ns.oy * sc;
      if (nsx < -20 || nsx > W + 20 || nsy < -20 || nsy > H + 20) continue;
      if (ns.isPleiades) {
        drawPleiadesCluster(nsx, nsy, ns.color);
      } else if (ns.isCluster) {
        drawCluster(nsx, nsy, ns.color);
      } else {
        ctx.beginPath();
        ctx.arc(nsx, nsy, 5, 0, Math.PI * 2);
        ctx.fillStyle = ns.color;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(nsx, nsy, 5, 0, Math.PI * 2);
        ctx.strokeStyle = ns.color + '66';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (showStarLabels) {
        ctx.font = '11px sans-serif';
        ctx.fillStyle = ns.color;
        ctx.fillText(ns.name, nsx + 8, nsy + 4);
      }
      starScreenPos.push({ x: nsx, y: nsy, item: ns });
    }

    var sunR = Math.max(16, 40 * sc);
    drawGlow(cx, cy, sunR, '#fdb813');
    ctx.beginPath();
    ctx.arc(cx, cy, sunR, 0, Math.PI * 2);
    var sunGrad = ctx.createRadialGradient(cx - sunR * 0.2, cy - sunR * 0.2, sunR * 0.1, cx, cy, sunR);
    sunGrad.addColorStop(0, '#fff5a0');
    sunGrad.addColorStop(0.5, '#fdb813');
    sunGrad.addColorStop(1, '#f57c00');
    ctx.fillStyle = sunGrad;
    ctx.fill();

    planetScreenPos.push({ x: cx, y: cy, item: { name: '太陽', type: '恒星', fact: '太陽系の中心恒星。直径は地球の約109倍、質量は太陽系全体の99.86%を占めます' } });

    var earthX = cx, earthY = cy;

    for (var pi = 0; pi < planets.length; pi++) {
      var pl = planets[pi];
      var ang = pl.angle + t / pl.period;
      var orbitScaled = pl.orbitR * sc;
      var px = cx + orbitScaled * Math.cos(ang);
      var py = cy + ORBIT_Y_SIGN * orbitScaled * Math.sin(ang);
      var pr = Math.max(3, pl.radius * sc * 1.4);

      if (pl.name === '地球') {
        earthX = px;
        earthY = py;
      }

      if (showOrbits) drawOrbit(cx, cy, orbitScaled);

      if (pl.hasRings) {
        drawRings(px, py, pr);
      }

      drawPlanet(px, py, pr, pl.color);

      if (pl.name === '木星') {
        ctx.save();
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.clip();
        ctx.strokeStyle = 'rgba(160,100,40,0.4)';
        ctx.lineWidth = 3;
        for (var band = -3; band <= 3; band++) {
          ctx.beginPath();
          ctx.moveTo(px - pr, py + band * (pr / 3));
          ctx.lineTo(px + pr, py + band * (pr / 3));
          ctx.stroke();
        }
        ctx.restore();
      }

      if (showPlanetLabels) {
        ctx.font = '11px sans-serif';
        ctx.fillStyle = '#c9d1d9';
        ctx.fillText(pl.jaName, px + pr + 4, py + 4);
      }

      planetScreenPos.push({ x: px, y: py, item: pl });
    }

    var moonOrbitScaled = moon.orbitR * sc;
    if (showOrbits) {
      ctx.save();
      ctx.setLineDash([3, 4]);
      drawOrbit(earthX, earthY, moonOrbitScaled);
      ctx.setLineDash([]);
      ctx.restore();
    }

    var moonAng = moon.angle + t / moon.period;
    var moonX = earthX + moonOrbitScaled * Math.cos(moonAng);
    var moonY = earthY + ORBIT_Y_SIGN * moonOrbitScaled * Math.sin(moonAng);
    var moonR = Math.max(2, moon.radius * sc * 1.4);
    drawPlanet(moonX, moonY, moonR, moon.color);
    planetScreenPos.push({ x: moonX, y: moonY, item: moon });

    if (showPlanetLabels) {
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#888';
      ctx.fillText('月', moonX + moonR + 3, moonY + 3);
    }

    var issOrbitScaled = iss.orbitR * sc;
    var issAng3 = iss.angle + t / iss.period;
    var issX = earthX + issOrbitScaled * Math.cos(issAng3);
    var issY = earthY + ORBIT_Y_SIGN * issOrbitScaled * Math.sin(issAng3);
    var issAlp2 = 0.5 + 0.5 * Math.sin(t * 25);
    ctx.strokeStyle = 'rgba(136,255,204,' + issAlp2.toFixed(2) + ')';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(issX - 4, issY); ctx.lineTo(issX + 4, issY);
    ctx.moveTo(issX, issY - 4); ctx.lineTo(issX, issY + 4);
    ctx.stroke();
    if (showPlanetLabels) {
      ctx.font = '9px sans-serif';
      ctx.fillStyle = 'rgba(136,255,204,0.85)';
      ctx.fillText('ISS', issX + 5, issY - 3);
    }
    planetScreenPos.push({ x: issX, y: issY, item: iss });

    if (showConstellations) {
      var sc2 = scale || 1;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(180,220,255,0.3)';
      var triIdx = [5, 6, 7];
      for (var tli = 0; tli < 3; tli++) {
        var ta = namedStars[triIdx[tli]], tb = namedStars[triIdx[(tli + 1) % 3]];
        ctx.beginPath();
        ctx.moveTo(cx + ta.ox * sc2, cy + ta.oy * sc2);
        ctx.lineTo(cx + tb.ox * sc2, cy + tb.oy * sc2);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(180,255,220,0.3)';
      for (var cliO = 0; cliO < cruxLines.length; cliO++) {
        var caO = namedStars[cruxLines[cliO][0]], cbO = namedStars[cruxLines[cliO][1]];
        ctx.beginPath();
        ctx.moveTo(cx + caO.ox * sc2, cy + caO.oy * sc2);
        ctx.lineTo(cx + cbO.ox * sc2, cy + cbO.oy * sc2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }

  requestAnimationFrame(frame);
})();
</script>
</body>
</html>`;
}
