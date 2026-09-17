# NOTICE: Jev(TypeSafe AI System One Model)連携の知見

日付: 2026-09-17

## Jev APIの実際のリクエスト・レスポンス形式(ドキュメントだけでは分からなかった)

`POST https://api.typesafe.ai/v1/systemone`は、事前の説明(`{ model, state, questions: [...] }`)
通りには動かない。実機のcurlで422を3往復して初めて正しい形が判明した。

- **`questions`は配列ではなく、質問IDをキーにした辞書(オブジェクト)が必須**。
  配列で送ると`{"detail":[{"type":"dict_type","loc":["body","questions"],"msg":"Input should be a valid dictionary"}]}`
- **`type:"score"`の質問には`criteria`(0側/1側の説明を2要素の文字列配列で)が必須**。
  無いと`{"msg":"Field required"}`、文字列で送ると`{"type":"list_type","msg":"Input should be a valid list"}`
- 正しい形式:
  ```json
  {
    "model": "jev-latest",
    "state": "評価対象のテキスト",
    "questions": {
      "1": { "type": "score", "question": "事実性", "criteria": ["事実誤認がある", "事実として正しい"] }
    }
  }
  ```
- レスポンスも同じキーの辞書で返る:
  ```json
  { "model": "jev-1.13.0", "answers": { "1": { "type": "score", "score": 0.96, "confidence": 0.93, "legend": {...}, "probabilities": {...} } }, "usage": {...} }
  ```
  スコアの値は`answers[id].score`に入っている(`value`や`probability`ではない。ただし
  `parseJevApiResponse`は`score`/`value`/`probability`の順で探索するフォールバックを
  持たせてあるので、どのキーで来ても壊れない設計にしてある)
- **教訓**: 新しい外部APIを使うときは、ドキュメントの記載を信じて実装を書き切ってから
  テストするのではなく、**最小構成のリクエストを1回実機に投げて成功レスポンスを
  確認してから**本実装に入るべきだった。今回はエラーメッセージの`loc`を1つずつ
  読み解きながら3往復した

## `jev_labels.options_json`の使い方(criteriaの保存場所)

`options_json`列は元々「choice/scoreの候補一覧」用に用意していたが、実際には
`criteria`(0側/1側の説明の2要素配列)をJSON文字列として保存する用途に使っている。
`question_text`列には短いラベル名(例: `事実性`)だけを入れ、詳しい説明は
`options_json`側に分離した。**理由**: 当初`question_text`に`事実性(0=事実誤認がある, 1=事実として正しい)`
のように両方を詰め込んでいたが、Jev APIの`criteria`は`question`とは独立した別フィールドで
要求されるため、後から文字列をパースして分解するのは無駄かつ壊れやすい。

## 「分析済み」の定義は1件でも評価があれば成立する(20ラベル全部揃っている必要はない)

`jev_evaluations`に`(target_type='answer', share_id, model)`の組み合わせで1行でも
存在すれば「分析済み」として扱う。20ラベル全部が埋まっているかは問わない。
これは左サイドパネルの緑背景判定・Jev分析ダッシュボードの`analyzedAnswers`集計の
両方で共通の基準にしている。**理由**: Jev呼び出しが途中で失敗しても「未分析」のまま
残ってしまう(中途半端な状態が「分析済み」と誤認識される)ことを避けたい一方、
「厳密に20件全部揃うまで未分析扱い」にすると再評価のハードルが上がりすぎるため、
実用上のバランスとして「1件でもあれば分析済み」を採用した。将来、完全性を厳密に
判定したくなった場合は`COUNT(*) = 20`のような条件に変更する必要がある

## 共有シークレット+本文emailの組み合わせは、他ユーザーへのなりすましを許す設計だった

