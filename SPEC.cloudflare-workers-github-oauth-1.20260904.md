# SPEC.cloudflare-workers-github-oauth-1.20260904

## 1. ワイン銘柄検索機能(/wine-search)の新規追加

**対象**: 新規テーブル `wine_embeddings` / `wine_details`、`src/index.ts` の
`getOrComputeWineEmbedding` / `rankWines` / `bulkRegisterWines` 関数、
新規ページ `GET /wine-search`(`src/views/wineSearch.ts`)、新規API
`POST /api/wine/search` / `POST /api/wine/bulk-register`、シードデータ
`seeds/wine_initial_vectors_v83.csv` / `src/data/wineVectors.ts` — 既存の
`aichat_keyword_embeddings` によるキーワードベクタ化・コサイン類似度検索の
仕組み(`SPEC.cloudflare-workers-github-oauth-1.VECTORIZE.md`)を踏襲し、
ワイン銘柄名を対象にした全ユーザー共通のベクトル検索機能を追加する。

### 背景

`seeds/wine_initial_vectors_v83.csv`(616銘柄、29種のペアリング特性スコア)を
元データとして、ワイン銘柄名をフリーワードで検索し、コサイン類似度の高い順に
銘柄とその特性データを一覧表示したいという要望に対応した。既存のAIチャット
キーワードベクタ化(`aichat_keyword_embeddings`)はユーザーごとのテナント
分離を持つが、ワインは全ユーザー共通の参照データのため、専用テーブルを
新設して分離した。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `migrations/0125_create_wine_tables.sql` | `wine_embeddings`(id連番PK・wine_name UNIQUE・model/dim/vector)と`wine_details`(wine_id PK+FK・CSVの29カラム)を新規作成 |
| `src/index.ts` | `STATUS_TABLE_DEFINITIONS`/`STATUS_MIGRATION_SQL`/`TABLE_COLUMN_KEYS`/`TABLE_GROUP_MAP`/`COLUMN_FK_TARGETS`へ`wine_embeddings`/`wine_details`を登録。`getOrComputeWineEmbedding`(埋め込みキャッシュ読み書き)・`rankWines`(コサイン類似度降順ランキング)・`bulkRegisterWines`(CSVシードの一括登録)・`rowToWineDetail`を追加。`GET /wine-search`・`POST /api/wine/search`・`POST /api/wine/bulk-register`ルートを追加 |
| `src/views/wineSearch.ts` | 検索ページ本体(cheeseSearch.tsを参考にしたPWA対応UI、右上に外部リンクなし) |
| `src/data/wineVectors.ts` | CSVから自動生成した`WINE_VECTOR_SEED`(616件の`WineSeedRow[]`) |
| `src/wine-search.test.ts` | 新規テスト18件(下記参照) |

### テーブル定義

