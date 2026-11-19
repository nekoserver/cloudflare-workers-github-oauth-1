CREATE TABLE IF NOT EXISTS conversation_stream_hosts (
  id TEXT PRIMARY KEY NOT NULL,
  label TEXT NOT NULL,
  origin TEXT NOT NULL UNIQUE,
  priority INTEGER NOT NULL DEFAULT 100,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conversation_stream_hosts_enabled_priority
  ON conversation_stream_hosts(enabled, priority, id);
