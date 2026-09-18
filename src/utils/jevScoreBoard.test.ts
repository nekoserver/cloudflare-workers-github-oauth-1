import { describe, it, expect } from 'vitest';
import { groupJevScoreRowsByShare, isValidJevScoreBoardLabelId } from './jevScoreBoard';

// 対象: /jev-score-boardページの純粋ロジックgroupJevScoreRowsByShare。
// jev_evaluationsの行を(share_id, model)単位でグルーピングし、
// buildJevValuesForLoopで1〜20件固定の配列に整形する。
//
// 故障シナリオ:
//   (1) 同一shareに複数モデルの評価がある場合に、モデルごとに別グループになる
//   (2) 値が無いラベルIDが黙って除外され、20件固定でなくなる
//   (3) shareOrderに存在しないshare_id(JOIN漏れ等)がそのまま出力に混入する
//   (4) 表示順がshareOrderの通りにならない

describe('groupJevScoreRowsByShare', () => {
  it('同一shareに複数モデルの評価があれば別グループとして分ける', () => {
    const rows = [
      { share_id: 's1', model: 'gemma', jev_label_id: 1, value: 0.9 },
      { share_id: 's1', model: 'llama', jev_label_id: 1, value: 0.5 },
    ];
    const result = groupJevScoreRowsByShare(rows, new Map([['s1', 'q']]), ['s1']);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.model).sort()).toEqual(['gemma', 'llama']);
  });

  it('値が無いラベルIDもnullとして20件固定で残る(黙って除外しない)', () => {
    const rows = [{ share_id: 's1', model: 'gemma', jev_label_id: 3, value: 0.7 }];
    const result = groupJevScoreRowsByShare(rows, new Map([['s1', 'q']]), ['s1']);
    expect(result).toHaveLength(1);
    expect(result[0].values).toHaveLength(20);
    expect(result[0].values.find((v) => v.jevLabelId === 3)?.value).toBe(0.7);
    expect(result[0].values.find((v) => v.jevLabelId === 1)?.value).toBeNull();
  });

  it('shareOrder(questionByShareId)に存在しないshare_idはJOIN漏れとして結果から除外する', () => {
    const rows = [
      { share_id: 's1', model: 'gemma', jev_label_id: 1, value: 0.9 },
      { share_id: 'orphan', model: 'gemma', jev_label_id: 1, value: 0.1 },
    ];
    const result = groupJevScoreRowsByShare(rows, new Map([['s1', 'q']]), ['s1']);
    expect(result.map((r) => r.shareId)).toEqual(['s1']);
  });

  it('表示順はshareOrderの並びに従う(scoreRowsの出現順ではない)', () => {
    const rows = [
      { share_id: 's2', model: 'gemma', jev_label_id: 1, value: 0.1 },
      { share_id: 's1', model: 'gemma', jev_label_id: 1, value: 0.9 },
    ];
    const questionByShareId = new Map([
      ['s1', 'q1'],
      ['s2', 'q2'],
    ]);
    const result = groupJevScoreRowsByShare(rows, questionByShareId, ['s1', 's2']);
    expect(result.map((r) => r.shareId)).toEqual(['s1', 's2']);
  });

  it('質問文はquestionByShareIdからshare_idで解決する', () => {
    const rows = [{ share_id: 's1', model: 'gemma', jev_label_id: 1, value: 0.9 }];
    const result = groupJevScoreRowsByShare(rows, new Map([['s1', 'フランスの話']]), ['s1']);
    expect(result[0].question).toBe('フランスの話');
  });
});

describe('isValidJevScoreBoardLabelId', () => {
  it('1〜20の整数は有効', () => {
    expect(isValidJevScoreBoardLabelId(1)).toBe(true);
    expect(isValidJevScoreBoardLabelId(20)).toBe(true);
    expect(isValidJevScoreBoardLabelId(10)).toBe(true);
  });

  it('範囲外・非整数・非数値は無効', () => {
    expect(isValidJevScoreBoardLabelId(0)).toBe(false);
    expect(isValidJevScoreBoardLabelId(21)).toBe(false);
    expect(isValidJevScoreBoardLabelId(1.5)).toBe(false);
    expect(isValidJevScoreBoardLabelId(NaN)).toBe(false);
    expect(isValidJevScoreBoardLabelId('1')).toBe(false);
    expect(isValidJevScoreBoardLabelId(undefined)).toBe(false);
  });
});
