-- 世界遺産ページのエリアズーム範囲（テーブルA相当）を保存する
CREATE TABLE IF NOT EXISTS heritage_area_boxes (
  area_seq INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  box TEXT NOT NULL DEFAULT 'box',
  top_left_lat REAL NOT NULL,
  top_left_lon REAL NOT NULL,
  bottom_right_lat REAL NOT NULL,
  bottom_right_lon REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_heritage_area_boxes_user_created
  ON heritage_area_boxes(user_id, created_at DESC);
