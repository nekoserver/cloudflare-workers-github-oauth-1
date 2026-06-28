type BTeam = { f: string; n: string };
type BMatch = { date: string; a: BTeam; b: BTeam; result?: string };

const BRACKET_DATA: BMatch[] = [
  { date: "6/28", a: { f: "🇿🇦", n: "RSA" }, b: { f: "🇨🇦", n: "CAN" } },
  { date: "6/29", a: { f: "🇧🇷", n: "BRA" }, b: { f: "🇯🇵", n: "JPN" } },
  { date: "6/29", a: { f: "🇩🇪", n: "GER" }, b: { f: "🇵🇾", n: "PAR" } },
  { date: "6/29", a: { f: "🇳🇱", n: "NED" }, b: { f: "🇲🇦", n: "MAR" } },
  { date: "6/30", a: { f: "🇨🇮", n: "CIV" }, b: { f: "🇳🇴", n: "NOR" } },
  { date: "6/30", a: { f: "🇫🇷", n: "FRA" }, b: { f: "🇸🇪", n: "SWE" } },
  { date: "6/30", a: { f: "🇲🇽", n: "MEX" }, b: { f: "🇪🇨", n: "ECU" } },
  { date: "7/1",  a: { f: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", n: "ENG" }, b: { f: "🇨🇩", n: "COD" } },
  { date: "7/1",  a: { f: "🇧🇪", n: "BEL" }, b: { f: "🇸🇳", n: "SEN" } },
  { date: "7/1",  a: { f: "🇺🇸", n: "USA" }, b: { f: "🇧🇦", n: "BIH" } },
  { date: "7/2",  a: { f: "🇪🇸", n: "ESP" }, b: { f: "🇦🇹", n: "AUT" } },
  { date: "7/2",  a: { f: "🇵🇹", n: "POR" }, b: { f: "🇭🇷", n: "CRO" } },
  { date: "7/2",  a: { f: "🇨🇭", n: "SUI" }, b: { f: "🇩🇿", n: "ALG" } },
  { date: "7/3",  a: { f: "🇦🇺", n: "AUS" }, b: { f: "🇪🇬", n: "EGY" } },
  { date: "7/3",  a: { f: "🇦🇷", n: "ARG" }, b: { f: "🇨🇻", n: "CPV" } },
  { date: "7/3",  a: { f: "🇨🇴", n: "COL" }, b: { f: "🇬🇭", n: "GHA" } },
];

function buildMatchCards(): string {
  const dateLabel: Record<string, string> = {
    "6/28": "6月28日(日)", "6/29": "6月29日(月)", "6/30": "6月30日(火)",
    "7/1": "7月1日(水)", "7/2": "7月2日(木)", "7/3": "7月3日(金)",
  };
  const groups: Record<string, BMatch[]> = {};
  for (const m of BRACKET_DATA) {
    if (!groups[m.date]) groups[m.date] = [];
    groups[m.date].push(m);
  }
  let html = "";
  for (const date of Object.keys(groups).sort()) {
    html += `<div class="card-date-group">`;
    html += `<div class="card-date-label">${dateLabel[date] ?? date}</div>`;
    for (const m of groups[date]) {
      const resultHtml = m.result
        ? `<div class="card-result">${m.result}</div>`
        : `<div class="card-vs">vs</div>`;
      html += `<div class="match-card">`;
      html += `<div class="card-team"><span class="card-flag">${m.a.f}</span><span class="card-name">${m.a.n}</span></div>`;
      html += resultHtml;
      html += `<div class="card-team card-team-b"><span class="card-name">${m.b.n}</span><span class="card-flag">${m.b.f}</span></div>`;
      html += `</div>`;
    }
    html += `</div>`;
  }
  return html;
}

export function getWorldCupWdlPage(): string {
  const matchCards = buildMatchCards();
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
  --card-bg: light-dark(#ffffff, #1a1a2e);
  --card-hover: light-dark(#f4f6ff, #1e1e38);
  --accent: light-dark(#3a6fd8, #5b9af0);
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--bg); color: var(--text); font-family: system-ui, -apple-system, sans-serif; min-height: 100vh; display: flex; flex-direction: column; }
.page-header { padding: 10px 14px 8px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
h1 { font-size: 1.1rem; margin-bottom: 2px; }
.subtitle { color: var(--text-muted); font-size: 0.72rem; }
.main-layout { display: flex; flex: 1; min-height: 0; overflow: hidden; }

/* ===== 左サイドパネル（ラウンド32 対戦カード） ===== */
.left-panel {
  width: 220px; flex-shrink: 0; overflow-y: auto;
  border-right: 1px solid var(--border);
  padding: 10px 8px;
  background: var(--surface);
}
.left-panel-title { font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; padding: 0 2px; }
.card-date-group { margin-bottom: 10px; }
.card-date-label {
  font-size: 0.68rem; font-weight: 700; color: var(--accent);
  padding: 2px 6px; margin-bottom: 4px;
  border-left: 2px solid var(--accent);
}
.match-card {
  display: flex; align-items: center; justify-content: space-between;
  background: var(--card-bg); border: 1px solid var(--border);
  border-radius: 6px; padding: 5px 6px; margin-bottom: 4px;
  font-size: 0.72rem; gap: 4px;
  transition: background 0.12s;
}
.match-card:hover { background: var(--card-hover); }
.card-team { display: flex; align-items: center; gap: 3px; flex: 1; min-width: 0; }
.card-team-b { flex-direction: row-reverse; }
.card-flag { font-size: 1rem; line-height: 1; flex-shrink: 0; }
.card-name { font-weight: 700; font-size: 0.7rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-vs { font-size: 0.62rem; font-weight: 700; color: var(--text-muted); padding: 0 3px; flex-shrink: 0; }
.card-result { font-size: 0.72rem; font-weight: 800; color: var(--accent); padding: 0 3px; flex-shrink: 0; white-space: nowrap; }

/* ===== 右メインエリア ===== */
.right-main { flex: 1; overflow-y: auto; padding: 10px 12px; min-width: 0; }
.section-title { font-size: 0.85rem; font-weight: 700; margin-bottom: 8px; }
.table-wrap { overflow-x: auto; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.15); margin-bottom: 6px; }
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

/* ===== モバイル ===== */
@media (max-width: 600px) {
  .main-layout { flex-direction: column; overflow: visible; }
  .left-panel { width: 100%; border-right: none; border-bottom: 1px solid var(--border); overflow-y: visible; padding: 10px 10px 6px; }
  .left-panel .card-date-group { display: flex; flex-wrap: wrap; gap: 4px; align-items: flex-start; margin-bottom: 6px; }
  .left-panel .card-date-label { width: 100%; margin-bottom: 0; }
  .match-card { flex: 1 1 auto; min-width: 140px; max-width: calc(50% - 2px); }
  .right-main { overflow-y: visible; }
}
</style>
</head>
<body>
<div class="page-header">
  <h1>&#x26BD; W杯2026 WDL分布テーブル</h1>
  <p class="subtitle">データ: 2026年6月28日現在（全12組 第3節終了・ラウンド32進行中）</p>
</div>

<div class="main-layout">
  <!-- 左サイドパネル：ラウンド32 対戦カード -->
  <div class="left-panel">
    <div class="left-panel-title">&#x1F3C6; ラウンド32</div>
    ${matchCards}
  </div>

  <!-- 右メイン：WDL分布テーブル -->
  <div class="right-main">
    <div class="section-title">&#x1F4CA; WDL分布テーブル（グループステージ）</div>
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
  "J":[{n:"ARG",f:"🇦🇷",w:3,d:0,l:0},{n:"AUT",f:"🇦🇹",w:1,d:1,l:1},{n:"ALG",f:"🇩🇿",w:1,d:1,l:1},{n:"JOR",f:"🇯🇴",w:0,d:0,l:3}],
  "K":[{n:"COL",f:"🇨🇴",w:2,d:1,l:0},{n:"POR",f:"🇵🇹",w:1,d:2,l:0},{n:"COD",f:"🇨🇩",w:1,d:1,l:1},{n:"UZB",f:"🇺🇿",w:0,d:0,l:3}],
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
