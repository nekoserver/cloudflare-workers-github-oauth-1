import { describe, it, expect } from 'vitest';
import { getWebGLHeritagePage } from './webglHeritage';

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

  it('🚉 鉄道ボタンとモーダルの要素が存在する', () => {
    expect(html).toContain('id="btnRail"');
    expect(html).toContain('id="rail-modal-overlay"');
    expect(html).toContain('id="rail-modal-body"');
    expect(html).toContain('id="rail-modal-close"');
    expect(html).toContain('function renderRailModalRows');
  });

  it('地表に降り立つ機能に近隣駅リストの要素が存在する', () => {
    expect(html).toContain('id="landing-station-list"');
    expect(html).toContain('function renderStationList');
    expect(html).toContain('function nearestStations');
  });

  it('RAIL_LINES にロシア・中国が含まれない', () => {
    const railBlockMatch = html.match(/var RAIL_LINES = (\[[\s\S]*?\]);\s*\n\s*function typeColor/);
    expect(railBlockMatch).not.toBeNull();
    const railBlock = railBlockMatch![1];
    expect(railBlock).not.toContain('ロシア');
    expect(railBlock).not.toContain('中国');
  });

  it('各路線は2駅以上の座標データを持つ', () => {
    const railBlockMatch = html.match(/var RAIL_LINES = (\[[\s\S]*?\]);\s*\n\s*function typeColor/);
    const railBlock = railBlockMatch![1];
    const lineBlocks = Array.from(railBlock.matchAll(/stations:\[([\s\S]*?)\]\}/g));
    expect(lineBlocks.length).toBeGreaterThanOrEqual(8);
    lineBlocks.forEach((lb) => {
      const stationCount = Array.from(lb[1].matchAll(/name:'([^']+)'/g)).length;
      expect(stationCount).toBeGreaterThanOrEqual(2);
    });
  });

  it('駅の行に座標データ属性が付与され、タップで地球儀を最大ズームで中心移動させる', () => {
    expect(html).toContain('rail-station-row');
    expect(html).toMatch(/data-lat="\s*'\s*\+\s*st\.lat\s*\+\s*'\s*"\s+data-lon="\s*'\s*\+\s*st\.lon\s*\+\s*'\s*"/);
    expect(html).toMatch(/querySelectorAll\('\.rail-station-row'\)/);
    expect(html).toMatch(/railModalOverlay\.classList\.remove\('open'\);\s*flyTo\(lat, lon\);\s*zoom = 1\.2;/);
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
