import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

// 対象: HERITAGE_LIST のフィンランドの世界遺産。
//
// 背景: フィンランドはUNESCO公式で7件（文化6・自然1）登録されているが、
// HERITAGE_LIST にはラウマ旧市街の1件しか入っていなかったため、残る6件を
// 座標付きで追加した。
//
// 故障シナリオ:
//   (1) 件数・種別内訳がUNESCO公式（文化6・自然1）と食い違う
//   (2) 座標がフィンランドの範囲外（緯度経度の入れ違い・符号ミス）
//   (3) 越境資産（クヴァルケン群島／高海岸）の国名にスウェーデンが反映されない
//   (4) 10か国にまたがるシュトルーヴェの測地弧が、既に登録済みのノルウェー地点と
//       名称衝突する／国別に区別できなくなる

const HERITAGE_TYPES = new Set(['文化遺産', '自然遺産', '複合遺産']);

describe('HERITAGE_LIST — フィンランドの世界遺産7件', () => {
  const finland = HERITAGE_LIST.filter((h) => h.f === '🇫🇮' && HERITAGE_TYPES.has(h.t));

  it('フィンランドの世界遺産が7件登録されている(重複なし)', () => {
    const names = finland.map((h) => h.n);
    expect(new Set(names).size).toBe(names.length);
    expect(finland.length).toBe(7);
  });

  it('種別の内訳がUNESCO公式と一致する(文化6・自然1)', () => {
    const count = (t: string) => finland.filter((h) => h.t === t).length;
    expect(count('文化遺産')).toBe(6);
    expect(count('自然遺産')).toBe(1);
    expect(count('複合遺産')).toBe(0);
  });

  it('1991年登録の2件(ラウマ旧市街・スオメンリンナ)が揃っている', () => {
    const y1991 = finland.filter((h) => h.y === 1991).map((h) => h.n);
    expect(y1991).toHaveLength(2);
    expect(y1991).toContain('ラウマ旧市街');
    expect(y1991).toContain('スオメンリンナの要塞群');
  });

  it('追加した6件の名称・登録年が正しい', () => {
    const expected: Array<{ n: string; y: number }> = [
      { n: 'スオメンリンナの要塞群', y: 1991 },
      { n: 'ペタヤヴェシの古い教会', y: 1994 },
      { n: 'ヴェルラ砕木・板紙工場', y: 1996 },
      { n: 'サンマルラハデンマキの青銅器時代の墳墓群', y: 1999 },
      { n: 'シュトルーヴェの測地弧（フィンランド）', y: 2005 },
      { n: 'クヴァルケン群島／高海岸', y: 2006 },
    ];
    for (const e of expected) {
      const item = finland.find((h) => h.n === e.n);
      expect(item, `${e.n} が見つからない`).toBeDefined();
      expect(item!.y).toBe(e.y);
    }
  });

  it('唯一の自然遺産クヴァルケン群島／高海岸はスウェーデンとの越境資産である', () => {
    const natural = finland.filter((h) => h.t === '自然遺産');
    expect(natural).toHaveLength(1);
    expect(natural[0].n).toBe('クヴァルケン群島／高海岸');
    expect(natural[0].c).toContain('フィンランド');
    expect(natural[0].c).toContain('スウェーデン');
  });

  it('シュトルーヴェの測地弧は国名を括弧で区別し既存のノルウェー地点と共存する', () => {
    const struve = HERITAGE_LIST.filter((h) => h.n.includes('シュトルーヴェの測地弧'));
    expect(struve.length).toBeGreaterThanOrEqual(2);
    const flags = struve.map((h) => h.f);
    expect(flags).toContain('🇫🇮');
    expect(flags).toContain('🇳🇴');
    // 名称が国別に一意（同名衝突しない）
    const names = struve.map((h) => h.n);
    expect(new Set(names).size).toBe(names.length);
    // フィンランド地点はアーヴァサクサ周辺（北緯66度台）
    const fi = struve.find((h) => h.f === '🇫🇮')!;
    expect(fi.lat).toBeGreaterThan(65);
    expect(fi.lat).toBeLessThan(67);
  });

  it('全件の座標が有効かつフィンランドの範囲内に収まっている', () => {
    for (const h of finland) {
      expect(h.lat).toBeGreaterThan(-90);
      expect(h.lat).toBeLessThan(90);
      expect(h.lon).toBeGreaterThan(-180);
      expect(h.lon).toBeLessThan(180);
      // フィンランドはおおよそ北緯59.5〜70.2度、東経19〜32度に収まる
      expect(h.lat).toBeGreaterThan(59.5);
      expect(h.lat).toBeLessThan(70.2);
      expect(h.lon).toBeGreaterThan(19);
      expect(h.lon).toBeLessThan(32);
    }
  });

  it('全件が国旗🇫🇮を持ち、国名にフィンランドを含む', () => {
    for (const h of finland) {
      expect(h.f).toBe('🇫🇮');
      expect(h.c).toContain('フィンランド');
    }
  });
});
