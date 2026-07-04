import { describe, expect, it } from 'vitest';
import { RAIL_LINES } from './data/railLines';

describe('RAIL_LINES — フレッチャロッサ(ミラノ～レッジョ・ディ・カラブリア)', () => {
  const line = RAIL_LINES.find((l) => l.name.includes('フレッチャロッサ'));

  it('路線が1件だけ登録されている', () => {
    const matches = RAIL_LINES.filter((l) => l.name.includes('フレッチャロッサ'));
    expect(matches).toHaveLength(1);
  });

  it('ミラノ～ナポリ間の既存4駅にレッジョ・エミリアAV駅が追加され、ナポリより先の5駅が延伸区間として追加されている', () => {
    expect(line).toBeDefined();
    expect(line!.stations.map((s) => s.name)).toEqual([
      'ミラノ中央駅',
      'レッジョ・エミリアAV駅',
      'ボローニャ中央駅',
      'フィレンツェSMN駅',
      'ローマ・テルミニ駅',
      'ナポリ中央駅',
      'サレルノ駅',
      'パオラ駅',
      'ラメツィア・テルメ・チェントラーレ駅',
      'ロザルノ駅',
      'レッジョ・ディ・カラブリア・チェントラーレ駅',
    ]);
  });

  it('各駅の座標が有効な範囲内である', () => {
    for (const station of line!.stations) {
      expect(station.lat).toBeGreaterThan(-90);
      expect(station.lat).toBeLessThan(90);
      expect(station.lon).toBeGreaterThan(-180);
      expect(station.lon).toBeLessThan(180);
    }
  });

  it('駅の座標は南下する経路に沿って緯度が概ね減少する（ミラノ→レッジョ・ディ・カラブリア）', () => {
    const lats = line!.stations.map((s) => s.lat);
    expect(lats[0]).toBeGreaterThan(lats[lats.length - 1]);
  });

  it('駅名の重複が無い', () => {
    const names = line!.stations.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('路線名がミラノ～レッジョ・ディ・カラブリアの延伸区間を反映している', () => {
    expect(line!.name).toBe('フレッチャロッサ(ミラノ～レッジョ・ディ・カラブリア)');
  });
});
