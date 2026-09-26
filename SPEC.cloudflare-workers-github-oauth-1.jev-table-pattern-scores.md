# SPEC.cloudflare-workers-github-oauth-1.jev-table-pattern-scores — 全テーブルに対するクエリパターン判断材料のJevスコアリング

## 1. 判断材料A〜Lを全テーブルに問い合わせる仕組みを追加

**対象**: `src/utils/queryPatternAnalysis.ts`(共有ロジック)、`/query-pattern-analysis`ページ・`POST /api/query-pattern-analysis/seed`(本体Worker)、`scripts/evaluate-table-pattern-scores.ts`(CLI版)、新規D1テーブル`jev_table_pattern_scores` — 姉妹Worker(`rust-worker-sqlx-d1`)の`/sqlx-d1-examples`ページのクエリパターン対照表を検討する中で、「WHERE/IN/LIKE/HAVING等の各SQLパターンをそのテーブルに適用すべきか」を判断する基準を12個の判断材料(A〜L)として整理した(チャットでの合意事項)。この判断材料を全137テーブルに対してJev API(TypeSafe AI System One Model)へ問い合わせ、スコアをD1へ保存する仕組みを追加した。当初CLIスクリプトのみで実装していたが、ローカルで`JEV_API_KEY`を用意する必要があり手間だったため、本体Workerに専用ページを追加し、Workerが既に持つ`JEV_API_KEY`シークレットでその場から投入できるようにした。

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

これらは「HAVINGは『集計が効果的か』×『絞り込み対象が多いか』の2軸のANDが揃って初めて採用理由になる」という考え方を、テーブル横断で再利用できる12個のatomicな判断材料に分解したもの。同じ判断材料が複数パターンの判断根拠として重なってよい(例: Jが範囲検索・IN句・LIKE・HAVING・IS NOT NULLすべての軸2として効く)という前提で設計している。**現時点では類似性判定や既存登録との比較は行わない(今後の課題)。**

## 実装

### `jev_table_pattern_scores`テーブル(新規、migration `'0164'`)

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

`judgment_code`はA〜Lの1文字。`(table_name, judgment_code)`をUNIQUEにし、再実行時は`ON CONFLICT`でスコアを上書きする(同じテーブルを2回スコアリングしても行が増殖しない)。既存の`jev_labels`/`jev_evaluations`(AIチャット回答評価用)とは独立したテーブルにした(目的が異なるため)。`STATUS_MIGRATION_SQL`に`'0163'`ではなく`'0164'`として登録した。`'0163'`はPR #2085(webhook_logのdelivery_id・duration_ms追加)が既に使用中(未マージ)のため、番号衝突を避けた。**このリポジトリの`STATUS_MIGRATION_SQL`はコード登録のみでは自動適用されない。実際にD1へ反映するには上記SQLをD1コンソールまたは`wrangler d1 execute`で実行すること。**

### `src/utils/queryPatternAnalysis.ts`(共有ロジック、Worker・CLIの両方から使う)

- `extractTableSchemasFromSql(sqlSource)`: SQLテキスト(生ソースでも`STATUS_MIGRATION_SQL`の全値を連結したものでも可)から`CREATE TABLE IF NOT EXISTS`定義をすべて抽出する純粋関数。同名テーブルが複数箇所で再宣言されている場合(実例: `api_endpoint_stats`・`keyword_category_groups`・`ts_function_callers`)は最後の定義(最新スキーマ)だけを残す。ALTER TABLE・CREATE INDEXのみのSQLは対象外。
- `buildStateForTable(schema, description?)`: テーブル名+(あれば)用途の説明文+DDLをJevへ渡す評価対象テキストに整形する純粋関数。説明文はDDLより前に置く。
- `JUDGMENT_LABELS`: 判断材料A〜Lの12問。`jev_labels`テーブルとは無関係の、この分析専用のローカル定義(D1への事前登録不要)。
- `toTableScoreRows(tableName, jevResult)` / `toInsertSql(rows)`: Jevの生の結果(labelIdキー)をA〜Lコードへ変換し、SQLへ整形する純粋関数。
- `evaluateTable({apiKey, schema, description, fetchImpl})`: 1テーブル分の12問をJev APIへ問い合わせる(`callJevApi`をそのまま再利用)。

Node組み込みモジュール(`fs`等)を一切使わないため、Workerランタイムから安全にimportできる。

### `/query-pattern-analysis`ページ(GET、`authMiddleware`必須)

