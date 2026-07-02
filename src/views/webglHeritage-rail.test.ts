import { describe, it, expect } from 'vitest';
import { getWebGLHeritagePage } from './webglHeritage';

type RailStation = { name: string; lat: number; lon: number };
type RailLine = { name: string; flag: string; country: string; stations: RailStation[] };

function extractRailLines(html: string): RailLine[] {
  const m = html.match(/var RAIL_LINES = (\[[\s\S]*?\]);/);
  if (!m) throw new Error('RAIL_LINES が見つかりません');
  return JSON.parse(m[1]);
}

describe('getWebGLHeritagePage 鉄道路線機能', () => {
  const html = getWebGLHeritagePage('tester');

  it('script タグ内の JS に構文エラーがない', () => {
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });

  it('🚉 鉄道ボタンと左サイドパネルの要素が存在する（モーダルは廃止）', () => {
    expect(html).toContain('id="btnRail"');
    expect(html).toContain('id="rail-side"');
    expect(html).toContain('id="rail-side-body"');
    expect(html).toContain('id="rail-side-close"');
    expect(html).toContain('function renderRailSideBody');
    expect(html).not.toContain('id="rail-modal-overlay"');
    expect(html).not.toContain('id="rail-modal-body"');
  });

  it('各路線の右端に巡回ボタンが存在する', () => {
    expect(html).toContain('rail-tour-btn');
    expect(html).toMatch(/function startRailTour\(lineIdx\)/);
    expect(html).toMatch(/function stopRailTour\(\)/);
  });

  it('地表に降り立つ機能に近隣駅リストの要素が存在する', () => {
    expect(html).toContain('id="landing-station-list"');
    expect(html).toContain('function renderStationList');
    expect(html).toContain('function nearestStations');
  });

  it('RAIL_LINES にロシア・中国が含まれない', () => {
    const lines = extractRailLines(html);
    expect(lines.some((l) => l.country.indexOf('ロシア') !== -1)).toBe(false);
    expect(lines.some((l) => l.country.indexOf('中国') !== -1)).toBe(false);
  });

  it('各路線は2駅以上の座標データを持つ', () => {
    const lines = extractRailLines(html);
    expect(lines.length).toBeGreaterThanOrEqual(8);
    lines.forEach((line) => {
      expect(line.stations.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('駅の行に座標データ属性が付与され、タップで地球儀を最大ズームで中心移動させる', () => {
    expect(html).toContain('rail-station-row');
    expect(html).toMatch(/data-lat="\s*'\s*\+\s*st\.lat\s*\+\s*'\s*"\s+data-lon="\s*'\s*\+\s*st\.lon\s*\+\s*'\s*"/);
    expect(html).toMatch(/querySelectorAll\('\.rail-station-row'\)/);
    expect(html).toMatch(/flyTo\(station\.lat, station\.lon\);\s*zoom = 1\.2;/);
  });

  it('サウジアラビア・UAE・カタールの鉄道路線が始発駅から終着駅の座標つきで含まれる', () => {
    const lines = extractRailLines(html);
    const names = lines.map((l) => l.country);
    const stationNames = lines.flatMap((l) => l.stations.map((s) => s.name));
    expect(names).toContain('サウジアラビア');
    expect(stationNames).toContain('メディナ駅');
    expect(stationNames).toContain('マッカ駅');
    expect(names).toContain('アラブ首長国連邦');
    expect(stationNames).toContain('アブダビ駅');
    expect(stationNames).toContain('フジャイラ駅');
    expect(names).toContain('カタール');
    expect(stationNames).toContain('アル・ワクラ駅');
    expect(stationNames).toContain('ルサイル駅');

    function haversineKm(la1: number, lo1: number, la2: number, lo2: number) {
      const R = 6371;
      const dLa = (la2 - la1) * Math.PI / 180;
      const dLo = (lo2 - lo1) * Math.PI / 180;
      const a = Math.sin(dLa / 2) * Math.sin(dLa / 2) +
        Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    function lineTotalKm(stations: { lat: number; lon: number }[]) {
      let total = 0;
      for (let i = 1; i < stations.length; i++) {
        total += haversineKm(stations[i - 1].lat, stations[i - 1].lon, stations[i].lat, stations[i].lon);
      }
      return total;
    }
    // ハラマイン高速鉄道: メディナ -> キング・アブドラ経済都市 -> ジッダ(空港) -> マッカ の実データで検証
    const haramain = [
      { lat: 24.468, lon: 39.621 },
      { lat: 22.406, lon: 39.093 },
      { lat: 21.694, lon: 39.157 },
      { lat: 21.474, lon: 39.826 },
    ];
    expect(lineTotalKm(haramain)).toBeGreaterThan(300);
    expect(lineTotalKm(haramain)).toBeLessThan(500);

    // エティハド鉄道: アブダビ -> ドバイ -> シャルジャ -> フジャイラ の実データで検証
    const etihad = [
      { lat: 24.454, lon: 54.377 },
      { lat: 25.205, lon: 55.271 },
      { lat: 25.346, lon: 55.421 },
      { lat: 25.129, lon: 56.327 },
    ];
    expect(lineTotalKm(etihad)).toBeGreaterThan(150);
    expect(lineTotalKm(etihad)).toBeLessThan(350);

    // ドーハメトロ・レッドライン: アル・ワクラ -> ハマド国際空港 -> ムシェリーブ -> ルサイル の実データで検証
    const doha = [
      { lat: 25.166, lon: 51.602 },
      { lat: 25.261, lon: 51.614 },
      { lat: 25.287, lon: 51.533 },
      { lat: 25.399, lon: 51.493 },
    ];
    expect(lineTotalKm(doha)).toBeGreaterThan(15);
    expect(lineTotalKm(doha)).toBeLessThan(60);
  });

  it('駅名の先頭に近隣都市キャッシュ済みなら🚉アイコンを表示し、タップでキャッシュを取得する', () => {
    expect(html).toContain("var hasStationDataSet = {}");
    expect(html).toContain("fetch('/api/rail-station-fetched-list')");
    expect(html).toContain('function cacheStationCities(name, lat, lon)');
    expect(html).toMatch(/var cacheIcon = hasStationDataSet\[st\.name\] \? '🚉 ' : '';/);
    expect(html).toMatch(/data-name="\s*'\s*\+\s*st\.name\s*\+\s*'\s*"/);
    expect(html).toMatch(/cities-modal-name">\s*'\s*\+\s*cacheIcon\s*\+\s*\(si \+ 1\)\s*\+\s*'\.\s*'\s*\+\s*st\.name/);
    expect(html).toMatch(/cacheStationCities\(station\.name, station\.lat, station\.lon\);/);
  });

  it('駅名タップで地球儀上に🚉ピンと路線名・駅名・区間距離・途中下車ボタンが表示される', () => {
    expect(html).toContain('id="rail-station-pin"');
    expect(html).toContain('id="rail-station-pin-label"');
    expect(html).toContain('id="rail-station-pin-line"');
    expect(html).toContain('id="rail-station-pin-name"');
    expect(html).toContain('id="rail-station-pin-route"');
    expect(html).toContain('id="rail-station-alight-btn"');
    expect(html).toContain('var railStationPin3d = null;');
    expect(html).toMatch(/data-line="\s*'\s*\+\s*line\.flag\s*\+\s*' '\s*\+\s*line\.name\s*\+\s*'"/);
    expect(html).toMatch(/function showRailStationPin\(line, station, stationIdx\)/);
    expect(html).toMatch(/function startStationLanding\(/);
    expect(html).toMatch(/updateWorldPin\(railStationPin3d, railStationPin, railStationPinLabel\);/);
  });

  it('途中下車すると駅から100km圏内の駅・世界遺産をAPI取得しツールチップに表示する', () => {
    expect(html).toContain("fetch('/api/rail-station-nearby'");
    expect(html).toContain('function renderNearbyPointsList(points)');
    expect(html).toContain('function loadNearbyPoints(name, lat, lon)');
    expect(html).toMatch(/半径100km圏内の駅・世界遺産/);
  });

  it('区間距離は haversine 公式で始発から終着まで加算した値と一致する', () => {
    function haversineKm(la1: number, lo1: number, la2: number, lo2: number) {
      const R = 6371;
      const dLa = (la2 - la1) * Math.PI / 180;
      const dLo = (lo2 - lo1) * Math.PI / 180;
      const a = Math.sin(dLa / 2) * Math.sin(dLa / 2) +
        Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    // 東海道新幹線: 東京駅 -> 新大阪駅 の実データで検証
    const tokyo = { lat: 35.681, lon: 139.767 };
    const shinYokohama = { lat: 35.507, lon: 139.617 };
    const nagoya = { lat: 35.170, lon: 136.881 };
    const kyoto = { lat: 34.985, lon: 135.759 };
    const shinOsaka = { lat: 34.734, lon: 135.500 };
    const stations = [tokyo, shinYokohama, nagoya, kyoto, shinOsaka];
    let total = 0;
    for (let i = 1; i < stations.length; i++) {
      total += haversineKm(stations[i - 1].lat, stations[i - 1].lon, stations[i].lat, stations[i].lon);
    }
    expect(total).toBeGreaterThan(400);
    expect(total).toBeLessThan(600);
  });
});
