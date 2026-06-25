export function getHeritageAccessPage(userId: string): string {
  void userId;
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>世界遺産アクセスランキング</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0d1117;color:#c9d1d9;min-height:100vh}
header{background:#161b22;border-bottom:1px solid #30363d;padding:12px 20px;display:flex;align-items:center;gap:12px}
header h1{font-size:16px;font-weight:700;color:#e6edf3}
header a{color:#58a6ff;font-size:12px;text-decoration:none;margin-left:auto}
.controls{padding:14px 20px;background:#161b22;border-bottom:1px solid #21262d;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.ctrl-label{font-size:12px;color:#8b949e}
select,input[type=number]{background:#0d1117;border:1px solid #30363d;border-radius:6px;color:#c9d1d9;font-size:12px;padding:5px 8px;outline:none}
select:focus,input:focus{border-color:#58a6ff}
button{background:#1f6feb;border:none;border-radius:6px;color:#fff;font-size:12px;padding:6px 14px;cursor:pointer;font-family:inherit}
button:hover{background:#388bfd}
button:disabled{background:#21262d;color:#484f58;cursor:default}
.summary{padding:10px 20px;font-size:12px;color:#8b949e}
.summary strong{color:#c9d1d9}
table{width:100%;border-collapse:collapse;font-size:12px}
thead th{background:#161b22;color:#8b949e;font-weight:600;padding:8px 10px;border-bottom:1px solid #30363d;white-space:nowrap;position:sticky;top:0;z-index:2}
thead th.num{text-align:right}
tbody tr{border-bottom:1px solid #21262d;transition:background .1s}
tbody tr:not(.accordion-row):not(.group-head-tr){cursor:pointer}
tbody tr:not(.accordion-row):not(.group-head-tr):hover{background:#161b22}
tbody tr.row-open{background:#1a2030}
td{padding:7px 10px;vertical-align:middle}
td.rank{color:#484f58;font-size:11px;text-align:right;width:36px}
td.flag{font-size:16px;text-align:center;width:28px}
td.city{font-weight:600;color:#e6edf3}
td.country{color:#8b949e;font-size:11px}
td.bar-cell{width:160px}
td.count{text-align:right;font-weight:700;color:#3fb950;min-width:44px}
td.nearest{text-align:right;color:#8b949e;font-size:11px;min-width:56px}
td.pop{text-align:right;color:#8b949e;font-size:11px;min-width:64px}
.bar{height:8px;background:#1f6feb;border-radius:3px;min-width:2px}
.tbl-wrap{overflow-x:auto;overflow-y:auto;max-height:calc(100vh - 160px)}
.dist-badge{display:inline-block;background:#1f3a5c;color:#58a6ff;border-radius:4px;padding:1px 6px;font-size:11px;font-weight:700}
.group-head{background:#161b22;color:#8b949e;font-size:11px;padding:6px 10px;border-bottom:1px solid #21262d;font-weight:600}
.spinner{text-align:center;padding:40px;color:#484f58}
.top1 td.city{color:#f0c040}
.top2 td.city{color:#b0c4de}
.top3 td.city{color:#cd7f32}
.mode-tabs{display:flex;gap:0;margin-left:8px}
.mode-tab{background:#0d1117;border:1px solid #30363d;color:#8b949e;font-size:11px;padding:5px 10px;cursor:pointer;font-family:inherit}
.mode-tab:first-child{border-radius:6px 0 0 6px}
.mode-tab:last-child{border-radius:0 6px 6px 0;border-left:none}
.mode-tab.active{background:#1f6feb;border-color:#1f6feb;color:#fff}
#sel-country{max-width:160px}
.accordion-row td{padding:0;border-bottom:1px solid #30363d}
.accordion-inner{padding:10px 16px 14px 48px;background:#0d1117}
.acc-heritage-list{display:flex;flex-direction:column;gap:4px;max-height:320px;overflow-y:auto}
.acc-row{display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #21262d;font-size:12px}
.acc-row:last-child{border-bottom:none}
.acc-country-flag{font-size:14px;flex-shrink:0;width:20px;text-align:center}
.acc-emoji{font-size:14px;flex-shrink:0;width:20px;text-align:center}
.acc-name{flex:1;color:#c9d1d9}
.acc-name-wrap{display:flex;align-items:center;gap:4px;flex:1;min-width:0}
.acc-topic-badge{display:inline-block;font-size:10px;padding:1px 5px;border-radius:10px;background:rgba(46,160,67,.18);color:#3fb950;border:1px solid rgba(63,185,80,.3);white-space:nowrap;flex-shrink:0;cursor:pointer}
.acc-topic-badge:hover{background:rgba(46,160,67,.35)}
.acc-dist{color:#58a6ff;font-size:11px;font-weight:600;white-space:nowrap;min-width:56px;text-align:right;margin-left:auto}
.acc-loading{color:#484f58;font-size:12px;padding:8px 0}
.acc-toggle{font-size:10px;color:#484f58;margin-left:4px;flex-shrink:0}
.acc-ai-panel{margin-top:6px;padding:8px 0 4px;border-top:1px solid #21262d}
.acc-ai-label{font-size:11px;color:#8b949e;margin-bottom:6px}
.acc-ai-btns{display:flex;flex-wrap:wrap;gap:6px}
.acc-ai-btn{background:#0d1117;border:1px solid #30363d;border-radius:6px;color:#c9d1d9;font-size:11px;padding:4px 10px;cursor:pointer;font-family:inherit;transition:border-color .15s,color .15s,background .15s}
.acc-ai-btn:hover{border-color:#58a6ff;color:#58a6ff}
.acc-ai-btn:disabled{color:#484f58;cursor:default;border-color:#21262d}
.acc-ai-btn.answered{background:#0e2a1a;border-color:#2ea043;color:#3fb950}
.ai-modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.78);align-items:center;justify-content:center}
.ai-modal-overlay.open{display:flex}
.ai-modal{background:#0d1117;border:1px solid #30363d;border-radius:10px;width:min(92vw,560px);max-height:80vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.9)}
.ai-modal-head{padding:12px 16px;border-bottom:1px solid #21262d;display:flex;align-items:center;gap:8px;flex-shrink:0}
.ai-modal-title{font-size:13px;font-weight:700;flex:1;color:#e6edf3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ai-modal-close{background:none;border:none;color:#8b949e;font-size:18px;cursor:pointer;padding:2px 6px;line-height:1}
.ai-modal-body{overflow-y:auto;padding:16px;font-size:13px;line-height:1.7;color:#c9d1d9;white-space:pre-wrap;word-break:break-word}
.acc-name-link{flex:1;color:#58a6ff;text-decoration:none;cursor:pointer;background:none;border:none;font:inherit;padding:0;text-align:left}
.acc-name-link:hover{color:#79c0ff}
.hcl-modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.78);align-items:center;justify-content:center}
.hcl-modal-overlay.open{display:flex}
.hcl-modal{background:#0d1117;border:1px solid #30363d;border-radius:10px;width:min(92vw,640px);max-height:82vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.9)}
.hcl-modal-head{padding:12px 16px;border-bottom:1px solid #21262d;display:flex;align-items:center;gap:8px;flex-shrink:0}
.hcl-modal-title{font-size:13px;font-weight:700;flex:1;color:#e6edf3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hcl-modal-close{background:none;border:none;color:#8b949e;font-size:18px;cursor:pointer;padding:2px 6px;line-height:1}
.hcl-modal-body{overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:10px}
.hcl-entry{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:12px 14px;display:flex;flex-direction:column;gap:6px}
.hcl-entry-q{font-size:12px;color:#8b949e;line-height:1.5}
.hcl-entry-a{font-size:12px;color:#c9d1d9;line-height:1.6;white-space:pre-wrap;word-break:break-word;max-height:160px;overflow-y:auto}
.hcl-entry-meta{font-size:11px;color:#484f58;display:flex;gap:8px}
.hcl-empty{color:#484f58;font-size:12px;padding:16px 0;text-align:center}
</style>
</head>
<body>
<header>
  <span style="font-size:20px">🗺️</span>
  <h1>世界遺産アクセスランキング</h1>
  <a href="/webgl-heritage">← 世界遺産地球儀</a>
</header>
<div class="controls">
  <span class="ctrl-label">距離上限</span>
  <select id="sel-dist">
    <option value="300">300 km</option>
    <option value="500" selected>500 km</option>
    <option value="800">800 km</option>
    <option value="1000">1000 km</option>
    <option value="1500">1500 km</option>
  </select>
  <span class="ctrl-label">表示件数</span>
  <select id="sel-limit">
    <option value="50">50件</option>
    <option value="100" selected>100件</option>
    <option value="200">200件</option>
    <option value="500">500件</option>
  </select>
  <div class="mode-tabs">
    <button class="mode-tab active" id="tab-all">全都市</button>
    <button class="mode-tab" id="tab-country">国別グループ</button>
  </div>
  <button id="btn-load">読み込む</button>
</div>
<div id="ai-modal-overlay" class="ai-modal-overlay">
  <div class="ai-modal">
    <div class="ai-modal-head">
      <span class="ai-modal-title" id="ai-modal-title">AI回答</span>
      <span id="ai-modal-cache-badge" style="display:none;background:#0e2a1a;border:1px solid #2ea043;border-radius:4px;color:#3fb950;font-size:10px;padding:1px 7px;flex-shrink:0">キャッシュ</span>
      <button class="ai-modal-close" id="ai-modal-close">✕</button>
    </div>
    <div class="ai-modal-body" id="ai-modal-body"></div>
  </div>
</div>
<div id="heritage-chatlog-modal-overlay" class="hcl-modal-overlay">
  <div class="hcl-modal" id="heritage-chatlog-modal">
    <div class="hcl-modal-head">
      <span class="hcl-modal-title" id="heritage-chatlog-modal-title">AIチャット過去ログ</span>
      <button class="hcl-modal-close" id="heritage-chatlog-close">✕</button>
    </div>
    <div class="hcl-modal-body" id="heritage-chatlog-modal-body"></div>
  </div>
</div>
<div class="summary" id="summary"></div>
<div class="tbl-wrap" id="tbl-wrap">
  <div class="spinner">条件を選択して「読み込む」を押してください</div>
</div>

<script>
var CC_FLAG = {
  AF:'🇦🇫',AL:'🇦🇱',DZ:'🇩🇿',AD:'🇦🇩',AO:'🇦🇴',AG:'🇦🇬',AR:'🇦🇷',AM:'🇦🇲',
  AU:'🇦🇺',AT:'🇦🇹',AZ:'🇦🇿',BS:'🇧🇸',BH:'🇧🇭',BD:'🇧🇩',BB:'🇧🇧',BY:'🇧🇾',
  BE:'🇧🇪',BZ:'🇧🇿',BJ:'🇧🇯',BT:'🇧🇹',BO:'🇧🇴',BA:'🇧🇦',BW:'🇧🇼',BR:'🇧🇷',
  BN:'🇧🇳',BG:'🇧🇬',BF:'🇧🇫',BI:'🇧🇮',CV:'🇨🇻',KH:'🇰🇭',CM:'🇨🇲',CA:'🇨🇦',
  CF:'🇨🇫',TD:'🇹🇩',CL:'🇨🇱',CN:'🇨🇳',CO:'🇨🇴',KM:'🇰🇲',CG:'🇨🇬',CD:'🇨🇩',
  CR:'🇨🇷',CI:'🇨🇮',HR:'🇭🇷',CU:'🇨🇺',CY:'🇨🇾',CZ:'🇨🇿',DK:'🇩🇰',DJ:'🇩🇯',
  DM:'🇩🇲',DO:'🇩🇴',EC:'🇪🇨',EG:'🇪🇬',SV:'🇸🇻',GQ:'🇬🇶',ER:'🇪🇷',EE:'🇪🇪',
  SZ:'🇸🇿',ET:'🇪🇹',FJ:'🇫🇯',FI:'🇫🇮',FR:'🇫🇷',GA:'🇬🇦',GM:'🇬🇲',GE:'🇬🇪',
  DE:'🇩🇪',GH:'🇬🇭',GR:'🇬🇷',GD:'🇬🇩',GT:'🇬🇹',GN:'🇬🇳',GW:'🇬🇼',GY:'🇬🇾',
  HT:'🇭🇹',HN:'🇭🇳',HU:'🇭🇺',IS:'🇮🇸',IN:'🇮🇳',ID:'🇮🇩',IR:'🇮🇷',IQ:'🇮🇶',
  IE:'🇮🇪',IL:'🇮🇱',IT:'🇮🇹',JM:'🇯🇲',JP:'🇯🇵',JO:'🇯🇴',KZ:'🇰🇿',KE:'🇰🇪',
  KI:'🇰🇮',KW:'🇰🇼',KG:'🇰🇬',LA:'🇱🇦',LV:'🇱🇻',LB:'🇱🇧',LS:'🇱🇸',LR:'🇱🇷',
  LY:'🇱🇾',LI:'🇱🇮',LT:'🇱🇹',LU:'🇱🇺',MG:'🇲🇬',MW:'🇲🇼',MY:'🇲🇾',MV:'🇲🇻',
  ML:'🇲🇱',MT:'🇲🇹',MH:'🇲🇭',MR:'🇲🇷',MU:'🇲🇺',MX:'🇲🇽',FM:'🇫🇲',MD:'🇲🇩',
  MC:'🇲🇨',MN:'🇲🇳',ME:'🇲🇪',MA:'🇲🇦',MZ:'🇲🇿',MM:'🇲🇲',NA:'🇳🇦',NR:'🇳🇷',
  NP:'🇳🇵',NL:'🇳🇱',NZ:'🇳🇿',NI:'🇳🇮',NE:'🇳🇪',NG:'🇳🇬',NO:'🇳🇴',OM:'🇴🇲',
  PK:'🇵🇰',PW:'🇵🇼',PS:'🇵🇸',PA:'🇵🇦',PG:'🇵🇬',PY:'🇵🇾',PE:'🇵🇪',PH:'🇵🇭',
  PL:'🇵🇱',PT:'🇵🇹',QA:'🇶🇦',RO:'🇷🇴',RU:'🇷🇺',RW:'🇷🇼',KN:'🇰🇳',LC:'🇱🇨',
  VC:'🇻🇨',WS:'🇼🇸',SM:'🇸🇲',ST:'🇸🇹',SA:'🇸🇦',SN:'🇸🇳',RS:'🇷🇸',SC:'🇸🇨',
  SL:'🇸🇱',SG:'🇸🇬',SK:'🇸🇰',SI:'🇸🇮',SB:'🇸🇧',SO:'🇸🇴',ZA:'🇿🇦',SS:'🇸🇸',
  ES:'🇪🇸',LK:'🇱🇰',SD:'🇸🇩',SR:'🇸🇷',SE:'🇸🇪',CH:'🇨🇭',SY:'🇸🇾',TW:'🇹🇼',
  TJ:'🇹🇯',TZ:'🇹🇿',TH:'🇹🇭',TL:'🇹🇱',TG:'🇹🇬',TO:'🇹🇴',TT:'🇹🇹',TN:'🇹🇳',
  TR:'🇹🇷',TM:'🇹🇲',TV:'🇹🇻',UG:'🇺🇬',UA:'🇺🇦',AE:'🇦🇪',GB:'🇬🇧',US:'🇺🇸',
  UY:'🇺🇾',UZ:'🇺🇿',VU:'🇻🇺',VE:'🇻🇪',VN:'🇻🇳',YE:'🇾🇪',ZM:'🇿🇲',ZW:'🇿🇼'
};
var CC_JP = {
  AF:'アフガニスタン',AL:'アルバニア',DZ:'アルジェリア',AD:'アンドラ',AO:'アンゴラ',
  AR:'アルゼンチン',AM:'アルメニア',AU:'オーストラリア',AT:'オーストリア',AZ:'アゼルバイジャン',
  BE:'ベルギー',BZ:'ベリーズ',BJ:'ベナン',BT:'ブータン',BO:'ボリビア',BA:'ボスニア・ヘルツェゴビナ',
  BW:'ボツワナ',BR:'ブラジル',BN:'ブルネイ',BG:'ブルガリア',BF:'ブルキナファソ',BI:'ブルンジ',
  KH:'カンボジア',CM:'カメルーン',CA:'カナダ',CF:'中央アフリカ',TD:'チャド',CL:'チリ',
  CN:'中国',CO:'コロンビア',CG:'コンゴ',CD:'コンゴ民主',CR:'コスタリカ',CI:'コートジボワール',
  HR:'クロアチア',CU:'キューバ',CY:'キプロス',CZ:'チェコ',DK:'デンマーク',DJ:'ジブチ',
  DO:'ドミニカ',EC:'エクアドル',EG:'エジプト',SV:'エルサルバドル',GQ:'赤道ギニア',
  ER:'エリトリア',EE:'エストニア',ET:'エチオピア',FI:'フィンランド',FR:'フランス',
  GA:'ガボン',GM:'ガンビア',GE:'ジョージア',DE:'ドイツ',GH:'ガーナ',GR:'ギリシャ',
  GT:'グアテマラ',GN:'ギニア',GW:'ギニアビサウ',GY:'ガイアナ',HT:'ハイチ',HN:'ホンジュラス',
  HU:'ハンガリー',IS:'アイスランド',IN:'インド',ID:'インドネシア',IR:'イラン',IQ:'イラク',
  IE:'アイルランド',IL:'イスラエル',IT:'イタリア',JM:'ジャマイカ',JP:'日本',JO:'ヨルダン',
  KZ:'カザフスタン',KE:'ケニア',KW:'クウェート',KG:'キルギス',LA:'ラオス',LV:'ラトビア',
  LB:'レバノン',LS:'レソト',LY:'リビア',LT:'リトアニア',LU:'ルクセンブルク',MG:'マダガスカル',
  MW:'マラウイ',MY:'マレーシア',MV:'モルディブ',ML:'マリ',MT:'マルタ',MR:'モーリタニア',
  MU:'モーリシャス',MX:'メキシコ',MD:'モルドバ',MC:'モナコ',MN:'モンゴル',ME:'モンテネグロ',
  MA:'モロッコ',MZ:'モザンビーク',MM:'ミャンマー',NA:'ナミビア',NP:'ネパール',NL:'オランダ',
  NZ:'ニュージーランド',NI:'ニカラグア',NE:'ニジェール',NG:'ナイジェリア',NO:'ノルウェー',
  OM:'オマーン',PK:'パキスタン',PA:'パナマ',PG:'パプアニューギニア',PY:'パラグアイ',
  PE:'ペルー',PH:'フィリピン',PL:'ポーランド',PT:'ポルトガル',QA:'カタール',RO:'ルーマニア',
  RU:'ロシア',RW:'ルワンダ',SA:'サウジアラビア',SN:'セネガル',RS:'セルビア',SC:'セーシェル',
  SL:'シエラレオネ',SG:'シンガポール',SK:'スロバキア',SI:'スロベニア',SB:'ソロモン諸島',
  SO:'ソマリア',ZA:'南アフリカ',SS:'南スーダン',ES:'スペイン',LK:'スリランカ',SD:'スーダン',
  SR:'スリナム',SE:'スウェーデン',CH:'スイス',SY:'シリア',TW:'台湾',TJ:'タジキスタン',
  TZ:'タンザニア',TH:'タイ',TL:'東ティモール',TG:'トーゴ',TT:'トリニダード・トバゴ',
  TN:'チュニジア',TR:'トルコ',TM:'トルクメニスタン',UG:'ウガンダ',UA:'ウクライナ',
  AE:'アラブ首長国連邦',GB:'イギリス',US:'アメリカ',UY:'ウルグアイ',UZ:'ウズベキスタン',
  VU:'バヌアツ',VE:'ベネズエラ',VN:'ベトナム',YE:'イエメン',ZM:'ザンビア',ZW:'ジンバブエ'
};

function ccToFlag(cc) {
  if (!cc) return '🌐';
  return CC_FLAG[cc] || '🌐';
}
function ccToJp(cc) {
  if (!cc) return '不明';
  return CC_JP[cc] || cc;
}
function fmtPop(n) {
  if (!n) return '-';
  if (n >= 1000000) return Math.round(n / 100000) / 10 + '百万';
  if (n >= 10000) return Math.round(n / 1000) + '千';
  return n.toLocaleString();
}

function cityLink(r) {
  var url = '/webgl-heritage?city=' + encodeURIComponent(r.city_name) +
    '&lat=' + r.city_lat + '&lon=' + r.city_lon +
    (r.country_code ? '&cc=' + encodeURIComponent(r.country_code) : '');
  return '<a href="' + url + '" style="color:inherit;text-decoration:none;border-bottom:1px dotted #444">' + r.city_name + '</a>';
}

function buildCountryStats(rows) {
  var map = {};
  rows.forEach(function(r) {
    var cc = r.country_code || '__';
    map[cc] = (map[cc] || 0) + 1;
  });
  return Object.keys(map).map(function(cc) {
    return { cc: cc, count: map[cc] };
  }).sort(function(a, b) { return b.count - a.count; });
}

function buildCityThHtml(ccStats) {
  var opts = '<option value="">すべて</option>';
  ccStats.forEach(function(s) {
    var flag = ccToFlag(s.cc === '__' ? null : s.cc);
    opts += '<option value="' + s.cc + '">' + s.count + ' ' + flag + '</option>';
  });
  return '都市 <select id="sel-country" style="font-size:11px;padding:3px 6px;margin-left:4px">' + opts + '</select>';
}

var allRows = [];
var viewMode = 'all';

document.getElementById('tab-all').addEventListener('click', function() {
  viewMode = 'all';
  document.getElementById('tab-all').className = 'mode-tab active';
  document.getElementById('tab-country').className = 'mode-tab';
  if (allRows.length) renderAll(filteredRows());
});
document.getElementById('tab-country').addEventListener('click', function() {
  viewMode = 'country';
  document.getElementById('tab-all').className = 'mode-tab';
  document.getElementById('tab-country').className = 'mode-tab active';
  if (allRows.length) renderCountry(filteredRows());
});

document.getElementById('btn-load').addEventListener('click', loadData);

function getSelCountry() {
  var el = document.getElementById('sel-country');
  return el ? el.value : '';
}

function filteredRows() {
  var cc = getSelCountry();
  if (!cc) return allRows;
  return allRows.filter(function(r) { return (r.country_code || '__') === cc; });
}

function onCountryChange() {
  if (!allRows.length) return;
  if (viewMode === 'country') renderCountry(filteredRows());
  else renderAll(filteredRows());
}

function bindCountrySelect() {
  var el = document.getElementById('sel-country');
  if (el) el.addEventListener('change', onCountryChange);
}

var aiModalOverlay = document.getElementById('ai-modal-overlay');
var aiModalTitle = document.getElementById('ai-modal-title');
var aiModalBody = document.getElementById('ai-modal-body');
var aiModalCacheBadge = document.getElementById('ai-modal-cache-badge');
document.getElementById('ai-modal-close').addEventListener('click', function() {
  aiModalOverlay.classList.remove('open');
});
aiModalOverlay.addEventListener('click', function(e) {
  if (e.target === aiModalOverlay) aiModalOverlay.classList.remove('open');
});

function getNextZ() {
  var els = document.querySelectorAll('[style*="z-index"]');
  var max = 100;
  for (var i = 0; i < els.length; i++) {
    var z = parseInt(els[i].style.zIndex, 10);
    if (!isNaN(z) && z > max) max = z;
  }
  return max + 100;
}

var hclOverlay = document.getElementById('heritage-chatlog-modal-overlay');
var hclTitle = document.getElementById('heritage-chatlog-modal-title');
var hclBody = document.getElementById('heritage-chatlog-modal-body');
document.getElementById('heritage-chatlog-close').addEventListener('click', function() {
  hclOverlay.classList.remove('open');
});
hclOverlay.addEventListener('click', function(e) {
  if (e.target === hclOverlay) hclOverlay.classList.remove('open');
});

function openHeritageChatlogModal(heritageName, topic) {
  hclTitle.textContent = (topic ? heritageName + ' — ' + topic : heritageName) + ' — AIチャット過去ログ';
  hclBody.innerHTML = '<div class="hcl-empty">読み込み中...</div>';
  hclOverlay.style.zIndex = String(getNextZ());
  hclOverlay.classList.add('open');
  var byKwUrl = '/api/aichat/shares/by-keyword?keyword=' + encodeURIComponent(heritageName) +
    (topic ? '&topic=' + encodeURIComponent(topic) : '');
  fetch(byKwUrl)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var results = data.results || [];
      if (!results.length) {
        hclBody.innerHTML = '<div class="hcl-empty">該当する過去ログが見つかりませんでした</div>';
        return;
      }
      var html = '';
      results.forEach(function(item) {
        var date = item.created_at ? item.created_at.slice(0, 10) : '';
        var model = item.model || '';
        var q = item.question || '';
        var a = item.answer || '';
        var qEsc = q.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        var aEsc = a.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        html += '<div class="hcl-entry">' +
          '<div class="hcl-entry-q">Q: ' + qEsc + '</div>' +
          '<div class="hcl-entry-a">' + aEsc + '</div>' +
          '<div class="hcl-entry-meta"><span>' + date + '</span><span>' + model + '</span></div>' +
          '</div>';
      });
      hclBody.innerHTML = html;
    })
    .catch(function() {
      hclBody.innerHTML = '<div class="hcl-empty">取得エラーが発生しました</div>';
    });
}

function checkHeritageKeywords(heritages, inner) {
  if (!heritages.length) return;
  var keywords = heritages.map(function(h) { return h.heritage_name; });
  fetch('/api/aichat/heritage-keywords-check?keywords=' + encodeURIComponent(keywords.join(',')))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var hits = data.hits || {};
      inner.querySelectorAll('.acc-name[data-heritage]').forEach(function(span) {
        var name = span.getAttribute('data-heritage');
        var topics = name ? (hits[name] || []) : [];
        if (name && topics.length) {
          var btn = document.createElement('button');
          btn.className = 'acc-name-link';
          btn.setAttribute('data-heritage', name);
          btn.textContent = span.textContent;
          btn.addEventListener('click', function(e) {
            e.stopPropagation();
          });
          var wrap = document.createElement('span');
          wrap.className = 'acc-name-wrap';
          wrap.appendChild(btn);
          for (var ti = 0; ti < topics.length; ti++) {
            var badge = document.createElement('span');
            badge.className = 'acc-topic-badge';
            badge.textContent = topics[ti];
            (function(badgeTopic) {
              badge.addEventListener('click', function(e) {
                e.stopPropagation();
                openHeritageChatlogModal(name, badgeTopic);
              });
            })(topics[ti]);
            wrap.appendChild(badge);
          }
          span.parentNode.replaceChild(wrap, span);
        }
      });
    })
    .catch(function() {});
}

function openAiModal(title, bodyText, isCached) {
  aiModalTitle.textContent = title;
  aiModalBody.textContent = bodyText;
  aiModalCacheBadge.style.display = isCached ? '' : 'none';
  aiModalOverlay.style.zIndex = getNextZ();
  aiModalOverlay.classList.add('open');
}

var AI_TOPICS = ['交通手段', '見どころ', '最寄り空港', '鉄道でのアクセス', '宿泊施設', 'スポーツ施設'];

function askAI(heritageName, topic, onComplete) {
  var prompt = '「' + heritageName + '」の「' + topic + '」について説明してください';
  openAiModal(heritageName + ' — ' + topic, '読み込み中...', false);
  fetch('/api/aichat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: prompt, source: 'api' })
  }).then(function(r) { return r.json(); }).then(function(data) {
    aiModalBody.textContent = data.response || data.error || '（応答なし）';
    if (data.response && data.id) {
      aiModalCacheBadge.style.display = 'none';
    }
    if (onComplete) onComplete();
  }).catch(function() {
    aiModalBody.textContent = '通信エラーが発生しました。';
  });
}

function askAICached(heritageName, topic, shareId) {
  openAiModal(heritageName + ' — ' + topic, '読み込み中...', true);
  fetch('/api/aichat/shares/' + encodeURIComponent(shareId))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      aiModalBody.textContent = data.answer || data.error || '（応答なし）';
    })
    .catch(function() {
      aiModalBody.textContent = '通信エラーが発生しました。';
    });
}

function buildAiPanel(heritageName) {
  var html = '<div class="acc-ai-panel">' +
    '<div class="acc-ai-label">AIに何を質問しますか</div>' +
    '<div class="acc-ai-btns">';
  AI_TOPICS.forEach(function(topic) {
    html += '<button class="acc-ai-btn" data-topic="' + topic + '" data-heritage="' +
      heritageName.replace(/"/g, '&quot;') + '">' + topic + '</button>';
  });
  html += '</div></div>';
  return html;
}

function closeAllAccordions() {
  var rows = document.querySelectorAll('.accordion-row');
  for (var i = 0; i < rows.length; i++) rows[i].parentNode.removeChild(rows[i]);
  var opens = document.querySelectorAll('.row-open');
  for (var j = 0; j < opens.length; j++) opens[j].classList.remove('row-open');
}

function openAccordion(tr) {
  var cityName = tr.getAttribute('data-city');
  var lat = parseFloat(tr.getAttribute('data-lat'));
  var lon = parseFloat(tr.getAttribute('data-lon'));
  var accTr = document.createElement('tr');
  accTr.className = 'accordion-row';
  var colCount = tr.cells.length;
  accTr.innerHTML = '<td colspan="' + colCount + '"><div class="accordion-inner"><div class="acc-loading">読み込み中...</div></div></td>';
  tr.parentNode.insertBefore(accTr, tr.nextSibling);
  tr.classList.add('row-open');
  fetch('/api/city-all-heritages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ city_name: cityName, lat: lat, lon: lon })
  }).then(function(r) { return r.json(); }).then(function(data) {
    var heritages = data.heritages || [];
    var inner = accTr.querySelector('.accordion-inner');
    if (!inner) return;
    if (heritages.length === 0) {
      inner.innerHTML = '<div class="acc-loading">近隣の世界遺産データなし</div>';
      return;
    }
    var html = '<div class="acc-heritage-list">';
    heritages.forEach(function(h) {
      var dist = h.distance_km < 10 ? h.distance_km.toFixed(1) : Math.round(h.distance_km);
      var safeName = h.heritage_name.replace(/&/g,'&amp;').replace(/</g,'&lt;');
      var flagSpan = h.country_flag
        ? '<span class="acc-country-flag">' + h.country_flag + '</span>'
        : '';
      html += '<div class="acc-row" data-heritage="' + h.heritage_name.replace(/"/g,'&quot;') + '">' +
        flagSpan +
        '<span class="acc-emoji">🏛️</span>' +
        '<span class="acc-name" data-heritage="' + h.heritage_name.replace(/"/g,'&quot;') + '">' + safeName + '</span>' +
        '<span class="acc-dist">' + dist + ' km</span>' +
        '</div>' +
        '<div class="acc-ai-wrap" id="acc-ai-' + Math.random().toString(36).slice(2) + '" style="display:none">' +
        buildAiPanel(h.heritage_name) +
        '</div>';
    });
    html += '</div>';
    inner.innerHTML = html;
    checkHeritageKeywords(heritages, inner);
    inner.querySelectorAll('.acc-row[data-heritage]').forEach(function(rowEl) {
      rowEl.style.cursor = 'pointer';
      rowEl.addEventListener('click', function() {
        var wrap = rowEl.nextSibling;
        if (!wrap || !wrap.classList || !wrap.classList.contains('acc-ai-wrap')) return;
        var isOpen = wrap.style.display !== 'none';
        inner.querySelectorAll('.acc-ai-wrap').forEach(function(w) { w.style.display = 'none'; });
        if (!isOpen) {
          wrap.style.display = '';
          checkHeritageKeywords(heritages, inner);
          var hName = rowEl.getAttribute('data-heritage') || '';
          if (hName) {
            var cityTr = accTr.previousElementSibling;
            var _cc = cityTr ? cityTr.getAttribute('data-cc') : '';
            var _cName = _cc ? ccToJp(_cc) : '';
            fetch('/api/aichat/check-heritage-questions?heritage=' + encodeURIComponent(hName) + '&country_name=' + encodeURIComponent(_cName))
              .then(function(r) { return r.json(); })
              .then(function(data) {
                var answered = data.answered || {};
                wrap.querySelectorAll('.acc-ai-btn').forEach(function(btn) {
                  var topic = btn.getAttribute('data-topic');
                  var shareId = topic ? answered[topic] : null;
                  if (shareId) {
                    btn.classList.add('answered');
                    btn.setAttribute('data-share-id', shareId);
                  } else {
                    btn.classList.remove('answered');
                    btn.removeAttribute('data-share-id');
                  }
                });
              })
              .catch(function() {});
          }
        }
      });
    });
    inner.querySelectorAll('.acc-ai-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var topic = btn.getAttribute('data-topic');
        var name = btn.getAttribute('data-heritage');
        var shareId = btn.getAttribute('data-share-id');
        if (shareId) {
          askAICached(name, topic, shareId);
        } else {
          askAI(name, topic, function() {
            var heritages = [];
            inner.querySelectorAll('.acc-row[data-heritage]').forEach(function(el) {
              heritages.push({ heritage_name: el.getAttribute('data-heritage') });
            });
            checkHeritageKeywords(heritages, inner);
          });
        }
      });
    });
  }).catch(function() {
    var inner = accTr.querySelector('.accordion-inner');
    if (inner) inner.innerHTML = '<div class="acc-loading">取得エラー</div>';
  });
}

function bindRowAccordion() {
  var tbody = document.querySelector('tbody');
  if (!tbody) return;
  tbody.addEventListener('click', function(e) {
    var target = e.target;
    if (target.tagName === 'A' || target.closest('a') || target.tagName === 'SELECT' || target.closest('select')) return;
    var tr = target.closest('tr');
    if (!tr || tr.classList.contains('accordion-row') || tr.classList.contains('group-head-tr')) return;
    if (tr.classList.contains('row-open')) {
      var next = tr.nextSibling;
      if (next && next.classList && next.classList.contains('accordion-row')) {
        next.parentNode.removeChild(next);
      }
      tr.classList.remove('row-open');
      return;
    }
    closeAllAccordions();
    openAccordion(tr);
  });
}

function summaryHtml(rows, ccStats, dist) {
  var countryCount = ccStats.length;
  var badge = '<span class="dist-badge">' + dist + ' km</span>';
  return '<strong>' + countryCount + 'ヶ国</strong> <strong>' + rows.length + '</strong>都市 · 距離上限 ' + badge;
}

function loadData() {
  var dist = document.getElementById('sel-dist').value;
  var limit = document.getElementById('sel-limit').value;
  var btn = document.getElementById('btn-load');
  btn.disabled = true;
  btn.textContent = '読み込み中...';
  document.getElementById('tbl-wrap').innerHTML = '<div class="spinner">読み込み中...</div>';
  document.getElementById('summary').textContent = '';
  fetch('/api/heritage-access-ranking?max_dist=' + dist + '&limit=' + limit)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      allRows = data.rows || [];
      btn.disabled = false;
      btn.textContent = '読み込む';
      if (!allRows.length) {
        document.getElementById('tbl-wrap').innerHTML = '<div class="spinner">データなし（都市データを先に取得してください）</div>';
        return;
      }
      if (viewMode === 'country') renderCountry(filteredRows());
      else renderAll(filteredRows());
    })
    .catch(function() {
      btn.disabled = false;
      btn.textContent = '読み込む';
      document.getElementById('tbl-wrap').innerHTML = '<div class="spinner">取得エラー</div>';
    });
}

function tableHead(ccStats) {
  return '<table><thead><tr>' +
    '<th style="text-align:right">#</th>' +
    '<th></th>' +
    '<th>' + buildCityThHtml(ccStats) + '</th>' +
    '<th>国</th>' +
    '<th>世界遺産数</th>' +
    '<th class="num">最近距離</th>' +
    '<th class="num">人口</th>' +
    '</tr></thead><tbody>';
}

function renderAll(rows) {
  var dist = document.getElementById('sel-dist').value;
  var ccStats = buildCountryStats(allRows);
  document.getElementById('summary').innerHTML = summaryHtml(allRows, ccStats, dist);
  var maxCount = allRows[0] ? allRows[0].heritage_count : 1;
  var html = tableHead(ccStats);
  rows.forEach(function(r, i) {
    var rowClass = i === 0 ? ' class="top1"' : i === 1 ? ' class="top2"' : i === 2 ? ' class="top3"' : '';
    var barW = Math.round((r.heritage_count / maxCount) * 140);
    html += '<tr' + rowClass +
      ' data-city="' + r.city_name.replace(/"/g, '&quot;') + '"' +
      ' data-lat="' + r.city_lat + '"' +
      ' data-lon="' + r.city_lon + '"' +
      ' data-cc="' + (r.country_code || '') + '">' +
      '<td class="rank">' + (i + 1) + '</td>' +
      '<td class="flag">' + ccToFlag(r.country_code) + '</td>' +
      '<td class="city">' + cityLink(r) + '</td>' +
      '<td class="country">' + ccToJp(r.country_code) + '</td>' +
      '<td><div style="display:flex;align-items:center;gap:6px">' +
        '<div class="bar" style="width:' + barW + 'px"></div>' +
        '<span style="color:#3fb950;font-weight:700;font-size:13px">' + r.heritage_count + '</span>' +
      '</div></td>' +
      '<td class="nearest">' + r.nearest_km + ' km</td>' +
      '<td class="pop">' + fmtPop(r.population) + '</td>' +
      '</tr>';
  });
  html += '</tbody></table>';
  document.getElementById('tbl-wrap').innerHTML = html;
  var selCC = getSelCountry();
  bindCountrySelect();
  bindRowAccordion();
  if (selCC) {
    var el = document.getElementById('sel-country');
    if (el) el.value = selCC;
  }
}

function renderCountry(rows) {
  var dist = document.getElementById('sel-dist').value;
  var ccStats = buildCountryStats(allRows);
  document.getElementById('summary').innerHTML = summaryHtml(allRows, ccStats, dist);
  var byCountry = {};
  rows.forEach(function(r) {
    var cc = r.country_code || '__';
    if (!byCountry[cc]) byCountry[cc] = [];
    byCountry[cc].push(r);
  });
  var ccList = Object.keys(byCountry).sort(function(a, b) {
    return byCountry[b][0].heritage_count - byCountry[a][0].heritage_count;
  });
  var maxCount = allRows[0] ? allRows[0].heritage_count : 1;
  var html = tableHead(ccStats);
  var globalRank = 0;
  ccList.forEach(function(cc) {
    var cities = byCountry[cc];
    var flag = ccToFlag(cc === '__' ? null : cc);
    var jpName = ccToJp(cc === '__' ? null : cc);
    html += '<tr class="group-head-tr"><td colspan="7" class="group-head">' + flag + ' ' + jpName +
      ' <span style="color:#484f58;margin-left:6px">' + cities.length + '都市</span></td></tr>';
    cities.forEach(function(r) {
      globalRank++;
      var barW = Math.round((r.heritage_count / maxCount) * 140);
      html += '<tr' +
        ' data-city="' + r.city_name.replace(/"/g, '&quot;') + '"' +
        ' data-lat="' + r.city_lat + '"' +
        ' data-lon="' + r.city_lon + '"' +
        ' data-cc="' + (r.country_code || '') + '">' +
        '<td class="rank">' + globalRank + '</td>' +
        '<td class="flag">' + ccToFlag(r.country_code) + '</td>' +
        '<td class="city">' + cityLink(r) + '</td>' +
        '<td class="country">' + ccToJp(r.country_code) + '</td>' +
        '<td><div style="display:flex;align-items:center;gap:6px">' +
          '<div class="bar" style="width:' + barW + 'px"></div>' +
          '<span style="color:#3fb950;font-weight:700;font-size:13px">' + r.heritage_count + '</span>' +
        '</div></td>' +
        '<td class="nearest">' + r.nearest_km + ' km</td>' +
        '<td class="pop">' + fmtPop(r.population) + '</td>' +
        '</tr>';
    });
  });
  html += '</tbody></table>';
  document.getElementById('tbl-wrap').innerHTML = html;
  var selCC = getSelCountry();
  bindCountrySelect();
  bindRowAccordion();
  if (selCC) {
    var el = document.getElementById('sel-country');
    if (el) el.value = selCC;
  }
}
</script>
</body>
</html>`;
}
