import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

// 対象: 2026-07-26 に第48回世界遺産委員会（釜山）で登録された
//       イタリア62件目・フランス56件目の世界遺産2件。
//
// 背景:
//   - イタリア: 「中部イタリアの18-19世紀のイタリア式コンドミニオ劇場システム」
//     マルケ州14・エミリア＝ロマーニャ州2・ウンブリア州2の計18劇場からなるシリアル資産。
//     マルケ州が申請を主導したため、代表点はマルケ州の構成資産テアトロ・ペルゴレージ
//     （イエジ）を採用した。
//   - フランス: 「ラングドックのカペー王家要塞群」
//     アギラール・カルカソンヌ・ラストゥール・モンセギュール・ペイルペルテューズ・
//     ピュイローラン・ケリビュス・テルムの8要塞からなるシリアル資産。
//     カルカソンヌは1997年登録の別資産として既に登録済みで座標が重複するため、
//     代表点は最も象徴的な構成資産ペイルペルテューズ城を採用した。
//
// 故障シナリオ:
//   (1) 2026年登録として登録されない（登録年の取り違え）
//   (2) 座標が当該国の範囲外（緯度経度の入れ違い）
//   (3) 既存の同名資産と重複登録される（カルカソンヌ等）
//   (4) 登録日(md)が設定されず月日不明として扱われる

describe('HERITAGE_LIST — 2026年登録のイタリア・フランスの世界遺産', () => {
  const italy = HERITAGE_LIST.find((h) => h.n.includes('コンドミニオ劇場'));
  const france = HERITAGE_LIST.find((h) => h.n.includes('カペー王家要塞'));

  it('イタリア: 中部イタリアのコンドミニオ劇場システムが2026年文化遺産として登録されている', () => {
    expect(italy).toBeDefined();
    expect(italy!.n).toBe('中部イタリアの18-19世紀のイタリア式コンドミニオ劇場システム');
    expect(italy!.f).toBe('🇮🇹');
    expect(italy!.c).toBe('イタリア');
    expect(italy!.t).toBe('文化遺産');
    expect(italy!.y).toBe(2026);
  });

  it('イタリア: 代表点がマルケ州イエジのテアトロ・ペルゴレージ周辺である', () => {
    expect(italy!.lat).toBeCloseTo(43.52, 1);
    expect(italy!.lon).toBeCloseTo(13.24, 1);
    // イタリア本土はおおよそ北緯36〜47.5度、東経6〜19度
    expect(italy!.lat).toBeGreaterThan(36);
    expect(italy!.lat).toBeLessThan(47.5);
    expect(italy!.lon).toBeGreaterThan(6);
    expect(italy!.lon).toBeLessThan(19);
  });

  it('フランス: ラングドックのカペー王家要塞群が2026年文化遺産として登録されている', () => {
    expect(france).toBeDefined();
    expect(france!.n).toBe('ラングドックのカペー王家要塞群');
    expect(france!.f).toBe('🇫🇷');
    expect(france!.c).toBe('フランス');
    expect(france!.t).toBe('文化遺産');
    expect(france!.y).toBe(2026);
  });

  it('フランス: 代表点がペイルペルテューズ城周辺である', () => {
    expect(france!.lat).toBeCloseTo(42.87, 1);
    expect(france!.lon).toBeCloseTo(2.56, 1);
    // フランス本土はおおよそ北緯41〜51.5度、東経-5〜10度
    expect(france!.lat).toBeGreaterThan(41);
    expect(france!.lat).toBeLessThan(51.5);
    expect(france!.lon).toBeGreaterThan(-5);
    expect(france!.lon).toBeLessThan(10);
  });

  it('両件に登録日(md=07-26)が設定されている', () => {
    expect(italy!.md).toBe('07-26');
    expect(france!.md).toBe('07-26');
  });

  it('1997年登録のカルカソンヌ歴史的城塞都市と重複していない(別資産として共存)', () => {
    const carcassonne = HERITAGE_LIST.filter((h) => h.n.includes('カルカソンヌ'));
    // カルカソンヌはカペー王家要塞群の構成資産だが、1997年の独立した資産としても登録済み。
    // 代表点を別の構成資産にしたため座標が重複しない。
    for (const c of carcassonne) {
      expect(c.n).not.toBe(france!.n);
      const sameCoord = c.lat === france!.lat && c.lon === france!.lon;
      expect(sameCoord).toBe(false);
    }
  });

  it('HERITAGE_LIST全体で国旗+名称の重複が無い', () => {
    const keys = HERITAGE_LIST.map((h) => h.f + '|' + h.n);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
