function escH(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function getWebGLHeritagePage(username: string): string {
  const safeUser = escH(username);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0d1117">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="世界遺産地球儀">
<link rel="manifest" href="/manifest.json">
<title>世界遺産 地球儀</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { background:#000; color:#e6edf3; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:13px; height:100vh; height:100dvh; display:flex; flex-direction:column; overflow:hidden; }
.topbar { background:#0d1117; border-bottom:1px solid #30363d; padding:8px 18px; display:flex; align-items:center; gap:10px; flex-shrink:0; }
.topbar a { color:#58a6ff; text-decoration:none; font-size:12px; }
h1 { font-size:14px; font-weight:700; }
.badge { background:#0c2d1a; color:#3fb950; font-size:10px; padding:2px 7px; border-radius:10px; font-weight:600; }
.body { display:grid; grid-template-columns:1fr 260px; grid-template-rows:1fr; flex:1; min-height:0; }
@media(max-width:800px){ .body{ grid-template-columns:1fr; } .side{ display:none; } }
.canvas-wrap { position:relative; background:#000010; overflow:hidden; }
canvas { position:absolute; inset:0; width:100%; height:100%; cursor:grab; touch-action:none; display:block; }
canvas:active { cursor:grabbing; }
.hud { position:absolute; bottom:10px; left:10px; background:rgba(0,0,0,.7); border:1px solid #30363d; border-radius:6px; padding:6px 10px; font-size:11px; font-family:monospace; color:#58a6ff; line-height:1.9; pointer-events:none; }
#markers { position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; overflow:hidden; }
.mk { position:absolute; transform:translate(-50%,-50%); line-height:1; font-size:16px; text-shadow:0 1px 3px #000,0 0 8px rgba(0,0,0,0.9); pointer-events:auto; cursor:pointer; user-select:none; -webkit-user-select:none; }
#mk-tooltip { position:fixed; background:rgba(13,17,23,0.97); border:1px solid #3fb950; border-radius:8px; padding:7px 12px; font-size:12px; color:#e6edf3; white-space:nowrap; pointer-events:none; opacity:0; transition:opacity .15s; z-index:60; transform:translate(-50%,-110%); line-height:1.7; }
#mk-tooltip.below { transform:translate(-50%, 14px); }
#mk-tooltip .tt-name { font-weight:700; font-size:13px; }
#mk-tooltip .tt-sub { font-size:12px; margin-top:3px; }
.side { background:#0d1117; border-left:1px solid #30363d; display:flex; flex-direction:column; overflow:hidden; }
.side-header { padding:10px 10px 8px; border-bottom:1px solid #21262d; flex-shrink:0; }
.side-title { font-size:10px; font-weight:700; color:#3fb950; text-transform:uppercase; letter-spacing:.5px; margin-bottom:6px; }
.search-wrap { position:relative; }
.search-wrap input { width:100%; background:#161b22; border:1px solid #30363d; border-radius:6px; padding:6px 10px 6px 28px; color:#e6edf3; font-size:12px; outline:none; }
.search-wrap input:focus { border-color:#3fb950; }
.search-wrap input::placeholder { color:#484f58; }
.search-icon { position:absolute; left:9px; top:50%; transform:translateY(-50%); color:#484f58; font-size:12px; pointer-events:none; }
#result-count { font-size:10px; color:#484f58; margin-top:5px; text-align:right; }
.list-scroll { flex:1; overflow-y:auto; overflow-x:hidden; }
.list-scroll::-webkit-scrollbar { width:4px; }
.list-scroll::-webkit-scrollbar-track { background:#0d1117; }
.list-scroll::-webkit-scrollbar-thumb { background:#30363d; border-radius:2px; }
.site-item { display:flex; align-items:center; gap:8px; padding:8px 10px; border-bottom:1px solid #161b22; cursor:pointer; transition:background .1s; }
.site-item:hover { background:#161b22; }
.site-item.active { background:#0c2d1a; }
.site-thumb { width:48px; height:36px; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0; border:1px solid #21262d; }
.site-body { flex:1; min-width:0; }
.site-top { display:flex; align-items:center; gap:4px; margin-bottom:2px; }
.site-flag { font-size:13px; flex-shrink:0; }
.site-name { font-size:11px; font-weight:600; color:#e6edf3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.site-meta { font-size:10px; color:#484f58; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.type-label { font-weight:600; }
.canvas-ctrl-btns { position:absolute; top:10px; right:10px; display:flex; flex-direction:row; gap:6px; z-index:5; }
.canvas-ctrl-btn { background:rgba(13,17,23,0.88); border:1px solid #30363d; border-radius:6px; color:#e6edf3; font-size:12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; padding:6px 12px; cursor:pointer; white-space:nowrap; transition:background .15s,border-color .15s,color .15s; }
.canvas-ctrl-btn:hover { background:rgba(13,17,23,1); border-color:#3fb950; }
.canvas-ctrl-btn.active { background:#0c2d1a; border-color:#3fb950; color:#3fb950; }
@media (display-mode: standalone) { .pwa-hide { display:none !important; } }
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
  <h1>世界遺産 地球儀</h1>
  <span class="badge">世界遺産</span>
  <span style="flex:1"></span>
  <a href="/webgl-sphere">&#9917; W杯</a>
  <a href="/webgl-lv-sphere">🔮 LV Sphere</a>
  <a href="/settings" class="pwa-hide">&#9881;</a>
  <span class="pwa-hide" style="color:#8b949e;font-size:11px">${safeUser}</span>
</div>

<div class="body">
  <div class="canvas-wrap">
    <canvas id="c"></canvas>
    <div id="markers"></div>
    <div class="hud" id="hud">テクスチャ読み込み中...</div>
    <div class="canvas-ctrl-btns">
      <button class="canvas-ctrl-btn" id="btnAxisLock">＋ 軸垂直固定</button>
      <button class="canvas-ctrl-btn" id="btnAutoRot">⏸ 自転停止</button>
    </div>
  </div>
  <div class="side">
    <div class="side-header">
      <div class="side-title">▼ 正面から近い順</div>
      <div class="search-wrap">
        <span class="search-icon">🔍</span>
        <input type="search" id="searchInput" placeholder="遺産名・国・種別で検索...">
      </div>
      <div id="result-count"></div>
    </div>
    <div class="list-scroll" id="siteList"></div>
  </div>
</div>

<div id="mk-tooltip"></div>

<script>
(function() {
  var canvas = document.getElementById('c');
  var wrap   = canvas.parentElement;
  var hud    = document.getElementById('hud');
  var markersDiv = document.getElementById('markers');
  var siteList = document.getElementById('siteList');
  var searchInput = document.getElementById('searchInput');
  var resultCount = document.getElementById('result-count');

  function resize() {
    var r = wrap.getBoundingClientRect();
    var w = Math.round(r.width), h = Math.round(r.height);
    if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
      canvas.width = w; canvas.height = h;
    }
  }
  resize();
  window.addEventListener('resize', resize);

  var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) { hud.textContent = 'WebGL が利用できません'; return; }

  function compileShader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  var prog = gl.createProgram();
  gl.attachShader(prog, compileShader(gl.VERTEX_SHADER,   document.getElementById('vs').textContent));
  gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, document.getElementById('fs').textContent));
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
  var aPos  = gl.getAttribLocation(prog, 'aPos');
  var aNorm = gl.getAttribLocation(prog, 'aNorm');
  var aUV   = gl.getAttribLocation(prog, 'aUV');
  gl.enableVertexAttribArray(aPos);  gl.vertexAttribPointer(aPos,  3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(aNorm); gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, stride, 12);
  gl.enableVertexAttribArray(aUV);   gl.vertexAttribPointer(aUV,   2, gl.FLOAT, false, stride, 24);

  var uMVP   = gl.getUniformLocation(prog, 'uMVP');
  var uModel = gl.getUniformLocation(prog, 'uModel');
  var uLight = gl.getUniformLocation(prog, 'uLight');
  var uTex   = gl.getUniformLocation(prog, 'uTex');
  gl.uniform1i(uTex, 0);

  function getSunDir() {
    var now = new Date();
    var utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    var sunLon = (utcH - 12) / 24 * 2 * Math.PI;
    var start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    var doy = Math.floor((now.getTime() - start.getTime()) / 86400000);
    var sunLat = 23.45 * Math.PI / 180 * Math.sin(2 * Math.PI * (doy - 80) / 365);
    return [Math.cos(sunLat) * Math.cos(sunLon), Math.sin(sunLat), Math.cos(sunLat) * Math.sin(sunLon)];
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
  earthImg.onerror = function() { hud.textContent = 'テクスチャ読み込み失敗'; };
  earthImg.src = '/earth.jpg';

  function m4()      { return new Float32Array(16); }
  function ident(m)  { for(var i=0;i<16;i++) m[i]=0; m[0]=m[5]=m[10]=m[15]=1; return m; }
  function mul(o,a,b){ for(var i=0;i<4;i++) for(var j=0;j<4;j++){ var s=0; for(var k=0;k<4;k++) s+=a[i+k*4]*b[k+j*4]; o[i+j*4]=s; } return o; }
  function persp(m,fov,asp,near,far){ ident(m); var f=1/Math.tan(fov/2); m[0]=f/asp; m[5]=f; m[10]=(far+near)/(near-far); m[11]=-1; m[14]=2*far*near/(near-far); m[15]=0; return m; }
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

  var btnAxisLock = document.getElementById('btnAxisLock');
  var btnAutoRot  = document.getElementById('btnAutoRot');

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

  var velY = 0, velX = 0, momentumY = 0, momentumX = 0;
  var MOMENTUM_DECAY = 0.92;

  canvas.addEventListener('mousedown',  function(e){ drag=true; lx=e.clientX; ly=e.clientY; momentumY=0; momentumX=0; velY=0; velX=0; });
  window.addEventListener('mouseup',    function(){ if(!drag)return; drag=false; momentumY=velY; momentumX=velX; velY=0; velX=0; });
  window.addEventListener('mousemove',  function(e){ if(!drag)return; var dy=(e.clientX-lx)*0.008; var dx=(e.clientY-ly)*0.008; rotYv+=dy; velY=velY*0.4+dy*0.6; if(!axisLocked){rotXv=clampElev(rotXv+dx); velX=velX*0.4+dx*0.6;} lx=e.clientX; ly=e.clientY; });
  canvas.addEventListener('wheel',      function(e){ e.preventDefault(); zoom=Math.max(1.6,Math.min(10,zoom+e.deltaY*0.01)); },{passive:false});
  canvas.addEventListener('dblclick',   function(){ autoRot=!autoRot; btnAutoRot.textContent=autoRot?'⏸ 自転停止':'▶ 回転'; if(autoRot){btnAutoRot.classList.remove('active');}else{btnAutoRot.classList.add('active');} });
  canvas.addEventListener('touchstart', function(e){ e.preventDefault(); touchMoved=false; momentumY=0; momentumX=0; velY=0; velX=0; if(e.touches.length===1){drag=true;lx=e.touches[0].clientX;ly=e.touches[0].clientY;} if(e.touches.length===2){pinch0=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);} },{passive:false});
  canvas.addEventListener('touchmove',  function(e){ e.preventDefault(); touchMoved=true; if(e.touches.length===1&&drag){var dy=(e.touches[0].clientX-lx)*0.008; var dx=(e.touches[0].clientY-ly)*0.008; rotYv+=dy; velY=velY*0.4+dy*0.6; if(!axisLocked){rotXv=clampElev(rotXv+dx); velX=velX*0.4+dx*0.6;} lx=e.touches[0].clientX;ly=e.touches[0].clientY;} if(e.touches.length===2){var d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);zoom=Math.max(1.6,Math.min(10,zoom-(d-pinch0)*0.02));pinch0=d;} },{passive:false});
  canvas.addEventListener('touchend', function(e){
    drag=false;
    momentumY=velY; momentumX=velX; velY=0; velX=0;
    if (!touchMoved && e.changedTouches.length === 1) { momentumY=0; momentumX=0; hideTooltip(); }
  });

  var HERITAGE = [
    {e:'🏛️',f:'🇨🇳',n:'万里の長城',c:'中国',t:'文化遺産',y:1987,lat:40.4,lon:116.6},
    {e:'🏛️',f:'🇨🇳',n:'故宮（北京）',c:'中国',t:'文化遺産',y:1987,lat:39.9,lon:116.4},
    {e:'🏛️',f:'🇨🇳',n:'兵馬俑',c:'中国',t:'文化遺産',y:1987,lat:34.4,lon:109.3},
    {e:'🏛️',f:'🇮🇳',n:'タージ・マハル',c:'インド',t:'文化遺産',y:1983,lat:27.2,lon:78.0},
    {e:'🏛️',f:'🇬🇷',n:'アクロポリス（アテネ）',c:'ギリシャ',t:'文化遺産',y:1987,lat:37.97,lon:23.73},
    {e:'🏛️',f:'🇮🇹',n:'ローマ歴史地区',c:'イタリア',t:'文化遺産',y:1980,lat:41.89,lon:12.49},
    {e:'🏛️',f:'🇪🇬',n:'ギザのピラミッド',c:'エジプト',t:'文化遺産',y:1979,lat:29.98,lon:31.13},
    {e:'🏛️',f:'🇯🇴',n:'ペトラ',c:'ヨルダン',t:'文化遺産',y:1985,lat:30.33,lon:35.44},
    {e:'🏛️',f:'🇵🇪',n:'マチュ・ピチュ',c:'ペルー',t:'文化遺産',y:1983,lat:-13.16,lon:-72.54},
    {e:'🏛️',f:'🇲🇽',n:'チチェン・イッツァ',c:'メキシコ',t:'文化遺産',y:1988,lat:20.68,lon:-88.57},
    {e:'🏛️',f:'🇮🇩',n:'ボロブドゥール',c:'インドネシア',t:'文化遺産',y:1991,lat:-7.61,lon:110.20},
    {e:'🏛️',f:'🇰🇭',n:'アンコール遺跡群',c:'カンボジア',t:'文化遺産',y:1992,lat:13.41,lon:103.87},
    {e:'🏛️',f:'🇬🇧',n:'ストーンヘンジ',c:'英国',t:'文化遺産',y:1986,lat:51.18,lon:-1.83},
    {e:'🏛️',f:'🇮🇷',n:'ペルセポリス',c:'イラン',t:'文化遺産',y:1979,lat:29.94,lon:52.89},
    {e:'🏛️',f:'🇫🇷',n:'ヴェルサイユ宮殿と庭園',c:'フランス',t:'文化遺産',y:1979,lat:48.81,lon:2.12},
    {e:'🏛️',f:'🇫🇷',n:'モン・サン＝ミシェル',c:'フランス',t:'文化遺産',y:1979,lat:48.64,lon:-1.51},
    {e:'🏛️',f:'🇪🇸',n:'アルハンブラ宮殿',c:'スペイン',t:'文化遺産',y:1984,lat:37.18,lon:-3.59},
    {e:'🏛️',f:'🇪🇸',n:'バルセロナのガウディ建築群',c:'スペイン',t:'文化遺産',y:1984,lat:41.41,lon:2.17},
    {e:'🏛️',f:'🇭🇷',n:'ドゥブロヴニク旧市街',c:'クロアチア',t:'文化遺産',y:1979,lat:42.65,lon:18.09},
    {e:'🏛️',f:'🇨🇿',n:'プラハ歴史地区',c:'チェコ',t:'文化遺産',y:1992,lat:50.09,lon:14.42},
    {e:'🏛️',f:'🇵🇱',n:'クラクフ歴史地区',c:'ポーランド',t:'文化遺産',y:1978,lat:50.06,lon:19.94},
    {e:'🏛️',f:'🇷🇺',n:'サンクトペテルブルク',c:'ロシア',t:'文化遺産',y:1990,lat:59.95,lon:30.32},
    {e:'🏛️',f:'🇹🇷',n:'イスタンブール歴史地区',c:'トルコ',t:'文化遺産',y:1985,lat:41.01,lon:28.98},
    {e:'🏛️',f:'🇺🇿',n:'サマルカンド',c:'ウズベキスタン',t:'文化遺産',y:2001,lat:39.65,lon:66.97},
    {e:'🏛️',f:'🇪🇬',n:'ルクソール（古代テーベ）',c:'エジプト',t:'文化遺産',y:1979,lat:25.69,lon:32.63},
    {e:'🏛️',f:'🇬🇹',n:'ティカル',c:'グアテマラ',t:'文化遺産',y:1979,lat:17.22,lon:-89.62},
    {e:'🏛️',f:'🇮🇹',n:'ポンペイ遺跡',c:'イタリア',t:'文化遺産',y:1997,lat:40.75,lon:14.49},
    {e:'🏛️',f:'🇪🇹',n:'アクスム',c:'エチオピア',t:'文化遺産',y:1980,lat:14.13,lon:38.72},
    {e:'🏛️',f:'🇿🇼',n:'グレート・ジンバブエ',c:'ジンバブエ',t:'文化遺産',y:1986,lat:-20.27,lon:30.93},
    {e:'🏛️',f:'🇯🇵',n:'日光の社寺',c:'日本',t:'文化遺産',y:1999,lat:36.76,lon:139.60},
    {e:'🏛️',f:'🇯🇵',n:'白川郷・五箇山の合掌造り集落',c:'日本',t:'文化遺産',y:1995,lat:36.26,lon:136.91},
    {e:'🏛️',f:'🇯🇵',n:'厳島神社',c:'日本',t:'文化遺産',y:1996,lat:34.30,lon:132.32},
    {e:'🏛️',f:'🇯🇵',n:'法隆寺地域の仏教建造物群',c:'日本',t:'文化遺産',y:1993,lat:34.61,lon:135.74},
    {e:'🏛️',f:'🇯🇵',n:'原爆ドーム',c:'日本',t:'文化遺産',y:1996,lat:34.40,lon:132.45},
    {e:'🏛️',f:'🇯🇵',n:'古都京都の文化財',c:'日本',t:'文化遺産',y:1994,lat:35.01,lon:135.77},
    {e:'🏛️',f:'🇯🇵',n:'古都奈良の文化財',c:'日本',t:'文化遺産',y:1998,lat:34.69,lon:135.84},
    {e:'🏛️',f:'🇯🇵',n:'琉球王国のグスク及び関連遺産群',c:'日本',t:'文化遺産',y:2000,lat:26.21,lon:127.72},
    {e:'🏛️',f:'🇨🇴',n:'カルタヘナの港、要塞、建造物群',c:'コロンビア',t:'文化遺産',y:1984,lat:10.42,lon:-75.54},
    {e:'🏛️',f:'🇨🇺',n:'オールド・ハバナと要塞',c:'キューバ',t:'文化遺産',y:1982,lat:23.14,lon:-82.36},
    {e:'🌿',f:'🇺🇸',n:'グランドキャニオン国立公園',c:'アメリカ',t:'自然遺産',y:1979,lat:36.10,lon:-112.11},
    {e:'🌿',f:'🇺🇸',n:'イエローストーン国立公園',c:'アメリカ',t:'自然遺産',y:1978,lat:44.43,lon:-110.59},
    {e:'🌿',f:'🇪🇨',n:'ガラパゴス諸島',c:'エクアドル',t:'自然遺産',y:1978,lat:-0.53,lon:-90.43},
    {e:'🌿',f:'🇦🇺',n:'グレート・バリア・リーフ',c:'オーストラリア',t:'自然遺産',y:1981,lat:-18.29,lon:147.70},
    {e:'🌿',f:'🇹🇿',n:'セレンゲティ国立公園',c:'タンザニア',t:'自然遺産',y:1981,lat:-2.33,lon:34.83},
    {e:'🌿',f:'🇿🇼',n:'ビクトリア滝',c:'ジンバブエ/ザンビア',t:'自然遺産',y:1989,lat:-17.92,lon:25.86},
    {e:'🌿',f:'🇦🇷',n:'イグアスの滝',c:'アルゼンチン/ブラジル',t:'自然遺産',y:1984,lat:-25.69,lon:-54.44},
    {e:'🌿',f:'🇳🇴',n:'フィヨルド（西ノルウェー）',c:'ノルウェー',t:'自然遺産',y:2005,lat:60.63,lon:6.61},
    {e:'🌿',f:'🇳🇵',n:'サガルマータ国立公園（エベレスト）',c:'ネパール',t:'自然遺産',y:1979,lat:27.99,lon:86.93},
    {e:'🌿',f:'🇷🇺',n:'バイカル湖',c:'ロシア',t:'自然遺産',y:1996,lat:53.50,lon:107.99},
    {e:'🌿',f:'🇮🇩',n:'コモド国立公園',c:'インドネシア',t:'自然遺産',y:1991,lat:-8.55,lon:119.48},
    {e:'🌿',f:'🇹🇿',n:'キリマンジャロ国立公園',c:'タンザニア',t:'自然遺産',y:1987,lat:-3.07,lon:37.35},
    {e:'🌿',f:'🇯🇵',n:'屋久島',c:'日本',t:'自然遺産',y:1993,lat:30.34,lon:130.53},
    {e:'🌿',f:'🇯🇵',n:'知床',c:'日本',t:'自然遺産',y:2005,lat:44.07,lon:145.08},
    {e:'🌿',f:'🇯🇵',n:'小笠原諸島',c:'日本',t:'自然遺産',y:2011,lat:27.05,lon:142.22},
    {e:'🌿',f:'🇯🇵',n:'奄美大島・徳之島・西表島',c:'日本',t:'自然遺産',y:2021,lat:28.38,lon:129.50},
    {e:'🌿',f:'🇻🇳',n:'ハ・ロン湾',c:'ベトナム',t:'自然遺産',y:1994,lat:20.91,lon:107.18},
    {e:'🌿',f:'🇨🇦',n:'カナディアン・ロッキー',c:'カナダ',t:'自然遺産',y:1984,lat:51.50,lon:-116.16},
    {e:'🌿',f:'🇦🇷',n:'ロス・グラシアレス国立公園',c:'アルゼンチン',t:'自然遺産',y:1981,lat:-50.59,lon:-73.09},
    {e:'🌿',f:'🇹🇿',n:'ンゴロンゴロ保全地域',c:'タンザニア',t:'自然遺産',y:1979,lat:-3.18,lon:35.58},
    {e:'🌿',f:'🇦🇺',n:'カカドゥ国立公園',c:'オーストラリア',t:'自然遺産',y:1981,lat:-12.87,lon:132.56},
    {e:'🌿',f:'🇧🇷',n:'中央アマゾン保全地域群',c:'ブラジル',t:'自然遺産',y:2000,lat:-2.50,lon:-60.50},
    {e:'⭐',f:'🇦🇺',n:'ウルル・カタ・ジュタ国立公園',c:'オーストラリア',t:'複合遺産',y:1987,lat:-25.36,lon:131.03},
    {e:'⭐',f:'🇳🇿',n:'トンガリロ国立公園',c:'ニュージーランド',t:'複合遺産',y:1990,lat:-39.18,lon:175.63},
    {e:'⭐',f:'🇨🇳',n:'泰山',c:'中国',t:'複合遺産',y:1987,lat:36.27,lon:117.10},
    {e:'⭐',f:'🇨🇳',n:'黄山',c:'中国',t:'複合遺産',y:1990,lat:30.13,lon:118.16}
  ];

  function typeColor(t) {
    return t === '文化遺産' ? '#e3a838' : (t === '自然遺産' ? '#3fb950' : '#a371f7');
  }
  function thumbBg(t) {
    return t === '文化遺産' ? '#1a0d00' : (t === '自然遺産' ? '#0a1e0a' : '#100a20');
  }

  function latLonTo3D(lat, lon) {
    var latR = lat * Math.PI / 180;
    var lonR = lon * Math.PI / 180;
    return [Math.cos(latR) * Math.cos(lonR), Math.sin(latR), -Math.cos(latR) * Math.sin(lonR)];
  }

  var flyTarget = null, flyFrom = null, flyStart = 0;
  var FLY_DUR = 2500;

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
    btnAutoRot.textContent = '▶ 回転';
    btnAutoRot.classList.add('active');
    if (axisLocked) {
      axisLocked = false;
      btnAxisLock.classList.remove('active');
      btnAxisLock.textContent = '＋ 軸垂直固定';
    }
  }

  var tooltip = document.getElementById('mk-tooltip');
  var activeIdx = -1;
  var canvasRect = {left:0, top:0, width:0, height:0};

  function updateCanvasRect() { canvasRect = canvas.getBoundingClientRect(); }
  window.addEventListener('resize', updateCanvasRect);
  updateCanvasRect();

  function hideTooltip() { tooltip.style.opacity = '0'; activeIdx = -1; }

  function positionTooltip(vx, vy) {
    var isNearTop = vy < canvasRect.top + 80;
    tooltip.style.left = vx + 'px';
    tooltip.style.top  = vy + 'px';
    if (isNearTop) { tooltip.classList.add('below'); } else { tooltip.classList.remove('below'); }
  }

  function showMarkerTooltip(idx, vx, vy) {
    var d = HERITAGE[idx];
    var col = typeColor(d.t);
    tooltip.innerHTML = '<div class="tt-name">' + d.e + ' ' + d.f + ' ' + d.n + '</div><div class="tt-sub"><span style="color:' + col + ';font-weight:600">' + d.t + '</span>  ' + d.c + '  ' + d.y + '年登録</div>';
    if (vx === 0 && vy === 0) {
      var cx = canvasRect.left + canvasRect.width / 2;
      var cy = canvasRect.top + canvasRect.height / 2;
      positionTooltip(cx, cy);
    } else {
      positionTooltip(vx, vy);
    }
    tooltip.style.opacity = '1';
    activeIdx = idx;
    flyTo(d.lat, d.lon);
  }

  // Build marker DOM elements
  var mkEls = [];
  for (var i = 0; i < HERITAGE.length; i++) {
    var d = HERITAGE[i];
    var el = document.createElement('div');
    el.className = 'mk';
    el.textContent = d.e;
    el.style.opacity = '0';
    (function(idx) {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        var r = el.getBoundingClientRect();
        showMarkerTooltip(idx, r.left + r.width/2, r.top + r.height/2);
      });
      el.addEventListener('touchend', function(e) {
        e.preventDefault(); e.stopPropagation();
        var r = el.getBoundingClientRect();
        showMarkerTooltip(idx, r.left + r.width/2, r.top + r.height/2);
      });
    })(i);
    markersDiv.appendChild(el);
    mkEls.push({el: el, pos3d: latLonTo3D(d.lat, d.lon)});
  }

  // Build proximity list DOM (pre-create all items)
  var listItemEls = HERITAGE.map(function(d, i) {
    var col = typeColor(d.t);
    var bg = thumbBg(d.t);
    var el = document.createElement('div');
    el.className = 'site-item';
    el.innerHTML =
      '<div class="site-thumb" style="background:' + bg + '">' + d.e + '</div>' +
      '<div class="site-body">' +
        '<div class="site-top">' +
          '<span class="site-flag">' + d.f + '</span>' +
          '<span class="site-name">' + d.n + '</span>' +
        '</div>' +
        '<div class="site-meta"><span class="type-label" style="color:' + col + '">' + d.t + '</span> · ' + d.c + ' ' + d.y + '年</div>' +
      '</div>';
    el.addEventListener('click', function() { showMarkerTooltip(i, 0, 0); });
    siteList.appendChild(el);
    return el;
  });

  var searchText = '';
  var listUpdateTick = 0;

  function updateProximityList() {
    var order = HERITAGE.map(function(d, i) {
      var p = mkEls[i].pos3d;
      var mz = model[2]*p[0] + model[6]*p[1] + model[10]*p[2];
      return {i: i, mz: mz};
    });
    order.sort(function(a, b) { return b.mz - a.mz; });

    var q = searchText.toLowerCase();
    var visible = 0;
    var frag = document.createDocumentFragment();
    var hidden = [];
    order.forEach(function(item) {
      var d = HERITAGE[item.i];
      var show = !q || d.n.indexOf(q) >= 0 || d.c.indexOf(q) >= 0 || d.t.indexOf(q) >= 0;
      if (show) { frag.appendChild(listItemEls[item.i]); visible++; }
      else { hidden.push(listItemEls[item.i]); }
    });
    hidden.forEach(function(el) { frag.appendChild(el); });
    siteList.appendChild(frag);

    // Toggle visibility
    order.forEach(function(item) {
      var d = HERITAGE[item.i];
      var show = !q || d.n.indexOf(q) >= 0 || d.c.indexOf(q) >= 0 || d.t.indexOf(q) >= 0;
      listItemEls[item.i].style.display = show ? '' : 'none';
    });

    // Highlight active
    listItemEls.forEach(function(el, i) { el.classList.toggle('active', i === activeIdx); });
    resultCount.textContent = q ? (visible + ' / ' + HERITAGE.length + ' 件') : (HERITAGE.length + ' 件');
  }

  searchInput.addEventListener('input', function() {
    searchText = searchInput.value;
    updateProximityList();
  });

  canvas.addEventListener('click', function() { hideTooltip(); });

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

    if (flyTarget !== null) {
      var fp = Math.min((now - flyStart) / FLY_DUR, 1);
      var fe = fp * fp * (3 - 2 * fp);
      rotYv = flyFrom.ry + (flyTarget.ry - flyFrom.ry) * fe;
      rotXv = flyFrom.rx + (flyTarget.rx - flyFrom.rx) * fe;
      if (fp >= 1) flyTarget = null;
    } else {
      if (autoRot) rotYv += 0.003;
      var wasSpinning = Math.abs(momentumY) > 0.0002 || Math.abs(momentumX) > 0.0002;
      if (Math.abs(momentumY) > 0.0002) { rotYv += momentumY; momentumY *= MOMENTUM_DECAY; } else { momentumY = 0; }
      if (!axisLocked && Math.abs(momentumX) > 0.0002) { rotXv = clampElev(rotXv + momentumX); momentumX *= MOMENTUM_DECAY; } else { momentumX = 0; }
      if (axisLocked) rotXv = 0;
      var nowSpinning = Math.abs(momentumY) > 0.0002 || Math.abs(momentumX) > 0.0002;
      if (wasSpinning && !nowSpinning && !autoRot) {
        var bestIdx = -1, bestMz = -1;
        for (var si = 0; si < HERITAGE.length; si++) {
          var sp = mkEls[si] ? mkEls[si].pos3d : null;
          if (!sp) continue;
          var smz = model[2]*sp[0] + model[6]*sp[1] + model[10]*sp[2];
          if (smz > bestMz) { bestMz = smz; bestIdx = si; }
        }
        if (bestIdx >= 0) {
          var bd = HERITAGE[bestIdx];
          showMarkerTooltip(bestIdx, 0, 0);
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
      var mp = mk.pos3d;
      var mz = model[2]*mp[0] + model[6]*mp[1] + model[10]*mp[2];
      if (mz > 0.12) {
        var mcx = mvp[0]*mp[0] + mvp[4]*mp[1] + mvp[8]*mp[2]  + mvp[12];
        var mcy = mvp[1]*mp[0] + mvp[5]*mp[1] + mvp[9]*mp[2]  + mvp[13];
        var mcw = mvp[3]*mp[0] + mvp[7]*mp[1] + mvp[11]*mp[2] + mvp[15];
        if (mcw > 0) {
          var px = (mcx/mcw+1)*0.5*W;
          var py = (1-mcy/mcw)*0.5*H;
          mk.el.style.left = px + 'px';
          mk.el.style.top  = py + 'px';
          mk.el.style.opacity = '1';
          if (mi === activeIdx) {
            positionTooltip(canvasRect.left + px, canvasRect.top + py);
            tooltip.style.opacity = '1';
          }
        } else {
          mk.el.style.opacity = '0';
          if (mi === activeIdx) hideTooltip();
        }
      } else {
        mk.el.style.opacity = '0';
        if (mi === activeIdx) hideTooltip();
      }
    }

    // Update proximity list every 30 frames
    listUpdateTick++;
    if (listUpdateTick >= 30) {
      listUpdateTick = 0;
      updateProximityList();
    }

    frames++;
    var dt = now - lastFps;
    if (dt >= 600) {
      var fps = Math.round(frames * 1000 / dt);
      var clock = new Date();
      var utcH = clock.getUTCHours() + clock.getUTCMinutes() / 60;
      var sunLonDeg = Math.round((12 - utcH) * 15);
      var ew = sunLonDeg >= 0 ? 'E' : 'W';
      var label = earthImg.complete && earthImg.naturalWidth > 0 ? '' : 'テクスチャ読込中 | ';
      hud.textContent = label + 'FPS: ' + fps + '  |  太陽: ' + Math.abs(sunLonDeg) + '°' + ew + '  |  ' + (autoRot ? '自動回転 ON' : '自動回転 OFF');
      frames = 0; lastFps = now;
    }
  }

  updateProximityList();
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
