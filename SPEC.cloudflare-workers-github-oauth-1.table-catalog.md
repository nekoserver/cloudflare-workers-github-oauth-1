# SPEC — テーブルカタログ・カラムキー定義・権限制御のDB化

## 対象

**対象**: 新規テーブル `table_catalog` / `table_column_keys` / `table_group_permissions`、`/api/status/tables/:table/rows` エンドポイント、`/status` ページのグループ別フィルタリング — 24テーブルのグループ分け・PK/FK定義・ロール別権限をD1に格納し、任意のテーブルを起点にそのグループ全体を俯瞰でき、かつロールに応じた参照・更新権限を制御できるようにする。

## 背景

現状24テーブルがあり、大まかに5グループ（Auth/Session、Commit/Cache、AI Summary、Email/Resend、Config/Settings）に分類できる。特定テーブルの構造やリレーションを再評価するとき、そのテーブルが属するグループ全体を俯瞰しないと文脈が把握しづらい。ER図のHTMLにハードコードされたグループ定義では、プログラムから引くのが困難。

加えて、ロール別にテーブルグループへのアクセス権限を制御する仕組みがないため、全ユーザーが全テーブルを閲覧できる状態にある。部署単位の人事データなど他ドメインへの適用も見据えると、ロール×グループ×操作権限の制御は必須。

この設計はWebアプリのテーブル管理に限らず、部署単位の人事データなど任意のドメインで「あるエンティティが属するグループ全体を即座に引ける」「ロールに応じてアクセスを制御する」という汎用パターンとして適用できる。

## テーブル設計

### table_catalog（マイグレーション 0024）

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| table_name | TEXT | PRIMARY KEY | テーブル名 |
| group_name | TEXT | NOT NULL | グループ名（auth, commit, ai, email, config） |
| description | TEXT | NOT NULL | テーブルの説明 |
| migration | TEXT | NOT NULL | マイグレーション番号 |
| sync_policy | TEXT | NOT NULL DEFAULT 'auto' | auto / manual / readonly |
| display_order | INTEGER | NOT NULL DEFAULT 0 | /status ページでの表示順 |

### table_column_keys（マイグレーション 0024）

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| table_name | TEXT | NOT NULL, FK → table_catalog | テーブル名 |
| column_name | TEXT | NOT NULL | カラム名 |
| key_type | TEXT | NOT NULL | pk / fk / pk+fk |
| fk_target_table | TEXT | NULL | FK先テーブル名（FKの場合のみ） |
| PRIMARY KEY | | (table_name, column_name) | 複合PK |

### table_group_permissions（マイグレーション 0025 — 将来）

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| role | TEXT | NOT NULL | ロール名（admin, member, guest 等） |
| group_name | TEXT | NOT NULL | グループ名（table_catalogのgroup_nameと対応） |
| permission | TEXT | NOT NULL DEFAULT 'read' | none / read / write / admin |
| PRIMARY KEY | | (role, group_name) | 複合PK |

**permission の定義**:

| 値 | 意味 |
|---|---|
| none | 一切アクセス不可（モーダルにも表示しない） |
| read | 参照のみ（モーダルで閲覧可、書き込み不可） |
| write | 参照＋書き込み（データの追加・更新が可能） |
| admin | 全操作可（テーブル定義の変更、データ削除含む） |

## 想定クエリ

### 特定テーブルと同グループの全テーブルを引く

```sql
SELECT tc2.*
FROM table_catalog tc1
JOIN table_catalog tc2 ON tc1.group_name = tc2.group_name
WHERE tc1.table_name = 'ai_summary_reviews'
ORDER BY tc2.display_order;
```

### 特定テーブルのFK先テーブルを含むグループ横断の関連テーブル

```sql
SELECT DISTINCT tc.*
FROM table_column_keys ck
JOIN table_catalog tc ON tc.table_name = ck.fk_target_table
WHERE ck.table_name = 'ai_summary_reviews';
```

### あるグループの全テーブルとそのPK/FK構造を一覧

```sql
SELECT tc.table_name, tc.description, ck.column_name, ck.key_type, ck.fk_target_table
FROM table_catalog tc
LEFT JOIN table_column_keys ck ON tc.table_name = ck.table_name
WHERE tc.group_name = 'email'
ORDER BY tc.display_order, ck.column_name;
```

