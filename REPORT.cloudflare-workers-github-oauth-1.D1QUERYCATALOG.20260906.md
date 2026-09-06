# D1クエリカタログ(src/index.ts 由来、sqlcアノテーション形式)

**対象**: `src/index.ts` 中の `db.prepare(\`SQL\`)` テンプレートリテラル呼び出し(480件中253件)。sqlcの`-- name: X :cmd`形式のアノテーションを機械的に合成し、対応するmigrationファイルとクエリ文字列自体の変更コミット履歴を突き合わせた一覧。

## 生成方法・制約

- 抽出対象: `.prepare(\`...\`)` のテンプレートリテラル呼び出し253件(480件中、変数に代入されたSQL(`db.prepare(ddl)`等)、複数行のマイグレーションループ内で動的に組み立てられるSQLなど残り227件は対象外)。
- コマンド種別: `.prepare(...)` の直後(400文字以内)に `.first(`/`.all(`/`.run(` が実際に見つかった**80件**は `:one`/`:many`/`:exec`(sqlcの実際のマッピングに準拠)を確定できたもの。見つからなかった**173件**は先頭のSQL動詞から`:many?`/`:exec?`と推測表記した(sqlcが実際に受理する形式ではなく、本レポート内の暫定表記)。
- **パーサー検証**: コマンドを確定できた80件を実際に`-- name: X :cmd`形式へ組み立て、`wasm/sqlc-wasm`のパーサー(`annotations.go`の`parseQueryAnnotations`、`go test`で実行)に読み込ませ、全件エラー0件でパースできることを確認する運用とする(スクリプト実行のたびに再検証が必要)。`:many?`/`:exec?`表記の173件は sqlc が受理しない形式のため、そのままではパーサーに通せない。
- クエリ名: 先頭のSQL動詞+主対象テーブル名から機械的に合成(sqlc本来の命名ではなく本レポート用の便宜的な名前)。同名になった場合は連番を付与。
- migration対応: `migrations/*.sql`内の`CREATE TABLE`/`ALTER TABLE`をテーブル名でマッチさせた一覧(1テーブルに複数migrationが対応する場合あり)。「初回作成コミット」は`git log --follow --diff-filter=A`でそのmigrationファイルが追加された最初のコミット。
- クエリ変更履歴: SQL本文の先頭60文字(空白正規化後)を`git log -S`で検索した結果(最大5件、新しい順)。SQL文字列がリファクタで完全に書き換わっている場合は追跡が切れる。
- **重要**: shallow cloneのままではこのgitログベースの突き合わせが機能しない(`src/index.ts`の履歴が実際より大幅に短く見える)。実行前に`git rev-parse --is-shallow-repository`を確認し、`true`なら`git fetch --unshallow`すること。詳細は`NOTICE.cloudflare-workers-github-oauth-1.20260906.md`参照。
- 本レポートはMarkdownでの内容確認用。D1テーブル化(`sql_query_catalog`等)は内容確定後に別途行う。

## サマリ

| 項目 | 値 |
|---|---|
| 抽出クエリ数 | 253 |
| うちコマンド種別を確定できた(sqlcパーサーで検証済み) | 80 |
| うちコマンド種別を推測表記(`:many?`/`:exec?`、未検証) | 173 |
| 対象テーブル数 | 66 |
| migration対応なし(要確認) | 10テーブル |

## テーブル: `(不明)`

