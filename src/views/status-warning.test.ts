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
  groupLabels: { ai: 'AI Summary' },
  userContext: { teamName: null, teamId: null, workspaceName: null, workspaceId: null, role: null, allWorkspaces: [] },
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
});
