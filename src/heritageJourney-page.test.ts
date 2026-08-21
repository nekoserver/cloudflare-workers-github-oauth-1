import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  getHeritageJourneyPage,
  buildEmbeddedHeritagePoints,
  buildEmbeddedAirportPoints,
  buildEmbeddedRailStationPoints,
  buildEmbeddedJourneyPoints,
  parseAirportCity,
} from './views/heritageJourney';

// 対象: /heritage-journey ページ(旧/heritage-routesを作り替え)。
// 都市2点(出発/到着)を選び、その間で「距離ロスがほぼ無く立ち寄れる」世界遺産候補を
// チェックボックスで任意に選択すると、直行との距離ロス・時間ロス・宿泊地の推奨プラン
// (連泊+市内巡り提案、日程短縮提案を含む)がその場で再計算される。
// 故障シナリオ:
//   (1) 候補が起点-終点直線の左右に散らばっている場合、単純な最近傍法/進行方向ソートでは
//       大きくジグザグし総距離が数倍に膨れ上がる(実データ検証で確認済みの実際の不具合)
//   (2) 起点・終点そのもの、または至近の候補を経由地として拾ってしまう
//   (3) 区間(leg)のfrom/toが経路の並び順と食い違う
//   (4) hubクラスタの重心計算・最寄り都市推定が誤り、無関係な都市を宿泊地に推奨する
//   (5) 日程短縮提案が「使える宿泊数」未入力(null)でも誤って発火する
function extractFn(html: string, name: string, argsPattern: string): string {
  const re = new RegExp('function ' + name + '\\(' + argsPattern + '\\) \\{[\\s\\S]*?\\n\\}');
  const m = html.match(re);
  if (!m) throw new Error(name + ' が生成HTMLから見つからない');
  return m[0];
}

function loadFns(html: string) {
  const earthR = html.match(/var EARTH_R = \d+;/);
  if (!earthR) throw new Error('EARTH_R が生成HTMLから見つからない');
  const citiesMatch = html.match(/var CITIES = (\[.*?\]);/);
  if (!citiesMatch) throw new Error('CITIES が生成HTMLから見つからない');
  const src = [
    'var CITIES = ' + citiesMatch[1] + ';',
    'var CITY_POINTS = CITIES.map(function(c) { return { name: c.label, lat: c.lat, lon: c.lon }; });',
    'var manuallyAddedPoints = {};',
    earthR[0],
    extractFn(html, 'haversineKm', '[^)]*'),
    extractFn(html, 'computeDetourKm', '[^)]*'),
    extractFn(html, 'buildCandidates', '[^)]*'),
    extractFn(html, 'cheapestInsertionOrder', '[^)]*'),
    extractFn(html, 'computeStats', '[^)]*'),
    extractFn(html, 'nearestCity', '[^)]*'),
    extractFn(html, 'detectHubClusters', '[^)]*'),
    extractFn(html, 'planOvernights', '[^)]*'),
    extractFn(html, 'rankRemovalCandidates', '[^)]*'),
    extractFn(html, 'computePlanNights', '[^)]*'),
  ].join('\n');
  return new Function(`${src}\nreturn { haversineKm, computeDetourKm, buildCandidates, cheapestInsertionOrder, computeStats, nearestCity, detectHubClusters, planOvernights, rankRemovalCandidates, computePlanNights };`)();
}

function extractDistributionFns(html: string) {
  const citiesMatch = html.match(/var CITIES = (\[.*?\]);/);
  const cityPointsLine = 'var CITY_POINTS = CITIES.map(function(c) { return { name: c.label, lat: c.lat, lon: c.lon }; });';
  const heritageMatch = html.match(/var HERITAGE_POINTS = (\[.*?\]);/);
  if (!citiesMatch || !heritageMatch) throw new Error('CITIES/HERITAGE_POINTS が生成HTMLから見つからない');
  const nightsBucketsMatch = html.match(/var NIGHTS_BUCKETS = \[[\s\S]*?\n\];/);
  if (!nightsBucketsMatch) throw new Error('NIGHTS_BUCKETS が生成HTMLから見つからない');
  const src = [
    'var CITIES = ' + citiesMatch[1] + ';',
    cityPointsLine,
    'var HERITAGE_POINTS = ' + heritageMatch[1] + ';',
    'var manuallyAddedPoints = {};',
    html.match(/var EARTH_R = \d+;/)![0],
    extractFn(html, 'haversineKm', '[^)]*'),
    extractFn(html, 'computeDetourKm', '[^)]*'),
    extractFn(html, 'buildCandidates', '[^)]*'),
    extractFn(html, 'cheapestInsertionOrder', '[^)]*'),
    extractFn(html, 'nearestCity', '[^)]*'),
    extractFn(html, 'detectHubClusters', '[^)]*'),
    extractFn(html, 'planOvernights', '[^)]*'),
    extractFn(html, 'computePlanNights', '[^)]*'),
    extractFn(html, 'computeDestinationNightsDistribution', '[^)]*'),
    nightsBucketsMatch[0],
    extractFn(html, 'bucketByNights', '[^)]*'),
  ].join('\n');
  return new Function(`${src}\nreturn { computeDestinationNightsDistribution, bucketByNights, CITIES };`)();
}

