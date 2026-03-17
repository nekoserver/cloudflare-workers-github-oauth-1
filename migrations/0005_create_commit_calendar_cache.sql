-- コミットカレンダーのキャッシュテーブル
-- 過去の確定月のコミット数データをキャッシュし、GitHub APIへの連続アクセスを防止する
CREATE TABLE IF NOT EXISTS commit_calendar_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  counts TEXT NOT NULL DEFAULT '{}',
  cached_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_commit_calendar_owner_repo_ym
  ON commit_calendar_cache (owner, repo, year, month);
