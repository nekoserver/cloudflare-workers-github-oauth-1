# SPEC.cloudflare-workers-github-oauth-1.20260924.auto-explore

## AIチャットの「探索の境界線」パネルと「自動探索」機能

**対象**: `/aichat`ページ(`src/views/aichat.ts`)の「探索の境界線」パネル(`keywordBoundaryPanel`)、
「🧭 自動探索」ボタン(`autoExploreBtn`)、`src/index.ts`の
`listUnclassifiedAnswerKeywords`・`getKeywordBoundaryStats`関数と
`GET /api/aichat/keyword-boundary/unknown`・`GET /api/aichat/keyword-boundary/stats`
エンドポイント — AIチャットの回答から自動抽出したキーワードのうち
「まだ分類していないもの」を一覧表示し、それらを起点にユーザーの入力待ちを
挟まず連鎖的にAIへ問い合わせる機能一式についてまとめる。

---

## 1. 何のための機能か

AIチャットで得た回答は、回答文をベクタ化(✂️ボタン)すると同時に
「予備知識キーワード」が自動抽出され`aichat_answer_keyword_vectors`に
保存される。ユーザーはそのキーワードを`/answer-graph`ページで手動で
カテゴリ分類していくが、分類が追いつかず「まだ理解していない(=未分類の
まま放置されている)キーワード」が溜まっていく。

「探索の境界線」パネルは、この未分類キーワードを一覧表示して次に何を
学ぶべきかの手がかりにする機能。「自動探索」ボタンは、その一覧から
選んだキーワードを起点に、AIへの問い合わせ→回答のJev評価→キーワード
再抽出、という一連の処理を人の入力待ちを挟まずに最大3階層まで自動で
連鎖させる。

当初案は「このキーワードを理解済みですか?」というユーザーの自己申告
(`jev_keyword_boundary_labels`/`jev_keyword_boundary_evaluations`、
migration 0158)を根拠にしていたが、「自己申告は根拠が曖昧」という指摘を
受け、`/answer-graph`で実際にカテゴリ分類したかどうか
(`aichat_keyword_category_map`)を根拠にする方式へ置き換えた
(migration 0159で自己申告用テーブルは削除済み)。

---

## 2. UI構成(`src/views/aichat.ts`)

`/aichat`のチャット本体(`chat-wrapper`)内、チャットログとメッセージ入力欄の
間に`keywordBoundaryPanel`(`.kb-panel`)を配置する。

| 要素 | 役割 |
|---|---|
| `#keywordBoundaryChips` | 未分類キーワードのチップ一覧。各チップにチェックボックスが付き、チップ本体をクリックすると「〇〇について説明してください」が`#chatInput`に差し込まれる(単発質問用、従来通り) |
| `#autoExploreManualInput` | 一覧に出ていない(まだベクタ化すらされていない)キーワードを、カンマ・読点区切りで自動探索の起点に追加するための手入力欄 |
| `#autoExploreBtn` | 自動探索の開始/停止ボタン。実行中は「⏹ 停止」表示に切り替わる |
| `#autoExploreProgressLog`(`.kb-progress-log`) | 自動探索の実行中のみ表示される途中経過ログ。各キーワードの「AI問い合わせ/Jev処理/キー切り出し」それぞれの開始・完了(または失敗)時刻と所要秒数を1行ずつ積む |

未分類キーワードが0件でも、手入力欄から探索を始められるようパネル自体は
常に表示する(`renderKeywordBoundaryChips`)。一覧から消えた(=分類済みに
なった等)キーワードのチェック状態は保持しない。

---

## 3. 未分類キーワード一覧・集計API(`src/index.ts`)

### `GET /api/aichat/keyword-boundary/unknown`

```
GET /api/aichat/keyword-boundary/unknown?limit=20
```

- 実体: `listUnclassifiedAnswerKeywords(db, userId, limit)`
- `aichat_answer_keyword_vectors`(ベクタ化済みキーワード)を
  `aichat_keyword_category_map`(ユーザー・キーワード単位のカテゴリ紐付け)へ
  `LEFT JOIN`し、`category_id IS NULL`(=未分類)のものだけを、
  抽出日時(`computed_at`)が新しい順に返す
- `limit`は正の整数なら`Math.min(limit, 200)`、それ以外は既定`50`
- 他ユーザーのキーワード・分類状況とは`user_id`で完全に分離される
- DBエラー時は汎用「サーバーエラーが発生しました」ではなく、実際のエラー
  メッセージをそのまま返す(500)

### `GET /api/aichat/keyword-boundary/stats`

