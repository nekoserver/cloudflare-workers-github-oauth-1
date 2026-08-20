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
.route-title-row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
#replay-tour-btn,#tour-test-btn{background:#1e293b;border:1px solid #475569;color:#cbd5e1;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;font-family:inherit;white-space:nowrap}
#replay-tour-btn:hover,#tour-test-btn:hover{border-color:#38bdf8;color:#fff}
#replay-tour-btn:disabled,#tour-test-btn:disabled{opacity:.5;cursor:default}
.tour-modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;align-items:center;justify-content:center;padding:16px}
.tour-modal-overlay.open{display:flex}
.tour-modal-box{background:#111827;border:1px solid #334155;border-radius:12px;padding:16px;max-width:560px;width:100%;max-height:90vh;overflow:auto}
.tour-modal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.tour-modal-title{font-size:14px;font-weight:700;color:#93c5fd}
.tour-modal-close{background:none;border:none;color:#94a3b8;font-size:16px;cursor:pointer;padding:2px 6px}
.tour-modal-close:hover{color:#e2e8f0}
#tour-globe-canvas{width:100%;max-width:520px;aspect-ratio:1/1;display:block;margin:0 auto;background:#0b1220;border-radius:50%;border:1px solid #1e293b}
.tour-modal-controls{display:flex;align-items:center;gap:10px;margin-top:12px}
#tour-play-btn{background:#1e293b;border:1px solid #475569;color:#cbd5e1;border-radius:8px;padding:6px 14px;font-size:12px;cursor:pointer;font-family:inherit}
#tour-play-btn:hover{border-color:#38bdf8;color:#fff}
.tour-modal-label{font-size:12px;color:#94a3b8}
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
.duration-label{font-size:12px;font-weight:400;color:#5eead4}
.visit-chip{display:inline-block;background:#1e293b;border:1px solid #475569;color:#cbd5e1;border-radius:999px;padding:2px 9px;font-size:11px;cursor:pointer;font-family:inherit;margin:2px 4px 2px 0}
.visit-chip:hover{border-color:#38bdf8;color:#fff}
.visit-chip.off{background:#374151;border-color:#374151;color:#9ca3af;text-decoration:line-through}
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
    <div class="route-title-row"><div class="section-title" style="margin:0">ルート順序</div><div style="display:flex;gap:8px;"><button id="tour-test-btn" type="button">🌐 巡回テスト</button><button id="replay-tour-btn" type="button">🎬 巡回ルートを再現する</button></div></div>
    <div class="route-line" id="route-line"></div>
  </div>

  <div class="card">
    <div class="section-title">宿泊地の推奨プラン <span id="day-plan-duration" class="duration-label"></span></div>
    <div id="day-plan"></div>
  </div>
</div>

<div class="tour-modal-overlay" id="tour-modal-overlay">
  <div class="tour-modal-box">
    <div class="tour-modal-head">
      <div class="tour-modal-title">🌐 巡回テスト</div>
      <button type="button" class="tour-modal-close" id="tour-modal-close" aria-label="閉じる">✕</button>
    </div>
    <canvas id="tour-globe-canvas" width="520" height="520"></canvas>
    <div class="tour-modal-controls">
      <button type="button" id="tour-play-btn">▶ 再生</button>
      <span class="tour-modal-label" id="tour-current-label"></span>
    </div>
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

function visitChipHtml(name) {
  var on = state.selected[name] !== false;
  return '<button type="button" class="visit-chip' + (on ? '' : ' off') + '" data-visit="' + esc(name) + '">' + esc(name) + '</button>';
}

function renderDayPlan(ordered, days, availableNights) {
  var el = document.getElementById('day-plan');
  var durationEl = document.getElementById('day-plan-duration');
  if (!days.length) {
    el.innerHTML = '<div class="empty-note">ルートがありません。</div>';
    if (durationEl) durationEl.textContent = '';
    return;
  }
  var totalNights = days.reduce(function(s,d){return s+d.nights;}, 0);
  if (durationEl) durationEl.textContent = '(' + totalNights + '泊' + (totalNights + 1) + '日)';

  var rows = days.map(function(d, i) {
    var nightsLabel = d.nights > 0 ? (d.nights + '泊') : '(到着)';
    var visitsHtml = d.visits.length ? d.visits.map(visitChipHtml).join('') : '-';
    return '<tr><td>Day ' + (i+1) + '</td><td>' + esc(d.city) + (d.isHub ? ' <span style="color:#93c5fd">(拠点)</span>' : '') + '</td>' +
      '<td>' + d.km.toFixed(0) + ' km</td><td>' + nightsLabel + '</td><td>' + visitsHtml + '</td></tr>';
  }).join('');
  var html = '<table class="day-table"><thead><tr><th>日程</th><th>宿泊推奨地</th><th>その日の移動距離</th><th>宿泊数</th><th>訪問した経由地</th></tr></thead><tbody>' + rows + '</tbody></table>';

  var hubDays = days.filter(function(d){return d.isHub;});
  if (hubDays.length) {
    html += hubDays.map(function(d) {
      return '<div class="hub-note">🏨 ' + esc(d.city) + 'に' + d.nights + '泊し、日帰りで「' + esc(d.visits.join('・')) + '」を周遊することを推奨します(連泊のほうが移動が少なく効率的です)。</div>';
    }).join('');
  }

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
  el.querySelectorAll('.visit-chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      var name = chip.getAttribute('data-visit');
      var currentOn = state.selected[name] !== false;
      var nextOn = !currentOn;
      state.selected[name] = nextOn;
      chip.classList.toggle('off', !nextOn);
      renderCandidates();
      recompute();
    });
  });
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
  state.lastOrdered = ordered;
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
document.getElementById('replay-tour-btn').addEventListener('click', function() {
  var ordered = state.lastOrdered || [];
  if (ordered.length < 2) return;
  var payload = { points: ordered.map(function(p) { return { name: p.name, lat: p.lat, lon: p.lon }; }) };
  try {
    sessionStorage.setItem('heritageJourneyTour', JSON.stringify(payload));
  } catch (e) {
    return;
  }
  window.location.href = '/webgl-heritage';
});

/**
 * 「巡回テスト」モーダル: WebGLの本格的な地球儀(webgl-heritage)を使わず、
 * 必要な行き先の座標だけをcanvas上の簡易な正射影(orthographic)地球儀に
 * プロットし、モーダル内で出発点から目的地まで巡回できるようにする軽量版。
 * 別ページへ遷移せず、モーダルの中だけで完結する。
 */
(function() {
  var overlay = document.getElementById('tour-modal-overlay');
  var closeBtn = document.getElementById('tour-modal-close');
  var canvas = document.getElementById('tour-globe-canvas');
  var playBtn = document.getElementById('tour-play-btn');
  var currentLabel = document.getElementById('tour-current-label');
  var tourTestBtn = document.getElementById('tour-test-btn');

  var tourPoints = [];
  var animProgress = 0; // 0..(tourPoints.length-1) の連続値。整数部=区間番号、小数部=区間内の進み具合
  var animTimer = null;
  var playing = false;
  var tourZoom = 1;
  var tourCenterLat = 0;
  var tourCenterLon = 0;
  var ZOOM_MIN = 0.5, ZOOM_MAX = 16;
  var pinchDist0 = 0;

  // ===== 地表テクスチャ(webgl-heritageページと同じ/earth.jpgを流用) =====
  var earthImg = new Image();
  var earthImageData = null; // { data: Uint8ClampedArray, width, height } 相当
  var sphereCache = null;    // 直前に描画したImageData(zoom/中心が変わらない限り再利用)
  var sphereCacheKey = '';
  earthImg.onload = function() {
    var off = document.createElement('canvas');
    off.width = earthImg.naturalWidth || earthImg.width;
    off.height = earthImg.naturalHeight || earthImg.height;
    var offCtx = off.getContext && off.getContext('2d');
    if (!offCtx) return;
    offCtx.drawImage(earthImg, 0, 0);
    earthImageData = offCtx.getImageData(0, 0, off.width, off.height);
    sphereCache = null;
    if (overlay.classList.contains('open')) drawGlobe();
  };
  earthImg.src = '/earth.jpg';

  /**
   * 中心座標(centerLat, centerLon)を正面に見た正射影投影。中心を出発点と
   * 目的地の中間座標に合わせることで、緯度方向もその中間点が画面中央に
   * 来るように球を回転させる(経度回転だけの単純な投影だと、中間点の緯度が
   * 高い/低い場合に中心からずれてしまうため)。
   */
  function project(lat, lon, centerLat, centerLon, R, cx, cy) {
    var latR = lat * Math.PI / 180;
    var lonR = (lon - centerLon) * Math.PI / 180;
    var lat0 = centerLat * Math.PI / 180;
    var x = R * Math.cos(latR) * Math.sin(lonR);
    var y = -R * (Math.cos(lat0) * Math.sin(latR) - Math.sin(lat0) * Math.cos(latR) * Math.cos(lonR));
    var z = Math.sin(lat0) * Math.sin(latR) + Math.cos(lat0) * Math.cos(latR) * Math.cos(lonR);
    return { x: cx + x, y: cy + y, visible: z > -0.05 };
  }

  function circularMeanLon(lonA, lonB) {
    var a = lonA * Math.PI / 180, b = lonB * Math.PI / 180;
    return Math.atan2((Math.sin(a) + Math.sin(b)) / 2, (Math.cos(a) + Math.cos(b)) / 2) * 180 / Math.PI;
  }

  /**
   * 出発点と目的地の中間座標を地球儀の中心にし、その2点がなるべく
   * モーダルの外側(円の縁)に近い位置に収まるズームレベルを自動算出する。
   */
  function computeInitialView(points, baseR) {
    var start = points[0], end = points[points.length - 1];
    var centerLat = (start.lat + end.lat) / 2;
    var centerLon = circularMeanLon(start.lon, end.lon);
    var pStart = project(start.lat, start.lon, centerLat, centerLon, baseR, 0, 0);
    var pEnd = project(end.lat, end.lon, centerLat, centerLon, baseR, 0, 0);
    var maxDist = Math.max(Math.hypot(pStart.x, pStart.y), Math.hypot(pEnd.x, pEnd.y));
    var MARGIN = 0.97;
    var zoom = maxDist > 0.01 ? (baseR * MARGIN) / maxDist : 1;
    zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));
    return { centerLat: centerLat, centerLon: centerLon, zoom: zoom };
  }

  /**
   * project()の逆変換(標準的な正射影投影の逆変換式、Snyderの地図投影公式)。
   * 画面上の1点(中心からの相対座標X,Y、半径1に正規化済み)から緯度経度を
   * 復元する。裏側(可視範囲外)ならnullを返す。
   */
  function unproject(X, Y, centerLat, centerLon) {
    var rho = Math.sqrt(X * X + Y * Y);
    if (rho > 1) return null;
    var lat0 = centerLat * Math.PI / 180;
    var lon0 = centerLon * Math.PI / 180;
    var c = Math.asin(Math.min(1, rho));
    var lat, lon;
    if (rho < 1e-6) {
      lat = lat0; lon = lon0;
    } else {
      var sinC = Math.sin(c), cosC = Math.cos(c);
      lat = Math.asin(cosC * Math.sin(lat0) + (Y * sinC * Math.cos(lat0)) / rho);
      lon = lon0 + Math.atan2(X * sinC, rho * cosC * Math.cos(lat0) - Y * sinC * Math.sin(lat0));
    }
    return { lat: lat * 180 / Math.PI, lon: lon * 180 / Math.PI };
  }

  /**
   * 球体表面に地表テクスチャ(/earth.jpg、webgl-heritageページと共通)を
   * ピクセル単位で貼り付ける(canvas 2Dにはメッシュ/UVマッピングが無いため、
   * 画面側の各ピクセルから緯度経度を逆算しテクスチャをサンプリングする
   * ソフトウェアレンダリング)。zoom/中心座標が変わらない限り結果を
   * キャッシュし、巡回アニメーション中の再描画では使い回す。
   */
  function renderSphereTexture(ctx, cx, cy, R) {
    var key = tourCenterLat + '|' + tourCenterLon + '|' + R;
    if (sphereCache && sphereCacheKey === key) {
      ctx.putImageData(sphereCache, 0, 0);
      return;
    }
    var W = canvas.width, H = canvas.height;
    var out = ctx.createImageData(W, H);
    var src = earthImageData;
    var sw = src.width, sh = src.height;
    var x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(W, Math.ceil(cx + R));
    var y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(H, Math.ceil(cy + R));
    for (var py = y0; py < y1; py++) {
      for (var px = x0; px < x1; px++) {
        var X = (px - cx) / R;
        var Y = -(py - cy) / R;
        var ll = unproject(X, Y, tourCenterLat, tourCenterLon);
        if (!ll) continue;
        var u = 0.5 + ll.lon / 360;
        u = u - Math.floor(u);
        var v = Math.max(0, Math.min(1, 0.5 - ll.lat / 180));
        var sx = Math.min(sw - 1, Math.floor(u * sw));
        var sy = Math.min(sh - 1, Math.floor(v * sh));
        var sIdx = (sy * sw + sx) * 4;
        var dIdx = (py * W + px) * 4;
        out.data[dIdx] = src.data[sIdx];
        out.data[dIdx + 1] = src.data[sIdx + 1];
        out.data[dIdx + 2] = src.data[sIdx + 2];
        out.data[dIdx + 3] = 255;
      }
    }
    sphereCache = out;
    sphereCacheKey = key;
    ctx.putImageData(out, 0, 0);
  }

  function pointAtProgress(points, progress) {
    var clamped = Math.max(0, Math.min(points.length - 1, progress));
    var idx = Math.floor(clamped);
    var frac = clamped - idx;
    if (idx >= points.length - 1) return points[points.length - 1];
    var a = points[idx], b = points[idx + 1];
    return { lat: a.lat + (b.lat - a.lat) * frac, lon: a.lon + (b.lon - a.lon) * frac };
  }

  function drawGlobe() {
    if (!canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    if (tourPoints.length === 0) return;
    var cx = W / 2, cy = H / 2;
    var baseR = Math.min(W, H) / 2 - 24;
    var R = baseR * tourZoom;

    if (earthImageData) {
      // 地表テクスチャを球面に貼り付ける
      renderSphereTexture(ctx, cx, cy, R);
      ctx.strokeStyle = '#0b1220';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // テクスチャ読み込み中の暫定表示: 球体の輪郭と簡易緯線グリッド
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      [-60, -30, 0, 30, 60].forEach(function(lat) {
        var latR = (lat - tourCenterLat) * Math.PI / 180;
        var ellipseY = cy - R * Math.sin(latR);
        var ellipseRx = R * Math.cos(latR);
        ctx.beginPath();
        ctx.ellipse(cx, ellipseY, Math.max(ellipseRx, 0.01), Math.max(ellipseRx * 0.15, 0.01), 0, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
    }

    var projected = tourPoints.map(function(p) { return project(p.lat, p.lon, tourCenterLat, tourCenterLon, R, cx, cy); });

    // 経由地を結ぶルート線
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    projected.forEach(function(pp, i) { if (i === 0) ctx.moveTo(pp.x, pp.y); else ctx.lineTo(pp.x, pp.y); });
    ctx.stroke();

    // 経由地点
    projected.forEach(function(pp, i) {
      ctx.fillStyle = pp.visible ? '#f59e0b' : '#475569';
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pp.visible ? '#e2e8f0' : '#64748b';
      ctx.font = '10px sans-serif';
      ctx.fillText(String(i + 1), pp.x + 7, pp.y - 7);
    });

    // 巡回中の現在位置マーカー
    var curPt = pointAtProgress(tourPoints, animProgress);
    var curProj = project(curPt.lat, curPt.lon, tourCenterLat, tourCenterLon, R, cx, cy);
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(curProj.x, curProj.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function nearestPointIndex(progress) {
    return Math.round(Math.max(0, Math.min(tourPoints.length - 1, progress)));
  }

  function updateLabel() {
    var idx = nearestPointIndex(animProgress);
    var p = tourPoints[idx];
    if (!p) { currentLabel.textContent = ''; return; }
    currentLabel.textContent = (idx + 1) + ' / ' + tourPoints.length + '　' + p.name;
  }

  function stopAnim() {
    playing = false;
    if (animTimer) { clearInterval(animTimer); animTimer = null; }
    playBtn.textContent = '▶ 再生';
  }

  function startAnim() {
    if (tourPoints.length < 2) return;
    if (animProgress >= tourPoints.length - 1) animProgress = 0;
    playing = true;
    playBtn.textContent = '⏸ 一時停止';
    var STEP = 0.02;
    animTimer = setInterval(function() {
      animProgress += STEP;
      if (animProgress >= tourPoints.length - 1) {
        animProgress = tourPoints.length - 1;
        drawGlobe();
        updateLabel();
        stopAnim();
        return;
      }
      drawGlobe();
      updateLabel();
    }, 40);
  }

  playBtn.addEventListener('click', function() {
    if (playing) { stopAnim(); return; }
    startAnim();
  });

  function openTourModal() {
    var ordered = state.lastOrdered || [];
    if (ordered.length < 2) return;
    tourPoints = ordered.map(function(p) { return { name: p.name, lat: p.lat, lon: p.lon }; });
    animProgress = 0;
    stopAnim();
    var baseR = Math.min(canvas.width, canvas.height) / 2 - 24;
    var initial = computeInitialView(tourPoints, baseR);
    tourCenterLat = initial.centerLat;
    tourCenterLon = initial.centerLon;
    tourZoom = initial.zoom;
    drawGlobe();
    updateLabel();
    overlay.classList.add('open');
  }

  function closeTourModal() {
    stopAnim();
    overlay.classList.remove('open');
  }

  tourTestBtn.addEventListener('click', openTourModal);
  closeBtn.addEventListener('click', closeTourModal);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeTourModal(); });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && overlay.classList.contains('open')) closeTourModal(); });

  // ===== ズーム・ピンチイン/ピンチアウト(webgl-heritageページから移植) =====
  canvas.addEventListener('wheel', function(e) {
    e.preventDefault();
    tourZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, tourZoom - e.deltaY * 0.002));
    drawGlobe();
  }, { passive: false });

  canvas.addEventListener('touchstart', function(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      pinchDist0 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', function(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      tourZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, tourZoom + (d - pinchDist0) * 0.008));
      pinchDist0 = d;
      drawGlobe();
    }
  }, { passive: false });
})();
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
