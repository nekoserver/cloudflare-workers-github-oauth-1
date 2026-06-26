function escF(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function getWebGLFaultsPage(username: string): string {
  const safeUser = escF(username);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0d1117">
<title>世界の活断層 地球儀</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { background:#000; color:#e6edf3; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:13px; height:100vh; height:100dvh; display:flex; flex-direction:column; overflow:hidden; }
.topbar { background:#0d1117; border-bottom:1px solid #30363d; padding:8px 18px; display:flex; align-items:center; gap:10px; flex-shrink:0; }
.topbar a { color:#58a6ff; text-decoration:none; font-size:12px; }
@media (display-mode: standalone) { .pwa-hide { display:none !important; } }
h1 { font-size:14px; font-weight:700; }
.badge { background:#2d1a0c; color:#f78166; font-size:10px; padding:2px 7px; border-radius:10px; font-weight:600; }
.body { display:grid; grid-template-columns:1fr 280px; grid-template-rows:1fr; flex:1; min-height:0; }
@media(max-width:800px){ .body{ grid-template-columns:1fr; } .side{ display:none; } }
.canvas-wrap { position:relative; background:#000010; overflow:hidden; }
canvas { position:absolute; inset:0; width:100%; height:100%; cursor:grab; touch-action:none; display:block; }
canvas:active { cursor:grabbing; }
.hud { position:absolute; bottom:10px; left:10px; background:rgba(0,0,0,.7); border:1px solid #30363d; border-radius:6px; padding:6px 10px; font-size:11px; font-family:monospace; color:#f78166; line-height:1.9; pointer-events:none; }
#markers { position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; overflow:hidden; }
.mk { position:absolute; transform:translate(-50%,-50%); line-height:1; font-size:13px; text-shadow:0 1px 3px #000,0 0 8px rgba(0,0,0,0.9); pointer-events:auto; cursor:pointer; user-select:none; -webkit-user-select:none; }
#mk-tooltip { position:fixed; background:rgba(13,17,23,0.97); border:1px solid #f78166; border-radius:8px; padding:8px 13px; font-size:12px; color:#e6edf3; white-space:normal; min-width:200px; max-width:280px; pointer-events:auto; opacity:0; transition:opacity .15s; z-index:60; transform:translate(-50%,-110%); line-height:1.7; }
#mk-tooltip.below { transform:translate(-50%, 14px); }
.tt-name { font-weight:700; font-size:13px; margin-bottom:3px; }
.tt-type { font-size:11px; margin-bottom:2px; }
.tt-desc { font-size:11px; color:#8b949e; }
.side { background:#0d1117; border-left:1px solid #30363d; display:flex; flex-direction:column; overflow:hidden; }
.panel-tabs { display:flex; border-bottom:1px solid #21262d; flex-shrink:0; }
.panel-tab { flex:1; padding:8px 4px; font-size:11px; font-weight:600; color:#484f58; background:none; border:none; border-bottom:2px solid transparent; cursor:pointer; transition:color .15s,border-color .15s; }
.panel-tab:hover { color:#8b949e; }
.panel-tab.active { color:#f78166; border-bottom-color:#f78166; }
.panel-body { display:none; flex:1; flex-direction:column; overflow:hidden; }
.panel-body.visible { display:flex; }
.side-header { padding:10px 10px 8px; border-bottom:1px solid #21262d; flex-shrink:0; }
.side-title { font-size:10px; font-weight:700; color:#f78166; text-transform:uppercase; letter-spacing:.5px; margin-bottom:6px; }
.filter-row { display:flex; gap:5px; flex-wrap:wrap; }
.filter-btn { background:#161b22; border:1px solid #30363d; border-radius:12px; color:#8b949e; font-size:10px; padding:3px 8px; cursor:pointer; transition:background .12s,border-color .12s,color .12s; white-space:nowrap; }
.filter-btn.active { color:#e6edf3; }
.filter-btn[data-type="subduction"].active { background:#3d0d0d; border-color:#f85149; color:#f85149; }
.filter-btn[data-type="transform"].active { background:#2d1a0c; border-color:#f78166; color:#f78166; }
.filter-btn[data-type="divergent"].active { background:#0c1f2d; border-color:#58d5ff; color:#58d5ff; }
.filter-btn[data-type="rift"].active { background:#2d2500; border-color:#e3b341; color:#e3b341; }
.filter-btn[data-type="thrust"].active { background:#1f0c2d; border-color:#d2a8ff; color:#d2a8ff; }
.list-scroll { flex:1; overflow-y:auto; overflow-x:hidden; }
.list-scroll::-webkit-scrollbar { width:4px; }
.list-scroll::-webkit-scrollbar-track { background:#0d1117; }
.list-scroll::-webkit-scrollbar-thumb { background:#30363d; border-radius:2px; }
.fault-item { display:flex; align-items:flex-start; gap:8px; padding:9px 10px; border-bottom:1px solid #161b22; cursor:pointer; transition:background .1s; border-left:3px solid transparent; }
.fault-item:hover { background:#161b22; }
.fault-item.active { background:rgba(247,129,102,0.07); border-left-color:#f78166; }
.fault-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; margin-top:3px; }
.fault-body { flex:1; min-width:0; }
.fault-name { font-size:11px; font-weight:600; color:#e6edf3; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.fault-meta { font-size:10px; color:#484f58; display:flex; align-items:center; gap:5px; }
.type-badge { font-size:9px; padding:1px 5px; border-radius:8px; font-weight:600; flex-shrink:0; }
.type-badge.subduction { background:#3d0d0d; color:#f85149; }
.type-badge.transform  { background:#2d1a0c; color:#f78166; }
.type-badge.divergent  { background:#0c1f2d; color:#58d5ff; }
.type-badge.rift       { background:#2d2500; color:#e3b341; }
.type-badge.thrust     { background:#1f0c2d; color:#d2a8ff; }
.canvas-ctrl-btns { position:absolute; top:10px; right:10px; display:flex; flex-direction:row; gap:6px; z-index:5; flex-wrap:wrap; justify-content:flex-end; max-width:60%; }
.canvas-ctrl-btn { background:rgba(13,17,23,0.88); border:1px solid #30363d; border-radius:6px; color:#e6edf3; font-size:12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; padding:6px 12px; cursor:pointer; white-space:nowrap; transition:background .15s,border-color .15s,color .15s; }
.canvas-ctrl-btn:hover { background:rgba(13,17,23,1); border-color:#f78166; }
.canvas-ctrl-btn.active { background:#2d1a0c; border-color:#f78166; color:#f78166; }
.ctrl-panel { padding:14px 12px; display:flex; flex-direction:column; gap:14px; overflow-y:auto; }
.ctrl-row { display:flex; flex-direction:column; gap:5px; }
.ctrl-label { font-size:11px; color:#8b949e; font-weight:600; }
.slider-row { display:flex; align-items:center; gap:8px; }
.slider-row input[type=range] { flex:1; accent-color:#f78166; }
.sval { font-family:monospace; font-size:11px; color:#f78166; min-width:36px; }
.ctrl-sep { border:none; border-top:1px solid #21262d; margin:0; }
.legend { display:flex; flex-direction:column; gap:8px; }
.legend-row { display:flex; align-items:center; gap:10px; font-size:12px; }
.legend-line { width:32px; height:3px; border-radius:2px; flex-shrink:0; }
.detail-panel { flex:1; overflow-y:auto; padding:12px; }
.detail-empty { color:#484f58; font-size:12px; text-align:center; padding:30px 0; }
.detail-name { font-size:14px; font-weight:700; color:#e6edf3; margin-bottom:4px; }
.detail-sub { font-size:11px; color:#8b949e; margin-bottom:12px; }
.detail-table { width:100%; border-collapse:collapse; font-size:11px; }
.detail-table td { padding:5px 0; border-bottom:1px solid #21262d; }
.detail-table td:first-child { color:#8b949e; width:80px; }
.detail-table td:last-child { color:#e6edf3; font-weight:500; }
.detail-desc { font-size:12px; color:#c9d1d9; line-height:1.6; margin-top:10px; padding-top:10px; border-top:1px solid #21262d; }
.spd-row { padding:8px 10px 6px; border-bottom:1px solid #21262d; flex-shrink:0; }
.spd-label { font-size:10px; font-weight:700; color:#f78166; text-transform:uppercase; letter-spacing:.5px; margin-bottom:4px; }
.vol-mk { position:absolute; transform:translate(-50%,-50%); line-height:1; font-size:14px; pointer-events:auto; cursor:pointer; user-select:none; -webkit-user-select:none; filter:drop-shadow(0 1px 3px rgba(0,0,0,0.9)); }
.vol-mk.active { font-size:18px; }
#vol-tooltip { position:fixed; background:rgba(13,17,23,0.97); border:1px solid #ff9500; border-radius:8px; padding:7px 12px; font-size:12px; color:#e6edf3; min-width:180px; max-width:260px; pointer-events:none; opacity:0; transition:opacity .15s; z-index:65; transform:translate(-50%,-110%); line-height:1.7; }
#vol-tooltip.below { transform:translate(-50%, 14px); }
.vol-tt-name { font-weight:700; font-size:13px; color:#ff9500; margin-bottom:2px; }
.vol-tt-sub { font-size:11px; color:#8b949e; }
.toggle-row { display:flex; align-items:center; gap:8px; }
.toggle-label { font-size:11px; color:#8b949e; flex:1; }
.toggle-btn { background:#161b22; border:1px solid #30363d; border-radius:12px; color:#8b949e; font-size:10px; padding:3px 10px; cursor:pointer; transition:all .15s; white-space:nowrap; }
.toggle-btn.on { background:#2d1a0c; border-color:#ff9500; color:#ff9500; }
.globe-icon-wrap { position:relative; cursor:help; display:inline-flex; align-items:center; }
#globe-vol-tooltip { position:fixed; background:rgba(13,17,23,0.97); border:1px solid #58a6ff; border-radius:8px; padding:8px 12px; font-size:11px; color:#e6edf3; min-width:220px; max-width:300px; max-height:320px; overflow-y:auto; pointer-events:none; opacity:0; transition:opacity .15s; z-index:100; line-height:1.7; white-space:nowrap; }
#globe-vol-tooltip::-webkit-scrollbar { width:3px; }
#globe-vol-tooltip::-webkit-scrollbar-track { background:transparent; }
#globe-vol-tooltip::-webkit-scrollbar-thumb { background:#30363d; border-radius:2px; }
.gvtt-title { font-weight:700; font-size:12px; color:#ff9500; margin-bottom:6px; border-bottom:1px solid #30363d; padding-bottom:4px; }
.gvtt-row { display:flex; align-items:baseline; gap:6px; padding:1px 0; }
.gvtt-name { font-weight:600; color:#e6edf3; flex-shrink:0; }
.gvtt-act { color:#8b949e; font-size:10px; overflow:hidden; text-overflow:ellipsis; }
.gvtt-hot { color:#ff9500; }
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
  vec3 oceanColor = vec3(0.04, 0.14, 0.42);
  vec3 baseColor = mix(earth.rgb, oceanColor, isOcean);
  float amb = 0.22;
  vec3 col = baseColor * (amb + vDiff * (1.0 - amb));
  col += vec3(0.4, 0.7, 1.0) * vSpec * isOcean * 0.6;
  col += vec3(0.2, 0.45, 1.0) * vRim * 0.45;
  col += vec3(0.08, 0.25, 0.8) * vRim * vRim * 0.2;
  gl_FragColor = vec4(col, 1.0);
}
</script>
<script id="line-vs" type="x-shader/x-vertex">
attribute vec3 aPos;
uniform mat4 uMVP;
uniform vec3 uColor;
uniform float uAlpha;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = uColor;
  vAlpha = uAlpha;
  gl_Position = uMVP * vec4(aPos, 1.0);
}
</script>
<script id="line-fs" type="x-shader/x-fragment">
precision mediump float;
varying vec3 vColor;
varying float vAlpha;
void main() {
  gl_FragColor = vec4(vColor, vAlpha);
}
</script>

<div id="globe-vol-tooltip"></div>
<div class="topbar">
  <h1><span class="globe-icon-wrap" id="globeIconWrap">🌐</span> 世界の活断層 地球儀</h1>
  <span class="badge">活断層</span>
  <span style="flex:1"></span>
  <a class="pwa-hide" href="/webgl-heritage">🏛️ 世界遺産</a>
  <a class="pwa-hide" href="/webgl-solar">☀️ 太陽系</a>
  <a class="pwa-hide" href="/settings">&#9881;</a>
  <span class="pwa-hide" style="color:#8b949e;font-size:11px">${safeUser}</span>
</div>

<div class="body">
  <div class="canvas-wrap">
    <canvas id="c"></canvas>
    <div id="markers"></div>
    <div class="hud" id="hud">テクスチャ読み込み中...</div>
    <div class="canvas-ctrl-btns">
      <button class="canvas-ctrl-btn" id="btnAxisLock">＋ 軸垂直固定</button>
      <button class="canvas-ctrl-btn" id="btnAutoRot">⏸ 自転停止</button>
      <button class="canvas-ctrl-btn" id="btnRingFire">🔥 環太平洋帯</button>
      <button class="canvas-ctrl-btn" id="btnAlpHim">⛰️ アルプス・ヒマラヤ帯</button>
      <button class="canvas-ctrl-btn" id="btnRiftTour">🌋 地溝帯</button>
      <button class="canvas-ctrl-btn" id="btnCaribbeanTour">🌊 カリブ海周辺</button>
      <button class="canvas-ctrl-btn active" id="btnVolToggle">🌋 火山 表示中</button>
    </div>
  </div>
  <div class="side">
    <div class="panel-tabs">
      <button class="panel-tab active" id="tabList">▼ 断層リスト</button>
      <button class="panel-tab" id="tabDetail">📋 詳細</button>
      <button class="panel-tab" id="tabCtrl">⚙ 設定</button>
    </div>

    <div class="panel-body visible" id="panelList">
      <div class="spd-row">
        <div class="spd-label">自転速度</div>
        <div class="slider-row">
          <input type="range" id="rotSpd" min="0" max="5" step="0.1" value="1">
          <span class="sval" id="rotSpdVal">1.0</span>
        </div>
      </div>
      <div class="side-header">
        <div class="side-title">断層タイプ フィルター</div>
        <div class="filter-row">
          <button class="filter-btn active" data-type="all">すべて</button>
          <button class="filter-btn" data-type="subduction">沈み込み帯</button>
          <button class="filter-btn" data-type="transform">横ずれ断層</button>
          <button class="filter-btn" data-type="divergent">発散境界</button>
          <button class="filter-btn" data-type="rift">地溝帯</button>
          <button class="filter-btn" data-type="thrust">逆断層</button>
        </div>
      </div>
      <div class="list-scroll" id="faultList"></div>
    </div>

    <div class="panel-body" id="panelDetail">
      <div class="detail-panel" id="detailContent">
        <div class="detail-empty">断層をクリックまたはリストから選択してください</div>
      </div>
    </div>

    <div class="panel-body" id="panelCtrl">
      <div class="ctrl-panel">
        <div class="ctrl-row">
          <div class="ctrl-label">断層線の輝度</div>
          <div class="slider-row">
            <input type="range" id="lineAlpha" min="0.3" max="1.0" step="0.05" value="0.85">
            <span class="sval" id="lineAlphaVal">0.85</span>
          </div>
        </div>
        <hr class="ctrl-sep">
        <div class="ctrl-row">
          <div class="ctrl-label">凡例</div>
          <div class="legend">
            <div class="legend-row">
              <div class="legend-line" style="background:#f85149"></div>
              <span><span style="color:#f85149;font-weight:600">沈み込み帯</span> — プレートが沈み込む境界</span>
            </div>
            <div class="legend-row">
              <div class="legend-line" style="background:#f78166"></div>
              <span><span style="color:#f78166;font-weight:600">横ずれ断層</span> — プレートが水平にすれ違う</span>
            </div>
            <div class="legend-row">
              <div class="legend-line" style="background:#58d5ff"></div>
              <span><span style="color:#58d5ff;font-weight:600">発散境界</span> — プレートが離れ海底が広がる</span>
            </div>
            <div class="legend-row">
              <div class="legend-line" style="background:#e3b341"></div>
              <span><span style="color:#e3b341;font-weight:600">地溝帯</span> — 大陸が引き裂かれる境界</span>
            </div>
            <div class="legend-row">
              <div class="legend-line" style="background:#d2a8ff"></div>
              <span><span style="color:#d2a8ff;font-weight:600">逆断層</span> — 圧縮によって生じる断層</span>
            </div>
          </div>
        </div>
        <hr class="ctrl-sep">
        <div class="ctrl-row">
          <div class="ctrl-label">レイヤー表示</div>
          <div class="toggle-row">
            <span class="toggle-label">🌋 活火山マーカー</span>
            <button class="toggle-btn on" id="volToggleCtrl">表示</button>
          </div>
        </div>
        <hr class="ctrl-sep">
        <div style="font-size:11px;color:#484f58;line-height:1.8">
          ドラッグ: 回転<br>
          ホイール: ズーム<br>
          フリック: 慣性スピン<br>
          ダブルクリック: 自動回転 ON/OFF<br>
          断層名クリック: その断層へ移動
        </div>
      </div>
    </div>
  </div>
</div>

<div id="mk-tooltip"></div>
<div id="vol-tooltip"></div>

<script>
(function() {
  var canvas = document.getElementById('c');
  var wrap = canvas.parentElement;
  var hud = document.getElementById('hud');
  var markersDiv = document.getElementById('markers');
  var faultListEl = document.getElementById('faultList');
  var detailContent = document.getElementById('detailContent');
  var tabList = document.getElementById('tabList');
  var tabDetail = document.getElementById('tabDetail');
  var tabCtrl = document.getElementById('tabCtrl');
  var panelList = document.getElementById('panelList');
  var panelDetail = document.getElementById('panelDetail');
  var panelCtrl = document.getElementById('panelCtrl');
  var rotSpdEl = document.getElementById('rotSpd');
  var rotSpdValEl = document.getElementById('rotSpdVal');
  var lineAlphaEl = document.getElementById('lineAlpha');
  var lineAlphaValEl = document.getElementById('lineAlphaVal');
  var tooltip = document.getElementById('mk-tooltip');

  var lineAlpha = 0.85;
  lineAlphaEl.addEventListener('input', function() {
    lineAlpha = parseFloat(lineAlphaEl.value);
    lineAlphaValEl.textContent = lineAlpha.toFixed(2);
  });

  tabList.addEventListener('click', function() {
    tabList.classList.add('active'); tabDetail.classList.remove('active'); tabCtrl.classList.remove('active');
    panelList.classList.add('visible'); panelDetail.classList.remove('visible'); panelCtrl.classList.remove('visible');
  });
  tabDetail.addEventListener('click', function() {
    tabDetail.classList.add('active'); tabList.classList.remove('active'); tabCtrl.classList.remove('active');
    panelDetail.classList.add('visible'); panelList.classList.remove('visible'); panelCtrl.classList.remove('visible');
  });
  tabCtrl.addEventListener('click', function() {
    tabCtrl.classList.add('active'); tabList.classList.remove('active'); tabDetail.classList.remove('active');
    panelCtrl.classList.add('visible'); panelList.classList.remove('visible'); panelDetail.classList.remove('visible');
  });

  var rotSpd = 1.0;
  rotSpdEl.addEventListener('input', function() { rotSpd = parseFloat(rotSpdEl.value); rotSpdValEl.textContent = rotSpd.toFixed(1); });

  function resize() {
    var r = wrap.getBoundingClientRect();
    var w = Math.round(r.width), h = Math.round(r.height);
    if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) { canvas.width = w; canvas.height = h; }
  }
  resize();
  window.addEventListener('resize', resize);

  var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) { hud.textContent = 'WebGL が利用できません'; return; }
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  function compileShader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  function makeProgram(vsId, fsId) {
    var p = gl.createProgram();
    gl.attachShader(p, compileShader(gl.VERTEX_SHADER, document.getElementById(vsId).textContent));
    gl.attachShader(p, compileShader(gl.FRAGMENT_SHADER, document.getElementById(fsId).textContent));
    gl.linkProgram(p);
    return p;
  }

  var prog = makeProgram('vs', 'fs');
  var lineProg = makeProgram('line-vs', 'line-fs');

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
  var uMVP   = gl.getUniformLocation(prog, 'uMVP');
  var uModel = gl.getUniformLocation(prog, 'uModel');
  var uLight = gl.getUniformLocation(prog, 'uLight');
  var uTex   = gl.getUniformLocation(prog, 'uTex');

  var lAPos  = gl.getAttribLocation(lineProg, 'aPos');
  var lUMVP  = gl.getUniformLocation(lineProg, 'uMVP');
  var lUColor = gl.getUniformLocation(lineProg, 'uColor');
  var lUAlpha = gl.getUniformLocation(lineProg, 'uAlpha');

  var texEarth = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texEarth);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([10, 25, 60, 255]));
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
    hud.textContent = '';
  };
  earthImg.onerror = function() { hud.textContent = 'テクスチャ読み込み失敗'; };
  earthImg.src = '/earth.jpg';

  function m4() { return new Float32Array(16); }
  function ident(m) { for(var i=0;i<16;i++) m[i]=0; m[0]=m[5]=m[10]=m[15]=1; return m; }
  function mul(o,a,b) { for(var i=0;i<4;i++) for(var j=0;j<4;j++){ var s=0; for(var k=0;k<4;k++) s+=a[i+k*4]*b[k+j*4]; o[i+j*4]=s; } return o; }
  function persp(m,fov,asp,near,far){ ident(m); var f=1/Math.tan(fov/2); m[0]=f/asp; m[5]=f; m[10]=(far+near)/(near-far); m[11]=-1; m[14]=2*far*near/(near-far); m[15]=0; return m; }
  function rotX(m,r){ ident(m); var c=Math.cos(r),s=Math.sin(r); m[5]=c;m[6]=s;m[9]=-s;m[10]=c; return m; }
  function rotY(m,r){ ident(m); var c=Math.cos(r),s=Math.sin(r); m[0]=c;m[2]=-s;m[8]=s;m[10]=c; return m; }
  function rotZ(m,r){ ident(m); var c=Math.cos(r),s=Math.sin(r); m[0]=c;m[1]=s;m[4]=-s;m[5]=c; return m; }
  function trans(m,x,y,z){ ident(m); m[12]=x;m[13]=y;m[14]=z; return m; }

  function latLonToXYZ(lat, lon, r) {
    var theta = (90 - lat) * Math.PI / 180;
    var phi = (lon + 180) * Math.PI / 180;
    var sinT = Math.sin(theta), cosT = Math.cos(theta);
    return [-sinT * Math.cos(phi) * r, cosT * r, sinT * Math.sin(phi) * r];
  }

  function getSunDir() {
    var now = new Date();
    var utcH = now.getUTCHours() + now.getUTCMinutes() / 60;
    var sunLon = (utcH - 12) / 24 * 2 * Math.PI;
    var start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    var doy = Math.floor((now.getTime() - start.getTime()) / 86400000);
    var sunLat = 23.45 * Math.PI / 180 * Math.sin(2 * Math.PI * (doy - 80) / 365);
    return [Math.cos(sunLat) * Math.cos(sunLon), Math.sin(sunLat), Math.cos(sunLat) * Math.sin(sunLon)];
  }

  var TYPE_COLORS = {
    subduction: [0.973, 0.318, 0.286],
    transform:  [0.969, 0.506, 0.400],
    divergent:  [0.345, 0.835, 1.000],
    rift:       [0.890, 0.702, 0.255],
    thrust:     [0.824, 0.659, 1.000]
  };
  var TYPE_NAMES = {
    subduction: '沈み込み帯',
    transform:  '横ずれ断層',
    divergent:  '発散境界',
    rift:       '地溝帯',
    thrust:     '逆断層'
  };

  var FAULTS = [
    {
      id:'san_andreas', n:'サンアンドレアス断層', t:'transform', region:'北アメリカ', country:'アメリカ合衆国', length:1300,
      maxMag:8.0, lastMajor:'1906年（サンフランシスコ地震 M7.9）',
      desc:'カリフォルニア州を縦断する太平洋プレートと北アメリカプレートの境界。年間約5cmの横ずれが発生し、「ビッグワン」と呼ばれる大地震のリスクが高い。',
      center:[36.5,-120.5],
      pts:[[32.5,-115.5],[33,-116.2],[33.5,-116.8],[34.2,-118],[34.8,-119.2],[35.5,-120.2],[36,-120.6],[36.5,-121],[37,-121.5],[37.5,-122],[38,-122.4],[38.7,-122.8],[39.5,-123.2],[40.3,-124],[40.7,-124.2]]
    },
    {
      id:'north_anatolian', n:'北アナトリア断層', t:'transform', region:'ヨーロッパ・中東', country:'トルコ', length:1500,
      maxMag:7.9, lastMajor:'1999年（イズミット地震 M7.6）',
      desc:'トルコ北部を東西に走るユーラシアプレートとアナトリアプレートの境界。20世紀に西向きに連続する大地震が発生し、「移動する地震」として有名。',
      center:[40.5,33],
      pts:[[39.8,40.5],[40,38.5],[40.3,36.5],[40.6,34.5],[40.8,32.5],[41,30.5],[41.1,28.8],[41,27.2]]
    },
    {
      id:'dead_sea', n:'死海トランスフォーム断層', t:'transform', region:'中東', country:'イスラエル/ヨルダン/レバノン', length:1000,
      maxMag:7.5, lastMajor:'749年（ガリラヤ地震 M7.3）',
      desc:'アフリカプレートとアラビアプレートを隔てる断層系。アカバ湾から東アナトリアまで続き、ヨルダン川・死海・ゴラン高原がこの断層に沿って形成されている。',
      center:[31.5,35.4],
      pts:[[29.5,34.9],[30.2,35.1],[31,35.4],[31.6,35.5],[32.2,35.5],[32.8,35.6],[33.4,35.8],[34,36.2],[35,36.6],[36.2,36.8],[37,36.6]]
    },
    {
      id:'alpine_nz', n:'アルパイン断層（ニュージーランド）', t:'transform', region:'オセアニア', country:'ニュージーランド', length:480,
      maxMag:8.2, lastMajor:'1717年（推定M8.1）',
      desc:'南島を縦断する太平洋プレートとオーストラリアプレートの境界。数百年に一度M8クラスの「アルパイン断層地震」が発生する可能性が高い。',
      center:[-43,170],
      pts:[[-45,167.5],[-44,168.2],[-43.2,169.5],[-42,171],[-41,172.5],[-40,173],[-39,173.8]]
    },
    {
      id:'queen_charlotte', n:'クイーン・シャーロット断層', t:'transform', region:'北アメリカ', country:'カナダ/アメリカ合衆国', length:840,
      maxMag:8.1, lastMajor:'1949年（M8.1）',
      desc:'ブリティッシュコロンビア州沖の太平洋プレートと北アメリカプレートの境界。カナダ版サンアンドレアス断層とも呼ばれる。',
      center:[55,-134],
      pts:[[51,-130],[52,-132],[54,-133.5],[55,-135],[57,-136],[58.5,-137.5]]
    },
    {
      id:'japan_trench', n:'日本海溝', t:'subduction', region:'東アジア', country:'日本', length:800,
      maxMag:9.1, lastMajor:'2011年（東北地方太平洋沖地震 M9.1）',
      desc:'太平洋プレートが北アメリカプレートの下に沈み込む境界。2011年の東日本大震災を引き起こした。最深部は約8000m。',
      center:[39,143],
      pts:[[35.5,141.5],[37,142.5],[38.5,143],[40,143.5],[41.5,144],[43,145.5],[44.5,147],[46,148]]
    },
    {
      id:'nankai', n:'南海トラフ', t:'subduction', region:'東アジア', country:'日本', length:700,
      maxMag:8.7, lastMajor:'1946年（南海地震 M8.1）',
      desc:'フィリピン海プレートがユーラシアプレートの下に沈み込む境界。100〜150年周期で巨大地震が発生し、次の「南海トラフ地震」は切迫しているとされる。',
      center:[33,136],
      pts:[[32,132.5],[32.5,134.2],[33,136],[33.5,137.5],[34,139],[34.5,140.5]]
    },
    {
      id:'ryukyu', n:'琉球海溝', t:'subduction', region:'東アジア', country:'日本', length:600,
      maxMag:8.0, lastMajor:'1771年（八重山地震 M7.4）',
      desc:'フィリピン海プレートが南西から沈み込む境界。津波の発生リスクが高く、歴史的に多くの被害を与えてきた。',
      center:[26.5,127],
      pts:[[23.5,122],[24,123.5],[25,125.5],[26.5,127.5],[28,129.5],[30,131.5]]
    },
    {
      id:'izu_ogasawara', n:'伊豆・小笠原海溝', t:'subduction', region:'東アジア', country:'日本', length:1100,
      maxMag:8.5, lastMajor:'1990年代（M7クラス多数）',
      desc:'太平洋プレートがフィリピン海プレートの下に沈み込む境界。最深部は約9780mに達する。',
      center:[29,141],
      pts:[[35,141],[33,141.5],[31,141.8],[29,141.8],[27,141.5],[25,141],[23,141]]
    },
    {
      id:'cascadia', n:'カスケード沈み込み帯', t:'subduction', region:'北アメリカ', country:'アメリカ合衆国/カナダ', length:1100,
      maxMag:9.2, lastMajor:'1700年（カスケード地震 推定M9.0）',
      desc:'フアン・デ・フカプレートが北アメリカプレートの下に沈み込む境界。オレゴン〜ブリティッシュコロンビア沖に位置し、次の巨大地震が懸念されている。',
      center:[45,-126],
      pts:[[41,-126],[43,-126.5],[45.5,-126],[47.5,-125],[49.5,-125.5],[51,-128]]
    },
    {
      id:'peru_chile', n:'ペルー・チリ海溝', t:'subduction', region:'南アメリカ', country:'チリ/ペルー/エクアドル', length:5900,
      maxMag:9.5, lastMajor:'1960年（チリ地震 M9.5 観測史上最大）',
      desc:'ナスカプレートと南アメリカプレートの境界。観測史上最大の地震（1960年チリ地震M9.5）が発生した場所。アンデス山脈形成の原動力。',
      center:[-25,-71],
      pts:[[0,-81],[-5,-80.5],[-10,-78],[-15,-75],[-20,-71],[-25,-70.5],[-30,-71],[-35,-72],[-40,-74],[-45,-76],[-50,-76]]
    },
    {
      id:'sumatra', n:'スンダ海溝（スマトラ海溝）', t:'subduction', region:'東南アジア', country:'インドネシア', length:5500,
      maxMag:9.3, lastMajor:'2004年（スマトラ島沖地震 M9.3 インド洋大津波）',
      desc:'インド・オーストラリアプレートがユーラシアプレートの下に沈み込む境界。2004年のインド洋大津波を引き起こし、23万人以上が犠牲になった。',
      center:[-2,101],
      pts:[[5.5,93.5],[3.5,95.5],[1.5,97],[0,98.5],[-2,100.5],[-4,102.5],[-6,105],[-8,107],[-9.5,109]]
    },
    {
      id:'aleutian', n:'アリューシャン海溝', t:'subduction', region:'北太平洋', country:'アメリカ合衆国（アラスカ）', length:3400,
      maxMag:9.2, lastMajor:'1964年（アラスカ地震 M9.2）',
      desc:'太平洋プレートが北アメリカプレートの下に沈み込む境界。アラスカ半島からアリューシャン列島に沿って弧を描く。',
      center:[52,-170],
      pts:[[55,-145],[54.5,-150],[54,-155],[53.5,-160],[53,-165],[52.5,-170],[52,-175],[51.5,179],[51,174],[51,170]]
    },
    {
      id:'kuril', n:'千島・カムチャツカ海溝', t:'subduction', region:'北太平洋', country:'ロシア/日本', length:2100,
      maxMag:8.5, lastMajor:'2006年（千島列島地震 M8.3）',
      desc:'太平洋プレートがオホーツクプレートの下に沈み込む境界。千島列島からカムチャツカ半島に沿って延びる。',
      center:[52,155],
      pts:[[44,148],[46,149],[48,151],[50,152.5],[52,155],[54,159],[56,163],[57.5,163],[59,161]]
    },
    {
      id:'mariana', n:'マリアナ海溝', t:'subduction', region:'西太平洋', country:'アメリカ合衆国', length:2550,
      maxMag:8.2, lastMajor:'1993年（グアム地震 M8.1）',
      desc:'太平洋プレートがフィリピン海プレートの下に沈み込む境界。最深部チャレンジャー海淵は世界で最も深い場所（約11,034m）。',
      center:[15,145],
      pts:[[21,145],[19,146.5],[16,147.5],[14,147.5],[12,146],[11,145.5],[12,144],[13.5,144]]
    },
    {
      id:'tonga', n:'トンガ海溝', t:'subduction', region:'南太平洋', country:'トンガ', length:2500,
      maxMag:8.8, lastMajor:'2022年（フンガ・トンガ火山噴火 M5.8）',
      desc:'太平洋プレートがオーストラリアプレートの下に沈み込む境界。世界で2番目に深い海溝（約10,882m）で、プレートの沈み込み速度が特に速い。',
      center:[-20,-176],
      pts:[[-14,-176],[-17,-176.5],[-20,-177],[-23,-177],[-26,-176.5],[-29,-175]]
    },
    {
      id:'mid_atlantic', n:'中央大西洋海嶺', t:'divergent', region:'大西洋', country:'（国際水域）', length:16000,
      maxMag:7.2, lastMajor:'継続的な微小地震活動',
      desc:'ユーラシアプレートと北アメリカプレート、アフリカプレートと南アメリカプレートが離れる境界。年間2〜3cmの速度で大西洋が広がっている。',
      center:[0,-25],
      pts:[[70,-5],[65,-17],[60,-30],[55,-35],[45,-30],[35,-36],[25,-45],[15,-45],[5,-32],[0,-16],[-5,-13],[-10,-13],[-15,-13],[-20,-13],[-25,-14],[-30,-14],[-35,-17],[-40,-16],[-45,-13],[-50,-8],[-55,-4],[-58,-8]]
    },
    {
      id:'east_pacific_rise', n:'東太平洋海嶺', t:'divergent', region:'太平洋', country:'（国際水域）', length:5000,
      maxMag:7.0, lastMajor:'継続的な微小地震活動',
      desc:'太平洋プレートとナスカプレートなどの発散境界。年間14〜15cmと世界で最も速い速度でプレートが広がっている。活発な熱水噴出孔がある。',
      center:[0,-104],
      pts:[[30,-111],[20,-107],[10,-104],[0,-103],[-10,-109],[-20,-113],[-30,-114],[-40,-112]]
    },
    {
      id:'mid_indian', n:'インド洋中央海嶺', t:'divergent', region:'インド洋', country:'（国際水域）', length:10000,
      maxMag:7.1, lastMajor:'継続的な微小地震活動',
      desc:'アフリカプレートとインド・オーストラリアプレートの発散境界。カールスベルク海嶺・中央インド洋海嶺・南東インド洋海嶺からなる複合的な海嶺系。',
      center:[0,63],
      pts:[[22,64],[15,63],[8,63],[0,63],[-10,63],[-20,64],[-30,65],[-40,67],[-50,65]]
    },
    {
      id:'sw_indian_ridge', n:'南西インド洋海嶺', t:'divergent', region:'南インド洋', country:'（国際水域）', length:7700,
      maxMag:6.8, lastMajor:'継続的な微小地震活動',
      desc:'アフリカプレートとインド・オーストラリアプレートを隔てる非常にゆっくりとした発散境界（年間1.5cm）。最も拡大速度の遅い中央海嶺の一つ。',
      center:[-42,30],
      pts:[[-55,5],[-50,14],[-45,24],[-40,35],[-35,45],[-30,55]]
    },
    {
      id:'east_african_rift', n:'東アフリカ地溝帯', t:'rift', region:'アフリカ', country:'エチオピア/ケニア/タンザニア/ザンビア', length:6000,
      maxMag:7.6, lastMajor:'2006年（モザンビーク地震 M7.0）',
      desc:'アフリカプレートが東アフリカと西アフリカの2つに分裂しつつある場所。1000万年後には大陸が分裂して新しい海が誕生すると予測されている。タンガニーカ湖・マラウイ湖が地溝湖。',
      center:[0,36],
      pts:[[15,38],[10,38.5],[5,37],[0,36],[-5,36.5],[-10,35.5],[-15,34.5],[-20,35],[-25,34]]
    },
    {
      id:'afar_triangle', n:'アファール三角地帯', t:'rift', region:'アフリカ・中東', country:'エチオピア/エリトリア/ジブチ', length:600,
      maxMag:7.2, lastMajor:'2020年（エチオピア地震 M6.2）',
      desc:'東アフリカ地溝帯・紅海・アデン湾の3つの発散境界が出会う三重会合点。現在も大陸分裂が進行中で、将来的に新しい海洋が形成される場所。',
      center:[12,41],
      pts:[[15,40],[14,41],[12,42],[10,42],[8,42]]
    },
    {
      id:'main_himalayan', n:'ヒマラヤ主衝上断層（MHT）', t:'thrust', region:'南アジア', country:'インド/ネパール/ブータン', length:2400,
      maxMag:8.6, lastMajor:'2015年（ネパール地震 M7.8）',
      desc:'インドプレートがユーラシアプレートに衝突して生じる大規模な逆断層。エベレストを含むヒマラヤ山脈全体を形成した主断層で、現在も急速に隆起が続く。',
      center:[28,84],
      pts:[[28,76],[28.5,78],[28.5,80],[28,82],[27.5,84],[27.5,86],[27.5,88],[28,90],[27.5,92],[27.5,94]]
    },
    {
      id:'philippine', n:'フィリピン断層', t:'transform', region:'東南アジア', country:'フィリピン', length:1200,
      maxMag:8.0, lastMajor:'1990年（ルソン島地震 M7.7）',
      desc:'フィリピン海プレートの内部を縦断する大規模な横ずれ断層。左横ずれ成分が卓越し、ルソン島・レイテ島・ミンダナオ島を縦断する。',
      center:[13,123],
      pts:[[18.5,122.2],[16,121.5],[14,121.8],[12,123],[10,124.5],[8,124]]
    },
    {
      id:'sumatra_fault', n:'スマトラ断層', t:'transform', region:'東南アジア', country:'インドネシア', length:1900,
      maxMag:7.7, lastMajor:'2009年（スマトラ島地震 M7.6）',
      desc:'スマトラ島内部を縦断する右横ずれ断層。バリサン山脈に沿って走り、スンダ海溝でのオブリーク沈み込みに起因するトランスフォーム成分を受け持つ。',
      center:[0,100],
      pts:[[5.5,95.5],[3.5,97.5],[1.5,99],[-0.5,100.5],[-2.5,102],[-4.5,103.5],[-5.5,105]]
    },
    {
      id:'denali', n:'デナリ断層', t:'transform', region:'北アメリカ', country:'アメリカ合衆国（アラスカ）', length:2000,
      maxMag:7.9, lastMajor:'2002年（デナリ断層地震 M7.9）',
      desc:'アラスカ州内部を走る大規模な右横ずれ断層。2002年の地震では地表に最大8.8mのずれが生じた。北アメリカ大陸最高峰デナリ（旧マッキンリー山）のそばを通る。',
      center:[63,-142],
      pts:[[60,-148],[61,-145.5],[62.5,-143],[64,-141],[65,-138],[65.5,-136]]
    },
    {
      id:'el_pilar', n:'エル・ピラル断層', t:'transform', region:'南アメリカ・カリブ海', country:'ベネズエラ', length:550,
      maxMag:7.7, lastMajor:'2024年（カリアコ沖地震 M6.5）',
      desc:'ベネズエラ北部沿岸を東西に走る右横ずれ断層。北アメリカプレートと南アメリカプレートの境界を形成し、カリアコ湾から西方のバルセロナ沖まで延びる。1997年のクマナ地震（M6.9）など歴史的に多くの地震を引き起こしており、マラカイボ沿岸の都市部への影響が懸念される。2024〜2025年にかけて活発な群発地震が観測された。',
      center:[10.5,-64],
      pts:[[10.2,-67],[10.4,-65.5],[10.6,-64],[10.6,-62.5],[10.5,-61.2],[10.4,-60]]
    },
    {
      id:'bocono', n:'ボコノ断層', t:'transform', region:'南アメリカ', country:'ベネズエラ', length:500,
      maxMag:7.5, lastMajor:'1812年（カラカス地震 M7.7 推定）',
      desc:'ベネズエラ・アンデス山脈を縦断する左横ずれ断層。コロンビアとの国境付近からマラカイボ湖南方まで延びる。1812年のカラカス地震はこの断層活動によるもので、推定1万人以上が犠牲になった。',
      center:[9,-70],
      pts:[[7.2,-72.5],[7.8,-71.5],[8.5,-70.5],[9.5,-69.5],[10.2,-68.5],[10.5,-67.5]]
    },
    {
      id:'south_caribbean', n:'南カリブ海沈み込み帯', t:'subduction', region:'カリブ海・南アメリカ', country:'コロンビア/ベネズエラ', length:1500,
      maxMag:8.0, lastMajor:'2018年（ベネズエラ北部沖地震 M7.3）',
      desc:'カリブ海プレートが南アメリカプレートの下に沈み込む複合的な境界帯。ベネズエラ北岸沖に平行に走り、沈み込みと横ずれの複合運動が生じる。2018年のM7.3地震はこの地域を震源とし、ベネズエラ北部全域で強い揺れが発生した。',
      center:[11,-65],
      pts:[[12,-74],[11.8,-71],[11.5,-68],[11.2,-65],[11,-62],[10.8,-60],[10.5,-57]]
    },
    {
      id:'caribbean_north', n:'カリブ海北部プレート境界', t:'transform', region:'カリブ海', country:'キューバ/ハイチ/ドミニカ共和国/プエルトリコ', length:2200,
      maxMag:8.1, lastMajor:'2010年（ハイチ地震 M7.0）',
      desc:'北アメリカプレートとカリブ海プレートの境界。セプテントリオナル断層（ハイチ）・エンリキロ断層（ハイチ）・プエルトリコ海溝などからなる複合的な断層系。2010年のハイチ地震（M7.0）ではポルトープランスが壊滅的な被害を受け、31万人以上が死亡した。',
      center:[18,-72],
      pts:[[15,-89],[16,-86],[17,-83],[17.5,-80],[17.8,-77],[18,-74],[18.2,-72],[18.5,-70],[18.5,-68],[18.3,-66],[17.5,-64],[16.5,-62]]
    },
    {
      id:'lesser_antilles', n:'小アンティル弧沈み込み帯', t:'subduction', region:'カリブ海東部', country:'マルティニーク/セントビンセント/モントセラト他', length:850,
      maxMag:8.0, lastMajor:'1843年（M8.0 推定）',
      desc:'北アメリカプレートとカリブ海プレートが接するカリブ海東縁の沈み込み帯。ペレー山（マルティニーク）・スフリエール・ヒルズ（モントセラト）・スフリエール（セントビンセント）などの活火山を形成している。',
      center:[14.5,-61.5],
      pts:[[16.5,-62],[15.5,-61.5],[14.5,-61],[13.5,-61.2],[12.5,-62],[11.5,-63],[10.5,-63.5]]
    },
    {
      id:'motagua', n:'モタグア断層', t:'transform', region:'中央アメリカ', country:'グアテマラ', length:400,
      maxMag:7.9, lastMajor:'1976年（グアテマラ地震 M7.5）',
      desc:'グアテマラを東西に横断する北アメリカプレートとカリブ海プレートの境界断層。1976年の地震では約23,000人が死亡。カリブ・ココス・北アメリカの3プレートが接近する複雑な地域。',
      center:[15.5,-89],
      pts:[[15,-92],[15.2,-91],[15.4,-90],[15.5,-89],[15.7,-88],[16,-87]]
    }
  ];

  var VOLCANOES = [
    {id:'kilauea',n:'キラウエア',c:'アメリカ合衆国（ハワイ）',elev:1247,lastErupt:'2024年（現在も活動中）',lat:19.42,lon:-155.29},
    {id:'mauna_loa',n:'マウナ・ロア',c:'アメリカ合衆国（ハワイ）',elev:4169,lastErupt:'2022年',lat:19.48,lon:-155.61},
    {id:'sakurajima',n:'桜島',c:'日本',elev:1117,lastErupt:'2024年（頻繁に噴火）',lat:31.58,lon:130.66},
    {id:'asosan',n:'阿蘇山',c:'日本',elev:1592,lastErupt:'2024年',lat:32.88,lon:131.10},
    {id:'fujisan',n:'富士山',c:'日本',elev:3776,lastErupt:'1707年（最後の噴火）',lat:35.36,lon:138.73},
    {id:'shinmoedake',n:'新燃岳（霧島）',c:'日本',elev:1421,lastErupt:'2018年',lat:31.93,lon:130.86},
    {id:'nishino',n:'西之島',c:'日本',elev:160,lastErupt:'2023年',lat:27.25,lon:140.87},
    {id:'etna',n:'エトナ山',c:'イタリア（シチリア）',elev:3357,lastErupt:'2024年（頻繁に噴火）',lat:37.75,lon:15.00},
    {id:'vesuvius',n:'ヴェスヴィオ山',c:'イタリア',elev:1281,lastErupt:'1944年',lat:40.82,lon:14.43},
    {id:'stromboli',n:'ストロンボリ島',c:'イタリア',elev:924,lastErupt:'2024年（ほぼ常時噴火）',lat:38.79,lon:15.21},
    {id:'santorini',n:'サントリーニ（テラ）',c:'ギリシャ',elev:329,lastErupt:'1950年',lat:36.42,lon:25.40},
    {id:'hekla',n:'ヘクラ山',c:'アイスランド',elev:1491,lastErupt:'2000年',lat:63.98,lon:-19.70},
    {id:'eyjafjallajokull',n:'エイヤフィヤトラヨークトル',c:'アイスランド',elev:1666,lastErupt:'2010年（航空障害）',lat:63.63,lon:-19.62},
    {id:'katla',n:'カトラ',c:'アイスランド',elev:1512,lastErupt:'1918年（次の大噴火が懸念）',lat:63.63,lon:-19.05},
    {id:'grindavik',n:'スヴァルツェンギ火山系',c:'アイスランド（レイキャネス半島）',elev:160,lastErupt:'2024〜2025年（複数回噴火）',lat:63.87,lon:-22.43},
    {id:'merapi',n:'メラピ山',c:'インドネシア（ジャワ）',elev:2930,lastErupt:'2024年',lat:-7.54,lon:110.44},
    {id:'krakatau',n:'クラカタウ',c:'インドネシア',elev:813,lastErupt:'2022年',lat:-6.10,lon:105.42},
    {id:'sinabung',n:'シナブン山',c:'インドネシア（スマトラ）',elev:2460,lastErupt:'2021年',lat:3.17,lon:98.39},
    {id:'semeru',n:'スメル山',c:'インドネシア（ジャワ）',elev:3676,lastErupt:'2024年',lat:-8.11,lon:112.92},
    {id:'agung',n:'アグン山',c:'インドネシア（バリ）',elev:3142,lastErupt:'2019年',lat:-8.34,lon:115.51},
    {id:'pinatubo',n:'ピナトゥボ山',c:'フィリピン',elev:1486,lastErupt:'1991年（20世紀最大級）',lat:15.14,lon:120.35},
    {id:'mayon',n:'マヨン山',c:'フィリピン',elev:2463,lastErupt:'2023年',lat:13.26,lon:123.69},
    {id:'taal',n:'タール火山',c:'フィリピン',elev:311,lastErupt:'2020年',lat:14.01,lon:120.99},
    {id:'klyuchevskaya',n:'クリュチェフスカヤ山',c:'ロシア（カムチャツカ）',elev:4750,lastErupt:'2024年',lat:56.06,lon:160.64},
    {id:'shiveluch',n:'シヴェルチ山',c:'ロシア（カムチャツカ）',elev:3307,lastErupt:'2024年',lat:56.65,lon:161.36},
    {id:'st_helens',n:'セント・ヘレンズ山',c:'アメリカ合衆国',elev:2549,lastErupt:'2008年',lat:46.20,lon:-122.19},
    {id:'redoubt',n:'リダウト山',c:'アメリカ合衆国（アラスカ）',elev:3108,lastErupt:'2009年',lat:60.49,lon:-152.74},
    {id:'popocatepetl',n:'ポポカテペトル山',c:'メキシコ',elev:5426,lastErupt:'2024年（活発に活動中）',lat:19.02,lon:-98.62},
    {id:'colima',n:'コリマ火山',c:'メキシコ',elev:3850,lastErupt:'2022年',lat:19.51,lon:-103.62},
    {id:'soufriere_hills',n:'スフリエール・ヒルズ',c:'モントセラト（英領）',elev:1050,lastErupt:'2010年',lat:16.72,lon:-62.18},
    {id:'soufriere_sv',n:'ラ・スフリエール（セントビンセント）',c:'セントビンセント・グレナディーン',elev:1234,lastErupt:'2021年（大噴火・島民避難）',lat:13.34,lon:-61.18},
    {id:'pelee',n:'プレー山',c:'マルティニーク（仏領）',elev:1394,lastErupt:'1932年（1902年に3万人死亡）',lat:14.81,lon:-61.17},
    {id:'cotopaxi',n:'コトパクシ山',c:'エクアドル',elev:5897,lastErupt:'2023年',lat:-0.68,lon:-78.44},
    {id:'tungurahua',n:'トゥングラウア山',c:'エクアドル',elev:5023,lastErupt:'2016年',lat:-1.47,lon:-78.44},
    {id:'villarrica',n:'ビジャリカ山',c:'チリ',elev:2847,lastErupt:'2024年',lat:-39.42,lon:-71.94},
    {id:'calbuco',n:'カルブコ山',c:'チリ',elev:2015,lastErupt:'2015年',lat:-41.33,lon:-72.61},
    {id:'galeras',n:'ガレラス山',c:'コロンビア',elev:4276,lastErupt:'2014年',lat:1.22,lon:-77.37},
    {id:'nyiragongo',n:'ニーラゴンゴ山',c:'コンゴ民主共和国',elev:3470,lastErupt:'2021年',lat:-1.52,lon:29.25},
    {id:'ol_doinyo',n:'オル・ドイニョ・レンガイ',c:'タンザニア',elev:2962,lastErupt:'2023年',lat:-2.76,lon:35.90},
    {id:'erta_ale',n:'エルタ・アレ',c:'エチオピア',elev:613,lastErupt:'2024年（常時活動）',lat:13.60,lon:40.67},
    {id:'erebus',n:'エレバス山',c:'南極',elev:3794,lastErupt:'2024年（常時活動）',lat:-77.53,lon:167.17},
    {id:'ruapehu',n:'ルアペフ山',c:'ニュージーランド',elev:2797,lastErupt:'2007年',lat:-39.28,lon:175.57},
    {id:'whakaari',n:'ファカーリ（ホワイト島）',c:'ニュージーランド',elev:321,lastErupt:'2019年（死者16名）',lat:-37.52,lon:177.18},
    {id:'ambae',n:'アンバエ（マナロ）',c:'バヌアツ',elev:1496,lastErupt:'2018年',lat:-15.39,lon:167.83},
    {id:'yasur',n:'ヤスール山',c:'バヌアツ（タンナ島）',elev:361,lastErupt:'2024年（ほぼ常時噴火）',lat:-19.53,lon:169.44},
    {id:'bagana',n:'バガナ山',c:'パプアニューギニア',elev:1855,lastErupt:'2024年',lat:-6.14,lon:155.20},
    {id:'ulawun',n:'ウラウン山',c:'パプアニューギニア',elev:2334,lastErupt:'2024年',lat:-5.05,lon:151.33},
    {id:'rainier',n:'レーニア山',c:'アメリカ合衆国',elev:4392,lastErupt:'1894年（潜在的脅威）',lat:46.85,lon:-121.73},
    {id:'sabancaya',n:'サバンカヤ山',c:'ペルー',elev:5976,lastErupt:'2024年',lat:-15.78,lon:-71.86},
    {id:'ubinas',n:'ウビナス山',c:'ペルー',elev:5672,lastErupt:'2024年',lat:-16.36,lon:-70.90},
    {id:'sangay',n:'サンガイ山',c:'エクアドル',elev:5286,lastErupt:'2024年（活発）',lat:-2.00,lon:-78.34}
  ];

  VOLCANOES.forEach(function(v) {
    v._p = latLonToXYZ(v.lat, v.lon, 1.005);
  });

  (function() {
    var globeWrap = document.getElementById('globeIconWrap');
    var gvtt = document.getElementById('globe-vol-tooltip');
    var hotKeywords = ['2024', '2025', '常時', '現在も活動中', '活発', '頻繁'];
    function isHot(v) {
      for (var i = 0; i < hotKeywords.length; i++) {
        if (v.lastErupt.indexOf(hotKeywords[i]) >= 0) return true;
      }
      return false;
    }
    var html = '<div class="gvtt-title">🌋 活火山一覧 (' + VOLCANOES.length + '件)</div>';
    var hot = VOLCANOES.filter(isHot);
    var rest = VOLCANOES.filter(function(v) { return !isHot(v); });
    hot.forEach(function(v) {
      html += '<div class="gvtt-row"><span class="gvtt-name gvtt-hot">🔥 ' + v.n + '</span><span class="gvtt-act">' + v.lastErupt + '</span></div>';
    });
    rest.forEach(function(v) {
      html += '<div class="gvtt-row"><span class="gvtt-name">🌋 ' + v.n + '</span><span class="gvtt-act">' + v.lastErupt + '</span></div>';
    });
    gvtt.innerHTML = html;

    globeWrap.addEventListener('mouseenter', function(e) {
      var r = globeWrap.getBoundingClientRect();
      gvtt.style.left = (r.left + r.width / 2) + 'px';
      gvtt.style.top = (r.bottom + 8) + 'px';
      gvtt.style.transform = 'translateX(-50%)';
      gvtt.style.opacity = '1';
    });
    globeWrap.addEventListener('mouseleave', function() {
      gvtt.style.opacity = '0';
    });
  })();

  var showVolcanoes = true;
  var volMarkersDiv = document.getElementById('markers');
  var volDivMap = {};
  var volTooltipEl = document.getElementById('vol-tooltip');

  var canvasRect = {left:0, top:0, width:0, height:0};
  function updateCanvasRect() { canvasRect = canvas.getBoundingClientRect(); }
  window.addEventListener('resize', updateCanvasRect);
  updateCanvasRect();

  var isHoveringVol = false;
  var autoVolId = null;

  VOLCANOES.forEach(function(v) {
    var el = document.createElement('div');
    el.className = 'vol-mk';
    el.textContent = '🌋';
    el.style.display = 'none';
    el.setAttribute('data-volid', v.id);
    volMarkersDiv.appendChild(el);
    volDivMap[v.id] = el;
    el.addEventListener('mouseenter', function() {
      isHoveringVol = true;
      var r = el.getBoundingClientRect();
      showVolTooltip(r.left + r.width / 2, r.top + r.height / 2, v);
    });
    el.addEventListener('mouseleave', function() {
      isHoveringVol = false;
      if (!autoRot) hideVolTooltip();
    });
    el.addEventListener('click', function() {
      selectFaultFromVol(v);
    });
  });

  function showVolTooltip(x, y, v) {
    volTooltipEl.innerHTML =
      '<div class="vol-tt-name">🌋 ' + v.n + '</div>' +
      '<div class="vol-tt-sub">' + v.c + ' / 標高 ' + v.elev.toLocaleString() + 'm</div>' +
      '<div class="vol-tt-sub">最新噴火: ' + v.lastErupt + '</div>';
    var below = y < canvasRect.top + canvasRect.height * 0.3;
    volTooltipEl.style.left = x + 'px';
    volTooltipEl.style.top = y + 'px';
    volTooltipEl.className = below ? 'below' : '';
    volTooltipEl.style.opacity = '1';
  }
  function hideVolTooltip() { volTooltipEl.style.opacity = '0'; }

  function flyToLatLon(lat, lon, dur) {
    var latR = lat * Math.PI / 180;
    var lonR = lon * Math.PI / 180;
    var a = axialTilt;
    var tanA = Math.tan(a);
    var tanL = Math.tan(latR);
    var cosVal = Math.max(-1, Math.min(1, tanA * tanL));
    var ty = Math.acos(cosVal) + lonR;
    var sinSq = 1 - cosVal * cosVal;
    var denom = Math.cos(a) * Math.sqrt(Math.max(0, sinSq));
    var tRx = denom < 1e-6 ? (latR >= 0 ? Math.PI / 2 : -Math.PI / 2) : Math.atan(tanL / denom);
    var dy = ty - rotYv;
    while (dy > Math.PI) dy -= 2 * Math.PI;
    while (dy < -Math.PI) dy += 2 * Math.PI;
    flyFrom = {ry: rotYv, rx: rotXv};
    flyTarget = {ry: rotYv + dy, rx: tRx};
    flyT = 0; flyDur = dur;
  }

  function selectFaultFromVol(v) {
    flyToLatLon(v.lat, v.lon, 1000);
  }

  var btnVolToggle = document.getElementById('btnVolToggle');
  var volToggleCtrl = document.getElementById('volToggleCtrl');
  function setVolcanoes(on) {
    showVolcanoes = on;
    btnVolToggle.textContent = on ? '🌋 火山 表示中' : '🌋 火山 非表示';
    if (on) { btnVolToggle.classList.add('active'); volToggleCtrl.textContent = '表示'; volToggleCtrl.classList.add('on'); }
    else { btnVolToggle.classList.remove('active'); volToggleCtrl.textContent = '非表示'; volToggleCtrl.classList.remove('on'); }
    if (!on) { VOLCANOES.forEach(function(v) { volDivMap[v.id].style.display = 'none'; }); hideVolTooltip(); autoVolId = null; }
  }
  btnVolToggle.addEventListener('click', function() { setVolcanoes(!showVolcanoes); });
  volToggleCtrl.addEventListener('click', function() { setVolcanoes(!showVolcanoes); });

  var activeFilter = 'all';
  var selectedFaultId = null;
  var flyTarget = null, flyFrom = null, flyT = 0, flyDur = 0;

  function faultColor(type) {
    return TYPE_COLORS[type] || [1,1,1];
  }

  function buildFaultVBOs() {
    FAULTS.forEach(function(f) {
      var pts = [];
      var r = 1.003;
      f.pts.forEach(function(p) {
        var xyz = latLonToXYZ(p[0], p[1], r);
        pts.push(xyz[0], xyz[1], xyz[2]);
      });
      f._vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, f._vbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.STATIC_DRAW);
      f._vcount = f.pts.length;
      var c = latLonToXYZ(f.center[0], f.center[1], 1.0);
      f._cp = c;
    });
  }
  buildFaultVBOs();

  function renderFaultList() {
    var filtered = FAULTS.filter(function(f) { return activeFilter === 'all' || f.t === activeFilter; });
    var html = '';
    filtered.forEach(function(f) {
      var c = faultColor(f.t);
      var dotClr = 'rgb(' + Math.round(c[0]*255) + ',' + Math.round(c[1]*255) + ',' + Math.round(c[2]*255) + ')';
      var isActive = f.id === selectedFaultId ? ' active' : '';
      html += '<div class="fault-item' + isActive + '" data-id="' + f.id + '">';
      html += '<div class="fault-dot" style="background:' + dotClr + '"></div>';
      html += '<div class="fault-body">';
      html += '<div class="fault-name">' + f.n + '</div>';
      html += '<div class="fault-meta">';
      html += '<span class="type-badge ' + f.t + '">' + (TYPE_NAMES[f.t] || f.t) + '</span>';
      html += '<span>' + f.country + '</span>';
      html += '</div>';
      html += '</div>';
      html += '</div>';
    });
    faultListEl.innerHTML = html;
    faultListEl.querySelectorAll('.fault-item').forEach(function(el) {
      el.addEventListener('click', function() {
        var id = el.getAttribute('data-id');
        selectFault(id, true);
      });
    });
  }

  function renderDetail(f) {
    if (!f) {
      detailContent.innerHTML = '<div class="detail-empty">断層をクリックまたはリストから選択してください</div>';
      return;
    }
    var c = faultColor(f.t);
    var dotClr = 'rgb(' + Math.round(c[0]*255) + ',' + Math.round(c[1]*255) + ',' + Math.round(c[2]*255) + ')';
    var html = '';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">';
    html += '<div class="fault-dot" style="background:' + dotClr + ';width:14px;height:14px;"></div>';
    html += '<div class="detail-name">' + f.n + '</div>';
    html += '</div>';
    html += '<div class="detail-sub">' + f.region + '</div>';
    html += '<table class="detail-table">';
    html += '<tr><td>タイプ</td><td><span class="type-badge ' + f.t + '">' + (TYPE_NAMES[f.t] || f.t) + '</span></td></tr>';
    html += '<tr><td>全長</td><td>' + f.length.toLocaleString() + ' km</td></tr>';
    html += '<tr><td>最大規模</td><td>M' + f.maxMag.toFixed(1) + '</td></tr>';
    html += '<tr><td>直近の大地震</td><td>' + f.lastMajor + '</td></tr>';
    html += '<tr><td>国・地域</td><td>' + f.country + '</td></tr>';
    html += '</table>';
    html += '<div class="detail-desc">' + f.desc + '</div>';
    detailContent.innerHTML = html;
  }

  function selectFault(id, doFly) {
    selectedFaultId = id;
    var f = FAULTS.find(function(x) { return x.id === id; });
    renderFaultList();
    renderDetail(f);
    tabDetail.classList.add('active'); tabList.classList.remove('active'); tabCtrl.classList.remove('active');
    panelDetail.classList.add('visible'); panelList.classList.remove('visible'); panelCtrl.classList.remove('visible');
    if (doFly && f) {
      flyToLatLon(f.center[0], f.center[1], 1200);
    }
  }

  document.querySelectorAll('.filter-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeFilter = btn.getAttribute('data-type');
      renderFaultList();
    });
  });

  var TOUR_GROUPS = {
    'ring_fire': ['japan_trench','nankai','ryukyu','kuril','aleutian','cascadia','peru_chile','tonga','mariana','sumatra','izu_ogasawara'],
    'alp_him': ['north_anatolian','dead_sea','main_himalayan','sumatra_fault','philippine'],
    'rift': ['east_african_rift','afar_triangle','mid_atlantic','east_pacific_rise','mid_indian','sw_indian_ridge'],
    'caribbean': ['el_pilar','bocono','south_caribbean','caribbean_north','lesser_antilles','motagua','san_andreas']
  };
  var tourGroup = null, tourIdx = 0, tourTimer = null;

  function startTour(groupId) {
    if (tourTimer) { clearTimeout(tourTimer); tourTimer = null; }
    tourGroup = TOUR_GROUPS[groupId];
    tourIdx = 0;
    nextTourStep();
  }
  function nextTourStep() {
    if (!tourGroup || tourIdx >= tourGroup.length) { tourGroup = null; return; }
    selectFault(tourGroup[tourIdx], true);
    tourIdx++;
    tourTimer = setTimeout(function() { nextTourStep(); }, 4000);
  }

  document.getElementById('btnRingFire').addEventListener('click', function() { startTour('ring_fire'); });
  document.getElementById('btnAlpHim').addEventListener('click', function() { startTour('alp_him'); });
  document.getElementById('btnRiftTour').addEventListener('click', function() { startTour('rift'); });
  document.getElementById('btnCaribbeanTour').addEventListener('click', function() { startTour('caribbean'); });

  var axisLocked = false, autoRot = true;
  var btnAxisLock = document.getElementById('btnAxisLock');
  var btnAutoRot = document.getElementById('btnAutoRot');
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

  var rotXv = 0.3, rotYv = 0.6, zoom = 3.2;
  var drag = false, lx = 0, ly = 0, pinch0 = 0, touchMoved = false;
  var velY = 0, velX = 0, momentumY = 0, momentumX = 0;
  var MOMENTUM_DECAY = 0.94, SPIN_BOOST = 2.0;
  var axialTilt = -23.4 * Math.PI / 180;
  var ELEV_MAX = Math.PI / 2 - 0.02;
  function clampElev(v) { return v < -ELEV_MAX ? -ELEV_MAX : (v > ELEV_MAX ? ELEV_MAX : v); }

  function applyMomentum(vy, vx) {
    momentumY = vy * SPIN_BOOST;
    momentumX = axisLocked ? 0 : (vx * SPIN_BOOST);
  }

  canvas.addEventListener('mousedown', function(e) { drag=true; lx=e.clientX; ly=e.clientY; momentumY=0; momentumX=0; velY=0; velX=0; });
  window.addEventListener('mouseup', function() { if(!drag)return; drag=false; applyMomentum(velY, velX); velY=0; velX=0; });
  window.addEventListener('mousemove', function(e) {
    if(!drag)return;
    var dy=(e.clientX-lx)*0.008, dx=(e.clientY-ly)*0.008;
    rotYv+=dy; velY=velY*0.4+dy*0.6;
    if(!axisLocked){rotXv=clampElev(rotXv+dx); velX=velX*0.4+dx*0.6;}
    lx=e.clientX; ly=e.clientY;
  });
  canvas.addEventListener('wheel', function(e) { e.preventDefault(); zoom=Math.max(1.4,Math.min(10,zoom+e.deltaY*0.01)); }, {passive:false});
  canvas.addEventListener('dblclick', function() {
    autoRot=!autoRot;
    btnAutoRot.textContent=autoRot?'⏸ 自転停止':'▶ 回転';
    if(autoRot){btnAutoRot.classList.remove('active');}else{btnAutoRot.classList.add('active');}
  });
  canvas.addEventListener('touchstart', function(e) {
    e.preventDefault(); touchMoved=false; momentumY=0; momentumX=0; velY=0; velX=0;
    if(e.touches.length===1){drag=true;lx=e.touches[0].clientX;ly=e.touches[0].clientY;}
    if(e.touches.length===2){pinch0=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);}
  }, {passive:false});
  canvas.addEventListener('touchmove', function(e) {
    e.preventDefault(); touchMoved=true;
    if(e.touches.length===1&&drag){
      var dy=(e.touches[0].clientX-lx)*0.008, dx=(e.touches[0].clientY-ly)*0.008;
      rotYv+=dy; velY=velY*0.4+dy*0.6;
      if(!axisLocked){rotXv=clampElev(rotXv+dx); velX=velX*0.4+dx*0.6;}
      lx=e.touches[0].clientX;ly=e.touches[0].clientY;
    }
    if(e.touches.length===2){
      var d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
      zoom=Math.max(1.4,Math.min(10,zoom-(d-pinch0)*0.02));pinch0=d;
    }
  }, {passive:false});
  canvas.addEventListener('touchend', function(e) {
    drag=false;
    applyMomentum(velY,velX); velY=0; velX=0;
    if(!touchMoved&&e.changedTouches.length===1){momentumY=0;momentumX=0;hideTooltip();}
  });

  canvas.addEventListener('click', function(e) {
    var rect = canvas.getBoundingClientRect();
    var cx = (e.clientX - rect.left) / rect.width * 2 - 1;
    var cy = -((e.clientY - rect.top) / rect.height * 2 - 1);
    var bestF = null, bestDist = 0.05;
    FAULTS.forEach(function(f) {
      if (activeFilter !== 'all' && f.t !== activeFilter) return;
      var cp = f._cp;
      var mz = model[2]*cp[0] + model[6]*cp[1] + model[10]*cp[2];
      if (mz < 0) return;
      var mcx = mvp[0]*cp[0] + mvp[4]*cp[1] + mvp[8]*cp[2] + mvp[12];
      var mcy = mvp[1]*cp[0] + mvp[5]*cp[1] + mvp[9]*cp[2] + mvp[13];
      var mcw = mvp[3]*cp[0] + mvp[7]*cp[1] + mvp[11]*cp[2] + mvp[15];
      if (mcw <= 0) return;
      var sx = mcx/mcw, sy = mcy/mcw;
      var dist = Math.hypot(sx - cx, sy - cy);
      if (dist < bestDist) { bestDist = dist; bestF = f; }
    });
    if (bestF) selectFault(bestF.id, false);
  });

  canvas.addEventListener('mousemove', function(e) {
    var rect = canvas.getBoundingClientRect();
    var cx = (e.clientX - rect.left) / rect.width * 2 - 1;
    var cy = -((e.clientY - rect.top) / rect.height * 2 - 1);
    var bestF = null, bestDist = 0.06;
    FAULTS.forEach(function(f) {
      if (activeFilter !== 'all' && f.t !== activeFilter) return;
      var cp = f._cp;
      var mz = model[2]*cp[0] + model[6]*cp[1] + model[10]*cp[2];
      if (mz < 0) return;
      var mcx = mvp[0]*cp[0] + mvp[4]*cp[1] + mvp[8]*cp[2] + mvp[12];
      var mcy = mvp[1]*cp[0] + mvp[5]*cp[1] + mvp[9]*cp[2] + mvp[13];
      var mcw = mvp[3]*cp[0] + mvp[7]*cp[1] + mvp[11]*cp[2] + mvp[15];
      if (mcw <= 0) return;
      var sx = mcx/mcw, sy = mcy/mcw;
      var dist = Math.hypot(sx - cx, sy - cy);
      if (dist < bestDist) { bestDist = dist; bestF = f; }
    });
    if (bestF) {
      showTooltip(e.clientX, e.clientY, bestF);
    } else {
      hideTooltip();
    }
  });

  function showTooltip(x, y, f) {
    var c = faultColor(f.t);
    var dotClr = 'rgb(' + Math.round(c[0]*255) + ',' + Math.round(c[1]*255) + ',' + Math.round(c[2]*255) + ')';
    tooltip.innerHTML =
      '<div class="tt-name" style="color:' + dotClr + '">' + f.n + '</div>' +
      '<div class="tt-type"><span class="type-badge ' + f.t + '">' + (TYPE_NAMES[f.t]||f.t) + '</span>  ' + f.region + '</div>' +
      '<div class="tt-desc">全長 ' + f.length.toLocaleString() + 'km / M' + f.maxMag.toFixed(1) + '</div>';
    var rect = canvas.getBoundingClientRect();
    var below = y < rect.top + rect.height * 0.3;
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
    tooltip.className = below ? 'below' : '';
    tooltip.style.opacity = '1';
  }
  function hideTooltip() { tooltip.style.opacity = '0'; }

  canvas.addEventListener('mouseleave', hideTooltip);

  var proj=m4(),view=m4(),model=m4(),rx=m4(),ry=m4(),tz=m4(),tmp=m4(),tmp2=m4(),mvp=m4();
  var lastT = 0;

  function frame(ts) {
    requestAnimationFrame(frame);
    var W = canvas.width, H = canvas.height;
    if (W <= 0 || H <= 0) return;
    var dt = Math.min(ts - lastT, 50); lastT = ts;

    if (flyTarget && flyFrom) {
      flyT = Math.min(flyT + dt, flyDur);
      var fe = flyT / flyDur;
      fe = fe < 0.5 ? 2*fe*fe : -1+(4-2*fe)*fe;
      rotYv = flyFrom.ry + (flyTarget.ry - flyFrom.ry) * fe;
      rotXv = flyFrom.rx + (flyTarget.rx - flyFrom.rx) * fe;
      if (flyT >= flyDur) { flyTarget = null; flyFrom = null; }
    } else {
      if (autoRot) rotYv += 0.003 * rotSpd;
      if (Math.abs(momentumY) > 0.0002) { rotYv += momentumY; momentumY *= MOMENTUM_DECAY; } else momentumY = 0;
      if (!axisLocked && Math.abs(momentumX) > 0.0002) { rotXv = clampElev(rotXv + momentumX); momentumX *= MOMENTUM_DECAY; } else momentumX = 0;
      if (axisLocked) rotXv = 0;
    }

    persp(proj, 0.7, W / H, 0.1, 100);
    trans(view, 0, 0, -zoom);
    rotY(ry, rotYv); rotZ(tz, axialTilt); rotX(rx, rotXv);
    mul(tmp2, tz, ry);
    mul(model, rx, tmp2);
    mul(tmp, view, model);
    mul(mvp, proj, tmp);

    gl.viewport(0, 0, W, H);
    gl.clearColor(0.01, 0.01, 0.05, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.enableVertexAttribArray(aPos);  gl.vertexAttribPointer(aPos,  3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(aNorm); gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(aUV);   gl.vertexAttribPointer(aUV,   2, gl.FLOAT, false, stride, 24);
    gl.uniformMatrix4fv(uMVP,   false, mvp);
    gl.uniformMatrix4fv(uModel, false, model);
    var sd = getSunDir();
    gl.uniform3f(uLight, sd[0], sd[1], sd[2]);
    gl.uniform1i(uTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texEarth);
    gl.drawElements(gl.TRIANGLES, idxs.length, gl.UNSIGNED_SHORT, 0);

    gl.useProgram(lineProg);
    gl.uniformMatrix4fv(lUMVP, false, mvp);
    gl.disableVertexAttribArray(aNorm);
    gl.disableVertexAttribArray(aUV);

    FAULTS.forEach(function(f) {
      if (activeFilter !== 'all' && f.t !== activeFilter) return;
      var c = faultColor(f.t);
      var isSelected = f.id === selectedFaultId;
      var alpha = isSelected ? 1.0 : lineAlpha;
      var bright = isSelected ? 1.3 : 1.0;
      gl.uniform3f(lUColor, Math.min(c[0]*bright,1), Math.min(c[1]*bright,1), Math.min(c[2]*bright,1));
      gl.uniform1f(lUAlpha, alpha);
      gl.bindBuffer(gl.ARRAY_BUFFER, f._vbo);
      gl.enableVertexAttribArray(lAPos);
      gl.vertexAttribPointer(lAPos, 3, gl.FLOAT, false, 0, 0);
      gl.lineWidth(isSelected ? 2.0 : 1.5);
      gl.drawArrays(gl.LINE_STRIP, 0, f._vcount);
    });

    gl.enableVertexAttribArray(aNorm);
    gl.enableVertexAttribArray(aUV);

    if (showVolcanoes) {
      VOLCANOES.forEach(function(v) {
        var p = v._p;
        var mz = model[2]*p[0] + model[6]*p[1] + model[10]*p[2];
        var el = volDivMap[v.id];
        if (mz < 0.02) { el.style.display = 'none'; return; }
        var mcx = mvp[0]*p[0] + mvp[4]*p[1] + mvp[8]*p[2] + mvp[12];
        var mcy = mvp[1]*p[0] + mvp[5]*p[1] + mvp[9]*p[2] + mvp[13];
        var mcw = mvp[3]*p[0] + mvp[7]*p[1] + mvp[11]*p[2] + mvp[15];
        if (mcw <= 0) { el.style.display = 'none'; return; }
        var sx = (mcx/mcw + 1) * W / 2;
        var sy = (-mcy/mcw + 1) * H / 2;
        el.style.display = 'block';
        el.style.left = sx + 'px';
        el.style.top = sy + 'px';
        el.style.opacity = Math.min(1, (mz - 0.02) * 10).toFixed(2);
      });
    }

    var visCount = 0;
    FAULTS.forEach(function(f) {
      if (activeFilter !== 'all' && f.t !== activeFilter) return;
      var cp = f._cp;
      var mz = model[2]*cp[0] + model[6]*cp[1] + model[10]*cp[2];
      if (mz < 0.05) return;
      visCount++;
    });
    var volCount = showVolcanoes ? VOLCANOES.length : 0;
    hud.textContent = '活断層: ' + FAULTS.length + '  活火山: ' + volCount + '  表示: ' + visCount;

    if (autoRot && showVolcanoes && !isHoveringVol && !drag) {
      var bestVolIdx = -1, bestVolMz = -1;
      for (var vi = 0; vi < VOLCANOES.length; vi++) {
        var vp = VOLCANOES[vi]._p;
        var vmz = model[2]*vp[0] + model[6]*vp[1] + model[10]*vp[2];
        if (vmz > 0.05 && vmz > bestVolMz) { bestVolMz = vmz; bestVolIdx = vi; }
      }
      if (bestVolIdx >= 0) {
        var acv = VOLCANOES[bestVolIdx];
        if (acv.id !== autoVolId) {
          autoVolId = acv.id;
          volTooltipEl.innerHTML =
            '<div class="vol-tt-name">🌋 ' + acv.n + '</div>' +
            '<div class="vol-tt-sub">' + acv.c + ' / 標高 ' + acv.elev.toLocaleString() + 'm</div>' +
            '<div class="vol-tt-sub">最新噴火: ' + acv.lastErupt + '</div>';
        }
        var acvEl = volDivMap[acv.id];
        var acvRect = acvEl.getBoundingClientRect();
        var vcx = acvRect.left + acvRect.width / 2;
        var vcy = acvRect.top + acvRect.height / 2;
        volTooltipEl.className = vcy < canvasRect.top + canvasRect.height * 0.3 ? 'below' : '';
        volTooltipEl.style.left = vcx + 'px';
        volTooltipEl.style.top = vcy + 'px';
        volTooltipEl.style.opacity = '1';
      }
    } else if (!autoRot && !isHoveringVol && autoVolId !== null) {
      autoVolId = null;
      hideVolTooltip();
    }
  }

  renderFaultList();
  requestAnimationFrame(frame);
})();
</script>
</body>
</html>`;
}
