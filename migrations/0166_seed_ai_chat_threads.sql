-- thread_id 導入前の履歴は安全に会話へ復元できないため変更しない。
-- 代わりに、まだスレッドを1件も持たない各ユーザーへ追跡画面を確認できる
-- 独立したサンプルスレッドを1件作る。再実行時は NOT EXISTS により増殖しない。
INSERT INTO ai_chat_shares (
  id, user_id, user_hash, question, answer, model, created_at, source, thread_id
)
SELECT
  'thread-seed-' || sessions.id || '-' || turns.turn_number,
  sessions.user_id,
  'thread-seed',
  turns.question,
  turns.answer,
  'seed-data',
  datetime('now', turns.created_modifier),
  'thread-seed',
  printf('%032x', sessions.id)
FROM user_sessions AS sessions
CROSS JOIN (
  SELECT 1 AS turn_number,
         'スレッド追跡を始めるには？' AS question,
         'AIチャットで質問すると、同じページで続けた会話が1つのスレッドとして記録されます。' AS answer,
         '-2 hours' AS created_modifier
  UNION ALL
  SELECT 2,
         '記録されたスレッドはどこで確認できますか？',
         'スレッド追跡ツリーで、質問と回答を時系列に確認できます。',
         '-1 hour'
  UNION ALL
  SELECT 3,
         'このデータは何ですか？',
         '追跡画面が空にならないように用意したサンプルです。実際の会話を始めた後も削除せず残ります。',
         '-1 minute'
) AS turns
WHERE NOT EXISTS (
  SELECT 1
  FROM ai_chat_shares AS existing
  WHERE existing.user_id = sessions.user_id
    AND existing.thread_id IS NOT NULL
);
