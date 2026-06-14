CREATE TABLE IF NOT EXISTS api_search_keyword_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword_id INTEGER NOT NULL REFERENCES api_search_keywords(id),
  section_name TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_api_search_keyword_sections_keyword_id ON api_search_keyword_sections(keyword_id);
