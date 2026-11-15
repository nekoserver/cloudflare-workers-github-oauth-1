# SPEC: AIチャット✂️のキーワード切り出しをEmbeddingGemma 2へ置き換え、切り出し結果とスコアを保存する

作成日: 2026-11-15
ブランチ: `feat/embeddinggemma-2-fallback-20261115`

---

## 1. ✂️のキーワード切り出しをEmbeddingGemma 2にし、gemma-4をフォールバックにする

**対象**: `POST /api/aichat/vectorize-answer`(AIチャットの✂️ボタン、answer-graphの「この回答文をベクタ化する」ボタン)の予備知識キーワード切り出し、`src/utils/embeddingKeywordExtraction.ts` — 切り出しを`@cf/google/gemma-4-26b-a4b-it`(文章生成)から`@cf/google/embeddinggemma-2`(埋め込み)へ置き換え、EmbeddingGemma 2が失敗したときだけgemma-4で切り出す。

### 背景

- ✂️のキーワード切り出しは、gemma-4に「この文章を理解するのに必要な用語を1行1語で列挙して」と頼んで行っていた(`extractPrerequisiteTerms`)。
- この処理はキーワードの切り出しにしか使っていないため、2026-11-12にWorkers AIで公開された埋め込みモデルEmbeddingGemma 2に置き換える(ユーザー指定、2026-11-15)。gemma-4は、EmbeddingGemma 2が使えないときのフォールバックとして残す。
- gemma-4にはsystem messageでthinkingが混入する既知の制限や、内部タイムアウト(3046)までの長い待ちがあった(`withTimeout`の導入理由)。埋め込みモデルなら1回の呼び出しで済む。

### 切り出しの手順

埋め込みモデルは文章を生成できないため、「生成」ではなく「候補を拾って順位付け」する(KeyBERTと同じ考え方)。

| 手順 | 内容 | 関数 |
|---|---|---|
| 1 | 本文(先頭6,000文字まで)から候補語を拾う。漢字・カタカナの連なり(例: 量子コンピュータ)と英字の技術用語(例: Node.js)。1文字の語・長音だけの並び・ありふれた語(場合・必要など)を除き、出現回数の多い順に最大64件 | `extractKeywordCandidates` |
| 2 | 本文1件と候補をまとめて1回でベクトル化する。本文は`title: none \| text: <本文>`、候補は`task: search result \| query: <候補>`の接頭辞を付ける(公式が推奨する検索用の接頭辞) | `extractKeywordsWithEmbedding` |
| 3 | 本文ベクトルと各候補ベクトルのコサイン類似度で並べ、上位15件を返す | `rankCandidatesBySimilarity` |
| 4 | 例外(`AI_ERROR`)・想定外の応答(`AI_UNEXPECTED_FORMAT`)のときだけgemma-4で切り出す。両方失敗したら両方の理由を含む例外を投げる | `extractKeywordsWithFallback` |

- 候補が0件の本文は、AIを呼ばずに空で成功を返す(gemma-4にも切り出せる語がないため、フォールバックしない)。
- 切り出し後は従来どおり`filterMeaningfulPrerequisiteTerms`で英数字だけの語などを除く。
- 処理全体には従来どおり`withTimeout`(20秒)をかける。

### EmbeddingGemma 2の入出力(従来の埋め込みモデルと違う点)

| | 従来(bge-m3・plamo-embedding-1b・embeddinggemma-300m) | EmbeddingGemma 2 |
|---|---|---|
| 入力 | `{ text: string[] }` | `{ input: string[] }` |
| 出力 | `data: number[][]` | `data: [{ index, embedding: number[] }]` |
| 次元 | モデルごとに固定 | 既定768。`dimensions`で128/256/512も可(今回は既定) |
| 文脈長 | — | 1入力あたり8,192トークン |

従来の`embedTextWithModel`(`{ text }`→`data[0]`)をそのまま使うと空ベクトルになるため、専用の解釈関数`parseEmbeddingGemma2Vectors`を使う。件数の不一致・形式違いは空配列で成功扱いにせず、失敗として返す。

根拠: https://developers.cloudflare.com/workers-ai/models/embeddinggemma-2/

### APIの応答に足した項目

