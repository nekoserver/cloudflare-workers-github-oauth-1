import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

describe('HERITAGE_LIST — マダガスカル世界遺産', () => {
  it('UNESCO世界遺産リスト掲載のマダガスカル3件をすべて含む', () => {
    const madagascar = HERITAGE_LIST.filter((item) => item.c === 'マダガスカル');
    const names = madagascar.map((item) => item.n);

    expect(names).toEqual(expect.arrayContaining([
      'アンドレファナの乾燥林',
      'アンブヒマンガの丘の王領地',
      'アチナナナの雨林',
    ]));
    expect(madagascar).toHaveLength(3);
  });

  it('マダガスカル世界遺産の座標がすべて設定されている', () => {
    const madagascar = HERITAGE_LIST.filter((item) => item.c === 'マダガスカル');

    expect(madagascar.length).toBeGreaterThan(0);
    for (const item of madagascar) {
      expect(Number.isFinite(item.lat)).toBe(true);
      expect(Number.isFinite(item.lon)).toBe(true);
    }
  });
});
