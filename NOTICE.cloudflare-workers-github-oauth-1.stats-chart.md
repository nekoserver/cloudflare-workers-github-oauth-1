# NOTICE: 日ごとキーワード数・質問数モーダルの統計グラフの元データ

確認日: 2026-10-07。対象は `/aichat` の📈ボタンから開くモーダル。
画面・実装上の名称は「日ごとキーワード数・質問数」。

## 「API経由 モデル別」円グラフの取得経路

1. [src/views/aichat.ts](src/views/aichat.ts) の `renderDailyStatsChart()` が、選択中の月を付けて `GET /api/aichat/daily-stats?month=YYYY-MM` を呼ぶ。認証は同一オリジンのCookieで行う。
2. [src/index.ts](src/index.ts) の同エンドポイントが、本体Workerの `env.DB`（D1）を問い合わせる。[wrangler.toml](wrangler.toml) のバインディング名は `DB`、データベース名は `workers-github-oauth`。
3. **元テーブルは `ai_chat_shares`**。ログインユーザーの指定月の、未削除かつ `source='api'` の行を `model` 別に `COUNT(*)` で集計する。
4. APIは `apiModelTotals`（モデル名→件数）として返す。画面はこの値からSVGの円グラフと件数・割合の凡例を作る。

実装の集計SQLは次のとおり。

```sql
SELECT model, COUNT(*) AS q_count
FROM ai_chat_shares
WHERE user_id = ?
  AND deleted_at IS NULL
  AND created_at LIKE ?
  AND source = 'api'
GROUP BY model
ORDER BY q_count DESC;
```

パラメータは認証ユーザーの `user.sub` と `YYYY-MM%`。
`created_at` は保存時の `new Date().toISOString()` によるUTC日時で、ここで日本時間やユーザーのタイムゾーンへ変換していない。月末・月初は日本時間の暦月と集計境界がずれる。

これは**保存された質問・回答レコードの件数**である。外部AIサービスの利用統計API、Cloudflareのリクエスト数、APIキーのアクセスログ、トークン使用量、キーワード数から算出しているわけではない。AI応答があってもD1への保存が失敗した場合は集計に入らない。

## 元テーブルへ誰が書き込むか

[src/index.ts](src/index.ts) の `POST /api/aichat` は、回答の自動保存処理 `autoSave()` で `ai_chat_shares` に書き込む。モデルには実際に保存する `usedModel`、日時にはUTCの `now` を使う。Codexの回答保存にも同じ `source` 判定がある。

| 保存経路・条件 | `source` | API経由モデル別円グラフへの算入 |
| --- | --- | --- |
| `POST /api/aichat` の本文で `source='textbox'` を指定 | `textbox` | 入らない |
| 同APIで `source` が省略、または `textbox` 以外 | `api` | 入る |
| Slack AI回答の保存処理 | `slack` | 入らない |
| `saveDynamicnekoAiShare()` による外部問い合わせ結果の保存 | `dynamicneko` | 入らない |
| `POST /api/aichat/share` の保存処理 | INSERTで`source`を指定しない | 保存された値が`api`の行だけ入る |

`/aichat` の入力窓・キーワードからの質問は、[src/views/aichat.ts](src/views/aichat.ts) で `source: 'textbox'` を送る。したがって、入力窓から質問を増やしても「API経由」の件数は増えない。

`api` は保存処理が付ける出所の分類で、APIキー認証に限定した分類ではない。[src/middleware/auth.ts](src/middleware/auth.ts) の `aichatAuthMiddleware` はAPIキーの所有者を `user.sub` に設定するため、APIキー経由で保存された回答も、その所有者の集計に入る。

## 同じモーダルの別グラフとの違い

| データ・表示 | 元データと条件 |
| --- | --- |
| 日ごとのキーワード数（`days[].kw_count`） | `aichat_search_history` の未削除の検索履歴。ユーザー・月で絞り、日ごとに `COUNT(DISTINCT keyword)` |
| 日ごとの質問数・通常のモデル別円グラフ（`days[].models`） | `ai_chat_shares` の未削除の行。ユーザー・月で絞り、日付・モデルで集計。`source='api'` への限定はない |
| API経由モデル別円グラフ（`apiModelTotals`） | 上記の質問・回答レコードのうち、`source='api'` の行だけ |
| リクエスト元別円グラフ（`sourceTotals`） | 同じユーザー・月の `ai_chat_shares` を `source` 別に集計し、[src/utils/aichatSourceStats.ts](src/utils/aichatSourceStats.ts) の `buildAichatSourceTotals()` で正規化 |
| 埋め込みモデル別登録済みキーワード率 | `GET /api/aichat/keyword-embeddings/model-counts` の集計結果と、`GET /api/aichat/all-keywords` のキーワード総数を使用。質問・回答モデルの `apiModelTotals` とは別データ |