| 項目 | 内容 |
|---|---|
| `keywordsModel` | 実際に切り出しに使ったモデル(`@cf/google/embeddinggemma-2`、フォールバック時は`@cf/google/gemma-4-26b-a4b-it`) |
| `_keywordsFallback` | フォールバックしたときのEmbeddingGemma 2の失敗理由(`{ errorCode, detail }`)。しなければ`null` |
| `_extractionSaveWarning` | 切り出し結果のD1保存に失敗したときの理由。成功なら`null` |

既存の`keywords`・`keywordVectorization`・`_keywordsWarning`は変えていない。

### 範囲外

- PR要約・pushのWebhookとバックフィル(`/api/commit-summary-keywords-backfill`)のキーワード抽出も`extractPrerequisiteTerms`を使うが、今回はgemma-4のまま変えていない(ユーザー指定で✂️だけが対象)。
- ZTモーダルの埋め込みモデル選択肢`embeddinggemma-300m`(`GEMMA_EMBEDDING_MODEL`)は変えていない。

---

## 2. 切り出し結果・ベクトル分析・スコアをD1へ保存する

**対象**: migrations `0192_create_aichat_answer_keyword_extractions.sql`、`src/utils/answerKeywordExtractionStore.ts`、`/status`の各登録表 — ✂️で切り出したキーワード群と、切り出しと同時に得たベクトル分析・各スコアを、モデル名を正規化し、回答IDとモデルIDを外部キーにして保存する。

### 背景

- 切り出しのたびに本文ベクトル・候補ベクトル・類似度を計算しているが、従来はどこにも残らず、切り出しの質を後から比べられなかった。
- ✂️の後続処理(`vectorizeAnswerKeywords`)がPlaMoで計算している「本文とキーワードの類似度」も、応答に返すだけで保存していなかった。

### テーブル

| 参照元 | 外部キー | 参照先 |
|---|---|---|
| `aichat_answer_keyword_extractions` | `share_id` | `ai_chat_shares(id)` |
| `aichat_answer_keyword_extractions` | `model_id` | `aichat_model_names(id)` |
| `aichat_answer_extracted_keywords` | `extraction_id` | `aichat_answer_keyword_extractions(id)` |
| `aichat_answer_keyword_scores` | `(extraction_id, rank)` | `aichat_answer_extracted_keywords(extraction_id, rank)` |
| `aichat_answer_keyword_scores` | `model_id` | `aichat_model_names(id)` |

| テーブル | 主キー・一意 | 主な列 |
|---|---|---|
| `aichat_model_names` | `id`、`name`一意 | モデル名(1モデル1行) |
| `aichat_answer_keyword_extractions` | `id`、`(user_id, share_id, model_id)`一意 | `share_id`(FK、回答削除で連鎖削除)、`model_id`(FK、切り出しに使ったモデル)、`dim`、`document_vector`、`candidate_count`、`score_method`、`fallback_error_code`、`fallback_detail`、`extracted_at` |
| `aichat_answer_extracted_keywords` | `(extraction_id, rank)`、`(extraction_id, keyword)`一意 | `keyword`、`score`(切り出しモデルでの本文との類似度)、`occurrence_count`(本文中の出現回数)、`vector` |
| `aichat_answer_keyword_scores` | `(extraction_id, rank, model_id)` | `similarity`(切り出しモデル以外で測った本文との類似度。現在はPlaMo)、`score_method` |

### 保存の規則

| 規則 | 理由 |
|---|---|
| スコアは必ずモデルIDと組で持ち、モデル名は`aichat_model_names`でID化する | モデルが違えばスコアの分布が違い、比べられないため |
| 切り出しモデルのスコアはキーワード表の`score`、他モデルのスコアは`aichat_answer_keyword_scores`に行で持つ | モデルが増えても列を足さずに済む(正規化) |
| ベクトルはFloat32のBLOBで保存し、次元数を`dim`に持つ | スコアは後から計算し直せるが、ベクトルが無いとできないため |
| スコアの計算条件を`score_method`に必ず持つ | タスク接頭辞や計算方式を変えたとき、新旧のスコアが混ざらないようにするため(下表) |
| 計算できなかった値は0ではなくNULLにする | gemma-4へフォールバックしたときは`dim`・`document_vector`・`candidate_count`・`score`・`vector`がNULL。理由は`fallback_*`に残る |
| 同じ回答・同じモデルで切り出し直したら、前回の結果を置き換える | 新旧のキーワードが混ざらないようにするため |
| すべての文をD1の`batch`1回で実行する | 途中で失敗したとき半端な状態を残さないため。切り出しIDはbatch内でサブクエリから引く |
| 保存するキーワードは画面に返すものと同じ(フィルタ後・重複除去後) | 画面とDBの食い違いを防ぐ。重複は一意制約でbatch全体が失敗するため除く |
| 保存の失敗は✂️全体を失敗させない | 保存は付随処理のため。`_extractionSaveWarning`とログ(`logger.error`)に理由を残す(CLAUDE.mdルール8) |

