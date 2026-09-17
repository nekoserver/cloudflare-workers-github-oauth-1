# AI問い合わせ・AI過去ログ応答・ai-cache・Jev評価まとめ

## 1. 全体像

**対象**: dynamicneko(別Worker)からService Binding経由で呼ばれる、本体Worker
(cloudflare-workers-github-oauth-1)側の`/api/aichat/*`エンドポイント群全体と、
dynamicnekoの`/ai-cache`ページ。

dynamicnekoは独自のログインセッションを持つが、GitHub OAuthユーザーの
本体Workerセッション(JWT)は持たない。そのため、dynamicnekoの各機能は
本体Workerに対して**Bearer secret(`AICHAT_EXTERNAL_SECRET`)+ Service Binding**
で認証する専用の`*-external`エンドポイント経由でD1・AIバインディングにアクセスする。

登場人物は大きく4つ:

```
① AI問い合わせ           dynamicnekoの「AIに聞く」ウィジェット
                          → /api/aichat/query-external (AIチャット本体)
                          → /api/aichat/permission-external (事前許可チェック)

② AI過去ログ応答          dynamicnekoの/ai-cacheページ(検索・回答表示)
   (qsearch)              → /api/aichat/qsearch-external (質問文検索)
                          → /api/aichat/qsearch-external/latest-answer (回答本文取得)
                          → /api/aichat/model-colors-external (モデル色凡例)

③ Jev評価                /ai-cacheの左サイドパネルの一括評価・チェックボックス
                          → /api/aichat/jev-score-external (個々の回答をJevで評価)
                          → jev_label_groups / jev_labels / jev_evaluations (D1)

④ Jev分析ダッシュボード    /ai-cache左サイドパネル最下段の展開セクション
                          → /api/aichat/jev-stats-external (全体集計)
```

全て`ai_chat_shares`(質問・回答本文の実体)を土台にしており、`share_id`が
「検索キーワード履歴」「回答本文」「Jev評価結果」を貫通する共通キーになっている。

## 2. AI問い合わせ(query-external)

**対象**: `POST /api/aichat/query-external`・`POST /api/aichat/permission-external`
(`src/index.ts`)、dynamicnekoの「AIに聞く」ウィジェット。

- `permission-external`: 送信前にUIをグレーアウトするための事前チェック。
  `dynamicneko_aichat_allowed_users`に登録済みメール かつ `github_login`登録済みかを見る
- `query-external`: 実際の問い合わせ本体。`permission-external`と同じ判定を
  **必ず再検証**してからAIバインディングを呼ぶ(クライアント側のグレーアウトは
  UXのためだけで、ここを省略すると未許可ユーザーの分もAI課金が発生してしまう)
