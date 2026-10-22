ALTER TABLE countdown_events ADD COLUMN deleted_at TEXT;
CREATE INDEX IF NOT EXISTS idx_countdown_events_active_user_target
ON countdown_events(user_id, target_at) WHERE deleted_at IS NULL;
