# SPEC.cloudflare-workers-github-oauth-1.VECTORIZE

## AIチャットキーワードのベクタ化 仕様まとめ

**対象**: `aichat_keyword_embeddings` / `aichat_keyword_category_suggestions` / `aichat_answer_category_scores` の各D1テーブル、埋め込み計算・キャッシュ関数群（`src/index.ts` の `getOrComputeKeywordEmbedding` 系）、ZTツリー（Zanzibar形式分類ツリー）・キーワード分類のAI推薦・`/answer-graph` の色分け機能 — このリポジトリにおける「ベクタ化」がどのように保存・運用されているかを一望できるようにする。

---

## 1. 大前提: Cloudflare Vectorize は使っていない

Cloudflare の **Vectorize**（専用ベクトルDB製品、`env.VECTORIZE.insert()` 等のAPIを持つ）は本リポジトリでは一切使用していない。

- `wrangler.toml` に `[[vectorize]]` バインディングは存在しない（バインディングは `[[d1_databases]]` と `[[analytics_engine_datasets]]` のみ）
- ベクトル本体は **D1（`aichat_keyword_embeddings` テーブル）に `BLOB` カラムとして直接保存**している
- 埋め込み計算そのものは **Cloudflare Workers AI**（`env.AI.run(model, ...)`）のテキスト埋め込みモデルを使う

「Vectorizeのmetadataに元テキストを入れておく」という一般論はこのリポジトリには当てはまらない。D1スキーマでは埋め込み対象の原文（キーワード）自体が最初から `keyword` カラムという一次データであり、`(user_id, keyword)` にユニークインデックスも張られているため、Vectorizeのmetadata（非構造化JSON、フィルタ用途止まり）より強い形で参照・検索できる。詳細な経緯は [`SPEC.cloudflare-workers-github-oauth-1.20260804.AICHAT_OVERVIEW.md`](./SPEC.cloudflare-workers-github-oauth-1.20260804.AICHAT_OVERVIEW.md) の第13章を参照。

---

## 2. テーブル定義

### 2-1. `aichat_keyword_embeddings`（主テーブル、migration `0087`〜`0093`）

キーワード単位で埋め込みベクトルをキャッシュする。**キーワードごとに最新1件のみ保持**（過去のベクトルは上書きされ、履歴は残らない）。

```sql
CREATE TABLE IF NOT EXISTS aichat_keyword_embeddings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  model TEXT NOT NULL,
  dim INTEGER NOT NULL,
  vector BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_aichat_keyword_embeddings_user_keyword ON aichat_keyword_embeddings(user_id, keyword);
```

`0090`〜`0093` で、bge-m3以外のモデル用に**追加カラム**（サブ系列）を後付けしている。主系列（`model`/`dim`/`vector`）はbge-m3専用、それ以外のモデルは以下のプレフィックス付きカラムに格納する。

```sql
ALTER TABLE aichat_keyword_embeddings ADD COLUMN plamo_vector BLOB;
ALTER TABLE aichat_keyword_embeddings ADD COLUMN plamo_dim INTEGER;
ALTER TABLE aichat_keyword_embeddings ADD COLUMN plamo_updated_at TEXT;
ALTER TABLE aichat_keyword_embeddings ADD COLUMN plamo_model TEXT;
ALTER TABLE aichat_keyword_embeddings ADD COLUMN source TEXT;
ALTER TABLE aichat_keyword_embeddings ADD COLUMN gemma_vector BLOB;
ALTER TABLE aichat_keyword_embeddings ADD COLUMN gemma_dim INTEGER;
ALTER TABLE aichat_keyword_embeddings ADD COLUMN gemma_model TEXT;
ALTER TABLE aichat_keyword_embeddings ADD COLUMN gemma_updated_at TEXT;
```

つまり1行の中に「主系列(bge-m3)」「plamoサブ系列」「gemmaサブ系列」の最大3モデル分のベクトルが同居しうる。`SECONDARY_MODEL_COLUMN_PREFIX`（`src/index.ts:5763`）がモデル名→カラムプレフィックスの対応表になっている。

| カラム | 意味 |
|---|---|
| `user_id` | ベクトルの所有ユーザー（テナント分離のキー） |
| `keyword` | 埋め込み対象の原文そのもの（＝Vectorizeでいうmetadataに相当する情報を、最初からこのカラム自体として保持） |
| `model` / `dim` / `vector` | bge-m3（`@cf/baai/bge-m3`）のモデル名・次元数・ベクトル本体（主系列） |
| `plamo_*` / `gemma_*` | plamo-embedding-1b / embeddinggemma-300m のサブ系列（主系列とは独立してキャッシュ） |
| `source` | どの操作経由で登録されたか（`auto`＝自動ベクタ化、`zt_manual`＝ZTモーダルからの手動登録、`category_suggest`等） |
| `created_at` / `updated_at` | 作成・最終更新日時 |

