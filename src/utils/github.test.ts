import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  findInstallationByExactSlugs,
  isWebhookUrlMatchingHosts,
  getGitHubCommits,
  computeCommitStats,
  getGitHubCommitsForStats,
  sumCountsTotal,
  buildPastMonthRange,
  CLOUDFLARE_DEPLOY_SLUGS,
  VERCEL_DEPLOY_SLUGS,
  SLACK_WEBHOOK_HOSTS,
  type GitHubInstallation,
} from './github';

/**
 * テストシナリオ: mantine-ui-nextra-1 は Vercel 連携のみで Cloudflare 連携していない。
 * 以前の実装では app_slug の部分一致（includes）により、
 * Cloudflare 関連だがデプロイ用ではない App にもマッチし誤検知していた。
 */

// ---- テスト用インストールデータ ----

/** Cloudflare Pages デプロイ用 App（selected: repo-a, repo-b のみ） */
const cfPagesInstallation: GitHubInstallation = {
  id: 100,
  app_id: 1,
  app_slug: 'cloudflare-pages',
  permissions: { contents: 'read', deployments: 'write' },
  repository_selection: 'selected',
};

/** Cloudflare Workers and Pages デプロイ用 App（all repos） */
const cfWorkersAndPagesInstallation: GitHubInstallation = {
  id: 101,
  app_id: 2,
  app_slug: 'cloudflare-workers-and-pages',
  permissions: { contents: 'read', deployments: 'write' },
  repository_selection: 'all',
};

/** Cloudflare 関連だがデプロイ用ではない App（例: Bot、セキュリティスキャンなど） */
const cfBotInstallation: GitHubInstallation = {
  id: 102,
  app_id: 3,
  app_slug: 'cloudflare-bot-management',
  permissions: { contents: 'read' },
  repository_selection: 'all',
};

/** Vercel デプロイ用 App（selected: mantine-ui-nextra-1 を含む） */
const vercelInstallation: GitHubInstallation = {
  id: 200,
  app_id: 10,
  app_slug: 'vercel',
  permissions: { contents: 'read', deployments: 'write' },
  repository_selection: 'selected',
};

/** app_slug が undefined のインストール */
const noSlugInstallation: GitHubInstallation = {
  id: 300,
  app_id: 20,
  permissions: { contents: 'read' },
  repository_selection: 'all',
};

// ---- テストケース ----

