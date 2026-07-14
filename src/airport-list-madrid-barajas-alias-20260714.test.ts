import { describe, expect, it } from 'vitest';
import { AIRPORT_LIST } from './data/airports';
import { findHeritageAreaPoint } from './index';

// 対象: AIRPORT_LISTの「マドリード・バラハス空港」(MAD)。ユーザーが正式名称に近い
// 「マドリード・バラハス国際空港」で検索したところ、findHeritageAreaPointは完全一致検索の
// ため見つからなかった。実座標(Web検索で確認: 北緯約40.4719度・西経約3.5626度、
// 既存データの40.47/-3.56と一致)・空港コード(MAD)・国旗(🇪🇸)を確認済みの上で、
// ローマ・フィウミチーノ空港/ベネチア・テッセラ空港と同じ「エイリアス」パターンで
// 既存の「マドリード・バラハス空港」と同一コード・座標のエイリアスとして追加する。
describe('AIRPORT_LIST — スペイン マドリード・バラハス空港/マドリード・バラハス国際空港(表記ゆれエイリアス)', () => {
  it('既存の「マドリード・バラハス空港」は変更せず、コード(MAD)・座標(40.47,-3.56)を維持する', () => {
    const site = AIRPORT_LIST.find((a) => a.name === 'マドリード・バラハス空港');
    expect(site).toBeDefined();
    expect(site).toMatchObject({ code: 'MAD', city: '🇪🇸 スペイン・マドリード', lat: 40.47, lon: -3.56 });
  });

  it('「マドリード・バラハス国際空港」が同一コード・座標のエイリアスとして追加されている', () => {
    const site = AIRPORT_LIST.find((a) => a.name === 'マドリード・バラハス国際空港');
    expect(site).toBeDefined();
    expect(site).toMatchObject({ code: 'MAD', city: '🇪🇸 スペイン・マドリード', lat: 40.47, lon: -3.56 });
  });

  it('findHeritageAreaPointは「マドリード・バラハス国際空港」表記のまま完全一致で解決でき、国旗🇪🇸を返す', () => {
    const point = findHeritageAreaPoint('マドリード・バラハス国際空港');
    expect(point).not.toBeNull();
    expect(point!.flag).toBe('🇪🇸');
    expect(point!.code).toBe('MAD');
    expect(point!.lat).toBeCloseTo(40.47, 1);
    expect(point!.lon).toBeCloseTo(-3.56, 1);
  });

  it('「マドリード・バラハス空港」表記も引き続き解決できる(既存挙動に影響なし)', () => {
    const point = findHeritageAreaPoint('マドリード・バラハス空港');
    expect(point).not.toBeNull();
    expect(point!.flag).toBe('🇪🇸');
    expect(point!.code).toBe('MAD');
  });
});
