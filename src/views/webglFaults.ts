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
.side { background:#0d1117; border-left:1px solid #30363d; display:flex; flex-direction:column; overflow:hidden; z-index:110; }
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
.fault-mk { position:absolute; transform:translate(-50%,-50%); width:8px; height:8px; border-radius:50%; pointer-events:auto; cursor:pointer; border:1.5px solid rgba(255,255,255,0.5); box-shadow:0 0 4px rgba(0,0,0,0.8); transition:transform .1s; }
.fault-mk:hover { transform:translate(-50%,-50%) scale(1.6); }
@keyframes fault-flash { 0%,100%{outline:2px solid transparent} 50%{outline:2px solid #ffd700} }
.fault-item.flash { animation:fault-flash 0.4s ease 3; }
.fault-body { flex:1; min-width:0; }
.fault-name { font-size:11px; font-weight:600; color:#e6edf3; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.fault-meta { font-size:10px; color:#484f58; display:flex; align-items:center; gap:5px; }
.type-badge { font-size:9px; padding:1px 5px; border-radius:8px; font-weight:600; flex-shrink:0; }
.type-badge.subduction { background:#3d0d0d; color:#f85149; }
.type-badge.transform  { background:#2d1a0c; color:#f78166; }
.type-badge.divergent  { background:#0c1f2d; color:#58d5ff; }
.type-badge.rift       { background:#2d2500; color:#e3b341; }
.type-badge.thrust     { background:#1f0c2d; color:#d2a8ff; }
.canvas-ctrl-btns { position:absolute; top:10px; right:10px; display:flex; flex-direction:row; gap:6px; z-index:110; flex-wrap:wrap; justify-content:flex-end; max-width:60%; }
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
#vol-tooltip { position:fixed; background:rgba(13,17,23,0.97); border:1px solid #ff9500; border-radius:8px; padding:0; font-size:12px; color:#e6edf3; min-width:200px; max-width:280px; pointer-events:none; opacity:0; transition:opacity .15s; z-index:65; transform:translate(-50%,-110%); line-height:1.7; }
#vol-tooltip.pinned { pointer-events:auto; transform:none; transition:opacity .15s; cursor:grab; user-select:none; }
#vol-tooltip.pinned:active { cursor:grabbing; }
#fault-tooltip { position:fixed; background:rgba(13,17,23,0.97); border:1px solid #f78166; border-radius:8px; padding:0; font-size:12px; color:#e6edf3; min-width:200px; max-width:280px; pointer-events:none; opacity:0; transition:opacity .15s; z-index:65; transform:translate(-50%,-115%); line-height:1.7; }
#fault-tooltip.pinned { pointer-events:auto; transform:none; }
.fault-tt-hdr { display:flex; align-items:center; justify-content:space-between; cursor:move; padding:5px 10px 3px; border-bottom:1px solid #30363d; user-select:none; }
.fault-tt-name { font-weight:700; font-size:13px; color:#58a6ff; flex:1; cursor:pointer; text-decoration:none; }
.fault-tt-close { font-size:14px; color:#8b949e; cursor:pointer; line-height:1; padding:15px; margin:-6px -8px -6px 0; flex-shrink:0; display:inline-flex; align-items:center; justify-content:center; }
.fault-tt-close:hover { color:#e6edf3; }
.fault-tt-body { padding:4px 12px 8px; }
.vol-tt-hdr { display:flex; align-items:center; justify-content:space-between; padding:9px 13px 8px; border-bottom:1px solid #30363d; }
.vol-tt-body { padding:9px 13px 12px; }
.vol-tt-name { font-weight:700; font-size:13px; color:#58a6ff; cursor:pointer; text-decoration:none; }
.vol-tt-close { font-size:14px; color:#8b949e; cursor:pointer; line-height:1; padding:0 2px; flex-shrink:0; }
.vol-tt-close:hover { color:#e6edf3; }
.vol-tt-sub { font-size:11px; color:#8b949e; }
#box-select-overlay { position:absolute; border:2px dashed rgba(100,200,255,0.85); background:rgba(100,200,255,0.06); pointer-events:none; display:none; z-index:60; }
.area-tour-drawer { position:absolute; left:0; top:0; height:100%; width:260px; background:#0d1117; border-right:1px solid #30363d; z-index:110; display:flex; flex-direction:column; transform:translateX(-100%); transition:transform .25s ease; overflow:hidden; box-shadow:4px 0 20px rgba(0,0,0,0); }
.area-tour-drawer.open { transform:translateX(0); box-shadow:4px 0 20px rgba(0,0,0,.5); }
.area-tour-hdr { display:flex; align-items:center; gap:8px; padding:10px 12px 9px; border-bottom:1px solid #30363d; flex-shrink:0; background:#0d1117; }
.area-tour-title { flex:1; font-size:13px; font-weight:700; color:#ff9500; min-width:0; }
.area-tour-close { background:none; border:none; color:#8b949e; font-size:17px; cursor:pointer; padding:0 4px; line-height:1; }
.area-tour-close:hover { color:#e6edf3; }
.area-tour-body { flex:1; overflow-y:auto; overflow-x:hidden; padding:4px 0; }
.area-tour-body::-webkit-scrollbar { width:4px; }
.area-tour-body::-webkit-scrollbar-track { background:#0d1117; }
.area-tour-body::-webkit-scrollbar-thumb { background:#30363d; border-radius:2px; }
.area-tour-item { display:flex; align-items:flex-start; gap:8px; padding:8px 12px; border-bottom:1px solid #161b22; border-left:3px solid transparent; cursor:pointer; transition:background .1s,border-color .1s; }
.area-tour-item:hover { background:#161b22; }
.area-tour-item.active { background:#2d1a0c; border-left-color:#ff9500; }
.area-tour-idx { color:#ff9500; font-family:monospace; font-size:10px; min-width:22px; }
.area-tour-name { color:#e6edf3; font-size:11px; font-weight:600; line-height:1.35; }
.area-tour-meta { color:#8b949e; font-size:10px; line-height:1.45; margin-top:2px; }
@keyframes area-tour-flash { 0%,100%{outline:2px solid transparent} 50%{outline:2px solid #ffd700} }
.area-tour-item.flash { animation:area-tour-flash 0.5s ease 3; }
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
.airport-drawer { position:absolute; left:0; top:0; height:100%; width:290px; background:#0d1117; border-right:1px solid #30363d; z-index:110; display:flex; flex-direction:column; transform:translateX(-100%); transition:transform .25s ease; overflow:hidden; box-shadow:4px 0 20px rgba(0,0,0,0); }
.airport-drawer.open { transform:translateX(0); box-shadow:4px 0 20px rgba(0,0,0,.5); }
.apt-hdr { display:flex; align-items:center; padding:10px 12px 9px; border-bottom:1px solid #30363d; flex-shrink:0; background:#0d1117; }
.apt-hdr-title { flex:1; font-size:13px; font-weight:700; color:#58a6ff; }
.apt-close-btn { background:none; border:none; color:#8b949e; font-size:17px; cursor:pointer; padding:0 4px; line-height:1; }
.apt-close-btn:hover { color:#e6edf3; }
.apt-body { flex:1; overflow-y:auto; }
.apt-body::-webkit-scrollbar { width:4px; }
.apt-body::-webkit-scrollbar-track { background:#0d1117; }
.apt-body::-webkit-scrollbar-thumb { background:#30363d; border-radius:2px; }
.apt-region { border-bottom:1px solid #21262d; }
.apt-region > summary { padding:8px 12px; cursor:pointer; font-size:11px; font-weight:700; color:#8b949e; list-style:none; display:flex; align-items:center; gap:6px; user-select:none; -webkit-user-select:none; }
.apt-region > summary::-webkit-details-marker { display:none; }
.apt-region[open] > summary { color:#58a6ff; background:rgba(88,166,255,.05); }
.apt-reg-arrow { margin-left:auto; font-size:9px; transition:transform .15s; }
.apt-region[open] .apt-reg-arrow { transform:rotate(180deg); }
.apt-item { padding:7px 12px 8px; border-bottom:1px solid #161b22; }
.apt-item:last-child { border-bottom:none; }
.apt-top { display:flex; align-items:baseline; gap:7px; margin-bottom:2px; }
.apt-iata { font-family:monospace; font-size:13px; font-weight:700; color:#f78166; flex-shrink:0; }
.apt-name { font-size:11px; color:#e6edf3; font-weight:600; }
.apt-city { font-size:10px; color:#8b949e; margin-bottom:3px; }
.apt-routes { font-size:10px; color:#484f58; line-height:1.6; }
.apt-routes-lbl { color:#58a6ff; font-weight:600; margin-right:3px; }
.apt-item.clickable { cursor:pointer; transition:background .1s; }
.apt-item.clickable:hover { background:#161b22; }
.apt-mk { position:absolute; transform:translate(-50%,-50%); font-size:14px; line-height:1; pointer-events:auto; cursor:pointer; user-select:none; -webkit-user-select:none; filter:drop-shadow(0 1px 3px rgba(0,0,0,0.9)); display:none; }
#apt-tooltip { position:fixed; background:rgba(13,17,23,0.97); border:1px solid #58a6ff; border-radius:8px; padding:8px 13px; font-size:12px; color:#e6edf3; min-width:200px; max-width:290px; pointer-events:auto; opacity:0; transition:opacity .15s; z-index:115; line-height:1.8; cursor:move; user-select:none; -webkit-user-select:none; }
.apt-tt-hdr { display:flex; align-items:flex-start; gap:6px; margin-bottom:5px; }
.apt-tt-name { flex:1; font-weight:700; font-size:13px; color:#58a6ff; cursor:pointer; text-decoration:none; }
.apt-tt-name:hover { color:#79c0ff; }
.apt-tt-close { background:none; border:none; color:#8b949e; font-size:15px; cursor:pointer; padding:0; line-height:1; flex-shrink:0; }
.apt-tt-close:hover { color:#e6edf3; }
.apt-tt-routes { display:flex; flex-wrap:wrap; gap:4px; margin-top:2px; }
.apt-tt-code { background:#161b22; border:1px solid #30363d; border-radius:4px; padding:2px 7px; font-size:11px; font-family:monospace; cursor:pointer; transition:background .1s,border-color .1s; white-space:nowrap; -webkit-tap-highlight-color:transparent; }
.apt-tt-code:hover { background:#21262d; border-color:#58a6ff; color:#58a6ff; }
.apt-tt-code:focus { outline:none; }
.apt-item-row { display:flex; align-items:center; gap:6px; }
.apt-item-main { flex:1; min-width:0; }
.apt-status-btn { background:none; border:1px solid #444; color:#8b949e; border-radius:50%; width:20px; height:20px; font-size:12px; cursor:pointer; flex-shrink:0; display:flex; align-items:center; justify-content:center; padding:0; transition:border-color .15s,color .15s; }
.apt-status-btn:hover { border-color:#ffd700; color:#ffd700; }
@keyframes aptFlash { 0%,100%{box-shadow:none;outline:2px solid transparent} 50%{box-shadow:0 0 0 2px #ffd700;outline:2px solid #ffd700} }
@keyframes aptTtFlash { 0%,100%{outline:2px solid transparent;color:inherit} 50%{outline:2px solid #ffd700;color:#ffd700} }
.apt-tt-flash { animation:aptTtFlash 0.5s ease 3; border-radius:3px; }
.apt-item.apt-flash { animation:aptFlash 0.5s ease 3; }
.fs-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.65); display:flex; align-items:center; justify-content:center; }
.fs-modal { background:#161b22; border:1px solid #30363d; border-radius:10px; padding:16px; width:min(92vw,430px); max-height:72vh; overflow-y:auto; color:#e6edf3; box-shadow:0 8px 32px rgba(0,0,0,0.7); }
.fs-modal-hdr { display:flex; align-items:center; gap:8px; margin-bottom:12px; }
.fs-modal-title { flex:1; font-size:13px; font-weight:700; color:#58a6ff; }
.fs-modal-close { background:none; border:none; color:#8b949e; font-size:18px; cursor:pointer; padding:0; line-height:1; }
.fs-modal-close:hover { color:#e6edf3; }
.fs-section-lbl { font-size:10px; color:#484f58; text-transform:uppercase; letter-spacing:.06em; margin-bottom:6px; }
.fs-flight-row { display:flex; align-items:center; gap:6px; padding:5px 0; border-bottom:1px solid #21262d; font-size:12px; }
.fs-flight-row:last-child { border-bottom:none; }
.fs-callsign { font-family:monospace; color:#f0883e; min-width:82px; font-size:12px; }
.fs-arrow { color:#444; font-size:11px; }
.fs-dest { color:#79c0ff; font-size:12px; }
.fs-time { color:#8b949e; margin-left:auto; font-size:11px; white-space:nowrap; }
.fs-empty { text-align:center; color:#8b949e; padding:24px 0; font-size:12px; }
.fs-note { font-size:10px; color:#484f58; margin-top:10px; padding-top:8px; border-top:1px solid #21262d; line-height:1.6; }
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
<div id="apt-tooltip"></div>
<div class="topbar">
  <h1><span class="globe-icon-wrap" id="globeIconWrap">🌐</span> 世界の活断層 地球儀</h1>
  <span class="badge">活断層</span>
  <span style="flex:1"></span>
</div>

<div class="body">
  <div class="canvas-wrap">
    <canvas id="c"></canvas>
    <div id="markers"></div>
    <div id="box-select-overlay"></div>
    <div class="hud" id="hud">テクスチャ読み込み中...</div>
    <div class="canvas-ctrl-btns">
      <button class="canvas-ctrl-btn" id="btnAxisLock">＋ 軸垂直固定</button>
      <button class="canvas-ctrl-btn" id="btnAutoRot">⏸ 自転停止</button>
      <button class="canvas-ctrl-btn" id="btnRingFire">🔥 環太平洋帯</button>
      <button class="canvas-ctrl-btn" id="btnAlpHim">⛰️ アルプス・ヒマラヤ帯</button>
      <button class="canvas-ctrl-btn" id="btnRiftTour">🌋 地溝帯</button>
      <button class="canvas-ctrl-btn" id="btnCaribbeanTour">🌊 カリブ海周辺</button>
      <button class="canvas-ctrl-btn active" id="btnVolToggle">🌋 火山 表示中</button>
      <button class="canvas-ctrl-btn" id="btnFaultDots">🔴 断層中心点</button>
      <button class="canvas-ctrl-btn" id="btnBoxZoom">🔲 エリアズーム</button>
      <button class="canvas-ctrl-btn" id="btnAirport">🛬 空路 🛫</button>
    </div>
    <div class="area-tour-drawer" id="areaTourDrawer">
      <div class="area-tour-hdr">
        <span class="area-tour-title" id="areaTourTitle">🌋 エリア内 活火山</span>
        <button class="area-tour-close" id="areaTourClose">✕</button>
      </div>
      <div class="area-tour-body" id="areaTourBody"></div>
    </div>
    <div class="airport-drawer" id="airportDrawer">
      <div class="apt-hdr">
        <span class="apt-hdr-title">🛬 主要国際空港</span>
        <button class="apt-close-btn" id="airportClose">✕</button>
      </div>
      <div class="apt-body" id="aptBody"></div>
    </div>
  </div>
  <div class="side">
    <div class="panel-tabs">
      <button class="panel-tab active" id="tabList">▼ 断層リスト</button>
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
<div id="fault-tooltip"></div>

<script>
(function() {
  var canvas = document.getElementById('c');
  var wrap = canvas.parentElement;
  var hud = document.getElementById('hud');
  var markersDiv = document.getElementById('markers');
  var faultListEl = document.getElementById('faultList');
  var tabList = document.getElementById('tabList');
  var tabCtrl = document.getElementById('tabCtrl');
  var panelList = document.getElementById('panelList');
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
    tabList.classList.add('active'); tabCtrl.classList.remove('active');
    panelList.classList.add('visible'); panelCtrl.classList.remove('visible');
  });
  tabCtrl.addEventListener('click', function() {
    tabCtrl.classList.add('active'); tabList.classList.remove('active');
    panelCtrl.classList.add('visible'); panelList.classList.remove('visible');
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
      id:'java_trench', n:'ジャワ海溝', t:'subduction', region:'東南アジア', country:'インドネシア', length:2600,
      maxMag:8.1, lastMajor:'1994年（東ジャワ地震 M7.8 津波）/2006年（ジャワ島南方沖地震 M7.7 津波）',
      desc:'スンダ海溝がジャワ島沖からバンダ弧へ続く区間。インド・オーストラリアプレートがユーラシアプレートの下に沈み込み、ジャワ島南岸からバリ・小スンダ列島・ティモール沖まで弧状に延びる。津波地震を繰り返し発生させている。',
      center:[-9,118],
      pts:[[-9.5,109],[-9.8,112],[-10,115],[-10,118],[-9.5,121],[-8.5,124],[-7.5,127],[-6.5,130]]
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
      id:'palu_koro', n:'パル・コロ断層', t:'transform', region:'東南アジア', country:'インドネシア', length:500,
      maxMag:7.5, lastMajor:'2018年（パル地震・津波 M7.5、大規模液状化により死者4000人以上）',
      desc:'スラウェシ島を南北に縦断する左横ずれ断層。スンダ・フィリピン海・オーストラリアの各プレートが収束する複雑な三重会合点付近に位置し、2018年の地震では津波と大規模な地盤液状化が同時に発生した。',
      center:[-1.5,120],
      pts:[[0.8,120.0],[0.0,119.9],[-1.0,119.9],[-2.0,120.2],[-3.0,120.5],[-3.5,121.5]]
    },
    {
      id:'flores_thrust', n:'フローレス背弧断層', t:'thrust', region:'東南アジア', country:'インドネシア', length:700,
      maxMag:7.4, lastMajor:'2018年（ロンボク島地震 M6.9、群発地震で死者500人超）',
      desc:'小スンダ列島（ロンボク島・スンバワ島・フローレス島）の北側に延びる背弧衝上断層帯。オーストラリアプレートの沈み込みに伴う地殻短縮で形成され、フローレス海南縁を隆起させている。',
      center:[-8.3,118],
      pts:[[-8.0,115.8],[-8.2,116.5],[-8.3,117.5],[-8.4,118.5],[-8.3,119.5],[-8.2,120.5],[-8.0,121.8]]
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
    },
    {
      id:'calabrian_arc', n:'カラブリア弧沈み込み帯', t:'subduction', region:'地中海中部', country:'イタリア', length:370,
      maxMag:7.5, lastMajor:'1908年（メッシーナ地震 M7.1、死者約12万人）',
      desc:'アフリカプレートの一部（イオニアプレート）がカラブリア（イタリア南部）の下に沈み込む地中海最大級の沈み込み帯。メッシーナ海峡を挟んでシチリア島とカラブリアを隔て、1908年の地震・津波はヨーロッパ史上最悪の自然災害の一つとされる。',
      center:[38.0,16.3],
      pts:[[36.5,15.0],[37.0,16.0],[37.8,17.0],[38.5,17.3],[39.3,17.0],[40.0,17.0]]
    },
    {
      id:'apennine', n:'アペニン断層帯', t:'rift', region:'地中海中部', country:'イタリア', length:800,
      maxMag:7.0, lastMajor:'2016年（イタリア中部地震 M6.5、アマトリーチェ・ノルチャ）',
      desc:'イタリア半島を北西から南東へ縦断する正断層群。アドリア海プレートの沈み込みに伴う背弧拡大により形成され、1980年イルピニア地震(M6.9)・2009年ラクイラ地震(M6.3)・2016年アマトリーチェ地震(M6.5)など内陸直下型地震を繰り返し引き起こしている。',
      center:[42.5,13.2],
      pts:[[44.5,10.5],[43.8,11.5],[43.0,12.8],[42.3,13.4],[41.5,14.0],[40.9,15.4]]
    },
    {
      id:'betic_shear', n:'東ベティコ剪断帯', t:'transform', region:'地中海西部', country:'スペイン', length:450,
      maxMag:6.6, lastMajor:'2011年（ロルカ地震 M5.1、死者9人）',
      desc:'スペイン南東部（ムルシア〜アルメリア）を北東-南西に走る左横ずれ断層帯。アフリカプレートとユーラシアプレートの斜め収束により生じ、1829年トレビエハ地震(M6.6)など歴史的な被害地震の震源となってきた。',
      center:[37.5,-1.7],
      pts:[[38.3,-0.5],[37.9,-1.1],[37.5,-1.7],[37.1,-2.3],[36.8,-2.8]]
    },
    {
      id:'azores_gibraltar', n:'アゾレス・ジブラルタル断裂帯', t:'transform', region:'大西洋・地中海', country:'ポルトガル/モロッコ（国際水域）', length:2000,
      maxMag:9.0, lastMajor:'1755年（リスボン地震 推定M8.5〜9.0、大津波でヨーロッパ・北アフリカ沿岸に甚大な被害）',
      desc:'アゾレス諸島沖からジブラルタル海峡を経てアルボラン海に至るアフリカプレートとユーラシアプレートの境界。1755年のリスボン地震・大西洋大津波は近代ヨーロッパ史上最大級の災害として知られる。',
      center:[36.0,-11.0],
      pts:[[37.5,-25.0],[36.8,-20.0],[36.3,-15.0],[36.0,-11.0],[36.0,-8.5],[35.9,-6.5],[35.8,-5.0]]
    },
    {
      id:'tell_atlas', n:'テル・アトラス断層帯', t:'thrust', region:'北アフリカ', country:'アルジェリア', length:1500,
      maxMag:7.3, lastMajor:'2003年（ブーメルデス地震 M6.8、死者2266人）',
      desc:'アルジェリア北部沿岸をほぼ東西に走る逆断層帯。アフリカプレートとユーラシアプレートの収束により隆起したテル・アトラス山脈に沿い、1980年エルアスナム地震(M7.1)・2003年ブーメルデス地震など大規模な内陸地震を繰り返している。',
      center:[36.5,3.5],
      pts:[[35.2,-1.0],[35.8,0.5],[36.3,2.5],[36.8,3.5],[36.9,5.0],[37.0,7.0]]
    },
    {
      id:'rif_fault', n:'リーフ断層帯', t:'thrust', region:'北アフリカ', country:'モロッコ', length:250,
      maxMag:6.4, lastMajor:'2004年（アル・ホセイマ地震 M6.4、死者628人）',
      desc:'モロッコ北部のリーフ山脈に沿う逆断層・横ずれ断層帯。ジブラルタル海峡南岸でアフリカプレートとユーラシアプレートが斜めに収束する地域で、1994年・2004年のアル・ホセイマ地震など被害地震を発生させている。',
      center:[35.2,-3.9],
      pts:[[35.7,-5.3],[35.3,-4.5],[35.2,-3.9],[35.0,-3.0],[34.9,-2.0]]
    },
    {
      id:'hellenic_arc', n:'ヘレニック弧沈み込み帯', t:'subduction', region:'地中海東部', country:'ギリシャ', length:1000,
      maxMag:8.5, lastMajor:'365年（クレタ地震 推定M8.3〜8.5、地中海東部全域を大津波が襲った）',
      desc:'アフリカプレートがエーゲ海マイクロプレートの下に沈み込む地中海最大の沈み込み帯。イオニア海からクレタ島南方を経てロドス島付近まで弧状に延び、サントリーニ火山を含む南エーゲ海火山弧の原動力となっている。',
      center:[35.5,24.0],
      pts:[[38.0,20.5],[36.5,21.5],[35.0,23.0],[34.5,25.0],[35.0,27.0],[36.0,28.5]]
    },
    {
      id:'corinth_rift', n:'コリントス地溝帯', t:'rift', region:'地中海東部', country:'ギリシャ', length:130,
      maxMag:6.7, lastMajor:'1995年（エギオ地震 M6.2、死者26人）',
      desc:'ペロポネソス半島とギリシャ本土の間を東西に隔てるコリントス湾を形成する地溝帯。年間10〜16mmという世界有数の速さで拡大しており、地中海地域で最も地震活動が活発な地域の一つ。',
      center:[38.25,22.3],
      pts:[[38.4,21.7],[38.3,22.2],[38.2,22.6],[38.1,23.0]]
    },
    {
      id:'futagawa', n:'布田川断層帯', t:'transform', region:'東アジア', country:'日本', length:64,
      maxMag:7.3, lastMajor:'2016年（熊本地震 本震 M7.3）',
      desc:'熊本県阿蘇外輪山西側斜面から益城町木山付近を経て宇土半島先端に至る右横ずれ断層帯。2016年熊本地震の本震（M7.3）はこの断層帯の活動により発生し、益城町等で震度7を観測した。',
      center:[32.76,130.72],
      pts:[[32.89,130.97],[32.82,130.86],[32.79,130.78],[32.72,130.65],[32.65,130.55],[32.60,130.43]]
    },
    {
      id:'hinagu', n:'日奈久断層帯', t:'transform', region:'東アジア', country:'日本', length:81,
      maxMag:8.0, lastMajor:'2026年（熊本地方の地震 M7.1、日奈久断層帯南部の活動とみられる）',
      desc:'益城町木山付近から宇城市・八代市・芦北町を経て八代海南部に至る右横ずれ断層帯。高野-白旗・日奈久・八代海の3区間からなり、2016年熊本地震の前震（M6.5）は高野-白旗区間の活動によるとされる。全区間が連動した場合はM8.0程度と評価されている。',
      center:[32.5,130.60],
      pts:[[32.79,130.78],[32.65,130.71],[32.51,130.60],[32.35,130.47],[32.28,130.42],[32.05,130.35]]
    },
    {
      id:'beppu_haneyama', n:'別府-万年山断層帯', t:'rift', region:'東アジア', country:'日本', length:76,
      maxMag:7.6, lastMajor:'1596年（慶長豊後地震 推定M7.0前後）',
      desc:'大分県の豊予海峡・別府湾から大分平野・由布院を経て九重・玖珠に至る正断層群。別府湾-日出生断層帯を中心に北側が隆起する構造で、1596年の慶長豊後地震では別府湾岸が沈降し瓜生島が水没したと伝わる。',
      center:[33.28,131.50],
      pts:[[33.28,131.89],[33.28,131.65],[33.28,131.49],[33.26,131.36],[33.29,131.18]]
    },
    {
      id:'kego', n:'警固断層帯', t:'transform', region:'東アジア', country:'日本', length:55,
      maxMag:7.2, lastMajor:'2005年（福岡県西方沖地震 M7.0）',
      desc:'福岡市西方沖から博多湾・福岡市中心部を経て筑紫野市に至る右横ずれ断層帯。2005年の福岡県西方沖地震（M7.0）は北西沖合の延長部で発生し、福岡市直下の警固断層本体が動いた場合はM7.2程度と評価されている。',
      center:[33.6,130.35],
      pts:[[33.74,130.18],[33.65,130.35],[33.59,130.40],[33.50,130.51]]
    }
  ];

  var VOLCANOES = [
    {id:'kilauea',n:'キラウエア',c:'アメリカ合衆国（ハワイ）',elev:1247,lastErupt:'2024年（現在も活動中）',lat:19.42,lon:-155.29},
    {id:'mauna_loa',n:'マウナ・ロア',c:'アメリカ合衆国（ハワイ）',elev:4169,lastErupt:'2022年',lat:19.48,lon:-155.61},
    {id:'hualalai',n:'フアラライ山',c:'アメリカ合衆国（ハワイ島）',elev:2521,lastErupt:'1801年（次の噴火が懸念）',lat:19.69,lon:-155.87},
    {id:'mauna_kea',n:'マウナ・ケア',c:'アメリカ合衆国（ハワイ島）',elev:4205,lastErupt:'4500年前（長期休眠中）',lat:19.82,lon:-155.47},
    {id:'haleakala',n:'ハレアカラ',c:'アメリカ合衆国（マウイ島）',elev:3055,lastErupt:'1790年頃',lat:20.71,lon:-156.25},
    {id:'loihi',n:'ロイヒ海底火山',c:'アメリカ合衆国（ハワイ島南東、海底）',elev:-975,lastErupt:'1996年（海底噴火・現在も活動中）',lat:18.92,lon:-155.27},
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
    {id:'tambora',n:'タンボラ山',c:'インドネシア（スンバワ島）',elev:2722,lastErupt:'1967年（1815年の噴火は観測史上最大級で「夏のない年」の原因）',lat:-8.25,lon:118.00},
    {id:'rinjani',n:'リンジャニ山',c:'インドネシア（ロンボク島）',elev:3726,lastErupt:'2016年',lat:-8.42,lon:116.47},
    {id:'kelud',n:'クルード山',c:'インドネシア（ジャワ）',elev:1731,lastErupt:'2014年',lat:-7.93,lon:112.31},
    {id:'soputan',n:'ソプタン山',c:'インドネシア（スラウェシ）',elev:1784,lastErupt:'2016年',lat:1.11,lon:124.73},
    {id:'ijen',n:'イジェン山',c:'インドネシア（ジャワ）',elev:2799,lastErupt:'1999年',lat:-8.058,lon:114.242},
    {id:'pinatubo',n:'ピナトゥボ山',c:'フィリピン',elev:1486,lastErupt:'1991年（20世紀最大級）',lat:15.14,lon:120.35},
    {id:'mayon',n:'マヨン山',c:'フィリピン',elev:2463,lastErupt:'2023年',lat:13.26,lon:123.69},
    {id:'taal',n:'タール火山',c:'フィリピン',elev:311,lastErupt:'2020年',lat:14.01,lon:120.99},
    {id:'klyuchevskaya',n:'クリュチェフスカヤ山',c:'ロシア（カムチャツカ）',elev:4750,lastErupt:'2024年',lat:56.06,lon:160.64},
    {id:'shiveluch',n:'シヴェルチ山',c:'ロシア（カムチャツカ）',elev:3307,lastErupt:'2024年',lat:56.65,lon:161.36},
    {id:'st_helens',n:'セント・ヘレンズ山',c:'アメリカ合衆国',elev:2549,lastErupt:'2008年',lat:46.20,lon:-122.19},
    {id:'redoubt',n:'リダウト山',c:'アメリカ合衆国（アラスカ）',elev:3108,lastErupt:'2009年',lat:60.49,lon:-152.74},
    {id:'popocatepetl',n:'ポポカテペトル山',c:'メキシコ',elev:5426,lastErupt:'2024年（活発に活動中）',lat:19.02,lon:-98.62},
    {id:'colima',n:'コリマ火山',c:'メキシコ',elev:3850,lastErupt:'2022年',lat:19.51,lon:-103.62},
    {id:'santa_maria',n:'サンタ・マリア（サンティアギート）',c:'グアテマラ',elev:3745,lastErupt:'2026年（サンティアギートで継続活動）',lat:14.757,lon:-91.552},
    {id:'fuego',n:'フエゴ火山',c:'グアテマラ',elev:3763,lastErupt:'2026年（頻繁に噴火）',lat:14.473,lon:-90.880},
    {id:'pacaya',n:'パカヤ火山',c:'グアテマラ',elev:2569,lastErupt:'2021年',lat:14.382,lon:-90.601},
    {id:'tacana',n:'タカナ火山',c:'グアテマラ/メキシコ',elev:4060,lastErupt:'1986年（噴気爆発）',lat:15.132,lon:-92.109},
    {id:'acatenango',n:'アカテナンゴ火山',c:'グアテマラ',elev:3976,lastErupt:'1972年',lat:14.501,lon:-90.876},
    {id:'atitlan',n:'アティトラン火山',c:'グアテマラ',elev:3535,lastErupt:'1853年',lat:14.583,lon:-91.186},
    {id:'cerro_quemado',n:'セロ・ケマード',c:'グアテマラ',elev:3197,lastErupt:'1818年',lat:14.797,lon:-91.520},
    {id:'santa_ana',n:'サンタ・アナ火山（イラマテペック）',c:'エルサルバドル',elev:2381,lastErupt:'2005年',lat:13.853,lon:-89.630},
    {id:'izalco',n:'イサルコ火山',c:'エルサルバドル',elev:1950,lastErupt:'1966年',lat:13.813,lon:-89.633},
    {id:'san_miguel',n:'サン・ミゲル火山（チャパラスティケ）',c:'エルサルバドル',elev:2130,lastErupt:'2023年',lat:13.434,lon:-88.269},
    {id:'san_salvador',n:'サン・サルバドル火山',c:'エルサルバドル',elev:1893,lastErupt:'1917年',lat:13.734,lon:-89.294},
    {id:'san_cristobal',n:'サン・クリストバル火山',c:'ニカラグア',elev:1745,lastErupt:'2024年',lat:12.702,lon:-87.004},
    {id:'telica',n:'テリカ火山',c:'ニカラグア',elev:1036,lastErupt:'2022年',lat:12.606,lon:-86.845},
    {id:'cerro_negro',n:'セロ・ネグロ',c:'ニカラグア',elev:728,lastErupt:'1999年',lat:12.506,lon:-86.702},
    {id:'momotombo',n:'モモトンボ火山',c:'ニカラグア',elev:1297,lastErupt:'2016年',lat:12.422,lon:-86.540},
    {id:'masaya',n:'マサヤ火山',c:'ニカラグア',elev:594,lastErupt:'2024年（溶岩湖・ガス活動）',lat:11.984,lon:-86.161},
    {id:'concepcion',n:'コンセプシオン火山',c:'ニカラグア',elev:1610,lastErupt:'2011年',lat:11.538,lon:-85.622},
    {id:'poas',n:'ポアス火山',c:'コスタリカ',elev:2708,lastErupt:'2026年',lat:10.200,lon:-84.233},
    {id:'rincon_de_la_vieja',n:'リンコン・デ・ラ・ビエハ火山',c:'コスタリカ',elev:1916,lastErupt:'2026年',lat:10.830,lon:-85.324},
    {id:'turrialba',n:'トゥリアルバ火山',c:'コスタリカ',elev:3340,lastErupt:'2022年',lat:10.025,lon:-83.767},
    {id:'irazu',n:'イラス火山',c:'コスタリカ',elev:3432,lastErupt:'1994年',lat:9.979,lon:-83.852},
    {id:'arenal',n:'アレナル火山',c:'コスタリカ',elev:1670,lastErupt:'2010年',lat:10.463,lon:-84.703},
    {id:'baru',n:'バル火山',c:'パナマ',elev:3474,lastErupt:'1550年頃',lat:8.808,lon:-82.543},
    {id:'soufriere_hills',n:'スフリエール・ヒルズ',c:'モントセラト（英領）',elev:1050,lastErupt:'2010年',lat:16.72,lon:-62.18},
    {id:'soufriere_sv',n:'ラ・スフリエール（セントビンセント）',c:'セントビンセント・グレナディーン',elev:1234,lastErupt:'2021年（大噴火・島民避難）',lat:13.34,lon:-61.18},
    {id:'pelee',n:'プレー山',c:'マルティニーク（仏領）',elev:1394,lastErupt:'1932年（1902年に3万人死亡）',lat:14.81,lon:-61.17},
    {id:'soufriere_guad',n:'ラ・スフリエール（グアドループ）',c:'グアドループ（仏領）',elev:1467,lastErupt:'1977年（噴気活動継続中）',lat:16.04,lon:-61.66},
    {id:'kick_em_jenny',n:'キック・エム・ジェニー',c:'グレナダ北部（海底火山）',elev:-185,lastErupt:'2001年（海底噴火）',lat:12.30,lon:-61.64},
    {id:'morne_diablotin',n:'モルヌ・ディアブロタン',c:'ドミニカ',elev:1447,lastErupt:'記録なし（地熱活動活発）',lat:15.51,lon:-61.42},
    {id:'soufriere_stlucia',n:'スフリエール地熱地帯',c:'セントルシア',elev:773,lastErupt:'噴気活動継続中（最後の噴火は先史時代）',lat:13.83,lon:-61.05},
    {id:'nevis_peak',n:'ネビス・ピーク',c:'セントクリストファー・ネービス',elev:985,lastErupt:'先史時代（休火山）',lat:17.15,lon:-62.58},
    {id:'mount_liamuiga',n:'リアムイガ山（サルファー・ヒルズ）',c:'セントクリストファー・ネービス',elev:1156,lastErupt:'先史時代（噴気活動あり）',lat:17.37,lon:-62.80},
    {id:'cotopaxi',n:'コトパクシ山',c:'エクアドル',elev:5897,lastErupt:'2023年',lat:-0.68,lon:-78.44},
    {id:'tungurahua',n:'トゥングラウア山',c:'エクアドル',elev:5023,lastErupt:'2016年',lat:-1.47,lon:-78.44},
    {id:'villarrica',n:'ビジャリカ山',c:'チリ',elev:2847,lastErupt:'2024年',lat:-39.42,lon:-71.94},
    {id:'calbuco',n:'カルブコ山',c:'チリ',elev:2015,lastErupt:'2015年',lat:-41.33,lon:-72.61},
    {id:'galeras',n:'ガレラス山',c:'コロンビア',elev:4276,lastErupt:'2014年',lat:1.22,lon:-77.37},
    {id:'nevado_del_ruiz',n:'ネバド・デル・ルイス',c:'コロンビア',elev:5321,lastErupt:'2026年（継続活動）',lat:4.892,lon:-75.324},
    {id:'nevado_del_huila',n:'ネバド・デル・ウイラ',c:'コロンビア',elev:5364,lastErupt:'2012年',lat:2.930,lon:-76.030},
    {id:'purace',n:'プラセ火山',c:'コロンビア',elev:4650,lastErupt:'2024年',lat:2.318,lon:-76.400},
    {id:'reventador',n:'レベンタドール火山',c:'エクアドル',elev:3562,lastErupt:'2026年（継続活動）',lat:-0.077,lon:-77.656},
    {id:'guagua_pichincha',n:'グアグア・ピチンチャ',c:'エクアドル',elev:4784,lastErupt:'2002年',lat:-0.171,lon:-78.598},
    {id:'chiles_cerro_negro',n:'チレス＝セロ・ネグロ火山群',c:'エクアドル/コロンビア',elev:4698,lastErupt:'約16万年前以降（近年地震活動）',lat:0.817,lon:-77.938},
    {id:'misti',n:'ミスティ火山',c:'ペルー',elev:5822,lastErupt:'1985年（小規模活動）',lat:-16.294,lon:-71.409},
    {id:'huaynaputina',n:'ワイナプチナ',c:'ペルー',elev:4850,lastErupt:'1600年（南米最大級の歴史噴火）',lat:-16.608,lon:-70.850},
    {id:'lascar',n:'ラスカル火山',c:'チリ',elev:5592,lastErupt:'2022年',lat:-23.370,lon:-67.730},
    {id:'nevados_de_chillan',n:'ネバドス・デ・チジャン',c:'チリ',elev:3180,lastErupt:'2024年',lat:-36.868,lon:-71.378},
    {id:'llaima',n:'ジャイマ火山',c:'チリ',elev:3125,lastErupt:'2009年',lat:-38.692,lon:-71.729},
    {id:'osorno',n:'オソルノ火山',c:'チリ',elev:2652,lastErupt:'1869年',lat:-41.104,lon:-72.496},
    {id:'copahue',n:'コパウエ火山',c:'チリ/アルゼンチン',elev:2953,lastErupt:'2024年',lat:-37.856,lon:-71.183},
    {id:'planchon_peteroa',n:'プランチョン＝ペテロア火山群',c:'チリ/アルゼンチン',elev:3977,lastErupt:'2019年',lat:-35.240,lon:-70.570},
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
    {id:'sangay',n:'サンガイ山',c:'エクアドル',elev:5286,lastErupt:'2024年（活発）',lat:-2.00,lon:-78.34},
    {id:'shiretoko_iozan',n:'知床硫黄山',c:'日本',elev:1563,lastErupt:'1936年',lat:44.1367,lon:145.1611},
    {id:'rausudake',n:'羅臼岳',c:'日本',elev:1660,lastErupt:'有史以来記録なし（噴気活動あり）',lat:44.0725,lon:145.12},
    {id:'mashu',n:'摩周',c:'日本',elev:857,lastErupt:'約1000年前（現在は噴気活動）',lat:43.5697,lon:144.5717},
    {id:'kussharo',n:'屈斜路',c:'日本',elev:568,lastErupt:'約350年前（カルデラ内の後カルデラ火山群）',lat:43.6,lon:144.43},
    {id:'meakandake',n:'雌阿寒岳',c:'日本',elev:1499,lastErupt:'2008年',lat:43.3839,lon:144.0136},
    {id:'taisetsuzan',n:'大雪山',c:'日本',elev:2291,lastErupt:'約3000年前（現在も噴気活動継続）',lat:43.6603,lon:142.8547},
    {id:'tokachidake',n:'十勝岳',c:'日本',elev:2077,lastErupt:'1988〜1989年',lat:43.4183,lon:142.6861},
    {id:'tarumaesan',n:'樽前山',c:'日本',elev:1041,lastErupt:'1909年（溶岩ドーム形成）',lat:42.6892,lon:141.3767},
    {id:'usuzan',n:'有珠山',c:'日本',elev:733,lastErupt:'2000年',lat:42.5442,lon:140.8375},
    {id:'hokkaido_komagatake',n:'北海道駒ヶ岳',c:'日本',elev:1131,lastErupt:'1929年',lat:42.0592,lon:140.6772},
    {id:'atosanupuri',n:'アトサヌプリ',c:'日本',elev:512,lastErupt:'有史以来噴火記録なし（硫黄採掘の歴史・噴気活動継続）',lat:43.6031,lon:144.5136},
    {id:'esan',n:'恵山',c:'日本',elev:618,lastErupt:'1874年',lat:41.8014,lon:141.1706},
    {id:'kuttara',n:'倶多楽',c:'日本',elev:581,lastErupt:'約200年前（推定）',lat:42.5031,lon:141.1697},
    {id:'eniwadake',n:'恵庭岳',c:'日本',elev:1320,lastErupt:'1739年',lat:42.8,lon:141.0167},
    {id:'niseko',n:'ニセコ火山群',c:'日本',elev:1308,lastErupt:'有史以来記録なし（噴気活動継続）',lat:42.8792,lon:140.6386},
    {id:'yoteizan',n:'羊蹄山（後方羊蹄山）',c:'日本',elev:1898,lastErupt:'約2000年前',lat:42.8317,lon:140.8125},
    {id:'nigorikawa',n:'濁川',c:'日本',elev:605,lastErupt:'約8万年前（カルデラ形成、現在も地熱活動）',lat:42.0664,lon:140.3667},
    {id:'oshima_oshima',n:'渡島大島',c:'日本',elev:737,lastErupt:'1741〜1742年（大規模山体崩壊・津波）',lat:41.5039,lon:139.935},
    {id:'osorezan',n:'恐山',c:'日本',elev:879,lastErupt:'約1万年前（現在は噴気・温泉活動）',lat:41.3189,lon:141.1611},
    {id:'iwakisan',n:'岩木山',c:'日本',elev:1625,lastErupt:'1863年',lat:40.6558,lon:140.3047},
    {id:'hakkodasan',n:'八甲田山',c:'日本',elev:1585,lastErupt:'有史以来記録なし（噴気活動あり）',lat:40.6583,lon:140.8833},
    {id:'towada',n:'十和田',c:'日本',elev:1011,lastErupt:'915年（平安時代の巨大噴火）',lat:40.4667,lon:140.9167},
    {id:'hachimantai',n:'八幡平',c:'日本',elev:1614,lastErupt:'有史以来記録なし（噴気活動あり）',lat:39.955,lon:140.8583},
    {id:'iwatesan',n:'岩手山',c:'日本',elev:2038,lastErupt:'1919年',lat:39.8531,lon:141.0011},
    {id:'akita_yakeyama',n:'秋田焼山',c:'日本',elev:1366,lastErupt:'1997年',lat:39.9611,lon:140.755},
    {id:'akita_komagatake',n:'秋田駒ヶ岳',c:'日本',elev:1637,lastErupt:'1971年',lat:39.7597,lon:140.7981},
    {id:'chokaisan',n:'鳥海山',c:'日本',elev:2236,lastErupt:'1974年',lat:39.0961,lon:140.0483},
    {id:'kurikomayama',n:'栗駒山',c:'日本',elev:1626,lastErupt:'1944年',lat:38.9611,lon:140.7936},
    {id:'naruko',n:'鳴子',c:'日本',elev:459,lastErupt:'1953年',lat:38.7333,lon:140.7333},
    {id:'zaosan',n:'蔵王山',c:'日本',elev:1841,lastErupt:'1940年',lat:38.1444,lon:140.4394},
    {id:'azumayama',n:'吾妻山',c:'日本',elev:2035,lastErupt:'1977年',lat:37.7333,lon:140.25},
    {id:'adatarayama',n:'安達太良山',c:'日本',elev:1700,lastErupt:'1900年',lat:37.6256,lon:140.2811},
    {id:'bandaisan',n:'磐梯山',c:'日本',elev:1816,lastErupt:'1888年（水蒸気爆発・大規模山体崩壊）',lat:37.6011,lon:140.0722},
    {id:'hiuchigatake',n:'燧ヶ岳',c:'日本',elev:2356,lastErupt:'約8000年前',lat:36.9614,lon:139.2861},
    {id:'numazawa',n:'沼沢',c:'日本',elev:1074,lastErupt:'約5400年前（カルデラ形成）',lat:37.4333,lon:139.6167},
    {id:'hijiori',n:'肘折',c:'日本',elev:506,lastErupt:'約1万年前（カルデラ形成）',lat:38.7167,lon:140.1333},
    {id:'nasudake',n:'那須岳',c:'日本',elev:1917,lastErupt:'1963年',lat:37.1211,lon:139.9631},
    {id:'takaharayama',n:'高原山',c:'日本',elev:1795,lastErupt:'有史以来記録なし（約20万年前まで活動）',lat:36.8667,lon:139.7833},
    {id:'nikko_shiranesan',n:'日光白根山',c:'日本',elev:2578,lastErupt:'1889年',lat:36.7975,lon:139.3767},
    {id:'akagisan',n:'赤城山',c:'日本',elev:1828,lastErupt:'有史以来記録なし（約3.2万年前が最新）',lat:36.5486,lon:139.1944},
    {id:'harunasan',n:'榛名山',c:'日本',elev:1449,lastErupt:'約6世紀（古墳時代の噴火）',lat:36.4736,lon:138.8931},
    {id:'kusatsu_shiranesan',n:'草津白根山',c:'日本',elev:2160,lastErupt:'2018年（本白根山）',lat:36.6197,lon:138.5389},
    {id:'asamayama',n:'浅間山',c:'日本',elev:2568,lastErupt:'2024年',lat:36.4061,lon:138.5231},
    {id:'niigata_yakeyama',n:'新潟焼山',c:'日本',elev:2400,lastErupt:'1983年',lat:36.9211,lon:137.9689},
    {id:'myokosan',n:'妙高山',c:'日本',elev:2454,lastErupt:'有史以来記録なし（約2.4万年前が最新）',lat:36.8869,lon:138.1147},
    {id:'midagahara',n:'弥陀ヶ原（立山）',c:'日本',elev:2621,lastErupt:'約2万年前',lat:36.5806,lon:137.5981},
    {id:'yakedake',n:'焼岳',c:'日本',elev:2455,lastErupt:'1962年',lat:36.2278,lon:137.5867},
    {id:'norikuradake',n:'乗鞍岳',c:'日本',elev:3026,lastErupt:'約2000年前',lat:36.1067,lon:137.5544},
    {id:'ontakesan',n:'御嶽山',c:'日本',elev:3067,lastErupt:'2014年（死者58名・行方不明5名）',lat:35.8931,lon:137.4806},
    {id:'hakusan',n:'白山',c:'日本',elev:2702,lastErupt:'1659年',lat:36.1553,lon:136.7722},
    {id:'hakoneyama',n:'箱根山',c:'日本',elev:1438,lastErupt:'2015年（大涌谷小規模噴火）',lat:35.2333,lon:139.0231},
    {id:'izu_tobu',n:'伊豆東部火山群',c:'日本',elev:580,lastErupt:'1989年（手石海丘海底噴火）',lat:34.9083,lon:139.1083},
    {id:'izu_oshima',n:'伊豆大島',c:'日本',elev:758,lastErupt:'1990年',lat:34.7256,lon:139.3931},
    {id:'toshima',n:'利島',c:'日本',elev:508,lastErupt:'約2700年前',lat:34.5192,lon:139.2778},
    {id:'niijima',n:'新島',c:'日本',elev:432,lastErupt:'886年',lat:34.3739,lon:139.2694},
    {id:'kozushima',n:'神津島',c:'日本',elev:574,lastErupt:'838年',lat:34.2214,lon:139.1408},
    {id:'miyakejima',n:'三宅島',c:'日本',elev:815,lastErupt:'2000年',lat:34.0808,lon:139.5289},
    {id:'mikurajima',n:'御蔵島',c:'日本',elev:851,lastErupt:'約2500年前',lat:33.8722,lon:139.6008},
    {id:'hachijojima',n:'八丈島（八丈富士）',c:'日本',elev:854,lastErupt:'1605年',lat:33.1358,lon:139.7853},
    {id:'aogashima',n:'青ヶ島',c:'日本',elev:423,lastErupt:'1785年',lat:32.4547,lon:139.7592},
    {id:'bayonnaise',n:'ベヨネース列岩（明神礁）',c:'日本',elev:-30,lastErupt:'1970年（海底噴火）',lat:31.925,lon:139.9194},
    {id:'sumisujima',n:'須美寿島',c:'日本',elev:136,lastErupt:'有史以来記録なし',lat:31.4467,lon:140.0517},
    {id:'torishima_izu',n:'伊豆鳥島',c:'日本',elev:394,lastErupt:'2002年（小規模）',lat:30.4833,lon:140.3083},
    {id:'sofugan',n:'孀婦岩',c:'日本',elev:99,lastErupt:'有史以来記録なし',lat:29.7861,lon:140.5306},
    {id:'iwoto',n:'硫黄島',c:'日本',elev:169,lastErupt:'2022年（隆起活動継続）',lat:24.7842,lon:141.3294},
    {id:'fukutoku_okanoba',n:'福徳岡ノ場',c:'日本',elev:-14,lastErupt:'2021年（新島形成・大規模噴火）',lat:24.2833,lon:141.4833},
    {id:'abu',n:'阿武火山群',c:'日本',elev:641,lastErupt:'約1万年前',lat:34.4667,lon:131.5833},
    {id:'tsurumidake',n:'鶴見岳・伽藍岳',c:'日本',elev:1375,lastErupt:'867年',lat:33.2822,lon:131.4406},
    {id:'yufudake',n:'由布岳',c:'日本',elev:1583,lastErupt:'約2200年前',lat:33.2833,lon:131.3667},
    {id:'kujusan',n:'九重山',c:'日本',elev:1791,lastErupt:'1995年',lat:33.0864,lon:131.2494},
    {id:'unzendake',n:'雲仙岳（平成新山）',c:'日本',elev:1483,lastErupt:'1996年（平成噴火終息）',lat:32.7594,lon:130.2994},
    {id:'fukue',n:'福江火山群',c:'日本',elev:315,lastErupt:'約1600年前',lat:32.6889,lon:128.8389},
    {id:'yonemaru_sumiyoshiike',n:'米丸・住吉池',c:'日本',elev:211,lastErupt:'約4600年前',lat:31.8167,lon:130.5667},
    {id:'wakamiko',n:'若尊',c:'日本',elev:-200,lastErupt:'約1万年前（現在も海底噴気活動）',lat:31.7167,lon:130.6833},
    {id:'ikeda_yamakawa',n:'池田・山川',c:'日本',elev:924,lastErupt:'約5600年前',lat:31.2333,lon:130.5667},
    {id:'kaimondake',n:'開聞岳',c:'日本',elev:924,lastErupt:'885年',lat:31.1811,lon:130.5286},
    {id:'satsuma_iojima',n:'薩摩硫黄島',c:'日本',elev:704,lastErupt:'2024年（硫黄岳）',lat:30.79,lon:130.3},
    {id:'kuchinoerabujima',n:'口永良部島',c:'日本',elev:657,lastErupt:'2024年',lat:30.44,lon:130.22},
    {id:'kuchinoshima',n:'口之島',c:'日本',elev:628,lastErupt:'有史以来記録なし',lat:29.9667,lon:129.9333},
    {id:'nakanoshima_tokara',n:'中之島（トカラ）',c:'日本',elev:979,lastErupt:'1914年',lat:29.85,lon:129.86},
    {id:'suwanosejima',n:'諏訪之瀬島',c:'日本',elev:799,lastErupt:'2024年（ほぼ常時噴火）',lat:29.6386,lon:129.7167},
    {id:'io_torishima',n:'硫黄鳥島',c:'日本',elev:212,lastErupt:'1903年',lat:27.8756,lon:128.2144},
    {id:'iriomote_kaitei',n:'西表海底火山',c:'日本',elev:-20,lastErupt:'1924年（硫黄島発見）',lat:24.1167,lon:124.0667},
  ];

  VOLCANOES.forEach(function(v) {
    v._p = latLonToXYZ(v.lat, v.lon, 1.005);
  });

  var VOL_FLAG_MAP = [
    ['日本', '🇯🇵'], ['アメリカ合衆国', '🇺🇸'], ['イタリア', '🇮🇹'], ['ギリシャ', '🇬🇷'],
    ['アイスランド', '🇮🇸'], ['インドネシア', '🇮🇩'], ['フィリピン', '🇵🇭'],
    ['ロシア', '🇷🇺'], ['メキシコ', '🇲🇽'], ['モントセラト', '🇲🇸'],
    ['セントビンセント', '🇻🇨'], ['マルティニーク', '🇲🇶'], ['エクアドル', '🇪🇨'],
    ['チリ', '🇨🇱'], ['コロンビア', '🇨🇴'], ['コンゴ民主共和国', '🇨🇩'],
    ['タンザニア', '🇹🇿'], ['エチオピア', '🇪🇹'], ['南極', '🇦🇶'],
    ['ニュージーランド', '🇳🇿'], ['バヌアツ', '🇻🇺'], ['パプアニューギニア', '🇵🇬'],
    ['ペルー', '🇵🇪'], ['イギリス', '🇬🇧'], ['フランス', '🇫🇷'],
    ['グアドループ', '🇬🇵'], ['グレナダ', '🇬🇩'], ['ドミニカ', '🇩🇲'],
    ['セントルシア', '🇱🇨'], ['セントクリストファー', '🇰🇳']
  ];
  function getVolFlag(country) {
    for (var i = 0; i < VOL_FLAG_MAP.length; i++) {
      if (country.indexOf(VOL_FLAG_MAP[i][0]) >= 0) return VOL_FLAG_MAP[i][1];
    }
    return '';
  }

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
      html += '<div class="gvtt-row"><span class="gvtt-name gvtt-hot">' + getVolFlag(v.c) + ' 🔥 ' + v.n + '</span><span class="gvtt-act">' + v.lastErupt + '</span></div>';
    });
    rest.forEach(function(v) {
      html += '<div class="gvtt-row"><span class="gvtt-name">' + getVolFlag(v.c) + ' 🌋 ' + v.n + '</span><span class="gvtt-act">' + v.lastErupt + '</span></div>';
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
    el.addEventListener('touchstart', function(e) { e.stopPropagation(); }, {passive:true});
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      var r = el.getBoundingClientRect();
      var x = r.left + r.width / 2;
      var y = r.top - 8;
      pinVolTooltip(v, x, y);
      selectFaultFromVol(v);
    });
  });

  var volTtPinned = false;
  var volTtDragging = false, volTtDx = 0, volTtDy = 0;
  var _volTtMouseHandler = null, _volTtTouchHandler = null, _volTtTouchMoveHandler = null;

  /**
   * ピン留め済みツールチップの上端に許容する最小Y座標を返す。
   * 常時表示のキャンバス操作ボタン(.canvas-ctrl-btns)の直下より上に
   * ツールチップが重なるとボタンがクリック不能になるため、その下端を下限にする。
   */
  function getPinnedTooltipMinTop() {
    var ctrlBtns = document.querySelector('.canvas-ctrl-btns');
    var ctrlBottom = ctrlBtns ? ctrlBtns.getBoundingClientRect().bottom : 0;
    return Math.max(8, ctrlBottom + 8);
  }

  function volTtHtml(v) {
    return '<div class="vol-tt-hdr"><span class="vol-tt-name">' + getVolFlag(v.c) + ' 🌋 ' + v.n + '</span><span class="vol-tt-close" id="volTtClose">&#215;</span></div>' +
      '<div class="vol-tt-body"><div class="vol-tt-sub">' + v.c + ' / 標高 ' + (v.elev < 0 ? '海面下' + Math.abs(v.elev) : v.elev.toLocaleString()) + 'm</div>' +
      '<div class="vol-tt-sub">最新噴火: ' + v.lastErupt + '</div></div>';
  }

  function showVolTooltip(x, y, v) {
    if (volTtPinned) return;
    volTooltipEl.innerHTML = volTtHtml(v);
    var below = y < canvasRect.top + canvasRect.height * 0.3;
    volTooltipEl.style.left = x + 'px';
    volTooltipEl.style.top = y + 'px';
    volTooltipEl.className = below ? 'below' : '';
    volTooltipEl.style.opacity = '1';
    var closeBtn = document.getElementById('volTtClose');
    if (closeBtn) closeBtn.onclick = function(e) { e.stopPropagation(); volTtPinned = false; volTooltipEl.className = ''; volTooltipEl.style.opacity = '0'; };
  }
  function hideVolTooltip() { if (!volTtPinned) volTooltipEl.style.opacity = '0'; }
  function pinVolTooltip(v, x, y) {
    volTtPinned = true;
    volTooltipEl.innerHTML = volTtHtml(v);
    var r = volTooltipEl.getBoundingClientRect();
    var cx = Math.max(8, Math.min(x - r.width / 2, window.innerWidth - r.width - 8));
    var cy = Math.max(getPinnedTooltipMinTop(), y - r.height - 10);
    volTooltipEl.style.left = cx + 'px';
    volTooltipEl.style.top = cy + 'px';
    volTooltipEl.style.opacity = '1';
    volTooltipEl.className = 'pinned';
    var closeBtn = document.getElementById('volTtClose');
    if (closeBtn) closeBtn.onclick = function(e) { e.stopPropagation(); volTtPinned = false; volTooltipEl.className = ''; volTooltipEl.style.opacity = '0'; };
    var volNameEl = volTooltipEl.querySelector('.vol-tt-name');
    if (volNameEl) {
      volNameEl.onclick = function(e) {
        e.stopPropagation();
        flyToLatLon(v.lat, v.lon, 900);
      };
    }
    if (_volTtMouseHandler) volTooltipEl.removeEventListener('mousedown', _volTtMouseHandler);
    if (_volTtTouchHandler) volTooltipEl.removeEventListener('touchstart', _volTtTouchHandler);
    _volTtMouseHandler = function(e) {
      if (boxZoomMode) return;
      if (e.target && (e.target.id === 'volTtClose' || e.target.className === 'vol-tt-name')) return;
      var rc = volTooltipEl.getBoundingClientRect();
      volTtDragging = true;
      volTtDx = e.clientX - rc.left;
      volTtDy = e.clientY - rc.top;
      e.preventDefault();
      e.stopPropagation();
    };
    _volTtTouchHandler = function(e) {
      if (boxZoomMode) return;
      if (e.target && (e.target.id === 'volTtClose' || e.target.className === 'vol-tt-name')) return;
      var rc = volTooltipEl.getBoundingClientRect();
      volTtDragging = true;
      volTtDx = e.touches[0].clientX - rc.left;
      volTtDy = e.touches[0].clientY - rc.top;
      e.preventDefault();
      e.stopPropagation();
    };
    volTooltipEl.addEventListener('mousedown', _volTtMouseHandler);
    volTooltipEl.addEventListener('touchstart', _volTtTouchHandler, {passive:false});
  }
  window.addEventListener('mousemove', function(e) {
    if (volTtDragging) {
      volTooltipEl.style.left = (e.clientX - volTtDx) + 'px';
      volTooltipEl.style.top = (e.clientY - volTtDy) + 'px';
    }
    if (faultTtDragging) {
      faultTooltipEl.style.left = (e.clientX - faultTtDx) + 'px';
      faultTooltipEl.style.top = (e.clientY - faultTtDy) + 'px';
    }
  });
  window.addEventListener('mouseup', function() { volTtDragging = false; faultTtDragging = false; });
  window.addEventListener('touchmove', function(e) {
    if (volTtDragging) {
      volTooltipEl.style.left = (e.touches[0].clientX - volTtDx) + 'px';
      volTooltipEl.style.top = (e.touches[0].clientY - volTtDy) + 'px';
    }
    if (faultTtDragging) {
      faultTooltipEl.style.left = (e.touches[0].clientX - faultTtDx) + 'px';
      faultTooltipEl.style.top = (e.touches[0].clientY - faultTtDy) + 'px';
    }
  }, {passive:true});
  window.addEventListener('touchend', function() { volTtDragging = false; });

  function flyToLatLon(lat, lon, dur, cb) {
    var latR = lat * Math.PI / 180;
    var lonR = lon * Math.PI / 180;
    var a = axialTilt;
    var tanA = Math.tan(a);
    var tanL = Math.tan(latR);
    var cosVal = Math.max(-1, Math.min(1, tanA * tanL));
    var ty = -Math.acos(cosVal) - lonR;
    var sinSq = 1 - cosVal * cosVal;
    var denom = Math.cos(a) * Math.sqrt(Math.max(0, sinSq));
    var tRx = denom < 1e-6 ? (latR >= 0 ? Math.PI / 2 : -Math.PI / 2) : Math.atan(tanL / denom);
    var dy = ty - rotYv;
    while (dy > Math.PI) dy -= 2 * Math.PI;
    while (dy < -Math.PI) dy += 2 * Math.PI;
    momentumY = 0; momentumX = 0;
    flyFrom = {ry: rotYv, rx: rotXv};
    flyTarget = {ry: rotYv + dy, rx: tRx};
    flyStart = performance.now();
    flyDur = dur || 2000;
    flyCallback = cb || null;
    autoRot = false;
    btnAutoRot.textContent = '▶ 回転';
    btnAutoRot.classList.add('active');
    if (axisLocked) {
      axisLocked = false;
      btnAxisLock.classList.remove('active');
      btnAxisLock.textContent = '＋ 軸垂直固定';
    }
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

  var showFaultDots = false;
  var faultDotDivMap = {};
  var btnFaultDots = document.getElementById('btnFaultDots');
  btnFaultDots.addEventListener('click', function() {
    showFaultDots = !showFaultDots;
    btnFaultDots.classList.toggle('active', showFaultDots);
    btnFaultDots.textContent = showFaultDots ? '🔴 中心点 表示中' : '🔴 断層中心点';
    if (!showFaultDots) { Object.keys(faultDotDivMap).forEach(function(id) { faultDotDivMap[id].style.display = 'none'; }); }
  });

  function initFaultDots() {
    FAULTS.forEach(function(f) {
      var el = document.createElement('div');
      el.className = 'fault-mk';
      var c = faultColor(f.t);
      var col = 'rgb(' + Math.round(c[0]*255) + ',' + Math.round(c[1]*255) + ',' + Math.round(c[2]*255) + ')';
      el.style.background = col;
      el.style.display = 'none';
      el.setAttribute('data-fid', f.id);
      volMarkersDiv.appendChild(el);
      faultDotDivMap[f.id] = el;
      el.addEventListener('touchstart', function(e) { e.stopPropagation(); }, {passive:true});
      el.addEventListener('mouseenter', function(e) {
        var r = el.getBoundingClientRect();
        showFaultTooltip(f, r.left + r.width/2, r.top);
      });
      el.addEventListener('mouseleave', hideFaultTooltip);
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        var r = el.getBoundingClientRect();
        flyToFaultCenter(f);
        pinFaultTooltip(f, r.left + r.width/2, r.top);
      });
    });
  }

  function flyToFaultCenter(f) {
    flyToLatLon(f.center[0], f.center[1], 800, null);
    if (!panelList.classList.contains('visible')) { tabList.click(); }
    setTimeout(function() {
      var item = faultListEl.querySelector('[data-id="' + f.id + '"]');
      if (!item) return;
      item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      item.classList.remove('flash');
      void item.offsetWidth;
      item.classList.add('flash');
      setTimeout(function() { item.classList.remove('flash'); }, 1300);
    }, 200);
  }

  initFaultDots();

  var activeFilter = 'all';
  var selectedFaultId = null;
  var flyTarget = null, flyFrom = null, flyStart = 0, flyDur = 2000, flyCallback = null;

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

  function getFaultFlag(country) {
    var map = [
      ['日本', '🇯🇵'], ['アメリカ', '🇺🇸'], ['カナダ', '🇨🇦'], ['メキシコ', '🇲🇽'],
      ['チリ', '🇨🇱'], ['ペルー', '🇵🇪'], ['コロンビア', '🇨🇴'], ['ベネズエラ', '🇻🇪'],
      ['エクアドル', '🇪🇨'], ['アルゼンチン', '🇦🇷'], ['ブラジル', '🇧🇷'],
      ['トルコ', '🇹🇷'], ['ギリシャ', '🇬🇷'], ['イタリア', '🇮🇹'],
      ['イスラエル', '🇮🇱'], ['ヨルダン', '🇯🇴'], ['シリア', '🇸🇾'],
      ['インドネシア', '🇮🇩'], ['インド', '🇮🇳'], ['パキスタン', '🇵🇰'], ['アフガニスタン', '🇦🇫'],
      ['中国', '🇨🇳'], ['台湾', '🇹🇼'], ['フィリピン', '🇵🇭'],
      ['マレーシア', '🇲🇾'], ['ミャンマー', '🇲🇲'],
      ['ニュージーランド', '🇳🇿'], ['パプアニューギニア', '🇵🇬'],
      ['ロシア', '🇷🇺'], ['カザフスタン', '🇰🇿'],
      ['エチオピア', '🇪🇹'], ['ケニア', '🇰🇪'], ['タンザニア', '🇹🇿'],
      ['モザンビーク', '🇲🇿'], ['ルワンダ', '🇷🇼'], ['ウガンダ', '🇺🇬'],
      ['コンゴ', '🇨🇩'], ['エリトリア', '🇪🇷'], ['ジブチ', '🇩🇯'],
      ['アイスランド', '🇮🇸'], ['ポルトガル', '🇵🇹'], ['スペイン', '🇪🇸'],
      ['アゾレス', '🇵🇹'], ['キルギス', '🇰🇬'], ['タジキスタン', '🇹🇯'],
      ['グアテマラ', '🇬🇹'], ['ホンジュラス', '🇭🇳'], ['エルサルバドル', '🇸🇻'],
      ['ニカラグア', '🇳🇮'], ['コスタリカ', '🇨🇷'], ['パナマ', '🇵🇦'],
      ['カリブ', '🌊'], ['大西洋', '🌊'], ['太平洋', '🌊'], ['インド洋', '🌊'],
      ['南極', '🇦🇶'], ['多国', '🌐']
    ];
    for (var i = 0; i < map.length; i++) {
      if (country.indexOf(map[i][0]) >= 0) return map[i][1] + ' ';
    }
    return '';
  }

  var faultTooltipEl = document.getElementById('fault-tooltip');
  var faultTtPinned = false;
  var faultTtDragging = false, faultTtDx = 0, faultTtDy = 0;
  var _faultTtMouseHandler = null, _faultTtTouchHandler = null;

  function showFaultTooltip(f, x, y) {
    if (faultTtPinned) return;
    var c = faultColor(f.t);
    var dotClr = 'rgb(' + Math.round(c[0]*255) + ',' + Math.round(c[1]*255) + ',' + Math.round(c[2]*255) + ')';
    faultTooltipEl.innerHTML =
      '<div style="display:flex;align-items:center;gap:6px;padding:7px 12px 5px;border-bottom:1px solid #30363d">' +
      '<div style="width:9px;height:9px;border-radius:50%;background:' + dotClr + ';flex-shrink:0"></div>' +
      '<div style="font-weight:700;font-size:12px;color:#f78166">' + getFaultFlag(f.country) + f.n + '</div>' +
      '</div>' +
      '<div style="padding:5px 12px 8px;font-size:11px;line-height:1.8">' +
      '<div><span style="color:#8b949e">タイプ: </span><span class="type-badge ' + f.t + '">' + (TYPE_NAMES[f.t] || f.t) + '</span></div>' +
      '<div><span style="color:#8b949e">全長: </span>' + f.length.toLocaleString() + ' km</div>' +
      '<div><span style="color:#8b949e">最大規模: </span>M' + f.maxMag.toFixed(1) + '</div>' +
      '<div><span style="color:#8b949e">直近: </span>' + f.lastMajor + '</div>' +
      '<div><span style="color:#8b949e">国・地域: </span>' + f.country + '</div>' +
      '</div>';
    faultTooltipEl.className = '';
    faultTooltipEl.style.left = x + 'px';
    faultTooltipEl.style.top = y + 'px';
    faultTooltipEl.style.opacity = '1';
  }

  function hideFaultTooltip() {
    if (!faultTtPinned) faultTooltipEl.style.opacity = '0';
  }

  function pinFaultTooltip(f, x, y) {
    faultTtPinned = true;
    var c = faultColor(f.t);
    var dotClr = 'rgb(' + Math.round(c[0]*255) + ',' + Math.round(c[1]*255) + ',' + Math.round(c[2]*255) + ')';
    faultTooltipEl.innerHTML =
      '<div class="fault-tt-hdr">' +
      '<div style="width:9px;height:9px;border-radius:50%;background:' + dotClr + ';flex-shrink:0;margin-right:6px"></div>' +
      '<span class="fault-tt-name">' + getFaultFlag(f.country) + f.n + '</span>' +
      '<span class="fault-tt-close" id="faultTtClose">&#x2715;</span>' +
      '</div>' +
      '<div class="fault-tt-body" style="font-size:11px;line-height:1.8">' +
      '<div><span style="color:#8b949e">タイプ: </span><span class="type-badge ' + f.t + '">' + (TYPE_NAMES[f.t] || f.t) + '</span></div>' +
      '<div><span style="color:#8b949e">全長: </span>' + f.length.toLocaleString() + ' km</div>' +
      '<div><span style="color:#8b949e">最大規模: </span>M' + f.maxMag.toFixed(1) + '</div>' +
      '<div><span style="color:#8b949e">直近: </span>' + f.lastMajor + '</div>' +
      '<div><span style="color:#8b949e">国・地域: </span>' + f.country + '</div>' +
      '<div style="color:#8b949e;margin-top:3px;font-size:10px">' + f.desc + '</div>' +
      '</div>';
    var r = faultTooltipEl.getBoundingClientRect();
    var cx = Math.max(8, Math.min(x - r.width / 2, window.innerWidth - r.width - 8));
    var cy = Math.max(getPinnedTooltipMinTop(), y - r.height - 10);
    faultTooltipEl.className = 'pinned';
    faultTooltipEl.style.left = cx + 'px';
    faultTooltipEl.style.top = cy + 'px';
    faultTooltipEl.style.opacity = '1';
    var closeBtn = document.getElementById('faultTtClose');
    if (closeBtn) closeBtn.onclick = function() { faultTtPinned = false; faultTooltipEl.style.opacity = '0'; faultTooltipEl.className = ''; };
    var faultNameEl = faultTooltipEl.querySelector('.fault-tt-name');
    if (faultNameEl) {
      faultNameEl.onclick = function(ev) {
        ev.stopPropagation();
        flyToLatLon(f.center[0], f.center[1], 900);
      };
    }
    if (_faultTtMouseHandler) faultTooltipEl.removeEventListener('mousedown', _faultTtMouseHandler);
    if (_faultTtTouchHandler) faultTooltipEl.removeEventListener('touchstart', _faultTtTouchHandler);
    _faultTtMouseHandler = function(ev) {
      if (boxZoomMode) return;
      if (ev.target && (ev.target.id === 'faultTtClose' || ev.target.className === 'fault-tt-name')) return;
      var r = faultTooltipEl.getBoundingClientRect();
      faultTtDragging = true;
      faultTtDx = ev.clientX - r.left;
      faultTtDy = ev.clientY - r.top;
      ev.preventDefault();
      ev.stopPropagation();
    };
    _faultTtTouchHandler = function(ev) {
      if (boxZoomMode) return;
      if (ev.target && (ev.target.id === 'faultTtClose' || ev.target.className === 'fault-tt-name')) return;
      var r = faultTooltipEl.getBoundingClientRect();
      faultTtDragging = true;
      faultTtDx = ev.touches[0].clientX - r.left;
      faultTtDy = ev.touches[0].clientY - r.top;
      ev.preventDefault();
      ev.stopPropagation();
    };
    faultTooltipEl.addEventListener('mousedown', _faultTtMouseHandler);
    faultTooltipEl.addEventListener('touchstart', _faultTtTouchHandler, {passive:false});
  }

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
      html += '<div class="fault-name">' + getFaultFlag(f.country) + f.n + '</div>';
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

  function selectFault(id, doFly) {
    selectedFaultId = id;
    var f = FAULTS.find(function(x) { return x.id === id; });
    renderFaultList();
    if (doFly && f) {
      flyToLatLon(f.center[0], f.center[1], 1200, function() {
        var rect = canvas.getBoundingClientRect();
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        var r = faultTooltipEl.getBoundingClientRect();
        var tx = Math.max(8, Math.min(cx - r.width / 2, window.innerWidth - r.width - 8));
        var ty = Math.max(8, cy - r.height - 20);
        pinFaultTooltip(f, tx, ty);
      });
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

  (function() {
    var IATA_FLAG = {
      'NRT':'🇯🇵','HND':'🇯🇵','KIX':'🇯🇵','ICN':'🇰🇷','PVG':'🇨🇳','PEK':'🇨🇳','HKG':'🇭🇰',
      'SIN':'🇸🇬','BKK':'🇹🇭','KUL':'🇲🇾','CGK':'🇮🇩','SYD':'🇦🇺','MEL':'🇦🇺','AKL':'🇳🇿',
      'DEL':'🇮🇳','BOM':'🇮🇳','DXB':'🇦🇪','DOH':'🇶🇦','IST':'🇹🇷',
      'LHR':'🇬🇧','CDG':'🇫🇷','FRA':'🇩🇪','AMS':'🇳🇱','MAD':'🇪🇸','FCO':'🇮🇹',
      'LAX':'🇺🇸','JFK':'🇺🇸','ORD':'🇺🇸','MIA':'🇺🇸','HNL':'🇺🇸','ATL':'🇺🇸','SFO':'🇺🇸',
      'YYZ':'🇨🇦','MEX':'🇲🇽','YVR':'🇨🇦',
      'GRU':'🇧🇷','EZE':'🇦🇷','BOG':'🇨🇴','LIM':'🇵🇪','SCL':'🇨🇱','CCS':'🇻🇪','PTY':'🇵🇦',
      'GIG':'🇧🇷','HAV':'🇨🇺',
      'JNB':'🇿🇦','NBO':'🇰🇪','CAI':'🇪🇬','LOS':'🇳🇬','ADD':'🇪🇹','CMN':'🇲🇦','ACC':'🇬🇭',
      'TPE':'🇹🇼','MNL':'🇵🇭','SGN':'🇻🇳','JED':'🇸🇦','TLV':'🇮🇱',
      'ZRH':'🇨🇭','SVO':'🇷🇺','CPH':'🇩🇰','VIE':'🇦🇹',
      'INN':'🇦🇹','ERF':'🇩🇪','ORY':'🇫🇷','RUH':'🇸🇦','GDN':'🇵🇱','STR':'🇩🇪','GVA':'🇨🇭','SXB':'🇫🇷','LKCS':'🇨🇿','TRS':'🇮🇹','TRN':'🇮🇹','EPTO':'🇵🇱','NUE':'🇩🇪','NCE':'🇫🇷','HAM':'🇩🇪','BSL':'🇨🇭','PMI':'🇪🇸','BZG':'🇵🇱','FLR':'🇮🇹','BRQ':'🇨🇿','BRE':'🇩🇪','PRG':'🇨🇿','LKLN':'🇨🇿','BRN':'🇨🇭','BLX':'🇮🇹','HOF':'🇸🇦','POZ':'🇵🇱','MRS':'🇫🇷','MHG':'🇩🇪','MUC':'🇩🇪','MXP':'🇮🇹','LIN':'🇮🇹','ETZ':'🇫🇷','LEJ':'🇩🇪','RWN':'🇺🇦','LIS':'🇵🇹','LYS':'🇫🇷','LUG':'🇨🇭','EDNR':'🇩🇪','WAW':'🇵🇱','XCR':'🇫🇷','VCE':'🇮🇹','VRN':'🇮🇹'
    };
    var APT_REGIONS = [
      { label:'🌏 東アジア', open:true, airports:[
        {code:'NRT',name:'成田国際空港',city:'🇯🇵 日本・千葉',lat:35.77,lon:140.39,routes:['ICN','HKG','SIN','BKK','LAX','PVG','LHR','CDG','JFK','SYD','DXB','ORD','HND','KIX']},
        {code:'HND',name:'羽田空港',city:'🇯🇵 日本・東京',lat:35.55,lon:139.78,routes:['ICN','PVG','HKG','LAX','SIN','LHR','BKK','CDG','JFK','SYD','DXB','ORD','DEL','KUL']},
        {code:'KIX',name:'関西国際空港',city:'🇯🇵 日本・大阪',lat:34.43,lon:135.24,routes:['ICN','PVG','HKG','SIN','BKK','LAX','KUL','CDG','LHR','SYD','DXB','JFK']},
        {code:'ICN',name:'仁川国際空港',city:'🇰🇷 韓国・ソウル',lat:37.46,lon:126.44,routes:['NRT','PVG','SIN','BKK','HKG','LAX','JFK','LHR','DXB','CDG','FRA','SYD','KUL','YYZ','ORD']},
        {code:'PVG',name:'上海浦東国際空港',city:'🇨🇳 中国・上海',lat:31.14,lon:121.81,routes:['ICN','NRT','SIN','LHR','LAX','CDG','JFK','HKG','BKK','DXB','AMS','FRA','SYD','ORD']},
        {code:'PEK',name:'北京首都国際空港',city:'🇨🇳 中国・北京',lat:40.08,lon:116.58,routes:['ICN','NRT','SIN','LHR','LAX','CDG','JFK','HKG','BKK','DXB','AMS','FRA','SYD','ORD']},
        {code:'HKG',name:'香港国際空港',city:'🇭🇰 香港',lat:22.31,lon:113.92,routes:['SIN','NRT','BKK','LAX','LHR','DXB','JFK','CDG','SYD','ICN','PVG','KUL','AMS','FRA','IST','DEL','TPE']},
        {code:'TPE',name:'台湾桃園国際空港',city:'🇹🇼 台湾・桃園',lat:25.08,lon:121.23,routes:['HKG','NRT','ICN','PVG','SIN','BKK','MNL','LAX','SFO']}
      ]},
      { label:'🌴 東南アジア・オセアニア', open:false, airports:[
        {code:'SIN',name:'チャンギ空港',city:'🇸🇬 シンガポール',lat:1.35,lon:103.99,routes:['KUL','BKK','HKG','NRT','DXB','SYD','LAX','LHR','ICN','CDG','AMS','DEL','MEL','JFK','FRA']},
        {code:'BKK',name:'スワンナプーム国際空港',city:'🇹🇭 タイ・バンコク',lat:13.69,lon:100.75,routes:['SIN','HKG','KUL','NRT','DXB','ICN','LAX','LHR','CDG','PVG','AMS','SYD','DEL','JFK']},
        {code:'KUL',name:'クアラルンプール国際空港',city:'🇲🇾 マレーシア',lat:2.74,lon:101.70,routes:['SIN','BKK','HKG','NRT','DXB','SYD','ICN','LHR','CDG','AMS','DEL','MEL','JFK']},
        {code:'CGK',name:'スカルノ・ハッタ国際空港',city:'🇮🇩 インドネシア・ジャカルタ',lat:-6.13,lon:106.65,routes:['SIN','KUL','NRT','HKG','SYD','DXB','BKK','MEL','ICN','LHR','CDG']},
        {code:'SYD',name:'シドニー国際空港',city:'🇦🇺 オーストラリア・シドニー',lat:-33.94,lon:151.18,routes:['MEL','SIN','LAX','HKG','AKL','NRT','LHR','DXB','BKK','KUL','ICN','CDG','JFK','FRA']},
        {code:'MEL',name:'メルボルン空港',city:'🇦🇺 オーストラリア・メルボルン',lat:-37.67,lon:144.84,routes:['SYD','SIN','LAX','HKG','AKL','NRT','LHR','DXB','BKK','KUL','CDG','ICN']},
        {code:'AKL',name:'オークランド国際空港',city:'🇳🇿 ニュージーランド',lat:-37.01,lon:174.79,routes:['SYD','MEL','LAX','SIN','NRT','LHR','HKG','CDG','DXB','JFK']},
        {code:'MNL',name:'ニノイ・アキノ国際空港',city:'🇵🇭 フィリピン・マニラ',lat:14.51,lon:121.02,routes:['SIN','HKG','NRT','ICN','BKK','KUL','LAX','SFO','DXB']},
        {code:'SGN',name:'タンソンニャット国際空港',city:'🇻🇳 ベトナム・ホーチミン',lat:10.82,lon:106.66,routes:['SIN','BKK','KUL','ICN','NRT','HKG','DOH']}
      ]},
      { label:'🕌 南アジア・中東', open:false, airports:[
        {code:'DEL',name:'インディラ・ガンジー国際空港',city:'🇮🇳 インド・ニューデリー',lat:28.57,lon:77.12,routes:['DXB','BOM','LHR','SIN','DOH','JFK','ICN','CDG','FRA','IST','BKK','AMS','NRT']},
        {code:'BOM',name:'チャトラパティ・シヴァージー国際空港',city:'🇮🇳 インド・ムンバイ',lat:19.09,lon:72.87,routes:['DXB','DEL','DOH','LHR','SIN','JFK','CDG','IST','FRA','AMS','ICN','NRT']},
        {code:'DXB',name:'ドバイ国際空港',city:'🇦🇪 UAE・ドバイ',lat:25.25,lon:55.36,routes:['LHR','SIN','BKK','KUL','CDG','JFK','LAX','NRT','SYD','DEL','BOM','IST','JNB','AMS','FRA','DOH','ICN','GRU','JED','TLV']},
        {code:'DOH',name:'ハマド国際空港',city:'🇶🇦 カタール・ドーハ',lat:25.27,lon:51.61,routes:['LHR','CDG','JFK','LAX','SIN','NRT','SYD','DEL','BOM','IST','FRA','AMS','DXB','JNB']},
        {code:'IST',name:'イスタンブール空港',city:'🇹🇷 トルコ・イスタンブール',lat:41.27,lon:28.75,routes:['LHR','CDG','FRA','JFK','DXB','SIN','AMS','JNB','GRU','LAX','MAD','DEL','NRT','FCO','SVO','TLV']},
        {code:'JED',name:'キング・アブドゥルアズィーズ国際空港',city:'🇸🇦 サウジアラビア・ジェッダ',lat:21.68,lon:39.16,routes:['DXB','DOH','IST','LHR','CDG','CAI']},
        {code:'TLV',name:'ベン・グリオン国際空港',city:'🇮🇱 イスラエル・テルアビブ',lat:32.01,lon:34.89,routes:['IST','LHR','CDG','FRA','JFK','DXB']},
        {code:'RUH',name:'キング・ハーリド国際空港',city:'🇸🇦 サウジアラビア・リヤド',lat:24.9576,lon:46.6988,routes:['DXB','DOH','IST','CAI','LHR']},
        {code:'HOF',name:'ホファール国際空港',city:'🇸🇦 サウジアラビア・アルアハサー',lat:25.2853,lon:49.4852,routes:['RUH','DXB']}
      ]},
      { label:'🏰 ヨーロッパ', open:false, airports:[
        {code:'LHR',name:'ロンドン・ヒースロー空港',city:'🇬🇧 イギリス・ロンドン',lat:51.48,lon:-0.46,routes:['JFK','LAX','DXB','SIN','HKG','NRT','CDG','FRA','JNB','AMS','ICN','SYD','GRU','ORD','YYZ','DOH','IST','DEL','ZRH','VIE','CPH','ACC']},
        {code:'CDG',name:'シャルル・ド・ゴール空港',city:'🇫🇷 フランス・パリ',lat:49.01,lon:2.55,routes:['LHR','JFK','LAX','DXB','NRT','SIN','FRA','GRU','AMS','JNB','IST','HKG','ICN','MAD','SYD','DOH','CMN','SVO']},
        {code:'FRA',name:'フランクフルト空港',city:'🇩🇪 ドイツ・フランクフルト',lat:50.04,lon:8.56,routes:['LHR','CDG','JFK','LAX','DXB','NRT','SIN','GRU','AMS','JNB','IST','ICN','SYD','DOH','DEL','ZRH','VIE','TLV']},
        {code:'AMS',name:'スキポール空港',city:'🇳🇱 オランダ・アムステルダム',lat:52.31,lon:4.77,routes:['LHR','CDG','JFK','LAX','NRT','SIN','DXB','JNB','FRA','IST','ICN','SYD','GRU','DOH','DEL']},
        {code:'MAD',name:'マドリード・バラハス空港',city:'🇪🇸 スペイン・マドリード',lat:40.47,lon:-3.56,routes:['LHR','CDG','JFK','LAX','GRU','BOG','SCL','EZE','LIM','IST','FRA','MIA','FCO','CCS']},
        {code:'FCO',name:'フィウミチーノ空港',city:'🇮🇹 イタリア・ローマ',lat:41.80,lon:12.25,routes:['LHR','CDG','FRA','JFK','LAX','DXB','NRT','IST','AMS','DOH','GRU','MAD','JNB']},
        {code:'ZRH',name:'チューリッヒ空港',city:'🇨🇭 スイス・チューリッヒ',lat:47.46,lon:8.55,routes:['LHR','CDG','FRA','JFK','SIN','DXB','IST']},
        {code:'SVO',name:'シェレメーチエヴォ国際空港',city:'🇷🇺 ロシア・モスクワ',lat:55.97,lon:37.42,routes:['IST','DXB','PEK','JFK','CDG']},
        {code:'CPH',name:'コペンハーゲン空港',city:'🇩🇰 デンマーク・コペンハーゲン',lat:55.62,lon:12.66,routes:['LHR','FRA','AMS','JFK','IST']},
        {code:'VIE',name:'ウィーン国際空港',city:'🇦🇹 オーストリア・ウィーン',lat:48.11,lon:16.57,routes:['LHR','FRA','IST','JFK','DXB']}
      ]},
      { label:'🏘️ ヨーロッパ（地方空港）', open:false, airports:[
        {code:'INN',name:'インスブルック空港',city:'🇦🇹 オーストリア・インスブルック',lat:47.2602,lon:11.344,routes:['FRA','MUC','LHR']},
        {code:'ERF',name:'エアフルト・ヴァイマル空港',city:'🇩🇪 ドイツ・エアフルト',lat:50.98,lon:10.9581,routes:['FRA','MUC']},
        {code:'ORY',name:'オルリー空港',city:'🇫🇷 フランス・パリ',lat:48.7233,lon:2.3794,routes:['CDG','MAD','FCO','LIS']},
        {code:'GDN',name:'グダニスク・レフ・ワレサ空港',city:'🇵🇱 ポーランド・グダニスク',lat:54.3776,lon:18.4662,routes:['WAW','FRA']},
        {code:'STR',name:'シュトゥットガルト空港',city:'🇩🇪 ドイツ・シュトゥットガルト',lat:48.6899,lon:9.222,routes:['FRA','MUC','LHR']},
        {code:'GVA',name:'ジュネーブ空港',city:'🇨🇭 スイス・ジュネーブ',lat:46.2381,lon:6.1089,routes:['ZRH','LHR','CDG','FRA']},
        {code:'SXB',name:'ストラスブール空港',city:'🇫🇷 フランス・ストラスブール',lat:48.5383,lon:7.6282,routes:['CDG','FRA']},
        {code:'LKCS',name:'チェスケー・ブジェヨヴィツェ空港',city:'🇨🇿 チェコ・チェスケー・ブジェヨヴィツェ',lat:48.9482,lon:14.4283,routes:['PRG']},
        {code:'TRS',name:'トリエステ空港',city:'🇮🇹 イタリア・トリエステ',lat:45.8275,lon:13.4722,routes:['FCO','MXP']},
        {code:'TRN',name:'トリノ空港',city:'🇮🇹 イタリア・トリノ',lat:45.2008,lon:7.6497,routes:['FCO','MXP','CDG']},
        {code:'EPTO',name:'トルン空港',city:'🇵🇱 ポーランド・トルン',lat:53.0292,lon:18.5459,routes:['WAW']},
        {code:'NUE',name:'ニュルンベルク空港',city:'🇩🇪 ドイツ・ニュルンベルク',lat:49.4987,lon:11.0669,routes:['FRA','MUC']},
        {code:'NCE',name:'ニース・コート・ダジュール空港',city:'🇫🇷 フランス・ニース',lat:43.6584,lon:7.2159,routes:['CDG','ORY','LHR','FRA']},
        {code:'HAM',name:'ハンブルク空港',city:'🇩🇪 ドイツ・ハンブルク',lat:53.6304,lon:9.9882,routes:['FRA','MUC','LHR']},
        {code:'BSL',name:'バーゼル・ミュルーズ・フライブルク欧州空港',city:'🇨🇭 スイス/フランス・バーゼル',lat:47.5896,lon:7.5299,routes:['ZRH','CDG','FRA']},
        {code:'PMI',name:'パルマ空港',city:'🇪🇸 スペイン・マヨルカ島',lat:39.5517,lon:2.7388,routes:['MAD','LHR','CDG','FRA']},
        {code:'BZG',name:'ビドゴシュチュ・イグナツィ・ヤン・パデレフスキ空港',city:'🇵🇱 ポーランド・ビドゴシュチュ',lat:53.0968,lon:17.9777,routes:['WAW']},
        {code:'FLR',name:'フィレンツェ空港',city:'🇮🇹 イタリア・フィレンツェ',lat:43.81,lon:11.2051,routes:['FCO','MXP']},
        {code:'BRQ',name:'ブルノ・トゥライステ空港',city:'🇨🇿 チェコ・ブルノ',lat:49.1513,lon:16.6944,routes:['PRG','VIE']},
        {code:'BRE',name:'ブレーメン空港',city:'🇩🇪 ドイツ・ブレーメン',lat:53.0475,lon:8.7867,routes:['FRA','MUC']},
        {code:'PRG',name:'ヴァーツラフ・ハヴェル・プラハ国際空港',city:'🇨🇿 チェコ・プラハ',lat:50.1008,lon:14.26,routes:['LHR','CDG','FRA','VIE','IST','AMS']},
        {code:'LKLN',name:'プルゼニ空港',city:'🇨🇿 チェコ・プルゼニ',lat:49.6752,lon:13.2746,routes:['PRG']},
        {code:'BRN',name:'ベルン空港',city:'🇨🇭 スイス・ベルン',lat:46.9141,lon:7.4971,routes:['ZRH']},
        {code:'BLX',name:'ベルーノ空港',city:'🇮🇹 イタリア・ベルーノ',lat:46.168,lon:12.248,routes:['FCO']},
        {code:'POZ',name:'ポズナン・ヴァヴィスワ空港',city:'🇵🇱 ポーランド・ポズナン',lat:52.421,lon:16.8263,routes:['WAW','FRA']},
        {code:'MRS',name:'マルセイユ・プロヴァンス空港',city:'🇫🇷 フランス・マルセイユ',lat:43.4393,lon:5.2214,routes:['CDG','ORY','LHR']},
        {code:'MHG',name:'マンハイム・シティー空港',city:'🇩🇪 ドイツ・マンハイム',lat:49.4727,lon:8.5143,routes:['FRA']},
        {code:'MUC',name:'ミュンヘン国際空港',city:'🇩🇪 ドイツ・ミュンヘン',lat:48.3538,lon:11.7861,routes:['FRA','LHR','CDG','JFK','IST','DXB']},
        {code:'MXP',name:'ミラノ・マルペンサ空港',city:'🇮🇹 イタリア・ミラノ',lat:45.6306,lon:8.7281,routes:['FCO','LHR','CDG','FRA','JFK']},
        {code:'LIN',name:'ミラノ・リナーテ空港',city:'🇮🇹 イタリア・ミラノ',lat:45.4451,lon:9.2767,routes:['FCO','CDG','FRA']},
        {code:'ETZ',name:'メス・ナンシー・ロレーヌ空港',city:'🇫🇷 フランス・メス/ナンシー',lat:48.9821,lon:6.2513,routes:['CDG','ORY']},
        {code:'LEJ',name:'ライプツィヒ・ハレ空港',city:'🇩🇪 ドイツ・ライプツィヒ',lat:51.4239,lon:12.2364,routes:['FRA','MUC']},
        {code:'RWN',name:'リウネ空港',city:'🇺🇦 ウクライナ・リウネ',lat:50.6071,lon:26.1416,routes:['WAW']},
        {code:'LIS',name:'リスボン・ポルテラ空港',city:'🇵🇹 ポルトガル・リスボン',lat:38.7813,lon:-9.1359,routes:['MAD','LHR','CDG','FRA','GRU']},
        {code:'LYS',name:'リヨン・サン＝テグジュペリ空港',city:'🇫🇷 フランス・リヨン',lat:45.7256,lon:5.0811,routes:['CDG','ORY','LHR']},
        {code:'LUG',name:'ルガーノ空港',city:'🇨🇭 スイス・ルガーノ',lat:46.0043,lon:8.9105,routes:['ZRH']},
        {code:'EDNR',name:'レーゲンスブルク空港',city:'🇩🇪 ドイツ・レーゲンスブルク',lat:49.1419,lon:12.0819,routes:['MUC']},
        {code:'WAW',name:'ワルシャワ・ショパン空港',city:'🇵🇱 ポーランド・ワルシャワ',lat:52.1657,lon:20.9671,routes:['LHR','CDG','FRA','IST','AMS']},
        {code:'XCR',name:'ヴァトリー国際空港',city:'🇫🇷 フランス・シャロン＝アン＝シャンパーニュ',lat:48.7678,lon:4.2011,routes:['CDG']},
        {code:'VCE',name:'ヴェネツィア・テッセラ空港',city:'🇮🇹 イタリア・ヴェネツィア',lat:45.5053,lon:12.3519,routes:['FCO','MXP','LHR','CDG','FRA']},
        {code:'VRN',name:'ヴェローナ・ヴィラフランカ空港',city:'🇮🇹 イタリア・ヴェローナ',lat:45.3957,lon:10.8885,routes:['FCO','MXP']}
      ]},
      { label:'🗽 北アメリカ', open:false, airports:[
        {code:'LAX',name:'ロサンゼルス国際空港',city:'🇺🇸 アメリカ・ロサンゼルス',lat:33.94,lon:-118.41,routes:['NRT','SYD','SIN','LHR','CDG','JFK','ORD','HKG','ICN','FRA','PVG','DXB','AKL','MEL','MEX','YYZ','SFO','HNL']},
        {code:'JFK',name:'ジョン・F・ケネディ国際空港',city:'🇺🇸 アメリカ・ニューヨーク',lat:40.64,lon:-73.78,routes:['LHR','CDG','FRA','NRT','HKG','DXB','LAX','ORD','GRU','SIN','AMS','IST','DOH','ICN','SYD','YYZ','MIA','ATL','SFO']},
        {code:'ORD',name:'シカゴ・オヘア国際空港',city:'🇺🇸 アメリカ・シカゴ',lat:41.98,lon:-87.90,routes:['JFK','LAX','LHR','CDG','NRT','FRA','MEX','GRU','YYZ','DXB','ICN','MIA','ATL']},
        {code:'YYZ',name:'トロント・ピアソン国際空港',city:'🇨🇦 カナダ・トロント',lat:43.68,lon:-79.63,routes:['JFK','LAX','LHR','CDG','NRT','MEX','DEL','FRA','AMS','ORD','GRU','MIA','YVR']},
        {code:'MEX',name:'メキシコシティ国際空港',city:'🇲🇽 メキシコ・メキシコシティ',lat:19.44,lon:-99.07,routes:['LAX','JFK','ORD','GRU','BOG','MAD','MIA','YYZ','LHR','CDG','EZE','PTY','HAV']},
        {code:'MIA',name:'マイアミ国際空港',city:'🇺🇸 アメリカ・マイアミ',lat:25.80,lon:-80.29,routes:['JFK','LAX','GRU','BOG','LIM','CCS','MEX','LHR','MAD','CDG','EZE','SCL','PTY','ORD','HAV']},
        {code:'ATL',name:'ハーツフィールド・ジャクソン・アトランタ国際空港',city:'🇺🇸 アメリカ・アトランタ',lat:33.64,lon:-84.43,routes:['JFK','LHR','ORD','MEX','GRU','LAX','CDG','AMS']},
        {code:'SFO',name:'サンフランシスコ国際空港',city:'🇺🇸 アメリカ・サンフランシスコ',lat:37.62,lon:-122.38,routes:['LAX','JFK','NRT','ICN','HKG','SIN','LHR','TPE','SYD']},
        {code:'YVR',name:'バンクーバー国際空港',city:'🇨🇦 カナダ・バンクーバー',lat:49.19,lon:-123.18,routes:['LAX','JFK','NRT','ICN','HKG','LHR','YYZ']},
        {code:'HNL',name:'ホノルル国際空港',city:'🇺🇸 アメリカ・ホノルル',lat:21.32,lon:-157.92,routes:['LAX','SFO','NRT','ICN','SYD']}
      ]},
      { label:'🌿 南アメリカ・カリブ海', open:false, airports:[
        {code:'GRU',name:'グアルーリョス国際空港',city:'🇧🇷 ブラジル・サンパウロ',lat:-23.43,lon:-46.47,routes:['JFK','LAX','LHR','CDG','FRA','BOG','EZE','LIM','MAD','ORD','MIA','SCL','DOH','IST','FCO','GIG']},
        {code:'EZE',name:'エセイサ国際空港',city:'🇦🇷 アルゼンチン・ブエノスアイレス',lat:-34.82,lon:-58.54,routes:['GRU','LIM','BOG','LHR','CDG','MAD','JFK','SCL','LAX','MIA','FCO']},
        {code:'BOG',name:'エル・ドラード国際空港',city:'🇨🇴 コロンビア・ボゴタ',lat:4.70,lon:-74.14,routes:['MIA','JFK','LAX','MEX','GRU','LIM','MAD','LHR','EZE','SCL','PTY','ORD','CDG']},
        {code:'LIM',name:'ホルヘ・チャベス国際空港',city:'🇵🇪 ペルー・リマ',lat:-12.02,lon:-77.11,routes:['BOG','GRU','EZE','LAX','JFK','MIA','MAD','SCL','MEX','CDG','ORD']},
        {code:'SCL',name:'アルトゥーロ・メリノ・ベニテス国際空港',city:'🇨🇱 チリ・サンティアゴ',lat:-33.39,lon:-70.79,routes:['GRU','EZE','LIM','BOG','MAD','LAX','JFK','MIA','MEX','CDG','FCO']},
        {code:'CCS',name:'シモン・ボリバル国際空港',city:'🇻🇪 ベネズエラ・カラカス',lat:10.60,lon:-66.99,routes:['MIA','BOG','GRU','MAD','LHR','MEX','PTY','JFK','ORD','LAX','EZE','LIM']},
        {code:'PTY',name:'トクメン国際空港',city:'🇵🇦 パナマ・パナマシティ',lat:9.07,lon:-79.38,routes:['MIA','JFK','LAX','BOG','GRU','LIM','MAD','MEX','EZE','ORD','CCS','SCL','HAV']},
        {code:'GIG',name:'ガレオン国際空港',city:'🇧🇷 ブラジル・リオデジャネイロ',lat:-22.81,lon:-43.24,routes:['GRU','LHR','MAD','JFK','MIA']},
        {code:'HAV',name:'ホセ・マルティ国際空港',city:'🇨🇺 キューバ・ハバナ',lat:22.99,lon:-82.41,routes:['MIA','MEX','MAD','JFK','PTY']}
      ]},
      { label:'🦁 アフリカ', open:false, airports:[
        {code:'JNB',name:'O・R・タンボ国際空港',city:'🇿🇦 南アフリカ・ヨハネスブルグ',lat:-26.13,lon:28.24,routes:['LHR','CDG','DXB','SIN','NBO','LAX','IST','AMS','FRA','JFK','ADD','NRT','DOH']},
        {code:'NBO',name:'ジョモ・ケニヤッタ国際空港',city:'🇰🇪 ケニア・ナイロビ',lat:-1.32,lon:36.93,routes:['LHR','DXB','JNB','CDG','BOM','IST','AMS','ADD','FRA','CAI','DOH']},
        {code:'CAI',name:'カイロ国際空港',city:'🇪🇬 エジプト・カイロ',lat:30.12,lon:31.41,routes:['LHR','DXB','IST','CDG','DOH','AMS','FRA','NBO','JNB','NRT','JFK','BOM']},
        {code:'LOS',name:'ムルタラ・ムハンマド国際空港',city:'🇳🇬 ナイジェリア・ラゴス',lat:6.58,lon:3.32,routes:['LHR','CDG','DXB','JNB','NBO','IST','JFK','AMS','ADD','NRT','CAI']},
        {code:'ADD',name:'ボレ国際空港',city:'🇪🇹 エチオピア・アディスアベバ',lat:8.98,lon:38.80,routes:['LHR','CDG','DXB','JNB','NBO','NRT','LAX','JFK','IST','BOM','AMS','DOH','ACC']},
        {code:'CMN',name:'モハメド5世国際空港',city:'🇲🇦 モロッコ・カサブランカ',lat:33.37,lon:-7.59,routes:['CDG','MAD','LHR','JFK','DXB']},
        {code:'ACC',name:'コトカ国際空港',city:'🇬🇭 ガーナ・アクラ',lat:5.61,lon:-0.17,routes:['LHR','CDG','JNB','ADD','DXB']}
      ]}
    ];

    var aptByCode = {};
    APT_REGIONS.forEach(function(rg) {
      rg.airports.forEach(function(a) { aptByCode[a.code] = a; });
    });

    var aptTooltipEl = document.getElementById('apt-tooltip');
    var aptMarkersDiv = document.getElementById('markers');
    var aptDivMap = {};
    var showAirports = false;

    APT_REGIONS.forEach(function(rg) {
      rg.airports.forEach(function(a) {
        a._p = latLonToXYZ(a.lat, a.lon, 1.008);
        var el = document.createElement('div');
        el.className = 'apt-mk';
        el.textContent = '✈';
        el.setAttribute('data-code', a.code);
        aptMarkersDiv.appendChild(el);
        aptDivMap[a.code] = el;
        el.addEventListener('click', function(ev) {
          ev.stopPropagation();
          openAptDrawerAndHighlight(a.code);
          flyToLatLon(a.lat, a.lon, 900, function() { showAptTooltip(a.code); });
        });
      });
    });

    var aptTtDragging = false, aptTtDragOX = 0, aptTtDragOY = 0, aptTtDragMoved = false;
    aptTooltipEl.addEventListener('pointerdown', function(ev) {
      if (ev.target.closest('button') || ev.target.closest('.apt-tt-code')) return;
      aptTtDragging = true;
      aptTtDragMoved = false;
      aptTtDragOX = ev.clientX - parseFloat(aptTooltipEl.style.left || '0');
      aptTtDragOY = ev.clientY - parseFloat(aptTooltipEl.style.top || '0');
      aptTooltipEl.setPointerCapture(ev.pointerId);
      ev.preventDefault();
    });
    aptTooltipEl.addEventListener('pointermove', function(ev) {
      if (!aptTtDragging) return;
      aptTtDragMoved = true;
      aptTooltipEl.style.left = (ev.clientX - aptTtDragOX) + 'px';
      aptTooltipEl.style.top = (ev.clientY - aptTtDragOY) + 'px';
    });
    aptTooltipEl.addEventListener('pointerup', function() { aptTtDragging = false; });

    function showAptTooltip(code, fromCode) {
      var a = aptByCode[code];
      if (!a) return;
      var el = aptDivMap[code];
      if (!el || el.style.display === 'none') return;
      var r = el.getBoundingClientRect();
      var cx = r.left + r.width / 2;
      var cy = r.top + r.height / 2;
      var routesHtml = '';
      a.routes.forEach(function(rc) {
        var flag = IATA_FLAG[rc] || '';
        routesHtml += '<span class="apt-tt-code" data-goto="' + rc + '">' + flag + ' ' + rc + '</span>';
      });
      var routeLabel = fromCode
        ? ' <span id="aptTtRouteLabel" style="font-size:11px;color:#8b949e;font-weight:400;font-family:monospace;">' + fromCode + ' &#x2192; ' + code + '</span>'
        : ' <span style="font-size:11px;color:#8b949e;font-weight:400;font-family:monospace;">' + code + '</span>';
      aptTooltipEl.innerHTML =
        '<div class="apt-tt-hdr"><div class="apt-tt-name" data-center="' + code + '" id="aptTtNameEl">' + a.city.split(' ')[0] + ' ' + a.name + routeLabel + '</div><button class="apt-tt-close" id="aptTtClose">&#215;</button></div>' +
        '<div class="apt-tt-routes">' + routesHtml + '</div>';
      var closeBtn = document.getElementById('aptTtClose');
      if (closeBtn) closeBtn.addEventListener('click', hideAptTooltip);
      var nameEl = aptTooltipEl.querySelector('.apt-tt-name');
      if (nameEl) {
        nameEl.addEventListener('click', function() {
          if (aptTtDragMoved) return;
          var centerCode = nameEl.getAttribute('data-center');
          var ca = aptByCode[centerCode];
          if (!ca) return;
          flyToLatLon(ca.lat, ca.lon, 900, function() { showAptTooltip(centerCode); });
        });
      }
      aptTooltipEl.style.transform = 'none';
      aptTooltipEl.className = '';
      aptTooltipEl.style.left = '-9999px';
      aptTooltipEl.style.top = '-9999px';
      aptTooltipEl.style.opacity = '0.01';
      var ttH = aptTooltipEl.offsetHeight || 110;
      var ttW = aptTooltipEl.offsetWidth || 220;
      var margin = 12;
      var ttX = cx - ttW / 2;
      var ttY;
      if (cy - ttH - margin < canvasRect.top) {
        ttY = cy + margin;
      } else {
        ttY = cy - ttH - margin;
      }
      ttX = Math.max(4, Math.min(ttX, window.innerWidth - ttW - 4));
      ttY = Math.max(4, Math.min(ttY, window.innerHeight - ttH - 4));
      aptTooltipEl.style.left = ttX + 'px';
      aptTooltipEl.style.top = ttY + 'px';
      aptTooltipEl.style.pointerEvents = 'none';
      aptTooltipEl.style.opacity = '1';
      requestAnimationFrame(function() { aptTooltipEl.style.pointerEvents = ''; });
      if (fromCode) {
        var flashEl = document.getElementById('aptTtNameEl');
        if (flashEl) {
          flashEl.classList.remove('apt-tt-flash');
          void flashEl.offsetWidth;
          flashEl.classList.add('apt-tt-flash');
          setTimeout(function() { if (flashEl) flashEl.classList.remove('apt-tt-flash'); }, 1600);
        }
      }
      aptTooltipEl.querySelectorAll('.apt-tt-code').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var dest = btn.getAttribute('data-goto');
          var da = aptByCode[dest];
          if (!da) return;
          hideAptTooltip();
          flyToLatLon(da.lat, da.lon, 1200, function() { showAptTooltip(dest, code); });
        });
      });
    }
    function hideAptTooltip() { aptTooltipEl.style.opacity = '0'; }

    function buildAptPanel() {
      var body = document.getElementById('aptBody');
      var html = '';
      APT_REGIONS.forEach(function(rg) {
        html += '<details class="apt-region"' + (rg.open ? ' open' : '') + '>';
        html += '<summary>' + rg.label + ' <span class="apt-reg-arrow">&#9660;</span></summary>';
        rg.airports.forEach(function(a) {
          html += '<div class="apt-item clickable" data-code="' + a.code + '">';
          html += '<div class="apt-item-row">';
          html += '<div class="apt-item-main">';
          html += '<div class="apt-top"><span class="apt-iata">' + a.code + '</span><span class="apt-name">' + a.name + '</span></div>';
          html += '<div class="apt-city">' + a.city + '</div>';
          html += '<div class="apt-routes"><span class="apt-routes-lbl">&#9992;</span>' + a.routes.join(' &middot; ') + '</div>';
          html += '</div>';
          html += '<button class="apt-status-btn" data-code="' + a.code + '" title="発着状況を確認">？</button>';
          html += '</div>';
          html += '</div>';
        });
        html += '</details>';
      });
      body.innerHTML = html;
      body.querySelectorAll('.apt-item.clickable').forEach(function(item) {
        item.addEventListener('click', function() {
          var code = item.getAttribute('data-code');
          var a = aptByCode[code];
          if (!a) return;
          hideAptTooltip();
          flyToLatLon(a.lat, a.lon, 1200, function() { showAptTooltip(code); });
        });
      });
      body.querySelectorAll('.apt-status-btn').forEach(function(btn) {
        btn.addEventListener('click', function(ev) {
          ev.stopPropagation();
          var code = btn.getAttribute('data-code');
          showFlightStatusModal(code);
        });
      });
    }

    function getNextZ() {
      var els = document.querySelectorAll('[style*="z-index"]');
      var max = 100;
      for (var i = 0; i < els.length; i++) {
        var z = parseInt(els[i].style.zIndex, 10);
        if (!isNaN(z) && z > max) max = z;
      }
      return max + 100;
    }

    function openAptDrawerAndHighlight(code) {
      var drawerEl = document.getElementById('airportDrawer');
      var btnEl = document.getElementById('btnAirport');
      if (!drawerEl.classList.contains('open')) {
        drawerEl.classList.add('open');
        btnEl.classList.add('active');
        setAirportMarkers(true);
      }
      setTimeout(function() {
        var item = document.querySelector('.apt-item[data-code="' + code + '"]');
        if (!item) return;
        var details = item.closest('details.apt-region');
        if (details && !details.open) details.open = true;
        setTimeout(function() {
          item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          item.classList.remove('apt-flash');
          void item.offsetWidth;
          item.classList.add('apt-flash');
          setTimeout(function() { item.classList.remove('apt-flash'); }, 1600);
        }, 80);
      }, 50);
    }

    var IATA_ICAO = {
      NRT:'RJAA',HND:'RJTT',KIX:'RJBB',ICN:'RKSI',PVG:'ZSPD',PEK:'ZBAA',HKG:'VHHH',TPE:'RCTP',
      SIN:'WSSS',BKK:'VTBS',KUL:'WMKK',CGK:'WIII',SYD:'YSSY',MEL:'YMML',AKL:'NZAA',MNL:'RPLL',SGN:'VVTS',
      DEL:'VIDP',BOM:'VABB',DXB:'OMDB',DOH:'OTHH',IST:'LTFM',JED:'OEJN',TLV:'LLBG',
      LHR:'EGLL',CDG:'LFPG',FRA:'EDDF',AMS:'EHAM',MAD:'LEMD',FCO:'LIRF',ZRH:'LSZH',SVO:'UUEE',CPH:'EKCH',VIE:'LOWW',
      LAX:'KLAX',JFK:'KJFK',ORD:'KORD',YYZ:'CYYZ',MEX:'MMMX',MIA:'KMIA',ATL:'KATL',SFO:'KSFO',YVR:'CYVR',HNL:'PHNL',
      GRU:'SBGR',EZE:'SAEZ',BOG:'SKBO',LIM:'SPJC',SCL:'SCEL',CCS:'SVMI',PTY:'MPTO',GIG:'SBGL',HAV:'MUHA',
      JNB:'FAOR',NBO:'HKJK',CAI:'HECA',LOS:'DNMM',ADD:'HAAB',CMN:'GMMN',ACC:'DGAA',
      INN:'LOWI',ERF:'EDDE',ORY:'LFPO',RUH:'OERK',GDN:'EPGD',STR:'EDDS',GVA:'LSGG',SXB:'LFST',LKCS:'LKCS',TRS:'LIPQ',TRN:'LIMF',EPTO:'EPTO',NUE:'EDDN',NCE:'LFMN',HAM:'EDDH',BSL:'LFSB',PMI:'LEPA',BZG:'EPBY',FLR:'LIRQ',BRQ:'LKTB',BRE:'EDDW',PRG:'LKPR',LKLN:'LKLN',BRN:'LSZB',BLX:'LIDB',HOF:'OEAH',POZ:'EPPO',MRS:'LFML',MHG:'EDFM',MUC:'EDDM',MXP:'LIMC',LIN:'LIML',ETZ:'LFJL',LEJ:'EDDP',RWN:'UKLR',LIS:'LPPT',LYS:'LFLL',LUG:'LSZA',EDNR:'EDNR',WAW:'EPWA',XCR:'LFOK',VCE:'LIPZ',VRN:'LIPX'
    };
    var ICAO_IATA = {};
    Object.keys(IATA_ICAO).forEach(function(k) { ICAO_IATA[IATA_ICAO[k]] = k; });

    function showFlightStatusModal(code) {
      var a = aptByCode[code];
      if (!a) return;
      var icao = IATA_ICAO[code];
      var z = getNextZ();
      var overlay = document.createElement('div');
      overlay.className = 'fs-overlay';
      overlay.style.zIndex = String(z);
      var modal = document.createElement('div');
      modal.className = 'fs-modal';
      modal.innerHTML =
        '<div class="fs-modal-hdr">' +
        '<div class="fs-modal-title">' + a.city.split(' ')[0] + ' ' + a.name + ' (' + code + ')</div>' +
        '<button class="fs-modal-close" id="fsCloseBtn">&#215;</button>' +
        '</div>' +
        '<div class="fs-section-lbl">直近2時間の出発便（ADS-B実績）</div>' +
        '<div id="fsBody"><div class="fs-empty">読み込み中...</div></div>';
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      modal.addEventListener('click', function(ev) { ev.stopPropagation(); });
      overlay.addEventListener('click', function() {
        if (document.body.contains(overlay)) document.body.removeChild(overlay);
      });
      document.getElementById('fsCloseBtn').addEventListener('click', function() {
        if (document.body.contains(overlay)) document.body.removeChild(overlay);
      });
      if (!icao) {
        document.getElementById('fsBody').innerHTML = '<div class="fs-empty">ICAO コード未登録</div>';
        return;
      }
      var now = Math.floor(Date.now() / 1000);
      var begin = now - 7200;
      var url = 'https://opensky-network.org/api/flights/departure?airport=' + icao + '&begin=' + begin + '&end=' + now;
      fetch(url)
        .then(function(r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(function(raw) {
          var fsBody = document.getElementById('fsBody');
          if (!fsBody) return;
          var flights = (raw || [])
            .map(function(f) {
              return {
                callsign: (f.callsign || '').trim(),
                departed: f.firstSeen,
                destIata: f.estArrivalAirport ? (ICAO_IATA[f.estArrivalAirport] || f.estArrivalAirport) : '不明'
              };
            })
            .filter(function(f) { return f.callsign; })
            .sort(function(a, b) { return b.departed - a.departed; });
          if (!flights.length) {
            fsBody.innerHTML = '<div class="fs-empty">直近2時間の出発便データがありません</div>';
          } else {
            var h = '';
            flights.slice(0, 40).forEach(function(f) {
              var dep = f.departed ? new Date(f.departed * 1000).toLocaleTimeString('ja-JP', {hour:'2-digit', minute:'2-digit', timeZone:'UTC'}) + ' UTC' : '';
              h += '<div class="fs-flight-row">';
              h += '<span class="fs-callsign">' + f.callsign + '</span>';
              h += '<span class="fs-arrow">&#8594;</span>';
              h += '<span class="fs-dest">' + f.destIata + '</span>';
              h += '<span class="fs-time">' + dep + '</span>';
              h += '</div>';
            });
            fsBody.innerHTML = h;
          }
          var note = document.createElement('div');
          note.className = 'fs-note';
          note.textContent = '出典: OpenSky Network (ADS-B実績) | 欠航情報は各航空会社・空港公式サイトをご確認ください';
          var el = document.getElementById('fsBody');
          if (el) el.appendChild(note);
        })
        .catch(function(e) {
          var fsBody = document.getElementById('fsBody');
          if (!fsBody) return;
          fsBody.innerHTML =
            '<div class="fs-empty">データ取得できませんでした<br><small style="color:#484f58">' + e.message + '</small><br>' +
            '<br><a href="https://www.flightradar24.com/airport/' + code + '" target="_blank" style="color:#58a6ff">FlightRadar24 で確認</a>' +
            ' &nbsp; <a href="https://www.flightaware.com/live/airport/' + icao + '" target="_blank" style="color:#58a6ff">FlightAware で確認</a></div>';
        });
    }

    function setAirportMarkers(visible) {
      showAirports = visible;
      Object.keys(aptDivMap).forEach(function(k) {
        if (!visible) aptDivMap[k].style.display = 'none';
      });
    }

    window._aptRenderFrame = function(mvpMat, modelMat, W, H) {
      if (!showAirports) return;
      APT_REGIONS.forEach(function(rg) {
        rg.airports.forEach(function(a) {
          var p = a._p;
          var mz = modelMat[2]*p[0] + modelMat[6]*p[1] + modelMat[10]*p[2];
          var el = aptDivMap[a.code];
          if (mz < 0.02) { el.style.display = 'none'; return; }
          var mcx = mvpMat[0]*p[0] + mvpMat[4]*p[1] + mvpMat[8]*p[2] + mvpMat[12];
          var mcy = mvpMat[1]*p[0] + mvpMat[5]*p[1] + mvpMat[9]*p[2] + mvpMat[13];
          var mcw = mvpMat[3]*p[0] + mvpMat[7]*p[1] + mvpMat[11]*p[2] + mvpMat[15];
          if (mcw <= 0) { el.style.display = 'none'; return; }
          el.style.display = 'block';
          el.style.left = ((mcx/mcw + 1) * W / 2) + 'px';
          el.style.top = ((-mcy/mcw + 1) * H / 2) + 'px';
          el.style.opacity = Math.min(1, (mz - 0.02) * 10).toFixed(2);
        });
      });
    };

    buildAptPanel();

    var drawer = document.getElementById('airportDrawer');
    var btn = document.getElementById('btnAirport');
    btn.addEventListener('click', function() {
      var open = drawer.classList.toggle('open');
      btn.classList.toggle('active', open);
      setAirportMarkers(open);
    });
    document.getElementById('airportClose').addEventListener('click', function() {
      drawer.classList.remove('open');
      btn.classList.remove('active');
      setAirportMarkers(false);
    });
  })();

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

  var rotXv = 0.3, rotYv = 0.6, zoom = 3.2, zoomTarget = 3.2;
  var DRAG_SENS_BASE_ZOOM = 3.2;
  // ドラッグ回転の感度。既定ズーム(3.2)を基準に、zoomが小さい(=最大ズーム付近、
  // カメラが地表に近い)ほど画面上の同じカーソル移動量が球面上のより大きな
  // 移動に見えてしまうため、既定ズームより手前側(zoom<3.2)だけ2乗で急減させて
  // 微調整しやすくする。既定ズーム以上(zoom>=3.2、ズームアウト側)は従来通り
  // 線形のまま変更しない。
  function computeDragSens(z) {
    var t = z / DRAG_SENS_BASE_ZOOM;
    return 0.008 * (t < 1 ? t * t : t);
  }
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

  var boxZoomMode = false;
  var boxZoomOverlay = document.getElementById('box-select-overlay');
  var bx0 = 0, by0 = 0, bxCur = 0, byCur = 0, boxDragging = false;
  var btnBoxZoom = document.getElementById('btnBoxZoom');
  btnBoxZoom.addEventListener('click', function() {
    boxZoomMode = !boxZoomMode;
    btnBoxZoom.classList.toggle('active', boxZoomMode);
    btnBoxZoom.textContent = boxZoomMode ? '🔲 選択中…' : '🔲 エリアズーム';
    canvas.style.cursor = boxZoomMode ? 'crosshair' : '';
    // エリア選択中はツールチップがドラッグ操作を奪ってしまわないよう、
    // ポインタイベントを透過させてキャンバスの矩形選択に届くようにする。
    faultTooltipEl.style.pointerEvents = boxZoomMode ? 'none' : '';
    volTooltipEl.style.pointerEvents = boxZoomMode ? 'none' : '';
  });

  function updateBoxOverlay() {
    var rect = canvas.getBoundingClientRect();
    var x1 = Math.min(bx0, bxCur) - rect.left;
    var y1 = Math.min(by0, byCur) - rect.top;
    var x2 = Math.max(bx0, bxCur) - rect.left;
    var y2 = Math.max(by0, byCur) - rect.top;
    boxZoomOverlay.style.left = x1 + 'px';
    boxZoomOverlay.style.top = y1 + 'px';
    boxZoomOverlay.style.width = (x2 - x1) + 'px';
    boxZoomOverlay.style.height = (y2 - y1) + 'px';
    boxZoomOverlay.style.display = 'block';
  }

  var lastBoxBounds = null;
  var areaMenuEl = null;
  var areaTourRunning = false;
  var areaTourTimer = null;
  var areaTourIdx = 0;
  var areaTourItems = [];
  var areaTourDrawer = document.getElementById('areaTourDrawer');
  var areaTourBody = document.getElementById('areaTourBody');
  var areaTourTitle = document.getElementById('areaTourTitle');
  document.getElementById('areaTourClose').addEventListener('click', function() { areaTourDrawer.classList.remove('open'); });

  function mulMat3Vec3(m, x, y, z) { return [m[0]*x+m[1]*y+m[2]*z, m[3]*x+m[4]*y+m[5]*z, m[6]*x+m[7]*y+m[8]*z]; }

  function screenToLatLon(px_screen, py_screen, rect) {
    var ndcX = (px_screen - rect.left) / rect.width * 2 - 1;
    var ndcY = -((py_screen - rect.top) / rect.height * 2 - 1);
    var tanHF = Math.tan(0.35);
    var aspect = rect.width / rect.height;
    var rdx = ndcX * tanHF * aspect;
    var rdy = ndcY * tanHF;
    var rdz = -1.0;
    var rlen = Math.sqrt(rdx*rdx + rdy*rdy + rdz*rdz);
    rdx /= rlen; rdy /= rlen; rdz /= rlen;
    var mi = [model[0],model[1],model[2], model[4],model[5],model[6], model[8],model[9],model[10]];
    var ro = mulMat3Vec3(mi, 0, 0, zoom);
    var rd = mulMat3Vec3(mi, rdx, rdy, rdz);
    var b2 = 2*(ro[0]*rd[0]+ro[1]*rd[1]+ro[2]*rd[2]);
    var cval = ro[0]*ro[0]+ro[1]*ro[1]+ro[2]*ro[2] - 1;
    var disc = b2*b2 - 4*cval;
    if (disc < 0) return null;
    var t = (-b2 - Math.sqrt(disc)) / 2;
    var hx = ro[0]+t*rd[0], hy = ro[1]+t*rd[1], hz = ro[2]+t*rd[2];
    return { lat: Math.asin(Math.max(-1, Math.min(1, hy))) * 180 / Math.PI, lon: Math.atan2(-hz, hx) * 180 / Math.PI };
  }

  function getVolsInBounds() {
    if (!lastBoxBounds) return [];
    var b = lastBoxBounds;
    return VOLCANOES.filter(function(v) {
      var lon = v.lon;
      if (b.lonCross) {
        return v.lat >= b.latMin && v.lat <= b.latMax && (lon >= b.lonMin || lon <= b.lonMax);
      }
      return v.lat >= b.latMin && v.lat <= b.latMax && lon >= b.lonMin && lon <= b.lonMax;
    });
  }

  function renderAreaTourDrawer(vols) {
    areaTourItems = vols.slice();
    areaTourTitle.textContent = '🌋 エリア内 活火山 (' + vols.length + '件)';
    areaTourBody.innerHTML = vols.map(function(v, i) {
      return '<div class="area-tour-item" data-idx="' + i + '">' +
        '<div class="area-tour-idx">#' + (i + 1) + '</div>' +
        '<div style="min-width:0;flex:1"><div class="area-tour-name">' + getVolFlag(v.c) + ' ' + v.n + '</div>' +
        '<div class="area-tour-meta">' + v.c + ' / 標高 ' + (v.elev < 0 ? '海面下' + Math.abs(v.elev) : v.elev.toLocaleString()) + 'm / 最新噴火: ' + v.lastErupt + '</div></div>' +
        '</div>';
    }).join('');
    areaTourBody.querySelectorAll('.area-tour-item').forEach(function(row) {
      row.addEventListener('click', function(e) {
        e.stopPropagation();
        var idx = parseInt(row.getAttribute('data-idx'), 10);
        focusAreaTourVolcano(idx);
      });
    });
    areaTourDrawer.classList.add('open');
  }

  function flashAreaTourVolcano(idx) {
    areaTourBody.querySelectorAll('.area-tour-item').forEach(function(row) { row.classList.remove('active'); });
    var row = areaTourBody.querySelector('.area-tour-item[data-idx="' + idx + '"]');
    if (!row) return;
    row.classList.add('active');
    row.classList.remove('flash');
    void row.offsetWidth;
    row.classList.add('flash');
    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    setTimeout(function() { row.classList.remove('flash'); }, 1500);
  }

  function pinVolTooltipAfterFly(v) {
    requestAnimationFrame(function() {
      var el = volDivMap[v.id];
      if (!el) return;
      var r = el.getBoundingClientRect();
      pinVolTooltip(v, r.left + r.width / 2, r.top - 8);
    });
  }

  function focusAreaTourVolcano(idx) {
    var v = areaTourItems[idx];
    if (!v) return;
    if (areaTourRunning) stopAreaTour(false);
    setVolcanoes(true);
    areaTourDrawer.classList.add('open');
    flashAreaTourVolcano(idx);
    flyToLatLon(v.lat, v.lon, 1200, function() { pinVolTooltipAfterFly(v); });
  }

  function showAreaMenu() {
    if (!areaMenuEl) {
      areaMenuEl = document.createElement('div');
      areaMenuEl.style.cssText = 'position:absolute;right:10px;top:50%;transform:translateY(-50%);background:rgba(13,17,23,0.93);border:1px solid #30363d;border-radius:9px;padding:10px 12px;z-index:110;min-width:130px;box-shadow:0 4px 16px rgba(0,0,0,0.6);';
      wrap.appendChild(areaMenuEl);
    }
    var vols = getVolsInBounds();
    areaMenuEl.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px">' +
      '<span style="font-size:11px;font-weight:700;color:#ff9500">&#x1F4CD; エリアメニュー</span>' +
      '<span id="areaMenuClose" style="cursor:pointer;color:#8b949e;font-size:14px;padding:0 3px;line-height:1">&#x2715;</span>' +
      '</div>' +
      '<div style="font-size:10px;color:#8b949e;margin-bottom:9px">&#x1F30B; 活火山: ' + vols.length + '件</div>' +
      '<button id="areaTourBtn" style="width:100%;background:#2d1a0c;border:1px solid #ff9500;border-radius:6px;color:#ff9500;font-size:11px;padding:6px 8px;cursor:pointer;opacity:' + (vols.length === 0 ? '0.4' : '1') + '" ' + (vols.length === 0 ? 'disabled' : '') + '>&#x1F30B; 巡回</button>' +
      '<div id="areaTourProg" style="font-size:10px;color:#8b949e;text-align:center;margin-top:6px;min-height:14px"></div>';
    areaMenuEl.style.display = 'block';
    document.getElementById('areaMenuClose').addEventListener('click', function() {
      stopAreaTour();
      areaMenuEl.style.display = 'none';
      lastBoxBounds = null;
    });
    document.getElementById('areaTourBtn').addEventListener('click', function() {
      if (areaTourRunning) { stopAreaTour(); } else { startAreaTour(); }
    });
  }

  function startAreaTour() {
    var vols = getVolsInBounds();
    if (vols.length === 0) return;
    areaTourRunning = true;
    areaTourIdx = 0;
    setVolcanoes(true);
    renderAreaTourDrawer(vols);
    areaTourStep(vols);
  }

  function areaTourStep(vols) {
    if (!areaTourRunning || areaTourIdx >= vols.length) { stopAreaTour(true); return; }
    var v = vols[areaTourIdx];
    var prog = document.getElementById('areaTourProg');
    if (prog) prog.textContent = (areaTourIdx + 1) + ' / ' + vols.length;
    flashAreaTourVolcano(areaTourIdx);
    var btn = document.getElementById('areaTourBtn');
    if (btn) btn.textContent = '&#x23F9; 停止 (' + (areaTourIdx + 1) + '/' + vols.length + ')';
    flyToLatLon(v.lat, v.lon, 1200, function() {
      if (!areaTourRunning) return;
      // フライ完了直後は volDivMap の位置がまだ前フレームの値のままなので、
      // 1フレーム待って実際のマーカー座標(クリック時のpinVolTooltip呼び出しと同じ基準)
      // を読んでからツールチップを表示する。固定の画面比率(rect.height*0.38等)で
      // 位置を決めると、マーカーの実際の投影位置とツールチップがズレる。
      requestAnimationFrame(function() {
        if (!areaTourRunning) return;
        var el = volDivMap[v.id];
        var r = el.getBoundingClientRect();
        pinVolTooltip(v, r.left + r.width / 2, r.top - 8);
      });
      areaTourTimer = setTimeout(function() {
        if (!areaTourRunning) return;
        volTtPinned = false;
        volTooltipEl.style.opacity = '0';
        volTooltipEl.className = '';
        areaTourIdx++;
        areaTourStep(vols);
      }, 5000);
    });
  }

  function stopAreaTour(completed) {
    areaTourRunning = false;
    if (areaTourTimer) { clearTimeout(areaTourTimer); areaTourTimer = null; }
    volTtPinned = false;
    volTooltipEl.style.opacity = '0';
    volTooltipEl.className = '';
    var btn = document.getElementById('areaTourBtn');
    if (btn) {
      var vols = getVolsInBounds();
      btn.innerHTML = '&#x1F30B; 巡回';
      btn.disabled = vols.length === 0;
      btn.style.opacity = vols.length === 0 ? '0.4' : '1';
    }
    var prog = document.getElementById('areaTourProg');
    if (prog) prog.textContent = '';
    if (completed) {
      lastBoxBounds = null;
      if (areaMenuEl) areaMenuEl.style.display = 'none';
      areaTourDrawer.classList.remove('open');
      boxZoomMode = false;
      btnBoxZoom.classList.remove('active');
      btnBoxZoom.textContent = '🔲 エリアズーム';
      canvas.style.cursor = '';
    }
  }

  function computeLonRange(lons) {
    if (lons.length === 0) return null;
    var sorted = lons.slice().sort(function(a, b) { return a - b; });
    var maxGap = -1, gapIdx = 0;
    for (var i = 0; i < sorted.length; i++) {
      var next = i === sorted.length - 1 ? sorted[0] + 360 : sorted[i + 1];
      var gap = next - sorted[i];
      if (gap > maxGap) { maxGap = gap; gapIdx = i; }
    }
    var lonMin = sorted[(gapIdx + 1) % sorted.length];
    var lonMax = sorted[gapIdx];
    return { lonMin: lonMin, lonMax: lonMax, lonCross: lonMin > lonMax };
  }

  function applyBoxZoom(ex, ey) {
    var rect = canvas.getBoundingClientRect();
    var cx_px = (bx0 + ex) / 2;
    var cy_px = (by0 + ey) / 2;
    var bw = Math.abs(ex - bx0);
    var bh = Math.abs(ey - by0);
    boxZoomOverlay.style.display = 'none';
    if (bw < 10 || bh < 10) return;
    var ctr = screenToLatLon(cx_px, cy_px, rect);
    if (!ctr) return;
    var lat = ctr.lat, lon = ctr.lon;
    // 対角2点だけでなく矩形の辺上を細かくサンプリングして緯度経度範囲を求める。
    // 球面への透視投影は選択矩形の内部で非線形に歪み、特に最大ズーム時は
    // カメラが球面のごく近くにあるため画面端に近いほど歪みが急激に大きくなる。
    // 対角2点のみでは矩形内の緯度経度の真の範囲を捉えられず、選択したはずの
    // 火山が検出されない/範囲外の火山が誤って含まれる原因になっていたため、
    // 辺上の複数点から真の範囲を求めるようにした。
    var minX = Math.min(bx0, ex), maxX = Math.max(bx0, ex);
    var minY = Math.min(by0, ey), maxY = Math.max(by0, ey);
    var EDGE_STEPS = 8;
    var latMin = Infinity, latMax = -Infinity, lons = [];
    for (var si = 0; si <= EDGE_STEPS; si++) {
      var fx = minX + (maxX - minX) * si / EDGE_STEPS;
      var fy = minY + (maxY - minY) * si / EDGE_STEPS;
      [[fx, minY], [fx, maxY], [minX, fy], [maxX, fy]].forEach(function(p) {
        var c = screenToLatLon(p[0], p[1], rect);
        if (!c) return;
        if (c.lat < latMin) latMin = c.lat;
        if (c.lat > latMax) latMax = c.lat;
        lons.push(c.lon);
      });
    }
    var lonRange = computeLonRange(lons);
    if (latMin <= latMax && lonRange) {
      lastBoxBounds = { latMin: latMin, latMax: latMax, lonMin: lonRange.lonMin, lonMax: lonRange.lonMax, lonCross: lonRange.lonCross };
    }
    var fraction = Math.min(bw / rect.width, bh / rect.height);
    var newZoom = Math.max(1.2, zoom * fraction);
    stopAreaTour();
    if (areaMenuEl) areaMenuEl.style.display = 'none';
    flyToLatLon(lat, lon, 800, function() {
      zoomTarget = newZoom;
      if (lastBoxBounds) showAreaMenu();
    });
  }

  canvas.addEventListener('mousedown', function(e) {
    if (volTtDragging) return;
    if (boxZoomMode) { boxDragging=true; bx0=e.clientX; by0=e.clientY; bxCur=e.clientX; byCur=e.clientY; return; }
    drag=true; lx=e.clientX; ly=e.clientY; momentumY=0; momentumX=0; velY=0; velX=0;
  });
  window.addEventListener('mouseup', function(e) {
    if (boxDragging) { boxDragging=false; applyBoxZoom(e.clientX, e.clientY); return; }
    if(!drag)return; drag=false; applyMomentum(velY, velX); velY=0; velX=0;
  });
  window.addEventListener('mousemove', function(e) {
    if (volTtDragging) return;
    if (boxDragging) { bxCur=e.clientX; byCur=e.clientY; updateBoxOverlay(); return; }
    if(!drag)return;
    var dragSens=computeDragSens(zoom);
    var dy=(e.clientX-lx)*dragSens, dx=(e.clientY-ly)*dragSens;
    rotYv+=dy; velY=velY*0.4+dy*0.6;
    if(!axisLocked){rotXv=clampElev(rotXv+dx); velX=velX*0.4+dx*0.6;}
    lx=e.clientX; ly=e.clientY;
  });
  canvas.addEventListener('wheel', function(e) {
    e.preventDefault();
    // 拡大時は1スクロールあたりの移動幅を抑え、最大ズーム付近でも微調整しやすくする。
    var wheelSens=0.006*Math.min(1,zoomTarget/3.2);
    zoomTarget=Math.max(1.2,Math.min(20,zoomTarget+e.deltaY*wheelSens));
  }, {passive:false});
  canvas.addEventListener('dblclick', function() {
    autoRot=!autoRot;
    btnAutoRot.textContent=autoRot?'⏸ 自転停止':'▶ 回転';
    if(autoRot){btnAutoRot.classList.remove('active');}else{btnAutoRot.classList.add('active');}
  });
  canvas.addEventListener('touchstart', function(e) {
    e.preventDefault(); touchMoved=false; momentumY=0; momentumX=0; velY=0; velX=0;
    if(e.touches.length===1){
      if (boxZoomMode) { boxDragging=true; bx0=e.touches[0].clientX; by0=e.touches[0].clientY; bxCur=bx0; byCur=by0; return; }
      drag=true;lx=e.touches[0].clientX;ly=e.touches[0].clientY;
    }
    if(e.touches.length===2){pinch0=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);}
  }, {passive:false});
  canvas.addEventListener('touchmove', function(e) {
    e.preventDefault(); touchMoved=true;
    if(e.touches.length===1&&boxDragging){ bxCur=e.touches[0].clientX; byCur=e.touches[0].clientY; updateBoxOverlay(); return; }
    if(e.touches.length===1&&drag){
      var dragSens=computeDragSens(zoom);
      var dy=(e.touches[0].clientX-lx)*dragSens, dx=(e.touches[0].clientY-ly)*dragSens;
      rotYv+=dy; velY=velY*0.4+dy*0.6;
      if(!axisLocked){rotXv=clampElev(rotXv+dx); velX=velX*0.4+dx*0.6;}
      lx=e.touches[0].clientX;ly=e.touches[0].clientY;
    }
    if(e.touches.length===2){
      var d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
      zoomTarget=Math.max(1.2,Math.min(20,zoomTarget-(d-pinch0)*0.008));pinch0=d;
    }
  }, {passive:false});
  canvas.addEventListener('touchend', function(e) {
    if (boxDragging && e.changedTouches.length===1) {
      boxDragging=false;
      applyBoxZoom(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      return;
    }
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

    zoom += (zoomTarget - zoom) * Math.min(1, dt * 0.016);

    if (flyTarget && flyFrom) {
      var fp = Math.min((ts - flyStart) / flyDur, 1);
      var fe = fp * fp * (3 - 2 * fp);
      rotYv = flyFrom.ry + (flyTarget.ry - flyFrom.ry) * fe;
      rotXv = flyFrom.rx + (flyTarget.rx - flyFrom.rx) * fe;
      if (fp >= 1) { flyTarget = null; flyFrom = null; if (flyCallback) { var _cb = flyCallback; flyCallback = null; _cb(); } }
    } else {
      if (autoRot) rotYv += 0.003 * rotSpd;
      var wasSpinning = Math.abs(momentumY) > 0.0002 || Math.abs(momentumX) > 0.0002;
      if (Math.abs(momentumY) > 0.0002) { rotYv += momentumY; momentumY *= MOMENTUM_DECAY; } else momentumY = 0;
      if (!axisLocked && Math.abs(momentumX) > 0.0002) { rotXv = clampElev(rotXv + momentumX); momentumX *= MOMENTUM_DECAY; } else momentumX = 0;
      if (axisLocked) rotXv = 0;
      var nowSpinning = Math.abs(momentumY) > 0.0002 || Math.abs(momentumX) > 0.0002;
      if (wasSpinning && !nowSpinning && !autoRot && showVolcanoes) {
        var bvBestIdx = -1, bvBestMz = -1;
        for (var bvi = 0; bvi < VOLCANOES.length; bvi++) {
          var bvp = VOLCANOES[bvi]._p;
          var bvmz = model[2]*bvp[0] + model[6]*bvp[1] + model[10]*bvp[2];
          if (bvmz > 0.05 && bvmz > bvBestMz) { bvBestMz = bvmz; bvBestIdx = bvi; }
        }
        if (bvBestIdx >= 0) {
          var bv = VOLCANOES[bvBestIdx];
          var bvEl = volDivMap[bv.id];
          if (bvEl && bvEl.style.display !== 'none') {
            var bvr = bvEl.getBoundingClientRect();
            showVolTooltip(bvr.left + bvr.width / 2, bvr.top + bvr.height / 2, bv);
          }
        }
      }
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

    if (window._aptRenderFrame) window._aptRenderFrame(mvp, model, W, H);

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

    if (showFaultDots) {
      FAULTS.forEach(function(f) {
        var el = faultDotDivMap[f.id];
        if (!el) return;
        if (activeFilter !== 'all' && f.t !== activeFilter) { el.style.display = 'none'; return; }
        var cp = f._cp;
        var mz = model[2]*cp[0] + model[6]*cp[1] + model[10]*cp[2];
        if (mz < 0.05) { el.style.display = 'none'; return; }
        var mcx = mvp[0]*cp[0] + mvp[4]*cp[1] + mvp[8]*cp[2] + mvp[12];
        var mcy = mvp[1]*cp[0] + mvp[5]*cp[1] + mvp[9]*cp[2] + mvp[13];
        var mcw = mvp[3]*cp[0] + mvp[7]*cp[1] + mvp[11]*cp[2] + mvp[15];
        if (mcw <= 0) { el.style.display = 'none'; return; }
        var sx = (mcx/mcw + 1) * W / 2;
        var sy = (-mcy/mcw + 1) * H / 2;
        el.style.display = 'block';
        el.style.left = sx + 'px';
        el.style.top = sy + 'px';
        el.style.opacity = Math.min(1, (mz - 0.05) * 10).toFixed(2);
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

    if (autoRot && showVolcanoes && !isHoveringVol && !drag && !volTtPinned) {
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
            '<div class="vol-tt-name">' + getVolFlag(acv.c) + ' 🌋 ' + acv.n + '</div>' +
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
    } else if (!autoRot && !isHoveringVol && autoVolId !== null && !volTtPinned) {
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
