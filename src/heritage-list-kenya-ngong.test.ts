import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

describe('HERITAGE_LIST — ケニアのンゴング競馬場', () => {
  it('🏇アイコンと調査した座標でンゴング競馬場を含む', () => {
    const site = HERITAGE_LIST.find((item) => item.n === 'ンゴング競馬場');

    expect(site).toMatchObject({
      e: '🏇',
      f: '🇰🇪',
      c: 'ケニア',
      t: '競馬場',
      y: 1954,
      lat: -1.305833,
      lon: 36.739164,
    });
  });
});
