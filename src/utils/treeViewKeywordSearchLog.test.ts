import { describe, it, expect } from 'vitest';
import {
  sanitizeKeywordOccurrenceRowsForSave,
  buildKeywordSearchSnapshotsByQuery,
  sortKeywordSearchTrendQueriesByLatestOccurrenceDesc,
} from './treeViewKeywordSearchLog';

// 対象: tree_view_keyword_search_log/tree_view_keyword_search_resultsの
// 保存前検証(sanitizeKeywordOccurrenceRowsForSave)と、傾向分析ページ用の
// 時系列集計(buildKeywordSearchSnapshotsByQuery)。
//
// 故障シナリオ:
//   (1) 空文字・空白のみのkeywordがそのまま保存されてしまう
//   (2) occurrenceCountが負値・NaNのままD1へ送られる
//   (3) 同じkeywordの重複行が合算されず別行として保存される
//   (4) 結果0件の検索ログがスナップショットから欠落する
//   (5) 複数queryのスナップショットが混ざる
//   (6) 時系列が古い順に並ばない

describe('sanitizeKeywordOccurrenceRowsForSave', () => {
  it('空文字・空白のみのkeywordは除外する', () => {
    const result = sanitizeKeywordOccurrenceRowsForSave([
      { keyword: '', occurrenceCount: 3 },
      { keyword: '   ', occurrenceCount: 1 },
      { keyword: 'リファクタ', occurrenceCount: 5 },
    ]);
    expect(result).toEqual([{ keyword: 'リファクタ', occurrenceCount: 5 }]);
  });

  it('負値・NaNのoccurrenceCountは0として扱う', () => {
    const result = sanitizeKeywordOccurrenceRowsForSave([
      { keyword: '負値', occurrenceCount: -5 },
      { keyword: 'NaN値', occurrenceCount: NaN },
    ]);
    expect(result).toEqual([
      { keyword: '負値', occurrenceCount: 0 },
      { keyword: 'NaN値', occurrenceCount: 0 },
    ]);
  });

  it('同じkeywordの重複行は合算する', () => {
    const result = sanitizeKeywordOccurrenceRowsForSave([
      { keyword: '重複', occurrenceCount: 2 },
      { keyword: '重複', occurrenceCount: 3 },
    ]);
    expect(result).toEqual([{ keyword: '重複', occurrenceCount: 5 }]);
  });

  it('小数のoccurrenceCountは切り捨てる', () => {
    const result = sanitizeKeywordOccurrenceRowsForSave([{ keyword: 'キー', occurrenceCount: 2.9 }]);
    expect(result).toEqual([{ keyword: 'キー', occurrenceCount: 2 }]);
  });
});

