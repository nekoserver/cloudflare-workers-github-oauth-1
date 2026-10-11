# EVAL.cloudflare-workers-github-oauth-1.20261011.judgment-models-current-state

## Jev呼び出しの現状評価: 抽象化されているか

**対象**: Jev(TypeSafe AI)を呼び出している全箇所——
`src/utils/jevEvaluation.ts`・`src/utils/jevScoreFlow.ts`・
`src/utils/queryPatternAnalysis.ts`・`src/index.ts`内の各ルート
ハンドラ、および`/jev-playground`・`/jev-playground-external`。
「プロバイダ(JevかClefか)を後から切り替えられる抽象化がどこまで
できているか」を評価する。総論(比較)は
[`SPEC.cloudflare-workers-github-oauth-1.20261011.judgment-models-overview.md`](SPEC.cloudflare-workers-github-oauth-1.20261011.judgment-models-overview.md)、
今後の方針は
[`PLAN.cloudflare-workers-github-oauth-1.20261011.judgment-models.md`](PLAN.cloudflare-workers-github-oauth-1.20261011.judgment-models.md)
を参照。

---

## 0. 結論

**抽象化はされていない。** `callJevApi()`(`src/utils/jevEvaluation.ts`)
という単一の低レベル関数がJevのHTTPエンドポイント・認証方式・
リクエスト/レスポンススキーマを直接埋め込んでおり、呼び出し元は
全てこの関数(または`callJevApi`を内部で呼ぶラッパー)を直接importして
`c.env.JEV_API_KEY`を直渡ししている。「プロバイダ」という概念、
プロバイダ選択のための分岐、Clefへのフォールバック経路は、
コードベース全体を検索しても存在しない。

テスト用に`fetchImpl`を注入できる作りにはなっているが、これは
「本物のネットワークアクセスをテストで発生させない」ためのモック
差し替えポイントであり、プロバイダ切り替えの抽象化ではない。

---

## 1. Jev呼び出しの全箇所

### 1.1 低レベル関数(唯一の搬送路)

| 関数 | ファイル | 役割 |
|---|---|---|
| `callJevApi()` | `src/utils/jevEvaluation.ts` | `https://api.typesafe.ai/v1/systemone`へのfetch・リクエスト組み立て(`buildJevRequestBody`)・レスポンス解析(`parseJevApiResponse`)を1本化した唯一の低レベル関数 |

### 1.2 構造化スコアリング経路(`callJevApi`を間接的に呼ぶ)

| 呼び出し元 | 用途 | テーブル |
|---|---|---|
| `runJevScoreForShare()`(`jevScoreFlow.ts`)← `POST /api/aichat/jev-score` | AIチャット回答・質問文の評価(本題) | `jev_labels`/`jev_evaluations` |
| `runJevScoreForKeyword()`(`jevScoreFlow.ts`)← `POST /api/aichat/jev-score-keyword` | 国名キーワードの評価 | `jev_country_keyword_labels`/`jev_country_keyword_evaluations` |
| `evaluateTable()`(`queryPatternAnalysis.ts`)← `/api/cf-dashboard`系 | D1テーブルのクエリパターン判定(A〜L、12問) | `jev_table_pattern_scores` |

### 1.3 構造化スコアリング経路(`callJevApi`を直接呼ぶ、`index.ts`内)

| 行(目安) | エンドポイント | 用途 |
|---|---|---|
| `index.ts:15806`付近 | `POST /api/aichat/jev-score-external` | dynamicneko用の外部版。**`runJevScoreForShare()`を再利用せず、同じロジックを別実装している**(2.1節で指摘) |
| `index.ts:16236`付近 | `POST /api/aichat/jev-vuln-score-external` | コミットメッセージの脆弱性診断 |
| `index.ts:16686`付近 | `POST /api/aichat/jev-test-score-external` | diffのテスト充足度診断 |

### 1.4 生パススルー経路(`callJevApi`を使わない、別実装)

| エンドポイント | 用途 |
|---|---|
| `POST /api/jev-playground` | 本体Worker用Jev Playground。`callJevPlaygroundApi()`が検証済みpayloadをそのまま`api.typesafe.ai`へ転送する |
| `POST /api/jev-playground-external` | dynamicneko用の同上 |

**注意**: この生パススルー経路は、構造化スコアリング経路
(`callJevApi`/`buildJevRequestBody`/`parseJevApiResponse`)と
**コードを共有していない**。将来Clef対応する場合、この2つの経路を
同時に1つの抽象化でカバーすることはできず、個別に対応が必要になる
(Clef Playground(`src/utils/clefPlayground.ts`)は既にこの生
パススルー経路の対になるものとして実装済み)。

### 1.5 補足: AIチャットの「既存の応答フロー」にJevが組み込まれている箇所は、クライアント側では2箇所だけ、サーバー側は1関数に集約されている

