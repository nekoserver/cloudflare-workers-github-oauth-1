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
<title>WebGL 球面テキスト</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { background:#000; color:#e6edf3; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:13px; height:100vh; display:flex; flex-direction:column; overflow:hidden; }
.topbar { background:#0d1117; border-bottom:1px solid #30363d; padding:8px 18px; display:flex; align-items:center; gap:10px; flex-shrink:0; }
.topbar a { color:#58a6ff; text-decoration:none; font-size:12px; }
h1 { font-size:14px; font-weight:700; }
.badge { background:#0c2d4e; color:#58a6ff; font-size:10px; padding:2px 7px; border-radius:10px; font-weight:600; }
.body { display:grid; grid-template-columns:1fr 300px; flex:1; min-height:0; }
@media(max-width:700px){ .body{ grid-template-columns:1fr; } .side{ display:none; } }
.canvas-wrap { position:relative; background:#000; }
canvas { display:block; width:100%; height:100%; cursor:grab; touch-action:none; }
canvas:active { cursor:grabbing; }
.hud { position:absolute; top:10px; left:10px; background:rgba(0,0,0,.7); border:1px solid #30363d; border-radius:6px; padding:6px 10px; font-size:11px; font-family:monospace; color:#3fb950; line-height:1.9; pointer-events:none; }
.side { background:#0d1117; border-left:1px solid #30363d; overflow-y:auto; padding:16px; }
.side h2 { font-size:11px; font-weight:700; color:#58a6ff; text-transform:uppercase; letter-spacing:.5px; margin-bottom:10px; }
.item { margin-bottom:12px; }
.item-title { font-weight:600; font-size:12px; margin-bottom:3px; }
.item-desc { color:#8b949e; font-size:11px; line-height:1.6; }
code { background:#21262d; padding:1px 5px; border-radius:3px; font-family:monospace; font-size:10px; }
hr { border:none; border-top:1px solid #30363d; margin:12px 0; }
.tip { background:#0c2d4e; border-radius:6px; padding:8px 10px; font-size:11px; color:#8b949e; line-height:1.7; margin-bottom:12px; }
.ctrl-label { font-size:11px; color:#8b949e; margin-bottom:4px; }
.ctrl-row { margin-bottom:12px; }
textarea#charPool { width:100%; height:64px; background:#21262d; border:1px solid #30363d; border-radius:4px; color:#e6edf3; font-family:monospace; font-size:11px; padding:6px; resize:vertical; }
.slider-row { display:flex; align-items:center; gap:8px; }
input[type=range]#fontSz { flex:1; accent-color:#3fb950; }
#fontSzVal { font-family:monospace; font-size:11px; color:#3fb950; min-width:28px; }
button#applyBtn { width:100%; padding:7px; background:#238636; border:none; border-radius:5px; color:#fff; font-size:12px; font-weight:600; cursor:pointer; margin-top:4px; }
button#applyBtn:hover { background:#2ea043; }
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
varying float vRim;
void main() {
  vec3 wn = normalize((uModel * vec4(aNorm, 0.0)).xyz);
  vDiff = max(dot(wn, normalize(uLight)), 0.0);
  vec3 toEye = normalize(vec3(0.0, 0.0, 1.0));
  vRim = pow(1.0 - abs(dot(wn, toEye)), 2.5);
  vUV = aUV;
  gl_Position = uMVP * vec4(aPos, 1.0);
}
</script>

<script id="fs" type="x-shader/x-fragment">
precision mediump float;
uniform sampler2D uTex;
uniform float uTime;
varying vec2 vUV;
varying float vDiff;
varying float vRim;
void main() {
  float ci = floor(vUV.x * 32.0);
  float spd = 0.08 + mod(ci * 6.1, 1.0) * 0.18;
  float dir = mod(floor(ci / 2.0), 2.0) < 1.0 ? 1.0 : -1.0;
  vec2 uv = vec2(vUV.x, vUV.y + uTime * spd * dir);
  vec4 t = texture2D(uTex, uv);
  float bright = t.r * (0.15 + vDiff * 0.85);
  vec3 col = vec3(0.05, 0.95, 0.38) * bright;
  col += vec3(0.0, 0.6, 0.25) * t.r * 0.3;
  col += vec3(0.02, 0.15, 0.06) * vRim;
  col += vec3(0.0, 0.03, 0.01) * (1.0 - vDiff);
  gl_FragColor = vec4(col, 1.0);
}
</script>

<div class="topbar">
  <h1>WebGL 球面テキスト</h1>
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
    <div class="hud" id="hud">起動中...</div>
  </div>
  <div class="side">
    <div class="tip">ドラッグ: 回転 | ホイール: ズーム | ダブルクリック: 自動回転 ON/OFF</div>

    <h2>テクスチャ設定</h2>
    <div class="ctrl-row">
      <div class="ctrl-label">文字プール（自由に編集）</div>
      <textarea id="charPool">アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン認証無効強制削除警告通過失敗成功要求応答暗号復号検証発行失効更新ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$</textarea>
    </div>
    <div class="ctrl-row">
      <div class="ctrl-label">文字サイズ</div>
      <div class="slider-row">
        <input type="range" id="fontSz" min="8" max="48" value="15">
        <span id="fontSzVal">15</span>px
      </div>
    </div>
    <button id="applyBtn">テクスチャを再生成</button>

    <hr>
    <h2>実装ポイント</h2>

    <div class="item">
      <div class="item-title">UV 球体（経緯線分割）</div>
      <div class="item-desc">緯度 48 × 経度 96 = 4608 頂点。各頂点に <code>aPos</code>・<code>aNorm</code>・<code>aUV</code> を設定し VBO へ。</div>
    </div>
    <div class="item">
      <div class="item-title">テキストテクスチャ（Canvas 2D）</div>
      <div class="item-desc">512×512 の Canvas に任意の文字を格子状に描画。文字サイズを変えるとセル数が変わり密度が変化する。</div>
    </div>
    <div class="item">
      <div class="item-title">列ごとに異なるスクロール速度</div>
      <div class="item-desc">フラグメントシェーダーで <code>floor(vUV.x * 32.0)</code> によって列インデックスを算出し、列ごとに速度と上下方向を変化させて <code>uTime</code> で UV をオフセット。</div>
    </div>
    <div class="item">
      <div class="item-title">リム（縁）グロー</div>
      <div class="item-desc">頂点シェーダーで法線と視線ベクトルの内積から縁付近を検出し <code>vRim</code> として補間。球の輪郭にほのかな緑の発光を付加。</div>
    </div>
    <div class="item">
      <div class="item-title">テクスチャ繰り返し（REPEAT）</div>
      <div class="item-desc"><code>gl.REPEAT</code> ラッピングを設定することで UV が 0〜1 を超えても GL 側で自動的に折り返し、スクロールを seamless に継続できる。</div>
    </div>
    <div class="item">
      <div class="item-title">行列演算（外部ライブラリなし）</div>
      <div class="item-desc">perspective・rotX・rotY・multiply を JavaScript で実装。Workers ランタイムに追加依存なし。</div>
    </div>
  </div>
</div>

<script>
(function() {
  var canvas = document.getElementById("c");
  var wrap = canvas.parentElement;
  var hud = document.getElementById("hud");

  function resize() {
    canvas.width = wrap.clientWidth;
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
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s)); return null;
    }
    return s;
  }
  var prog = gl.createProgram();
  gl.attachShader(prog, compileShader(gl.VERTEX_SHADER,   document.getElementById("vs").textContent));
  gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, document.getElementById("fs").textContent));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  var LAT = 48, LON = 96;
  var verts = [], idxs = [];
  for (var i = 0; i <= LAT; i++) {
    var theta = i / LAT * Math.PI;
    var sinT = Math.sin(theta), cosT = Math.cos(theta);
    for (var j = 0; j <= LON; j++) {
      var phi = j / LON * 2 * Math.PI;
      var x = sinT * Math.cos(phi);
      var y = cosT;
      var z = sinT * Math.sin(phi);
      verts.push(x, y, z,  x, y, z,  j / LON, i / LAT);
    }
  }
  for (var i = 0; i < LAT; i++) {
    for (var j = 0; j < LON; j++) {
      var a = i * (LON + 1) + j;
      var b = a + (LON + 1);
      idxs.push(a, b, a + 1,  b, b + 1, a + 1);
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
  var uTime  = gl.getUniformLocation(prog, "uTime");
  gl.uniform3f(uLight, 1.5, 2.0, 2.5);
  gl.uniform1i(uTex, 0);

  // ── テキストテクスチャ生成（再利用可能） ──
  var TW = 512, TH = 512;
  var tex = gl.createTexture();

  function buildTexture(poolStr, fsize) {
    var pool = poolStr && poolStr.length > 0 ? poolStr : "0123456789";
    var poolLen = pool.length;
    var cellH = Math.max(8, Math.min(64, fsize));
    var cellW = cellH;
    var cols = Math.floor(TW / cellW);
    var rows = Math.floor(TH / cellH);

    var tc = document.createElement("canvas");
    tc.width = TW; tc.height = TH;
    var ctx = tc.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, TW, TH);
    ctx.textBaseline = "top";
    ctx.font = (cellH - 1) + "px monospace";

    for (var col = 0; col < cols; col++) {
      var headRow = Math.floor(Math.random() * rows);
      var streamLen = 4 + Math.floor(Math.random() * 12);
      for (var row = 0; row < rows; row++) {
        var dist = (row - headRow + rows) % rows;
        if (dist > streamLen) continue;
        var fade = dist === 0 ? 1.0 : (streamLen - dist) / streamLen;
        if (dist === 0) {
          ctx.fillStyle = "rgba(220,255,220," + fade + ")";
        } else {
          var g = Math.floor((0.3 + fade * 0.7) * 220);
          ctx.fillStyle = "rgba(0," + g + "," + Math.floor(fade * 80) + "," + fade + ")";
        }
        var ch = pool[Math.floor(Math.random() * poolLen)];
        ctx.fillText(ch, col * cellW, row * cellH);
      }
    }

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tc);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  var poolEl  = document.getElementById("charPool");
  var fontSzEl = document.getElementById("fontSz");
  var fontSzValEl = document.getElementById("fontSzVal");

  fontSzEl.addEventListener("input", function() {
    fontSzValEl.textContent = fontSzEl.value;
  });

  document.getElementById("applyBtn").addEventListener("click", function() {
    buildTexture(poolEl.value, parseInt(fontSzEl.value, 10));
  });

  // 初回生成
  buildTexture(poolEl.value, 15);

  // ── 行列ユーティリティ ──
  function m4()      { return new Float32Array(16); }
  function ident(m)  { for (var i=0;i<16;i++) m[i]=0; m[0]=m[5]=m[10]=m[15]=1; return m; }
  function mul(o,a,b){
    for (var i=0;i<4;i++) for (var j=0;j<4;j++) {
      var s=0; for(var k=0;k<4;k++) s+=a[i+k*4]*b[k+j*4]; o[i+j*4]=s;
    } return o;
  }
  function persp(m, fov, asp, near, far) {
    ident(m); var f=1/Math.tan(fov/2);
    m[0]=f/asp; m[5]=f; m[10]=(far+near)/(near-far); m[11]=-1;
    m[14]=2*far*near/(near-far); m[15]=0; return m;
  }
  function rotX(m,r){ ident(m); var c=Math.cos(r),s=Math.sin(r); m[5]=c;m[6]=s;m[9]=-s;m[10]=c; return m; }
  function rotY(m,r){ ident(m); var c=Math.cos(r),s=Math.sin(r); m[0]=c;m[2]=-s;m[8]=s;m[10]=c; return m; }
  function trans(m,x,y,z){ ident(m); m[12]=x;m[13]=y;m[14]=z; return m; }

  var proj=m4(),view=m4(),model=m4(),rx=m4(),ry=m4(),tmp=m4(),mvp=m4();
  var rotXv=0.4, rotYv=0.3, zoom=3.0, autoRot=true;
  var drag=false, lx=0, ly=0, pinch0=0;

  canvas.addEventListener("mousedown",  function(e){ drag=true; lx=e.clientX; ly=e.clientY; });
  window.addEventListener("mouseup",    function(){ drag=false; });
  window.addEventListener("mousemove",  function(e){ if(!drag)return; rotYv+=(e.clientX-lx)*0.008; rotXv+=(e.clientY-ly)*0.008; lx=e.clientX; ly=e.clientY; });
  canvas.addEventListener("wheel",      function(e){ e.preventDefault(); zoom=Math.max(1.5,Math.min(10,zoom+e.deltaY*0.01)); },{passive:false});
  canvas.addEventListener("dblclick",   function(){ autoRot=!autoRot; });
  canvas.addEventListener("touchstart", function(e){ e.preventDefault(); if(e.touches.length===1){drag=true;lx=e.touches[0].clientX;ly=e.touches[0].clientY;} if(e.touches.length===2){pinch0=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);} },{passive:false});
  canvas.addEventListener("touchmove",  function(e){ e.preventDefault(); if(e.touches.length===1&&drag){rotYv+=(e.touches[0].clientX-lx)*0.008;rotXv+=(e.touches[0].clientY-ly)*0.008;lx=e.touches[0].clientX;ly=e.touches[0].clientY;} if(e.touches.length===2){var d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);zoom=Math.max(1.5,Math.min(10,zoom-(d-pinch0)*0.02));pinch0=d;} },{passive:false});
  canvas.addEventListener("touchend",   function(){ drag=false; });

  var startTime = performance.now();
  var frames=0, lastFps=startTime;

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);

  function frame(now) {
    requestAnimationFrame(frame);
    resize();
    var W=canvas.width, H=canvas.height;
    if(W===0||H===0) return;
    gl.viewport(0,0,W,H);
    gl.clearColor(0.01,0.02,0.01,1);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

    var t = (now - startTime) * 0.001;
    if (autoRot) rotYv += 0.005;

    persp(proj, Math.PI/4, W/H, 0.1, 100);
    trans(view, 0, 0, -zoom);
    rotX(rx, rotXv); rotY(ry, rotYv);
    mul(model, ry, rx);
    mul(tmp, view, model);
    mul(mvp, proj, tmp);

    gl.uniformMatrix4fv(uMVP,   false, mvp);
    gl.uniformMatrix4fv(uModel, false, model);
    gl.uniform1f(uTime, t);

    gl.drawElements(gl.TRIANGLES, idxs.length, gl.UNSIGNED_SHORT, 0);

    frames++;
    var dt = now - lastFps;
    if (dt >= 600) {
      var fps = Math.round(frames * 1000 / dt);
      hud.textContent = "FPS: " + fps + "  |  " + (autoRot ? "自動回転 ON" : "自動回転 OFF (ダブルクリックで切替)");
      frames=0; lastFps=now;
    }
  }
  requestAnimationFrame(frame);
})();
</script>
</body>
</html>`;
}
