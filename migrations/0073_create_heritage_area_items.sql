-- 保存済みエリアに含まれる世界遺産・空港・駅・火山などの地点をエリア番号へ紐付ける
CREATE TABLE IF NOT EXISTS heritage_area_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  area_seq INTEGER NOT NULL,
  category TEXT NOT NULL,
  item_name TEXT NOT NULL,
  lat REAL,
  lon REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (area_seq) REFERENCES heritage_area_boxes(area_seq) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_heritage_area_items_area_seq
  ON heritage_area_items(area_seq);

CREATE INDEX IF NOT EXISTS idx_heritage_area_items_category
  ON heritage_area_items(category, item_name);
