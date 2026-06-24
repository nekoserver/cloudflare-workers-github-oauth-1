function escH(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function getWebGLHeritagePage(username: string): string {
  const safeUser = escH(username);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0d1117">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="世界遺産地球儀">
<link rel="manifest" href="/manifest.json">
<title>世界遺産 地球儀</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { background:#000; color:#e6edf3; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:13px; height:100vh; height:100dvh; display:flex; flex-direction:column; overflow:hidden; }
.topbar { background:#0d1117; border-bottom:1px solid #30363d; padding:8px 18px; display:flex; align-items:center; gap:10px; flex-shrink:0; }
.topbar a { color:#58a6ff; text-decoration:none; font-size:12px; }
h1 { font-size:14px; font-weight:700; }
.badge { background:#0c2d1a; color:#3fb950; font-size:10px; padding:2px 7px; border-radius:10px; font-weight:600; }
.body { display:grid; grid-template-columns:1fr 260px; grid-template-rows:1fr; flex:1; min-height:0; }
@media(max-width:800px){ .body{ grid-template-columns:1fr; } .side{ display:none; } }
.canvas-wrap { position:relative; background:#000010; overflow:hidden; }
canvas { position:absolute; inset:0; width:100%; height:100%; cursor:grab; touch-action:none; display:block; }
canvas:active { cursor:grabbing; }
.hud { position:absolute; bottom:10px; left:10px; background:rgba(0,0,0,.7); border:1px solid #30363d; border-radius:6px; padding:6px 10px; font-size:11px; font-family:monospace; color:#58a6ff; line-height:1.9; pointer-events:none; }
#markers { position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; overflow:hidden; }
.mk { position:absolute; transform:translate(-50%,-50%); line-height:1; font-size:16px; text-shadow:0 1px 3px #000,0 0 8px rgba(0,0,0,0.9); pointer-events:auto; cursor:pointer; user-select:none; -webkit-user-select:none; }
#mk-tooltip { position:fixed; background:rgba(13,17,23,0.97); border:1px solid #3fb950; border-radius:8px; padding:7px 12px; font-size:12px; color:#e6edf3; white-space:normal; min-width:180px; pointer-events:auto; opacity:0; transition:opacity .15s; z-index:60; transform:translate(-50%,-110%); line-height:1.7; }
.tt-name { white-space:nowrap; font-weight:700; font-size:13px; }
.tt-sub { white-space:nowrap; font-size:12px; margin-top:3px; }
#mk-tooltip.below { transform:translate(-50%, 14px); }
.side { background:#0d1117; border-left:1px solid #30363d; display:flex; flex-direction:column; overflow:hidden; }
.side-header { padding:10px 10px 8px; border-bottom:1px solid #21262d; flex-shrink:0; }
.side-title { font-size:10px; font-weight:700; color:#3fb950; text-transform:uppercase; letter-spacing:.5px; margin-bottom:6px; }
.search-wrap { position:relative; }
.search-wrap input { width:100%; background:#161b22; border:1px solid #30363d; border-radius:6px; padding:6px 10px 6px 28px; color:#e6edf3; font-size:12px; outline:none; }
.search-wrap input:focus { border-color:#3fb950; }
.search-wrap input::placeholder { color:#484f58; }
.search-icon { position:absolute; left:9px; top:50%; transform:translateY(-50%); color:#484f58; font-size:12px; pointer-events:none; }
#result-count { font-size:10px; color:#484f58; margin-top:5px; text-align:right; }
.list-scroll { flex:1; overflow-y:auto; overflow-x:hidden; }
.list-scroll::-webkit-scrollbar { width:4px; }
.list-scroll::-webkit-scrollbar-track { background:#0d1117; }
.list-scroll::-webkit-scrollbar-thumb { background:#30363d; border-radius:2px; }
.site-item { display:flex; align-items:center; gap:8px; padding:8px 10px; border-bottom:1px solid #161b22; cursor:pointer; transition:background .1s; border-left:3px solid transparent; }
.site-item:hover { background:#161b22; }
.site-item.active { background:rgba(255,240,30,0.09); border-left-color:#c8960a; }
.spd-row { padding:8px 10px 6px; border-bottom:1px solid #21262d; flex-shrink:0; }
.spd-row .ctrl-label { font-size:10px; font-weight:700; color:#3fb950; text-transform:uppercase; letter-spacing:.5px; margin-bottom:4px; }
.site-thumb { width:48px; height:36px; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0; border:1px solid #21262d; }
.site-body { flex:1; min-width:0; }
.site-top { display:flex; align-items:center; gap:4px; margin-bottom:2px; }
.site-flag { font-size:13px; flex-shrink:0; }
.site-name { font-size:11px; font-weight:600; color:#e6edf3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.site-meta { font-size:10px; color:#484f58; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.type-label { font-weight:600; }
.canvas-ctrl-btns { position:absolute; top:10px; right:10px; display:flex; flex-direction:row; gap:6px; z-index:5; }
.canvas-ctrl-btn { background:rgba(13,17,23,0.88); border:1px solid #30363d; border-radius:6px; color:#e6edf3; font-size:12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; padding:6px 12px; cursor:pointer; white-space:nowrap; transition:background .15s,border-color .15s,color .15s; }
.canvas-ctrl-btn:hover { background:rgba(13,17,23,1); border-color:#3fb950; }
.canvas-ctrl-btn.active { background:#0c2d1a; border-color:#3fb950; color:#3fb950; }
.dbg-rect { position:absolute; pointer-events:none; box-sizing:border-box; }
#dbg-globe-rect { border:1px dashed #3fb950; }
#dbg-zoom-rect { border:1px dashed #58a6ff; }
#dbg-info { position:absolute; bottom:10px; left:10px; background:rgba(0,0,0,.75); border:1px solid #21262d; border-radius:5px; padding:5px 9px; font-size:10px; font-family:monospace; color:#8b949e; line-height:1.7; pointer-events:none; z-index:6; }
.panel-tabs { display:flex; border-bottom:1px solid #21262d; flex-shrink:0; }
.panel-tab { flex:1; padding:8px 4px; font-size:11px; font-weight:600; color:#484f58; background:none; border:none; border-bottom:2px solid transparent; cursor:pointer; transition:color .15s,border-color .15s; }
.panel-tab:hover { color:#8b949e; }
.panel-tab.active { color:#3fb950; border-bottom-color:#3fb950; }
.panel-body { display:none; flex:1; flex-direction:column; overflow:hidden; }
.panel-body.visible { display:flex; }
.ctrl-panel { padding:14px 12px; display:flex; flex-direction:column; gap:14px; }
.ctrl-row { display:flex; flex-direction:column; gap:5px; }
.ctrl-label { font-size:11px; color:#8b949e; font-weight:600; }
.slider-row { display:flex; align-items:center; gap:8px; }
.slider-row input[type=range] { flex:1; accent-color:#3fb950; }
.sval { font-family:monospace; font-size:11px; color:#3fb950; min-width:36px; }
.ctrl-sep { border:none; border-top:1px solid #21262d; margin:0; }
.legend { display:flex; flex-direction:column; gap:7px; }
.legend-row { display:flex; align-items:center; gap:8px; font-size:12px; }
.legend-dot { font-size:16px; }
@media (display-mode: standalone) { .pwa-hide { display:none !important; } }
.tour-panel { display:none; flex-direction:column; flex:1; overflow:hidden; }
.tour-panel.visible { display:flex; }
.tour-panel-header { padding:8px 12px; background:#0d1117; border-bottom:1px solid #21262d; flex-shrink:0; display:flex; align-items:center; gap:8px; }
.tour-panel-title { font-size:12px; font-weight:700; color:#3fb950; flex:1; }
.tour-panel-count { font-size:11px; color:#484f58; }
.tour-list-scroll { flex:1; overflow-y:auto; }
.tour-item { display:flex; align-items:center; gap:10px; padding:8px 12px; border-bottom:1px solid #161b22; cursor:pointer; transition:background .12s; }
.tour-item:hover { background:#161b22; }
.tour-item.active { background:#0c2d1a; border-left:3px solid #3fb950; padding-left:9px; }
.tour-item-num { font-size:10px; color:#484f58; font-variant-numeric:tabular-nums; min-width:22px; text-align:right; flex-shrink:0; }
.tour-item-body { flex:1; min-width:0; }
.tour-item-name { font-size:11px; font-weight:600; color:#e6edf3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.tour-item-meta { font-size:10px; color:#484f58; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.tour-item.active .tour-item-name { color:#3fb950; }
.stats-tab { flex:1; padding:9px 4px; font-size:12px; font-weight:600; color:#484f58; background:none; border:none; border-bottom:2px solid transparent; cursor:pointer; transition:color .15s,border-color .15s; }
.stats-tab:hover { color:#8b949e; }
.stats-tab.active { color:#3fb950; border-bottom-color:#3fb950; }
.stats-bar-row { display:flex; align-items:center; gap:8px; margin-bottom:9px; font-size:12px; }
.stats-bar-label { width:160px; flex-shrink:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#e6edf3; }
.stats-bar-track { flex:1; height:12px; background:#161b22; border-radius:6px; overflow:hidden; }
.stats-bar-fill { height:100%; border-radius:6px; transition:width .4s; }
.stats-bar-num { width:56px; text-align:right; color:#8b949e; font-variant-numeric:tabular-nums; flex-shrink:0; }
.stats-section-title { font-size:11px; font-weight:700; color:#3fb950; text-transform:uppercase; letter-spacing:.5px; margin:12px 0 8px; }
.stats-type-card { display:flex; align-items:center; gap:12px; padding:10px 14px; background:#161b22; border-radius:8px; margin-bottom:8px; }
.stats-donut-wrap { position:relative; }
.stats-legend-list { display:flex; flex-direction:column; gap:7px; margin-top:4px; }
.stats-legend-item { display:flex; align-items:center; gap:7px; font-size:12px; }
.stats-legend-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
.landing-overlay { display:none; position:fixed; inset:0; z-index:150; pointer-events:none; align-items:center; justify-content:flex-end; padding:0 0 40px; flex-direction:column; }
.landing-overlay.active { display:flex; }
.landing-card { background:rgba(13,17,23,0.97); border:1px solid #3fb950; border-radius:12px; padding:18px 28px; text-align:center; pointer-events:auto; min-width:300px; box-shadow:0 4px 32px rgba(63,185,80,0.2); }
.landing-site-name { font-size:16px; font-weight:700; color:#e6edf3; margin-bottom:4px; }
.landing-site-sub { font-size:12px; color:#8b949e; margin-bottom:10px; }
.landing-status-txt { font-size:13px; color:#3fb950; margin-bottom:8px; font-weight:600; }
.landing-prog-track { width:100%; height:6px; background:#21262d; border-radius:3px; overflow:hidden; margin-bottom:16px; }
.landing-prog-fill { height:100%; background:linear-gradient(90deg,#3fb950,#58a6ff); border-radius:3px; width:0%; transition:width 0.15s linear; }
.landing-exit-btn { background:#161b22; border:1px solid #3fb950; border-radius:6px; color:#3fb950; font-size:13px; padding:7px 20px; cursor:pointer; font-family:inherit; }
.landing-exit-btn:hover { background:#0c2d1a; }
.landing-btn-row { display:flex; gap:6px; align-items:center; justify-content:center; }
.landing-spin-btn { background:#161b22; border:1px solid #30363d; border-radius:6px; color:#8b949e; font-size:11px; padding:6px 10px; cursor:pointer; font-family:inherit; white-space:nowrap; }
.landing-spin-btn.active { border-color:#3fb950; color:#3fb950; }
.landing-spin-btn:hover { border-color:#58a6ff; color:#58a6ff; }
.landing-city-list { font-size:10px; color:#8b949e; margin-top:8px; text-align:left; max-height:90px; overflow-y:auto; border-top:1px solid #21262d; padding-top:6px; }
.landing-city-item { display:flex; justify-content:space-between; gap:8px; padding:1px 0; color:#c9d1d9; }
.landing-city-dist { color:#58a6ff; flex-shrink:0; }
.landing-city-loading { color:#8b949e; text-align:center; padding:4px; }
.city-mk { position:absolute; transform:translate(-50%,-50%); background:rgba(13,17,23,0.92); border:1px solid #388bfd; border-radius:10px; color:#c9d1d9; font-size:9px; padding:2px 6px; white-space:nowrap; pointer-events:none; opacity:0; transition:opacity .3s; display:flex; align-items:center; gap:3px; }
.city-mk-dot { width:5px; height:5px; border-radius:50%; background:#388bfd; flex-shrink:0; }
</style>
</head>
<body>

<script id="vs" type="x-shader/x-vertex">
attribute vec3 aPos;
attribute vec3 aNorm;
attribute vec2 aUV;
uniform mat4 uMVP;
uniform mat4 uModel;
uniform vec3 uLight;
varying vec2 vUV;
varying float vDiff;
varying float vSpec;
varying float vRim;
void main() {
  vec3 wn = normalize((uModel * vec4(aNorm, 0.0)).xyz);
  vec3 wl = normalize(uLight);
  vDiff = max(dot(wn, wl), 0.0);
  vec3 toEye = normalize(vec3(0.0, 0.0, 1.0));
  vec3 halfv = normalize(wl + toEye);
  vSpec = pow(max(dot(wn, halfv), 0.0), 64.0);
  vRim  = pow(1.0 - abs(dot(wn, toEye)), 3.0);
  vUV = aUV;
  gl_Position = uMVP * vec4(aPos, 1.0);
}
</script>

<script id="fs" type="x-shader/x-fragment">
precision mediump float;
uniform sampler2D uTex;
varying vec2 vUV;
varying float vDiff;
varying float vSpec;
varying float vRim;
void main() {
  vec4 earth = texture2D(uTex, vUV);
  float isOcean = clamp((earth.b - earth.r * 0.8 - earth.g * 0.3) * 3.0, 0.0, 1.0);
  vec3 oceanColor = vec3(0.05, 0.18, 0.52);
  vec3 baseColor = mix(earth.rgb, oceanColor, isOcean);
  float amb = 0.25;
  vec3 col = baseColor * (amb + vDiff * (1.0 - amb));
  col += vec3(0.5, 0.8, 1.0) * vSpec * isOcean * 0.7;
  col += vec3(0.25, 0.55, 1.0) * vRim * 0.5;
  col += vec3(0.1,  0.3,  0.9) * vRim * vRim * 0.25;
  gl_FragColor = vec4(col, 1.0);
}
</script>

<div class="topbar">
  <h1>世界遺産 地球儀</h1>
  <span class="badge">世界遺産</span>
  <span style="flex:1"></span>
  <a href="/webgl-sphere" class="pwa-hide">&#9917; W杯</a>
  <a href="/webgl-lv-sphere" class="pwa-hide">🔮 LV Sphere</a>
  <a href="/settings" class="pwa-hide">&#9881;</a>
  <span class="pwa-hide" style="color:#8b949e;font-size:11px">${safeUser}</span>
</div>

<div class="body">
  <div class="canvas-wrap">
    <canvas id="c"></canvas>
    <div id="markers"></div>
    <div class="hud" id="hud">テクスチャ読み込み中...</div>
    <div id="dbg-info"></div>
    <div class="dbg-rect" id="dbg-globe-rect"></div>
    <div class="dbg-rect" id="dbg-zoom-rect"></div>
    <div class="canvas-ctrl-btns">
      <button class="canvas-ctrl-btn" id="btnAxisLock">＋ 軸垂直固定</button>
      <button class="canvas-ctrl-btn" id="btnAutoRot">⏸ 自転停止</button>
      <button class="canvas-ctrl-btn" id="btnJapanTour">🗾 日本巡回</button>
      <button class="canvas-ctrl-btn" id="btnAmericaTour">🌎 アメリカ巡回</button>
      <button class="canvas-ctrl-btn" id="btnEuropeTour">🏰 ヨーロッパ巡回</button>
      <button class="canvas-ctrl-btn" id="btnAfricaTour">🌍 アフリカ巡回</button>
      <button class="canvas-ctrl-btn" id="btnStats">📊 内訳</button>
    </div>
  </div>
  <div class="side">
    <div class="panel-tabs">
      <button class="panel-tab active" id="tabList">▼ 近接リスト</button>
      <button class="panel-tab" id="tabCtrl">⚙ コントロール</button>
    </div>

    <div class="panel-body visible" id="panelList">
      <div class="spd-row">
        <div class="ctrl-label">自転速度</div>
        <div class="slider-row">
          <input type="range" id="rotSpd" min="0" max="5" step="0.1" value="1">
          <span class="sval" id="rotSpdVal">1.0</span>
        </div>
      </div>
      <div class="side-header">
        <div class="search-wrap">
          <span class="search-icon">🔍</span>
          <input type="search" id="searchInput" placeholder="遺産名・国・種別で検索...">
        </div>
        <div id="result-count"></div>
      </div>
      <div class="list-scroll" id="siteList"></div>
      <div class="tour-panel" id="tourPanel">
        <div class="tour-panel-header">
          <span class="tour-panel-title" id="tourPanelTitle">巡回リスト</span>
          <span class="tour-panel-count" id="tourPanelCount"></span>
        </div>
        <div class="tour-list-scroll" id="tourListScroll"></div>
      </div>
    </div>

    <div class="panel-body" id="panelCtrl">
      <div class="ctrl-panel">
        <div class="ctrl-row">
          <div class="ctrl-label">スピンブースト</div>
          <div class="slider-row">
            <input type="range" id="spinBoost" min="1" max="4" step="0.1" value="2">
            <span class="sval" id="spinBoostVal">2.0</span>
          </div>
        </div>
        <hr class="ctrl-sep">
        <div class="ctrl-row">
          <div class="ctrl-label">凡例</div>
          <div class="legend">
            <div class="legend-row"><span class="legend-dot">🏛️</span><span style="color:#e3a838;font-weight:600">文化遺産</span></div>
            <div class="legend-row"><span class="legend-dot">🌿</span><span style="color:#3fb950;font-weight:600">自然遺産</span></div>
            <div class="legend-row"><span class="legend-dot">⭐</span><span style="color:#a371f7;font-weight:600">複合遺産</span></div>
          </div>
        </div>
        <hr class="ctrl-sep">
        <div style="font-size:11px;color:#484f58;line-height:1.7">
          ドラッグ: 回転<br>
          ホイール: ズーム<br>
          フリック: 慣性スピン → 最寄り遺産スナップ<br>
          ダブルクリック: 自動回転 ON/OFF
        </div>
      </div>
    </div>
  </div>
</div>

<div id="mk-tooltip"></div>

<div class="landing-overlay" id="landing-overlay">
  <div class="landing-card">
    <div class="landing-site-name" id="landing-title"></div>
    <div class="landing-site-sub" id="landing-sub"></div>
    <div class="landing-status-txt" id="landing-status">着陸中...</div>
    <div class="landing-prog-track"><div class="landing-prog-fill" id="landing-prog"></div></div>
    <div class="landing-btn-row">
      <button class="landing-exit-btn" id="landing-exit">🚀 宇宙に戻る</button>
      <button class="landing-spin-btn" id="landing-spin-toggle">🔄 360°スイープ</button>
    </div>
    <div class="landing-city-list" id="landing-city-list"></div>
  </div>
</div>

<div id="city-markers-div" style="position:absolute;inset:0;pointer-events:none;display:none;overflow:hidden;"></div>

<div id="stats-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:200;align-items:center;justify-content:center;">
  <div id="stats-modal" style="background:#0d1117;border:1px solid #30363d;border-radius:10px;width:min(92vw,680px);max-height:86vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.8);">
    <div style="padding:14px 18px;border-bottom:1px solid #21262d;display:flex;align-items:center;gap:10px;flex-shrink:0;">
      <span style="font-size:15px;font-weight:700;">📊 世界遺産 内訳統計</span>
      <span id="stats-total-badge" style="background:#0c2d1a;color:#3fb950;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600;"></span>
      <span style="flex:1"></span>
      <button id="btnStatsClose" style="background:none;border:none;color:#8b949e;font-size:18px;cursor:pointer;line-height:1;padding:2px 6px;">✕</button>
    </div>
    <div style="display:flex;border-bottom:1px solid #21262d;flex-shrink:0;">
      <button class="stats-tab active" data-tab="region">🌐 地域別</button>
      <button class="stats-tab" data-tab="country">🏳️ 国別 Top30</button>
      <button class="stats-tab" data-tab="type">🏷️ 種別</button>
      <button class="stats-tab" data-tab="decade">📅 登録年代</button>
    </div>
    <div id="stats-body" style="flex:1;overflow-y:auto;padding:16px 18px;"></div>
  </div>
</div>

<script>
(function() {
  var canvas = document.getElementById('c');
  var wrap   = canvas.parentElement;
  var hud         = document.getElementById('hud');
  var dbgInfo     = document.getElementById('dbg-info');
  var dbgGlobeRect = document.getElementById('dbg-globe-rect');
  var dbgZoomRect  = document.getElementById('dbg-zoom-rect');
  var markersDiv = document.getElementById('markers');
  var siteList = document.getElementById('siteList');
  var searchInput = document.getElementById('searchInput');
  var resultCount = document.getElementById('result-count');
  var tourPanel = document.getElementById('tourPanel');
  var tourListScroll = document.getElementById('tourListScroll');
  var tourPanelTitle = document.getElementById('tourPanelTitle');
  var tourPanelCount = document.getElementById('tourPanelCount');
  var tabList = document.getElementById('tabList');
  var tabCtrl = document.getElementById('tabCtrl');
  var panelList = document.getElementById('panelList');
  var panelCtrl = document.getElementById('panelCtrl');
  var rotSpdEl = document.getElementById('rotSpd');
  var rotSpdValEl = document.getElementById('rotSpdVal');
  var spinBoostEl = document.getElementById('spinBoost');
  var spinBoostValEl = document.getElementById('spinBoostVal');
  var btnAmericaTour = document.getElementById('btnAmericaTour');

  var isListMode = true;

  tabList.addEventListener('click', function() {
    isListMode = true;
    tabList.classList.add('active'); tabCtrl.classList.remove('active');
    panelList.classList.add('visible'); panelCtrl.classList.remove('visible');
  });
  tabCtrl.addEventListener('click', function() {
    isListMode = false;
    tabCtrl.classList.add('active'); tabList.classList.remove('active');
    panelCtrl.classList.add('visible'); panelList.classList.remove('visible');
  });
  rotSpdEl.addEventListener('input', function() { rotSpdValEl.textContent = parseFloat(rotSpdEl.value).toFixed(1); });
  spinBoostEl.addEventListener('input', function() {
    SPIN_BOOST = parseFloat(spinBoostEl.value);
    spinBoostValEl.textContent = SPIN_BOOST.toFixed(1);
  });

  function resize() {
    var r = wrap.getBoundingClientRect();
    var w = Math.round(r.width), h = Math.round(r.height);
    if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
      canvas.width = w; canvas.height = h;
    }
  }
  resize();
  window.addEventListener('resize', resize);

  var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) { hud.textContent = 'WebGL が利用できません'; return; }

  function compileShader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  var prog = gl.createProgram();
  gl.attachShader(prog, compileShader(gl.VERTEX_SHADER,   document.getElementById('vs').textContent));
  gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, document.getElementById('fs').textContent));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  var LAT = 64, LON = 128;
  var verts = [], idxs = [];
  for (var i = 0; i <= LAT; i++) {
    var theta = i / LAT * Math.PI;
    var sinT = Math.sin(theta), cosT = Math.cos(theta);
    for (var j = 0; j <= LON; j++) {
      var phi = j / LON * 2 * Math.PI;
      var x = -sinT * Math.cos(phi), y = cosT, z = sinT * Math.sin(phi);
      verts.push(x, y, z, x, y, z, j / LON, i / LAT);
    }
  }
  for (var i = 0; i < LAT; i++) {
    for (var j = 0; j < LON; j++) {
      var a = i * (LON + 1) + j, b = a + (LON + 1);
      idxs.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  var vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
  var ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idxs), gl.STATIC_DRAW);

  var stride = 8 * 4;
  var aPos  = gl.getAttribLocation(prog, 'aPos');
  var aNorm = gl.getAttribLocation(prog, 'aNorm');
  var aUV   = gl.getAttribLocation(prog, 'aUV');
  gl.enableVertexAttribArray(aPos);  gl.vertexAttribPointer(aPos,  3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(aNorm); gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, stride, 12);
  gl.enableVertexAttribArray(aUV);   gl.vertexAttribPointer(aUV,   2, gl.FLOAT, false, stride, 24);

  var uMVP   = gl.getUniformLocation(prog, 'uMVP');
  var uModel = gl.getUniformLocation(prog, 'uModel');
  var uLight = gl.getUniformLocation(prog, 'uLight');
  var uTex   = gl.getUniformLocation(prog, 'uTex');
  gl.uniform1i(uTex, 0);

  function getSunDir() {
    var now = new Date();
    var utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    var sunLon = (utcH - 12) / 24 * 2 * Math.PI;
    var start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    var doy = Math.floor((now.getTime() - start.getTime()) / 86400000);
    var sunLat = 23.45 * Math.PI / 180 * Math.sin(2 * Math.PI * (doy - 80) / 365);
    return [Math.cos(sunLat) * Math.cos(sunLon), Math.sin(sunLat), Math.cos(sunLat) * Math.sin(sunLon)];
  }

  var texEarth = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texEarth);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([10, 30, 70, 255]));
  var earthImg = new Image();
  earthImg.onload = function() {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texEarth);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, earthImg);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  };
  earthImg.onerror = function() { hud.textContent = 'テクスチャ読み込み失敗'; };
  earthImg.src = '/earth.jpg';

  function m4()      { return new Float32Array(16); }
  function ident(m)  { for(var i=0;i<16;i++) m[i]=0; m[0]=m[5]=m[10]=m[15]=1; return m; }
  function mul(o,a,b){ for(var i=0;i<4;i++) for(var j=0;j<4;j++){ var s=0; for(var k=0;k<4;k++) s+=a[i+k*4]*b[k+j*4]; o[i+j*4]=s; } return o; }
  function persp(m,fov,asp,near,far){ ident(m); var f=1/Math.tan(fov/2); m[0]=f/asp; m[5]=f; m[10]=(far+near)/(near-far); m[11]=-1; m[14]=2*far*near/(near-far); m[15]=0; return m; }
  function rotX(m,r){ ident(m); var c=Math.cos(r),s=Math.sin(r); m[5]=c;m[6]=s;m[9]=-s;m[10]=c; return m; }
  function rotY(m,r){ ident(m); var c=Math.cos(r),s=Math.sin(r); m[0]=c;m[2]=-s;m[8]=s;m[10]=c; return m; }
  function rotZ(m,r){ ident(m); var c=Math.cos(r),s=Math.sin(r); m[0]=c;m[1]=s;m[4]=-s;m[5]=c; return m; }
  function rotAround(m,ax,ay,az,angle){ ident(m); var c=Math.cos(angle),s=Math.sin(angle),t=1-c; m[0]=t*ax*ax+c; m[4]=t*ax*ay-s*az; m[8]=t*ax*az+s*ay; m[1]=t*ax*ay+s*az; m[5]=t*ay*ay+c; m[9]=t*ay*az-s*ax; m[2]=t*ax*az-s*ay; m[6]=t*ay*az+s*ax; m[10]=t*az*az+c; return m; }
  function trans(m,x,y,z){ ident(m); m[12]=x;m[13]=y;m[14]=z; return m; }

  var axialTilt = -23.4 * Math.PI / 180;
  var ELEV_MAX = Math.PI / 2 - 0.02;
  function clampElev(v){ return v < -ELEV_MAX ? -ELEV_MAX : (v > ELEV_MAX ? ELEV_MAX : v); }

  var proj=m4(),view=m4(),model=m4(),rx=m4(),ry=m4(),tz=m4(),tmp=m4(),tmp2=m4(),mvp=m4(),landSpin=m4();
  var landingSpinAngle = 0;
  var rotXv = 0.3, rotYv = 0.6, zoom = 3.2, autoRot = true;
  var drag = false, lx = 0, ly = 0, pinch0 = 0, touchMoved = false;
  var axisLocked = false;

  var btnAxisLock = document.getElementById('btnAxisLock');
  var btnAutoRot  = document.getElementById('btnAutoRot');

  btnAxisLock.addEventListener('click', function() {
    axisLocked = !axisLocked;
    if (axisLocked) { rotXv = 0; btnAxisLock.classList.add('active'); btnAxisLock.textContent = '＋ 軸固定中'; }
    else { btnAxisLock.classList.remove('active'); btnAxisLock.textContent = '＋ 軸垂直固定'; }
  });
  btnAutoRot.addEventListener('click', function() {
    autoRot = !autoRot;
    btnAutoRot.textContent = autoRot ? '⏸ 自転停止' : '▶ 回転';
    if (autoRot) { btnAutoRot.classList.remove('active'); } else { btnAutoRot.classList.add('active'); }
  });

  var velY = 0, velX = 0, momentumY = 0, momentumX = 0;
  var MOMENTUM_DECAY = 0.94;
  var SPIN_BOOST = 2.0;
  var rotSpd = 1.0;

  function applyMomentum(vy, vx) {
    momentumY = vy * SPIN_BOOST;
    momentumX = axisLocked ? 0 : (vx * SPIN_BOOST);
  }

  canvas.addEventListener('mousedown',  function(e){ drag=true; lx=e.clientX; ly=e.clientY; momentumY=0; momentumX=0; velY=0; velX=0; });
  window.addEventListener('mouseup',    function(){ if(!drag)return; drag=false; applyMomentum(velY, velX); velY=0; velX=0; });
  window.addEventListener('mousemove',  function(e){ if(!drag)return; var dy=(e.clientX-lx)*0.008; var dx=(e.clientY-ly)*0.008; rotYv+=dy; velY=velY*0.4+dy*0.6; if(!axisLocked){rotXv=clampElev(rotXv+dx); velX=velX*0.4+dx*0.6;} lx=e.clientX; ly=e.clientY; });
  canvas.addEventListener('wheel',      function(e){ e.preventDefault(); zoom=Math.max(1.2,Math.min(10,zoom+e.deltaY*0.01)); },{passive:false});
  canvas.addEventListener('dblclick',   function(){ autoRot=!autoRot; btnAutoRot.textContent=autoRot?'⏸ 自転停止':'▶ 回転'; if(autoRot){btnAutoRot.classList.remove('active');}else{btnAutoRot.classList.add('active');} });
  canvas.addEventListener('touchstart', function(e){ e.preventDefault(); touchMoved=false; momentumY=0; momentumX=0; velY=0; velX=0; if(e.touches.length===1){drag=true;lx=e.touches[0].clientX;ly=e.touches[0].clientY;} if(e.touches.length===2){pinch0=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);} },{passive:false});
  canvas.addEventListener('touchmove',  function(e){ e.preventDefault(); touchMoved=true; if(e.touches.length===1&&drag){var dy=(e.touches[0].clientX-lx)*0.008; var dx=(e.touches[0].clientY-ly)*0.008; rotYv+=dy; velY=velY*0.4+dy*0.6; if(!axisLocked){rotXv=clampElev(rotXv+dx); velX=velX*0.4+dx*0.6;} lx=e.touches[0].clientX;ly=e.touches[0].clientY;} if(e.touches.length===2){var d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);zoom=Math.max(1.2,Math.min(10,zoom-(d-pinch0)*0.02));pinch0=d;} },{passive:false});
  canvas.addEventListener('touchend', function(e){
    drag=false;
    applyMomentum(velY, velX); velY=0; velX=0;
    if (!touchMoved && e.changedTouches.length === 1) { momentumY=0; momentumX=0; hideTooltip(); }
  });

  var HERITAGE = [
    {e:'🏛️',f:'🇨🇳',n:'万里の長城',c:'中国',t:'文化遺産',y:1987,lat:40.4,lon:116.6},
    {e:'🏛️',f:'🇨🇳',n:'故宮（北京）',c:'中国',t:'文化遺産',y:1987,lat:39.9,lon:116.4},
    {e:'🏛️',f:'🇨🇳',n:'兵馬俑',c:'中国',t:'文化遺産',y:1987,lat:34.4,lon:109.3},
    {e:'🏛️',f:'🇮🇳',n:'タージ・マハル',c:'インド',t:'文化遺産',y:1983,lat:27.2,lon:78.0},
    {e:'🏛️',f:'🇬🇷',n:'アクロポリス（アテネ）',c:'ギリシャ',t:'文化遺産',y:1987,lat:37.97,lon:23.73},
    {e:'🏛️',f:'🇮🇹',n:'ローマ歴史地区',c:'イタリア',t:'文化遺産',y:1980,lat:41.89,lon:12.49},
    {e:'🏛️',f:'🇪🇬',n:'ギザのピラミッド',c:'エジプト',t:'文化遺産',y:1979,lat:29.98,lon:31.13},
    {e:'🏛️',f:'🇯🇴',n:'ペトラ',c:'ヨルダン',t:'文化遺産',y:1985,lat:30.33,lon:35.44},
    {e:'🏛️',f:'🇵🇪',n:'マチュ・ピチュ',c:'ペルー',t:'文化遺産',y:1983,lat:-13.16,lon:-72.54},
    {e:'🏛️',f:'🇲🇽',n:'チチェン・イッツァ',c:'メキシコ',t:'文化遺産',y:1988,lat:20.68,lon:-88.57},
    {e:'🏛️',f:'🇮🇩',n:'ボロブドゥール',c:'インドネシア',t:'文化遺産',y:1991,lat:-7.61,lon:110.20},
    {e:'🏛️',f:'🇰🇭',n:'アンコール遺跡群',c:'カンボジア',t:'文化遺産',y:1992,lat:13.41,lon:103.87},
    {e:'🏛️',f:'🇬🇧',n:'ストーンヘンジ',c:'英国',t:'文化遺産',y:1986,lat:51.18,lon:-1.83},
    {e:'🏛️',f:'🇮🇷',n:'ペルセポリス',c:'イラン',t:'文化遺産',y:1979,lat:29.94,lon:52.89},
    {e:'🏛️',f:'🇫🇷',n:'ヴェルサイユ宮殿と庭園',c:'フランス',t:'文化遺産',y:1979,lat:48.81,lon:2.12},
    {e:'🏛️',f:'🇫🇷',n:'モン・サン＝ミシェル',c:'フランス',t:'文化遺産',y:1979,lat:48.64,lon:-1.51},
    {e:'🏛️',f:'🇪🇸',n:'アルハンブラ宮殿',c:'スペイン',t:'文化遺産',y:1984,lat:37.18,lon:-3.59},
    {e:'🏛️',f:'🇪🇸',n:'バルセロナのガウディ建築群',c:'スペイン',t:'文化遺産',y:1984,lat:41.41,lon:2.17},
    {e:'🏛️',f:'🇭🇷',n:'ドゥブロヴニク旧市街',c:'クロアチア',t:'文化遺産',y:1979,lat:42.65,lon:18.09},
    {e:'🏛️',f:'🇨🇿',n:'プラハ歴史地区',c:'チェコ',t:'文化遺産',y:1992,lat:50.09,lon:14.42},
    {e:'🏛️',f:'🇵🇱',n:'クラクフ歴史地区',c:'ポーランド',t:'文化遺産',y:1978,lat:50.06,lon:19.94},
    {e:'🏛️',f:'🇷🇺',n:'サンクトペテルブルク',c:'ロシア',t:'文化遺産',y:1990,lat:59.95,lon:30.32},
    {e:'🏛️',f:'🇹🇷',n:'イスタンブール歴史地区',c:'トルコ',t:'文化遺産',y:1985,lat:41.01,lon:28.98},
    {e:'🏛️',f:'🇺🇿',n:'サマルカンド',c:'ウズベキスタン',t:'文化遺産',y:2001,lat:39.65,lon:66.97},
    {e:'🏛️',f:'🇪🇬',n:'ルクソール（古代テーベ）',c:'エジプト',t:'文化遺産',y:1979,lat:25.69,lon:32.63},
    {e:'🏛️',f:'🇬🇹',n:'ティカル',c:'グアテマラ',t:'文化遺産',y:1979,lat:17.22,lon:-89.62},
    {e:'🏛️',f:'🇮🇹',n:'ポンペイ遺跡',c:'イタリア',t:'文化遺産',y:1997,lat:40.75,lon:14.49},
    {e:'🏛️',f:'🇪🇹',n:'アクスム',c:'エチオピア',t:'文化遺産',y:1980,lat:14.13,lon:38.72},
    {e:'🏛️',f:'🇿🇼',n:'グレート・ジンバブエ',c:'ジンバブエ',t:'文化遺産',y:1986,lat:-20.27,lon:30.93},
    {e:'🏛️',f:'🇯🇵',n:'日光の社寺',c:'日本',t:'文化遺産',y:1999,lat:36.76,lon:139.60},
    {e:'🏛️',f:'🇯🇵',n:'白川郷・五箇山の合掌造り集落',c:'日本',t:'文化遺産',y:1995,lat:36.26,lon:136.91},
    {e:'🏛️',f:'🇯🇵',n:'厳島神社',c:'日本',t:'文化遺産',y:1996,lat:34.30,lon:132.32},
    {e:'🏛️',f:'🇯🇵',n:'法隆寺地域の仏教建造物群',c:'日本',t:'文化遺産',y:1993,lat:34.61,lon:135.74},
    {e:'🏛️',f:'🇯🇵',n:'原爆ドーム',c:'日本',t:'文化遺産',y:1996,lat:34.40,lon:132.45},
    {e:'🏛️',f:'🇯🇵',n:'古都京都の文化財',c:'日本',t:'文化遺産',y:1994,lat:35.01,lon:135.77},
    {e:'🏛️',f:'🇯🇵',n:'古都奈良の文化財',c:'日本',t:'文化遺産',y:1998,lat:34.69,lon:135.84},
    {e:'🏛️',f:'🇯🇵',n:'琉球王国のグスク及び関連遺産群',c:'日本',t:'文化遺産',y:2000,lat:26.21,lon:127.72},
    {e:'🏛️',f:'🇨🇴',n:'カルタヘナの港、要塞、建造物群',c:'コロンビア',t:'文化遺産',y:1984,lat:10.42,lon:-75.54},
    {e:'🏛️',f:'🇨🇺',n:'オールド・ハバナと要塞',c:'キューバ',t:'文化遺産',y:1982,lat:23.14,lon:-82.36},
    {e:'🌿',f:'🇺🇸',n:'グランドキャニオン国立公園',c:'アメリカ',t:'自然遺産',y:1979,lat:36.10,lon:-112.11},
    {e:'🌿',f:'🇺🇸',n:'イエローストーン国立公園',c:'アメリカ',t:'自然遺産',y:1978,lat:44.43,lon:-110.59},
    {e:'🌿',f:'🇪🇨',n:'ガラパゴス諸島',c:'エクアドル',t:'自然遺産',y:1978,lat:-0.53,lon:-90.43},
    {e:'🌿',f:'🇦🇺',n:'グレート・バリア・リーフ',c:'オーストラリア',t:'自然遺産',y:1981,lat:-18.29,lon:147.70},
    {e:'🌿',f:'🇹🇿',n:'セレンゲティ国立公園',c:'タンザニア',t:'自然遺産',y:1981,lat:-2.33,lon:34.83},
    {e:'🌿',f:'🇿🇼',n:'ビクトリア滝',c:'ジンバブエ/ザンビア',t:'自然遺産',y:1989,lat:-17.92,lon:25.86},
    {e:'🌿',f:'🇦🇷',n:'イグアスの滝',c:'アルゼンチン/ブラジル',t:'自然遺産',y:1984,lat:-25.69,lon:-54.44},
    {e:'🌿',f:'🇳🇴',n:'フィヨルド（西ノルウェー）',c:'ノルウェー',t:'自然遺産',y:2005,lat:60.63,lon:6.61},
    {e:'🌿',f:'🇳🇵',n:'サガルマータ国立公園（エベレスト）',c:'ネパール',t:'自然遺産',y:1979,lat:27.99,lon:86.93},
    {e:'🌿',f:'🇷🇺',n:'バイカル湖',c:'ロシア',t:'自然遺産',y:1996,lat:53.50,lon:107.99},
    {e:'🌿',f:'🇮🇩',n:'コモド国立公園',c:'インドネシア',t:'自然遺産',y:1991,lat:-8.55,lon:119.48},
    {e:'🌿',f:'🇹🇿',n:'キリマンジャロ国立公園',c:'タンザニア',t:'自然遺産',y:1987,lat:-3.07,lon:37.35},
    {e:'🌿',f:'🇯🇵',n:'屋久島',c:'日本',t:'自然遺産',y:1993,lat:30.34,lon:130.53},
    {e:'🌿',f:'🇯🇵',n:'知床',c:'日本',t:'自然遺産',y:2005,lat:44.07,lon:145.08},
    {e:'🌿',f:'🇯🇵',n:'小笠原諸島',c:'日本',t:'自然遺産',y:2011,lat:27.05,lon:142.22},
    {e:'🌿',f:'🇯🇵',n:'奄美大島・徳之島・西表島',c:'日本',t:'自然遺産',y:2021,lat:28.38,lon:129.50},
    {e:'🏛️',f:'🇯🇵',n:'姫路城',c:'日本',t:'文化遺産',y:1993,lat:34.84,lon:134.69},
    {e:'🌿',f:'🇯🇵',n:'白神山地',c:'日本',t:'自然遺産',y:1993,lat:40.47,lon:140.12},
    {e:'🏛️',f:'🇯🇵',n:'紀伊山地の霊場と参詣道',c:'日本',t:'文化遺産',y:2004,lat:34.17,lon:135.60},
    {e:'🏛️',f:'🇯🇵',n:'石見銀山遺跡とその文化的景観',c:'日本',t:'文化遺産',y:2007,lat:35.10,lon:132.43},
    {e:'🏛️',f:'🇯🇵',n:'平泉',c:'日本',t:'文化遺産',y:2011,lat:38.99,lon:141.11},
    {e:'🏛️',f:'🇯🇵',n:'富士山',c:'日本',t:'文化遺産',y:2013,lat:35.36,lon:138.73},
    {e:'🏛️',f:'🇯🇵',n:'富岡製糸場と絹産業遺産群',c:'日本',t:'文化遺産',y:2014,lat:36.26,lon:138.89},
    {e:'🏛️',f:'🇯🇵',n:'明治日本の産業革命遺産',c:'日本',t:'文化遺産',y:2015,lat:33.88,lon:130.87},
    {e:'🏛️',f:'🇯🇵',n:'ル・コルビュジエの建築作品（国立西洋美術館）',c:'日本',t:'文化遺産',y:2016,lat:35.71,lon:139.77},
    {e:'🏛️',f:'🇯🇵',n:'「神宿る島」宗像・沖ノ島と関連遺産群',c:'日本',t:'文化遺産',y:2017,lat:34.25,lon:130.10},
    {e:'🏛️',f:'🇯🇵',n:'長崎と天草地方の潜伏キリシタン関連遺産',c:'日本',t:'文化遺産',y:2018,lat:32.76,lon:130.08},
    {e:'🏛️',f:'🇯🇵',n:'百舌鳥・古市古墳群',c:'日本',t:'文化遺産',y:2019,lat:34.56,lon:135.50},
    {e:'🏛️',f:'🇯🇵',n:'北海道・北東北の縄文遺跡群',c:'日本',t:'文化遺産',y:2021,lat:41.50,lon:140.85},
    {e:'🏛️',f:'🇯🇵',n:'佐渡島の金山',c:'日本',t:'文化遺産',y:2024,lat:38.06,lon:138.52},
    {e:'🌿',f:'🇻🇳',n:'ハ・ロン湾',c:'ベトナム',t:'自然遺産',y:1994,lat:20.91,lon:107.18},
    {e:'🌿',f:'🇨🇦',n:'カナディアン・ロッキー',c:'カナダ',t:'自然遺産',y:1984,lat:51.50,lon:-116.16},
    {e:'🌿',f:'🇦🇷',n:'ロス・グラシアレス国立公園',c:'アルゼンチン',t:'自然遺産',y:1981,lat:-50.59,lon:-73.09},
    {e:'🌿',f:'🇹🇿',n:'ンゴロンゴロ保全地域',c:'タンザニア',t:'自然遺産',y:1979,lat:-3.18,lon:35.58},
    {e:'🌿',f:'🇦🇺',n:'カカドゥ国立公園',c:'オーストラリア',t:'自然遺産',y:1981,lat:-12.87,lon:132.56},
    {e:'🌿',f:'🇧🇷',n:'中央アマゾン保全地域群',c:'ブラジル',t:'自然遺産',y:2000,lat:-2.50,lon:-60.50},
    {e:'⭐',f:'🇦🇺',n:'ウルル・カタ・ジュタ国立公園',c:'オーストラリア',t:'複合遺産',y:1987,lat:-25.36,lon:131.03},
    {e:'⭐',f:'🇳🇿',n:'トンガリロ国立公園',c:'ニュージーランド',t:'複合遺産',y:1990,lat:-39.18,lon:175.63},
    {e:'⭐',f:'🇨🇳',n:'泰山',c:'中国',t:'複合遺産',y:1987,lat:36.27,lon:117.10},
    {e:'⭐',f:'🇨🇳',n:'黄山',c:'中国',t:'複合遺産',y:1990,lat:30.13,lon:118.16},
    {e:'🏛️',f:'🇩🇪',n:'ケルン大聖堂',c:'ドイツ',t:'文化遺産',y:1996,lat:50.94,lon:6.96},
    {e:'🏛️',f:'🇲🇦',n:'フェズ旧市街',c:'モロッコ',t:'文化遺産',y:1981,lat:34.06,lon:-4.98},
    {e:'🏛️',f:'🇰🇷',n:'慶州歴史地域',c:'韓国',t:'文化遺産',y:2000,lat:35.84,lon:129.21},
    {e:'🏛️',f:'🇸🇦',n:'ヘグラ（マダイン・サーレハ）',c:'サウジアラビア',t:'文化遺産',y:2008,lat:26.79,lon:37.95},
    {e:'🏛️',f:'🇲🇱',n:'ティンブクトゥ',c:'マリ',t:'文化遺産',y:1988,lat:16.77,lon:-3.01},
    {e:'🏛️',f:'🇱🇧',n:'バールベック',c:'レバノン',t:'文化遺産',y:1984,lat:34.00,lon:36.21},
    {e:'🏛️',f:'🇵🇹',n:'ポルト歴史地区',c:'ポルトガル',t:'文化遺産',y:1996,lat:41.14,lon:-8.61},
    {e:'🏛️',f:'🇲🇲',n:'バガン',c:'ミャンマー',t:'文化遺産',y:2019,lat:21.17,lon:94.86},
    {e:'🏛️',f:'🇵🇰',n:'モヘンジョダロ',c:'パキスタン',t:'文化遺産',y:1980,lat:27.33,lon:68.14},
    {e:'🏛️',f:'🇿🇦',n:'ロベン島',c:'南アフリカ',t:'文化遺産',y:1999,lat:-33.81,lon:18.37},
    {e:'🏛️',f:'🇰🇪',n:'ラム旧市街',c:'ケニア',t:'文化遺産',y:2001,lat:-2.27,lon:40.90},
    {e:'🏛️',f:'🇸🇳',n:'ゴレ島',c:'セネガル',t:'文化遺産',y:1978,lat:14.67,lon:-17.40},
    {e:'🏛️',f:'🇦🇹',n:'ウィーン歴史地区',c:'オーストリア',t:'文化遺産',y:2001,lat:48.21,lon:16.37},
    {e:'🏛️',f:'🇵🇭',n:'コルディリェーラの棚田群',c:'フィリピン',t:'文化遺産',y:1995,lat:16.92,lon:121.09},
    {e:'🏛️',f:'🇺🇾',n:'コロニア・デル・サクラメント',c:'ウルグアイ',t:'文化遺産',y:1995,lat:-34.47,lon:-57.84},
    {e:'⭐',f:'🇲🇳',n:'オルホン渓谷文化的景観',c:'モンゴル',t:'複合遺産',y:2004,lat:47.01,lon:102.84},
    {e:'🏛️',f:'🇩🇰',n:'イェリング遺跡',c:'デンマーク',t:'文化遺産',y:1994,lat:55.76,lon:9.75},
    {e:'🏛️',f:'🇳🇬',n:'オスン・オソボ神聖な木立',c:'ナイジェリア',t:'文化遺産',y:2005,lat:7.77,lon:4.56},
    {e:'🏛️',f:'🇸🇾',n:'パルミラ',c:'シリア',t:'文化遺産',y:1980,lat:34.55,lon:38.27},
    {e:'🏛️',f:'🇧🇴',n:'ポトシ市街',c:'ボリビア',t:'文化遺産',y:1987,lat:-19.59,lon:-65.75},
    {e:'🏛️',f:'🇦🇫',n:'ジャームのミナレット',c:'アフガニスタン',t:'文化遺産',y:2002,lat:34.40,lon:64.52},
    {e:'🏛️',f:'🇰🇿',n:'ホジャ・アフマド・ヤサウィ廟',c:'カザフスタン',t:'文化遺産',y:2003,lat:43.30,lon:68.27},
    {e:'🌿',f:'🇳🇦',n:'ナミブ砂海',c:'ナミビア',t:'自然遺産',y:2013,lat:-24.76,lon:15.34},
    {e:'🏛️',f:'🇲🇺',n:'アープラヴァシ・ガート',c:'モーリシャス',t:'文化遺産',y:2006,lat:-20.16,lon:57.50},
    {e:'🏛️',f:'🇦🇿',n:'ゴブスタン岩絵文化的景観',c:'アゼルバイジャン',t:'文化遺産',y:2007,lat:40.07,lon:49.38},
    {e:'⭐',f:'🇰🇬',n:'スレイマン山',c:'キルギス',t:'複合遺産',y:2009,lat:40.53,lon:72.80},
    {e:'🏛️',f:'🇹🇯',n:'サラズム先史時代の都市',c:'タジキスタン',t:'文化遺産',y:2010,lat:39.52,lon:67.68},
    {e:'🏛️',f:'🇸🇮',n:'イドリヤ水銀採掘遺産',c:'スロベニア',t:'文化遺産',y:2012,lat:46.00,lon:14.03},
    {e:'🌿',f:'🇨🇷',n:'ディキスの石球群',c:'コスタリカ',t:'文化遺産',y:2014,lat:8.92,lon:-83.33},
    {e:'🌿',f:'🇸🇬',n:'シンガポール植物園',c:'シンガポール',t:'文化遺産',y:2015,lat:1.31,lon:103.82},
    {e:'🏛️',f:'🇦🇬',n:'アンティグア海軍造船所',c:'アンティグア・バーブーダ',t:'文化遺産',y:2016,lat:17.02,lon:-61.77},
    {e:'🏛️',f:'🇪🇷',n:'アスマラ・モダニズム都市',c:'エリトリア',t:'文化遺産',y:2017,lat:15.33,lon:38.93},
    {e:'🏛️',f:'🇴🇲',n:'カルハット古代都市',c:'オマーン',t:'文化遺産',y:2018,lat:22.70,lon:59.38},
    {e:'🌿',f:'🇨🇱',n:'ラパ・ヌイ国立公園',c:'チリ',t:'文化遺産',y:1995,lat:-27.12,lon:-109.35},
    {e:'🌿',f:'🇬🇪',n:'コルキスの雨林と湿地',c:'ジョージア',t:'自然遺産',y:2023,lat:42.44,lon:42.04},
    {e:'🏛️',f:'🇹🇭',n:'スコータイ歴史都市',c:'タイ',t:'文化遺産',y:1991,lat:17.02,lon:99.82},
    {e:'🏛️',f:'🇹🇭',n:'アユタヤ歴史都市',c:'タイ',t:'文化遺産',y:1991,lat:14.36,lon:100.58},
    {e:'🌿',f:'🇹🇭',n:'ドンパヤーイェン-カオヤイ森林地帯',c:'タイ',t:'自然遺産',y:2005,lat:14.43,lon:101.37},
    {e:'🏛️',f:'🇮🇹',n:'フィレンツェ歴史地区',c:'イタリア',t:'文化遺産',y:1982,lat:43.773,lon:11.257},
    {e:'🌿',f:'🇺🇸',n:'エバーグレーズ国立公園',c:'アメリカ',t:'自然遺産',y:1979,lat:25.29,lon:-80.90},
    {e:'🌿',f:'🇺🇸',n:'グレート・スモーキー山脈国立公園',c:'アメリカ',t:'自然遺産',y:1983,lat:35.61,lon:-83.51},
    {e:'🌿',f:'🇺🇸',n:'オリンピック国立公園',c:'アメリカ',t:'自然遺産',y:1981,lat:47.80,lon:-123.60},
    {e:'🌿',f:'🇺🇸',n:'レッドウッド国立州立公園',c:'アメリカ',t:'自然遺産',y:1980,lat:41.40,lon:-124.00},
    {e:'🌿',f:'🇺🇸',n:'マンモス・ケーブ国立公園',c:'アメリカ',t:'自然遺産',y:1981,lat:37.19,lon:-86.10},
    {e:'🌿',f:'🇺🇸',n:'カールスバッド洞窟群国立公園',c:'アメリカ',t:'自然遺産',y:1995,lat:32.17,lon:-104.44},
    {e:'🌿',f:'🇺🇸',n:'カナイマ国立公園（テーブルマウンテン地帯）',c:'アメリカ',t:'自然遺産',y:1994,lat:61.00,lon:-149.00},
    {e:'🏛️',f:'🇺🇸',n:'インデペンデンス・ホール',c:'アメリカ',t:'文化遺産',y:1979,lat:39.95,lon:-75.15},
    {e:'🏛️',f:'🇺🇸',n:'チャコ文化',c:'アメリカ',t:'文化遺産',y:1987,lat:36.06,lon:-107.96},
    {e:'🏛️',f:'🇺🇸',n:'タオスのプエブロ',c:'アメリカ',t:'文化遺産',y:1992,lat:36.44,lon:-105.55},
    {e:'🏛️',f:'🇺🇸',n:'モンティチェロとバージニア大学',c:'アメリカ',t:'文化遺産',y:1987,lat:38.00,lon:-78.45},
    {e:'🏛️',f:'🇺🇸',n:'カホキア',c:'アメリカ',t:'文化遺産',y:1982,lat:38.66,lon:-90.06},
    {e:'🌿',f:'🇺🇸',n:'パパハナウモクアケア',c:'アメリカ',t:'複合遺産',y:2010,lat:25.70,lon:-170.00},
    {e:'🌿',f:'🇺🇸',n:'ウォータートン・グレイシャー国際平和公園',c:'アメリカ/カナダ',t:'自然遺産',y:1995,lat:48.93,lon:-113.90},
    {e:'🌿',f:'🇨🇦',n:'グロス・モーン国立公園',c:'カナダ',t:'自然遺産',y:1987,lat:49.60,lon:-57.80},
    {e:'🌿',f:'🇨🇦',n:'ウッド・バッファロー国立公園',c:'カナダ',t:'自然遺産',y:1983,lat:59.50,lon:-112.00},
    {e:'🌿',f:'🇨🇦',n:'ミグアシャ国立公園',c:'カナダ',t:'自然遺産',y:1999,lat:48.10,lon:-66.37},
    {e:'🌿',f:'🇨🇦',n:'ジョギンズの断崖',c:'カナダ',t:'自然遺産',y:2008,lat:45.70,lon:-64.43},
    {e:'🏛️',f:'🇨🇦',n:'ケベック旧市街の歴史地区',c:'カナダ',t:'文化遺産',y:1985,lat:46.81,lon:-71.21},
    {e:'🏛️',f:'🇨🇦',n:'ルーネンバーグ旧市街',c:'カナダ',t:'文化遺産',y:1995,lat:44.38,lon:-64.32},
    {e:'🏛️',f:'🇨🇦',n:'ランス・オ・メドウ国定史跡',c:'カナダ',t:'文化遺産',y:1978,lat:51.60,lon:-55.53},
    {e:'🏛️',f:'🇨🇦',n:'ヘッド・スマッシュト・イン・バッファロー・ジャンプ',c:'カナダ',t:'文化遺産',y:1981,lat:49.72,lon:-113.65},
    {e:'🌿',f:'🇨🇦',n:'アルタ岩絵群',c:'カナダ',t:'文化遺産',y:1980,lat:59.57,lon:-117.90},
    {e:'🏛️',f:'🇲🇽',n:'オアハカ歴史地区とモンテ・アルバン',c:'メキシコ',t:'文化遺産',y:1987,lat:17.04,lon:-96.72},
    {e:'🏛️',f:'🇲🇽',n:'テオティワカン',c:'メキシコ',t:'文化遺産',y:1987,lat:19.69,lon:-98.84},
    {e:'🏛️',f:'🇲🇽',n:'メキシコシティ歴史地区とソチミルコ',c:'メキシコ',t:'文化遺産',y:1987,lat:19.43,lon:-99.13},
    {e:'🏛️',f:'🇲🇽',n:'プエブラ歴史地区',c:'メキシコ',t:'文化遺産',y:1987,lat:19.04,lon:-98.19},
    {e:'🏛️',f:'🇲🇽',n:'グアナファト歴史都市と鉱山地帯',c:'メキシコ',t:'文化遺産',y:1988,lat:21.02,lon:-101.26},
    {e:'🏛️',f:'🇲🇽',n:'パレンケの古代都市と国立公園',c:'メキシコ',t:'文化遺産',y:1987,lat:17.49,lon:-92.04},
    {e:'🏛️',f:'🇲🇽',n:'ウシュマル古代都市',c:'メキシコ',t:'文化遺産',y:1996,lat:20.36,lon:-89.77},
    {e:'🏛️',f:'🇲🇽',n:'モレリア歴史地区',c:'メキシコ',t:'文化遺産',y:1991,lat:19.70,lon:-101.19},
    {e:'🌿',f:'🇲🇽',n:'エル・ビスカイノ鯨保護区',c:'メキシコ',t:'自然遺産',y:1993,lat:28.00,lon:-114.00},
    {e:'🌿',f:'🇲🇽',n:'コナカステ熱帯乾燥林',c:'メキシコ',t:'自然遺産',y:2008,lat:20.47,lon:-105.00},
    {e:'🏛️',f:'🇲🇽',n:'サカテカス歴史地区',c:'メキシコ',t:'文化遺産',y:1993,lat:22.77,lon:-102.58},
    {e:'🏛️',f:'🇧🇷',n:'オウロ・プレット歴史都市',c:'ブラジル',t:'文化遺産',y:1980,lat:-20.39,lon:-43.50},
    {e:'🏛️',f:'🇧🇷',n:'オリンダ歴史地区',c:'ブラジル',t:'文化遺産',y:1982,lat:-8.02,lon:-34.86},
    {e:'🏛️',f:'🇧🇷',n:'サルバドール・デ・バイア歴史地区',c:'ブラジル',t:'文化遺産',y:1985,lat:-12.97,lon:-38.51},
    {e:'🏛️',f:'🇧🇷',n:'ブラジリア',c:'ブラジル',t:'文化遺産',y:1987,lat:-15.78,lon:-47.93},
    {e:'🌿',f:'🇧🇷',n:'パンタナール保護地域群',c:'ブラジル',t:'自然遺産',y:2000,lat:-16.50,lon:-56.50},
    {e:'🌿',f:'🇧🇷',n:'イグアスの滝（ブラジル側）',c:'ブラジル',t:'自然遺産',y:1986,lat:-25.69,lon:-54.44},
    {e:'🌿',f:'🇧🇷',n:'ブラジル大西洋岸森林保護区群',c:'ブラジル',t:'自然遺産',y:1999,lat:-24.00,lon:-48.00},
    {e:'🌿',f:'🇧🇷',n:'カピバラ山国立公園',c:'ブラジル',t:'文化遺産',y:1991,lat:-8.85,lon:-42.53},
    {e:'🌿',f:'🇧🇷',n:'ベラス・アルテス群島',c:'ブラジル',t:'自然遺産',y:2001,lat:-3.87,lon:-32.42},
    {e:'🏛️',f:'🇦🇷',n:'ブエノスアイレスのコルドバ・イエズス会地区',c:'アルゼンチン',t:'文化遺産',y:2000,lat:-31.41,lon:-64.18},
    {e:'🏛️',f:'🇦🇷',n:'クエバ・デ・ラス・マノス',c:'アルゼンチン',t:'文化遺産',y:1999,lat:-47.16,lon:-70.67},
    {e:'🌿',f:'🇦🇷',n:'バルデス半島',c:'アルゼンチン',t:'自然遺産',y:1999,lat:-42.50,lon:-63.61},
    {e:'🌿',f:'🇦🇷',n:'イスチグアラスト／タランパジャ自然公園群',c:'アルゼンチン',t:'自然遺産',y:2000,lat:-29.90,lon:-68.00},
    {e:'🌿',f:'🇦🇷',n:'コロラド・フィッツロイ山脈',c:'アルゼンチン',t:'自然遺産',y:1981,lat:-49.27,lon:-72.90},
    {e:'🏛️',f:'🇵🇪',n:'クスコ市街',c:'ペルー',t:'文化遺産',y:1983,lat:-13.53,lon:-71.97},
    {e:'🏛️',f:'🇵🇪',n:'チャン・チャン遺跡地帯',c:'ペルー',t:'文化遺産',y:1986,lat:-8.10,lon:-79.07},
    {e:'🏛️',f:'🇵🇪',n:'チャビン（考古遺跡）',c:'ペルー',t:'文化遺産',y:1985,lat:-9.60,lon:-77.18},
    {e:'🌿',f:'🇵🇪',n:'マヌー国立公園',c:'ペルー',t:'自然遺産',y:1987,lat:-11.00,lon:-71.50},
    {e:'🌿',f:'🇵🇪',n:'リオ・アビセオ国立公園',c:'ペルー',t:'複合遺産',y:1990,lat:-7.70,lon:-77.50},
    {e:'🏛️',f:'🇵🇪',n:'ナスカとパルパの地上絵',c:'ペルー',t:'文化遺産',y:1994,lat:-14.74,lon:-75.13},
    {e:'🏛️',f:'🇵🇪',n:'カラル・スーペの聖都',c:'ペルー',t:'文化遺産',y:2009,lat:-10.90,lon:-77.52},
    {e:'🏛️',f:'🇨🇴',n:'サン・アグスティン遺跡公園',c:'コロンビア',t:'文化遺産',y:1995,lat:1.88,lon:-76.28},
    {e:'🏛️',f:'🇨🇴',n:'ティエラデントロ国立考古学公園',c:'コロンビア',t:'文化遺産',y:1995,lat:2.68,lon:-76.03},
    {e:'🌿',f:'🇨🇴',n:'ロス・カティオス国立公園',c:'コロンビア',t:'自然遺産',y:1994,lat:7.73,lon:-77.16},
    {e:'🏛️',f:'🇨🇴',n:'モンポス歴史地区',c:'コロンビア',t:'文化遺産',y:1995,lat:9.24,lon:-74.43},
    {e:'🌿',f:'🇨🇴',n:'コロンビアのコーヒー文化的景観',c:'コロンビア',t:'文化遺産',y:2011,lat:4.69,lon:-75.55},
    {e:'🏛️',f:'🇻🇪',n:'コロの港湾都市',c:'ベネズエラ',t:'文化遺産',y:1993,lat:11.40,lon:-69.67},
    {e:'🌿',f:'🇻🇪',n:'カナイマ国立公園',c:'ベネズエラ',t:'自然遺産',y:1994,lat:5.80,lon:-62.50},
    {e:'🏛️',f:'🇧🇴',n:'スクレの歴史都市',c:'ボリビア',t:'文化遺産',y:1991,lat:-19.05,lon:-65.26},
    {e:'🌿',f:'🇧🇴',n:'ノエル・ケンプ・メルカード国立公園',c:'ボリビア',t:'自然遺産',y:2000,lat:-13.90,lon:-61.00},
    {e:'🏛️',f:'🇧🇴',n:'ティワナク',c:'ボリビア',t:'文化遺産',y:2000,lat:-16.55,lon:-68.67},
    {e:'🏛️',f:'🇪🇨',n:'キト市街',c:'エクアドル',t:'文化遺産',y:1978,lat:-0.22,lon:-78.51},
    {e:'🌿',f:'🇪🇨',n:'サンガイ国立公園',c:'エクアドル',t:'自然遺産',y:1983,lat:-2.00,lon:-78.50},
    {e:'🏛️',f:'🇪🇨',n:'クエンカ歴史地区',c:'エクアドル',t:'文化遺産',y:1999,lat:-2.90,lon:-79.01},
    {e:'🏛️',f:'🇨🇱',n:'ハンバーストーンとサンタ・ラウラの硝石工場群',c:'チリ',t:'文化遺産',y:2005,lat:-20.21,lon:-69.78},
    {e:'🏛️',f:'🇨🇱',n:'バルパライソの海港都市',c:'チリ',t:'文化遺産',y:2003,lat:-33.05,lon:-71.63},
    {e:'🌿',f:'🇨🇱',n:'フンボルト・ペンギン国立保護区',c:'チリ',t:'自然遺産',y:2021,lat:-29.30,lon:-71.48},
    {e:'🏛️',f:'🇬🇹',n:'アンティグア・グアテマラ',c:'グアテマラ',t:'文化遺産',y:1979,lat:14.56,lon:-90.73},
    {e:'🌿',f:'🇬🇹',n:'キリグア遺跡公園と遺跡群',c:'グアテマラ',t:'文化遺産',y:1981,lat:15.28,lon:-89.04},
    {e:'🏛️',f:'🇭🇳',n:'コパン遺跡',c:'ホンジュラス',t:'文化遺産',y:1980,lat:14.84,lon:-89.14},
    {e:'🌿',f:'🇭🇳',n:'リオ・プラタノ生物圏保護区',c:'ホンジュラス',t:'自然遺産',y:1982,lat:15.70,lon:-85.00},
    {e:'🏛️',f:'🇵🇦',n:'パナマのカリブ沿岸の要塞群',c:'パナマ',t:'文化遺産',y:1980,lat:9.35,lon:-79.91},
    {e:'🌿',f:'🇵🇦',n:'ダリエン国立公園',c:'パナマ',t:'自然遺産',y:1981,lat:7.90,lon:-77.70},
    {e:'🌿',f:'🇨🇷',n:'コスタリカの保護地域群',c:'コスタリカ',t:'自然遺産',y:1983,lat:9.44,lon:-83.74},
    {e:'🌿',f:'🇨🇷',n:'ココス島国立公園',c:'コスタリカ',t:'自然遺産',y:1997,lat:5.54,lon:-87.07},
    {e:'🏛️',f:'🇨🇺',n:'トリニダーとロス・インヘニオス渓谷',c:'キューバ',t:'文化遺産',y:1988,lat:21.80,lon:-79.98},
    {e:'🌿',f:'🇨🇺',n:'アレハンドロ・デ・フンボルト国立公園',c:'キューバ',t:'自然遺産',y:2001,lat:20.46,lon:-74.72},
    {e:'🏛️',f:'🇨🇺',n:'サンティアゴ・デ・クーバの聖カストロ要塞',c:'キューバ',t:'文化遺産',y:1997,lat:19.97,lon:-75.85},
    {e:'🏛️',f:'🇩🇴',n:'サントドミンゴの植民都市',c:'ドミニカ共和国',t:'文化遺産',y:1990,lat:18.47,lon:-69.89},
    {e:'🏛️',f:'🇯🇲',n:'ブルー・マウンテン/ジョン・クロウ山脈',c:'ジャマイカ',t:'自然遺産',y:2015,lat:18.10,lon:-76.61},
    {e:'🌿',f:'🇸🇷',n:'セントラル・スリナム自然保護区',c:'スリナム',t:'自然遺産',y:2000,lat:3.98,lon:-56.79},
    {e:'🏛️',f:'🇸🇷',n:'パラマリボの歴史地区',c:'スリナム',t:'文化遺産',y:2002,lat:5.85,lon:-55.20},
    {e:'🌿',f:'🇬🇾',n:'カイエトゥール国立公園',c:'ガイアナ',t:'自然遺産',y:2024,lat:5.18,lon:-59.48},
    {e:'🏛️',f:'🇵🇾',n:'ラ・サンティシマ・トリニダー・デ・パラナ',c:'パラグアイ',t:'文化遺産',y:1993,lat:-27.13,lon:-56.40},
    {e:'🏛️',f:'🇺🇾',n:'フライベントスの産業景観',c:'ウルグアイ',t:'文化遺産',y:2015,lat:-33.10,lon:-58.30},
    {e:'🏛️',f:'🇧🇿',n:'ベリーズのバリア・リーフ',c:'ベリーズ',t:'自然遺産',y:1996,lat:17.00,lon:-87.60},
    {e:'🌿',f:'🇳🇮',n:'レオン・ビエホ遺跡',c:'ニカラグア',t:'文化遺産',y:2000,lat:12.43,lon:-87.02},
    {e:'🏛️',f:'🇸🇻',n:'ハヤ・デ・ラ・トレ天文台',c:'エルサルバドル',t:'文化遺産',y:1993,lat:13.91,lon:-88.02},
    {e:'🏛️',f:'🇹🇹',n:'ベネズエラの南米独立都市',c:'トリニダード・トバゴ',t:'文化遺産',y:2016,lat:10.68,lon:-61.52},
    {e:'🏛️',f:'🇫🇷',n:'シャルトル大聖堂',c:'フランス',t:'文化遺産',y:1979,lat:48.45,lon:1.49},
    {e:'🏛️',f:'🇫🇷',n:'アヴィニョン歴史地区',c:'フランス',t:'文化遺産',y:1995,lat:43.95,lon:4.81},
    {e:'🏛️',f:'🇫🇷',n:'カルカッソンヌ',c:'フランス',t:'文化遺産',y:1997,lat:43.21,lon:2.35},
    {e:'🏛️',f:'🇫🇷',n:'ポン・デュ・ガール',c:'フランス',t:'文化遺産',y:1985,lat:43.95,lon:4.54},
    {e:'🏛️',f:'🇫🇷',n:'サン＝テミリオン地域',c:'フランス',t:'文化遺産',y:1999,lat:44.90,lon:-0.16},
    {e:'🏛️',f:'🇩🇪',n:'ハイデルベルク旧市街（ライン川上流）',c:'ドイツ',t:'文化遺産',y:2024,lat:49.41,lon:8.71},
    {e:'🏛️',f:'🇩🇪',n:'バンベルク旧市街',c:'ドイツ',t:'文化遺産',y:1993,lat:49.90,lon:10.90},
    {e:'🏛️',f:'🇩🇪',n:'ポツダムと周辺の離宮・庭園群',c:'ドイツ',t:'文化遺産',y:1990,lat:52.40,lon:13.06},
    {e:'🏛️',f:'🇩🇪',n:'ロテンブルク・オプ・デア・タウバー（ロマンチック街道）',c:'ドイツ',t:'文化遺産',y:1981,lat:49.37,lon:10.18},
    {e:'🏛️',f:'🇩🇪',n:'ワルトブルク城',c:'ドイツ',t:'文化遺産',y:1999,lat:50.97,lon:10.30},
    {e:'🏛️',f:'🇬🇧',n:'タワー・オブ・ロンドン',c:'英国',t:'文化遺産',y:1988,lat:51.51,lon:-0.08},
    {e:'🏛️',f:'🇬🇧',n:'バース市街',c:'英国',t:'文化遺産',y:1987,lat:51.38,lon:-2.36},
    {e:'🏛️',f:'🇬🇧',n:'エディンバラ旧市街・新市街',c:'英国',t:'文化遺産',y:1995,lat:55.95,lon:-3.19},
    {e:'🌿',f:'🇬🇧',n:'ジャイアンツ・コーズウェーと海岸',c:'英国',t:'自然遺産',y:1986,lat:55.24,lon:-6.51},
    {e:'🏛️',f:'🇮🇹',n:'ヴェネツィアとその潟',c:'イタリア',t:'文化遺産',y:1987,lat:45.44,lon:12.33},
    {e:'🏛️',f:'🇮🇹',n:'アマルフィ海岸',c:'イタリア',t:'文化遺産',y:1997,lat:40.63,lon:14.60},
    {e:'🏛️',f:'🇮🇹',n:'シエナ歴史地区',c:'イタリア',t:'文化遺産',y:1995,lat:43.32,lon:11.33},
    {e:'🏛️',f:'🇮🇹',n:'アグリジェント考古学地区',c:'イタリア',t:'文化遺産',y:1997,lat:37.29,lon:13.59},
    {e:'🏛️',f:'🇮🇹',n:'チンクエ・テッレ',c:'イタリア',t:'文化遺産',y:1997,lat:44.13,lon:9.72},
    {e:'🏛️',f:'🇪🇸',n:'サンティアゴ・デ・コンポステーラ旧市街',c:'スペイン',t:'文化遺産',y:1985,lat:42.88,lon:-8.54},
    {e:'🏛️',f:'🇪🇸',n:'セビーリャの大聖堂・アルカサル・インディアス文書館',c:'スペイン',t:'文化遺産',y:1987,lat:37.39,lon:-5.99},
    {e:'🏛️',f:'🇪🇸',n:'トレド旧市街',c:'スペイン',t:'文化遺産',y:1986,lat:39.86,lon:-4.02},
    {e:'🏛️',f:'🇵🇹',n:'シントラの文化的景観',c:'ポルトガル',t:'文化遺産',y:1995,lat:38.79,lon:-9.39},
    {e:'🏛️',f:'🇵🇹',n:'リスボン・ジェロニモス修道院',c:'ポルトガル',t:'文化遺産',y:1983,lat:38.70,lon:-9.21},
    {e:'🏛️',f:'🇨🇭',n:'ベルン旧市街',c:'スイス',t:'文化遺産',y:1983,lat:46.95,lon:7.45},
    {e:'🌿',f:'🇨🇭',n:'スイス・アルプス ユングフラウ・アレッチュ',c:'スイス',t:'自然遺産',y:2001,lat:46.55,lon:8.00},
    {e:'🏛️',f:'🇧🇪',n:'ブリュッセルのグラン＝プラス',c:'ベルギー',t:'文化遺産',y:1998,lat:50.85,lon:4.35},
    {e:'🏛️',f:'🇧🇪',n:'ブルッヘ歴史地区',c:'ベルギー',t:'文化遺産',y:2000,lat:51.21,lon:3.22},
    {e:'🏛️',f:'🇳🇱',n:'アムステルダムの運河網',c:'オランダ',t:'文化遺産',y:2010,lat:52.37,lon:4.90},
    {e:'🌿',f:'🇳🇱',n:'スホウクラント',c:'オランダ',t:'文化遺産',y:1995,lat:52.66,lon:5.73},
    {e:'🏛️',f:'🇸🇪',n:'ビルカとホーヴゴーデン',c:'スウェーデン',t:'文化遺産',y:1993,lat:59.36,lon:17.54},
    {e:'🏛️',f:'🇸🇪',n:'ガンメルスタード教会街',c:'スウェーデン',t:'文化遺産',y:1996,lat:65.68,lon:22.02},
    {e:'🌿',f:'🇮🇸',n:'シンクヴェトリル国立公園',c:'アイスランド',t:'文化遺産',y:2004,lat:64.26,lon:-20.91},
    {e:'🏛️',f:'🇭🇺',n:'ブダペスト・ドナウ川岸と城地区',c:'ハンガリー',t:'文化遺産',y:1987,lat:47.50,lon:19.04},
    {e:'🏛️',f:'🇷🇴',n:'シギショアラ歴史地区',c:'ルーマニア',t:'文化遺産',y:1999,lat:46.22,lon:24.79},
    {e:'🌿',f:'🇷🇴',n:'ドナウ・デルタ',c:'ルーマニア',t:'自然遺産',y:1991,lat:45.20,lon:29.40},
    {e:'🏛️',f:'🇧🇬',n:'ネセバル旧市街',c:'ブルガリア',t:'文化遺産',y:1983,lat:42.66,lon:27.73},
    {e:'🏛️',f:'🇬🇷',n:'メテオラ',c:'ギリシャ',t:'複合遺産',y:1988,lat:39.72,lon:21.63},
    {e:'🏛️',f:'🇬🇷',n:'デルフィの考古学的遺跡',c:'ギリシャ',t:'文化遺産',y:1987,lat:38.48,lon:22.50},
    {e:'🏛️',f:'🇹🇷',n:'ハットゥシャ（ヒッタイトの首都）',c:'トルコ',t:'文化遺産',y:1986,lat:40.02,lon:34.61},
    {e:'🏛️',f:'🇹🇷',n:'ネムルト山',c:'トルコ',t:'文化遺産',y:1987,lat:37.98,lon:38.74},
    {e:'🏛️',f:'🇹🇷',n:'エフェソス',c:'トルコ',t:'文化遺産',y:2015,lat:37.94,lon:27.34},
    {e:'🏛️',f:'🇺🇦',n:'キーウの聖ソフィア大聖堂と修道院群',c:'ウクライナ',t:'文化遺産',y:1990,lat:50.45,lon:30.51},
    {e:'🏛️',f:'🇱🇻',n:'リガ歴史地区',c:'ラトビア',t:'文化遺産',y:1997,lat:56.95,lon:24.11},
    {e:'🏛️',f:'🇪🇪',n:'タリン歴史地区',c:'エストニア',t:'文化遺産',y:1997,lat:59.44,lon:24.75},
    {e:'🏛️',f:'🇱🇹',n:'ヴィリニュス歴史地区',c:'リトアニア',t:'文化遺産',y:1994,lat:54.69,lon:25.28},
    {e:'🏛️',f:'🇦🇲',n:'ハフパットとサナヒンの修道院群',c:'アルメニア',t:'文化遺産',y:1996,lat:41.25,lon:44.64},
    {e:'🏛️',f:'🇬🇪',n:'ムツヘタ歴史建造物群',c:'ジョージア',t:'文化遺産',y:1994,lat:41.85,lon:44.72},
    {e:'🏛️',f:'🇮🇱',n:'マサダ国立公園',c:'イスラエル',t:'文化遺産',y:2001,lat:31.32,lon:35.35},
    {e:'🏛️',f:'🇮🇱',n:'エルサレム旧市街と城壁',c:'イスラエル/パレスチナ',t:'文化遺産',y:1981,lat:31.78,lon:35.23},
    {e:'🏛️',f:'🇮🇱',n:'カイサリア考古学遺跡',c:'イスラエル',t:'文化遺産',y:2022,lat:32.50,lon:34.90},
    {e:'🏛️',f:'🇯🇴',n:'クサイル・アムラ',c:'ヨルダン',t:'文化遺産',y:1985,lat:31.80,lon:36.59},
    {e:'🏛️',f:'🇯🇴',n:'ウム・アル＝ラサス',c:'ヨルダン',t:'文化遺産',y:2004,lat:31.50,lon:36.20},
    {e:'🏛️',f:'🇱🇧',n:'ビブロス',c:'レバノン',t:'文化遺産',y:1984,lat:34.12,lon:35.65},
    {e:'🏛️',f:'🇱🇧',n:'ティルス',c:'レバノン',t:'文化遺産',y:1984,lat:33.27,lon:35.20},
    {e:'🏛️',f:'🇸🇾',n:'ダマスカス旧市街',c:'シリア',t:'文化遺産',y:1979,lat:33.51,lon:36.29},
    {e:'🏛️',f:'🇸🇾',n:'アレッポ旧市街',c:'シリア',t:'文化遺産',y:1986,lat:36.20,lon:37.16},
    {e:'🏛️',f:'🇮🇶',n:'ハトラ',c:'イラク',t:'文化遺産',y:1985,lat:35.59,lon:42.72},
    {e:'🏛️',f:'🇮🇶',n:'ウル（シュメール）',c:'イラク',t:'文化遺産',y:2016,lat:30.96,lon:46.10},
    {e:'🏛️',f:'🇮🇷',n:'イスファハーンのマスジェデ・ジャーメ',c:'イラン',t:'文化遺産',y:2012,lat:32.67,lon:51.68},
    {e:'🏛️',f:'🇮🇷',n:'ゴンバデ・カーブース',c:'イラン',t:'文化遺産',y:2012,lat:37.25,lon:55.17},
    {e:'🏛️',f:'🇸🇦',n:'ナジュラン/ウクデ文化的景観',c:'サウジアラビア',t:'文化遺産',y:2021,lat:17.49,lon:44.13},
    {e:'🏛️',f:'🇸🇦',n:'ヒマー文化地域',c:'サウジアラビア',t:'文化遺産',y:2021,lat:26.54,lon:43.96},
    {e:'🏛️',f:'🇾🇪',n:'サナアの旧市街',c:'イエメン',t:'文化遺産',y:1986,lat:15.35,lon:44.21},
    {e:'🏛️',f:'🇾🇪',n:'シバーム城壁都市',c:'イエメン',t:'文化遺産',y:1982,lat:15.93,lon:48.62},
    {e:'🏛️',f:'🇴🇲',n:'バフラー要塞',c:'オマーン',t:'文化遺産',y:1987,lat:22.97,lon:57.30},
    {e:'🏛️',f:'🇦🇪',n:'アル・アインのオアシス群',c:'UAE',t:'文化遺産',y:2011,lat:24.21,lon:55.76},
    {e:'🇲🇦',f:'🇲🇦',n:'マラケシュ旧市街',c:'モロッコ',t:'文化遺産',y:1985,lat:31.63,lon:-7.99},
    {e:'🏛️',f:'🇲🇦',n:'ヴォルビリス考古学遺跡',c:'モロッコ',t:'文化遺産',y:1997,lat:34.07,lon:-5.55},
    {e:'🏛️',f:'🇲🇦',n:'メクネス旧市街',c:'モロッコ',t:'文化遺産',y:1996,lat:33.89,lon:-5.55},
    {e:'🏛️',f:'🇹🇳',n:'カルタゴ遺跡',c:'チュニジア',t:'文化遺産',y:1979,lat:36.86,lon:10.32},
    {e:'🏛️',f:'🇹🇳',n:'カイラワン',c:'チュニジア',t:'文化遺産',y:1988,lat:35.68,lon:10.10},
    {e:'🏛️',f:'🇩🇿',n:'ジェミラ考古学遺跡',c:'アルジェリア',t:'文化遺産',y:1982,lat:36.32,lon:5.74},
    {e:'🏛️',f:'🇩🇿',n:'ティパサ考古学遺跡',c:'アルジェリア',t:'文化遺産',y:1982,lat:36.59,lon:2.45},
    {e:'🏛️',f:'🇱🇾',n:'レプティス・マグナ',c:'リビア',t:'文化遺産',y:1982,lat:32.64,lon:14.29},
    {e:'🏛️',f:'🇸🇩',n:'メロエ島の考古学遺跡',c:'スーダン',t:'文化遺産',y:2011,lat:16.93,lon:33.75},
    {e:'🌿',f:'🇹🇿',n:'セレンゲティ/ンゴロンゴロ拡張区域',c:'タンザニア',t:'複合遺産',y:2010,lat:-3.24,lon:35.00},
    {e:'🏛️',f:'🇹🇿',n:'ザンジバル旧石造都市',c:'タンザニア',t:'文化遺産',y:2000,lat:-6.16,lon:39.19},
    {e:'🌿',f:'🇰🇪',n:'ケニヤ山国立公園',c:'ケニア',t:'自然遺産',y:1997,lat:0.15,lon:37.31},
    {e:'🏛️',f:'🇰🇪',n:'ミジケンダのカヤの森',c:'ケニア',t:'文化遺産',y:2008,lat:-3.95,lon:39.67},
    {e:'🌿',f:'🇺🇬',n:'ブウィンディ原生国立公園',c:'ウガンダ',t:'自然遺産',y:1994,lat:-1.06,lon:29.71},
    {e:'🌿',f:'🇷🇼',n:'ニュングウェ国立公園',c:'ルワンダ',t:'自然遺産',y:2023,lat:-2.49,lon:29.23},
    {e:'🌿',f:'🇿🇦',n:'ウカンブンバ考古学遺跡',c:'南アフリカ',t:'文化遺産',y:1999,lat:-25.90,lon:27.70},
    {e:'🌿',f:'🇿🇦',n:'フレデフォート・ドーム',c:'南アフリカ',t:'自然遺産',y:2005,lat:-26.87,lon:27.52},
    {e:'🏛️',f:'🇿🇦',n:'ロベン島',c:'南アフリカ',t:'文化遺産',y:1999,lat:-33.81,lon:18.37},
    {e:'🌿',f:'🇲🇬',n:'アチナナナの雨林',c:'マダガスカル',t:'自然遺産',y:2007,lat:-15.73,lon:49.76},
    {e:'🌿',f:'🇲🇿',n:'ゴロンゴザ国立公園',c:'モザンビーク',t:'自然遺産',y:2024,lat:-18.92,lon:34.33},
    {e:'🏛️',f:'🇸🇳',n:'セント＝ルイス島',c:'セネガル',t:'文化遺産',y:2000,lat:16.02,lon:-16.50},
    {e:'🏛️',f:'🇬🇭',n:'ヴォルタ州・アシャンティ州等の要塞と城砦群',c:'ガーナ',t:'文化遺産',y:1979,lat:5.11,lon:-1.28},
    {e:'🌿',f:'🇨🇲',n:'ジャー野生動物保護区',c:'カメルーン',t:'自然遺産',y:1987,lat:3.05,lon:13.29},
    {e:'🌿',f:'🇨🇩',n:'オカピ野生生物保護区',c:'コンゴ民主共和国',t:'自然遺産',y:1996,lat:1.43,lon:28.60},
    {e:'🏛️',f:'🇲🇱',n:'ジェンネ旧市街',c:'マリ',t:'文化遺産',y:1988,lat:13.90,lon:-4.56},
    {e:'🌿',f:'🇧🇼',n:'オカバンゴ・デルタ',c:'ボツワナ',t:'自然遺産',y:2014,lat:-19.18,lon:22.71},
    {e:'🌿',f:'🇿🇲',n:'モシ・オア・トゥニャ（ヴィクトリア滝）',c:'ザンビア',t:'自然遺産',y:1989,lat:-17.93,lon:25.86},
    {e:'🌿',f:'🇳🇦',n:'ツォダブ湖文化的景観',c:'ナミビア',t:'文化遺産',y:2022,lat:-25.19,lon:18.77},
    {e:'🌿',f:'🇪🇹',n:'シミエン国立公園',c:'エチオピア',t:'自然遺産',y:1978,lat:13.25,lon:38.07},
    {e:'🏛️',f:'🇪🇹',n:'ラリベラの岩窟教会群',c:'エチオピア',t:'文化遺産',y:1978,lat:12.03,lon:39.04},
    {e:'🏛️',f:'🇮🇷',n:'ペルシャのカナート',c:'イラン',t:'文化遺産',y:2016,lat:33.64,lon:52.35},
    {e:'🏛️',f:'🇫🇮',n:'ラウマ旧市街',c:'フィンランド',t:'文化遺産',y:1991,lat:61.13,lon:21.51},
    {e:'🏛️',f:'🇳🇴',n:'ブリッゲン（ベルゲン）',c:'ノルウェー',t:'文化遺産',y:1979,lat:60.40,lon:5.32}
  ];

  function typeColor(t) {
    return t === '文化遺産' ? '#e3a838' : (t === '自然遺産' ? '#3fb950' : '#a371f7');
  }
  function thumbBg(t) {
    return t === '文化遺産' ? '#1a0d00' : (t === '自然遺産' ? '#0a1e0a' : '#100a20');
  }

  function latLonTo3D(lat, lon) {
    var latR = lat * Math.PI / 180;
    var lonR = lon * Math.PI / 180;
    return [Math.cos(latR) * Math.cos(lonR), Math.sin(latR), -Math.cos(latR) * Math.sin(lonR)];
  }

  var flyTarget = null, flyFrom = null, flyStart = 0;
  var FLY_DUR = 2500;

  var landingMode = false;
  var landingIdx = -1;
  var landingPhase = 0;
  var landingPhaseStart = 0;
  var landingZoomFrom = 3.2;
  var landingRotStart = 0;
  var landingRotXFrom = 0;
  var landingZoomOutFrom = 1.12;
  var LANDING_ZOOM_TARGET = 1.12;
  var LANDING_ZOOM_RETURN = 3.5;
  var LANDING_ZOOM_IN_DUR = 3500;
  var LANDING_ROT_DUR = 14000;
  var LANDING_ZOOM_OUT_DUR = 2500;
  var landingOverlayEl = null;
  var landingTitleEl = null;
  var landingSubEl = null;
  var landingStatusEl = null;
  var landingProgEl = null;
  var landingCityListEl = null;
  var landingSpinToggleEl = null;
  var spin360Enabled = false;
  var landingCities = [];
  var cityMkEls = [];
  var cityMarkersDiv = null;
  var hasCityDataSet = {};

  fetch('/api/heritage-city-fetched-list').then(function(r){ return r.json(); }).then(function(d){
    if(d && d.names) { d.names.forEach(function(n){ hasCityDataSet[n] = true; }); }
  }).catch(function(){});

  function haversineKm(la1, lo1, la2, lo2) {
    var R = 6371;
    var dLa = (la2 - la1) * Math.PI / 180;
    var dLo = (lo2 - lo1) * Math.PI / 180;
    var a = Math.sin(dLa/2)*Math.sin(dLa/2) + Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dLo/2)*Math.sin(dLo/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  function clearCityMarkers() {
    cityMkEls.forEach(function(el){ if(el.parentNode) el.parentNode.removeChild(el); });
    cityMkEls = [];
    if(cityMarkersDiv) cityMarkersDiv.style.display = 'none';
  }

  function formatPop(p) {
    if(!p) return '';
    if(p >= 1000000) return (p/1000000).toFixed(1) + 'M';
    if(p >= 1000) return Math.round(p/1000) + 'k';
    return String(p);
  }

  function buildCityMarkers(cities) {
    clearCityMarkers();
    if(!cityMarkersDiv || !cities || cities.length === 0) return;
    cityMarkersDiv.style.display = '';
    cities.forEach(function(city) {
      var el = document.createElement('div');
      el.className = 'city-mk';
      var pop = city.population ? (' ' + formatPop(city.population)) : '';
      el.innerHTML = '<span class="city-mk-dot"></span>' + city.city_name + pop;
      cityMarkersDiv.appendChild(el);
      cityMkEls.push({ el: el, pos3d: latLonTo3D(city.city_lat, city.city_lon) });
    });
  }

  function renderCityList(cities) {
    if(!landingCityListEl) return;
    if(!cities || cities.length === 0) { landingCityListEl.innerHTML = ''; return; }
    var html = '';
    cities.forEach(function(city) {
      var pop = city.population ? (' <span style="color:#8b949e">(' + formatPop(city.population) + ')</span>') : '';
      html += '<div class="landing-city-item"><span>🌆 ' + city.city_name + pop + '</span><span class="landing-city-dist">' + city.distance_km + 'km</span></div>';
    });
    landingCityListEl.innerHTML = html;
  }

  function loadLandingCities(hidx) {
    var ld = HERITAGE[hidx];
    if(!ld) return;
    if(landingCityListEl) landingCityListEl.innerHTML = '<div class="landing-city-loading">🌆 周辺都市を検索中...</div>';
    fetch('/api/heritage-cities?name=' + encodeURIComponent(ld.n))
      .then(function(r){ return r.json(); })
      .then(function(data) {
        if(data.fetched) {
          landingCities = data.cities || [];
          if(landingCities.length > 0) hasCityDataSet[ld.n] = true;
          buildCityMarkers(landingCities);
          renderCityList(landingCities);
        } else {
          return fetch('/api/heritage-cities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: ld.n, lat: ld.lat, lon: ld.lon })
          }).then(function(r){ return r.json(); }).then(function(d) {
            landingCities = d.cities || [];
            if(landingCities.length > 0) hasCityDataSet[ld.n] = true;
            buildCityMarkers(landingCities);
            renderCityList(landingCities);
          });
        }
      })
      .catch(function() {
        if(landingCityListEl) landingCityListEl.innerHTML = '';
      });
  }

  function flyTo(lat, lon) {
    var latR = lat * Math.PI / 180;
    var lonR = lon * Math.PI / 180;
    var a = axialTilt;
    var tanA = Math.tan(a);
    var tanL = Math.tan(latR);
    var cosVal = Math.max(-1, Math.min(1, tanA * tanL));
    var ty = -Math.acos(cosVal) - lonR;
    var sinSq = 1 - cosVal * cosVal;
    var denom = Math.cos(a) * Math.sqrt(Math.max(0, sinSq));
    var tx = denom < 1e-6 ? (latR >= 0 ? Math.PI / 2 : -Math.PI / 2) : Math.atan(tanL / denom);
    var dy = ty - rotYv;
    while (dy > Math.PI) dy -= 2*Math.PI;
    while (dy < -Math.PI) dy += 2*Math.PI;
    momentumY = 0; momentumX = 0;
    flyFrom = {ry: rotYv, rx: rotXv};
    flyTarget = {ry: rotYv + dy, rx: tx};
    flyStart = performance.now();
    autoRot = false;
    btnAutoRot.textContent = '▶ 回転';
    btnAutoRot.classList.add('active');
    if (axisLocked) {
      axisLocked = false;
      btnAxisLock.classList.remove('active');
      btnAxisLock.textContent = '＋ 軸垂直固定';
    }
  }

  function startLanding(hidx) {
    if (landingMode) return;
    landingIdx = hidx;
    var ld = HERITAGE[hidx];
    flyTo(ld.lat, ld.lon);
    stopAmericaTour(); stopEuropeTour(); stopAfricaTour(); stopJapanTour();
    setTimeout(function() {
      flyTarget = null;
      landingMode = true;
      landingPhase = 1;
      landingPhaseStart = performance.now();
      landingZoomFrom = zoom;
      landingRotXFrom = rotXv;
      markersDiv.style.display = 'none';
      tooltip.style.opacity = '0';
      if (landingTitleEl) landingTitleEl.textContent = ld.e + ' ' + ld.f + ' ' + ld.n;
      if (landingSubEl) landingSubEl.textContent = ld.t + '  ' + ld.c + '  ' + ld.y + '年登録';
      if (landingStatusEl) landingStatusEl.textContent = '着陸中...';
      if (landingProgEl) landingProgEl.style.width = '0%';
      if (landingCityListEl) landingCityListEl.innerHTML = '';
      if (landingOverlayEl) landingOverlayEl.classList.add('active');
      loadLandingCities(hidx);
    }, FLY_DUR + 100);
  }

  function stopLanding() {
    landingMode = false;
    landingPhase = 0;
    landingCities = [];
    clearCityMarkers();
    markersDiv.style.display = '';
    if (landingOverlayEl) landingOverlayEl.classList.remove('active');
    if (landingCityListEl) landingCityListEl.innerHTML = '';
    zoom = LANDING_ZOOM_RETURN;
    rotXv = 0.3;
    autoRot = true;
    btnAutoRot.textContent = '⏸ 自転停止';
    btnAutoRot.classList.remove('active');
  }

  var sideHeader = document.querySelector('.side-header');

  var AMERICAS_IDXS = [];
  for (var ai = 0; ai < HERITAGE.length; ai++) {
    if (HERITAGE[ai].lon < -30) AMERICAS_IDXS.push(ai);
  }
  AMERICAS_IDXS.sort(function(a, b) { return HERITAGE[b].lon - HERITAGE[a].lon; });

  var americaTourActive = false;
  var americaTourPos = 0;
  var americaTourTimer = null;
  var AMERICAS_INTERVAL = 5000;

  function stopAmericaTour() {
    americaTourActive = false;
    if (americaTourTimer !== null) { clearTimeout(americaTourTimer); americaTourTimer = null; }
    btnAmericaTour.classList.remove('active');
    btnAmericaTour.textContent = '🌎 アメリカ巡回';
    hideTourPanel();
  }

  function nextAmericaSite() {
    if (!americaTourActive) return;
    if (AMERICAS_IDXS.length === 0) { stopAmericaTour(); return; }
    var idx = AMERICAS_IDXS[americaTourPos % AMERICAS_IDXS.length];
    americaTourPos++;
    showMarkerTooltip(idx, 0, 0);
    highlightTourItem(idx);
    americaTourTimer = setTimeout(nextAmericaSite, AMERICAS_INTERVAL);
  }

  function startAmericaTour() {
    stopEuropeTour();
    stopAfricaTour();
    stopJapanTour();
    americaTourActive = true;
    americaTourPos = 0;
    btnAmericaTour.classList.add('active');
    btnAmericaTour.textContent = '⏹ 巡回停止';
    autoRot = false;
    btnAutoRot.textContent = '▶ 回転';
    btnAutoRot.classList.add('active');
    showTourPanel(AMERICAS_IDXS, '🌎 アメリカ巡回');
    nextAmericaSite();
  }

  btnAmericaTour.addEventListener('click', function() {
    if (americaTourActive) { stopAmericaTour(); } else { startAmericaTour(); }
  });

  var btnEuropeTour = document.getElementById('btnEuropeTour');
  var btnAfricaTour = document.getElementById('btnAfricaTour');

  var REGION_MAP = {
    '🇨🇳':'アジア','🇯🇵':'アジア','🇮🇳':'アジア','🇰🇷':'アジア','🇮🇩':'アジア','🇰🇭':'アジア','🇻🇳':'アジア','🇹🇭':'アジア','🇲🇾':'アジア','🇵🇰':'アジア','🇧🇩':'アジア','🇲🇳':'アジア','🇳🇵':'アジア','🇱🇰':'アジア','🇵🇭':'アジア','🇲🇲':'アジア','🇰🇿':'アジア','🇺🇿':'アジア','🇹🇲':'アジア','🇰🇬':'アジア','🇹🇯':'アジア','🇦🇫':'アジア',
    '🇫🇷':'ヨーロッパ','🇩🇪':'ヨーロッパ','🇬🇧':'ヨーロッパ','🇮🇹':'ヨーロッパ','🇪🇸':'ヨーロッパ','🇵🇹':'ヨーロッパ','🇬🇷':'ヨーロッパ','🇭🇷':'ヨーロッパ','🇨🇿':'ヨーロッパ','🇵🇱':'ヨーロッパ','🇷🇺':'ヨーロッパ','🇹🇷':'ヨーロッパ','🇦🇹':'ヨーロッパ','🇨🇭':'ヨーロッパ','🇧🇪':'ヨーロッパ','🇳🇱':'ヨーロッパ','🇸🇪':'ヨーロッパ','🇳🇴':'ヨーロッパ','🇩🇰':'ヨーロッパ','🇫🇮':'ヨーロッパ','🇮🇸':'ヨーロッパ','🇮🇪':'ヨーロッパ','🇭🇺':'ヨーロッパ','🇷🇴':'ヨーロッパ','🇧🇬':'ヨーロッパ','🇸🇰':'ヨーロッパ','🇸🇮':'ヨーロッパ','🇱🇻':'ヨーロッパ','🇱🇹':'ヨーロッパ','🇪🇪':'ヨーロッパ','🇺🇦':'ヨーロッパ','🇲🇹':'ヨーロッパ','🇱🇺':'ヨーロッパ','🇲🇪':'ヨーロッパ','🇷🇸':'ヨーロッパ','🇲🇰':'ヨーロッパ','🇧🇦':'ヨーロッパ','🇦🇱':'ヨーロッパ','🇦🇿':'コーカサス・中央アジア','🇬🇪':'コーカサス・中央アジア','🇦🇲':'コーカサス・中央アジア',
    '🇺🇸':'北アメリカ','🇨🇦':'北アメリカ','🇲🇽':'北アメリカ',
    '🇧🇷':'南アメリカ','🇵🇪':'南アメリカ','🇦🇷':'南アメリカ','🇨🇱':'南アメリカ','🇧🇴':'南アメリカ','🇨🇴':'南アメリカ','🇪🇨':'南アメリカ','🇵🇾':'南アメリカ','🇺🇾':'南アメリカ','🇻🇪':'南アメリカ','🇬🇾':'南アメリカ','🇸🇷':'南アメリカ',
    '🇬🇹':'中米・カリブ','🇲🇽':'中米・カリブ','🇨🇺':'中米・カリブ','🇩🇴':'中米・カリブ','🇯🇲':'中米・カリブ','🇭🇳':'中米・カリブ','🇵🇦':'中米・カリブ','🇨🇷':'中米・カリブ','🇸🇻':'中米・カリブ','🇳🇮':'中米・カリブ','🇧🇿':'中米・カリブ','🇹🇹':'中米・カリブ',
    '🇪🇬':'アフリカ・北アフリカ','🇲🇦':'アフリカ・北アフリカ','🇹🇳':'アフリカ・北アフリカ','🇩🇿':'アフリカ・北アフリカ','🇱🇾':'アフリカ・北アフリカ','🇸🇩':'アフリカ・北アフリカ',
    '🇪🇹':'アフリカ・サブサハラ','🇿🇼':'アフリカ・サブサハラ','🇿🇦':'アフリカ・サブサハラ','🇳🇦':'アフリカ・サブサハラ','🇸🇳':'アフリカ・サブサハラ','🇹🇿':'アフリカ・サブサハラ','🇰🇪':'アフリカ・サブサハラ','🇺🇬':'アフリカ・サブサハラ','🇷🇼':'アフリカ・サブサハラ','🇲🇿':'アフリカ・サブサハラ','🇲🇼':'アフリカ・サブサハラ','🇿🇲':'アフリカ・サブサハラ','🇲🇬':'アフリカ・サブサハラ','🇬🇭':'アフリカ・サブサハラ','🇨🇲':'アフリカ・サブサハラ','🇨🇩':'アフリカ・サブサハラ','🇨🇬':'アフリカ・サブサハラ','🇬🇦':'アフリカ・サブサハラ','🇧🇯':'アフリカ・サブサハラ','🇨🇮':'アフリカ・サブサハラ','🇲🇱':'アフリカ・サブサハラ','🇳🇪':'アフリカ・サブサハラ','🇸🇱':'アフリカ・サブサハラ','🇩🇯':'アフリカ・サブサハラ','🇸🇴':'アフリカ・サブサハラ','🇧🇼':'アフリカ・サブサハラ','🇲🇺':'アフリカ・サブサハラ','🇸🇿':'アフリカ・サブサハラ','🇱🇸':'アフリカ・サブサハラ','🇪🇷':'アフリカ・サブサハラ','🇳🇬':'アフリカ・サブサハラ',
    '🇮🇱':'中東','🇯🇴':'中東','🇱🇧':'中東','🇸🇾':'中東','🇮🇶':'中東','🇮🇷':'中東','🇸🇦':'中東','🇾🇪':'中東','🇴🇲':'中東','🇦🇪':'中東','🇶🇦':'中東','🇧🇭':'中東','🇰🇼':'中東',
    '🇦🇺':'オセアニア','🇳🇿':'オセアニア','🇵🇬':'オセアニア','🇫🇯':'オセアニア','🇸🇧':'オセアニア','🇻🇺':'オセアニア',
    '🇺🇿':'コーカサス・中央アジア'
  };
  var REGION_ORDER = ['アジア','ヨーロッパ','アフリカ・サブサハラ','アフリカ・北アフリカ','中東','北アメリカ','南アメリカ','中米・カリブ','コーカサス・中央アジア','オセアニア','その他'];
  var REGION_COLORS = {'アジア':'#e3a838','ヨーロッパ':'#58a6ff','アフリカ・サブサハラ':'#3fb950','アフリカ・北アフリカ':'#7ee787','中東':'#f0883e','北アメリカ':'#a371f7','南アメリカ':'#79c0ff','中米・カリブ':'#d2a8ff','コーカサス・中央アジア':'#ffa657','オセアニア':'#39d353','その他':'#484f58'};
  var TYPE_COLORS = {'文化遺産':'#e3a838','自然遺産':'#3fb950','複合遺産':'#a371f7'};

  var EUROPE_IDXS = [];
  var AFRICA_IDXS = [];
  var JAPAN_IDXS = [];
  for (var ri = 0; ri < HERITAGE.length; ri++) {
    var rg = REGION_MAP[HERITAGE[ri].f] || '';
    if (rg === 'ヨーロッパ') EUROPE_IDXS.push(ri);
    if (rg === 'アフリカ・サブサハラ' || rg === 'アフリカ・北アフリカ') AFRICA_IDXS.push(ri);
    if (HERITAGE[ri].f === '🇯🇵') JAPAN_IDXS.push(ri);
  }
  EUROPE_IDXS.sort(function(a, b) { return HERITAGE[b].lon - HERITAGE[a].lon; });
  AFRICA_IDXS.sort(function(a, b) { return HERITAGE[b].lon - HERITAGE[a].lon; });
  var JAPAN_PANEL_IDXS = JAPAN_IDXS.slice().sort(function(a, b) { return HERITAGE[b].y - HERITAGE[a].y; });
  var JAPAN_TOUR_IDXS  = JAPAN_IDXS.slice().sort(function(a, b) { return HERITAGE[a].y - HERITAGE[b].y; });

  function showTourPanel(idxs, title) {
    tourPanelTitle.textContent = title;
    tourPanelCount.textContent = idxs.length + '件';
    var html = '';
    for (var ti = 0; ti < idxs.length; ti++) {
      var h = HERITAGE[idxs[ti]];
      var col = typeColor(h.t);
      html += '<div class="tour-item" id="tour-item-' + idxs[ti] + '" data-hidx="' + idxs[ti] + '">' +
        '<span class="tour-item-num">' + (ti + 1) + '</span>' +
        '<span style="font-size:16px;flex-shrink:0">' + h.e + '</span>' +
        '<div class="tour-item-body">' +
          '<div class="tour-item-name">' + h.f + ' ' + h.n + '</div>' +
          '<div class="tour-item-meta" style="color:' + col + '">' + h.t + ' · ' + h.c + ' ' + h.y + '年</div>' +
        '</div>' +
        '</div>';
    }
    tourListScroll.innerHTML = html;
    var tourItems = tourListScroll.querySelectorAll('.tour-item');
    tourItems.forEach(function(el) {
      el.addEventListener('click', function() {
        var hidx = parseInt(el.getAttribute('data-hidx'));
        showMarkerTooltip(hidx, 0, 0);
      });
    });
    if (sideHeader) sideHeader.style.display = 'none';
    siteList.style.display = 'none';
    tourPanel.classList.add('visible');
  }

  function hideTourPanel() {
    tourPanel.classList.remove('visible');
    siteList.style.display = '';
    if (sideHeader) sideHeader.style.display = '';
    tourListScroll.innerHTML = '';
  }

  function highlightTourItem(idx) {
    var prev = tourListScroll.querySelector('.tour-item.active');
    if (prev) prev.classList.remove('active');
    var el = document.getElementById('tour-item-' + idx);
    if (el) {
      el.classList.add('active');
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  var europeTourActive = false;
  var europeTourPos = 0;
  var europeTourTimer = null;
  var TOUR_INTERVAL = 5000;

  function stopEuropeTour() {
    europeTourActive = false;
    if (europeTourTimer !== null) { clearTimeout(europeTourTimer); europeTourTimer = null; }
    if (btnEuropeTour) { btnEuropeTour.classList.remove('active'); btnEuropeTour.textContent = '🏰 ヨーロッパ巡回'; }
    hideTourPanel();
  }

  function nextEuropeSite() {
    if (!europeTourActive) return;
    if (EUROPE_IDXS.length === 0) { stopEuropeTour(); return; }
    var idx = EUROPE_IDXS[europeTourPos % EUROPE_IDXS.length];
    europeTourPos++;
    showMarkerTooltip(idx, 0, 0);
    highlightTourItem(idx);
    europeTourTimer = setTimeout(nextEuropeSite, TOUR_INTERVAL);
  }

  function startEuropeTour() {
    stopAmericaTour();
    stopAfricaTour();
    stopJapanTour();
    europeTourActive = true;
    europeTourPos = 0;
    if (btnEuropeTour) { btnEuropeTour.classList.add('active'); btnEuropeTour.textContent = '⏹ 巡回停止'; }
    autoRot = false;
    btnAutoRot.textContent = '▶ 回転';
    btnAutoRot.classList.add('active');
    showTourPanel(EUROPE_IDXS, '🏰 ヨーロッパ巡回');
    nextEuropeSite();
  }

  if (btnEuropeTour) {
    btnEuropeTour.addEventListener('click', function() {
      if (europeTourActive) { stopEuropeTour(); } else { startEuropeTour(); }
    });
  }

  var africaTourActive = false;
  var africaTourPos = 0;
  var africaTourTimer = null;

  function stopAfricaTour() {
    africaTourActive = false;
    if (africaTourTimer !== null) { clearTimeout(africaTourTimer); africaTourTimer = null; }
    if (btnAfricaTour) { btnAfricaTour.classList.remove('active'); btnAfricaTour.textContent = '🌍 アフリカ巡回'; }
    hideTourPanel();
  }

  function nextAfricaSite() {
    if (!africaTourActive) return;
    if (AFRICA_IDXS.length === 0) { stopAfricaTour(); return; }
    var idx = AFRICA_IDXS[africaTourPos % AFRICA_IDXS.length];
    africaTourPos++;
    showMarkerTooltip(idx, 0, 0);
    highlightTourItem(idx);
    africaTourTimer = setTimeout(nextAfricaSite, TOUR_INTERVAL);
  }

  function startAfricaTour() {
    stopAmericaTour();
    stopEuropeTour();
    stopJapanTour();
    africaTourActive = true;
    africaTourPos = 0;
    if (btnAfricaTour) { btnAfricaTour.classList.add('active'); btnAfricaTour.textContent = '⏹ 巡回停止'; }
    autoRot = false;
    btnAutoRot.textContent = '▶ 回転';
    btnAutoRot.classList.add('active');
    showTourPanel(AFRICA_IDXS, '🌍 アフリカ巡回');
    nextAfricaSite();
  }

  if (btnAfricaTour) {
    btnAfricaTour.addEventListener('click', function() {
      if (africaTourActive) { stopAfricaTour(); } else { startAfricaTour(); }
    });
  }

  var btnJapanTour = document.getElementById('btnJapanTour');
  var japanTourActive = false;
  var japanTourPos = 0;
  var japanTourTimer = null;

  function stopJapanTour() {
    japanTourActive = false;
    if (japanTourTimer !== null) { clearTimeout(japanTourTimer); japanTourTimer = null; }
    if (btnJapanTour) { btnJapanTour.classList.remove('active'); btnJapanTour.textContent = '🗾 日本巡回'; }
    hideTourPanel();
  }

  function nextJapanSite() {
    if (!japanTourActive) return;
    if (JAPAN_TOUR_IDXS.length === 0) { stopJapanTour(); return; }
    var idx = JAPAN_TOUR_IDXS[japanTourPos % JAPAN_TOUR_IDXS.length];
    japanTourPos++;
    showMarkerTooltip(idx, 0, 0);
    highlightTourItem(idx);
    japanTourTimer = setTimeout(nextJapanSite, TOUR_INTERVAL);
  }

  function startJapanTour() {
    stopAmericaTour();
    stopEuropeTour();
    stopAfricaTour();
    japanTourActive = true;
    japanTourPos = 0;
    if (btnJapanTour) { btnJapanTour.classList.add('active'); btnJapanTour.textContent = '⏹ 巡回停止'; }
    autoRot = false;
    btnAutoRot.textContent = '▶ 回転';
    btnAutoRot.classList.add('active');
    showTourPanel(JAPAN_PANEL_IDXS, '🗾 日本巡回');
    nextJapanSite();
  }

  if (btnJapanTour) {
    btnJapanTour.addEventListener('click', function() {
      if (japanTourActive) { stopJapanTour(); } else { startJapanTour(); }
    });
  }

  function buildStats() {
    var regionMap = {}, countryMap = {}, typeMap = {}, decadeMap = {};
    var total = HERITAGE.length;
    for (var i = 0; i < HERITAGE.length; i++) {
      var h = HERITAGE[i];
      var region = REGION_MAP[h.f] || 'その他';
      regionMap[region] = (regionMap[region] || 0) + 1;
      var ckey = h.f + ' ' + h.c;
      countryMap[ckey] = (countryMap[ckey] || 0) + 1;
      typeMap[h.t] = (typeMap[h.t] || 0) + 1;
      var decade = Math.floor(h.y / 10) * 10 + 's';
      decadeMap[decade] = (decadeMap[decade] || 0) + 1;
    }
    return {total:total, region:regionMap, country:countryMap, type:typeMap, decade:decadeMap};
  }

  function makeBars(data, maxVal, colors, order, total) {
    var keys = order ? order.filter(function(k){ return data[k]; }) : Object.keys(data).sort(function(a,b){ return data[b]-data[a]; });
    var html = '';
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i]; var v = data[k]; if (!v) continue;
      var pct = Math.round(v/total*100);
      var barW = Math.round(v/maxVal*100);
      var col = (colors && colors[k]) ? colors[k] : '#58a6ff';
      html += '<div class="stats-bar-row">';
      html += '<div class="stats-bar-label" title="' + k + '">' + k + '</div>';
      html += '<div class="stats-bar-track"><div class="stats-bar-fill" style="width:' + barW + '%;background:' + col + ';"></div></div>';
      html += '<div class="stats-bar-num">' + v + ' <span style="color:#484f58;font-size:10px;">(' + pct + '%)</span></div>';
      html += '</div>';
    }
    return html;
  }

  function renderStatsTab(tab, stats) {
    var body = document.getElementById('stats-body');
    var html = '';
    if (tab === 'region') {
      var maxV = 0;
      for (var k in stats.region) { if (stats.region[k] > maxV) maxV = stats.region[k]; }
      html += '<div class="stats-section-title">地域別件数（全' + stats.total + '件）</div>';
      html += makeBars(stats.region, maxV, REGION_COLORS, REGION_ORDER, stats.total);
    } else if (tab === 'country') {
      var pairs = [];
      for (var k in stats.country) { pairs.push([k, stats.country[k]]); }
      pairs.sort(function(a,b){ return b[1]-a[1]; });
      pairs = pairs.slice(0,30);
      var maxV = pairs[0] ? pairs[0][1] : 1;
      html += '<div class="stats-section-title">国別件数 Top30（全' + stats.total + '件）</div>';
      for (var i = 0; i < pairs.length; i++) {
        var k = pairs[i][0]; var v = pairs[i][1];
        var pct = Math.round(v/stats.total*100);
        var barW = Math.round(v/maxV*100);
        html += '<div class="stats-bar-row">';
        html += '<div class="stats-bar-label" title="' + k + '">' + (i+1) + '. ' + k + '</div>';
        html += '<div class="stats-bar-track"><div class="stats-bar-fill" style="width:' + barW + '%;background:#58a6ff;"></div></div>';
        html += '<div class="stats-bar-num">' + v + ' <span style="color:#484f58;font-size:10px;">(' + pct + '%)</span></div>';
        html += '</div>';
      }
    } else if (tab === 'type') {
      var total = stats.total;
      var cvs = document.createElement('canvas'); cvs.width = 160; cvs.height = 160;
      var ctx = cvs.getContext('2d');
      var types = Object.keys(TYPE_COLORS); var startA = -Math.PI/2;
      for (var i = 0; i < types.length; i++) {
        var v = stats.type[types[i]] || 0;
        var sweep = (v/total) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(80,80); ctx.arc(80,80,72,startA,startA+sweep);
        ctx.closePath(); ctx.fillStyle = TYPE_COLORS[types[i]]; ctx.fill();
        startA += sweep;
      }
      ctx.beginPath(); ctx.arc(80,80,36,0,Math.PI*2); ctx.fillStyle='#0d1117'; ctx.fill();
      html += '<div class="stats-section-title">種別内訳</div>';
      html += '<div style="display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap;">';
      html += '<div class="stats-donut-wrap">' + cvs.outerHTML + '</div>';
      html += '<div style="flex:1;min-width:160px;padding-top:8px;">';
      for (var i = 0; i < types.length; i++) {
        var v = stats.type[types[i]] || 0;
        var pct = Math.round(v/total*100);
        html += '<div class="stats-legend-item">';
        html += '<div class="stats-legend-dot" style="background:' + TYPE_COLORS[types[i]] + ';"></div>';
        html += '<span style="font-weight:600;color:' + TYPE_COLORS[types[i]] + ';">' + types[i] + '</span>';
        html += '<span style="color:#8b949e;margin-left:auto;">' + v + '件 (' + pct + '%)</span>';
        html += '</div>';
      }
      html += '</div></div>';
    } else if (tab === 'decade') {
      var decades = Object.keys(stats.decade).sort();
      var maxV = 0;
      for (var i = 0; i < decades.length; i++) { if (stats.decade[decades[i]] > maxV) maxV = stats.decade[decades[i]]; }
      html += '<div class="stats-section-title">登録年代別（全' + stats.total + '件）</div>';
      for (var i = 0; i < decades.length; i++) {
        var d = decades[i]; var v = stats.decade[d];
        var pct = Math.round(v/stats.total*100);
        var barW = Math.round(v/maxV*100);
        html += '<div class="stats-bar-row">';
        html += '<div class="stats-bar-label">' + d + '</div>';
        html += '<div class="stats-bar-track"><div class="stats-bar-fill" style="width:' + barW + '%;background:#f0883e;"></div></div>';
        html += '<div class="stats-bar-num">' + v + ' <span style="color:#484f58;font-size:10px;">(' + pct + '%)</span></div>';
        html += '</div>';
      }
    }
    body.innerHTML = html;
  }

  var statsOverlay = document.getElementById('stats-overlay');
  var currentStatsTab = 'region';
  var cachedStats = null;

  document.getElementById('btnStats').addEventListener('click', function() {
    if (!cachedStats) cachedStats = buildStats();
    document.getElementById('stats-total-badge').textContent = '全' + cachedStats.total + '件';
    statsOverlay.style.display = 'flex';
    renderStatsTab(currentStatsTab, cachedStats);
  });

  document.getElementById('btnStatsClose').addEventListener('click', function() {
    statsOverlay.style.display = 'none';
  });

  statsOverlay.addEventListener('click', function(e) {
    if (e.target === statsOverlay) statsOverlay.style.display = 'none';
  });

  var statsTabs = document.querySelectorAll('.stats-tab');
  for (var sti = 0; sti < statsTabs.length; sti++) {
    statsTabs[sti].addEventListener('click', function() {
      for (var j = 0; j < statsTabs.length; j++) statsTabs[j].classList.remove('active');
      this.classList.add('active');
      currentStatsTab = this.getAttribute('data-tab');
      if (!cachedStats) cachedStats = buildStats();
      renderStatsTab(currentStatsTab, cachedStats);
    });
  }

  var tooltip = document.getElementById('mk-tooltip');
  var activeIdx = -1;
  var canvasRect = {left:0, top:0, width:0, height:0};

  function updateCanvasRect() { canvasRect = canvas.getBoundingClientRect(); }
  window.addEventListener('resize', updateCanvasRect);
  updateCanvasRect();

  landingOverlayEl = document.getElementById('landing-overlay');
  landingTitleEl   = document.getElementById('landing-title');
  landingSubEl     = document.getElementById('landing-sub');
  landingStatusEl  = document.getElementById('landing-status');
  landingProgEl    = document.getElementById('landing-prog');
  landingCityListEl = document.getElementById('landing-city-list');
  landingSpinToggleEl = document.getElementById('landing-spin-toggle');
  cityMarkersDiv = document.getElementById('city-markers-div');
  var landingExitBtn = document.getElementById('landing-exit');
  if (landingExitBtn) landingExitBtn.addEventListener('click', stopLanding);
  if (landingSpinToggleEl) {
    landingSpinToggleEl.addEventListener('click', function() {
      spin360Enabled = !spin360Enabled;
      if(spin360Enabled) {
        landingSpinToggleEl.classList.add('active');
        landingSpinToggleEl.textContent = '🔄 360°スイープ ON';
      } else {
        landingSpinToggleEl.classList.remove('active');
        landingSpinToggleEl.textContent = '🔄 360°スイープ';
        landingSpinAngle = 0;
      }
    });
  }

  function hideTooltip() { tooltip.style.opacity = '0'; activeIdx = -1; }

  function positionTooltip(vx, vy) {
    var isNearTop = vy < canvasRect.top + 80;
    tooltip.style.left = vx + 'px';
    tooltip.style.top  = vy + 'px';
    if (isNearTop) { tooltip.classList.add('below'); } else { tooltip.classList.remove('below'); }
  }

  function showMarkerTooltip(idx, vx, vy) {
    var d = HERITAGE[idx];
    var col = typeColor(d.t);
    var cityIcon = hasCityDataSet[d.n] ? ' 🌆' : '';
    tooltip.innerHTML = '<div class="tt-name">' + d.e + ' ' + d.f + ' ' + d.n + cityIcon + '</div><div class="tt-sub"><span style="color:' + col + ';font-weight:600">' + d.t + '</span>  ' + d.c + '  ' + d.y + '年登録</div><div style="margin-top:7px;text-align:center;"><button id="tt-land-btn" style="background:#0c2d1a;border:1px solid #3fb950;border-radius:6px;color:#3fb950;font-size:11px;padding:4px 12px;cursor:pointer;font-family:inherit;">🚶 地表に降り立つ</button></div>';
    var landBtn = document.getElementById('tt-land-btn');
    if (landBtn) {
      (function(ci) {
        landBtn.addEventListener('click', function(e) { e.stopPropagation(); startLanding(ci); });
      })(idx);
    }
    if (vx === 0 && vy === 0) {
      var cx = canvasRect.left + canvasRect.width / 2;
      var cy = canvasRect.top + canvasRect.height / 2;
      positionTooltip(cx, cy);
    } else {
      positionTooltip(vx, vy);
    }
    tooltip.style.opacity = '1';
    activeIdx = idx;
    flyTo(d.lat, d.lon);
  }

  // Build marker DOM elements
  var mkEls = [];
  for (var i = 0; i < HERITAGE.length; i++) {
    var d = HERITAGE[i];
    var el = document.createElement('div');
    el.className = 'mk';
    el.textContent = d.e;
    el.style.opacity = '0';
    (function(idx) {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        var r = el.getBoundingClientRect();
        showMarkerTooltip(idx, r.left + r.width/2, r.top + r.height/2);
      });
      el.addEventListener('touchend', function(e) {
        e.preventDefault(); e.stopPropagation();
        var r = el.getBoundingClientRect();
        showMarkerTooltip(idx, r.left + r.width/2, r.top + r.height/2);
      });
    })(i);
    markersDiv.appendChild(el);
    mkEls.push({el: el, pos3d: latLonTo3D(d.lat, d.lon)});
  }

  // Build proximity list DOM (pre-create all items)
  var listItemEls = HERITAGE.map(function(d, i) {
    var col = typeColor(d.t);
    var bg = thumbBg(d.t);
    var el = document.createElement('div');
    el.className = 'site-item';
    el.innerHTML =
      '<div class="site-thumb" style="background:' + bg + '">' + d.e + '</div>' +
      '<div class="site-body">' +
        '<div class="site-top">' +
          '<span class="site-flag">' + d.f + '</span>' +
          '<span class="site-name">' + d.n + '</span>' +
        '</div>' +
        '<div class="site-meta"><span class="type-label" style="color:' + col + '">' + d.t + '</span> · ' + d.c + ' ' + d.y + '年</div>' +
      '</div>';
    el.addEventListener('click', function() { showMarkerTooltip(i, 0, 0); });
    siteList.appendChild(el);
    return el;
  });

  var searchText = '';
  var listUpdateTick = 0;

  function updateProximityList() {
    var order = HERITAGE.map(function(d, i) {
      var p = mkEls[i].pos3d;
      var mz = model[2]*p[0] + model[6]*p[1] + model[10]*p[2];
      return {i: i, mz: mz};
    });
    order.sort(function(a, b) { return b.mz - a.mz; });

    var q = searchText.toLowerCase();
    var visible = 0;
    var frag = document.createDocumentFragment();
    var hidden = [];
    order.forEach(function(item) {
      var d = HERITAGE[item.i];
      var show = !q || d.n.indexOf(q) >= 0 || d.c.indexOf(q) >= 0 || d.t.indexOf(q) >= 0;
      if (show) { frag.appendChild(listItemEls[item.i]); visible++; }
      else { hidden.push(listItemEls[item.i]); }
    });
    hidden.forEach(function(el) { frag.appendChild(el); });
    siteList.appendChild(frag);

    // Toggle visibility
    order.forEach(function(item) {
      var d = HERITAGE[item.i];
      var show = !q || d.n.indexOf(q) >= 0 || d.c.indexOf(q) >= 0 || d.t.indexOf(q) >= 0;
      listItemEls[item.i].style.display = show ? '' : 'none';
    });

    // Highlight active
    listItemEls.forEach(function(el, i) { el.classList.toggle('active', i === activeIdx); });
    resultCount.textContent = q ? (visible + ' / ' + HERITAGE.length + ' 件') : (HERITAGE.length + ' 件');
  }

  searchInput.addEventListener('input', function() {
    searchText = searchInput.value;
    updateProximityList();
  });

  canvas.addEventListener('click', function() { hideTooltip(); stopAmericaTour(); stopEuropeTour(); stopAfricaTour(); });

  gl.enable(gl.DEPTH_TEST);

  var startTime = performance.now();
  var frames = 0, lastFps = startTime;

  function frame(now) {
    requestAnimationFrame(frame);
    resize();
    var W = canvas.width, H = canvas.height;
    if (W === 0 || H === 0) return;
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0.02, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (landingMode && landingPhase > 0) {
      if (landingPhase === 1) {
        var lp1 = Math.min((now - landingPhaseStart) / LANDING_ZOOM_IN_DUR, 1);
        var le1 = lp1 * lp1 * (3 - 2 * lp1);
        zoom = landingZoomFrom + (LANDING_ZOOM_TARGET - landingZoomFrom) * le1;
        if (landingStatusEl) landingStatusEl.textContent = '降下中...';
        if (landingProgEl) landingProgEl.style.width = Math.round(le1 * 35) + '%';
        if (lp1 >= 1) {
          landingPhase = 2;
          landingPhaseStart = now;
          landingSpinAngle = 0;
          zoom = LANDING_ZOOM_TARGET;
        }
      } else if (landingPhase === 2) {
        var lp2 = Math.min((now - landingPhaseStart) / LANDING_ROT_DUR, 1);
        if (spin360Enabled) {
          landingSpinAngle = lp2 * Math.PI * 2;
          var deg2 = Math.round(lp2 * 360);
          if (landingStatusEl) landingStatusEl.textContent = '地表を見渡し中... ' + deg2 + '°';
        } else {
          landingSpinAngle = 0;
          if (landingStatusEl) landingStatusEl.textContent = '地表を見渡し中';
        }
        if (landingProgEl) landingProgEl.style.width = Math.round(35 + lp2 * 40) + '%';
        if (lp2 >= 1) {
          landingPhase = 3;
          landingPhaseStart = now;
          landingZoomOutFrom = zoom;
        }
      } else if (landingPhase === 3) {
        var lp3 = Math.min((now - landingPhaseStart) / LANDING_ZOOM_OUT_DUR, 1);
        var le3 = lp3 * lp3 * (3 - 2 * lp3);
        zoom = landingZoomOutFrom + (LANDING_ZOOM_RETURN - landingZoomOutFrom) * le3;
        rotXv = landingRotXFrom + (0.3 - landingRotXFrom) * le3;
        if (landingStatusEl) landingStatusEl.textContent = '帰還中...';
        if (landingProgEl) landingProgEl.style.width = Math.round(75 + le3 * 25) + '%';
        if (lp3 >= 1) { landingSpinAngle = 0; stopLanding(); }
      }
    } else if (flyTarget !== null) {
      var fp = Math.min((now - flyStart) / FLY_DUR, 1);
      var fe = fp * fp * (3 - 2 * fp);
      rotYv = flyFrom.ry + (flyTarget.ry - flyFrom.ry) * fe;
      rotXv = flyFrom.rx + (flyTarget.rx - flyFrom.rx) * fe;
      if (fp >= 1) flyTarget = null;
    } else {
      rotSpd = parseFloat(rotSpdEl.value);
      if (autoRot) rotYv += 0.003 * rotSpd;
      var wasSpinning = Math.abs(momentumY) > 0.0002 || Math.abs(momentumX) > 0.0002;
      if (Math.abs(momentumY) > 0.0002) { rotYv += momentumY; momentumY *= MOMENTUM_DECAY; } else { momentumY = 0; }
      if (!axisLocked && Math.abs(momentumX) > 0.0002) { rotXv = clampElev(rotXv + momentumX); momentumX *= MOMENTUM_DECAY; } else { momentumX = 0; }
      if (axisLocked) rotXv = 0;
      var nowSpinning = Math.abs(momentumY) > 0.0002 || Math.abs(momentumX) > 0.0002;
      if (wasSpinning && !nowSpinning && !autoRot) {
        var bestIdx = -1, bestMz = -1;
        for (var si = 0; si < HERITAGE.length; si++) {
          var sp = mkEls[si] ? mkEls[si].pos3d : null;
          if (!sp) continue;
          var smz = model[2]*sp[0] + model[6]*sp[1] + model[10]*sp[2];
          if (smz > bestMz) { bestMz = smz; bestIdx = si; }
        }
        if (bestIdx >= 0) {
          var bd = HERITAGE[bestIdx];
          showMarkerTooltip(bestIdx, 0, 0);
        }
      }
    }

    var landFov = landingMode ? Math.PI / 2.8 : Math.PI / 4;
    var landNear = landingMode ? 0.02 : 0.1;
    persp(proj, landFov, W / H, landNear, 100);
    trans(view, 0, 0, -zoom);
    rotY(ry, rotYv); rotZ(tz, axialTilt); rotX(rx, rotXv);
    mul(tmp2, tz, ry);
    mul(model, rx, tmp2);
    if (landingMode && landingPhase === 2 && landingIdx >= 0) {
      var lsite = HERITAGE[landingIdx];
      var lsp = latLonTo3D(lsite.lat, lsite.lon);
      rotAround(landSpin, lsp[0], lsp[1], lsp[2], landingSpinAngle);
      mul(tmp2, model, landSpin);
      model.set(tmp2);
    }
    mul(tmp, view, model);
    mul(mvp, proj, tmp);

    if (autoRot && isListMode && flyTarget === null) {
      var nearestIdx2 = -1, nearestMz2 = -1;
      for (var si2 = 0; si2 < HERITAGE.length; si2++) {
        var sp2 = mkEls[si2] ? mkEls[si2].pos3d : null;
        if (!sp2) continue;
        var smz2 = model[2]*sp2[0] + model[6]*sp2[1] + model[10]*sp2[2];
        if (smz2 > nearestMz2) { nearestMz2 = smz2; nearestIdx2 = si2; }
      }
      if (nearestIdx2 >= 0 && nearestIdx2 !== activeIdx) {
        activeIdx = nearestIdx2;
        var nd = HERITAGE[nearestIdx2];
        var nc = typeColor(nd.t);
        tooltip.innerHTML = '<div class="tt-name">' + nd.e + ' ' + nd.f + ' ' + nd.n + '</div><div class="tt-sub"><span style="color:' + nc + ';font-weight:600">' + nd.t + '</span>  ' + nd.c + '  ' + nd.y + '年登録</div>';
        tooltip.style.opacity = '1';
      }
    }

    var sd = getSunDir();
    gl.uniform3f(uLight, sd[0], sd[1], sd[2]);
    gl.uniformMatrix4fv(uMVP,   false, mvp);
    gl.uniformMatrix4fv(uModel, false, model);

    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texEarth);
    gl.drawElements(gl.TRIANGLES, idxs.length, gl.UNSIGNED_SHORT, 0);

    for (var mi = 0; mi < mkEls.length; mi++) {
      var mk = mkEls[mi];
      var mp = mk.pos3d;
      var mz = model[2]*mp[0] + model[6]*mp[1] + model[10]*mp[2];
      if (mz > 0.12) {
        var mcx = mvp[0]*mp[0] + mvp[4]*mp[1] + mvp[8]*mp[2]  + mvp[12];
        var mcy = mvp[1]*mp[0] + mvp[5]*mp[1] + mvp[9]*mp[2]  + mvp[13];
        var mcw = mvp[3]*mp[0] + mvp[7]*mp[1] + mvp[11]*mp[2] + mvp[15];
        if (mcw > 0) {
          var px = (mcx/mcw+1)*0.5*W;
          var py = (1-mcy/mcw)*0.5*H;
          mk.el.style.left = px + 'px';
          mk.el.style.top  = py + 'px';
          mk.el.style.opacity = '1';
          if (mi === activeIdx) {
            positionTooltip(canvasRect.left + px, canvasRect.top + py);
            tooltip.style.opacity = '1';
          }
        } else {
          mk.el.style.opacity = '0';
          if (mi === activeIdx) hideTooltip();
        }
      } else {
        mk.el.style.opacity = '0';
        if (mi === activeIdx) hideTooltip();
      }
    }

    for (var ci = 0; ci < cityMkEls.length; ci++) {
      var cmk = cityMkEls[ci];
      var cp = cmk.pos3d;
      var cmz = model[2]*cp[0] + model[6]*cp[1] + model[10]*cp[2];
      if (cmz > 0.05) {
        var ccx = mvp[0]*cp[0] + mvp[4]*cp[1] + mvp[8]*cp[2]  + mvp[12];
        var ccy = mvp[1]*cp[0] + mvp[5]*cp[1] + mvp[9]*cp[2]  + mvp[13];
        var ccw = mvp[3]*cp[0] + mvp[7]*cp[1] + mvp[11]*cp[2] + mvp[15];
        if (ccw > 0) {
          var cpx = (ccx/ccw+1)*0.5*W;
          var cpy = (1-ccy/ccw)*0.5*H;
          cmk.el.style.left = cpx + 'px';
          cmk.el.style.top  = cpy + 'px';
          cmk.el.style.opacity = '1';
        } else {
          cmk.el.style.opacity = '0';
        }
      } else {
        cmk.el.style.opacity = '0';
      }
    }

    // Update proximity list every 30 frames
    listUpdateTick++;
    if (listUpdateTick >= 30) {
      listUpdateTick = 0;
      updateProximityList();
    }

    var tanHalfFov = Math.tan(Math.PI / 8);
    var sinAlpha = 1 / zoom;
    var cosAlpha = Math.sqrt(1 - sinAlpha * sinAlpha);
    var tanAlpha = sinAlpha / cosAlpha;
    var globeR = Math.round((H / 2) * tanAlpha / tanHalfFov);
    var gcx = Math.round(W / 2);
    var gcy = Math.round(H / 2);
    dbgGlobeRect.style.left = (gcx - globeR) + 'px';
    dbgGlobeRect.style.top  = (gcy - globeR) + 'px';
    dbgGlobeRect.style.width  = (globeR * 2) + 'px';
    dbgGlobeRect.style.height = (globeR * 2) + 'px';
    var visHalfDeg = Math.round(Math.asin(sinAlpha) * 180 / Math.PI);
    var zoomR = Math.round(globeR / zoom);
    dbgZoomRect.style.left = (gcx - zoomR) + 'px';
    dbgZoomRect.style.top  = (gcy - zoomR) + 'px';
    dbgZoomRect.style.width  = (zoomR * 2) + 'px';
    dbgZoomRect.style.height = (zoomR * 2) + 'px';
    dbgInfo.innerHTML =
      'Canvas: ' + W + ' x ' + H + '<br>' +
      'Globe: (' + (gcx - globeR) + ', ' + (gcy - globeR) + ') - (' + (gcx + globeR) + ', ' + (gcy + globeR) + ') r=' + globeR + '<br>' +
      'Zoom: ' + zoom.toFixed(2) + 'x  |  Visible: +/-' + visHalfDeg + 'deg';

    frames++;
    var dt = now - lastFps;
    if (dt >= 600) {
      var fps = Math.round(frames * 1000 / dt);
      var clock = new Date();
      var utcH = clock.getUTCHours() + clock.getUTCMinutes() / 60;
      var sunLonDeg = Math.round((12 - utcH) * 15);
      var ew = sunLonDeg >= 0 ? 'E' : 'W';
      var label = earthImg.complete && earthImg.naturalWidth > 0 ? '' : 'テクスチャ読込中 | ';
      hud.textContent = label + 'FPS: ' + fps + '  |  太陽: ' + Math.abs(sunLonDeg) + '°' + ew + '  |  ' + (autoRot ? '自転回転 ON' : '自転回転 OFF');
      frames = 0; lastFps = now;
    }
  }

  updateProximityList();
  requestAnimationFrame(frame);
})();
</script>
<script>
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(function(){});
}
</script>
</body>
</html>`;
}
