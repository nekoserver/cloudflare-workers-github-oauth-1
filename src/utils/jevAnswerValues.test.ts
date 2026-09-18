import { describe, expect, it } from 'vitest';
import { buildJevValuesForLoop } from './jevAnswerValues';

describe('buildJevValuesForLoop', () => {
  it('jev_label_id 1から20まで順番に、該当行があればvalueを、無ければnullを詰める', () => {
    const rows = [
      { jev_label_id: 1, value: 0.8 },
      { jev_label_id: 3, value: 0.2 },
    ];
    const result = buildJevValuesForLoop(rows);
    expect(result).toHaveLength(20);
    expect(result[0]).toEqual({ jevLabelId: 1, value: 0.8 });
    expect(result[1]).toEqual({ jevLabelId: 2, value: null });
    expect(result[2]).toEqual({ jevLabelId: 3, value: 0.2 });
    expect(result[19]).toEqual({ jevLabelId: 20, value: null });
  });

  it('行が1件も無ければ全て{value: null}の20件を返す(黙って0件にしない)', () => {
    const result = buildJevValuesForLoop([]);
    expect(result).toHaveLength(20);
    expect(result.every((r) => r.value === null)).toBe(true);
    expect(result.map((r) => r.jevLabelId)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('質問IDの並び順は数値順(loop Aの順)を維持し、valueで並び替えない', () => {
    const rows = [
      { jev_label_id: 20, value: 0.9 },
      { jev_label_id: 5, value: 0.1 },
    ];
    const result = buildJevValuesForLoop(rows);
    expect(result.map((r) => r.jevLabelId)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('範囲外(21以上)の行は無視する(1〜20のループAのみを対象とする)', () => {
    const rows = [{ jev_label_id: 21, value: 0.5 }];
    const result = buildJevValuesForLoop(rows);
    expect(result).toHaveLength(20);
    expect(result.every((r) => r.value === null)).toBe(true);
  });
});
