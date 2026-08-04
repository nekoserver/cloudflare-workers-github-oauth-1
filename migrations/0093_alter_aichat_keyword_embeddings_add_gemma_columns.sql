ALTER TABLE aichat_keyword_embeddings ADD COLUMN gemma_vector BLOB;
ALTER TABLE aichat_keyword_embeddings ADD COLUMN gemma_dim INTEGER;
ALTER TABLE aichat_keyword_embeddings ADD COLUMN gemma_model TEXT;
ALTER TABLE aichat_keyword_embeddings ADD COLUMN gemma_updated_at TEXT;
