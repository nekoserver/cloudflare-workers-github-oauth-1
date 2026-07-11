import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

describe('HERITAGE_LIST — モンゴル世界遺産', () => {
  const mongoliaHeritages = HERITAGE_LIST.filter((item) => item.c.includes('モンゴル'));

  it('UNESCO掲載のモンゴル世界遺産6件をすべて含む', () => {
    expect(mongoliaHeritages.map((item) => item.n)).toEqual(
      expect.arrayContaining([
        'ウヴス・ヌール盆地',
        'オルホン渓谷文化的景観',
        'モンゴル・アルタイ山脈の岩絵群',
        '大ブルカン・カルドゥン山とその周辺の聖なる景観',
        'ダウリヤの景観群',
        '鹿石記念物と関連する青銅器時代遺跡群',
      ]),
    );
    expect(mongoliaHeritages).toHaveLength(6);
  });

  it('追加したモンゴル世界遺産には登録年・分類・座標が設定されている', () => {
    for (const item of mongoliaHeritages) {
      expect(item.y).not.toBe('----');
      expect(['文化遺産', '自然遺産', '複合遺産']).toContain(item.t);
      expect(Number.isFinite(item.lat)).toBe(true);
      expect(Number.isFinite(item.lon)).toBe(true);
      expect(item.lat).toBeGreaterThan(40);
      expect(item.lat).toBeLessThan(55);
      expect(item.lon).toBeGreaterThan(80);
      expect(item.lon).toBeLessThan(120);
    }
  });
});
