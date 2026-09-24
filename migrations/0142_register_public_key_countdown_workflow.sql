-- /public-keysで鍵ペアを生成してから、期限付き公開鍵の期限を
-- /countdownへ登録・確認するまでの処理を/workflowに追加する。
INSERT INTO workflow_registry (workflow_no, title, page_path, summary)
VALUES (
  '0013',
  '公開鍵登録からカウントダウン登録',
  '/public-keys',
  'ブラウザでの鍵ペア生成、公開鍵と期限の保存、期限カウントダウンの自動登録、登録結果の確認までを示します。'
);

INSERT INTO workflow_steps (workflow_no, step_order, stage_title, api_method, api_path, note, indent_level) VALUES
  ('0013', 1, '公開鍵登録ページを開く', NULL, NULL, '登録済み公開鍵の一覧を読み込む準備をします。', 0),
  ('0013', 2, '登録済み公開鍵を取得', 'GET', '/api/public-keys', '現在のユーザーが登録した公開鍵を一覧表示します。', 1),
  ('0013', 3, 'ブラウザ内で鍵ペアを生成', NULL, NULL, 'Web Crypto APIでECDSA P-256鍵ペアを生成し、秘密鍵はサーバーへ送りません。', 0),
  ('0013', 4, '公開鍵と有効期限を登録', 'POST', '/api/public-keys', '公開鍵をuser_public_keysへ保存します。', 1),
  ('0013', 5, '期限をカウントダウンへ自動登録', NULL, NULL, '同じPOST処理内で、期限付きの場合だけcountdown_eventsへ「PK期限」を追加します。無期限の場合は正常にスキップします。', 2),
  ('0013', 6, '秘密鍵を端末へ保存', NULL, NULL, '秘密鍵をこのブラウザのIndexedDBにのみ保存します。', 1),
  ('0013', 7, '登録結果を表示', NULL, NULL, 'カウントダウンの登録成否を表示し、登録済みの場合だけ/countdownへの確認リンクを表示します。', 0),
  ('0013', 8, 'カウントダウンを確認', NULL, NULL, '確認リンクから/countdownを開き、登録された「PK期限」を確認します。', 0);
