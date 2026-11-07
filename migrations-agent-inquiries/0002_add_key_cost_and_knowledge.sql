CREATE TABLE IF NOT EXISTS inquiry_knowledge (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  text TEXT NOT NULL,
  source_key_id TEXT REFERENCES inquiry_keys(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE (scope, text)
);
CREATE TABLE IF NOT EXISTS inquiry_entry_keys (
  entry_id TEXT NOT NULL REFERENCES inquiry_entries(id) ON DELETE CASCADE,
  key_id TEXT NOT NULL REFERENCES inquiry_keys(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('target', 'obtained')),
  PRIMARY KEY (entry_id, key_id, role)
);
CREATE INDEX IF NOT EXISTS idx_inquiry_entry_keys_key ON inquiry_entry_keys(key_id);
ALTER TABLE inquiry_keys ADD COLUMN useful INTEGER CHECK (useful IN (0, 1));
ALTER TABLE inquiry_keys ADD COLUMN closed_by_knowledge_id TEXT REFERENCES inquiry_knowledge(id) ON DELETE SET NULL;
ALTER TABLE inquiry_entries ADD COLUMN avoidable_by_knowledge_id TEXT REFERENCES inquiry_knowledge(id) ON DELETE SET NULL;
CREATE VIEW IF NOT EXISTS inquiry_key_cost AS
SELECT
  k.case_id,
  k.id AS key_id,
  k.text,
  k.useful,
  k.closed_by_knowledge_id IS NOT NULL AS known_without_asking,
  COUNT(e.id) AS attempts,
  COALESCE(SUM(e.status = 'failed'), 0) AS failed_attempts,
  COALESCE(SUM(e.avoidable_by_knowledge_id IS NOT NULL), 0) AS avoidable_attempts,
  COALESCE(SUM(e.duration_seconds), 0) AS seconds
FROM inquiry_keys k
LEFT JOIN inquiry_entry_keys ek ON ek.key_id = k.id AND ek.role = 'target'
LEFT JOIN inquiry_entries e ON e.id = ek.entry_id
GROUP BY k.id;
