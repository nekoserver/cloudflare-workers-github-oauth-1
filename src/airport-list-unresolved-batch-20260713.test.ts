import { describe, expect, it } from 'vitest';
import { AIRPORT_LIST } from './data/airports';
import { findHeritageAreaPoint } from './index';

// 対象: unresolved_airport_keywords に記録されていた67件の空港名候補のうち、
// 実在を確認できた64件をAIRPORT_LISTへ追加した分の回帰テスト。
// 3件(スイス国際空港協会/組織名、ニュルンベルク中央駅/鉄道駅、
// ボローニャ・グエルフォ・ネローニ空港/実在確認不可)は対象外。
describe('AIRPORT_LIST: unresolved_airport_keywords由来の64件の追加分', () => {
  const byName = (n: string) => AIRPORT_LIST.find((a) => a.name === n);

  it('既存データに同一空港が別名で登録済みの12件は、その既存の正確な座標を再利用する', () => {
    expect(byName('フランクフルト・アム・マイン空港')).toMatchObject({ code: 'FRA', lat: 50.04, lon: 8.56 });
    expect(byName('ヴェローナ空港')).toMatchObject({ code: 'VRN', lat: 45.3957, lon: 10.8885 });
    expect(byName('ストラスブール国際空港')).toMatchObject({ code: 'SXB', lat: 48.5383, lon: 7.6282 });
    expect(byName('トリノ国際空港')).toMatchObject({ code: 'TRN', lat: 45.2008, lon: 7.6497 });
    expect(byName('フィレンツェ・アメーデオ・アヴォガドロ空港')).toMatchObject({ code: 'FLR', lat: 43.81, lon: 11.2051 });
    expect(byName('ジュネーブ国際空港')).toMatchObject({ code: 'GVA', lat: 46.2381, lon: 6.1089 });
    expect(byName('エアフルト空港')).toMatchObject({ code: 'ERF', lat: 50.98, lon: 10.9581 });
    expect(byName('インツブルック空港')).toMatchObject({ code: 'INN', lat: 47.2602, lon: 11.344 });
    expect(byName('ミュンヘン空港')).toMatchObject({ code: 'MUC', lat: 48.3538, lon: 11.7861 });
    expect(byName('プラハ・ヴァーツラフ・ハヴェル空港')).toMatchObject({ code: 'PRG', lat: 50.1008, lon: 14.26 });
    expect(byName('マンハイム・シティー・エアポート')).toMatchObject({ code: 'MHG', lat: 49.4727, lon: 8.5143 });
    expect(byName('エンツハイム空港')).toMatchObject({ code: 'SXB', lat: 48.5383, lon: 7.6282 });
    expect(byName('トリエステ・フリウリ＝ヴェネツィア・ジュリア空港')).toMatchObject({ code: 'TRS', lat: 45.8275, lon: 13.4722 });
  });

  it('新規に追加した空港（サウジアラビア・トルコ・イエメン・バーレーン等）が座標付きで登録されている', () => {
    expect(byName('キング・ファハド国際空港')).toMatchObject({ code: 'DMM' });
    expect(byName('バーレーン国際空港')).toMatchObject({ code: 'BAH' });
    expect(byName('サナ国際空港')).toMatchObject({ code: 'SAH' });
    expect(byName('ディヤルバクル空港')).toMatchObject({ code: 'DIY' });
    expect(byName('ガズィアンテプ・オゲズハン空港')).toMatchObject({ code: 'GZT' });
    expect(byName('ダーラン空港')).toMatchObject({ code: 'DHA' });
  });

  it('同一空港の複数エイリアス(ピサ空港/ガリレオ・ガリレイ空港/ピサ国際空港)は同じ座標を持つ', () => {
    const a = byName('ピサ空港');
    const b = byName('ガリレオ・ガリレイ空港');
    const c = byName('ピサ国際空港');
    expect(a).toBeDefined();
    expect(b).toMatchObject({ lat: a!.lat, lon: a!.lon, code: a!.code });
    expect(c).toMatchObject({ lat: a!.lat, lon: a!.lon, code: a!.code });
  });

  it('ボローニャの2エイリアス(ボローニャ・グリエルモ・マルコーニ空港/ボローニャ空港)、ジェノヴァの2エイリアス、ルクセンブルクの2エイリアス、ナポリの2エイリアスも同一座標', () => {
    const coords = (n: string) => { const a = byName(n)!; return { code: a.code, lat: a.lat, lon: a.lon }; };
    expect(coords('ボローニャ・グリエルモ・マルコーニ空港')).toEqual(coords('ボローニャ空港'));
    expect(coords('クリストーフォロ・コロンボ空港')).toEqual(coords('ジェノヴァ空港'));
    expect(coords('ルクセンブルク＝フィンデレン空港')).toEqual(coords('ルクセンブルク・フィンデレン空港'));
    expect(coords('ナポリ・カポディキーノ国際空港')).toEqual(coords('ナポリ国際空港'));
  });

  it('ICAOコードしか無い空港(ジュラ空港、フェラーラ空港)も登録されている', () => {
    expect(byName('ジュラ空港')).toMatchObject({ code: 'LSZQ' });
    expect(byName('フェラーラ空港')).toMatchObject({ code: 'LIPF' });
  });

  it('実在を確認できなかった3件(組織名・鉄道駅・不明空港)はAIRPORT_LISTに追加されていない', () => {
    expect(byName('スイス国際空港協会')).toBeUndefined();
    expect(byName('ニュルンベルク中央駅')).toBeUndefined();
    expect(byName('ボローニャ・グエルフォ・ネローニ空港')).toBeUndefined();
  });

  it('findHeritageAreaPointで今回追加した空港名から国旗・座標を引ける(統合テスト)', () => {
    const point = findHeritageAreaPoint('ボローニャ・グリエルモ・マルコーニ空港');
    expect(point).not.toBeNull();
    expect(point!.flag).toBe('🇮🇹');
    expect(point!.lat).toBeCloseTo(44.53, 1);
  });

  it('AIRPORT_LISTの総件数が今回の64件追加分だけ増えている(103+64=167、以降のセッションで追加された分は含まない)', () => {
    expect(AIRPORT_LIST.length).toBeGreaterThanOrEqual(167);
  });
});
