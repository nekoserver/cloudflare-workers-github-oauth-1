import { describe, it, expect } from 'vitest';
import { getWebGLFaultsPage } from './webglFaults';

describe('getWebGLFaultsPage', () => {
  const html = getWebGLFaultsPage('tester');

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

  it('世界の主要ハブ空港（新規追加分）が APT_REGIONS に存在する', () => {
    const newCodes = [
      'TPE', 'MNL', 'SGN', 'JED', 'TLV', 'ZRH', 'SVO', 'CPH', 'VIE',
      'ATL', 'SFO', 'YVR', 'HNL', 'GIG', 'HAV', 'CMN', 'ACC',
    ];
    newCodes.forEach((code) => {
      expect(html).toContain("code:'" + code + "'");
    });
  });

  it('すべての空港コードに IATA_FLAG の国旗定義がある', () => {
    const codes = Array.from(html.matchAll(/code:'(\w+)'/g)).map((m) => m[1]);
    expect(codes.length).toBeGreaterThan(0);
    const flagBlockMatch = html.match(/var IATA_FLAG = \{([\s\S]*?)\};/);
    expect(flagBlockMatch).not.toBeNull();
    const flagBlock = flagBlockMatch![1];
    codes.forEach((code) => {
      expect(flagBlock).toContain("'" + code + "'");
    });
  });

  it('すべての空港コードに IATA_ICAO の対応がある', () => {
    const codes = Array.from(html.matchAll(/code:'(\w+)'/g)).map((m) => m[1]);
    const icaoBlockMatch = html.match(/var IATA_ICAO = \{([\s\S]*?)\};/);
    expect(icaoBlockMatch).not.toBeNull();
    const icaoBlock = icaoBlockMatch![1];
    codes.forEach((code) => {
      expect(icaoBlock).toContain(code + ':');
    });
  });

  it('routes に列挙されたコードはすべて実在する空港コードである', () => {
    const codes = new Set(Array.from(html.matchAll(/code:'(\w+)'/g)).map((m) => m[1]));
    const routeMatches = Array.from(html.matchAll(/routes:\[([^\]]*)\]/g));
    expect(routeMatches.length).toBeGreaterThan(0);
    routeMatches.forEach((rm) => {
      const routeCodes = Array.from(rm[1].matchAll(/'(\w+)'/g)).map((x) => x[1]);
      routeCodes.forEach((rc) => {
        expect(codes.has(rc)).toBe(true);
      });
    });
  });
});
