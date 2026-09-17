import { describe, expect, it } from 'vitest';
import { computeJevQuestionCounts, renderJevRevViewerPage } from './jevRevViewer';

describe('computeJevQuestionCounts', () => {
  it('質問IDごとに重複を除いた出現回数を数える(変数A相当)', () => {
    const evaluations = [
      { jev_label_id: 1 },
      { jev_label_id: 2 },
      { jev_label_id: 1 },
      { jev_label_id: 1 },
      { jev_label_id: 2 },
    ];
    const labels = [
      { id: 1, question_text: '事実性' },
      { id: 2, question_text: '根拠' },
    ];
    const result = computeJevQuestionCounts(evaluations, labels);
    expect(result).toEqual([
      { count: 3, questionId: 1, questionText: '事実性' },
      { count: 2, questionId: 2, questionText: '根拠' },
    ]);
  });

  it('出現回数の多い順(降順)に並び替える', () => {
    const evaluations = [
      { jev_label_id: 3 },
      { jev_label_id: 1 },
      { jev_label_id: 1 },
      { jev_label_id: 2 },
      { jev_label_id: 2 },
      { jev_label_id: 2 },
    ];
    const labels = [
      { id: 1, question_text: 'A' },
      { id: 2, question_text: 'B' },
      { id: 3, question_text: 'C' },
    ];
    const result = computeJevQuestionCounts(evaluations, labels);
    expect(result.map((r) => r.questionId)).toEqual([2, 1, 3]);
  });

  it('出現回数が同数の場合は質問IDの昇順で安定的に並べる', () => {
    const evaluations = [{ jev_label_id: 5 }, { jev_label_id: 2 }];
    const labels = [
      { id: 2, question_text: 'B' },
      { id: 5, question_text: 'E' },
    ];
    const result = computeJevQuestionCounts(evaluations, labels);
    expect(result.map((r) => r.questionId)).toEqual([2, 5]);
  });

  it('jev_labelsに存在しない質問IDは「(不明な質問)」として扱う(黙って除外しない)', () => {
    const evaluations = [{ jev_label_id: 99 }];
    const labels: { id: number; question_text: string }[] = [];
    const result = computeJevQuestionCounts(evaluations, labels);
    expect(result).toEqual([{ count: 1, questionId: 99, questionText: '(不明な質問)' }]);
  });

  it('評価が0件なら空配列を返す', () => {
    expect(computeJevQuestionCounts([], [])).toEqual([]);
  });
});

describe('renderJevRevViewerPage', () => {
  it('<meta charset=utf-8><pre>で囲み、各行を「出現回数/質問ID/質問文」形式で書き出す', () => {
    const html = renderJevRevViewerPage([
      { count: 3, questionId: 1, questionText: '事実性' },
      { count: 2, questionId: 2, questionText: '根拠' },
    ]);
    expect(html).toBe('<meta charset=utf-8><pre>3/1/事実性\n2/2/根拠</pre>');
  });

  it('0件のときは中身が空のpreを返す', () => {
    expect(renderJevRevViewerPage([])).toBe('<meta charset=utf-8><pre></pre>');
  });

  it('質問文に含まれるHTML特殊文字はエスケープする(pre内でも構文崩れ・XSSを防ぐ)', () => {
    const html = renderJevRevViewerPage([{ count: 1, questionId: 1, questionText: '<script>alert(1)</script>' }]);
    expect(html).toBe('<meta charset=utf-8><pre>1/1/&lt;script&gt;alert(1)&lt;/script&gt;</pre>');
  });
});