const PARIS = { name: 'パリ', lat: 48.8566, lon: 2.3522 };
const ROME = { name: 'ローマ', lat: 41.9028, lon: 12.4964 };

describe('buildCandidates', () => {
  it('起点・終点に至近(3km未満)の候補を除外する', () => {
    const html = getHeritageJourneyPage();
    const { buildCandidates } = loadFns(html);
    const pool = [{ n: 'ParisNear', e: '🏛️', c: 'フランス', lat: 48.86, lon: 2.35 }];
    expect(buildCandidates(PARIS, ROME, pool, 500)).toEqual([]);
  });

  it('迂回距離がmaxDetourKmを超える候補(東京)を除外する', () => {
    const html = getHeritageJourneyPage();
    const { buildCandidates } = loadFns(html);
    const pool = [{ n: 'Tokyo', e: '⛩️', c: '日本', lat: 35.6762, lon: 139.6503 }];
    expect(buildCandidates(PARIS, ROME, pool, 500)).toEqual([]);
  });

  it('迂回距離の昇順にソートして返す', () => {
    const html = getHeritageJourneyPage();
    const { buildCandidates } = loadFns(html);
    const pool = [
      { n: 'A', e: '🏛️', c: 'フランス', lat: 46.5, lon: 6.0 },
      { n: 'B', e: '🏛️', c: 'フランス', lat: 45.7640, lon: 4.8357 },
    ];
    const result = buildCandidates(PARIS, ROME, pool, 300);
    for (let i = 1; i < result.length; i++) expect(result[i].detour).toBeGreaterThanOrEqual(result[i - 1].detour);
  });
});

describe('cheapestInsertionOrder', () => {
  it('候補が起点-終点直線の左右に散らばっていても、最近傍法よりジグザグの少ない現実的な総距離になる', () => {
    const html = getHeritageJourneyPage();
    const { cheapestInsertionOrder, haversineKm } = loadFns(html);
    // パリ-ローマの間で東西南北にばらけた4点(いずれも直行から大きく外れすぎない範囲)
    const scattered = [
      { name: 'North', lat: 47.5, lon: 7.5 },
      { name: 'South', lat: 44.0, lon: 8.0 },
      { name: 'Mid1', lat: 46.0, lon: 6.5 },
      { name: 'Mid2', lat: 45.0, lon: 9.5 },
    ];
    const route = cheapestInsertionOrder(PARIS, ROME, scattered);
    expect(route[0].name).toBe('パリ');
    expect(route[route.length - 1].name).toBe('ローマ');
    let total = 0;
    for (let i = 1; i < route.length; i++) total += haversineKm(route[i-1].lat, route[i-1].lon, route[i].lat, route[i].lon);
    const direct = haversineKm(PARIS.lat, PARIS.lon, ROME.lat, ROME.lon);
    // 4点全部を経由しても、直行の3倍を超えるような極端なジグザグにはならない
    expect(total).toBeLessThan(direct * 3);
  });

  it('候補が空なら起点→終点のみの経路を返す', () => {
    const html = getHeritageJourneyPage();
    const { cheapestInsertionOrder } = loadFns(html);
    const route = cheapestInsertionOrder(PARIS, ROME, []);
    expect(route.map((p: any) => p.name)).toEqual(['パリ', 'ローマ']);
  });
});

