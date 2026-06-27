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
.badge { display: inline-block; margin: 1px; padding: 1px 4px; border-radius: 3px; white-space: nowrap; font-size: 0.78rem; background: var(--badge-bg); border: 1px solid var(--badge-border); }
.badge-win { background: var(--win-bg); border-color: var(--win-border); }
.badge-draw { background: var(--draw-bg); border-color: var(--draw-border); }
.badge-loss { background: var(--loss-bg); border-color: var(--loss-border); }
.empty { color: var(--border); font-size: 0.68rem; }
.ko-section { margin-top: 18px; }
.ko-section h2 { font-size: 1rem; margin-bottom: 8px; }
.ko-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 6px; }
.ko-card { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; }
.ko-card-title { font-size: 0.7rem; font-weight: 700; color: var(--text-muted); margin-bottom: 4px; }
.ko-slot { display: flex; align-items: center; gap: 4px; font-size: 0.82rem; padding: 2px 0; }
.ko-slot-label { font-size: 0.65rem; color: var(--text-muted); min-width: 14px; }
.ko-flag { font-size: 1rem; line-height: 1; }
.ko-name { font-weight: 600; font-size: 0.78rem; }
.ko-pend { color: var(--text-muted); font-size: 0.75rem; font-style: italic; }
.ko-confirmed { border-left: 3px solid light-dark(#27ae60,#2ecc71); }
.ko-partial { border-left: 3px solid light-dark(#f39c12,#e6b800); }
</style>
</head>
<body>
<div class="page-header">
  <h1>&#x26BD; W杯2026 WDL分布テーブル</h1>
  <p class="subtitle">データ: 2026年6月27日現在（A〜I・K・L組は第3節終了後、J組は第2節終了後）</p>
</div>
<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th class="grp">A</th><th class="grp">B</th><th class="grp">C</th>
        <th class="grp">D</th><th class="grp">E</th><th class="grp">F</th>
        <th class="grp">G</th><th class="grp">H</th><th class="grp">I</th>
        <th class="grp">J</th><th class="grp">K</th><th class="grp">L</th>
        <th>W</th><th>D</th><th>L</th><th>勝点</th>
      </tr>
    </thead>
    <tbody id="tbody"></tbody>
  </table>
</div>

<div class="ko-section">
  <h2>&#x1F3C6; ノックアウトステージ 確定進出枠</h2>
  <div class="ko-grid">
    <div class="ko-card ko-confirmed">
      <div class="ko-card-title">A組</div>
      <div class="ko-slot"><span class="ko-slot-label">1.</span><span class="ko-flag">&#x1F1F2;&#x1F1FD;</span><span class="ko-name">MEX</span></div>
      <div class="ko-slot"><span class="ko-slot-label">2.</span><span class="ko-flag">&#x1F1FF;&#x1F1E6;</span><span class="ko-name">RSA</span></div>
    </div>
    <div class="ko-card ko-partial">
      <div class="ko-card-title">B組</div>
      <div class="ko-slot"><span class="ko-slot-label">1.</span><span class="ko-flag">&#x1F1E8;&#x1F1ED;</span><span class="ko-name">SUI</span></div>
      <div class="ko-slot"><span class="ko-slot-label">2.</span><span class="ko-pend">CAN / BIH（PK未定）</span></div>
    </div>
    <div class="ko-card ko-confirmed">
      <div class="ko-card-title">C組</div>
      <div class="ko-slot"><span class="ko-slot-label">1.</span><span class="ko-flag">&#x1F1E7;&#x1F1F7;</span><span class="ko-name">BRA</span></div>
      <div class="ko-slot"><span class="ko-slot-label">2.</span><span class="ko-flag">&#x1F1F2;&#x1F1E6;</span><span class="ko-name">MAR</span></div>
    </div>
    <div class="ko-card ko-partial">
      <div class="ko-card-title">D組</div>
      <div class="ko-slot"><span class="ko-slot-label">1.</span><span class="ko-flag">&#x1F1FA;&#x1F1F8;</span><span class="ko-name">USA</span></div>
      <div class="ko-slot"><span class="ko-slot-label">2.</span><span class="ko-pend">AUS / PAR（PK未定）</span></div>
    </div>
    <div class="ko-card ko-confirmed">
      <div class="ko-card-title">E組</div>
      <div class="ko-slot"><span class="ko-slot-label">1.</span><span class="ko-flag">&#x1F1E9;&#x1F1EA;</span><span class="ko-name">GER</span></div>
      <div class="ko-slot"><span class="ko-slot-label">2.</span><span class="ko-flag">&#x1F1E8;&#x1F1EE;</span><span class="ko-name">CIV</span></div>
    </div>
    <div class="ko-card ko-confirmed">
      <div class="ko-card-title">F組</div>
      <div class="ko-slot"><span class="ko-slot-label">1.</span><span class="ko-flag">&#x1F1F3;&#x1F1F1;</span><span class="ko-name">NED</span></div>
      <div class="ko-slot"><span class="ko-slot-label">2.</span><span class="ko-flag">&#x1F1EF;&#x1F1F5;</span><span class="ko-name">JPN</span></div>
    </div>
    <div class="ko-card ko-confirmed">
      <div class="ko-card-title">G組</div>
      <div class="ko-slot"><span class="ko-slot-label">1.</span><span class="ko-pend">EGY / BEL（順位未定）</span></div>
      <div class="ko-slot"><span class="ko-flag">&#x1F1EA;&#x1F1EC;</span><span class="ko-name">EGY</span><span style="color:var(--text-muted);font-size:0.7rem;margin-left:2px">+</span><span class="ko-flag" style="margin-left:3px">&#x1F1E7;&#x1F1EA;</span><span class="ko-name">BEL</span></div>
    </div>
    <div class="ko-card ko-confirmed">
      <div class="ko-card-title">H組</div>
      <div class="ko-slot"><span class="ko-slot-label">1.</span><span class="ko-flag">&#x1F1EA;&#x1F1F8;</span><span class="ko-name">ESP</span></div>
      <div class="ko-slot"><span class="ko-slot-label">2.</span><span class="ko-flag">&#x1F1E8;&#x1F1FB;</span><span class="ko-name">CPV</span></div>
    </div>
    <div class="ko-card ko-confirmed">
      <div class="ko-card-title">I組</div>
      <div class="ko-slot"><span class="ko-slot-label">1.</span><span class="ko-flag">&#x1F1EB;&#x1F1F7;</span><span class="ko-name">FRA</span></div>
      <div class="ko-slot"><span class="ko-slot-label">2.</span><span class="ko-flag">&#x1F1F3;&#x1F1F4;</span><span class="ko-name">NOR</span></div>
    </div>
    <div class="ko-card ko-partial">
      <div class="ko-card-title">J組</div>
      <div class="ko-slot"><span class="ko-slot-label">1.</span><span class="ko-flag">&#x1F1E6;&#x1F1F7;</span><span class="ko-name">ARG</span></div>
      <div class="ko-slot"><span class="ko-slot-label">2.</span><span class="ko-pend">第3節未了</span></div>
    </div>
    <div class="ko-card ko-confirmed">
      <div class="ko-card-title">K組</div>
      <div class="ko-slot"><span class="ko-slot-label">1.</span><span class="ko-flag">&#x1F1E8;&#x1F1F4;</span><span class="ko-name">COL</span></div>
      <div class="ko-slot"><span class="ko-slot-label">2.</span><span class="ko-flag">&#x1F1F5;&#x1F1F9;</span><span class="ko-name">POR</span></div>
    </div>
    <div class="ko-card ko-confirmed">
      <div class="ko-card-title">L組</div>
      <div class="ko-slot"><span class="ko-slot-label">1.</span><span class="ko-pend">ENG / GHA（順位未定）</span></div>
      <div class="ko-slot"><span class="ko-flag">&#x1F3F4;&#xE0067;&#xE0062;&#xE0065;&#xE006E;&#xE0067;&#xE007F;</span><span class="ko-name">ENG</span><span style="color:var(--text-muted);font-size:0.7rem;margin-left:2px">+</span><span class="ko-flag" style="margin-left:3px">&#x1F1EC;&#x1F1ED;</span><span class="ko-name">GHA</span></div>
    </div>
  </div>
</div>

<script>
var GS = ["A","B","C","D","E","F","G","H","I","J","K","L"];

var data = {
  "A":[{n:"MX",f:"🇲🇽",w:3,d:0,l:0},{n:"RSA",f:"🇿🇦",w:1,d:1,l:1},{n:"KOR",f:"🇰🇷",w:1,d:0,l:2},{n:"CZE",f:"🇨🇿",w:0,d:1,l:2}],
  "B":[{n:"SUI",f:"🇨🇭",w:2,d:1,l:0},{n:"CAN",f:"🇨🇦",w:1,d:1,l:1},{n:"BIH",f:"🇧🇦",w:1,d:1,l:1},{n:"QAT",f:"🇶🇦",w:0,d:1,l:2}],
  "C":[{n:"BRA",f:"🇧🇷",w:2,d:1,l:0},{n:"MAR",f:"🇲🇦",w:2,d:1,l:0},{n:"SCO",f:"🏴󠁧󠁢󠁳󠁣󠁴󠁿",w:1,d:0,l:2},{n:"HAI",f:"🇭🇹",w:0,d:0,l:3}],
  "D":[{n:"USA",f:"🇺🇸",w:2,d:0,l:1},{n:"PAR",f:"🇵🇾",w:1,d:1,l:1},{n:"AUS",f:"🇦🇺",w:1,d:1,l:1},{n:"TUR",f:"🇹🇷",w:1,d:0,l:2}],
  "E":[{n:"GER",f:"🇩🇪",w:2,d:0,l:1},{n:"CIV",f:"🇨🇮",w:2,d:0,l:1},{n:"ECU",f:"🇪🇨",w:1,d:1,l:1},{n:"CUW",f:"🇨🇼",w:0,d:1,l:2}],
  "F":[{n:"NED",f:"🇳🇱",w:2,d:1,l:0},{n:"JPN",f:"🇯🇵",w:1,d:2,l:0},{n:"SWE",f:"🇸🇪",w:1,d:1,l:1},{n:"TUN",f:"🇹🇳",w:0,d:0,l:3}],
  "G":[{n:"EGY",f:"🇪🇬",w:1,d:2,l:0},{n:"BEL",f:"🇧🇪",w:1,d:2,l:0},{n:"IRN",f:"🇮🇷",w:0,d:3,l:0},{n:"NZL",f:"🇳🇿",w:0,d:1,l:2}],
  "H":[{n:"ESP",f:"🇪🇸",w:2,d:1,l:0},{n:"CPV",f:"🇨🇻",w:0,d:3,l:0},{n:"URU",f:"🇺🇾",w:0,d:2,l:1},{n:"KSA",f:"🇸🇦",w:0,d:2,l:1}],
  "I":[{n:"FRA",f:"🇫🇷",w:3,d:0,l:0},{n:"NOR",f:"🇳🇴",w:2,d:0,l:1},{n:"SEN",f:"🇸🇳",w:1,d:0,l:2},{n:"IRQ",f:"🇮🇶",w:0,d:0,l:3}],
  "J":[{n:"ARG",f:"🇦🇷",w:2,d:0,l:0},{n:"AUT",f:"🇦🇹",w:1,d:0,l:1},{n:"ALG",f:"🇩🇿",w:1,d:0,l:1},{n:"JOR",f:"🇯🇴",w:0,d:0,l:2}],
  "K":[{n:"COL",f:"🇨🇴",w:3,d:0,l:0},{n:"POR",f:"🇵🇹",w:1,d:1,l:1},{n:"UZB",f:"🇺🇿",w:1,d:0,l:2},{n:"COD",f:"🇨🇩",w:0,d:1,l:2}],
  "L":[{n:"ENG",f:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",w:2,d:1,l:0},{n:"GHA",f:"🇬🇭",w:2,d:1,l:0},{n:"CRO",f:"🇭🇷",w:1,d:0,l:2},{n:"PAN",f:"🇵🇦",w:0,d:0,l:3}]
};

function pts(w,d){return w*3+d;}
function bc(w,d,l){
  if(w>0&&d===0&&l===0)return "badge badge-win";
  if(d>0&&w===0&&l===0)return "badge badge-draw";
  if(l>0&&w===0&&d===0)return "badge badge-loss";
  return "badge";
}

function render(){
  var seen={};
  GS.forEach(function(g){
    data[g].forEach(function(t){
      var k=t.w+"-"+t.d+"-"+t.l;
      if(!seen[k])seen[k]={w:t.w,d:t.d,l:t.l,p:pts(t.w,t.d)};
    });
  });
  var rows=Object.values(seen).sort(function(a,b){return b.p-a.p||b.w-a.w||b.d-a.d;});
  var h="";
  rows.forEach(function(r){
    var cls=bc(r.w,r.d,r.l);
    h+="<tr>";
    GS.forEach(function(g){
      var ts=data[g].filter(function(t){return t.w===r.w&&t.d===r.d&&t.l===r.l;});
      h+="<td class='grp-cell'>";
      if(ts.length===0){h+="<span class='empty'>-</span>";}
      else{ts.forEach(function(t){h+="<span class='"+cls+"' title='"+t.n+"'>"+t.f+"</span>";});}
      h+="</td>";
    });
    h+="<td class='meta'>"+r.w+"</td><td class='meta'>"+r.d+"</td><td class='meta'>"+r.l+"</td><td class='pts'>"+r.p+"</td>";
    h+="</tr>";
  });
  document.getElementById("tbody").innerHTML=h;
}

render();
</script>
</body>
</html>`;
}