describe('buildKeywordSearchSnapshotsByQuery', () => {
  it('結果0件の検索ログもkeywordCount=0・totalOccurrenceCount=0として含める(欠落させない)', () => {
    const result = buildKeywordSearchSnapshotsByQuery(
      [{ id: 1, repoName: 'owner/repo', query: 'oauth', fileCount: 3, searchedAt: '2026-10-15T00:00:00Z' }],
      [],
    );
    expect(result.get('owner/repo\u0000oauth')?.snapshots).toEqual([
      { searchLogId: 1, searchedAt: '2026-10-15T00:00:00Z', fileCount: 3, keywordCount: 0, totalOccurrenceCount: 0 },
    ]);
  });

  it('クエリごとに別グループへ分ける', () => {
    const result = buildKeywordSearchSnapshotsByQuery(
      [
        { id: 1, repoName: 'owner/repo', query: 'oauth', fileCount: 3, searchedAt: '2026-10-15T00:00:00Z' },
        { id: 2, repoName: 'owner/repo', query: 'jwt', fileCount: 1, searchedAt: '2026-10-15T00:00:00Z' },
      ],
      [
        { searchLogId: 1, resultCount: 2, totalOccurrenceCount: 10 },
        { searchLogId: 2, resultCount: 1, totalOccurrenceCount: 1 },
      ],
    );
    expect(result.get('owner/repo\u0000oauth')?.snapshots.map((s) => s.searchLogId)).toEqual([1]);
    expect(result.get('owner/repo\u0000jwt')?.snapshots.map((s) => s.searchLogId)).toEqual([2]);
  });

  it('同じクエリ文字列でもリポジトリが違えば別グループとして分ける', () => {
    const result = buildKeywordSearchSnapshotsByQuery(
      [
        { id: 1, repoName: 'owner/repo-a', query: 'oauth', fileCount: 3, searchedAt: '2026-10-15T00:00:00Z' },
        { id: 2, repoName: 'owner/repo-b', query: 'oauth', fileCount: 1, searchedAt: '2026-10-15T00:00:00Z' },
      ],
      [],
    );
    expect(result.get('owner/repo-a\u0000oauth')?.snapshots.map((s) => s.searchLogId)).toEqual([1]);
    expect(result.get('owner/repo-b\u0000oauth')?.snapshots.map((s) => s.searchLogId)).toEqual([2]);
  });

  it('同一queryのスナップショットはsearchedAtの昇順(古い順)に並ぶ', () => {
    const result = buildKeywordSearchSnapshotsByQuery(
      [
        { id: 2, repoName: 'owner/repo', query: 'oauth', fileCount: 3, searchedAt: '2026-10-16T00:00:00Z' },
        { id: 1, repoName: 'owner/repo', query: 'oauth', fileCount: 3, searchedAt: '2026-10-15T00:00:00Z' },
      ],
      [
        { searchLogId: 1, resultCount: 2, totalOccurrenceCount: 10 },
        { searchLogId: 2, resultCount: 3, totalOccurrenceCount: 15 },
      ],
    );
    expect(result.get('owner/repo\u0000oauth')?.snapshots.map((s) => s.searchLogId)).toEqual([1, 2]);
  });
});

describe('sortKeywordSearchTrendQueriesByLatestOccurrenceDesc', () => {
  function query(name: string, totalOccurrenceCount: number, keywordCount = 1) {
    return {
      query: name,
      snapshots: [
        { searchLogId: 1, searchedAt: '2026-10-15T00:00:00Z', fileCount: 1, keywordCount, totalOccurrenceCount },
      ],
    };
  }

  it('最新スナップショットのtotalOccurrenceCountが多い順に並べる', () => {
    const result = sortKeywordSearchTrendQueriesByLatestOccurrenceDesc([query('少', 1), query('多', 10), query('中', 5)]);
    expect(result.map((q) => q.query)).toEqual(['多', '中', '少']);
  });

  it('出現回数が同数ならkeywordCountが多い順に並べる', () => {
    const result = sortKeywordSearchTrendQueriesByLatestOccurrenceDesc([query('少key', 5, 1), query('多key', 5, 3)]);
    expect(result.map((q) => q.query)).toEqual(['多key', '少key']);
  });

  it('出現回数・keywordCountが両方同数ならqueryの文字コード順で安定的に並ぶ', () => {
    const result = sortKeywordSearchTrendQueriesByLatestOccurrenceDesc([query('b', 5, 2), query('a', 5, 2)]);
    expect(result.map((q) => q.query)).toEqual(['a', 'b']);
  });

  it('スナップショットが複数ある場合は最新(末尾)の値で比較する(古いスナップショットは見ない)', () => {
    const rising = {
      query: 'rising',
      snapshots: [
        { searchLogId: 1, searchedAt: '2026-10-14T00:00:00Z', fileCount: 1, keywordCount: 1, totalOccurrenceCount: 100 },
        { searchLogId: 2, searchedAt: '2026-10-15T00:00:00Z', fileCount: 1, keywordCount: 1, totalOccurrenceCount: 1 },
      ],
    };
    const result = sortKeywordSearchTrendQueriesByLatestOccurrenceDesc([rising, query('higher-now', 2)]);
    expect(result.map((q) => q.query)).toEqual(['higher-now', 'rising']);
  });
});
