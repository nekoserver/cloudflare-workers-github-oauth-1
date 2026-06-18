function escH(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function getWebGLSolarPage(username: string): string {
  const safeUser = escH(username);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#000010">
<title>🪐 太陽系</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { background:#000010; color:#e6edf3; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:13px; height:100vh; height:100dvh; display:flex; flex-direction:column; overflow:hidden; }
.topbar { background:rgba(0,0,20,0.95); border-bottom:1px solid #1e2a40; padding:8px 18px; display:flex; align-items:center; gap:10px; flex-shrink:0; }
.topbar a { color:#58a6ff; text-decoration:none; font-size:12px; }
.topbar a:hover { text-decoration:underline; }
h1 { font-size:15px; font-weight:700; flex:1; }
.canvas-wrap { position:relative; flex:1; min-height:0; overflow:hidden; background:#000010; }
canvas { display:block; width:100%; height:100%; cursor:crosshair; touch-action:none; }
.ctrl-bar { background:rgba(0,0,20,0.95); border-top:1px solid #1e2a40; padding:8px 18px; display:flex; align-items:center; gap:16px; flex-shrink:0; flex-wrap:wrap; }
.ctrl-group { display:flex; align-items:center; gap:8px; }
.ctrl-label { font-size:11px; color:#8b949e; }
input[type=range] { accent-color:#fdb813; width:120px; }
.sval { font-family:monospace; font-size:11px; color:#fdb813; min-width:32px; }
.btn { background:rgba(30,42,64,0.8); border:1px solid #30363d; border-radius:6px; color:#e6edf3; font-size:11px; padding:5px 12px; cursor:pointer; transition:background .15s,border-color .15s,color .15s; }
.btn:hover { background:rgba(30,42,64,1); border-color:#fdb813; }
.btn.active { background:#2a2000; border-color:#fdb813; color:#fdb813; }
#tooltip { position:fixed; background:rgba(5,10,30,0.97); border:1px solid #fdb813; border-radius:8px; padding:8px 14px; font-size:12px; color:#e6edf3; pointer-events:none; opacity:0; transition:opacity .15s; z-index:100; max-width:240px; line-height:1.8; }
#tooltip .tt-name { font-size:14px; font-weight:700; color:#fdb813; }
#tooltip .tt-type { font-size:11px; color:#8b949e; }
#tooltip .tt-fact { font-size:12px; margin-top:4px; color:#c9d1d9; }
</style>
</head>
<body>
<div class="topbar">
  <h1>🪐 太陽系</h1>
  <a href="/">ホーム</a>
  <a href="/webgl">地球儀</a>
  <a href="/webgl-heritage">世界遺産</a>
</div>
<div class="canvas-wrap">
  <canvas id="c"></canvas>
  <div id="tooltip"></div>
</div>
<div class="ctrl-bar">
  <div class="ctrl-group">
    <span class="ctrl-label">速度</span>
    <input type="range" id="speedSlider" min="0.1" max="5" step="0.1" value="1">
    <span class="sval" id="speedVal">1.0x</span>
  </div>
  <button class="btn active" id="btnOrbits">軌道を表示</button>
  <button class="btn active" id="btnLabels">恒星ラベル</button>
  <button class="btn active" id="btnPlanetLabels">惑星ラベル</button>
  <button class="btn" id="btnEarth">🌍 地球目線</button>
</div>

<script>
(function() {
  var canvas = document.getElementById('c');
  var ctx = canvas.getContext('2d');
  var tooltip = document.getElementById('tooltip');
  var speedSlider = document.getElementById('speedSlider');
  var speedVal = document.getElementById('speedVal');
  var btnOrbits = document.getElementById('btnOrbits');
  var btnLabels = document.getElementById('btnLabels');
  var btnPlanetLabels = document.getElementById('btnPlanetLabels');
  var btnEarth = document.getElementById('btnEarth');

  var showOrbits = true;
  var showStarLabels = true;
  var showPlanetLabels = true;
  var speed = 1.0;
  var t = 0;
  var earthViewMode = false;
  var viewAngle = 0;
  var viewElev = 0;
  var FOV_H = Math.PI * 2 / 3;
  var FOV_V = Math.PI * 4 / 9;
  var dragActive = false;
  var dragStartX = 0;
  var dragStartY = 0;
  var dragStartAngle = 0;
  var dragStartElev = 0;

  btnOrbits.addEventListener('click', function() {
    showOrbits = !showOrbits;
    btnOrbits.classList.toggle('active', showOrbits);
  });
  btnLabels.addEventListener('click', function() {
    showStarLabels = !showStarLabels;
    btnLabels.classList.toggle('active', showStarLabels);
  });
  btnPlanetLabels.addEventListener('click', function() {
    showPlanetLabels = !showPlanetLabels;
    btnPlanetLabels.classList.toggle('active', showPlanetLabels);
  });
  speedSlider.addEventListener('input', function() {
    speed = parseFloat(speedSlider.value);
    speedVal.textContent = speed.toFixed(1) + 'x';
  });

  btnEarth.addEventListener('click', function() {
    earthViewMode = !earthViewMode;
    btnEarth.classList.toggle('active', earthViewMode);
    hideTooltip();
  });

  function startDrag(clientX, clientY) {
    if (!earthViewMode) return;
    dragActive = true;
    dragStartX = clientX;
    dragStartY = clientY;
    dragStartAngle = viewAngle;
    dragStartElev = viewElev;
  }
  function moveDrag(clientX, clientY) {
    if (!dragActive) return;
    var dx = clientX - dragStartX;
    var dy = clientY - dragStartY;
    viewAngle = dragStartAngle - dx * (FOV_H / W);
    viewElev = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, dragStartElev + dy * (FOV_V / H)));
  }
  function endDrag(clientX, clientY, isTouch) {
    if (!earthViewMode) { dragActive = false; return; }
    var dx = clientX - dragStartX;
    var dy = clientY - dragStartY;
    if (!dragActive || (Math.abs(dx) < 4 && Math.abs(dy) < 4)) {
      if (!isTouch) {
        var pos = getCanvasPos({ clientX: clientX, clientY: clientY });
        var item = hitTest(pos.x, pos.y);
        if (item) { showTooltip(item, clientX, clientY); activeItem = item; }
        else hideTooltip();
      }
    }
    dragActive = false;
  }

  canvas.addEventListener('mousedown', function(e) { startDrag(e.clientX, e.clientY); });
  canvas.addEventListener('mousemove', function(e) { moveDrag(e.clientX, e.clientY); });
  canvas.addEventListener('mouseup', function(e) { endDrag(e.clientX, e.clientY, false); });
  canvas.addEventListener('mouseleave', function() { dragActive = false; });

  canvas.addEventListener('touchstart', function(e) {
    if (e.touches.length === 1) startDrag(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  canvas.addEventListener('touchmove', function(e) {
    if (e.touches.length === 1) { e.preventDefault(); moveDrag(e.touches[0].clientX, e.touches[0].clientY); }
  }, { passive: false });
  canvas.addEventListener('touchend', function(e) {
    if (e.changedTouches.length > 0) {
      var touch = e.changedTouches[0];
      endDrag(touch.clientX, touch.clientY, true);
    }
  });

  var starLon = [1.76, 1.53, 1.38, 1.22, 4.34, 4.99, 5.15, 5.48, 3.56, 3.09];
  var starLat = [-0.68, -0.28, -0.54, -0.09, -0.09, 1.08, 0.51, 1.05, -0.03, 0.54];

  function projectSky(lon, lat) {
    var dLon = lon - viewAngle;
    while (dLon > Math.PI) dLon -= 2 * Math.PI;
    while (dLon < -Math.PI) dLon += 2 * Math.PI;
    var dLat = lat - viewElev;
    if (Math.abs(dLon) > FOV_H / 2 + 0.15) return null;
    if (Math.abs(dLat) > FOV_V / 2 + 0.15) return null;
    return {
      x: W / 2 + dLon / (FOV_H / 2) * W / 2,
      y: H / 2 - dLat / (FOV_V / 2) * H / 2
    };
  }

  function getEarthPos() {
    var ep = planets[2];
    var ea = ep.angle + t / ep.period;
    return { x: Math.cos(ea) * ep.orbitR, y: Math.sin(ea) * ep.orbitR };
  }

  function drawEarthView() {
    ctx.fillStyle = '#000008';
    ctx.fillRect(0, 0, W, H);

    var ep = getEarthPos();

    for (var si2 = 0; si2 < stars.length; si2++) {
      var st = stars[si2];
      var slon = Math.atan2(st.y, st.x);
      var sPos = projectSky(slon, 0);
      if (!sPos) continue;
      var alpha2 = 1;
      if (st.twinkle) alpha2 = 0.5 + 0.5 * Math.sin(t * 3 + st.phase);
      ctx.beginPath();
      ctx.arc(sPos.x, sPos.y, st.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,' + alpha2.toFixed(2) + ')';
      ctx.fill();
    }

    starScreenPos = [];
    for (var ni2 = 0; ni2 < namedStars.length; ni2++) {
      var ns2 = namedStars[ni2];
      var nPos = projectSky(starLon[ni2], starLat[ni2]);
      if (!nPos) continue;
      ctx.beginPath();
      ctx.arc(nPos.x, nPos.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = ns2.color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(nPos.x, nPos.y, 7, 0, Math.PI * 2);
      ctx.strokeStyle = ns2.color + '55';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (showStarLabels) {
        ctx.font = '11px sans-serif';
        ctx.fillStyle = ns2.color;
        ctx.fillText(ns2.name, nPos.x + 9, nPos.y + 4);
      }
      starScreenPos.push({ x: nPos.x, y: nPos.y, item: ns2 });
    }

    var sunDx = -ep.x, sunDy = -ep.y;
    var sunLon = Math.atan2(sunDy, sunDx);
    var sunPos = projectSky(sunLon, 0);
    if (sunPos) {
      drawGlow(sunPos.x, sunPos.y, 30, '#fdb813');
      var sg2 = ctx.createRadialGradient(sunPos.x - 5, sunPos.y - 5, 3, sunPos.x, sunPos.y, 28);
      sg2.addColorStop(0, '#fff5a0');
      sg2.addColorStop(0.5, '#fdb813');
      sg2.addColorStop(1, '#f57c00');
      ctx.beginPath();
      ctx.arc(sunPos.x, sunPos.y, 28, 0, Math.PI * 2);
      ctx.fillStyle = sg2;
      ctx.fill();
      if (showPlanetLabels) {
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#fdb813';
        ctx.fillText('太陽', sunPos.x + 32, sunPos.y + 4);
      }
      planetScreenPos.push({ x: sunPos.x, y: sunPos.y, item: { name: '太陽', type: '恒星', fact: '太陽系の中心恒星。直径は地球の約109倍、質量は太陽系全体の99.86%を占めます' } });
    }

    for (var pi2 = 0; pi2 < planets.length; pi2++) {
      var pl2 = planets[pi2];
      if (pl2.name === '地球') continue;
      var pa = pl2.angle + t / pl2.period;
      var plx = Math.cos(pa) * pl2.orbitR;
      var ply = Math.sin(pa) * pl2.orbitR;
      var dx2 = plx - ep.x;
      var dy2 = ply - ep.y;
      var dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      var plon = Math.atan2(dy2, dx2);
      var pPos = projectSky(plon, 0);
      if (!pPos) continue;
      var appR = Math.max(4, pl2.radius * 120 / Math.max(dist2, 30));
      if (pl2.hasRings) drawRings(pPos.x, pPos.y, appR);
      drawPlanet(pPos.x, pPos.y, appR, pl2.color);
      if (showPlanetLabels) {
        ctx.font = '11px sans-serif';
        ctx.fillStyle = '#c9d1d9';
        ctx.fillText(pl2.jaName, pPos.x + appR + 4, pPos.y + 4);
      }
      planetScreenPos.push({ x: pPos.x, y: pPos.y, item: pl2 });
    }

    var moonEa = planets[2].angle + t / planets[2].period;
    var mEarthX = Math.cos(moonEa) * planets[2].orbitR;
    var mEarthY = Math.sin(moonEa) * planets[2].orbitR;
    var moonAng2 = moon.angle + t / moon.period;
    var mAbsX = mEarthX + moon.orbitR * Math.cos(moonAng2);
    var mAbsY = mEarthY + moon.orbitR * Math.sin(moonAng2);
    var mDx = mAbsX - ep.x;
    var mDy = mAbsY - ep.y;
    var mLon = Math.atan2(mDy, mDx);
    var mLat = Math.atan2(mDy, Math.sqrt(mDx * mDx + mDy * mDy) * 10);
    var mPos = projectSky(mLon, mLat * 0.05);
    if (mPos) {
      drawPlanet(mPos.x, mPos.y, 14, '#cccccc');
      if (showPlanetLabels) {
        ctx.font = '11px sans-serif';
        ctx.fillStyle = '#aaa';
        ctx.fillText('月', mPos.x + 17, mPos.y + 4);
      }
      planetScreenPos.push({ x: mPos.x, y: mPos.y, item: moon });
    }

    var horizY = H / 2 - (-viewElev) / (FOV_V / 2) * H / 2;
    ctx.beginPath();
    ctx.moveTo(0, horizY);
    ctx.lineTo(W, horizY);
    ctx.strokeStyle = 'rgba(100,180,100,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = 'rgba(0,30,0,0.35)';
    ctx.fillRect(0, horizY, W, H - horizY);

    ctx.font = '11px sans-serif';
    ctx.fillStyle = 'rgba(100,200,100,0.6)';
    ctx.fillText('地平線', 10, horizY - 5);

    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(100,180,255,0.7)';
    ctx.fillText('🌍 地球目線モード  ドラッグで視点回転', 10, 28);
  }

  var planets = [
    { name: '水星', jaName: '水星', type: '岩石惑星', orbitR: 80, radius: 4, period: 0.24, color: '#b5b5b5', angle: 0, fact: '太陽系最小の惑星。表面温度は-180°Cから430°Cと激しく変動します' },
    { name: '金星', jaName: '金星', type: '岩石惑星', orbitR: 120, radius: 8, period: 0.62, color: '#e8cda0', angle: 1.0, fact: '地球から最も明るく見える惑星。厚い大気で温室効果が強烈です' },
    { name: '地球', jaName: '地球', type: '岩石惑星', orbitR: 170, radius: 9, period: 1.0, color: '#4fa3e0', angle: 2.0, fact: '生命が存在する唯一確認されている惑星。表面の71%が海です', hasMoon: true },
    { name: '火星', jaName: '火星', type: '岩石惑星', orbitR: 230, radius: 6, period: 1.88, color: '#c1440e', angle: 3.5, fact: '赤い惑星。太陽系最大の火山「オリンポス山」があります' },
    { name: '木星', jaName: '木星', type: 'ガス惑星', orbitR: 320, radius: 20, period: 11.86, color: '#c88b3a', angle: 0.5, fact: '太陽系最大の惑星。大赤斑という巨大嵐が300年以上続いています' },
    { name: '土星', jaName: '土星', type: 'ガス惑星', orbitR: 420, radius: 16, period: 29.46, color: '#e4d191', angle: 4.0, fact: '美しいリングを持つ惑星。平均密度が水より低く、海に浮かびます', hasRings: true },
    { name: '天王星', jaName: '天王星', type: '氷巨星', orbitR: 510, radius: 11, period: 84.0, color: '#7de8e8', angle: 1.5, fact: '自転軸が約98度傾いており、横倒しになって公転しています' },
    { name: '海王星', jaName: '海王星', type: '氷巨星', orbitR: 590, radius: 10, period: 165.0, color: '#4b70dd', angle: 2.8, fact: '太陽系最強の風速を持つ惑星。風速は2100km/hに達します' }
  ];

  var moon = { name: '月', type: '衛星', orbitR: 22, radius: 3, period: 0.075, color: '#cccccc', angle: 0, fact: '地球の唯一の天然衛星。地球の潮汐に影響を与えています' };

  var namedStars = [
    { name: 'シリウス', color: '#b0d4ff', ox: -680, oy: 200, fact: '全天で最も明るい恒星。おおいぬ座にあります' },
    { name: 'ベテルギウス', color: '#ff7043', ox: 650, oy: -180, fact: 'オリオン座の赤色超巨星。近い将来超新星爆発の可能性があります' },
    { name: 'リゲル', color: '#cce0ff', ox: 700, oy: 280, fact: 'オリオン座の青白色超巨星。太陽の約120倍の質量を持ちます' },
    { name: 'アルデバラン', color: '#ff8c42', ox: -600, oy: -320, fact: 'おうし座の赤色巨星。太陽の約44倍の直径です' },
    { name: 'アンタレス', color: '#ff5252', ox: 500, oy: 400, fact: 'さそり座の赤色超巨星。その名は「火星に対抗するもの」の意味です' },
    { name: 'ベガ', color: '#e8eaff', ox: -200, oy: -650, fact: 'こと座の白色星・七夕の織姫星。太陽の約2.5倍の質量です' },
    { name: 'アルタイル', color: '#fff5e0', ox: 300, oy: -620, fact: 'わし座の星・七夕の彦星。自転が非常に速く赤道付近が膨らんでいます' },
    { name: 'デネブ', color: '#ddeeff', ox: -500, oy: 500, fact: 'はくちょう座の白色超巨星。地球からの距離は約1400光年です' },
    { name: 'スピカ', color: '#aad4ff', ox: 600, oy: -450, fact: 'おとめ座の青白色連星。2つの星が互いを公転する連星系です' },
    { name: 'アークトゥルス', color: '#ffad42', ox: -680, oy: -150, fact: 'うしかい座のオレンジ色巨星。北天で最も明るい星のひとつです' }
  ];

  var stars = [];
  var rng = 12345;
  function pseudoRand() {
    rng = (rng * 1664525 + 1013904223) & 0xffffffff;
    return (rng >>> 0) / 4294967296;
  }
  for (var i = 0; i < 200; i++) {
    stars.push({
      x: (pseudoRand() - 0.5) * 3000,
      y: (pseudoRand() - 0.5) * 3000,
      r: pseudoRand() < 0.3 ? 2 : 1,
      twinkle: pseudoRand() < 0.2,
      phase: pseudoRand() * Math.PI * 2
    });
  }

  var W, H, scale;
  function resize() {
    W = canvas.offsetWidth;
    H = canvas.offsetHeight;
    canvas.width = W;
    canvas.height = H;
    scale = Math.min(W, H) / 1400;
  }
  resize();
  window.addEventListener('resize', resize);

  function drawGlow(x, y, r, color) {
    var grad = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 2.5);
    grad.addColorStop(0, color);
    grad.addColorStop(0.4, color + '88');
    grad.addColorStop(1, color + '00');
    ctx.beginPath();
    ctx.arc(x, y, r * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  function drawPlanet(x, y, r, color) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawRings(x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.35);
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(228,209,145,0.55)';
    ctx.lineWidth = r * 0.6;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(228,209,145,0.3)';
    ctx.lineWidth = r * 0.3;
    ctx.stroke();
    ctx.restore();
  }

  function drawOrbit(cx, cy, r) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  var activeItem = null;

  function showTooltip(item, screenX, screenY) {
    tooltip.innerHTML =
      '<div class="tt-name">' + item.name + '</div>' +
      '<div class="tt-type">' + (item.type || '恒星') + '</div>' +
      '<div class="tt-fact">' + item.fact + '</div>';
    tooltip.style.opacity = '1';
    var tx = screenX + 16;
    var ty = screenY - 60;
    if (tx + 250 > window.innerWidth) tx = screenX - 260;
    if (ty < 0) ty = screenY + 16;
    tooltip.style.left = tx + 'px';
    tooltip.style.top = ty + 'px';
  }

  function hideTooltip() {
    tooltip.style.opacity = '0';
    activeItem = null;
  }

  function getCanvasPos(e) {
    var rect = canvas.getBoundingClientRect();
    var cx = e.clientX - rect.left;
    var cy = e.clientY - rect.top;
    return { x: cx, y: cy };
  }

  var planetScreenPos = [];
  var starScreenPos = [];

  function hitTest(screenX, screenY) {
    var hitR = 18;
    for (var i = 0; i < planetScreenPos.length; i++) {
      var p = planetScreenPos[i];
      var dx = screenX - p.x;
      var dy = screenY - p.y;
      if (dx * dx + dy * dy < hitR * hitR) return p.item;
    }
    hitR = 14;
    for (var j = 0; j < starScreenPos.length; j++) {
      var s = starScreenPos[j];
      var dx2 = screenX - s.x;
      var dy2 = screenY - s.y;
      if (dx2 * dx2 + dy2 * dy2 < hitR * hitR) return s.item;
    }
    return null;
  }

  canvas.addEventListener('click', function(e) {
    if (earthViewMode) return;
    var pos = getCanvasPos(e);
    var item = hitTest(pos.x, pos.y);
    if (item) { showTooltip(item, e.clientX, e.clientY); activeItem = item; }
    else hideTooltip();
  });

  var lastTime = null;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!lastTime) lastTime = now;
    var dt = (now - lastTime) / 1000;
    lastTime = now;
    dt = Math.min(dt, 0.1);
    t += dt * speed;

    ctx.clearRect(0, 0, W, H);

    planetScreenPos = [];
    starScreenPos = [];

    if (earthViewMode) {
      drawEarthView();
      return;
    }

    ctx.fillStyle = '#000010';
    ctx.fillRect(0, 0, W, H);

    var cx = W / 2;
    var cy = H / 2;

    for (var si = 0; si < stars.length; si++) {
      var star = stars[si];
      var sx = cx + star.x;
      var sy = cy + star.y;
      if (sx < -5 || sx > W + 5 || sy < -5 || sy > H + 5) continue;
      var alpha = 1;
      if (star.twinkle) {
        alpha = 0.5 + 0.5 * Math.sin(t * 3 + star.phase);
      }
      ctx.beginPath();
      ctx.arc(sx, sy, star.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,' + alpha.toFixed(2) + ')';
      ctx.fill();
    }

    var sc = scale || 1;

    for (var ni = 0; ni < namedStars.length; ni++) {
      var ns = namedStars[ni];
      var nsx = cx + ns.ox * sc;
      var nsy = cy + ns.oy * sc;
      if (nsx < -20 || nsx > W + 20 || nsy < -20 || nsy > H + 20) continue;
      ctx.beginPath();
      ctx.arc(nsx, nsy, 5, 0, Math.PI * 2);
      ctx.fillStyle = ns.color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(nsx, nsy, 5, 0, Math.PI * 2);
      ctx.strokeStyle = ns.color + '66';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (showStarLabels) {
        ctx.font = '11px sans-serif';
        ctx.fillStyle = ns.color;
        ctx.fillText(ns.name, nsx + 8, nsy + 4);
      }
      starScreenPos.push({ x: nsx, y: nsy, item: ns });
    }

    var sunR = Math.max(16, 40 * sc);
    drawGlow(cx, cy, sunR, '#fdb813');
    ctx.beginPath();
    ctx.arc(cx, cy, sunR, 0, Math.PI * 2);
    var sunGrad = ctx.createRadialGradient(cx - sunR * 0.2, cy - sunR * 0.2, sunR * 0.1, cx, cy, sunR);
    sunGrad.addColorStop(0, '#fff5a0');
    sunGrad.addColorStop(0.5, '#fdb813');
    sunGrad.addColorStop(1, '#f57c00');
    ctx.fillStyle = sunGrad;
    ctx.fill();

    planetScreenPos.push({ x: cx, y: cy, item: { name: '太陽', type: '恒星', fact: '太陽系の中心恒星。直径は地球の約109倍、質量は太陽系全体の99.86%を占めます' } });

    var earthX = cx, earthY = cy;

    for (var pi = 0; pi < planets.length; pi++) {
      var pl = planets[pi];
      var ang = pl.angle + t / pl.period;
      var orbitScaled = pl.orbitR * sc;
      var px = cx + orbitScaled * Math.cos(ang);
      var py = cy + orbitScaled * Math.sin(ang);
      var pr = Math.max(3, pl.radius * sc * 1.4);

      if (pl.name === '地球') {
        earthX = px;
        earthY = py;
      }

      if (showOrbits) drawOrbit(cx, cy, orbitScaled);

      if (pl.hasRings) {
        drawRings(px, py, pr);
      }

      drawPlanet(px, py, pr, pl.color);

      if (pl.name === '木星') {
        ctx.save();
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.clip();
        ctx.strokeStyle = 'rgba(160,100,40,0.4)';
        ctx.lineWidth = 3;
        for (var band = -3; band <= 3; band++) {
          ctx.beginPath();
          ctx.moveTo(px - pr, py + band * (pr / 3));
          ctx.lineTo(px + pr, py + band * (pr / 3));
          ctx.stroke();
        }
        ctx.restore();
      }

      if (showPlanetLabels) {
        ctx.font = '11px sans-serif';
        ctx.fillStyle = '#c9d1d9';
        ctx.fillText(pl.jaName, px + pr + 4, py + 4);
      }

      planetScreenPos.push({ x: px, y: py, item: pl });
    }

    var moonOrbitScaled = moon.orbitR * sc;
    if (showOrbits) {
      ctx.save();
      ctx.setLineDash([3, 4]);
      drawOrbit(earthX, earthY, moonOrbitScaled);
      ctx.setLineDash([]);
      ctx.restore();
    }

    var moonAng = moon.angle + t / moon.period;
    var moonX = earthX + moonOrbitScaled * Math.cos(moonAng);
    var moonY = earthY + moonOrbitScaled * Math.sin(moonAng);
    var moonR = Math.max(2, moon.radius * sc * 1.4);
    drawPlanet(moonX, moonY, moonR, moon.color);
    planetScreenPos.push({ x: moonX, y: moonY, item: moon });

    if (showPlanetLabels) {
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#888';
      ctx.fillText('月', moonX + moonR + 3, moonY + 3);
    }
  }

  requestAnimationFrame(frame);
})();
</script>
</body>
</html>`;
}
