CREATE TABLE IF NOT EXISTS inquiry_agent_assets (
  agent TEXT NOT NULL,
  asset_kind TEXT NOT NULL,
  name TEXT NOT NULL,
  visible INTEGER CHECK (visible IN (0, 1)),
  note TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (agent, asset_kind, name)
);
CREATE TABLE IF NOT EXISTS inquiry_asset_domains (
  asset_kind TEXT NOT NULL,
  domain TEXT NOT NULL,
  note TEXT,
  PRIMARY KEY (asset_kind, domain)
);
ALTER TABLE inquiry_entries ADD COLUMN routing_basis TEXT CHECK (routing_basis IN ('measured', 'access', 'declared', 'inferred', 'none'));
ALTER TABLE inquiry_entries ADD COLUMN routing_asset_kind TEXT;
CREATE VIEW IF NOT EXISTS inquiry_hunch_accuracy AS
WITH tries AS (
  SELECT DISTINCT e.id, e.routing_asset_kind AS asset_kind, k.domain
  FROM inquiry_entries e
  JOIN inquiry_entry_keys ek ON ek.entry_id = e.id AND ek.role = 'target'
  JOIN inquiry_keys k ON k.id = ek.key_id
  WHERE e.routing_basis = 'inferred' AND e.routing_asset_kind IS NOT NULL AND k.domain IS NOT NULL
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
CREATE VIEW IF NOT EXISTS inquiry_agent_candidates AS
SELECT d.agent, d.domain, d.basis, NULL AS asset_kind, d.note, NULL AS hunch_tries, NULL AS hunch_hits
FROM inquiry_agent_domains d
UNION ALL
SELECT a.agent, m.domain, 'inferred' AS basis, a.asset_kind, a.name AS note, h.tries AS hunch_tries, h.hits AS hunch_hits
FROM inquiry_agent_assets a
JOIN inquiry_asset_domains m ON m.asset_kind = a.asset_kind
LEFT JOIN inquiry_hunch_accuracy h ON h.asset_kind = a.asset_kind AND h.domain = m.domain
WHERE a.visible IS NOT 0;
