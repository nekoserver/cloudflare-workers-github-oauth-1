DROP VIEW IF EXISTS inquiry_agent_candidates;
DROP VIEW IF EXISTS inquiry_hunch_accuracy;
DROP VIEW IF EXISTS inquiry_agent_domain_stats;
DROP VIEW IF EXISTS inquiry_key_cost;
CREATE VIEW inquiry_key_cost AS
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
LEFT JOIN inquiry_entries e ON e.id = ek.entry_id AND e.status NOT IN ('planned', 'withdrawn')
GROUP BY k.id;
CREATE VIEW inquiry_agent_domain_stats AS
WITH asked AS (
  SELECT DISTINCT e.id, e.agent, k.domain, e.status, e.duration_seconds
  FROM inquiry_entries e
  JOIN inquiry_entry_keys ek ON ek.entry_id = e.id AND ek.role = 'target'
  JOIN inquiry_keys k ON k.id = ek.key_id
  WHERE k.domain IS NOT NULL AND e.status NOT IN ('planned', 'withdrawn')
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
CREATE VIEW inquiry_hunch_accuracy AS
WITH tries AS (
  SELECT DISTINCT e.id, e.routing_asset_kind AS asset_kind, k.domain
  FROM inquiry_entries e
  JOIN inquiry_entry_keys ek ON ek.entry_id = e.id AND ek.role = 'target'
  JOIN inquiry_keys k ON k.id = ek.key_id
  WHERE e.routing_basis = 'inferred' AND e.routing_asset_kind IS NOT NULL AND k.domain IS NOT NULL
    AND e.status NOT IN ('planned', 'withdrawn')
)
SELECT
  t.asset_kind,
  t.domain,
  COUNT(*) AS tries,
  SUM(EXISTS (
    SELECT 1 FROM inquiry_entry_keys ek2
    JOIN inquiry_keys k2 ON k2.id = ek2.key_id
    WHERE ek2.entry_id = t.id AND ek2.role = 'obtained' AND k2.useful = 1 AND k2.domain = t.domain
  )) AS hits
FROM tries t
GROUP BY t.asset_kind, t.domain;
CREATE VIEW inquiry_agent_candidates AS
SELECT d.agent, d.domain, d.basis, NULL AS asset_kind, d.note, NULL AS hunch_tries, NULL AS hunch_hits
FROM inquiry_agent_domains d
UNION ALL
SELECT a.agent, m.domain, 'inferred' AS basis, a.asset_kind, a.name AS note, h.tries AS hunch_tries, h.hits AS hunch_hits
FROM inquiry_agent_assets a
JOIN inquiry_asset_domains m ON m.asset_kind = a.asset_kind
LEFT JOIN inquiry_hunch_accuracy h ON h.asset_kind = a.asset_kind AND h.domain = m.domain
WHERE a.visible IS NOT 0;
