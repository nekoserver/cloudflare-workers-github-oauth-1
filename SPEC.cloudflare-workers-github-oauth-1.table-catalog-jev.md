# SPEC — テーブルカタログ・カラムキー定義(Jev評価系)

## 対象

**対象**: `jev_label_groups` / `jev_labels` / `jev_evaluations` /
`jev_country_keyword_labels` / `jev_country_keyword_evaluations` /
`jev_keyword_evaluation_locks` の6テーブル(migration 0144/0145/0148) —
`SPEC.cloudflare-workers-github-oauth-1.table-catalog.md`(auth/commit/ai/email/config
の5グループを対象にした一般設計)のJev評価機能版として、実際に稼働している
Jev(TypeSafe AI System One Model)評価系テーブルのグループ・PK/FK・関連
エンドポイントを1つにまとめたもの。`table_catalog`/`table_column_keys`が
将来DB化する設計だった内容を、現状は`src/index.ts`の定数
(`STATUS_TABLE_DEFINITIONS`/`TABLE_COLUMN_KEYS`/`TABLE_GROUP_MAP`/
`COLUMN_FK_TARGETS`)から実データとして書き出している。

## 背景

Jev評価系は「AI回答そのものの品質評価」(`jev_labels`系、20問固定)と
「AI分類したキーワードがカタカナの国名だった場合の国名判定」
(`jev_country_keyword_labels`系、旅程チェックリスト由来の質問群)という、
目的の異なる2つの評価パイプラインが同居しており、テーブル名も似ているため
混同しやすい(例: `jev_evaluations`と`jev_country_keyword_evaluations`は
主キーの構成要素が違う。前者は`share_id`+`model`単位、後者は`keyword`文字列
単位)。本ドキュメントは元の`table-catalog.md`と同じ「グループ全体を1枚で
俯瞰する」目的を、この2パイプラインに限定して適用する。

`table_catalog`/`table_column_keys`テーブル自体は本番投入されておらず、
`TABLE_GROUP_MAP`上ではJev系6テーブルはすべて`group_name='ai'`に属する
(専用の`jev`グループは存在しない)。

## テーブル設計

### jev_label_groups(migration 0144)

**対象**: `jev_labels`の表示グループ(事実の正確さ/論理・整合性/伝わりやすさ/
応答姿勢・手続きの4分類)のマスター。`/jev-label-stats`ページで使う。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 行ID |
| name | TEXT | NOT NULL, UNIQUE(`idx_jev_label_groups_name`) | グループ表示名 |
| created_at | TEXT | NOT NULL DEFAULT datetime('now') | 作成日時 |

### jev_labels(migration 0144)

**対象**: Jevで回答の品質を評価するための質問(ラベル)のマスター。
**追記専用**(既存行は編集しない)で、ラベルを追加しても過去の評価データと
矛盾しない設計。`target_type`(answer/source_question)によらず常に同じ
20件の質問セットを使う(`SPEC.cloudflare-workers-github-oauth-1.dynamicneko-aichat-flow.md`
とは別系統。`/jev-label-stats`のパターン1)。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 質問ID |
| question_type | TEXT | NOT NULL | 現状すべて`'score'` |
| question_text | TEXT | NOT NULL | 質問文(例: 「事実性」「根拠」「出典品質」等) |
| options_json | TEXT | | 2択の選択肢(否定側/肯定側)をJSON配列で格納 |
| jev_group_id | INTEGER | NOT NULL, FK→jev_label_groups | 表示グループ |
| created_at | TEXT | NOT NULL DEFAULT datetime('now') | 作成日時 |

初期データは20件(各グループに5件ずつ)。カラム`key_type`は
`TABLE_COLUMN_KEYS`上`{ id: 'pk', jev_group_id: 'fk' }`。

### jev_evaluations(migration 0144)

**対象**: `ai_chat_shares`の回答(または`target_type='source_question'`で
元の質問文自体)を、`jev_labels`の各ラベルでJevに評価させた結果。
`/ai-cache`のモデル比較・`/jev-score-board`・`/jev-label-stats`で使う。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 行ID |
| target_type | TEXT | NOT NULL | `'answer'` または `'source_question'` |
| share_id | TEXT | NOT NULL, FK→ai_chat_shares, INDEX(`idx_jev_evaluations_share`) | 評価対象の質問・回答ID |
| user_id | TEXT | NOT NULL, FK→user_sessions | 評価を実行したユーザー |
| model | TEXT | | 評価対象回答のモデル名(異モデル比較用) |
| jev_label_id | INTEGER | NOT NULL, FK→jev_labels | 評価したラベル |
| value | REAL | NOT NULL | Jevによるスコア(0〜1の連続値) |
| computed_at | TEXT | NOT NULL DEFAULT datetime('now') | 評価実行日時 |
| UNIQUE | | `(target_type, user_id, share_id, model, jev_label_id)`(`idx_jev_evaluations_unique`) | 同一評価の重複INSERTを防ぐ |

