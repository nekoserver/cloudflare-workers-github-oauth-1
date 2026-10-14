CREATE TABLE IF NOT EXISTS commit_summary_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS commit_summary_topic_links (
  topic_id INTEGER NOT NULL REFERENCES commit_summary_topics(id) ON DELETE CASCADE,
  summary_log_id INTEGER NOT NULL REFERENCES ai_summary_log(id) ON DELETE CASCADE,
  recorded_at TEXT NOT NULL,
  PRIMARY KEY(topic_id, summary_log_id)
);
CREATE INDEX IF NOT EXISTS idx_commit_summary_topic_links_summary ON commit_summary_topic_links(summary_log_id);
CREATE TRIGGER IF NOT EXISTS commit_summary_topics_from_keyword
AFTER INSERT ON ai_summary_keywords
WHEN trim(NEW.keyword) != ''
BEGIN
  INSERT OR IGNORE INTO commit_summary_topics(name, created_at)
  VALUES(trim(NEW.keyword), NEW.created_at);
  INSERT OR IGNORE INTO commit_summary_topic_links(topic_id, summary_log_id, recorded_at)
  SELECT id, NEW.summary_log_id, NEW.created_at FROM commit_summary_topics WHERE name = trim(NEW.keyword);
END;
INSERT OR IGNORE INTO commit_summary_topics(name, created_at)
SELECT trim(keyword), MIN(created_at) FROM ai_summary_keywords WHERE trim(keyword) != '' GROUP BY trim(keyword);
INSERT OR IGNORE INTO commit_summary_topic_links(topic_id, summary_log_id, recorded_at)
SELECT t.id, k.summary_log_id, MIN(k.created_at)
FROM ai_summary_keywords k JOIN commit_summary_topics t ON t.name = trim(k.keyword)
GROUP BY t.id, k.summary_log_id;
