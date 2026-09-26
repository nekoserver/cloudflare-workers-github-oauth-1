# SPEC.cloudflare-workers-github-oauth-1.jev-table-pattern-scores — 全テーブルに対するクエリパターン判断材料のJevスコアリング

## 1. 判断材料A〜Lを全テーブルに問い合わせるバッチスクリプトを追加

**対象**: `scripts/evaluate-table-pattern-scores.ts`、新規D1テーブル`jev_table_pattern_scores` — 姉妹Worker(`rust-worker-sqlx-d1`)の`/sqlx-d1-examples`ページのクエリパターン対照表を検討する中で、「WHERE/IN/LIKE/HAVING等の各SQLパターンをそのテーブルに適用すべきか」を判断する基準を12個の判断材料(A〜L)として整理した(チャットでの合意事項)。この判断材料を、全マイグレーション(`ALTER TABLE`・`CREATE INDEX`のみのものは対象外)から抽出した全テーブルに対してJev API(TypeSafe AI System One Model)へ問い合わせ、スコアをD1へ保存する仕組みを追加した。

## 判断材料A〜L

| 記号 | 判断材料 |
|---|---|
| A | 連続値(距離・日時・金額・件数等)型のカラムを含むか |
| B | 自由記述で完全一致では検索が成立しないカラムを含むか |
| C | UNIQUE制約またはPRIMARY KEYのカラムを含むか |
| D | NULL許容カラムを含むか |
| E | NULL許容カラムに実際にNULLが入りうる設計か |
| F | IN句が有効に働きそうな離散値カラムを含むか |
| G | IN句にすると候補値が無制限に近くなるカラムを含むか |
| H | GROUP BYによる集計が意味を持つ性質のテーブルか |
| I | GROUP BYすると複数グループが生じる見込みか |
| J | 典型的な絞り込みが0件にも全件にもならない見込みか |
| K | 1件だけを確実に特定する用途が主か |
| L | 複数件を一覧として取得する用途が主か |

これらは「HAVINGは『集計が効果的か』×『絞り込み対象が多いか』の2軸のANDが揃って初めて採用理由になる」という考え方を、テーブル横断で再利用できる12個のatomicな判断材料に分解したもの。同じ判断材料が複数パターンの判断根拠として重なってよい(例: Jが範囲検索・IN句・LIKE・HAVING・IS NOT NULLすべての軸2として効く)という前提で設計している。

## 実装

### `jev_table_pattern_scores`テーブル(新規、要マイグレーション登録)

```sql
CREATE TABLE IF NOT EXISTS jev_table_pattern_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  judgment_code TEXT NOT NULL,
  score REAL NOT NULL,
  evaluated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_jev_table_pattern_scores_unique ON jev_table_pattern_scores(table_name, judgment_code);
```

`judgment_code`はA〜Lの1文字。`(table_name, judgment_code)`をUNIQUEにし、再実行時は`ON CONFLICT`でスコアを上書きする(同じテーブルを2回スコアリングしても行が増殖しない)。既存の`jev_labels`/`jev_evaluations`(AIチャット回答評価用)とは独立したテーブルにした。目的が異なる(テーブル設計の分析 vs AI回答の品質評価)ため、スキーマを混在させるとどちらの用途にとっても不自然なカラムが増えると判断した。