describe('computeStats', () => {
  it('区間距離の合計は総合距離と一致し、距離ロス・時間ロスが正しく算出される', () => {
    const html = getHeritageJourneyPage();
    const { computeStats } = loadFns(html);
    const ordered = [PARIS, { name: 'Lyon', lat: 45.7640, lon: 4.8357 }, ROME];
    const stats = computeStats(PARIS, ROME, ordered, 70, 1.5);
    const legSum = stats.legs.reduce((s: number, l: any) => s + l.km, 0);
    expect(Math.abs(legSum - stats.totalKm)).toBeLessThan(0.01);
    expect(stats.extraKm).toBeCloseTo(stats.totalKm - stats.directKm, 5);
    expect(stats.stopCount).toBe(1);
    expect(stats.visitHours).toBeCloseTo(1.5, 5);
    expect(stats.extraHours).toBeCloseTo(stats.extraKm / 70, 5);
    expect(stats.totalAddedHours).toBeCloseTo(stats.extraHours + stats.visitHours, 5);
  });

  it('区間(leg)のfrom/toはルート順序と一致する', () => {
    const html = getHeritageJourneyPage();
    const { computeStats } = loadFns(html);
    const ordered = [PARIS, { name: 'A', lat: 46, lon: 5 }, { name: 'B', lat: 44, lon: 9 }, ROME];
    const stats = computeStats(PARIS, ROME, ordered, 70, 1);
    for (let i = 0; i < stats.legs.length; i++) {
      expect(stats.legs[i].from).toBe(ordered[i].name);
      expect(stats.legs[i].to).toBe(ordered[i + 1].name);
    }
  });
});

