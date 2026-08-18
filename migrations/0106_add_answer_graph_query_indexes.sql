CREATE INDEX IF NOT EXISTS idx_aichat_search_log_user_share ON aichat_search_log(user_id, share_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_shares_user_deleted ON ai_chat_shares(user_id, deleted_at);