**このリポジトリの`STATUS_MIGRATION_SQL`への登録・マイグレーション番号の確定は未実施。** 次に空いている番号は本ブランチの分岐元時点で`'0163'`(ただしPR #2085が同じ`'0163'`を既に使用中、未マージ)。マージ時期によって衝突しうるため、マージ直前に空いている番号へ採番し直すこと。

### `scripts/evaluate-table-pattern-scores.ts`

- `extractTableSchemas(source)`: `src/index.ts`から`CREATE TABLE IF NOT EXISTS`定義をすべて抽出する純粋関数。同名テーブルが複数マイグレーションで再宣言されている場合(実例: `api_endpoint_stats`・`keyword_category_groups`・`ts_function_callers`)は最後の定義(最新スキーマ)だけを残す。
- `extractTableDescriptions(source)`: `src/index.ts`の`STATUS_TABLE_DEFINITIONS`配列から、テーブル名→人間が書いた説明文(`description`)のマップを抽出する純粋関数。DDL(カラム名・型)だけでは「このテーブルがどんなデータモデルを構成するために用意されたか」という目的が読み取れないため、判断材料の評価に文脈を補う目的で追加した。137テーブル中136テーブルがこの配列に登録済み(未登録は1件、DDLのみで評価する)。
- `buildStateForTable(schema, description?)`: テーブル名+(あれば)用途の説明文+DDLをJevへ渡す評価対象テキストに整形する純粋関数。説明文はDDLより前に置く。
- `JUDGMENT_LABELS`: 判断材料A〜Lの12問。`jev_labels`テーブルとは無関係の、このスクリプト専用のローカル定義(D1への事前登録不要)。
- `toInsertSql(rows)`: スコアを`jev_table_pattern_scores`へのUPSERT SQLへ変換する純粋関数。
- `main()`: 全テーブル(または`--limit`/`--only`で絞った一部)に対して`callJevApi`(`src/utils/jevEvaluation.ts`の既存実装、エンドポイント・レスポンス解釈を完全に再利用)を呼び出し、成功した分だけSQLを標準出力へ書く。1テーブルの失敗が他のテーブルの処理を止めない(既存の1セクション単位の障害分離方針と同じ)。

### 実行方法

```
JEV_API_KEY=xxx npx tsx scripts/evaluate-table-pattern-scores.ts --limit=3 > table-pattern-scores-sample.sql
```

まず`--limit`で少数のテーブルに対して動作確認し、出力SQLの内容を確認してから全件(137テーブル×12問=1,644回のJev API呼び出し)を実行すること。Jev APIは有償のため、コストを見積もってから全件実行の可否を判断すること。

出力されたSQLはD1コンソールまたは`wrangler d1 execute`で実行する。このSQLは自動アップロード対象外(CLAUDE.md「自動アップロード対象の区別」参照)であり、リポジトリにもartifactsディレクトリにも置かない。

## テスト・検証

- `npx vitest run scripts/evaluate-table-pattern-scores.test.ts`: 15件全件成功
  - `CREATE TABLE`抽出(単一・複数・ALTER/INDEXのみの除外・空文字列・同名テーブルの重複排除)
  - `STATUS_TABLE_DEFINITIONS`からの説明文抽出(複数件・未登録・エスケープされたクォート)
  - `buildStateForTable`のテキスト整形(説明文あり/なしの両方、説明文がDDLより前に来ること)
  - `JUDGMENT_LABELS`の件数・重複無し・criteria形式(Jev APIのscore型要件)
  - `toInsertSql`のSQL生成(クォートエスケープ・複数行)
- `npx vitest run src/jev-evaluation-core.test.ts`: 既存23件、退行なし
- `npx tsc --noEmit`: エラー0件
- 実際のJev API呼び出し・D1書き込みはこのセッションから実行不可(`JEV_API_KEY`・D1アクセス手段が無い)のため未検証。ユーザー側での実行が必要。

## 注意事項

- **このセッションからはJev APIの呼び出し・D1への書き込みを一切実行していない。** コード(スクリプト・テスト)の実装のみで、実際のスコアリングはユーザー側で`JEV_API_KEY`を用意して実行する必要がある。
- Jev APIの`score`型の戻り値は0/1の厳密なブール値とは限らない(連続値の可能性がある、`src/utils/jevEvaluation.ts`の`extractScoreValue`参照)。`jev_table_pattern_scores.score`は`REAL`型にしており、消費側(将来のダッシュボード等)で閾値判定(例: `score >= 0.5`)をどう扱うかは別途決める必要がある。
- 判断材料A〜Lの文言はテーブル単位の一般的な判断であり、個々のカラムまでは踏み込んでいない(例: Aは「連続値型のカラムを含むか」であり、どのカラムかまでは問わない)。カラム単位の判定が必要になった場合は、質問文をカラムごとに分ける設計変更が必要。
