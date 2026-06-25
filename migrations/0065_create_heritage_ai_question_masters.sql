CREATE TABLE IF NOT EXISTS heritage_ai_question_masters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO heritage_ai_question_masters (topic) VALUES
  ('交通手段'),
  ('見どころ'),
  ('最寄り空港'),
  ('鉄道でのアクセス'),
  ('宿泊施設'),
  ('スポーツ施設');
