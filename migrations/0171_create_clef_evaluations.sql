CREATE TABLE IF NOT EXISTS clef_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL,
  share_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  model TEXT,
  jev_label_id INTEGER NOT NULL REFERENCES jev_labels(id),
  clef_model TEXT NOT NULL,
  value REAL NOT NULL,
  computed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clef_evaluations_unique ON clef_evaluations(target_type, user_id, share_id, model, jev_label_id, clef_model);
CREATE INDEX IF NOT EXISTS idx_clef_evaluations_share ON clef_evaluations(share_id);
