function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function getWebGLSpherePage(username: string): string {
  const safeUser = esc(username);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0d1117">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="地球儀">
<link rel="manifest" href="/manifest.json">
<title>WebGL 地球儀</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { background:#000; color:#e6edf3; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:13px; height:100vh; height:100dvh; display:flex; flex-direction:column; overflow:hidden; }
.topbar { background:#0d1117; border-bottom:1px solid #30363d; padding:8px 18px; display:flex; align-items:center; gap:10px; flex-shrink:0; }
.topbar a { color:#58a6ff; text-decoration:none; font-size:12px; }
h1 { font-size:14px; font-weight:700; }
.badge { background:#0c2d4e; color:#58a6ff; font-size:10px; padding:2px 7px; border-radius:10px; font-weight:600; }
.body { display:grid; grid-template-columns:1fr 280px; grid-template-rows:1fr; flex:1; min-height:0; }
@media(max-width:900px){ .body{ grid-template-columns:1fr; } .side{ display:none; } }
.canvas-wrap { position:relative; background:#000010; overflow:hidden; }
canvas { position:absolute; inset:0; width:100%; height:100%; cursor:grab; touch-action:none; display:block; }
canvas:active { cursor:grabbing; }
.hud { position:absolute; bottom:10px; left:10px; background:rgba(0,0,0,.7); border:1px solid #30363d; border-radius:6px; padding:6px 10px; font-size:11px; font-family:monospace; color:#58a6ff; line-height:1.9; pointer-events:none; }
#markers { position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; overflow:hidden; }
.mk { position:absolute; transform:translate(-50%,-50%); line-height:1; font-size:18px; text-shadow:0 1px 3px #000,0 0 8px rgba(0,0,0,0.9); pointer-events:auto; cursor:pointer; user-select:none; -webkit-user-select:none; }
.mk-ball { font-size:28px; }
#mk-tooltip { position:fixed; background:rgba(13,17,23,0.97); border:1px solid #58a6ff; border-radius:8px; padding:7px 12px; font-size:12px; color:#e6edf3; white-space:nowrap; pointer-events:none; opacity:0; transition:opacity .15s; z-index:60; transform:translate(-50%,-110%); line-height:1.7; text-align:center; }
#mk-tooltip.below { transform:translate(-50%, 14px); }
#mk-tooltip .tt-name { font-weight:700; font-size:13px; }
#mk-tooltip .tt-match { font-size:12px; margin-top:3px; }
#mk-tooltip .tt-flags { font-size:18px; letter-spacing:2px; }
#mk-tooltip .tt-time { color:#58a6ff; font-family:monospace; }
#mk-tooltip .tt-past { color:#555d68; }
.mk.elim { filter:grayscale(0.85) brightness(0.28) saturate(0.15); }
#schedule-panel { position:fixed; bottom:0; left:0; right:0; z-index:55; background:#0d1117; border-top:2px solid #58a6ff; border-radius:12px 12px 0 0; max-height:68vh; overflow-y:auto; transform:translateY(100%); transition:transform .3s ease; box-shadow:0 -4px 30px rgba(0,0,0,.8); }
#schedule-panel.open { transform:translateY(0); }
.sp-hdr { display:flex; align-items:center; justify-content:space-between; padding:12px 16px 8px; border-bottom:1px solid #30363d; position:sticky; top:0; background:#0d1117; z-index:1; }
.sp-title { font-size:13px; font-weight:700; color:#58a6ff; }
.sp-close { background:none; border:none; color:#8b949e; font-size:22px; line-height:1; cursor:pointer; padding:0 2px; }
.sp-date { padding:8px 16px 4px; font-size:10px; font-weight:700; color:#8b949e; text-transform:uppercase; letter-spacing:1px; }
.sp-match { display:flex; justify-content:space-between; align-items:center; padding:7px 16px; border-bottom:1px solid #21262d; }
.sp-match:last-child { border-bottom:none; }
.sp-flags { font-size:18px; letter-spacing:2px; }
.tm-code { font-size:10px; font-weight:700; letter-spacing:1px; color:#8b949e; font-family:'SFMono-Regular',Consolas,monospace; vertical-align:middle; }
.sp-time { font-family:monospace; font-size:12px; color:#58a6ff; }
.sp-match.sp-past { opacity:0.45; }
.sp-match.sp-today { background:rgba(88,166,255,0.07); }
.side { background:#0d1117; border-left:1px solid #30363d; overflow-y:auto; padding:16px; }
.side h2 { font-size:11px; font-weight:700; color:#58a6ff; text-transform:uppercase; letter-spacing:.5px; margin-bottom:10px; }
.item { margin-bottom:12px; }
.item-title { font-weight:600; font-size:12px; margin-bottom:3px; }
.item-desc { color:#8b949e; font-size:11px; line-height:1.6; }
code { background:#21262d; padding:1px 5px; border-radius:3px; font-family:monospace; font-size:10px; }
hr { border:none; border-top:1px solid #30363d; margin:12px 0; }
.tip { background:#0c2d4e; border-radius:6px; padding:8px 10px; font-size:11px; color:#8b949e; line-height:1.7; margin-bottom:12px; }
@media (display-mode: standalone) { .pwa-hide { display:none !important; } }
.mk-hw { font-size:15px; }
#btnHeritage.active { background:#0c2d1a; border-color:#3fb950; color:#3fb950; }
.ctrl-row { margin-bottom:10px; }
.ctrl-label { font-size:11px; color:#8b949e; margin-bottom:4px; }
.slider-row { display:flex; align-items:center; gap:8px; }
input[type=range] { flex:1; accent-color:#58a6ff; }
.sval { font-family:monospace; font-size:11px; color:#58a6ff; min-width:36px; }
.canvas-ctrl-btns { position:absolute; top:10px; right:10px; display:flex; flex-direction:row; gap:6px; z-index:5; }
.canvas-ctrl-btn { background:rgba(13,17,23,0.88); border:1px solid #30363d; border-radius:6px; color:#e6edf3; font-size:12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; padding:6px 12px; cursor:pointer; white-space:nowrap; transition:background .15s,border-color .15s,color .15s; text-align:left; }
.canvas-ctrl-btn:hover { background:rgba(13,17,23,1); border-color:#58a6ff; }
.canvas-ctrl-btn.active { background:#0c2d4e; border-color:#58a6ff; color:#58a6ff; }
#drawer-overlay { position:fixed; inset:0; z-index:68; background:rgba(0,0,0,.55); display:none; }
#drawer-overlay.open { display:block; }
#left-drawer { position:fixed; top:0; left:0; bottom:0; width:300px; max-width:90vw; z-index:69; background:#0d1117; border-right:2px solid #30363d; transform:translateX(-100%); transition:transform .3s ease; display:flex; flex-direction:column; }
#left-drawer.open { transform:translateX(0); }
.drw-hdr { display:flex; align-items:center; justify-content:space-between; padding:12px 14px 10px; border-bottom:1px solid #30363d; flex-shrink:0; background:#0d1117; }
.drw-title { font-size:13px; font-weight:700; color:#58a6ff; }
.drw-close { background:none; border:none; color:#8b949e; font-size:22px; line-height:1; cursor:pointer; padding:0 2px; }
#drw-body { overflow-y:auto; flex:1; }
.drw-row { display:flex; align-items:center; justify-content:space-between; padding:9px 14px; border-bottom:1px solid #21262d; cursor:pointer; gap:8px; -webkit-tap-highlight-color:transparent; }
.drw-row:active { background:#21262d; }
.drw-flags { font-size:22px; letter-spacing:3px; flex-shrink:0; }
.drw-meta { font-family:monospace; font-size:11px; color:#58a6ff; text-align:right; white-space:nowrap; }
.drw-row.drw-past { opacity:0.38; }
.drw-row.drw-live { background:rgba(63,185,80,.08); border-left:3px solid #3fb950; }
#match-info { position:absolute; top:52px; left:50%; transform:translateX(-50%); z-index:6; background:rgba(13,17,23,0.93); border:1px solid #30363d; border-radius:12px; padding:14px 28px 12px; text-align:center; opacity:0; pointer-events:none; transition:opacity .2s; white-space:nowrap; box-shadow:0 4px 24px rgba(0,0,0,.7); }
#match-info.open { opacity:1; pointer-events:auto; }
.mi-flags { font-size:56px; letter-spacing:4px; line-height:1.1; display:flex; align-items:center; justify-content:center; gap:10px; }
.mi-vs { font-size:16px; color:#484f58; font-weight:700; }
.grp-section { margin-bottom:18px; }
.grp-section h2 { font-size:11px; font-weight:700; color:#58a6ff; text-transform:uppercase; letter-spacing:.5px; margin-bottom:8px; }
.grp-row { display:flex; align-items:center; gap:4px; margin-bottom:4px; }
.grp-label { font-size:10px; font-weight:700; color:#58a6ff; background:rgba(88,166,255,0.1); border:1px solid rgba(88,166,255,0.2); border-radius:4px; padding:1px 4px; width:18px; text-align:center; flex-shrink:0; }
.grp-flags { display:flex; gap:1px; }
.grp-flag { display:inline-flex; width:30px; justify-content:center; align-items:center; border:2px solid #0d1117; border-radius:4px; padding:2px 0; line-height:1; font-size:16px; box-sizing:border-box; flex-shrink:0; }
.grp-flag-today { border-color:rgba(139,148,158,0.45); cursor:pointer; }
.grp-flag-today:hover { border-color:rgba(139,148,158,0.75); background:rgba(139,148,158,0.06); }
.grp-flag-active { border-color:rgba(255,200,0,0.9) !important; background:rgba(255,200,0,0.07); }
.drw-row.drw-highlight { background:rgba(255,240,60,0.12); border-left:3px solid rgba(255,240,60,0.7); }
.drw-section-body { display:none; }
.drw-section.open .drw-section-body { display:block; }
.drw-date { padding:8px 14px 4px; font-size:10px; font-weight:700; color:#8b949e; letter-spacing:1px; text-transform:uppercase; position:sticky; top:0; background:#0d1117; border-bottom:1px solid #21262d; cursor:pointer; display:flex; justify-content:space-between; align-items:center; user-select:none; -webkit-user-select:none; }
.drw-chevron { font-size:9px; opacity:0.5; transition:transform .2s; }
.drw-section.open .drw-chevron { transform:rotate(180deg); }
.cal-match { cursor:pointer; }
.cal-match:hover { filter:brightness(1.15); }
.cal-selected { outline:2px solid rgba(88,166,255,0.7); outline-offset:-1px; }
.cal-wrap { margin-bottom:14px; }
.cal-title { font-size:10px; font-weight:700; color:#58a6ff; text-transform:uppercase; letter-spacing:.5px; margin-bottom:5px; }
.cal-legend { display:flex; flex-wrap:wrap; gap:3px; margin-bottom:5px; }
.cal-leg { font-size:8px; font-weight:700; padding:1px 4px; border-radius:3px; color:#e6edf3; }
.cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; }
.cal-cell { font-size:9px; text-align:center; padding:3px 0 2px; border-radius:3px; color:#484f58; line-height:1.3; }
.cal-hdr { font-weight:700; color:#30363d; font-size:8px; padding-bottom:3px; }
.cal-match { color:#e6edf3; }
.cal-today { outline:1.5px solid #58a6ff; outline-offset:-1px; }
.cal-rlabel { font-size:7px; font-weight:700; color:rgba(255,255,255,0.75); line-height:1; margin-top:1px; }
.drw-cal-wrap { padding:10px 14px 12px; border-bottom:1px solid #30363d; flex-shrink:0; }
.tnmt-grp-list { display:flex; flex-wrap:wrap; gap:6px; padding:10px 16px 12px; border-bottom:1px solid #30363d; }
.tnmt-grp-item { display:flex; align-items:center; gap:3px; }
.tnmt-grp-badge { font-size:9px; font-weight:700; color:#58a6ff; background:rgba(88,166,255,0.1); border:1px solid rgba(88,166,255,0.2); border-radius:3px; padding:1px 4px; flex-shrink:0; }
.tnmt-grp-flags { font-size:15px; letter-spacing:1px; }
@keyframes cal-blink { 0%,100%{box-shadow:none;background-color:transparent} 50%{box-shadow:0 0 0 2px rgba(255,200,0,0.9);background-color:rgba(255,200,0,0.28)} }
.cal-today-blink { animation:cal-blink 0.35s ease 7; }
.mi-time { font-size:13px; color:#58a6ff; font-family:monospace; margin-top:6px; }
.mi-date { font-size:11px; color:#8b949e; margin-top:3px; }
.mi-close { position:absolute; top:6px; right:10px; background:none; border:none; color:#8b949e; font-size:18px; line-height:1; cursor:pointer; padding:0; }
#drawer-open-btn { position:absolute; left:10px; top:10px; z-index:5; background:rgba(13,17,23,0.88); border:1px solid #30363d; border-radius:6px; color:#e6edf3; font-size:12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; padding:6px 12px; cursor:pointer; white-space:nowrap; transition:background .15s,border-color .15s; }
#drawer-open-btn:hover { background:rgba(13,17,23,1); border-color:#58a6ff; }
#tnmt-btn { position:absolute; left:10px; top:50px; z-index:5; background:rgba(13,17,23,0.88); border:1px solid #30363d; border-radius:6px; color:#e6edf3; font-size:12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; padding:6px 12px; cursor:pointer; white-space:nowrap; transition:background .15s,border-color .15s; }
#tnmt-btn:hover { background:rgba(13,17,23,1); border-color:#f0b429; color:#f0b429; }
#tnmt-overlay { position:fixed; inset:0; z-index:300; background:rgba(0,0,0,0.88); display:none; overflow-y:auto; }
#tnmt-overlay.open { display:block; }
.tnmt-modal { background:#0d1117; border:1px solid #30363d; border-radius:12px; margin:20px auto; max-width:980px; overflow:hidden; }
.tnmt-hdr { display:flex; align-items:center; justify-content:space-between; padding:14px 18px; border-bottom:1px solid #30363d; position:sticky; top:0; background:#0d1117; z-index:1; }
.tnmt-title { font-size:14px; font-weight:700; color:#f0b429; }
.tnmt-close { background:none; border:none; color:#8b949e; font-size:22px; line-height:1; cursor:pointer; padding:0 4px; }
.tnmt-close:hover { color:#e6edf3; }
.tnmt-body { padding:16px; overflow-x:auto; }
.tnmt-bracket { display:flex; gap:10px; min-width:820px; align-items:flex-start; }
.tnmt-col { display:flex; flex-direction:column; flex:1; min-width:0; }
.tnmt-col-hdr { font-size:10px; font-weight:700; color:#58a6ff; text-transform:uppercase; letter-spacing:.5px; text-align:center; padding:5px 4px 8px; border-bottom:1px solid #21262d; margin-bottom:8px; white-space:nowrap; }
.tnmt-col-final .tnmt-col-hdr { color:#f0b429; }
.tnmt-spacer { flex:1; }
.tnmt-match { background:#161b22; border:1px solid #30363d; border-radius:6px; padding:6px 8px; margin-bottom:6px; }
.tnmt-match-date { font-size:9px; color:#e6edf3; font-family:monospace; margin-bottom:4px; text-align:right; }
.tnmt-team { display:flex; align-items:center; gap:5px; padding:3px 2px; border-radius:3px; }
.tnmt-team + .tnmt-team { border-top:1px solid #21262d; margin-top:2px; padding-top:5px; }
.tnmt-team-flag { font-size:18px; line-height:1; }
.tnmt-team-code { font-size:10px; font-weight:700; color:#8b949e; font-family:'SFMono-Regular',Consolas,monospace; }
.tnmt-team-tbd { font-size:11px; color:#e6edf3; font-style:italic; }
.tnmt-winner { color:#f0b429; }
.tnmt-winner .tnmt-team-code { color:#f0b429; }
.tnmt-3rd { margin-top:16px; border-top:1px solid #30363d; padding-top:14px; }
.tnmt-3rd-label { font-size:11px; font-weight:700; color:#8b949e; text-align:center; margin-bottom:8px; }
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
  <h1>WebGL 地球儀</h1>
  <span class="badge">WebGL</span>
  <span style="flex:1"></span>
  <a href="/webgl-heritage">🏛️ 世界遺産</a>
  <a href="/webgl-demo" class="pwa-hide">3D Cube</a>
  <a href="/htmlrewriter-demo" class="pwa-hide">HTMLRewriter</a>
  <a href="/settings" class="pwa-hide">&#9881;</a>
  <span class="pwa-hide" style="color:#8b949e;font-size:11px">${safeUser}</span>
</div>

<div class="body">
  <div class="canvas-wrap">
    <canvas id="c"></canvas>
    <div id="markers"></div>
    <div class="hud" id="hud">テクスチャ読み込み中...</div>
    <div class="canvas-ctrl-btns">
      <button class="canvas-ctrl-btn" id="btnAxisLock" title="地軸を画面に対して垂直に固定するモード">＋ 軸垂直固定</button>
      <button class="canvas-ctrl-btn" id="btnAutoRot" title="自転の停止/再開">⏸ 自転停止</button>
    </div>
    <button id="drawer-open-btn" title="試合一覧を開く">&#9776; 試合一覧</button>
    <button id="tnmt-btn" title="トーナメント表を開く">&#127942; トーナメント</button>
    <div id="match-info">
      <button class="mi-close" id="miClose">&#10005;</button>
      <div class="mi-flags" id="mi-flags"></div>
      <div class="mi-time"  id="mi-time"></div>
      <div class="mi-date"  id="mi-date"></div>
    </div>
  </div>
  <div class="side">
    <div id="cal-section"></div>

    <div class="grp-section">
    <h2>グループ一覧</h2>
    <div id="grp-body"></div>
  </div>
  <h2>コントロール</h2>
    <div class="ctrl-row">
      <div class="ctrl-label">自転速度</div>
      <div class="slider-row">
        <input type="range" id="rotSpd" min="0" max="5" step="0.1" value="1">
        <span class="sval" id="rotSpdVal">1.0</span>
      </div>
    </div>

    <hr>
    <h2>実装ポイント</h2>

    <div class="item">
      <div class="item-title">テクスチャ（NASA Blue Marble）</div>
      <div class="item-desc">NASA が公開する Blue Marble 2048×1024 の正距円筒図法画像を Workers Static Assets で配信。<code>/earth.jpg</code> として同一オリジンから取得するため CORS 不要。</div>
    </div>
    <div class="item">
      <div class="item-title">海洋スペキュラー</div>
      <div class="item-desc">フラグメントシェーダーでテクスチャの B-R 差分から海陸を推定し、海面にのみブリン・フォン鏡面反射を適用。</div>
    </div>
    <div class="item">
      <div class="item-title">大気散乱グロー</div>
      <div class="item-desc">法線と視線内積の 3 乗から縁付近を検出。青を 2 段で加算し地球縁の大気発光を表現。</div>
    </div>
    <div class="item">
      <div class="item-title">Workers Static Assets</div>
      <div class="item-desc"><code>wrangler.toml</code> に <code>assets = &#123; directory = "./public" &#125;</code> を追記。<code>public/</code> 内のファイルが Worker を経由せず Cloudflare CDN から直配信される。</div>
    </div>
  </div>
</div>

<div id="tnmt-overlay">
  <div class="tnmt-modal">
    <div class="tnmt-hdr">
      <span class="tnmt-title">&#127942; 2026 FIFA ワールドカップ トーナメント</span>
      <button class="tnmt-close" id="tnmtClose">&#10005;</button>
    </div>
    <div class="tnmt-body" id="tnmt-body"></div>
  </div>
</div>
<div id="mk-tooltip"></div>
<div id="drawer-overlay"></div>
<div id="left-drawer">
  <div class="drw-hdr">
    <span class="drw-title">&#9917; 2026 FIFA W杯 全104試合(32+72)</span>
    <button class="drw-close" id="drwClose">&#10005;</button>
  </div>
  <div id="drw-cal"></div>
  <div id="drw-body"></div>
</div>
<div id="schedule-panel">
  <div class="sp-hdr">
    <span class="sp-title">&#9917; 2026 FIFA W杯 試合スケジュール</span>
    <button class="sp-close" id="spClose">&#10005;</button>
  </div>
  <div id="sp-body"></div>
</div>

<script>
function getNextZ() {
  var max = 100;
  var els = document.querySelectorAll('*');
  for (var i = 0; i < els.length; i++) {
    var z = parseInt(window.getComputedStyle(els[i]).zIndex, 10);
    if (!isNaN(z) && z > max) max = z;
  }
  return max + 100;
}
</script>
<script>
(function() {
  var canvas = document.getElementById("c");
  var wrap   = canvas.parentElement;
  var hud    = document.getElementById("hud");
  var markersDiv = document.getElementById("markers");

  function resize() {
    var r = wrap.getBoundingClientRect();
    var w = Math.round(r.width);
    var h = Math.round(r.height);
    if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
      canvas.width  = w;
      canvas.height = h;
    }
  }
  resize();
  window.addEventListener("resize", resize);

  var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (!gl) { hud.textContent = "WebGL が利用できません"; return; }

  function compileShader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  var prog = gl.createProgram();
  gl.attachShader(prog, compileShader(gl.VERTEX_SHADER,   document.getElementById("vs").textContent));
  gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, document.getElementById("fs").textContent));
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
  var aPos  = gl.getAttribLocation(prog, "aPos");
  var aNorm = gl.getAttribLocation(prog, "aNorm");
  var aUV   = gl.getAttribLocation(prog, "aUV");
  gl.enableVertexAttribArray(aPos);  gl.vertexAttribPointer(aPos,  3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(aNorm); gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, stride, 12);
  gl.enableVertexAttribArray(aUV);   gl.vertexAttribPointer(aUV,   2, gl.FLOAT, false, stride, 24);

  var uMVP   = gl.getUniformLocation(prog, "uMVP");
  var uModel = gl.getUniformLocation(prog, "uModel");
  var uLight = gl.getUniformLocation(prog, "uLight");
  var uTex   = gl.getUniformLocation(prog, "uTex");
  gl.uniform1i(uTex, 0);

  function getSunDir() {
    var now = new Date();
    var utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    var sunLon = (utcH - 12) / 24 * 2 * Math.PI;
    var start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    var doy = Math.floor((now.getTime() - start.getTime()) / 86400000);
    var sunLat = 23.45 * Math.PI / 180 * Math.sin(2 * Math.PI * (doy - 80) / 365);
    return [
      Math.cos(sunLat) * Math.cos(sunLon),
      Math.sin(sunLat),
      Math.cos(sunLat) * Math.sin(sunLon)
    ];
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
  earthImg.onerror = function() {
    hud.textContent = "テクスチャ読み込み失敗 — /earth.jpg が見つかりません";
  };
  earthImg.src = "/earth.jpg";

  function m4()      { return new Float32Array(16); }
  function ident(m)  { for(var i=0;i<16;i++) m[i]=0; m[0]=m[5]=m[10]=m[15]=1; return m; }
  function mul(o,a,b){
    for(var i=0;i<4;i++) for(var j=0;j<4;j++){
      var s=0; for(var k=0;k<4;k++) s+=a[i+k*4]*b[k+j*4]; o[i+j*4]=s;
    } return o;
  }
  function persp(m,fov,asp,near,far){
    ident(m); var f=1/Math.tan(fov/2);
    m[0]=f/asp; m[5]=f; m[10]=(far+near)/(near-far); m[11]=-1;
    m[14]=2*far*near/(near-far); m[15]=0; return m;
  }
  function rotX(m,r){ ident(m); var c=Math.cos(r),s=Math.sin(r); m[5]=c;m[6]=s;m[9]=-s;m[10]=c; return m; }
  function rotY(m,r){ ident(m); var c=Math.cos(r),s=Math.sin(r); m[0]=c;m[2]=-s;m[8]=s;m[10]=c; return m; }
  function rotZ(m,r){ ident(m); var c=Math.cos(r),s=Math.sin(r); m[0]=c;m[1]=s;m[4]=-s;m[5]=c; return m; }
  function trans(m,x,y,z){ ident(m); m[12]=x;m[13]=y;m[14]=z; return m; }

  var axialTilt = -23.4 * Math.PI / 180;
  var ELEV_MAX = Math.PI / 2 - 0.02;
  function clampElev(v){ return v < -ELEV_MAX ? -ELEV_MAX : (v > ELEV_MAX ? ELEV_MAX : v); }

  var proj=m4(),view=m4(),model=m4(),rx=m4(),ry=m4(),tz=m4(),tmp=m4(),tmp2=m4(),mvp=m4();
  var rotXv = 0.3, rotYv = 0.6, zoom = 3.2, autoRot = true;
  var drag = false, lx = 0, ly = 0, pinch0 = 0, touchMoved = false;

  var axisLocked = false;

  var btnAxisLock = document.getElementById("btnAxisLock");
  var btnAutoRot  = document.getElementById("btnAutoRot");

  btnAxisLock.addEventListener("click", function() {
    axisLocked = !axisLocked;
    if (axisLocked) {
      rotXv = 0;
      btnAxisLock.classList.add("active");
      btnAxisLock.textContent = "＋ 軸固定中";
    } else {
      btnAxisLock.classList.remove("active");
      btnAxisLock.textContent = "＋ 軸垂直固定";
    }
  });

  btnAutoRot.addEventListener("click", function() {
    autoRot = !autoRot;
    btnAutoRot.textContent = autoRot ? "⏸ 自転停止" : "▶ 回転";
    if (autoRot) { btnAutoRot.classList.remove("active"); } else { btnAutoRot.classList.add("active"); }
  });


  var rotSpdEl    = document.getElementById("rotSpd");
  var rotSpdValEl = document.getElementById("rotSpdVal");
  rotSpdEl.addEventListener("input", function(){ rotSpdValEl.textContent = parseFloat(rotSpdEl.value).toFixed(1); });

  var velY = 0, velX = 0, momentumY = 0, momentumX = 0;
  var MOMENTUM_DECAY = 0.92;

  canvas.addEventListener("mousedown",  function(e){ drag=true; lx=e.clientX; ly=e.clientY; momentumY=0; momentumX=0; velY=0; velX=0; });
  function applySpinBoost(v) {
    var spd = parseFloat(rotSpdEl.value);
    var factor = Math.random() * spd;
    return v * (1 + factor);
  }
  window.addEventListener("mouseup",    function(){ if(!drag)return; drag=false; momentumY=applySpinBoost(velY); momentumX=applySpinBoost(velX); velY=0; velX=0; });
  window.addEventListener("mousemove",  function(e){ if(!drag)return; var dy=(e.clientX-lx)*0.008; var dx=(e.clientY-ly)*0.008; rotYv+=dy; velY=velY*0.4+dy*0.6; if(!axisLocked){ rotXv=clampElev(rotXv+dx); velX=velX*0.4+dx*0.6; } lx=e.clientX; ly=e.clientY; });
  canvas.addEventListener("wheel",      function(e){ e.preventDefault(); zoom=Math.max(1.6,Math.min(10,zoom+e.deltaY*0.01)); },{passive:false});
  canvas.addEventListener("dblclick",   function(){ autoRot=!autoRot; btnAutoRot.textContent = autoRot ? "⏸ 自転停止" : "▶ 回転"; if(autoRot){btnAutoRot.classList.remove("active");}else{btnAutoRot.classList.add("active");} });
  canvas.addEventListener("touchstart", function(e){ e.preventDefault(); touchMoved=false; momentumY=0; momentumX=0; velY=0; velX=0; if(e.touches.length===1){drag=true;lx=e.touches[0].clientX;ly=e.touches[0].clientY;} if(e.touches.length===2){pinch0=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);} },{passive:false});
  canvas.addEventListener("touchmove",  function(e){ e.preventDefault(); touchMoved=true; if(e.touches.length===1&&drag){ var dy=(e.touches[0].clientX-lx)*0.008; var dx=(e.touches[0].clientY-ly)*0.008; rotYv+=dy; velY=velY*0.4+dy*0.6; if(!axisLocked){rotXv=clampElev(rotXv+dx); velX=velX*0.4+dx*0.6;} lx=e.touches[0].clientX;ly=e.touches[0].clientY;} if(e.touches.length===2){var d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);zoom=Math.max(1.6,Math.min(10,zoom-(d-pinch0)*0.02));pinch0=d;} },{passive:false});
  canvas.addEventListener("touchend", function(e){
    drag=false;
    momentumY=applySpinBoost(velY); momentumX=applySpinBoost(velX); velY=0; velX=0;
    if (!touchMoved && e.changedTouches.length === 1) {
      momentumY=0; momentumX=0;
      hideTooltip();
      schedulePanel.classList.remove("open");
      var ball = wc2026[0];
      activeMarkerIdx = 0;
      flyTo(ball.lat, ball.lon);
    }
  });

  // 2026 FIFAワールドカップ出場国（⚽=開催地マーカー）
  var wc2026 = [
    {flag:"⚽", name:"2026 FIFA W杯 開催地", lat:34, lon:-99, ball:true},
    {flag:"🏟️", name:"Lumen Field（シアトル）", lat:47.595, lon:-122.332},
    {flag:"🇲🇽", name:"メキシコ", lat:23, lon:-102},
    {flag:"🇿🇦", name:"南アフリカ", lat:-29, lon:25},
    {flag:"🇰🇷", name:"韓国", lat:36, lon:128},
    {flag:"🇨🇿", name:"チェコ", lat:50, lon:15},
    {flag:"🇨🇦", name:"カナダ", lat:56, lon:-96},
    {flag:"🇧🇦", name:"ボスニア・ヘルツェゴビナ", lat:44, lon:17},
    {flag:"🇶🇦", name:"カタール", lat:25, lon:51},
    {flag:"🇨🇭", name:"スイス", lat:47, lon:8},
    {flag:"🏴󠁧󠁢󠁳󠁣󠁴󠁿", name:"スコットランド", lat:57, lon:-4},
    {flag:"🇧🇷", name:"ブラジル", lat:-10, lon:-53},
    {flag:"🇲🇦", name:"モロッコ", lat:32, lon:-6},
    {flag:"🇭🇹", name:"ハイチ", lat:19, lon:-73},
    {flag:"🇺🇸", name:"アメリカ合衆国", lat:39, lon:-95},
    {flag:"🇦🇺", name:"オーストラリア", lat:-27, lon:133},
    {flag:"🇹🇷", name:"トルコ", lat:39, lon:35},
    {flag:"🇵🇾", name:"パラグアイ", lat:-23, lon:-58},
    {flag:"🇩🇪", name:"ドイツ", lat:51, lon:10},
    {flag:"🇨🇮", name:"コートジボワール", lat:7, lon:-5},
    {flag:"🇪🇨", name:"エクアドル", lat:-2, lon:-78},
    {flag:"🇨🇼", name:"キュラソー", lat:12, lon:-69},
    {flag:"🇸🇪", name:"スウェーデン", lat:60, lon:18},
    {flag:"🇯🇵", name:"日本", lat:36, lon:138},
    {flag:"🇳🇱", name:"オランダ", lat:52, lon:5},
    {flag:"🇹🇳", name:"チュニジア", lat:34, lon:9},
    {flag:"🇮🇷", name:"イラン", lat:32, lon:53},
    {flag:"🇳🇿", name:"ニュージーランド", lat:-41, lon:174},
    {flag:"🇧🇪", name:"ベルギー", lat:50, lon:4},
    {flag:"🇪🇬", name:"エジプト", lat:26, lon:30},
    {flag:"🇸🇦", name:"サウジアラビア", lat:24, lon:45},
    {flag:"🇺🇾", name:"ウルグアイ", lat:-33, lon:-56},
    {flag:"🇨🇻", name:"カーボベルデ", lat:16, lon:-24},
    {flag:"🇪🇸", name:"スペイン", lat:40, lon:-4},
    {flag:"🇫🇷", name:"フランス", lat:46, lon:2},
    {flag:"🇮🇶", name:"イラク", lat:33, lon:44},
    {flag:"🇳🇴", name:"ノルウェー", lat:61, lon:8},
    {flag:"🇸🇳", name:"セネガル", lat:14, lon:-14},
    {flag:"🇩🇿", name:"アルジェリア", lat:28, lon:3},
    {flag:"🇦🇷", name:"アルゼンチン", lat:-34, lon:-64},
    {flag:"🇦🇹", name:"オーストリア", lat:47, lon:14},
    {flag:"🇯🇴", name:"ヨルダン", lat:31, lon:36},
    {flag:"🇨🇴", name:"コロンビア", lat:4, lon:-72},
    {flag:"🇨🇩", name:"コンゴ民主共和国", lat:-4, lon:24},
    {flag:"🇵🇹", name:"ポルトガル", lat:39, lon:-8},
    {flag:"🇺🇿", name:"ウズベキスタン", lat:41, lon:64},
    {flag:"🇭🇷", name:"クロアチア", lat:45, lon:16},
    {flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", name:"イングランド", lat:52, lon:-1},
    {flag:"🇬🇭", name:"ガーナ", lat:8, lon:-1},
    {flag:"🇵🇦", name:"パナマ", lat:9, lon:-80}
  ];

  function latLonTo3D(lat, lon) {
    var latR = lat * Math.PI / 180;
    var lonR = lon * Math.PI / 180;
    return [
      Math.cos(latR) * Math.cos(lonR),
      Math.sin(latR),
      -Math.cos(latR) * Math.sin(lonR)
    ];
  }

  var MATCHES = [
    {a:"🇲🇽",b:"🇿🇦",date:"2026-06-11",time:"19:00"},
    {a:"🇰🇷",b:"🇨🇿",date:"2026-06-12",time:"02:00"},
    {a:"🇨🇦",b:"🇧🇦",date:"2026-06-12",time:"19:00"},
    {a:"🇺🇸",b:"🇵🇾",date:"2026-06-13",time:"01:00"},
    {a:"🇶🇦",b:"🇨🇭",date:"2026-06-13",time:"19:00"},
    {a:"🇧🇷",b:"🇲🇦",date:"2026-06-13",time:"22:00"},
    {a:"🇭🇹",b:"🏴󠁧󠁢󠁳󠁣󠁴󠁿",date:"2026-06-14",time:"01:00"},
    {a:"🇦🇺",b:"🇹🇷",date:"2026-06-14",time:"04:00"},
    {a:"🇩🇪",b:"🇨🇼",date:"2026-06-14",time:"17:00"},
    {a:"🇳🇱",b:"🇯🇵",date:"2026-06-14",time:"20:00"},
    {a:"🇨🇮",b:"🇪🇨",date:"2026-06-14",time:"23:00"},
    {a:"🇸🇪",b:"🇹🇳",date:"2026-06-15",time:"02:00"},
    {a:"🇪🇸",b:"🇨🇻",date:"2026-06-15",time:"16:00"},
    {a:"🇧🇪",b:"🇪🇬",date:"2026-06-15",time:"19:00"},
    {a:"🇸🇦",b:"🇺🇾",date:"2026-06-15",time:"22:00"},
    {a:"🇮🇷",b:"🇳🇿",date:"2026-06-16",time:"01:00"},
    {a:"🇫🇷",b:"🇸🇳",date:"2026-06-16",time:"19:00"},
    {a:"🇮🇶",b:"🇳🇴",date:"2026-06-16",time:"22:00"},
    {a:"🇦🇷",b:"🇩🇿",date:"2026-06-17",time:"01:00"},
    {a:"🇦🇹",b:"🇯🇴",date:"2026-06-17",time:"04:00"},
    {a:"🇵🇹",b:"🇨🇩",date:"2026-06-17",time:"17:00"},
    {a:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",b:"🇭🇷",date:"2026-06-17",time:"20:00"},
    {a:"🇬🇭",b:"🇵🇦",date:"2026-06-17",time:"23:00"},
    {a:"🇺🇿",b:"🇨🇴",date:"2026-06-18",time:"02:00"},
    {a:"🇨🇿",b:"🇿🇦",date:"2026-06-18",time:"16:00"},
    {a:"🇨🇭",b:"🇧🇦",date:"2026-06-18",time:"19:00"},
    {a:"🇨🇦",b:"🇶🇦",date:"2026-06-18",time:"22:00"},
    {a:"🇲🇽",b:"🇰🇷",date:"2026-06-19",time:"01:00"},
    {a:"🇺🇸",b:"🇦🇺",date:"2026-06-19",time:"19:00"},
    {a:"🏴󠁧󠁢󠁳󠁣󠁴󠁿",b:"🇲🇦",date:"2026-06-19",time:"22:00"},
    {a:"🇧🇷",b:"🇭🇹",date:"2026-06-20",time:"00:30"},
    {a:"🇹🇷",b:"🇵🇾",date:"2026-06-20",time:"03:00"},
    {a:"🇳🇱",b:"🇸🇪",date:"2026-06-20",time:"17:00"},
    {a:"🇩🇪",b:"🇨🇮",date:"2026-06-20",time:"20:00"},
    {a:"🇪🇨",b:"🇨🇼",date:"2026-06-21",time:"00:00"},
    {a:"🇹🇳",b:"🇯🇵",date:"2026-06-21",time:"04:00"},
    {a:"🇪🇸",b:"🇸🇦",date:"2026-06-21",time:"16:00"},
    {a:"🇧🇪",b:"🇮🇷",date:"2026-06-21",time:"19:00"},
    {a:"🇺🇾",b:"🇨🇻",date:"2026-06-21",time:"22:00"},
    {a:"🇳🇿",b:"🇪🇬",date:"2026-06-22",time:"01:00"},
    {a:"🇦🇷",b:"🇦🇹",date:"2026-06-22",time:"17:00"},
    {a:"🇫🇷",b:"🇮🇶",date:"2026-06-22",time:"21:00"},
    {a:"🇳🇴",b:"🇸🇳",date:"2026-06-23",time:"00:00"},
    {a:"🇯🇴",b:"🇩🇿",date:"2026-06-23",time:"03:00"},
    {a:"🇵🇹",b:"🇺🇿",date:"2026-06-23",time:"17:00"},
    {a:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",b:"🇬🇭",date:"2026-06-23",time:"20:00"},
    {a:"🇵🇦",b:"🇭🇷",date:"2026-06-23",time:"23:00"},
    {a:"🇨🇴",b:"🇨🇩",date:"2026-06-24",time:"02:00"},
    {a:"🇨🇭",b:"🇨🇦",date:"2026-06-24",time:"19:00"},
    {a:"🇧🇦",b:"🇶🇦",date:"2026-06-24",time:"19:00"},
    {a:"🏴󠁧󠁢󠁳󠁣󠁴󠁿",b:"🇧🇷",date:"2026-06-24",time:"22:00"},
    {a:"🇲🇦",b:"🇭🇹",date:"2026-06-24",time:"22:00"},
    {a:"🇨🇿",b:"🇲🇽",date:"2026-06-25",time:"01:00"},
    {a:"🇿🇦",b:"🇰🇷",date:"2026-06-25",time:"01:00"},
    {a:"🇨🇼",b:"🇨🇮",date:"2026-06-25",time:"20:00"},
    {a:"🇪🇨",b:"🇩🇪",date:"2026-06-25",time:"20:00"},
    {a:"🇯🇵",b:"🇸🇪",date:"2026-06-25",time:"23:00"},
    {a:"🇹🇳",b:"🇳🇱",date:"2026-06-25",time:"23:00"},
    {a:"🇹🇷",b:"🇺🇸",date:"2026-06-26",time:"02:00"},
    {a:"🇵🇾",b:"🇦🇺",date:"2026-06-26",time:"02:00"},
    {a:"🇳🇴",b:"🇫🇷",date:"2026-06-26",time:"19:00"},
    {a:"🇸🇳",b:"🇮🇶",date:"2026-06-26",time:"19:00"},
    {a:"🇨🇻",b:"🇸🇦",date:"2026-06-27",time:"00:00"},
    {a:"🇺🇾",b:"🇪🇸",date:"2026-06-27",time:"00:00"},
    {a:"🇪🇬",b:"🇮🇷",date:"2026-06-27",time:"03:00"},
    {a:"🇳🇿",b:"🇧🇪",date:"2026-06-27",time:"03:00"},
    {a:"🇵🇦",b:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",date:"2026-06-27",time:"21:00"},
    {a:"🇭🇷",b:"🇬🇭",date:"2026-06-27",time:"21:00"},
    {a:"🇨🇴",b:"🇵🇹",date:"2026-06-27",time:"23:30"},
    {a:"🇨🇩",b:"🇺🇿",date:"2026-06-27",time:"23:30"},
    {a:"🇩🇿",b:"🇦🇹",date:"2026-06-28",time:"02:00"},
    {a:"🇯🇴",b:"🇦🇷",date:"2026-06-28",time:"02:00"}
  ];
  var FLAG_CODE = {
    '🇲🇽':'MEX','🇿🇦':'RSA','🇰🇷':'KOR','🇨🇿':'CZE','🇨🇦':'CAN','🇧🇦':'BIH',
    '🇺🇸':'USA','🇵🇾':'PAR','🇶🇦':'QAT','🇨🇭':'SUI','🇧🇷':'BRA','🇲🇦':'MAR',
    '🇭🇹':'HAI','🇦🇺':'AUS','🇹🇷':'TUR','🇩🇪':'GER','🇨🇼':'CUW','🇳🇱':'NED',
    '🇯🇵':'JPN','🇨🇮':'CIV','🇪🇨':'ECU','🇸🇪':'SWE','🇹🇳':'TUN','🇪🇸':'ESP',
    '🇨🇻':'CPV','🇧🇪':'BEL','🇪🇬':'EGY','🇸🇦':'KSA','🇺🇾':'URU','🇮🇷':'IRN',
    '🇳🇿':'NZL','🇫🇷':'FRA','🇸🇳':'SEN','🇮🇶':'IRQ','🇳🇴':'NOR','🇦🇷':'ARG',
    '🇩🇿':'ALG','🇦🇹':'AUT','🇯🇴':'JOR','🇵🇹':'POR','🇨🇩':'COD','🇭🇷':'CRO',
    '🇬🇭':'GHA','🇵🇦':'PAN','🇺🇿':'UZB','🇨🇴':'COL','🏴󠁧󠁢󠁳󠁣󠁴󠁿':'SCO','🏴󠁧󠁢󠁥󠁮󠁧󠁿':'ENG'
  };
  function flagCode(f) { return FLAG_CODE[f] || ''; }
  function fc(f) { var c = flagCode(f); return c ? '<span class="tm-code">' + c + '</span>' : ''; }

  var GROUPS = [
    {g:'A', f:['🇲🇽','🇿🇦','🇰🇷','🇨🇿']},
    {g:'B', f:['🇨🇦','🇧🇦','🇶🇦','🇨🇭']},
    {g:'C', f:['🇧🇷','🇲🇦','🇭🇹','🏴󠁧󠁢󠁳󠁣󠁴󠁿']},
    {g:'D', f:['🇺🇸','🇵🇾','🇦🇺','🇹🇷']},
    {g:'E', f:['🇩🇪','🇨🇼','🇨🇮','🇪🇨']},
    {g:'F', f:['🇳🇱','🇯🇵','🇸🇪','🇹🇳']},
    {g:'G', f:['🇧🇪','🇪🇬','🇮🇷','🇳🇿']},
    {g:'H', f:['🇪🇸','🇨🇻','🇸🇦','🇺🇾']},
    {g:'I', f:['🇫🇷','🇸🇳','🇮🇶','🇳🇴']},
    {g:'J', f:['🇦🇷','🇩🇿','🇦🇹','🇯🇴']},
    {g:'K', f:['🇵🇹','🇨🇩','🇺🇿','🇨🇴']},
    {g:'L', f:['🏴󠁧󠁢󠁥󠁮󠁧󠁿','🇭🇷','🇬🇭','🇵🇦']}
  ];

  var CAL_R32_BG = 'rgba(88,166,255,0.18)';
  var CAL_R16_BG = 'rgba(88,166,255,0.32)';
  var CAL_QF_BG  = 'rgba(88,166,255,0.50)';
  var CAL_SF_BG  = 'rgba(88,166,255,0.66)';
  var CAL_3RD_BG = 'rgba(88,166,255,0.50)';
  var CAL_FIN_BG = 'rgba(88,166,255,0.90)';
  var CAL_DAYS = {
    1:CAL_R32_BG,2:CAL_R32_BG,3:CAL_R32_BG,4:CAL_R32_BG,5:CAL_R32_BG,6:CAL_R32_BG,
    8:CAL_R16_BG,9:CAL_R16_BG,10:CAL_R16_BG,11:CAL_R16_BG,12:CAL_R16_BG,
    14:CAL_QF_BG,15:CAL_QF_BG,16:CAL_QF_BG,
    19:CAL_SF_BG,20:CAL_SF_BG,
    23:CAL_3RD_BG,
    26:CAL_FIN_BG
  };
  var CAL_LABELS = {1:'R32',8:'R16',14:'QF',19:'SF',23:'3位',26:'決勝'};
  var CAL_ICONS_JUL = {27:'🏆'};

  function buildCalendar() {
    var sec = document.getElementById('cal-section');
    if (!sec) return;
    var firstDow = new Date(2026, 6, 1).getDay();
    var todayStr = new Date().toISOString().slice(0, 10);
    var todayDay = todayStr.startsWith('2026-07-') ? parseInt(todayStr.slice(8), 10) : 0;
    var wdays = ['日','月','火','水','木','金','土'];
    var html = '<div class="cal-wrap">';
    html += '<div class="cal-title">🏆 7️⃣月 ノックアウトステージ (32)🏃</div>';
    html += '<div class="cal-legend">';
    html += '<span class="cal-leg" style="background:' + CAL_R32_BG + '">R32</span>';
    html += '<span class="cal-leg" style="background:' + CAL_R16_BG + '">R16</span>';
    html += '<span class="cal-leg" style="background:' + CAL_QF_BG  + '">QF</span>';
    html += '<span class="cal-leg" style="background:' + CAL_SF_BG  + '">SF</span>';
    html += '<span class="cal-leg" style="background:' + CAL_FIN_BG + ';color:#0d1117">決勝</span>';
    html += '</div><div class="cal-grid">';
    for (var wi = 0; wi < 7; wi++) { html += '<div class="cal-cell cal-hdr">' + wdays[wi] + '</div>'; }
    for (var ei = 0; ei < firstDow; ei++) { html += '<div class="cal-cell"></div>'; }
    for (var di = 1; di <= 31; di++) {
      var bg = CAL_DAYS[di] || '';
      var cls = 'cal-cell' + (bg ? ' cal-match' : '') + (di === todayDay ? ' cal-today' : '');
      var style = bg ? 'background:' + bg : '';
      var lbl = (CAL_LABELS[di] ? '<div class="cal-rlabel">' + CAL_LABELS[di] + '</div>' : '') +
                (CAL_ICONS_JUL[di] ? '<div class="cal-rlabel">' + CAL_ICONS_JUL[di] + '</div>' : '');
      html += '<div class="' + cls + '" style="' + style + '">' + di + lbl + '</div>';
    }
    html += '</div></div>';
    sec.innerHTML = html;
  }

  function buildDrawerCalendar() {
    var sec = document.getElementById('drw-cal');
    if (!sec) return;
    var juneDays = {};
    MATCHES.forEach(function(m) {
      if (m.date.startsWith('2026-06-')) juneDays[parseInt(m.date.slice(8), 10)] = true;
    });
    var firstDow = new Date(2026, 5, 1).getDay();
    var todayStr = new Date().toISOString().slice(0, 10);
    var todayDay = todayStr.startsWith('2026-06-') ? parseInt(todayStr.slice(8), 10) : 0;
    var GS_BG = 'rgba(88,166,255,0.18)';
    var wdays = ['日','月','火','水','木','金','土'];
    var html = '<div class="cal-wrap drw-cal-wrap">';
    html += '<div class="cal-title">🏃6️⃣月 グループステージ (72)</div>';
    html += '<div class="cal-legend"><span class="cal-leg" style="background:' + GS_BG + '">グループステージ</span></div>';
    html += '<div class="cal-grid">';
    for (var wi = 0; wi < 7; wi++) { html += '<div class="cal-cell cal-hdr">' + wdays[wi] + '</div>'; }
    for (var ei = 0; ei < firstDow; ei++) { html += '<div class="cal-cell"></div>'; }
    for (var di = 1; di <= 30; di++) {
      var isMatch = juneDays[di] || false;
      var isToday = di === todayDay;
      var cls = 'cal-cell' + (isMatch ? ' cal-match' : '') + (isToday ? ' cal-today' : '');
      var style = isMatch ? 'background:' + GS_BG : '';
      var lbl = isToday ? '<div class="cal-rlabel">🏁</div>' : '';
      var dStr = '2026-06-' + (di < 10 ? '0' + di : '' + di);
      var dateAttr = isMatch ? ' data-date="' + dStr + '"' : '';
      html += '<div class="' + cls + '"' + dateAttr + ' style="' + style + '">' + di + lbl + '</div>';
    }
    html += '</div></div>';
    sec.innerHTML = html;
    sec.addEventListener('click', function(e) {
      var cell = e.target.closest('.cal-match');
      if (!cell || !cell.dataset.date) return;
      var ds = cell.dataset.date;
      sec.querySelectorAll('.cal-selected').forEach(function(el) { el.classList.remove('cal-selected'); });
      cell.classList.add('cal-selected');
      if (!drwBuilt) { buildDrawer(); drwBuilt = true; }
      openDateSection(ds);
      updateActiveDateFlags(ds);
    });
  }

  function buildGroupsPanel() {
    var grpBody = document.getElementById('grp-body');
    if (!grpBody) return;
    var todayStr = new Date().toISOString().slice(0, 10);
    var todayFlags = {};
    MATCHES.forEach(function(m) {
      if (m.date === todayStr) { todayFlags[m.a] = true; todayFlags[m.b] = true; }
    });
    var html = '';
    GROUPS.forEach(function(grp) {
      html += '<div class="grp-row"><span class="grp-label">' + grp.g + '</span><span class="grp-flags">';
      grp.f.forEach(function(flag) {
        var cls = 'grp-flag' + (todayFlags[flag] ? ' grp-flag-today' : '');
        var enc = flag.replace(/&/g, '&amp;');
        html += '<span class="' + cls + '" data-flag="' + enc + '">' + flag + '</span>';
      });
      html += '</span></div>';
    });
    grpBody.innerHTML = html;
    grpBody.addEventListener('click', function(e) {
      var span = e.target.closest('.grp-flag');
      if (!span) return;
      var flag = span.dataset.flag;
      if (!flag) return;
      grpBody.querySelectorAll('.grp-flag').forEach(function(s) { s.classList.remove('grp-flag-active'); });
      span.classList.add('grp-flag-active');
      var now2 = Date.now();
      var nextMatch = null;
      var nextKo = Infinity;
      var fallback = null;
      for (var mi2 = 0; mi2 < MATCHES.length; mi2++) {
        var mm = MATCHES[mi2];
        if (mm.a !== flag && mm.b !== flag) continue;
        var ko2 = new Date(mm.date + "T" + mm.time + ":00Z").getTime();
        if (ko2 > now2 - 110*60000) {
          if (ko2 < nextKo) { nextMatch = mm; nextKo = ko2; }
        } else {
          fallback = mm;
        }
      }
      var match = nextMatch || fallback;
      openDrawer();
      blinkCalToday();
      highlightDrawerFlag(flag);
      if (match) {
        updateActiveDateFlags(match.date);
        showMatchDetail(match.a, match.b, match.date, match.time, true, true);
      }
    });
  }

  function blinkCalToday() {
    var cell = document.querySelector('#drw-cal .cal-today');
    if (!cell) return;
    cell.classList.remove('cal-today-blink');
    void cell.offsetWidth;
    cell.classList.add('cal-today-blink');
    cell.addEventListener('animationend', function() { cell.classList.remove('cal-today-blink'); }, {once: true});
  }

  function highlightDrawerFlag(flag) {
    var rows = drwBody.querySelectorAll('.drw-row');
    var target = null;
    for (var i = 0; i < rows.length; i++) {
      rows[i].classList.remove('drw-highlight');
      var a = rows[i].dataset.a, b = rows[i].dataset.b;
      if ((a === flag || b === flag) && !rows[i].classList.contains('drw-past')) {
        if (!target) target = rows[i];
      }
    }
    if (target) {
      var sec = target.closest('.drw-section');
      if (sec) {
        drwBody.querySelectorAll('.drw-section').forEach(function(s) { s.classList.remove('open'); });
        sec.classList.add('open');
      }
      target.classList.add('drw-highlight');
      setTimeout(function() { target.scrollIntoView({behavior:'smooth', block:'center'}); }, 80);
    }
  }

  var TNMT_ROUNDS = [
    { label: 'ラウンド32', key: 'r32', matches: [
      {id:'r32-1', date:'7/1', a:null, b:null, slotA:'1A', slotB:'2C'},
      {id:'r32-2', date:'7/1', a:null, b:null, slotA:'1B', slotB:'2D'},
      {id:'r32-3', date:'7/2', a:null, b:null, slotA:'1C', slotB:'2A'},
      {id:'r32-4', date:'7/2', a:null, b:null, slotA:'1D', slotB:'2B'},
      {id:'r32-5', date:'7/3', a:null, b:null, slotA:'1E', slotB:'2G'},
      {id:'r32-6', date:'7/3', a:null, b:null, slotA:'1F', slotB:'2H'},
      {id:'r32-7', date:'7/4', a:null, b:null, slotA:'1G', slotB:'2E'},
      {id:'r32-8', date:'7/4', a:null, b:null, slotA:'1H', slotB:'2F'},
      {id:'r32-9', date:'7/5', a:null, b:null, slotA:'1I', slotB:'2K'},
      {id:'r32-10', date:'7/5', a:null, b:null, slotA:'1J', slotB:'2L'},
      {id:'r32-11', date:'7/6', a:null, b:null, slotA:'1K', slotB:'2I'},
      {id:'r32-12', date:'7/6', a:null, b:null, slotA:'1L', slotB:'2J'},
      {id:'r32-13', date:'7/1', a:null, b:null, slotA:'3位(ABCD)', slotB:'3位(EFGH)'},
      {id:'r32-14', date:'7/2', a:null, b:null, slotA:'3位(IJKL)', slotB:'3位(ABEF)'},
      {id:'r32-15', date:'7/3', a:null, b:null, slotA:'3位(CDIJ)', slotB:'3位(GHKL)'},
      {id:'r32-16', date:'7/4', a:null, b:null, slotA:'3位(ABCD)', slotB:'3位(IJKL)'}
    ]},
    { label: 'ベスト16', key: 'r16', matches: [
      {id:'r16-1', date:'7/8', a:null, b:null, slotA:'R32-M1勝者', slotB:'R32-M2勝者'},
      {id:'r16-2', date:'7/8', a:null, b:null, slotA:'R32-M3勝者', slotB:'R32-M4勝者'},
      {id:'r16-3', date:'7/9', a:null, b:null, slotA:'R32-M5勝者', slotB:'R32-M6勝者'},
      {id:'r16-4', date:'7/9', a:null, b:null, slotA:'R32-M7勝者', slotB:'R32-M8勝者'},
      {id:'r16-5', date:'7/10', a:null, b:null, slotA:'R32-M9勝者', slotB:'R32-M10勝者'},
      {id:'r16-6', date:'7/10', a:null, b:null, slotA:'R32-M11勝者', slotB:'R32-M12勝者'},
      {id:'r16-7', date:'7/11', a:null, b:null, slotA:'R32-M13勝者', slotB:'R32-M14勝者'},
      {id:'r16-8', date:'7/12', a:null, b:null, slotA:'R32-M15勝者', slotB:'R32-M16勝者'}
    ]},
    { label: '準々決勝', key: 'qf', matches: [
      {id:'qf-1', date:'7/14', a:null, b:null, slotA:'R16-M1勝者', slotB:'R16-M2勝者'},
      {id:'qf-2', date:'7/14', a:null, b:null, slotA:'R16-M3勝者', slotB:'R16-M4勝者'},
      {id:'qf-3', date:'7/15', a:null, b:null, slotA:'R16-M5勝者', slotB:'R16-M6勝者'},
      {id:'qf-4', date:'7/16', a:null, b:null, slotA:'R16-M7勝者', slotB:'R16-M8勝者'}
    ]},
    { label: '準決勝', key: 'sf', matches: [
      {id:'sf-1', date:'7/19', a:null, b:null, slotA:'QF1勝者', slotB:'QF2勝者'},
      {id:'sf-2', date:'7/20', a:null, b:null, slotA:'QF3勝者', slotB:'QF4勝者'}
    ]},
    { label: '決勝', key: 'final', matches: [
      {id:'final', date:'7/26', a:null, b:null, slotA:'SF1勝者', slotB:'SF2勝者'}
    ]}
  ];

  var TNMT_3RD = {id:'3rd', date:'7/23', a:null, b:null, slotA:'SF1負', slotB:'SF2負'};

  var DOW_JA = ['日','月','火','水','木','金','土'];
  function dateWithDow(ds) {
    var p = ds.split('/');
    if (p.length !== 2) return ds;
    var d = new Date(2026, parseInt(p[0], 10) - 1, parseInt(p[1], 10));
    return ds + '(' + DOW_JA[d.getDay()] + ')';
  }

  function buildTournamentModal() {
    var body = document.getElementById('tnmt-body');
    if (!body) return;
    var groupsHtml = '<div class="tnmt-grp-list">';
    GROUPS.forEach(function(grp) {
      groupsHtml += '<div class="tnmt-grp-item"><span class="tnmt-grp-badge">' + grp.g + '</span><span class="tnmt-grp-flags">' + grp.f.join('') + '</span></div>';
    });
    groupsHtml += '</div>';
    function teamSlot(flag, slot) {
      if (flag) {
        var code = flagCode(flag);
        return '<div class="tnmt-team"><span class="tnmt-team-flag">' + flag + '</span><span class="tnmt-team-code">' + code + '</span></div>';
      }
      return '<div class="tnmt-team"><span class="tnmt-team-tbd">' + slot + '</span></div>';
    }
    function matchCard(m) {
      return '<div class="tnmt-match"><div class="tnmt-match-date">' + dateWithDow(m.date) + '</div>' +
        teamSlot(m.a, m.slotA) + teamSlot(m.b, m.slotB) + '</div>';
    }
    var bracketHtml = '<div class="tnmt-bracket">';
    TNMT_ROUNDS.forEach(function(rnd) {
      var isFinal = rnd.key === 'final';
      bracketHtml += '<div class="tnmt-col' + (isFinal ? ' tnmt-col-final' : '') + '">';
      bracketHtml += '<div class="tnmt-col-hdr">' + rnd.label + '</div>';
      rnd.matches.forEach(function(m) { bracketHtml += matchCard(m); });
      bracketHtml += '</div>';
    });
    bracketHtml += '</div>';
    bracketHtml += '<div class="tnmt-3rd"><div class="tnmt-3rd-label">3位決定戦 (' + dateWithDow('7/23') + ')</div>' +
      matchCard(TNMT_3RD) + '</div>';
    body.innerHTML = groupsHtml + bracketHtml;
  }

  var tnmtOverlay = document.getElementById('tnmt-overlay');
  var tnmtBtn = document.getElementById('tnmt-btn');
  var tnmtClose = document.getElementById('tnmtClose');
  var tnmtBuilt = false;

  function openTournament() {
    if (!tnmtBuilt) { buildTournamentModal(); tnmtBuilt = true; }
    tnmtOverlay.style.zIndex = String(getNextZ());
    tnmtOverlay.classList.add('open');
  }
  function closeTournament() { tnmtOverlay.classList.remove('open'); }
  tnmtBtn.addEventListener('click', openTournament);
  tnmtClose.addEventListener('click', closeTournament);
  tnmtOverlay.addEventListener('click', function(e) {
    if (e.target === tnmtOverlay) closeTournament();
  });

  var teamMatches = {};
  var ELIMINATED = {};
  MATCHES.forEach(function(m) {
    if (!teamMatches[m.a]) teamMatches[m.a] = [];
    if (!teamMatches[m.b]) teamMatches[m.b] = [];
    teamMatches[m.a].push({opp:m.b, date:m.date, time:m.time});
    teamMatches[m.b].push({opp:m.a, date:m.date, time:m.time});
  });

  function getNextMatch(flag) {
    var ms = teamMatches[flag];
    if (!ms) return null;
    var now = Date.now();
    for (var i = 0; i < ms.length; i++) {
      var ko = new Date(ms[i].date + "T" + ms[i].time + ":00Z").getTime();
      if (ko > now - 110*60000) return {m: ms[i], past: ko < now, ko: ko};
    }
    return {m: ms[ms.length-1], past: true, ko: 0};
  }

  var flyTarget = null, flyFrom = null, flyStart = 0;
  var FLY_DUR = 2500;

  function toJST(utcTime) {
    var h = parseInt(utcTime.slice(0, 2)) + 9;
    var m = utcTime.slice(3, 5);
    var next = h >= 24;
    h = h % 24;
    return (next ? "翌" : "") + (h < 10 ? "0" : "") + h + ":" + m + " JST(UTC+9)";
  }

  function toET(utcTime) {
    var h = parseInt(utcTime.slice(0, 2)) - 4;
    var m = utcTime.slice(3, 5);
    var prev = h < 0;
    if (prev) h += 24;
    return (h < 10 ? "0" : "") + h + ":" + m + " ET(UTC-4)" + (prev ? " 前日" : "");
  }

  function findCountryByFlag(flag) {
    for (var i = 0; i < wc2026.length; i++) {
      if (wc2026[i].flag === flag) return i;
    }
    return -1;
  }

  function flyTo(lat, lon) {
    var ty = -(Math.PI/2 + lon * Math.PI/180);
    var tx = Math.atan(Math.cos(axialTilt) * Math.tan(lat * Math.PI/180));
    var dy = ty - rotYv;
    while (dy > Math.PI) dy -= 2*Math.PI;
    while (dy < -Math.PI) dy += 2*Math.PI;
    momentumY = 0; momentumX = 0;
    flyFrom = {ry: rotYv, rx: rotXv};
    flyTarget = {ry: rotYv + dy, rx: tx};
    flyStart = performance.now();
    autoRot = false;
    btnAutoRot.textContent = "▶ 回転";
    btnAutoRot.classList.add("active");
    if (axisLocked) {
      axisLocked = false;
      btnAxisLock.classList.remove("active");
      btnAxisLock.textContent = "＋ 軸垂直固定";
    }
  }

  var tooltip = document.getElementById("mk-tooltip");
  var schedulePanel = document.getElementById("schedule-panel");
  var spBody = schedulePanel.querySelector("#sp-body");
  var activeMarkerIdx = -1;
  var canvasRect = {left:0, top:0, width:0, height:0};

  function updateCanvasRect() { canvasRect = canvas.getBoundingClientRect(); }
  window.addEventListener("resize", updateCanvasRect);
  updateCanvasRect();

  function hideTooltip() { tooltip.style.opacity = "0"; activeMarkerIdx = -1; }

  function positionTooltip(vx, vy) {
    var isNearTop = vy < canvasRect.top + 80;
    tooltip.style.left = vx + "px";
    tooltip.style.top  = vy + "px";
    if (isNearTop) { tooltip.classList.add("below"); } else { tooltip.classList.remove("below"); }
  }

  function buildMatchHtml(flag, name) {
    var nm = '<div class="tt-name">' + name + '</div>';
    var info = getNextMatch(flag);
    if (!info) return nm;
    var m = info.m;
    var md = m.date.slice(5).replace("-", "/");
    if (info.past) {
      return nm + '<div class="tt-match tt-past"><span class="tt-flags">' + flag + ' - ' + m.opp + '</span>  ' + md + ' ' + m.time + ' UTC 終了</div>';
    }
    return nm + '<div class="tt-match"><span class="tt-flags">' + flag + ' - ' + m.opp + '</span>  ' + md + '<br><span class="tt-time">' + m.time + ' UTC / ' + toET(m.time) + ' / ' + toJST(m.time) + '</span></div>';
  }

  function showTooltip(idx, vx, vy) {
    var d = wc2026[idx];
    if (d.ball) { showSchedulePanel(); return; }
    tooltip.innerHTML = buildMatchHtml(d.flag, d.name);
    positionTooltip(vx, vy);
    tooltip.style.opacity = "1";
    activeMarkerIdx = idx;
    flyTo(d.lat, d.lon);
  }

  var leftDrawer = document.getElementById("left-drawer");
  var drwOverlay = document.getElementById("drawer-overlay");
  var drwBody    = document.getElementById("drw-body");
  var matchInfo  = document.getElementById("match-info");
  var miFlags    = document.getElementById("mi-flags");
  var miTime     = document.getElementById("mi-time");
  var miDate     = document.getElementById("mi-date");
  var drwBuilt = false;

  function openDrawer() {
    if (!drwBuilt) { buildDrawer(); drwBuilt = true; }
    leftDrawer.classList.add("open");
    drwOverlay.classList.add("open");
    hideTooltip();
    schedulePanel.classList.remove("open");
  }
  function closeDrawer() {
    leftDrawer.classList.remove("open");
    drwOverlay.classList.remove("open");
  }
  function showMatchDetail(a, b, date, time, doFly, keepDrawer) {
    miFlags.innerHTML = fc(a) + ' ' + a + '<span class="mi-vs">vs</span>' + b + ' ' + fc(b);
    miTime.textContent  = time + " UTC / " + toET(time) + " / " + toJST(time);
    miDate.textContent  = date.slice(5).replace("-", "/");
    matchInfo.classList.add("open");
    if (!keepDrawer) closeDrawer();
    schedulePanel.classList.remove("open");
    if (doFly) {
      var tidx = findCountryByFlag(a);
      if (tidx >= 0) {
        var td = wc2026[tidx];
        tooltip.innerHTML = buildMatchHtml(td.flag, td.name);
        activeMarkerIdx = tidx;
        flyTo(td.lat, td.lon);
      }
    }
  }
  function closeMatchDetail() { matchInfo.classList.remove("open"); }
  var miCloseBtn = document.getElementById("miClose");
  miCloseBtn.addEventListener("click", function(e) { e.stopPropagation(); closeMatchDetail(); });
  var spCloseBtn = document.getElementById("spClose");
  spCloseBtn.addEventListener("click", function() { schedulePanel.classList.remove("open"); });

  function showSchedulePanel() {
    var todayStr = new Date().toISOString().slice(0, 10);
    var allMatches = MATCHES.filter(function(m) { return m.date >= todayStr; });
    allMatches.sort(function(a, b) { return (a.date + a.time) < (b.date + b.time) ? -1 : 1; });
    var html = "";
    var lastDate = "";
    var nowMs = Date.now();
    allMatches.forEach(function(m) {
      if (m.date !== lastDate) {
        var label = m.date === todayStr ? "本日 " + m.date.slice(5).replace("-","/") : m.date.slice(5).replace("-","/");
        html += '<div class="sp-date">' + label + '</div>';
        lastDate = m.date;
      }
      var koMs = new Date(m.date + "T" + m.time + ":00Z").getTime();
      var isPast = koMs < nowMs - 110*60000;
      var isTod  = m.date === todayStr;
      var cls = "sp-match" + (isPast ? " sp-past" : "") + (isTod && !isPast ? " sp-today" : "");
      html += '<div class="' + cls + '" data-a="' + m.a + '" data-b="' + m.b + '" data-date="' + m.date + '" data-time="' + m.time + '" style="cursor:pointer"><span class="sp-flags">' + fc(m.a) + ' ' + m.a + ' <span style="color:#484f58">-</span> ' + m.b + ' ' + fc(m.b) + '</span><span class="sp-time">' + m.time + ' UTC<br>' + toET(m.time) + '<br>' + toJST(m.time) + '</span></div>';
    });
    spBody.innerHTML = html || '<div style="padding:16px;color:#8b949e">本日以降の試合はありません</div>';
    function spRowTap(row) {
      if (!row) return;
      var a = row.dataset.a, b = row.dataset.b;
      schedulePanel.classList.remove("open");
      showMatchDetail(a, b, row.dataset.date, row.dataset.time, true);
    }
    spBody.onclick = function(e) { spRowTap(e.target.closest(".sp-match")); };
    spBody.ontouchend = function(e) {
      var row = e.target.closest(".sp-match");
      if (row) { e.preventDefault(); spRowTap(row); }
    };
    schedulePanel.classList.add("open");
    hideTooltip();
  }

  function openDateSection(dateStr) {
    if (!drwBody) return;
    drwBody.querySelectorAll('.drw-section').forEach(function(s) { s.classList.remove('open'); });
    var target = drwBody.querySelector('.drw-section[data-date="' + dateStr + '"]');
    if (target) {
      target.classList.add('open');
      setTimeout(function() { target.scrollIntoView({behavior:'smooth', block:'start'}); }, 80);
    }
  }

  function updateActiveDateFlags(dateStr) {
    var grpBody = document.getElementById('grp-body');
    if (!grpBody) return;
    var dateFlags = {};
    MATCHES.forEach(function(m) {
      if (m.date === dateStr) { dateFlags[m.a] = true; dateFlags[m.b] = true; }
    });
    grpBody.querySelectorAll('.grp-flag').forEach(function(span) {
      var flag = span.dataset.flag;
      span.classList.remove('grp-flag-today', 'grp-flag-active');
      if (dateFlags[flag]) span.classList.add('grp-flag-today');
    });
  }

  function buildDrawer() {
    if (!drwBody) return;
    var nowMs = Date.now();
    var todayStr = new Date().toISOString().slice(0, 10);
    var upcoming = MATCHES.filter(function(m) { return m.date >= todayStr; }).sort(function(x, y) { return (x.date + x.time) < (y.date + y.time) ? -1 : 1; });
    var past = MATCHES.filter(function(m) { return m.date < todayStr; }).sort(function(x, y) { return (x.date + x.time) < (y.date + y.time) ? -1 : 1; });
    var allM = upcoming.concat(past);
    var dateMap = {};
    var dateOrder = [];
    allM.forEach(function(m) {
      if (!dateMap[m.date]) { dateMap[m.date] = []; dateOrder.push(m.date); }
      dateMap[m.date].push(m);
    });
    var html = "";
    dateOrder.forEach(function(date) {
      var label = date === todayStr ? "TODAY  " + date.slice(5).replace("-","/") : date.slice(5).replace("-","/");
      html += '<div class="drw-section" data-date="' + date + '">';
      html += '<div class="drw-date"><span>' + label + '</span><span class="drw-chevron">&#9660;</span></div>';
      html += '<div class="drw-section-body">';
      dateMap[date].forEach(function(m) {
        var koMs = new Date(m.date + "T" + m.time + ":00Z").getTime();
        var isPast = koMs < nowMs - 110*60000;
        var isLive = !isPast && koMs <= nowMs + 110*60000 && koMs >= nowMs - 110*60000;
        var cls = "drw-row" + (isPast ? " drw-past" : "") + (isLive ? " drw-live" : "");
        var enc_a = m.a.replace(/&/g,"&amp;");
        var enc_b = m.b.replace(/&/g,"&amp;");
        html += '<div class="' + cls + '" data-a="' + enc_a + '" data-b="' + enc_b + '" data-date="' + m.date + '" data-time="' + m.time + '"><span class="drw-flags">' + fc(m.a) + ' ' + m.a + '  ' + m.b + ' ' + fc(m.b) + '</span><span class="drw-meta">' + m.date.slice(5).replace("-","/") + '<br>' + m.time + ' UTC<br>' + toET(m.time) + '<br>' + toJST(m.time) + '</span></div>';
      });
      html += '</div></div>';
    });
    drwBody.innerHTML = html;
    var todaySection = drwBody.querySelector('.drw-section[data-date="' + todayStr + '"]');
    if (todaySection) todaySection.classList.add('open');
    drwBody.addEventListener("click", function(e) {
      var hdr = e.target.closest(".drw-date");
      if (hdr) {
        var sec = hdr.closest(".drw-section");
        if (sec) {
          var wasOpen = sec.classList.contains('open');
          drwBody.querySelectorAll('.drw-section').forEach(function(s) { s.classList.remove('open'); });
          if (!wasOpen) sec.classList.add('open');
        }
        return;
      }
      var row = e.target.closest(".drw-row");
      if (!row) return;
      showMatchDetail(row.dataset.a, row.dataset.b, row.dataset.date, row.dataset.time, true);
    });
    drwBody.addEventListener("touchend", function(e) {
      var hdr = e.target.closest(".drw-date");
      if (hdr) { return; }
      var row = e.target.closest(".drw-row");
      if (!row) return;
      e.preventDefault();
      showMatchDetail(row.dataset.a, row.dataset.b, row.dataset.date, row.dataset.time, true);
    });
  }

  var drawerOpenBtn = document.getElementById("drawer-open-btn");
  drawerOpenBtn.addEventListener("click", openDrawer);
  var drwCloseBtn = document.getElementById("drwClose");
  drwCloseBtn.addEventListener("click", closeDrawer);
  drwOverlay.addEventListener("click", closeDrawer);

  var mkEls = [];
  for (var mi = 0; mi < wc2026.length; mi++) {
    var mdata = wc2026[mi];
    var mel = document.createElement("div");
    mel.className = "mk" + (mdata.ball ? " mk-ball" : "") + (ELIMINATED[mdata.flag] ? " elim" : "");
    mel.textContent = mdata.flag;
    mel.style.opacity = "0";
    mel.dataset.name = mdata.name;
    (function(idx) {
      mel.addEventListener("click", function(e) {
        e.stopPropagation();
        var r = mel.getBoundingClientRect();
        showTooltip(idx, r.left + r.width/2, r.top + r.height/2);
      });
      mel.addEventListener("touchend", function(e) {
        e.preventDefault();
        e.stopPropagation();
        var r = mel.getBoundingClientRect();
        showTooltip(idx, r.left + r.width/2, r.top + r.height/2);
      });
    })(mi);
    markersDiv.appendChild(mel);
    mkEls.push({el: mel, pos3d: latLonTo3D(mdata.lat, mdata.lon)});
  }

  canvas.addEventListener("click", function() {
    hideTooltip();
    schedulePanel.classList.remove("open");
    var ball = wc2026[0];
    activeMarkerIdx = 0;
    flyTo(ball.lat, ball.lon);
  });

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

    var t = (now - startTime) * 0.001;
    var spd = parseFloat(rotSpdEl.value);
    if (flyTarget !== null) {
      var fp = Math.min((now - flyStart) / FLY_DUR, 1);
      var fe = fp * fp * (3 - 2 * fp);
      rotYv = flyFrom.ry + (flyTarget.ry - flyFrom.ry) * fe;
      rotXv = flyFrom.rx + (flyTarget.rx - flyFrom.rx) * fe;
      if (fp >= 1) flyTarget = null;
    } else {
      if (autoRot) rotYv += 0.003 * spd;
      var wasSpinning = Math.abs(momentumY) > 0.0002 || Math.abs(momentumX) > 0.0002;
      if (Math.abs(momentumY) > 0.0002) { rotYv += momentumY; momentumY *= MOMENTUM_DECAY; } else { momentumY = 0; }
      if (!axisLocked && Math.abs(momentumX) > 0.0002) { rotXv = clampElev(rotXv + momentumX); momentumX *= MOMENTUM_DECAY; } else { momentumX = 0; }
      if (axisLocked) rotXv = 0;
      var nowSpinning = Math.abs(momentumY) > 0.0002 || Math.abs(momentumX) > 0.0002;
      if (wasSpinning && !nowSpinning && !autoRot) {
        var bestIdx = -1, bestMz = -1;
        for (var si = 0; si < wc2026.length; si++) {
          if (wc2026[si].ball) continue;
          var sp = mkEls[si] ? mkEls[si].pos3d : null;
          if (!sp) continue;
          var smz = model[2]*sp[0] + model[6]*sp[1] + model[10]*sp[2];
          if (smz > bestMz) { bestMz = smz; bestIdx = si; }
        }
        if (bestIdx >= 0) {
          var bd = wc2026[bestIdx];
          tooltip.innerHTML = buildMatchHtml(bd.flag, bd.name);
          activeMarkerIdx = bestIdx;
          flyTo(bd.lat, bd.lon);
        }
      }
    }

    persp(proj, Math.PI / 4, W / H, 0.1, 100);
    trans(view, 0, 0, -zoom);
    rotY(ry, rotYv); rotZ(tz, axialTilt); rotX(rx, rotXv);
    mul(tmp2, tz, ry);
    mul(model, rx, tmp2);
    mul(tmp, view, model);
    mul(mvp, proj, tmp);

    var sd = getSunDir();
    gl.uniform3f(uLight, sd[0], sd[1], sd[2]);
    gl.uniformMatrix4fv(uMVP,   false, mvp);
    gl.uniformMatrix4fv(uModel, false, model);

    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texEarth);
    gl.drawElements(gl.TRIANGLES, idxs.length, gl.UNSIGNED_SHORT, 0);

    for (var mi = 0; mi < mkEls.length; mi++) {
      var mk = mkEls[mi];
      mk.el.style.display = "";
      var mp = mk.pos3d;
      var mz = model[2]*mp[0] + model[6]*mp[1] + model[10]*mp[2];
      if (mz > 0.12) {
        var mcx = mvp[0]*mp[0] + mvp[4]*mp[1] + mvp[8]*mp[2]  + mvp[12];
        var mcy = mvp[1]*mp[0] + mvp[5]*mp[1] + mvp[9]*mp[2]  + mvp[13];
        var mcw = mvp[3]*mp[0] + mvp[7]*mp[1] + mvp[11]*mp[2] + mvp[15];
        if (mcw > 0) {
          var px = (mcx/mcw+1)*0.5*W;
          var py = (1-mcy/mcw)*0.5*H;
          mk.el.style.left = px + "px";
          mk.el.style.top  = py + "px";
          mk.el.style.opacity = "1";
          if (mi === activeMarkerIdx) {
            positionTooltip(canvasRect.left + px, canvasRect.top + py);
            tooltip.style.opacity = "1";
          }
        } else {
          mk.el.style.opacity = "0";
          if (mi === activeMarkerIdx) hideTooltip();
        }
      } else {
        mk.el.style.opacity = "0";
        if (mi === activeMarkerIdx) hideTooltip();
      }
    }
    frames++;
    var dt = now - lastFps;
    if (dt >= 600) {
      var fps = Math.round(frames * 1000 / dt);
      var clock = new Date();
      var utcH = clock.getUTCHours() + clock.getUTCMinutes() / 60;
      var sunLonDeg = Math.round((12 - utcH) * 15);
      var ew = sunLonDeg >= 0 ? "E" : "W";
      var label = earthImg.complete && earthImg.naturalWidth > 0 ? "" : "テクスチャ読込中 | ";
      hud.textContent = label + "FPS: " + fps + "  |  太陽: " + Math.abs(sunLonDeg) + "°" + ew + "  |  " + (autoRot ? "自動回転 ON" : "自動回転 OFF");
      frames = 0; lastFps = now;
    }
  }
  buildCalendar();
  buildDrawerCalendar();
  buildGroupsPanel();
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
