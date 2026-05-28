# SPEC.cloudflare-workers-github-oauth-1.ADDTABLE.md

## 新テーブル追加の完全手順

**対象**: D1 データベース `workers-github-oauth-1` に新しいテーブルを追加し、`/status` ページでのデータ表示・ER図・グループ表示・データプレビューがすべて正常動作するまでの全工程。

このドキュメントは `repo_commit_index` テーブル（マイグレーション `0034`、PR #312/#313）の追加作業で判明した登録漏れを教訓に策定した。

---

## 前提

| 項目 | 値 |
|---|---|
| D1 DB 名 | `workers-github-oauth-1` |
| D1 UUID | `abbe590b-f7ff-4b98-b61c-17c8cb18c8cf` |
| マイグレーションディレクトリ | `migrations/` |
| コード登録先 | `src/index.ts` |

---

## Step 1: マイグレーション SQL ファイルを作成する

`migrations/XXXX_create_<table_name>.sql` を新規作成する。`XXXX` は既存の最大番号の次の番号。

```sql
CREATE TABLE IF NOT EXISTS <table_name> (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ...
);
CREATE INDEX IF NOT EXISTS idx_<table_name>_<col> ON <table_name> (<col>);
```

**ルール**:
- SQL ファイルに `--` コメントを書かない（CLAUDE.md ルール 6）
- `CREATE TABLE IF NOT EXISTS` を使う（冪等性の確保）
- インデックスも `IF NOT EXISTS` 付きで作成する

---

## Step 2: D1 にマイグレーションを適用する

D1 MCP ツール `d1_database_query` を使って SQL を実行する。

```sql
CREATE TABLE IF NOT EXISTS <table_name> ( ... );
CREATE INDEX IF NOT EXISTS ...;
```

デプロイ環境では `wrangler d1 execute workers-github-oauth-1 --file=migrations/XXXX_...sql --remote` でも適用できる。

---

## Step 3: シードデータを投入する（必要な場合）

シードデータがある場合は `INSERT OR IGNORE` で投入する。

```sql
INSERT OR IGNORE INTO <table_name> (...) VALUES (...);
```

50件を超える場合は50件以下のバッチに分割して実行する。
投入後、件数を確認する。

```sql
SELECT COUNT(*) AS total FROM <table_name>;
```

---

## Step 4: `src/index.ts` の 7 箇所に登録する

**この Step が最も重要。** 登録漏れがあると `/status` での表示・ER図・データプレビューが部分的または完全に機能しない。

### 4-1. `STATUS_TABLE_DEFINITIONS`（line 60 付近）

テーブル一覧に表示するための定義を追加する。

```typescript
{ name: '<table_name>', migration: 'XXXX', description: '<説明>', syncPolicy: 'manual' },
```

**登録漏れの症状**: `/status` にテーブル自体が表示されない（自動検出 OFF 時）。

---

### 4-2. `TABLE_COLUMN_KEYS`（line 681 付近）

各カラムの PK/FK/UK/IDX バッジ定義を追加する。

```typescript
<table_name>: { id: 'pk', <col>: 'fk', <col>: 'idx' },
```

| バッジ値 | 意味 |
|---|---|
| `'pk'` | PRIMARY KEY |
| `'fk'` | FOREIGN KEY |
| `'pk+fk'` | PK かつ FK |
| `'uk'` | UNIQUE |
| `'idx'` | INDEX |

**登録漏れの症状**: テーブルヘッダーに PK/FK/IDX バッジが表示されない（CLAUDE.md ルール 17）。

---

### 4-3. `TABLE_GROUP_MAP`（line 753 付近）

テーブルが所属するグループを指定する。

```typescript
<table_name>: 'commit',  // 'auth' | 'commit' | 'ai' | 'email' | 'config'
```

| グループ | 対象テーブル |
|---|---|
| `auth` | 認証・セッション・チーム・ワークスペース |
| `commit` | コミット・キャッシュ・検索履歴 |
| `ai` | AI 要約・エージェントログ |
| `email` | メール送信・Webhook |
| `config` | 設定・権限・メタデータ |

**登録漏れの症状**: `/status` でグループ列が「未分類」になり、ER図の凡例フィルタが機能しない。

---

### 4-4. `STATUS_MIGRATION_SQL`（line 100 付近）

マイグレーション番号をキーに、マイグレーション SQL を登録する。

```typescript
'XXXX': `CREATE TABLE IF NOT EXISTS <table_name> (
  ...
);
CREATE INDEX IF NOT EXISTS ...;`,
```

**登録漏れの症状**: `/status` のマイグレーション詳細パネルで SQL が表示されない。

---

### 4-5. `COLUMN_FK_TARGETS`（line 857 付近）

論理 FK の参照先テーブルを登録する。DB 制約がなくても論理的に FK として扱うカラムを登録する。

```typescript
<table_name>: { <fk_col>: '<referenced_table>' },
```

**特に重要な共有ドメインカラム**:

| カラム名 | 通常の参照先 |
|---|---|
| `user_id` | `user_sessions` |
| `workspace_id` | `workspaces` |
| `repo_name` | `installation_permissions` |
| `request_id` | `ai_summary_log` |
| `source_id` | `resend_webhook_sources` |
| `group_id` | `repo_groups` |