### `score_method`の値

| 値 | 使う場所 | 意味 |
|---|---|---|
| `cosine;doc=title-none;query=search-result;v1` | 切り出し表(EmbeddingGemma 2で切り出したとき) | 本文は`title: none \| text:`、候補は`task: search result \| query:`の接頭辞でベクトル化し、コサイン類似度で順位付け |
| `llm-list;v1` | 切り出し表(gemma-4へフォールバックしたとき) | gemma-4の出力順。スコアはなし(`score`はNULL) |
| `cosine;plain;v1` | スコア表(PlaMoなど) | 接頭辞なしでベクトル化した本文とキーワードのコサイン類似度 |

接頭辞・計算方式を変えるときは、`KEYWORD_EXTRACTION_SCORE_METHOD`など(`src/utils/embeddingKeywordExtraction.ts`・`src/utils/answerKeywordExtractionStore.ts`)の版(`v1`)を上げる。スコアを比べるときは、`model_id`と`score_method`が同じ行だけを使う。

### スコアの意味と扱い

- EmbeddingGemma 2はスコアを返さない。返すのはベクトルだけで、スコアはこちらでコサイン類似度として計算する。
- スコアは**同じ本文の中で候補を並べるための相対値**で、確率でも絶対尺度でもない。回答をまたいで閾値で比べる用途には向かない。
- 比べてよいのは、モデル・次元数・タスク接頭辞がそろったスコア同士だけ。PlaMoのスコア(接頭辞なし・別モデル)とEmbeddingGemma 2のスコアは比べられない。
- EmbeddingGemma 2のベクトルが正規化済みかは公式文書に記載がない(未確認)。そのため内積ではなくコサインで計算している。

### `/status`への登録(CLAUDE.mdルール17・23)

`STATUS_TABLE_DEFINITIONS`・`STATUS_MIGRATION_SQL`(`'0192'`)・`TABLE_COLUMN_KEYS`・`TABLE_GROUP_MAP`(`ai`)・`COLUMN_FK_TARGETS`・`COLUMN_FK_TARGET_COLUMNS`に4テーブルを登録した。

### D1で実行するSQL

マイグレーション`0192`と同じ内容。本番のD1で次を実行する。

```sql
CREATE TABLE IF NOT EXISTS aichat_model_names (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS aichat_answer_keyword_extractions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  share_id TEXT NOT NULL REFERENCES ai_chat_shares(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  model_id INTEGER NOT NULL REFERENCES aichat_model_names(id),
  dim INTEGER CHECK(dim IS NULL OR dim > 0),
  document_vector BLOB,
  candidate_count INTEGER CHECK(candidate_count IS NULL OR candidate_count >= 0),
  score_method TEXT NOT NULL,
  fallback_error_code TEXT,
  fallback_detail TEXT,
  extracted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(user_id, share_id, model_id)
);
CREATE INDEX IF NOT EXISTS idx_aichat_answer_keyword_extractions_share ON aichat_answer_keyword_extractions(share_id);
CREATE TABLE IF NOT EXISTS aichat_answer_extracted_keywords (
  extraction_id INTEGER NOT NULL REFERENCES aichat_answer_keyword_extractions(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL CHECK(rank >= 1),
  keyword TEXT NOT NULL,
  score REAL,
  occurrence_count INTEGER NOT NULL DEFAULT 0 CHECK(occurrence_count >= 0),
  vector BLOB,
  PRIMARY KEY(extraction_id, rank),
  UNIQUE(extraction_id, keyword)
);
CREATE INDEX IF NOT EXISTS idx_aichat_answer_extracted_keywords_keyword ON aichat_answer_extracted_keywords(keyword);
CREATE TABLE IF NOT EXISTS aichat_answer_keyword_scores (
  extraction_id INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  model_id INTEGER NOT NULL REFERENCES aichat_model_names(id),
  similarity REAL NOT NULL,
  score_method TEXT NOT NULL,
  PRIMARY KEY(extraction_id, rank, model_id),
  FOREIGN KEY(extraction_id, rank) REFERENCES aichat_answer_extracted_keywords(extraction_id, rank) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_aichat_answer_keyword_scores_model ON aichat_answer_keyword_scores(model_id, similarity);
```

