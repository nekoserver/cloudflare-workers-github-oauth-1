CREATE TABLE IF NOT EXISTS public_key_security_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  detail TEXT,
  ip TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_public_key_security_events_user_id ON public_key_security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_public_key_security_events_created_at ON public_key_security_events(created_at);
