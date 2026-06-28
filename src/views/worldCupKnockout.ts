type KOTeam = { f: string; n: string };
type KOMatch = { date: string; a: KOTeam; b: KOTeam; jst: string; result?: string };

// jst: JST表示文字列。翌=翌日
const KO_BRACKET: KOMatch[] = [
  // 6/28 UTC 19:00 = 翌4:00 JST (6/29)
  { date: "6/28", jst: "翌4:00",  a: { f: "🇿🇦", n: "RSA" }, b: { f: "🇨🇦", n: "CAN" } },
  // 6/28 UTC 22:00 = 7:00 JST (6/29) ← カード表示は6/29なので"翌"不要
  { date: "6/29", jst: "7:00",    a: { f: "🇳🇱", n: "NED" }, b: { f: "🇲🇦", n: "MAR" } },
  // 6/29 UTC 19:00 = 翌4:00 JST (6/30)
  { date: "6/29", jst: "翌4:00",  a: { f: "🇧🇷", n: "BRA" }, b: { f: "🇯🇵", n: "JPN" } },
  // 6/29 UTC 22:00 = 翌7:00 JST (6/30)
  { date: "6/29", jst: "翌7:00",  a: { f: "🇩🇪", n: "GER" }, b: { f: "🇵🇾", n: "PAR" } },
  // 6/30 UTC 19:00 = 翌4:00 JST (7/1)
  { date: "6/30", jst: "翌4:00",  a: { f: "🇨🇮", n: "CIV" }, b: { f: "🇳🇴", n: "NOR" } },
  // 6/30 UTC 22:00 = 翌7:00 JST (7/1)
  { date: "6/30", jst: "翌7:00",  a: { f: "🇫🇷", n: "FRA" }, b: { f: "🇸🇪", n: "SWE" } },
  // 7/1 UTC 02:00 = 翌11:00 JST (7/1) ← 現地6/30深夜
  { date: "6/30", jst: "翌11:00", a: { f: "🇲🇽", n: "MEX" }, b: { f: "🇪🇨", n: "ECU" } },
  // 7/1 UTC 19:00 = 翌4:00 JST (7/2)
  { date: "7/1",  jst: "翌4:00",  a: { f: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", n: "ENG" }, b: { f: "🇨🇩", n: "COD" } },
  // 7/1 UTC 22:00 = 翌7:00 JST (7/2)
  { date: "7/1",  jst: "翌7:00",  a: { f: "🇧🇪", n: "BEL" }, b: { f: "🇸🇳", n: "SEN" } },
  // 7/2 UTC 02:00 = 翌11:00 JST (7/2) ← 現地7/1深夜
  { date: "7/1",  jst: "翌11:00", a: { f: "🇺🇸", n: "USA" }, b: { f: "🇧🇦", n: "BIH" } },
  // 7/2 UTC 19:00 = 翌4:00 JST (7/3)
  { date: "7/2",  jst: "翌4:00",  a: { f: "🇪🇸", n: "ESP" }, b: { f: "🇦🇹", n: "AUT" } },
  // 7/2 UTC 22:00 = 翌7:00 JST (7/3)
  { date: "7/2",  jst: "翌7:00",  a: { f: "🇵🇹", n: "POR" }, b: { f: "🇭🇷", n: "CRO" } },
  // 7/3 UTC 02:00 = 翌11:00 JST (7/3) ← 現地7/2深夜
  { date: "7/2",  jst: "翌11:00", a: { f: "🇨🇭", n: "SUI" }, b: { f: "🇩🇿", n: "ALG" } },
  // 7/3 UTC 19:00 = 翌4:00 JST (7/4)
  { date: "7/3",  jst: "翌4:00",  a: { f: "🇦🇺", n: "AUS" }, b: { f: "🇪🇬", n: "EGY" } },
  // 7/3 UTC 22:00 = 翌7:00 JST (7/4)
  { date: "7/3",  jst: "翌7:00",  a: { f: "🇦🇷", n: "ARG" }, b: { f: "🇨🇻", n: "CPV" } },
  // 7/4 UTC 02:00 = 翌11:00 JST (7/4) ← 現地7/3深夜
  { date: "7/3",  jst: "翌11:00", a: { f: "🇨🇴", n: "COL" }, b: { f: "🇬🇭", n: "GHA" } },
];

function buildKOCards(): string {
  const dateLabel: Record<string, string> = {
    "6/28": "6/28(日)", "6/29": "6/29(月)", "6/30": "6/30(火)",
    "7/1": "7/1(水)", "7/2": "7/2(木)", "7/3": "7/3(金)",
  };
  const groups: Record<string, KOMatch[]> = {};
  const order: string[] = [];
  for (const m of KO_BRACKET) {
    if (!groups[m.date]) { groups[m.date] = []; order.push(m.date); }
    groups[m.date].push(m);
  }
  const seen = new Set<string>();
  const dates = order.filter(d => { if (seen.has(d)) return false; seen.add(d); return true; });

  let html = "";
  for (const date of dates) {
    html += `<div class="card-group">`;
    html += `<div class="card-date"><span>${dateLabel[date] ?? date}</span><span>JST</span></div>`;
    for (const m of groups[date]) {
      const mid = m.result
        ? `<div class="card-result">${m.result}</div>`
        : `<div class="card-vs">vs</div>`;
      html += `<div class="match-card">`;
      html += `<div class="card-team"><span class="cf">${m.a.f}</span><span class="cn">${m.a.n}</span></div>`;
      html += mid;
      html += `<div class="card-team card-team-r"><span class="cn">${m.b.n}</span><span class="cf">${m.b.f}</span></div>`;
      html += `<span class="card-time">${m.jst}</span>`;
      html += `</div>`;
    }
    html += `</div>`;
  }
  return html;
}

export function getWorldCupKnockoutPage(): string {
  const cards = buildKOCards();
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>W杯2026 ノックアウト</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0d1117;color:#e6edf3;font-family:system-ui,-apple-system,sans-serif;height:100vh;display:flex;flex-direction:column;overflow:hidden}
.pg-hdr{padding:6px 12px;border-bottom:1px solid #21262d;flex-shrink:0;display:flex;align-items:center;gap:8px}
.pg-title{font-size:0.9rem;font-weight:700;color:#f0b429}
.pg-sub{font-size:0.68rem;color:#8b949e}
.layout{display:flex;flex:1;min-height:0;overflow:hidden}

/* ===== 左パネル（R32対戦カード） ===== */
.left{width:210px;flex-shrink:0;border-right:1px solid #21262d;overflow-y:auto;padding:6px}
.left-title{font-size:0.65rem;font-weight:700;color:#58a6ff;text-transform:uppercase;letter-spacing:.05em;padding:2px 4px;margin-bottom:4px}
.card-group{margin-bottom:8px}
.card-date{display:flex;justify-content:space-between;align-items:center;font-size:0.62rem;font-weight:700;color:#58a6ff;border-left:2px solid #58a6ff;padding:1px 5px;margin-bottom:3px}
.match-card{display:flex;align-items:center;background:#161b22;border:1px solid #30363d;border-radius:5px;padding:3px 5px;margin-bottom:3px;gap:2px;font-size:0.66rem}
.match-card:hover{background:#1c2128}
.card-team{display:flex;align-items:center;gap:2px;flex:1;min-width:0}
.card-team-r{flex-direction:row-reverse}
.cf{font-size:0.9rem;line-height:1;flex-shrink:0}
.cn{font-weight:700;font-size:0.64rem;white-space:nowrap}
.card-vs{font-size:0.58rem;color:#8b949e;flex-shrink:0;padding:0}
.card-result{font-size:0.66rem;font-weight:800;color:#f0b429;flex-shrink:0;padding:0}
.card-time{font-size:0.58rem;color:#8b949e;font-family:monospace;white-space:nowrap;flex-shrink:0;margin-left:2px}

/* ===== 右メイン（トーナメントブラケット） ===== */
.right{flex:1;overflow:auto;padding:8px 10px}
.bracket{display:flex;gap:6px;min-width:640px;align-items:flex-start}
.bc{display:flex;flex-direction:column;flex:1;min-width:0}
.bc-hdr{font-size:8px;font-weight:700;color:#58a6ff;text-transform:uppercase;letter-spacing:.5px;text-align:center;padding:3px;border-bottom:1px solid #21262d;margin-bottom:4px;white-space:nowrap}
.bc-final .bc-hdr{color:#f0b429}
.bm{background:#161b22;border:1px solid #30363d;border-radius:4px;padding:2px 5px;margin-bottom:3px}
.bm-date{font-size:8px;color:#8b949e;font-family:monospace;text-align:right;margin-bottom:1px}
.bt{display:flex;align-items:center;gap:3px;height:12px;overflow:hidden}
.bt+.bt{border-top:1px solid #21262d;margin-top:1px}
.bt-flag{font-size:10px;line-height:1}
.bt-code{font-size:8px;font-weight:700;color:#8b949e;font-family:monospace}
.bt-tbd{font-size:8px;color:#484f58;font-style:italic;white-space:nowrap}
.b3rd{margin-top:12px;border-top:1px solid #21262d;padding-top:10px}
.b3rd-label{font-size:10px;font-weight:700;color:#8b949e;text-align:center;margin-bottom:6px}

@media(max-width:600px){
  body{overflow:auto}
  .layout{flex-direction:column;overflow:visible}
  .left{width:100%;border-right:none;border-bottom:1px solid #21262d;overflow-y:visible}
  .right{overflow:visible}
}
</style>
</head>
<body>
<div class="pg-hdr">
  <span class="pg-title">&#127942; W杯2026 ノックアウト</span>
  <span class="pg-sub">R32〜決勝</span>
</div>
<div class="layout">
  <div class="left">
    <div class="left-title">&#127939; R32 対戦カード</div>
    ${cards}
  </div>
  <div class="right">
    <div class="bracket" id="bracket"></div>
    <div class="b3rd" id="b3rd"></div>
  </div>
</div>
<script>
var FLAG_CODE = {
  '🇲🇽':'MEX','🇿🇦':'RSA','🇨🇦':'CAN','🇧🇦':'BIH','🇺🇸':'USA','🇵🇾':'PAR',
  '🇨🇭':'SUI','🇧🇷':'BRA','🇲🇦':'MAR','🇦🇺':'AUS','🇩🇪':'GER','🇳🇱':'NED',
  '🇯🇵':'JPN','🇨🇮':'CIV','🇪🇨':'ECU','🇸🇪':'SWE','🇪🇸':'ESP','🇨🇻':'CPV',
  '🇧🇪':'BEL','🇪🇬':'EGY','🇫🇷':'FRA','🇸🇳':'SEN','🇳🇴':'NOR','🇦🇷':'ARG',
  '🇩🇿':'ALG','🇦🇹':'AUT','🇵🇹':'POR','🇨🇩':'COD','🇭🇷':'CRO','🇬🇭':'GHA',
  '🏴󠁧󠁢󠁥󠁮󠁧󠁿':'ENG','🇨🇴':'COL'
};
var DOW=['日','月','火','水','木','金','土'];
function ddow(ds){var p=ds.split('/');if(p.length!==2)return ds;var d=new Date(2026,parseInt(p[0],10)-1,parseInt(p[1],10));return ds+'('+DOW[d.getDay()]+')';}
function fc(f){return FLAG_CODE[f]||'';}
function teamSlot(flag,slot){
  if(flag){return '<div class="bt"><span class="bt-flag">'+flag+'</span><span class="bt-code">'+fc(flag)+'</span></div>';}
  return '<div class="bt"><span class="bt-tbd">'+slot+'</span></div>';
}
function matchCard(m){
  return '<div class="bm"><div class="bm-date">'+ddow(m.date)+'</div>'+teamSlot(m.a,m.slotA)+teamSlot(m.b,m.slotB)+'</div>';
}
var ROUNDS=[
  {label:'R32',flex:'2.4',matches:[
    {date:'6/28',a:'🇿🇦',b:'🇨🇦',slotA:'RSA',slotB:'CAN'},
    {date:'6/29',a:'🇳🇱',b:'🇲🇦',slotA:'NED',slotB:'MAR'},
    {date:'6/29',a:'🇧🇷',b:'🇯🇵',slotA:'BRA',slotB:'JPN'},
    {date:'6/29',a:'🇩🇪',b:'🇵🇾',slotA:'GER',slotB:'PAR'},
    {date:'6/30',a:'🇨🇮',b:'🇳🇴',slotA:'CIV',slotB:'NOR'},
    {date:'6/30',a:'🇫🇷',b:'🇸🇪',slotA:'FRA',slotB:'SWE'},
    {date:'6/30',a:'🇲🇽',b:'🇪🇨',slotA:'MEX',slotB:'ECU'},
    {date:'7/1', a:'🏴󠁧󠁢󠁥󠁮󠁧󠁿',b:'🇨🇩',slotA:'ENG',slotB:'COD'},
    {date:'7/1', a:'🇧🇪',b:'🇸🇳',slotA:'BEL',slotB:'SEN'},
    {date:'7/1', a:'🇺🇸',b:'🇧🇦',slotA:'USA',slotB:'BIH'},
    {date:'7/2', a:'🇪🇸',b:'🇦🇹',slotA:'ESP',slotB:'AUT'},
    {date:'7/2', a:'🇵🇹',b:'🇭🇷',slotA:'POR',slotB:'CRO'},
    {date:'7/2', a:'🇨🇭',b:'🇩🇿',slotA:'SUI',slotB:'ALG'},
    {date:'7/3', a:'🇦🇺',b:'🇪🇬',slotA:'AUS',slotB:'EGY'},
    {date:'7/3', a:'🇦🇷',b:'🇨🇻',slotA:'ARG',slotB:'CPV'},
    {date:'7/3', a:'🇨🇴',b:'🇬🇭',slotA:'COL',slotB:'GHA'}
  ]},
  {label:'R16',flex:'1.8',matches:[
    {date:'7/5', a:null,b:null,slotA:'M1勝',slotB:'M2勝'},
    {date:'7/5', a:null,b:null,slotA:'M3勝',slotB:'M4勝'},
    {date:'7/6', a:null,b:null,slotA:'M5勝',slotB:'M6勝'},
    {date:'7/6', a:null,b:null,slotA:'M7勝',slotB:'M8勝'},
    {date:'7/7', a:null,b:null,slotA:'M9勝',slotB:'M10勝'},
    {date:'7/7', a:null,b:null,slotA:'M11勝',slotB:'M12勝'},
    {date:'7/8', a:null,b:null,slotA:'M13勝',slotB:'M14勝'},
    {date:'7/8', a:null,b:null,slotA:'M15勝',slotB:'M16勝'}
  ]},
  {label:'QF',flex:'1.3',matches:[
    {date:'7/11',a:null,b:null,slotA:'L1勝',slotB:'L2勝'},
    {date:'7/11',a:null,b:null,slotA:'L3勝',slotB:'L4勝'},
    {date:'7/12',a:null,b:null,slotA:'L5勝',slotB:'L6勝'},
    {date:'7/12',a:null,b:null,slotA:'L7勝',slotB:'L8勝'}
  ]},
  {label:'SF',flex:'1.0',matches:[
    {date:'7/15',a:null,b:null,slotA:'QF1勝',slotB:'QF2勝'},
    {date:'7/16',a:null,b:null,slotA:'QF3勝',slotB:'QF4勝'}
  ]},
  {label:'決勝',flex:'0.9',matches:[
    {date:'7/19',a:null,b:null,slotA:'SF1勝',slotB:'SF2勝'}
  ]}
];
var MATCH3RD={date:'7/23',a:null,b:null,slotA:'SF1負',slotB:'SF2負'};
function build(){
  var br=document.getElementById('bracket');
  var html='';
  ROUNDS.forEach(function(rnd){
    var isFinal=rnd.label==='決勝';
    html+='<div class="bc'+(isFinal?' bc-final':'')+'" style="flex:'+rnd.flex+'">';
    html+='<div class="bc-hdr">'+rnd.label+'</div>';
    rnd.matches.forEach(function(m){html+=matchCard(m);});
    html+='</div>';
  });
  br.innerHTML=html;
  var b3=document.getElementById('b3rd');
  b3.innerHTML='<div class="b3rd-label">3位決定戦 ('+ddow('7/23')+')</div>'+matchCard(MATCH3RD);
}
build();
</script>
</body>
</html>`;
}
