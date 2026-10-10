import { describe, it, expect } from 'vitest';
import { sortRepoKeywordCounts, getKeywordStatsPage } from './keywordStats';

describe('sortRepoKeywordCounts', () => {
  it('件数の多い順に並べ替える', () => {
    const result = sortRepoKeywordCounts([
      { repoFullName: 'nekoserver/a', keywordCount: 3 },
      { repoFullName: 'nekoserver/b', keywordCount: 10 },
      { repoFullName: 'nekoserver/c', keywordCount: 7 },
    ]);
    expect(result.map((r) => r.repoFullName)).toEqual(['nekoserver/b', 'nekoserver/c', 'nekoserver/a']);
  });

  it('repoFullNameがNULLの行は(リポジトリ不明)として最後にまとめる(件数が多くても先頭に来ない)', () => {
    const result = sortRepoKeywordCounts([
      { repoFullName: null, keywordCount: 100 },
      { repoFullName: 'nekoserver/a', keywordCount: 1 },
    ]);
    expect(result.map((r) => r.repoFullName)).toEqual(['nekoserver/a', null]);
  });

  it('空配列を渡すと空配列を返す', () => {
    expect(sortRepoKeywordCounts([])).toEqual([]);
  });
});

describe('getKeywordStatsPage', () => {
  const baseData = {
    totalKeywordRows: 42,
    totalSummaryLogsWithKeywords: 10,
    byRepo: [
      { repoFullName: 'nekoserver/rails-root', keywordCount: 5 },
      { repoFullName: 'nekoserver/dynamicneko', keywordCount: 37 },
    ],
    topKeywords: [
      { keyword: 'ログイン機能', occurrenceCount: 8 },
      { keyword: '認証トークン', occurrenceCount: 3 },
    ],
  };

  it('総数・リポジトリ別・頻出キーワードを表示する', () => {
    const html = getKeywordStatsPage({ name: 'Octocat', username: 'octocat' }, baseData);
    expect(html).toContain('42');
    expect(html).toContain('10');
    expect(html).toContain('nekoserver/rails-root');
    expect(html).toContain('nekoserver/dynamicneko');
    expect(html).toContain('ログイン機能');
    expect(html).toContain('認証トークン');
  });

  it('データが空でも空状態の文言を出し、例外にならない', () => {
    const html = getKeywordStatsPage({ name: 'Octocat', username: 'octocat' }, {
      totalKeywordRows: 0,
      totalSummaryLogsWithKeywords: 0,
      byRepo: [],
      topKeywords: [],
    });
    expect(html).toContain('キーワードはまだありません');
  });

  it('リポジトリ名・キーワードのHTMLエスケープが効いている(XSS対策)', () => {
    const html = getKeywordStatsPage({ name: 'Octocat', username: 'octocat' }, {
      totalKeywordRows: 1,
      totalSummaryLogsWithKeywords: 1,
      byRepo: [{ repoFullName: '<script>alert(1)</script>', keywordCount: 1 }],
      topKeywords: [{ keyword: '<img src=x onerror=alert(1)>', occurrenceCount: 1 }],
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
  });
});