### 2-2. `aichat_keyword_category_suggestions`（migration `0088`）

キーワードを中分類（カテゴリ）に自動分類する際の「AI推薦」の記録。**確定分類を書き換えない、あくまで参考情報のログ**。

```sql
CREATE TABLE IF NOT EXISTS aichat_keyword_category_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  suggested_category_id INTEGER NOT NULL REFERENCES aichat_keyword_categories(id),
  similarity REAL NOT NULL,
  model TEXT NOT NULL,
  accepted INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_aichat_keyword_category_suggestions_user_keyword ON aichat_keyword_category_suggestions(user_id, keyword, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aichat_keyword_category_suggestions_category ON aichat_keyword_category_suggestions(suggested_category_id);
```

### 2-3. `aichat_answer_category_scores`（migration `0089`）

`/answer-graph` のノード色分け用に、回答（share）ごとの各カテゴリへの類似度スコアをキャッシュするテーブル。

```sql
CREATE TABLE IF NOT EXISTS aichat_answer_category_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  share_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES aichat_keyword_categories(id),
  score REAL NOT NULL,
  model TEXT NOT NULL,
  computed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_aichat_answer_category_scores_unique ON aichat_answer_category_scores(user_id, share_id, category_id);
CREATE INDEX IF NOT EXISTS idx_aichat_answer_category_scores_share ON aichat_answer_category_scores(share_id);
```

---

## 3. 現在使用している埋め込みモデル

`src/index.ts:5730-5733` で定義。

```typescript
export const BGE_M3_MODEL = '@cf/baai/bge-m3';
export const PLAMO_EMBEDDING_MODEL = '@cf/pfnet/plamo-embedding-1b';
export const GEMMA_EMBEDDING_MODEL = '@cf/google/embeddinggemma-300m';
export const KEYWORD_EMBEDDING_MODELS = [BGE_M3_MODEL, PLAMO_EMBEDDING_MODEL, GEMMA_EMBEDDING_MODEL];
```

3モデルとも Cloudflare Workers AI 上のテキスト埋め込みモデルで、いずれもテキスト（キーワード）→固定長ベクトルへの変換に使う。

| モデル | 用途上の既定値 | フォールバック先 |
|---|---|---|
| `@cf/baai/bge-m3`（bge-m3） | ZTモーダルからの明示的な問い合わせ・登録のデフォルト、主系列 | `resolveKeywordEmbeddingModel()` の最終フォールバック（未対応モデル名・null/undefinedはここに落ちる） |
| `@cf/pfnet/plamo-embedding-1b`（plamo-embedding-1b） | 「キーワードの自動ベクタ化」（Cookie設定）のデフォルトモデル | `resolveAutoVectorizeSettings()` の既定値 |
| `@cf/google/embeddinggemma-300m`（embeddinggemma-300m） | ユーザーが明示的に選択した場合のみ使用 | なし（bge-m3/plamoのような既定値としての役割はない） |

**2つの独立したモデル解決関数がある**点に注意（意図的に分離されている）。

- `resolveKeywordEmbeddingModel(model)`（`src/index.ts:5773`）: bge-m3問い合わせモーダルのドロップダウン用。未対応値・null/undefinedは **bge-m3** にフォールバック
- `resolveAutoVectorizeSettings(cookieHeader)`（`src/index.ts:5747`）: `/answer-graph` の色分けやカテゴリ推薦など、ユーザーが明示的にボタンを押していない箇所で自動実行される「自動ベクタ化」用。未設定/不正値は **plamo-embedding-1b** にフォールバック

---

## 4. 保存・キャッシュの運用方式

### 4-1. キャッシュキーと粒度

- ベクタ化の単位は**キーワード（単語・短いフレーズ）単位**。質問文・回答文まるごとのベクタ化は行っていない
- キャッシュキーは `(user_id, keyword)` の組。ユーザーをまたいだベクトル共有はしない（テナント分離）
- 同じキーワードでも**モデルが違えば別ベクトル**として扱う（主系列＝bge-m3、サブ系列＝plamo/gemma）。モデル不一致の行はキャッシュヒットとみなさず再計算する（`getOrComputeKeywordEmbeddingForModel`、`src/index.ts:6538`のコメント参照）
- 履歴は持たない。同一キーワード・同一モデルへの再登録は `UPDATE` で上書きされる（`ON CONFLICT(user_id, keyword) DO UPDATE SET ...`）

