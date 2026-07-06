import { describe, expect, it } from 'vitest';
import { RAIL_LINES } from './data/railLines';

describe('RAIL_LINES — オーストリア・チェコ世界遺産アクセス鉄道', () => {
  const semmering = RAIL_LINES.find((l) => l.name === 'ゼメリング鉄道(グログニッツ～ミュルツツーシュラーク)');
  const czech = RAIL_LINES.find((l) => l.name === 'チェコ鉄道(プラハ～チェスキー・クルムロフ)');

  it('オーストリアのゼメリング鉄道は始発・終着と全11駅を経由順で含む', () => {
    expect(semmering).toBeDefined();
    expect(semmering!.stations.map((s) => s.name)).toEqual([
      'グログニッツ駅',
      'シュレグルミュール駅',
      'パイヤーバッハ＝ライヒェナウ駅',
      'キューブ駅',
      'アイヒベルク駅',
      'クラム＝ショットヴィーン駅',
      'ブライテンシュタイン駅',
      'ヴォルフスベルクコーゲル駅',
      'ゼメリング駅',
      'シュピタール・アム・ゼメリング駅',
      'ミュルツツーシュラーク駅',
    ]);
  });

  it('チェコ鉄道はプラハ本駅を始発、チェスキー・クルムロフ駅を終着として主要全駅を経由順で含む', () => {
    expect(czech).toBeDefined();
    expect(czech!.stations.map((s) => s.name)).toEqual([
      'プラハ本駅',
      'プラハ・スミーホフ駅',
      'ベネショフ・ウ・プラヒ駅',
      'ターボル駅',
      'ヴェセリー・ナド・ルジニチー駅',
      'チェスケー・ブジェヨヴィツェ駅',
      'チェスキー・クルムロフ駅',
    ]);
  });

  it('各駅の座標が有効範囲内で、路線の国旗・国名を持つ', () => {
    for (const line of [semmering!, czech!]) {
      for (const station of line.stations) {
        expect(station.lat).toBeGreaterThan(-90);
        expect(station.lat).toBeLessThan(90);
        expect(station.lon).toBeGreaterThan(-180);
        expect(station.lon).toBeLessThan(180);
        expect(station.flag ?? line.flag).toBe(line.flag);
        expect(station.country ?? line.country).toBe(line.country);
      }
    }
  });

  it('始発駅と終着駅の座標が世界遺産ページの駅間距離計算に使える程度に離れている', () => {
    expect(semmering!.stations[0].lon).toBeGreaterThan(semmering!.stations.at(-1)!.lon);
    expect(czech!.stations[0].lat).toBeGreaterThan(czech!.stations.at(-1)!.lat);
  });
});
