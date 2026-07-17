import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

// 対象: HERITAGE_LISTへの「ル・コルビュジエの建築作品－近代建築運動への顕著な貢献－」
// (2016年7月17日登録、7カ国17資産の一括登録)の全構成資産の追加。
// 既存では日本・フランス・ドイツ・スイス・ベルギーの各1件(国名だけの汎用名)しか
// 登録されておらず、フランスに実在する残り9資産やアルゼンチン・インドの資産が
// 欠けていた。今回、17資産すべてを個別の資産名で登録し直した。
// 故障シナリオ:
//   (1) 資産数が17件に満たない/超える(重複追加・登録漏れ)
//   (2) 国別の内訳が公式の内訳(フランス10・スイス2・ベルギー1・ドイツ1・
//       日本1・アルゼンチン1・インド1)と一致しない
//   (3) 既存の国名だけの汎用エントリと新規の資産名付きエントリが重複して
//       同じ建物を二重登録してしまう(近接座標チェックで検出する)
//   (4) 登録年が2016以外になっている、またはUNESCO非構成資産としてy:'----'に
//       なってしまっている

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

describe('HERITAGE_LIST — ル・コルビュジエの建築作品(2016年・7カ国17資産)', () => {
  const corbusier = HERITAGE_LIST.filter((h) => h.n.includes('ル・コルビュジエ'));

  it('全17資産が登録されている', () => {
    expect(corbusier).toHaveLength(17);
  });

  it('国別の内訳が公式の構成(フランス10・スイス2・ベルギー1・ドイツ1・日本1・アルゼンチン1・インド1)と一致する', () => {
    const byCountry: Record<string, number> = {};
    corbusier.forEach((h) => { byCountry[h.c] = (byCountry[h.c] || 0) + 1; });
    expect(byCountry).toEqual({
      日本: 1,
      フランス: 10,
      ドイツ: 1,
      スイス: 2,
      ベルギー: 1,
      アルゼンチン: 1,
      インド: 1,
    });
  });

  it('全資産が2016年7月17日登録として記録されている', () => {
    corbusier.forEach((h) => {
      expect(h.y).toBe(2016);
      expect(h.md).toBe('07-17');
    });
  });

  it('全資産の座標が有効な緯度経度範囲内にある', () => {
    corbusier.forEach((h) => {
      expect(h.lat).toBeGreaterThanOrEqual(-90);
      expect(h.lat).toBeLessThanOrEqual(90);
      expect(h.lon).toBeGreaterThanOrEqual(-180);
      expect(h.lon).toBeLessThanOrEqual(180);
    });
  });

  it('日本の資産(国立西洋美術館)は既存のまま維持されている', () => {
    const japan = corbusier.find((h) => h.c === '日本');
    expect(japan).toMatchObject({ n: 'ル・コルビュジエの建築作品（国立西洋美術館）', f: '🇯🇵', lat: 35.71, lon: 139.77 });
  });

  it('フランス10資産すべての名称が含まれる', () => {
    const franceNames = corbusier.filter((h) => h.c === 'フランス').map((h) => h.n);
    expect(franceNames).toEqual(expect.arrayContaining([
      'ル・コルビュジエの建築作品（マルセイユのユニテ・ダビタシオン）',
      'ル・コルビュジエの建築作品（ラ・ロッシュ＝ジャンヌレ邸）',
      'ル・コルビュジエの建築作品（サヴォア邸と庭師小屋）',
      'ル・コルビュジエの建築作品（ペサックの集合住宅）',
      'ル・コルビュジエの建築作品（カップ・マルタンの休暇小屋）',
      'ル・コルビュジエの建築作品（ポルト・モリトーの集合住宅）',
      'ル・コルビュジエの建築作品（ロンシャンの礼拝堂）',
      'ル・コルビュジエの建築作品（ラ・トゥーレット修道院）',
      'ル・コルビュジエの建築作品（サン・ディエの工場）',
      'ル・コルビュジエの建築作品（フィルミニの文化の家）',
    ]));
  });

  it('スイス2資産(イムーブル・クラルテ／レマン湖畔の小さな家)が両方含まれる', () => {
    const swissNames = corbusier.filter((h) => h.c === 'スイス').map((h) => h.n);
    expect(swissNames).toEqual(expect.arrayContaining([
      'ル・コルビュジエの建築作品（イムーブル・クラルテ）',
      'ル・コルビュジエの建築作品（レマン湖畔の小さな家）',
    ]));
  });

  it('アルゼンチン(クルチェット邸)・インド(チャンディガール)が追加されている', () => {
    expect(corbusier.find((h) => h.c === 'アルゼンチン')).toMatchObject({ n: 'ル・コルビュジエの建築作品（クルチェット邸）', f: '🇦🇷' });
    expect(corbusier.find((h) => h.c === 'インド')).toMatchObject({ n: 'ル・コルビュジエの建築作品（チャンディガールのキャピトル・コンプレックス）', f: '🇮🇳' });
  });

  it('資産同士の座標が意図せず重複(同一地点への誤登録)していない(500m未満の近接ペアが無い)', () => {
    for (let i = 0; i < corbusier.length; i++) {
      for (let j = i + 1; j < corbusier.length; j++) {
        const d = haversineKm(corbusier[i].lat, corbusier[i].lon, corbusier[j].lat, corbusier[j].lon);
        expect(d, `${corbusier[i].n} と ${corbusier[j].n} が近すぎる(${d.toFixed(2)}km)`).toBeGreaterThan(0.5);
      }
    }
  });

  it('名称の重複が無い(17件すべてユニーク)', () => {
    const names = new Set(corbusier.map((h) => h.n));
    expect(names.size).toBe(17);
  });
});
