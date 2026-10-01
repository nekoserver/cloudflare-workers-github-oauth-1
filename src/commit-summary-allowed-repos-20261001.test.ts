import { describe, expect, it } from 'vitest';
import { loadCommitSummaryAllowedRepos } from './utils/commitSummaryAllowedRepos';

// 対象: /api/commit-summary-external・/api/jev-test-score-external・
// /api/jev-test-score-trend-external が許可するrepoNameの一覧を、固定配列
// ではなくinstallation_permissionsテーブルから都度取得するようにした対応。
//
// 背景: 以前はCOMMIT_SUMMARY_ALLOWED_REPOSという3件固定の配列をハードコード
// しており、GitHub Appのインストール対象リポジトリ(rust-worker-sqlx-d1等)が
// 増えても追随できず、dynamicnekoのtree-view「推移」リンクでrust-worker-
// sqlx-d1が「repoNameは次のいずれかである必要があります」として拒否されていた。
// repo_commit_index(過去にコミットが記録されたかどうか)ではなく
// installation_permissions(GitHub App webhookで自動更新される、現在
// インストール済みのリポジトリ一覧)を参照することで、コミット未登録の
// 新規リポジトリでも拒否されないようにしている。
//
// 故障シナリオ:
//   (1) installation_permissionsに新しいrepo_nameが追加されても一覧に反映されない
//   (2) installation_permissionsが空のときに例外を投げる
//   (3) repository_selection='all'(repo_name=NULL)の行が一覧にnullとして混入する
//   (4) 同じrepo_nameが複数installation分重複して一覧に入ってしまう(DISTINCT漏れ)

function createMockDb(rows: { repo_name: string | null }[]) {
  return {
    prepare: (sql: string) => ({
      all: async () => ({
        results: sql.includes('installation_permissions') ? rows : [],
      }),
    }),
  } as unknown as D1Database;
}

describe('loadCommitSummaryAllowedRepos', () => {
  it('installation_permissionsに存在するrepo_nameの一覧を返す', async () => {
    const db = createMockDb([
      { repo_name: 'nekoserver/cloudflare-workers-github-oauth-1' },
      { repo_name: 'nekoserver/dynamicneko' },
      { repo_name: 'nekoserver/rust-worker-sqlx-d1' },
    ]);
    const allowed = await loadCommitSummaryAllowedRepos(db);
    expect(allowed).toEqual(['nekoserver/cloudflare-workers-github-oauth-1', 'nekoserver/dynamicneko', 'nekoserver/rust-worker-sqlx-d1']);
  });

  it('installation_permissionsが空でも例外を投げず空配列を返す', async () => {
    const db = createMockDb([]);
    const allowed = await loadCommitSummaryAllowedRepos(db);
    expect(allowed).toEqual([]);
  });

  it('SQL文にWHERE repo_name IS NOT NULLとDISTINCTが含まれる(全リポジトリ選択installのNULL行を除外し、重複排除する)', async () => {
    let capturedSql = '';
    const db = {
      prepare: (sql: string) => {
        capturedSql = sql;
        return { all: async () => ({ results: [] }) };
      },
    } as unknown as D1Database;
    await loadCommitSummaryAllowedRepos(db);
    expect(capturedSql).toContain('DISTINCT');
    expect(capturedSql).toContain('installation_permissions');
    expect(capturedSql).toContain('IS NOT NULL');
  });

  it('resultsがundefinedでも空配列にフォールバックする(例外にしない)', async () => {
    const db = {
      prepare: () => ({ all: async () => ({ results: undefined }) }),
    } as unknown as D1Database;
    const allowed = await loadCommitSummaryAllowedRepos(db);
    expect(allowed).toEqual([]);
  });
});
