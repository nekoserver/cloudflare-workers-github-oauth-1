import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

describe('HERITAGE_LIST — ケニア世界遺産', () => {
  const UNESCO_TYPES = ['文化遺産', '自然遺産', '複合遺産'];

  it('UNESCO世界遺産リスト掲載のケニア8件をすべて含む', () => {
    const kenyaHeritage = HERITAGE_LIST.filter((item) => item.c === 'ケニア' && UNESCO_TYPES.includes(item.t));
    const names = kenyaHeritage.map((item) => item.n);

    expect(names).toEqual(expect.arrayContaining([
      'ケニヤ山国立公園',
      'トゥルカナ湖国立公園群',
      'ラム旧市街',
      'ミジケンダのカヤの森',
      'ケニア・グレート・リフト・バレーの湖群',
      'フォート・ジーザス（モンバサ）',
      'ティムリカ・オヒンガ考古遺跡',
      'ゲディの歴史都市と考古遺跡',
    ]));
    expect(kenyaHeritage).toHaveLength(8);
  });

  it('ケニア世界遺産の座標がすべて設定されている', () => {
    const kenyaHeritage = HERITAGE_LIST.filter((item) => item.c === 'ケニア' && UNESCO_TYPES.includes(item.t));

    expect(kenyaHeritage.length).toBeGreaterThan(0);
    for (const item of kenyaHeritage) {
      expect(Number.isFinite(item.lat)).toBe(true);
      expect(Number.isFinite(item.lon)).toBe(true);
    }
  });
});
