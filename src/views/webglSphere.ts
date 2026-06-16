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
<title>WebGL 地球儀</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { background:#000; color:#e6edf3; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:13px; height:100vh; display:flex; flex-direction:column; overflow:hidden; }
.topbar { background:#0d1117; border-bottom:1px solid #30363d; padding:8px 18px; display:flex; align-items:center; gap:10px; flex-shrink:0; }
.topbar a { color:#58a6ff; text-decoration:none; font-size:12px; }
h1 { font-size:14px; font-weight:700; }
.badge { background:#0c2d4e; color:#58a6ff; font-size:10px; padding:2px 7px; border-radius:10px; font-weight:600; }
.body { display:grid; grid-template-columns:1fr 280px; flex:1; min-height:0; }
@media(max-width:700px){ .body{ grid-template-columns:1fr; } .side{ display:none; } }
.canvas-wrap { position:relative; background:#000010; }
canvas { display:block; width:100%; height:100%; cursor:grab; touch-action:none; }
canvas:active { cursor:grabbing; }
.hud { position:absolute; top:10px; left:10px; background:rgba(0,0,0,.7); border:1px solid #30363d; border-radius:6px; padding:6px 10px; font-size:11px; font-family:monospace; color:#58a6ff; line-height:1.9; pointer-events:none; }
.side { background:#0d1117; border-left:1px solid #30363d; overflow-y:auto; padding:16px; }
.side h2 { font-size:11px; font-weight:700; color:#58a6ff; text-transform:uppercase; letter-spacing:.5px; margin-bottom:10px; }
.item { margin-bottom:12px; }
.item-title { font-weight:600; font-size:12px; margin-bottom:3px; }
.item-desc { color:#8b949e; font-size:11px; line-height:1.6; }
code { background:#21262d; padding:1px 5px; border-radius:3px; font-family:monospace; font-size:10px; }
hr { border:none; border-top:1px solid #30363d; margin:12px 0; }
.tip { background:#0c2d4e; border-radius:6px; padding:8px 10px; font-size:11px; color:#8b949e; line-height:1.7; margin-bottom:12px; }
.ctrl-row { margin-bottom:10px; }
.ctrl-label { font-size:11px; color:#8b949e; margin-bottom:4px; }
.slider-row { display:flex; align-items:center; gap:8px; }
input[type=range] { flex:1; accent-color:#58a6ff; }
.sval { font-family:monospace; font-size:11px; color:#58a6ff; min-width:36px; }
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
uniform sampler2D uCloud;
uniform float uTime;
uniform float uRotSpeed;
varying vec2 vUV;
varying float vDiff;
varying float vSpec;
varying float vRim;
void main() {
  vec4 earth = texture2D(uTex, vUV);
  float isOcean = clamp((earth.b - earth.r * 0.8 - earth.g * 0.3) * 3.0, 0.0, 1.0);
  vec2 cuv = vec2(mod(vUV.x + uTime * uRotSpeed * 0.04, 1.0), vUV.y);
  vec4 cloud = texture2D(uCloud, cuv);
  float amb = 0.1;
  vec3 col = earth.rgb * (amb + vDiff * (1.0 - amb));
  col += vec3(0.7, 0.85, 1.0) * vSpec * isOcean * 0.5;
  col = mix(col, vec3(1.0), cloud.r * (amb + vDiff) * 0.85);
  col += vec3(0.25, 0.55, 1.0) * vRim * 0.55;
  col += vec3(0.1,  0.3,  0.9) * vRim * vRim * 0.3;
  gl_FragColor = vec4(col, 1.0);
}
</script>

<div class="topbar">
  <h1>WebGL 地球儀</h1>
  <span class="badge">WebGL</span>
  <span style="flex:1"></span>
  <a href="/webgl-demo">3D Cube</a>
  <a href="/htmlrewriter-demo">HTMLRewriter</a>
  <a href="/settings">⚙</a>
  <span style="color:#8b949e;font-size:11px">${safeUser}</span>
</div>

<div class="body">
  <div class="canvas-wrap">
    <canvas id="c"></canvas>
    <div class="hud" id="hud">テクスチャ読み込み中...</div>
  </div>
  <div class="side">
    <div class="tip">ドラッグ: 回転 | ホイール: ズーム | ダブルクリック: 自動回転 ON/OFF</div>

    <h2>コントロール</h2>
    <div class="ctrl-row">
      <div class="ctrl-label">自転速度</div>
      <div class="slider-row">
        <input type="range" id="rotSpd" min="0" max="5" step="0.1" value="1">
        <span class="sval" id="rotSpdVal">1.0</span>
      </div>
    </div>
    <div class="ctrl-row">
      <div class="ctrl-label">雲の流れ速度</div>
      <div class="slider-row">
        <input type="range" id="cloudSpd" min="0" max="5" step="0.1" value="1">
        <span class="sval" id="cloudSpdVal">1.0</span>
      </div>
    </div>

    <hr>
    <h2>実装ポイント</h2>

    <div class="item">
      <div class="item-title">テクスチャ（NASA Blue Marble）</div>
      <div class="item-desc">NASA が公開する Blue Marble 2048×1024 の正距円筒図法画像を Workers Static Assets で配信。<code>/earth.jpg</code> として同一オリジンから取得するため CORS 不要。</div>
    </div>
    <div class="item">
      <div class="item-title">雲レイヤー（Canvas 2D 手続き生成）</div>
      <div class="item-desc">512×256 の Canvas にパーリン風ノイズで雲模様を生成。<code>uTime * uRotSpeed</code> で UV を横スクロールさせ、地表と異なる速度で流す。</div>
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

<script>
(function() {
  var canvas = document.getElementById("c");
  var wrap   = canvas.parentElement;
  var hud    = document.getElementById("hud");

  function resize() {
    canvas.width  = wrap.clientWidth;
    canvas.height = wrap.clientHeight;
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

  // ── 球体ジオメトリ ──
  var LAT = 64, LON = 128;
  var verts = [], idxs = [];
  for (var i = 0; i <= LAT; i++) {
    var theta = i / LAT * Math.PI;
    var sinT = Math.sin(theta), cosT = Math.cos(theta);
    for (var j = 0; j <= LON; j++) {
      var phi = j / LON * 2 * Math.PI;
      var x = sinT * Math.cos(phi), y = cosT, z = sinT * Math.sin(phi);
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

  var uMVP      = gl.getUniformLocation(prog, "uMVP");
  var uModel    = gl.getUniformLocation(prog, "uModel");
  var uLight    = gl.getUniformLocation(prog, "uLight");
  var uTex      = gl.getUniformLocation(prog, "uTex");
  var uCloud    = gl.getUniformLocation(prog, "uCloud");
  var uTime     = gl.getUniformLocation(prog, "uTime");
  var uRotSpeed = gl.getUniformLocation(prog, "uRotSpeed");
  gl.uniform3f(uLight, 2.0, 1.5, 2.5);
  gl.uniform1i(uTex,   0);
  gl.uniform1i(uCloud, 1);

  // ── 地球テクスチャ（/earth.jpg からロード）──
  var texEarth = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texEarth);
  // ロード中プレースホルダー（深青 1x1）
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

  // ── 雲テクスチャ（Canvas 2D 手続き生成）──
  function makeCloudTex() {
    var W = 512, H = 256;
    var tc = document.createElement("canvas");
    tc.width = W; tc.height = H;
    var ctx = tc.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    function noise(x, y, f) {
      var v = 0, amp = 1, tot = 0;
      for (var o = 0; o < 5; o++) {
        var sc = f * Math.pow(2, o);
        v += amp * (Math.sin(x * sc + o * 7.3) * Math.cos(y * sc * 1.7 + o * 5.1) * 0.5 + 0.5);
        tot += amp; amp *= 0.55;
      }
      return v / tot;
    }
    var id = ctx.createImageData(W, H);
    var d  = id.data;
    for (var py = 0; py < H; py++) {
      var lat = (0.5 - py / H) * Math.PI;
      for (var px = 0; px < W; px++) {
        var lon = (px / W - 0.5) * Math.PI * 2;
        var v = Math.max(0, noise(lon, lat, 3.5) - 0.45) * 3.5;
        v *= Math.max(0, 1 - Math.abs(lat) / (Math.PI * 0.45));
        v  = Math.min(1, v);
        var i4 = (py * W + px) * 4;
        d[i4] = d[i4+1] = d[i4+2] = Math.round(v * 255);
        d[i4+3] = 255;
      }
    }
    ctx.putImageData(id, 0, 0);
    return tc;
  }

  var texCloud = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, texCloud);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, makeCloudTex());
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // ── 行列ユーティリティ ──
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
  function trans(m,x,y,z){ ident(m); m[12]=x;m[13]=y;m[14]=z; return m; }

  var proj=m4(),view=m4(),model=m4(),rx=m4(),ry=m4(),tmp=m4(),mvp=m4();
  var rotXv = 0.3, rotYv = 0.6, zoom = 3.2, autoRot = true;
  var drag = false, lx = 0, ly = 0, pinch0 = 0;

  var rotSpdEl      = document.getElementById("rotSpd");
  var rotSpdValEl   = document.getElementById("rotSpdVal");
  var cloudSpdEl    = document.getElementById("cloudSpd");
  var cloudSpdValEl = document.getElementById("cloudSpdVal");
  rotSpdEl.addEventListener("input",   function(){ rotSpdValEl.textContent   = parseFloat(rotSpdEl.value).toFixed(1); });
  cloudSpdEl.addEventListener("input", function(){ cloudSpdValEl.textContent = parseFloat(cloudSpdEl.value).toFixed(1); });

  canvas.addEventListener("mousedown",  function(e){ drag=true; lx=e.clientX; ly=e.clientY; });
  window.addEventListener("mouseup",    function(){ drag=false; });
  window.addEventListener("mousemove",  function(e){ if(!drag)return; rotYv+=(e.clientX-lx)*0.008; rotXv+=(e.clientY-ly)*0.008; lx=e.clientX; ly=e.clientY; });
  canvas.addEventListener("wheel",      function(e){ e.preventDefault(); zoom=Math.max(1.6,Math.min(10,zoom+e.deltaY*0.01)); },{passive:false});
  canvas.addEventListener("dblclick",   function(){ autoRot=!autoRot; });
  canvas.addEventListener("touchstart", function(e){ e.preventDefault(); if(e.touches.length===1){drag=true;lx=e.touches[0].clientX;ly=e.touches[0].clientY;} if(e.touches.length===2){pinch0=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);} },{passive:false});
  canvas.addEventListener("touchmove",  function(e){ e.preventDefault(); if(e.touches.length===1&&drag){rotYv+=(e.touches[0].clientX-lx)*0.008;rotXv+=(e.touches[0].clientY-ly)*0.008;lx=e.touches[0].clientX;ly=e.touches[0].clientY;} if(e.touches.length===2){var d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);zoom=Math.max(1.6,Math.min(10,zoom-(d-pinch0)*0.02));pinch0=d;} },{passive:false});
  canvas.addEventListener("touchend",   function(){ drag=false; });

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);

  var startTime = performance.now();
  var frames = 0, lastFps = startTime, texReady = false;

  function frame(now) {
    requestAnimationFrame(frame);
    resize();
    var W = canvas.width, H = canvas.height;
    if (W === 0 || H === 0) return;
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0.02, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    var t = (now - startTime) * 0.001;
    var spd  = parseFloat(rotSpdEl.value);
    var cspd = parseFloat(cloudSpdEl.value);
    if (autoRot) rotYv += 0.003 * spd;

    persp(proj, Math.PI / 4, W / H, 0.1, 100);
    trans(view, 0, 0, -zoom);
    rotX(rx, rotXv); rotY(ry, rotYv);
    mul(model, ry, rx);
    mul(tmp, view, model);
    mul(mvp, proj, tmp);

    gl.uniformMatrix4fv(uMVP,   false, mvp);
    gl.uniformMatrix4fv(uModel, false, model);
    gl.uniform1f(uTime,     t);
    gl.uniform1f(uRotSpeed, cspd);

    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texEarth);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texCloud);

    gl.drawElements(gl.TRIANGLES, idxs.length, gl.UNSIGNED_SHORT, 0);

    frames++;
    var dt = now - lastFps;
    if (dt >= 600) {
      var fps = Math.round(frames * 1000 / dt);
      if (earthImg.complete && earthImg.naturalWidth > 0) {
        hud.textContent = "FPS: " + fps + "  |  " + (autoRot ? "自動回転 ON" : "自動回転 OFF");
      } else {
        hud.textContent = "テクスチャ読み込み中... FPS: " + fps;
      }
      frames = 0; lastFps = now;
    }
  }
  requestAnimationFrame(frame);
})();
</script>
</body>
</html>`;
}
