CREATE TABLE IF NOT EXISTS inquiry_cases (
  id TEXT PRIMARY KEY,
  goal TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'abandoned')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  resolved_at TEXT
);
CREATE TABLE IF NOT EXISTS inquiry_entries (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES inquiry_cases(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  clue TEXT NOT NULL,
  asked_by TEXT NOT NULL,
  agent TEXT NOT NULL,
  ask_id TEXT,
  question TEXT NOT NULL,
  answer TEXT,
  info TEXT,
  progress TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'sent', 'answered', 'failed', 'withdrawn')),
  error TEXT,
  duration_seconds INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE (case_id, seq)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inquiry_entries_ask_id ON inquiry_entries(ask_id) WHERE ask_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS inquiry_keys (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES inquiry_cases(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('known', 'unknown', 'pitfall')),
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  blocking INTEGER NOT NULL DEFAULT 0 CHECK (blocking IN (0, 1)),
  mutating INTEGER NOT NULL DEFAULT 0 CHECK (mutating IN (0, 1)),
  depends_on_key_id TEXT REFERENCES inquiry_keys(id) ON DELETE SET NULL,
  goal_similarity REAL,
  opened_by_entry_id TEXT REFERENCES inquiry_entries(id) ON DELETE SET NULL,
  closed_by_entry_id TEXT REFERENCES inquiry_entries(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE (case_id, kind, text)
);
CREATE INDEX IF NOT EXISTS idx_inquiry_keys_case_status ON inquiry_keys(case_id, status);
