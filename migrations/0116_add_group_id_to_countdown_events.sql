ALTER TABLE countdown_events ADD COLUMN group_id TEXT;
CREATE INDEX IF NOT EXISTS idx_countdown_events_group ON countdown_events(group_id);