- 実体: `getKeywordBoundaryStats(db, userId)`
- ベクタ化済みキーワード(重複除去済み)のうち、分類済み(`classifiedCount`)・
  未分類(`unclassifiedCount`)の件数をそれぞれ`COUNT(DISTINCT CASE WHEN ...)`で
  集計する。自動探索の締めくくりに「分類済み◯件 / 未分類◯件」として表示する
  ための、ゆるい進捗の目安
- キーワードが1件も無ければ両方`0`を返す

いずれも`authMiddleware`必須(JWT認証)で、`user.sub`単位に閉じている。

---

## 4. 自動探索のクライアント側ロジック(`src/views/aichat.ts`)

### 4-1. 起点キーワードの決定

`runAutoExplore()`が起点集合を組み立てる:

1. チェックボックスで選んだキーワード(`keywordBoundarySelection`)
2. `#autoExploreManualInput`にカンマ・読点区切りで入力したキーワード

の和集合。**一覧に出ているものを無差別に拾うのではなく、ユーザーが選択・
入力したものだけを1階層目の起点にする**(過去に「選択されたものだけを
問い合わせろ」という指摘を受けて明示的にそう変更した経緯がある)。
起点が0件なら「自動探索するキーワードをチェックするか、入力してください」
というトーストを出して何もしない。

### 4-2. 階層探索(最大3階層)

```
AUTO_EXPLORE_MAX_LEVELS = 3
AUTO_EXPLORE_LEVEL_LIMIT = 20
```

- 1階層目: 起点キーワードのみを`autoExploreRunCandidates`で順番に処理
- 2階層目以降: `autoExploreNextLevelCandidates`が
  `GET /api/aichat/keyword-boundary/unknown?limit=20`を再取得し、
  「まだこの回で処理していないもの(`processedKeywords`)」だけを次の候補にする
  → 1階層目の処理で新たに抽出されたキーワードへ自然に掘り下がっていく設計
- 各階層はPromiseチェーンを直列につないでおり、並列実行はしない(1件ずつ順番)
- `autoExploreCancelRequested`が立った時点(「⏹ 停止」クリック)で、
  今実行中の1件が終わり次第、以降のキーワード処理をスキップする

### 4-3. 1キーワードあたりの処理(`autoExploreProcessKeyword`)

必ず次の3段階を**この順序**で行う(✂️ボタンの既存フロー
`createJevValuesWidget`/`onJevComplete`と同じく、Jev処理が完了した回答に
対してだけキー切り出しを行う設計を踏襲している。Jev処理を飛ばして
先にキー切り出しだけ行うことはしない):

1. **AI問い合わせ**: `POST /api/aichat`に
   `{ message: "<keyword>について説明してください", model: lastModel, systemPromptMode: langModeSelect.value, source: 'auto-explore' }`
   を送る。レスポンスの`shareId`が無い/エラー/非2xxなら例外を投げる
2. **Jev処理**: `POST /api/aichat/jev-score`に`{ shareId, model }`を送り、
   `data.verified === true`でなければ例外を投げる
3. **キー切り出し**: 共通スクリプト(`src/utils/vectorizeAndBulkRegister.ts`の
   `getVectorizeAndBulkRegisterScript()`)が提供する
   `vectorizeAnswerAndExtractKeywords(shareId, AICHAT_SCISSORS_EMBEDDING_MODEL, true)`
   (`POST /api/aichat/vectorize-answer`、`forcePlamo: true`で埋め込みモデルを
   強制的に`@cf/pfnet/plamo-embedding-1b`に固定)を呼ぶ。レスポンスに
   `_keywordsWarning`が付いている場合は、HTTP自体は200でも
   **明示的に失敗として扱う**(ベクタ化は成功していてもキーワード抽出が
   0件だと自動探索が実質何も進んでいないのに気付けないバグの修正、後述5-3)

いずれか1段階でも失敗したら**その場で自動探索全体を打ち切る**(コストは
気にしないが、エラーが出たら止める方針)。各段階の開始・完了・失敗は
`autoExploreRunStage`が時刻(`toLocaleTimeString`)と所要秒数付きで
`#autoExploreProgressLog`へ1行ずつ出力する。

### 4-4. `source: 'auto-explore'`について(実装上の注意)

クライアントは`POST /api/aichat`のボディに`source: 'auto-explore'`を
含めて送るが、サーバー側(`src/index.ts`)の実際の判定は

```ts
const rawSource = (body.source ?? '').trim();
const source = rawSource === 'textbox' ? 'textbox' : 'api';
```

であり、`'textbox'`以外の値はすべて`'api'`に正規化される。つまり
**現状、自動探索由来の問い合わせは通常のAPI呼び出しと区別されずに
記録される**(`source: 'auto-explore'`という値自体はサーバー側の集計・
ログには一切反映されない)。将来「自動探索だけの呼び出し回数を集計したい」
等の要件が出た場合は、この正規化ロジックの拡張が必要になる。

