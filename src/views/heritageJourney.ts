import { HERITAGE_LIST } from '../data/heritageList';
import { ROUTE_CITIES } from '../data/routeCities';

const EUROPE_LAT_MIN = 36, EUROPE_LAT_MAX = 61, EUROPE_LON_MIN = -12, EUROPE_LON_MAX = 35;

function inEurope(lat: number, lon: number): boolean {
  return lat >= EUROPE_LAT_MIN && lat <= EUROPE_LAT_MAX && lon >= EUROPE_LON_MIN && lon <= EUROPE_LON_MAX;
}

/**
 * heritage-journeyページの経由地候補として埋め込む、ヨーロッパ域内の世界遺産一覧。
 * 出発/到着都市によって迂回距離の絞り込みはクライアント側(JS)で行うため、ここでは
 * 座標付きの生データのみをヨーロッパ域内に絞って埋め込む。
 */
export function buildEmbeddedHeritagePoints(): { n: string; e: string; c: string; lat: number; lon: number }[] {
  return HERITAGE_LIST
    .filter((h) => inEurope(h.lat, h.lon))
    .map((h) => ({ n: h.n, e: h.e, c: h.c, lat: h.lat, lon: h.lon }));
}

export function getHeritageJourneyPage(): string {
  const heritagePoints = buildEmbeddedHeritagePoints();
  const cities = ROUTE_CITIES;
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Heritage Journey — 世界遺産巡りマップ</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0}
.wrap{max-width:1080px;margin:0 auto;padding:24px}
h1{font-size:22px;margin:0 0 4px}
.muted{color:#94a3b8;font-size:12px;margin-bottom:18px;line-height:1.7}
.card{background:#111827;border:1px solid #334155;border-radius:12px;padding:16px;margin-bottom:16px}
.section-title{font-size:14px;font-weight:700;margin:0 0 10px;color:#93c5fd}
.city-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.city-row select{background:#0b1220;border:1px solid #475569;color:#e2e8f0;border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit}
#swap-btn{background:#1e293b;border:1px solid #475569;color:#cbd5e1;border-radius:8px;padding:7px 10px;cursor:pointer;font-size:13px}
#swap-btn:hover{border-color:#38bdf8;color:#fff}
.opt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;margin-top:12px}
.opt-item{display:flex;flex-direction:column;gap:4px;font-size:11px;color:#94a3b8}
.opt-item input{background:#0b1220;border:1px solid #475569;color:#e2e8f0;border-radius:6px;padding:6px 8px;font-size:13px;font-family:inherit}
.summary-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.stat{background:#0b1220;border:1px solid #1e293b;border-radius:8px;padding:10px 12px}
.stat .label{font-size:11px;color:#94a3b8}
.stat .value{font-size:18px;font-weight:700;color:#5eead4;margin-top:2px}
.stat.loss .value{color:#fca5a5}
.cand-toolbar{display:flex;gap:8px;align-items:center;margin-bottom:8px;font-size:12px}
.cand-toolbar button{background:#1e293b;border:1px solid #475569;color:#cbd5e1;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:11px}
.cand-toolbar button:hover{border-color:#38bdf8;color:#fff}
.cand-count{color:#94a3b8;margin-left:auto}
.cand-list{max-height:360px;overflow:auto;border:1px solid #1e293b;border-radius:8px}
.cand-row{display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid #1e293b;font-size:12px}
.cand-row:last-child{border-bottom:none}
.cand-row:hover{background:#0b1220}
.cand-row .cname{flex:1}
.cand-row .cdetour{color:#94a3b8;font-variant-numeric:tabular-nums}
.route-line{padding:0;font-size:12px;line-height:2.1;margin-top:12px}
.wp-badge{display:inline-block;background:#1e293b;border:1px solid #334155;border-radius:999px;padding:2px 9px;white-space:nowrap}
.wp-arrow{color:#64748b;margin:0 4px}
.day-table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}
.day-table th,.day-table td{padding:6px 10px;border-bottom:1px solid #1e293b;text-align:left}
.day-table th{background:#1e293b;color:#bfdbfe}
.hub-note{background:#0c2d4e;border:1px solid #1e3a5f;border-radius:8px;padding:8px 12px;font-size:12px;color:#93c5fd;margin-top:6px}
.trim-box{background:#3a1414;border:1px solid #7f1d1d;border-radius:8px;padding:10px 12px;font-size:12px;color:#fecaca;margin-top:10px}
.trim-box ul{margin:6px 0 8px;padding-left:18px}
.trim-box button{background:#7f1d1d;border:1px solid #ef4444;color:#fecaca;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:11px}
.empty-note{color:#64748b;font-size:12px;padding:8px 0}
.dist-row{display:flex;align-items:center;gap:10px;padding:6px 4px;cursor:pointer;border-radius:6px}
.dist-row:hover{background:#0b1220}
.dist-label{width:110px;flex-shrink:0;font-size:12px;color:#cbd5e1}
.dist-bar-track{flex:1;background:#0b1220;border-radius:5px;height:16px;overflow:hidden}
.dist-bar{background:linear-gradient(90deg,#2563eb,#38bdf8);height:100%;border-radius:5px;min-width:2px;transition:width .2s}
.dist-count{width:52px;flex-shrink:0;text-align:right;font-size:12px;color:#94a3b8;font-variant-numeric:tabular-nums}
.dist-cities{padding:4px 4px 10px 120px;display:flex;flex-wrap:wrap;gap:6px}
.dist-city-chip{background:#1e293b;border:1px solid #475569;color:#cbd5e1;border-radius:999px;padding:4px 10px;font-size:11px;cursor:pointer}
.dist-city-chip:hover{border-color:#38bdf8;color:#fff}
.slack-note{background:#0c2d1a;border:1px solid #14532d;border-radius:8px;padding:8px 12px;font-size:12px;color:#86efac;margin-top:10px}
</style>
</head>
<body>
<div class="wrap">
  <h1>Heritage Journey — 世界遺産巡りマップ</h1>
  <div class="muted">主要都市2点を移動する際、距離ロスがほぼ無く立ち寄れる世界遺産を候補として表示します。候補を任意に選択(すべて選択も可)すると、直行との距離ロス・時間ロスがその場で再計算されます。あわせて宿泊地の推奨と、連泊しての市内巡り・日程短縮の提案も行います。</div>

  <div class="card">
    <div class="section-title">出発地・到着地</div>
    <div class="city-row">
      <select id="start-city"></select>
      <button id="swap-btn" type="button">⇄ 入替</button>
      <select id="end-city"></select>
    </div>
    <div class="opt-grid">
      <label class="opt-item">迂回許容距離(km・候補の広さ)<input id="opt-detour" type="number" min="10" max="500" step="10" value="150"></label>
      <label class="opt-item">平均移動速度(km/h)<input id="opt-speed" type="number" min="20" max="160" step="5" value="70"></label>
      <label class="opt-item">1件あたり見学時間(h)<input id="opt-visit" type="number" min="0" max="12" step="0.5" value="1.5"></label>
      <label class="opt-item">1日の最大移動距離(km)<input id="opt-daily" type="number" min="100" max="900" step="10" value="350"></label>
      <label class="opt-item">拠点とみなす近さ(km・連泊判定)<input id="opt-hub" type="number" min="10" max="200" step="5" value="45"></label>
      <label class="opt-item">使える宿泊数(泊・任意)<input id="opt-nights" type="number" min="0" max="60" step="1" placeholder="未入力なら無制限"></label>
    </div>
  </div>

  <div class="card">
    <div class="section-title">出発地から見た目的地別プラン分布</div>
    <div class="muted" style="margin-bottom:10px">現在の出発地から各都市への既定プラン(迂回20km以内の世界遺産を全て含む)が、それぞれ何泊必要かを集計しています。バーをクリックすると該当する目的地の一覧が開き、選ぶとその目的地の詳細プランに切り替わります。</div>
    <div id="nights-dist"></div>
  </div>

  <div class="card">
    <div class="section-title">距離ロス・時間ロス</div>
    <div class="summary-grid" id="summary-grid"></div>
    <div id="slack-note"></div>
  </div>

  <div class="card">
    <div class="section-title">経由地候補(世界遺産)</div>
    <div class="cand-toolbar">
      <button id="select-all-btn" type="button">すべて選択</button>
      <button id="select-none-btn" type="button">すべて解除</button>
      <button id="select-near-btn" type="button">近接のみ選択(20km以内)</button>
      <span class="cand-count" id="cand-count"></span>
    </div>
    <div class="cand-list" id="cand-list"></div>
  </div>

  <div class="card">
    <div class="section-title">ルート順序</div>
    <div class="route-line" id="route-line"></div>
  </div>

  <div class="card">
    <div class="section-title">宿泊地の推奨プラン</div>
    <div id="day-plan"></div>
  </div>
</div>
<script>
var HERITAGE_POINTS = ${JSON.stringify(heritagePoints)};
var CITIES = ${JSON.stringify(cities)};
var CITY_POINTS = CITIES.map(function(c) { return { name: c.label, lat: c.lat, lon: c.lon }; });
var EARTH_R = 6371;

function haversineKm(lat1, lon1, lat2, lon2) {
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
  return EARTH_R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function computeDetourKm(start, end, p) {
  var direct = haversineKm(start.lat, start.lon, end.lat, end.lon);
  return haversineKm(start.lat, start.lon, p.lat, p.lon) + haversineKm(p.lat, p.lon, end.lat, end.lon) - direct;
}

function buildCandidates(start, end, pool, maxDetourKm) {
  var out = [];
  pool.forEach(function(h) {
    if (haversineKm(h.lat, h.lon, start.lat, start.lon) < 3) return;
    if (haversineKm(h.lat, h.lon, end.lat, end.lon) < 3) return;
    var detour = computeDetourKm(start, end, h);
    if (detour <= maxDetourKm) out.push({ name: h.n, icon: h.e, country: h.c, lat: h.lat, lon: h.lon, detour: detour });
  });
  out.sort(function(a, b) { return a.detour - b.detour; });
  return out;
}

/**
 * 最安挿入法(cheapest insertion)でstart→endに選択済み地点を全て挿入し1本のルートにする。
 * 単純な最近傍法や進行方向ソートでは候補が起点-終点直線の左右に散らばっている場合に
 * 大きくジグザグして総距離が数倍に膨れ上がることが実データ検証で判明したため、
 * 「挿入しても増加距離が最小になる位置」を毎回全候補×全位置から選び直す方式にした。
 */
function cheapestInsertionOrder(start, end, selected) {
  var remaining = selected.slice();
  var route = [start, end];
  while (remaining.length) {
    var bestIdx = -1, bestPos = -1, bestCost = Infinity;
    for (var ci = 0; ci < remaining.length; ci++) {
      var cand = remaining[ci];
      for (var pos = 1; pos < route.length; pos++) {
        var prev = route[pos-1], next = route[pos];
        var cost = haversineKm(prev.lat, prev.lon, cand.lat, cand.lon) + haversineKm(cand.lat, cand.lon, next.lat, next.lon) - haversineKm(prev.lat, prev.lon, next.lat, next.lon);
        if (cost < bestCost) { bestCost = cost; bestIdx = ci; bestPos = pos; }
      }
    }
    var chosen = remaining.splice(bestIdx, 1)[0];
    route.splice(bestPos, 0, chosen);
  }
  return route;
}

function computeStats(start, end, ordered, speedKmh, perSiteHours) {
  var legs = [];
  var totalKm = 0;
  for (var i = 1; i < ordered.length; i++) {
    var km = haversineKm(ordered[i-1].lat, ordered[i-1].lon, ordered[i].lat, ordered[i].lon);
    legs.push({ from: ordered[i-1].name, to: ordered[i].name, km: km });
    totalKm += km;
  }
  var directKm = haversineKm(start.lat, start.lon, end.lat, end.lon);
  var extraKm = totalKm - directKm;
  var stopCount = ordered.length - 2;
  var extraHours = speedKmh > 0 ? extraKm / speedKmh : 0;
  var visitHours = stopCount * perSiteHours;
  return {
    legs: legs, totalKm: totalKm, directKm: directKm, extraKm: extraKm,
    extraPct: directKm > 0 ? (extraKm / directKm * 100) : 0,
    stopCount: stopCount, extraHours: extraHours, visitHours: visitHours,
    totalAddedHours: extraHours + visitHours,
  };
}

function nearestCity(p, cities) {
  var best = cities[0], bestD = Infinity;
  cities.forEach(function(c) { var d = haversineKm(p.lat, p.lon, c.lat, c.lon); if (d < bestD) { bestD = d; best = c; } });
  return best;
}

/**
 * ルート順(start/endを除く)で連続する経由地同士の距離がhubRadiusKm以内であれば、
 * 「同じ拠点に連泊して日帰りで周れる」候補としてクラスタ化する(2件以上のみ採用)。
 */
function detectHubClusters(ordered, hubRadiusKm) {
  var mid = ordered.slice(1, -1);
  var clusters = [];
  var cur = [];
  for (var i = 0; i < mid.length; i++) {
    if (cur.length === 0) { cur.push(mid[i]); continue; }
    // クラスタ内の最初の地点(拠点候補の目安)からの距離で判定する。直前の1件だけと
    // 比較する連鎖判定だと、各ペアはhubRadiusKm以内でも連鎖全体では大きく広がってしまい
    // (例: A-B, B-Cが近くてもA-Cは遠い)、現実には日帰りできない距離を「連泊圏内」と
    // 誤判定する。起点基準にすることでクラスタの直径は最大2*hubRadiusKmに収まる。
    var anchor = cur[0];
    var d = haversineKm(anchor.lat, anchor.lon, mid[i].lat, mid[i].lon);
    if (d <= hubRadiusKm) { cur.push(mid[i]); }
    else { if (cur.length >= 2) clusters.push(cur.slice()); cur = [mid[i]]; }
  }
  if (cur.length >= 2) clusters.push(cur.slice());
  return clusters;
}

/**
 * ルートを1日あたりmaxDailyKmを上限に区切り、各日の終着地点に最も近い都市を
 * 宿泊推奨地として提示する。hubクラスタに含まれる経由地は、クラスタの重心に最も
 * 近い都市を拠点として連泊(日帰り観光)扱いにする。hubクラスタに到達した時点で
 * 必ずその日を区切る(距離上限に達していなくても)。距離だけで日を区切ると、
 * hubクラスタと無関係な手前の経由地がhub到着日の訪問地一覧に混入してしまうため。
 * また、経由地が無い(または疎らな)直行区間だけでmaxDailyKmを超える場合、その1区間を
 * 均等分割して複数の移動日に分ける。分割しないと「最終区間は常にnights:0」という
 * 判定により、実際には数日かかる長距離直行ルートが常に0泊と算出されてしまう
 * (実際に発生した不具合)。
 */
function planOvernights(start, end, ordered, clusters, cities, maxDailyKm) {
  var clusterOf = {};
  clusters.forEach(function(cl, ci) { cl.forEach(function(m) { clusterOf[m.name] = ci; }); });

  var collapsed = [start];
  var i = 1;
  while (i < ordered.length - 1) {
    var p = ordered[i];
    var ci = clusterOf[p.name];
    if (ci !== undefined) {
      var cl = clusters[ci];
      var centroid = { lat: 0, lon: 0 };
      cl.forEach(function(m) { centroid.lat += m.lat / cl.length; centroid.lon += m.lon / cl.length; });
      var city = nearestCity(centroid, cities);
      collapsed.push({ name: city.name, lat: city.lat, lon: city.lon, hubMembers: cl });
      i += cl.length;
    } else {
      collapsed.push(p);
      i += 1;
    }
  }
  collapsed.push(end);

  var days = [];
  var dayKm = 0, dayVisits = [];
  for (var k = 1; k < collapsed.length; k++) {
    var prev = collapsed[k-1], node = collapsed[k];
    var km = haversineKm(prev.lat, prev.lon, node.lat, node.lon);
    var isLast = (k === collapsed.length - 1);

    if (node.hubMembers) {
      // hub(連泊拠点)に到達する前に未確定の移動日が残っていれば、その日をhub到着前で
      // 区切って確定させる。そうしないとhub到着日の訪問地一覧に、hubとは無関係な
      // 手前の経由地まで混ざってしまう(実際に発生した不具合)。
      if (dayVisits.length > 0 || dayKm > 0) {
        days.push({ endPoint: prev.name, city: nearestCity(prev, cities).name, km: dayKm, visits: dayVisits.slice(), nights: 1, isHub: false });
        dayKm = 0; dayVisits = [];
      }
      dayKm += km;
      dayVisits = node.hubMembers.map(function(m) { return m.name; });
      var nights = Math.max(1, Math.ceil(node.hubMembers.length / 2));
      days.push({ endPoint: node.name, city: node.name, km: dayKm, visits: dayVisits.slice(), nights: isLast ? 0 : nights, isHub: true });
      dayKm = 0; dayVisits = [];
      continue;
    }

    // 1区間(prev→node)だけでmaxDailyKmを超える場合、そのままだと1日に押し込められて
    // しまい(直行ルートが常に「0泊」になる不具合が実際に起きた)、区間を均等分割して
    // 複数の移動日に分ける。分割点は経路上の実在しない地点なので、最寄り都市を宿泊
    // 推奨地として提示する。
    if (km > maxDailyKm) {
      if (dayVisits.length > 0 || dayKm > 0) {
        days.push({ endPoint: prev.name, city: nearestCity(prev, cities).name, km: dayKm, visits: dayVisits.slice(), nights: 1, isHub: false });
        dayKm = 0; dayVisits = [];
      }
      var segs = Math.ceil(km / maxDailyKm);
      var segKm = km / segs;
      for (var s = 1; s <= segs; s++) {
        var t = s / segs;
        var subPoint = { lat: prev.lat + (node.lat - prev.lat) * t, lon: prev.lon + (node.lon - prev.lon) * t };
        var isFinalSeg = (s === segs);
        var subVisits = (isFinalSeg && !isLast) ? [node.name] : [];
        var subCity = nearestCity(subPoint, cities);
        days.push({ endPoint: isFinalSeg ? node.name : subCity.name, city: subCity.name, km: segKm, visits: subVisits, nights: (isFinalSeg && isLast) ? 0 : 1, isHub: false });
      }
      continue;
    }

    dayKm += km;
    if (!isLast) dayVisits.push(node.name);
    if (dayKm >= maxDailyKm || isLast) {
      var city = nearestCity(node, cities);
      days.push({ endPoint: node.name, city: city.name, km: dayKm, visits: dayVisits.slice(), nights: isLast ? 0 : 1, isHub: false });
      dayKm = 0; dayVisits = [];
    }
  }
  return days;
}

/**
 * 各選択済み経由地を「その地点を経路から抜いた場合に減る距離(=挿入コスト)」の
 * 降順で並べる。日程短縮の際、迂回コストが大きい(=わりに合わない)経由地から
 * 削る候補として提示するために使う。
 */
function rankRemovalCandidates(ordered) {
  var mid = ordered.slice(1, -1);
  return mid.map(function(p, idx) {
    var prev = ordered[idx], next = ordered[idx + 2];
    var cost = haversineKm(prev.lat, prev.lon, p.lat, p.lon) + haversineKm(p.lat, p.lon, next.lat, next.lon) - haversineKm(prev.lat, prev.lon, next.lat, next.lon);
    return { name: p.name, cost: cost };
  }).sort(function(a, b) { return b.cost - a.cost; });
}

/**
 * start→endの経路(選択済み地点)から、必要な宿泊数の合計だけを求める。
 * 出発地別プラン分布(全目的地との比較)や、既定プランとの余裕比較で使う軽量版。
 */
function computePlanNights(start, end, selectedPoints, hubRadiusKm, maxDailyKm) {
  var ordered = cheapestInsertionOrder(start, end, selectedPoints);
  var clusters = detectHubClusters(ordered, hubRadiusKm);
  var days = planOvernights(start, end, ordered, clusters, CITY_POINTS, maxDailyKm);
  return days.reduce(function(s, d) { return s + d.nights; }, 0);
}

/**
 * 指定した出発地startから、他の全都市を目的地とみなした場合の既定プラン
 * (迂回20km以内の世界遺産を全て含む)の必要泊数を都市ごとに算出する。
 * 迂回許容距離(opt-detour)には依存せず、常に20km以内の既定候補で計算する
 * (この分布は「候補の広さ」ではなく「既定プランでの負担」を横比較するためのもの)。
 */
function computeDestinationNightsDistribution(start, hubRadiusKm, maxDailyKm) {
  return CITIES.filter(function(c) { return c.label !== start.name; }).map(function(c) {
    var end = { name: c.label, lat: c.lat, lon: c.lon };
    var candidates = buildCandidates(start, end, HERITAGE_POINTS, 300).filter(function(x) { return x.detour <= 20; });
    var nights = computePlanNights(start, end, candidates, hubRadiusKm, maxDailyKm);
    return { city: c.label, cityName: c.name, nights: nights };
  });
}

var NIGHTS_BUCKETS = [
  { label: '日帰り圏(0泊)', min: 0, max: 0 },
  { label: '1泊2日', min: 1, max: 1 },
  { label: '2泊3日', min: 2, max: 2 },
  { label: '3泊4日', min: 3, max: 3 },
  { label: '4泊5日', min: 4, max: 4 },
  { label: '5泊以上', min: 5, max: Infinity },
];

function bucketByNights(distribution) {
  return NIGHTS_BUCKETS.map(function(b) {
    return { label: b.label, cities: distribution.filter(function(d) { return d.nights >= b.min && d.nights <= b.max; }) };
  });
}

var esc = function(s) { return String(s||'').replace(/[&<>"']/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); };

var state = { selected: {} };

function populateCitySelects() {
  var startSel = document.getElementById('start-city');
  var endSel = document.getElementById('end-city');
  var opts = CITIES.map(function(c) { return '<option value="' + esc(c.name) + '">' + esc(c.label) + '</option>'; }).join('');
  startSel.innerHTML = opts;
  endSel.innerHTML = opts;
  startSel.value = 'Paris';
  endSel.value = 'Rome';
}

function getCity(name) { return CITIES.filter(function(c){return c.name===name;})[0]; }

function currentStartEnd() {
  var s = getCity(document.getElementById('start-city').value);
  var e = getCity(document.getElementById('end-city').value);
  return {
    start: { name: s.label, lat: s.lat, lon: s.lon },
    end: { name: e.label, lat: e.lat, lon: e.lon },
  };
}

function renderCandidates() {
  var se = currentStartEnd();
  var maxDetour = Number(document.getElementById('opt-detour').value) || 150;
  var candidates = buildCandidates(se.start, se.end, HERITAGE_POINTS, maxDetour);
  var listEl = document.getElementById('cand-list');
  if (!candidates.length) {
    listEl.innerHTML = '<div class="empty-note">この2都市間・この迂回許容距離では候補がありません。</div>';
    document.getElementById('cand-count').textContent = '';
    return candidates;
  }
  listEl.innerHTML = candidates.map(function(c) {
    var checked = state.selected[c.name] !== undefined ? state.selected[c.name] : (c.detour <= 20);
    state.selected[c.name] = checked;
    return '<label class="cand-row"><input type="checkbox" data-cand="' + esc(c.name) + '"' + (checked ? ' checked' : '') + '>' +
      '<span class="cname">' + esc(c.icon) + ' ' + esc(c.name) + '</span><span class="cdetour">迂回 ' + c.detour.toFixed(1) + 'km</span></label>';
  }).join('');
  document.getElementById('cand-count').textContent = candidates.length + ' 件中 ' + candidates.filter(function(c){return state.selected[c.name];}).length + ' 件選択中';
  listEl.querySelectorAll('[data-cand]').forEach(function(cb) {
    cb.addEventListener('change', function() { state.selected[cb.getAttribute('data-cand')] = cb.checked; recompute(); });
  });
  return candidates;
}

function renderSummary(stats) {
  var grid = document.getElementById('summary-grid');
  function stat(label, value, isLoss) {
    return '<div class="stat' + (isLoss ? ' loss' : '') + '"><div class="label">' + esc(label) + '</div><div class="value">' + value + '</div></div>';
  }
  grid.innerHTML =
    stat('経由地数', stats.stopCount + ' 件') +
    stat('直行距離', stats.directKm.toFixed(0) + ' km') +
    stat('総合距離', stats.totalKm.toFixed(0) + ' km') +
    stat('距離ロス', '+' + stats.extraKm.toFixed(0) + ' km (' + stats.extraPct.toFixed(0) + '%)', true) +
    stat('追加移動時間', stats.extraHours.toFixed(1) + ' h', true) +
    stat('見学時間(合計)', stats.visitHours.toFixed(1) + ' h', true) +
    stat('時間ロス合計', stats.totalAddedHours.toFixed(1) + ' h', true);
}

function renderNightsDistribution() {
  var se = currentStartEnd();
  var hubRadiusKm = Number(document.getElementById('opt-hub').value) || 45;
  var maxDailyKm = Number(document.getElementById('opt-daily').value) || 350;
  var distribution = computeDestinationNightsDistribution(se.start, hubRadiusKm, maxDailyKm);
  var buckets = bucketByNights(distribution);
  var maxCount = 1;
  buckets.forEach(function(b) { if (b.cities.length > maxCount) maxCount = b.cities.length; });
  var el = document.getElementById('nights-dist');
  el.innerHTML = buckets.map(function(b, i) {
    var pct = (b.cities.length / maxCount * 100);
    return '<div class="dist-row" data-bucket="' + i + '">' +
      '<span class="dist-label">' + esc(b.label) + '</span>' +
      '<div class="dist-bar-track"><div class="dist-bar" style="width:' + pct + '%"></div></div>' +
      '<span class="dist-count">' + b.cities.length + '件</span>' +
      '</div><div class="dist-cities" id="dist-cities-' + i + '" style="display:none"></div>';
  }).join('');
  el.querySelectorAll('.dist-row').forEach(function(row) {
    row.addEventListener('click', function() {
      var idx = Number(row.getAttribute('data-bucket'));
      var citiesEl = document.getElementById('dist-cities-' + idx);
      var willOpen = citiesEl.style.display === 'none';
      el.querySelectorAll('.dist-cities').forEach(function(c) { c.style.display = 'none'; });
      if (!willOpen) return;
      citiesEl.style.display = 'flex';
      var bucketCities = buckets[idx].cities.slice().sort(function(a, b2) { return a.nights - b2.nights; });
      citiesEl.innerHTML = bucketCities.length
        ? bucketCities.map(function(d) {
            return '<button type="button" class="dist-city-chip" data-city="' + esc(d.cityName) + '">' + esc(d.city) + '(' + d.nights + '泊)</button>';
          }).join('')
        : '<span class="empty-note">該当する目的地はありません。</span>';
      citiesEl.querySelectorAll('[data-city]').forEach(function(chip) {
        chip.addEventListener('click', function() {
          document.getElementById('end-city').value = chip.getAttribute('data-city');
          state.selected = {};
          renderCandidates();
          recompute();
          var summaryEl = document.getElementById('summary-grid');
          if (summaryEl && summaryEl.scrollIntoView) summaryEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    });
  });
}

function renderSlackNote(se, currentNights, hubRadiusKm, maxDailyKm) {
  var el = document.getElementById('slack-note');
  var defaultCandidates = buildCandidates(se.start, se.end, HERITAGE_POINTS, 300).filter(function(x) { return x.detour <= 20; });
  var defaultNights = computePlanNights(se.start, se.end, defaultCandidates, hubRadiusKm, maxDailyKm);
  if (currentNights < defaultNights) {
    el.innerHTML = '<div class="slack-note">🕒 既定プラン(迂回20km以内をすべて選択)では ' + defaultNights + ' 泊でしたが、現在の選択では ' + currentNights + ' 泊です。'
      + '行かない場所を選んだことで ' + (defaultNights - currentNights) + ' 泊分の時間的な余裕が生まれています。</div>';
  } else {
    el.innerHTML = '';
  }
}

function renderRouteLine(ordered) {
  document.getElementById('route-line').innerHTML = ordered.map(function(p) {
    return '<span class="wp-badge">' + esc(p.icon || '📍') + ' ' + esc(p.name) + '</span>';
  }).join('<span class="wp-arrow">→</span>');
}

function renderDayPlan(ordered, days, availableNights) {
  var el = document.getElementById('day-plan');
  if (!days.length) { el.innerHTML = '<div class="empty-note">ルートがありません。</div>'; return; }
  var rows = days.map(function(d, i) {
    var nightsLabel = d.nights > 0 ? (d.nights + '泊') : '(到着)';
    return '<tr><td>Day ' + (i+1) + '</td><td>' + esc(d.city) + (d.isHub ? ' <span style="color:#93c5fd">(拠点)</span>' : '') + '</td>' +
      '<td>' + d.km.toFixed(0) + ' km</td><td>' + nightsLabel + '</td><td>' + esc(d.visits.join('、') || '-') + '</td></tr>';
  }).join('');
  var html = '<table class="day-table"><thead><tr><th>日程</th><th>宿泊推奨地</th><th>その日の移動距離</th><th>宿泊数</th><th>訪問した経由地</th></tr></thead><tbody>' + rows + '</tbody></table>';

  var hubDays = days.filter(function(d){return d.isHub;});
  if (hubDays.length) {
    html += hubDays.map(function(d) {
      return '<div class="hub-note">🏨 ' + esc(d.city) + 'に' + d.nights + '泊し、日帰りで「' + esc(d.visits.join('・')) + '」を周遊することを推奨します(連泊のほうが移動が少なく効率的です)。</div>';
    }).join('');
  }

  var totalNights = days.reduce(function(s,d){return s+d.nights;}, 0);
  if (availableNights != null && availableNights >= 0 && totalNights > availableNights) {
    var over = totalNights - availableNights;
    var ranked = rankRemovalCandidates(ordered);
    var suggestion = ranked.slice(0, Math.max(1, over * 2));
    html += '<div class="trim-box">現在の日程では ' + totalNights + ' 泊必要ですが、指定の宿泊数(' + availableNights + '泊)を ' + over + ' 泊超えています。' +
      '迂回コストが大きい(訪問効率が悪い)経由地から外すことをご検討ください:<ul>' +
      suggestion.map(function(s){return '<li>' + esc(s.name) + '(この地点だけで約' + s.cost.toFixed(0) + 'km余分)</li>';}).join('') +
      '</ul><button id="apply-trim-btn" type="button">上位候補を選択解除して再計算</button></div>';
  }

  el.innerHTML = html;
  var applyBtn = document.getElementById('apply-trim-btn');
  if (applyBtn) {
    applyBtn.addEventListener('click', function() {
      var ranked = rankRemovalCandidates(ordered);
      var totalNightsNow = days.reduce(function(s,d){return s+d.nights;}, 0);
      var overNow = totalNightsNow - availableNights;
      ranked.slice(0, Math.max(1, overNow * 2)).forEach(function(s) { state.selected[s.name] = false; });
      renderCandidates();
      recompute();
    });
  }
}

function recompute() {
  var se = currentStartEnd();
  var maxDetour = Number(document.getElementById('opt-detour').value) || 150;
  var speedKmh = Number(document.getElementById('opt-speed').value) || 70;
  var perSiteHours = Number(document.getElementById('opt-visit').value) || 0;
  var maxDailyKm = Number(document.getElementById('opt-daily').value) || 350;
  var hubRadiusKm = Number(document.getElementById('opt-hub').value) || 45;
  var nightsRaw = document.getElementById('opt-nights').value;
  var availableNights = nightsRaw === '' ? null : Number(nightsRaw);

  var candidates = buildCandidates(se.start, se.end, HERITAGE_POINTS, maxDetour);
  var selected = candidates.filter(function(c) { return state.selected[c.name]; });
  var ordered = cheapestInsertionOrder(se.start, se.end, selected);
  var stats = computeStats(se.start, se.end, ordered, speedKmh, perSiteHours);
  renderSummary(stats);
  renderRouteLine(ordered);
  var clusters = detectHubClusters(ordered, hubRadiusKm);
  var days = planOvernights(se.start, se.end, ordered, clusters, CITY_POINTS, maxDailyKm);
  renderDayPlan(ordered, days, availableNights);
  var currentNights = days.reduce(function(s, d) { return s + d.nights; }, 0);
  renderSlackNote(se, currentNights, hubRadiusKm, maxDailyKm);
  var countEl = document.getElementById('cand-count');
  if (countEl) countEl.textContent = candidates.length + ' 件中 ' + selected.length + ' 件選択中';
}

document.getElementById('select-all-btn').addEventListener('click', function() {
  var se = currentStartEnd();
  var maxDetour = Number(document.getElementById('opt-detour').value) || 150;
  buildCandidates(se.start, se.end, HERITAGE_POINTS, maxDetour).forEach(function(c) { state.selected[c.name] = true; });
  renderCandidates(); recompute();
});
document.getElementById('select-none-btn').addEventListener('click', function() {
  var se = currentStartEnd();
  var maxDetour = Number(document.getElementById('opt-detour').value) || 150;
  buildCandidates(se.start, se.end, HERITAGE_POINTS, maxDetour).forEach(function(c) { state.selected[c.name] = false; });
  renderCandidates(); recompute();
});
document.getElementById('select-near-btn').addEventListener('click', function() {
  var se = currentStartEnd();
  var maxDetour = Number(document.getElementById('opt-detour').value) || 150;
  buildCandidates(se.start, se.end, HERITAGE_POINTS, maxDetour).forEach(function(c) { state.selected[c.name] = c.detour <= 20; });
  renderCandidates(); recompute();
});
document.getElementById('swap-btn').addEventListener('click', function() {
  var s = document.getElementById('start-city'), e = document.getElementById('end-city');
  var tmp = s.value; s.value = e.value; e.value = tmp;
  state.selected = {};
  renderCandidates(); recompute(); renderNightsDistribution();
});
document.getElementById('start-city').addEventListener('change', function() {
  state.selected = {}; renderCandidates(); recompute(); renderNightsDistribution();
});
document.getElementById('end-city').addEventListener('change', function() {
  state.selected = {}; renderCandidates(); recompute();
});
['opt-detour','opt-speed','opt-visit','opt-nights'].forEach(function(id) {
  document.getElementById(id).addEventListener('input', function() { renderCandidates(); recompute(); });
});
['opt-daily','opt-hub'].forEach(function(id) {
  document.getElementById(id).addEventListener('input', function() { renderCandidates(); recompute(); renderNightsDistribution(); });
});

populateCitySelects();
renderCandidates();
recompute();
renderNightsDistribution();
</script>
</body>
</html>`;
}