### あるロールが参照可能なテーブル一覧

```sql
SELECT tc.*
FROM table_catalog tc
JOIN table_group_permissions gp ON tc.group_name = gp.group_name
WHERE gp.role = 'member' AND gp.permission != 'none'
ORDER BY tc.display_order;
```

## 初期データ

ER図 (`er-diagram.html`) の SCHEMA/GROUPS 定義、および `TABLE_COLUMN_KEYS` (`src/index.ts`) のハードコード定数から生成する。

### グループマッピング

| group_name | テーブル |
|---|---|
| auth | user_sessions, teams, workspaces, team_members |
| commit | commit_calendar_cache, commit_list_cache, cache_stats, commit_search_history, commit_search_repo_stats, cloudflare_setup_pending |
| ai | ai_summary_log, ai_summary_reviews |
| email | resend_webhook_sources, resend_webhook_log, email_send_log, email_suppression_list, email_mfa_challenges, email_audit_anomalies |
| config | installation_permissions, repo_color_settings, repo_groups, repo_group_members, table_catalog, table_column_keys, table_group_permissions |

## マイグレーション実行手順

### 実行順序（厳守）

1. **0024: テーブル作成**（CREATE TABLE）を先に実行
2. **初期データ投入**（INSERT INTO）をその後に実行

table_column_keysはtable_catalogへのFKを持つため、table_catalogに先にデータが入っていなければINSERTが失敗する。必ずCREATE TABLE → table_catalog INSERT → table_column_keys INSERT の順で実行すること。

### 実行方法

```
wrangler d1 execute workers-github-oauth-1 --remote --command "SQLをここに貼る"
```

複数のSQLを一度に実行する場合は `.sql` ファイルに書き出して `--file` オプションを使う:

```
wrangler d1 execute workers-github-oauth-1 --remote --file migrations/0024_table_catalog.sql
```

### 注意事項

- マイグレーションSQLはこのリポジトリのコード内（`STATUS_MIGRATION_SQL['0024']`）に定義されているが、**D1への適用はユーザーのローカル環境から `wrangler d1 execute` で手動実行する**。Claude Code環境には `CLOUDFLARE_API_TOKEN` がないためデプロイ・マイグレーション実行は不可
- INSERTの初期データはチャットで提示済み。SPECファイル内のSQLとしては記載しない（CLAUDE.mdルール: `[vars]`に秘密情報を書かないのと同様、大量のINSERTは実行時にチャットからコピーする運用）
- `table_catalog` と `table_column_keys` 自身も `table_catalog` に登録する（自己参照）
- `table_group_permissions` はマイグレーション0025として将来追加。0024のtable_catalogが運用に乗ってから段階的に導入する

## コードへの影響

1. マイグレーションSQL（0024）を追加済み
2. `STATUS_TABLE_DEFINITIONS` はDB読み出しに段階的に移行（フォールバックとして定数を残す）
3. `TABLE_COLUMN_KEYS` はDB読み出しに段階的に移行（同上）
4. `/status` ページにグループ別フィルタリングUIを追加（将来）
5. ER図の GROUPS 定義との同期を保証するテスト追加
6. `table_group_permissions` 導入時に `/api/status/tables/:table/rows` にロール別アクセス制御を追加

## 関連コミット

| コミット | 内容 |
|---|---|
| [`6920e85`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6920e85) | table_catalog / table_column_keys テーブル追加（マイグレーション0024） |

## 注意事項

- `table_catalog` と `table_column_keys` 自身も `table_catalog` に登録する（自己参照）
- グループ横断FKが存在する場合（例: email_suppression_list → resend_webhook_log）、グループフィルタリング時にFK先テーブルも表示対象に含めるかはUI設計で決定
- `table_group_permissions` はUIレベルのアクセス制御であり、D1レベルのRBACではない。Worker側のミドルウェアで制御する形になる
- permission='none' のグループはモーダルの表示対象から除外するだけでなく、APIレスポンスからも除外すること（クライアント側のみの制御では不十分）
