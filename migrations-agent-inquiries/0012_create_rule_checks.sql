CREATE TABLE IF NOT EXISTS inquiry_rule_checks (id INTEGER PRIMARY KEY AUTOINCREMENT, rule_id TEXT NOT NULL REFERENCES inquiry_records(id), target_ref TEXT NOT NULL, method TEXT NOT NULL, candidates INTEGER NOT NULL CHECK (candidates >= 0), checked_by TEXT NOT NULL, checked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')), entry_id TEXT REFERENCES inquiry_entries(id) ON DELETE SET NULL);
CREATE INDEX IF NOT EXISTS idx_inquiry_rule_checks_rule ON inquiry_rule_checks(rule_id, checked_at);
CREATE TABLE IF NOT EXISTS inquiry_rule_findings (id INTEGER PRIMARY KEY AUTOINCREMENT, rule_id TEXT NOT NULL REFERENCES inquiry_records(id), location TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'violation', 'not_violation', 'fixed', 'exception')), found_check_id INTEGER NOT NULL REFERENCES inquiry_rule_checks(id), fixed_by_id TEXT REFERENCES inquiry_records(id), fixed_at TEXT, judged_by TEXT, note TEXT, CHECK ((status = 'fixed') = (fixed_by_id IS NOT NULL AND fixed_at IS NOT NULL)), UNIQUE (rule_id, location));
CREATE VIEW IF NOT EXISTS inquiry_rule_summary AS
SELECT r.id AS rule_id, r.label AS label,
  (SELECT COUNT(*) FROM inquiry_rule_checks c WHERE c.rule_id = r.id) AS checks,
  (SELECT c.checked_at FROM inquiry_rule_checks c WHERE c.rule_id = r.id ORDER BY c.checked_at DESC, c.id DESC LIMIT 1) AS last_checked_at,
  (SELECT c.candidates FROM inquiry_rule_checks c WHERE c.rule_id = r.id ORDER BY c.checked_at DESC, c.id DESC LIMIT 1) AS last_candidates,
  (SELECT COUNT(*) FROM inquiry_rule_findings f WHERE f.rule_id = r.id AND f.status = 'candidate') AS candidate,
  (SELECT COUNT(*) FROM inquiry_rule_findings f WHERE f.rule_id = r.id AND f.status = 'violation') AS violation,
  (SELECT COUNT(*) FROM inquiry_rule_findings f WHERE f.rule_id = r.id AND f.status = 'not_violation') AS not_violation,
  (SELECT COUNT(*) FROM inquiry_rule_findings f WHERE f.rule_id = r.id AND f.status = 'fixed') AS fixed,
  (SELECT COUNT(*) FROM inquiry_rule_findings f WHERE f.rule_id = r.id AND f.status = 'exception') AS exception
FROM inquiry_records r
WHERE EXISTS (SELECT 1 FROM inquiry_rule_checks c WHERE c.rule_id = r.id);
