CREATE TABLE IF NOT EXISTS jev_keyword_boundary_labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_text TEXT NOT NULL,
  options_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jev_keyword_boundary_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL,
  user_id TEXT NOT NULL,
  jev_keyword_boundary_label_id INTEGER NOT NULL REFERENCES jev_keyword_boundary_labels(id),
  value REAL NOT NULL,
  source_share_id TEXT,
  computed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_jev_keyword_boundary_evaluations_unique ON jev_keyword_boundary_evaluations(user_id, keyword, jev_keyword_boundary_label_id);
CREATE INDEX IF NOT EXISTS idx_jev_keyword_boundary_evaluations_keyword ON jev_keyword_boundary_evaluations(keyword);
CREATE INDEX IF NOT EXISTS idx_jev_keyword_boundary_evaluations_unknown ON jev_keyword_boundary_evaluations(user_id, jev_keyword_boundary_label_id, value, computed_at DESC);

INSERT OR IGNORE INTO jev_keyword_boundary_labels (question_text, options_json) VALUES
  ('このキーワードをユーザーは理解済みですか?', '["未理解(探索の境界線の外側)","理解済み(探索の境界線の内側)"]');