- 認可判定に使う`login`(D1の`user_id`)は、リクエスト本文からは一切受け取らない。
  `email`だけを受け取り、`resolveDynamicnekoAllowedLogin`でDB側の登録済み`github_login`
  を引く。過去に「本文の`login`をそのまま信用する」実装で他ユーザーになりすませる
  脆弱性(PR #1809/#1810)が実際に発覚しており、その再発防止パターン
- 回答は`saveDynamicnekoAiShare`で`ai_chat_shares`に保存される(`/neko qsearch`・
  `/ai-cache`の検索対象に自動的に乗る)

## 3. AI過去ログ応答(qsearch系)

**対象**: `POST /api/aichat/qsearch-external`・`.../latest-answer`・
`POST /api/aichat/model-colors-external`(`src/index.ts`)、dynamicnekoの
`/ai-cache`ページの検索窓・左サイドパネル・回答カード。

- `qsearch-external`: `ai_chat_shares`から質問文・回答文にキーワードを含む行を検索し、
  `{id(=share_id), question, model}`の一覧を返す。**回答本文は含めない**
  (件数が多いと重く、行をクリックするまで表示しない設計に揃えている)
- `qsearch-external/latest-answer`: 質問ID(`share_id`)+ モデル名を指定して、
  一致する最新の回答本文を1件だけ返す
- `model-colors-external`: `/ai-cache`左サイドパネルの言語モデル色丸凡例用の
  データを返す(ユーザー固有ではないため`email`の許可チェックのみ、login解決は行わない)
- 認可パターンはquery-externalと同じ(本文の`login`は信用せず、`email`→DB登録済み
  `login`を経由する)

### dynamicneko側プロキシ

`src/server.ts`の`POST /api/ai-cache/qsearch`・`.../qsearch/latest-answer`・
`GET /api/ai-cache/model-colors`が、ログイン中セッションの`email`を使って
上記`*-external`を中継する。qsearchのヒットは`recordAiCacheSearch`で
dynamicneko側D1(`ai_cache_search_keywords`等)にも記録され、検索キーワード
履歴として後から追える。

## 4. ai-cacheページ(dynamicneko UI)

**対象**: `dynamicneko/src/client.tsx`の`AiCachePage`、
`dynamicneko/src/components/ai-cache-question-row.tsx`の`AiCacheQuestionRow`。

画面構成:

- **左サイドパネル**(`<aside>`、常に同じ位置に表示され続ける):
  - StylePicker(シンタックスハイライトテーマ)
  - 「言語モデル」`<details>`: 色丸凡例
  - 「質問文」`<details>`(`questionJumpOpen`): キーワード検索でヒットがあると
    自動で開くジャンプリスト。各行に**背景色**(緑=Jev評価済みあり)と
    **行頭チェックボックス**(未評価が残る質問にのみ表示)、上部に
    「チェック済みを一括評価」ボタンを持つ(詳細は5節)
  - 「Jev分析ダッシュボード」`<details>`: 展開時に初回だけ集計取得(詳細は6節)
- **メインコンテンツ**(画面右側): 検索窓+`AiCacheQuestionRow`のリスト。
  1質問ぶんの行が、その質問に回答した各モデルの色丸をスワイプで切り替えて
  回答文を表示する(展開・スワイプで見た目が動く)

**設計上の教訓**: Jevの一括評価チェックボックス・ボタンは当初この
`AiCacheQuestionRow`(メインコンテンツ側)に置いていたが、展開・スワイプで
見た目が動くため質問を切り替えると死角に入る不具合があった。**常に同じ位置に
表示され続ける左サイドパネル側に置き直した**(#177→#181で移設)。UIの
「動く場所」と「固定される場所」を区別し、常設操作は固定される場所に置くこと。

## 5. Jev評価の仕組みとテーブル設計

**対象**: `migrations/0144_create_jev_tables.sql`、`jev_label_groups`・
`jev_labels`・`jev_evaluations`テーブル、`src/utils/jevEvaluation.ts`。

Jev(TypeSafe AI System One Model)は文章生成用の通常LLMとは異なり、
あらかじめ決めた候補・尺度に対して高速・低コストに確率的な判定だけを返す
モデル(`POST https://api.typesafe.ai/v1/systemone`)。本リポジトリでは
`type: "score"`(0〜1の連続スコア)専用で、20個の固定ラベル(観点)を使い、
AIチャット回答の品質をモデル横断で大まかに比較する目的で使っている。

```sql
CREATE TABLE jev_label_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,               -- 事実の正確さ/論理・整合性/伝わりやすさ/応答姿勢・手続き
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE jev_labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_type TEXT NOT NULL,      -- 'score'固定
  question_text TEXT NOT NULL,      -- 短いラベル名(例: '事実性')
  options_json TEXT,                -- criteria(0側/1側の説明、2要素のJSON配列)
  jev_group_id INTEGER NOT NULL REFERENCES jev_label_groups(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE jev_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL,        -- 'answer' または 'source_question'
  share_id TEXT NOT NULL,           -- ai_chat_sharesの質問ID(qsearchのidと同じ)
  user_id TEXT NOT NULL,
  model TEXT,                       -- source_questionの場合はNULL(モデル非依存)
  jev_label_id INTEGER NOT NULL REFERENCES jev_labels(id),
  value REAL NOT NULL,              -- 0〜1のscore
  computed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 設計判断

- **`jev_label_groups`/`jev_labels`は追記専用(UPDATE禁止)**。ラベルを
  変えたくなったら新しい行を追加する。同じ`jev_label_id`が指す質問文は
  永久に変わらないため、過去の`value`と矛盾しない
- **`share_id`が全ての紐付けの起点**。qsearchの検索結果・キーワード履歴・
  回答本文・Jev評価結果は全て同じ`share_id`で繋がっている
- **`target_type`で「回答」と「元の質問文」を同じラベル基準で評価できる**。
  質問の具体性が高いのに回答の具体性が低ければモデルの問題、質問の具体性自体が
  低ければ聞き方の問題、と切り分けられる
- 「分析済み」の定義は、`(target_type='answer', share_id, model)`の組み合わせが
  `jev_evaluations`に1件でも存在すること。20ラベル全部が揃っている保証は要求しない
  (左サイドパネルの緑背景判定・ダッシュボードの分析済み件数どちらも同じ基準)

### Jev APIの実際の仕様(実機検証で判明した点)

`questions`は配列ではなく**質問IDをキーにした辞書(オブジェクト)**が必須
(配列で送るとHTTP 422)。`type: "score"`の質問には`criteria`(0側/1側の説明を
**2要素の文字列配列**で)が必須(無いと422、文字列で送っても422)。

```json
{
  "model": "jev-latest",
  "state": "評価対象の回答本文(またはtarget_type=source_questionなら質問文)",
  "questions": {
    "1": { "type": "score", "question": "事実性", "criteria": ["事実誤認がある", "事実として正しい"] }
  }
}
```

レスポンスも同じキーの辞書(`{"answers": {"1": {"type":"score","score":0.96,...}}}`)。

## 6. Jev評価API・分析ダッシュボードAPI

**対象**: `POST /api/aichat/jev-score-external`・`POST /api/aichat/jev-stats-external`
(`src/index.ts`)、`src/utils/jevEvaluation.ts`のコアロジック。

### jev-score-external

`share_id`+`model`(+`targetType`)を受け取り:

1. `jev_labels`全件と、既に評価済みの`(target_type, user_id, share_id, model, jev_label_id)`を取得
2. `computeJevEvaluationPlan`で未評価ラベルだけを`pending`に絞る(重複呼び出し・
   重複課金の防止。全ラベル評価済みならJevを一切呼ばずキャッシュ済みの値だけ返す)
3. `callJevApi`でJevへ問い合わせ、結果を`jev_evaluations`にINSERT
4. 評価済み(cached)+新規(newly evaluated)をまとめて返す

`jev_labels.options_json`が不正(2要素配列としてparseできない)な場合は
黙って進めず500エラーで停止し、ログに記録する(ルール8: 記録・通知・テスト)。

### jev-stats-external

ユーザー単位で以下を集計して返す:

- `totalAnswers`: `ai_chat_shares`の全登録件数
- `analyzedAnswers`: Jev分析済み件数(`(share_id, model)`の組み合わせ単位)
- `byModel`: モデルごとの分析済み件数・平均score(スコア降順)
- `byLabel`: ラベル(分析観点)ごとの平均score(スコア降順)

## 7. Jev分析ダッシュボード(UI)

**対象**: `dynamicneko/src/client.tsx`の`AiCachePage`内、左サイドパネル最下段の
「Jev分析ダッシュボード」`<details>`、`dynamicneko/src/ai-cache-jev.ts`の
`buildConicGradientCss`/`analyzedRatioPercent`。

- 展開(`onToggle`)時に初回だけ`GET /api/ai-cache/jev-stats`を取得し、以後は
  再展開しても再取得しない(手動での再取得手段は無く、一括評価完了時の
  自動再取得のみ)
- 表示内容: ①全登録件数に対する分析済み件数の比率(円グラフ)、②分析済み件数の
  モデル別内訳(円グラフ、色は左サイドパネルの言語モデル凡例と共通)、
  ③モデル別平均scoreのテーブル(降順)、④ラベル別平均scoreのテーブル(降順)
- 円グラフは外部ライブラリを使わず、CSSの`conic-gradient()`で構成(既存の
  スニペットスタイルサンプルと同じ手法)
- **一括評価が完了すると(成功・失敗いずれも)自動で再取得**し、再取得完了直後に
  左サイドパネルの「質問文」ドロップダウンを閉じる(`runBulkJev`→`openJevStats`
  →`setQuestionJumpOpen(false)`の順)

## 8. セキュリティ: userTokenによるユーザー識別の分離

**対象**: `src/utils/jwt.ts`の`createJWT`/`verifyJWT`の再利用、
`jev-score-external`・`jev-stats-external`の認可、
dynamicneko`src/utils/aichatUserToken.ts`。

セキュリティレビューで、`jev-score-external`・`jev-stats-external`が
リクエスト本文の`email`をそのまま信頼していたため、`AICHAT_EXTERNAL_SECRET`
(全`*-external`共通のサービス認証)を知っているだけの呼び出し元が任意の
許可済み`email`を名乗って他ユーザーのJevデータを読み書きできる脆弱性が
指摘された。対応として、この2エンドポイントだけ以下に変更:

- リクエスト本文の`email`を廃止し、`userToken`(短寿命JWT、`sub`=email、
  有効期限60秒)を必須にする
- 署名鍵は`AICHAT_USER_TOKEN_SECRET`という**`AICHAT_EXTERNAL_SECRET`とは
  別のシークレット**にする。同じ鍵だと「サービス認証」と「ユーザー識別」が
  同じ秘密情報に依存し、今回の脆弱性そのものになるため
- dynamicneko側は`createAichatUserToken(session.email, secret)`でリクエスト
  直前にトークンを発行し、本体Worker側は既存の`verifyJWT`でそのまま検証する
  (新規のトークン実装はdynamicneko側の署名部分のみ)

**注意**: `query-external`・`qsearch-external`等、他の`*-external`エンドポイントは
今回のuserToken化の対象外(このSPECの範囲はJev関連2エンドポイントの修正)。
同じ「本文の`email`をそのまま信頼する」設計を他のエンドポイントも共有しており、
将来的に同種の指摘が入れば同じ方式で塞ぐ想定。

## 9. 関連コミット(cloudflare-workers-github-oauth-1)

- [`18b9ff7`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/18b9ff751dd0a0934d13a55c59c4dc78ca514000) PR #1854: Jevテーブル設計・`jev-score-external`実装
- [`5bc02fa`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5bc02faa6b9cc00662b2241ce7465fa6afc71efb) PR #1855: `questions`を配列から辞書形式に修正
- [`8fb181b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8fb181b671f8c773f10006fa642475bc9f9ec28a) PR #1856: `criteria`(0/1側説明の2要素配列)を追加
- [`1f37cba`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/1f37cbaa8f374658ad688e118375b27070497324) PR #1857: `jev-stats-external`(分析ダッシュボード集計API)を追加
- [`958898a`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/958898a) PR #1858: `userToken`によるユーザー識別の分離(セキュリティ修正)

## 10. 関連コミット(dynamicneko)

- [`08217b5`](https://github.com/nekoserver/dynamicneko/commit/08217b5) PR #177: `/ai-cache`一括評価ボタンを追加
- [`c6f2313`](https://github.com/nekoserver/dynamicneko/commit/c6f2313) PR #178: `hasJevResult`による緑背景表示
- [`7bc1575`](https://github.com/nekoserver/dynamicneko/commit/7bc1575) PR #179: チェックボックス追加(モデル別、後に見直し)
- [`c270f4a`](https://github.com/nekoserver/dynamicneko/commit/c270f4a) PR #180: チェックボックスを質問行1個に統合
- [`eed9676`](https://github.com/nekoserver/dynamicneko/commit/eed9676) PR #181: チェックボックス・ボタンを左サイドパネルへ移設(設置場所の修正)
- [`69d2074`](https://github.com/nekoserver/dynamicneko/commit/69d2074) PR #182: 結果モーダルの背景透明バグ修正
- [`33eb89e`](https://github.com/nekoserver/dynamicneko/commit/33eb89e) PR #183: ボタンに対象件数・「評価対象なし」を明示
- [`7d11b4b`](https://github.com/nekoserver/dynamicneko/commit/7d11b4b) PR #184: Jev分析ダッシュボード(円グラフ・リスト)を追加
- [`ecf3060`](https://github.com/nekoserver/dynamicneko/commit/ecf3060) PR #185: ダッシュボードをモーダルから左サイドパネル展開表示へ変更
- [`f778851`](https://github.com/nekoserver/dynamicneko/commit/f778851) PR #186: 一括評価直後にダッシュボードを毎回再取得
- [`58f5645`](https://github.com/nekoserver/dynamicneko/commit/58f5645) PR #187: `userToken`送信への対応(セキュリティ修正)
- [`390ce8d`](https://github.com/nekoserver/dynamicneko/commit/390ce8d) PR #188: 一括評価後にダッシュボード更新→質問文ドロップダウンを閉じる

## 11. 今後の課題

- 引用評価(回答をハッシュ経由でネット接続モデルに評価させる仕組み)は未着手・未設計。
  作る場合もJevのテーブルには混ぜず、`share_id`を外部キーとして共有するだけの
  別テーブルにする方針のみ決定済み
- `query-external`・`qsearch-external`等、Jev以外の`*-external`エンドポイントは
  本文の`email`をそのまま信頼する設計のままで、userToken化していない
- 過去分の回答へのラベルバックフィルは無し(今後の新規評価分から対象。新しい
  ラベルを追加しても既存データと矛盾しない設計のため、後から気が向いた時に
  バックフィルジョブを別途書けばよい)