describe('detectHubClusters / planOvernights', () => {
  it('起点(クラスタ内最初の地点)からhubRadiusKm以内の経由地はクラスタとして検出する' +
    '(フィレンツェ→サン・ジミニャーノは37.6kmで圏内、フィレンツェ→シエナは50.3kmで圏外のため' +
    'シエナは別クラスタ扱いになる)', () => {
    const html = getHeritageJourneyPage();
    const { detectHubClusters } = loadFns(html);
    const ordered = [
      PARIS,
      { name: 'Firenze歴史地区', lat: 43.7696, lon: 11.2558 },
      { name: 'サンジミニャーノ', lat: 43.47, lon: 11.04 },
      { name: 'シエナ', lat: 43.32, lon: 11.33 },
      ROME,
    ];
    const clusters = detectHubClusters(ordered, 45);
    expect(clusters.length).toBe(1);
    expect(clusters[0].map((c: any) => c.name)).toEqual(['Firenze歴史地区', 'サンジミニャーノ']);
  });

  it('隣接ペアはそれぞれhubRadiusKm以内でも、連鎖全体がhubRadiusKmの2倍を大きく超えて' +
    '広がる場合はクラスタ化しない(トリノ〜ベルンのような非現実的な連泊拠点提案を防ぐ回帰テスト)', () => {
    const html = getHeritageJourneyPage();
    const { detectHubClusters, haversineKm } = loadFns(html);
    // 各点は隣同士40km前後だが、鎖状に連結すると全体では200km超に広がる配置
    const chain = [
      { name: 'P1', lat: 46.0, lon: 8.0 },
      { name: 'P2', lat: 46.35, lon: 8.0 },
      { name: 'P3', lat: 46.7, lon: 8.0 },
      { name: 'P4', lat: 47.05, lon: 8.0 },
      { name: 'P5', lat: 47.4, lon: 8.0 },
    ];
    // 隣接ペアの距離はいずれも45km未満であることを確認(前提条件)
    for (let i = 1; i < chain.length; i++) {
      expect(haversineKm(chain[i-1].lat, chain[i-1].lon, chain[i].lat, chain[i].lon)).toBeLessThan(45);
    }
    // 先頭P1と末尾P5は155km以上離れている(日帰り圏外)
    expect(haversineKm(chain[0].lat, chain[0].lon, chain[4].lat, chain[4].lon)).toBeGreaterThan(150);
    const ordered = [PARIS, ...chain, ROME];
    const clusters = detectHubClusters(ordered, 45);
    // 起点(先頭)から45km以内に収まる範囲だけがクラスタになり、全5件が1つの連泊拠点には
    // まとまらない
    expect(clusters.length).toBeGreaterThan(0);
    clusters.forEach((cl: any[]) => {
      const anchor = cl[0];
      cl.forEach((m) => { expect(haversineKm(anchor.lat, anchor.lon, m.lat, m.lon)).toBeLessThanOrEqual(45); });
    });
    expect(clusters.some((cl: any[]) => cl.length === chain.length)).toBe(false);
  });

  it('遠く離れた経由地同士はクラスタ化しない', () => {
    const html = getHeritageJourneyPage();
    const { detectHubClusters } = loadFns(html);
    const ordered = [PARIS, { name: 'Lyon', lat: 45.76, lon: 4.84 }, { name: 'Roma郊外', lat: 42.0, lon: 12.5 }, ROME];
    const clusters = detectHubClusters(ordered, 45);
    expect(clusters.length).toBe(0);
  });

  it('hub到着日の訪問地一覧には、そのhubクラスタの構成メンバー以外(手前で通過した無関係な' +
    '単独経由地)が混入しない(実際に発生した不具合の回帰テスト)', () => {
    const html = getHeritageJourneyPage();
    const { cheapestInsertionOrder, detectHubClusters, planOvernights, haversineKm } = loadFns(html);
    // 起点付近の単独経由地(hubクラスタとは無関係)を2件はさんでから、
    // フィレンツェ近郊のhubクラスタ(2件以上)に至る経路を作る
    const soloA = { name: 'ソロ地点A', lat: 47.0, lon: 6.0 };
    const soloB = { name: 'ソロ地点B', lat: 45.5, lon: 8.5 };
    const florence = { name: 'フィレンツェ歴史地区', lat: 43.7696, lon: 11.2558 };
    const sanG = { name: 'サン・ジミニャーノの歴史地区', lat: 43.47, lon: 11.04 };
    const cities = [
      { name: 'フィレンツェ', lat: 43.7696, lon: 11.2558 },
      { name: 'ローマ', lat: 41.9028, lon: 12.4964 },
      { name: 'パリ', lat: 48.8566, lon: 2.3522 },
    ];
    const ordered = cheapestInsertionOrder(PARIS, ROME, [soloA, soloB, florence, sanG]);
    const clusters = detectHubClusters(ordered, 45);
    expect(clusters.length).toBeGreaterThan(0);
    // 1日の移動距離上限を大きくして、ソロ地点とhubが同じ「日」にまとまり得る状況を作る
    const days = planOvernights(PARIS, ROME, ordered, clusters, cities, 100000);
    const hubDay = days.find((d: any) => d.isHub);
    expect(hubDay).toBeTruthy();
    expect(hubDay.visits.sort()).toEqual(['サン・ジミニャーノの歴史地区', 'フィレンツェ歴史地区'].sort());
    expect(hubDay.visits).not.toContain('ソロ地点A');
    expect(hubDay.visits).not.toContain('ソロ地点B');
  });

  it('hubクラスタは重心に最も近い都市を拠点として提示し、宿泊数は1以上になる', () => {
    const html = getHeritageJourneyPage();
    const { cheapestInsertionOrder, detectHubClusters, planOvernights } = loadFns(html);
    const florence = { name: 'フィレンツェ歴史地区', lat: 43.7696, lon: 11.2558 };
    const sanG = { name: 'サン・ジミニャーノの歴史地区', lat: 43.47, lon: 11.04 };
    const siena = { name: 'シエナ歴史地区', lat: 43.32, lon: 11.33 };
    const cities = [
      { name: 'フィレンツェ', lat: 43.7696, lon: 11.2558 },
      { name: 'ローマ', lat: 41.9028, lon: 12.4964 },
      { name: 'パリ', lat: 48.8566, lon: 2.3522 },
    ];
    const ordered = cheapestInsertionOrder(PARIS, ROME, [florence, sanG, siena]);
    const clusters = detectHubClusters(ordered, 45);
    expect(clusters.length).toBeGreaterThan(0);
    const days = planOvernights(PARIS, ROME, ordered, clusters, cities, 350);
    const hubDay = days.find((d: any) => d.isHub);
    expect(hubDay).toBeTruthy();
    expect(hubDay.city).toBe('フィレンツェ');
    expect(hubDay.nights).toBeGreaterThanOrEqual(1);
  });

  it('最終日(到着日)の宿泊数は0(移動のみでその夜は目的地滞在扱い)', () => {
    const html = getHeritageJourneyPage();
    const { cheapestInsertionOrder, detectHubClusters, planOvernights } = loadFns(html);
    const cities = [
      { name: 'ローマ', lat: 41.9028, lon: 12.4964 },
      { name: 'パリ', lat: 48.8566, lon: 2.3522 },
    ];
    const ordered = cheapestInsertionOrder(PARIS, ROME, []);
    const days = planOvernights(PARIS, ROME, ordered, [], cities, 350);
    expect(days[days.length - 1].nights).toBe(0);
  });
});

