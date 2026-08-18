CREATE TABLE IF NOT EXISTS cheese_fr (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seq_no INTEGER NOT NULL,
  name_fr TEXT NOT NULL,
  reading TEXT NOT NULL,
  ingredient TEXT,
  producer TEXT,
  method TEXT,
  hardness TEXT,
  notes TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cheese_fr_seq_no ON cheese_fr(seq_no);
CREATE INDEX IF NOT EXISTS idx_cheese_fr_name_fr ON cheese_fr(name_fr);
