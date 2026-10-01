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
// repo_commit_index自体ではなく installation_permissions(GitHub App
// webhookで自動更新される、現在インストール済みのリポジトリ一覧)を参照する。
// repo_commit_indexは「過去にコミットが1件でも記録されたか」を表すだけで、
// 新しく追加したばかりでコミット未登録のリポジトリや、該当コミットが0件の
// 検索結果では空になってしまい、「有効なリポジトリかどうか」の判定には
// 不適切(GitHub Appのアクセス権限という、本来の認可境界とも一致しない)。
export async function loadCommitSummaryAllowedRepos(db: D1Database): Promise<string[]> {
  const { results } = await db
    .prepare('SELECT DISTINCT repo_name FROM installation_permissions WHERE repo_name IS NOT NULL ORDER BY repo_name ASC')
    .all<{ repo_name: string }>();
  return (results ?? []).map((row) => row.repo_name);
}