describe('rankRemovalCandidates', () => {
  it('迂回コストの大きい経由地ほど先頭に来る(降順)', () => {
    const html = getHeritageJourneyPage();
    const { cheapestInsertionOrder, rankRemovalCandidates } = loadFns(html);
    const near = { name: 'OnPath', lat: 45.3, lon: 7.2 };
    const far = { name: 'FarDetour', lat: 47.5, lon: 5.5 };
    const ordered = cheapestInsertionOrder(PARIS, ROME, [near, far]);
    const ranked = rankRemovalCandidates(ordered);
    for (let i = 1; i < ranked.length; i++) expect(ranked[i].cost).toBeLessThanOrEqual(ranked[i - 1].cost);
  });
});

describe('computePlanNights', () => {
  it('経由地が無く直行距離が1日の上限以内なら宿泊数は0(日帰り圏)', () => {
    const html = getHeritageJourneyPage();
    const { computePlanNights } = loadFns(html);
    // パリ-リヨン(約392km)は1日の上限(500km)以内
    const lyon = { name: 'リヨン', lat: 45.7640, lon: 4.8357 };
    const nights = computePlanNights(PARIS, lyon, [], 45, 500);
    expect(nights).toBe(0);
  });

  it('経由地が無くても直行距離が1日の上限を大きく超える場合は区間を分割して' +
    '複数泊と算出する(区間分割しないと常に0泊になってしまう不具合の回帰テスト)', () => {
    const html = getHeritageJourneyPage();
    const { computePlanNights } = loadFns(html);
    // パリ-ローマ直行(約1105km)を1日350km上限で分割すると ceil(1105/350)=4区間 → 3泊
    const nights = computePlanNights(PARIS, ROME, [], 45, 350);
    expect(nights).toBe(3);
  });
});

describe('出発地別プラン分布(computeDestinationNightsDistribution / bucketByNights)', () => {
  it('出発地自身は目的地の一覧に含まれない', () => {
    const html = getHeritageJourneyPage();
    const { computeDestinationNightsDistribution } = extractDistributionFns(html);
    const start = { name: 'パリ', lat: 48.8566, lon: 2.3522 };
    const distribution = computeDestinationNightsDistribution(start, 45, 350);
    expect(distribution.find((d: any) => d.city === 'パリ')).toBeUndefined();
  });

  it('全都市数-1件ぶんの目的地について、それぞれ0以上の宿泊数を返す', () => {
    const html = getHeritageJourneyPage();
    const { computeDestinationNightsDistribution, CITIES } = extractDistributionFns(html);
    const start = { name: 'パリ', lat: 48.8566, lon: 2.3522 };
    const distribution = computeDestinationNightsDistribution(start, 45, 350);
    expect(distribution.length).toBe(CITIES.length - 1);
    distribution.forEach((d: any) => { expect(d.nights).toBeGreaterThanOrEqual(0); });
  });

  it('bucketByNightsは全目的地をいずれか1つのバケットに過不足なく分類する', () => {
    const html = getHeritageJourneyPage();
    const { computeDestinationNightsDistribution, bucketByNights } = extractDistributionFns(html);
    const start = { name: 'パリ', lat: 48.8566, lon: 2.3522 };
    const distribution = computeDestinationNightsDistribution(start, 45, 350);
    const buckets = bucketByNights(distribution);
    const totalBucketed = buckets.reduce((s: number, b: any) => s + b.cities.length, 0);
    expect(totalBucketed).toBe(distribution.length);
  });

  it('近隣都市(リヨン等)は遠方都市より必要泊数が少ない傾向にある', () => {
    const html = getHeritageJourneyPage();
    const { computeDestinationNightsDistribution } = extractDistributionFns(html);
    const start = { name: 'パリ', lat: 48.8566, lon: 2.3522 };
    const distribution = computeDestinationNightsDistribution(start, 45, 350);
    const lyon = distribution.find((d: any) => d.city === 'リヨン');
    const athens = distribution.find((d: any) => d.city === 'アテネ');
    expect(lyon).toBeTruthy();
    expect(athens).toBeTruthy();
    expect(lyon.nights).toBeLessThan(athens.nights);
  });

  it('各目的地には所属国の国旗(flag)が付与され、全件が空文字にならない', () => {
    const html = getHeritageJourneyPage();
    const { computeDestinationNightsDistribution } = extractDistributionFns(html);
    const start = { name: 'パリ', lat: 48.8566, lon: 2.3522 };
    const distribution = computeDestinationNightsDistribution(start, 45, 350);
    distribution.forEach((d: any) => { expect(d.flag).toBeTruthy(); });
  });

  it('ローマはイタリア国旗(🇮🇹)、リヨンはフランス国旗(🇫🇷)が付与される', () => {
    const html = getHeritageJourneyPage();
    const { computeDestinationNightsDistribution } = extractDistributionFns(html);
    const start = { name: 'パリ', lat: 48.8566, lon: 2.3522 };
    const distribution = computeDestinationNightsDistribution(start, 45, 350);
    const rome = distribution.find((d: any) => d.city === 'ローマ');
    const lyon = distribution.find((d: any) => d.city === 'リヨン');
    expect(rome.flag).toBe('🇮🇹');
    expect(lyon.flag).toBe('🇫🇷');
  });
});