`AICHAT_EXTERNAL_SECRET`(dynamicnekoと本体Worker間の全`*-external`共通のサービス認証)
を知っているだけの呼び出し元は、リクエスト本文に**任意の許可済みemail**を書くだけで
そのユーザーのデータを読み書きできてしまう。これは`jev-score-external`・
`jev-stats-external`で実際にセキュリティレビューにより指摘された(PR #1858, dynamicneko #187で修正)。

**対処**: 「サービス認証」(`AICHAT_EXTERNAL_SECRET`)と「ユーザー識別」を別の
シークレット(`AICHAT_USER_TOKEN_SECRET`)に分離し、dynamicneko側がセッションの
emailを`sub`に入れた短寿命JWT(60秒)を発行してから本体Workerへ送る形にした。
既存の`src/utils/jwt.ts`の`createJWT`/`verifyJWT`をそのまま再利用できた。

**注意**: この修正はJevの2エンドポイントにしか適用していない。`query-external`・
`qsearch-external`・`model-colors-external`・`cursor-agent/query-external`・
`kimi-code/generate-external`は今も本文の生emailを信頼する設計のままで、
同じ穴が残っている(EVAL.cloudflare-workers-github-oauth-1.ai-jev.md 5節参照)。

## 常設UI操作は、展開・スワイプで動く要素の中に置かない

`/ai-cache`の一括評価ボタン・チェックボックスを、当初は回答カード
(`ai-cache-question-row.tsx`のスワイプ式カルーセルの中)に置いていたが、
質問を展開・スワイプで切り替えると要素ごと画面外へ動いてしまい、死角に入って
見えなくなる不具合が実際に発生した。**教訓**: 常設で操作したいUI要素は、
展開・タブ切り替え・カルーセルなどで位置が変わる領域の外、常に同じ位置に
留まる領域(今回は左サイドパネル)に置くこと。「目立つ場所に置きたい」という
判断だけで配置場所を決めず、「その場所は本当に動かないか」を先に確認する。

## D1のCREATE TABLE文で存在しないクラス名・列名を書くと気づきにくいバグになる

モーダルのCSSで`bg-kumo-surface`という(このプロジェクトに実在しない)クラス名を
書いてしまい、背景が透明になって後ろのページが透けて見えるバグを作った。
Tailwindは未知のクラス名でもエラーを出さず、単に何のスタイルも適用しないだけなので、
見た目の異常としてしか気づけない。**教訓**: 新しいクラス名を書くときは、
同じプロジェクト内の既存コンポーネントで実際に使われているクラス名か
(`grep`等で)確認してから使う。今回は`bg-kumo-base`/`bg-kumo-elevated`が
正しい実在トークンだった。

## D1のテーブル・列名は、実装着手前にユーザーへ一度提示して確定させる

このセッションでは`jev_axes`→`jev_categories`→`jev_labels`、
`axis_id`→`category_id`→`jev_label_id`と、D1のテーブル・列名を3回リネームした。
その都度マイグレーションファイル・`STATUS_TABLE_DEFINITIONS`等の4つのregistry・
テストコードの手戻りが発生した。**教訓**: 独自に命名を決め打ちで実装を進めず、
最初の案を提示して確認を取ってから実装に入る方が、結果的に速い。特に「軸」のような
比喩表現は、意図しない含みを読み取られるリスクがあるため避け、Jevの公式語彙
(`noul`/`choice`/`score`)や既存テーブルの命名規則にできるだけ寄せる。

## マージ済みブランチへ気づかずpushを続けると、コミットが宙に浮く

このセッションでは、PRを作成した直後にユーザー(または自動マージ設定)によって
即座にマージされるケースが繰り返し発生した。マージされたことに気づかないまま
同じブランチへ追加コミットをpushしてしまうと、そのコミットは`origin/main`に
含まれないまま宙に浮く(GitHub UI上は「Merged」と表示されるPRのブランチに、
後から積んだコミットが取り残される)。**対処**: `git merge-base --is-ancestor <commit> origin/main`
で該当コミットが`main`に含まれているか確認できる。含まれていなければ、
`git checkout -b <new-branch> origin/main && git cherry-pick <commit>`で
新しいブランチへ回収してから改めてPRを出す。**教訓**: push前に対象ブランチの
PRがマージ済みでないか(`pull_request_read`等で)確認する習慣を付ける。
