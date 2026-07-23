import { describe, expect, it } from 'vitest';
import { RAIL_LINES } from './data/railLines';

describe('RAIL_LINES — 未判定駅 39件を整理した新規路線群(2026-07-23)', () => {
  it('チンクエテッレ鉄道(リオマッジョーレ～モンテロッソ): 5つの沿岸村駅が登録されている', () => {
    const line = RAIL_LINES.find((l) => l.name === 'チンクエテッレ鉄道(リオマッジョーレ～モンテロッソ)');
    expect(line).toBeDefined();
    expect(line!.stations).toHaveLength(5);
    const names = line!.stations.map((s) => s.name);
    expect(names).toEqual([
      'リオマッジョーレ駅',
      'マナローラ駅',
      'コルニリア駅',
      'ヴェルナッツァ駅',
      'モンテロッソ・アル・メール駅'
    ]);
  });

  it('スイス主要幹線(チューリッヒ～ローザンヌ): チューリッヒ・バーゼル・ルツェルン・ローザンヌが登録されている', () => {
    const line = RAIL_LINES.find((l) => l.name === 'スイス主要幹線(チューリッヒ～ローザンヌ)');
    expect(line).toBeDefined();
    const names = line!.stations.map((s) => s.name);
    expect(names).toEqual(['チューリッヒ中央駅', 'バーゼルSBB駅', 'ルツェルン駅', 'ローザンヌ駅']);
  });

  it('スイス・インターラーケン線: インターラーケン・オスト駅とトゥーン駅が登録されている', () => {
    const line = RAIL_LINES.find((l) => l.name === 'スイス・インターラーケン線(インターラーケン～トゥーン)');
    expect(line).toBeDefined();
    const names = line!.stations.map((s) => s.name);
    expect(names).toEqual(['インターラーケン・オスト駅', 'トゥーン駅']);
  });

  it('スイス・アルペン線: サメダン・ロカルノ・ラ・ショー＝ド＝フォン駅が登録されている', () => {
    const line = RAIL_LINES.find((l) => l.name === 'スイス・アルペン線(サメダン～ロカルノ)');
    expect(line).toBeDefined();
    const names = line!.stations.map((s) => s.name);
    expect(names).toEqual(['サメダン駅', 'ロカルノ駅', 'ラ・ショー＝ド＝フォン駅']);
  });

  it('ドイツ・ライン川沿い線: ストラスブール・シュパイアー(3種類)・ハイデルベルク駅が登録されている', () => {
    const line = RAIL_LINES.find((l) => l.name === 'ドイツ・ライン川沿い線(ストラスブール～ハイデルベルク)');
    expect(line).toBeDefined();
    const names = line!.stations.map((s) => s.name);
    expect(names).toContain('ストラスブール駅');
    expect(names).toContain('シュパイアー中央駅');
    expect(names).toContain('シュパイアー・ノルト駅');
    expect(names).toContain('シュパイアー・ヴェスト駅');
    expect(names).toContain('ハイデルベルク中央駅');
  });

  it('ドイツ・バイエルン線: バイロイト・フュッセン・リンダウ・ハムエルン・バート・キッシンゲン駅が登録されている', () => {
    const line = RAIL_LINES.find((l) => l.name === 'ドイツ・バイエルン線(バイロイト～キッシンゲン)');
    expect(line).toBeDefined();
    const names = line!.stations.map((s) => s.name);
    expect(names).toContain('バイロイト駅');
    expect(names).toContain('フュッセン駅');
    expect(names).toContain('リンダウ・インゼル駅');
    expect(names).toContain('ハムエルン駅');
    expect(names).toContain('バート・キッシンゲン駅');
  });

  it('フランス・南部線: ニーム・モンペリエ駅が登録されている', () => {
    const line = RAIL_LINES.find((l) => l.name === 'フランス・南部線(ニーム～モンペリエ)');
    expect(line).toBeDefined();
    const names = line!.stations.map((s) => s.name);
    expect(names).toEqual(['ニーム駅', 'モンペリエ駅']);
  });

  it('イタリア・中部線: フィレンツェ・メストレ・ジェノヴァ・イヴレーア駅が登録されている', () => {
    const line = RAIL_LINES.find((l) => l.name === 'イタリア・中部線(フィレンツェ～イヴレーア)');
    expect(line).toBeDefined();
    const names = line!.stations.map((s) => s.name);
    expect(names).toContain('サンタ・マリア・ノヴェッラ駅');
    expect(names).toContain('メストレ駅');
    expect(names).toContain('プリンチペ駅');
    expect(names).toContain('イヴレーア駅');
  });

  it('中央ヨーロッパ線: アムステルダム・プラハ・ウィーン(シェーンブルン)駅が登録されている', () => {
    const line = RAIL_LINES.find((l) => l.name === '中央ヨーロッパ線(アムステルダム～プラハ～ウィーン)');
    expect(line).toBeDefined();
    const names = line!.stations.map((s) => s.name);
    expect(names).toContain('アムステルダム中央駅');
    expect(names).toContain('ナードラジー・ヴェレスラヴィン駅');
    expect(names).toContain('シェーンブルン駅');
  });

  it('各新規路線の駅の座標が有効な範囲内である', () => {
    const newLineNames = [
      'チンクエテッレ鉄道',
      'スイス主要幹線',
      'スイス・インターラーケン線',
      'スイス・アルペン線',
      'ドイツ・ライン川沿い線',
      'ドイツ・バイエルン線',
      'フランス・南部線',
      'イタリア・中部線',
      '中央ヨーロッパ線'
    ];
    const newLines = RAIL_LINES.filter((l) => newLineNames.some((name) => l.name.includes(name)));
    expect(newLines.length).toBe(newLineNames.length);
    for (const line of newLines) {
      for (const station of line.stations) {
        expect(station.lat).toBeGreaterThan(-90);
        expect(station.lat).toBeLessThan(90);
        expect(station.lon).toBeGreaterThan(-180);
        expect(station.lon).toBeLessThan(180);
      }
    }
  });

  it('新規路線内での駅名の重複が無い', () => {
    const newLineNames = [
      'チンクエテッレ鉄道',
      'スイス主要幹線',
      'スイス・インターラーケン線',
      'スイス・アルペン線',
      'ドイツ・ライン川沿い線',
      'ドイツ・バイエルン線',
      'フランス・南部線',
      'イタリア・中部線',
      '中央ヨーロッパ線'
    ];
    const newLines = RAIL_LINES.filter((l) => newLineNames.some((name) => l.name.includes(name)));
    for (const line of newLines) {
      const names = line.stations.map((s) => s.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });
});
