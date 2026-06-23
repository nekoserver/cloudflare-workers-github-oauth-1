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

<script type="module">
import anime from 'https://cdn.jsdelivr.net/npm/animejs@4.0.2/+esm';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

// キャラクターセット: カタカナ + 数字 + アルファベット
const CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%&*';

const PALETTES = [
  { head: '#ffffff', body: '#00ff41', dim: '#003b10' },  // 緑 (classic)
  { head: '#ffffff', body: '#00cfff', dim: '#00314a' },  // 青
  { head: '#ffffff', body: '#ff4488', dim: '#3a0020' },  // ピンク
  { head: '#ffffff', body: '#ffaa00', dim: '#3a2500' },  // オレンジ
  { head: '#ffffff', body: '#cc44ff', dim: '#2a0040' },  // 紫
];
let paletteIdx = 0;

const FONT_SIZE = 16;
let cols, drops, colChars, speeds;
let intervalId = null;
let speedFactor = 1.0;

function init() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  cols = Math.floor(canvas.width / FONT_SIZE);
  drops = new Array(cols).fill(0).map(() => Math.random() * -50);
  colChars = new Array(cols).fill('').map(() => randomChar());
  speeds = new Array(cols).fill(0).map(() => 0.3 + Math.random() * 0.7);
}

function randomChar() {
  return CHARS[Math.floor(Math.random() * CHARS.length)];
}

function draw() {
  const pal = PALETTES[paletteIdx];

  // フェードトレイル
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = FONT_SIZE + 'px monospace';

  for (let i = 0; i < cols; i++) {
    const y = Math.floor(drops[i]) * FONT_SIZE;

    // 先頭文字 (白く光る)
    ctx.fillStyle = pal.head;
    ctx.shadowBlur = 8;
    ctx.shadowColor = pal.body;
    ctx.fillText(colChars[i], i * FONT_SIZE, y);

    // 直前の文字は本体色
    ctx.fillStyle = pal.body;
    ctx.shadowBlur = 4;
    ctx.shadowColor = pal.body;
    if (y - FONT_SIZE > 0) {
      ctx.fillText(randomChar(), i * FONT_SIZE, y - FONT_SIZE);
    }

    ctx.shadowBlur = 0;

    drops[i] += speeds[i] * speedFactor;
    colChars[i] = randomChar();

    // 画面下に達したらランダムにリセット
    if (drops[i] * FONT_SIZE > canvas.height && Math.random() > 0.975) {
      drops[i] = 0;
    }
  }
}

// anime.js でフレームループを駆動
let anim;
function startAnim() {
  if (anim) anim.pause();
  const ticker = { t: 0 };
  anim = anime.animate(ticker, {
    t: 1e9,
    duration: 1e9,
    easing: 'linear',
    onUpdate: draw,
  });
}

init();
startAnim();
window.addEventListener('resize', () => { init(); });

// ─── 速度変更 (anime.js でスムーズに補間) ─────────────────────────
const speedProxy = { v: 1.0 };

function setSpeed(target) {
  anime.animate(speedProxy, {
    v: Math.max(0.2, Math.min(4.0, target)),
    duration: 600,
    easing: 'easeOutCubic',
    onUpdate: () => { speedFactor = speedProxy.v; },
  });
}

document.getElementById('btn-speed-down').addEventListener('click', () => setSpeed(speedProxy.v - 0.4));
document.getElementById('btn-speed-up').addEventListener('click',   () => setSpeed(speedProxy.v + 0.4));

// ─── 色変更: anime.js でキャンバスをフラッシュ ──────────────────────
document.getElementById('btn-color').addEventListener('click', () => {
  paletteIdx = (paletteIdx + 1) % PALETTES.length;

  // 白フラッシュ演出
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:5;pointer-events:none;opacity:0;';
  document.body.appendChild(overlay);
  anime.animate(overlay, {
    opacity: [0, 0.3, 0],
    duration: 400,
    easing: 'easeOutQuad',
    onComplete: () => overlay.remove(),
  });

  // 全列をリセット
  drops = drops.map(() => Math.random() * -30);
});
</script>
</body>
</html>`;
}
