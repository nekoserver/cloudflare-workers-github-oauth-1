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
  <button class="btn" id="btnConst">星座線</button>
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
  var btnConst = document.getElementById('btnConst');
  var btnEarth = document.getElementById('btnEarth');

  var showOrbits = true;
  var showStarLabels = true;
  var showPlanetLabels = true;
  var showConstellations = false;
  var speed = 1.0;
  var t = 0;
  var earthViewMode = false;
  var viewAngle = 0;
  var viewElev = 0;
  var fovH = Math.PI * 2 / 3;
  var pinchStartDist = 0;
  var pinchStartFov = Math.PI * 2 / 3;
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

  btnConst.addEventListener('click', function() {
    showConstellations = !showConstellations;
    btnConst.classList.toggle('active', showConstellations);
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
    var sensitivity = fovH / W;
    viewAngle = dragStartAngle - dx * sensitivity;
    viewElev = Math.max(-Math.PI * 0.45, Math.min(Math.PI * 0.45, dragStartElev + dy * sensitivity));
  }
  function endDrag(clientX, clientY) {
    var dx = clientX - dragStartX;
    var dy = clientY - dragStartY;
    if (dragActive && Math.abs(dx) < 5 && Math.abs(dy) < 5) {
      var pos = getCanvasPos({ clientX: clientX, clientY: clientY });
      var item = hitTest(pos.x, pos.y);
      if (item) { showTooltip(item, clientX, clientY); activeItem = item; }
      else hideTooltip();
    }
    dragActive = false;
  }

  canvas.addEventListener('mousedown', function(e) { startDrag(e.clientX, e.clientY); });
  canvas.addEventListener('mousemove', function(e) { moveDrag(e.clientX, e.clientY); });
  canvas.addEventListener('mouseup', function(e) { endDrag(e.clientX, e.clientY); });
  canvas.addEventListener('mouseleave', function() { dragActive = false; });

  canvas.addEventListener('wheel', function(e) {
    if (!earthViewMode) return;
    e.preventDefault();
    fovH = Math.max(Math.PI / 8, Math.min(Math.PI * 0.85, fovH + e.deltaY * 0.0015));
  }, { passive: false });

  canvas.addEventListener('touchstart', function(e) {
    if (e.touches.length === 2) {
      dragActive = false;
      var ddx = e.touches[0].clientX - e.touches[1].clientX;
      var ddy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDist = Math.sqrt(ddx * ddx + ddy * ddy);
      pinchStartFov = fovH;
    } else if (e.touches.length === 1) {
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', function(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      var ddx = e.touches[0].clientX - e.touches[1].clientX;
      var ddy = e.touches[0].clientY - e.touches[1].clientY;
      var d = Math.sqrt(ddx * ddx + ddy * ddy);
      if (pinchStartDist > 0) {
        fovH = Math.max(Math.PI / 8, Math.min(Math.PI * 0.85, pinchStartFov * pinchStartDist / d));
      }
    } else if (e.touches.length === 1) {
      e.preventDefault();
      moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });
  canvas.addEventListener('touchend', function(e) {
    if (e.changedTouches.length > 0 && e.touches.length === 0) {
      endDrag(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    }
  });

  var skyStars = [];
  for (var si3 = 0; si3 < 600; si3++) {
    var ssLon = pseudoRand() * Math.PI * 2;
    var ssLat = Math.asin(pseudoRand() * 2 - 1);
    skyStars.push({ lon: ssLon, lat: ssLat, r: pseudoRand() < 0.25 ? 2 : 1, twinkle: pseudoRand() < 0.18, phase: pseudoRand() * Math.PI * 2 });
  }

  var starLon = [1.817, 1.53, 1.38, 1.22, 4.34, 4.99, 5.267, 5.853, 3.558, 3.565];
  var starLat = [-0.691, -0.28, -0.54, -0.09, -0.09, 1.08, 0.511, 1.046, -0.036, 0.536];

  var bigDipper = [
    { lon: 2.360, lat: 0.868 },
    { lon: 2.433, lat: 0.784 },
    { lon: 2.625, lat: 0.822 },
    { lon: 2.637, lat: 0.901 },
    { lon: 2.774, lat: 0.946 },
    { lon: 2.895, lat: 0.982 },
    { lon: 3.087, lat: 0.944 }
  ];
  var bigDipperLines = [[0,1],[1,2],[2,3],[3,0],[3,4],[4,5],[5,6]];
  var summerTriIdx = [5, 6, 7];
  var iss = { name: 'ISS', jaName: 'ISS', type: '宇宙ステーション', orbitR: 14, radius: 2, period: 0.004, color: '#88ffcc', angle: 1.2, fact: '国際宇宙ステーション。高度約400kmを約90分で一周。常時6名が滞在しています' };

  function project3D(dX, dY, dZ) {
    var cy2 = Math.cos(viewAngle), sy2 = Math.sin(viewAngle);
    var cp2 = Math.cos(viewElev), sp2 = Math.sin(viewElev);
    var dotFw = dX * cy2 * cp2 + dY * sy2 * cp2 + dZ * sp2;
    if (dotFw <= 0.01) return null;
    var dotRt = dX * sy2 - dY * cy2;
    var dotUp = -dX * cy2 * sp2 - dY * sy2 * sp2 + dZ * cp2;
    var focal = (W / 2) / Math.tan(fovH / 2);
    var sx = W / 2 + dotRt / dotFw * focal;
    var sy3 = H / 2 - dotUp / dotFw * focal;
    if (sx < -80 || sx > W + 80 || sy3 < -80 || sy3 > H + 80) return null;
    return { x: sx, y: sy3 };
  }

  function projectSky(lon, lat) {
    var dX = Math.cos(lat) * Math.cos(lon);
    var dY = Math.cos(lat) * Math.sin(lon);
    var dZ = Math.sin(lat);
    return project3D(dX, dY, dZ);
  }

  function getEarthPos() {
    var ep = planets[2];
    var ea = ep.angle + t / ep.period;
    return { x: Math.cos(ea) * ep.orbitR, y: Math.sin(ea) * ep.orbitR };
  }

  function drawMoonPhase(x, y, r, phaseNorm) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#e8e8d8';
    ctx.fill();
    var theta = phaseNorm * Math.PI * 2;
    var c = Math.cos(theta);
    ctx.beginPath();
    if (phaseNorm < 0.5) {
      ctx.arc(x, y, r, Math.PI / 2, 3 * Math.PI / 2);
      ctx.ellipse(x, y, Math.abs(c) * r, r, 0, 3 * Math.PI / 2, Math.PI / 2, c < 0);
    } else {
      ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2);
      ctx.ellipse(x, y, Math.abs(c) * r, r, 0, Math.PI / 2, -Math.PI / 2, c > 0);
    }
    ctx.closePath();
    ctx.fillStyle = '#060614';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(200,200,200,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawEarthView() {
    var focal = (W / 2) / Math.tan(fovH / 2);
    var cp3 = Math.cos(viewElev), sp3 = Math.sin(viewElev);
    var horizonY = H / 2 - (sp3 / cp3) * focal;

    var grad = ctx.createLinearGradient(0, 0, 0, Math.max(0, horizonY));
    grad.addColorStop(0, '#000018');
    grad.addColorStop(1, '#000c28');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, W);

    if (horizonY < H) {
      ctx.fillStyle = '#060e06';
      ctx.fillRect(0, Math.max(0, horizonY), W, H);
    }

    var ep = getEarthPos();
    var sunLon = Math.atan2(-ep.y, -ep.x);

    for (var si4 = 0; si4 < skyStars.length; si4++) {
      var ss = skyStars[si4];
      if (ss.lat < -0.02) continue;
      var sPos = projectSky(ss.lon, ss.lat);
      if (!sPos) continue;
      var alp = 1;
      if (ss.twinkle) alp = 0.5 + 0.5 * Math.sin(t * 3 + ss.phase);
      ctx.beginPath();
      ctx.arc(sPos.x, sPos.y, ss.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,' + alp.toFixed(2) + ')';
      ctx.fill();
    }

    starScreenPos = [];
    for (var ni3 = 0; ni3 < namedStars.length; ni3++) {
      var ns3 = namedStars[ni3];
      var nPos = projectSky(starLon[ni3], starLat[ni3]);
      if (!nPos) continue;
      ctx.beginPath();
      ctx.arc(nPos.x, nPos.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = ns3.color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(nPos.x, nPos.y, 8, 0, Math.PI * 2);
      ctx.strokeStyle = ns3.color + '44';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (showStarLabels) {
        ctx.font = '11px sans-serif';
        ctx.fillStyle = ns3.color;
        ctx.fillText(ns3.name, nPos.x + 10, nPos.y + 4);
      }
      starScreenPos.push({ x: nPos.x, y: nPos.y, item: ns3 });
    }

    if (showConstellations) {
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(180,220,255,0.4)';
      var stPts = [];
      for (var sti = 0; sti < summerTriIdx.length; sti++) {
        stPts.push(projectSky(starLon[summerTriIdx[sti]], starLat[summerTriIdx[sti]]));
      }
      for (var stli = 0; stli < 3; stli++) {
        var pa = stPts[stli], pb = stPts[(stli + 1) % 3];
        if (pa && pb) {
          ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
        }
      }
      if (stPts[0] && showStarLabels) {
        ctx.setLineDash([]);
        ctx.font = '10px sans-serif';
        ctx.fillStyle = 'rgba(180,220,255,0.7)';
        ctx.fillText('夏の大三角', stPts[0].x + 12, stPts[0].y - 14);
      }
      ctx.strokeStyle = 'rgba(255,220,150,0.4)';
      ctx.setLineDash([4, 4]);
      for (var bli2 = 0; bli2 < bigDipperLines.length; bli2++) {
        var bpa = projectSky(bigDipper[bigDipperLines[bli2][0]].lon, bigDipper[bigDipperLines[bli2][0]].lat);
        var bpb = projectSky(bigDipper[bigDipperLines[bli2][1]].lon, bigDipper[bigDipperLines[bli2][1]].lat);
        if (bpa && bpb) {
          ctx.beginPath(); ctx.moveTo(bpa.x, bpa.y); ctx.lineTo(bpb.x, bpb.y); ctx.stroke();
        }
      }
      ctx.setLineDash([]);
      for (var bdi2 = 0; bdi2 < bigDipper.length; bdi2++) {
        var bdp = projectSky(bigDipper[bdi2].lon, bigDipper[bdi2].lat);
        if (!bdp) continue;
        ctx.beginPath(); ctx.arc(bdp.x, bdp.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffdd88'; ctx.fill();
      }
      if (showStarLabels) {
        var bd0 = projectSky(bigDipper[0].lon, bigDipper[0].lat);
        if (bd0) {
          ctx.font = '10px sans-serif';
          ctx.fillStyle = 'rgba(255,220,150,0.7)';
          ctx.fillText('北斗七星', bd0.x - 10, bd0.y - 14);
        }
      }
    }

    var sunPos = projectSky(sunLon, 0);
    if (sunPos) {
      drawGlow(sunPos.x, sunPos.y, 32, '#fdb813');
      var sg3 = ctx.createRadialGradient(sunPos.x - 6, sunPos.y - 6, 3, sunPos.x, sunPos.y, 30);
      sg3.addColorStop(0, '#fff5a0');
      sg3.addColorStop(0.5, '#fdb813');
      sg3.addColorStop(1, '#f57c00');
      ctx.beginPath();
      ctx.arc(sunPos.x, sunPos.y, 30, 0, Math.PI * 2);
      ctx.fillStyle = sg3;
      ctx.fill();
      if (showPlanetLabels) {
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#fdb813';
        ctx.fillText('太陽', sunPos.x + 34, sunPos.y + 4);
      }
      planetScreenPos.push({ x: sunPos.x, y: sunPos.y, item: { name: '太陽', type: '恒星', fact: '太陽系の中心恒星。直径は地球の約109倍、質量は太陽系全体の99.86%を占めます' } });
    }

    for (var pi3 = 0; pi3 < planets.length; pi3++) {
      var pl3 = planets[pi3];
      if (pl3.name === '地球') continue;
      var pa3 = pl3.angle + t / pl3.period;
      var plx3 = Math.cos(pa3) * pl3.orbitR;
      var ply3 = Math.sin(pa3) * pl3.orbitR;
      var dx3 = plx3 - ep.x;
      var dy3 = ply3 - ep.y;
      var dist3 = Math.sqrt(dx3 * dx3 + dy3 * dy3);
      var plon3 = Math.atan2(dy3, dx3);
      var pPos = projectSky(plon3, 0);
      if (!pPos) continue;
      var appR = Math.max(4, pl3.radius * 120 / Math.max(dist3, 20));
      if (pl3.hasRings) drawRings(pPos.x, pPos.y, appR);
      drawPlanet(pPos.x, pPos.y, appR, pl3.color);
      if (showPlanetLabels) {
        ctx.font = '11px sans-serif';
        ctx.fillStyle = '#c9d1d9';
        ctx.fillText(pl3.jaName, pPos.x + appR + 4, pPos.y + 4);
      }
      planetScreenPos.push({ x: pPos.x, y: pPos.y, item: pl3 });
    }

    var moonEa2 = planets[2].angle + t / planets[2].period;
    var mEX = Math.cos(moonEa2) * planets[2].orbitR;
    var mEY = Math.sin(moonEa2) * planets[2].orbitR;
    var moonAng3 = moon.angle + t / moon.period;
    var mAbsX2 = mEX + moon.orbitR * Math.cos(moonAng3);
    var mAbsY2 = mEY + moon.orbitR * Math.sin(moonAng3);
    var mDx2 = mAbsX2 - ep.x;
    var mDy2 = mAbsY2 - ep.y;
    var mLon2 = Math.atan2(mDy2, mDx2);
    var mPos = projectSky(mLon2, 0.05);
    if (mPos) {
      var phaseAngle = ((mLon2 - sunLon) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      var phaseNorm = phaseAngle / (Math.PI * 2);
      drawMoonPhase(mPos.x, mPos.y, 16, phaseNorm);
      if (showPlanetLabels) {
        ctx.font = '11px sans-serif';
        ctx.fillStyle = '#aaa';
        ctx.fillText('月', mPos.x + 20, mPos.y + 4);
      }
      planetScreenPos.push({ x: mPos.x, y: mPos.y, item: moon });
    }

    var issEa2 = planets[2].angle + t / planets[2].period;
    var iEX2 = Math.cos(issEa2) * planets[2].orbitR;
    var iEY2 = Math.sin(issEa2) * planets[2].orbitR;
    var issAng2 = iss.angle + t / iss.period;
    var iAbsX2 = iEX2 + iss.orbitR * Math.cos(issAng2);
    var iAbsY2 = iEY2 + iss.orbitR * Math.sin(issAng2);
    var iDx2 = iAbsX2 - ep.x;
    var iDy2 = iAbsY2 - ep.y;
    var iLon2 = Math.atan2(iDy2, iDx2);
    var iPos2 = projectSky(iLon2, 0.09);
    if (iPos2) {
      var issAlp = 0.5 + 0.5 * Math.sin(t * 25);
      ctx.strokeStyle = 'rgba(136,255,204,' + issAlp.toFixed(2) + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(iPos2.x - 6, iPos2.y); ctx.lineTo(iPos2.x + 6, iPos2.y);
      ctx.moveTo(iPos2.x, iPos2.y - 6); ctx.lineTo(iPos2.x, iPos2.y + 6);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(iPos2.x, iPos2.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(136,255,204,' + issAlp.toFixed(2) + ')'; ctx.fill();
      if (showPlanetLabels) {
        ctx.font = '10px sans-serif';
        ctx.fillStyle = 'rgba(136,255,204,0.9)';
        ctx.fillText('ISS', iPos2.x + 8, iPos2.y - 3);
      }
      planetScreenPos.push({ x: iPos2.x, y: iPos2.y, item: iss });
    }

    if (horizonY > 0 && horizonY < H) {
      ctx.beginPath();
      ctx.moveTo(0, horizonY);
      ctx.lineTo(W, horizonY);
      ctx.strokeStyle = 'rgba(80,160,80,0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(100,180,255,0.65)';
    ctx.fillText('🌍 地球目線  ドラッグ:視点回転  ピンチ/スクロール:ズーム', 10, 28);
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

    var issOrbitScaled = iss.orbitR * sc;
    var issAng3 = iss.angle + t / iss.period;
    var issX = earthX + issOrbitScaled * Math.cos(issAng3);
    var issY = earthY + issOrbitScaled * Math.sin(issAng3);
    var issAlp2 = 0.5 + 0.5 * Math.sin(t * 25);
    ctx.strokeStyle = 'rgba(136,255,204,' + issAlp2.toFixed(2) + ')';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(issX - 4, issY); ctx.lineTo(issX + 4, issY);
    ctx.moveTo(issX, issY - 4); ctx.lineTo(issX, issY + 4);
    ctx.stroke();
    if (showPlanetLabels) {
      ctx.font = '9px sans-serif';
      ctx.fillStyle = 'rgba(136,255,204,0.85)';
      ctx.fillText('ISS', issX + 5, issY - 3);
    }
    planetScreenPos.push({ x: issX, y: issY, item: iss });

    if (showConstellations) {
      var sc2 = scale || 1;
      ctx.strokeStyle = 'rgba(180,220,255,0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      var triIdx = [5, 6, 7];
      for (var tli = 0; tli < 3; tli++) {
        var ta = namedStars[triIdx[tli]], tb = namedStars[triIdx[(tli + 1) % 3]];
        ctx.beginPath();
        ctx.moveTo(cx + ta.ox * sc2, cy + ta.oy * sc2);
        ctx.lineTo(cx + tb.ox * sc2, cy + tb.oy * sc2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }

  requestAnimationFrame(frame);
})();
</script>
</body>
</html>`;
}
