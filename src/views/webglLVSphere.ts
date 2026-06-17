function escLV(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function getWebGLLVSpherePage(username: string): string {
  const safeUser = escLV(username);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0a0500">
<title>Las Vegas Sphere — WebGL</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { background:#0a0500; color:#e6d0a0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:13px; height:100vh; height:100dvh; display:flex; flex-direction:column; overflow:hidden; }
.topbar { background:rgba(10,5,0,0.9); border-bottom:1px solid #3a2800; padding:8px 18px; display:flex; align-items:center; gap:10px; flex-shrink:0; }
.topbar a { color:#c8900a; text-decoration:none; font-size:12px; }
h1 { font-size:14px; font-weight:700; color:#f0b020; }
.badge { background:#2a1800; color:#f0b020; font-size:10px; padding:2px 7px; border-radius:10px; font-weight:600; }
.wrap { position:relative; flex:1; min-height:0; background:#0a0500; overflow:hidden; }
canvas { position:absolute; inset:0; width:100%; height:100%; cursor:grab; touch-action:none; display:block; }
canvas:active { cursor:grabbing; }
.hud { position:absolute; bottom:12px; left:50%; transform:translateX(-50%); background:rgba(10,5,0,0.8); border:1px solid #3a2800; border-radius:20px; padding:6px 18px; font-size:11px; color:#c8900a; font-family:monospace; white-space:nowrap; pointer-events:none; }
.mode-btns { position:absolute; top:10px; right:10px; display:flex; gap:6px; }
.mode-btn { background:rgba(10,5,0,0.85); border:1px solid #3a2800; border-radius:6px; color:#c8900a; font-size:11px; padding:5px 10px; cursor:pointer; transition:all .15s; }
.mode-btn:hover { border-color:#f0b020; color:#f0b020; }
.mode-btn.active { background:#2a1800; border-color:#f0b020; color:#f0b020; }
</style>
</head>
<body>

<script id="vs-sphere" type="x-shader/x-vertex">
attribute vec3 aPos;
attribute vec3 aNorm;
attribute vec2 aUV;
uniform mat4 uMVP;
uniform mat4 uModel;
varying vec2 vUV;
varying vec3 vWorldNorm;
void main() {
  vUV = aUV;
  vWorldNorm = normalize((uModel * vec4(aNorm, 0.0)).xyz);
  gl_Position = uMVP * vec4(aPos, 1.0);
}
</script>

<script id="fs-sphere" type="x-shader/x-fragment">
precision mediump float;
uniform float uTime;
uniform vec3 uCamDir;
uniform int uMode;
varying vec2 vUV;
varying vec3 vWorldNorm;

vec3 hue2rgb(float h) {
  h = fract(h) * 6.0;
  float r = clamp(abs(h - 3.0) - 1.0, 0.0, 1.0);
  float g = clamp(2.0 - abs(h - 2.0), 0.0, 1.0);
  float b = clamp(2.0 - abs(h - 4.0), 0.0, 1.0);
  return vec3(r, g, b);
}

void main() {
  float PI = 3.14159265;
  float t = uTime;

  float cols = 160.0;
  float rows = 80.0;
  vec2 panUV = fract(vUV * vec2(cols, rows));
  float led = smoothstep(0.44, 0.38, length(panUV - 0.5));

  float lon = vUV.x * 2.0 * PI;
  float lat = (vUV.y - 0.5) * PI;

  vec3 color;

  if (uMode == 0) {
    float w1 = sin(lon * 3.0 - t * 2.0) * sin(lat * 4.0 + t * 1.5) * 0.5 + 0.5;
    float w2 = cos(lon * 5.0 + t * 1.1) * cos(lat * 2.5 - t * 0.9) * 0.5 + 0.5;
    float radial = length(vec2(vUV.x - 0.5, vUV.y - 0.65));
    float pulse = (sin(radial * 30.0 - t * 5.0) * 0.5 + 0.5) * exp(-radial * 6.0);
    float sunRay = pow(max(0.0, sin(lon * 16.0 + t * 0.3)), 3.0) * exp(-abs(lat) * 2.0);
    vec3 gold  = vec3(1.0, 0.78, 0.0);
    vec3 amber = vec3(1.0, 0.42, 0.02);
    vec3 white = vec3(1.0, 0.96, 0.8);
    color = mix(gold, amber, w1 * 0.6 + w2 * 0.4);
    color = mix(color, white, pulse * 0.7 + sunRay * 0.4);
  } else if (uMode == 1) {
    float h = fract(vUV.x + vUV.y * 0.5 + t * 0.12);
    float v = sin(lat * 6.0 - t * 2.0) * 0.5 + 0.5;
    float ring = fract(abs(lat) / PI * 8.0 - t * 0.5);
    ring = smoothstep(0.4, 0.5, ring) * smoothstep(0.6, 0.5, ring);
    color = hue2rgb(h) * (0.5 + v * 0.5 + ring * 0.3);
  } else {
    float sparkle = sin(lon * 40.0 + t * 7.0) * sin(lat * 20.0 - t * 5.0);
    sparkle = pow(max(0.0, sparkle), 6.0);
    float base = sin(lon * 2.0 - t) * sin(lat * 3.0 + t * 0.7) * 0.5 + 0.5;
    vec3 blue  = vec3(0.1, 0.4, 1.0);
    vec3 cyan  = vec3(0.0, 0.9, 1.0);
    vec3 white3 = vec3(1.0, 1.0, 1.0);
    color = mix(blue, cyan, base);
    color = mix(color, white3, sparkle);
  }

  float rim = pow(1.0 - abs(dot(vWorldNorm, normalize(uCamDir))), 2.5);
  vec3 rimColor = (uMode == 1) ? vec3(0.8, 0.2, 1.0) : (uMode == 2 ? vec3(0.1, 0.5, 1.0) : vec3(1.0, 0.7, 0.0));
  color += rimColor * rim * 1.2;

  float frame = 0.12;
  float mask = led * 2.2 + (1.0 - led) * frame;

  gl_FragColor = vec4(color * mask, 1.0);
}
</script>

<script id="vs-ground" type="x-shader/x-vertex">
attribute vec3 aPos;
uniform mat4 uMVP;
varying vec3 vPos;
void main() { vPos = aPos; gl_Position = uMVP * vec4(aPos, 1.0); }
</script>

<script id="fs-ground" type="x-shader/x-fragment">
precision mediump float;
uniform float uTime;
uniform int uMode;
varying vec3 vPos;
void main() {
  float grid = max(
    smoothstep(0.03, 0.0, abs(fract(vPos.x * 3.0) - 0.5)),
    smoothstep(0.03, 0.0, abs(fract(vPos.z * 3.0) - 0.5))
  );
  vec3 gc = uMode == 1 ? vec3(0.1, 0.0, 0.2) : (uMode == 2 ? vec3(0.0, 0.05, 0.15) : vec3(0.12, 0.06, 0.0));
  vec3 lc = uMode == 1 ? vec3(0.5, 0.1, 0.8) : (uMode == 2 ? vec3(0.1, 0.4, 0.9) : vec3(0.7, 0.4, 0.0));
  float dist = length(vec2(vPos.x, vPos.z));
  float fade = exp(-dist * 0.25);
  gl_FragColor = vec4(mix(gc, lc, grid * fade * 0.6) * fade, 1.0);
}
</script>

<script id="vs-star" type="x-shader/x-vertex">
attribute vec3 aPos;
attribute float aBright;
uniform mat4 uMVP;
varying float vBright;
void main() { vBright = aBright; gl_Position = uMVP * vec4(aPos, 1.0); gl_PointSize = 2.0; }
</script>

<script id="fs-star" type="x-shader/x-fragment">
precision mediump float;
varying float vBright;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.0, d) * vBright;
  gl_FragColor = vec4(0.9, 0.9, 1.0, a);
}
</script>

<div class="topbar">
  <h1>Las Vegas Sphere</h1>
  <span class="badge">WebGL</span>
  <span style="flex:1"></span>
  <a href="/webgl-sphere">&#9917; W杯</a>
  <a href="/webgl-heritage">🏛️ 世界遺産</a>
  <a href="/settings" class="pwa-hide">&#9881;</a>
  <span class="pwa-hide" style="color:#6a4a00;font-size:11px">${safeUser}</span>
</div>

<div class="wrap">
  <canvas id="c"></canvas>
  <div class="hud" id="hud">読み込み中...</div>
  <div class="mode-btns">
    <button class="mode-btn active" id="btn0">🟡 ゴールド</button>
    <button class="mode-btn" id="btn1">🌈 レインボー</button>
    <button class="mode-btn" id="btn2">💙 ブルー</button>
  </div>
</div>

<script>
(function() {
  var canvas = document.getElementById('c');
  var wrap   = canvas.parentElement;
  var hud    = document.getElementById('hud');

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
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  function makeProgram(vsId, fsId) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER,   document.getElementById(vsId).textContent));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, document.getElementById(fsId).textContent));
    gl.linkProgram(p);
    return p;
  }

  var progSphere = makeProgram('vs-sphere', 'fs-sphere');
  var progGround = makeProgram('vs-ground', 'fs-ground');
  var progStar   = makeProgram('vs-star',   'fs-star');

  // --- Sphere geometry ---
  var LAT = 80, LON = 160;
  var sv = [], si = [];
  for (var i = 0; i <= LAT; i++) {
    var th = i / LAT * Math.PI;
    var st = Math.sin(th), ct = Math.cos(th);
    for (var j = 0; j <= LON; j++) {
      var ph = j / LON * 2 * Math.PI;
      var x = -st * Math.cos(ph), y = ct, z = st * Math.sin(ph);
      sv.push(x, y, z, x, y, z, j / LON, i / LAT);
    }
  }
  for (var i = 0; i < LAT; i++) {
    for (var j = 0; j < LON; j++) {
      var a = i * (LON + 1) + j, b = a + (LON + 1);
      si.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  var sVBO = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, sVBO); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sv), gl.STATIC_DRAW);
  var sIBO = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sIBO); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(si), gl.STATIC_DRAW);

  // --- Ground plane geometry ---
  var gr = 12;
  var gv = [-gr,0,-gr, -gr,0,gr, gr,0,gr, gr,0,-gr];
  var gi = [0,1,2, 0,2,3];
  var gVBO = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, gVBO); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(gv), gl.STATIC_DRAW);
  var gIBO = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gIBO); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(gi), gl.STATIC_DRAW);

  // --- Stars ---
  var starV = [], starB = [];
  for (var k = 0; k < 800; k++) {
    var u = Math.random(), v = Math.random();
    var phi2 = 2 * Math.PI * u;
    var cosTheta = 2 * v - 1;
    var sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
    var r2 = 40;
    starV.push(r2 * sinTheta * Math.cos(phi2), r2 * cosTheta, r2 * sinTheta * Math.sin(phi2));
    starB.push(0.3 + Math.random() * 0.7);
  }
  var starPosVBO = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, starPosVBO); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(starV), gl.STATIC_DRAW);
  var starBriVBO = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, starBriVBO); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(starB), gl.STATIC_DRAW);

  // --- Matrix helpers ---
  function m4() { return new Float32Array(16); }
  function ident(m) { for(var i=0;i<16;i++) m[i]=0; m[0]=m[5]=m[10]=m[15]=1; return m; }
  function mul(o,a,b) { for(var i=0;i<4;i++) for(var j=0;j<4;j++){var s=0;for(var k2=0;k2<4;k2++) s+=a[i+k2*4]*b[k2+j*4];o[i+j*4]=s;} return o; }
  function persp(m,fov,asp,near,far) {
    ident(m); var f=1/Math.tan(fov/2);
    m[0]=f/asp; m[5]=f; m[10]=(far+near)/(near-far); m[11]=-1;
    m[14]=2*far*near/(near-far); m[15]=0; return m;
  }
  function trans(m,x,y,z) { ident(m); m[12]=x; m[13]=y; m[14]=z; return m; }
  function rotY(m,r) { ident(m); var c=Math.cos(r),s=Math.sin(r); m[0]=c;m[2]=-s;m[8]=s;m[10]=c; return m; }
  function scale(m,s2) { ident(m); m[0]=m[5]=m[10]=s2; return m; }

  function lookAt(ex,ey,ez, tx,ty,tz) {
    var zx=ex-tx,zy=ey-ty,zz=ez-tz;
    var zl=Math.sqrt(zx*zx+zy*zy+zz*zz); zx/=zl;zy/=zl;zz/=zl;
    var ux=0,uy=1,uz=0;
    var xx=uy*zz-uz*zy, xy=uz*zx-ux*zz, xz=ux*zy-uy*zx;
    var xl=Math.sqrt(xx*xx+xy*xy+xz*xz); xx/=xl;xy/=xl;xz/=xl;
    var yx=zy*xz-zz*xy, yy=zz*xx-zx*xz, yz=zx*xy-zy*xx;
    var m=m4();
    m[0]=xx;m[1]=yx;m[2]=zx;m[3]=0;
    m[4]=xy;m[5]=yy;m[6]=zy;m[7]=0;
    m[8]=xz;m[9]=yz;m[10]=zz;m[11]=0;
    m[12]=-(xx*ex+xy*ey+xz*ez);
    m[13]=-(yx*ex+yy*ey+yz*ez);
    m[14]=-(zx*ex+zy*ey+zz*ez);
    m[15]=1;
    return m;
  }

  // --- Camera state ---
  var camTheta = 0.4, camPhi = 0.18, camRadius = 4.2;
  var autoRot = true;
  var drag = false, lx = 0, ly = 0, touchMoved = false;
  var displayMode = 0;
  var sphereRotY = 0;

  // --- Mode buttons ---
  var modeButtons = [document.getElementById('btn0'), document.getElementById('btn1'), document.getElementById('btn2')];
  modeButtons.forEach(function(btn, idx) {
    btn.addEventListener('click', function() {
      displayMode = idx;
      modeButtons.forEach(function(b, i) {
        if (i === idx) { b.classList.add('active'); } else { b.classList.remove('active'); }
      });
    });
  });

  // --- Input ---
  canvas.addEventListener('mousedown', function(e) { drag=true; lx=e.clientX; ly=e.clientY; });
  window.addEventListener('mouseup',   function() { drag=false; });
  window.addEventListener('mousemove', function(e) {
    if (!drag) return;
    camTheta -= (e.clientX - lx) * 0.007;
    camPhi    = Math.max(-0.4, Math.min(0.8, camPhi + (e.clientY - ly) * 0.005));
    lx = e.clientX; ly = e.clientY;
    autoRot = false;
  });
  canvas.addEventListener('wheel', function(e) {
    e.preventDefault();
    camRadius = Math.max(2.0, Math.min(9.0, camRadius + e.deltaY * 0.005));
  }, {passive:false});
  canvas.addEventListener('dblclick', function() { autoRot = !autoRot; });
  canvas.addEventListener('touchstart', function(e) { e.preventDefault(); touchMoved=false; if(e.touches.length===1){drag=true;lx=e.touches[0].clientX;ly=e.touches[0].clientY;} },{passive:false});
  canvas.addEventListener('touchmove',  function(e) { e.preventDefault(); touchMoved=true; if(e.touches.length===1&&drag){ camTheta-=(e.touches[0].clientX-lx)*0.007; camPhi=Math.max(-0.4,Math.min(0.8,camPhi+(e.touches[0].clientY-ly)*0.005)); lx=e.touches[0].clientX;ly=e.touches[0].clientY; autoRot=false; } },{passive:false});
  canvas.addEventListener('touchend',   function() { drag=false; });

  // --- Render ---
  var proj=m4(), view=m4(), model=m4(), mvp=m4(), tmp=m4(), tmp2=m4(), ry2=m4(), sc=m4();
  var startTime = performance.now();
  var frames = 0, lastFps = startTime;

  function frame(now) {
    requestAnimationFrame(frame);
    resize();
    var W = canvas.width, H = canvas.height;
    if (W === 0 || H === 0) return;

    var t = (now - startTime) * 0.001;

    if (autoRot) {
      camTheta += 0.004;
      sphereRotY += 0.002;
    }

    var ex = Math.cos(camPhi) * Math.sin(camTheta) * camRadius;
    var ey = Math.sin(camPhi) * camRadius + 0.3;
    var ez = Math.cos(camPhi) * Math.cos(camTheta) * camRadius;
    var el = Math.sqrt(ex*ex+ey*ey+ez*ez);

    view = lookAt(ex, ey, ez, 0, 0.3, 0);
    persp(proj, Math.PI/4, W/H, 0.1, 200);
    mul(mvp, proj, view);

    gl.viewport(0, 0, W, H);
    gl.clearColor(0.04, 0.02, 0.0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // === Stars ===
    gl.useProgram(progStar);
    var uMVPstar = gl.getUniformLocation(progStar, 'uMVP');
    gl.uniformMatrix4fv(uMVPstar, false, mvp);
    gl.bindBuffer(gl.ARRAY_BUFFER, starPosVBO);
    var aPosS = gl.getAttribLocation(progStar, 'aPos');
    gl.enableVertexAttribArray(aPosS);
    gl.vertexAttribPointer(aPosS, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, starBriVBO);
    var aBriS = gl.getAttribLocation(progStar, 'aBright');
    gl.enableVertexAttribArray(aBriS);
    gl.vertexAttribPointer(aBriS, 1, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, 800);

    // === Ground ===
    trans(tmp2, 0, -1.05, 0);
    mul(tmp, mvp, tmp2);
    gl.useProgram(progGround);
    gl.uniformMatrix4fv(gl.getUniformLocation(progGround, 'uMVP'),   false, tmp);
    gl.uniform1f(gl.getUniformLocation(progGround, 'uTime'), t);
    gl.uniform1i(gl.getUniformLocation(progGround, 'uMode'), displayMode);
    gl.bindBuffer(gl.ARRAY_BUFFER, gVBO);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gIBO);
    var aPosG = gl.getAttribLocation(progGround, 'aPos');
    gl.enableVertexAttribArray(aPosG);
    gl.vertexAttribPointer(aPosG, 3, gl.FLOAT, false, 0, 0);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    // === Sphere ===
    rotY(ry2, sphereRotY);
    scale(sc, 1.05);
    mul(tmp2, sc, ry2);
    mul(model, tmp2, m4());
    ident(model);
    rotY(model, sphereRotY);
    mul(tmp, mvp, model);

    gl.useProgram(progSphere);
    gl.uniformMatrix4fv(gl.getUniformLocation(progSphere, 'uMVP'),   false, tmp);
    gl.uniformMatrix4fv(gl.getUniformLocation(progSphere, 'uModel'), false, model);
    gl.uniform1f(gl.getUniformLocation(progSphere, 'uTime'), t);
    gl.uniform3f(gl.getUniformLocation(progSphere, 'uCamDir'), ex/el, ey/el, ez/el);
    gl.uniform1i(gl.getUniformLocation(progSphere, 'uMode'), displayMode);

    var stride = 8 * 4;
    gl.bindBuffer(gl.ARRAY_BUFFER, sVBO);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sIBO);
    var aPo = gl.getAttribLocation(progSphere, 'aPos');
    var aNm = gl.getAttribLocation(progSphere, 'aNorm');
    var aUV2 = gl.getAttribLocation(progSphere, 'aUV');
    gl.enableVertexAttribArray(aPo);  gl.vertexAttribPointer(aPo,  3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(aNm);  gl.vertexAttribPointer(aNm,  3, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(aUV2); gl.vertexAttribPointer(aUV2, 2, gl.FLOAT, false, stride, 24);
    gl.drawElements(gl.TRIANGLES, si.length, gl.UNSIGNED_SHORT, 0);

    // HUD
    frames++;
    var dt = now - lastFps;
    if (dt >= 600) {
      var fps = Math.round(frames * 1000 / dt);
      var modeLabel = ['ゴールド', 'レインボー', 'ブルー'][displayMode];
      hud.textContent = 'FPS: ' + fps + '  |  ' + modeLabel + '  |  ダブルクリック: 自動回転 ' + (autoRot ? 'ON' : 'OFF');
      frames = 0; lastFps = now;
    }
  }
  requestAnimationFrame(frame);
})();
</script>
</body>
</html>`;
}
