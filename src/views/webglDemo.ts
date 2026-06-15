function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function getWebGLDemoPage(username: string): string {
  const safeUser = esc(username);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>WebGL デモ</title>
<style>
:root {
  --bg:#0d1117;--surface:#161b22;--border:#30363d;--text:#e6edf3;
  --muted:#8b949e;--blue:#58a6ff;--blue-bg:#0c2d4e;--ok:#3fb950;
  --ok-bg:#0f2d1a;--code-bg:#21262d;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;min-height:100vh;display:flex;flex-direction:column}
.topbar{background:var(--surface);border-bottom:1px solid var(--border);padding:10px 20px;display:flex;align-items:center;gap:10px;flex-shrink:0}
.topbar a{color:var(--blue);text-decoration:none;font-size:12px}
h1{font-size:15px;font-weight:700}
.badge{background:var(--blue-bg);color:var(--blue);font-size:10px;padding:2px 7px;border-radius:10px;font-weight:600}
.layout{display:grid;grid-template-columns:1fr 340px;flex:1;min-height:0;overflow:hidden}
@media(max-width:800px){.layout{grid-template-columns:1fr;grid-template-rows:auto 1fr}}
.canvas-wrap{position:relative;background:#000;display:flex;align-items:center;justify-content:center}
canvas{display:block;cursor:grab;touch-action:none}
canvas:active{cursor:grabbing}
.overlay{position:absolute;top:10px;left:10px;background:rgba(0,0,0,.6);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:11px;font-family:monospace;color:#aaa;line-height:1.8;pointer-events:none}
.panel{background:var(--surface);border-left:1px solid var(--border);overflow-y:auto;padding:16px}
.panel h2{font-size:12px;font-weight:700;color:var(--blue);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px}
.step{display:flex;gap:10px;margin-bottom:14px;align-items:flex-start}
.step-num{background:var(--blue-bg);color:var(--blue);border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;margin-top:1px}
.step-body{flex:1}
.step-title{font-weight:600;font-size:12px;margin-bottom:3px}
.step-desc{color:var(--muted);font-size:11px;line-height:1.6}
code{background:var(--code-bg);padding:1px 5px;border-radius:3px;font-family:monospace;font-size:10px;color:#e6edf3}
.divider{border:none;border-top:1px solid var(--border);margin:14px 0}
.controls{background:var(--code-bg);border-radius:6px;padding:10px 12px;margin-bottom:14px;font-size:11px;color:var(--muted);line-height:1.8}
.controls strong{color:var(--text)}
.stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px}
.stat{background:var(--code-bg);border-radius:6px;padding:8px 10px}
.stat-label{font-size:10px;color:var(--muted);margin-bottom:2px}
.stat-val{font-size:14px;font-weight:700;color:var(--ok);font-family:monospace}
</style>
</head>
<body>

<!-- Vertex Shader -->
<script id="vs" type="x-shader/x-vertex">
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec3 aColor;
uniform mat4 uMVP;
uniform mat4 uNormalMatrix;
uniform vec3 uLightDir;
varying vec3 vColor;
varying float vDiffuse;
void main() {
  vec3 n = normalize((uNormalMatrix * vec4(aNormal, 0.0)).xyz);
  vDiffuse = max(dot(n, normalize(uLightDir)), 0.0);
  vColor = aColor;
  gl_Position = uMVP * vec4(aPosition, 1.0);
}
</script>

<!-- Fragment Shader -->
<script id="fs" type="x-shader/x-fragment">
precision mediump float;
varying vec3 vColor;
varying float vDiffuse;
void main() {
  vec3 ambient = vColor * 0.25;
  vec3 diffuse = vColor * vDiffuse;
  gl_FragColor = vec4(ambient + diffuse, 1.0);
}
</script>

<div class="topbar">
  <h1>WebGL デモ</h1>
  <span class="badge">Cloudflare Workers</span>
  <span style="flex:1"></span>
  <a href="/htmlrewriter-demo">HTMLRewriter</a>
  <a href="/settings">⚙ 設定</a>
  <span style="color:var(--muted);font-size:11px">${safeUser}</span>
</div>

<div class="layout">
  <div class="canvas-wrap">
    <canvas id="glcanvas"></canvas>
    <div class="overlay" id="overlay">FPS: --</div>
  </div>
  <div class="panel">
    <div class="stat-grid">
      <div class="stat"><div class="stat-label">FPS</div><div class="stat-val" id="sFps">--</div></div>
      <div class="stat"><div class="stat-label">頂点数</div><div class="stat-val" id="sVerts">--</div></div>
      <div class="stat"><div class="stat-label">三角形</div><div class="stat-val" id="sTris">--</div></div>
      <div class="stat"><div class="stat-label">ドローコール</div><div class="stat-val" id="sDraw">--</div></div>
    </div>

    <div class="controls">
      <strong>操作方法</strong><br>
      ドラッグ: 回転<br>
      ホイール / ピンチ: ズーム<br>
      ダブルクリック: 自動回転 ON/OFF
    </div>

    <h2>WebGL パイプライン</h2>

    <div class="step">
      <div class="step-num">1</div>
      <div class="step-body">
        <div class="step-title">コンテキスト取得</div>
        <div class="step-desc"><code>canvas.getContext("webgl")</code> で GPU コンテキストを取得。WebGL 2 が使えない環境でも動作するよう WebGL 1 を使用。</div>
      </div>
    </div>

    <div class="step">
      <div class="step-num">2</div>
      <div class="step-body">
        <div class="step-title">シェーダーコンパイル</div>
        <div class="step-desc">頂点シェーダー（位置・法線変換）とフラグメントシェーダー（ライティング計算）を GLSL で記述し GPU にコンパイル。</div>
      </div>
    </div>

    <div class="step">
      <div class="step-num">3</div>
      <div class="step-body">
        <div class="step-title">VBO（頂点バッファ）</div>
        <div class="step-desc">位置 <code>aPosition</code>・法線 <code>aNormal</code>・色 <code>aColor</code> を GPU メモリにアップロード。インターリーブ形式で1バッファにまとめる。</div>
      </div>
    </div>

    <div class="step">
      <div class="step-num">4</div>
      <div class="step-body">
        <div class="step-title">ユニフォーム変数</div>
        <div class="step-desc">フレームごとに <code>uMVP</code>（Model × View × Projection 行列）と <code>uNormalMatrix</code> を更新して送信。</div>
      </div>
    </div>

    <div class="step">
      <div class="step-num">5</div>
      <div class="step-body">
        <div class="step-title">ライティング（Phong）</div>
        <div class="step-desc">頂点シェーダーで法線と光源方向の内積を計算。アンビエント 25% + ディフューズ 75% で面ごとの明暗を表現。</div>
      </div>
    </div>

    <div class="step">
      <div class="step-num">6</div>
      <div class="step-body">
        <div class="step-title">描画（インデックスバッファ）</div>
        <div class="step-desc"><code>gl.drawElements(TRIANGLES)</code> でインデックスバッファを使い頂点を再利用。デプステストで奥行きの正しい描画を実現。</div>
      </div>
    </div>

    <hr class="divider">
    <div class="step-desc" style="color:var(--muted);font-size:11px;line-height:1.7">
      シェーダーソースは <code>&lt;script type="x-shader"&gt;</code> タグで HTML に埋め込み、JS から <code>textContent</code> で取得してコンパイル。<br>
      行列計算は外部ライブラリなしで実装（gl-matrix 相当を手書き）。
    </div>
  </div>
</div>

<script>
(function() {
  var canvas = document.getElementById("glcanvas");
  var wrap = canvas.parentElement;

  function resize() {
    var w = wrap.clientWidth;
    var h = wrap.clientHeight;
    canvas.width = w;
    canvas.height = h;
  }
  resize();
  window.addEventListener("resize", resize);

  var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (!gl) {
    document.getElementById("overlay").textContent = "WebGL が利用できません";
    return;
  }

  // シェーダーコンパイル
  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }
  var vsSrc = document.getElementById("vs").textContent;
  var fsSrc = document.getElementById("fs").textContent;
  var prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  // キューブ定義: 6面 × 4頂点 × (pos3 + normal3 + color3) = stride 9
  var R = 0.95;
  var faces = [
    // pos(3)                normal(3)       color(3)
    // +Z 前面 (赤)
    -R,-R, R,  0, 0, 1,  0.95,0.35,0.35,
     R,-R, R,  0, 0, 1,  0.95,0.35,0.35,
     R, R, R,  0, 0, 1,  0.95,0.35,0.35,
    -R, R, R,  0, 0, 1,  0.95,0.35,0.35,
    // -Z 背面 (緑)
     R,-R,-R,  0, 0,-1,  0.30,0.80,0.40,
    -R,-R,-R,  0, 0,-1,  0.30,0.80,0.40,
    -R, R,-R,  0, 0,-1,  0.30,0.80,0.40,
     R, R,-R,  0, 0,-1,  0.30,0.80,0.40,
    // +X 右面 (青)
     R,-R, R,  1, 0, 0,  0.35,0.55,0.95,
     R,-R,-R,  1, 0, 0,  0.35,0.55,0.95,
     R, R,-R,  1, 0, 0,  0.35,0.55,0.95,
     R, R, R,  1, 0, 0,  0.35,0.55,0.95,
    // -X 左面 (黄)
    -R,-R,-R, -1, 0, 0,  0.95,0.85,0.25,
    -R,-R, R, -1, 0, 0,  0.95,0.85,0.25,
    -R, R, R, -1, 0, 0,  0.95,0.85,0.25,
    -R, R,-R, -1, 0, 0,  0.95,0.85,0.25,
    // +Y 上面 (マゼンタ)
    -R, R, R,  0, 1, 0,  0.90,0.40,0.85,
     R, R, R,  0, 1, 0,  0.90,0.40,0.85,
     R, R,-R,  0, 1, 0,  0.90,0.40,0.85,
    -R, R,-R,  0, 1, 0,  0.90,0.40,0.85,
    // -Y 下面 (シアン)
    -R,-R,-R,  0,-1, 0,  0.25,0.80,0.85,
     R,-R,-R,  0,-1, 0,  0.25,0.80,0.85,
     R,-R, R,  0,-1, 0,  0.25,0.80,0.85,
    -R,-R, R,  0,-1, 0,  0.25,0.80,0.85,
  ];

  var vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(faces), gl.STATIC_DRAW);

  // インデックスバッファ（各面 2 三角形 = 6 インデックス）
  var indices = [];
  for (var f = 0; f < 6; f++) {
    var b = f * 4;
    indices.push(b, b+1, b+2, b, b+2, b+3);
  }
  var ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

  var stride = 9 * 4;
  var aPos    = gl.getAttribLocation(prog, "aPosition");
  var aNorm   = gl.getAttribLocation(prog, "aNormal");
  var aCol    = gl.getAttribLocation(prog, "aColor");
  gl.enableVertexAttribArray(aPos);  gl.vertexAttribPointer(aPos,  3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(aNorm); gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, stride, 12);
  gl.enableVertexAttribArray(aCol);  gl.vertexAttribPointer(aCol,  3, gl.FLOAT, false, stride, 24);

  var uMVP    = gl.getUniformLocation(prog, "uMVP");
  var uNorm   = gl.getUniformLocation(prog, "uNormalMatrix");
  var uLight  = gl.getUniformLocation(prog, "uLightDir");
  gl.uniform3f(uLight, 1.0, 1.5, 2.0);

  // 行列ユーティリティ（gl-matrix なし）
  function mat4() { return new Float32Array(16); }
  function identity(m) {
    for (var i=0;i<16;i++) m[i]=0;
    m[0]=m[5]=m[10]=m[15]=1; return m;
  }
  function perspective(m, fov, asp, near, far) {
    identity(m);
    var f = 1/Math.tan(fov/2);
    m[0]=f/asp; m[5]=f;
    m[10]=(far+near)/(near-far); m[11]=-1;
    m[14]=2*far*near/(near-far); m[15]=0;
    return m;
  }
  function multiply(out, a, b) {
    for (var i=0;i<4;i++) for (var j=0;j<4;j++) {
      var s=0; for(var k=0;k<4;k++) s+=a[i+k*4]*b[k+j*4];
      out[i+j*4]=s;
    }
    return out;
  }
  function rotX(m, r) {
    identity(m); var c=Math.cos(r),s=Math.sin(r);
    m[5]=c; m[6]=s; m[9]=-s; m[10]=c; return m;
  }
  function rotY(m, r) {
    identity(m); var c=Math.cos(r),s=Math.sin(r);
    m[0]=c; m[2]=-s; m[8]=s; m[10]=c; return m;
  }
  function translate(m, x, y, z) {
    identity(m); m[12]=x; m[13]=y; m[14]=z; return m;
  }
  function transpose3(m) {
    var out = mat4(); identity(out);
    out[0]=m[0];out[1]=m[4];out[2]=m[8];
    out[4]=m[1];out[5]=m[5];out[6]=m[9];
    out[8]=m[2];out[9]=m[6];out[10]=m[10];
    return out;
  }

  var proj=mat4(), view=mat4(), model=mat4(), rx=mat4(), ry=mat4(), tmp=mat4(), mvp=mat4();
  perspective(proj, Math.PI/4, 1, 0.1, 100);
  translate(view, 0, 0, -4);

  // インタラクション
  var rotX_ = 0.4, rotY_ = 0.5;
  var autoRot = true;
  var dragging = false, lastX = 0, lastY = 0;
  var zoom = 4.0;

  canvas.addEventListener("mousedown", function(e) { dragging=true; lastX=e.clientX; lastY=e.clientY; });
  window.addEventListener("mouseup",   function()  { dragging=false; });
  window.addEventListener("mousemove", function(e) {
    if (!dragging) return;
    rotY_ += (e.clientX - lastX) * 0.01;
    rotX_ += (e.clientY - lastY) * 0.01;
    lastX=e.clientX; lastY=e.clientY;
  });
  canvas.addEventListener("wheel", function(e) {
    e.preventDefault();
    zoom = Math.max(1.5, Math.min(10, zoom + e.deltaY * 0.01));
  }, { passive: false });
  canvas.addEventListener("dblclick", function() { autoRot = !autoRot; });

  // タッチ
  var pinchDist = 0;
  canvas.addEventListener("touchstart", function(e) {
    e.preventDefault();
    if (e.touches.length === 1) { dragging=true; lastX=e.touches[0].clientX; lastY=e.touches[0].clientY; }
    if (e.touches.length === 2) { pinchDist = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY); }
  }, { passive: false });
  canvas.addEventListener("touchmove", function(e) {
    e.preventDefault();
    if (e.touches.length === 1 && dragging) {
      rotY_ += (e.touches[0].clientX - lastX) * 0.01;
      rotX_ += (e.touches[0].clientY - lastY) * 0.01;
      lastX=e.touches[0].clientX; lastY=e.touches[0].clientY;
    }
    if (e.touches.length === 2) {
      var d = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
      zoom = Math.max(1.5, Math.min(10, zoom - (d - pinchDist) * 0.02));
      pinchDist = d;
    }
  }, { passive: false });
  canvas.addEventListener("touchend", function() { dragging=false; });

  // FPS
  var frames=0, lastFpsTime=performance.now();
  var sFps=document.getElementById("sFps");
  var sVerts=document.getElementById("sVerts");
  var sTris=document.getElementById("sTris");
  var sDraw=document.getElementById("sDraw");
  var overlay=document.getElementById("overlay");
  sVerts.textContent="24"; sTris.textContent="12"; sDraw.textContent="1";

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);

  var t = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    resize();

    var W = canvas.width, H = canvas.height;
    gl.viewport(0, 0, W, H);
    gl.clearColor(0.05, 0.07, 0.10, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    perspective(proj, Math.PI/4, W/H, 0.1, 100);
    translate(view, 0, 0, -zoom);

    if (autoRot) { rotY_ += 0.008; rotX_ += 0.004; }

    rotX(rx, rotX_); rotY(ry, rotY_);
    multiply(model, ry, rx);
    multiply(tmp, view, model);
    multiply(mvp, proj, tmp);

    gl.uniformMatrix4fv(uMVP, false, mvp);
    gl.uniformMatrix4fv(uNorm, false, transpose3(model));

    gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);

    frames++;
    var dt = now - lastFpsTime;
    if (dt >= 500) {
      var fps = Math.round(frames * 1000 / dt);
      sFps.textContent = fps;
      overlay.textContent = "FPS: " + fps + " | " + (autoRot ? "自動回転 ON" : "自動回転 OFF") + " | ダブルクリックで切替";
      frames=0; lastFpsTime=now;
    }
    t++;
  }
  requestAnimationFrame(frame);
})();
</script>
</body>
</html>`;
}
