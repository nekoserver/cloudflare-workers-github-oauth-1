import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

// 対象: HERITAGE_LIST の「ハイデルベルク城と旧市街」(ドイツ)。
//
// 背景: ユーザーから提示されたハイデルベルク城とマルクト広場(ヘラクレス噴水)の写真について
// UNESCO世界遺産かどうかを調査した。ハイデルベルク(旧市街と城)はドイツの暫定リスト
// (Tentative List)には掲載されているが、2005年・2007年の審査で登録延期(申請差し戻し)と
// なっており、現在も正式なUNESCO世界遺産には登録されていないことを確認した。
//
// また調査の過程で、既存データに事実誤りを発見した: 修正前は
// {n:'ハイデルベルク旧市街（ライン川上流）', t:'文化遺産', y:2024, lat:49.41, lon:8.71}
// という「2024年に文化遺産として登録された」エントリが存在していたが、
//   (1) ドイツの2024年UNESCO新規登録は「シュヴェリーン王宮群」と「ヘルンフート同胞教団の
//       ザクセン入植地群」の2件のみで、ハイデルベルクは含まれない
//   (2) 実在する「上中ライン渓谷」(Upper Middle Rhine Valley, 2002年登録)は
//       ビンゲン〜コブレンツ間のライン川本流沿いであり、ネッカー川沿いのハイデルベルクとは
//       地理的に別の資産(HERITAGE_LISTにも別途正しいエントリが存在する: lat:50.15,lon:7.68)
// という2点から、この「2024年文化遺産」エントリは事実に反する誤ったデータだったため、
// 本来の状態(UNESCO未登録、y:'----')の正しいエントリに置き換えた。
//
// 故障シナリオ:
//   (1) 誤った「UNESCO文化遺産・2024年登録」のデータが残り、実際の登録状況と矛盾したまま
//   (2) 座標がハイデルベルクの範囲外(緯度経度の入れ違い・符号ミス)
//   (3) 実在する「上中ライン渓谷」(2002年)のエントリと混同・重複する

const HERITAGE_TYPES = new Set(['文化遺産', '自然遺産', '複合遺産']);

describe('HERITAGE_LIST — ハイデルベルク城と旧市街(非世界遺産)', () => {
  it('ハイデルベルク城と旧市街が1件登録されている', () => {
    const items = HERITAGE_LIST.filter((h) => h.n === 'ハイデルベルク城と旧市街');
    expect(items).toHaveLength(1);
  });

  it('登録年は"----"(世界遺産ではない)であり、UNESCO種別(文化/自然/複合遺産)を名乗らない', () => {
    const item = HERITAGE_LIST.find((h) => h.n === 'ハイデルベルク城と旧市街')!;
    expect(item.y).toBe('----');
    expect(HERITAGE_TYPES.has(item.t)).toBe(false);
  });

  it('誤って登録されていた「ハイデルベルク旧市街（ライン川上流）」2024年文化遺産エントリは存在しない', () => {
    const wrongEntry = HERITAGE_LIST.find((h) => h.n === 'ハイデルベルク旧市街（ライン川上流）');
    expect(wrongEntry).toBeUndefined();
  });

  it('国旗🇩🇪・国名ドイツが設定されている', () => {
    const item = HERITAGE_LIST.find((h) => h.n === 'ハイデルベルク城と旧市街')!;
    expect(item.f).toBe('🇩🇪');
    expect(item.c).toBe('ドイツ');
  });

  it('座標がハイデルベルク市内の範囲に収まっている(北緯49.3〜49.5度・東経8.6〜8.8度)', () => {
    const item = HERITAGE_LIST.find((h) => h.n === 'ハイデルベルク城と旧市街')!;
    expect(item.lat).toBeGreaterThan(49.3);
    expect(item.lat).toBeLessThan(49.5);
    expect(item.lon).toBeGreaterThan(8.6);
    expect(item.lon).toBeLessThan(8.8);
  });

  it('実在する「上中ライン渓谷」(2002年、UNESCO文化遺産)とは別エントリであり、地理的にも離れている', () => {
    const heidelberg = HERITAGE_LIST.find((h) => h.n === 'ハイデルベルク城と旧市街')!;
    const rhineValley = HERITAGE_LIST.find((h) => h.n === '上中ライン渓谷');
    expect(rhineValley).toBeDefined();
    expect(rhineValley!.y).toBe(2002);
    expect(HERITAGE_TYPES.has(rhineValley!.t)).toBe(true);
    // 2地点の距離がおおよそ100km以上離れていることを確認(同一資産の誤記ではない)
    const dLat = Math.abs(heidelberg.lat - rhineValley!.lat);
    const dLon = Math.abs(heidelberg.lon - rhineValley!.lon);
    expect(dLat > 0.5 || dLon > 0.5).toBe(true);
  });
});
