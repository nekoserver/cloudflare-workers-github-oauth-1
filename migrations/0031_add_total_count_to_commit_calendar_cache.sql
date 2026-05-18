ALTER TABLE commit_calendar_cache ADD COLUMN total_count INTEGER NOT NULL DEFAULT 0;
UPDATE commit_calendar_cache SET total_count = (SELECT COALESCE(SUM(CAST(je.value AS INTEGER)), 0) FROM json_each(commit_calendar_cache.counts) je) WHERE total_count = 0;
