ALTER TABLE countdown_events ADD COLUMN deleted_by TEXT;
ALTER TABLE countdown_events ADD COLUMN deletion_reason TEXT;
ALTER TABLE countdown_events ADD COLUMN created_by TEXT;
ALTER TABLE countdown_events ADD COLUMN creation_reason TEXT;
