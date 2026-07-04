import { describe, expect, it } from 'vitest';
import { RAIL_LINES } from './data/railLines';

describe('RAIL_LINES — ベルニナ急行(クール～ティラーノ)', () => {
  const line = RAIL_LINES.find((l) => l.name === 'ベルニナ急行(クール～ティラーノ)');

  it('路線が1件だけ登録されている', () => {
    const matches = RAIL_LINES.filter((l) => l.name.includes('ベルニナ急行'));
    expect(matches).toHaveLength(1);
  });

  it('実在する13駅をすべて含む（クール〜ティラーノ、経由順）', () => {
    expect(line).toBeDefined();
    expect(line!.stations.map((s) => s.name)).toEqual([
      'クール駅',
      'トゥージス駅',
      'ティーフェンカステル駅',
      'フィリズール駅',
      'ベルグン駅',
      'サン・モリッツ駅',
      'ポントレジーナ駅',
      'ベルニナ・ディアヴォレッツァ駅',
      'オスピツィオ・ベルニナ駅',
      'アルプ・グリュム駅',
      'ポスキアーヴォ駅',
      'ル・プレーゼ駅',
      'ティラーノ駅',
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

  it('駅の座標は南下する経路に沿って緯度が概ね減少する（クール→ティラーノ）', () => {
    const lats = line!.stations.map((s) => s.lat);
    expect(lats[0]).toBeGreaterThan(lats[lats.length - 1]);
  });

  it('スイス国内駅は🇨🇭、イタリアのティラーノ駅は🇮🇹を持つ（国境をまたぐ路線）', () => {
    const swissStations = line!.stations.filter((s) => s.name !== 'ティラーノ駅');
    swissStations.forEach((s) => {
      expect(s.flag).toBe('🇨🇭');
      expect(s.country).toBe('スイス');
    });
    const tirano = line!.stations.find((s) => s.name === 'ティラーノ駅');
    expect(tirano?.flag).toBe('🇮🇹');
    expect(tirano?.country).toBe('イタリア');
  });

  it('駅名の重複が無い', () => {
    const names = line!.stations.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