**対応migration**: 見つかりませんでした(動的テーブル名、またはCREATE TABLE文がmigrations/配下に存在しない可能性)。

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 1950 | CreateUnknown | :exec | CREATE INDEX IF NOT EXISTS idx_keyword_category_groups_user_id ON keyword_category_groups(user_id) | [`b905bf0`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b905bf0d95a9b7849c9de4c950dc9dcbfe0695f9), [`20871b4`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/20871b40b41fcc03cd9c243a54aae712fbbda40f) |
| 1951 | CreateUnknown2 | :exec | CREATE UNIQUE INDEX IF NOT EXISTS idx_keyword_category_groups_user_name ON keyword_category_groups(user_id, group_name) | [`b905bf0`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b905bf0d95a9b7849c9de4c950dc9dcbfe0695f9), [`568db4e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/568db4ef95a10fad3821348caed3310871e98093) |
| 3316 | OtherUnknown | :exec? | PRAGMA table_info(${tableName}) | [`889e583`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/889e583c3cd3b67d3d4ef5fb1106d8eb0dfc994e), [`7979c3e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7979c3e5e796c5196cbf6e883150261e305d77e6), [`dbc8ba5`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/dbc8ba507dafe291ec8260fc68a19e3928373602) |
| 13019 | OtherUnknown2 | :exec? | PRAGMA table_info(${req.table}) | [`eab9e5d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/eab9e5d7290bfa3f78ddc91877960f42e022f717) |
| 13071 | SelectUnknown | :many? | SELECT COUNT(*) AS cnt FROM ${tbl.name} | [`c47b70c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c47b70c10163440ceda5eb137e5d25b78107a630) |
| 13093 | SelectUnknown2 | :many? | SELECT COUNT(*) AS cnt FROM ${row.name} | [`dcdb92e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/dcdb92e1ac94482e516b1407ac19ef0606a79e6d) |
| 13556 | OtherUnknown3 | :exec? | PRAGMA table_info(${tableName}) | [`889e583`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/889e583c3cd3b67d3d4ef5fb1106d8eb0dfc994e), [`7979c3e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7979c3e5e796c5196cbf6e883150261e305d77e6), [`dbc8ba5`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/dbc8ba507dafe291ec8260fc68a19e3928373602) |
| 13595 | OtherUnknown4 | :exec? | PRAGMA table_info(${tableName}) | [`889e583`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/889e583c3cd3b67d3d4ef5fb1106d8eb0dfc994e), [`7979c3e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7979c3e5e796c5196cbf6e883150261e305d77e6), [`dbc8ba5`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/dbc8ba507dafe291ec8260fc68a19e3928373602) |
| 13683 | OtherUnknown5 | :exec? | PRAGMA table_info(${tName}) | [`53b01b7`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/53b01b7bb5e37db8fe8f4d1f9d7ada0d6adeb6a6), [`d026af6`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d026af6d40b46005ca845e9a53da5e7313c8adef) |
| 13692 | OtherUnknown6 | :exec? | PRAGMA index_list(${tName}) | [`d026af6`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d026af6d40b46005ca845e9a53da5e7313c8adef) |
| 13696 | OtherUnknown7 | :exec? | PRAGMA index_info(${idx.name}) | [`d026af6`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d026af6d40b46005ca845e9a53da5e7313c8adef) |
| 13711 | OtherUnknown8 | :exec? | PRAGMA foreign_key_list(${tName}) | [`53b01b7`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/53b01b7bb5e37db8fe8f4d1f9d7ada0d6adeb6a6), [`d026af6`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d026af6d40b46005ca845e9a53da5e7313c8adef) |
| 13784 | OtherUnknown9 | :exec? | PRAGMA table_info(${tName}) | [`53b01b7`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/53b01b7bb5e37db8fe8f4d1f9d7ada0d6adeb6a6), [`d026af6`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d026af6d40b46005ca845e9a53da5e7313c8adef) |
| 13793 | OtherUnknown10 | :exec? | PRAGMA foreign_key_list(${tName}) | [`53b01b7`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/53b01b7bb5e37db8fe8f4d1f9d7ada0d6adeb6a6), [`d026af6`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d026af6d40b46005ca845e9a53da5e7313c8adef) |
| 14214 | OtherUnknown11 | :exec? | PRAGMA table_info(${t}) | [`d641b02`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d641b024cf81a4d236dbea52ce9b5cee269b6d95) |

## テーブル: `ai_chat_shares`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0047_add_conversation_hash.sql` | ALTER | [`aa959f5`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/aa959f51ddaedcf5b5190b0cfb75153ee00f1c07) |
| `0074_add_deleted_at_to_ai_chat_shares.sql` | ALTER | [`45313e1`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/45313e11e08bd9cb2073bb046f215eb84b03f702) |
| `0098_add_image_data_url_to_ai_chat_shares.sql` | ALTER | [`db0b955`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/db0b955f2e581afa79490ffbd15e9d020182b0de) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 4963 | SelectAiChatShares | :many? | SELECT strftime('%Y-%m-%d %H:00', created_at, '+9 hours') AS hour, model, SUM(COALESCE(input_tokens, 0)) AS input_tokens, SUM(COALESCE(output_tokens, 0)) AS output_tokens, COUNT(*) AS request_count FR… | (検出不可) |
| 5285 | SelectAiChatShares2 | :many? | SELECT s.id, s.user_hash, s.question, s.answer, s.model, s.created_at, s.access_count, s.question_hash, s.image_id, COALESCE(img.image_data_url, s.image_data_url) AS image_data_url FROM ai_chat_shares… | [`7535ad3`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7535ad3ce2d84614b2582808a74bc0ed4ee43424), [`21c8eaf`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/21c8eafb57d2812207b473a26b6914c6ed843422), [`6b97a0c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6b97a0cc3be9302d4cd045fb751e0ca8c37882a4) |
| 5328 | SelectAiChatShares3 | :many? | SELECT s.id, s.user_hash, s.question, s.answer, s.model, s.created_at, s.image_id, COALESCE(img.image_data_url, s.image_data_url) AS image_data_url FROM ai_chat_shares s LEFT JOIN aichat_images img ON… | [`7535ad3`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7535ad3ce2d84614b2582808a74bc0ed4ee43424), [`21c8eaf`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/21c8eafb57d2812207b473a26b6914c6ed843422), [`6b97a0c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6b97a0cc3be9302d4cd045fb751e0ca8c37882a4) |
| 5541 | SelectAiChatShares4 | :many? | SELECT s.id, s.user_hash, s.question, s.answer, s.model, s.created_at, s.access_count, s.question_hash, s.input_tokens, s.output_tokens, s.total_tokens, COALESCE(img.image_data_url, s.image_data_url) … | [`7535ad3`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7535ad3ce2d84614b2582808a74bc0ed4ee43424), [`21c8eaf`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/21c8eafb57d2812207b473a26b6914c6ed843422), [`6b97a0c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6b97a0cc3be9302d4cd045fb751e0ca8c37882a4) |
| 5664 | SelectAiChatShares5 | :many? | SELECT image_id, id AS shareId, model FROM ai_chat_shares WHERE user_id = ? AND deleted_at IS NULL AND image_id IN (${placeholders}) | (検出不可) |
| 5831 | SelectAiChatShares6 | :many? | SELECT id, question, answer FROM ai_chat_shares WHERE user_id = ? AND deleted_at IS NULL AND (${clause}) ORDER BY created_at DESC | [`dffe0a2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/dffe0a275ae1d22affdeb4dfb1b2a941d1342a31) |
| 5870 | SelectAiChatShares7 | :many? | SELECT id, question, answer FROM ai_chat_shares WHERE id = ? AND user_id = ? AND deleted_at IS NULL | [`9cbd89e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/9cbd89e7ef9befc5ccda8b9bb5933f540348e9d3) |
| 6046 | SelectAiChatShares8 | :many? | SELECT id, question FROM ai_chat_shares WHERE user_id = ? AND deleted_at IS NULL AND INSTR(REPLACE(question, '･', '・'), ?) > 0 ORDER BY created_at DESC | [`8a305c9`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8a305c91fea0120affbb83f92a80c60a47580718), [`7d39948`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7d399487e86385261d7129c4b47660df7412c46b), [`ed34998`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ed349983f620e4e5aaf6e9121821153c3edae516) |
| 6208 | SelectAiChatShares9 | :many? | SELECT id, question FROM ai_chat_shares WHERE user_id = ? AND deleted_at IS NULL AND (${conditions}) ORDER BY created_at DESC | [`8a305c9`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8a305c91fea0120affbb83f92a80c60a47580718), [`7d39948`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7d399487e86385261d7129c4b47660df7412c46b), [`ed34998`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ed349983f620e4e5aaf6e9121821153c3edae516) |
| 6296 | SelectAiChatShares10 | :many? | SELECT DISTINCT acs.question, ash.keyword FROM ai_chat_shares acs INNER JOIN aichat_search_history ash ON ash.share_id = acs.id AND ash.user_id = ? AND ash.deleted_at IS NULL WHERE acs.user_id = ? AND… | (検出不可) |
| 6376 | SelectAiChatShares11 | :many? | SELECT acs.answer, ash.keyword FROM ai_chat_shares acs INNER JOIN aichat_search_history ash ON ash.share_id = acs.id AND ash.user_id = ? AND ash.deleted_at IS NULL WHERE acs.user_id = ? AND acs.delete… | (検出不可) |
| 6417 | SelectAiChatShares12 | :many? | SELECT id, question FROM ai_chat_shares WHERE user_id = ? AND deleted_at IS NULL AND model = ? AND INSTR(question, ?) > 0 AND (${conditions}) ORDER BY created_at DESC | [`8a305c9`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8a305c91fea0120affbb83f92a80c60a47580718), [`7d39948`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7d399487e86385261d7129c4b47660df7412c46b), [`ed34998`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ed349983f620e4e5aaf6e9121821153c3edae516) |
| 6539 | SelectAiChatShares13 | :many? | SELECT substr(created_at, 1, 10) as date, COUNT(*) as count FROM ai_chat_shares WHERE user_id = ? AND deleted_at IS NULL AND created_at LIKE ? GROUP BY date ORDER BY date | (検出不可) |
| 6561 | SelectAiChatShares14 | :many? | SELECT substr(created_at,1,10) as date, model, COUNT(*) as q_count FROM ai_chat_shares WHERE user_id=? AND deleted_at IS NULL AND created_at LIKE ? GROUP BY date, model ORDER BY date | [`dde02ec`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/dde02ec4223e1c70928b15b92ca30799ac41777e) |
| 6567 | SelectAiChatShares15 | :many? | SELECT model, COUNT(*) as q_count FROM ai_chat_shares WHERE user_id=? AND deleted_at IS NULL AND created_at LIKE ? AND source='api' GROUP BY model ORDER BY q_count DESC | (検出不可) |
| 6573 | SelectAiChatShares16 | :many? | SELECT source, COUNT(*) as q_count FROM ai_chat_shares WHERE user_id=? AND deleted_at IS NULL AND created_at LIKE ? GROUP BY source ORDER BY q_count DESC | (検出不可) |
| 6614 | SelectAiChatShares17 | :many? | SELECT s.id, s.user_hash, s.question, s.answer, s.model, s.created_at, s.access_count, s.question_hash, COALESCE(img.image_data_url, s.image_data_url) AS image_data_url FROM ai_chat_shares s LEFT JOIN… | [`7535ad3`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7535ad3ce2d84614b2582808a74bc0ed4ee43424), [`21c8eaf`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/21c8eafb57d2812207b473a26b6914c6ed843422), [`6b97a0c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6b97a0cc3be9302d4cd045fb751e0ca8c37882a4) |
| 6638 | SelectAiChatShares18 | :many? | SELECT DISTINCT s.id, s.user_hash, s.question, s.answer, s.model, s.created_at, s.access_count, s.question_hash, COALESCE(img.image_data_url, s.image_data_url) AS image_data_url FROM ai_chat_shares s … | [`6b97a0c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6b97a0cc3be9302d4cd045fb751e0ca8c37882a4), [`85f7238`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/85f7238b576fd4e881c12317495cbaea441667fd) |
| 6764 | SelectAiChatShares19 | :many | SELECT s.id, s.question, s.model FROM ai_chat_shares s WHERE s.id IN (${placeholders}) AND s.deleted_at IS NULL | [`f5070a9`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f5070a926f2781a7854c72856477eb59ab57cf8c) |
| 7091 | SelectAiChatShares20 | :many? | SELECT id, model, question, created_at, access_count, user_hash FROM ai_chat_shares WHERE question = ? AND user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC | [`09cf955`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/09cf955bce3414ade8351a53919bae69f83565ab), [`6c0a972`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6c0a9723f37d82acc9207fcd3c737c8a06ff3fab) |
| 7108 | SelectAiChatShares21 | :many? | SELECT id, model, question, created_at, access_count, user_hash FROM ai_chat_shares WHERE question_hash = ? AND user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC | [`09cf955`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/09cf955bce3414ade8351a53919bae69f83565ab), [`6c0a972`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6c0a9723f37d82acc9207fcd3c737c8a06ff3fab) |
| 7188 | SelectAiChatShares22 | :many? | SELECT strftime('${periodFormat}', created_at) AS period, model, SUM(COALESCE(input_tokens, 0)) AS input_tokens, SUM(COALESCE(output_tokens, 0)) AS output_tokens, SUM(COALESCE(total_tokens, 0)) AS tot… | [`90816a2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/90816a21a0eff9b8dd97234b46b6695c9ce42bba) |
| 7887 | SelectAiChatShares23 | :many? | SELECT id, question, answer FROM ai_chat_shares WHERE user_id = ? AND id IN (${placeholders}) | [`dffe0a2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/dffe0a275ae1d22affdeb4dfb1b2a941d1342a31) |
| 9123 | SelectAiChatShares24 | :many? | SELECT id, answer FROM ai_chat_shares WHERE id = ? AND user_id = ? AND deleted_at IS NULL | [`a2d85a5`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a2d85a551c475767504d41c37eafaead09c17099) |
| 11789 | SelectAiChatShares25 | :many? | SELECT id, question, answer, model, created_at FROM ai_chat_shares WHERE image_id = ? AND user_id = ? AND deleted_at IS NULL ORDER BY created_at ASC | (検出不可) |

## テーブル: `ai_summary_link_access_log`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0029_create_ai_summary_link_access_log.sql` | CREATE | [`403ae17`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/403ae17e7e6f4833bdaa2f984b8f481c832f28f4) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 2311 | InsertAiSummaryLinkAccessLog | :exec | INSERT INTO ai_summary_link_access_log (route, request_id, found, issue_code, issue_detail, referer, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) | (検出不可) |

## テーブル: `ai_summary_log`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0012_create_ai_summary_log.sql` | CREATE | [`55cd1e3`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/55cd1e3ce636512470b30b84624a444f4d916043) |
| `0015_alter_ai_summary_log.sql` | ALTER | [`d9cc398`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d9cc39894cf704d5dff6aa425d015a400ab43f07) |
| `0015_alter_ai_summary_log.sql` | ALTER | [`d9cc398`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d9cc39894cf704d5dff6aa425d015a400ab43f07) |
| `0015_alter_ai_summary_log.sql` | ALTER | [`d9cc398`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d9cc39894cf704d5dff6aa425d015a400ab43f07) |
| `0015_alter_ai_summary_log.sql` | ALTER | [`d9cc398`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d9cc39894cf704d5dff6aa425d015a400ab43f07) |
| `0015_alter_ai_summary_log.sql` | ALTER | [`d9cc398`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d9cc39894cf704d5dff6aa425d015a400ab43f07) |
| `0015_alter_ai_summary_log.sql` | ALTER | [`d9cc398`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d9cc39894cf704d5dff6aa425d015a400ab43f07) |
| `0028_add_model_switch_columns.sql` | ALTER | [`777e124`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/777e1244514614755f2cc33039ed2650103d10a0) |
| `0028_add_model_switch_columns.sql` | ALTER | [`777e124`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/777e1244514614755f2cc33039ed2650103d10a0) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 14946 | InsertAiSummaryLog | :exec? | INSERT INTO ai_summary_log (request_id, daily_seq, event_date, event_type, repo_full_name, pr_number, pr_action, pr_url, model, summary, diff_length, slack_notified, created_at, fallback_used, primary… | (検出不可) |
| 19277 | UpdateAiSummaryLog | :exec | UPDATE ai_summary_log SET resolved = ?, resolved_at = ?, resolution_note = ? WHERE request_id = ? | (検出不可) |

## テーブル: `ai_summary_reviews`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0016_create_ai_summary_reviews.sql` | CREATE | [`d9cc398`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d9cc39894cf704d5dff6aa425d015a400ab43f07) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 15011 | InsertAiSummaryReviews | :exec | INSERT INTO ai_summary_reviews (summary_request_id, rating, reviewer_type, reviewer_name, review_model, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) | (検出不可) |
| 15036 | InsertAiSummaryReviews2 | :exec | INSERT INTO ai_summary_reviews (summary_request_id, rating, reviewer_type, reviewer_name, review_model, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) | (検出不可) |
| 19239 | InsertAiSummaryReviews3 | :exec | INSERT INTO ai_summary_reviews (summary_request_id, rating, reviewer_type, reviewer_name, review_model, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) | (検出不可) |

## テーブル: `aichat_answer_category_scores`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0089_create_aichat_answer_category_scores.sql` | CREATE | [`dffe0a2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/dffe0a275ae1d22affdeb4dfb1b2a941d1342a31) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 7808 | SelectAichatAnswerCategoryScores | :many? | SELECT share_id, category_id, score, model FROM aichat_answer_category_scores WHERE user_id = ? AND share_id IN (${placeholders}) | [`e41e6c5`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e41e6c51f885fdc2063803e25cdebc2be4c8cf09) |
| 7835 | InsertAichatAnswerCategoryScores | :exec | INSERT INTO aichat_answer_category_scores (share_id, user_id, category_id, score, model, computed_at) VALUES ${valuesSql} ON CONFLICT(user_id, share_id, category_id) DO UPDATE SET score = excluded.sco… | [`dffe0a2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/dffe0a275ae1d22affdeb4dfb1b2a941d1342a31) |

## テーブル: `aichat_answer_keyword_vectors`

**対応migration**: 見つかりませんでした(動的テーブル名、またはCREATE TABLE文がmigrations/配下に存在しない可能性)。

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 8365 | SelectAichatAnswerKeywordVectors | :many? | SELECT 1 as found FROM aichat_answer_keyword_vectors WHERE user_id = ? AND share_id = ? AND keyword = ? AND model = ? | [`3437d24`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3437d24aca385b487204cf7396e53758ab5e3abd), [`5a9748f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5a9748f641f81fbbb0ed6887ac3392be66eac8d8) |
| 8385 | SelectAichatAnswerKeywordVectors2 | :many? | SELECT vector FROM aichat_answer_keyword_vectors WHERE user_id = ? AND share_id = ? AND keyword = ? AND model = ? | [`5a9748f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5a9748f641f81fbbb0ed6887ac3392be66eac8d8) |
| 8392 | InsertAichatAnswerKeywordVectors | :exec | INSERT INTO aichat_answer_keyword_vectors (share_id, user_id, keyword, model, dim, vector, computed_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, share_id, keyword, model) DO UPDATE SET dim = … | [`5a9748f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5a9748f641f81fbbb0ed6887ac3392be66eac8d8) |
| 8412 | SelectAichatAnswerKeywordVectors3 | :many? | SELECT 1 as found FROM aichat_answer_keyword_vectors WHERE user_id = ? AND share_id = ? LIMIT 1 | [`3437d24`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3437d24aca385b487204cf7396e53758ab5e3abd), [`5a9748f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5a9748f641f81fbbb0ed6887ac3392be66eac8d8) |
| 8427 | SelectAichatAnswerKeywordVectors4 | :many? | SELECT DISTINCT keyword FROM aichat_answer_keyword_vectors WHERE user_id = ? AND share_id = ? ORDER BY keyword | [`3437d24`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3437d24aca385b487204cf7396e53758ab5e3abd) |

## テーブル: `aichat_answer_vectors`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0094_create_aichat_answer_vectors.sql` | CREATE | [`a2d85a5`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a2d85a551c475767504d41c37eafaead09c17099) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 4949 | SelectAichatAnswerVectors | :many? | SELECT s.id AS id, s.question AS question, MAX(v.computed_at) AS computed_at FROM aichat_answer_vectors v JOIN ai_chat_shares s ON s.id = v.share_id WHERE v.user_id = ? GROUP BY s.id, s.question ORDER… | [`a5a7347`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a5a734739c51e81e8200ebc51ec1141e55d4fe67) |
| 5739 | SelectAichatAnswerVectors2 | :many? | SELECT DISTINCT share_id FROM aichat_answer_vectors WHERE user_id = ? AND model = ? AND share_id IN (${placeholders}) | (検出不可) |
| 8319 | SelectAichatAnswerVectors3 | :many? | SELECT vector FROM aichat_answer_vectors WHERE user_id = ? AND share_id = ? AND model = ? | [`a2d85a5`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a2d85a551c475767504d41c37eafaead09c17099) |
| 8326 | InsertAichatAnswerVectors | :exec | INSERT INTO aichat_answer_vectors (share_id, user_id, model, dim, vector, computed_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, share_id, model) DO UPDATE SET dim = excluded.dim, vector = exclud… | [`a2d85a5`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a2d85a551c475767504d41c37eafaead09c17099) |
| 8346 | SelectAichatAnswerVectors4 | :many? | SELECT 1 as found FROM aichat_answer_vectors WHERE user_id = ? AND share_id = ? AND model = ? | [`a2d85a5`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a2d85a551c475767504d41c37eafaead09c17099) |

## テーブル: `aichat_category_audit_log`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0086_create_aichat_category_audit_log.sql` | CREATE | [`ba96632`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ba96632d38637bfff2d104d560ec42d995057ba4) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 3131 | InsertAichatCategoryAuditLog | :exec | INSERT INTO aichat_category_audit_log (user_id, action, entity_type, entity_id, entity_name, detail) VALUES (?, ?, ?, ?, ?, ?) | [`ba96632`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ba96632d38637bfff2d104d560ec42d995057ba4) |

## テーブル: `aichat_category_groups`

**対応migration**: 見つかりませんでした(動的テーブル名、またはCREATE TABLE文がmigrations/配下に存在しない可能性)。

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 7215 | SelectAichatCategoryGroups | :many? | SELECT ag.id, ag.group_name, ag.category_ids, COUNT(DISTINCT m.keyword) AS kw_count FROM aichat_category_groups ag LEFT JOIN json_each(ag.category_ids) je LEFT JOIN aichat_keyword_category_map m ON m.… | (検出不可) |
| 7249 | InsertAichatCategoryGroups | :exec | INSERT INTO aichat_category_groups (id, user_id, group_name, category_ids, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now')) | [`59a4b0b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/59a4b0b0c3cf7ebc9bc96b62dca5cebed0e68ac9) |
| 7277 | SelectAichatCategoryGroups2 | :many? | SELECT category_ids FROM aichat_category_groups WHERE id = ? AND user_id = ? AND (is_deleted = 0 OR is_deleted IS NULL) | [`eba8514`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/eba85148d25243dcf70928cf5f98db1cb8c9c90e), [`c840d3f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c840d3fa5db89fc7a438318d079198c85bc7c7a1) |
| 7287 | UpdateAichatCategoryGroups | :exec | UPDATE aichat_category_groups SET category_ids = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ? | [`eba8514`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/eba85148d25243dcf70928cf5f98db1cb8c9c90e), [`c840d3f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c840d3fa5db89fc7a438318d079198c85bc7c7a1) |
| 7312 | SelectAichatCategoryGroups3 | :many? | SELECT category_ids FROM aichat_category_groups WHERE id = ? AND user_id = ? AND (is_deleted = 0 OR is_deleted IS NULL) | [`eba8514`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/eba85148d25243dcf70928cf5f98db1cb8c9c90e), [`c840d3f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c840d3fa5db89fc7a438318d079198c85bc7c7a1) |
| 7319 | UpdateAichatCategoryGroups2 | :exec | UPDATE aichat_category_groups SET category_ids = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ? | [`eba8514`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/eba85148d25243dcf70928cf5f98db1cb8c9c90e), [`c840d3f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c840d3fa5db89fc7a438318d079198c85bc7c7a1) |
| 7340 | UpdateAichatCategoryGroups3 | :exec | UPDATE aichat_category_groups SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ? AND user_id = ? | [`59a4b0b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/59a4b0b0c3cf7ebc9bc96b62dca5cebed0e68ac9) |
| 9612 | SelectAichatCategoryGroups4 | :many? | SELECT category_ids FROM aichat_category_groups WHERE user_id = ? AND lower(group_name) = lower(?) AND (is_deleted = 0 OR is_deleted IS NULL) ORDER BY updated_at DESC LIMIT 1 | (検出不可) |

## テーブル: `aichat_keyword_categories`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0084_create_aichat_keyword_categories.sql` | CREATE | [`ba96632`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ba96632d38637bfff2d104d560ec42d995057ba4) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 7363 | SelectAichatKeywordCategories | :many? | SELECT c.id, c.name, COALESCE(c.color, '#6366f1') AS color, COUNT(DISTINCT m.keyword) AS kw_count FROM aichat_keyword_categories c LEFT JOIN aichat_keyword_category_map m ON m.category_id = c.id AND m… | (検出不可) |
| 7390 | InsertAichatKeywordCategories | :exec | INSERT OR IGNORE INTO aichat_keyword_categories (user_id, name, color, created_at) VALUES (?, ?, ?, ?) | [`87544c8`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/87544c87bd5134959cba0352b070d8d7b4650560) |
| 7393 | SelectAichatKeywordCategories2 | :many? | SELECT id, name, color FROM aichat_keyword_categories WHERE user_id = ? AND name = ? | [`a1d054d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a1d054d8b50078e78ad1e7b4144e2b62b2202d7a), [`dffe0a2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/dffe0a275ae1d22affdeb4dfb1b2a941d1342a31), [`f6da82f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f6da82ffcc5cb5738f9f290dd468e2173fae965a) |
| 7422 | SelectAichatKeywordCategories3 | :exec | SELECT id, name, color FROM aichat_keyword_categories WHERE id = ? AND user_id = ? | [`a1d054d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a1d054d8b50078e78ad1e7b4144e2b62b2202d7a), [`dffe0a2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/dffe0a275ae1d22affdeb4dfb1b2a941d1342a31), [`f6da82f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f6da82ffcc5cb5738f9f290dd468e2173fae965a) |
| 7426 | UpdateAichatKeywordCategories | :exec | UPDATE aichat_keyword_categories SET color = ? WHERE id = ? AND user_id = ? | [`a1d054d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a1d054d8b50078e78ad1e7b4144e2b62b2202d7a) |
| 7858 | SelectAichatKeywordCategories4 | :many? | SELECT id, name, color FROM aichat_keyword_categories WHERE user_id = ? | [`a1d054d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a1d054d8b50078e78ad1e7b4144e2b62b2202d7a), [`dffe0a2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/dffe0a275ae1d22affdeb4dfb1b2a941d1342a31), [`f6da82f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f6da82ffcc5cb5738f9f290dd468e2173fae965a) |
| 8892 | SelectAichatKeywordCategories5 | :many? | SELECT id, name FROM aichat_keyword_categories WHERE user_id = ? | [`e7063ef`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e7063ef66d5e6da520776b1b5650c8c26b6faaec), [`f6da82f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f6da82ffcc5cb5738f9f290dd468e2173fae965a), [`87544c8`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/87544c87bd5134959cba0352b070d8d7b4650560) |
| 9625 | SelectAichatKeywordCategories6 | :many? | SELECT c.id, c.name, COALESCE(c.color, '#6366f1') AS color, COUNT(DISTINCT m.keyword) AS kw_count FROM aichat_keyword_categories c LEFT JOIN aichat_keyword_category_map m ON m.user_id = c.user_id AND … | (検出不可) |

## テーブル: `aichat_keyword_category_map`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0085_create_aichat_keyword_category_map.sql` | CREATE | [`ba96632`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ba96632d38637bfff2d104d560ec42d995057ba4) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 7158 | SelectAichatKeywordCategoryMap | :many? | SELECT c.id, c.name, c.color, (SELECT COUNT(*) FROM aichat_keyword_category_map m WHERE m.category_id = c.id AND m.keyword = ? AND m.user_id = ?) AS is_mapped FROM aichat_keyword_categories c WHERE c.… | (検出不可) |
| 7868 | SelectAichatKeywordCategoryMap2 | :many? | SELECT category_id, keyword FROM aichat_keyword_category_map WHERE user_id = ? AND category_id IN (${placeholders}) | [`e41e6c5`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e41e6c51f885fdc2063803e25cdebc2be4c8cf09) |
| 7965 | SelectAichatKeywordCategoryMap3 | :many? | SELECT m.keyword AS keyword, c.name AS name, c.color AS color FROM aichat_keyword_category_map m JOIN aichat_keyword_categories c ON c.id = m.category_id AND c.user_id = m.user_id WHERE m.user_id = ? … | [`dffe0a2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/dffe0a275ae1d22affdeb4dfb1b2a941d1342a31) |
| 8142 | SelectAichatKeywordCategoryMap4 | :many? | SELECT m.keyword AS keyword, c.id AS category_id, c.name AS category_name FROM aichat_keyword_category_map m JOIN aichat_keyword_categories c ON c.id = m.category_id AND c.user_id = m.user_id WHERE m.… | [`30e8f9a`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/30e8f9a07413fa0ef5893b0467160643898535cd) |
| 8191 | SelectAichatKeywordCategoryMap5 | :many? | SELECT category_id FROM aichat_keyword_category_map WHERE user_id = ? AND keyword = ? | [`ab7b12c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ab7b12cdfc01cd65bc101b1e7b75855ce6b82dec) |
| 8200 | DeleteAichatKeywordCategoryMap | :exec | DELETE FROM aichat_keyword_category_map WHERE user_id = ? AND keyword = ? AND category_id = ? | [`ab7b12c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ab7b12cdfc01cd65bc101b1e7b75855ce6b82dec) |
| 8209 | InsertAichatKeywordCategoryMap | :exec | INSERT OR IGNORE INTO aichat_keyword_category_map (user_id, keyword, category_id, created_at) VALUES (?, ?, ?, ?) | [`87544c8`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/87544c87bd5134959cba0352b070d8d7b4650560) |
| 8498 | SelectAichatKeywordCategoryMap6 | :many? | SELECT m.keyword AS keyword, c.id AS category_id, c.color AS color FROM aichat_keyword_category_map m JOIN aichat_keyword_categories c ON c.id = m.category_id AND c.user_id = m.user_id WHERE m.user_id… | [`34d8f62`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/34d8f62c0bad0bb3f2fc231e4c1121af45c3cf8a) |
| 8903 | SelectAichatKeywordCategoryMap7 | :many? | SELECT DISTINCT keyword FROM aichat_keyword_category_map WHERE user_id = ? AND category_id = ? LIMIT 30 | [`e41e6c5`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e41e6c51f885fdc2063803e25cdebc2be4c8cf09), [`dffe0a2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/dffe0a275ae1d22affdeb4dfb1b2a941d1342a31), [`e7063ef`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e7063ef66d5e6da520776b1b5650c8c26b6faaec) |
| 9647 | SelectAichatKeywordCategoryMap8 | :many? | SELECT m.keyword, COUNT(DISTINCT i.id) AS count FROM aichat_keyword_category_map m LEFT JOIN aichat_search_log s ON s.user_id = m.user_id AND s.keyword = m.keyword AND s.deleted_at IS NULL LEFT JOIN a… | (検出不可) |

## テーブル: `aichat_keyword_category_suggestions`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0088_create_aichat_keyword_category_suggestions.sql` | CREATE | [`8a40712`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8a4071215e78d326bc2a897e0df8d8db05b6a18f) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 8919 | InsertAichatKeywordCategorySuggestions | :exec | INSERT INTO aichat_keyword_category_suggestions (user_id, keyword, suggested_category_id, similarity, model, created_at) VALUES (?, ?, ?, ?, ?, ?) | [`e7063ef`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e7063ef66d5e6da520776b1b5650c8c26b6faaec) |

## テーブル: `aichat_keyword_embeddings`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0087_create_aichat_keyword_embeddings.sql` | CREATE | [`8a40712`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8a4071215e78d326bc2a897e0df8d8db05b6a18f) |
| `0090_alter_aichat_keyword_embeddings_add_plamo_columns.sql` | ALTER | [`65f3e1b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/65f3e1bd93ac43620cbde8427b678862904edc0a) |
| `0090_alter_aichat_keyword_embeddings_add_plamo_columns.sql` | ALTER | [`65f3e1b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/65f3e1bd93ac43620cbde8427b678862904edc0a) |
| `0090_alter_aichat_keyword_embeddings_add_plamo_columns.sql` | ALTER | [`65f3e1b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/65f3e1bd93ac43620cbde8427b678862904edc0a) |
| `0091_alter_aichat_keyword_embeddings_add_plamo_model.sql` | ALTER | [`839e467`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/839e467e4932a961e33382b0c82b76bba17c4e9c) |
| `0092_alter_aichat_keyword_embeddings_add_source.sql` | ALTER | [`cf46798`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/cf46798c348994ffbbaf22797ce9dd2de13ba726) |
| `0093_alter_aichat_keyword_embeddings_add_gemma_columns.sql` | ALTER | [`88fff55`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/88fff556b39a46979acebc752703cc88362730b7) |
| `0093_alter_aichat_keyword_embeddings_add_gemma_columns.sql` | ALTER | [`88fff55`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/88fff556b39a46979acebc752703cc88362730b7) |
| `0093_alter_aichat_keyword_embeddings_add_gemma_columns.sql` | ALTER | [`88fff55`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/88fff556b39a46979acebc752703cc88362730b7) |
| `0093_alter_aichat_keyword_embeddings_add_gemma_columns.sql` | ALTER | [`88fff55`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/88fff556b39a46979acebc752703cc88362730b7) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 7752 | SelectAichatKeywordEmbeddings | :many? | SELECT keyword, vector, model FROM aichat_keyword_embeddings WHERE user_id = ? AND keyword IN (${placeholders}) | [`e41e6c5`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e41e6c51f885fdc2063803e25cdebc2be4c8cf09) |
| 7787 | InsertAichatKeywordEmbeddings | :exec | INSERT INTO aichat_keyword_embeddings (user_id, keyword, model, dim, vector, source, created_at, updated_at) VALUES ${valuesSql} ON CONFLICT(user_id, keyword) DO UPDATE SET model = excluded.model, dim… | [`e41e6c5`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e41e6c51f885fdc2063803e25cdebc2be4c8cf09), [`e7063ef`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e7063ef66d5e6da520776b1b5650c8c26b6faaec) |
| 8126 | SelectAichatKeywordEmbeddings2 | :many? | SELECT vector FROM aichat_keyword_embeddings WHERE user_id = ? AND keyword = ? | [`30e8f9a`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/30e8f9a07413fa0ef5893b0467160643898535cd) |
| 8132 | SelectAichatKeywordEmbeddings3 | :many? | SELECT keyword, vector FROM aichat_keyword_embeddings WHERE user_id = ? AND keyword != ? | [`30e8f9a`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/30e8f9a07413fa0ef5893b0467160643898535cd) |
| 8282 | SelectAichatKeywordEmbeddings4 | :exec | SELECT vector, model, source FROM aichat_keyword_embeddings WHERE user_id = ? AND keyword = ? | [`0b4addf`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/0b4addf2c85db73f5b208fbbc889ec39b0c5f594) |
| 8287 | UpdateAichatKeywordEmbeddings | :exec | UPDATE aichat_keyword_embeddings SET source = ?, updated_at = ? WHERE user_id = ? AND keyword = ? | [`0b4addf`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/0b4addf2c85db73f5b208fbbc889ec39b0c5f594) |
| 8296 | InsertAichatKeywordEmbeddings2 | :exec | INSERT INTO aichat_keyword_embeddings (user_id, keyword, model, dim, vector, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, keyword) DO UPDATE SET model = exclude… | [`e41e6c5`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e41e6c51f885fdc2063803e25cdebc2be4c8cf09), [`e7063ef`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e7063ef66d5e6da520776b1b5650c8c26b6faaec) |
| 8683 | SelectAichatKeywordEmbeddings5 | :many? | SELECT ${prefix}_vector AS sec_vector, ${prefix}_dim AS sec_dim, ${prefix}_model AS sec_model FROM aichat_keyword_embeddings WHERE user_id = ? AND keyword = ? | [`88fff55`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/88fff556b39a46979acebc752703cc88362730b7) |
| 8700 | UpdateAichatKeywordEmbeddings2 | :exec | UPDATE aichat_keyword_embeddings SET ${prefix}_vector = ?, ${prefix}_dim = ?, ${prefix}_model = ?, ${prefix}_updated_at = ? WHERE user_id = ? AND keyword = ? | (検出不可) |
| 8765 | SelectAichatKeywordEmbeddings6 | :many? | SELECT keyword, model, dim, vector, created_at, updated_at FROM aichat_keyword_embeddings WHERE user_id = ? AND keyword = ? | [`5269399`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/52693998c0ea33ca7902903d92857d33409e80e5) |
| 8816 | SelectAichatKeywordEmbeddings7 | :many? | SELECT keyword, model, dim, updated_at, source, plamo_dim, plamo_model, plamo_updated_at, gemma_dim, gemma_model, gemma_updated_at FROM aichat_keyword_embeddings WHERE user_id = ? ORDER BY updated_at … | [`abb6a6c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/abb6a6c02653cfbfbcb3d6fabc64f5e147465bba) |
| 8862 | SelectAichatKeywordEmbeddings8 | :many? | SELECT COUNT(*) AS bge, SUM(CASE WHEN plamo_dim IS NOT NULL THEN 1 ELSE 0 END) AS plamo, SUM(CASE WHEN gemma_dim IS NOT NULL THEN 1 ELSE 0 END) AS gemma FROM aichat_keyword_embeddings WHERE user_id = … | (検出不可) |

## テーブル: `aichat_moondream_analyses`

**対応migration**: 見つかりませんでした(動的テーブル名、またはCREATE TABLE文がmigrations/配下に存在しない可能性)。

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 5364 | SelectAichatMoondreamAnalyses | :many? | SELECT s.id, s.user_hash, s.question, m.analysis_text AS answer, m.model, s.created_at, s.image_id, COALESCE(img.image_data_url, s.image_data_url) AS image_data_url FROM aichat_moondream_analyses m JO… | [`5374c24`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5374c248d56e4b90e08e47667d528ae10453cfe2), [`7535ad3`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7535ad3ce2d84614b2582808a74bc0ed4ee43424) |
| 5527 | SelectAichatMoondreamAnalyses2 | :many? | SELECT s.id, s.user_hash, s.question, m.analysis_text AS answer, m.model, s.created_at, s.access_count, s.question_hash, s.input_tokens, s.output_tokens, s.total_tokens, COALESCE(img.image_data_url, s… | [`5374c24`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5374c248d56e4b90e08e47667d528ae10453cfe2), [`7535ad3`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7535ad3ce2d84614b2582808a74bc0ed4ee43424) |
| 5670 | SelectAichatMoondreamAnalyses3 | :many? | SELECT image_id, share_id AS shareId, model FROM aichat_moondream_analyses WHERE user_id = ? AND image_id IN (${placeholders}) | [`85e95f3`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/85e95f313df88cb832de2cce93f2cbeae8811567) |
| 11796 | SelectAichatMoondreamAnalyses4 | :many? | SELECT share_id, analysis_text, model, created_at FROM aichat_moondream_analyses WHERE image_id = ? AND user_id = ? ORDER BY created_at ASC | (検出不可) |

## テーブル: `aichat_rate_limit`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0055_create_aichat_rate_limit.sql` | CREATE | [`fa5fb34`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/fa5fb348fe155f4fb529734b9a1193561730b7a7) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 2920 | InsertAichatRateLimit | :exec? | INSERT INTO aichat_rate_limit (user_id, window_key, request_count, updated_at) VALUES (?, ?, 1, datetime('now')) ON CONFLICT(user_id, window_key) DO UPDATE SET request_count = request_count + 1, updat… | [`fa5fb34`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/fa5fb348fe155f4fb529734b9a1193561730b7a7) |

## テーブル: `aichat_search_history`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0041_create_aichat_search_history.sql` | CREATE | [`8fd1c8a`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8fd1c8a1a16a218c323f2981a87ab54119f70881) |
| `0043_alter_aichat_search_history_add_result_count.sql` | ALTER | [`9c5402c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/9c5402ccde1339d3aa01be17ed7782e2605385fb) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 6328 | SelectAichatSearchHistory | :many? | SELECT ash.keyword, COUNT(*) as count FROM aichat_search_history ash INNER JOIN ai_chat_shares acs ON acs.id = ash.share_id AND acs.user_id = ? AND acs.deleted_at IS NULL WHERE ash.user_id = ? AND ash… | (検出不可) |
| 6555 | SelectAichatSearchHistory2 | :many? | SELECT substr(searched_at,1,10) as date, COUNT(DISTINCT keyword) as kw_count FROM aichat_search_history WHERE user_id=? AND searched_at LIKE ? AND deleted_at IS NULL GROUP BY date ORDER BY date | [`dde02ec`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/dde02ec4223e1c70928b15b92ca30799ac41777e) |
| 6710 | SelectAichatSearchHistory3 | :many? | SELECT h.id, h.keyword, h.share_id, h.seq_num, h.searched_at, h.deleted_at, c.question FROM aichat_search_history h LEFT JOIN ai_chat_shares c ON c.id = h.share_id AND c.deleted_at IS NULL WHERE h.use… | [`8825a21`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8825a2162118e4457fed639f11474fa9b187fada) |
| 6729 | SelectAichatSearchHistory4 | :many? | SELECT h.share_id, c.question, h.keyword, MAX(h.seq_num) AS max_seq_num FROM aichat_search_history h LEFT JOIN ai_chat_shares c ON c.id = h.share_id WHERE h.user_id = ? AND h.deleted_at IS NULL GROUP … | [`dce68b7`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/dce68b777be9d57037b2c67ddb2f0ebe3f0d8cc8) |
| 6821 | InsertAichatSearchHistory | :exec | INSERT INTO aichat_search_history (user_id, keyword, share_id, seq_num, searched_at, result_count) VALUES (?, ?, ?, (SELECT COALESCE(COUNT(*), 0) + 1 FROM aichat_search_history WHERE user_id = ? AND k… | [`8fd1c8a`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8fd1c8a1a16a218c323f2981a87ab54119f70881) |
| 6965 | SelectAichatSearchHistory5 | :many? | SELECT h.share_id, h.keyword, COUNT(*) AS cnt FROM aichat_search_history h WHERE h.share_id IN (${placeholders}) AND h.deleted_at IS NULL GROUP BY h.share_id, h.keyword ORDER BY h.share_id, cnt DESC | (検出不可) |

## テーブル: `aichat_search_impressions`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0044_create_aichat_search_impressions.sql` | CREATE | [`9d8dd09`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/9d8dd090ba8fb2d06f5006e6e3857786d800f65d) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 6833 | SelectAichatSearchImpressions | :many? | SELECT i.share_id, s.question, COUNT(DISTINCT i.id) AS impression_count, MAX(i.result_count) AS max_result_count, MAX(i.searched_at) AS last_searched_at, l.keyword, MAX(l.select_count) AS max_select_c… | (検出不可) |
| 6881 | InsertAichatSearchImpressions | :many | INSERT INTO aichat_search_impressions (user_id, share_id, result_count, searched_at) VALUES (?, ?, ?, ?) | [`9d8dd09`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/9d8dd090ba8fb2d06f5006e6e3857786d800f65d) |
| 9720 | SelectAichatSearchImpressions2 | :many? | SELECT NULL AS area_seq, 'aichat_search_impressions' AS category, s.question AS item_name, s.answer AS answer, i.share_id, COUNT(DISTINCT i.id) AS impression_count, MAX(i.result_count) AS max_result_c… | (検出不可) |

## テーブル: `aichat_search_log`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0040_create_aichat_search_log.sql` | CREATE | [`e39925d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e39925d1d98562fddd3b847e9c09e5647cd4140c) |
| `0042_alter_aichat_search_log_add_columns.sql` | ALTER | [`9c5402c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/9c5402ccde1339d3aa01be17ed7782e2605385fb) |
| `0042_alter_aichat_search_log_add_columns.sql` | ALTER | [`9c5402c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/9c5402ccde1339d3aa01be17ed7782e2605385fb) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 4878 | InsertAichatSearchLog | :exec? | INSERT INTO aichat_search_log (user_id, keyword, share_id, first_searched_at, last_searched_at, select_count, result_count) VALUES (?, ?, ?, ?, ?, 1, ?) ON CONFLICT(user_id, keyword, share_id) DO UPDA… | [`f5070a9`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f5070a926f2781a7854c72856477eb59ab57cf8c), [`e39925d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e39925d1d98562fddd3b847e9c09e5647cd4140c) |
| 5710 | SelectAichatSearchLog | :many? | SELECT share_id, COUNT(DISTINCT keyword) AS cnt FROM aichat_search_log WHERE user_id = ? AND share_id IN (${placeholders}) GROUP BY share_id | [`e16ec46`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e16ec46b8e08e5fbc737099b8ab093e04cae5fa4) |
| 5792 | SelectAichatSearchLog2 | :many? | SELECT share_id, keyword FROM aichat_search_log WHERE user_id = ? AND share_id IN (${placeholders}) GROUP BY share_id, keyword ORDER BY SUM(select_count) DESC | (検出不可) |
| 6652 | SelectAichatSearchLog3 | :many? | SELECT DISTINCT s.id, s.user_hash, s.question, s.answer, s.model, s.created_at, s.access_count, s.question_hash, COALESCE(img.image_data_url, s.image_data_url) AS image_data_url FROM aichat_search_log… | [`6b97a0c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6b97a0cc3be9302d4cd045fb751e0ca8c37882a4), [`85f7238`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/85f7238b576fd4e881c12317495cbaea441667fd) |
| 6673 | SelectAichatSearchLog4 | :many? | SELECT l.keyword, SUM(l.select_count) AS total_count, GROUP_CONCAT(DISTINCT s.model) AS models FROM aichat_search_log l LEFT JOIN ai_chat_shares s ON s.id = l.share_id AND s.deleted_at IS NULL WHERE l… | (検出不可) |
| 6691 | SelectAichatSearchLog5 | :many? | SELECT s.keyword, s.share_id, s.first_searched_at, s.last_searched_at, s.select_count, c.question FROM aichat_search_log s LEFT JOIN ai_chat_shares c ON c.id = s.share_id AND c.deleted_at IS NULL WHER… | [`4a5697b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/4a5697b7df4e33f629ccfa746d816807d4b67c2b) |
| 6760 | SelectAichatSearchLog6 | :many | SELECT share_id FROM aichat_search_log WHERE user_id = ? AND keyword = ? AND share_id IN (${placeholders}) | [`f5070a9`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f5070a926f2781a7854c72856477eb59ab57cf8c) |
| 6790 | InsertAichatSearchLog2 | :exec? | INSERT INTO aichat_search_log (user_id, keyword, share_id, first_searched_at, last_searched_at, select_count) VALUES (?, ?, ?, ?, ?, 1) ON CONFLICT(user_id, keyword, share_id) DO NOTHING | [`f5070a9`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f5070a926f2781a7854c72856477eb59ab57cf8c), [`e39925d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e39925d1d98562fddd3b847e9c09e5647cd4140c) |
| 6813 | InsertAichatSearchLog3 | :exec | INSERT INTO aichat_search_log (user_id, keyword, share_id, first_searched_at, last_searched_at, select_count, result_count) VALUES (?, ?, ?, ?, ?, 1, ?) ON CONFLICT(user_id, keyword, share_id) DO UPDA… | [`f5070a9`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f5070a926f2781a7854c72856477eb59ab57cf8c), [`e39925d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e39925d1d98562fddd3b847e9c09e5647cd4140c) |
| 7059 | SelectAichatSearchLog7 | :many? | SELECT s.keyword, SUM(s.select_count) AS count, CASE WHEN COUNT(m.category_id) > 0 THEN 1 ELSE 0 END AS is_classified FROM aichat_search_log s LEFT JOIN aichat_keyword_category_map m ON m.keyword = s.… | (検出不可) |
| 7071 | SelectAichatSearchLog8 | :many? | SELECT keyword, SUM(select_count) AS count FROM aichat_search_log WHERE share_id = ? AND user_id = ? GROUP BY keyword ORDER BY count DESC LIMIT 50 | (検出不可) |
| 7125 | SelectAichatSearchLog9 | :many? | SELECT s.keyword, s.cnt, CASE WHEN COUNT(m.category_id) > 0 THEN 1 ELSE 0 END AS is_classified, MIN(m.category_id) AS category_id, COALESCE(MIN(c.color), '#6366f1') AS category_color, GROUP_CONCAT(m.c… | (検出不可) |
| 7140 | SelectAichatSearchLog10 | :many? | SELECT keyword, SUM(select_count) AS cnt FROM aichat_search_log WHERE user_id = ? GROUP BY keyword ORDER BY cnt DESC | [`ae29605`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ae2960596259f4ae53de4f4848fc1a10cc27cce7) |
| 7878 | SelectAichatSearchLog11 | :many? | SELECT keyword FROM aichat_search_log WHERE user_id = ? GROUP BY keyword ORDER BY SUM(select_count) DESC LIMIT 300 | [`e16ec46`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e16ec46b8e08e5fbc737099b8ab093e04cae5fa4), [`62e9f3c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/62e9f3c193932ba2f47fa7de501ad377baed05e0), [`dffe0a2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/dffe0a275ae1d22affdeb4dfb1b2a941d1342a31), [`9cbd89e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/9cbd89e7ef9befc5ccda8b9bb5933f540348e9d3) |
| 8450 | SelectAichatSearchLog12 | :many? | SELECT keyword, SUM(select_count) AS cnt FROM aichat_search_log WHERE user_id = ? AND keyword IN (${placeholders}) GROUP BY keyword | [`ae29605`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ae2960596259f4ae53de4f4848fc1a10cc27cce7) |

## テーブル: `aichat_share_subquery_links`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0046_create_aichat_share_subquery_links.sql` | CREATE | [`346ef16`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/346ef162cfce56af0d4c99eb9b16146c468cb80c) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 6903 | SelectAichatShareSubqueryLinks | :many? | SELECT l.subquery_id, h.keyword, COUNT(*) AS cnt FROM aichat_share_subquery_links l JOIN ai_chat_shares cs ON cs.question = l.question JOIN aichat_search_history h ON h.share_id = cs.id WHERE h.delete… | (検出不可) |
| 6950 | SelectAichatShareSubqueryLinks2 | :many? | SELECT DISTINCT cs.id AS share_id, cs.question FROM aichat_share_subquery_links l JOIN ai_chat_shares cs ON cs.question = l.question JOIN aichat_search_history h ON h.share_id = cs.id WHERE l.subquery… | (検出不可) |
| 6994 | SelectAichatShareSubqueryLinks3 | :many? | SELECT l.id, l.question, l.subquery_id, l.url, q.query, s.model FROM aichat_share_subquery_links l JOIN aichat_subqueries q ON q.id = l.subquery_id LEFT JOIN ai_chat_shares s ON s.id = CAST(SUBSTR(l.u… | (検出不可) |
| 7015 | SelectAichatShareSubqueryLinks4 | :many? | SELECT l.id, l.question, l.subquery_id, l.url, q.query, l.question_hash, GROUP_CONCAT(DISTINCT s.model) AS models_csv, MIN(s.id) AS share_id FROM aichat_share_subquery_links l JOIN aichat_subqueries q… | [`6c0a972`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6c0a9723f37d82acc9207fcd3c737c8a06ff3fab) |
| 9034 | InsertAichatShareSubqueryLinks | :exec | INSERT OR IGNORE INTO aichat_share_subquery_links (user_id, question, subquery_id, url, created_at, question_hash) VALUES (?, ?, ?, ?, ?, ?) | [`346ef16`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/346ef162cfce56af0d4c99eb9b16146c468cb80c) |

## テーブル: `aichat_subqueries`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0045_create_aichat_subqueries.sql` | CREATE | [`346ef16`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/346ef162cfce56af0d4c99eb9b16146c468cb80c) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 6895 | SelectAichatSubqueries | :many? | SELECT s.id, s.query, COUNT(l.id) AS link_count FROM aichat_subqueries s LEFT JOIN aichat_share_subquery_links l ON l.subquery_id = s.id GROUP BY s.id, s.query ORDER BY link_count DESC, s.id DESC LIMI… | (検出不可) |
| 6933 | InsertAichatSubqueries | :exec | INSERT OR IGNORE INTO aichat_subqueries (query) VALUES (?) | [`346ef16`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/346ef162cfce56af0d4c99eb9b16146c468cb80c) |
| 6936 | SelectAichatSubqueries2 | :many? | SELECT id, query FROM aichat_subqueries WHERE query = ? | [`346ef16`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/346ef162cfce56af0d4c99eb9b16146c468cb80c) |

## テーブル: `api_endpoint_stats`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0056_create_api_endpoint_stats.sql` | CREATE | [`6894487`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/689448722c884f243d8ee50bbaefbbf0d835ecd0) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 3014 | InsertApiEndpointStats | :exec | INSERT INTO api_endpoint_stats (endpoint, status_code, count, last_called_at) VALUES (?, ?, 1, datetime('now')) ON CONFLICT(endpoint, status_code) DO UPDATE SET count = count + 1, last_called_at = dat… | [`6894487`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/689448722c884f243d8ee50bbaefbbf0d835ecd0) |

## テーブル: `api_search_keyword_sections`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0058_create_api_search_keyword_sections.sql` | CREATE | [`a18bb68`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a18bb6822c54dcc6f4788a38e33a19032445e8fd) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 18266 | InsertApiSearchKeywordSections | :exec? | INSERT INTO api_search_keyword_sections (keyword_id, section_name, count) VALUES (?, ?, ?) | [`a18bb68`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a18bb6822c54dcc6f4788a38e33a19032445e8fd) |

## テーブル: `api_search_keywords`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0057_create_api_search_keywords.sql` | CREATE | [`a18bb68`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a18bb6822c54dcc6f4788a38e33a19032445e8fd) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 18238 | SelectApiSearchKeywords | :many | SELECT id, keyword, total_count, section_count, recorded_at FROM api_search_keywords ORDER BY total_count DESC, recorded_at DESC LIMIT 20 | [`a8f2c37`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a8f2c3715cc26e95f197a4591ab62c832015c6d2) |
| 18259 | InsertApiSearchKeywords | :exec | INSERT INTO api_search_keywords (keyword, total_count, section_count, recorded_at) VALUES (?, ?, ?, datetime('now')) | [`a18bb68`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a18bb6822c54dcc6f4788a38e33a19032445e8fd) |

## テーブル: `cache_stats`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0009_create_cache_stats.sql` | CREATE | [`6a28952`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6a28952f81bbe12267b7405b01af301a4fa59579) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 15712 | InsertCacheStats | :exec | INSERT INTO cache_stats (user_id, owner, repo, ${field}, last_updated_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT (user_id, owner, repo) DO UPDATE SET ${field} = ${field} + 1, last_updated_at = excluded.la… | [`6a28952`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6a28952f81bbe12267b7405b01af301a4fa59579) |

## テーブル: `cheese_fr`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0107_create_cheese_fr.sql` | CREATE | [`618e391`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/618e3918e8aaf5b04b0896abdfa8e2eeaaf77a59) |
| `0108_add_pairing_to_cheese_fr.sql` | ALTER | [`28cedb0`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/28cedb062f4ac8e0dca3dbad6becc9f67c25ae27) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 11654 | SelectCheeseFr | :many | SELECT seq_no, name_fr, reading, ingredient, producer, method, hardness, notes, pairing FROM cheese_fr WHERE name_fr LIKE ? OR reading LIKE ? ORDER BY seq_no | [`618e391`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/618e3918e8aaf5b04b0896abdfa8e2eeaaf77a59) |
| 11658 | SelectCheeseFr2 | :many | SELECT seq_no, name_fr, reading, ingredient, producer, method, hardness, notes, pairing FROM cheese_fr ORDER BY seq_no | [`618e391`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/618e3918e8aaf5b04b0896abdfa8e2eeaaf77a59) |

## テーブル: `cloudflare_setup_pending`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0010_create_cloudflare_setup_pending.sql` | CREATE | [`fafdc18`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/fafdc181f32f2266b7ac10676f303d53eb7c5df4) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 14505 | SelectCloudflareSetupPending | :many? | SELECT id, repo_owner, repo_name, repo_full_name, is_private, created_at FROM cloudflare_setup_pending WHERE user_id = ? AND dismissed_at IS NULL ORDER BY created_at DESC LIMIT 10 | [`fafdc18`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/fafdc181f32f2266b7ac10676f303d53eb7c5df4) |
| 14745 | InsertCloudflareSetupPending | :exec | INSERT INTO cloudflare_setup_pending (user_id, repo_owner, repo_name, repo_full_name, is_private, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, repo_full_name) DO NOTHING | [`fafdc18`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/fafdc181f32f2266b7ac10676f303d53eb7c5df4) |
| 19532 | SelectCloudflareSetupPending2 | :many? | SELECT id, repo_owner, repo_name, repo_full_name, is_private, created_at FROM cloudflare_setup_pending WHERE user_id = ? AND dismissed_at IS NULL ORDER BY created_at DESC LIMIT 10 | [`fafdc18`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/fafdc181f32f2266b7ac10676f303d53eb7c5df4) |
| 19580 | UpdateCloudflareSetupPending | :exec | UPDATE cloudflare_setup_pending SET dismissed_at = ? WHERE id = ? AND user_id = ? AND dismissed_at IS NULL | (検出不可) |
| 19614 | UpdateCloudflareSetupPending2 | :exec | UPDATE cloudflare_setup_pending SET dismissed_at = ? WHERE user_id = ? AND dismissed_at IS NULL | (検出不可) |
| 19661 | InsertCloudflareSetupPending2 | :exec | INSERT INTO cloudflare_setup_pending (user_id, repo_owner, repo_name, repo_full_name, is_private, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, repo_full_name) DO NOTHING | [`fafdc18`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/fafdc181f32f2266b7ac10676f303d53eb7c5df4) |

## テーブル: `commit_agent_log`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0025_create_commit_agent_log.sql` | CREATE | [`73bdc81`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/73bdc817f997a9e99dcaa3e6e82c8d7ee52a0472) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 14984 | InsertCommitAgentLog | :exec? | INSERT INTO commit_agent_log (request_id, repo_full_name, pr_number, commit_sha, commit_message, commit_author_name, commit_author_email, detected_agent_name, detected_agent_version, detected_signal, … | (検出不可) |

## テーブル: `commit_list_cache`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0008_create_commit_list_cache.sql` | CREATE | [`5f4f54a`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5f4f54aa970df19b057be1d97a6e5669cb2cc0a1) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 15650 | SelectCommitListCache | :many? | SELECT date FROM commit_list_cache WHERE workspace_id = ? AND owner = ? AND repo = ? AND date IN (${placeholders}) | [`c6e9d21`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c6e9d2183d7bc1ea8c73592a8d1ffb9cbb1b7c0e) |
| 15835 | SelectCommitListCache2 | :many? | SELECT owner, repo, date, commits_json, commit_count FROM commit_list_cache WHERE workspace_id = ? AND commits_json LIKE ? ESCAPE '\\' ORDER BY date DESC LIMIT 100 | (検出不可) |

## テーブル: `commit_search_history`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0011_create_commit_search_history.sql` | CREATE | [`a05eaef`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a05eaef9aeff15fdf283cc37b5932f09175e8af3) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 15910 | InsertCommitSearchHistory | :exec | INSERT INTO commit_search_history (user_id, search_query, total_hits, repo_names, searched_at) VALUES (?, ?, ?, ?, ?) | [`a05eaef`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a05eaef9aeff15fdf283cc37b5932f09175e8af3) |
| 16318 | SelectCommitSearchHistory | :many? | SELECT h.id, h.search_query, h.total_hits, h.repo_names, h.searched_at, COALESCE(kl.label, 'uncategorized') AS label FROM commit_search_history h LEFT JOIN commit_search_keyword_labels kl ON kl.user_i… | [`2dc2ba8`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/2dc2ba8d564354f0dca11795715f550d7b3e5544) |
| 16364 | SelectCommitSearchHistory2 | :many? | SELECT id, search_query, total_hits, repo_names, searched_at FROM commit_search_history WHERE id = ? AND user_id = ? | [`2dc2ba8`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/2dc2ba8d564354f0dca11795715f550d7b3e5544), [`a05eaef`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a05eaef9aeff15fdf283cc37b5932f09175e8af3) |
| 16417 | SelectCommitSearchHistory3 | :many? | SELECT COUNT(*) as search_count, SUM(total_hits) as total_hits, COUNT(DISTINCT DATE(searched_at)) as search_days, MIN(searched_at) as first_searched_at, MAX(searched_at) as last_searched_at FROM commi… | (検出不可) |
| 16483 | SelectCommitSearchHistory4 | :many? | SELECT DATE(searched_at) as date, COUNT(*) as search_count, SUM(total_hits) as total_hits FROM commit_search_history WHERE user_id = ? AND search_query = ? GROUP BY DATE(searched_at) ORDER BY date ASC | (検出不可) |

## テーブル: `commit_search_hit_details`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0032_create_commit_search_hit_details.sql` | CREATE | [`29fe34d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/29fe34df507e41547fedc849061ea6de26ab1ea6) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 15937 | InsertCommitSearchHitDetails | :exec? | INSERT INTO commit_search_hit_details (search_history_id, repo_name, commit_sha, commit_message) VALUES (?, ?, ?, ?) | [`29fe34d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/29fe34df507e41547fedc849061ea6de26ab1ea6) |

## テーブル: `commit_search_keyword_labels`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0035_create_commit_search_keyword_labels.sql` | CREATE | [`d23e23c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d23e23cb48244bf16166daa0e72cd8b09b0d4694) |
| `0036_add_ai_model_to_keyword_labels.sql` | ALTER | [`25f07c2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/25f07c2871f56dd8705e3d4cbdf65de50fd8ba84) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 3220 | SelectCommitSearchKeywordLabels | :many? | SELECT DISTINCT label FROM commit_search_keyword_labels WHERE user_id = ? AND label != 'uncategorized' ORDER BY label | [`7e96e03`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7e96e0393dd562e1f1e6692f4aaf34d3256a1ad7), [`40e5d84`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/40e5d84a0a9e7247c291288f92772a33e0307cc6) |
| 3245 | UpdateCommitSearchKeywordLabels | :exec | UPDATE commit_search_keyword_labels SET label = ?, ai_model = ?, classify_status = ?, updated_at = datetime('now') WHERE user_id = ? AND search_query = ? | [`a64d107`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a64d107902970cad125f9f26bf5ce051cefd3e41), [`25f07c2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/25f07c2871f56dd8705e3d4cbdf65de50fd8ba84) |
| 3251 | UpdateCommitSearchKeywordLabels2 | :exec | UPDATE commit_search_keyword_labels SET label = ?, ai_model = ?, updated_at = datetime('now') WHERE user_id = ? AND search_query = ? | [`a64d107`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a64d107902970cad125f9f26bf5ce051cefd3e41), [`25f07c2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/25f07c2871f56dd8705e3d4cbdf65de50fd8ba84) |
| 3257 | UpdateCommitSearchKeywordLabels3 | :exec | UPDATE commit_search_keyword_labels SET label = ?, updated_at = datetime('now') WHERE user_id = ? AND search_query = ? | [`dbee658`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/dbee65897e88ab6f3b3a9ced5b0a69635bc54259), [`25f07c2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/25f07c2871f56dd8705e3d4cbdf65de50fd8ba84), [`b391f19`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b391f1945902e822b256c69056e7be5b65117cae) |
| 15965 | InsertCommitSearchKeywordLabels | :exec | INSERT OR IGNORE INTO commit_search_keyword_labels (user_id, search_query, label, created_at, updated_at) VALUES (?, ?, 'uncategorized', datetime('now'), datetime('now')) | [`6587283`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6587283175ad6f139445bf45d1e980a43ce8e387), [`8fd681c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8fd681caea028187a530b26202edc772b6a9dc7d) |
| 15977 | SelectCommitSearchKeywordLabels2 | :many? | SELECT label, classify_status FROM commit_search_keyword_labels WHERE user_id = ? AND search_query = ? | [`6587283`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6587283175ad6f139445bf45d1e980a43ce8e387), [`a64d107`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a64d107902970cad125f9f26bf5ce051cefd3e41) |
| 15986 | SelectCommitSearchKeywordLabels3 | :many? | SELECT label FROM commit_search_keyword_labels WHERE user_id = ? AND search_query = ? | [`6587283`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6587283175ad6f139445bf45d1e980a43ce8e387), [`ca43a82`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ca43a823a67a9c1372cf02275319fabd59a6e2b3) |
| 16025 | SelectCommitSearchKeywordLabels4 | :many? | SELECT label, classify_status FROM commit_search_keyword_labels WHERE user_id = ? AND search_query = ? | [`6587283`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6587283175ad6f139445bf45d1e980a43ce8e387), [`a64d107`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a64d107902970cad125f9f26bf5ce051cefd3e41) |
| 16030 | SelectCommitSearchKeywordLabels5 | :many? | SELECT label FROM commit_search_keyword_labels WHERE user_id = ? AND search_query = ? | [`6587283`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6587283175ad6f139445bf45d1e980a43ce8e387), [`ca43a82`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ca43a823a67a9c1372cf02275319fabd59a6e2b3) |
| 16044 | InsertCommitSearchKeywordLabels2 | :exec | INSERT OR IGNORE INTO commit_search_keyword_labels (user_id, search_query, label, created_at, updated_at) VALUES (?, ?, 'uncategorized', datetime('now'), datetime('now')) | [`6587283`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6587283175ad6f139445bf45d1e980a43ce8e387), [`8fd681c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8fd681caea028187a530b26202edc772b6a9dc7d) |
| 16074 | InsertCommitSearchKeywordLabels3 | :exec | INSERT INTO commit_search_keyword_labels (user_id, search_query, label, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now')) ON CONFLICT(user_id, search_query) DO UPDATE SET labe… | [`a64d107`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a64d107902970cad125f9f26bf5ce051cefd3e41), [`8fd681c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8fd681caea028187a530b26202edc772b6a9dc7d) |
| 16079 | InsertCommitSearchKeywordLabels4 | :exec | INSERT INTO commit_search_keyword_labels (user_id, search_query, label, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now')) ON CONFLICT(user_id, search_query) DO UPDATE SET labe… | [`a64d107`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a64d107902970cad125f9f26bf5ce051cefd3e41), [`8fd681c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8fd681caea028187a530b26202edc772b6a9dc7d) |
| 16541 | SelectCommitSearchKeywordLabels6 | :many? | SELECT DISTINCT label FROM commit_search_keyword_labels WHERE user_id = ? AND label IS NOT NULL | [`7e96e03`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7e96e0393dd562e1f1e6692f4aaf34d3256a1ad7), [`40e5d84`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/40e5d84a0a9e7247c291288f92772a33e0307cc6) |

## テーブル: `commit_search_repo_stats`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0011_create_commit_search_history.sql` | CREATE | [`a05eaef`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a05eaef9aeff15fdf283cc37b5932f09175e8af3) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 15919 | InsertCommitSearchRepoStats | :exec? | INSERT INTO commit_search_repo_stats (search_history_id, repo_name, hit_count, search_query, user_name) VALUES (?, ?, ?, ?, ?) | [`a05eaef`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a05eaef9aeff15fdf283cc37b5932f09175e8af3) |
| 16380 | SelectCommitSearchRepoStats | :many? | SELECT repo_name, hit_count, search_query, user_name FROM commit_search_repo_stats WHERE search_history_id = ? ORDER BY hit_count DESC | (検出不可) |
| 16434 | SelectCommitSearchRepoStats2 | :many? | SELECT s.repo_name, SUM(s.hit_count) as total_hit_count, COUNT(*) as search_count FROM commit_search_repo_stats s JOIN commit_search_history h ON s.search_history_id = h.id WHERE h.user_id = ? AND s.s… | [`29fe34d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/29fe34df507e41547fedc849061ea6de26ab1ea6) |

## テーブル: `group_oauth_apps`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0027_create_group_oauth_apps.sql` | CREATE | [`3d0e1b4`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3d0e1b4659b82419f80f5b2995a6bc8c04258888) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 18899 | SelectGroupOauthApps | :many | SELECT m.repo_name, a.app_name, a.app_note, g.name AS group_name, g.color_code FROM group_oauth_apps a JOIN repo_groups g ON g.id = a.group_id AND g.workspace_id = a.workspace_id JOIN repo_group_membe… | [`3d0e1b4`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3d0e1b4659b82419f80f5b2995a6bc8c04258888) |

## テーブル: `harness_hook_log`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0083_create_harness_hook_log.sql` | CREATE | [`0e1ffe8`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/0e1ffe86d645c7ebf911197a141544639e4ba738) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 11923 | InsertHarnessHookLog | :exec | INSERT INTO harness_hook_log (hook_event, check_name, tool_name, file_path, result, detail, session_id) VALUES (?, ?, ?, ?, ?, ?, ?) | [`cd83937`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/cd839379d0af26a0b35c665410b86474fd31d9d5) |
| 11952 | SelectHarnessHookLog | :many? | SELECT result, COUNT(*) AS cnt FROM harness_hook_log GROUP BY result | [`8375469`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/83754691f257248604c09d25d912cfe4b94dee0b) |
| 11963 | SelectHarnessHookLog2 | :many? | SELECT id, hook_event, check_name, tool_name, file_path, result, detail, session_id, created_at FROM harness_hook_log ORDER BY created_at DESC LIMIT 200 | [`8375469`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/83754691f257248604c09d25d912cfe4b94dee0b) |
| 11967 | SelectHarnessHookLog3 | :many? | SELECT id, hook_event, check_name, tool_name, file_path, result, detail, session_id, created_at FROM harness_hook_log WHERE result = ? ORDER BY created_at DESC LIMIT 200 | [`8375469`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/83754691f257248604c09d25d912cfe4b94dee0b) |

## テーブル: `heritage_ai_question_masters`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0065_create_heritage_ai_question_masters.sql` | CREATE | [`b8fa173`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b8fa173162e99383a7f4261c93c1bb94deb9dc3c) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 6060 | SelectHeritageAiQuestionMasters | :many? | SELECT id, topic FROM heritage_ai_question_masters WHERE topic IN (${topics.map(() => '?').join(', ')}) | [`4f6593f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/4f6593ff0cf9241ff13411206e4b31e62766b4d7), [`6527a7b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6527a7b012a808903e451840c59758e34f9b2baf), [`b8fa173`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b8fa173162e99383a7f4261c93c1bb94deb9dc3c) |

## テーブル: `heritage_area_boxes`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0072_create_heritage_area_boxes.sql` | CREATE | [`698abdd`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/698abddd811bf695dd58795ab48add7d3d3df8ad) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 9422 | SelectHeritageAreaBoxes | :many | SELECT area_seq AS areaSeq, box, NULL AS areaName, top_left_lat AS topLeftLat, top_left_lon AS topLeftLon, bottom_right_lat AS bottomRightLat, bottom_right_lon AS bottomRightLon, created_at AS created… | [`4814445`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/4814445875ebc8e2c282a5b2f81c1feaccf063b0) |
| 9811 | SelectHeritageAreaBoxes2 | :many? | SELECT area_seq AS areaSeq, top_left_lat AS topLeftLat, top_left_lon AS topLeftLon, bottom_right_lat AS bottomRightLat, bottom_right_lon AS bottomRightLon FROM heritage_area_boxes WHERE user_id = ? | [`9f5bbfd`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/9f5bbfd9e4cb69745425f3f79b8a5c38990ccc47) |

## テーブル: `heritage_area_items`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0073_create_heritage_area_items.sql` | CREATE | [`698abdd`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/698abddd811bf695dd58795ab48add7d3d3df8ad) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 9435 | SelectHeritageAreaItems | :many | SELECT area_seq AS areaSeq, category, item_name AS name, lat, lon FROM heritage_area_items WHERE area_seq IN (${placeholders}) ORDER BY area_seq DESC, id ASC | [`4814445`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/4814445875ebc8e2c282a5b2f81c1feaccf063b0) |
| 9793 | SelectHeritageAreaItems2 | :many? | SELECT i.item_name AS key, i.area_seq, i.category, b.box FROM heritage_area_items i JOIN heritage_area_boxes b ON b.area_seq = i.area_seq AND b.user_id = ? WHERE i.item_name = ? OR INSTR(?, i.item_nam… | (検出不可) |
| 9884 | SelectHeritageAreaItems3 | :many? | SELECT DISTINCT i.item_name AS item_name FROM heritage_area_items i JOIN heritage_area_boxes b ON b.area_seq = i.area_seq AND b.user_id = ? WHERE i.area_seq = ? ORDER BY i.item_name ASC LIMIT 500 | (検出不可) |
| 9894 | SelectHeritageAreaItems4 | :many? | SELECT i.area_seq AS area_seq FROM heritage_area_items i JOIN heritage_area_boxes b ON b.area_seq = i.area_seq AND b.user_id = ? WHERE i.item_name = ? ORDER BY i.area_seq ASC | (検出不可) |

## テーブル: `heritage_cities`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0063_create_heritage_cities.sql` | CREATE | [`355c381`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/355c381c16df1bcc1fa4c37e03021ed8ac3cb955) |
| `0064_add_country_code_to_heritage_cities.sql` | ALTER | [`fd40508`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/fd4050856ba8775da3f432872d582fce9e1e12d5) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 10505 | SelectHeritageCities | :many? | SELECT COUNT(DISTINCT city_name \|\| '\|' \|\| CAST(ROUND(city_lat,3) AS TEXT) \|\| '\|' \|\| CAST(ROUND(city_lon,3) AS TEXT)) AS total FROM heritage_cities WHERE heritage_name IN (${placeholders}) | [`c0b9bbf`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c0b9bbf5cb10f786a533558ecd51be1a744ae781) |
| 10520 | SelectHeritageCities2 | :many? | SELECT city_name, ROUND(city_lat,3) AS lat, ROUND(city_lon,3) AS lon, country_code, MAX(population) AS population, COUNT(DISTINCT heritage_name) AS near_count FROM heritage_cities WHERE heritage_name … | [`dee6c0a`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/dee6c0a682639a048c80c970a2c5958c522bdf1a) |
| 10543 | SelectHeritageCities3 | :many? | SELECT heritage_name, MIN(distance_km) AS distance_km FROM heritage_cities WHERE city_name = ? AND ROUND(city_lat,3) = ? AND ROUND(city_lon,3) = ? AND heritage_name IN (${placeholders}) GROUP BY herit… | (検出不可) |
| 10565 | SelectHeritageCities4 | :many? | SELECT heritage_name, MIN(distance_km) AS distance_km FROM heritage_cities WHERE city_name = ? AND ROUND(city_lat,3) = ? AND ROUND(city_lon,3) = ? GROUP BY heritage_name ORDER BY distance_km LIMIT 100 | (検出不可) |
| 10588 | SelectHeritageCities5 | :many? | SELECT city_name, country_code, ROUND(AVG(city_lat), 4) AS city_lat, ROUND(AVG(city_lon), 4) AS city_lon, MAX(population) AS population, COUNT(DISTINCT heritage_name) AS heritage_count, ROUND(MIN(dist… | [`750264e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/750264e21f8e37c11132cfe6c99b1c92d0cdca42) |
| 10621 | SelectHeritageCities6 | :many? | SELECT city_name, country_code, ROUND(AVG(city_lat), 4) AS city_lat, ROUND(AVG(city_lon), 4) AS city_lon, MAX(population) AS population FROM heritage_cities GROUP BY city_name, country_code | [`750264e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/750264e21f8e37c11132cfe6c99b1c92d0cdca42) |

## テーブル: `heritage_city_fetched`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0063_create_heritage_cities.sql` | CREATE | [`355c381`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/355c381c16df1bcc1fa4c37e03021ed8ac3cb955) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 10500 | SelectHeritageCityFetched | :many? | SELECT heritage_name, city_count FROM heritage_city_fetched WHERE heritage_name IN (${placeholders}) | [`c0b9bbf`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c0b9bbf5cb10f786a533558ecd51be1a744ae781) |

## テーブル: `heritage_question_view_log`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0066_create_heritage_question_view_log.sql` | CREATE | [`b8fa173`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b8fa173162e99383a7f4261c93c1bb94deb9dc3c) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 6066 | SelectHeritageQuestionViewLog | :many? | SELECT question_master_id FROM heritage_question_view_log WHERE user_id = ? AND heritage_name = ? AND deleted_at IS NULL | [`4f6593f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/4f6593ff0cf9241ff13411206e4b31e62766b4d7), [`6527a7b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6527a7b012a808903e451840c59758e34f9b2baf), [`b8fa173`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b8fa173162e99383a7f4261c93c1bb94deb9dc3c) |
| 6077 | InsertHeritageQuestionViewLog | :exec | INSERT OR IGNORE INTO heritage_question_view_log (user_id, country_name, heritage_name, question_master_id, searched_at) VALUES (?, ?, ?, ?, ?) | [`4f6593f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/4f6593ff0cf9241ff13411206e4b31e62766b4d7), [`6527a7b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6527a7b012a808903e451840c59758e34f9b2baf), [`b8fa173`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b8fa173162e99383a7f4261c93c1bb94deb9dc3c) |
| 6252 | SelectHeritageQuestionViewLog2 | :many? | SELECT l.heritage_name, m.topic FROM heritage_question_view_log l JOIN heritage_ai_question_masters m ON l.question_master_id = m.id WHERE l.user_id = ? AND l.heritage_name IN (${placeholders}) AND l.… | [`7cc61b3`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7cc61b3dccf3b5047d9da3f5a09bb8416086007b), [`6527a7b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6527a7b012a808903e451840c59758e34f9b2baf), [`995c9f4`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/995c9f4b615882d249fe2f6682154ecb28375ca4) |

## テーブル: `installation_permissions`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0004_create_installation_permissions.sql` | CREATE | [`688c22b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/688c22bb608d2014be1e1887471ef4100780677a) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 14648 | InsertInstallationPermissions | :exec | INSERT INTO installation_permissions (installation_id, repo_name, repository_selection, permissions, updated_at) VALUES (?, NULL, ?, ?, ?) ON CONFLICT(installation_id, repo_name) DO UPDATE SET reposit… | [`688c22b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/688c22bb608d2014be1e1887471ef4100780677a) |
| 14663 | InsertInstallationPermissions2 | :exec | INSERT INTO installation_permissions (installation_id, repo_name, repository_selection, permissions, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(installation_id, repo_name) DO UPDATE SET repository… | [`688c22b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/688c22bb608d2014be1e1887471ef4100780677a) |

## テーブル: `keyword_category_groups`

**対応migration**: 見つかりませんでした(動的テーブル名、またはCREATE TABLE文がmigrations/配下に存在しない可能性)。

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 1934 | CreateKeywordCategoryGroups | :exec | CREATE TABLE IF NOT EXISTS keyword_category_groups ( id TEXT PRIMARY KEY, user_id TEXT NOT NULL, group_name TEXT NOT NULL, description TEXT, categories TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAU… | (検出不可) |
| 16100 | SelectKeywordCategoryGroups | :many? | SELECT id, group_name, description, categories, is_deleted FROM keyword_category_groups WHERE user_id = ? | [`bb48730`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/bb487305675e78f827c4a82aa48ce2d4c63e3e29) |
| 16128 | SelectKeywordCategoryGroups2 | :many? | SELECT id, group_name, description, categories FROM keyword_category_groups WHERE user_id = ? AND (is_deleted = 0 OR is_deleted IS NULL) ORDER BY group_name ASC | [`bb48730`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/bb487305675e78f827c4a82aa48ce2d4c63e3e29) |
| 16150 | SelectKeywordCategoryGroups3 | :many? | SELECT id FROM keyword_category_groups WHERE user_id = ? AND group_name = ? AND (is_deleted = 0 OR is_deleted IS NULL) LIMIT 1 | [`568db4e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/568db4ef95a10fad3821348caed3310871e98093) |
| 16176 | InsertKeywordCategoryGroups | :exec | INSERT INTO keyword_category_groups (id, user_id, group_name, description, categories, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now')) | [`568db4e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/568db4ef95a10fad3821348caed3310871e98093) |
| 16217 | UpdateKeywordCategoryGroups | :exec | UPDATE keyword_category_groups SET group_name = ?, description = ?, categories = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ? AND (is_deleted = 0 OR is_deleted IS NULL) | [`bb48730`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/bb487305675e78f827c4a82aa48ce2d4c63e3e29) |
| 16237 | UpdateKeywordCategoryGroups2 | :exec | UPDATE keyword_category_groups SET is_deleted = 1, deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND user_id = ? AND (is_deleted = 0 OR is_deleted IS NULL) | [`bb48730`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/bb487305675e78f827c4a82aa48ce2d4c63e3e29) |

## テーブル: `keyword_multi_labels`

**対応migration**: 見つかりませんでした(動的テーブル名、またはCREATE TABLE文がmigrations/配下に存在しない可能性)。

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 16538 | SelectKeywordMultiLabels | :many? | SELECT categories FROM keyword_multi_labels WHERE user_id = ? AND search_query = ? | [`7e96e03`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7e96e0393dd562e1f1e6692f4aaf34d3256a1ad7) |
| 16585 | InsertKeywordMultiLabels | :exec | INSERT INTO keyword_multi_labels (user_id, search_query, categories, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now')) ON CONFLICT(user_id, search_query) DO UPDATE SET categor… | [`7e96e03`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7e96e0393dd562e1f1e6692f4aaf34d3256a1ad7) |
| 16591 | InsertKeywordMultiLabels2 | :exec | INSERT INTO keyword_multi_labels (user_id, search_query, categories, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now')) | [`7e96e03`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7e96e0393dd562e1f1e6692f4aaf34d3256a1ad7) |
| 16611 | SelectKeywordMultiLabels2 | :many? | SELECT search_query, categories FROM keyword_multi_labels WHERE user_id = ? | [`51eceea`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/51eceeaf820c62aa257b669416c811f8461ceb01) |

## テーブル: `kimi_code_generate_log`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0118_create_kimi_code_generate_log.sql` | CREATE | [`90816a2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/90816a21a0eff9b8dd97234b46b6695c9ce42bba) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 5445 | SelectKimiCodeGenerateLog | :many? | SELECT period, model, SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens, SUM(total_tokens) AS total_tokens, COUNT(*) AS request_count FROM ( SELECT strftime('${periodFormat}', cre… | (検出不可) |
| 12285 | InsertKimiCodeGenerateLog | :exec | INSERT INTO kimi_code_generate_log (user_id, model, input_tokens, output_tokens, total_tokens) VALUES (?, ?, ?, ?, ?) | [`90816a2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/90816a21a0eff9b8dd97234b46b6695c9ce42bba) |

## テーブル: `kimi_gemma_reviews`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0117_create_kimi_gemma_reviews.sql` | CREATE | [`2101493`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/210149387111bcdb6515caeeaf165072c1f610a4) |
| `0119_add_gemma_tokens_to_kimi_gemma_reviews.sql` | ALTER | [`90816a2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/90816a21a0eff9b8dd97234b46b6695c9ce42bba) |
| `0119_add_gemma_tokens_to_kimi_gemma_reviews.sql` | ALTER | [`90816a2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/90816a21a0eff9b8dd97234b46b6695c9ce42bba) |
| `0119_add_gemma_tokens_to_kimi_gemma_reviews.sql` | ALTER | [`90816a2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/90816a21a0eff9b8dd97234b46b6695c9ce42bba) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 5511 | SelectKimiGemmaReviews | :many? | SELECT id, id AS user_hash, kimi_prompt AS question, kimi_code AS answer, 'kimi-k2.7-code' AS model, gemma_model, gemma_response, created_at, 0 AS access_count, NULL AS question_hash, NULL AS input_to… | [`109010f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/109010f722d945e06c01f17abaab6eda71ae39d6) |
| 12329 | InsertKimiGemmaReviews | :exec | INSERT INTO kimi_gemma_reviews (id, user_id, kimi_prompt, kimi_code, gemma_prompt, gemma_response, gemma_model, gemma_input_tokens, gemma_output_tokens, gemma_total_tokens) VALUES (?, ?, ?, ?, ?, ?, ?… | [`2101493`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/210149387111bcdb6515caeeaf165072c1f610a4) |

## テーブル: `moondream_analyze_log`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0096_create_moondream_analyze_log.sql` | CREATE | [`26e66f4`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/26e66f4c2684ea9a5478e3c37dad3cdc71d261c5) |
| `0097_add_image_data_url_to_moondream_analyze_log.sql` | ALTER | [`09ea6db`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/09ea6db53695df4e9b373a70befe5d20b543c286) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 3040 | InsertMoondreamAnalyzeLog | :exec | INSERT INTO moondream_analyze_log (user_id, status, model, prompt_length, image_bytes, error_message, image_data_url, prompt_text, analysis_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) | [`26e66f4`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/26e66f4c2684ea9a5478e3c37dad3cdc71d261c5) |
| 11709 | SelectMoondreamAnalyzeLog | :many? | SELECT id, status, model, prompt_length, image_bytes, error_message, created_at, image_data_url, prompt_text, analysis_text FROM moondream_analyze_log WHERE user_id = ? ORDER BY created_at DESC, id DE… | [`26e66f4`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/26e66f4c2684ea9a5478e3c37dad3cdc71d261c5) |

## テーブル: `notification_settings`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0075_create_notification_settings.sql` | CREATE | [`276f13c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/276f13c6b70c160972af24c570fa028974e3bae3) |
| `0077_add_email_confirm_login_enabled.sql` | ALTER | [`50d06f1`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/50d06f10188044045a748b89a864178c2442d00c) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 17884 | InsertNotificationSettings | :exec | INSERT INTO notification_settings (id, slack_enabled, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET slack_enabled = excluded.slack_enabled, updated_at = excluded.updated_at | [`276f13c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/276f13c6b70c160972af24c570fa028974e3bae3) |
| 17925 | InsertNotificationSettings2 | :exec | INSERT INTO notification_settings (id, email_confirm_login_enabled, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET email_confirm_login_enabled = excluded.email_confirm_login_enabled, updat… | [`50d06f1`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/50d06f10188044045a748b89a864178c2442d00c) |

## テーブル: `repo_color_settings`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0013_create_repo_color_settings.sql` | CREATE | [`5c8a0c1`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5c8a0c1e0a1858464af9f4f70227edce78a46275) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 18501 | UpdateRepoColorSettings | :exec | UPDATE repo_color_settings SET ${updates.join(', ')} WHERE workspace_id = ? AND repo_name = ? | [`73fad35`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/73fad3580e6b38440bed9974b13e1d499c7b222a) |

## テーブル: `repo_group_members`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0014_create_repo_groups.sql` | CREATE | [`b5c1168`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b5c11680e8db5ac9e88816ed36978433e97d7612) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 13448 | SelectRepoGroupMembers | :many? | SELECT group_id, repo_name FROM repo_group_members WHERE workspace_id = ? AND group_id IN (${groupIds.map(() => '?').join(',')}) ORDER BY repo_name | [`eba1a5d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/eba1a5d981cafacc0240a3c3285a3dba8d87b76f), [`b5c1168`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b5c11680e8db5ac9e88816ed36978433e97d7612) |
| 18545 | SelectRepoGroupMembers2 | :many? | SELECT group_id, repo_name FROM repo_group_members WHERE workspace_id = ? AND group_id IN (${groupIds.map(() => '?').join(',')}) ORDER BY repo_name | [`eba1a5d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/eba1a5d981cafacc0240a3c3285a3dba8d87b76f), [`b5c1168`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b5c11680e8db5ac9e88816ed36978433e97d7612) |

## テーブル: `repo_groups`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0014_create_repo_groups.sql` | CREATE | [`b5c1168`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b5c11680e8db5ac9e88816ed36978433e97d7612) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 18725 | UpdateRepoGroups | :exec? | UPDATE repo_groups SET ${updates.join(', ')} WHERE workspace_id = ? AND id = ? | [`eba1a5d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/eba1a5d981cafacc0240a3c3285a3dba8d87b76f) |

## テーブル: `resend_webhook_log`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0019_create_resend_webhook_log.sql` | CREATE | [`0c307a4`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/0c307a4e3270246f690dd233523d11c9ce00595a) |
| `0023_add_webhook_secret_to_sources.sql` | ALTER | [`81085b6`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/81085b6d09034f81fda9a5e120462c78a3ee9f09) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 17167 | InsertResendWebhookLog | :exec | INSERT OR IGNORE INTO resend_webhook_log (source_id, svix_id, resend_email_id, event_type, email_from, email_to, bounce_type, error_detail, slack_result, slack_result_at, proxy_result, proxy_result_at… | [`81085b6`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/81085b6d09034f81fda9a5e120462c78a3ee9f09) |

## テーブル: `resend_webhook_sources`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0017_create_resend_webhook_sources.sql` | CREATE | [`0c307a4`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/0c307a4e3270246f690dd233523d11c9ce00595a) |
| `0023_add_webhook_secret_to_sources.sql` | ALTER | [`81085b6`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/81085b6d09034f81fda9a5e120462c78a3ee9f09) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 17213 | SelectResendWebhookSources | :many? | SELECT id, label, webhook_secret FROM resend_webhook_sources WHERE id = ? | [`81085b6`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/81085b6d09034f81fda9a5e120462c78a3ee9f09) |

## テーブル: `slack_installations`

**対応migration**: 見つかりませんでした(動的テーブル名、またはCREATE TABLE文がmigrations/配下に存在しない可能性)。

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 4658 | InsertSlackInstallations | :exec | INSERT INTO slack_installations (team_id, team_name, bot_user_id, access_token, scope, authed_user_id, installed_by_user, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now')) ON CONFLICT(team_id)… | [`5b0ccbe`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5b0ccbe0db6336f880d400f28b6250cfd06c0f4d) |

## テーブル: `table_column_keys`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0026_create_table_catalog.sql` | CREATE | [`77fecd3`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/77fecd3de83eba80dc51b535a159c09ae4dd8627) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 3342 | InsertTableColumnKeys | :exec | INSERT OR IGNORE INTO table_column_keys (table_name, column_name, key_type) VALUES (?, ?, 'pk') | [`889e583`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/889e583c3cd3b67d3d4ef5fb1106d8eb0dfc994e) |

## テーブル: `ts_commit_function_map`

**対応migration**: 見つかりませんでした(動的テーブル名、またはCREATE TABLE文がmigrations/配下に存在しない可能性)。

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 11566 | SelectTsCommitFunctionMap | :many? | SELECT m.file_path, COUNT(DISTINCT m.commit_hash) AS history_count FROM ts_commit_function_map m JOIN ts_commit_log cl ON cl.repo_id = m.repo_id AND cl.commit_hash = m.commit_hash WHERE m.repo_id = 1 … | [`af80f6e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/af80f6e47fc860f79bfc415f47dc22aaf3b3a6a6) |
| 11616 | SelectTsCommitFunctionMap2 | :many? | SELECT cl.commit_hash, cl.commit_at, cl.subject, cl.author_email, cl.branch_name, SUM(m.lines_added) AS lines_added, SUM(m.lines_deleted) AS lines_deleted, COUNT(DISTINCT m.function_name) AS functions… | [`d688633`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d6886339487964cb55589fc6f979353d8e4b746d) |
| 13975 | SelectTsCommitFunctionMap3 | :many? | SELECT m.commit_hash, cl.commit_at, cl.subject, cl.author_email, cl.branch_name, cl.files_changed, m.change_type, m.lines_added, m.lines_deleted FROM ts_commit_function_map m JOIN ts_commit_log cl ON … | (検出不可) |

## テーブル: `ts_function_activity_log`

**対応migration**: 見つかりませんでした(動的テーブル名、またはCREATE TABLE文がmigrations/配下に存在しない可能性)。

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 13889 | SelectTsFunctionActivityLog | :many? | SELECT m.commit_at, m.commit_hash, m.commit_subject AS subject, m.file_path, m.function_name, COALESCE(f.purpose, '') AS purpose, m.change_type, m.lines_added, m.lines_deleted, i.impact_type, i.severi… | (検出不可) |

## テーブル: `ts_function_catalog`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0053_alter_ts_function_catalog_add_callers.sql` | ALTER | [`a50c5aa`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a50c5aa66dd2a76963cc47e8dc795022c6dad2f6) |
| `0053_alter_ts_function_catalog_add_callers.sql` | ALTER | [`a50c5aa`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a50c5aa66dd2a76963cc47e8dc795022c6dad2f6) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 13908 | SelectTsFunctionCatalog | :many? | SELECT DISTINCT file_path FROM ts_function_catalog WHERE repo_id = ? ORDER BY file_path | [`869b5d0`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/869b5d09337e995d9ded147a4f65b190a0398174), [`43aaa32`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/43aaa322ffd0ff951358219743f733f839020785) |
| 13911 | SelectTsFunctionCatalog2 | :many? | SELECT file_path, function_name, COALESCE(purpose,'') AS purpose FROM ts_function_catalog WHERE repo_id = ? ORDER BY file_path, function_name | [`3a2dd7b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3a2dd7b0142d405218059a6c1ca7ebe1d8e3346c) |
| 13914 | SelectTsFunctionCatalog3 | :many? | SELECT f.file_path, f.function_name, COALESCE(f.purpose,'') AS purpose, f.is_exported, f.is_async, f.start_line, f.end_line, COUNT(c.id) AS caller_count FROM ts_function_catalog f LEFT JOIN ts_functio… | [`869b5d0`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/869b5d09337e995d9ded147a4f65b190a0398174) |
| 13924 | SelectTsFunctionCatalog4 | :many? | SELECT DISTINCT file_path FROM ts_function_catalog WHERE repo_id = ? AND start_line IS NOT NULL ORDER BY file_path | [`869b5d0`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/869b5d09337e995d9ded147a4f65b190a0398174), [`43aaa32`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/43aaa322ffd0ff951358219743f733f839020785) |
| 14050 | SelectTsFunctionCatalog5 | :many? | SELECT COALESCE(purpose,'') AS purpose, source_snippet, start_line, end_line FROM ts_function_catalog WHERE repo_id = ? AND file_path = ? AND function_name = ? LIMIT 1 | [`a1b6f74`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a1b6f742ee7cd8223cd5f75e23b8715f45a13570) |
| 14059 | SelectTsFunctionCatalog6 | :many? | SELECT COALESCE(purpose,'') AS purpose, start_line, end_line FROM ts_function_catalog WHERE repo_id = ? AND file_path = ? AND function_name = ? LIMIT 1 | [`a1b6f74`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a1b6f742ee7cd8223cd5f75e23b8715f45a13570) |

## テーブル: `ts_repository`

**対応migration**: 見つかりませんでした(動的テーブル名、またはCREATE TABLE文がmigrations/配下に存在しない可能性)。

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 13876 | SelectTsRepository | :many? | SELECT id, full_name FROM ts_repository ORDER BY id | [`be8651b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/be8651b90ff1b422bdd9cb9e6d72bba480e8ad1d) |
| 14035 | SelectTsRepository2 | :many? | SELECT full_name FROM ts_repository WHERE id = ? | [`3a2dd7b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3a2dd7b0142d405218059a6c1ca7ebe1d8e3346c) |

## テーブル: `user_sessions`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0001_create_user_sessions.sql` | CREATE | [`ea91d8f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ea91d8f8a752a1162292ec2d33a0fe9a5ec3bd20) |
| `0002_add_display_name.sql` | ALTER | [`ea91d8f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ea91d8f8a752a1162292ec2d33a0fe9a5ec3bd20) |
| `0003_add_github_access_token.sql` | ALTER | [`c2fe831`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c2fe831944c71a6fc207cd2bf1055c2341372cb8) |
| `0007_create_teams_and_workspaces.sql` | ALTER | [`24be2e8`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/24be2e8b1e9e693c8883d25a597b218a25878203) |
| `0054_alter_user_sessions_add_last_activity_at.sql` | ALTER | [`71d5749`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/71d574978eb7e33311d9d640a046d3fc4300faf5) |
| `0059_add_revoked_at_to_user_sessions.sql` | ALTER | [`8d79530`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8d79530e6c594689cb914929f22b5dd74cc9af5c) |
| `0060_add_idle_timeout_to_user_sessions.sql` | ALTER | [`b7cac76`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b7cac7693e46460afeba2f570ec302425a513915) |
| `0114_add_heritage_tour_country_filter_to_user_sessions.sql` | ALTER | [`8e0aa2d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8e0aa2d20baf83819053fec5ce7f8bf4e0ca838a) |
| `0123_add_last_login_method_to_user_sessions.sql` | ALTER | [`05a8aa4`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/05a8aa44e23c4c4c42bea6a9e4a9255ddb42572c) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 3605 | InsertUserSessions | :exec | INSERT INTO user_sessions (user_id, timezone, session_duration, last_login_at, current_login_at, updated_at, github_access_token, github_granted_scopes) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (us… | [`c98a14d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c98a14df61eff50bd81ae80cc4842309f20801f4), [`ea91d8f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ea91d8f8a752a1162292ec2d33a0fe9a5ec3bd20) |
| 3918 | UpdateUserSessions | :exec | UPDATE user_sessions SET ${field} = ?, updated_at = ? WHERE user_id = ? | (検出不可) |
| 19421 | InsertUserSessions2 | :exec | INSERT INTO user_sessions (user_id, timezone, session_duration, current_login_at, updated_at) VALUES (?, 'JST', '1h', ?, ?) ON CONFLICT(user_id) DO UPDATE SET updated_at = ? | [`c98a14d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c98a14df61eff50bd81ae80cc4842309f20801f4), [`ea91d8f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ea91d8f8a752a1162292ec2d33a0fe9a5ec3bd20) |

## テーブル: `wasm_module_startup_config`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0104_create_wasm_module_startup_config.sql` | CREATE | [`c6ce50e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c6ce50ee22ab378df72f4dad462f24c38b76208d) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 10813 | InsertWasmModuleStartupConfig | :exec | INSERT INTO wasm_module_startup_config (module_id, enabled, updated_at, updated_by) VALUES (?, ?, datetime('now'), ?) ON CONFLICT(module_id) DO UPDATE SET enabled = excluded.enabled, updated_at = excl… | [`c6ce50e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c6ce50ee22ab378df72f4dad462f24c38b76208d) |

## テーブル: `wine_details`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0125_create_wine_tables.sql` | CREATE | [`e033ce0`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e033ce0521f3daf1b0cdf3af801abb7a186f466c) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 11088 | InsertWineDetails | :exec | INSERT INTO wine_details (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT(wine_id) DO UPDATE SET ${updateSet} | [`e033ce0`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e033ce0521f3daf1b0cdf3af801abb7a186f466c) |

## テーブル: `wine_embeddings`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0125_create_wine_tables.sql` | CREATE | [`e033ce0`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e033ce0521f3daf1b0cdf3af801abb7a186f466c) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 10850 | SelectWineEmbeddings | :many? | SELECT vector, model FROM wine_embeddings WHERE wine_name = ? | [`e033ce0`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e033ce0521f3daf1b0cdf3af801abb7a186f466c) |
| 10857 | InsertWineEmbeddings | :exec | INSERT INTO wine_embeddings (wine_name, model, dim, vector, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(wine_name) DO UPDATE SET model = excluded.model, dim = excluded.dim, vector = … | [`e033ce0`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e033ce0521f3daf1b0cdf3af801abb7a186f466c) |
| 11064 | SelectWineEmbeddings2 | :many? | SELECT wine_name FROM wine_embeddings | [`3a5fd22`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3a5fd2216d5af706ccd3ca44b42c3f3395030ae1), [`e033ce0`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e033ce0521f3daf1b0cdf3af801abb7a186f466c) |
| 11079 | SelectWineEmbeddings3 | :many? | SELECT id FROM wine_embeddings WHERE wine_name = ? | [`e86eead`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e86eead12794d5bd05bf832edbb3d1a67e637a41), [`e033ce0`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e033ce0521f3daf1b0cdf3af801abb7a186f466c) |
| 11159 | SelectWineEmbeddings4 | :many? | SELECT e.id AS id, e.wine_name AS wine_name, e.model AS model, e.dim AS dim, ${cols}, ${metaCols} FROM wine_embeddings e LEFT JOIN wine_details d ON d.wine_id = e.id LEFT JOIN wine_metadata m ON m.id … | [`090ce2d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/090ce2dc97a2c3f2e5267215da1ccfbfc6fc2ed6) |
| 11262 | SelectWineEmbeddings5 | :many? | SELECT e.id AS id, e.wine_name AS wine_name, e.vector AS vector, m.pairing_foods AS pairing_foods, ${cols} FROM wine_embeddings e LEFT JOIN wine_details d ON d.wine_id = e.id LEFT JOIN wine_metadata m… | [`e033ce0`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e033ce0521f3daf1b0cdf3af801abb7a186f466c) |
| 11332 | SelectWineEmbeddings6 | :many? | SELECT wine_name FROM wine_embeddings | [`3a5fd22`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3a5fd2216d5af706ccd3ca44b42c3f3395030ae1), [`e033ce0`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e033ce0521f3daf1b0cdf3af801abb7a186f466c) |
| 11396 | SelectWineEmbeddings7 | :many? | SELECT id FROM wine_embeddings WHERE wine_name = ? | [`e86eead`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e86eead12794d5bd05bf832edbb3d1a67e637a41), [`e033ce0`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e033ce0521f3daf1b0cdf3af801abb7a186f466c) |

## テーブル: `wine_metadata`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0126_create_wine_metadata.sql` | CREATE | [`1078fe2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/1078fe2a8cea8f3b96225a3f376f071ba52bd90b) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 11212 | SelectWineMetadata | :many? | SELECT m.id AS id, m.wine_name AS wine_name, m.pairing_foods AS pairing_foods, m.country AS country, m.wine_type AS wine_type, m.characteristics AS characteristics FROM wine_metadata m WHERE ${conditi… | [`fef468e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/fef468eebbc4f6d134326760b989bdcb3eceb90a) |
| 11405 | InsertWineMetadata | :exec | INSERT INTO wine_metadata (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updateSet} | [`e86eead`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e86eead12794d5bd05bf832edbb3d1a67e637a41) |

## テーブル: `workflow_registry`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0109_create_workflow_registry.sql` | CREATE | [`7bf6bce`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7bf6bcea41b8b400ff6eb9eb9f5caef8420e6343) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 11531 | SelectWorkflowRegistry | :many? | SELECT w.workflow_no AS workflow_no, w.title AS title FROM workflow_registry w LEFT JOIN workflow_steps s ON s.workflow_no = w.workflow_no WHERE s.workflow_no IS NULL ORDER BY w.workflow_no ASC | (検出不可) |

## テーブル: `workflow_steps`

**対応migration**:

| ファイル | 種別 | 初回コミット |
|---|---|---|
| `0109_create_workflow_registry.sql` | CREATE | [`7bf6bce`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7bf6bcea41b8b400ff6eb9eb9f5caef8420e6343) |
| `0120_add_indent_level_to_workflow_steps.sql` | ALTER | [`9767193`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/97671936fc076d4b84ddcd1dd853ca7078ac2f82) |

**クエリ一覧**:

| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |
|---|---|---|---|---|
| 11510 | SelectWorkflowSteps | :many? | SELECT s.api_method AS api_method, s.api_path AS api_path, s.workflow_no AS workflow_no, w.title AS title FROM workflow_steps s JOIN workflow_registry w ON w.workflow_no = s.workflow_no WHERE s.api_me… | [`9ca624b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/9ca624b29c1217a52c28a1228d5c00a493e7a1ea) |

## 関連コミット

**対象**: 本レポートに対応する履歴 — コミット作成後にGitHub上のコミットリンクを追記する。

本変更のコミットで初回作成する。