describe('findInstallationByExactSlugs', () => {
  describe('Cloudflare デプロイ用 App のマッチング', () => {
    it('cloudflare-pages に完全一致する', () => {
      const installations = [cfPagesInstallation, vercelInstallation];
      const result = findInstallationByExactSlugs(installations, CLOUDFLARE_DEPLOY_SLUGS);
      expect(result).toBeDefined();
      expect(result!.app_slug).toBe('cloudflare-pages');
    });

    it('cloudflare-workers-and-pages に完全一致する', () => {
      const installations = [cfWorkersAndPagesInstallation, vercelInstallation];
      const result = findInstallationByExactSlugs(installations, CLOUDFLARE_DEPLOY_SLUGS);
      expect(result).toBeDefined();
      expect(result!.app_slug).toBe('cloudflare-workers-and-pages');
    });

    it('cloudflare-bot-management はデプロイ用 slug ではないのでマッチしない', () => {
      const installations = [cfBotInstallation, vercelInstallation];
      const result = findInstallationByExactSlugs(installations, CLOUDFLARE_DEPLOY_SLUGS);
      expect(result).toBeUndefined();
    });

    it('部分一致する slug "cloudflare" 単体はデプロイ用リストにないのでマッチしない', () => {
      const installation: GitHubInstallation = {
        id: 103,
        app_id: 4,
        app_slug: 'cloudflare',
        permissions: { contents: 'read' },
        repository_selection: 'all',
      };
      const result = findInstallationByExactSlugs([installation], CLOUDFLARE_DEPLOY_SLUGS);
      expect(result).toBeUndefined();
    });

    it('Cloudflare デプロイ App がインストールされていなければ undefined を返す', () => {
      const installations = [vercelInstallation, noSlugInstallation];
      const result = findInstallationByExactSlugs(installations, CLOUDFLARE_DEPLOY_SLUGS);
      expect(result).toBeUndefined();
    });
  });

  describe('Vercel デプロイ用 App のマッチング', () => {
    it('vercel に完全一致する', () => {
      const installations = [cfPagesInstallation, vercelInstallation];
      const result = findInstallationByExactSlugs(installations, VERCEL_DEPLOY_SLUGS);
      expect(result).toBeDefined();
      expect(result!.app_slug).toBe('vercel');
    });

    it('vercel-something はデプロイ用リストにないのでマッチしない', () => {
      const installation: GitHubInstallation = {
        id: 201,
        app_id: 11,
        app_slug: 'vercel-something',
        permissions: { contents: 'read' },
        repository_selection: 'selected',
      };
      const result = findInstallationByExactSlugs([installation], VERCEL_DEPLOY_SLUGS);
      expect(result).toBeUndefined();
    });

    it('Vercel App がインストールされていなければ undefined を返す', () => {
      const installations = [cfPagesInstallation, noSlugInstallation];
      const result = findInstallationByExactSlugs(installations, VERCEL_DEPLOY_SLUGS);
      expect(result).toBeUndefined();
    });
  });

  describe('mantine-ui-nextra-1 のシナリオ', () => {
    it('Cloudflare Bot のみインストール → Cloudflare デプロイ判定にマッチしない', () => {
      const installations = [cfBotInstallation, vercelInstallation];
      const cfMatch = findInstallationByExactSlugs(installations, CLOUDFLARE_DEPLOY_SLUGS);
      expect(cfMatch).toBeUndefined();
    });

    it('Vercel App は正しくマッチする', () => {
      const installations = [cfBotInstallation, vercelInstallation];
      const vercelMatch = findInstallationByExactSlugs(installations, VERCEL_DEPLOY_SLUGS);
      expect(vercelMatch).toBeDefined();
      expect(vercelMatch!.app_slug).toBe('vercel');
    });
  });

  describe('エッジケース', () => {
    it('空のインストール一覧では undefined を返す', () => {
      expect(findInstallationByExactSlugs([], CLOUDFLARE_DEPLOY_SLUGS)).toBeUndefined();
      expect(findInstallationByExactSlugs([], VERCEL_DEPLOY_SLUGS)).toBeUndefined();
    });

    it('app_slug が undefined のインストールはスキップされる', () => {
      const result = findInstallationByExactSlugs([noSlugInstallation], CLOUDFLARE_DEPLOY_SLUGS);
      expect(result).toBeUndefined();
    });

    it('大文字小文字を無視してマッチする', () => {
      const installation: GitHubInstallation = {
        id: 104,
        app_id: 5,
        app_slug: 'Cloudflare-Pages',
        permissions: { contents: 'read' },
        repository_selection: 'selected',
      };
      const result = findInstallationByExactSlugs([installation], CLOUDFLARE_DEPLOY_SLUGS);
      expect(result).toBeDefined();
      expect(result!.app_slug).toBe('Cloudflare-Pages');
    });
  });
});

describe('isWebhookUrlMatchingHosts', () => {
  describe('Slack Webhook URL の判定', () => {
    it('hooks.slack.com の URL にマッチする', () => {
      expect(isWebhookUrlMatchingHosts(
        'https://hooks.slack.com/services/T00000000/B00000000/XXXX',
        SLACK_WEBHOOK_HOSTS
      )).toBe(true);
    });

    it('hooks.slack.com のパスが異なってもマッチする', () => {
      expect(isWebhookUrlMatchingHosts(
        'https://hooks.slack.com/workflows/T00000000/XXXX',
        SLACK_WEBHOOK_HOSTS
      )).toBe(true);
    });

    it('大文字小文字を無視してマッチする', () => {
      expect(isWebhookUrlMatchingHosts(
        'https://Hooks.Slack.Com/services/T00000000/B00000000/XXXX',
        SLACK_WEBHOOK_HOSTS
      )).toBe(true);
    });

    it('api.slack.com はマッチしない', () => {
      expect(isWebhookUrlMatchingHosts(
        'https://api.slack.com/events',
        SLACK_WEBHOOK_HOSTS
      )).toBe(false);
    });

    it('slack.com 単体はマッチしない', () => {
      expect(isWebhookUrlMatchingHosts(
        'https://slack.com/webhook',
        SLACK_WEBHOOK_HOSTS
      )).toBe(false);
    });

    it('無関係な URL はマッチしない', () => {
      expect(isWebhookUrlMatchingHosts(
        'https://example.com/hooks',
        SLACK_WEBHOOK_HOSTS
      )).toBe(false);
    });

    it('不正な URL は false を返す', () => {
      expect(isWebhookUrlMatchingHosts('not-a-url', SLACK_WEBHOOK_HOSTS)).toBe(false);
    });

    it('空文字列は false を返す', () => {
      expect(isWebhookUrlMatchingHosts('', SLACK_WEBHOOK_HOSTS)).toBe(false);
    });
  });
});