この事実はこれまで複数のSPEC/EVALに断片的にしか書かれていなかった
(auto-explore側の呼び出しは
[`SPEC.cloudflare-workers-github-oauth-1.20260924.auto-explore.md`](SPEC.cloudflare-workers-github-oauth-1.20260924.auto-explore.md)
4-3節に記載があるが、📔ボタン側の呼び出しとの関係や「これで全数か」は
どこにも明記されていなかった)ため、ここで`grep`による実測で確定させる。

`POST /api/aichat/jev-score`をクライアント側から呼んでいる箇所は、
`src/views/aichat.ts`の以下の2箇所のみ(`src/`全体を検索して確認済み。
`src/views/apis.ts`・`src/data/apiEndpointList.ts`はAPIカタログ表示用の
記述であり呼び出しではない)。

| 呼び出し元(関数) | 行(目安) | トリガー |
|---|---|---|
| `runJevScoreAndShow()` | `aichat.ts:4967` | 詳細プレビューモーダルの📔ボタン(ユーザーが手動で押す) |
| `autoExploreProcessKeyword()` | `aichat.ts:7257` | 自動探索パイプラインの2段階目(自動実行、4-3節参照) |

この2箇所は**どちらも同じエンドポイント(`POST /api/aichat/jev-score`)を
叩き、サーバー側は必ず同じ1つの関数`runJevScoreForShare()`
(`jevScoreFlow.ts`)を通る**(ルートハンドラ自体は認可・バリデーションの
薄いラッパーで、実処理は全てこの関数に委譲している)。

**含意**: 「既存のAI応答フローに組み込まれたJev問い合わせ」を変更・
抽象化する必要が生じた場合、触る場所は実質1箇所(`runJevScoreForShare()`、
または呼び出し元の`/api/aichat/jev-score`ハンドラ)に限定される。
クライアント側の2つの呼び出し元(📔ボタン・自動探索)は、サーバー側の
実装を意識せずどちらも恩恵を受ける(またはどちらも影響を受ける)。

一方、PLANで採用した「新テーブル(`clef_evaluations`)+新規エンドポイント
(`/api/aichat/clef-score`)を追加するだけ」という方針では、**この1関数には
一切触らない**。そのため、この節で確定させた「唯一の経路」は今回の
拡張作業では変更対象にならない(将来、本当にJevからClefへ本番を
切り替える判断をした時にのみ、この節の情報が変更対象の特定に使える)。

---

## 1.5 合計呼び出し箇所数

- 構造化スコアリング: **6箇所**(1.2の3箇所 + 1.3の3箇所)
- 生パススルー: **2箇所**(1.4、Jev側。対になるClef側は実装済み)

---

## 2. 設計上の問題点(抽象化とは別の既存の技術的負債)

### 2.1 `jev-score-external`が`runJevScoreForShare()`を再利用していない

**対象**: `index.ts:15690`付近の`POST /api/aichat/jev-score-external`。

コメントには「既に評価済みのラベルは再送しない」「ベリファイする」等、
`runJevScoreForShare()`と全く同じ設計意図が書かれているにもかかわらず、
`fetchAllLabels`・`fetchEvaluatedRows`・書き込み・ベリファイのロジックを
インラインで再実装している。これは単純な重複であり、将来プロバイダ
抽象化を導入する際も、この箇所だけ別に直す必要が生じる
(「1箇所直せば済む」という前提が成り立たない現状)。

**あるべき設計**: `runJevScoreForShare()`を呼ぶだけにして、
認可・login解決(dynamicneko向けのuserToken検証)だけをこの
エンドポイント固有の処理として残すべき。

### 2.2 プロバイダ選択のための設定値がどこにも存在しない

Cookie・D1のユーザー設定・環境変数のいずれにも、「Jevを使うかClefを
使うか」を表す値は存在しない。CLAUDE.mdルール27(D1優先→Cookie→
デフォルトの解決順)に準拠した設定値を新設する余地がそのまま空いている
(既存の衝突や後方互換の心配をせずに追加できる、という意味では
「抽象化していないこと」自体はマイナスではなく、むしろ白紙から
設計できる状態)。

---

## 3. まとめ

| 問い | 評価 |
|---|---|
| Jevは抽象化されているか | **されていない**。単一プロバイダ(Jev)前提で6+2箇所がハードコード |
| Clefとの切り替えは困難か | 困難ではないが、無検証ではない(SPEC4節・PLAN参照)。`callJevApi`の呼び出し元を全て書き換える必要はなく、関数の内部実装(または差し替え用の新しい振り分け関数)を1箇所変えるだけで済む設計に持っていける |
| 再抽象化は可能か | 可能。既存の`JevApiResult`(判別可能な戻り値型、ルール32準拠)の形を保ったまま、低レベル関数だけをプロバイダ別に差し替える設計が素直に成立する |