`key_type`: `{ id: 'pk', share_id: 'fk+idx', user_id: 'fk', jev_label_id: 'fk' }`。

### jev_country_keyword_labels(migration 0145、初期データ追加は0146)

**対象**: AI分類したキーワードがカタカナの国名だった場合に使う、国名1語から
判定できるJev評価ラベルのマスター。`jev_labels`とは完全に別系統(旅程前提の
質問は除外し、国レベルの一般的な質問のみ)。`/jev-label-stats`のパターン2。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 質問ID |
| question_text | TEXT | NOT NULL | 質問文(例: 「ビザ免除で渡航できる国か」「EU加盟国か」等) |
| options_json | TEXT | NOT NULL | 2択の選択肢をJSON配列で格納 |
| created_at | TEXT | NOT NULL DEFAULT datetime('now') | 作成日時 |

migration 0145で15件、0146(旅行チェックリスト由来)でさらに追加投入。
`key_type`: `{ id: 'pk' }`。

### jev_country_keyword_evaluations(migration 0145)

**対象**: カタカナ国名キーワードを`jev_country_keyword_labels`の各ラベルで
Jevに評価させた結果。**`share_id`/`model`ではなく`keyword`文字列で引く点が
`jev_evaluations`と最大の違い**(国名は特定の質問・回答に紐づかない共通データ
のため)。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 行ID |
| keyword | TEXT | NOT NULL, INDEX(`idx_jev_country_keyword_evaluations_keyword`) | 評価対象のカタカナ国名キーワード |
| user_id | TEXT | NOT NULL, FK→user_sessions | 評価を実行したユーザー |
| jev_country_keyword_label_id | INTEGER | NOT NULL, FK→jev_country_keyword_labels | 評価したラベル |
| value | REAL | NOT NULL | Jevによるスコア |
| computed_at | TEXT | NOT NULL DEFAULT datetime('now') | 評価実行日時 |
| UNIQUE | | `(user_id, keyword, jev_country_keyword_label_id)`(`idx_jev_country_keyword_evaluations_unique`) | 同一評価の重複INSERTを防ぐ |

`key_type`: `{ id: 'pk', keyword: 'idx', user_id: 'fk', jev_country_keyword_label_id: 'fk' }`。

### jev_keyword_evaluation_locks(migration 0148)

**対象**: `runJevScoreForKeyword`(国名キーワード評価の一括実行関数)の多重
実行防止用の一時ロック行。`user_id`+`keyword`単位で、一定時間で失効し処理
完了後は削除される(恒久データではない)。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| user_id | TEXT | NOT NULL, PK構成要素, FK→user_sessions | 実行ユーザー |
| keyword | TEXT | NOT NULL, PK構成要素 | ロック対象キーワード |
| locked_at | TEXT | NOT NULL DEFAULT datetime('now') | ロック取得日時 |
| PRIMARY KEY | | `(user_id, keyword)` | 複合PK |

`key_type`: `{ user_id: 'pk+fk', keyword: 'pk' }`。

## グループマッピング(`TABLE_GROUP_MAP`)

| group_name | テーブル |
|---|---|
| ai | jev_label_groups, jev_labels, jev_evaluations, jev_country_keyword_labels, jev_country_keyword_evaluations, jev_keyword_evaluation_locks |

元の`table-catalog.md`が定義する5グループ(auth/commit/ai/email/config)の
うち、Jev系はすべて`ai`グループに属する。専用の`jev`サブグループは
現状のコードには存在しない(将来`table_group_permissions`を導入する場合の
検討課題)。

## 想定クエリ

### あるグループ(ai)のJev関連テーブルとそのPK/FK構造を一覧

```sql
SELECT table_name, column_name, key_type, fk_target_table
FROM table_column_keys
WHERE table_name LIKE 'jev\_%' ESCAPE '\'
ORDER BY table_name, column_name;
```

(`table_column_keys`がD1化されていない現状は、`TABLE_COLUMN_KEYS`定数
[`src/index.ts`]を直接参照する)

### 特定の質問・回答に対するJev評価結果を全ラベル分まとめて引く

```sql
SELECT jl.question_text, jg.name AS group_name, je.model, je.value
FROM jev_evaluations je
JOIN jev_labels jl ON jl.id = je.jev_label_id
JOIN jev_label_groups jg ON jg.id = jl.jev_group_id
WHERE je.share_id = ? AND je.user_id = ? AND je.target_type = 'answer'
ORDER BY jg.id, jl.id;
```