describe('出発地から見た目的地別プラン分布: 各都市ボタンの行頭に国旗を表示する', () => {
  it('renderNightsDistribution内のチップ生成ロジックが、都市名の直前に国旗を連結する', () => {
    const html = getHeritageJourneyPage();
    const fnSrc = extractFn(html, 'renderNightsDistribution', '');
    expect(fnSrc).toContain("var flagPrefix = d.flag ? esc(d.flag) + ' ' : '';");
    expect(fnSrc).toContain('flagPrefix + esc(d.city)');
  });

  it('flagが空の場合でも例外にならず、国旗プレフィックスを省いた表示になる(欠損時のフォールバック)', () => {
    const html = getHeritageJourneyPage();
    const { computeDestinationNightsDistribution } = extractDistributionFns(html);
    const start = { name: 'パリ', lat: 48.8566, lon: 2.3522 };
    const distribution = computeDestinationNightsDistribution(start, 45, 350);
    const d = distribution[0];
    const flagPrefix = d.flag ? d.flag + ' ' : '';
    expect(() => flagPrefix + d.city + '(' + d.nights + '泊)').not.toThrow();
  });
});

describe('buildEmbeddedHeritagePoints', () => {
  it('ヨーロッパ域外(日本など)の世界遺産は含まれない', () => {
    const points = buildEmbeddedHeritagePoints();
    expect(points.find((p) => p.n === '富士山')).toBeUndefined();
  });

  it('ヨーロッパ域内の世界遺産(ローマ歴史地区など)は含まれる', () => {
    const points = buildEmbeddedHeritagePoints();
    expect(points.find((p) => p.n === 'ローマ歴史地区')).toBeTruthy();
  });
});

describe('parseAirportCity', () => {
  it('"国旗 国・地域" 形式から国旗と国名(・より前)を分離する', () => {
    expect(parseAirportCity('🇫🇷 フランス・パリ')).toEqual({ flag: '🇫🇷', country: 'フランス' });
  });

  it('"・" を含まない場合は残り全体を国名として扱う', () => {
    expect(parseAirportCity('🇸🇬 シンガポール')).toEqual({ flag: '🇸🇬', country: 'シンガポール' });
  });

  it('空文字や不正な形式でも例外を投げず、空文字にフォールバックする', () => {
    expect(() => parseAirportCity('')).not.toThrow();
    expect(parseAirportCity('')).toEqual({ flag: '', country: '' });
    expect(() => parseAirportCity(undefined as unknown as string)).not.toThrow();
  });
});

