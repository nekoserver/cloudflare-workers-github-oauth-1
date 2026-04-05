# NOTICE — cloudflare-workers-github-oauth-1 (2026-04-05)

## 1. 設計課題: `table_column_keys` に FK先カラム名が保存されていない

### 現状

`table_column_keys` テーブルのスキーマ:

```sql
CREATE TABLE IF NOT EXISTS table_column_keys (
  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL,
  key_type TEXT NOT NULL,
  fk_target_table TEXT,
  PRIMARY KEY (table_name, column_name),
  FOREIGN KEY (table_name) REFERENCES table_catalog(table_name)
);
```

`fk_target_table`（FK先テーブル名）は保存されるが、**FK先カラム名**は保存されない。

### 問題

FK先カラムが `id` でないリレーションが存在する:

| テーブル.カラム | FK先テーブル | FK先カラム（実際） | 現状の扱い |
|---|---|---|---|
| `ai_summary_reviews.summary_request_id` | `ai_summary_log` | `request_id` | ハードコードで補完 |
| `table_column_keys.table_name` | `table_catalog` | `table_name` | ハードコードで補完 |

このため、以下3箇所に同じ情報が分散している:

| 場所 | ファイル | 内容 |
|---|---|---|
| バックエンド定数 | `src/index.ts` `COLUMN_FK_TARGETS` | FK先テーブル名のみ（カラム名なし） |
| DB | `table_column_keys.fk_target_table` | FK先テーブル名のみ（カラム名なし） |
| フロントエンド | `src/views/status.ts` `fkTargetColMap` | FK先カラム名のハードコード補完 |

ER図で「どのカラム同士がつながっているか」を正確に表示するために、フロントエンドに静的マップ (`fkTargetColMap`) を置いて補完している状態。

### 本来あるべき設計

`table_column_keys` テーブルに `fk_target_column` カラムを追加する:

```sql
ALTER TABLE table_column_keys ADD COLUMN fk_target_column TEXT;
```

これにより:

- DB が FK先カラム名の Single Source of Truth になる
- バックエンド `COLUMN_FK_TARGETS` を `{ table, column }` 形式に拡張できる
- フロントエンドの `fkTargetColMap` ハードコードが不要になる
- ER図の `buildGroupErData` が `fkTarget` として `{ table, column }` を返せる

### 修正が必要なファイル（将来対応時）

| ファイル | 修正内容 |
|---|---|
| `migrations/` | `ALTER TABLE table_column_keys ADD COLUMN fk_target_column TEXT` マイグレーション追加 |
| `src/index.ts` | `COLUMN_FK_TARGETS` を `Record<string, Record<string, { table: string; column: string }>>` に変更 |
| `src/index.ts` | `buildGroupErData` の `fkTarget` を `{ table, column }` に拡張 |
| `src/index.ts` | `table_column_keys` のシード/同期ロジックに `fk_target_column` を含める |
| `src/index.ts` | ER図用データ取得クエリに `fk_target_column` を追加 |
| `src/views/status.ts` | `fkTargetColMap` ハードコードを削除し、サーバーから受け取ったデータを使用 |
| `src/views/status.ts` | リレーション構築時に `column.fkTarget.column` でFK先カラム名を取得 |

### 対応優先度

低〜中。現状2件のみ `id` 以外のFK先カラムがあり、静的マップで動作上の問題はない。ただしテーブル追加のたびにフロントエンド・バックエンド両方の定数を手動更新する必要があり、見落としリスクがある。テーブル数が増えた段階で対応することを推奨。

---

## 2. ER図の PK+FK バッジ表示バグと修正内容

### 発見経緯

`repo_group_members.group_id` のキータイプ `pk+fk` が、ER図モーダル内でPK(赤)+FK(オレンジ)の2つのバッジではなく、色なしの「PK+FK」テキストとして表示されていた。

### 原因

`keyType` が `'pk+fk'` のとき、`keys` 配列に分割せず `['pk+fk']` として1要素で格納していた。CSSクラス `uml-col-key` には `.pk`, `.fk`, `.uk`, `.idx` の定義しかなく、`.pk+fk` は未定義のため色が付かなかった。Canvas版の `keyColorMap` も同様に `'pk+fk'` キーがなくフォールバック色になっていた。

### 修正

`col.keyType` に `+` が含まれる場合、`split('+')` で分割して個別のキーとして `keys` 配列に格納するよう変更。これにより PK バッジ(赤)と FK バッジ(オレンジ)が個別に描画される。

### 教訓

複合キータイプ（`pk+fk` のように `+` 区切りで複数の役割を持つカラム）を扱う場合、表示層では必ず分割して個別のバッジとして処理すること。今後 `pk+uk` 等の新しい複合キータイプが追加された場合も、同じ分割ロジックで自動的に対応できる。
