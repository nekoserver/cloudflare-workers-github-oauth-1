import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

/** 2026年にバイラルした Brush Jjaemu 系 — 猫の背中をブラシする反射ゲーム */
export function getBrushJjaemuPage(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>🐱 ブラシッ！猫</title>
${getThemeInitScript()}
<style>
${getThemeCSS()}
${getThemeToggleCSS()}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
}
.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  height: 44px;
  min-height: 44px;
  max-height: 44px;
  background: var(--navbar-bg);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  flex-shrink: 0;
}
.topbar h1 { font-size: 14px; font-weight: 700; flex: 1; }
.scorebar {
  display: flex;
  gap: 14px;
  font-family: ui-monospace, monospace;
  font-size: 12px;
  color: var(--text-secondary);
}
.scorebar b { color: var(--accent-color); font-size: 15px; }
.stage-wrap { flex: 1; min-height: 0; position: relative; }
canvas { display: block; width: 100%; height: 100%; touch-action: none; cursor: grab; }
canvas.brushing { cursor: none; }
.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: var(--modal-overlay);
  z-index: 5;
  padding: 20px;
  text-align: center;
}
.overlay.hidden { display: none; }
.overlay h2 { font-size: 22px; color: var(--text-primary); }
.overlay p { font-size: 12px; color: var(--text-muted); line-height: 1.7; max-width: 320px; }
.overlay .dead { font-size: 28px; font-weight: 800; color: var(--danger-color); letter-spacing: 0.08em; }
.btn {
  background: var(--accent-color);
  color: #fff;
  border: none;
  border-radius: 999px;
  padding: 10px 22px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.btn:hover { background: var(--accent-hover); }
.hint {
  position: absolute;
  bottom: max(12px, env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%);
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 11px;
  color: var(--text-muted);
  pointer-events: none;
  white-space: nowrap;
}
</style>
</head>
<body>
<div class="topbar">
  <h1>🐱 ブラシッ！猫</h1>
  <div class="scorebar">
    <span>SCORE <b id="score">0</b></span>
    <span>BEST <b id="best">0</b></span>
  </div>
  ${getThemeToggleHTML()}
</div>
<div class="stage-wrap">
  <canvas id="stage" aria-label="猫をブラシするゲーム"></canvas>
  <div class="hint" id="hint">背中をなでる → 振り返ったら離す！</div>
  <div class="overlay" id="overlay-start">
    <h2>ブラシッ！猫</h2>
    <p>2026年にSNSを席巻した反射ゲーム風。<br>猫の背中をブラシ！振り返った瞬間に触ってたらアウト。</p>
    <button class="btn" id="btn-start" type="button">はじめる</button>
  </div>
  <div class="overlay hidden" id="overlay-dead">
    <div class="dead">YOU DIED</div>
    <p id="dead-msg">猫にバレた…</p>
    <button class="btn" id="btn-retry" type="button">もう一度</button>
  </div>
</div>
<script>
${getThemeToggleScript()}
(function() {
  var canvas = document.getElementById('stage');
  var ctx = canvas.getContext('2d');
  var scoreEl = document.getElementById('score');
  var bestEl = document.getElementById('best');
  var overlayStart = document.getElementById('overlay-start');
  var overlayDead = document.getElementById('overlay-dead');
  var deadMsg = document.getElementById('dead-msg');
  var hint = document.getElementById('hint');

  var MIN_TURN = 550, BASE_TURN = 2600, WATCH_MS = 850;
  var highScore = 0;
  try { highScore = parseInt(localStorage.getItem('brush-jjaemu-best') || '0', 10) || 0; } catch (e) {}
  bestEl.textContent = String(highScore);

  var state = {
    score: 0,
    phase: 'idle',
    catFacing: 'away',
    msUntilTurn: BASE_TURN,
    msWatchingLeft: 0
  };

  var brushing = false;
  var brushX = 0, brushY = 0;
  var lastStrokeX = 0, lastStrokeY = 0;
  var last = performance.now();
  var shake = 0;
  var purr = 0;

  function turnInterval(score) {
    return Math.max(MIN_TURN, BASE_TURN - score * 38);
  }

  function startGame() {
    state = {
      score: 0,
      phase: 'playing',
      catFacing: 'away',
      msUntilTurn: turnInterval(0),
      msWatchingLeft: 0
    };
    scoreEl.textContent = '0';
    overlayStart.classList.add('hidden');
    overlayDead.classList.add('hidden');
    hint.textContent = '背中をなでる → 振り返ったら離す！';
  }

  function die() {
    state.phase = 'dead';
    if (state.score > highScore) {
      highScore = state.score;
      try { localStorage.setItem('brush-jjaemu-best', String(highScore)); } catch (e) {}
      bestEl.textContent = String(highScore);
    }
    deadMsg.textContent = 'スコア ' + state.score + ' — 猫にバレた…';
    overlayDead.classList.remove('hidden');
    shake = 18;
  }

  function applyStroke() {
    if (state.phase !== 'playing' || !brushing) return;
    if (state.catFacing === 'watching') {
      die();
      return;
    }
    if (state.catFacing === 'away') {
      var dx = brushX - lastStrokeX;
      var dy = brushY - lastStrokeY;
      if (Math.hypot(dx, dy) < 10) return;
      lastStrokeX = brushX;
      lastStrokeY = brushY;
      state.score += 1;
      scoreEl.textContent = String(state.score);
      purr = 1;
    }
  }

  function tick(dt) {
    if (state.phase !== 'playing') return;
    if (state.catFacing === 'watching') {
      if (brushing) { die(); return; }
      state.msWatchingLeft -= dt;
      if (state.msWatchingLeft <= 0) {
        state.catFacing = 'away';
        state.msUntilTurn = turnInterval(state.score);
        hint.textContent = 'OK！またブラシできる';
      } else {
        hint.textContent = '見てる！！離せ！！';
      }
      return;
    }
    state.msUntilTurn -= dt;
    if (state.msUntilTurn <= 0) {
      state.catFacing = 'watching';
      state.msWatchingLeft = WATCH_MS;
      hint.textContent = '見てる！！離せ！！';
    }
    applyStroke();
  }

  function resize() {
    var rect = canvas.parentElement.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function catCenter() {
    return { x: canvas.clientWidth * 0.5, y: canvas.clientHeight * 0.55 };
  }

  function drawCat(cx, cy, facing) {
    ctx.save();
    ctx.translate(cx, cy);
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      shake *= 0.85;
    }

    ctx.fillStyle = '#f6a623';
    ctx.strokeStyle = '#d48806';
    ctx.lineWidth = 2;

    if (facing === 'away') {
      ctx.beginPath();
      ctx.ellipse(0, 20, 70, 58, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e8941a';
      for (var i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.ellipse(i * 14, 8, 8, 22, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#f6a623';
      ctx.beginPath();
      ctx.moveTo(-18, -42);
      ctx.lineTo(-8, -68);
      ctx.lineTo(2, -42);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(18, -42);
      ctx.lineTo(8, -68);
      ctx.lineTo(-2, -42);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(58, 30);
      ctx.quadraticCurveTo(92, 10, 88, -10);
      ctx.quadraticCurveTo(78, 24, 58, 30);
      ctx.fill();
      ctx.stroke();
      if (purr > 0) {
        ctx.globalAlpha = purr * 0.5;
        ctx.fillStyle = '#fff';
        ctx.font = '16px sans-serif';
        ctx.fillText('♪', -6, -78);
        ctx.globalAlpha = 1;
        purr *= 0.92;
      }
    } else {
      ctx.beginPath();
      ctx.arc(0, 10, 62, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff8ef';
      ctx.beginPath();
      ctx.ellipse(0, 28, 36, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a202c';
      ctx.beginPath();
      ctx.arc(-22, -6, 10, 0, Math.PI * 2);
      ctx.arc(22, -6, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#cf222e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-30, -18);
      ctx.lineTo(-14, -10);
      ctx.moveTo(30, -18);
      ctx.lineTo(14, -10);
      ctx.stroke();
      ctx.fillStyle = '#cf222e';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('！？', 0, -36);
      ctx.beginPath();
      ctx.moveTo(-18, -52);
      ctx.lineTo(-10, -74);
      ctx.lineTo(-2, -50);
      ctx.closePath();
      ctx.fillStyle = '#f6a623';
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(18, -52);
      ctx.lineTo(10, -74);
      ctx.lineTo(2, -50);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBrush(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.4);
    ctx.fillStyle = '#ffb6c1';
    ctx.strokeStyle = '#db7093';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-8, -34, 16, 38, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff0f5';
    for (var b = 0; b < 5; b++) {
      ctx.beginPath();
      ctx.ellipse(-6 + b * 3, -38, 2.5, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function draw() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary').trim() || '#f7fafc';
    ctx.fillRect(0, 0, w, h);
    var rug = ctx.createRadialGradient(w * 0.5, h * 0.65, 20, w * 0.5, h * 0.65, Math.min(w, h) * 0.45);
    rug.addColorStop(0, 'rgba(102,126,234,0.12)');
    rug.addColorStop(1, 'rgba(102,126,234,0)');
    ctx.fillStyle = rug;
    ctx.fillRect(0, 0, w, h);

    var c = catCenter();
    drawCat(c.x, c.y, state.catFacing);

    if (brushing && state.phase === 'playing') {
      drawBrush(brushX, brushY);
    }

    if (state.phase === 'playing' && state.catFacing === 'away') {
      var warn = state.msUntilTurn / turnInterval(state.score);
      if (warn < 0.25) {
        ctx.fillStyle = 'rgba(207,34,46,0.15)';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('そろそろ振り返る…', w * 0.5, 24);
      }
    }
  }

  function frame(now) {
    var dt = Math.min(50, now - last);
    last = now;
    tick(dt);
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function ptrDown(x, y) {
    if (state.phase !== 'playing') return;
    brushing = true;
    canvas.classList.add('brushing');
    brushX = x; brushY = y;
    lastStrokeX = x; lastStrokeY = y;
  }
  function ptrMove(x, y) {
    brushX = x; brushY = y;
  }
  function ptrUp() {
    brushing = false;
    canvas.classList.remove('brushing');
  }

  canvas.addEventListener('mousedown', function(e) { ptrDown(e.offsetX, e.offsetY); });
  canvas.addEventListener('mousemove', function(e) { if (brushing) ptrMove(e.offsetX, e.offsetY); });
  window.addEventListener('mouseup', ptrUp);
  canvas.addEventListener('touchstart', function(e) {
    e.preventDefault();
    var rect = canvas.getBoundingClientRect();
    var t = e.touches[0];
    ptrDown(t.clientX - rect.left, t.clientY - rect.top);
  }, { passive: false });
  canvas.addEventListener('touchmove', function(e) {
    e.preventDefault();
    var rect = canvas.getBoundingClientRect();
    var t = e.touches[0];
    ptrMove(t.clientX - rect.left, t.clientY - rect.top);
  }, { passive: false });
  canvas.addEventListener('touchend', function(e) { e.preventDefault(); ptrUp(); }, { passive: false });

  document.getElementById('btn-start').addEventListener('click', startGame);
  document.getElementById('btn-retry').addEventListener('click', startGame);
})();
</script>
</body>
</html>`;
}
