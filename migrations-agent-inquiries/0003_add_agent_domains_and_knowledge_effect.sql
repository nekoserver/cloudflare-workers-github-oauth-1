CREATE TABLE IF NOT EXISTS inquiry_agent_domains (
  agent TEXT NOT NULL,
  domain TEXT NOT NULL,
  basis TEXT NOT NULL CHECK (basis IN ('access', 'declared', 'measured')),
  note TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (agent, domain)
);
CREATE TABLE IF NOT EXISTS inquiry_entry_knowledge (
  entry_id TEXT NOT NULL REFERENCES inquiry_entries(id) ON DELETE CASCADE,
  knowledge_id TEXT NOT NULL REFERENCES inquiry_knowledge(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, knowledge_id)
);
CREATE INDEX IF NOT EXISTS idx_inquiry_entry_knowledge_knowledge ON inquiry_entry_knowledge(knowledge_id);
ALTER TABLE inquiry_keys ADD COLUMN domain TEXT;
CREATE VIEW IF NOT EXISTS inquiry_agent_domain_stats AS
WITH asked AS (
  SELECT DISTINCT e.id, e.agent, k.domain, e.status, e.duration_seconds
  FROM inquiry_entries e
  JOIN inquiry_entry_keys ek ON ek.entry_id = e.id AND ek.role = 'target'
  JOIN inquiry_keys k ON k.id = ek.key_id
  WHERE k.domain IS NOT NULL
)
SELECT
  a.agent,
  a.domain,
  COUNT(*) AS attempts,
  SUM(a.status = 'failed') AS failed_attempts,
  COALESCE(SUM(a.duration_seconds), 0) AS seconds,
  (SELECT COUNT(DISTINCT k2.id)
   FROM inquiry_entries e2
   JOIN inquiry_entry_keys ek2 ON ek2.entry_id = e2.id AND ek2.role = 'obtained'
   JOIN inquiry_keys k2 ON k2.id = ek2.key_id
   WHERE e2.agent = a.agent AND k2.domain = a.domain AND k2.useful = 1) AS useful_keys
FROM asked a
GROUP BY a.agent, a.domain;
CREATE VIEW IF NOT EXISTS inquiry_knowledge_effect AS
SELECT
  n.id AS knowledge_id,
  n.scope,
  n.text,
  (SELECT COUNT(*) FROM inquiry_entry_knowledge ek WHERE ek.knowledge_id = n.id) AS used_in_questions,
  (SELECT COUNT(*) FROM inquiry_keys k WHERE k.closed_by_knowledge_id = n.id) AS keys_closed_without_asking,
  (SELECT COUNT(*) FROM inquiry_entries e WHERE e.avoidable_by_knowledge_id = n.id) AS avoidable_questions,
  (SELECT COALESCE(SUM(e.duration_seconds), 0) FROM inquiry_entries e WHERE e.avoidable_by_knowledge_id = n.id) AS avoidable_seconds
FROM inquiry_knowledge n;