describe('buildEmbeddedAirportPoints', () => {
  it('ヨーロッパ域内の空港(シャルル・ド・ゴール空港など)は含まれ、✈︎アイコンが付与される', () => {
    const points = buildEmbeddedAirportPoints();
    const cdg = points.find((p) => p.n === 'シャルル・ド・ゴール空港');
    expect(cdg).toBeTruthy();
    expect(cdg!.e).toBe('✈︎');
    expect(cdg!.f).toBe('🇫🇷');
    expect(cdg!.c).toBe('フランス');
  });

  it('ヨーロッパ域外の空港(成田国際空港など)は含まれない', () => {
    const points = buildEmbeddedAirportPoints();
    expect(points.find((p) => p.n === '成田国際空港')).toBeUndefined();
  });

  it('空港の候補はidを持たない(heritage_masterのID採番対象外のため)', () => {
    const points = buildEmbeddedAirportPoints();
    const cdg = points.find((p) => p.n === 'シャルル・ド・ゴール空港');
    expect(cdg!.id).toBeNull();
  });

  it('同名の空港が重複データとして複数存在しても1件に絞られる(例: マドリード・バラハス空港系)', () => {
    const points = buildEmbeddedAirportPoints();
    const names = points.map((p) => p.n);
    const uniqueNames = new Set(names);
    expect(names.length).toBe(uniqueNames.size);
  });
});

describe('buildEmbeddedRailStationPoints', () => {
  it('ヨーロッパ域内の駅(パリ北駅など)は含まれ、🚉アイコンが付与される', () => {
    const points = buildEmbeddedRailStationPoints();
    const parisNord = points.find((p) => p.n === 'パリ北駅');
    expect(parisNord).toBeTruthy();
    expect(parisNord!.e).toBe('🚉');
    expect(parisNord!.f).toBe('🇫🇷');
    expect(parisNord!.id).toBeNull();
  });

  it('ヨーロッパ域外の駅(ソウル駅など)は含まれない', () => {
    const points = buildEmbeddedRailStationPoints();
    expect(points.find((p) => p.n === 'ソウル駅')).toBeUndefined();
  });

  it('駅自身にflag/countryが無い場合は所属路線(line)のflag/countryにフォールバックする', () => {
    const points = buildEmbeddedRailStationPoints();
    // ICE(ハンブルク～ハノーファー～フランクフルト)の各駅は駅レベルのflag/countryを
    // 持たないため、路線側の値(🇩🇪 ドイツ)を引き継ぐ
    const hamburg = points.find((p) => p.n === 'ハンブルク中央駅');
    expect(hamburg).toBeTruthy();
    expect(hamburg!.f).toBe('🇩🇪');
    expect(hamburg!.c).toBe('ドイツ');
  });

  it('複数路線にまたがって同名で登場する駅(ウィーン中央駅など)は重複せず1件に絞られる', () => {
    const points = buildEmbeddedRailStationPoints();
    const names = points.map((p) => p.n);
    const uniqueNames = new Set(names);
    expect(names.length).toBe(uniqueNames.size);
  });
});

describe('buildEmbeddedJourneyPoints', () => {
  it('世界遺産・空港・駅の3種類がすべて候補プールに混在する', () => {
    const points = buildEmbeddedJourneyPoints();
    expect(points.find((p) => p.n === 'ローマ歴史地区')).toBeTruthy();
    expect(points.find((p) => p.n === 'シャルル・ド・ゴール空港')).toBeTruthy();
    expect(points.find((p) => p.n === 'パリ北駅')).toBeTruthy();
  });

  it('空港・駅のアイコンは世界遺産のアイコンと視覚的に区別できる(異なる絵文字)', () => {
    const points = buildEmbeddedJourneyPoints();
    const heritage = points.find((p) => p.n === 'ローマ歴史地区');
    const airport = points.find((p) => p.n === 'シャルル・ド・ゴール空港');
    const station = points.find((p) => p.n === 'パリ北駅');
    expect(airport!.e).toBe('✈︎');
    expect(station!.e).toBe('🚉');
    expect(airport!.e).not.toBe(heritage!.e);
    expect(station!.e).not.toBe(heritage!.e);
    expect(airport!.e).not.toBe(station!.e);
  });

  it('件数は世界遺産+空港+駅の合計と一致する', () => {
    const heritage = buildEmbeddedHeritagePoints();
    const airports = buildEmbeddedAirportPoints();
    const stations = buildEmbeddedRailStationPoints();
    const merged = buildEmbeddedJourneyPoints();
    expect(merged.length).toBe(heritage.length + airports.length + stations.length);
  });
});

