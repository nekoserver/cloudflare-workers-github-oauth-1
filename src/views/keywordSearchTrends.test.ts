import { describe, it, expect } from 'vitest';
import { getKeywordSearchTrendsPage } from './keywordSearchTrends';

// 対象: /keyword-search-trendsページのHTML生成(getKeywordSearchTrendsPage)。

describe('getKeywordSearchTrendsPage', () => {
  it('検索ログが0件なら案内文を出す', () => {
    const html = getKeywordSearchTrendsPage({ name: 'Octocat', username: 'octocat' }, { queries: [] });
    expect(html).toContain('検索ログはまだありません');
  });

  it('クエリごとのカードに最新・過去のスナップショットが時系列で並ぶ', () => {
    const html = getKeywordSearchTrendsPage(
      { name: 'Octocat', username: 'octocat' },
      {
        queries: [
          {
            repoName: 'nekoserver/dynamicneko',
            query: 'oauth',
            snapshots: [
              { searchLogId: 1, searchedAt: '2026-10-15T00:00:00Z', fileCount: 3, keywordCount: 2, totalOccurrenceCount: 5 },
              { searchLogId: 2, searchedAt: '2026-10-16T00:00:00Z', fileCount: 3, keywordCount: 4, totalOccurrenceCount: 12 },
            ],
          },
        ],
      },
    );
    expect(html).toContain('oauth');
    expect(html).toContain('nekoserver/dynamicneko');
    const firstIdx = html.indexOf('2026-10-15');
    const secondIdx = html.indexOf('2026-10-16');
    expect(firstIdx).toBeGreaterThan(-1);
    expect(secondIdx).toBeGreaterThan(firstIdx);
  });

  it('直前スナップショットとの差分を+/-付きで表示する', () => {
    const html = getKeywordSearchTrendsPage(
      { name: 'Octocat', username: 'octocat' },
      {
        queries: [
          {
            repoName: 'nekoserver/dynamicneko',
            query: 'oauth',
            snapshots: [
              { searchLogId: 1, searchedAt: '2026-10-15T00:00:00Z', fileCount: 3, keywordCount: 2, totalOccurrenceCount: 5 },
              { searchLogId: 2, searchedAt: '2026-10-16T00:00:00Z', fileCount: 3, keywordCount: 4, totalOccurrenceCount: 12 },
            ],
          },
        ],
      },
    );
    expect(html).toContain('delta-up">+2');
    expect(html).toContain('delta-up">+7');
  });

  it('スナップショットが1件だけの場合は差分を表示しない', () => {
    const html = getKeywordSearchTrendsPage(
      { name: 'Octocat', username: 'octocat' },
      {
        queries: [
          {
            repoName: 'nekoserver/dynamicneko',
            query: 'oauth',
            snapshots: [{ searchLogId: 1, searchedAt: '2026-10-15T00:00:00Z', fileCount: 3, keywordCount: 2, totalOccurrenceCount: 5 }],
          },
        ],
      },
    );
    expect(html).not.toContain('class="delta-up"');
    expect(html).not.toContain('class="delta-down"');
    expect(html).not.toContain('class="delta-flat"');
  });

  it('query・repoNameにHTMLタグが含まれてもエスケープする(XSS対策)', () => {
    const html = getKeywordSearchTrendsPage(
      { name: 'Octocat', username: 'octocat' },
      {
        queries: [
          {
            repoName: '<img src=x onerror=alert(1)>',
            query: '<script>alert(1)</script>',
            snapshots: [{ searchLogId: 1, searchedAt: '2026-10-15T00:00:00Z', fileCount: 1, keywordCount: 1, totalOccurrenceCount: 1 }],
          },
        ],
      },
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
  });

  it('各クエリカードに最新スナップショットの数値をdata属性で持たせる(クライアント側の並び替え用)', () => {
    const html = getKeywordSearchTrendsPage(
      { name: 'Octocat', username: 'octocat' },
      {
        queries: [
          {
            repoName: 'nekoserver/dynamicneko',
            query: 'oauth',
            snapshots: [
              { searchLogId: 1, searchedAt: '2026-10-15T00:00:00Z', fileCount: 3, keywordCount: 2, totalOccurrenceCount: 5 },
              { searchLogId: 2, searchedAt: '2026-10-16T00:00:00Z', fileCount: 7, keywordCount: 4, totalOccurrenceCount: 12 },
            ],
          },
        ],
      },
    );
    expect(html).toContain('data-file-count="7"');
    expect(html).toContain('data-keyword-count="4"');
    expect(html).toContain('data-occurrence-count="12"');
  });

  it('並び替え用のソートボタンを3つ持ち、既定で出現回数合計がアクティブ(降順)になっている', () => {
    const html = getKeywordSearchTrendsPage(
      { name: 'Octocat', username: 'octocat' },
      {
        queries: [
          {
            repoName: 'nekoserver/dynamicneko',
            query: 'oauth',
            snapshots: [{ searchLogId: 1, searchedAt: '2026-10-15T00:00:00Z', fileCount: 1, keywordCount: 1, totalOccurrenceCount: 1 }],
          },
        ],
      },
    );
    expect(html).toContain('data-sort-field="fileCount"');
    expect(html).toContain('data-sort-field="keywordCount"');
    expect(html).toContain('data-sort-field="occurrenceCount"');
    const occurrenceBtnIdx = html.indexOf('data-sort-field="occurrenceCount"');
    const surrounding = html.slice(occurrenceBtnIdx - 100, occurrenceBtnIdx + 60);
    expect(surrounding).toContain('is-active');
    expect(surrounding).toContain('data-sort-dir="desc"');
  });

  it('検索ログが0件のときはソートボタンを出さない', () => {
    const html = getKeywordSearchTrendsPage({ name: 'Octocat', username: 'octocat' }, { queries: [] });
    expect(html).not.toContain('class="sort-btn');
  });
});
