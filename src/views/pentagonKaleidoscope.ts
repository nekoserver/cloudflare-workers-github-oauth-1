import {
  getThemeCSS,
  getThemeInitScript,
  getThemeToggleHTML,
  getThemeToggleCSS,
  getThemeToggleScript,
} from '../utils/theme';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 五角形（5回対称）カレイドスコープページ（/pentagon-kaleidoscope）。 */
export function getPentagonKaleidoscopePage(username: string): string {
  const safeUser = esc(username);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#06060f">
<title>pentagon-kaleidoscope — 五角形万華鏡</title>
${getThemeInitScript()}
<style>
${getThemeCSS()}
${getThemeToggleCSS()}
:root { --stage-bg: #06060f; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; }
body {
  background: var(--stage-bg);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.nav {
  height: 44px;
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 clamp(14px, 3vw, 24px);
  background: var(--navbar-bg);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}
.nav h1 { font-size: 14px; font-weight: 700; flex: 1; letter-spacing: 0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.badge {
  background: var(--badge-bg);
  color: var(--accent-color);
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
  flex-shrink: 0;
}
.user-tag { font-size: 11px; color: var(--text-muted); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0; }
.stage { position: relative; flex: 1; min-height: 0; background: var(--stage-bg); overflow: hidden; }
canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; cursor: crosshair; touch-action: none; }
.panel {
  position: absolute;
  top: 12px;
  left: 12px;
  background: rgba(6, 6, 15, 0.78);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 200px;
  backdrop-filter: blur(6px);
  color: #e8ecff;
}
.panel .row { display: flex; flex-direction: column; gap: 4px; }
.panel label { font-size: 11px; color: #aab4dd; display: flex; justify-content: space-between; font-family: ui-monospace, monospace; }
.panel input[type="range"] { width: 100%; accent-color: #7aa2ff; }
.panel .btns { display: flex; gap: 8px; }
.panel button {
  flex: 1;
  background: #1b2140;
  border: 1px solid #33407a;
  color: #cdd6ff;
  border-radius: 7px;
  padding: 7px 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.panel button:hover { background: #263063; border-color: #4d5ca8; }
.panel button.active { background: #3550b0; border-color: #6f86e0; color: #fff; }
.hud {
  position: absolute;
  bottom: 12px;
  right: 12px;
  background: rgba(6, 6, 15, 0.72);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 11px;
  font-family: ui-monospace, monospace;
  color: #8fa6ff;
  line-height: 1.7;
  text-align: right;
  pointer-events: none;
}
.hint {
  position: absolute;
  bottom: 12px;
  left: 12px;
  background: rgba(6, 6, 15, 0.72);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 11px;
  color: var(--text-muted);
  max-width: 240px;
  line-height: 1.6;
}
</style>
</head>
<body>
<nav class="nav">
  <h1>pentagon-kaleidoscope</h1>
  <span class="badge">五角形万華鏡</span>
  ${getThemeToggleHTML()}
  <span class="user-tag">${safeUser}</span>
</nav>
<div class="stage">
  <canvas id="kal"></canvas>
  <div class="panel">
    <div class="row">
      <label>対称数 <span id="segVal">5</span></label>
      <input id="segments" type="range" min="3" max="14" step="1" value="5">
    </div>
    <div class="row">
      <label>回転速度 <span id="spdVal">1.0</span></label>
      <input id="speed" type="range" min="0" max="30" step="1" value="10">
    </div>
    <div class="row">
      <label>残像 <span id="trailVal">0.14</span></label>
      <input id="trail" type="range" min="2" max="40" step="1" value="14">
    </div>
    <div class="btns">
      <button id="pauseBtn" type="button">一時停止</button>
      <button id="mirrorBtn" type="button" class="active">鏡映</button>
    </div>
  </div>
  <div class="hud" id="hud">-- fps</div>
  <div class="hint">ドラッグ / タップで色と模様を操作できます。対称数を 5 にすると五角形の万華鏡になります。</div>
</div>
<script>
${getThemeToggleScript()}
(function(){
  var canvas = document.getElementById('kal');
  var ctx = canvas.getContext('2d');
  var stage = canvas.parentElement;
  var dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  var W = 0, H = 0, cx = 0, cy = 0, R = 0;

  function resize(){
    var rect = stage.getBoundingClientRect();
    W = Math.max(1, Math.floor(rect.width));
    H = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W / 2;
    cy = H / 2;
    R = Math.sqrt(cx * cx + cy * cy) * 1.05;
    ctx.fillStyle = '#06060f';
    ctx.fillRect(0, 0, W, H);
  }
  window.addEventListener('resize', resize);

  var segments = 5;
  var speed = 1.0;
  var trailAlpha = 0.14;
  var mirror = true;
  var paused = false;
  var rot = 0;
  var hueBase = 200;
  var spread = 1.0;
  var pointerHue = null;

  var segEl = document.getElementById('segments');
  var spdEl = document.getElementById('speed');
  var trailEl = document.getElementById('trail');
  var segValEl = document.getElementById('segVal');
  var spdValEl = document.getElementById('spdVal');
  var trailValEl = document.getElementById('trailVal');
  var pauseBtn = document.getElementById('pauseBtn');
  var mirrorBtn = document.getElementById('mirrorBtn');
  var hud = document.getElementById('hud');

  segEl.addEventListener('input', function(){
    segments = parseInt(segEl.value, 10);
    segValEl.textContent = String(segments);
  });
  spdEl.addEventListener('input', function(){
    speed = parseInt(spdEl.value, 10) / 10;
    spdValEl.textContent = speed.toFixed(1);
  });
  trailEl.addEventListener('input', function(){
    trailAlpha = parseInt(trailEl.value, 10) / 100;
    trailValEl.textContent = trailAlpha.toFixed(2);
  });
  pauseBtn.addEventListener('click', function(){
    paused = !paused;
    pauseBtn.textContent = paused ? '再生' : '一時停止';
    pauseBtn.classList.toggle('active', paused);
  });
  mirrorBtn.addEventListener('click', function(){
    mirror = !mirror;
    mirrorBtn.classList.toggle('active', mirror);
  });

  function pointerMove(clientX, clientY){
    var rect = canvas.getBoundingClientRect();
    var px = clientX - rect.left - cx;
    var py = clientY - rect.top - cy;
    var ang = Math.atan2(py, px);
    hueBase = ((ang / Math.PI) * 180 + 360) % 360;
    pointerHue = hueBase;
    var dist = Math.sqrt(px * px + py * py) / (R || 1);
    spread = 0.5 + dist * 1.8;
  }
  canvas.addEventListener('pointermove', function(e){
    if (e.buttons === 0 && e.pointerType === 'mouse') return;
    pointerMove(e.clientX, e.clientY);
  });
  canvas.addEventListener('pointerdown', function(e){
    pointerMove(e.clientX, e.clientY);
  });

  function drawSource(t){
    var wedge = Math.PI / segments;
    ctx.globalCompositeOperation = 'lighter';
    var orbCount = 8;
    for (var k = 0; k < orbCount; k++){
      var kk = k + 1;
      var a = wedge * (0.5 + 0.48 * Math.sin(t * 0.00031 * kk + k * 1.3));
      var rad = R * (0.14 + 0.62 * Math.abs(Math.sin(t * 0.00041 * kk + k * 1.7))) * Math.min(1.4, spread);
      var x = Math.cos(a) * rad;
      var y = Math.sin(a) * rad;
      var hue = (t * 0.045 + k * 41 + hueBase) % 360;
      var size = R * (0.05 + 0.07 * (0.5 + 0.5 * Math.sin(t * 0.001 * kk + k)));
      var g = ctx.createRadialGradient(x, y, 0, x, y, size);
      g.addColorStop(0, 'hsla(' + hue.toFixed(0) + ',92%,66%,0.95)');
      g.addColorStop(0.5, 'hsla(' + ((hue + 30) % 360).toFixed(0) + ',90%,58%,0.45)');
      g.addColorStop(1, 'hsla(' + hue.toFixed(0) + ',90%,52%,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    var spokeHue = (t * 0.06 + hueBase + 180) % 360;
    ctx.strokeStyle = 'hsla(' + spokeHue.toFixed(0) + ',85%,60%,0.35)';
    ctx.lineWidth = 1.5;
    for (var s = 0; s < 4; s++){
      var sa = wedge * (0.2 + 0.2 * s) + Math.sin(t * 0.0006 + s) * 0.12;
      ctx.beginPath();
      ctx.moveTo(Math.cos(sa) * R * 0.05, Math.sin(sa) * R * 0.05);
      ctx.lineTo(Math.cos(sa) * R * 0.95, Math.sin(sa) * R * 0.95);
      ctx.stroke();
    }
  }

  function drawFrame(t){
    var wedge = Math.PI / segments;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(6,6,15,' + trailAlpha.toFixed(3) + ')';
    ctx.fillRect(0, 0, W, H);

    var copies = segments * 2;
    for (var i = 0; i < copies; i++){
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot + i * wedge);
      if (mirror && (i % 2 === 1)) ctx.scale(1, -1);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R, -0.02, wedge + 0.02);
      ctx.closePath();
      ctx.clip();
      drawSource(t);
      ctx.restore();
    }
  }

  var last = performance.now();
  var fpsAcc = 0, fpsCount = 0, fpsShown = 0, fpsTimer = 0;
  function loop(now){
    var dt = now - last;
    last = now;
    if (!paused){
      rot += 0.00025 * speed * dt;
      drawFrame(now);
    }
    fpsAcc += dt; fpsCount++; fpsTimer += dt;
    if (fpsTimer >= 500){
      fpsShown = Math.round(1000 / (fpsAcc / fpsCount));
      fpsAcc = 0; fpsCount = 0; fpsTimer = 0;
      hud.textContent = fpsShown + ' fps / 対称 ' + (segments * (mirror ? 2 : 1));
    }
    requestAnimationFrame(loop);
  }

  resize();
  requestAnimationFrame(loop);
})();
</script>
</body>
</html>`;
}
