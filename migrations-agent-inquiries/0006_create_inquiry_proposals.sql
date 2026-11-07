CREATE TABLE IF NOT EXISTS inquiry_proposals (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES inquiry_cases(id) ON DELETE CASCADE,
  entry_id TEXT REFERENCES inquiry_entries(id) ON DELETE SET NULL,
  proposed_by TEXT NOT NULL,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'adopted', 'rejected', 'done')),
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_inquiry_proposals_case ON inquiry_proposals(case_id, status);
