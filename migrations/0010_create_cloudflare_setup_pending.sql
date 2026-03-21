-- Cloudflare 未連携リポジトリのセットアップ通知テーブル
-- リポジトリ作成後、Cloudflare Pages/Workers への連携を促すための通知を管理する
CREATE TABLE IF NOT EXISTS cloudflare_setup_pending (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  repo_full_name TEXT NOT NULL,
  is_private INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  dismissed_at TEXT,
  UNIQUE(user_id, repo_full_name)
);

CREATE INDEX IF NOT EXISTS idx_cloudflare_setup_pending_user
  ON cloudflare_setup_pending(user_id, dismissed_at);
