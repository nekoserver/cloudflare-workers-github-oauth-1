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

INSERT OR IGNORE INTO conversation_stream_hosts (id,label,origin,priority,enabled,created_at,updated_at) VALUES
  ('redmine','Redmine','https://r9.nekomaneki.work',10,1,'2026-10-26T00:00:00Z','2026-10-26T00:00:00Z'),
  ('mygw','mygw','https://mygw.nekomaneki.work',20,1,'2026-10-26T00:00:00Z','2026-10-26T00:00:00Z'),
  ('mynw','mynw','https://mynw.nekomaneki.work',30,1,'2026-10-26T00:00:00Z','2026-10-26T00:00:00Z'),
  ('testcfc','Test CFC','https://stream.test.cfc.nekomaneki.work',40,1,'2026-10-26T00:00:00Z','2026-10-26T00:00:00Z');
