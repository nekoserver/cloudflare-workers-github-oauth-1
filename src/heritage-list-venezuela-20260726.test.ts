import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

// 対象: HERITAGE_LIST のベネズエラの世界遺産。
//
// 背景: ベネズエラはUNESCO公式で3件(文化2・自然1)登録されているが、
// HERITAGE_LIST にはコロの港湾都市(1993)・カナイマ国立公園(1994)の2件しか
// 入っていなかったため、残るカラカス大学都市(2000)を座標付きで追加した。
//
// 故障シナリオ:
//   (1) 件数・種別内訳がUNESCO公式(文化2・自然1)と食い違う
//   (2) 座標がベネズエラの範囲外(緯度経度の入れ違い・符号ミス)
//   (3) 既存の2件(コロの港湾都市・カナイマ国立公園)が重複・改変されてしまう

const HERITAGE_TYPES = new Set(['文化遺産', '自然遺産', '複合遺産']);

describe('HERITAGE_LIST — ベネズエラの世界遺産3件', () => {
  const venezuela = HERITAGE_LIST.filter((h) => h.f === '🇻🇪' && HERITAGE_TYPES.has(h.t));

  it('ベネズエラの世界遺産が3件登録されている(重複なし)', () => {
    const names = venezuela.map((h) => h.n);
    expect(new Set(names).size).toBe(names.length);
    expect(venezuela.length).toBe(3);
  });

  it('種別の内訳がUNESCO公式と一致する(文化2・自然1)', () => {
    const count = (t: string) => venezuela.filter((h) => h.t === t).length;
    expect(count('文化遺産')).toBe(2);
    expect(count('自然遺産')).toBe(1);
    expect(count('複合遺産')).toBe(0);
  });

  it('既存2件(コロの港湾都市・カナイマ国立公園)が改変されずに残っている', () => {
    const coro = venezuela.find((h) => h.n === 'コロの港湾都市');
    expect(coro).toBeDefined();
    expect(coro!.y).toBe(1993);
    expect(coro!.t).toBe('文化遺産');
    expect(coro!.lat).toBeCloseTo(11.4, 1);
    expect(coro!.lon).toBeCloseTo(-69.67, 1);

    const canaima = venezuela.find((h) => h.n === 'カナイマ国立公園');
    expect(canaima).toBeDefined();
    expect(canaima!.y).toBe(1994);
    expect(canaima!.t).toBe('自然遺産');
    expect(canaima!.lat).toBeCloseTo(5.8, 1);
    expect(canaima!.lon).toBeCloseTo(-62.5, 1);
  });

  it('追加したカラカス大学都市(2000年登録)の名称・登録年・座標が正しい', () => {
    const item = venezuela.find((h) => h.n === 'カラカス大学都市');
    expect(item, 'カラカス大学都市 が見つからない').toBeDefined();
    expect(item!.y).toBe(2000);
    expect(item!.t).toBe('文化遺産');
    // UNESCO登録座標: 北緯10度29分27秒, 西経66度53分26秒 付近
    expect(item!.lat).toBeCloseTo(10.49, 1);
    expect(item!.lon).toBeCloseTo(-66.89, 1);
  });

  it('全件の座標が有効かつベネズエラの範囲内に収まっている', () => {
    for (const h of venezuela) {
      expect(h.lat).toBeGreaterThan(-90);
      expect(h.lat).toBeLessThan(90);
      expect(h.lon).toBeGreaterThan(-180);
      expect(h.lon).toBeLessThan(180);
      // ベネズエラはおおよそ北緯0.6〜12.2度、西経59.8〜73.4度に収まる
      expect(h.lat).toBeGreaterThan(0.6);
      expect(h.lat).toBeLessThan(12.2);
      expect(h.lon).toBeGreaterThan(-73.4);
      expect(h.lon).toBeLessThan(-59.8);
    }
  });

  it('全件が国旗🇻🇪を持ち、国名にベネズエラを含む', () => {
    for (const h of venezuela) {
      expect(h.f).toBe('🇻🇪');
      expect(h.c).toContain('ベネズエラ');
    }
  });
});