### 4-5. 終了処理

階層探索チェーンが完了すると:

1. `keywordBoundarySelection`をクリアし、`loadUnknownKeywordBoundaryPanel()`で
   チップ一覧を再取得(分類状況の変化を反映)
2. `GET /api/aichat/keyword-boundary/stats`を取得し、
   「分類済み◯件 / 未分類◯件」をトーストに含める
3. 停止理由に応じてトーストの文言を出し分ける:
   - 途中でエラー: 「自動探索を途中で停止しました(エラー内容) ◯◯」
   - ユーザーが停止ボタンを押した: 「自動探索を停止しました ◯◯」
   - 正常完了: 「自動探索完了 ◯◯」(成功トースト色)
4. `finally`でボタンをアイドル表示に戻す(`autoExploreRunning = false`)

---

## 5. これまでの変遷(関連コミット)

| コミット | 内容 |
|---|---|
| [`43ade83`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/43ade83e7dc804da34b78aa1f68b131df4eef6fa) | 「探索の境界線(未理解キーワード)」トラッカーを追加(当初は自己申告ベース、`jev_keyword_boundary_labels`/`evaluations`) |
| [`142a72e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/142a72ebfbbc3535bc30571eeb965d3663953893) | 自己申告方式を廃止し、`aichat_keyword_category_map`(実際の分類済み判定)を根拠にする方式へ置き換え。「自動探索」ボタンを新規追加 |
| [`09f59fa`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/09f59faaedf4bac310e85b82023141069433b204) | 自動探索の1階層目を「一覧を無差別に拾う」実装から「チェックしたキーワードだけを起点にする」実装へ修正(指摘対応) |
| [`6235d50`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6235d5008c45377f31a935987edc2f83513a5aca) | 停止ボタン・Jev処理の必須化(飛ばせないように)・段階別の進捗ログ表示を追加 |
| [`8f57c8e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8f57c8e55ca30f0e378d41e0683e686a64154c30) | 「再検索の抑止」機能(`aichat_auto_explore_history`テーブル、migration 0160)を追加し、UIをチェックボックス方式から検索窓(`autoExploreKeywordInput`)方式へ変更。**後述の通り丸ごとrevertされている** |
| [`9dfabac`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/9dfabac6155c79fb45e0e3187733f0a29f7ccdcc) | 上記`8f57c8e`(PR #2029)を丸ごとrevert。再検索抑止機能・`aichat_auto_explore_history`テーブル・検索窓UIはすべて消滅し、チェックボックス方式へ復帰 |
| [`8ef8a67`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8ef8a672cbbb625f3768c93f8fe2a7a4731025ce) | キー切り出し段階で`_keywordsWarning`が付いた場合にHTTP 200のまま「成功」扱いにしていた見逃しを修正(4-3参照)。手入力欄(`autoExploreManualInput`)から探索を開始できる現行方式を追加 |

**現状(2026-09-24時点)で有効なのは`8ef8a67`(PR #2031)までの実装**であり、
`8f57c8e`で追加された「再検索の抑止」(`aichat_auto_explore_history`、
1週間の再探索待ち等)は`9dfabac`で完全に取り消され、現在のコードベースには
一切存在しない。過去のコミットログだけを見て「再検索抑止機能がある」と
誤解しないよう、このSPECに明記しておく。

---

## 6. 関連テーブル

| テーブル | 役割 |
|---|---|
| `aichat_answer_keyword_vectors` | 回答文をベクタ化した際に抽出される予備知識キーワード(`user_id`・`share_id`・`keyword`・`model`・`vector`・`computed_at`) |
| `aichat_keyword_category_map` | ユーザーが`/answer-graph`で行ったキーワード↔カテゴリの分類結果。ここに行があるキーワードが「分類済み」 |
| `aichat_keyword_categories` | カテゴリ本体(`user_id`・`name`) |

(`jev_keyword_boundary_labels`・`jev_keyword_boundary_evaluations`は
migration 0159で削除済みの非推奨テーブル。`aichat_auto_explore_history`は
上記の通りrevert済みで存在しない)

---

## 7. テスト

| ファイル | 内容 |
|---|---|
| `src/keyword-boundary-endpoints.test.ts` | `GET /api/aichat/keyword-boundary/unknown`・`/stats`の分類済み除外、他ユーザー分離、`computed_at`降順、`limit`上限、DBエラー時のエラーメッセージ透過を検証 |
| `src/aichat-boundary-panel-selection-20260923.test.ts` | チェックボックス選択・自動探索ボタンのHTML/クライアントスクリプト側の挙動を検証 |
| `src/aichat-scissors-auto-vectorize-20260918.test.ts` | `vectorizeAnswerAndExtractKeywords`呼び出しのHTML埋め込み内容を検証 |
