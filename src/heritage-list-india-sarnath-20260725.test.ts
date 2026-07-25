import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

// 対象: HERITAGE_LIST のインドの世界遺産。
//
// 背景: 2026-07-25 の第48回世界遺産委員会（釜山）で「古代仏教遺跡サールナート
// （バラナシ）」が登録され、インドは45件目となった。従来 HERITAGE_LIST には
// タージ・マハルとル・コルビュジエ（チャンディガール）の2件しか入っておらず、
// 43件が欠落していたため、全45件を座標付きで登録した。
//
// 故障シナリオ:
//   (1) 件数・種別内訳がUNESCO公式（文化37・自然7・複合1）と食い違う
//   (2) 座標がインド国土の範囲外（緯度経度の入れ違い・符号ミス）
//   (3) 名称の重複登録、または名称に英字が混入したまま登録される
//   (4) サールナートの登録年・座標が誤っている

const HERITAGE_TYPES = new Set(['文化遺産', '自然遺産', '複合遺産']);

describe('HERITAGE_LIST — インドの世界遺産45件', () => {
  const india = HERITAGE_LIST.filter((h) => h.f === '🇮🇳' && HERITAGE_TYPES.has(h.t));

  it('インドの世界遺産が45件登録されている(重複なし)', () => {
    const names = india.map((h) => h.n);
    expect(new Set(names).size).toBe(names.length);
    expect(india.length).toBe(45);
  });

  it('種別の内訳がUNESCO公式と一致する(文化37・自然7・複合1)', () => {
    const count = (t: string) => india.filter((h) => h.t === t).length;
    expect(count('文化遺産')).toBe(37);
    expect(count('自然遺産')).toBe(7);
    expect(count('複合遺産')).toBe(1);
  });

  it('2026年登録の古代仏教遺跡サールナート（バラナシ）が登録されている', () => {
    const sarnath = india.find((h) => h.n.includes('サールナート'));
    expect(sarnath).toBeDefined();
    expect(sarnath!.y).toBe(2026);
    expect(sarnath!.t).toBe('文化遺産');
    // ダメーク・ストゥーパ（サールナートの中核）の座標
    expect(sarnath!.lat).toBeCloseTo(25.38, 1);
    expect(sarnath!.lon).toBeCloseTo(83.02, 1);
  });

  it('1983年の最初の4件（タージ・マハル・アジャンター・エローラ・アーグラ城塞）が揃っている', () => {
    const first = india.filter((h) => h.y === 1983).map((h) => h.n);
    expect(first).toHaveLength(4);
    expect(first).toContain('タージ・マハル');
    expect(first).toContain('アジャンター石窟群');
    expect(first).toContain('エローラ石窟群');
    expect(first).toContain('アーグラ城塞');
  });

  it('唯一の複合遺産はカンチェンジュンガ国立公園である', () => {
    const mixed = india.filter((h) => h.t === '複合遺産');
    expect(mixed).toHaveLength(1);
    expect(mixed[0].n).toBe('カンチェンジュンガ国立公園');
    expect(mixed[0].y).toBe(2016);
  });

  it('全件の座標が有効かつインド国土の範囲内に収まっている', () => {
    for (const h of india) {
      expect(h.lat).toBeGreaterThan(-90);
      expect(h.lat).toBeLessThan(90);
      expect(h.lon).toBeGreaterThan(-180);
      expect(h.lon).toBeLessThan(180);
      // インド本土はおおよそ北緯6〜36度、東経68〜98度に収まる
      expect(h.lat).toBeGreaterThan(6);
      expect(h.lat).toBeLessThan(36);
      expect(h.lon).toBeGreaterThan(68);
      expect(h.lon).toBeLessThan(98);
    }
  });

  it('名称に英字が混入していない(表記の取りこぼし防止)', () => {
    for (const h of india) {
      expect(h.n, `${h.n} に英字が混入している`).not.toMatch(/[A-Za-z]/);
    }
  });

  it('全件が国旗🇮🇳と国名「インド」を持つ', () => {
    for (const h of india) {
      expect(h.f).toBe('🇮🇳');
      expect(h.c).toBe('インド');
    }
  });
});
