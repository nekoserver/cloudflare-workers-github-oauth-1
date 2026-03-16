import { describe, it, expect } from 'vitest';
import {
  findInstallationByExactSlugs,
  CLOUDFLARE_DEPLOY_SLUGS,
  VERCEL_DEPLOY_SLUGS,
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
      // mantine-ui-nextra-1 がアクセス対象に含まれていても、
      // cloudflare-bot-management はデプロイ用 slug ではないため無視される
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