テーブルが無い間も✂️は動き、`_extractionSaveWarning`に`no such table`が入る。

---

## 3. 修正内容

| ファイル | 変更 |
|---|---|
| `src/utils/embeddingKeywordExtraction.ts`(新規) | 候補抽出・EmbeddingGemma 2の応答解釈・類似度での順位付け・gemma-4へのフォールバック |
| `src/utils/answerKeywordExtractionStore.ts`(新規) | 切り出し結果・ベクトル・スコアのbatch保存、出現回数の計算 |
| `migrations/0192_create_aichat_answer_keyword_extractions.sql`(新規) | 4テーブルの作成 |
| `src/index.ts` | `/api/aichat/vectorize-answer`で新しい切り出しと保存を呼ぶ。応答に`keywordsModel`・`_keywordsFallback`・`_extractionSaveWarning`を追加。`/status`の各登録表に4テーブルを追加 |
| `src/utils/embeddingKeywordExtraction.test.ts`(新規) | 候補抽出・応答解釈・順位付け・フォールバックのテスト |
| `src/utils/answerKeywordExtractionStore.test.ts`(新規) | 実際のマイグレーションをnode:sqliteに流し、外部キーを有効にした保存のテスト |
| `src/aichat-scissors-embeddinggemma2-20261115.test.ts`(新規) | ハンドラの統合テスト(EmbeddingGemma 2の使用・フォールバック・保存・保存失敗時の200) |

---

## 4. 故障想定と確認状況

| 故障シナリオ | 対処 | 検証 |
|---|---|---|
| EmbeddingGemma 2の入出力を従来形式と取り違え、常に空になる | 専用の入力`{ input }`と解釈関数 | ユニットテスト |
| EmbeddingGemma 2が失敗したのに空配列を「キーワードなし」として返す | 失敗を型で返し、gemma-4へフォールバック | ユニット・統合テスト |
| フォールバックが呼び出し元から分からない | `_keywordsFallback`とログ | 統合テスト |
| モデル名が切り出しのたびに増える | `aichat_model_names`の一意制約と`INSERT OR IGNORE` | 保存テスト |
| 存在しない回答IDで保存できる | 外部キー。違反時はbatch全体が取り消される | 保存テスト(node:sqlite、`PRAGMA foreign_keys = ON`) |
| 接頭辞を変えたとき新旧のスコアが混ざる | `score_method`列(ユーザー承認、2026-11-15) | 保存テスト・統合テスト |
| 切り出し直しで新旧が混ざる | batch内で前回のスコア・キーワードを削除してから保存 | 保存テスト |
| 保存の失敗で✂️全体が500になる | 保存の失敗を捕まえ、警告として返す | 統合テスト |

### 確かめていないこと

- **本番のWorkers AIでEmbeddingGemma 2を実際に呼んだ結果。** 入出力の形は公式文書に合わせ、テストはモックで行った。デプロイ後に✂️を押し、応答の`keywordsModel`が`@cf/google/embeddinggemma-2`、`_keywordsFallback`が`null`であることを確かめる必要がある。
- **切り出しの質。** gemma-4の生成と比べて、キーワードが良くなったか悪くなったかは比べていない。gemma-4は本文に無い言い換え語も返せたが、新方式は本文中の語しか返さない。
- **D1の外部キーの挙動。** テストはnode:sqliteで外部キーを有効にして行った。D1は既定で外部キーを有効にしているとされるが、本番では確かめていない。保存処理は`ON DELETE CASCADE`に頼らず、置き換え時に明示的に削除している。
- **EmbeddingGemma 2のベクトルが正規化済みかどうか。**

---

## 5. 未決事項

- PR要約のキーワード抽出(Webhook・バックフィル)も同じ方式に揃えるか。

---

## 6. 関連コミット

- 本SPECと同じコミット: `AIチャット✂️のキーワード切り出しをEmbeddingGemma 2にし、切り出し結果とスコアをD1へ保存する`(ブランチ`feat/embeddinggemma-2-fallback-20261115`。ハッシュはマージ後に確定するため、マージ後にリンクを追記する)

---

## 7. コンテナ

- 再ビルド: 不要(`src/`と`migrations/`だけの変更で、`containers/**`・`src/containers/**`・`wrangler.toml`の`[[containers]]`に触れていない)
- 再起動: 不要(Worker側だけの変更)