**リクエスト元別では `source` がNULLや未知の値でも `api` に正規化されるが、API経由モデル別のSQLは文字列 `'api'` との完全一致だけを数える。** そのため、リクエスト元別に「回答伝播ページ」が出ていても、API経由モデル別には元データがない場合がある。

## 円グラフが表示されないときの確認箇所

まずブラウザーのNetworkで `/api/aichat/daily-stats?month=...` のHTTPステータスとJSONを確認する。`apiModelTotals` が空か、正の件数を持つモデルがあるかを調べる。

- 画面は `d.apiModelTotals || {}` を使い、件数が正で、モデル名に `deepseek-r1` を含まないモデルだけを表示する。除外後の合計 `apiTotal` が0なら、見出し・円グラフ・凡例をすべて描画しない。
- `days` が空の場合は、API経由グラフを作る前に「この月のデータがありません」で処理を終了する。
- データ取得は `Promise.allSettled()`。daily-statsの通信が失敗すると空のオブジェクトとして処理される。また、`response.ok` を確認せず `r.json()` を読むため、JSON形式のAPIエラーもデータがないように見える場合がある。認証・D1エラーはHTTPステータスも確認する。
- 日付・ユーザー・`deleted_at`・`source` の絞り込みを確認する。別ユーザーの履歴や別月の履歴、削除済み履歴は数えない。回答の保存失敗はWorkerログの `AI chat auto-save failed` も確認する。
- 見出し・凡例・件数は出るのに円だけ出ない場合はSVG描画を確認する。現実装は単一モデルで100%の場合も1つの円弧パスを作る。開始点と終了点が同じ座標に丸められるため、円が描画されない可能性がある（コードからの推測。今回の本番の非表示原因としては未確認）。

D1で対象月の元データを確認する読み取り用SQL例:

```sql
-- user_idは画面にログインしているユーザーの識別子へ置き換える。
SELECT source, model, COUNT(*) AS q_count
FROM ai_chat_shares
WHERE user_id = '<ログインユーザーのuser.sub>'
  AND deleted_at IS NULL
  AND created_at LIKE '2026-10%'
GROUP BY source, model
ORDER BY source, q_count DESC;
```

本書は取得経路と表示条件を実装から記録したもの。今回報告された本番の非表示原因は、該当APIレスポンス・D1レコードを確認していないため未確定。


## 新規切り出しキーワード数（追加実装）

`0167_create_aichat_keyword_registry.sql` 適用後、`aichat_keyword_registry` を初出台帳として使う。
主キーは `(user_id, keyword)`、`first_share_id` は `ai_chat_shares.id` を参照するNULL許可のFKで、回答を物理削除したときは `ON DELETE SET NULL` により統計を保持する。
ユーザー識別子は既存のキーワードテーブルと同じ `user_id` を使う。セッション行はログイン状態に依存するため、`user_sessions` へのFKは設けない。

回答キーワードベクトルのINSERT成功時にD1トリガーが `first_source='answer_extraction'` で初出を記録する。
保存と同じトランザクションで確定するため、失敗時は記録されず、再実行・別回答・別埋め込みモデルで同じ語を登録しても初回日時と件数は変わらない。
検索・キーワード埋め込み・分類のINSERTにも初出記録を設け、それらで先に存在した語を後で切り出しても新規切り出し数に含めない。
✂️と同じ保存経路を利用するanswer-graph等の回答キーワード抽出も対象。

既存4テーブルの語を、確認可能な最古の日時で `first_source='legacy'` として取り込む。
過去の初回抽出日時・出所は保証できないため、日次の新規切り出し数には含めない。既存の語の再抽出は新規として扱わない。

`GET /api/aichat/daily-stats` は `legacy` を除く全経路の初回日時をユーザー・月・UTC日付で集計し、`days[].added_kw_count`（合計）と `days[].added_kw_sources`（最初の追加経路別内訳）を返す。従来の `days[].new_kw_count` は回答切り出しのみの件数として維持する。
日次モーダルに新規追加の月合計と日別件数、✂️切り出し・検索・埋め込み・分類の内訳を表示する。既存の `kw_count`（その日に検索した語の種類数）とは別の指標。
台帳はユーザーごとの語の初出のみを保持し、回答・モデル・分類の比較には従来の `aichat_answer_keyword_vectors`、`ai_chat_shares`、`aichat_keyword_category_map` を引き続き使う。


検索窓からの追加は `/api/aichat/search-log/approve` の保存成功時に検索用トリガーで初出を記録する。
同じ語を複数回答に追加しても、ユーザーの新規語は1語で、回答への紐付けは追加した回答の数だけ。
承認APIは所有する未削除回答へ実際にINSERTされた行数を `RETURNING share_id` から返し、同じ語の再承認は0件となる。
回答ごとのキーワード総数は保存済みの `aichat_search_log` を `COUNT(DISTINCT keyword)` で再集計して `keywordCounts` として返す。総数を回答レコードへ書き戻すカウンターは作らない。
承認後は画面のキーワード一覧キャッシュを破棄し、開いている日次統計・キーワード一覧を再取得する。
