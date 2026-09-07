/**
 * /status ページの「関連ページ」列(TABLE_PAGE_MAP)のテスト
 *
 * 対象: 「テーブル名、どのページと関連してるのかをはっきりさせることはできないのか」
 * という指摘への対応。src/data/tablePageMap.ts(scripts/generate-table-page-map.ts
 * の実行結果)を使って、/status のテーブル別マイグレーション状況テーブルに
 * 「関連ページ」列を追加する。
 *
 * 故障シナリオ:
 *   (1) tablePageMapに無いテーブルで「関連ページ」列がクラッシュする(不明表示になるべき)
 *   (2) 複数ページから参照されるテーブルの全ページが表示されない
 *   (3) テーブル名・パスにHTMLとして解釈される文字が含まれた場合にXSSになる
 */
import { describe, it, expect } from 'vitest';
import { getCacheStatusPage, type CacheStatusData } from './views/status';

const baseData: CacheStatusData = {
  commitCache: { totalEntries: 0, totalCommits: 0, repos: [], byMonth: [], byMonthByRepo: [], entries: [] },
  repoColors: [],
  repoGroups: [],
  installationPerms: { totalEntries: 0, entries: [] },
  cacheStats: { totalGithubFetch: 0, totalCacheSave: 0, totalCacheLookup: 0, totalCacheHit: 0, entries: [] },
  tables: [],
  tableGroupMap: {},
  tablePageMap: {},
  unclassifiedAutoDetectedTables: [],
  groupLabels: {},
  groupColors: {},
  tableFkPairs: [],
  userContext: { teamName: null, teamId: null, workspaceName: null, workspaceId: null, role: null, allWorkspaces: [] },
  pendingColumnMigrations: [],
};

const minimalUser = { username: 'testuser' };

describe('/status の「関連ページ」列', () => {
  it('tablePageMapに複数ページが登録されているテーブルは、全ページがバッジとして表示される', () => {
    const html = getCacheStatusPage(minimalUser, {
      ...baseData,
      tables: [{ name: 'user_sessions', exists: true, rowCount: 3, migration: '0001', description: '', syncPolicy: 'auto' }],
      tablePageMap: {
        user_sessions: [
          { method: 'GET', path: '/status' },
          { method: 'GET', path: '/welcome' },
          { method: 'POST', path: '/api/aichat' },
        ],
      },
    });
    expect(html).toContain('GET /status');
    expect(html).toContain('GET /welcome');
    expect(html).toContain('POST /api/aichat');
  });

  it('tablePageMapに無いテーブルは「(不明)」バッジになりクラッシュしない', () => {
    const html = getCacheStatusPage(minimalUser, {
      ...baseData,
      tables: [{ name: 'some_unmapped_table', exists: true, rowCount: 0, migration: '0099', description: '', syncPolicy: 'manual' }],
      tablePageMap: {},
    });
    expect(html).toContain('table-page-badge-unknown');
    expect(html).toContain('(不明)');
  });

  it('テーブル名・パス中の特殊文字はエスケープされHTMLとして解釈されない', () => {
    const html = getCacheStatusPage(minimalUser, {
      ...baseData,
      tables: [{ name: 'xss_table', exists: true, rowCount: 0, migration: '0001', description: '', syncPolicy: 'auto' }],
      tablePageMap: {
        xss_table: [{ method: 'GET', path: '/foo"><script>alert(1)</script>' }],
      },
    });
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('関連ページ列のヘッダーが表に含まれる', () => {
    const html = getCacheStatusPage(minimalUser, baseData);
    expect(html).toContain('関連ページ');
  });
});
