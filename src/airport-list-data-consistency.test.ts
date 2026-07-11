import { describe, it, expect } from 'vitest';
import { AIRPORT_LIST } from './data/airports';
import { getWebGLHeritagePage } from './views/webglHeritage';

// 対象: src/data/airports.ts の AIRPORT_LIST (heritage-accessページの空港ランキング
// モーダルが AIRPORT_BY_NAME 経由で参照する) と、webglHeritage.ts の APT_REGIONS
// (世界遺産ページの空路機能・エリア巡回で使う空港シード)。
// 両者が同期していないと、APT_REGIONSにしか無い空港が「⛳️🏌️‍♀️🏌️‍♂️」ボタンで
// 記録された際、ランキングモーダル側でAIRPORT_BY_NAME[name]がundefinedになり
// 国旗・空港コード表示が丸ごと欠落する(実際に43件の地方空港追加時に発生した不具合)。
describe('AIRPORT_LIST と APT_REGIONS(webglHeritage.ts) の空港コード整合性', () => {
  it('APT_REGIONSに存在する空港コードは、すべてAIRPORT_LISTにも存在する', () => {
    const html = getWebGLHeritagePage('tester');
    const aptRegionsCodes = new Set(Array.from(html.matchAll(/code:'(\w+)'/g)).map((m) => m[1]));
    expect(aptRegionsCodes.size).toBeGreaterThan(0);

    const airportListCodes = new Set(AIRPORT_LIST.map((a) => a.code));
    const missing = Array.from(aptRegionsCodes).filter((code) => !airportListCodes.has(code));
    expect(missing).toEqual([]);
  });

  it('新規追加した43空港(地方空港)がAIRPORT_LISTに存在する', () => {
    const codes = new Set(AIRPORT_LIST.map((a) => a.code));
    const newCodes = [
      'INN', 'ERF', 'ORY', 'RUH', 'GDN', 'STR', 'GVA', 'SXB', 'LKCS', 'TRS', 'TRN', 'EPTO',
      'NUE', 'NCE', 'HAM', 'BSL', 'PMI', 'BZG', 'FLR', 'BRQ', 'BRE', 'PRG', 'LKLN', 'BRN',
      'BLX', 'HOF', 'POZ', 'MRS', 'MHG', 'MUC', 'MXP', 'LIN', 'ETZ', 'LEJ', 'RWN', 'LIS',
      'LYS', 'LUG', 'EDNR', 'WAW', 'XCR', 'VCE', 'VRN',
    ];
    newCodes.forEach((code) => {
      expect(codes.has(code)).toBe(true);
    });
  });
});
