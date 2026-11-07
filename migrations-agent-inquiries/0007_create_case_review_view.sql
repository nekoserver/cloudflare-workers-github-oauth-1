CREATE VIEW IF NOT EXISTS inquiry_case_review AS
SELECT
  e.case_id,
  e.seq,
  e.clue,
  e.agent,
  e.question,
  e.status,
  e.duration_seconds,
  (SELECT GROUP_CONCAT(k.text, ' / ')
   FROM inquiry_entry_keys ek
   JOIN inquiry_keys k ON k.id = ek.key_id
   WHERE ek.entry_id = e.id AND ek.role = 'obtained' AND k.useful = 1) AS useful_keys,
  n.text AS avoidable_by,
  CASE
    WHEN n.id IS NULL THEN NULL
    WHEN n.source_key_id IS NULL THEN 'avoidable_now'
    ELSE 'avoidable_next_time'
  END AS avoidable_kind
FROM inquiry_entries e
LEFT JOIN inquiry_knowledge n ON n.id = e.avoidable_by_knowledge_id
WHERE e.status NOT IN ('planned', 'withdrawn');
