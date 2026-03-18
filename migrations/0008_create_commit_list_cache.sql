-- コミット一覧のキャッシュテーブル
-- 過去の確定日(アクセス当日以外)のコミット詳細データをキャッシュし、GitHub APIへのアクセスを削減する
CREATE TABLE IF NOT EXISTS commit_list_cache (
  workspace_id TEXT NOT NULL,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  date TEXT NOT NULL,
  commits_json TEXT NOT NULL DEFAULT '[]',
  commit_count INTEGER NOT NULL DEFAULT 0,
  cached_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_commit_list_ws_owner_repo_date
  ON commit_list_cache (workspace_id, owner, repo, date);
