// /api/commit-summary-external・/api/jev-test-score-external・
// /api/jev-test-score-trend-external が受け付けるrepoNameの一覧。
//
// 以前は COMMIT_SUMMARY_ALLOWED_REPOS という固定配列(3件)をハードコードして
// いたが、repo_commit_index(CLAUDE.mdルール24で手動運用しているテーブル)に
// 追跡対象リポジトリが増減しても追随できず、「現在把握しているリポジトリ数を
// その都度参照すべきで固定値を使うべきでない」という指摘を受けて撤廃した
// (2026-10-01、dynamicnekoのtree-view「推移」リンクでrust-worker-sqlx-d1が
// 弾かれる不具合として顕在化)。
//
// 当初はinstallation_permissions(GitHub App webhookで自動更新される、現在
// インストール済みのリポジトリ一覧)だけを参照していたが、本番で実際に
// 確認したところこのテーブルが0行だった(installationイベントが一度も
// 記録されていない)ため、以前は動いていた3リポジトリぶんまで全滅する
// regressionを起こした。installation_permissionsとrepo_commit_index
// (ルール24で手動投入される実コミットデータ)の両方をUNIONして参照する
// ことで、どちらか一方が空・未整備でも機能するようにした。
export async function loadCommitSummaryAllowedRepos(db: D1Database): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT repo_name FROM installation_permissions WHERE repo_name IS NOT NULL
       UNION
       SELECT repo_name FROM repo_commit_index
       ORDER BY repo_name ASC`
    )
    .all<{ repo_name: string }>();
  return (results ?? []).map((row) => row.repo_name);
}
