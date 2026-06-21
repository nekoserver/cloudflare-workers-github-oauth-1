type MonthGameDates = Record<string, {US: boolean, CA: boolean, MX: boolean}>;
type MonthPreload = {key: string, dates: MonthGameDates} | null;

export function getMLBSpherePage(username: string, monthPreload: MonthPreload = null): string {
  const safeUser = username.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const preloadJson = monthPreload ? JSON.stringify(monthPreload) : 'null';
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0d1117">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>MLB</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { background:#000; color:#e6edf3; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:13px; height:100vh; height:100dvh; display:flex; flex-direction:column; overflow:hidden; }
.topbar { background:#0d1117; border-bottom:1px solid #30363d; padding:8px 18px; display:flex; align-items:center; gap:10px; flex-shrink:0; }
.topbar a { color:#58a6ff; text-decoration:none; font-size:12px; }
h1 { font-size:14px; font-weight:700; }
.badge { background:#0c2d4e; color:#58a6ff; font-size:10px; padding:2px 7px; border-radius:10px; font-weight:600; }
.body { display:grid; grid-template-columns:1fr 260px; flex:1; min-height:0; }
@media(max-width:860px){ .body{ grid-template-columns:1fr; } .side{ display:none !important; } }
.canvas-wrap { position:relative; background:#000010; overflow:hidden; }
canvas { position:absolute; inset:0; width:100%; height:100%; cursor:grab; touch-action:none; display:block; }
canvas:active { cursor:grabbing; }
.hud { position:absolute; bottom:10px; left:10px; background:rgba(0,0,0,.7); border:1px solid #30363d; border-radius:6px; padding:6px 10px; font-size:11px; font-family:monospace; color:#58a6ff; pointer-events:none; }
#markers { position:absolute; inset:0; pointer-events:none; overflow:hidden; }
.mlb-mk { position:absolute; transform:translate(-50%,-50%); color:#fff; font-size:9px; font-weight:700; font-family:monospace; padding:3px 6px; border-radius:4px; border:1.5px solid rgba(255,255,255,0.25); pointer-events:auto; cursor:pointer; user-select:none; -webkit-user-select:none; letter-spacing:0.5px; white-space:nowrap; box-shadow:0 1px 4px rgba(0,0,0,0.7); line-height:1.4; }
.mlb-mk.active { border-color:#58a6ff !important; box-shadow:0 0 0 2px rgba(88,166,255,0.5),0 1px 4px rgba(0,0,0,0.7); }
.mlb-us-center { font-size:22px; padding:0; background:none !important; border:none !important; box-shadow:none !important; filter:drop-shadow(0 1px 3px rgba(0,0,0,0.8)); }
#mk-tooltip { position:fixed; background:rgba(13,17,23,0.97); border:1px solid #58a6ff; border-radius:8px; padding:10px 14px; font-size:12px; color:#e6edf3; max-width:340px; max-height:80vh; overflow-y:auto; pointer-events:none; opacity:0; transition:opacity .15s; z-index:60; transform:translate(-50%,-110%); line-height:1.6; text-align:center; }
#mk-tooltip.below { transform:translate(-50%,14px); }
#mk-tooltip.tt-left-side { transform:translate(-100%,-50%); }
.tt-stadium { font-weight:700; font-size:13px; }
.tt-city { color:#8b949e; font-size:11px; margin-bottom:4px; }
.tt-game { margin-top:5px; padding-top:5px; border-top:1px solid #21262d; }
.tt-game:first-of-type { margin-top:0; padding-top:0; border-top:none; }
.tt-away { color:#c9d1d9; display:block; }
.tt-home { font-weight:700; display:block; }
.tt-vs { color:#484f58; }
.tt-time { font-family:monospace; font-size:11px; color:#58a6ff; display:block; }
.tt-live { color:#3fb950; font-weight:700; font-size:11px; }
.tt-final { color:#8b949e; font-size:11px; }
.tt-lu-wrap { margin-top:8px; padding-top:8px; border-top:1px solid #21262d; }
.tt-lu-hdr { font-size:9px; color:#8b949e; font-weight:700; text-transform:uppercase; letter-spacing:.5px; margin-bottom:5px; }
.tt-lu-grid { display:grid; grid-template-columns:1fr 1fr; gap:4px 8px; text-align:left; }
.tt-lu-col { font-size:10px; }
.tt-lu-team { font-size:9px; font-weight:700; color:#58a6ff; margin-bottom:3px; text-transform:uppercase; }
.tt-lu-sp { color:#f0883e; font-weight:700; margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.tt-lu-row { color:#c9d1d9; padding:1px 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.tt-lu-none { font-size:10px; color:#484f58; font-style:italic; margin-top:3px; }
.canvas-ctrl-btns { position:absolute; top:10px; right:10px; display:flex; gap:6px; z-index:5; }
.ctrl-btn { background:rgba(13,17,23,0.88); border:1px solid #30363d; border-radius:6px; color:#e6edf3; font-size:12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; padding:6px 12px; cursor:pointer; white-space:nowrap; }
.ctrl-btn:hover { border-color:#58a6ff; }
.ctrl-btn.active { background:#0c2d4e; border-color:#58a6ff; color:#58a6ff; }
.side { background:#0d1117; border-left:1px solid #30363d; overflow-y:auto; display:flex; flex-direction:column; }
.side-hdr { padding:10px 12px 6px; font-size:10px; font-weight:700; color:#58a6ff; text-transform:uppercase; letter-spacing:.5px; border-bottom:1px solid #30363d; flex-shrink:0; }
.div-section { padding:8px 12px; border-bottom:1px solid #21262d; }
.div-label { font-size:9px; font-weight:700; color:#8b949e; text-transform:uppercase; letter-spacing:.5px; margin-bottom:5px; }
.div-teams { display:flex; flex-wrap:wrap; gap:4px; }
.team-badge { font-size:9px; font-weight:700; font-family:monospace; padding:3px 6px; border-radius:4px; color:#fff; cursor:default; opacity:0.28; border:1.5px solid transparent; letter-spacing:0.5px; transition:opacity .15s,border-color .15s; }
.team-badge.has-game { opacity:1; border-color:rgba(255,255,255,0.2); cursor:pointer; }
.team-badge.has-game:hover { border-color:#58a6ff; }
.team-badge.active { border-color:#58a6ff !important; box-shadow:0 0 0 1px rgba(88,166,255,0.4); }
#drawer-overlay { position:fixed; inset:0; z-index:68; background:rgba(0,0,0,.55); display:none; }
#drawer-overlay.open { display:block; }
#left-drawer { position:fixed; top:0; left:0; bottom:0; width:320px; max-width:92vw; z-index:69; background:#0d1117; border-right:2px solid #30363d; transform:translateX(-100%); transition:transform .3s ease; display:flex; flex-direction:column; }
#left-drawer.open { transform:translateX(0); }
.drw-hdr { display:flex; align-items:center; justify-content:space-between; padding:12px 14px 10px; border-bottom:1px solid #30363d; flex-shrink:0; }
.drw-title { font-size:13px; font-weight:700; color:#58a6ff; }
.drw-close { background:none; border:none; color:#8b949e; font-size:22px; line-height:1; cursor:pointer; padding:0 2px; }
.drw-scroll { overflow-y:auto; flex:1; }
#cal-wrap { padding:10px 12px; border-bottom:1px solid #30363d; flex-shrink:0; }
.cal-hdr { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
.cal-month-lbl { font-size:12px; font-weight:700; color:#e6edf3; }
.cal-nav { background:none; border:1px solid #30363d; border-radius:4px; color:#8b949e; font-size:13px; cursor:pointer; padding:2px 8px; line-height:1.4; }
.cal-nav:hover { border-color:#58a6ff; color:#58a6ff; }
.cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; }
.cal-dow { font-size:9px; color:#8b949e; text-align:center; padding:3px 0; font-weight:700; }
.cal-day { font-size:11px; text-align:center; padding:5px 2px; border-radius:4px; cursor:pointer; color:#c9d1d9; }
.cal-day:hover { background:#21262d; }
.cal-today { color:#58a6ff; font-weight:700; border:1px solid #58a6ff; border-radius:4px; }
.cal-sel { background:#0c2d4e; color:#58a6ff; font-weight:700; }
.cal-country-hl { background:#3a2e00; color:#ffd700; }
.cal-country-hl.cal-today { border-color:#ffd700; }
.cal-country-hl.cal-sel { background:#0c2d4e; color:#ffd700; }
.cal-allstar { position:relative; }
.cal-allstar::after { content:'★'; position:absolute; top:1px; right:2px; font-size:7px; color:#ffd700; line-height:1; }
.cal-flags { display:flex; gap:5px; padding:6px 0 2px; }
.cal-flag-btn { background:none; border:1px solid #30363d; border-radius:5px; font-size:16px; cursor:pointer; padding:3px 8px; line-height:1.4; transition:border-color .15s,background .15s; }
.cal-flag-btn:hover { border-color:#58a6ff; }
.cal-flag-btn.active { border-color:#ffd700; background:rgba(255,215,0,0.12); }
#game-list { flex:1; }
.game-date-hdr { padding:7px 12px 4px; font-size:10px; font-weight:700; color:#8b949e; letter-spacing:.5px; text-transform:uppercase; border-bottom:1px solid #21262d; position:sticky; top:0; background:#0d1117; }
.game-card { padding:8px 12px; border-bottom:1px solid #21262d; cursor:pointer; border-left:2px solid transparent; }
.game-card:hover { background:#21262d; }
.game-card:active { background:#21262d; }
.game-card.live-now { background:rgba(63,185,80,0.07); border-left-color:#3fb950; }
.game-card.up-next { background:rgba(88,166,255,0.06); border-left-color:#58a6ff; }
.game-matchup { font-size:12px; font-weight:600; color:#e6edf3; margin-bottom:3px; }
.game-away { color:#c9d1d9; font-weight:400; }
.game-vs { color:#484f58; }
.game-home { color:#e6edf3; }
.game-meta { display:flex; justify-content:space-between; align-items:flex-start; gap:6px; }
.game-venue { font-size:10px; color:#484f58; flex:1; min-width:0; }
.game-times { display:flex; flex-direction:column; align-items:flex-end; flex-shrink:0; }
.game-time { font-family:monospace; font-size:11px; color:#58a6ff; white-space:nowrap; }
.game-live { color:#3fb950; font-weight:700; font-size:11px; }
.game-final { color:#555d68; font-size:11px; }
.drw-msg { padding:20px; color:#8b949e; text-align:center; font-size:13px; }
@media(display-mode:standalone){ .pwa-hide{ display:none !important; } }
.drw-tabs { display:flex; flex:1; }
.drw-tab { flex:1; padding:7px 4px; text-align:center; font-size:11px; font-weight:700; color:#8b949e; cursor:pointer; border-bottom:2px solid transparent; }
.drw-tab.active { color:#58a6ff; border-bottom-color:#58a6ff; }
.jp-wrap { padding:8px 10px 16px; }
.jp-sec-hdr { font-size:10px; font-weight:700; color:#8b949e; text-transform:uppercase; letter-spacing:.5px; margin:12px 0 5px; padding-bottom:3px; border-bottom:1px solid #21262d; }
.jp-tbl { width:100%; border-collapse:collapse; font-size:10px; }
.jp-tbl th { text-align:right; color:#484f58; font-weight:700; font-size:9px; padding:3px 3px; white-space:nowrap; }
.jp-tbl th:first-child { text-align:left; }
.jp-tbl td { padding:5px 3px; border-bottom:1px solid #21262d; vertical-align:middle; text-align:right; }
.jp-tbl td:first-child { text-align:left; }
.jp-name { font-weight:700; color:#e6edf3; font-size:11px; }
.jp-num { color:#8b949e; font-size:9px; margin-left:2px; }
.jp-pos { color:#8b949e; font-size:9px; }
.jp-team-tag { font-size:8px; font-family:monospace; padding:1px 3px; border-radius:3px; color:#fff; display:inline-block; margin-top:1px; }
.jp-today-start { color:#3fb950; font-size:10px; font-weight:700; }
.jp-today-game { color:#58a6ff; font-size:10px; }
.jp-today-none { color:#484f58; font-size:10px; }
.jp-stat { color:#c9d1d9; font-family:monospace; }
.jp-stat-na { color:#484f58; font-family:monospace; }
.jp-next-date { color:#f0883e; font-size:10px; }
.jp-next-none { color:#484f58; font-size:10px; }
.jp-loading { color:#484f58; font-style:italic; font-size:11px; padding:12px; text-align:center; }
</style>
</head>
<body>

<script id="vs" type="x-shader/x-vertex">
attribute vec3 aPos; attribute vec3 aNorm; attribute vec2 aUV;
uniform mat4 uMVP; uniform mat4 uModel; uniform vec3 uLight;
varying vec2 vUV; varying float vDiff; varying float vSpec; varying float vRim;
void main() {
  vec3 wn=normalize((uModel*vec4(aNorm,0.0)).xyz); vec3 wl=normalize(uLight);
  vDiff=max(dot(wn,wl),0.0);
  vec3 toEye=normalize(vec3(0.0,0.0,1.0)); vec3 halfv=normalize(wl+toEye);
  vSpec=pow(max(dot(wn,halfv),0.0),64.0); vRim=pow(1.0-abs(dot(wn,toEye)),3.0);
  vUV=aUV; gl_Position=uMVP*vec4(aPos,1.0);
}
</script>
<script id="fs" type="x-shader/x-fragment">
precision mediump float;
uniform sampler2D uTex; uniform float uNight;
varying vec2 vUV; varying float vDiff; varying float vSpec; varying float vRim;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
void main(){
  vec4 earth=texture2D(uTex,vUV);
  float isOcean=clamp((earth.b-earth.r*0.8-earth.g*0.3)*3.0,0.0,1.0);
  vec3 baseColor=mix(earth.rgb,vec3(0.05,0.18,0.52),isOcean);
  float night=clamp(1.0-vDiff*8.0,0.0,1.0)*uNight;
  float amb=mix(0.25,0.03,night);
  vec3 col=baseColor*(amb+vDiff*(1.0-amb));
  col+=vec3(0.5,0.8,1.0)*vSpec*isOcean*0.7;
  col+=vec3(0.25,0.55,1.0)*vRim*0.5+vec3(0.1,0.3,0.9)*vRim*vRim*0.25;
  float isLand=1.0-isOcean;
  vec2 c1=floor(vUV*192.0); float city1=step(0.955,hash(c1))*isLand;
  vec2 c2=floor(vUV*512.0); float city2=step(0.982,hash(c2+vec2(17.0,31.0)))*isLand;
  col+=vec3(1.0,0.75,0.35)*(city1*0.7+city2*0.3)*night;
  gl_FragColor=vec4(col,1.0);
}
</script>

<div class="topbar">
  <h1>&#9918; MLB</h1>
  <span class="badge" id="hdr-date"></span>
</div>

<div class="body">
  <div class="canvas-wrap">
    <canvas id="c"></canvas>
    <div id="markers"></div>
    <div class="hud" id="hud">&#35501;&#12415;&#36796;&#12415;&#20013;...</div>
    <div class="canvas-ctrl-btns">
      <button class="ctrl-btn" id="btnGames">&#9918; &#35430;&#21512;&#19968;&#35239;</button>
      <button class="ctrl-btn" id="btnMLBView">&#9918; &#20840;&#29699;&#22243;</button>
      <button class="ctrl-btn active" id="btnAutoRot">&#9654; &#22238;&#36578;</button>
      <button class="ctrl-btn" id="btnNight">&#127769; &#22812;&#26223;</button>
    </div>
  </div>
  <div class="side" id="side-panel">
    <div class="side-hdr">&#9918; 30&#29699;&#22280; &#8212; &#12487;&#12451;&#12499;&#12472;&#12519;&#12531;&#19968;&#35239;</div>
  </div>
</div>

<div id="mk-tooltip"></div>
<div id="drawer-overlay"></div>
<div id="left-drawer">
  <div class="drw-hdr">
    <div class="drw-tabs">
      <div class="drw-tab active" id="tabGames">&#9918; &#20840;&#35430;&#21512;</div>
      <div class="drw-tab" id="tabJP">&#127991; &#26085;&#26412;&#20154;</div>
    </div>
    <button class="drw-close" id="drwClose">&#10005;</button>
  </div>
  <div id="cal-wrap"></div>
  <div class="drw-scroll">
    <div id="game-list"><div class="drw-msg">&#35501;&#12415;&#36796;&#12415;&#20013;...</div></div>
  </div>
</div>

<script>
(function() {
  var MLB_STADIUMS = {
    108:{name:'Angel Stadium',city:'Anaheim, CA',lat:33.8003,lon:-117.8827,abbr:'LAA',color:'#BA0021'},
    109:{name:'Chase Field',city:'Phoenix, AZ',lat:33.4453,lon:-112.0667,abbr:'ARI',color:'#A71930'},
    110:{name:'Oriole Park at Camden Yards',city:'Baltimore, MD',lat:39.2838,lon:-76.6217,abbr:'BAL',color:'#DF4601'},
    111:{name:'Fenway Park',city:'Boston, MA',lat:42.3467,lon:-71.0972,abbr:'BOS',color:'#BD3039'},
    112:{name:'Wrigley Field',city:'Chicago, IL',lat:41.9484,lon:-87.6553,abbr:'CHC',color:'#0E3386'},
    113:{name:'Great American Ball Park',city:'Cincinnati, OH',lat:39.0979,lon:-84.5082,abbr:'CIN',color:'#C6011F'},
    114:{name:'Progressive Field',city:'Cleveland, OH',lat:41.4954,lon:-81.6854,abbr:'CLE',color:'#E31937'},
    115:{name:'Coors Field',city:'Denver, CO',lat:39.7559,lon:-104.9942,abbr:'COL',color:'#6F263D'},
    116:{name:'Comerica Park',city:'Detroit, MI',lat:42.3390,lon:-83.0485,abbr:'DET',color:'#0C2340'},
    117:{name:'Minute Maid Park',city:'Houston, TX',lat:29.7572,lon:-95.3553,abbr:'HOU',color:'#002D62'},
    118:{name:'Kauffman Stadium',city:'Kansas City, MO',lat:39.0517,lon:-94.4803,abbr:'KC',color:'#004687'},
    119:{name:'Dodger Stadium',city:'Los Angeles, CA',lat:34.0739,lon:-118.2400,abbr:'LAD',color:'#005A9C'},
    120:{name:'Nationals Park',city:'Washington, DC',lat:38.8730,lon:-77.0074,abbr:'WSH',color:'#AB0003'},
    121:{name:'Citi Field',city:'Queens, NY',lat:40.7571,lon:-73.8458,abbr:'NYM',color:'#002D72'},
    133:{name:'Sutter Health Park',city:'Sacramento, CA',lat:38.5802,lon:-121.5001,abbr:'OAK',color:'#003831'},
    134:{name:'PNC Park',city:'Pittsburgh, PA',lat:40.4469,lon:-80.0057,abbr:'PIT',color:'#FDB827'},
    135:{name:'Petco Park',city:'San Diego, CA',lat:32.7076,lon:-117.1570,abbr:'SD',color:'#2F241D'},
    136:{name:'T-Mobile Park',city:'Seattle, WA',lat:47.5914,lon:-122.3326,abbr:'SEA',color:'#0C2C56'},
    137:{name:'Oracle Park',city:'San Francisco, CA',lat:37.7786,lon:-122.3893,abbr:'SF',color:'#FD5A1E'},
    138:{name:'Busch Stadium',city:'St. Louis, MO',lat:38.6226,lon:-90.1928,abbr:'STL',color:'#C41E3A'},
    139:{name:'Tropicana Field',city:'St. Petersburg, FL',lat:27.7683,lon:-82.6534,abbr:'TB',color:'#092C5C'},
    140:{name:'Globe Life Field',city:'Arlington, TX',lat:32.7512,lon:-97.0832,abbr:'TEX',color:'#003278'},
    141:{name:'Rogers Centre',city:'Toronto, ON',lat:43.6414,lon:-79.3894,abbr:'TOR',color:'#134A8E'},
    142:{name:'Target Field',city:'Minneapolis, MN',lat:44.9817,lon:-93.2781,abbr:'MIN',color:'#002B5C'},
    143:{name:'Citizens Bank Park',city:'Philadelphia, PA',lat:39.9057,lon:-75.1665,abbr:'PHI',color:'#E81828'},
    144:{name:'Truist Park',city:'Cumberland, GA',lat:33.8908,lon:-84.4677,abbr:'ATL',color:'#CE1141'},
    145:{name:'Guaranteed Rate Field',city:'Chicago, IL',lat:41.8299,lon:-87.6338,abbr:'CWS',color:'#27251F'},
    146:{name:'loanDepot park',city:'Miami, FL',lat:25.7781,lon:-80.2197,abbr:'MIA',color:'#00A3E0'},
    147:{name:'Yankee Stadium',city:'Bronx, NY',lat:40.8296,lon:-73.9262,abbr:'NYY',color:'#003087'},
    158:{name:'American Family Field',city:'Milwaukee, WI',lat:43.0280,lon:-87.9712,abbr:'MIL',color:'#12284B'}
  };

  var DIVISIONS = [
    {name:'AL East', teams:[110,111,147,139,141]},
    {name:'AL Central', teams:[145,114,116,118,142]},
    {name:'AL West', teams:[117,108,133,136,140]},
    {name:'NL East', teams:[144,146,121,143,120]},
    {name:'NL Central', teams:[112,113,158,134,138]},
    {name:'NL West', teams:[109,115,119,135,137]}
  ];

  var JP_PLAYERS = [
    {id:660271,name:'大谷翔平',team:'LAD',teamId:119,num:17,pos:'TWP',type:'2W'},
    {id:808967,name:'山本由伸',team:'LAD',teamId:119,num:18,pos:'SP',type:'P'},
    {id:808963,name:'佐々木朗希',team:'LAD',teamId:119,num:11,pos:'SP',type:'P'},
    {id:684007,name:'今永昇太',team:'CHC',teamId:112,num:18,pos:'SP',type:'P'},
    {id:579328,name:'菊池雄星',team:'LAA',teamId:108,num:16,pos:'SP',type:'P'},
    {id:506433,name:'ダルビッシュ有',team:'SD',teamId:135,num:11,pos:'SP',type:'P'},
    {id:673513,name:'松井裕樹',team:'SD',teamId:135,num:1,pos:'RP',type:'P'},
    {id:673548,name:'鈴木誠也',team:'CHC',teamId:112,num:27,pos:'RF',type:'H'},
    {id:807799,name:'吉田正尚',team:'BOS',teamId:111,num:7,pos:'DH',type:'H'},
    {id:672960,name:'岡本和真',team:'TOR',teamId:141,num:7,pos:'3B',type:'H'},
    {id:808959,name:'村上宗隆',team:'CWS',teamId:145,num:5,pos:'1B',type:'H'}
  ];
  var jpStatsCache={}, jpNextCache={}, jpBoxCache={};
  var activeTab='games';

  var MLB_CENTER_LAT=0, MLB_CENTER_LON=0, MLB_FIT_ZOOM=2.2;
  (function(){
    var ids=Object.keys(MLB_STADIUMS), n=ids.length, sx=0,sy=0,sz=0;
    for(var i=0;i<n;i++){
      var sd=MLB_STADIUMS[parseInt(ids[i])];
      var lr=sd.lat*Math.PI/180, lo=sd.lon*Math.PI/180;
      sx+=Math.cos(lr)*Math.cos(lo); sy+=Math.cos(lr)*Math.sin(lo); sz+=Math.sin(lr);
    }
    sx/=n; sy/=n; sz/=n;
    var cx=Math.atan2(sz,Math.sqrt(sx*sx+sy*sy))*180/Math.PI;
    var cy=Math.atan2(sy,sx)*180/Math.PI;
    function maxDist(clat,clon){
      var clr=clat*Math.PI/180,clo2=clon*Math.PI/180,md=0;
      for(var k=0;k<n;k++){
        var s=MLB_STADIUMS[parseInt(ids[k])];
        var lr2=s.lat*Math.PI/180,lo2=s.lon*Math.PI/180;
        var dot=Math.sin(clr)*Math.sin(lr2)+Math.cos(clr)*Math.cos(lr2)*Math.cos(lo2-clo2);
        var d=Math.acos(Math.max(-1,Math.min(1,dot)));
        if(d>md)md=d;
      }
      return md;
    }
    var step=4.0;
    for(var iter=0;iter<400;iter++){
      var best=maxDist(cx,cy),improved=false;
      var dirs=[[step,0],[-step,0],[0,step],[0,-step]];
      for(var di=0;di<4;di++){
        var nd=maxDist(cx+dirs[di][0],cy+dirs[di][1]);
        if(nd<best-1e-9){best=nd;cx+=dirs[di][0];cy+=dirs[di][1];improved=true;break;}
      }
      if(!improved)step*=0.5;
      if(step<0.0005)break;
    }
    MLB_CENTER_LAT=cx; MLB_CENTER_LON=cy;
    var margin=0.68, fh=Math.PI/8, maxD=maxDist(cx,cy);
    MLB_FIT_ZOOM=Math.max(1.6, Math.sin(maxD)/(margin*Math.tan(fh))+Math.cos(maxD));
  })();

  var ALL_STAR_EVENTS = {
    '2026-07-10': 'All-Star Futures Game',
    '2026-07-11': 'Home Run Derby',
    '2026-07-14': 'All-Star Game'
  };

  var todayGames = [], stadiumGames = {}, gameCache = {};
  var countryFilter = null;
  var monthScheduleCache = (function(){
    var pre = ${preloadJson};
    if (pre && pre.key && pre.dates) {
      var c = {}; c[pre.key] = pre.dates; return c;
    }
    return {};
  })();
  var MEXICO_KW = ['Harp', 'Monterrey', 'Mexico', 'Estadio'];
  function venueCountry(homeTeamId, venueName) {
    if (homeTeamId === 141) return 'CA';
    for (var k = 0; k < MEXICO_KW.length; k++) { if (venueName.indexOf(MEXICO_KW[k]) >= 0) return 'MX'; }
    return 'US';
  }
  function fetchMonthSchedule(year, month) {
    var mm = month < 10 ? '0' + month : '' + month;
    var key = year + '-' + mm;
    if (monthScheduleCache[key] !== undefined) return;
    monthScheduleCache[key] = null;
    var lastDay = new Date(year, month, 0).getDate();
    var startDate = key + '-01';
    var endDate = key + '-' + (lastDay < 10 ? '0' + lastDay : '' + lastDay);
    fetch('/api/mlb-schedule?startDate=' + startDate + '&endDate=' + endDate)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var result = {};
        (data.dates || []).forEach(function(d) {
          var ctry = {US: false, CA: false, MX: false};
          (d.games || []).forEach(function(g) {
            var c = venueCountry(g.teams && g.teams.home && g.teams.home.team && g.teams.home.team.id, g.venue && g.venue.name || '');
            ctry[c] = true;
          });
          result[d.date] = ctry;
        });
        monthScheduleCache[key] = result;
        buildCalendar();
      })
      .catch(function() { monthScheduleCache[key] = {}; });
  }

  var now = new Date();
  function toDateStr(d) {
    var mm = d.getMonth()+1, dd = d.getDate();
    return d.getFullYear() + '-' + (mm<10?'0'+mm:mm) + '-' + (dd<10?'0'+dd:dd);
  }
  var selectedDate = toDateStr(now);
  var calYear = now.getFullYear(), calMonth = now.getMonth();

  var canvas = document.getElementById('c');
  var wrap = canvas.parentElement;
  var hud = document.getElementById('hud');
  var markersDiv = document.getElementById('markers');
  var tooltip = document.getElementById('mk-tooltip');

  function resize() {
    var r = wrap.getBoundingClientRect(), w = Math.round(r.width), h = Math.round(r.height);
    if (w>0&&h>0&&(canvas.width!==w||canvas.height!==h)){canvas.width=w;canvas.height=h;}
  }
  resize();
  window.addEventListener('resize', resize);

  var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) { hud.textContent = 'WebGL が利用できません'; return; }

  function compileShader(type, src) {
    var s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s); return s;
  }
  var prog = gl.createProgram();
  gl.attachShader(prog, compileShader(gl.VERTEX_SHADER,   document.getElementById('vs').textContent));
  gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, document.getElementById('fs').textContent));
  gl.linkProgram(prog); gl.useProgram(prog);

  var LAT=64, LON=128, verts=[], idxs=[];
  for (var i=0;i<=LAT;i++) {
    var theta=i/LAT*Math.PI, sinT=Math.sin(theta), cosT=Math.cos(theta);
    for (var j=0;j<=LON;j++) {
      var phi=j/LON*2*Math.PI, x=-sinT*Math.cos(phi), y=cosT, z=sinT*Math.sin(phi);
      verts.push(x,y,z,x,y,z,j/LON,i/LAT);
    }
  }
  for (var i=0;i<LAT;i++) for (var j=0;j<LON;j++) {
    var a=i*(LON+1)+j, b=a+(LON+1); idxs.push(a,b,a+1,b,b+1,a+1);
  }
  var vbo=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.STATIC_DRAW);
  var ibo=gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(idxs),gl.STATIC_DRAW);
  var stride=8*4, aPos=gl.getAttribLocation(prog,'aPos'), aNorm=gl.getAttribLocation(prog,'aNorm'), aUV=gl.getAttribLocation(prog,'aUV');
  gl.enableVertexAttribArray(aPos);  gl.vertexAttribPointer(aPos, 3,gl.FLOAT,false,stride,0);
  gl.enableVertexAttribArray(aNorm); gl.vertexAttribPointer(aNorm,3,gl.FLOAT,false,stride,12);
  gl.enableVertexAttribArray(aUV);   gl.vertexAttribPointer(aUV,  2,gl.FLOAT,false,stride,24);
  var uMVP=gl.getUniformLocation(prog,'uMVP'), uModel=gl.getUniformLocation(prog,'uModel'), uLight=gl.getUniformLocation(prog,'uLight');
  gl.uniform1i(gl.getUniformLocation(prog,'uTex'),0);
  var uNightL=gl.getUniformLocation(prog,'uNight'); gl.uniform1f(uNightL,0.0);

  var nightMode=false;
  document.getElementById('btnNight').addEventListener('click',function(){
    nightMode=!nightMode; gl.uniform1f(uNightL,nightMode?1.0:0.0); this.classList.toggle('active',nightMode);
  });

  function getSunDir(){
    var n=new Date(), utcH=n.getUTCHours()+n.getUTCMinutes()/60;
    var sunLon=(utcH-12)/24*2*Math.PI;
    var start=new Date(Date.UTC(n.getUTCFullYear(),0,1)), doy=Math.floor((n.getTime()-start.getTime())/86400000);
    var sunLat=23.45*Math.PI/180*Math.sin(2*Math.PI*(doy-80)/365);
    return [Math.cos(sunLat)*Math.cos(sunLon),Math.sin(sunLat),Math.cos(sunLat)*Math.sin(sunLon)];
  }

  var texEarth=gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,texEarth);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([10,30,70,255]));
  var earthImg=new Image();
  earthImg.onload=function(){
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,texEarth);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,earthImg);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    if (hud.textContent.indexOf('読') >= 0) hud.textContent = '';
  };
  earthImg.onerror=function(){ hud.textContent='テクスチャ読み込み失敗'; };
  earthImg.src='/earth.jpg';

  function m4(){return new Float32Array(16);}
  function ident(m){for(var i=0;i<16;i++)m[i]=0;m[0]=m[5]=m[10]=m[15]=1;return m;}
  function mul(o,a,b){for(var i=0;i<4;i++)for(var j=0;j<4;j++){var s=0;for(var k=0;k<4;k++)s+=a[i+k*4]*b[k+j*4];o[i+j*4]=s;}return o;}
  function persp(m,fov,asp,near,far){ident(m);var f=1/Math.tan(fov/2);m[0]=f/asp;m[5]=f;m[10]=(far+near)/(near-far);m[11]=-1;m[14]=2*far*near/(near-far);m[15]=0;return m;}
  function rotX(m,r){ident(m);var c=Math.cos(r),s=Math.sin(r);m[5]=c;m[6]=s;m[9]=-s;m[10]=c;return m;}
  function rotY(m,r){ident(m);var c=Math.cos(r),s=Math.sin(r);m[0]=c;m[2]=-s;m[8]=s;m[10]=c;return m;}
  function rotZ(m,r){ident(m);var c=Math.cos(r),s=Math.sin(r);m[0]=c;m[1]=s;m[4]=-s;m[5]=c;return m;}
  function trans(m,x,y,z){ident(m);m[12]=x;m[13]=y;m[14]=z;return m;}

  var axialTilt=-23.4*Math.PI/180, ELEV_MAX=Math.PI/2-0.02;
  function clampElev(v){return v<-ELEV_MAX?-ELEV_MAX:(v>ELEV_MAX?ELEV_MAX:v);}
  var proj=m4(),view=m4(),model=m4(),rx=m4(),ry=m4(),tz=m4(),tmp=m4(),tmp2=m4(),mvp=m4();
  var rotXv=0.35, rotYv=0.1, zoom=3.2, zoomTarget=3.2, autoRot=false;
  var drag=false, lx=0, ly=0, velY=0, velX=0, momentumY=0, momentumX=0, MOMENTUM_DECAY=0.92;

  var btnAutoRot=document.getElementById('btnAutoRot');
  btnAutoRot.addEventListener('click',function(){
    autoRot=!autoRot;
    this.textContent=autoRot?'⏸ 自転停止':'▶ 回転';
    this.classList.toggle('active',!autoRot);
  });
  canvas.addEventListener('mousedown',function(e){drag=true;lx=e.clientX;ly=e.clientY;momentumY=0;momentumX=0;velY=0;velX=0;});
  window.addEventListener('mouseup',function(){if(!drag)return;drag=false;momentumY=velY*0.7;momentumX=velX*0.7;velY=0;velX=0;});
  window.addEventListener('mousemove',function(e){
    if(!drag)return;
    var dy=(e.clientX-lx)*0.008,dx=(e.clientY-ly)*0.008;
    rotYv+=dy;velY=velY*0.4+dy*0.6;rotXv=clampElev(rotXv+dx);velX=velX*0.4+dx*0.6;lx=e.clientX;ly=e.clientY;
  });
  canvas.addEventListener('wheel',function(e){e.preventDefault();zoomTarget=Math.max(1.5,Math.min(8,zoomTarget+e.deltaY*0.003));},{passive:false});
  var touches={},pinch0=0;
  canvas.addEventListener('touchstart',function(e){
    e.preventDefault();
    for(var i=0;i<e.changedTouches.length;i++){var t=e.changedTouches[i];touches[t.identifier]={x:t.clientX,y:t.clientY};}
    var ids=Object.keys(touches);
    if(ids.length===2){var t0=touches[ids[0]],t1=touches[ids[1]];pinch0=Math.hypot(t1.x-t0.x,t1.y-t0.y);drag=false;}
    else{drag=true;var tc=e.changedTouches[0];lx=tc.clientX;ly=tc.clientY;momentumY=0;momentumX=0;}
  },{passive:false});
  canvas.addEventListener('touchmove',function(e){
    e.preventDefault();
    for(var i=0;i<e.changedTouches.length;i++){var t=e.changedTouches[i];touches[t.identifier]={x:t.clientX,y:t.clientY};}
    var ids=Object.keys(touches);
    if(ids.length===2){
      var t0=touches[ids[0]],t1=touches[ids[1]],p1=Math.hypot(t1.x-t0.x,t1.y-t0.y);
      if(pinch0>0)zoomTarget=Math.max(1.5,Math.min(8,zoomTarget-(p1-pinch0)*0.015));pinch0=p1;
    }else if(ids.length===1&&drag){
      var t=touches[ids[0]];
      var dy=(t.x-lx)*0.008,dx=(t.y-ly)*0.008;
      rotYv+=dy;velY=velY*0.4+dy*0.6;rotXv=clampElev(rotXv+dx);velX=velX*0.4+dx*0.6;lx=t.x;ly=t.y;
    }
  },{passive:false});
  canvas.addEventListener('touchend',function(e){
    for(var i=0;i<e.changedTouches.length;i++)delete touches[e.changedTouches[i].identifier];
    if(Object.keys(touches).length===0){if(drag){momentumY=velY*0.7;momentumX=velX*0.7;}drag=false;pinch0=0;}
  },{passive:false});

  var flyTarget=null,flyFrom=null,flyStart=0,FLY_DUR=2000;
  function flyTo(lat,lon){
    var ty=-(Math.PI/2+lon*Math.PI/180);
    var tx=Math.atan(Math.cos(axialTilt)*Math.tan(lat*Math.PI/180));
    var dy=ty-rotYv;
    while(dy>Math.PI)dy-=2*Math.PI; while(dy<-Math.PI)dy+=2*Math.PI;
    momentumY=0;momentumX=0;flyFrom={ry:rotYv,rx:rotXv};flyTarget={ry:rotYv+dy,rx:tx};flyStart=performance.now();
    autoRot=false;btnAutoRot.textContent='▶ 回転';btnAutoRot.classList.add('active');
  }

  var mkEls=[], activeHomeId=-1, canvasRect=canvas.getBoundingClientRect(), stadiumTooltipLeftMode=false;

  function latLonTo3D(lat,lon){
    var latR=lat*Math.PI/180,lonR=lon*Math.PI/180;
    return [Math.cos(latR)*Math.cos(lonR),Math.sin(latR),-Math.cos(latR)*Math.sin(lonR)];
  }

  function hideTooltip(){
    tooltip.style.opacity='0'; activeHomeId=-1; stadiumTooltipLeftMode=false; tooltip.classList.remove('tt-left-side');
    for(var i=0;i<mkEls.length;i++)mkEls[i].el.classList.remove('active');
    document.querySelectorAll('.team-badge').forEach(function(b){b.classList.remove('active');});
  }

  function positionTooltip(vx,vy){
    tooltip.style.left=vx+'px'; tooltip.style.top=vy+'px';
    if(stadiumTooltipLeftMode){
      tooltip.classList.add('tt-left-side'); tooltip.classList.remove('below');
    }else{
      tooltip.classList.remove('tt-left-side');
      if(vy<canvasRect.top+80){tooltip.classList.add('below');}else{tooltip.classList.remove('below');}
    }
  }

  function fmtTime(utcStr,tzId,label){
    var d=new Date(utcStr);
    try{return new Intl.DateTimeFormat('en-US',{timeZone:tzId,hour:'numeric',minute:'2-digit',hour12:true}).format(d)+' '+label;}
    catch(e2){return utcStr;}
  }

  function fmtLName(p){
    if(!p||!p.fullName)return '?';
    var nm=p.fullName, sp=nm.lastIndexOf(' ');
    return sp>=0?nm.substring(sp+1):nm;
  }

  function buildLineupHtml(lu,awayAbbr,homeAbbr){
    if(!lu)return '<div class="tt-lu-none">&#8987; スタメン取得中...</div>';
    if(lu==='none')return '<div class="tt-lu-none">スタメン未発表</div>';
    function extractBatters(side){
      var batters=side.batters||[], players=side.players||{}, result=[];
      for(var i=0;i<batters.length;i++){
        var pl=players['ID'+batters[i]]; if(!pl)continue;
        var ord=parseInt(pl.battingOrder||'0',10);
        if(ord>0&&ord%100===0)result.push({name:pl.person&&pl.person.fullName?pl.person.fullName:'?',pos:pl.position&&pl.position.abbreviation?pl.position.abbreviation:''});
      }
      return result;
    }
    function extractSP(side){
      var pitchers=side.pitchers||[], players=side.players||{};
      if(!pitchers.length)return null;
      var pl=players['ID'+pitchers[0]];
      return pl&&pl.person?pl.person.fullName:null;
    }
    var awBat=extractBatters(lu.away||{}), hmBat=extractBatters(lu.home||{});
    var awSP=extractSP(lu.away||{}), hmSP=extractSP(lu.home||{});
    if(!awBat.length&&!hmBat.length&&!awSP&&!hmSP)return '<div class="tt-lu-none">スタメン未発表</div>';
    var html='<div class="tt-lu-wrap"><div class="tt-lu-hdr">&#127358; スタメン</div><div class="tt-lu-grid">';
    html+='<div class="tt-lu-col"><div class="tt-lu-team">'+awayAbbr+'</div>';
    if(awSP)html+='<div class="tt-lu-sp">P '+fmtLName({fullName:awSP})+'</div>';
    for(var i=0;i<awBat.length;i++)html+='<div class="tt-lu-row">'+(i+1)+' '+awBat[i].pos+' '+fmtLName({fullName:awBat[i].name})+'</div>';
    html+='</div><div class="tt-lu-col"><div class="tt-lu-team">'+homeAbbr+'</div>';
    if(hmSP)html+='<div class="tt-lu-sp">P '+fmtLName({fullName:hmSP})+'</div>';
    for(var j=0;j<hmBat.length;j++)html+='<div class="tt-lu-row">'+(j+1)+' '+hmBat[j].pos+' '+fmtLName({fullName:hmBat[j].name})+'</div>';
    html+='</div></div></div>';
    return html;
  }

  function buildTooltipHtml(homeId){
    var sd=MLB_STADIUMS[homeId], games=stadiumGames[homeId]||[];
    var html='<div class="tt-stadium">&#127967; '+sd.name+'</div><div class="tt-city">'+sd.city+'</div>';
    for(var gi=0;gi<games.length;gi++){
      var g=games[gi], state=(g.status&&g.status.abstractGameState)||'Preview';
      html+='<div class="tt-game">';
      html+='<span class="tt-away">'+g.awayAbbr+' '+g.awayName+'</span>';
      html+='<span class="tt-home"><span class="tt-vs">@ </span>'+sd.abbr+' '+g.homeName+'</span>';
      if(state==='Live'){
        var liveScoreTt='';
        if(g.awayScore!=null&&g.homeScore!=null){
          var innTxt=g.inning?(((g.inningHalf||'').charAt(0)==='B'?'B':'T')+g.inning):'';
          liveScoreTt=' &nbsp;<span style="font-family:monospace;font-size:14px;color:#fff;font-weight:700">'+g.awayScore+' - '+g.homeScore+'</span>'+(innTxt?' <span style="font-size:10px;color:#8b949e">'+innTxt+(g.outs!=null?' '+g.outs+'out':'')+'</span>':'');
        }
        html+='<span class="tt-live">&#9679; LIVE'+liveScoreTt+'</span>';
      }
      else if(state==='Final'){
        var finalScoreTt='';
        if(g.awayScore!=null&&g.homeScore!=null)finalScoreTt=' &nbsp;<span style="font-family:monospace;font-size:13px;font-weight:700">'+g.awayScore+' - '+g.homeScore+'</span>';
        html+='<span class="tt-final">&#32199;&#20102;'+finalScoreTt+'</span>';
      }
      else{
        html+='<span class="tt-time">'+fmtTime(g.gameDate,'America/New_York','ET')+'</span>';
        html+='<span class="tt-time">'+fmtTime(g.gameDate,'America/Los_Angeles','PT')+'</span>';
        html+='<span class="tt-time">'+fmtTime(g.gameDate,'Asia/Tokyo','JST')+'</span>';
      }
      var awAbbr=g.awayAbbr||(g.awayName||'').split(' ').pop()||'';
      html+=buildLineupHtml(g.lineups||null,awAbbr,sd.abbr);
      html+='</div>';
    }
    return html;
  }

  function showStadiumTooltip(homeId){
    var sd=MLB_STADIUMS[homeId], games=stadiumGames[homeId];
    if(!sd||!games||games.length===0)return;
    hideTooltip();
    activeHomeId=homeId;
    tooltip.innerHTML=buildTooltipHtml(homeId);
    for(var i=0;i<mkEls.length;i++)mkEls[i].el.classList.toggle('active',mkEls[i].homeId===homeId);
    document.querySelectorAll('.team-badge[data-tid="'+homeId+'"]').forEach(function(b){b.classList.add('active');});
    stadiumTooltipLeftMode=true; tooltip.classList.add('tt-left-side');
    flyTo(sd.lat,sd.lon);
    setTimeout(function(){if(activeHomeId===homeId)tooltip.style.opacity='1';},900);
    games.forEach(function(g){
      if(!g.gamePk||g.lineups!==null)return;
      fetch('/api/mlb-boxscore?gamePk='+g.gamePk)
        .then(function(r){return r.json();})
        .then(function(data){
          g.lineups=data.teams?{away:data.teams.away,home:data.teams.home}:'none';
          if(data.teams){
            var at=data.teams.away&&data.teams.away.teamStats&&data.teams.away.teamStats.batting;
            var ht=data.teams.home&&data.teams.home.teamStats&&data.teams.home.teamStats.batting;
            if(at&&at.runs!=null)g.awayScore=at.runs;
            if(ht&&ht.runs!=null)g.homeScore=ht.runs;
          }
          if(activeHomeId===homeId)tooltip.innerHTML=buildTooltipHtml(homeId);
        })
        .catch(function(){g.lineups='none';});
    });
  }

  function buildMarkers(){
    markersDiv.innerHTML=''; mkEls=[];
    var seen={};
    for(var i=0;i<todayGames.length;i++){
      var g=todayGames[i]; if(seen[g.homeId])continue; seen[g.homeId]=true;
      var sd=MLB_STADIUMS[g.homeId]; if(!sd)continue;
      var el=document.createElement('div');
      el.className='mlb-mk'; el.textContent=sd.abbr; el.style.background=sd.color;
      var hid=g.homeId;
      el.addEventListener('click',function(id){return function(e){e.stopPropagation();showStadiumTooltip(id);};}(hid));
      markersDiv.appendChild(el);
      mkEls.push({el:el,pos3d:latLonTo3D(sd.lat,sd.lon),homeId:hid});
    }
    var usCenter=document.createElement('div');
    usCenter.className='mlb-mk mlb-us-center'; usCenter.textContent='⚾'; usCenter.style.pointerEvents='none';
    markersDiv.appendChild(usCenter);
    mkEls.push({el:usCenter,pos3d:latLonTo3D(39.5,-98.35),homeId:-1});
  }

  function buildSidePanel(){
    var sideEl=document.getElementById('side-panel');
    var html='<div class="side-hdr">&#9918; 30&#29699;&#22280; &mdash; &#12487;&#12451;&#12499;&#12472;&#12519;&#12531;&#19968;&#35239;</div>';
    DIVISIONS.forEach(function(div){
      html+='<div class="div-section"><div class="div-label">'+div.name+'</div><div class="div-teams">';
      div.teams.forEach(function(tid){
        var sd=MLB_STADIUMS[tid]; if(!sd)return;
        var hasGame=!!(stadiumGames[tid]&&stadiumGames[tid].length>0);
        var style='background:'+sd.color+(hasGame?'':';filter:grayscale(0.5)');
        html+='<div class="team-badge'+(hasGame?' has-game':'')+'" data-tid="'+tid+'" style="'+style+'">'+sd.abbr+'</div>';
      });
      html+='</div></div>';
    });
    sideEl.innerHTML=html;
    sideEl.querySelectorAll('.team-badge.has-game').forEach(function(el){
      el.addEventListener('click',function(){showStadiumTooltip(parseInt(this.dataset.tid,10));});
    });
  }

  function buildCalendar(){
    var MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
    var firstDay=new Date(calYear,calMonth,1).getDay();
    var daysInMonth=new Date(calYear,calMonth+1,0).getDate();
    var todayY=now.getFullYear(),todayM=now.getMonth(),todayD=now.getDate();
    var mm2=calMonth+1;
    var monthKey=calYear+'-'+(mm2<10?'0'+mm2:mm2);
    var monthData=monthScheduleCache[monthKey];
    if(countryFilter && monthData === undefined) fetchMonthSchedule(calYear, mm2);
    var html='<div class="cal-hdr">';
    html+='<button class="cal-nav" id="calPrev">&#8592;</button>';
    html+='<span class="cal-month-lbl">'+MONTHS[calMonth]+' '+calYear+'</span>';
    html+='<button class="cal-nav" id="calNext">&#8594;</button>';
    html+='</div><div class="cal-grid">';
    ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(function(d){html+='<div class="cal-dow">'+d+'</div>';});
    for(var i=0;i<firstDay;i++)html+='<div></div>';
    for(var day=1;day<=daysInMonth;day++){
      var isToday=(calYear===todayY&&calMonth===todayM&&day===todayD);
      var ds=calYear+'-'+(mm2<10?'0'+mm2:mm2)+'-'+(day<10?'0'+day:day);
      var hasHl=!!(countryFilter && monthData && monthData[ds] && monthData[ds][countryFilter]);
      var isAllStar=!!ALL_STAR_EVENTS[ds];
      var cls='cal-day'+(isToday?' cal-today':'')+(ds===selectedDate?' cal-sel':'')+(hasHl?' cal-country-hl':'')+(isAllStar?' cal-allstar':'');
      html+='<div class="'+cls+'" data-date="'+ds+'">'+day+'</div>';
    }
    html+='</div>';
    document.getElementById('cal-wrap').innerHTML=html;
    document.getElementById('calPrev').addEventListener('click',function(){
      calMonth--;if(calMonth<0){calMonth=11;calYear--;}buildCalendar();
    });
    document.getElementById('calNext').addEventListener('click',function(){
      calMonth++;if(calMonth>11){calMonth=0;calYear++;}buildCalendar();
    });
    document.querySelectorAll('.cal-day[data-date]').forEach(function(el){
      el.addEventListener('click',function(){
        selectedDate=this.dataset.date;
        loadGamesForDate(selectedDate);
      });
    });
    ['US','CA','MX'].forEach(function(cc){
      var btn=document.getElementById('flag'+cc);
      if(btn) btn.addEventListener('click',function(){
        countryFilter=(countryFilter===cc)?null:cc;
        if(countryFilter) fetchMonthSchedule(calYear, mm2);
        buildCalendar();
      });
    });
  }

  function buildGameList(games,dateStr){
    var parts=dateStr.split('-');
    var label=parseInt(parts[1],10)+'/'+parseInt(parts[2],10);
    var asEvent=ALL_STAR_EVENTS[dateStr];
    var asHtml=asEvent?'<div style="padding:8px 12px;border-bottom:1px solid #30363d;background:rgba(255,215,0,0.07)"><span style="color:#ffd700;font-weight:700;font-size:12px">&#11088; '+asEvent+'</span><div style="font-size:10px;color:#8b949e;margin-top:2px">Target Field &mdash; Minneapolis, MN</div></div>':'';
    if(games.length===0){
      document.getElementById('game-list').innerHTML=asHtml+'<div class="drw-msg">'+label+' の試合はありません</div>';
      return;
    }
    var html=asHtml+'<div class="game-date-hdr">'+label+' ('+games.length+'試合)</div>';
    var nowMs=Date.now();
    for(var i=0;i<games.length;i++){
      var g=games[i], sd=MLB_STADIUMS[g.homeId];
      var state=(g.status&&g.status.abstractGameState)||'Preview';
      var isLive=state==='Live', isFinal=state==='Final';
      var venue=sd?sd.name:(g.venue||'');
      var city=sd?sd.city:'';
      var startMs=g.gameDate?new Date(g.gameDate).getTime():0;
      var endMs=startMs+3.5*3600000;
      var isLiveNow=isLive||(startMs>0&&nowMs>=startMs&&nowMs<=endMs&&!isFinal);
      var isUpNext=!isLiveNow&&!isFinal&&startMs>0&&nowMs<startMs&&(startMs-nowMs)<=1800000;
      var cardCls='game-card'+(isLiveNow?' live-now':isUpNext?' up-next':'');
      var timeHtml='';
      if(isLive){
        var liveScoreCard='';
        if(g.awayScore!=null&&g.homeScore!=null){
          var innTxtC=g.inning?(((g.inningHalf||'').charAt(0)==='B'?'B':'T')+g.inning):'';
          liveScoreCard='<span style="font-family:monospace;font-weight:700;color:#fff"> '+g.awayScore+'-'+g.homeScore+'</span>'+(innTxtC?' <span style="font-size:10px;color:#8b949e">'+innTxtC+'</span>':'');
        }
        timeHtml='<span class="game-live">&#9679; LIVE'+liveScoreCard+'</span>';
      }
      else if(isFinal){
        var finalScoreCard='';
        if(g.awayScore!=null&&g.homeScore!=null)finalScoreCard=' <span style="font-family:monospace;font-weight:700">'+g.awayScore+'-'+g.homeScore+'</span>';
        timeHtml='<span class="game-final">&#32199;&#20102;'+finalScoreCard+'</span>';
      }
      else{
        timeHtml='<span class="game-time">'+fmtTime(g.gameDate,'America/New_York','ET')+'</span>';
        timeHtml+='<span class="game-time">'+fmtTime(g.gameDate,'America/Los_Angeles','PT')+'</span>';
        timeHtml+='<span class="game-time">'+fmtTime(g.gameDate,'Asia/Tokyo','JST')+'</span>';
      }
      html+='<div class="'+cardCls+'" data-hid="'+g.homeId+'">';
      html+='<div class="game-matchup">';
      html+='<span class="game-away">'+g.awayAbbr+' '+g.awayName+'</span>';
      html+='<span class="game-vs"> @ </span>';
      html+='<span class="game-home">'+(sd?sd.abbr:'')+' '+g.homeName+'</span>';
      html+='</div>';
      html+='<div class="game-meta">';
      html+='<div class="game-venue">&#127967; '+venue+(city?' &mdash; '+city:'')+'</div>';
      html+='<div class="game-times">'+timeHtml+'</div>';
      html+='</div>';
      html+='</div>';
    }
    document.getElementById('game-list').innerHTML=html;
    document.querySelectorAll('.game-card').forEach(function(card){
      card.addEventListener('click',function(){showStadiumTooltip(parseInt(this.dataset.hid,10));});
    });
  }

  function extractScore(g){
    var ls=g.linescore;
    if(!ls)return {awayScore:null,homeScore:null,inning:null,inningHalf:null,outs:null};
    var t=ls.teams||{};
    return {
      awayScore:t.away&&t.away.runs!=null?t.away.runs:null,
      homeScore:t.home&&t.home.runs!=null?t.home.runs:null,
      inning:ls.currentInning||null,
      inningHalf:ls.inningHalf||null,
      outs:ls.outs!=null?ls.outs:null
    };
  }

  function parseGames(rawGames){
    var list=[];
    for(var i=0;i<rawGames.length;i++){
      var g=rawGames[i];
      var ht=g.teams&&g.teams.home&&g.teams.home.team;
      var at=g.teams&&g.teams.away&&g.teams.away.team;
      if(!ht||!at)continue;
      var hsd=MLB_STADIUMS[ht.id], asd=MLB_STADIUMS[at.id];
      var sc=extractScore(g);
      list.push({
        homeId:ht.id, homeName:ht.name||'', homeAbbr:hsd?hsd.abbr:'',
        awayTeamId:at.id, awayName:at.name||'', awayAbbr:asd?asd.abbr:(at.name||'').split(' ').pop(),
        gameDate:g.gameDate||'', status:g.status||null,
        venue:g.venue?g.venue.name:'',
        gamePk:g.gamePk||null, lineups:null,
        awayScore:sc.awayScore, homeScore:sc.homeScore,
        inning:sc.inning, inningHalf:sc.inningHalf, outs:sc.outs
      });
    }
    list.sort(function(a,b){return a.gameDate<b.gameDate?-1:(a.gameDate>b.gameDate?1:0);});
    return list;
  }

  function applyGames(games,dateStr){
    todayGames=games; stadiumGames={};
    for(var i=0;i<games.length;i++){
      var g=games[i]; if(!stadiumGames[g.homeId])stadiumGames[g.homeId]=[];
      stadiumGames[g.homeId].push(g);
    }
    buildMarkers(); buildSidePanel(); buildGameList(games,dateStr);
    hud.textContent=games.length+'試合';
    startLivePolling(dateStr);
  }

  var livePoller=null;
  function startLivePolling(dateStr){
    if(livePoller)clearInterval(livePoller);
    livePoller=setInterval(function(){
      var hasLive=false;
      for(var i=0;i<todayGames.length;i++){if((todayGames[i].status&&todayGames[i].status.abstractGameState)==='Live'){hasLive=true;break;}}
      if(!hasLive){clearInterval(livePoller);livePoller=null;return;}
      fetch('/api/mlb-schedule?date='+dateStr)
        .then(function(r){return r.json();})
        .then(function(data){
          var raw=(data.dates&&data.dates[0]&&data.dates[0].games)?data.dates[0].games:[];
          var fresh=parseGames(raw);
          for(var i=0;i<fresh.length;i++){
            for(var j=0;j<todayGames.length;j++){
              if(todayGames[j].gamePk===fresh[i].gamePk){
                todayGames[j].status=fresh[i].status;
                todayGames[j].awayScore=fresh[i].awayScore;
                todayGames[j].homeScore=fresh[i].homeScore;
                todayGames[j].inning=fresh[i].inning;
                todayGames[j].inningHalf=fresh[i].inningHalf;
                todayGames[j].outs=fresh[i].outs;
                stadiumGames[todayGames[j].homeId]=stadiumGames[todayGames[j].homeId]||[];
              }
            }
          }
          buildGameList(todayGames,dateStr);
          if(activeHomeId>=0)tooltip.innerHTML=buildTooltipHtml(activeHomeId);
        })
        .catch(function(){});
    },30000);
  }

  function loadGamesForDate(dateStr){
    selectedDate=dateStr; buildCalendar();
    if(livePoller){clearInterval(livePoller);livePoller=null;}
    if(gameCache[dateStr]){applyGames(gameCache[dateStr],dateStr);return;}
    document.getElementById('game-list').innerHTML='<div class="drw-msg">&#35501;&#12415;&#36796;&#12415;&#20013;...</div>';
    hud.textContent='&#35501;&#12415;&#36796;&#12415;&#20013;...';
    fetch('/api/mlb-schedule?date='+dateStr)
      .then(function(r){return r.json();})
      .then(function(data){
        var raw=(data.dates&&data.dates[0]&&data.dates[0].games)?data.dates[0].games:[];
        var games=parseGames(raw);
        gameCache[dateStr]=games;
        applyGames(games,dateStr);
      })
      .catch(function(){
        hud.textContent='取得失敗';
        document.getElementById('game-list').innerHTML='<div class="drw-msg">&#12487;&#12540;&#12479;&#12398;&#21462;&#24471;&#12395;&#22833;&#25943;&#12375;&#12414;&#12375;&#12383;</div>';
      });
  }

  var drawer=document.getElementById('left-drawer');
  var drawerOverlay=document.getElementById('drawer-overlay');
  function openDrawer(){drawer.classList.add('open');drawerOverlay.classList.add('open');}
  function closeDrawer(){drawer.classList.remove('open');drawerOverlay.classList.remove('open');}
  document.getElementById('btnGames').addEventListener('click',openDrawer);
  document.getElementById('drwClose').addEventListener('click',closeDrawer);
  drawerOverlay.addEventListener('click',closeDrawer);
  canvas.addEventListener('click',function(){hideTooltip();});

  function frame(now2){
    requestAnimationFrame(frame);
    resize(); canvasRect=canvas.getBoundingClientRect();
    var W=canvas.width,H=canvas.height; if(W===0||H===0)return;
    gl.viewport(0,0,W,H); gl.clearColor(0,0,0.02,1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    zoom+=(zoomTarget-zoom)*0.15;
    if(flyTarget!==null){
      var fp=Math.min((now2-flyStart)/FLY_DUR,1),fe=fp*fp*(3-2*fp);
      rotYv=flyFrom.ry+(flyTarget.ry-flyFrom.ry)*fe; rotXv=flyFrom.rx+(flyTarget.rx-flyFrom.rx)*fe;
      if(fp>=1)flyTarget=null;
    }else{
      if(autoRot)rotYv+=0.003;
      if(Math.abs(momentumY)>0.0002){rotYv+=momentumY;momentumY*=MOMENTUM_DECAY;}else momentumY=0;
      if(Math.abs(momentumX)>0.0002){rotXv=clampElev(rotXv+momentumX);momentumX*=MOMENTUM_DECAY;}else momentumX=0;
    }
    persp(proj,Math.PI/4,W/H,0.1,100); trans(view,0,0,-zoom);
    rotY(ry,rotYv);rotZ(tz,axialTilt);rotX(rx,rotXv);
    mul(tmp2,tz,ry);mul(model,rx,tmp2);mul(tmp,view,model);mul(mvp,proj,tmp);
    var sd2=getSunDir(); gl.uniform3f(uLight,sd2[0],sd2[1],sd2[2]);
    gl.uniformMatrix4fv(uMVP,false,mvp); gl.uniformMatrix4fv(uModel,false,model);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,texEarth);
    gl.enable(gl.DEPTH_TEST); gl.drawElements(gl.TRIANGLES,idxs.length,gl.UNSIGNED_SHORT,0);
    var MK_HALF=10;
    for(var mi=0;mi<mkEls.length;mi++){
      var mk=mkEls[mi],mp=mk.pos3d;
      var mz=model[2]*mp[0]+model[6]*mp[1]+model[10]*mp[2];
      if(mz>0.12){
        var mcx=mvp[0]*mp[0]+mvp[4]*mp[1]+mvp[8]*mp[2]+mvp[12];
        var mcy=mvp[1]*mp[0]+mvp[5]*mp[1]+mvp[9]*mp[2]+mvp[13];
        var mcw=mvp[3]*mp[0]+mvp[7]*mp[1]+mvp[11]*mp[2]+mvp[15];
        if(mcw>0){
          var px=(mcx/mcw+1)*0.5*W, py=(1-mcy/mcw)*0.5*H;
          mk.el.style.display=''; mk.el.style.left=px+'px'; mk.el.style.top=py+'px'; mk.el.style.opacity='1';
          if(mk.homeId===activeHomeId)positionTooltip(canvasRect.left+px-MK_HALF,canvasRect.top+py);
        }else{mk.el.style.opacity='0';if(mk.homeId===activeHomeId)hideTooltip();}
      }else{mk.el.style.opacity='0';if(mk.homeId===activeHomeId)hideTooltip();}
    }
  }

  function findTodayGame(teamId){
    for(var i=0;i<todayGames.length;i++){
      var g=todayGames[i];
      if(g.homeId===teamId||g.awayTeamId===teamId)return g;
    }
    return null;
  }

  function isPlayerStarting(lineups,playerId){
    if(!lineups||lineups==='none')return null;
    var sides=['away','home'];
    for(var s=0;s<sides.length;s++){
      var side=lineups[sides[s]]||{};
      var batters=side.batters||[], pitchers=side.pitchers||[], players=side.players||{};
      var allStarters=batters.concat(pitchers);
      for(var i=0;i<allStarters.length;i++){
        if(allStarters[i]===playerId){
          var pl=players['ID'+playerId];
          if(!pl)return true;
          var ord=parseInt(pl.battingOrder||'0',10);
          if(ord===0||ord%100===0)return true;
        }
      }
    }
    return false;
  }

  function fmtDecimal(val,dec){
    if(val===null||val===undefined||val==='')return '-';
    var n=parseFloat(val);
    if(isNaN(n))return '-';
    return n.toFixed(dec);
  }

  function fmtAvg(val){
    if(val===null||val===undefined||val==='')return '.---';
    var n=parseFloat(val);
    if(isNaN(n))return '.---';
    return n.toFixed(3).replace(/^0/,'');
  }

  function fmtERA(val){return fmtDecimal(val,2);}
  function fmtWHIP(val){return fmtDecimal(val,3);}
  function fmtOPS(val){
    if(val===null||val===undefined||val==='')return '.---';
    var n=parseFloat(val);
    if(isNaN(n))return '.---';
    return n.toFixed(3).replace(/^0/,'');
  }

  function buildJPTodayCell(teamId,playerId){
    var g=findTodayGame(teamId);
    if(!g)return '<span class="jp-today-none">-</span>';
    var state=(g.status&&g.status.abstractGameState)||'Preview';
    if(state==='Final')return '<span class="jp-today-none">終了</span>';
    if(state==='Live'){
      var starting=isPlayerStarting(g.lineups,playerId);
      if(starting===true)return '<span class="jp-today-start">● LIVE先発</span>';
      return '<span class="jp-today-game">● LIVE</span>';
    }
    if(!g.lineups){
      return '<span class="jp-today-game">試合あり</span>';
    }
    if(g.lineups==='none')return '<span class="jp-today-game">試合あり</span>';
    var starting=isPlayerStarting(g.lineups,playerId);
    if(starting===true)return '<span class="jp-today-start">先発</span>';
    return '<span class="jp-today-none">控え/未</span>';
  }

  function buildJPNextCell(teamId,playerId){
    var key='ns'+playerId;
    var v=jpNextCache[key];
    if(v===undefined)return '<span class="jp-next-none">取得中</span>';
    if(!v)return '<span class="jp-next-none">-</span>';
    var parts=v.date.split('-');
    var label=(parseInt(parts[1],10))+'/'+(parseInt(parts[2],10));
    return '<span class="jp-next-date">'+label+'</span>';
  }

  function renderJPView(){
    var pitchers=JP_PLAYERS.filter(function(p){return p.type==='P'||p.type==='2W';});
    var hitters=JP_PLAYERS.filter(function(p){return p.type==='H'||p.type==='2W';});
    var sd119=MLB_STADIUMS[119];
    var html='<div class="jp-wrap">';

    html+='<div class="jp-sec-hdr">&#9918; &#25237;&#25163;&#38542;</div>';
    html+='<table class="jp-tbl"><thead><tr>';
    html+='<th>&#36984;&#25163;</th><th>&#20170;&#26085;</th><th>&#27425;&#22238;</th><th>W-L</th><th>ERA</th><th>WHIP</th><th>K</th>';
    html+='</tr></thead><tbody>';
    for(var i=0;i<pitchers.length;i++){
      var p=pitchers[i];
      var sd=MLB_STADIUMS[p.teamId];
      var color=sd?sd.color:'#333';
      var ps=jpStatsCache['p'+p.id];
      var st=ps||{};
      var wins=st.wins!==undefined?st.wins:'-';
      var losses=st.losses!==undefined?st.losses:'-';
      var era=ps?fmtERA(st.era):'-';
      var whip=ps?fmtWHIP(st.whip):'-';
      var so=st.strikeOuts!==undefined?st.strikeOuts:'-';
      var statCls=ps?'jp-stat':'jp-stat-na';
      html+='<tr>';
      html+='<td><div class="jp-name">'+p.name+'<span class="jp-num">#'+p.num+'</span></div>';
      html+='<span class="jp-team-tag" style="background:'+color+'">'+p.team+'</span> <span class="jp-pos">'+p.pos+'</span></td>';
      html+='<td>'+buildJPTodayCell(p.teamId,p.id)+'</td>';
      html+='<td>'+buildJPNextCell(p.teamId,p.id)+'</td>';
      html+='<td class="'+statCls+'">'+wins+'-'+losses+'</td>';
      html+='<td class="'+statCls+'">'+era+'</td>';
      html+='<td class="'+statCls+'">'+whip+'</td>';
      html+='<td class="'+statCls+'">'+so+'</td>';
      html+='</tr>';
    }
    html+='</tbody></table>';

    html+='<div class="jp-sec-hdr">&#127966; &#37326;&#25163;&#38542;</div>';
    html+='<table class="jp-tbl"><thead><tr>';
    html+='<th>&#36984;&#25163;</th><th>&#20170;&#26085;</th><th>AVG</th><th>HR</th><th>RBI</th><th>OPS</th>';
    html+='</tr></thead><tbody>';
    for(var j=0;j<hitters.length;j++){
      var h=hitters[j];
      var sdh=MLB_STADIUMS[h.teamId];
      var hcolor=sdh?sdh.color:'#333';
      var hs=jpStatsCache['h'+h.id];
      var hst=hs||{};
      var avg=hs?fmtAvg(hst.avg):'.---';
      var hr=hst.homeRuns!==undefined?hst.homeRuns:'-';
      var rbi=hst.rbi!==undefined?hst.rbi:'-';
      var ops=hs?fmtOPS(hst.ops):'.---';
      var hstatCls=hs?'jp-stat':'jp-stat-na';
      html+='<tr>';
      html+='<td><div class="jp-name">'+h.name+'<span class="jp-num">#'+h.num+'</span></div>';
      html+='<span class="jp-team-tag" style="background:'+hcolor+'">'+h.team+'</span> <span class="jp-pos">'+h.pos+'</span></td>';
      html+='<td>'+buildJPTodayCell(h.teamId,h.id)+'</td>';
      html+='<td class="'+hstatCls+'">'+avg+'</td>';
      html+='<td class="'+hstatCls+'">'+hr+'</td>';
      html+='<td class="'+hstatCls+'">'+rbi+'</td>';
      html+='<td class="'+hstatCls+'">'+ops+'</td>';
      html+='</tr>';
    }
    html+='</tbody></table></div>';

    document.getElementById('game-list').innerHTML=html;
    document.getElementById('cal-wrap').style.display='none';
  }

  function fetchAllJPStats(){
    var pitchers=JP_PLAYERS.filter(function(p){return p.type==='P'||p.type==='2W';});
    var hitters=JP_PLAYERS.filter(function(p){return p.type==='H'||p.type==='2W';});
    pitchers.forEach(function(p){
      if(jpStatsCache['p'+p.id]!==undefined)return;
      jpStatsCache['p'+p.id]=null;
      fetch('/api/mlb-player-stats?playerId='+p.id+'&group=pitching')
        .then(function(r){return r.json();})
        .then(function(data){
          var sp=data.stats&&data.stats[0]&&data.stats[0].splits&&data.stats[0].splits[0];
          jpStatsCache['p'+p.id]=sp?sp.stat:null;
          if(activeTab==='jp')renderJPView();
        })
        .catch(function(){if(activeTab==='jp')renderJPView();});
    });
    hitters.forEach(function(p){
      if(jpStatsCache['h'+p.id]!==undefined)return;
      jpStatsCache['h'+p.id]=null;
      fetch('/api/mlb-player-stats?playerId='+p.id+'&group=hitting')
        .then(function(r){return r.json();})
        .then(function(data){
          var sp=data.stats&&data.stats[0]&&data.stats[0].splits&&data.stats[0].splits[0];
          jpStatsCache['h'+p.id]=sp?sp.stat:null;
          if(activeTab==='jp')renderJPView();
        })
        .catch(function(){if(activeTab==='jp')renderJPView();});
    });
    var pitcherTeams={};
    pitchers.forEach(function(p){pitcherTeams[p.teamId]=pitcherTeams[p.teamId]||[];pitcherTeams[p.teamId].push(p.id);});
    Object.keys(pitcherTeams).forEach(function(teamId){
      fetch('/api/mlb-next-start?teamId='+teamId)
        .then(function(r){return r.json();})
        .then(function(data){
          var pids=pitcherTeams[teamId];
          pids.forEach(function(pid){jpNextCache['ns'+pid]=null;});
          if(!data.dates)return;
          for(var di=0;di<data.dates.length;di++){
            var games=data.dates[di].games||[];
            for(var gi=0;gi<games.length;gi++){
              var g=games[gi], teams=g.teams||{};
              var sides=['home','away'];
              for(var si=0;si<sides.length;si++){
                var pp=teams[sides[si]]&&teams[sides[si]].probablePitcher;
                if(!pp)continue;
                for(var pi=0;pi<pids.length;pi++){
                  if(pp.id===pids[pi]&&jpNextCache['ns'+pids[pi]]===null){
                    jpNextCache['ns'+pids[pi]]={date:data.dates[di].date,gamePk:g.gamePk};
                  }
                }
              }
            }
          }
          if(activeTab==='jp')renderJPView();
        })
        .catch(function(){});
    });
    var jpTeams={};
    JP_PLAYERS.forEach(function(p){jpTeams[p.teamId]=true;});
    Object.keys(jpTeams).forEach(function(tid){
      var tidN=parseInt(tid,10);
      var g=findTodayGame(tidN);
      if(!g||!g.gamePk||g.lineups!==null)return;
      fetch('/api/mlb-boxscore?gamePk='+g.gamePk)
        .then(function(r){return r.json();})
        .then(function(data){
          g.lineups=data.teams?{away:data.teams.away,home:data.teams.home}:'none';
          if(activeTab==='jp')renderJPView();
        })
        .catch(function(){g.lineups='none';});
    });
  }

  function switchTab(tab){
    activeTab=tab;
    var tabGames=document.getElementById('tabGames');
    var tabJP=document.getElementById('tabJP');
    var calWrap=document.getElementById('cal-wrap');
    if(tab==='games'){
      tabGames.className='drw-tab active';
      tabJP.className='drw-tab';
      calWrap.style.display='';
      buildGameList(todayGames,selectedDate);
    }else{
      tabGames.className='drw-tab';
      tabJP.className='drw-tab active';
      renderJPView();
      fetchAllJPStats();
    }
  }

  var mlbLocked=false;
  var btnMLBView=document.getElementById('btnMLBView');
  btnMLBView.addEventListener('click',function(){
    mlbLocked=!mlbLocked;
    if(mlbLocked){
      flyTo(MLB_CENTER_LAT, MLB_CENTER_LON);
      zoomTarget=MLB_FIT_ZOOM;
      btnMLBView.classList.add('active');
      btnMLBView.textContent='🔒 全球団';
    }else{
      btnMLBView.classList.remove('active');
      btnMLBView.textContent='⚾ 全球団';
    }
  });
  canvas.addEventListener('mousedown',function(){if(mlbLocked){mlbLocked=false;btnMLBView.classList.remove('active');btnMLBView.textContent='⚾ 全球団';}});
  canvas.addEventListener('touchstart',function(){if(mlbLocked){mlbLocked=false;btnMLBView.classList.remove('active');btnMLBView.textContent='⚾ 全球団';}},{passive:true});

  document.getElementById('tabGames').addEventListener('click',function(){switchTab('games');});
  document.getElementById('tabJP').addEventListener('click',function(){switchTab('jp');});

  // init
  var mm=now.getMonth()+1, dd=now.getDate(), yyyy=now.getFullYear();
  document.getElementById('hdr-date').textContent=yyyy+'/'+(mm<10?'0'+mm:mm)+'/'+(dd<10?'0'+dd:dd);
  buildCalendar();
  buildSidePanel();
  requestAnimationFrame(frame);
  loadGamesForDate(selectedDate);
  setTimeout(openDrawer, 200);
})();
</script>
</body>
</html>`;
}
