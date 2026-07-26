import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

// 対象: HERITAGE_LIST の南アフリカの世界遺産。
//
// 背景: 従来は3件(ロベン島・フレデフォート・ドーム・名称が壊れた1件)しか無く、
// さらにロベン島が完全重複で2行登録されていた。UNESCO公式の全12件
// (文化7・自然4・複合1)を座標付きで揃え、重複を解消した。
//
// 故障シナリオ:
//   (1) 同一遺産が重複登録される(ロベン島で実際に発生していた)
//   (2) 件数・種別内訳がUNESCO公式(文化7・自然4・複合1)と食い違う
//   (3) 座標が南部アフリカの範囲外(緯度の符号ミス・経度の取り違え)
//   (4) 名称と座標が対応しない(旧「ウカンブンバ考古学遺跡」は名称が
//       ドラケンスバーグ風なのに座標は人類化石遺跡群のものだった)

const HERITAGE_TYPES = new Set(['文化遺産', '自然遺産', '複合遺産']);

describe('HERITAGE_LIST — 南アフリカの世界遺産12件', () => {
  const za = HERITAGE_LIST.filter((h) => h.f === '🇿🇦' && HERITAGE_TYPES.has(h.t));

  it('南アフリカの世界遺産が12件登録されている(重複なし)', () => {
    const names = za.map((h) => h.n);
    expect(new Set(names).size).toBe(names.length);
    expect(za.length).toBe(12);
  });

  it('ロベン島が重複登録されていない(旧不具合の修正確認)', () => {
    const robben = za.filter((h) => h.n.includes('ロベン島'));
    expect(robben).toHaveLength(1);
    expect(robben[0].y).toBe(1999);
  });

  it('種別の内訳がUNESCO公式と一致する(文化7・自然4・複合1)', () => {
    const count = (t: string) => za.filter((h) => h.t === t).length;
    expect(count('文化遺産')).toBe(7);
    expect(count('自然遺産')).toBe(4);
    expect(count('複合遺産')).toBe(1);
  });

  it('1999年登録の3件が揃っている', () => {
    const y1999 = za.filter((h) => h.y === 1999).map((h) => h.n);
    expect(y1999).toHaveLength(3);
    expect(y1999).toContain('ロベン島');
    expect(y1999).toContain('イシマンガリソ湿地公園');
    expect(y1999.some((n) => n.includes('人類化石遺跡群'))).toBe(true);
  });

  it('唯一の複合遺産はマロティ＝ドラケンスバーグ公園(レソトとの越境資産)である', () => {
    const mixed = za.filter((h) => h.t === '複合遺産');
    expect(mixed).toHaveLength(1);
    expect(mixed[0].n).toBe('マロティ＝ドラケンスバーグ公園');
    expect(mixed[0].y).toBe(2000);
    expect(mixed[0].c).toContain('レソト');
  });

  it('2024年登録の2件(マンデラ関連遺跡群・更新世の居住遺跡群)が登録されている', () => {
    const y2024 = za.filter((h) => h.y === 2024);
    expect(y2024).toHaveLength(2);
    expect(y2024.some((h) => h.n.includes('ネルソン・マンデラ'))).toBe(true);
    expect(y2024.some((h) => h.n.includes('更新世'))).toBe(true);
  });

  it('全件の座標が有効かつ南部アフリカの範囲内に収まっている', () => {
    for (const h of za) {
      expect(h.lat).toBeGreaterThan(-90);
      expect(h.lat).toBeLessThan(90);
      expect(h.lon).toBeGreaterThan(-180);
      expect(h.lon).toBeLessThan(180);
      // 南アフリカはおおよそ南緯21〜35度、東経16〜33度に収まる
      expect(h.lat).toBeGreaterThan(-35);
      expect(h.lat).toBeLessThan(-21);
      expect(h.lon).toBeGreaterThan(16);
      expect(h.lon).toBeLessThan(33.5);
    }
  });

  it('人類化石遺跡群の座標がスタークフォンテン周辺である(名称と座標の対応)', () => {
    const fossil = za.find((h) => h.n.includes('人類化石遺跡群'));
    expect(fossil).toBeDefined();
    expect(fossil!.t).toBe('文化遺産');
    expect(fossil!.lat).toBeCloseTo(-26.01, 1);
    expect(fossil!.lon).toBeCloseTo(27.73, 1);
  });

  it('全件が国旗🇿🇦を持ち、国名に南アフリカを含む', () => {
    for (const h of za) {
      expect(h.f).toBe('🇿🇦');
      expect(h.c).toContain('南アフリカ');
    }
  });
});
