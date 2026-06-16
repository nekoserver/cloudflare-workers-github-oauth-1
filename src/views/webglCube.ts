function escC(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function getWebGLCubePage(username: string): string {
  const safeUser = escC(username);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>WebGL ルービックキューブ</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { background:#0d1117; color:#e6edf3; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:13px; height:100vh; display:flex; flex-direction:column; overflow:hidden; }
.topbar { background:#0d1117; border-bottom:1px solid #30363d; padding:8px 18px; display:flex; align-items:center; gap:10px; flex-shrink:0; }
h1 { font-size:14px; font-weight:700; }
.badge { background:#0c2d4e; color:#58a6ff; font-size:10px; padding:2px 7px; border-radius:10px; font-weight:600; }
.body { display:grid; grid-template-columns:1fr 260px; grid-template-rows:1fr; flex:1; min-height:0; }
@media(max-width:700px){ .body{ grid-template-columns:1fr; } .side{ display:none; } }
.canvas-wrap { position:relative; background:#0a0c10; overflow:hidden; }
#netbig { position:absolute; inset:0; width:100%; height:100%; display:none; image-rendering:pixelated; z-index:1; pointer-events:none; }
#cw { position:absolute; top:0; left:0; width:100%; height:100%; z-index:2; transition:top .55s cubic-bezier(.4,0,.2,1),left .55s cubic-bezier(.4,0,.2,1),width .55s cubic-bezier(.4,0,.2,1),height .55s cubic-bezier(.4,0,.2,1); }
#cw.sm { top:12px; left:60%; width:38%; height:38%; }
#c { position:absolute; inset:0; width:100%; height:100%; cursor:grab; touch-action:none; display:block; }
#c:active { cursor:grabbing; }
.side { background:#0d1117; border-left:1px solid #30363d; overflow:hidden; padding:16px; display:flex; flex-direction:column; }
.side h2 { font-size:11px; font-weight:700; color:#58a6ff; text-transform:uppercase; letter-spacing:.5px; margin-bottom:8px; }
.seg { display:flex; gap:3px; margin-bottom:12px; flex-wrap:wrap; }
.seg-btn { flex:1; min-width:36px; text-align:center; background:#21262d; border:1px solid #30363d; color:#8b949e; padding:4px; border-radius:5px; cursor:pointer; font-size:11px; font-weight:600; user-select:none; }
.seg-btn.active { background:#0c2d4e; border-color:#58a6ff; color:#58a6ff; }
.btn-row { display:flex; gap:6px; margin-bottom:12px; flex-wrap:wrap; }
.btn { background:#21262d; border:1px solid #30363d; color:#e6edf3; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600; }
.btn:hover { background:#30363d; }
.btn.primary { background:#1f6feb; border-color:#1f6feb; }
.btn.primary:hover { background:#388bfd; }
.btn.danger { background:#6e1c1c; border-color:#da3633; }
.btn.danger:hover { background:#da3633; }
.ctrl-label { font-size:11px; color:#8b949e; margin-bottom:4px; }
.slider-row { display:flex; align-items:center; gap:8px; margin-bottom:12px; }
input[type=range] { flex:1; accent-color:#58a6ff; }
.sval { font-family:monospace; font-size:11px; color:#58a6ff; min-width:28px; }
hr { border:none; border-top:1px solid #30363d; margin:12px 0; }
.status { font-size:11px; color:#58a6ff; margin-bottom:6px; font-family:monospace; min-height:16px; }
.moves-label { font-size:11px; color:#8b949e; margin-bottom:4px; }
.moves-box { background:#161b22; border:1px solid #30363d; border-radius:6px; padding:8px; font-family:monospace; font-size:11px; color:#8b949e; flex:1; overflow-y:auto; line-height:2; word-break:break-all; }
.md { color:#3fb950; }
.mc { color:#f0883e; font-weight:bold; }
.mn { color:#484f58; }
</style>
</head>
<body>
<script id="vs" type="x-shader/x-vertex">
attribute vec3 aPos;
attribute vec3 aNorm;
attribute vec3 aCol;
uniform mat4 uMVP;
uniform mat3 uNR;
varying vec3 vCol;
void main() {
  vec3 wn = normalize(uNR * aNorm);
  vec3 ld = normalize(vec3(1.0, 2.0, 1.5));
  float d = max(dot(wn, ld), 0.0);
  vCol = aCol * (0.3 + 0.7 * d);
  gl_Position = uMVP * vec4(aPos, 1.0);
}
</script>
<script id="fs" type="x-shader/x-fragment">
precision mediump float;
varying vec3 vCol;
void main() { gl_FragColor = vec4(vCol, 1.0); }
</script>

<div class="topbar">
  <h1>ルービックキューブ</h1>
  <span class="badge">WebGL</span>
  <span style="flex:1"></span>
</div>

<div class="body">
  <div class="canvas-wrap" id="cwrap">
    <canvas id="netbig"></canvas>
    <div id="cw"><canvas id="c"></canvas></div>
  </div>
  <div class="side">
    <h2>サイズ</h2>
    <div class="seg" id="sizesel">
      <div class="seg-btn" data-n="2">2×2</div>
      <div class="seg-btn active" data-n="3">3×3</div>
      <div class="seg-btn" data-n="4">4×4</div>
      <div class="seg-btn" data-n="5">5×5</div>
      <div class="seg-btn" data-n="7">7×7</div>
      <div class="seg-btn" data-n="11">11×11</div>
    </div>
    <h2>操作</h2>
    <div class="btn-row">
      <button class="btn danger" id="btnS">スクランブル</button>
      <button class="btn primary" id="btnV">ソルブ</button>
      <button class="btn" id="btnR">リセット</button>
    </div>
    <div class="ctrl-label">アニメ速度</div>
    <div class="slider-row">
      <input type="range" id="spd" min="1" max="10" value="5">
      <span class="sval" id="spdv">5</span>
    </div>
    <hr>
    <div class="status" id="st">ソルブ済み</div>
    <div class="moves-label">手順</div>
    <div style="flex:1;display:flex;flex-direction:column;min-height:0;">
      <div class="moves-box" id="mb"></div>
    </div>
  </div>
</div>

<script>
(function() {
  var COLS = [
    [0.95,0.95,0.95],[1.0,0.85,0.0],[0.0,0.6,0.2],
    [0.1,0.35,0.95],[0.9,0.1,0.1],[1.0,0.5,0.0],[0.07,0.07,0.07]
  ];
  var N = 3;
  var cubies = [];

  function initCube(n) {
    N = n; cubies = [];
    for (var x = 0; x < N; x++) for (var y = 0; y < N; y++) for (var z = 0; z < N; z++) {
      var c = [6,6,6,6,6,6];
      if (x===N-1) c[0]=4; if (x===0) c[1]=5;
      if (y===N-1) c[2]=0; if (y===0) c[3]=1;
      if (z===N-1) c[4]=2; if (z===0) c[5]=3;
      cubies.push({x:x,y:y,z:z,c:c});
    }
  }

  function rotPos(axis, dir, x, y, z) {
    var n1=N-1;
    if (axis===0&&dir===1)  return [x,n1-z,y];
    if (axis===0&&dir===-1) return [x,z,n1-y];
    if (axis===1&&dir===1)  return [z,y,n1-x];
    if (axis===1&&dir===-1) return [n1-z,y,x];
    if (axis===2&&dir===1)  return [n1-y,x,z];
    if (axis===2&&dir===-1) return [y,n1-x,z];
    return [x,y,z];
  }

  function rotFaces(axis, dir, c) {
    var t=c.slice();
    if (axis===0&&dir===1)  { c[2]=t[5];c[4]=t[2];c[3]=t[4];c[5]=t[3]; }
    else if (axis===0&&dir===-1) { c[5]=t[2];c[2]=t[4];c[4]=t[3];c[3]=t[5]; }
    else if (axis===1&&dir===1)  { c[5]=t[0];c[0]=t[4];c[4]=t[1];c[1]=t[5]; }
    else if (axis===1&&dir===-1) { c[0]=t[5];c[4]=t[0];c[1]=t[4];c[5]=t[1]; }
    else if (axis===2&&dir===1)  { c[2]=t[0];c[1]=t[2];c[3]=t[1];c[0]=t[3]; }
    else if (axis===2&&dir===-1) { c[3]=t[0];c[0]=t[2];c[2]=t[1];c[1]=t[3]; }
  }

  function applyMove(axis, layer, dir) {
    var nc=[];
    for (var i=0;i<cubies.length;i++) {
      var cb=cubies[i];
      var inL=(axis===0&&cb.x===layer)||(axis===1&&cb.y===layer)||(axis===2&&cb.z===layer);
      if (inL) {
        var np=rotPos(axis,dir,cb.x,cb.y,cb.z);
        var fc=cb.c.slice(); rotFaces(axis,dir,fc);
        nc.push({x:np[0],y:np[1],z:np[2],c:fc});
      } else { nc.push(cb); }
    }
    cubies=nc;
  }

  function mname(axis,layer,dir) {
    var b;
    if (axis===0) b=layer===N-1?"R":layer===0?"L":"r"+layer;
    else if (axis===1) b=layer===N-1?"U":layer===0?"D":"u"+layer;
    else b=layer===N-1?"F":layer===0?"B":"f"+layer;
    return b+(dir===-1?"'":"");
  }

  function genScramble(len) {
    var mv=[]; var la=-1,ll=-1;
    for (var i=0;i<len;i++) {
      var ax,ly,dr;
      do { ax=Math.floor(Math.random()*3); ly=Math.floor(Math.random()*N); } while(ax===la&&ly===ll);
      dr=Math.random()<0.5?1:-1;
      mv.push({axis:ax,layer:ly,dir:dr}); la=ax; ll=ly;
    }
    return mv;
  }

  // --- WebGL ---
  var canvas=document.getElementById("c");
  var cw=document.getElementById("cw");
  var cwrap=document.getElementById("cwrap");
  var netbig=document.getElementById("netbig");
  var nb2d=netbig.getContext("2d");
  var gl=canvas.getContext("webgl")||canvas.getContext("experimental-webgl");

  function cs(type,id) {
    var s=gl.createShader(type);
    gl.shaderSource(s,document.getElementById(id).textContent);
    gl.compileShader(s); return s;
  }
  var prog=gl.createProgram();
  gl.attachShader(prog,cs(gl.VERTEX_SHADER,"vs"));
  gl.attachShader(prog,cs(gl.FRAGMENT_SHADER,"fs"));
  gl.linkProgram(prog); gl.useProgram(prog);
  var aPos=gl.getAttribLocation(prog,"aPos");
  var aNorm=gl.getAttribLocation(prog,"aNorm");
  var aCol=gl.getAttribLocation(prog,"aCol");
  var uMVP=gl.getUniformLocation(prog,"uMVP");
  var uNR=gl.getUniformLocation(prog,"uNR");
  gl.enableVertexAttribArray(aPos); gl.enableVertexAttribArray(aNorm); gl.enableVertexAttribArray(aCol);
  var vbo=gl.createBuffer();

  var FN=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  var FV=[
    [[0.5,0.5,0.5],[0.5,-0.5,0.5],[0.5,-0.5,-0.5],[0.5,0.5,-0.5]],
    [[-0.5,0.5,-0.5],[-0.5,-0.5,-0.5],[-0.5,-0.5,0.5],[-0.5,0.5,0.5]],
    [[-0.5,0.5,0.5],[0.5,0.5,0.5],[0.5,0.5,-0.5],[-0.5,0.5,-0.5]],
    [[-0.5,-0.5,-0.5],[0.5,-0.5,-0.5],[0.5,-0.5,0.5],[-0.5,-0.5,0.5]],
    [[-0.5,0.5,0.5],[-0.5,-0.5,0.5],[0.5,-0.5,0.5],[0.5,0.5,0.5]],
    [[0.5,0.5,-0.5],[0.5,-0.5,-0.5],[-0.5,-0.5,-0.5],[-0.5,0.5,-0.5]]
  ];
  var TI=[0,1,2,0,2,3];

  function buildVerts(aa,al,ad,ang) {
    var v=[]; var sc=0.9/N; var sp=1.0/N; var ctr=(N-1)/2;
    var ca=Math.cos(ang), sa=Math.sin(ang)*ad;
    for (var i=0;i<cubies.length;i++) {
      var cb=cubies[i];
      var inA=(aa===0&&cb.x===al)||(aa===1&&cb.y===al)||(aa===2&&cb.z===al);
      var wx=(cb.x-ctr)*sp, wy=(cb.y-ctr)*sp, wz=(cb.z-ctr)*sp;
      for (var fi=0;fi<6;fi++) {
        var col=COLS[cb.c[fi]]; var fn=FN[fi]; var fq=FV[fi];
        for (var ti=0;ti<6;ti++) {
          var qi=TI[ti]; var qv=fq[qi];
          var px=wx+qv[0]*sc, py=wy+qv[1]*sc, pz=wz+qv[2]*sc;
          var nx=fn[0],ny=fn[1],nz=fn[2];
          if (inA&&ang!==0) {
            var tx,ty,tz,tnx,tny,tnz;
            if (aa===0) {
              tx=px;ty=ca*py-sa*pz;tz=sa*py+ca*pz;
              tnx=nx;tny=ca*ny-sa*nz;tnz=sa*ny+ca*nz;
            } else if (aa===1) {
              tx=ca*px+sa*pz;ty=py;tz=-sa*px+ca*pz;
              tnx=ca*nx+sa*nz;tny=ny;tnz=-sa*nx+ca*nz;
            } else {
              tx=ca*px-sa*py;ty=sa*px+ca*py;tz=pz;
              tnx=ca*nx-sa*ny;tny=sa*nx+ca*ny;tnz=nz;
            }
            px=tx;py=ty;pz=tz;nx=tnx;ny=tny;nz=tnz;
          }
          v.push(px,py,pz,nx,ny,nz,col[0],col[1],col[2]);
        }
      }
    }
    return new Float32Array(v);
  }

  function m4(){return new Float32Array(16);}
  function id(m){for(var i=0;i<16;i++)m[i]=0;m[0]=m[5]=m[10]=m[15]=1;return m;}
  function mul(o,a,b){for(var i=0;i<4;i++)for(var j=0;j<4;j++){var s=0;for(var k=0;k<4;k++)s+=a[i+k*4]*b[k+j*4];o[i+j*4]=s;}return o;}
  function persp(m,fov,asp,nr,fr){id(m);var f=1/Math.tan(fov/2);m[0]=f/asp;m[5]=f;m[10]=(fr+nr)/(nr-fr);m[11]=-1;m[14]=2*fr*nr/(nr-fr);m[15]=0;return m;}
  function rX(m,r){id(m);var c=Math.cos(r),s=Math.sin(r);m[5]=c;m[6]=s;m[9]=-s;m[10]=c;return m;}
  function rY(m,r){id(m);var c=Math.cos(r),s=Math.sin(r);m[0]=c;m[2]=-s;m[8]=s;m[10]=c;return m;}
  function tr(m,x,y,z){id(m);m[12]=x;m[13]=y;m[14]=z;return m;}

  var proj=m4(),view=m4(),model=m4(),rx=m4(),ry=m4(),tmp=m4(),mvp=m4();
  var rotXv=0.5,rotYv=0.6,zoom=2.5;
  var drag=false,lx=0,ly=0,pinch0=0;

  canvas.addEventListener("mousedown",function(e){drag=true;lx=e.clientX;ly=e.clientY;});
  window.addEventListener("mouseup",function(){drag=false;});
  window.addEventListener("mousemove",function(e){if(!drag)return;rotYv+=(e.clientX-lx)*0.01;rotXv+=(e.clientY-ly)*0.01;lx=e.clientX;ly=e.clientY;});
  canvas.addEventListener("wheel",function(e){e.preventDefault();zoom=Math.max(1.5,Math.min(10,zoom+e.deltaY*0.01));},{passive:false});
  canvas.addEventListener("touchstart",function(e){e.preventDefault();if(e.touches.length===1){drag=true;lx=e.touches[0].clientX;ly=e.touches[0].clientY;}else if(e.touches.length===2){pinch0=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);}},{passive:false});
  canvas.addEventListener("touchmove",function(e){e.preventDefault();if(e.touches.length===1&&drag){rotYv+=(e.touches[0].clientX-lx)*0.01;rotXv+=(e.touches[0].clientY-ly)*0.01;lx=e.touches[0].clientX;ly=e.touches[0].clientY;}else if(e.touches.length===2){var d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);zoom=Math.max(1.5,Math.min(10,zoom-(d-pinch0)*0.02));pinch0=d;}},{passive:false});
  canvas.addEventListener("touchend",function(){drag=false;});

  // --- 2D net (big) ---
  var HEX=["#f0f0f0","#ffd800","#00a030","#1450e8","#e01010","#ff8000","#141414"];

  function getCb(x,y,z) {
    for (var i=0;i<cubies.length;i++) if(cubies[i].x===x&&cubies[i].y===y&&cubies[i].z===z) return cubies[i];
    return null;
  }

  function drawNetBig() {
    var wr=cwrap.getBoundingClientRect();
    var W=Math.round(wr.width), H=Math.round(wr.height);
    if(W<=0||H<=0) return;
    netbig.width=W; netbig.height=H;
    nb2d.fillStyle="#0a0c10";
    nb2d.fillRect(0,0,W,H);
    var gap=2;
    var cellW=Math.floor((W*0.88)/(4*N+3));
    var cellH=Math.floor((H*0.82)/(3*N+2));
    var cell=Math.max(4,Math.min(cellW,cellH));
    var cs=cell+gap;
    var netW=4*N*cs-gap, netH=3*N*cs-gap;
    var ox=Math.floor((W-netW)/2), oy=Math.floor((H-netH)/2);
    var n1=N-1;
    function df(nr,nc,gfn) {
      var bx=ox+nc*N*cs, by=oy+nr*N*cs;
      for (var r=0;r<N;r++) for (var c=0;c<N;c++) {
        nb2d.fillStyle=HEX[gfn(r,c)];
        nb2d.fillRect(bx+c*cs,by+r*cs,cell,cell);
      }
    }
    df(0,1,function(r,c){return getCb(c,n1,r).c[2];});
    df(1,0,function(r,c){return getCb(0,n1-r,c).c[1];});
    df(1,1,function(r,c){return getCb(c,n1-r,n1).c[4];});
    df(1,2,function(r,c){return getCb(n1,n1-r,n1-c).c[0];});
    df(1,3,function(r,c){return getCb(n1-c,n1-r,0).c[5];});
    df(2,1,function(r,c){return getCb(c,0,n1-r).c[3];});
    // face labels
    nb2d.fillStyle="#58a6ff";
    nb2d.font="bold "+(Math.max(9,cell-2))+"px monospace";
    nb2d.textAlign="center";
    var lc=cell/2;
    var labels=[["U",0,1],["L",1,0],["F",1,1],["R",1,2],["B",1,3],["D",2,1]];
    for(var li=0;li<labels.length;li++){
      var lb=labels[li];
      nb2d.fillText(lb[0], ox+lb[2]*N*cs+N*cs/2, oy+lb[1]*N*cs-3);
    }
  }

  // --- Animation state ---
  var moveQ=[],animMv=null,animProg=0,scramMvs=[],allMvs=[],mvIdx=0;
  var solving=false,scrambling=false;
  var stEl=document.getElementById("st"),mbEl=document.getElementById("mb");
  var spdEl=document.getElementById("spd"),spdvEl=document.getElementById("spdv");
  spdEl.addEventListener("input",function(){spdvEl.textContent=spdEl.value;});
  function getSpd(){return parseInt(spdEl.value)*0.035;}

  function updDisplay() {
    var h="";
    for (var i=0;i<allMvs.length;i++) {
      var cls;
      if (solving) {
        if (i===mvIdx&&animMv) cls="mc";
        else if (i>mvIdx) cls="mn";
        else cls="md";
      } else {
        cls=i<mvIdx?"md":(i===mvIdx&&animMv?"mc":"mn");
      }
      h+="<span class="+cls+">"+allMvs[i].n+" </span>";
    }
    mbEl.innerHTML=h;
    var cur=mbEl.querySelector(".mc");
    if (cur) cur.scrollIntoView({block:"nearest"});
  }

  function enterScrambleView() {
    cw.classList.add("sm");
    netbig.style.display="block";
    drawNetBig();
  }

  function exitScrambleView() {
    cw.classList.remove("sm");
    netbig.style.display="none";
  }

  function doScramble() {
    if (animMv) return;
    initCube(N);
    var len=Math.floor(Math.random()*31)+70;
    scramMvs=genScramble(len);
    allMvs=scramMvs.map(function(m){return {axis:m.axis,layer:m.layer,dir:m.dir,n:mname(m.axis,m.layer,m.dir)};});
    mvIdx=0; solving=false; scrambling=false; moveQ=[];
    mbEl.innerHTML="";
    enterScrambleView();
    stEl.textContent="3秒後にスクランブル開始 ("+len+"手)...";
    setTimeout(function(){
      moveQ=scramMvs.slice(); scrambling=true;
      stEl.textContent="スクランブル中... 0/"+len+"手";
      updDisplay();
    },3000);
  }

  function doSolve() {
    if (animMv||scramMvs.length===0||scrambling) return;
    var sm=[];
    for (var i=scramMvs.length-1;i>=0;i--) sm.push({axis:scramMvs[i].axis,layer:scramMvs[i].layer,dir:-scramMvs[i].dir});
    moveQ=sm.slice();
    mvIdx=scramMvs.length-1; solving=true; scrambling=false;
    stEl.textContent="ソルブ中... 0/"+scramMvs.length+"手";
    updDisplay();
  }

  function doReset() {
    if (animMv) return;
    initCube(N); scramMvs=[]; allMvs=[]; moveQ=[]; mvIdx=0; solving=false; scrambling=false;
    stEl.textContent="ソルブ済み"; mbEl.innerHTML="";
    exitScrambleView();
  }

  document.getElementById("btnS").addEventListener("click",doScramble);
  document.getElementById("btnV").addEventListener("click",doSolve);
  document.getElementById("btnR").addEventListener("click",doReset);
  document.getElementById("sizesel").addEventListener("click",function(e){
    var b=e.target.closest(".seg-btn"); if(!b) return;
    var n=parseInt(b.getAttribute("data-n"));
    document.querySelectorAll(".seg-btn").forEach(function(x){x.classList.remove("active");});
    b.classList.add("active"); N=n; doReset();
  });

  function resize(){
    var r=cw.getBoundingClientRect();
    var w=Math.round(r.width),h=Math.round(r.height);
    if(w>0&&h>0&&(canvas.width!==w||canvas.height!==h)){canvas.width=w;canvas.height=h;}
  }
  resize();
  window.addEventListener("resize",function(){
    resize();
    if(netbig.style.display!=="none") drawNetBig();
  });

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  initCube(N);

  function frame() {
    requestAnimationFrame(frame);
    resize();
    var W=canvas.width,H=canvas.height;
    if(W===0||H===0) return;
    gl.viewport(0,0,W,H);
    gl.clearColor(0.07,0.08,0.09,1);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

    var aa=-1,al=-1,ad=0,ang=0;
    if (animMv) {
      animProg+=getSpd();
      if (animProg>=1) {
        applyMove(animMv.axis,animMv.layer,animMv.dir);
        animMv=null; animProg=0;
        if (solving) { mvIdx--; } else { mvIdx++; }
        updDisplay();
        drawNetBig();
        var total=allMvs.length;
        if (scrambling) {
          if (moveQ.length===0) { scrambling=false; stEl.textContent="スクランブル完了 ("+total+"手)"; }
          else stEl.textContent="スクランブル中... "+mvIdx+"/"+total+"手";
        } else if (solving) {
          if (moveQ.length===0) { solving=false; scramMvs=[]; stEl.textContent="ソルブ完了！"; exitScrambleView(); }
          else stEl.textContent="ソルブ中... "+(total-1-mvIdx)+"/"+total+"手";
        }
      } else { aa=animMv.axis;al=animMv.layer;ad=animMv.dir;ang=animProg*Math.PI/2; }
    } else if (moveQ.length>0) { animMv=moveQ.shift(); animProg=0; }

    rX(rx,rotXv); rY(ry,rotYv);
    mul(model,rx,ry);
    tr(view,0,0,-zoom);
    mul(tmp,view,model);
    persp(proj,Math.PI/4,W/H,0.1,50);
    mul(mvp,proj,tmp);
    gl.uniformMatrix4fv(uMVP,false,mvp);
    gl.uniformMatrix3fv(uNR,false,new Float32Array([
      model[0],model[1],model[2],model[4],model[5],model[6],model[8],model[9],model[10]
    ]));

    var verts=buildVerts(aa,al,ad,ang);
    gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
    gl.bufferData(gl.ARRAY_BUFFER,verts,gl.DYNAMIC_DRAW);
    var stride=9*4;
    gl.vertexAttribPointer(aPos,3,gl.FLOAT,false,stride,0);
    gl.vertexAttribPointer(aNorm,3,gl.FLOAT,false,stride,12);
    gl.vertexAttribPointer(aCol,3,gl.FLOAT,false,stride,24);
    gl.drawArrays(gl.TRIANGLES,0,verts.length/9);
  }
  requestAnimationFrame(frame);
})();
</script>
</body>
</html>`;
}
