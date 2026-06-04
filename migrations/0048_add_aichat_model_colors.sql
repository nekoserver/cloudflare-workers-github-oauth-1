CREATE TABLE IF NOT EXISTS aichat_model_colors (
  model_id TEXT PRIMARY KEY,
  color TEXT NOT NULL,
  label TEXT NOT NULL
);

INSERT OR IGNORE INTO aichat_model_colors (model_id, color, label) VALUES
  ('@cf/meta/llama-3.3-70b-instruct-fp8-fast', '#4f46e5', 'llama-3.3-70b-instruct-fp8-fast'),
  ('@cf/meta/llama-3.1-8b-instruct-fp8', '#0ea5e9', 'llama-3.1-8b'),
  ('@cf/meta/llama-3.1-70b-instruct', '#3b82f6', 'llama-3.1-70b'),
  ('@cf/google/gemma-4-26b-a4b-it', '#16a34a', 'gemma-4-26b'),
  ('@cf/google/gemma-3-12b-it', '#22c55e', 'gemma-3-12b'),
  ('@cf/meta/llama-4-scout-17b-16e-instruct', '#a855f7', 'llama-4-scout-17b');
