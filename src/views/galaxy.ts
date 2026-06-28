export function getGalaxyPage(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#000005">
<title>🌌 銀河</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { background:#000005; color:#e6edf3; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:13px; height:100vh; height:100dvh; display:flex; flex-direction:column; overflow:hidden; }
.topbar { background:rgba(0,0,10,0.9); border-bottom:1px solid #1a1f3a; padding:8px 18px; display:flex; align-items:center; gap:12px; flex-shrink:0; z-index:10; position:relative; }
h1 { font-size:15px; font-weight:700; flex:1; letter-spacing:0.5px; }
.canvas-wrap { position:relative; flex:1; min-height:0; overflow:hidden; }
canvas { display:block; width:100%; height:100%; cursor:grab; touch-action:none; }
canvas:active { cursor:grabbing; }
.ctrl-bar { background:rgba(0,0,10,0.9); border-top:1px solid #1a1f3a; padding:8px 18px; display:flex; align-items:center; gap:16px; flex-shrink:0; flex-wrap:wrap; }
.ctrl-group { display:flex; align-items:center; gap:8px; }
.ctrl-label { font-size:11px; color:#8b949e; white-space:nowrap; }
input[type=range] { accent-color:#a78bfa; width:100px; }
.sval { font-family:monospace; font-size:11px; color:#a78bfa; min-width:36px; }
.btn { background:rgba(20,15,40,0.8); border:1px solid #30363d; border-radius:6px; color:#e6edf3; font-size:11px; padding:5px 12px; cursor:pointer; transition:background .15s,border-color .15s,color .15s; }
.btn:hover { background:rgba(30,20,60,1); border-color:#a78bfa; }
.btn.active { background:#1a0f3a; border-color:#a78bfa; color:#a78bfa; }
.hud { position:absolute; bottom:10px; right:10px; background:rgba(0,0,10,0.7); border:1px solid #1a1f3a; border-radius:6px; padding:6px 10px; font-size:10px; font-family:monospace; color:#6e7681; pointer-events:none; line-height:1.8; }
</style>
</head>
<body>
<div class="topbar">
  <h1>🌌 銀河パーティクル</h1>
  <a href="/" style="color:#58a6ff;text-decoration:none;font-size:12px;">ホーム</a>
</div>
<div class="canvas-wrap">
  <canvas id="c"></canvas>
  <div class="hud" id="hud">粒子: — | FPS: —</div>
</div>
<div class="ctrl-bar">
  <div class="ctrl-group">
    <span class="ctrl-label">腕の数</span>
    <input type="range" id="armsRange" min="2" max="8" step="1" value="4">
    <span class="sval" id="armsVal">4</span>
  </div>
  <div class="ctrl-group">
    <span class="ctrl-label">粒子数</span>
    <input type="range" id="countRange" min="5000" max="80000" step="5000" value="30000">
    <span class="sval" id="countVal">30000</span>
  </div>
  <div class="ctrl-group">
    <span class="ctrl-label">広がり</span>
    <input type="range" id="spreadRange" min="0.1" max="2" step="0.05" value="0.6">
    <span class="sval" id="spreadVal">0.60</span>
  </div>
  <div class="ctrl-group">
    <span class="ctrl-label">回転速度</span>
    <input type="range" id="spinRange" min="0" max="3" step="0.05" value="0.5">
    <span class="sval" id="spinVal">0.50</span>
  </div>
  <button class="btn active" id="btnRotate">自動回転</button>
  <button class="btn active" id="btnColors">カラー</button>
  <button class="btn" id="btnRegen">再生成</button>
</div>
<script type="importmap">
{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/"}}
</script>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const canvas = document.getElementById('c');
const hud = document.getElementById('hud');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000005);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
camera.position.set(0, 4, 8);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 1;
controls.maxDistance = 30;

let geometry = null;
let points = null;

function buildGalaxy() {
  const arms = parseInt(document.getElementById('armsRange').value);
  const count = parseInt(document.getElementById('countRange').value);
  const spread = parseFloat(document.getElementById('spreadRange').value);
  const spinFactor = parseFloat(document.getElementById('spinRange').value);
  const useColors = document.getElementById('btnColors').classList.contains('active');

  if (points) {
    scene.remove(points);
    geometry.dispose();
    points.material.dispose();
  }

  geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  const innerColor = new THREE.Color('#ffd6a0');
  const outerColor = new THREE.Color('#5a8aff');
  const armColors = [
    new THREE.Color('#ff6b9d'),
    new THREE.Color('#a78bfa'),
    new THREE.Color('#34d399'),
    new THREE.Color('#60a5fa'),
    new THREE.Color('#f59e0b'),
    new THREE.Color('#f87171'),
    new THREE.Color('#38bdf8'),
    new THREE.Color('#c084fc'),
  ];

  for (let i = 0; i < count; i++) {
    const r = Math.pow(Math.random(), 1.5) * 5;
    const armIdx = i % arms;
    const armAngle = (armIdx / arms) * Math.PI * 2;
    const spin = r * spinFactor;
    const branchAngle = armAngle + spin;
    const rand = () => (Math.random() - 0.5) * spread * (1 - r / 6);
    const rx = rand() * (1 + r * 0.1);
    const ry = rand() * 0.3;
    const rz = rand() * (1 + r * 0.1);

    positions[i * 3]     = Math.cos(branchAngle) * r + rx;
    positions[i * 3 + 1] = ry;
    positions[i * 3 + 2] = Math.sin(branchAngle) * r + rz;

    if (useColors) {
      const mixColor = armColors[armIdx % armColors.length].clone();
      const blended = innerColor.clone().lerp(mixColor, r / 5).lerp(outerColor, r / 7);
      colors[i * 3]     = blended.r;
      colors[i * 3 + 1] = blended.g;
      colors[i * 3 + 2] = blended.b;
    } else {
      const t = r / 5;
      const c = innerColor.clone().lerp(outerColor, t);
      colors[i * 3]     = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.025,
    sizeAttenuation: true,
    vertexColors: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  points = new THREE.Points(geometry, material);
  scene.add(points);
  hud.textContent = '粒子: ' + count.toLocaleString() + ' | FPS: —';
}

buildGalaxy();

let autoRotate = true;
let lastTime = performance.now();
let frameCount = 0;
let fps = 0;

function resize() {
  const w = canvas.parentElement.clientWidth;
  const h = canvas.parentElement.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener('resize', resize);

function animate(now) {
  requestAnimationFrame(animate);
  frameCount++;
  const dt = now - lastTime;
  if (dt >= 1000) {
    fps = Math.round(frameCount * 1000 / dt);
    frameCount = 0;
    lastTime = now;
    const count = parseInt(document.getElementById('countRange').value);
    hud.textContent = '粒子: ' + count.toLocaleString() + ' | FPS: ' + fps;
  }
  if (autoRotate && points) {
    points.rotation.y += 0.0005;
  }
  controls.update();
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

document.getElementById('btnRotate').addEventListener('click', function() {
  autoRotate = !autoRotate;
  this.classList.toggle('active', autoRotate);
});

document.getElementById('btnColors').addEventListener('click', function() {
  this.classList.toggle('active');
  buildGalaxy();
});

document.getElementById('btnRegen').addEventListener('click', buildGalaxy);

['armsRange','countRange','spreadRange','spinRange'].forEach(function(id) {
  const el = document.getElementById(id);
  const valId = id.replace('Range', 'Val');
  const valEl = document.getElementById(valId);
  el.addEventListener('input', function() {
    const v = parseFloat(this.value);
    if (id === 'armsRange' || id === 'countRange') {
      valEl.textContent = Math.round(v).toString();
    } else {
      valEl.textContent = v.toFixed(2);
    }
    buildGalaxy();
  });
});
</script>
</body>
</html>`;
}