### あるラベルでの上位N件(`/jev-score-board`のtop-by-label相当)

```sql
SELECT je.share_id, je.model, je.value
FROM jev_evaluations je
WHERE je.user_id = ? AND je.jev_label_id = ? AND je.target_type = 'answer'
ORDER BY je.value DESC
LIMIT 20;
```

### カタカナ国名キーワードの評価結果を全ラベル分まとめて引く

```sql
SELECT jcl.question_text, jce.value
FROM jev_country_keyword_evaluations jce
JOIN jev_country_keyword_labels jcl ON jcl.id = jce.jev_country_keyword_label_id
WHERE jce.user_id = ? AND jce.keyword = ?
ORDER BY jcl.id;
```

### グループ別の質問項目数(`/jev-label-stats`のパターン1集計)

```sql
SELECT jg.name, COUNT(jl.id) AS label_count
FROM jev_label_groups jg
LEFT JOIN jev_labels jl ON jl.jev_group_id = jg.id
GROUP BY jg.id
ORDER BY jg.id;
```

## 関連ファイル・エンドポイント

| ファイル/エンドポイント | 役割 |
|---|---|
| `src/index.ts` の `runJevScoreForKeyword` 等 | Jev API(`https://api.typesafe.ai/v1/systemone`)呼び出し・評価結果のINSERT |
| `GET /api/aichat/jev-values` | 特定share_idの評価済みラベル値を取得 |
| `POST /api/aichat/jev-score` | 回答本文をJevで評価し`jev_evaluations`へ保存 |
| `POST /api/aichat/jev-score-keyword` | カタカナ国名キーワードをJevで評価し`jev_country_keyword_evaluations`へ保存(`jev_keyword_evaluation_locks`で多重実行防止) |
| `POST /api/aichat/jev-score-external` / `jev-stats-external` | dynamicnekoの`/ai-cache`ページから中継されるJev評価・集計API(Bearer secret認証) |
| `POST /api/aichat/jev-score-board-*-external` | dynamicneko側`/jev-scores`ページ向けの`jev-score-board`系外部API群 |
| `GET /jev-rev-viewer` | Jev評価の生レビュー内容を閲覧するページ |
| `GET /jev-score-board`、`GET /api/jev-score-board/rows` 他 | 質問ID×ラベル1〜20スコアの一覧ページ(PR #1886〜#1890) |
| `GET /jev-label-stats` | パターン1(jev_labels)・パターン2(jev_country_keyword_labels)の質問項目数を可視化するページ(PR #1897〜#1898) |

## 関連コミット

| コミット | 内容 |
|---|---|
| [`655eda3`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/655eda3) | `jev_label_groups`/`jev_labels`/`jev_evaluations`をmigration 0144として追加 |
| [`c72b449`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c72b449) | カタカナ国名の評価を専用の`jev_country_keyword_labels`/`jev_country_keyword_evaluations`(migration 0145)に分離 |
| [`cb29167`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/cb29167) | 旅行チェックリストから国名単体で判定できる質問を`jev_country_keyword_labels`に追加(migration 0146) |
| [`4a2a105`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/4a2a105) | `runJevScoreForKeyword`に多重実行防止のDBロック(`jev_keyword_evaluation_locks`、migration 0148)を追加 |

## 注意事項

- `jev_evaluations`と`jev_country_keyword_evaluations`は名前が似ているが、
  **主キー構成要素がまったく異なる**(前者は`share_id`+`model`+`target_type`
  単位、後者は`keyword`文字列単位で質問・回答そのものには紐づかない)。
  実装・調査時に取り違えないこと
- `jev_labels`は追記専用。既存行の`question_text`/`options_json`を編集すると、
  過去の`jev_evaluations`が「別の質問への回答」であるかのように見えてしまう
  (評価データとラベル定義の対応が崩れる)ため、変更する場合は新しい行を
  追加し旧行は残す
- `jev_labels`は`target_type`(answer/source_question)によらず常に同じ20件の
  質問セットが使われる。表示上は4グループに分かれるだけで、実際にJevへ送る
  質問項目セット自体はtarget_typeで変わらない
- `table_catalog`/`table_column_keys`テーブル自体は本番投入されていないため、
  本ドキュメントの内容は`src/index.ts`の定数が変更されるたびに手動で
  同期する必要がある(自動生成ではない)
- Jev API呼び出しには`JEV_API_KEY`シークレットが必要。未設定時の挙動は
  各呼び出し元のエラーハンドリングに従う(CLAUDE.mdルール8: 記録・通知・
  テストの3義務を満たすこと)
