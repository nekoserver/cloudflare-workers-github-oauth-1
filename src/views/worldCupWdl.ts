type BTeam = { f: string; n: string };
type BMatch = { date: string; a: BTeam; b: BTeam | null; bl?: string };

const BRACKET_DATA: BMatch[] = [
  { date: "6/28", a: { f: "🇿🇦", n: "RSA" }, b: { f: "🇨🇦", n: "CAN" } },
  { date: "6/28", a: { f: "🇳🇱", n: "NED" }, b: { f: "🇲🇦", n: "MAR" } },
  { date: "6/29", a: { f: "🇧🇷", n: "BRA" }, b: { f: "🇯🇵", n: "JPN" } },
  { date: "6/29", a: { f: "🇩🇪", n: "GER" }, b: { f: "🇵🇾", n: "PAR" } },
  { date: "6/30", a: { f: "🇨🇮", n: "CIV" }, b: { f: "🇳🇴", n: "NOR" } },
  { date: "6/30", a: { f: "🇫🇷", n: "FRA" }, b: { f: "🇸🇪", n: "SWE" } },
  { date: "6/30", a: { f: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", n: "ENG" }, b: null, bl: "3位枠未定" },
  { date: "7/1",  a: { f: "🇲🇽", n: "MEX" }, b: null, bl: "3位枠未定" },
  { date: "7/1",  a: { f: "🇪🇬", n: "EGY" }, b: { f: "🇰🇷", n: "KOR" } },
  { date: "7/1",  a: { f: "🇺🇸", n: "USA" }, b: { f: "🇧🇦", n: "BIH" } },
  { date: "7/2",  a: { f: "🇪🇸", n: "ESP" }, b: null, bl: "J組2位" },
  { date: "7/2",  a: { f: "🇨🇭", n: "SUI" }, b: null, bl: "3位枠未定" },
  { date: "7/2",  a: { f: "🇵🇹", n: "POR" }, b: { f: "🇬🇭", n: "GHA" } },
  { date: "7/3",  a: { f: "🇦🇺", n: "AUS" }, b: { f: "🇧🇪", n: "BEL" } },
  { date: "7/3",  a: { f: "🇦🇷", n: "ARG" }, b: { f: "🇨🇻", n: "CPV" } },
  { date: "7/3",  a: { f: "🇨🇴", n: "COL" }, b: { f: "🇭🇷", n: "CRO" } },
];

function bTeamCell(t: BTeam | null, label?: string): string {
  if (t) return `<div class="br-team-inner"><span class="br-flag">${t.f}</span><span class="br-name">${t.n}</span></div>`;
  return `<div class="br-tbd">${label ?? "未定"}</div>`;
}

function buildBracketRows(): string {
  const counts: Record<string, number> = {};
  for (const m of BRACKET_DATA) counts[m.date] = (counts[m.date] ?? 0) + 1;
  const shown: Record<string, boolean> = {};
  let rows = "";
  for (const m of BRACKET_DATA) {
    rows += "<tr>";
    if (!shown[m.date]) {
      rows += `<td class="br-date-cell" rowspan="${counts[m.date]}">${m.date}</td>`;
      shown[m.date] = true;
    }
    rows += `<td class="br-team-cell">${bTeamCell(m.a)}</td>`;
    rows += `<td class="br-vs-cell">vs</td>`;
    rows += `<td class="br-team-cell">${bTeamCell(m.b, m.bl)}</td>`;
    rows += "</tr>";
  }
  return rows;
}

export function getWorldCupWdlPage(): string {
  const bracketRows = buildBracketRows();
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
.br-wrap { overflow-x: auto; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.15); }
.br-table { border-collapse: collapse; font-size: 0.8rem; background: var(--surface); width: 100%; }
.br-table th { padding: 5px 8px; text-align: center; border: 1px solid var(--border); background: var(--header-bg); color: var(--header-text); font-weight: 600; white-space: nowrap; }
.br-table td { border: 1px solid var(--border); padding: 4px 6px; vertical-align: middle; }
.br-date-cell { background: var(--grp-header-bg); color: var(--header-text); text-align: center; font-weight: 700; font-size: 0.75rem; white-space: nowrap; min-width: 38px; }
.br-team-cell { white-space: nowrap; }
.br-team-inner { display: flex; align-items: center; gap: 5px; padding: 3px 4px; border-radius: 4px; background: var(--meta-bg); border: 1px solid var(--border); min-width: 80px; }
.br-flag { font-size: 1.1rem; line-height: 1; }
.br-name { font-weight: 700; font-size: 0.8rem; }
.br-tbd { display: flex; align-items: center; justify-content: center; padding: 3px 8px; border-radius: 4px; border: 1px dashed var(--border); color: var(--text-muted); font-size: 0.75rem; min-width: 80px; min-height: 28px; }
.br-vs-cell { text-align: center; color: var(--text-muted); font-size: 0.7rem; font-weight: 600; padding: 4px 6px; white-space: nowrap; }
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
  <h2>&#x1F3C6; ラウンド32 対戦表</h2>
  <div class="br-wrap">
    <table class="br-table">
      <thead><tr><th>日付</th><th colspan="3">対戦</th></tr></thead>
      <tbody>${bracketRows}</tbody>
    </table>
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
