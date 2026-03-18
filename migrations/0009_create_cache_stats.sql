-- ユーザー別キャッシュ統計テーブル
-- コミット一覧のキャッシュヒット率を計算するための累計カウンターを保持する
-- 各カウンターは毎回のアクセス時に加算され、永続的に蓄積される
CREATE TABLE IF NOT EXISTS cache_stats (
  user_id TEXT NOT NULL,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  github_fetch_count INTEGER NOT NULL DEFAULT 0,
  cache_save_count INTEGER NOT NULL DEFAULT 0,
  cache_lookup_count INTEGER NOT NULL DEFAULT 0,
  cache_hit_count INTEGER NOT NULL DEFAULT 0,
  last_updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cache_stats_user_repo
  ON cache_stats (user_id, owner, repo);
