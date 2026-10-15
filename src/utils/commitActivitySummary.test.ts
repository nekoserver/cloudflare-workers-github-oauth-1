import { describe, expect, it } from 'vitest';
import { mergeCommitActivityDaily, computeBackfillCoverage } from './commitActivitySummary';

// 対象: mergeCommitActivityDaily(コミット数・変更ファイル数・Topicの
// 3クエリ結果を日付で統合する純粋関数)。
//
// 故障シナリオ:
//   (1) 3クエリの日付集合が一致しない(片方にしかない日)場合に、
//       存在しない軸を0件/空配列ではなくundefinedのまま返してしまう
//   (2) 同じ日に複数Topicがある場合に重複を除去できない
//   (3) 日付の並び順が崩れる(昇順でない)

describe('mergeCommitActivityDaily', () => {
  it('3クエリ全てに存在する日付はそのまま統合する', () => {
    const result = mergeCommitActivityDaily(
      [{ date: '2026-10-14', commitCount: 3 }],
      [{ date: '2026-10-14', fileChangeCount: 5 }],
      [{ date: '2026-10-14', topic: 'tree-view' }]
    );
    expect(result).toEqual([{ date: '2026-10-14', commitCount: 3, fileChangeCount: 5, topics: ['tree-view'] }]);
  });

  it('片方のクエリにしか無い日付は、存在しない軸を0件/空配列で埋める', () => {
    const result = mergeCommitActivityDaily(
      [{ date: '2026-10-14', commitCount: 3 }],
      [],
      []
    );
    expect(result).toEqual([{ date: '2026-10-14', commitCount: 3, fileChangeCount: 0, topics: [] }]);
  });

  it('同じ日に複数Topicがあれば配列にまとめ、重複は除去する', () => {
    const result = mergeCommitActivityDaily(
      [],
      [],
      [
        { date: '2026-10-14', topic: 'tree-view' },
        { date: '2026-10-14', topic: 'Clef' },
        { date: '2026-10-14', topic: 'tree-view' },
      ]
    );
    expect(result).toEqual([{ date: '2026-10-14', commitCount: 0, fileChangeCount: 0, topics: ['tree-view', 'Clef'] }]);
  });

  it('日付の和集合を昇順で返す', () => {
    const result = mergeCommitActivityDaily(
      [{ date: '2026-10-15', commitCount: 1 }],
      [{ date: '2026-10-13', fileChangeCount: 2 }],
      [{ date: '2026-10-14', topic: 'x' }]
    );
    expect(result.map((r) => r.date)).toEqual(['2026-10-13', '2026-10-14', '2026-10-15']);
  });

  it('入力が全て空なら空配列を返す', () => {
    expect(mergeCommitActivityDaily([], [], [])).toEqual([]);
  });
});

describe('computeBackfillCoverage', () => {
  it('committedAtFilled/totalCommitsの比率を計算する', () => {
    expect(computeBackfillCoverage(200, 50)).toEqual({ totalCommits: 200, committedAtFilled: 50, ratio: 0.25 });
  });

  it('totalCommitsが0なら0除算せずratio=0を返す', () => {
    expect(computeBackfillCoverage(0, 0)).toEqual({ totalCommits: 0, committedAtFilled: 0, ratio: 0 });
  });

  it('全件埋まっていればratio=1', () => {
    expect(computeBackfillCoverage(10, 10)).toEqual({ totalCommits: 10, committedAtFilled: 10, ratio: 1 });
  });
});