### 4-2. ベクトルのバイナリ表現

```typescript
export function floatsToBlob(vec: number[]): ArrayBuffer {
  return new Float32Array(vec).buffer;
}
export function blobToFloats(blob: ArrayBuffer): number[] {
  return Array.from(new Float32Array(blob));
}
```

`number[]` を `Float32Array` のバイト列に変換してD1の `BLOB` カラムへ格納する（32bit浮動小数点、リトルエンディアン）。

### 4-3. 類似度計算

コサイン類似度で統一。

```typescript
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  // 内積 / (ノルムの積)
}
```

D1側にベクトル検索機能（ANN等）は無いため、類似度計算は**アプリ側でJavaScriptにより総当たりで計算**している（Vectorizeのような近似最近傍検索インデックスは持たない）。対象件数はユーザー単位のキーワード数に限られるため現状は許容範囲という前提。

### 4-4. 類似度の用途と閾値

| 用途 | 関数 | 閾値の既定値 |
|---|---|---|
| 似ているキーワードの提示（埋め込みキャッシュモーダルの🔍分析） | `/api/aichat/keyword-embeddings/similar` | サーバー側フォールバック `0.85`。UIスライダーのデフォルトは `75%`（Cookie記憶、1%刻み）。**両者は意図的に独立**した値 |
| キーワード→中分類のAI推薦 | `pickBestCategorySuggestion` | 閾値なし（全カテゴリ中の最大類似度を1件だけ返す「参考情報」。確定分類は書き換えない） |
| `/answer-graph` のノード色分け | `aichat_answer_category_scores` 経由 | 同上のロジックを回答単位に適用 |

短い単語のベクトルは類似度が高く出やすい（anisotropy、異方性）問題があるため、閾値をユーザー調整可能なスライダーにしてある（詳細は [`SPEC.cloudflare-workers-github-oauth-1.20260804.AICHAT_OVERVIEW.md`](./SPEC.cloudflare-workers-github-oauth-1.20260804.AICHAT_OVERVIEW.md) 第13章）。

### 4-5. `source` カラムの値

登録経路を後から追跡できるよう、埋め込み行ごとに記録する。

| 値 | 意味 |
|---|---|
| `auto` | 自動ベクタ化（`/answer-graph` の色分け等、ユーザーの明示操作を伴わない） |
| `zt_manual` | ZTモーダルの「登録する」ボタンからの明示登録 |
| `category_suggest` | カテゴリ推薦フロー経由 |

`source` は最新の登録経路で上書きされる（履歴ではなく現在値）。

---

## 5. 主要な関数一覧

| 関数 | 役割 |
|---|---|
| `getOrComputeKeywordEmbedding(db, ai, userId, keyword, source, model)` | bge-m3（主系列）のキャッシュ取得・未キャッシュ時はAI呼び出しの上で保存 |
| `getOrComputeKeywordEmbeddingForModel(db, ai, userId, keyword, model)` | モデル名に応じて主系列/サブ系列いずれかに振り分けてキャッシュ取得・保存。plamo/gemma利用時も主系列(bge-m3)の行は必ず確保する |
| `embedTextWithModel(ai, model, text)` / `embedTextsWithModelBatch(ai, model, texts)` | Workers AI呼び出しの薄いラッパー（単発/バッチ） |
| `registerKeywordEmbeddings(...)` | ZTモーダルの「登録する」ボタンから複数キーワードをまとめて登録。1件の失敗が他を止めないよう結果を`results`に記録して継続 |
| `lookupKeywordEmbedding(...)` / `listKeywordEmbeddingsOverview(...)` | 既存キャッシュの参照・一覧表示用（埋め込みキャッシュモーダルの📖一覧） |
| `pickBestCategorySuggestion(keywordVector, centroids)` | キーワードベクトルと各中分類の代表ベクトル(centroid)から最も類似度が高い中分類を選ぶ |
| `cosineSimilarity` / `averageVector` / `floatsToBlob` / `blobToFloats` | ベクトル演算・バイナリ変換の共通ユーティリティ |

---

## 6. 関連ドキュメント

- ZTツリー・埋め込みキャッシュモーダルUIの開発経緯: [`SPEC.cloudflare-workers-github-oauth-1.20260804.AICHAT_OVERVIEW.md`](./SPEC.cloudflare-workers-github-oauth-1.20260804.AICHAT_OVERVIEW.md) 第13章
- ZTボタン経由検索と左サイドパネル検索の精度差（本ドキュメントのベクタ化とは別軸の、文字列一致検索の話）: 同ファイル 13-1節