- `STATUS_MIGRATION_SQL`の全値を連結した文字列から`extractTableSchemasFromSql`でテーブル一覧を、`STATUS_TABLE_DEFINITIONS`(構造化済みの配列、既にWorkerのメモリ上にある)から説明文マップを作る。**CLI版と違い正規表現でのdescription抽出は不要**(構造化データをそのまま`Map`化するだけ)。
- `jev_table_pattern_scores`をSELECTしてテーブル×判断材料のスコアマトリクスを表示。**このテーブルが未作成(migration未適用)でも`isMissingTableError`で捕捉し、空データ表示にフォールバックする**(既存の1テーブル単位の障害分離方針を踏襲)。
- 各行に「シード投入」(未投入)/「再投入」(投入済み)ボタンを表示し、クリックで`POST /api/query-pattern-analysis/seed`を呼び、成功したセルをその場で更新する。

### `POST /api/query-pattern-analysis/seed`(`authMiddleware`必須)

- body: `{ tableName: string }`
- `JEV_API_KEY`未設定は503、`tableName`未指定は400、未知のテーブル名は404、Jev API呼び出し失敗は502、D1書き込み失敗(テーブル未作成含む)は500。
- 成功時は`evaluateTable()`→12件のスコアを`jev_table_pattern_scores`へ`db.batch()`でUPSERTし、`{ ok: true, scores: [{code, score}, ...] }`を返す。

### `scripts/evaluate-table-pattern-scores.ts`(CLI版、代替手段として維持)

デプロイ前の事前見積り・動作確認、または大量バッチをまとめてSQLファイルに残したい場合の代替手段として残している。`src/utils/queryPatternAnalysis.ts`の共有ロジックをそのままimportし、CLI固有の部分(`fs`でのファイル読み込み、`STATUS_TABLE_DEFINITIONS`配列を正規表現で読み取る`extractTableDescriptions`、`--limit`/`--only`オプション、標準出力へのSQL出力)だけを持つ。

```
JEV_API_KEY=xxx npx tsx scripts/evaluate-table-pattern-scores.ts --limit=3 > table-pattern-scores-sample.sql
```

## テスト・検証

- `npx vitest run src/utils/queryPatternAnalysis.test.ts`: 11件全件成功(共有ロジックの純粋関数群、`evaluateTable`のfetch実装注入含む)
- `npx vitest run scripts/evaluate-table-pattern-scores.test.ts`: 3件全件成功(CLI固有の`extractTableDescriptions`のみ、他は共有ロジック側でカバー済みのため削減)
- `npx vitest run src/query-pattern-analysis-route.test.ts`: 12件全件成功(ルートブロックのテキスト抽出による認証・エラーハンドリング・SQL文の検証、既存の`webhook-cf-wh1-route.test.ts`と同じ手法)
- `npx vitest run src/jev-evaluation-core.test.ts`: 既存23件、退行なし
- `npx tsc --noEmit`: `src/index.ts`・本PRで追加したファイルに起因するエラー0件(既存の無関係な失敗のみ残存)
- `getQueryPatternAnalysisPage()`をNodeから直接呼び出し、HTML生成が例外を投げないことをスモークテスト済み(タイトル・凡例・シード/再投入ボタンの出し分けを確認)
- 実際のJev API呼び出し・D1書き込み・本番ページの表示確認は、このセッションからデプロイ・実行できないため未検証。ユーザー側でのデプロイ後確認が必要。

## 注意事項

- **このセッションからはJev APIの呼び出し・D1への書き込み・Workerのデプロイを一切実行していない。** コード(ページ・エンドポイント・スクリプト・テスト)の実装のみ。
- Jev APIの`score`型の戻り値は0/1の厳密なブール値とは限らない(連続値の可能性がある、`src/utils/jevEvaluation.ts`の`extractScoreValue`参照)。`jev_table_pattern_scores.score`は`REAL`型にしており、ページ側では`score >= 0.5`を「はい」寄りの色分けに使っているだけで、厳密な二値判定はしていない。
- 判断材料A〜Lの文言はテーブル単位の一般的な判断であり、個々のカラムまでは踏み込んでいない(例: Aは「連続値型のカラムを含むか」であり、どのカラムかまでは問わない)。カラム単位の判定が必要になった場合は、質問文をカラムごとに分ける設計変更が必要。
- **類似性判定・既存登録との比較は今回のスコープ外。** ユーザーから「今回の件が終わったら類似性判定や既存登録との比較もできるようにしたい」という要望が出ており、次のステップとして想定されている(未着手)。
- `/query-pattern-analysis`ページは`/status`ページの`STATUS_TABLE_DEFINITIONS`・`TABLE_COLUMN_KEYS`・`TABLE_GROUP_MAP`・`COLUMN_FK_TARGETS`(CLAUDE.mdルール23)には統合していない。目的が異なる独立ページとして実装したためで、`/status`のPK/FK/UK/IDXバッジ表示等は対象外。
