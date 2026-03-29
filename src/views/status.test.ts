/**
 * /status ページの保存データモーダル内 request_id リンク化テスト
 *
 * formatPreviewValue (クライアントサイドJS) が request_id カラムの
 * UUID値を /ai-summary/{id} へのリンクとして描画することを検証する。
 * getCacheStatusPage の出力HTML内の inline JS にリンク生成ロジックが
 * 含まれていることをテストする。
 */
import { describe, it, expect } from 'vitest';
import { getCacheStatusPage, type CacheStatusData } from './status';

const minimalData: CacheStatusData = {
  commitCache: { totalEntries: 0, totalCommits: 0, repos: [], byMonth: [], byMonthByRepo: [], entries: [] },
  repoColors: [],
  repoGroups: [],
  installationPerms: { totalEntries: 0, entries: [] },
  cacheStats: { totalGithubFetch: 0, totalCacheSave: 0, totalCacheLookup: 0, totalCacheHit: 0, entries: [] },
  tables: [],
  userContext: { teamName: null, teamId: null, workspaceName: null, workspaceId: null, role: null, allWorkspaces: [] },
};

const minimalUser = { username: 'testuser' };

describe('/status ページの formatPreviewValue UUID リンク化', () => {
  it('formatPreviewValue が request_id カラムの UUID を /ai-summary/ リンクに変換するロジックを含む', () => {
    const html = getCacheStatusPage(minimalUser, minimalData);

    // formatPreviewValue が column 引数を受け取ること
    expect(html).toContain('function formatPreviewValue(value, column)');

    // request_id カラムの UUID を /ai-summary/ リンクにする分岐が存在すること
    expect(html).toContain('/ai-summary/');
    expect(html).toContain('request_id');
  });

  it('renderStatusTablePreview が formatPreviewValue にカラム名を渡している', () => {
    const html = getCacheStatusPage(minimalUser, minimalData);

    // formatPreviewValue(row[column], column) の形式で呼び出されていること
    expect(html).toContain('formatPreviewValue(row[column], column)');
  });
});
