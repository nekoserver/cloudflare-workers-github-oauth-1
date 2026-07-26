import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

// 対象: HERITAGE_LIST のニジェールの世界遺産。
//
// 背景: ニジェールは UNESCO 公式で3件（自然2・文化1）登録されているが、
// HERITAGE_LIST には1件も入っていなかったため全3件を座標付きで追加した。
//
// 故障シナリオ:
//   (1) 件数・種別内訳がUNESCO公式（自然2・文化1）と食い違う
//   (2) 座標がニジェール周辺の範囲外（緯度経度の入れ違い・符号ミス）
//   (3) 越境資産の国名に共同登録国が反映されない
//   (4) 名称の重複登録

const HERITAGE_TYPES = new Set(['文化遺産', '自然遺産', '複合遺産']);

describe('HERITAGE_LIST — ニジェールの世界遺産3件', () => {
  const niger = HERITAGE_LIST.filter((h) => h.f === '🇳🇪' && HERITAGE_TYPES.has(h.t));

  it('ニジェールの世界遺産が3件登録されている(重複なし)', () => {
    const names = niger.map((h) => h.n);
    expect(new Set(names).size).toBe(names.length);
    expect(niger.length).toBe(3);
  });

  it('種別の内訳がUNESCO公式と一致する(自然2・文化1)', () => {
    const count = (t: string) => niger.filter((h) => h.t === t).length;
    expect(count('自然遺産')).toBe(2);
    expect(count('文化遺産')).toBe(1);
    expect(count('複合遺産')).toBe(0);
  });

  it('アイールとテネレの自然保護区群(1991)が登録されている', () => {
    const air = niger.find((h) => h.n.includes('アイールとテネレ'));
    expect(air).toBeDefined();
    expect(air!.y).toBe(1991);
    expect(air!.t).toBe('自然遺産');
    // 保護区は北緯17°14′〜20°30′、東経8°00′〜10°57′に広がる
    expect(air!.lat).toBeGreaterThan(17);
    expect(air!.lat).toBeLessThan(20.6);
    expect(air!.lon).toBeGreaterThan(8);
    expect(air!.lon).toBeLessThan(11);
  });

  it('W・アルリ・パンジャリ複合自然公園群(1996)が3か国の越境資産として登録されている', () => {
    const w = niger.find((h) => h.n.includes('パンジャリ'));
    expect(w).toBeDefined();
    expect(w!.y).toBe(1996);
    expect(w!.t).toBe('自然遺産');
    expect(w!.c).toContain('ニジェール');
    expect(w!.c).toContain('ブルキナファソ');
    expect(w!.c).toContain('ベナン');
  });

  it('アガデス歴史地区(2013)が唯一の文化遺産として登録されている', () => {
    const cultural = niger.filter((h) => h.t === '文化遺産');
    expect(cultural).toHaveLength(1);
    expect(cultural[0].n).toBe('アガデス歴史地区');
    expect(cultural[0].y).toBe(2013);
    // アガデス市街の座標
    expect(cultural[0].lat).toBeCloseTo(16.97, 1);
    expect(cultural[0].lon).toBeCloseTo(7.99, 1);
  });

  it('全件の座標が有効かつニジェール周辺の範囲内に収まっている', () => {
    for (const h of niger) {
      expect(h.lat).toBeGreaterThan(-90);
      expect(h.lat).toBeLessThan(90);
      expect(h.lon).toBeGreaterThan(-180);
      expect(h.lon).toBeLessThan(180);
      // ニジェールはおおよそ北緯11〜24度、東経0〜16度に収まる
      expect(h.lat).toBeGreaterThan(11);
      expect(h.lat).toBeLessThan(24);
      expect(h.lon).toBeGreaterThan(0);
      expect(h.lon).toBeLessThan(16);
    }
  });

  it('全件が国旗🇳🇪を持ち、国名にニジェールを含む', () => {
    for (const h of niger) {
      expect(h.f).toBe('🇳🇪');
      expect(h.c).toContain('ニジェール');
    }
  });
});
