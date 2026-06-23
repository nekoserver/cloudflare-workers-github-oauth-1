export function getMatrixRainPage(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Matrix Rain</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{background:#000;overflow:hidden;width:100vw;height:100vh;}
canvas{display:block;}
#ui{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);display:flex;gap:10px;z-index:10;}
.btn{padding:8px 18px;border-radius:6px;border:1px solid #00ff41;background:rgba(0,0,0,0.7);color:#00ff41;font-size:12px;font-family:monospace;cursor:pointer;letter-spacing:.1em;transition:background .15s;}
.btn:hover{background:rgba(0,255,65,0.15);}
#info{position:fixed;top:16px;left:50%;transform:translateX(-50%);color:#00ff41;font-family:monospace;font-size:11px;opacity:0.5;letter-spacing:.15em;}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div id="info">MATRIX RAIN &mdash; anime.js powered</div>
<div id="ui">
  <button class="btn" id="btn-speed-down">&#9664; 遅く</button>
  <button class="btn" id="btn-color">色変更</button>
  <button class="btn" id="btn-speed-up">速く &#9654;</button>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js"></script>
<script>
var canvas = document.getElementById('c');
var ctx = canvas.getContext('2d');

var CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%&*';

var PALETTES = [
  { head: '#ffffff', body: '#00ff41' },
  { head: '#ffffff', body: '#00cfff' },
  { head: '#ffffff', body: '#ff4488' },
  { head: '#ffffff', body: '#ffaa00' },
  { head: '#ffffff', body: '#cc44ff' },
];
var paletteIdx = 0;

var FONT_SIZE = 16;
var cols, drops, colChars, speeds;
var speedFactor = 1.0;

function init() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  cols = Math.floor(canvas.width / FONT_SIZE);
  drops = [];
  colChars = [];
  speeds = [];
  for (var i = 0; i < cols; i++) {
    drops.push(Math.random() * -50);
    colChars.push(randomChar());
    speeds.push(0.3 + Math.random() * 0.7);
  }
}

function randomChar() {
  return CHARS[Math.floor(Math.random() * CHARS.length)];
}

function draw() {
  var pal = PALETTES[paletteIdx];
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = FONT_SIZE + 'px monospace';

  for (var i = 0; i < cols; i++) {
    var y = Math.floor(drops[i]) * FONT_SIZE;

    ctx.fillStyle = pal.head;
    ctx.shadowBlur = 8;
    ctx.shadowColor = pal.body;
    ctx.fillText(colChars[i], i * FONT_SIZE, y);

    ctx.fillStyle = pal.body;
    ctx.shadowBlur = 4;
    ctx.shadowColor = pal.body;
    if (y - FONT_SIZE > 0) {
      ctx.fillText(randomChar(), i * FONT_SIZE, y - FONT_SIZE);
    }
    ctx.shadowBlur = 0;

    drops[i] += speeds[i] * speedFactor;
    colChars[i] = randomChar();

    if (drops[i] * FONT_SIZE > canvas.height && Math.random() > 0.975) {
      drops[i] = 0;
    }
  }
}

// anime.js の update コールバックでフレームループを駆動
var ticker = { t: 0 };
var anim = anime({
  targets: ticker,
  t: 1000000,
  duration: 1000000,
  easing: 'linear',
  update: draw,
  loop: true,
});

init();
window.addEventListener('resize', init);

// 速度変更: anime.js でスムーズに補間
var speedProxy = { v: 1.0 };

function setSpeed(target) {
  anime({
    targets: speedProxy,
    v: Math.max(0.2, Math.min(4.0, target)),
    duration: 600,
    easing: 'easeOutCubic',
    update: function() { speedFactor = speedProxy.v; },
  });
}

document.getElementById('btn-speed-down').addEventListener('click', function() {
  setSpeed(speedProxy.v - 0.4);
});
document.getElementById('btn-speed-up').addEventListener('click', function() {
  setSpeed(speedProxy.v + 0.4);
});

// 色変更: anime.js でフラッシュ演出
document.getElementById('btn-color').addEventListener('click', function() {
  paletteIdx = (paletteIdx + 1) % PALETTES.length;

  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:5;pointer-events:none;opacity:0;';
  document.body.appendChild(overlay);
  anime({
    targets: overlay,
    opacity: [0, 0.35, 0],
    duration: 400,
    easing: 'easeOutQuad',
    complete: function() { overlay.remove(); },
  });

  for (var i = 0; i < drops.length; i++) {
    drops[i] = Math.random() * -30;
  }
});
</script>
</body>
</html>`;
}