describe('getGitHubCommits — isMerge 判定', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parents が 2 件以上のコミットは isMerge=true、1 件以下は false を返す', async () => {
    const apiResponse = [
      {
        sha: 'merge1',
        html_url: 'https://github.com/o/r/commit/merge1',
        commit: { message: 'Merge pull request #1', author: { name: 'alice', date: '2026-05-01T00:00:00Z' } },
        author: { login: 'alice' },
        parents: [{ sha: 'p1' }, { sha: 'p2' }],
      },
      {
        sha: 'normal1',
        html_url: 'https://github.com/o/r/commit/normal1',
        commit: { message: 'fix: bug', author: { name: 'bob', date: '2026-05-02T00:00:00Z' } },
        author: { login: 'bob' },
        parents: [{ sha: 'p3' }],
      },
      {
        sha: 'initial',
        html_url: 'https://github.com/o/r/commit/initial',
        commit: { message: 'initial commit', author: { name: 'alice', date: '2026-05-03T00:00:00Z' } },
        author: { login: 'alice' },
        parents: [],
      },
      {
        sha: 'octopus',
        html_url: 'https://github.com/o/r/commit/octopus',
        commit: { message: 'Merge branches', author: { name: 'bob', date: '2026-05-04T00:00:00Z' } },
        author: { login: 'bob' },
        parents: [{ sha: 'p4' }, { sha: 'p5' }, { sha: 'p6' }],
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(apiResponse), { status: 200 })
    );

    const result = await getGitHubCommits({ owner: 'o', repo: 'r', perPage: 10 });

    expect(result.status).toBe(200);
    expect(result.commits).toHaveLength(4);
    expect(result.commits[0]).toMatchObject({ sha: 'merge1', isMerge: true });
    expect(result.commits[1]).toMatchObject({ sha: 'normal1', isMerge: false });
    expect(result.commits[2]).toMatchObject({ sha: 'initial', isMerge: false });
    expect(result.commits[3]).toMatchObject({ sha: 'octopus', isMerge: true });
  });

  it('parents プロパティが欠落しても isMerge=false で安全にマップする', async () => {
    const apiResponse = [
      {
        sha: 'noparents',
        html_url: 'https://github.com/o/r/commit/noparents',
        commit: { message: 'x', author: { name: 'x', date: '2026-05-05T00:00:00Z' } },
        author: { login: 'x' },
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(apiResponse), { status: 200 })
    );

    const result = await getGitHubCommits({ owner: 'o', repo: 'r', perPage: 10 });
    expect(result.commits[0].isMerge).toBe(false);
  });
});

describe('computeCommitStats', () => {
  it('空配列は空配列を返す', () => {
    expect(computeCommitStats([])).toEqual([]);
  });

  it('単一コミット（非マージ）を1件にまとめる', () => {
    const result = computeCommitStats([{ authorLogin: 'alice', authorName: 'Alice', isMerge: false }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ authorLogin: 'alice', commitCount: 1, mergeCount: 0 });
  });

  it('マージコミットのカウントを正しく計上する', () => {
    const commits = [
      { authorLogin: 'alice', authorName: 'Alice', isMerge: true },
      { authorLogin: 'alice', authorName: 'Alice', isMerge: false },
    ];
    const result = computeCommitStats(commits);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ authorLogin: 'alice', commitCount: 2, mergeCount: 1 });
  });

  it('authorLoginがnullの場合はauthorNameで集計する', () => {
    const result = computeCommitStats([{ authorLogin: null, authorName: 'Bob', isMerge: false }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ authorLogin: '', authorName: 'Bob', commitCount: 1 });
  });

  it('authorLogin/authorNameともにnullの場合はUnknownキーで集計する', () => {
    const result = computeCommitStats([
      { authorLogin: null, authorName: null, isMerge: false },
      { authorLogin: null, authorName: null, isMerge: true },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ commitCount: 2, mergeCount: 1 });
  });

  it('コミット数降順でソートされる', () => {
    const commits = [
      { authorLogin: 'alice', authorName: 'Alice', isMerge: false },
      { authorLogin: 'bob', authorName: 'Bob', isMerge: false },
      { authorLogin: 'bob', authorName: 'Bob', isMerge: false },
    ];
    const result = computeCommitStats(commits);
    expect(result[0].authorLogin).toBe('bob');
    expect(result[1].authorLogin).toBe('alice');
  });

  it('コミット数が同じ場合はauthorLoginのアルファベット順', () => {
    const commits = [
      { authorLogin: 'zara', authorName: 'Zara', isMerge: false },
      { authorLogin: 'alice', authorName: 'Alice', isMerge: false },
    ];
    const result = computeCommitStats(commits);
    expect(result[0].authorLogin).toBe('alice');
    expect(result[1].authorLogin).toBe('zara');
  });

  it('複数ユーザーの集計を正しく行う', () => {
    const commits = [
      { authorLogin: 'alice', authorName: 'Alice', isMerge: false },
      { authorLogin: 'bob', authorName: 'Bob', isMerge: true },
      { authorLogin: 'alice', authorName: 'Alice', isMerge: true },
      { authorLogin: 'bob', authorName: 'Bob', isMerge: false },
      { authorLogin: 'bob', authorName: 'Bob', isMerge: false },
    ];
    const result = computeCommitStats(commits);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ authorLogin: 'bob', commitCount: 3, mergeCount: 1 });
    expect(result[1]).toMatchObject({ authorLogin: 'alice', commitCount: 2, mergeCount: 1 });
  });
});

