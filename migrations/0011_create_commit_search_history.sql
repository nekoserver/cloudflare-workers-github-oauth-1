-- コミット検索履歴テーブル（テーブルA）
-- ユーザーごとの検索キー・総ヒット数・検索日時・リポジトリ名を記録
CREATE TABLE IF NOT EXISTS commit_search_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  search_query TEXT NOT NULL,
  total_hits INTEGER NOT NULL DEFAULT 0,
  repo_names TEXT NOT NULL DEFAULT '[]',
  searched_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_commit_search_history_user_id ON commit_search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_commit_search_history_total_hits ON commit_search_history(user_id, total_hits DESC);

-- コミット検索リポジトリ別集計テーブル（テーブルB）
-- 各リポジトリごとのヒット数・リポジトリ名・検索キー・検索ユーザー名を記録
CREATE TABLE IF NOT EXISTS commit_search_repo_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  search_history_id INTEGER NOT NULL,
  repo_name TEXT NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  search_query TEXT NOT NULL,
  user_name TEXT NOT NULL,
  FOREIGN KEY (search_history_id) REFERENCES commit_search_history(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_commit_search_repo_stats_history_id ON commit_search_repo_stats(search_history_id);
