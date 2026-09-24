import { describe, expect, it } from 'vitest';
import { buildJevLivePulse } from './utils/jevLivePulse';

describe('buildJevLivePulse', () => {
  it('直近平均と過去平均との差が大きい順に並べる', () => {
    const result = buildJevLivePulse([
      { jev_label_id: 1, label_text: '事実性', recent_average: 0.9, baseline_average: 0.8, recent_count: 3 },
      { jev_label_id: 2, label_text: '明瞭性', recent_average: 0.3, baseline_average: 0.7, recent_count: 2 },
    ]);
    expect(result.map((item) => item.labelId)).toEqual([2, 1]);
    expect(result[0].delta).toBeCloseTo(-0.4);
  });

  it('直近データがない行を除外し、baseline無しは新規データとして残す', () => {
    const result = buildJevLivePulse([
      { jev_label_id: 1, label_text: '空', recent_average: null, baseline_average: 0.5, recent_count: 0 },
      { jev_label_id: 2, label_text: '新規', recent_average: 0.75, baseline_average: null, recent_count: 1 },
    ]);
    expect(result).toEqual([{ labelId: 2, label: '新規', average: 0.75, delta: null, sampleCount: 1 }]);
  });

  it('表示件数を制限できる', () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({
      jev_label_id: i + 1,
      label_text: `L${i + 1}`,
      recent_average: i / 10,
      baseline_average: 0,
      recent_count: 1,
    }));
    expect(buildJevLivePulse(rows, 3)).toHaveLength(3);
  });
});
