ALTER TABLE ai_summary_log ADD COLUMN fallback_used INTEGER DEFAULT 0;
ALTER TABLE ai_summary_log ADD COLUMN primary_model TEXT;
