import { describe, it, expect } from 'vitest';
import { scoreAnswerAgainstCategories, blendCategoryColors } from './index';

// 対象: /answer-graph のノードを「旅行寄り」「コーディング寄り」のような
// カテゴリ類似度のブレンドで色分けするための純粋関数群。
//
// 故障シナリオ:
//   (1) centroidが空ベクトルのカテゴリをスコア対象に含めてしまう
//   (2) 全カテゴリの類似度が0以下(無関係)なのに何らかの色を返してしまう
//     （ニュートラルカラーへフォールバックすべき）
//   (3) スコアの合計が1にならない重み付けで色がおかしくなる
//   (4) 不正な色コード(#始まりでない・6桁でない)でクラッシュする

describe('scoreAnswerAgainstCategories: 回答ベクトルと全中分類の類似度スコア', () => {
  it('全カテゴリとのコサイン類似度を返す(最良1件だけに絞らない)', () => {
    const result = scoreAnswerAgainstCategories(
      [1, 0],
      [
        { categoryId: 1, name: 'Travel', color: '#3b82f6', vector: [1, 0] },
        { categoryId: 2, name: 'Coding', color: '#22c55e', vector: [0, 1] },
      ]
    );
    expect(result).toHaveLength(2);
    const travel = result.find((r) => r.categoryId === 1)!;
    const coding = result.find((r) => r.categoryId === 2)!;
    expect(travel.score).toBeCloseTo(1, 6);
    expect(coding.score).toBeCloseTo(0, 6);
  });

  it('centroidが空ベクトルのカテゴリは結果から除外する', () => {
    const result = scoreAnswerAgainstCategories(
      [1, 0],
      [
        { categoryId: 1, name: 'Empty', color: '#000000', vector: [] },
        { categoryId: 2, name: 'Travel', color: '#3b82f6', vector: [1, 0] },
      ]
    );
    expect(result.map((r) => r.categoryId)).toEqual([2]);
  });

  it('候補が空配列なら空配列を返す', () => {
    expect(scoreAnswerAgainstCategories([1, 0], [])).toEqual([]);
  });
});

describe('blendCategoryColors: スコアで色をブレンドする', () => {
  it('単一カテゴリのスコアのみ正なら、そのカテゴリの色そのものになる', () => {
    const color = blendCategoryColors(
      [
        { categoryId: 1, name: 'Travel', color: '#ff0000', score: 0.9 },
        { categoryId: 2, name: 'Coding', color: '#0000ff', score: -0.2 },
      ],
      '#888888'
    );
    expect(color.toLowerCase()).toBe('#ff0000');
  });

  it('2つのカテゴリに正のスコアがある場合は重み付き平均の色になる', () => {
    const color = blendCategoryColors(
      [
        { categoryId: 1, name: 'A', color: '#ff0000', score: 0.5 },
        { categoryId: 2, name: 'B', color: '#0000ff', score: 0.5 },
      ],
      '#888888'
    );
    expect(color.toLowerCase()).toBe('#800080');
  });

  it('全カテゴリのスコアが0以下ならニュートラルカラーを返す', () => {
    const color = blendCategoryColors(
      [
        { categoryId: 1, name: 'A', color: '#ff0000', score: 0 },
        { categoryId: 2, name: 'B', color: '#0000ff', score: -0.3 },
      ],
      '#888888'
    );
    expect(color.toLowerCase()).toBe('#888888');
  });

  it('スコアが空配列ならニュートラルカラーを返す', () => {
    expect(blendCategoryColors([], '#888888').toLowerCase()).toBe('#888888');
  });

  it('不正な色コードが混ざってもクラッシュせずニュートラルカラーにフォールバックする', () => {
    const color = blendCategoryColors(
      [{ categoryId: 1, name: 'A', color: 'not-a-color', score: 0.8 }],
      '#888888'
    );
    expect(color.toLowerCase()).toBe('#888888');
  });
});
