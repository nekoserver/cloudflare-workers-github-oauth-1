# SPEC — テーブルカタログ・カラムキー定義のDB化

## 対象

**対象**: 新規テーブル `table_catalog` / `table_column_keys`、`/api/status/tables/:table/rows` エンドポイント、`/status` ページのグループ別フィルタリング — 22テーブルのグループ分け・PK/FK定義をD1に格納し、任意のテーブルを起点にそのグループ全体を俯瞰できるようにする。

## 背景

現状22テーブルがあり、大まかに5グループ（Auth/Session、Commit/Cache、AI Summary、Email/Resend、Config/Settings）に分類できる。特定テーブルの構造やリレーションを再評価するとき、そのテーブルが属するグループ全体を俯瞰しないと文脈が把握しづらい。ER図のHTMLにハードコードされたグループ定義では、プログラムから引くのが困難。

この設計はWebアプリのテーブル管理に限らず、部署単位の人事データなど任意のドメインで「あるエンティティが属するグループ全体を即座に引ける」という汎用パターンとして適用できる。

## テーブル設計

### table_catalog

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| table_name | TEXT | PRIMARY KEY | テーブル名 |
| group_name | TEXT | NOT NULL | グループ名（auth, commit, ai, email, config） |
| description | TEXT | NOT NULL | テーブルの説明 |
| migration | TEXT | NOT NULL | マイグレーション番号 |
| sync_policy | TEXT | NOT NULL DEFAULT 'auto' | auto / manual / readonly |
| display_order | INTEGER | NOT NULL DEFAULT 0 | /status ページでの表示順 |

### table_column_keys

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| table_name | TEXT | NOT NULL, FK → table_catalog | テーブル名 |
| column_name | TEXT | NOT NULL | カラム名 |
| key_type | TEXT | NOT NULL | pk / fk / pk+fk |
| fk_target_table | TEXT | NULL | FK先テーブル名（FKの場合のみ） |
| PRIMARY KEY | | (table_name, column_name) | 複合PK |

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

## 初期データ

ER図 (`er-diagram.html`) の SCHEMA/GROUPS 定義、および `TABLE_COLUMN_KEYS` (`src/index.ts`) のハードコード定数から生成する。

### グループマッピング

| group_name | テーブル |
|---|---|
| auth | user_sessions, teams, workspaces, team_members |
| commit | commit_calendar_cache, commit_list_cache, cache_stats, commit_search_history, commit_search_repo_stats, cloudflare_setup_pending |
| ai | ai_summary_log, ai_summary_reviews |
| email | resend_webhook_sources, resend_webhook_log, email_send_log, email_suppression_list, email_mfa_challenges, email_audit_anomalies |
| config | installation_permissions, repo_color_settings, repo_groups, repo_group_members |

## コードへの影響

1. マイグレーションSQL（0023）を追加
2. `STATUS_TABLE_DEFINITIONS` はDB読み出しに段階的に移行（フォールバックとして定数を残す）
3. `TABLE_COLUMN_KEYS` はDB読み出しに段階的に移行（同上）
4. `/status` ページにグループ別フィルタリングUIを追加（将来）
5. ER図の GROUPS 定義との同期を保証するテスト追加

## 注意事項

- `table_catalog` と `table_column_keys` 自身も `table_catalog` に登録する（自己参照）
- グループ横断FKが存在する場合（例: email_suppression_list → resend_webhook_log）、グループフィルタリング時にFK先テーブルも表示対象に含めるかはUI設計で決定
