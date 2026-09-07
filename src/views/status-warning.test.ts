import { describe, expect, it } from 'vitest';
import { getCacheStatusPage, type CacheStatusData } from './status';

const data: CacheStatusData = {
  commitCache: { totalEntries: 0, totalCommits: 0, repos: [], byMonth: [], byMonthByRepo: [], entries: [] },
  repoColors: [],
  repoGroups: [],
  installationPerms: { totalEntries: 0, entries: [] },
  cacheStats: { totalGithubFetch: 0, totalCacheSave: 0, totalCacheLookup: 0, totalCacheHit: 0, entries: [] },
  tables: [
    { name: 'unknown_table', exists: true, rowCount: 1, migration: 'unknown', description: '自動検出', syncPolicy: 'manual' },
    { name: 'commit_agent_log', exists: true, rowCount: 1, migration: '0025', description: 'コミットエージェント検出ログ', syncPolicy: 'auto' },
  ],
  tableGroupMap: { commit_agent_log: 'ai' },
  tablePageMap: {},
  unclassifiedAutoDetectedTables: [],
  groupLabels: { ai: 'AI Summary' },
  groupColors: {},
  tableFkPairs: [],
  userContext: { teamName: null, teamId: null, workspaceName: null, workspaceId: null, role: null, allWorkspaces: [] },
  pendingColumnMigrations: [],
};

describe('/status 未分類警告スクリプト', () => {
  it('commit_agent_log 行が欠けていても 0025 行を補完表示する', () => {
    const html = getCacheStatusPage({ username: 'u' }, {
      ...data,
      tables: [{ name: 'unknown_table', exists: true, rowCount: 1, migration: 'unknown', description: '自動検出', syncPolicy: 'manual' }],
    });
    expect(html).toContain('<code>commit_agent_log</code>');
    expect(html).toContain('>0025<');
  });

  it('行に data-migration 属性を埋め込む', () => {
    const html = getCacheStatusPage({ username: 'u' }, data);
    expect(html).toContain('data-migration="unknown"');
    expect(html).toContain('data-migration="0025"');
  });

  it('unknown migration の未分類警告を除外する設定を参照する', () => {
    const html = getCacheStatusPage({ username: 'u', statusIgnoreUnknownUnclassifiedWarning: 'on' }, data);
    expect(html).toContain("ignoreUnknownUnclassifiedWarning");
    expect(html).toContain("migration === 'unknown'");
  });

  it('slack_interaction_log が migration 0024 として表示される', () => {
    const html = getCacheStatusPage({ username: 'u' }, {
      ...data,
      tables: [
        { name: 'slack_interaction_log', exists: true, rowCount: 5, migration: '0024', description: 'Slack操作ログ', syncPolicy: 'auto' },
        { name: 'commit_agent_log', exists: true, rowCount: 1, migration: '0025', description: 'コミットエージェント検出ログ', syncPolicy: 'auto' },
      ],
      tableGroupMap: { commit_agent_log: 'ai', slack_interaction_log: 'config' },
    });
    expect(html).toContain('<code>slack_interaction_log</code>');
    expect(html).toContain('data-migration="0024"');
    expect(html).toContain('data-migration="0025"');
  });

  it('table_catalog/table_column_keys が migration 0024 ではなく 0026 として表示される', () => {
    const html = getCacheStatusPage({ username: 'u' }, {
      ...data,
      tables: [
        { name: 'table_catalog', exists: true, rowCount: 10, migration: '0026', description: 'テーブルカタログ（グループ・メタ情報）', syncPolicy: 'manual' },
        { name: 'table_column_keys', exists: true, rowCount: 20, migration: '0026', description: 'カラムキー定義（PK/FK）', syncPolicy: 'manual' },
      ],
      tableGroupMap: { table_catalog: 'config', table_column_keys: 'config' },
    });
    expect(html).toContain('data-migration="0026"');
    expect(html).not.toContain('data-table-name="table_catalog" data-migration="0024"');
  });
});
