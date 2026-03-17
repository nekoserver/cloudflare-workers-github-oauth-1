-- Layer 2: リポジトリ単位キャッシュ
-- 最新コミット、Issue/PR数、Webhook一覧など
-- ユーザー不問：誰が取得しても同じデータを共有する
CREATE TABLE IF NOT EXISTS repo_cache (
  owner       TEXT NOT NULL,
  repo        TEXT NOT NULL,
  data_type   TEXT NOT NULL,
  data        TEXT NOT NULL DEFAULT '{}',
  cached_at   TEXT NOT NULL,
  PRIMARY KEY (owner, repo, data_type)
);

-- Layer 3: ユーザー単位キャッシュ
-- リポジトリ一覧、Installation情報など
-- ユーザーごとに異なるデータを保持する
CREATE TABLE IF NOT EXISTS user_cache (
  user_id     TEXT NOT NULL,
  data_type   TEXT NOT NULL,
  data        TEXT NOT NULL DEFAULT '{}',
  cached_at   TEXT NOT NULL,
  PRIMARY KEY (user_id, data_type)
);
