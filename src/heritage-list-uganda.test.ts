import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

// 対象: ウガンダのUNESCO世界遺産(2026年時点で3件全て: ブウィンディ原生国立公園
// [既存]・ルウェンゾリ山地国立公園[新規]・カスビのブガンダ歴代国王の墓[新規])。
// UNESCO World Heritage Centre(whc.unesco.org)公表の座標・登録年で追加した。
describe('HERITAGE_LIST — ウガンダの世界遺産(3件すべて)', () => {
  it('ウガンダの世界遺産は3件で、すべてf:🇺🇬・c:ウガンダを持つ', () => {
    const ugandaSites = HERITAGE_LIST.filter((item) => item.c === 'ウガンダ');
    expect(ugandaSites).toHaveLength(3);
    for (const site of ugandaSites) {
      expect(site.f).toBe('🇺🇬');
    }
  });

  it('ブウィンディ原生国立公園(既存)は変更されていない', () => {
    const site = HERITAGE_LIST.find((item) => item.n === 'ブウィンディ原生国立公園');
    expect(site).toMatchObject({
      e: '🌿', f: '🇺🇬', c: 'ウガンダ', t: '自然遺産', y: 1994, lat: -1.06, lon: 29.71,
    });
  });

  it('ルウェンゾリ山地国立公園(新規)をUNESCO公表座標(0°24′N 29°57′E)で含む', () => {
    const site = HERITAGE_LIST.find((item) => item.n === 'ルウェンゾリ山地国立公園');
    expect(site).toMatchObject({
      e: '🌿', f: '🇺🇬', c: 'ウガンダ', t: '自然遺産', y: 1994, lat: 0.40, lon: 29.95,
    });
  });

  it('カスビのブガンダ歴代国王の墓(新規)をUNESCO公表座標(0°19′45″N 32°33′12″E)で含む', () => {
    const site = HERITAGE_LIST.find((item) => item.n === 'カスビのブガンダ歴代国王の墓');
    expect(site).toMatchObject({
      e: '🏛️', f: '🇺🇬', c: 'ウガンダ', t: '文化遺産', y: 2001, lat: 0.3292, lon: 32.5533,
    });
  });
});
