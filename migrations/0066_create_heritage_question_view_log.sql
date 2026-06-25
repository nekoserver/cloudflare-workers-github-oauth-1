CREATE TABLE IF NOT EXISTS heritage_question_view_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  country_name TEXT,
  heritage_name TEXT NOT NULL,
  question_master_id INTEGER NOT NULL REFERENCES heritage_ai_question_masters(id),
  searched_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_hqvl_user_heritage_qm ON heritage_question_view_log(user_id, heritage_name, question_master_id);
