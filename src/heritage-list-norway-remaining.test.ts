import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

const HERITAGE_TYPES = new Set(['文化遺産', '自然遺産', '複合遺産']);

describe('HERITAGE_LIST — ノルウェーの世界遺産8件すべてが登録されている', () => {
  const norwayItems = HERITAGE_LIST.filter((h) => h.c === 'ノルウェー' && HERITAGE_TYPES.has(h.t));

  it('ノルウェーの世界遺産が8件登録されている(重複なし)', () => {
    const names = norwayItems.map((h) => h.n);
    expect(new Set(names).size).toBe(names.length);
    expect(norwayItems.length).toBe(8);
  });

  it('既存の2件(ブリッゲン・西ノルウェーのフィヨルド)が維持されている', () => {
    expect(norwayItems.some((h) => h.n === 'ブリッゲン（ベルゲン）' && h.y === 1979)).toBe(true);
    expect(norwayItems.some((h) => h.n === 'フィヨルド（西ノルウェー）' && h.y === 2005)).toBe(true);
  });

  it('未登録だった6件が追加されている(名称・登録年)', () => {
    const expected: Array<{ n: string; y: number }> = [
      { n: 'ウルネスの木造教会', y: 1979 },
      { n: 'ロロースの鉱山街とその周辺', y: 1980 },
      { n: 'アルタの岩絵', y: 1985 },
      { n: 'ヴェガ群島', y: 2004 },
      { n: 'シュトルーヴェの測地弧（ノルウェー）', y: 2005 },
      { n: 'リューカン・ノトデン産業遺産', y: 2015 },
    ];
    for (const e of expected) {
      const item = norwayItems.find((h) => h.n === e.n);
      expect(item, `${e.n} が見つからない`).toBeDefined();
      expect(item!.y).toBe(e.y);
    }
  });

  it('全件の座標が有効な範囲内かつノルウェー国内の緯度経度に収まっている', () => {
    for (const h of norwayItems) {
      expect(h.lat).toBeGreaterThan(-90);
      expect(h.lat).toBeLessThan(90);
      expect(h.lon).toBeGreaterThan(-180);
      expect(h.lon).toBeLessThan(180);
      // ノルウェー本土・沖合はおおよそ北緯58〜71度、東経4〜31度の範囲に収まる
      expect(h.lat).toBeGreaterThan(55);
      expect(h.lat).toBeLessThan(72);
      expect(h.lon).toBeGreaterThan(0);
      expect(h.lon).toBeLessThan(32);
    }
  });

  it('全件が国旗🇳🇴を持つ', () => {
    for (const h of norwayItems) {
      expect(h.f).toBe('🇳🇴');
    }
  });
});
