ALTER TABLE ai_summary_log ADD COLUMN resolved INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_summary_log ADD COLUMN resolved_at TEXT;
ALTER TABLE ai_summary_log ADD COLUMN resolution_note TEXT;
ALTER TABLE ai_summary_log ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_summary_log ADD COLUMN parent_id TEXT;
ALTER TABLE ai_summary_log ADD COLUMN tags TEXT NOT NULL DEFAULT '';
