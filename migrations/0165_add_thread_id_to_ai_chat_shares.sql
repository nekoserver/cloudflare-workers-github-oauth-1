-- conversation_hash は回答単位の識別子なので、会話を複数ターンに束ねるキーは分離する。
-- 既存行は推測で束ねず NULL のままランキング対象外にする。
ALTER TABLE ai_chat_shares ADD COLUMN thread_id TEXT;

CREATE INDEX IF NOT EXISTS idx_ai_chat_shares_user_thread_created
ON ai_chat_shares(user_id, thread_id, created_at);
