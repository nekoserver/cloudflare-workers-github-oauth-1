import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

/** ショウジョウバエの簡略 connectome を可視化するインタラクティブデモ */
export function getFlyBrainPage(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>🪰 ハエの脳</title>
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
.topbar h1 { font-size: 14px; font-weight: 700; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.main { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 240px; }
@media (max-width: 720px) { .main { grid-template-columns: 1fr; grid-template-rows: 1fr auto; } }
.arena-wrap { position: relative; min-height: 0; }
canvas { display: block; width: 100%; height: 100%; cursor: crosshair; touch-action: none; }
.side {
  background: var(--card-bg);
  border-left: 1px solid var(--border-color);
  padding: 12px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
@media (max-width: 720px) {
  .side { border-left: none; border-top: 1px solid var(--border-color); max-height: 220px; }
}
.panel {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 10px;
}
.panel h2 { font-size: 11px; color: var(--text-muted); margin-bottom: 8px; letter-spacing: 0.06em; }
.btn-row { display: flex; gap: 6px; flex-wrap: wrap; }
.btn {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 11px;
  padding: 6px 10px;
  cursor: pointer;
}
.btn:hover { border-color: var(--accent-color); }
.btn.active { border-color: var(--accent-color); color: var(--accent-color); background: var(--bg-secondary); }
.stat { font-family: ui-monospace, monospace; font-size: 11px; line-height: 1.7; color: var(--text-secondary); }
.neuron-graph { width: 100%; height: 140px; }
.hint { font-size: 10px; color: var(--text-muted); line-height: 1.6; }
.legend { display: flex; gap: 10px; flex-wrap: wrap; font-size: 10px; color: var(--text-muted); }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
</style>
</head>
<body>
<div class="topbar">
  <h1>🪰 ハエの脳 — ミニ connectome</h1>
  ${getThemeToggleHTML()}
</div>
<div class="main">
  <div class="arena-wrap">
    <canvas id="arena" aria-label="ハエの行動アリーナ"></canvas>
  </div>
  <aside class="side">
    <div class="panel">
      <h2>刺激を置く</h2>
      <div class="btn-row">
        <button class="btn active" id="tool-food" type="button">🍎 餌（匂い）</button>
        <button class="btn" id="tool-light" type="button">💡 光</button>
        <button class="btn" id="tool-clear" type="button">クリア</button>
      </div>
      <p class="hint" style="margin-top:8px">アリーナをクリックして刺激を配置。餌に近づき、光から離れる。</p>
    </div>
    <div class="panel">
      <h2>ニューロン活動</h2>
      <svg class="neuron-graph" id="graph" viewBox="0 0 220 140" aria-hidden="true"></svg>
      <div class="legend">
        <span><span class="dot" style="background:#48bb78"></span>触角（匂い）</span>
        <span><span class="dot" style="background:#ecc94b"></span>複眼（光）</span>
        <span><span class="dot" style="background:#667eea"></span>運動</span>
      </div>
    </div>
    <div class="panel">
      <h2>状態</h2>
      <div class="stat" id="stats">—</div>
    </div>
  </aside>
</div>
${getThemeToggleScript()}
<script>
(function() {
  var canvas = document.getElementById('arena');
  var ctx = canvas.getContext('2d');
  var graph = document.getElementById('graph');
  var statsEl = document.getElementById('stats');
  var tool = 'food';
  var stimuli = [];
  var fly = { x: 200, y: 200, angle: 0, speed: 0 };
  var neurons = null;
  var last = performance.now();

  document.getElementById('tool-food').onclick = function() {
    tool = 'food';
    document.getElementById('tool-food').classList.add('active');
    document.getElementById('tool-light').classList.remove('active');
  };
  document.getElementById('tool-light').onclick = function() {
    tool = 'light';
    document.getElementById('tool-light').classList.add('active');
    document.getElementById('tool-food').classList.remove('active');
  };
  document.getElementById('tool-clear').onclick = function() { stimuli = []; };

  function resize() {
    var rect = canvas.parentElement.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (fly.x > rect.width - 16) fly.x = rect.width / 2;
    if (fly.y > rect.height - 16) fly.y = rect.height / 2;
  }
  window.addEventListener('resize', resize);
  resize();

  function placeStim(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    stimuli.push({
      kind: tool,
      x: clientX - rect.left,
      y: clientY - rect.top,
      intensity: 1
    });
  }
  canvas.addEventListener('click', function(e) { placeStim(e.clientX, e.clientY); });
  canvas.addEventListener('touchstart', function(e) {
    if (e.touches.length === 1) {
      e.preventDefault();
      placeStim(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function sigmoid(v) { return 1 / (1 + Math.exp(-v)); }

  function antennaPos(side) {
    var perp = fly.angle + (Math.PI / 2) * side;
    return {
      x: fly.x + Math.cos(fly.angle) * 8 + Math.cos(perp) * 3.5,
      y: fly.y + Math.sin(fly.angle) * 8 + Math.sin(perp) * 3.5
    };
  }
  function eyePos(side) {
    var perp = fly.angle + (Math.PI / 2) * side;
    return {
      x: fly.x + Math.cos(fly.angle) * 4 + Math.cos(perp) * 6,
      y: fly.y + Math.sin(fly.angle) * 4 + Math.sin(perp) * 6
    };
  }
  function field(pos, kind) {
    var total = 0;
    for (var i = 0; i < stimuli.length; i++) {
      var s = stimuli[i];
      if (s.kind !== kind) continue;
      var dx = s.x - pos.x;
      var dy = s.y - pos.y;
      var dist = Math.hypot(dx, dy);
      total += s.intensity * Math.exp(-dist / 220);
    }
    return clamp01(total);
  }

  function stepBrain() {
    var la = antennaPos(-1), ra = antennaPos(1), le = eyePos(-1), re = eyePos(1);
    var sensory = [
      field(la, 'food'),
      field(ra, 'food'),
      field(le, 'light'),
      field(re, 'light')
    ];
    var h = [
      sigmoid(sensory[0] * 2.2 - sensory[1] * 0.4 + 0.1),
      sigmoid(sensory[1] * 2.2 - sensory[0] * 0.4 + 0.1),
      sigmoid(sensory[2] * 2.5 - sensory[3] * 0.3),
      sigmoid(sensory[3] * 2.5 - sensory[2] * 0.3),
      sigmoid((sensory[0] + sensory[1]) * 1.4 - (sensory[2] + sensory[3]) * 1.1),
      sigmoid((sensory[2] + sensory[3]) * 1.2 - (sensory[0] + sensory[1]) * 0.6 + 0.2)
    ];
    var rawTurn = (h[0] - h[1]) * 1.4 + (h[2] - h[3]) * -1.2 + (h[5] - h[4]) * 0.3;
    var rawThrust = h[4] * 1.3 - h[5] * 0.9 + 0.15;
    var motor = {
      turn: Math.max(-1, Math.min(1, rawTurn)),
      thrust: clamp01(rawThrust)
    };
    neurons = { sensory: sensory, h: h, motor: motor };
    return motor;
  }

  function integrate(motor, dt) {
    fly.angle += motor.turn * 3.2 * dt;
    fly.speed = 20 + motor.thrust * 90;
    fly.x += Math.cos(fly.angle) * fly.speed * dt;
    fly.y += Math.sin(fly.angle) * fly.speed * dt;
    var w = canvas.clientWidth, h = canvas.clientHeight, m = 16;
    if (fly.x < m) { fly.x = m; fly.angle = Math.PI - fly.angle; }
    else if (fly.x > w - m) { fly.x = w - m; fly.angle = Math.PI - fly.angle; }
    if (fly.y < m) { fly.y = m; fly.angle = -fly.angle; }
    else if (fly.y > h - m) { fly.y = h - m; fly.angle = -fly.angle; }
  }

  function css(name, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }

  function drawArena() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.fillStyle = css('--bg-secondary', '#f7fafc');
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = css('--border-color', '#e2e8f0');
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    for (var i = 0; i < stimuli.length; i++) {
      var s = stimuli[i];
      var grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 80);
      if (s.kind === 'food') {
        grad.addColorStop(0, 'rgba(72,187,120,0.35)');
        grad.addColorStop(1, 'rgba(72,187,120,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 80, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#48bb78';
      } else {
        grad.addColorStop(0, 'rgba(236,201,75,0.4)');
        grad.addColorStop(1, 'rgba(236,201,75,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 90, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ecc94b';
      }
      ctx.beginPath();
      ctx.arc(s.x, s.y, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(fly.x, fly.y);
    ctx.rotate(fly.angle);
    ctx.fillStyle = css('--text-primary', '#1a202c');
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(5, -3, 2.2, 0, Math.PI * 2);
    ctx.arc(5, 3, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = css('--text-muted', '#718096');
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-4, -8);
    ctx.lineTo(-14, -12);
    ctx.moveTo(-4, 8);
    ctx.lineTo(-14, 12);
    ctx.stroke();
    ctx.restore();
  }

  function drawGraph() {
    if (!neurons) return;
    var s = neurons.sensory, h = neurons.h, m = neurons.motor;
    var nodes = [
      { x: 18, y: 22, v: s[0], c: '#48bb78', l: 'AL-L' },
      { x: 18, y: 48, v: s[1], c: '#48bb78', l: 'AL-R' },
      { x: 18, y: 74, v: s[2], c: '#ecc94b', l: 'OL-L' },
      { x: 18, y: 100, v: s[3], c: '#ecc94b', l: 'OL-R' },
      { x: 110, y: 35, v: h[0], c: '#805ad5', l: 'MB' },
      { x: 110, y: 70, v: h[4], c: '#805ad5', l: 'CC' },
      { x: 110, y: 105, v: h[5], c: '#805ad5', l: 'LN' },
      { x: 200, y: 55, v: m.thrust, c: '#667eea', l: 'MOT' },
      { x: 200, y: 95, v: (m.turn + 1) / 2, c: '#667eea', l: 'TURN' }
    ];
    var edges = [[0,4],[1,4],[2,6],[3,6],[0,5],[1,5],[4,7],[5,7],[6,8],[4,8]];
    var html = '';
    for (var ei = 0; ei < edges.length; ei++) {
      var a = nodes[edges[ei][0]], b = nodes[edges[ei][1]];
      var alpha = 0.15 + ((a.v + b.v) / 2) * 0.55;
      html += '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '" stroke="#667eea" stroke-opacity="' + alpha.toFixed(2) + '" stroke-width="1.5"/>';
    }
    for (var ni = 0; ni < nodes.length; ni++) {
      var n = nodes[ni];
      var r = 6 + n.v * 8;
      html += '<circle cx="' + n.x + '" cy="' + n.y + '" r="' + r.toFixed(1) + '" fill="' + n.c + '" fill-opacity="' + (0.35 + n.v * 0.65).toFixed(2) + '" stroke="' + n.c + '" stroke-width="1"/>';
      html += '<text x="' + n.x + '" y="' + (n.y + 22) + '" text-anchor="middle" font-size="7" fill="currentColor" opacity="0.7">' + n.l + '</text>';
    }
    graph.innerHTML = html;
    statsEl.textContent =
      'turn ' + m.turn.toFixed(2) + '  thrust ' + m.thrust.toFixed(2) + '\\n' +
      'pos (' + fly.x.toFixed(0) + ', ' + fly.y.toFixed(0) + ')  spd ' + fly.speed.toFixed(0);
  }

  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    var motor = stepBrain();
    integrate(motor, dt);
    drawArena();
    drawGraph();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
</script>
</body>
</html>`;
}
