ALTER TABLE ai_chat_shares ADD COLUMN conversation_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_ai_chat_shares_conv_hash ON ai_chat_shares(conversation_hash);