describe('getGitHubCommitsForStats — ページネーション', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('単一ページのレスポンスを正しく処理する', async () => {
    const apiResponse = [
      {
        sha: 'abc1',
        html_url: 'https://github.com/o/r/commit/abc1',
        commit: { message: 'fix', author: { name: 'Alice', date: '2026-05-01T00:00:00Z' } },
        author: { login: 'alice' },
        parents: [{ sha: 'p1' }],
      },
      {
        sha: 'abc2',
        html_url: 'https://github.com/o/r/commit/abc2',
        commit: { message: 'Merge PR', author: { name: 'Bob', date: '2026-05-02T00:00:00Z' } },
        author: { login: 'bob' },
        parents: [{ sha: 'p2' }, { sha: 'p3' }],
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(apiResponse), { status: 200 })
    );

    const result = await getGitHubCommitsForStats({ owner: 'o', repo: 'r' });
    expect(result.status).toBe(200);
    expect(result.commits).toHaveLength(2);
    expect(result.commits[0]).toMatchObject({ sha: 'abc1', authorLogin: 'alice', isMerge: false });
    expect(result.commits[1]).toMatchObject({ sha: 'abc2', authorLogin: 'bob', isMerge: true });
  });

  it('APIエラー時に部分結果と実際のstatusを返す', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 })
    );

    const result = await getGitHubCommitsForStats({ owner: 'o', repo: 'missing' });
    expect(result.status).toBe(404);
    expect(result.commits).toHaveLength(0);
  });

  it('sha/html_urlが欠けたエントリはスキップする', async () => {
    const apiResponse = [
      { sha: '', html_url: '', commit: { message: 'x', author: { name: 'x', date: '2026-05-01T00:00:00Z' } }, author: { login: 'x' }, parents: [] },
      { sha: 'abc3', html_url: 'https://github.com/o/r/commit/abc3', commit: { message: 'y', author: { name: 'y', date: '2026-05-01T00:00:00Z' } }, author: { login: 'y' }, parents: [] },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(apiResponse), { status: 200 })
    );

    const result = await getGitHubCommitsForStats({ owner: 'o', repo: 'r' });
    expect(result.commits).toHaveLength(1);
    expect(result.commits[0].sha).toBe('abc3');
  });
});

describe('sumCountsTotal', () => {
  it('空オブジェクトは 0 を返す', () => {
    expect(sumCountsTotal({})).toBe(0);
  });
  it('null/undefined は 0 を返す', () => {
    expect(sumCountsTotal(null)).toBe(0);
    expect(sumCountsTotal(undefined)).toBe(0);
  });
  it('全日の合計を返す', () => {
    expect(sumCountsTotal({ '2026-05-01': 3, '2026-05-02': 7, '2026-05-15': 2 })).toBe(12);
  });
  it('NaN は無視する', () => {
    expect(sumCountsTotal({ '2026-05-01': 3, '2026-05-02': NaN as any })).toBe(3);
  });
});

describe('buildPastMonthRange', () => {
  it('作成月 < 当月 のとき、(当月-1) から作成月までを降順で返す', () => {
    expect(buildPastMonthRange('2026-03', '2026-05')).toEqual(['2026-04', '2026-03']);
  });
  it('年をまたぐケースを正しく扱う', () => {
    expect(buildPastMonthRange('2025-11', '2026-02')).toEqual(['2026-01', '2025-12', '2025-11']);
  });
  it('作成月 == 当月 のとき空配列を返す', () => {
    expect(buildPastMonthRange('2026-05', '2026-05')).toEqual([]);
  });
  it('作成月 > 当月 のとき空配列を返す（異常入力）', () => {
    expect(buildPastMonthRange('2026-06', '2026-05')).toEqual([]);
  });
  it('作成月が (当月-1) のとき1件のみ返す', () => {
    expect(buildPastMonthRange('2026-04', '2026-05')).toEqual(['2026-04']);
  });
  it('フォーマット不正の場合は空配列を返す', () => {
    expect(buildPastMonthRange('2026/05', '2026-04')).toEqual([]);
    expect(buildPastMonthRange('2026-05', 'invalid')).toEqual([]);
  });
});
