import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

// 対象: イタリアの世界遺産リスト。2025年7月12日(第47回世界遺産委員会)に
// 登録され、イタリア61件目の世界遺産となった「サルデーニャ先史時代の
// 葬送伝統－ドムス・デ・ジャナス」と、2023年に登録された「北アペニン
// 山脈の石膏カルストと洞窟群」が未収録だったため追加する。
// 座標はいずれもシリアル(複数構成資産)サイトのため、最も著名かつ
// 主導自治体に近い構成資産の座標を代表点として採用した
// (ドムス・デ・ジャナス: アンゲル・ルジュ墳墓群/アルゲーロ、
//  石膏カルスト: ヴェーナ・デル・ジェッソ・ロマニョーラ州立公園)。
describe('HERITAGE_LIST — イタリアの2023・2025年登録世界遺産', () => {
  it('2025年登録「ドムス・デ・ジャナス」(イタリア61件目)を含む', () => {
    const site = HERITAGE_LIST.find((item) => item.n.includes('ドムス・デ・ジャナス'));
    expect(site).toBeDefined();
    expect(site).toMatchObject({
      f: '🇮🇹',
      c: 'イタリア',
      t: '文化遺産',
      y: 2025,
    });
    expect(site!.lat).toBeCloseTo(40.63287, 1);
    expect(site!.lon).toBeCloseTo(8.32649, 1);
  });

  it('2023年登録「北アペニン山脈の石膏カルストと洞窟群」を含む', () => {
    const site = HERITAGE_LIST.find((item) => item.n.includes('石膏カルスト'));
    expect(site).toBeDefined();
    expect(site).toMatchObject({
      f: '🇮🇹',
      c: 'イタリア',
      t: '自然遺産',
      y: 2023,
    });
    expect(site!.lat).toBeCloseTo(44.24249, 1);
    expect(site!.lon).toBeCloseTo(11.67388, 1);
  });

  it('追加した2件は座標がイタリア国内の妥当な範囲(北緯35-47度・東経6-19度)にある', () => {
    const sites = HERITAGE_LIST.filter((item) => item.n.includes('ドムス・デ・ジャナス') || item.n.includes('石膏カルスト'));
    expect(sites).toHaveLength(2);
    for (const item of sites) {
      expect(item.lat).toBeGreaterThan(35);
      expect(item.lat).toBeLessThan(47);
      expect(item.lon).toBeGreaterThan(6);
      expect(item.lon).toBeLessThan(19);
    }
  });
});
