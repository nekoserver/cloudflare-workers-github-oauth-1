# SPEC: NEWTABLE_CHECK（新テーブル自動検出〜後続処理フロー）

このドキュメントは、`/status` における**新テーブル（定義外テーブル）自動検出**から、表示・警告・関連API連携までの処理フローを整理したものです。

---

## 1. 設定値の入力経路（Settings画面）

### 1-1. ユーザー操作
`/settings` 画面では次の3トグルをユーザーが切り替えます。

- テーブル自動検出（`statusTableAutoDetect`）
- 自動検出テーブルを表示（`statusShowAutoDetectedTables`）
- unknownマイグレーションの未分類警告を無視（`statusIgnoreUnknownUnclassifiedWarning`）

JSハンドラは `fetch` で設定APIへPOSTし、失敗時はUIをロールバックします。

### 1-2. 設定API
各APIは `mode`（`on`/`off`）を検証し、Cookieへ保存します（1年）。

- `POST /api/settings/status-table-autodetect`
  - Cookie: `user_status_table_autodetect`
- `POST /api/settings/status-show-autodetected-tables`
  - Cookie: `user_status_show_autodetected_tables`
- `POST /api/settings/status-ignore-unknown-unclassified-warning`
  - Cookie: `user_status_ignore_unknown_unclassified_warning`

---

## 2. /status 読み込み時の自動検出フロー

### 2-1. Cookieを解釈
`/status` 取得時、Cookieから以下を読み込みます。

- `statusTableAutoDetect`: `off` 以外は `on`
- `statusShowAutoDetectedTables`: `on` のときのみ表示
- `statusIgnoreUnknownUnclassifiedWarning`: `off` 以外は `on`

### 2-2. 既知テーブルを基準に初期化
`getEffectiveStatusTableDefinitions()` のテーブルを**既知テーブル**として走査し、各テーブルの存在確認（`COUNT(*)`）結果を `data.tables` へ投入します。

### 2-3. 新テーブル（定義外）を探索
`statusTableAutoDetect === 'on'` のときのみ、`sqlite_master` から実テーブル一覧を取得し、以下を除外します。

- 既知テーブル
- `d1_migrations`
- 空名

除外後のテーブルは「自動検出テーブル」として `data.tables` に追加されます。

- `description: '自動検出テーブル'`
- `syncPolicy: 'manual'`
- `isAutoDetected: true`
- `migration`: `inferMigrationFromAppliedNames(...)` で推定、失敗時 `unknown`
- `rowCount`: `COUNT(*)` 取得、失敗時 `null`

### 2-4. 表示フィルタ
`statusShowAutoDetectedTables !== 'on'` の場合、`isAutoDetected` 行は最終表示から除外します。

### 2-5. commit_agent_log 補完
表示差分・競合があっても `commit_agent_log` が消えないよう、最終段で存在チェックし、欠けていれば `0025` 定義として補完追加します。

---

## 3. 未分類警告（フロント）

`/status` のクライアントJSでは、テーブル行（`#statusTablesTable tbody tr`）を走査し、次を「未分類」とみなします。

- `data-group-id === '0'`

ただし `statusIgnoreUnknownUnclassifiedWarning === 'on'` のときは、

- `data-migration === 'unknown'`

を警告対象から除外します。対象が残る場合はトースト通知を表示します（最大3件＋件数サフィックス）。

---

## 4. 関連する後続処理

### 4-1. テーブル詳細API
一覧に出たテーブルは、既存の詳細APIで行プレビュー・マイグレーション情報に進めます。

- `/api/status/tables/:table/rows`
- `/api/status/tables/:table/migration-details`
- `/api/status/migrations/:migration/sql`

### 4-2. グループER図API
`/api/status/tables/:table/group-er` は `TABLE_GROUP_MAP` をベースに `table_catalog` を上書きするため、
`table_catalog` が部分投入でもフォールバックが維持されます。
さらに `commit_agent_log` は `ai` グループへ補完されるため、ER図解決の欠落を回避します。

---

## 5. シーケンス（要約）

1. ユーザーが `/settings` で3トグルを変更
2. 設定APIがCookieへ保存
3. `/status` 読み込み時にCookieを解釈
4. 既知テーブルを列挙
5. （ON時）`sqlite_master` から未知テーブルを自動検出
6. `migration` 推定・件数取得して `isAutoDetected` 行として追加
7. 表示設定に応じて自動検出行を表示/非表示
8. 未分類（group_id=0）を検出し、必要に応じトースト警告
9. 行クリック等で rows / migration / group-er API へ遷移

---

## 6. 運用メモ

- 自動検出は「DB実体に対する安全な観測」です。`COUNT(*)` 失敗時は `rowCount=null` で継続し、ページ全体は落とさない設計です。
- unknownマイグレーションの警告は、運用ポリシーに合わせてユーザーが抑制できます。
- `table_catalog` の整備度合いに依存しないフォールバック設計（`TABLE_GROUP_MAP` ベース）により、ER図導線の安定性を優先します。
