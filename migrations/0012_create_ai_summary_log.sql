-- AI要約ログテーブル
-- PRのWebhook受信時にWorkers AIで要約を生成した記録を保持する
CREATE TABLE IF NOT EXISTS ai_summary_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE,          -- リクエスト固有ID (UUID)
  daily_seq INTEGER NOT NULL,               -- その日の通算番号
  event_date TEXT NOT NULL,                 -- 日付 (YYYY-MM-DD)
  event_type TEXT NOT NULL DEFAULT 'pr_summary', -- イベント種別
  repo_full_name TEXT,                      -- リポジトリ名
  pr_number INTEGER,                        -- PR番号
  pr_action TEXT,                           -- opened / synchronize
  pr_url TEXT,                              -- PR URL
  model TEXT,                               -- 使用モデル
  summary TEXT,                             -- AI生成要約
  diff_length INTEGER DEFAULT 0,            -- 取得したdiffの長さ
  slack_notified INTEGER DEFAULT 0,         -- Slack通知成功: 1, 失敗: 0
  created_at TEXT NOT NULL                  -- ISO 8601 タイムスタンプ
);

-- 日付ごとの通算番号を高速に取得するためのインデックス
CREATE INDEX IF NOT EXISTS idx_ai_summary_log_date ON ai_summary_log (event_date);
