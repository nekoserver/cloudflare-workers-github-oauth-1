function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function getWebGLSpherePage(username: string): string {
  const safeUser = esc(username);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0d1117">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="地球儀">
<link rel="manifest" href="/manifest.json">
<title>WebGL 地球儀</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { background:#000; color:#e6edf3; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:13px; height:calc(100vh + 100px); display:flex; flex-direction:column; overflow:hidden; }
.topbar { background:#0d1117; border-bottom:1px solid #30363d; padding:8px 18px; display:flex; align-items:center; gap:10px; flex-shrink:0; }
.topbar a { color:#58a6ff; text-decoration:none; font-size:12px; }
h1 { font-size:14px; font-weight:700; }
.badge { background:#0c2d4e; color:#58a6ff; font-size:10px; padding:2px 7px; border-radius:10px; font-weight:600; }
.body { display:grid; grid-template-columns:1fr 280px; grid-template-rows:1fr; flex:1; min-height:0; }
@media(max-width:700px){ .body{ grid-template-columns:1fr; } .side{ display:none; } }
.canvas-wrap { position:relative; background:#000010; overflow:hidden; }
canvas { position:absolute; inset:0; width:100%; height:100%; cursor:grab; touch-action:none; display:block; }
canvas:active { cursor:grabbing; }
.hud { position:absolute; top:10px; left:10px; background:rgba(0,0,0,.7); border:1px solid #30363d; border-radius:6px; padding:6px 10px; font-size:11px; font-family:monospace; color:#58a6ff; line-height:1.9; pointer-events:none; }
#markers { position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; overflow:hidden; }
.mk { position:absolute; transform:translate(-50%,-50%); line-height:1; font-size:18px; text-shadow:0 1px 3px #000,0 0 8px rgba(0,0,0,0.9); pointer-events:auto; cursor:pointer; user-select:none; -webkit-user-select:none; }
.mk-ball { font-size:28px; }
#mk-tooltip { position:fixed; background:rgba(13,17,23,0.97); border:1px solid #58a6ff; border-radius:8px; padding:7px 12px; font-size:12px; color:#e6edf3; white-space:nowrap; pointer-events:none; opacity:0; transition:opacity .15s; z-index:60; transform:translate(-50%,-110%); line-height:1.7; }
#mk-tooltip.below { transform:translate(-50%, 14px); }
#mk-tooltip .tt-name { font-weight:700; font-size:13px; }
#mk-tooltip .tt-match { font-size:12px; margin-top:3px; }
#mk-tooltip .tt-flags { font-size:18px; letter-spacing:2px; }
#mk-tooltip .tt-time { color:#58a6ff; font-family:monospace; }
#mk-tooltip .tt-past { color:#555d68; }
.mk.elim { filter:grayscale(0.85) brightness(0.28) saturate(0.15); }
#schedule-panel { position:fixed; bottom:0; left:0; right:0; z-index:55; background:#0d1117; border-top:2px solid #58a6ff; border-radius:12px 12px 0 0; max-height:68vh; overflow-y:auto; transform:translateY(100%); transition:transform .3s ease; box-shadow:0 -4px 30px rgba(0,0,0,.8); }
#schedule-panel.open { transform:translateY(0); }
.sp-hdr { display:flex; align-items:center; justify-content:space-between; padding:12px 16px 8px; border-bottom:1px solid #30363d; position:sticky; top:0; background:#0d1117; z-index:1; }
.sp-title { font-size:13px; font-weight:700; color:#58a6ff; }
.sp-close { background:none; border:none; color:#8b949e; font-size:22px; line-height:1; cursor:pointer; padding:0 2px; }
.sp-date { padding:8px 16px 4px; font-size:10px; font-weight:700; color:#8b949e; text-transform:uppercase; letter-spacing:1px; }
.sp-match { display:flex; justify-content:space-between; align-items:center; padding:7px 16px; border-bottom:1px solid #21262d; }
.sp-match:last-child { border-bottom:none; }
.sp-flags { font-size:18px; letter-spacing:2px; }
.sp-time { font-family:monospace; font-size:12px; color:#58a6ff; }
.sp-match.sp-past { opacity:0.45; }
.sp-match.sp-today { background:rgba(88,166,255,0.07); }
.side { background:#0d1117; border-left:1px solid #30363d; overflow-y:auto; padding:16px; }
.side h2 { font-size:11px; font-weight:700; color:#58a6ff; text-transform:uppercase; letter-spacing:.5px; margin-bottom:10px; }
.item { margin-bottom:12px; }
.item-title { font-weight:600; font-size:12px; margin-bottom:3px; }
.item-desc { color:#8b949e; font-size:11px; line-height:1.6; }
code { background:#21262d; padding:1px 5px; border-radius:3px; font-family:monospace; font-size:10px; }
hr { border:none; border-top:1px solid #30363d; margin:12px 0; }
.tip { background:#0c2d4e; border-radius:6px; padding:8px 10px; font-size:11px; color:#8b949e; line-height:1.7; margin-bottom:12px; }
@media (display-mode: standalone) { .pwa-hide { display:none !important; } }
.ctrl-row { margin-bottom:10px; }
.ctrl-label { font-size:11px; color:#8b949e; margin-bottom:4px; }
.slider-row { display:flex; align-items:center; gap:8px; }
input[type=range] { flex:1; accent-color:#58a6ff; }
.sval { font-family:monospace; font-size:11px; color:#58a6ff; min-width:36px; }
.canvas-ctrl-btns { position:absolute; bottom:14px; right:14px; display:flex; flex-direction:column; gap:6px; z-index:5; }
.canvas-ctrl-btn { background:rgba(13,17,23,0.88); border:1px solid #30363d; border-radius:6px; color:#e6edf3; font-size:12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; padding:6px 12px; cursor:pointer; white-space:nowrap; transition:background .15s,border-color .15s,color .15s; text-align:left; }
.canvas-ctrl-btn:hover { background:rgba(13,17,23,1); border-color:#58a6ff; }
.canvas-ctrl-btn.active { background:#0c2d4e; border-color:#58a6ff; color:#58a6ff; }
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
  <h1>WebGL 地球儀</h1>
  <span class="badge">WebGL</span>
  <span style="flex:1"></span>
  <a href="/webgl-demo" class="pwa-hide">3D Cube</a>
  <a href="/htmlrewriter-demo" class="pwa-hide">HTMLRewriter</a>
  <a href="/settings" class="pwa-hide">&#9881;</a>
  <span class="pwa-hide" style="color:#8b949e;font-size:11px">${safeUser}</span>
</div>

<div class="body">
  <div class="canvas-wrap">
    <canvas id="c"></canvas>
    <div id="markers"></div>
    <div class="hud" id="hud">テクスチャ読み込み中...</div>
    <div class="canvas-ctrl-btns">
      <button class="canvas-ctrl-btn" id="btnAxisLock" title="地軸を画面に対して垂直に固定するモード">＋ 軸垂直固定</button>
      <button class="canvas-ctrl-btn" id="btnAutoRot" title="自転の停止/再開">⏸ 自転停止</button>
    </div>
  </div>
  <div class="side">
    <div class="tip">ドラッグ: 回転 | ホイール: ズーム | ダブルクリック: 自動回転 ON/OFF<br>&#9917; = 2026 FIFAワールドカップ開催地（北米） | 各国旗 = 出場48ヵ国</div>

    <h2>コントロール</h2>
    <div class="ctrl-row">
      <div class="ctrl-label">自転速度</div>
      <div class="slider-row">
        <input type="range" id="rotSpd" min="0" max="5" step="0.1" value="1">
        <span class="sval" id="rotSpdVal">1.0</span>
      </div>
    </div>

    <hr>
    <h2>実装ポイント</h2>

    <div class="item">
      <div class="item-title">テクスチャ（NASA Blue Marble）</div>
      <div class="item-desc">NASA が公開する Blue Marble 2048×1024 の正距円筒図法画像を Workers Static Assets で配信。<code>/earth.jpg</code> として同一オリジンから取得するため CORS 不要。</div>
    </div>
    <div class="item">
      <div class="item-title">海洋スペキュラー</div>
      <div class="item-desc">フラグメントシェーダーでテクスチャの B-R 差分から海陸を推定し、海面にのみブリン・フォン鏡面反射を適用。</div>
    </div>
    <div class="item">
      <div class="item-title">大気散乱グロー</div>
      <div class="item-desc">法線と視線内積の 3 乗から縁付近を検出。青を 2 段で加算し地球縁の大気発光を表現。</div>
    </div>
    <div class="item">
      <div class="item-title">Workers Static Assets</div>
      <div class="item-desc"><code>wrangler.toml</code> に <code>assets = &#123; directory = "./public" &#125;</code> を追記。<code>public/</code> 内のファイルが Worker を経由せず Cloudflare CDN から直配信される。</div>
    </div>
  </div>
</div>

<div id="mk-tooltip"></div>
<div id="schedule-panel">
  <div class="sp-hdr">
    <span class="sp-title">&#9917; 2026 FIFA W杯 試合スケジュール</span>
    <button class="sp-close" id="spClose">&#10005;</button>
  </div>
  <div id="sp-body"></div>
</div>

<script>
(function() {
  var canvas = document.getElementById("c");
  var wrap   = canvas.parentElement;
  var hud    = document.getElementById("hud");
  var markersDiv = document.getElementById("markers");

  function resize() {
    var r = wrap.getBoundingClientRect();
    var w = Math.round(r.width);
    var h = Math.round(r.height);
    if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
      canvas.width  = w;
      canvas.height = h;
    }
  }
  resize();
  window.addEventListener("resize", resize);

  var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (!gl) { hud.textContent = "WebGL が利用できません"; return; }

  function compileShader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  var prog = gl.createProgram();
  gl.attachShader(prog, compileShader(gl.VERTEX_SHADER,   document.getElementById("vs").textContent));
  gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, document.getElementById("fs").textContent));
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
  var aPos  = gl.getAttribLocation(prog, "aPos");
  var aNorm = gl.getAttribLocation(prog, "aNorm");
  var aUV   = gl.getAttribLocation(prog, "aUV");
  gl.enableVertexAttribArray(aPos);  gl.vertexAttribPointer(aPos,  3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(aNorm); gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, stride, 12);
  gl.enableVertexAttribArray(aUV);   gl.vertexAttribPointer(aUV,   2, gl.FLOAT, false, stride, 24);

  var uMVP   = gl.getUniformLocation(prog, "uMVP");
  var uModel = gl.getUniformLocation(prog, "uModel");
  var uLight = gl.getUniformLocation(prog, "uLight");
  var uTex   = gl.getUniformLocation(prog, "uTex");
  gl.uniform1i(uTex, 0);

  function getSunDir() {
    var now = new Date();
    var utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    var sunLon = (utcH - 12) / 24 * 2 * Math.PI;
    var start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    var doy = Math.floor((now.getTime() - start.getTime()) / 86400000);
    var sunLat = 23.45 * Math.PI / 180 * Math.sin(2 * Math.PI * (doy - 80) / 365);
    return [
      Math.cos(sunLat) * Math.cos(sunLon),
      Math.sin(sunLat),
      Math.cos(sunLat) * Math.sin(sunLon)
    ];
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
  earthImg.onerror = function() {
    hud.textContent = "テクスチャ読み込み失敗 — /earth.jpg が見つかりません";
  };
  earthImg.src = "/earth.jpg";

  function m4()      { return new Float32Array(16); }
  function ident(m)  { for(var i=0;i<16;i++) m[i]=0; m[0]=m[5]=m[10]=m[15]=1; return m; }
  function mul(o,a,b){
    for(var i=0;i<4;i++) for(var j=0;j<4;j++){
      var s=0; for(var k=0;k<4;k++) s+=a[i+k*4]*b[k+j*4]; o[i+j*4]=s;
    } return o;
  }
  function persp(m,fov,asp,near,far){
    ident(m); var f=1/Math.tan(fov/2);
    m[0]=f/asp; m[5]=f; m[10]=(far+near)/(near-far); m[11]=-1;
    m[14]=2*far*near/(near-far); m[15]=0; return m;
  }
  function rotX(m,r){ ident(m); var c=Math.cos(r),s=Math.sin(r); m[5]=c;m[6]=s;m[9]=-s;m[10]=c; return m; }
  function rotY(m,r){ ident(m); var c=Math.cos(r),s=Math.sin(r); m[0]=c;m[2]=-s;m[8]=s;m[10]=c; return m; }
  function rotZ(m,r){ ident(m); var c=Math.cos(r),s=Math.sin(r); m[0]=c;m[1]=s;m[4]=-s;m[5]=c; return m; }
  function trans(m,x,y,z){ ident(m); m[12]=x;m[13]=y;m[14]=z; return m; }

  var axialTilt = -23.4 * Math.PI / 180;
  var ELEV_MAX = Math.PI / 2 - 0.02;
  function clampElev(v){ return v < -ELEV_MAX ? -ELEV_MAX : (v > ELEV_MAX ? ELEV_MAX : v); }

  var proj=m4(),view=m4(),model=m4(),rx=m4(),ry=m4(),tz=m4(),tmp=m4(),tmp2=m4(),mvp=m4();
  var rotXv = 0.3, rotYv = 0.6, zoom = 3.2, autoRot = true;
  var drag = false, lx = 0, ly = 0, pinch0 = 0;

  var axisLocked = false;

  var btnAxisLock = document.getElementById("btnAxisLock");
  var btnAutoRot  = document.getElementById("btnAutoRot");

  btnAxisLock.addEventListener("click", function() {
    axisLocked = !axisLocked;
    if (axisLocked) {
      rotXv = 0;
      btnAxisLock.classList.add("active");
      btnAxisLock.textContent = "＋ 軸固定中";
    } else {
      btnAxisLock.classList.remove("active");
      btnAxisLock.textContent = "＋ 軸垂直固定";
    }
  });

  btnAutoRot.addEventListener("click", function() {
    autoRot = !autoRot;
    btnAutoRot.textContent = autoRot ? "⏸ 自転停止" : "▶ 回転";
    if (autoRot) { btnAutoRot.classList.remove("active"); } else { btnAutoRot.classList.add("active"); }
  });

  var rotSpdEl    = document.getElementById("rotSpd");
  var rotSpdValEl = document.getElementById("rotSpdVal");
  rotSpdEl.addEventListener("input", function(){ rotSpdValEl.textContent = parseFloat(rotSpdEl.value).toFixed(1); });

  canvas.addEventListener("mousedown",  function(e){ drag=true; lx=e.clientX; ly=e.clientY; });
  window.addEventListener("mouseup",    function(){ drag=false; });
  window.addEventListener("mousemove",  function(e){ if(!drag)return; rotYv+=(e.clientX-lx)*0.008; if(!axisLocked){ rotXv=clampElev(rotXv+(e.clientY-ly)*0.008); } lx=e.clientX; ly=e.clientY; });
  canvas.addEventListener("wheel",      function(e){ e.preventDefault(); zoom=Math.max(1.6,Math.min(10,zoom+e.deltaY*0.01)); },{passive:false});
  canvas.addEventListener("dblclick",   function(){ autoRot=!autoRot; btnAutoRot.textContent = autoRot ? "⏸ 自転停止" : "▶ 回転"; if(autoRot){btnAutoRot.classList.remove("active");}else{btnAutoRot.classList.add("active");} });
  canvas.addEventListener("touchstart", function(e){ e.preventDefault(); if(e.touches.length===1){drag=true;lx=e.touches[0].clientX;ly=e.touches[0].clientY;} if(e.touches.length===2){pinch0=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);} },{passive:false});
  canvas.addEventListener("touchmove",  function(e){ e.preventDefault(); if(e.touches.length===1&&drag){rotYv+=(e.touches[0].clientX-lx)*0.008; if(!axisLocked){rotXv=clampElev(rotXv+(e.touches[0].clientY-ly)*0.008);}lx=e.touches[0].clientX;ly=e.touches[0].clientY;} if(e.touches.length===2){var d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);zoom=Math.max(1.6,Math.min(10,zoom-(d-pinch0)*0.02));pinch0=d;} },{passive:false});
  canvas.addEventListener("touchend",   function(){ drag=false; });

  // 2026 FIFAワールドカップ出場国（⚽=開催地マーカー）
  var wc2026 = [
    {flag:"⚽", name:"2026 FIFA W杯 開催地", lat:34, lon:-99, ball:true},
    {flag:"🇺🇸", name:"アメリカ合衆国", lat:39, lon:-95},
    {flag:"🇨🇦", name:"カナダ", lat:56, lon:-96},
    {flag:"🇲🇽", name:"メキシコ", lat:23, lon:-102},
    {flag:"🇵🇦", name:"パナマ", lat:9, lon:-80},
    {flag:"🇨🇷", name:"コスタリカ", lat:10, lon:-84},
    {flag:"🇭🇳", name:"ホンジュラス", lat:15, lon:-87},
    {flag:"🇦🇷", name:"アルゼンチン", lat:-34, lon:-64},
    {flag:"🇧🇷", name:"ブラジル", lat:-10, lon:-53},
    {flag:"🇨🇴", name:"コロンビア", lat:4, lon:-72},
    {flag:"🇺🇾", name:"ウルグアイ", lat:-33, lon:-56},
    {flag:"🇪🇨", name:"エクアドル", lat:-2, lon:-78},
    {flag:"🇵🇾", name:"パラグアイ", lat:-23, lon:-58},
    {flag:"🇻🇪", name:"ベネズエラ", lat:8, lon:-66},
    {flag:"🇪🇸", name:"スペイン", lat:40, lon:-4},
    {flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", name:"イングランド", lat:52, lon:-1},
    {flag:"🇫🇷", name:"フランス", lat:46, lon:2},
    {flag:"🇩🇪", name:"ドイツ", lat:51, lon:10},
    {flag:"🇵🇹", name:"ポルトガル", lat:39, lon:-8},
    {flag:"🇳🇱", name:"オランダ", lat:52, lon:5},
    {flag:"🇮🇹", name:"イタリア", lat:42, lon:12},
    {flag:"🇧🇪", name:"ベルギー", lat:50, lon:4},
    {flag:"🇭🇷", name:"クロアチア", lat:45, lon:16},
    {flag:"🇦🇹", name:"オーストリア", lat:47, lon:14},
    {flag:"🇨🇭", name:"スイス", lat:47, lon:8},
    {flag:"🇩🇰", name:"デンマーク", lat:56, lon:10},
    {flag:"🇷🇸", name:"セルビア", lat:44, lon:21},
    {flag:"🇹🇷", name:"トルコ", lat:39, lon:35},
    {flag:"🏴󠁧󠁢󠁳󠁣󠁴󠁿", name:"スコットランド", lat:57, lon:-4},
    {flag:"🇸🇰", name:"スロバキア", lat:48, lon:19},
    {flag:"🇲🇦", name:"モロッコ", lat:32, lon:-6},
    {flag:"🇳🇬", name:"ナイジェリア", lat:10, lon:8},
    {flag:"🇸🇳", name:"セネガル", lat:14, lon:-14},
    {flag:"🇪🇬", name:"エジプト", lat:26, lon:30},
    {flag:"🇨🇮", name:"コートジボワール", lat:7, lon:-5},
    {flag:"🇿🇦", name:"南アフリカ", lat:-29, lon:25},
    {flag:"🇨🇩", name:"コンゴ民主共和国", lat:-4, lon:24},
    {flag:"🇬🇭", name:"ガーナ", lat:8, lon:-1},
    {flag:"🇩🇿", name:"アルジェリア", lat:28, lon:3},
    {flag:"🇹🇳", name:"チュニジア", lat:34, lon:9},
    {flag:"🇯🇵", name:"日本", lat:36, lon:138},
    {flag:"🇰🇷", name:"韓国", lat:36, lon:128},
    {flag:"🇮🇷", name:"イラン", lat:32, lon:53},
    {flag:"🇮🇶", name:"イラク", lat:33, lon:44},
    {flag:"🇦🇺", name:"オーストラリア", lat:-27, lon:133},
    {flag:"🇯🇴", name:"ヨルダン", lat:31, lon:36},
    {flag:"🇺🇿", name:"ウズベキスタン", lat:41, lon:64},
    {flag:"🇸🇦", name:"サウジアラビア", lat:24, lon:45},
    {flag:"🇳🇿", name:"ニュージーランド", lat:-41, lon:174},
    {flag:"🇮🇩", name:"インドネシア", lat:-7, lon:117}
  ];

  function latLonTo3D(lat, lon) {
    var latR = lat * Math.PI / 180;
    var lonR = lon * Math.PI / 180;
    return [
      Math.cos(latR) * Math.cos(lonR),
      Math.sin(latR),
      -Math.cos(latR) * Math.sin(lonR)
    ];
  }

  var GD = [
    {t:["🇺🇸","🇵🇦","🇺🇾","🇸🇦"],d1:"2026-06-12",d2:"2026-06-19",d3:"2026-06-26"},
    {t:["🇨🇦","🇨🇷","🇦🇷","🇩🇿"],d1:"2026-06-13",d2:"2026-06-20",d3:"2026-06-27"},
    {t:["🇲🇽","🇭🇳","🇪🇨","🇲🇦"],d1:"2026-06-13",d2:"2026-06-20",d3:"2026-06-27"},
    {t:["🇧🇷","🇻🇪","🇯🇵","🇳🇿"],d1:"2026-06-14",d2:"2026-06-21",d3:"2026-06-28"},
    {t:["🇨🇴","🇵🇾","🇰🇷","🇳🇬"],d1:"2026-06-14",d2:"2026-06-21",d3:"2026-06-28"},
    {t:["🇪🇸","🇷🇸","🇸🇳","🇮🇩"],d1:"2026-06-15",d2:"2026-06-22",d3:"2026-06-29"},
    {t:["🇫🇷","🇦🇹","🇪🇬","🇯🇴"],d1:"2026-06-15",d2:"2026-06-22",d3:"2026-06-29"},
    {t:["🇩🇪","🇭🇷","🇬🇭","🇺🇿"],d1:"2026-06-16",d2:"2026-06-23",d3:"2026-06-30"},
    {t:["🏴󠁧󠁢󠁥󠁮󠁧󠁿","🇧🇪","🇮🇷","🇨🇩"],d1:"2026-06-16",d2:"2026-06-23",d3:"2026-06-30"},
    {t:["🇵🇹","🇩🇰","🇨🇮","🇹🇷"],d1:"2026-06-17",d2:"2026-06-24",d3:"2026-07-01"},
    {t:["🇳🇱","🇨🇭","🏴󠁧󠁢󠁳󠁣󠁴󠁿","🇮🇶"],d1:"2026-06-17",d2:"2026-06-24",d3:"2026-07-01"},
    {t:["🇮🇹","🇸🇰","🇿🇦","🇹🇳"],d1:"2026-06-18",d2:"2026-06-25",d3:"2026-07-02"}
  ];
  var PAIRS = [[0,1,"18:00"],[2,3,"21:00"],[0,2,"18:00"],[1,3,"21:00"],[0,3,"21:00"],[1,2,"18:00"]];
  var teamMatches = {};
  var ELIMINATED = {};
  GD.forEach(function(g) {
    var ds = [g.d1, g.d2, g.d3];
    PAIRS.forEach(function(p, pi) {
      var a = g.t[p[0]], b = g.t[p[1]], d = ds[Math.floor(pi/2)], ti = p[2];
      if (!teamMatches[a]) teamMatches[a] = [];
      if (!teamMatches[b]) teamMatches[b] = [];
      teamMatches[a].push({opp:b, date:d, time:ti});
      teamMatches[b].push({opp:a, date:d, time:ti});
    });
  });

  function getNextMatch(flag) {
    var ms = teamMatches[flag];
    if (!ms) return null;
    var now = Date.now();
    for (var i = 0; i < ms.length; i++) {
      var ko = new Date(ms[i].date + "T" + ms[i].time + ":00Z").getTime();
      if (ko > now - 110*60000) return {m: ms[i], past: ko < now, ko: ko};
    }
    return {m: ms[ms.length-1], past: true, ko: 0};
  }

  var flyTarget = null, flyFrom = null, flyStart = 0;
  var FLY_DUR = 1400;

  function flyTo(lat, lon) {
    var ty = -(Math.PI/2 + lon * Math.PI/180);
    var tx = -lat * Math.PI/180;
    var dy = ty - rotYv;
    while (dy > Math.PI) dy -= 2*Math.PI;
    while (dy < -Math.PI) dy += 2*Math.PI;
    flyFrom = {ry: rotYv, rx: rotXv};
    flyTarget = {ry: rotYv + dy, rx: tx};
    flyStart = performance.now();
    autoRot = false;
    btnAutoRot.textContent = "▶ 回転";
    btnAutoRot.classList.add("active");
    if (axisLocked) {
      axisLocked = false;
      btnAxisLock.classList.remove("active");
      btnAxisLock.textContent = "＋ 軸垂直固定";
    }
  }

  var tooltip = document.getElementById("mk-tooltip");
  var schedulePanel = document.getElementById("schedule-panel");
  var spBody = document.getElementById("sp-body");
  var activeMarkerIdx = -1;
  var canvasRect = {left:0, top:0, width:0, height:0};

  function updateCanvasRect() { canvasRect = canvas.getBoundingClientRect(); }
  window.addEventListener("resize", updateCanvasRect);
  updateCanvasRect();

  function hideTooltip() { tooltip.style.opacity = "0"; activeMarkerIdx = -1; }

  function positionTooltip(vx, vy) {
    var isNearTop = vy < canvasRect.top + 80;
    tooltip.style.left = vx + "px";
    tooltip.style.top  = vy + "px";
    if (isNearTop) { tooltip.classList.add("below"); } else { tooltip.classList.remove("below"); }
  }

  function buildMatchHtml(flag, name) {
    var nm = '<div class="tt-name">' + name + '</div>';
    var info = getNextMatch(flag);
    if (!info) return nm;
    var m = info.m;
    var md = m.date.slice(5).replace("-", "/");
    if (info.past) {
      return nm + '<div class="tt-match tt-past"><span class="tt-flags">' + flag + ' - ' + m.opp + '</span>  ' + md + ' ' + m.time + ' UTC 終了</div>';
    }
    return nm + '<div class="tt-match"><span class="tt-flags">' + flag + ' - ' + m.opp + '</span>  ' + md + ' <span class="tt-time">' + m.time + ' UTC</span></div>';
  }

  function showTooltip(idx, vx, vy) {
    var d = wc2026[idx];
    if (d.ball) { showSchedulePanel(); return; }
    tooltip.innerHTML = buildMatchHtml(d.flag, d.name);
    positionTooltip(vx, vy);
    tooltip.style.opacity = "1";
    activeMarkerIdx = idx;
    flyTo(d.lat, d.lon);
  }

  function showSchedulePanel() {
    var todayStr = new Date().toISOString().slice(0, 10);
    var allMatches = [];
    var PAIRS2 = [[0,1,"18:00"],[2,3,"21:00"],[0,2,"18:00"],[1,3,"21:00"],[0,3,"21:00"],[1,2,"18:00"]];
    GD.forEach(function(g) {
      var ds = [g.d1, g.d2, g.d3];
      PAIRS2.forEach(function(p, pi) {
        var d = ds[Math.floor(pi/2)];
        if (d >= todayStr) {
          allMatches.push({date:d, time:p[2], a:g.t[p[0]], b:g.t[p[1]]});
        }
      });
    });
    allMatches.sort(function(a, b) { return (a.date + a.time) < (b.date + b.time) ? -1 : 1; });
    var html = "";
    var lastDate = "";
    var nowMs = Date.now();
    allMatches.forEach(function(m) {
      if (m.date !== lastDate) {
        var label = m.date === todayStr ? "本日 " + m.date.slice(5).replace("-","/") : m.date.slice(5).replace("-","/");
        html += '<div class="sp-date">' + label + '</div>';
        lastDate = m.date;
      }
      var koMs = new Date(m.date + "T" + m.time + ":00Z").getTime();
      var isPast = koMs < nowMs - 110*60000;
      var isTod  = m.date === todayStr;
      var cls = "sp-match" + (isPast ? " sp-past" : "") + (isTod && !isPast ? " sp-today" : "");
      html += '<div class="' + cls + '"><span class="sp-flags">' + m.a + ' - ' + m.b + '</span><span class="sp-time">' + m.time + ' UTC</span></div>';
    });
    spBody.innerHTML = html || '<div style="padding:16px;color:#8b949e">本日以降の試合はありません</div>';
    schedulePanel.classList.add("open");
    hideTooltip();
  }

  document.getElementById("spClose").addEventListener("click", function() {
    schedulePanel.classList.remove("open");
  });

  var mkEls = [];
  for (var mi = 0; mi < wc2026.length; mi++) {
    var mdata = wc2026[mi];
    var mel = document.createElement("div");
    mel.className = "mk" + (mdata.ball ? " mk-ball" : "") + (ELIMINATED[mdata.flag] ? " elim" : "");
    mel.textContent = mdata.flag;
    mel.style.opacity = "0";
    mel.dataset.name = mdata.name;
    (function(idx) {
      mel.addEventListener("click", function(e) {
        e.stopPropagation();
        var r = mel.getBoundingClientRect();
        showTooltip(idx, r.left + r.width/2, r.top + r.height/2);
      });
      mel.addEventListener("touchend", function(e) {
        e.preventDefault();
        e.stopPropagation();
        var r = mel.getBoundingClientRect();
        showTooltip(idx, r.left + r.width/2, r.top + r.height/2);
      });
    })(mi);
    markersDiv.appendChild(mel);
    mkEls.push({el: mel, pos3d: latLonTo3D(mdata.lat, mdata.lon)});
  }

  canvas.addEventListener("click", function() { hideTooltip(); schedulePanel.classList.remove("open"); });

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

    var t = (now - startTime) * 0.001;
    var spd = parseFloat(rotSpdEl.value);
    if (flyTarget !== null) {
      var fp = Math.min((now - flyStart) / FLY_DUR, 1);
      var fe = fp * fp * (3 - 2 * fp);
      rotYv = flyFrom.ry + (flyTarget.ry - flyFrom.ry) * fe;
      rotXv = flyFrom.rx + (flyTarget.rx - flyFrom.rx) * fe;
      if (fp >= 1) flyTarget = null;
    } else {
      if (autoRot) rotYv += 0.003 * spd;
      if (axisLocked) rotXv = 0;
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
          mk.el.style.left = px + "px";
          mk.el.style.top  = py + "px";
          mk.el.style.opacity = "1";
          if (mi === activeMarkerIdx) {
            positionTooltip(canvasRect.left + px, canvasRect.top + py);
          }
        } else {
          mk.el.style.opacity = "0";
          if (mi === activeMarkerIdx) hideTooltip();
        }
      } else {
        mk.el.style.opacity = "0";
        if (mi === activeMarkerIdx) hideTooltip();
      }
    }

    frames++;
    var dt = now - lastFps;
    if (dt >= 600) {
      var fps = Math.round(frames * 1000 / dt);
      var clock = new Date();
      var utcH = clock.getUTCHours() + clock.getUTCMinutes() / 60;
      var sunLonDeg = Math.round((12 - utcH) * 15);
      var ew = sunLonDeg >= 0 ? "E" : "W";
      var label = earthImg.complete && earthImg.naturalWidth > 0 ? "" : "テクスチャ読込中 | ";
      hud.textContent = label + "FPS: " + fps + "  |  太陽: " + Math.abs(sunLonDeg) + "°" + ew + "  |  " + (autoRot ? "自動回転 ON" : "自動回転 OFF");
      frames = 0; lastFps = now;
    }
  }
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
