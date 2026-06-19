export function getWorldCupWdlPage(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>W杯2026 WDL分布</title>
<style>
:root {
  color-scheme: light dark;
  --bg: light-dark(#f0f2f5, #0f0f1a);
  --surface: light-dark(#ffffff, #1a1a2e);
  --text: light-dark(#212529, #e0e0e0);
  --text-muted: light-dark(#6c757d, #888);
  --border: light-dark(#dee2e6, #333355);
  --header-bg: light-dark(#2c3e50, #0d0d1a);
  --header-text: #e0e0e0;
  --grp-header-bg: light-dark(#34495e, #1a1a3a);
  --pts-bg: light-dark(#ebf5fb, #0a1020);
  --pts-text: light-dark(#1a5276, #7ec8f0);
  --meta-bg: light-dark(#f8f9fa, #12121e);
  --win-bg: light-dark(#d5f5e3, #0d2e1a);
  --win-border: light-dark(#27ae60, #2ecc71);
  --draw-bg: light-dark(#fef9e7, #2e2a00);
  --draw-border: light-dark(#f39c12, #e6b800);
  --loss-bg: light-dark(#fadbd8, #2e0a0a);
  --loss-border: light-dark(#e74c3c, #ff6b6b);
  --badge-bg: light-dark(#f0f0f0, #252535);
  --badge-border: light-dark(#ccc, #444466);
  --row-alt: light-dark(#f9fbfc, #151520);
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--bg); color: var(--text); font-family: system-ui, -apple-system, sans-serif; padding: 12px; min-height: 100vh; }
.page-header { margin-bottom: 10px; }
h1 { font-size: 1.2rem; margin-bottom: 2px; }
.subtitle { color: var(--text-muted); font-size: 0.75rem; }
.table-wrap { overflow-x: auto; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.15); }
table { border-collapse: collapse; font-size: 0.75rem; background: var(--surface); }
th { padding: 6px 7px; text-align: center; border: 1px solid var(--border); white-space: nowrap; font-weight: 600; background: var(--header-bg); color: var(--header-text); }
th.grp { background: var(--grp-header-bg); }
td { padding: 4px 3px; border: 1px solid var(--border); vertical-align: middle; }
tr:nth-child(even) td { background: var(--row-alt); }
.pts { background: var(--pts-bg) !important; color: var(--pts-text); font-size: 1rem; font-weight: bold; text-align: center; min-width: 36px; }
.meta { background: var(--meta-bg) !important; text-align: center; font-weight: 600; min-width: 24px; }
.grp-cell { min-width: 64px; text-align: center; line-height: 1.6; }
.badge { display: inline-block; margin: 1px; padding: 1px 4px; border-radius: 3px; white-space: nowrap; font-size: 0.78rem; background: var(--badge-bg); border: 1px solid var(--badge-border); cursor: default; }
.badge-win { background: var(--win-bg); border-color: var(--win-border); }
.badge-draw { background: var(--draw-bg); border-color: var(--draw-border); }
.badge-loss { background: var(--loss-bg); border-color: var(--loss-border); }
.empty { color: var(--border); font-size: 0.68rem; }
.upd { margin-top: 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 12px; }
.upd h2 { font-size: 0.9rem; margin-bottom: 8px; }
.form-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-end; }
.fgrp { display: flex; flex-direction: column; gap: 2px; }
label { font-size: 0.7rem; color: var(--text-muted); }
select, button { padding: 5px 9px; border-radius: 4px; border: 1px solid var(--border); background: var(--bg); color: var(--text); font-size: 0.8rem; cursor: pointer; }
.btn-ok { background: #2980b9; color: #fff; border-color: #2980b9; font-weight: bold; }
.btn-ok:hover { background: #1a6fa0; }
.btn-ng { background: var(--loss-bg); color: var(--pts-text); border-color: var(--loss-border); }
.msg { margin-top: 5px; font-size: 0.75rem; color: var(--pts-text); min-height: 14px; }
</style>
</head>
<body>
<div class="page-header">
  <h1>&#x26BD; W&#26757;2026 WDL&#20998;&#24067;&#12486;&#12540;&#12502;&#12523;</h1>
  <p class="subtitle">&#12471;&#12540;&#12489;: 2026&#24180;6&#26376;18&#26085;&#65288;&#31532;1&#31680;&#32066;&#20102;&#65289; &#8203;/ &#35611;&#21512;&#32080;&#26524;&#20837;&#21147;&#12391;&#26356;&#26032;&#21487;&#33021;</p>
</div>
<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th>&#x52DD;&#x70B9;</th><th>W</th><th>D</th><th>L</th>
        <th class="grp">A</th><th class="grp">B</th><th class="grp">C</th>
        <th class="grp">D</th><th class="grp">E</th><th class="grp">F</th>
        <th class="grp">G</th><th class="grp">H</th><th class="grp">I</th>
        <th class="grp">J</th><th class="grp">K</th><th class="grp">L</th>
      </tr>
    </thead>
    <tbody id="tbody"></tbody>
  </table>
</div>

<div class="upd">
  <h2>&#35430;&#21512;&#32080;&#26524;&#20837;&#21147;</h2>
  <div class="form-row">
    <div class="fgrp"><label>&#12464;&#12523;&#12540;&#12503;</label><select id="selG"></select></div>
    <div class="fgrp"><label>&#12481;&#12540;&#12512;1</label><select id="selT1"></select></div>
    <div class="fgrp">
      <label>&#32080;&#26524;</label>
      <select id="selR">
        <option value="w1">&#12481;1&#21213;&#12385;</option>
        <option value="d">&#24341;&#12365;&#20998;</option>
        <option value="w2">&#12481;2&#21213;&#12385;</option>
      </select>
    </div>
    <div class="fgrp"><label>&#12481;&#12540;&#12512;2</label><select id="selT2"></select></div>
    <button class="btn-ok" id="btnOk">&#21453;&#26131;</button>
    <button class="btn-ng" id="btnRst">&#12522;&#12475;&#12483;&#12488;</button>
  </div>
  <div class="msg" id="msg"></div>
</div>

<script>
var GS = ["A","B","C","D","E","F","G","H","I","J","K","L"];

var SEED = {
  "A":[{n:"MX",f:"🇲🇽",w:1,d:0,l:0},{n:"KOR",f:"🇰🇷",w:0,d:0,l:1},{n:"CZE",f:"🇨🇿",w:0,d:1,l:0},{n:"RSA",f:"🇿🇦",w:0,d:1,l:0}],
  "B":[{n:"CAN",f:"🇨🇦",w:1,d:0,l:0},{n:"QAT",f:"🇶🇦",w:0,d:0,l:1},{n:"SUI",f:"🇨🇭",w:1,d:0,l:0},{n:"BIH",f:"🇧🇦",w:0,d:0,l:1}],
  "C":[{n:"BRA",f:"🇧🇷",w:0,d:1,l:0},{n:"MAR",f:"🇲🇦",w:0,d:1,l:0},{n:"SCO",f:"🏴󠁧󠁢󠁳󠁣󠁴󠁿",w:1,d:0,l:0},{n:"HAI",f:"🇭🇹",w:0,d:0,l:1}],
  "D":[{n:"USA",f:"🇺🇸",w:1,d:0,l:0},{n:"PAR",f:"🇵🇾",w:0,d:0,l:1},{n:"AUS",f:"🇦🇺",w:1,d:0,l:0},{n:"TUR",f:"🇹🇷",w:0,d:0,l:1}],
  "E":[{n:"GER",f:"🇩🇪",w:1,d:0,l:0},{n:"CUW",f:"🇨🇼",w:0,d:0,l:1},{n:"CIV",f:"🇨🇮",w:1,d:0,l:0},{n:"ECU",f:"🇪🇨",w:0,d:0,l:1}],
  "F":[{n:"NED",f:"🇳🇱",w:0,d:1,l:0},{n:"JPN",f:"🇯🇵",w:0,d:1,l:0},{n:"SWE",f:"🇸🇪",w:1,d:0,l:0},{n:"TUN",f:"🇹🇳",w:0,d:0,l:1}],
  "G":[{n:"BEL",f:"🇧🇪",w:0,d:1,l:0},{n:"EGY",f:"🇪🇬",w:0,d:1,l:0},{n:"IRN",f:"🇮🇷",w:0,d:1,l:0},{n:"NZL",f:"🇳🇿",w:0,d:1,l:0}],
  "H":[{n:"ESP",f:"🇪🇸",w:0,d:1,l:0},{n:"CPV",f:"🇨🇻",w:0,d:1,l:0},{n:"KSA",f:"🇸🇦",w:0,d:1,l:0},{n:"URU",f:"🇺🇾",w:0,d:1,l:0}],
  "I":[{n:"FRA",f:"🇫🇷",w:1,d:0,l:0},{n:"SEN",f:"🇸🇳",w:0,d:0,l:1},{n:"IRQ",f:"🇮🇶",w:0,d:0,l:1},{n:"NOR",f:"🇳🇴",w:1,d:0,l:0}],
  "J":[{n:"ARG",f:"🇦🇷",w:1,d:0,l:0},{n:"ALG",f:"🇩🇿",w:0,d:0,l:1},{n:"AUT",f:"🇦🇹",w:1,d:0,l:0},{n:"JOR",f:"🇯🇴",w:0,d:0,l:1}],
  "K":[{n:"POR",f:"🇵🇹",w:0,d:1,l:0},{n:"COD",f:"🇨🇩",w:0,d:1,l:0},{n:"UZB",f:"🇺🇿",w:0,d:0,l:1},{n:"COL",f:"🇨🇴",w:1,d:0,l:0}],
  "L":[{n:"ENG",f:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",w:1,d:0,l:0},{n:"CRO",f:"🇭🇷",w:0,d:0,l:1},{n:"GHA",f:"🇬🇭",w:1,d:0,l:0},{n:"PAN",f:"🇵🇦",w:0,d:0,l:1}]
};

var LS = "wc2026v1";
function clone(o){return JSON.parse(JSON.stringify(o));}
function load(){try{var s=localStorage.getItem(LS);if(s)return JSON.parse(s);}catch(e){}return clone(SEED);}
function save(d){try{localStorage.setItem(LS,JSON.stringify(d));}catch(e){}}
var st = load();

function pts(w,d){return w*3+d;}
function bc(w,d,l){
  if(w>0&&d===0&&l===0)return "badge badge-win";
  if(d>0&&w===0&&l===0)return "badge badge-draw";
  if(l>0&&w===0&&d===0)return "badge badge-loss";
  return "badge";
}

function render(){
  var seen={};
  GS.forEach(function(g){st[g].forEach(function(t){var k=t.w+"-"+t.d+"-"+t.l;if(!seen[k])seen[k]={w:t.w,d:t.d,l:t.l,p:pts(t.w,t.d)};});});
  var rows=Object.values(seen).sort(function(a,b){return b.p-a.p||b.w-a.w||b.d-a.d;});
  var h="";
  rows.forEach(function(r){
    var cls=bc(r.w,r.d,r.l);
    h+="<tr><td class='pts'>"+r.p+"</td><td class='meta'>"+r.w+"</td><td class='meta'>"+r.d+"</td><td class='meta'>"+r.l+"</td>";
    GS.forEach(function(g){
      var ts=st[g].filter(function(t){return t.w===r.w&&t.d===r.d&&t.l===r.l;});
      h+="<td class='grp-cell'>";
      if(ts.length===0){h+="<span class='empty'>-</span>";}
      else{ts.forEach(function(t){h+="<span class='"+cls+"' title='"+t.n+"'>"+t.f+"</span>";});}
      h+="</td>";
    });
    h+="</tr>";
  });
  document.getElementById("tbody").innerHTML=h;
}

function refSels(){
  var g=document.getElementById("selG").value;
  var ts=st[g];
  var s1=document.getElementById("selT1"),s2=document.getElementById("selT2");
  s1.innerHTML=s2.innerHTML="";
  ts.forEach(function(t,i){
    var lbl=t.f+t.n+" ("+t.w+"-"+t.d+"-"+t.l+")";
    var a=document.createElement("option");a.value=i;a.textContent=lbl;s1.appendChild(a);
    var b=document.createElement("option");b.value=i;b.textContent=lbl;s2.appendChild(b);
  });
  if(ts.length>1)s2.selectedIndex=1;
}

function initG(){
  var s=document.getElementById("selG");s.innerHTML="";
  GS.forEach(function(g){var o=document.createElement("option");o.value=g;o.textContent=g+"組";s.appendChild(o);});
  s.addEventListener("change",refSels);
  refSels();
}

document.getElementById("btnOk").addEventListener("click",function(){
  var g=document.getElementById("selG").value;
  var i1=+document.getElementById("selT1").value;
  var i2=+document.getElementById("selT2").value;
  var r=document.getElementById("selR").value;
  var msg=document.getElementById("msg");
  if(i1===i2){msg.textContent="同じチームが選択されています";return;}
  var t1=st[g][i1],t2=st[g][i2];
  if(t1.w+t1.d+t1.l>=3){msg.textContent=t1.n+"は3試合消化済";return;}
  if(t2.w+t2.d+t2.l>=3){msg.textContent=t2.n+"は3試合消化済";return;}
  if(r==="w1"){t1.w++;t2.l++;}else if(r==="d"){t1.d++;t2.d++;}else{t1.l++;t2.w++;}
  save(st);render();refSels();
  msg.textContent=t1.n+" vs "+t2.n+" 反映済";
  setTimeout(function(){msg.textContent="";},2500);
});

document.getElementById("btnRst").addEventListener("click",function(){
  if(!confirm("リセットしますか？"))return;
  st=clone(SEED);save(st);render();refSels();
  var msg=document.getElementById("msg");
  msg.textContent="シードに戻しました";
  setTimeout(function(){msg.textContent="";},2000);
});

initG();
render();
</script>
</body>
</html>`;
}
