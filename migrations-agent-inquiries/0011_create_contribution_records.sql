CREATE TABLE IF NOT EXISTS inquiry_records (id TEXT NOT NULL PRIMARY KEY, kind TEXT NOT NULL, ref TEXT NOT NULL, label TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')), deleted_at TEXT, UNIQUE (kind, ref));
CREATE TABLE IF NOT EXISTS inquiry_contributions (id INTEGER PRIMARY KEY AUTOINCREMENT, source_id TEXT NOT NULL REFERENCES inquiry_records(id), target_id TEXT NOT NULL REFERENCES inquiry_records(id), effect TEXT NOT NULL CHECK (effect IN ('changed_direction', 'avoided_inquiry', 'closed_key', 'prevented_defect', 'avoided_building', 'corrected_premise', 'changed_cost', 'kept_for_later')), phase TEXT NOT NULL CHECK (phase IN ('decision', 'trial', 'retrospective')), judged_by TEXT NOT NULL, judged_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')), confirmed_by TEXT, confirmed_at TEXT, evidence_entry_id TEXT REFERENCES inquiry_entries(id) ON DELETE SET NULL, note TEXT, CHECK (source_id <> target_id), CHECK ((confirmed_by IS NULL) = (confirmed_at IS NULL)), UNIQUE (source_id, target_id, effect, phase));
CREATE INDEX IF NOT EXISTS idx_inquiry_contributions_target ON inquiry_contributions(target_id);
CREATE TABLE IF NOT EXISTS inquiry_unused (id INTEGER PRIMARY KEY AUTOINCREMENT, source_id TEXT NOT NULL REFERENCES inquiry_records(id), target_id TEXT NOT NULL REFERENCES inquiry_records(id), consequence TEXT NOT NULL CHECK (consequence IN ('failure', 'rework', 'delay', 'none_observed')), judged_by TEXT NOT NULL, judged_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')), confirmed_by TEXT, confirmed_at TEXT, evidence_entry_id TEXT REFERENCES inquiry_entries(id) ON DELETE SET NULL, note TEXT, CHECK (source_id <> target_id), CHECK ((confirmed_by IS NULL) = (confirmed_at IS NULL)), UNIQUE (source_id, target_id));
INSERT OR IGNORE INTO inquiry_records (id, kind, ref, label) SELECT 'case:' || id, 'case', id, substr(goal, 1, 200) FROM inquiry_cases WHERE id IS NOT NULL;
INSERT OR IGNORE INTO inquiry_records (id, kind, ref, label) SELECT 'entry:' || id, 'entry', id, substr(clue, 1, 200) FROM inquiry_entries WHERE id IS NOT NULL;
INSERT OR IGNORE INTO inquiry_records (id, kind, ref, label) SELECT 'key:' || id, 'key', id, substr(text, 1, 200) FROM inquiry_keys WHERE id IS NOT NULL;
INSERT OR IGNORE INTO inquiry_records (id, kind, ref, label) SELECT 'proposal:' || id, 'proposal', id, substr(text, 1, 200) FROM inquiry_proposals WHERE id IS NOT NULL;
INSERT OR IGNORE INTO inquiry_records (id, kind, ref, label) SELECT 'knowledge:' || id, 'knowledge', id, substr(text, 1, 200) FROM inquiry_knowledge WHERE id IS NOT NULL;
CREATE TRIGGER IF NOT EXISTS inquiry_records_case_insert AFTER INSERT ON inquiry_cases
WHEN NEW.id IS NOT NULL
BEGIN
  INSERT INTO inquiry_records (id, kind, ref, label) VALUES ('case:' || NEW.id, 'case', NEW.id, substr(NEW.goal, 1, 200))
  ON CONFLICT(id) DO UPDATE SET deleted_at = NULL, label = excluded.label;
END;
CREATE TRIGGER IF NOT EXISTS inquiry_records_case_delete AFTER DELETE ON inquiry_cases
WHEN OLD.id IS NOT NULL
BEGIN
  UPDATE inquiry_records SET deleted_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = 'case:' || OLD.id AND deleted_at IS NULL;
END;
CREATE TRIGGER IF NOT EXISTS inquiry_records_entry_insert AFTER INSERT ON inquiry_entries
WHEN NEW.id IS NOT NULL
BEGIN
  INSERT INTO inquiry_records (id, kind, ref, label) VALUES ('entry:' || NEW.id, 'entry', NEW.id, substr(NEW.clue, 1, 200))
  ON CONFLICT(id) DO UPDATE SET deleted_at = NULL, label = excluded.label;
END;
CREATE TRIGGER IF NOT EXISTS inquiry_records_entry_delete AFTER DELETE ON inquiry_entries
WHEN OLD.id IS NOT NULL
BEGIN
  UPDATE inquiry_records SET deleted_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = 'entry:' || OLD.id AND deleted_at IS NULL;
END;
CREATE TRIGGER IF NOT EXISTS inquiry_records_key_insert AFTER INSERT ON inquiry_keys
WHEN NEW.id IS NOT NULL
BEGIN
  INSERT INTO inquiry_records (id, kind, ref, label) VALUES ('key:' || NEW.id, 'key', NEW.id, substr(NEW.text, 1, 200))
  ON CONFLICT(id) DO UPDATE SET deleted_at = NULL, label = excluded.label;
END;
CREATE TRIGGER IF NOT EXISTS inquiry_records_key_delete AFTER DELETE ON inquiry_keys
WHEN OLD.id IS NOT NULL
BEGIN
  UPDATE inquiry_records SET deleted_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = 'key:' || OLD.id AND deleted_at IS NULL;
END;
CREATE TRIGGER IF NOT EXISTS inquiry_records_proposal_insert AFTER INSERT ON inquiry_proposals
WHEN NEW.id IS NOT NULL
BEGIN
  INSERT INTO inquiry_records (id, kind, ref, label) VALUES ('proposal:' || NEW.id, 'proposal', NEW.id, substr(NEW.text, 1, 200))
  ON CONFLICT(id) DO UPDATE SET deleted_at = NULL, label = excluded.label;
END;
CREATE TRIGGER IF NOT EXISTS inquiry_records_proposal_delete AFTER DELETE ON inquiry_proposals
WHEN OLD.id IS NOT NULL
BEGIN
  UPDATE inquiry_records SET deleted_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = 'proposal:' || OLD.id AND deleted_at IS NULL;
END;
CREATE TRIGGER IF NOT EXISTS inquiry_records_knowledge_insert AFTER INSERT ON inquiry_knowledge
WHEN NEW.id IS NOT NULL
BEGIN
  INSERT INTO inquiry_records (id, kind, ref, label) VALUES ('knowledge:' || NEW.id, 'knowledge', NEW.id, substr(NEW.text, 1, 200))
  ON CONFLICT(id) DO UPDATE SET deleted_at = NULL, label = excluded.label;
END;
CREATE TRIGGER IF NOT EXISTS inquiry_records_knowledge_delete AFTER DELETE ON inquiry_knowledge
WHEN OLD.id IS NOT NULL
BEGIN
  UPDATE inquiry_records SET deleted_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = 'knowledge:' || OLD.id AND deleted_at IS NULL;
END;
