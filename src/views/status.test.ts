/**
 * /status ページの保存データモーダル内 request_id リンク化テスト
 *
 * formatCellValue (クライアントサイドJS) が ai_summary_log テーブルの
 * request_id カラムの UUID値を /ai-summary/{id} へのリンクとして描画する
 * ことを検証する。
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

describe('/status ページの formatCellValue UUID リンク化', () => {
  it('formatCellValue が ai_summary_log の request_id を /ai-summary/ リンクに変換するロジックを含む', () => {
    const html = getCacheStatusPage(minimalUser, minimalData);

    expect(html).toContain('function formatCellValue(column, value, tableName)');
    expect(html).toContain('/ai-summary/');
    expect(html).toContain('ai_summary_log');
  });

  it('renderStatusTablePreview が formatCellValue にカラム名とテーブル名を渡している', () => {
    const html = getCacheStatusPage(minimalUser, minimalData);

    expect(html).toContain('formatCellValue(column, row[column], tableName)');
  });
});