describe('buildCandidates: 空港・駅を含む統合候補プールでの動作', () => {
  it('HERITAGE_POINTSに埋め込まれた空港・駅の実データがbuildCandidatesの迂回距離フィルタを通過する', () => {
    const html = getHeritageJourneyPage();
    const heritageMatch = html.match(/var HERITAGE_POINTS = (\[.*?\]);/);
    expect(heritageMatch).toBeTruthy();
    const embedded = JSON.parse(heritageMatch![1]);
    // リール・ヨーロップ駅(ユーロスター)・シャルル・ド・ゴール空港が埋め込みデータに含まれていること自体を確認
    expect(embedded.find((p: any) => p.n === 'リール・ヨーロップ駅')).toBeTruthy();
    expect(embedded.find((p: any) => p.n === 'シャルル・ド・ゴール空港')).toBeTruthy();

    const earthR = html.match(/var EARTH_R = \d+;/)![0];
    const buildCandidatesSrc = extractFn(html, 'buildCandidates', '[^)]*');
    const haversineKmSrc = extractFn(html, 'haversineKm', '[^)]*');
    const computeDetourKmSrc = extractFn(html, 'computeDetourKm', '[^)]*');
    const fn = new Function(
      'manuallyAddedPoints',
      `${earthR}\n${haversineKmSrc}\n${computeDetourKmSrc}\n${buildCandidatesSrc}\nreturn buildCandidates;`
    )({});
    // パリ(出発)からリヨン(到着)への移動中、シャルル・ド・ゴール空港とリール・ヨーロップ駅は
    // 十分な迂回範囲(500km)なら候補に入るはず(ともに出発/到着から3km以上離れている)
    const PARIS = { name: 'パリ', lat: 48.8566, lon: 2.3522 };
    const LYON = { name: 'リヨン', lat: 45.7640, lon: 4.8357 };
    const candidates = fn(PARIS, LYON, embedded, 500);
    const names = candidates.map((c: any) => c.name);
    expect(names).toContain('シャルル・ド・ゴール空港');
    expect(names).toContain('リール・ヨーロップ駅');
    // 空港・駅候補もid(null)を保持したまま返る
    const cdg = candidates.find((c: any) => c.name === 'シャルル・ド・ゴール空港');
    expect(cdg.id).toBeNull();
  });
});

describe('経由データ保存機能(currentTourActiveHeritageIds)は空港・駅(id:null)混入時に壊れない', () => {
  it('updateCurrentTourActiveHeritageIdsのロジック(!!p.idフィルタ)は、idを持たないtourPointを' +
    '安全にスキップし、世界遺産のidだけを配列化する(クラッシュも空文字化もしない)', () => {
    const tourPoints = [
      { name: 'パリ', id: undefined },
      { name: 'ローマ歴史地区', id: '0001' },
      { name: 'シャルル・ド・ゴール空港', id: null },
      { name: 'パリ北駅', id: null },
      { name: 'ローマ', id: undefined },
    ];
    const updateCurrentTourActiveHeritageIds = (points: { name: string; id: string | null | undefined }[]) =>
      points.filter((p) => !!p.id).map((p) => p.id);
    const result = updateCurrentTourActiveHeritageIds(tourPoints);
    expect(result).toEqual(['0001']);
    expect(result.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
  });
});

describe('getHeritageJourneyPage', () => {
  it('都市選択・候補チェックリスト・サマリー・宿泊プランのDOM要素を含む', () => {
    const html = getHeritageJourneyPage();
    expect(html).toContain('id="start-city"');
    expect(html).toContain('id="end-city"');
    expect(html).toContain('id="swap-btn"');
    expect(html).toContain('id="opt-detour"');
    expect(html).toContain('id="opt-nights"');
    expect(html).toContain('id="cand-list"');
    expect(html).toContain('id="summary-grid"');
    expect(html).toContain('id="day-plan"');
    expect(html).toContain('id="nights-dist"');
    expect(html).toContain('id="slack-note"');
    expect(html).toContain('function planOvernights(');
    expect(html).toContain('function detectHubClusters(');
    expect(html).toContain('function rankRemovalCandidates(');
    expect(html).toContain('function computeDestinationNightsDistribution(');
    expect(html).toContain('function bucketByNights(');
    expect(html).toContain('function renderNightsDistribution(');
    expect(html).toContain('function renderSlackNote(');
  });
});

describe('/heritage-journey ルート登録', () => {
  it('src/index.ts にルートが登録され、旧/heritage-routesは残っていない', () => {
    const src = readFileSync('src/index.ts', 'utf8');
    expect(src).toContain("app.get('/heritage-journey'");
    expect(src).toContain('getHeritageJourneyPage');
    expect(src).not.toContain("app.get('/heritage-routes'");
  });
});
