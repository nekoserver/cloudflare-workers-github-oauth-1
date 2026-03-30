# TEST_LESSONS — 2026-03-30

## 1. ai_summary_reviews モーダルで全フィールドが空になる

**対象**: `/api/status/tables/:table/rows` エンドポイント、クライアント側 `renderStatusTablePreview` — PRAGMAとJOINクエリのカラム不整合によりモーダルの表示が空になった問題。

### 何が起きたか

`/status` ページの ai_summary_reviews モーダルで全フィールドが空だった。D1にはデータが44件存在し、JOINクエリを直接実行すれば正常にデータが返る状態だった。

### 根本原因

API側で `PRAGMA table_info(ai_summary_reviews)` の結果を `columns` として返していたが、PRAGMAはテーブル定義のカラムのみ返す（SQLiteの仕様）。JOINで追加された `repo_full_name`, `pr_number` は `columns` に含まれない。クライアント側は `columns.map(col => row[col])` でセルを描画するため、`columns` にないカラムは表示されない。

### どうテストしていれば防げたか

**テスト対象**: APIレスポンスの `columns` と `rows` の整合性

```
テスト: rowsに含まれる全キーがcolumnsにも含まれること
入力: PRAGMAカラム=['id','rating','comment'], rows=[{id:1, rating:'good', comment:'text', repo_full_name:'owner/repo'}]
期待: columns に 'repo_full_name' が含まれる
```

このテストはコードを書く前に設計できた。「PRAGMAで取得したカラム一覧」と「JOINクエリが返す行データのキー一覧」が一致するかどうかは、SQLiteの仕様を知っていれば自明に疑うべきポイント。

### パターンとアンチパターン

**アンチパターン: メタデータとデータの取得元が異なるのに整合性を検証しない**

```
columns = PRAGMA table_info(テーブル名)   ← メタデータ（テーブル定義）
rows    = SELECT r.*, l.x FROM ... JOIN   ← データ（JOIN結果）
```

メタデータの取得元（PRAGMA）とデータの取得元（JOINクエリ）が異なるとき、両者の整合性は保証されない。これを検証せずにクライアントに渡すと、クライアントは存在しないキーでアクセスして空になる。

**パターン: データ自身からメタデータを導出する**

```
columns = mergeColumnsFromRows(pragmaColumns, rows)
```

行データのキーからカラム一覧を補完する。メタデータとデータの取得元が一致するため、不整合が起きない。

**アンチパターン: モックが本番の不整合を隠す**

```
// 悪い例: モックがPRAGMAとrows両方に同じカラムを入れるので不整合が検出されない
mock.pragma = ['id', 'name', 'extra_col']
mock.rows = [{ id: 1, name: 'test', extra_col: 'value' }]
```

テストのモックを「テストが通るように」作ると、本番で起きる不整合（PRAGMAにJOINカラムがない）を再現できない。

**パターン: モックは本番の制約を再現する**

```
// 良い例: PRAGMAはテーブル定義カラムのみ、rowsはJOIN結果を再現
mock.pragma = ['id', 'name']                        // テーブル定義のみ
mock.rows = [{ id: 1, name: 'test', joined_col: 'x' }]  // JOIN由来カラムあり
```

**アンチパターン: ロジックをルートハンドラに直書きしてテストする**

ルートハンドラ内にロジックを置いたままテストを書くと、HTTPリクエスト・認証・DB接続すべてをモックする必要がある。モックが増えるほどテストの信頼性が下がる。

**パターン: 純粋関数に切り出してからテストする**

```typescript
// 純粋関数 — 入力と出力だけでテスト可能
export function mergeColumnsFromRows(pragmaColumns: string[], rows: Record<string, unknown>[]): string[]
```

モック不要。入出力だけで検証できるため、テストが本番の挙動を正確に反映する。

### 故障想定（事前に列挙すべきだったもの）

| 故障シナリオ | 検出テスト | 対処 |
|---|---|---|
| PRAGMAがJOINカラムを返さない | rowsの全キーがcolumnsに含まれるか検証 | mergeColumnsFromRowsで補完 |
| PRAGMAがテーブル未作成で空を返す | columnsが空のとき行データからカラム生成されるか | mergeColumnsFromRowsが行キーから生成 |
| 行ごとにキー集合が異なる | 2行目にのみ存在するキーの検証 | 現状は1行目のキーのみ採用（既知の制限） |
| D1が空オブジェクトの行を返す | rows=[{}]のときcolumnsが空のまま返るか | 空テーブルとして表示 |

---

## 運用ルール

- 日付はセッションの日付を使う
- 同日に複数の知見があれば追記する
- 各項目に「どうテストしていれば防げたか」「パターン/アンチパターン」「故障想定」を必ず含める
- 過去のファイルは削除せず蓄積する