**登録漏れの症状**: `er-diagram-consistency.test.ts` が失敗し、ER 図の関係線が欠落する。

---

### 4-6. `getStatusTablePreviewQuery` 関数（line 1126 付近）

テーブルヘッダータップ時のデータプレビュー SQL を登録する。

```typescript
case '<table_name>':
  return {
    sql: `SELECT * FROM ${tableName} ORDER BY <col> DESC LIMIT ${STATUS_TABLE_PREVIEW_LIMIT}`,
    params: [],
  };
```

ログインユーザー・ワークスペースでスコープすべきテーブルは `userId`、`workspaceId` を `params` に渡す。

**登録漏れの症状**: テーブルヘッダータップ時に「表示できる保存データがありません」と表示される（行数は正常表示）。

---

### 4-7. `getStatusTableQueryExample` 関数（line 1256 付近）

マイグレーション詳細パネルに表示するクエリ例を登録する。

```typescript
case '<table_name>':
  return {
    sql: `SELECT * FROM <table_name>
ORDER BY <col> DESC
LIMIT 20;`,
    params: [],
    note: '<このテーブルのクエリ意図を1文で>',
  };
```

**登録漏れの症状**: マイグレーション詳細パネルの「クエリ例」欄が空欄になる（致命的ではないが情報が欠落）。

---

## Step 5: テストを実行して登録漏れを検知する

```bash
npm test
```

**重点確認テスト**: `src/er-diagram-consistency.test.ts`

- `repo_name` の論理FK漏れ → `COLUMN_FK_TARGETS` 未登録
- `user_id` の論理FK漏れ → 同上
- domain カラムの missing > 0 → FK 登録漏れがある

テストが通らない場合は Step 4 の対応する箇所を追加して再実行する。

---

## Step 6: コミット・プッシュ・PR 作成

```bash
git add migrations/XXXX_... src/index.ts
git commit -m "マイグレーションXXXX: <table_name> テーブルを追加"
git push -u origin <branch>
```

PR 本文の「デプロイ後の確認項目」に以下を含める:

- [ ] `/status` でテーブルが指定グループに表示される
- [ ] テーブルヘッダータップでデータが正常に読み出せる
- [ ] ER 図にエンティティが表示される
- [ ] マイグレーション `XXXX` の SQL 表示が正常

---

## Step 7: PR マージ後に `repo_commit_index` を更新する

PR マージ後、`SPEC.cloudflare-workers-github-oauth-1.COMMITDB.md` の手順に従い、`repo_commit_index` テーブルへ新規コミットを追記する（CLAUDE.md ルール 24）。

---

## 登録チェックリスト（コピー用）

```
テーブル名: _______________
マイグレーション番号: _______________

□ Step 1: migrations/XXXX_create_<table>.sql を作成
□ Step 2: D1 に CREATE TABLE を適用
□ Step 3: シードデータ投入（必要な場合）
□ Step 4-1: STATUS_TABLE_DEFINITIONS に追加
□ Step 4-2: TABLE_COLUMN_KEYS に追加（PK/FK/IDX 定義）
□ Step 4-3: TABLE_GROUP_MAP にグループ割り当て
□ Step 4-4: STATUS_MIGRATION_SQL に CREATE TABLE SQL を追加
□ Step 4-5: COLUMN_FK_TARGETS に論理FK を追加
□ Step 4-6: getStatusTablePreviewQuery に case を追加
□ Step 4-7: getStatusTableQueryExample に case を追加
□ Step 5: npm test 全通過
□ Step 6: コミット・プッシュ・PR 作成
□ Step 7: マージ後に repo_commit_index を更新
```

---

## 症状と原因の対応表

| 症状 | 原因（未登録の箇所） |
|---|---|
| テーブルが `/status` に表示されない | `STATUS_TABLE_DEFINITIONS` |
| グループが「未分類」になる | `TABLE_GROUP_MAP` |
| ER図にエンティティが出ない | `TABLE_GROUP_MAP`（未分類テーブルは自動検出でのみ出る） |
| ER図の関係線が欠落する / テスト失敗 | `COLUMN_FK_TARGETS` |
| ヘッダータップで「保存データなし」 | `getStatusTablePreviewQuery` |
| マイグレーション SQL が表示されない | `STATUS_MIGRATION_SQL` |
| PK/FK/IDX バッジが表示されない | `TABLE_COLUMN_KEYS` |

---

## 関連ファイル

| ファイル | 説明 |
|---|---|
| `SPEC.cloudflare-workers-github-oauth-1.COMMITDB.md` | PR マージ後の `repo_commit_index` 追記手順 |
| `SPEC.cloudflare-workers-github-oauth-1.NEWTABLE_CHECK.md` | `/status` の自動検出フロー（観測・表示ロジック） |
| `CLAUDE.md` ルール 17 | `TABLE_COLUMN_KEYS` 登録義務 |
| `CLAUDE.md` ルール 23 | `/status` 3状態表示（OK/NG/未作成） |
| `CLAUDE.md` ルール 24 | PR マージ後の `repo_commit_index` 更新義務 |
