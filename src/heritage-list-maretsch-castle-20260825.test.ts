import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

// 対象: ボルツァーノの「メレッチョ城」(Castel Mareccio / Schloss Maretsch)。
// UNESCO世界遺産リストには単独資産としてもシリアル資産の構成資産としても
// 登録されていないため、観光史跡として登録年を y:'----' にする。

const HERITAGE_TYPES = new Set(['文化遺産', '自然遺産', '複合遺産']);

describe('HERITAGE_LIST — メレッチョ城(ボルツァーノ・非世界遺産)', () => {
  it('メレッチョ城が1件登録されている', () => {
    expect(HERITAGE_LIST.filter((h) => h.n === 'メレッチョ城')).toHaveLength(1);
  });

  it('非世界遺産として登録年は"----"で、UNESCO遺産種別を名乗らない', () => {
    const item = HERITAGE_LIST.find((h) => h.n === 'メレッチョ城')!;
    expect(item.y).toBe('----');
    expect(item.t).toBe('史跡');
    expect(HERITAGE_TYPES.has(item.t)).toBe(false);
  });

  it('イタリアの国旗・国名と城アイコンを持つ', () => {
    const item = HERITAGE_LIST.find((h) => h.n === 'メレッチョ城')!;
    expect(item.f).toBe('🇮🇹');
    expect(item.c).toBe('イタリア');
    expect(item.e).toBe('🏰');
  });

  it('座標がボルツァーノ市街のメレッチョ城付近にある', () => {
    const item = HERITAGE_LIST.find((h) => h.n === 'メレッチョ城')!;
    expect(item.lat).toBeCloseTo(46.5050, 4);
    expect(item.lon).toBeCloseTo(11.3463, 4);
  });
});
