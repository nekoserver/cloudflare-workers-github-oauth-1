import { describe, expect, it } from 'vitest';
import { loadCommitSummaryAllowedRepos } from './utils/commitSummaryAllowedRepos';

// 対象: /api/commit-summary-external・/api/jev-test-score-external・
// /api/jev-test-score-trend-external が許可するrepoNameの一覧を、固定配列
// ではなく都度DBから取得するようにした対応。
//
// 背景: 以前はCOMMIT_SUMMARY_ALLOWED_REPOSという3件固定の配列をハードコード
// しており、GitHub Appのインストール対象リポジトリ(rust-worker-sqlx-d1等)が
// 増えても追随できず、dynamicnekoのtree-view「推移」リンクでrust-worker-
// sqlx-d1が「repoNameは次のいずれかである必要があります」として拒否されていた。
// 当初はinstallation_permissionsだけを参照する実装にしたが、本番で確認した
// ところこのテーブルが0行(installationイベント未記録)で、以前は動いていた
// 3リポジトリぶんまで全滅するregressionを起こした。installation_permissions
// とrepo_commit_index(ルール24で手動投入される実コミットデータ)の両方を
// UNIONして参照することで、どちらか一方が空・未整備でも機能するようにした。
//
// 故障シナリオ:
//   (1) installation_permissionsだけに存在するrepo_nameが一覧に反映されない
//   (2) repo_commit_indexだけに存在するrepo_nameが一覧に反映されない
//   (3) 両方のテーブルが空のときに例外を投げる
//   (4) 両テーブルに同じrepo_nameがあるとき重複して一覧に入ってしまう(UNION漏れ)
//   (5) repository_selection='all'(repo_name=NULL)の行が一覧にnullとして混入する

function createMockDb(rows: { repo_name: string | null }[]) {
  return {
    prepare: (sql: string) => ({
      all: async () => ({
        results: sql.includes('installation_permissions') && sql.includes('repo_commit_index') ? rows : [],
      }),
    }),
  } as unknown as D1Database;
}

describe('loadCommitSummaryAllowedRepos', () => {
  it('installation_permissions・repo_commit_indexいずれかに存在するrepo_nameの一覧を返す', async () => {
    const db = createMockDb([
      { repo_name: 'nekoserver/cloudflare-workers-github-oauth-1' },
      { repo_name: 'nekoserver/dynamicneko' },
      { repo_name: 'nekoserver/rust-worker-sqlx-d1' },
    ]);
    const allowed = await loadCommitSummaryAllowedRepos(db);
    expect(allowed).toEqual(['nekoserver/cloudflare-workers-github-oauth-1', 'nekoserver/dynamicneko', 'nekoserver/rust-worker-sqlx-d1']);
  });

  it('両テーブルが空でも例外を投げず空配列を返す(installation_permissionsが0行でも機能する)', async () => {
    const db = createMockDb([]);
    const allowed = await loadCommitSummaryAllowedRepos(db);
    expect(allowed).toEqual([]);
  });

  it('SQL文にUNION・installation_permissions・repo_commit_index・IS NOT NULLが含まれる', async () => {
    let capturedSql = '';
    const db = {
      prepare: (sql: string) => {
        capturedSql = sql;
        return { all: async () => ({ results: [] }) };
      },
    } as unknown as D1Database;
    await loadCommitSummaryAllowedRepos(db);
    expect(capturedSql).toContain('UNION');
    expect(capturedSql).toContain('installation_permissions');
    expect(capturedSql).toContain('repo_commit_index');
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