```sql
CREATE TABLE IF NOT EXISTS wine_embeddings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wine_name TEXT NOT NULL UNIQUE,
  model TEXT NOT NULL,
  dim INTEGER NOT NULL,
  vector BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS wine_details (
  wine_id INTEGER PRIMARY KEY REFERENCES wine_embeddings(id),
  pairing_count INTEGER NOT NULL DEFAULT 0,
  source_linked_count INTEGER NOT NULL DEFAULT 0,
  source_rate REAL NOT NULL DEFAULT 0,
  reliability REAL NOT NULL DEFAULT 0,
  fat REAL NOT NULL DEFAULT 0,
  sweet REAL NOT NULL DEFAULT 0,
  acid REAL NOT NULL DEFAULT 0,
  salt REAL NOT NULL DEFAULT 0,
  spice REAL NOT NULL DEFAULT 0,
  umami REAL NOT NULL DEFAULT 0,
  bitter REAL NOT NULL DEFAULT 0,
  richness REAL NOT NULL DEFAULT 0,
  raw REAL NOT NULL DEFAULT 0,
  fried REAL NOT NULL DEFAULT 0,
  grilled_smoked REAL NOT NULL DEFAULT 0,
  creamy_butter REAL NOT NULL DEFAULT 0,
  tomato REAL NOT NULL DEFAULT 0,
  herbal_green REAL NOT NULL DEFAULT 0,
  seafood REAL NOT NULL DEFAULT 0,
  shellfish REAL NOT NULL DEFAULT 0,
  white_fish REAL NOT NULL DEFAULT 0,
  oily_fish REAL NOT NULL DEFAULT 0,
  sushi REAL NOT NULL DEFAULT 0,
  red_meat REAL NOT NULL DEFAULT 0,
  poultry REAL NOT NULL DEFAULT 0,
  pork REAL NOT NULL DEFAULT 0,
  lamb REAL NOT NULL DEFAULT 0,
  dairy REAL NOT NULL DEFAULT 0,
  mushroom_truffle REAL NOT NULL DEFAULT 0,
  vegetable REAL NOT NULL DEFAULT 0,
  dessert REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 関数一覧(`src/index.ts`)

| 関数 | 役割 |
|---|---|
| `getOrComputeWineEmbedding(db, ai, wineName, model?)` | ワイン名の埋め込みをキャッシュ優先で取得。同一モデルでキャッシュ済みならAIを呼ばない |
| `rankWines(queryVector, candidates, limit?)` | コサイン類似度降順で上位limit件を返す純粋関数。クエリベクトルが空/候補0件でも空配列を返す |
| `bulkRegisterWines(db, ai, seeds)` | 未登録の銘柄だけを埋め込み計算し`wine_embeddings`/`wine_details`へ保存。1件失敗しても他は継続し、失敗は`errors`配列に記録して返す(CLAUDE.mdルール8準拠) |
| `rowToWineDetail(row)` | D1の行(LEFT JOIN結果)を`WineDetailFields`または`null`に変換 |

### エンドポイント

| メソッド/パス | 認証 | 概要 |
|---|---|---|
| `GET /wine-search` | 必須 | 検索ページ(フリーワード入力→コサイン類似度順に表示) |
| `POST /api/wine/search` | 必須 | body `{ q: string }`。qを都度plamo-embedding-1bでベクタ化し、`wine_embeddings`全件との類似度で降順ソートして`wine_details`とJOINした結果を返す |
| `POST /api/wine/bulk-register` | 必須 | `WINE_VECTOR_SEED`(CSV由来)のうち未登録の銘柄だけ埋め込み計算し登録する管理用エンドポイント |

### テスト(`src/wine-search.test.ts`、18件)

故障シナリオ:
1. embedding計算(AI呼び出し)がエラーを投げる/空ベクトルを返す
2. `wine_details`に対応する行が無いワイン(LEFT JOINでNULL)
3. 空文字列・非常に長い検索クエリ
4. `wine_embeddings`が0件の状態での検索
5. `bulkRegisterWines`で一部の銘柄が失敗しても他の登録が継続するか、失敗が記録されるか

上記いずれも正常系・異常系の両方でテストし、`npx vitest run` で全件通過を確認済み。

### 注意事項

- この環境には`CLOUDFLARE_API_TOKEN`が無く、Workers AI(`env.AI.run`)の実呼び出しができないため、
  `POST /api/wine/bulk-register`は実装のみでこのセッションでは実行できない。デプロイ後にユーザーが叩く。
- `wine_details`は`wine_embeddings.id`への外部キー(`wine_id`)を主キーとする1:1関係。
  埋め込みが存在しない銘柄の`wine_id`は決めようがないため、`wine_details`は
  「手動SQLで先に流す」ことができない。**`POST /api/wine/bulk-register`が唯一の投入経路**であり、
  このエンドポイントが埋め込み計算の直後に実在するIDを使って`wine_details`にも保存するため、
  それ以外の手順は不要。
- `wine_embeddings`/`wine_details`は`syncPolicy: 'manual'`として登録した(自動生成データではなく
  CSV由来のマスタデータのため)。

## 追記(設計修正): `wine_details`手動SQLシードを廃止

**対象**: 一時的に追加していた`seeds/wine_details_616.sql`(手動SQL投入用)と生成スクリプト
`scripts/gen-wine-details-sql.ts` — チェーン依存(`wine_embeddings`に銘柄が無いと`wine_id`が
決まらない)のため、この手動SQLは「先に流しても意味がない」上に「後から流しても
`bulk-register`が既にwine_detailsへ保存済みなので二度手間」という、そもそも不要な
仕組みだったため削除した。

### 経緯

当初`seeds/wine_details_616.sql`を`INSERT INTO wine_details (wine_id, ...)
VALUES ((SELECT id FROM wine_embeddings WHERE wine_name = 'X'), ...)`という
VALUES句サブクエリ形式で生成していたが、`wine_embeddings`にまだ`'X'`が登録されて
いない状態で実行すると、サブクエリが返す`NULL`が`INTEGER PRIMARY KEY`(SQLiteの
rowidエイリアス)へ渡り、D1は既定で`PRAGMA foreign_keys`がOFFのため制約違反にも
ならず、**無関係な`wine_id`を持つゴミ行が616件エラーなく作られる**バグがあった。
一度は`INSERT ... SELECT`形式(該当行が無ければ0行のまま)に修正したが、
そもそも`wine_details`は`bulk-register`実行時に必ず埋め込み保存と同じ処理内で
書き込まれるため、独立した手動SQLシード自体が不要というのが根本的な結論。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `seeds/wine_details_616.sql` | 削除(不要) |
| `scripts/gen-wine-details-sql.ts` | 削除(不要) |
| `src/wine-search.test.ts` | 上記ファイルを前提にした回帰テスト3件を削除 |

### 結論・正しい運用手順

1. デプロイ
2. マイグレーション適用(`wine_embeddings`/`wine_details`のテーブル作成)
3. `POST /api/wine/bulk-register` を1回叩く(これだけで616銘柄の埋め込み計算と
   `wine_details`への保存が両方完了する)
4. `/wine-search` で検索確認
