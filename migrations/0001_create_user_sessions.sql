-- ユーザーセッション情報テーブル
CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE,
  timezone TEXT DEFAULT 'UTC',
  session_duration TEXT DEFAULT '1h',
  last_login_at TEXT,
  current_login_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- user_idにインデックスを作成（検索の高速化）
CREATE INDEX IF NOT EXISTS idx_user_id ON user_sessions(user_id);
