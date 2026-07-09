ALTER TABLE ai_chat_shares ADD COLUMN deleted_at TEXT;
CREATE INDEX IF NOT EXISTS idx_ai_chat_shares_deleted_at ON ai_chat_shares(deleted_at);
