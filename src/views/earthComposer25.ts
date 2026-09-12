import { getThemeCSS, getThemeInitScript } from '../utils/theme';

/** WebGL テクスチャ地球儀ページ（/earth-composer-2.5）。PWA(standalone)時は右上にユーザー名・アバターを置かない。 */
export function getEarthComposer25Page(username: string): string {
  void username;
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#000008">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="earth-composer-2.5">
<link rel="manifest" href="/manifest-earth-composer-2.5.json">
<title>earth-composer-2.5 — WebGL 地球儀</title>
<style>
${getThemeCSS()}
/* 宇宙背景は常に暗色固定（ライト/ダークどちらでも地球儀の視認性を確保） */
:root { --space-bg: #000008; --space-accent: #58a6ff; --space-glow: rgba(88,166,255,0.35); }
[data-theme="dark"] { --space-bg: #000008; --space-accent: #7eb8ff; --space-glow: rgba(126,184,255,0.4); }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; }
body {
  background: var(--space-bg);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.nav {
  height: 44px;
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 clamp(14px, 3vw, 24px);
  background: var(--navbar-bg);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}
.nav h1 { font-size: 14px; font-weight: 700; flex: 1; letter-spacing: 0.02em; }
.badge {
  background: var(--badge-bg);
  color: var(--accent-color);
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}
.stage { position: relative; flex: 1; min-height: 0; background: var(--space-bg); overflow: hidden; }
canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; cursor: grab; touch-action: none; }
canvas:active { cursor: grabbing; }
.hud {
  position: absolute;
  bottom: 10px;
  left: 10px;
  background: rgba(0, 0, 8, 0.72);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 11px;
  font-family: ui-monospace, monospace;
  color: var(--space-accent);
  line-height: 1.8;
  pointer-events: none;
}
.ctrl-bar {
  background: var(--navbar-bg);
  border-top: 1px solid var(--border-color);
  padding: 8px clamp(14px, 3vw, 24px);
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.ctrl-group { display: flex; align-items: center; gap: 8px; }
.ctrl-label { font-size: 11px; color: var(--text-muted); white-space: nowrap; }
input[type=range] { width: 100px; accent-color: var(--accent-color); }
.sval { font-family: ui-monospace, monospace; font-size: 11px; color: var(--accent-color); min-width: 32px; }
.btn {
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 11px;
  padding: 5px 12px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.btn:hover { border-color: var(--accent-color); }
.btn.active { background: var(--badge-bg); border-color: var(--accent-color); color: var(--accent-color); }
</style>
${getThemeInitScript()}
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
uniform float uNight;
varying vec2 vUV;
varying float vDiff;
varying float vSpec;
varying float vRim;
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
void main() {
  vec4 earth = texture2D(uTex, vUV);
  float isOcean = clamp((earth.b - earth.r * 0.8 - earth.g * 0.3) * 3.0, 0.0, 1.0);
  vec3 oceanColor = vec3(0.05, 0.18, 0.52);
  vec3 baseColor = mix(earth.rgb, oceanColor, isOcean);
  float night = clamp(1.0 - vDiff * 8.0, 0.0, 1.0) * uNight;
  float amb = mix(0.25, 0.03, night);
  vec3 col = baseColor * (amb + vDiff * (1.0 - amb));
  col += vec3(0.5, 0.8, 1.0) * vSpec * isOcean * 0.7;
  col += vec3(0.25, 0.55, 1.0) * vRim * 0.5;
  col += vec3(0.1,  0.3,  0.9) * vRim * vRim * 0.25;
  float isLand = 1.0 - isOcean;
  vec2 c1 = floor(vUV * 192.0);
  float city1 = step(0.955, hash(c1)) * isLand;
  vec2 c2 = floor(vUV * 512.0);
  float city2 = step(0.982, hash(c2 + vec2(17.0, 31.0))) * isLand;
  col += vec3(1.0, 0.75, 0.35) * (city1 * 0.7 + city2 * 0.3) * night;
  gl_FragColor = vec4(col, 1.0);
}
</script>

<script id="vs-line" type="x-shader/x-vertex">
attribute vec3 aPos;
uniform mat4 uMVP;
void main() {
  gl_Position = uMVP * vec4(aPos, 1.0);
}
</script>
<script id="fs-line" type="x-shader/x-fragment">
precision mediump float;
uniform vec4 uColor;
void main() {
  gl_FragColor = uColor;
}
</script>

<nav class="nav">
  <h1>earth-composer-2.5</h1>
  <span class="badge">WebGL</span>
</nav>

<div class="stage">
  <canvas id="c"></canvas>
  <div class="hud" id="hud">テクスチャ読み込み中...</div>
</div>

<div class="ctrl-bar">
  <div class="ctrl-group">
    <span class="ctrl-label">自転</span>
    <input type="range" id="rotSpd" min="0" max="5" step="0.1" value="1">
    <span class="sval" id="rotSpdVal">1.0</span>
  </div>
  <button class="btn active" id="btnAutoRot">⏸ 自転停止</button>
  <button class="btn" id="btnNight">🌙 夜景</button>
  <button class="btn active" id="btnLatLines">🌐 緯線</button>
  <button class="btn" id="btnReset">↺ リセット</button>
</div>

<script>
(function() {
  var canvas = document.getElementById("c");
  var wrap = canvas.parentElement;
  var hud = document.getElementById("hud");
  var rotSpdEl = document.getElementById("rotSpd");
  var rotSpdValEl = document.getElementById("rotSpdVal");
  var btnAutoRot = document.getElementById("btnAutoRot");
  var btnNight = document.getElementById("btnNight");
  var btnLatLines = document.getElementById("btnLatLines");
  var btnReset = document.getElementById("btnReset");

  function resize() {
    var r = wrap.getBoundingClientRect();
    var w = Math.round(r.width);
    var h = Math.round(r.height);
    if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
      canvas.width = w;
      canvas.height = h;
    }
  }
  resize();
  window.addEventListener("resize", resize);

  var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (!gl) {
    hud.textContent = "WebGL が利用できません";
    return;
  }

  function compileShader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  var prog = gl.createProgram();
  gl.attachShader(prog, compileShader(gl.VERTEX_SHADER, document.getElementById("vs").textContent));
  gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, document.getElementById("fs").textContent));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  var LAT = 64;
  var LON = 128;
  var verts = [];
  var idxs = [];
  for (var i = 0; i <= LAT; i++) {
    var theta = i / LAT * Math.PI;
    var sinT = Math.sin(theta);
    var cosT = Math.cos(theta);
    for (var j = 0; j <= LON; j++) {
      var phi = j / LON * 2 * Math.PI;
      var x = -sinT * Math.cos(phi);
      var y = cosT;
      var z = sinT * Math.sin(phi);
      verts.push(x, y, z, x, y, z, j / LON, i / LAT);
    }
  }
  for (var ri = 0; ri < LAT; ri++) {
    for (var rj = 0; rj < LON; rj++) {
      var a = ri * (LON + 1) + rj;
      var b = a + (LON + 1);
      idxs.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  var vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
  var ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idxs), gl.STATIC_DRAW);

  var progLine = gl.createProgram();
  gl.attachShader(progLine, compileShader(gl.VERTEX_SHADER, document.getElementById("vs-line").textContent));
  gl.attachShader(progLine, compileShader(gl.FRAGMENT_SHADER, document.getElementById("fs-line").textContent));
  gl.linkProgram(progLine);
  var uMVPLine = gl.getUniformLocation(progLine, "uMVP");
  var uColorLine = gl.getUniformLocation(progLine, "uColor");
  var aPosLine = gl.getAttribLocation(progLine, "aPos");

  function buildLatCircle(latDeg, segs) {
    var r = Math.cos(latDeg * Math.PI / 180);
    var y = Math.sin(latDeg * Math.PI / 180);
    var pts = [];
    for (var k = 0; k <= segs; k++) {
      var ang = k / segs * 2 * Math.PI;
      pts.push(r * Math.cos(ang), y, r * Math.sin(ang));
    }
    return pts;
  }
  var SEG = 128;
  function makeLineBuf(pts) {
    var b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.STATIC_DRAW);
    return b;
  }
  var equatorBuf = makeLineBuf(buildLatCircle(0, SEG));
  var tropic1Buf = makeLineBuf(buildLatCircle(23.4, SEG));
  var tropic2Buf = makeLineBuf(buildLatCircle(-23.4, SEG));
  var showLatLines = true;

  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  var stride = 8 * 4;
  var aPos = gl.getAttribLocation(prog, "aPos");
  var aNorm = gl.getAttribLocation(prog, "aNorm");
  var aUV = gl.getAttribLocation(prog, "aUV");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(aNorm);
  gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, stride, 12);
  gl.enableVertexAttribArray(aUV);
  gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, stride, 24);

  var uMVP = gl.getUniformLocation(prog, "uMVP");
  var uModel = gl.getUniformLocation(prog, "uModel");
  var uLight = gl.getUniformLocation(prog, "uLight");
  var uTex = gl.getUniformLocation(prog, "uTex");
  var uNightL = gl.getUniformLocation(prog, "uNight");
  gl.uniform1i(uTex, 0);
  gl.uniform1f(uNightL, 0.0);

  var texEarth = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texEarth);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([10, 30, 70, 255]));
  var texReady = false;
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
    texReady = true;
  };
  earthImg.onerror = function() {
    hud.textContent = "テクスチャ読み込み失敗 — /earth.jpg";
  };
  earthImg.src = "/earth.jpg";

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

  function m4() { return new Float32Array(16); }
  function ident(m) { for (var ii = 0; ii < 16; ii++) m[ii] = 0; m[0] = m[5] = m[10] = m[15] = 1; return m; }
  function mul(o, a, b) {
    for (var ii = 0; ii < 4; ii++) {
      for (var jj = 0; jj < 4; jj++) {
        var s = 0;
        for (var kk = 0; kk < 4; kk++) s += a[ii + kk * 4] * b[kk + jj * 4];
        o[ii + jj * 4] = s;
      }
    }
    return o;
  }
  function persp(m, fov, asp, near, far) {
    ident(m);
    var f = 1 / Math.tan(fov / 2);
    m[0] = f / asp;
    m[5] = f;
    m[10] = (far + near) / (near - far);
    m[11] = -1;
    m[14] = 2 * far * near / (near - far);
    m[15] = 0;
    return m;
  }
  function rotX(m, r) { ident(m); var c = Math.cos(r), s = Math.sin(r); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; }
  function rotY(m, r) { ident(m); var c = Math.cos(r), s = Math.sin(r); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; }
  function rotZ(m, r) { ident(m); var c = Math.cos(r), s = Math.sin(r); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; }
  function trans(m, x, y, z) { ident(m); m[12] = x; m[13] = y; m[14] = z; return m; }

  var axialTilt = -23.4 * Math.PI / 180;
  var ELEV_MAX = Math.PI / 2 - 0.02;
  function clampElev(v) { return v < -ELEV_MAX ? -ELEV_MAX : (v > ELEV_MAX ? ELEV_MAX : v); }

  var proj = m4(), view = m4(), model = m4(), rx = m4(), ry = m4(), tz = m4(), tmp = m4(), tmp2 = m4(), mvp = m4();
  var rotXv = 0.25;
  var rotYv = 0.8;
  var zoom = 3.2;
  var zoomTarget = 3.2;
  var autoRot = true;
  var nightMode = false;
  var drag = false;
  var lx = 0;
  var ly = 0;
  var pinch0 = 0;
  var velY = 0;
  var velX = 0;
  var momentumY = 0;
  var momentumX = 0;
  var MOMENTUM_DECAY = 0.92;

  rotSpdEl.addEventListener("input", function() {
    rotSpdValEl.textContent = parseFloat(rotSpdEl.value).toFixed(1);
  });

  btnAutoRot.addEventListener("click", function() {
    autoRot = !autoRot;
    btnAutoRot.textContent = autoRot ? "⏸ 自転停止" : "▶ 自転";
    btnAutoRot.classList.toggle("active", autoRot);
  });

  btnNight.addEventListener("click", function() {
    nightMode = !nightMode;
    btnNight.classList.toggle("active", nightMode);
  });

  btnLatLines.addEventListener("click", function() {
    showLatLines = !showLatLines;
    btnLatLines.classList.toggle("active", showLatLines);
  });

  btnReset.addEventListener("click", function() {
    rotXv = 0.25;
    rotYv = 0.8;
    zoomTarget = 3.2;
    momentumY = 0;
    momentumX = 0;
    autoRot = true;
    nightMode = false;
    showLatLines = true;
    btnAutoRot.textContent = "⏸ 自転停止";
    btnAutoRot.classList.add("active");
    btnNight.classList.remove("active");
    btnLatLines.classList.add("active");
  });

  canvas.addEventListener("mousedown", function(e) {
    drag = true;
    lx = e.clientX;
    ly = e.clientY;
    momentumY = 0;
    momentumX = 0;
    velY = 0;
    velX = 0;
  });
  window.addEventListener("mouseup", function() {
    if (!drag) return;
    drag = false;
    momentumY = velY;
    momentumX = velX;
    velY = 0;
    velX = 0;
  });
  window.addEventListener("mousemove", function(e) {
    if (!drag) return;
    var dy = (e.clientX - lx) * 0.008;
    var dx = (e.clientY - ly) * 0.008;
    rotYv += dy;
    velY = velY * 0.4 + dy * 0.6;
    rotXv = clampElev(rotXv + dx);
    velX = velX * 0.4 + dx * 0.6;
    lx = e.clientX;
    ly = e.clientY;
  });
  canvas.addEventListener("wheel", function(e) {
    e.preventDefault();
    var delta = e.deltaMode === 1 ? e.deltaY * 18 : (e.deltaMode === 2 ? e.deltaY * 300 : e.deltaY);
    zoomTarget = Math.max(1.2, Math.min(8, zoomTarget + delta * 0.004));
  }, { passive: false });
  canvas.addEventListener("dblclick", function() {
    autoRot = !autoRot;
    btnAutoRot.textContent = autoRot ? "⏸ 自転停止" : "▶ 自転";
    btnAutoRot.classList.toggle("active", autoRot);
  });
  canvas.addEventListener("touchstart", function(e) {
    e.preventDefault();
    momentumY = 0;
    momentumX = 0;
    velY = 0;
    velX = 0;
    if (e.touches.length === 1) {
      drag = true;
      lx = e.touches[0].clientX;
      ly = e.touches[0].clientY;
    }
    if (e.touches.length === 2) {
      pinch0 = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, { passive: false });
  canvas.addEventListener("touchmove", function(e) {
    e.preventDefault();
    if (e.touches.length === 1 && drag) {
      var cx = e.touches[0].clientX;
      var cy = e.touches[0].clientY;
      var dy = (cx - lx) * 0.008;
      var dx = (cy - ly) * 0.008;
      rotYv += dy;
      velY = velY * 0.4 + dy * 0.6;
      rotXv = clampElev(rotXv + dx);
      velX = velX * 0.4 + dx * 0.6;
      lx = cx;
      ly = cy;
    }
    if (e.touches.length === 2) {
      var d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      zoomTarget = Math.max(1.2, Math.min(8, zoomTarget - (d - pinch0) * 0.015));
      pinch0 = d;
    }
  }, { passive: false });
  canvas.addEventListener("touchend", function() { drag = false; momentumY = velY; momentumX = velX; velY = 0; velX = 0; });

  gl.enable(gl.DEPTH_TEST);
  var startTime = performance.now();
  var frames = 0;
  var lastFps = startTime;

  function frame(now) {
    requestAnimationFrame(frame);
    resize();
    var W = canvas.width;
    var H = canvas.height;
    if (W === 0 || H === 0) return;
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0.02, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    zoom += (zoomTarget - zoom) * 0.15;
    var spd = parseFloat(rotSpdEl.value);
    if (autoRot) rotYv += 0.003 * spd;
    if (Math.abs(momentumY) > 0.0002) { rotYv += momentumY; momentumY *= MOMENTUM_DECAY; } else { momentumY = 0; }
    if (Math.abs(momentumX) > 0.0002) { rotXv = clampElev(rotXv + momentumX); momentumX *= MOMENTUM_DECAY; } else { momentumX = 0; }

    persp(proj, Math.PI / 4, W / H, 0.1, 100);
    trans(view, 0, 0, -zoom);
    rotY(ry, rotYv);
    rotZ(tz, axialTilt);
    rotX(rx, rotXv);
    mul(tmp2, tz, ry);
    mul(model, rx, tmp2);
    mul(tmp, view, model);
    mul(mvp, proj, tmp);

    var sd = getSunDir();
    gl.useProgram(prog);
    gl.uniform3f(uLight, sd[0], sd[1], sd[2]);
    gl.uniform1f(uNightL, nightMode ? 1.0 : 0.0);
    gl.uniformMatrix4fv(uMVP, false, mvp);
    gl.uniformMatrix4fv(uModel, false, model);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texEarth);
    gl.drawElements(gl.TRIANGLES, idxs.length, gl.UNSIGNED_SHORT, 0);

    if (showLatLines) {
      gl.useProgram(progLine);
      gl.uniformMatrix4fv(uMVPLine, false, mvp);
      gl.enableVertexAttribArray(aPosLine);
      function drawLatLine(buf, r, g, b, a) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.vertexAttribPointer(aPosLine, 3, gl.FLOAT, false, 0, 0);
        gl.uniform4f(uColorLine, r, g, b, a);
        gl.drawArrays(gl.LINE_STRIP, 0, SEG + 1);
      }
      drawLatLine(equatorBuf, 0.2, 0.8, 1.0, 0.7);
      drawLatLine(tropic1Buf, 1.0, 0.85, 0.2, 0.4);
      drawLatLine(tropic2Buf, 1.0, 0.85, 0.2, 0.4);
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(aNorm);
      gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, stride, 12);
      gl.enableVertexAttribArray(aUV);
      gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, stride, 24);
    }

    frames++;
    if (now - lastFps >= 500) {
      var fps = Math.round(frames * 1000 / (now - lastFps));
      frames = 0;
      lastFps = now;
      var latDeg = (rotXv * 180 / Math.PI).toFixed(1);
      var lonDeg = (rotYv * 180 / Math.PI).toFixed(1);
      hud.textContent = "FPS " + fps
        + (texReady ? " | テクスチャ OK" : " | 読込中")
        + " | 視点 " + latDeg + "° / " + lonDeg + "°";
    }
  }
  requestAnimationFrame(frame);
})();
</script>
<script>
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw-earth-composer-2.5.js', { scope: '/earth-composer-2.5' }).catch(function() {});
}
</script>
</body>
</html>`;
}
