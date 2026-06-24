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
tbody tr:hover{background:#161b22}
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

var allRows = [];
var viewMode = 'all';

document.getElementById('tab-all').addEventListener('click', function() {
  viewMode = 'all';
  document.getElementById('tab-all').className = 'mode-tab active';
  document.getElementById('tab-country').className = 'mode-tab';
  if (allRows.length) renderAll(allRows);
});
document.getElementById('tab-country').addEventListener('click', function() {
  viewMode = 'country';
  document.getElementById('tab-all').className = 'mode-tab';
  document.getElementById('tab-country').className = 'mode-tab active';
  if (allRows.length) renderCountry(allRows);
});

document.getElementById('btn-load').addEventListener('click', loadData);

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
      if (viewMode === 'country') renderCountry(allRows);
      else renderAll(allRows);
    })
    .catch(function() {
      btn.disabled = false;
      btn.textContent = '読み込む';
      document.getElementById('tbl-wrap').innerHTML = '<div class="spinner">取得エラー</div>';
    });
}

function renderAll(rows) {
  var dist = document.getElementById('sel-dist').value;
  var maxCount = rows[0] ? rows[0].heritage_count : 1;
  document.getElementById('summary').innerHTML =
    '<strong>' + rows.length + '</strong> 都市 · 距離上限 <span class="dist-badge">' + dist + ' km</span>';
  var html = '<table><thead><tr>' +
    '<th style="text-align:right">#</th>' +
    '<th></th>' +
    '<th>都市</th>' +
    '<th>国</th>' +
    '<th>世界遺産数</th>' +
    '<th class="num">最近距離</th>' +
    '<th class="num">人口</th>' +
    '</tr></thead><tbody>';
  rows.forEach(function(r, i) {
    var rowClass = i === 0 ? ' class="top1"' : i === 1 ? ' class="top2"' : i === 2 ? ' class="top3"' : '';
    var barW = Math.round((r.heritage_count / maxCount) * 140);
    html += '<tr' + rowClass + '>' +
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
}

function renderCountry(rows) {
  var dist = document.getElementById('sel-dist').value;
  var byCountry = {};
  rows.forEach(function(r) {
    var cc = r.country_code || '__';
    if (!byCountry[cc]) byCountry[cc] = [];
    byCountry[cc].push(r);
  });
  var ccList = Object.keys(byCountry).sort(function(a, b) {
    return byCountry[b][0].heritage_count - byCountry[a][0].heritage_count;
  });
  document.getElementById('summary').innerHTML =
    '<strong>' + rows.length + '</strong> 都市 · <strong>' + ccList.length + '</strong> 国 · 距離上限 <span class="dist-badge">' + dist + ' km</span>';
  var maxCount = rows[0] ? rows[0].heritage_count : 1;
  var html = '<table><thead><tr>' +
    '<th style="text-align:right">#</th>' +
    '<th></th>' +
    '<th>都市</th>' +
    '<th>国</th>' +
    '<th>世界遺産数</th>' +
    '<th class="num">最近距離</th>' +
    '<th class="num">人口</th>' +
    '</tr></thead><tbody>';
  var globalRank = 0;
  ccList.forEach(function(cc) {
    var cities = byCountry[cc];
    var flag = ccToFlag(cc === '__' ? null : cc);
    var jpName = ccToJp(cc === '__' ? null : cc);
    html += '<tr><td colspan="7" class="group-head">' + flag + ' ' + jpName +
      ' <span style="color:#484f58;margin-left:6px">' + cities.length + '都市</span></td></tr>';
    cities.forEach(function(r) {
      globalRank++;
      var barW = Math.round((r.heritage_count / maxCount) * 140);
      html += '<tr>' +
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
}
</script>
</body>
</html>`;
}
