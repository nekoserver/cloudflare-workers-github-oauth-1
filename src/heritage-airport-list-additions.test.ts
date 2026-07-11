import { describe, it, expect } from 'vitest';
import { getWebGLHeritagePage } from './views/webglHeritage';
import { getWebGLFaultsPage } from './views/webglFaults';

// 対象: 世界遺産ページ・活断層ページの空路(APT_REGIONS)データ。
// AIチャットの検索明細履歴(aichat_search_history.keyword)で「〇〇空港」として
// 検索されたにもかかわらずシードデータに存在しなかった空港を追加する。
// APT_REGIONSはwebglHeritage.tsとwebglFaults.tsに同一内容が重複しているため、
// 両方に同じ追加を適用する。

const NEW_CODES = [
  'INN', 'ERF', 'ORY', 'RUH', 'GDN', 'STR', 'GVA', 'SXB', 'LKCS', 'TRS', 'TRN', 'EPTO',
  'NUE', 'NCE', 'HAM', 'BSL', 'PMI', 'BZG', 'FLR', 'BRQ', 'BRE', 'PRG', 'LKLN', 'BRN',
  'BLX', 'HOF', 'POZ', 'MRS', 'MHG', 'MUC', 'MXP', 'LIN', 'ETZ', 'LEJ', 'RWN', 'LIS',
  'LYS', 'LUG', 'EDNR', 'WAW', 'XCR', 'VCE', 'VRN',
];

describe.each([
  ['webglHeritage', () => getWebGLHeritagePage('tester')],
  ['webglFaults', () => getWebGLFaultsPage('tester')],
])('%s: 検索明細履歴に存在しシードデータに無かった空港の追加', (_label, render) => {
  const html = render();

  it('script タグ内のJSに構文エラーがない', () => {
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });

  it('新規43空港すべてがAPT_REGIONSに存在する', () => {
    NEW_CODES.forEach((code) => {
      expect(html).toContain("code:'" + code + "'");
    });
  });

  it('新規空港すべてにIATA_FLAGの国旗定義がある', () => {
    const flagBlockMatch = html.match(/var IATA_FLAG = \{([\s\S]*?)\};/);
    expect(flagBlockMatch).not.toBeNull();
    const flagBlock = flagBlockMatch![1];
    NEW_CODES.forEach((code) => {
      expect(flagBlock).toContain("'" + code + "'");
    });
  });

  it('新規空港すべてにIATA_ICAOの対応がある', () => {
    const icaoBlockMatch = html.match(/var IATA_ICAO = \{([\s\S]*?)\};/);
    expect(icaoBlockMatch).not.toBeNull();
    const icaoBlock = icaoBlockMatch![1];
    NEW_CODES.forEach((code) => {
      expect(icaoBlock).toContain(code + ':');
    });
  });

  it('routesに列挙されたコードはすべて実在する空港コードである(存在しないコードへのリンクを作らない)', () => {
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

  it('空港コードに重複が無い(同じ空港が二重登録されていない)', () => {
    const codes = Array.from(html.matchAll(/code:'(\w+)'/g)).map((m) => m[1]);
    const unique = new Set(codes);
    expect(codes.length).toBe(unique.size);
  });
});
