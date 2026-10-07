-- ユーザーごとの初出台帳。回答を削除しても初出統計は保持する。
CREATE TABLE IF NOT EXISTS aichat_keyword_registry (
  user_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  first_added_at TEXT NOT NULL,
  first_share_id TEXT REFERENCES ai_chat_shares(id) ON DELETE SET NULL,
  first_source TEXT NOT NULL CHECK (first_source IN ('answer_extraction', 'search', 'embedding', 'classification', 'legacy')),
  PRIMARY KEY (user_id, keyword)
);
CREATE INDEX IF NOT EXISTS idx_aichat_keyword_registry_first_added
  ON aichat_keyword_registry(user_id, first_source, first_added_at);

-- 過去の出所は特定できないためlegacyとする。登録済みの語を再抽出しても新規に数えない。
INSERT OR IGNORE INTO aichat_keyword_registry (user_id, keyword, first_added_at, first_share_id, first_source)
SELECT user_id, keyword, MIN(added_at), NULL, 'legacy'
FROM (
  SELECT user_id, keyword, strftime('%Y-%m-%dT%H:%M:%fZ', computed_at) AS added_at FROM aichat_answer_keyword_vectors
  UNION ALL
  SELECT user_id, keyword, strftime('%Y-%m-%dT%H:%M:%fZ', first_searched_at) FROM aichat_search_log
  UNION ALL
  SELECT user_id, keyword, strftime('%Y-%m-%dT%H:%M:%fZ', created_at) FROM aichat_keyword_embeddings
  UNION ALL
  SELECT user_id, keyword, strftime('%Y-%m-%dT%H:%M:%fZ', created_at) FROM aichat_keyword_category_map
)
GROUP BY user_id, keyword;

-- 保存と同じトランザクションで初出を記録。モデル・回答が違っても同じ語は1件だけ。
CREATE TRIGGER IF NOT EXISTS aichat_keyword_registry_from_answer
AFTER INSERT ON aichat_answer_keyword_vectors
BEGIN
  INSERT INTO aichat_keyword_registry (user_id, keyword, first_added_at, first_share_id, first_source)
  VALUES (NEW.user_id, NEW.keyword, strftime('%Y-%m-%dT%H:%M:%fZ', NEW.computed_at),
    (SELECT id FROM ai_chat_shares WHERE id = NEW.share_id AND user_id = NEW.user_id), 'answer_extraction')
  ON CONFLICT(user_id, keyword) DO NOTHING;
END;

CREATE TRIGGER IF NOT EXISTS aichat_keyword_registry_from_search
AFTER INSERT ON aichat_search_log
BEGIN
  INSERT INTO aichat_keyword_registry (user_id, keyword, first_added_at, first_share_id, first_source)
  VALUES (NEW.user_id, NEW.keyword, strftime('%Y-%m-%dT%H:%M:%fZ', NEW.first_searched_at), NULL, 'search')
  ON CONFLICT(user_id, keyword) DO NOTHING;
END;

CREATE TRIGGER IF NOT EXISTS aichat_keyword_registry_from_embedding
AFTER INSERT ON aichat_keyword_embeddings
BEGIN
  INSERT INTO aichat_keyword_registry (user_id, keyword, first_added_at, first_share_id, first_source)
  VALUES (NEW.user_id, NEW.keyword, strftime('%Y-%m-%dT%H:%M:%fZ', NEW.created_at), NULL, 'embedding')
  ON CONFLICT(user_id, keyword) DO NOTHING;
END;

CREATE TRIGGER IF NOT EXISTS aichat_keyword_registry_from_classification
AFTER INSERT ON aichat_keyword_category_map
BEGIN
  INSERT INTO aichat_keyword_registry (user_id, keyword, first_added_at, first_share_id, first_source)
  VALUES (NEW.user_id, NEW.keyword, strftime('%Y-%m-%dT%H:%M:%fZ', NEW.created_at), NULL, 'classification')
  ON CONFLICT(user_id, keyword) DO NOTHING;
END;
