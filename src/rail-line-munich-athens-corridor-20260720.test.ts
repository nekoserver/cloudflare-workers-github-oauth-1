import { describe, expect, it } from 'vitest';
import { RAIL_LINES } from './data/railLines';

// 対象: 世界遺産地球儀(/webgl-heritage)の🚉鉄道サイドパネル(RAIL_LINES)。
// ユーザーからの「ドイツからギリシャ方面の路線図・乗換駅・路線名をまとめて」という
// 調査依頼(WebSearchでseat61.com等を調査)の結果を、実際に現在運行中の区間のみ
// RAIL_LINESへ追加した。ベオグラード～スコピエ～テッサロニキ間(2019年に完全運休)や
// ニシュ～ソフィア間・クラタ～テッサロニキ間(バス代替区間)は、鉄道路線データとして
// 実態と異なるため意図的に含めていない。
describe('RAIL_LINES — ミュンヘン～アテネ方面の現行運行区間(7路線)', () => {
  const corridorNames = [
    'ミュンヘン～ウィーン(ヴェストバーン/レイルジェット)',
    'ウィーン～ブダペスト(レイルジェット)',
    'ブダペスト～スボティツァ(セゲド経由)',
    'スボティツァ～ベオグラード(ソコ高速線)',
    'ベオグラード～ニシュ',
    'ソフィア～クラタ(ギリシャ国境)',
    'テッサロニキ～アテネ(ラリサ経由)',
  ];

  it('7路線すべてが登録されている', () => {
    corridorNames.forEach((name) => {
      const matches = RAIL_LINES.filter((l) => l.name === name);
      expect(matches, `${name} が見つからない`).toHaveLength(1);
    });
  });

  it('各路線の駅座標が有効な緯度経度範囲内である', () => {
    corridorNames.forEach((name) => {
      const line = RAIL_LINES.find((l) => l.name === name)!;
      line.stations.forEach((st) => {
        expect(st.lat).toBeGreaterThan(-90);
        expect(st.lat).toBeLessThan(90);
        expect(st.lon).toBeGreaterThan(-180);
        expect(st.lon).toBeLessThan(180);
      });
    });
  });

  it('各路線内で駅名の重複が無い', () => {
    corridorNames.forEach((name) => {
      const line = RAIL_LINES.find((l) => l.name === name)!;
      const names = line.stations.map((s) => s.name);
      expect(new Set(names).size, `${name} 内に重複駅名がある`).toBe(names.length);
    });
  });

  it('国境をまたぐ路線は駅ごとの国旗が正しく設定されている(ミュンヘン～ウィーン: 独→墺)', () => {
    const line = RAIL_LINES.find((l) => l.name === 'ミュンヘン～ウィーン(ヴェストバーン/レイルジェット)')!;
    expect(line.stations[0]).toMatchObject({ name: 'ミュンヘン中央駅', flag: '🇩🇪', country: 'ドイツ' });
    expect(line.stations[1]).toMatchObject({ name: 'ウィーン中央駅', flag: '🇦🇹', country: 'オーストリア' });
  });

  it('国境をまたぐ路線は駅ごとの国旗が正しく設定されている(ウィーン～ブダペスト: 墺→洪)', () => {
    const line = RAIL_LINES.find((l) => l.name === 'ウィーン～ブダペスト(レイルジェット)')!;
    expect(line.stations[0]).toMatchObject({ flag: '🇦🇹', country: 'オーストリア' });
    expect(line.stations[1]).toMatchObject({ name: 'ブダペスト東駅', flag: '🇭🇺', country: 'ハンガリー' });
  });

  it('国境をまたぐ路線は駅ごとの国旗が正しく設定されている(ブダペスト～スボティツァ: 洪→塞、セゲド経由)', () => {
    const line = RAIL_LINES.find((l) => l.name === 'ブダペスト～スボティツァ(セゲド経由)')!;
    expect(line.stations.map((s) => s.name)).toEqual(['ブダペスト東駅', 'セゲド駅', 'スボティツァ駅']);
    expect(line.stations[0].country).toBe('ハンガリー');
    expect(line.stations[1].country).toBe('ハンガリー');
    expect(line.stations[2]).toMatchObject({ flag: '🇷🇸', country: 'セルビア' });
  });

  it('ミュンヘン中央駅は既存のICE路線と同一座標を再利用している(データ重複による座標ズレ防止)', () => {
    const existing = RAIL_LINES.find((l) => l.name === 'ICE(ハノーファー～ニュルンベルク～ミュンヘン)')!;
    const existingMunich = existing.stations.find((s) => s.name === 'ミュンヘン中央駅')!;
    const newLine = RAIL_LINES.find((l) => l.name === 'ミュンヘン～ウィーン(ヴェストバーン/レイルジェット)')!;
    const newMunich = newLine.stations.find((s) => s.name === 'ミュンヘン中央駅')!;
    expect(newMunich.lat).toBe(existingMunich.lat);
    expect(newMunich.lon).toBe(existingMunich.lon);
  });

  it('ベオグラード中央駅は「スボティツァ～ベオグラード」と「ベオグラード～ニシュ」の両路線で同一座標', () => {
    const soko = RAIL_LINES.find((l) => l.name === 'スボティツァ～ベオグラード(ソコ高速線)')!;
    const nis = RAIL_LINES.find((l) => l.name === 'ベオグラード～ニシュ')!;
    const a = soko.stations.find((s) => s.name === 'ベオグラード中央駅')!;
    const b = nis.stations.find((s) => s.name === 'ベオグラード中央駅')!;
    expect(a.lat).toBe(b.lat);
    expect(a.lon).toBe(b.lon);
  });

  it('「クラタ駅」はギリシャのクレタ島(クレタ)と表記が混同されない(ブルガリア国境のKulata駅)', () => {
    const line = RAIL_LINES.find((l) => l.name === 'ソフィア～クラタ(ギリシャ国境)')!;
    expect(line.stations.map((s) => s.name)).toContain('クラタ駅');
    expect(line.stations.map((s) => s.name)).not.toContain('クレタ駅');
  });

  it('テッサロニキ～アテネはラリサ経由で3駅、緯度が南下するにつれて減少する', () => {
    const line = RAIL_LINES.find((l) => l.name === 'テッサロニキ～アテネ(ラリサ経由)')!;
    expect(line.stations.map((s) => s.name)).toEqual(['テッサロニキ駅', 'ラリサ駅', 'アテネ・ラリシス駅']);
    const lats = line.stations.map((s) => s.lat);
    expect(lats[0]).toBeGreaterThan(lats[1]);
    expect(lats[1]).toBeGreaterThan(lats[2]);
  });

  it('現在バス代替・完全運休中の区間(ベオグラード～スコピエ～テッサロニキ、ニシュ～ソフィア、クラタ～テッサロニキ)は含まれていない', () => {
    const suspiciousNames = ['スコピエ', 'ソフィア～ニシュ', 'ニシュ～ソフィア', 'クラタ～テッサロニキ'];
    RAIL_LINES.forEach((line) => {
      suspiciousNames.forEach((bad) => {
        expect(line.name).not.toContain(bad);
      });
    });
  });
});
