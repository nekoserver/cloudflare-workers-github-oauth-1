import { describe, it, expect } from 'vitest';
import {
  floatsToBlob,
  blobToFloats,
  cosineSimilarity,
  averageVector,
  pickBestCategorySuggestion,
  analyzeVector,
} from './index';

// 対象: bge-m3埋め込みベクトルをD1のBLOBへ保存/復元する変換と、
// キーワード↔中分類の類似度によるAI分類推薦のための純粋関数群。
//
// 故障シナリオ:
//   (1) Float32Arrayの精度でBLOB化した結果、変換後の値が元と大きくずれる
//   (2) コサイン類似度計算でゼロベクトルが渡された際にゼロ除算でNaNになる
//   (3) 次元数が異なるベクトル同士を比較して不正な結果になる
//   (4) 中分類の代表ベクトル(centroid)が空配列の候補を最良候補として誤選択する

describe('floatsToBlob / blobToFloats: BLOB往復変換', () => {
  it('数値配列をBLOB化して復元すると同じ値が得られる（Float32精度の範囲内）', () => {
    const original = [0.1, -0.5, 1.25, 0, 3.75];
    const blob = floatsToBlob(original);
    const restored = blobToFloats(blob);
    restored.forEach((v, i) => {
      expect(v).toBeCloseTo(original[i], 5);
    });
  });

  it('空配列も往復できる', () => {
    expect(blobToFloats(floatsToBlob([]))).toEqual([]);
  });
});

describe('cosineSimilarity: コサイン類似度', () => {
  it('完全に同じ向きのベクトルは類似度1になる', () => {
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 6);
  });

  it('直交するベクトルは類似度0になる', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });

  it('正反対のベクトルは類似度-1になる', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 6);
  });

  it('ゼロベクトルが渡されてもゼロ除算でNaNにならず0を返す', () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([1, 2, 3], [0, 0, 0])).toBe(0);
  });

  it('次元数が異なるベクトル同士は0を返す（誤った比較を防ぐ）', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2])).toBe(0);
  });
});

describe('averageVector: 中分類の代表ベクトル(centroid)計算', () => {
  it('複数ベクトルの要素ごとの平均を返す', () => {
    expect(averageVector([[1, 2], [3, 4], [5, 6]])).toEqual([3, 4]);
  });

  it('空配列が渡されたら空配列を返す（握りつぶさない）', () => {
    expect(averageVector([])).toEqual([]);
  });
});

describe('pickBestCategorySuggestion: 最良の分類候補を選ぶ', () => {
  it('最も類似度が高い中分類を返す', () => {
    const result = pickBestCategorySuggestion(
      [1, 0],
      [
        { categoryId: 1, name: 'Geography', vector: [0, 1] },
        { categoryId: 2, name: 'Travel', vector: [0.9, 0.1] },
      ]
    );
    expect(result).not.toBeNull();
    expect(result!.categoryId).toBe(2);
    expect(result!.name).toBe('Travel');
    expect(result!.similarity).toBeGreaterThan(0.9);
  });

  it('候補が空配列なら null を返す', () => {
    expect(pickBestCategorySuggestion([1, 0], [])).toBeNull();
  });

  it('centroidが空ベクトルの候補は無視する（キーワードが1件も無い中分類を誤って推薦しない）', () => {
    const result = pickBestCategorySuggestion(
      [1, 0],
      [
        { categoryId: 1, name: 'Empty', vector: [] },
        { categoryId: 2, name: 'Travel', vector: [1, 0] },
      ]
    );
    expect(result).not.toBeNull();
    expect(result!.categoryId).toBe(2);
  });

  it('全候補のcentroidが空ベクトルなら null を返す', () => {
    const result = pickBestCategorySuggestion(
      [1, 0],
      [{ categoryId: 1, name: 'Empty', vector: [] }]
    );
    expect(result).toBeNull();
  });
});

describe('analyzeVector: 埋め込みキャッシュモーダルの🔍分析ボタン', () => {
  it('次元数・L2ノルム・平均・標準偏差・最小/最大値を計算する', () => {
    const result = analyzeVector([1, 2, 3, 4]);
    expect(result.dim).toBe(4);
    expect(result.l2Norm).toBeCloseTo(Math.sqrt(1 + 4 + 9 + 16), 6);
    expect(result.mean).toBeCloseTo(2.5, 6);
    expect(result.std).toBeCloseTo(Math.sqrt(1.25), 6);
    expect(result.min).toBe(1);
    expect(result.max).toBe(4);
  });

  it('絶対値0.01未満の要素の割合をnearZeroRatioとして返す', () => {
    const result = analyzeVector([0, 0.005, -0.005, 1, -1]);
    expect(result.nearZeroRatio).toBeCloseTo(3 / 5, 6);
  });

  it('空配列が渡された場合は例外を投げず全て0のオブジェクトを返す（握りつぶさない）', () => {
    const result = analyzeVector([]);
    expect(result).toEqual({ dim: 0, l2Norm: 0, mean: 0, std: 0, min: 0, max: 0, nearZeroRatio: 0 });
  });

  it('全要素が同一値の場合は標準偏差0になる（浮動小数点誤差で負値のsqrtにならない）', () => {
    const result = analyzeVector([3, 3, 3, 3]);
    expect(result.std).toBe(0);
  });
});
