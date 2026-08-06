# SPEC.cloudflare-workers-github-oauth-1.ANSWER-GRAPH.md

## 1. このドキュメントについて

**対象**: `/answer-graph` ページ(`src/views/answerGraph.ts`)、および同ページが使う
`POST /api/aichat/answer-propagation-graph`・`GET /api/aichat/shares/search`・
`GET /api/aichat/all-keywords` 等のAPI群 — 本ページの「基本設計(ユーザーとワーカーの
やり取りのループ構造)」を初期仕様として固め、以後の拡張の土台とする。

このページは「過去のAIチャット共有(質問と回答のペア)を、キーワードを手がかりに
連想的に辿っていく」ための探索UIである。個々の機能(経路列・絞り込みモーダル・
一人称モード等)は個別のPR/SPECで追加されてきたが、本ドキュメントはそれらを貫く
**基本ループの設計**を1か所に明文化する。

## 2. 基本設計: ユーザーとワーカーの対話ループ

ページの中核は、以下の6ステップからなるループである。奇数番はユーザーの操作、
偶数番はワーカー(サーバー/クライアントJS)の応答を表す。

| # | 主体 | 内容 |
|---|---|---|
| 1 | ユーザー | 中分類カテゴリから任意のキーワードを選ぶ(大分類ラジオ→中分類`<select>`のカテゴリクイックナビ) |
| 2 | ワーカー | そのキーワードで`/api/aichat/shares/search`を検索し、初期データ(起点候補の質問一覧)を機械的に用意して表に描画する |
| 3 | ユーザー | その中から初期質問を選ぶ(**初回の起点確定**。行タップで`loadGraph`が走り、`/api/aichat/answer-propagation-graph`がBFSでグラフを構築する) |
| 4 | ワーカー | 選択された初期質問とペアになる回答文から、その中に含まれるキーワード群を**選択可能な状態で**画面上に表示する(表の真上の「この回答文のキーワード:」バー `#answerKeywordsBar`) |
| 5 | ユーザー | 表示されたキーワード群の中から任意のキーワードを選ぶ(チップをタップ) |
| 6 | ワーカー | 選択されたキーワードを**ステップ2で選んだキーワードと同等の扱い**で再検索し、以後「2.→6.」を繰り返す |

### ループの終端と画面フォーカスの移動

- ループ中に任意の質問文の行がタップされたら、いったんフォーカスは**画面下のグラフ
  描画(俯瞰ビュー)**に移る。タップされた質問が新しい起点となり、グラフが再構築される
- **一人称モードボタン**(`🧑‍🚶`)が押されたらそこにフォーカスが移り、一人称視点での
  探索(現在地の回答→周囲のキーワード→先に進む、の一連の処理)が実行される

### ループを支える補助機能(実装済み)

| 機能 | 実装 | ループ内での役割 |
|---|---|---|
| 経路列 | `computeAnswerPathStages` / `formatSearchResultPath` | 検索結果の各行が「起点から何段階のキーワード選択で到達できるか」を表示し、ステップ3の選択を助ける |
| 空行の非表示 | `shouldHideSearchResultRow`(設定`answer_graph_hide_empty_rows`、デフォルトON) | キーワード数0・経路「ー」の行を作表時に一括除外し、ループを意味のある行だけで回す |
| 作表後の並び順 | `doSeedSearch`で`count-desc` | キーワード数の多い行(=次の展開が豊富な行)を上に出す |
| 🧭絞り込みモーダル | `computeNarrowingKeywordCandidates` / `renderNarrowModal` | 検索結果全体から次に選べるキーワードを出現回数順に提案する、ステップ5の別入口 |
| ノード半径 | `computeAnswerNodeRadius` / `computeKeywordNodeRadius` | 俯瞰ビューでキーワードが多い回答(オアシス)・よく使われるキーワードを大きく描く |
| パン屑リスト(選択履歴の足跡) | `computeTrailAfterJump` / `renderSelectionTrail` 等(詳細は4.1) | ステップ1〜6の選択のたびに足跡を`#selectionTrailBar`へ積み、巻き戻しを可能にする |

## 3. データフローの前提

- 各回答のキーワードは `aichat_search_log` の `share_id` 紐づけが唯一の情報源
  (回答本文への部分一致で人気キーワードをぶつける方式は汎用語が混入するため使わない)
- グラフは `buildAnswerPropagationGraph`(`src/index.ts`)がBFSで構築する。
  ノードは `a:{shareId}`(回答、偶数depth)と `k:{keyword}`(キーワード、奇数depth)が
  交互に現れる木構造
- 同じ層のキーワード群に対する`ai_chat_shares`の検索は、D1のバインド上限に収まる
  単位でバッチ化されている(N+1回避。詳細は
  [`NOTICE.cloudflare-workers-github-oauth-1.20260806.md`](NOTICE.cloudflare-workers-github-oauth-1.20260806.md))

## 4. パン屑リスト(選択履歴の足跡)

**対象**: `#selectionTrailBar`(検索欄の真上)、`selectionTrail`配列、
`computeTrailAfterJump`/`pushTrailKeyword`/`pushTrailSeed`/`jumpToTrailIndex`/
`resetSelectionTrail`(`src/views/answerGraph.ts`)。ステップ1→5→5'→5''…と
キーワードを選びながら進む過程で、どの経路を辿って今の検索結果に至ったかを
画面上に足跡として残す。**実装済み**(4.1)。

### 4.1 表示・操作仕様

