type KOTeam = { f: string; n: string };
type KOMatch = { date: string; a: KOTeam; b: KOTeam; jst: string; result?: string };

// jst: JST表示文字列。翌=翌日
const KO_BRACKET: KOMatch[] = [
  // 6/28 UTC 19:00 = 翌4:00 JST (6/29)
  { date: "6/28", jst: "翌4:00",  a: { f: "🇿🇦", n: "RSA" }, b: { f: "🇨🇦", n: "CAN" } },
  // 6/28 UTC 22:00 = 7:00 JST (6/29) ← カード表示は6/29なので"翌"不要
  { date: "6/29", jst: "翌7:00",  a: { f: "🇳🇱", n: "NED" }, b: { f: "🇲🇦", n: "MAR" } },
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
<title>W杯2026 ノックアウトステージ</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0d1117;color:#e6edf3;font-family:system-ui,-apple-system,sans-serif;height:100vh;height:100dvh;display:flex;flex-direction:column;overflow:hidden}
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
.bracket{display:flex;gap:6px;min-width:0;width:100%;align-items:flex-start}
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

/* ===== 縦置きタブレット用カレンダー ===== */
.ko-cal{display:none;padding:4px 4px 2px;border-bottom:1px solid #21262d;margin-bottom:6px}
@media(min-width:601px) and (orientation:portrait){.ko-cal{display:block}}
.ko-cal-month{font-size:0.65rem;font-weight:700;color:#58a6ff;text-transform:uppercase;letter-spacing:.05em;padding:2px 2px 1px;margin-top:4px}
.ko-cal-month:first-child{margin-top:0}
.cal-legend{display:flex;flex-wrap:wrap;gap:2px;margin-bottom:3px}
.cal-leg{font-size:7px;font-weight:700;padding:1px 3px;border-radius:3px;color:#e6edf3}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
.cal-cell{font-size:8px;text-align:center;padding:2px 0 1px;border-radius:3px;color:#484f58;line-height:1.3}
.cal-hdr-cell{font-weight:700;color:#30363d;font-size:7px;padding-bottom:2px}
.cal-match{color:#e6edf3;cursor:pointer}
.cal-match:hover{filter:brightness(1.2)}
.cal-today{outline:1.5px solid #58a6ff;outline-offset:-1px}
.cal-selected{outline:2px solid rgba(88,166,255,0.7);outline-offset:-1px}
.cal-rlabel{font-size:6px;font-weight:700;color:rgba(255,255,255,0.75);line-height:1;margin-top:1px}
/* ブラケットカード点滅 */
@keyframes bm-flash{0%,100%{outline:none;background:#161b22}50%{outline:2px solid #f0b429;background:rgba(240,180,41,0.18)}}
.bm-flash{animation:bm-flash 0.4s ease 6}

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
  <span class="pg-title">&#127942; W杯2026 ノックアウトステージ</span>
  <span class="pg-sub">R32〜決勝</span>
</div>
<div class="layout">
  <div class="left">
    <div class="ko-cal" id="ko-cal"></div>
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
  return '<div class="bm" data-date="'+m.date+'"><div class="bm-date">'+ddow(m.date)+'</div>'+teamSlot(m.a,m.slotA)+teamSlot(m.b,m.slotB)+'</div>';
}
var ROUNDS=[
  {label:'R32',flex:'1',matches:[
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
  {label:'R16',flex:'1',matches:[
    {date:'7/5', a:null,b:null,slotA:'M1勝',slotB:'M2勝'},
    {date:'7/5', a:null,b:null,slotA:'M3勝',slotB:'M4勝'},
    {date:'7/6', a:null,b:null,slotA:'M5勝',slotB:'M6勝'},
    {date:'7/6', a:null,b:null,slotA:'M7勝',slotB:'M8勝'},
    {date:'7/7', a:null,b:null,slotA:'M9勝',slotB:'M10勝'},
    {date:'7/7', a:null,b:null,slotA:'M11勝',slotB:'M12勝'},
    {date:'7/8', a:null,b:null,slotA:'M13勝',slotB:'M14勝'},
    {date:'7/8', a:null,b:null,slotA:'M15勝',slotB:'M16勝'}
  ]},
  {label:'QF',flex:'1',matches:[
    {date:'7/11',a:null,b:null,slotA:'L1勝',slotB:'L2勝'},
    {date:'7/11',a:null,b:null,slotA:'L3勝',slotB:'L4勝'},
    {date:'7/12',a:null,b:null,slotA:'L5勝',slotB:'L6勝'},
    {date:'7/12',a:null,b:null,slotA:'L7勝',slotB:'L8勝'}
  ]},
  {label:'SF',flex:'1.0',matches:[
    {date:'7/15',a:null,b:null,slotA:'QF1勝',slotB:'QF2勝'},
    {date:'7/16',a:null,b:null,slotA:'QF3勝',slotB:'QF4勝'}
  ]},
  {label:'決勝',flex:'1',matches:[
    {date:'7/19',a:null,b:null,slotA:'SF1勝',slotB:'SF2勝'}
  ]}
];
var MATCH3RD={date:'7/18',a:null,b:null,slotA:'SF1負',slotB:'SF2負'};
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
  b3.innerHTML='<div class="b3rd-label">3位決定戦 ('+ddow('7/18')+')</div>'+matchCard(MATCH3RD);
}
build();
function flashBracketDate(dateStr){
  var parts=dateStr.split('-');
  var mo=parseInt(parts[1],10);
  var dy=parseInt(parts[2],10);
  var key=mo+'/'+dy;
  var cards=document.querySelectorAll('.bm[data-date="'+key+'"]');
  cards.forEach(function(c){
    c.classList.remove('bm-flash');
    void c.offsetWidth;
    c.classList.add('bm-flash');
    setTimeout(function(){c.classList.remove('bm-flash');},2600);
  });
  if(cards.length>0){cards[0].scrollIntoView({behavior:'smooth',block:'nearest'});}
}
function buildKoCal(){
  var el=document.getElementById('ko-cal');
  if(!el)return;
  var todayStr=new Date().toISOString().slice(0,10);
  var GS_BG='rgba(88,166,255,0.18)';
  var R32_JUN='rgba(240,180,40,0.30)';
  var R32='rgba(88,166,255,0.18)';
  var R16='rgba(88,166,255,0.32)';
  var QF='rgba(88,166,255,0.50)';
  var SF='rgba(88,166,255,0.66)';
  var C3='rgba(88,166,255,0.50)';
  var FIN='rgba(88,166,255,0.90)';
  var JUN_GS={11:1,12:1,13:1,14:1,15:1,16:1,17:1,18:1,19:1,20:1,21:1,22:1,23:1,24:1,25:1,26:1,27:1};
  var JUN_R32={28:1,29:1,30:1};
  var JUL_BG={1:R32,2:R32,3:R32,5:R16,6:R16,7:R16,8:R16,11:QF,12:QF,15:SF,16:SF,18:C3,19:FIN};
  var JUL_LBL={1:'R32',5:'R16',11:'QF',15:'SF',18:'3位',19:'決勝'};
  var wdays=['日','月','火','水','木','金','土'];
  var html='';
  html+='<div class="ko-cal-month">6️⃣ 6月</div>';
  html+='<div class="cal-legend">';
  html+='<span class="cal-leg" style="background:'+GS_BG+'">GS</span>';
  html+='<span class="cal-leg" style="background:'+R32_JUN+';color:#0d1117">R32</span>';
  html+='</div>';
  html+='<div class="cal-grid">';
  for(var wi=0;wi<7;wi++){html+='<div class="cal-cell cal-hdr-cell">'+wdays[wi]+'</div>';}
  var jf=new Date(2026,5,1).getDay();
  for(var ei=0;ei<jf;ei++){html+='<div class="cal-cell"></div>';}
  var tjd=todayStr.startsWith('2026-06-')?parseInt(todayStr.slice(8),10):0;
  for(var di=1;di<=30;di++){
    var isR=!!JUN_R32[di];var isG=!!JUN_GS[di];var isM=isR||isG;var isTd=di===tjd;
    var bg=isR?R32_JUN:(isG?GS_BG:'');
    var cls='cal-cell'+(isM?' cal-match':'')+(isTd?' cal-today':'');
    var sty=bg?'background:'+bg:'';
    var lbl=isR?'<div class="cal-rlabel">R32</div>':'';
    var dat=isM?' data-date="2026-06-'+(di<10?'0'+di:''+di)+'"':'';
    html+='<div class="'+cls+'"'+dat+' style="'+sty+'">'+di+lbl+'</div>';
  }
  html+='</div>';
  html+='<div class="ko-cal-month">7️⃣ 7月</div>';
  html+='<div class="cal-legend">';
  html+='<span class="cal-leg" style="background:'+R32+'">R32</span>';
  html+='<span class="cal-leg" style="background:'+R16+'">R16</span>';
  html+='<span class="cal-leg" style="background:'+QF+'">QF</span>';
  html+='<span class="cal-leg" style="background:'+SF+'">SF</span>';
  html+='<span class="cal-leg" style="background:'+FIN+';color:#0d1117">決勝</span>';
  html+='</div>';
  html+='<div class="cal-grid">';
  for(var wi=0;wi<7;wi++){html+='<div class="cal-cell cal-hdr-cell">'+wdays[wi]+'</div>';}
  var jlf=new Date(2026,6,1).getDay();
  for(var ei=0;ei<jlf;ei++){html+='<div class="cal-cell"></div>';}
  var tljd=todayStr.startsWith('2026-07-')?parseInt(todayStr.slice(8),10):0;
  for(var di=1;di<=31;di++){
    var bg=JUL_BG[di]||'';var isM=!!bg;var isTd=di===tljd;
    var cls='cal-cell'+(isM?' cal-match':'')+(isTd?' cal-today':'');
    var sty=bg?'background:'+bg:'';
    var lbl=JUL_LBL[di]?'<div class="cal-rlabel">'+JUL_LBL[di]+'</div>':'';
    var dat=isM?' data-date="2026-07-'+(di<10?'0'+di:''+di)+'"':'';
    html+='<div class="'+cls+'"'+dat+' style="'+sty+'">'+di+lbl+'</div>';
  }
  html+='</div>';
  el.innerHTML=html;
  el.addEventListener('click',function(e){
    var cell=e.target.closest('.cal-match');
    if(!cell||!cell.dataset.date)return;
    el.querySelectorAll('.cal-selected').forEach(function(x){x.classList.remove('cal-selected');});
    cell.classList.add('cal-selected');
    flashBracketDate(cell.dataset.date);
  });
}
buildKoCal();
(function(){function fix(){document.body.style.height=window.innerHeight+'px';}fix();window.addEventListener('resize',fix);})();
</script>
</body>
</html>`;
}