- 表示イメージ(検索欄の上に横並びのチップ列。`›`区切り):

  ```text
  📄 旅行の質問 › 東京駅 › 新幹線 › 駅弁
  ```

- 足跡が積まれるタイミング:
  - 検索結果行の選択(起点確定・以後のフォーカス移動) → `pushTrailSeed(shareId, question)`。
    見た目はキーワードと区別するため `📄` 付きの角丸四角(`.trail-chip-seed`)
  - 中分類カテゴリの`<select>`選択、「この回答文のキーワード:」バーのチップ、
    🧭絞り込みモーダルのチップ → いずれも `pushTrailKeyword(keyword)`。
    中分類`<select>`はループの起点(ステップ1)を表すため、選択前に
    `resetSelectionTrail()`してから積む
- 各足跡はタップ可能。タップすると`jumpToTrailIndex(index)`でその時点まで
  巻き戻し(`computeTrailAfterJump`、それ以降の足跡は破棄)、キーワードなら
  `doSeedSearch`で再検索、起点(質問)なら`loadGraph`でグラフを再読み込みする。
  巻き戻し自体は新たな足跡を積まない
- 末尾(現在地)のチップは`disabled`でクリック不可
- 手入力検索(`seedSearchInput`の`input`イベント)が行われたら足跡は
  `resetSelectionTrail()`でリセットされる(ループ外の操作のため)
- `✕ クリア`ボタンでいつでも足跡をリセットできる

### 4.2 保存(sessionStorage) — 同意ベース・デフォルトOFF

足跡には検索履歴・回答内容に由来する情報(質問文・キーワード)が含まれるため、
**ユーザーが設定ページで明示的に同意(ON)しない限り一切保存しない**。

- 設定: `/settings`の「answer-graph: パン屑リスト(選択履歴の足跡)を
  ブラウザのsessionStorageに保存し、リロード後も復元する」トグル
  (デフォルトOFF)。Cookie `answer_graph_trail_session_storage`(`on`の場合のみ有効。
  他のanswer-graph設定`answer_graph_hide_empty_rows`とは逆に、デフォルトが
  無効側であることに注意)
  - 解決関数: `resolveAnswerGraphTrailSessionStorage(cookieHeader)`(`src/index.ts`)
  - 変更エンドポイント: `POST /api/settings/answer-graph-trail-session-storage`
- クライアント側: `getAnswerGraphPage`の`trailSessionStorageDefault`引数で
  初期値を埋め込み、`trailSessionStorageSetting`というJS変数として保持する
  - 保存: `renderSelectionTrail()`のたびに`persistSelectionTrail()`を呼び、
    設定がONなら`sessionStorage.setItem('answerGraphSelectionTrail', ...)`、
    OFFなら`sessionStorage.removeItem(...)`(同意していない場合は保存しない
    だけでなく、過去に残っていたデータも消す=同意の取り消しを尊重する)
  - 復元: ページ初期化時(`restoreSelectionTrail()`)に、設定がONなら
    `sessionStorage`から読み込んで`selectionTrail`へ反映。設定がOFFなら
    (前回ONだった名残りがあり得るため)ここでも`removeItem`する
- `sessionStorage`はタブを閉じるまでの保持であり、他ページ・他タブ・
  サーバー側へは一切送信されない(D1永続化とは別物。D1永続化は4.3の
  拡張案として引き続き検討対象)

### 4.3 さらなる拡張案(優先度順)

1. **足跡のD1永続化(タブを閉じても残す・複数端末で共有)** — 4.2の
   sessionStorageは「同じタブ内でのリロード」までしか耐えられない。
   D1(例: `answer_graph_trail_log`)に記録すれば、「よく辿る経路」の分析や、
   次回訪問時の「前回の続きから」ボタンに発展できる。sessionStorage版と
   同様に**デフォルトOFF・設定ページでの明示同意が必須**とすること
2. **キーワードバーと🧭モーダルの統合** — ステップ4のキーワードバー(現在地の
   回答文のキーワード)と🧭絞り込みモーダル(検索結果全体からの候補)は役割が近い。
   バー側に「もっと見る→モーダル」の導線を付けると、ループの入口が1つに整理される
3. **足跡とグラフの連動ハイライト** — パン屑の足跡をホバー/タップしたとき、俯瞰
   グラフ上の対応するキーワードノード・回答ノードを強調表示する。
   `lastLayout.posById['k:'+keyword]`で位置は即座に引けるため実装コストは低い
4. **一人称モードへの足跡引き継ぎ** — 一人称モードの前進/後退も`selectionTrail`に
   追記すれば、俯瞰⇄一人称を行き来しても1本の履歴として繋がる
5. **経路列とパン屑の表現統一** — 経路列の「1. kwA/kwB → 2. kwC」とパン屑の
   「kwA > kwC」は同じ「キーワードの列」なので、区切り記号・配色を揃えると
   学習コストが下がる

## 5. 関連ドキュメント

- [`SPEC.cloudflare-workers-github-oauth-1.20260804.AICHAT_OVERVIEW.md`](SPEC.cloudflare-workers-github-oauth-1.20260804.AICHAT_OVERVIEW.md) — AIチャット機能全体の概観
- [`SPEC.cloudflare-workers-github-oauth-1.VECTORIZE.md`](SPEC.cloudflare-workers-github-oauth-1.VECTORIZE.md) — キーワードの自動ベクタ化とグラフ色分け
- [`NOTICE.cloudflare-workers-github-oauth-1.20260806.md`](NOTICE.cloudflare-workers-github-oauth-1.20260806.md) — D1クエリ最適化(N+1問題)の知見
