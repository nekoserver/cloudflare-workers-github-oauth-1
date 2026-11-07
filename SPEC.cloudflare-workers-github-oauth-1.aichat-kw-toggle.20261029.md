# SPEC: AIチャット詳細プレビューの🔑トグル(3段階)

## 1. 🔑トグルを2段階から3段階にした

**対象**: AIチャットの詳細プレビューモーダル(`src/views/aichat.ts` の `getAiChatPage` が返すページ内スクリプト)の左下にある「🔑」ボタン(`#historyModalHighlightToggleBtn`)と、キーワードパネル(`#historyModalKeywordChips`)・本文中のキーワードハイライト(`.kw-highlight`、`.highlights-hidden`) — ボタンを押すたびに、ハイライトとパネルの表示を3つの状態で順番に切り替える。

### 背景

従来は2段階だった。ハイライトをONにすると本文のキーワードがハイライトされ、OFFにするとキーワードパネルが自動で出ていた。「ハイライトもパネルも出さない状態」を作れなかったため、3段階に変更した(ユーザーからの直接の依頼)。

### 仕様

クリックのたびに、1 → 2 → 3 → 1 の順に進む。

| 段階 | 内部名 | キーワードハイライト | キーワードパネル | ボタンの不透明度 |
|---|---|---|---|---|
| 1 | `highlight` | ON | OFF | 1 |
| 2 | `off` | OFF | OFF | 0.35 |
| 3 | `panel` | OFF | ON | 0.65 |

ボタンのツールチップは、現在の段階と次に起きることを示す。

| 段階 | ツールチップ |
|---|---|
| 1 | 🔑 ハイライト表示中（クリックでハイライトもパネルも非表示） |
| 2 | 🔑 ハイライトもパネルも非表示（クリックでキーワードパネルを表示） |
| 3 | 🔑 キーワードパネル表示中（クリックでハイライト表示） |

本文にハイライト対象(`.kw-highlight`)が1つも無い間は、3段階にはならない。次の表のとおり、従来どおりの表示になる。

| 状況 | パネル | ボタンの不透明度 | ツールチップ |
|---|---|---|---|
| ハイライト対象なし、DBにキーワードあり | 表示 | 1 | 🔑 クリックでキーワードをハイライト表示 |
| ハイライト対象なし、DBにもキーワードなし | 非表示 | 0.2 | キーワードハイライトなし |

最初のクリックでDBのキーワードをハイライトに適用する動作(まだ適用されていない場合)は従来のまま。この最初のクリックで段階1(`highlight`)になる。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/views/aichat.ts` | 段階の判定を、ページ内の純粋な関数 `nextKeywordToggleMode`、`keywordToggleView`、`currentKeywordToggleMode` に切り出した。パネルの状態として `historyModalKwPanelOn` を追加した。クリック処理と `updateHighlightToggleBtn` をこれらに合わせた |
| `src/aichat-keyword-toggle-3state-20261028.test.ts` | 新規(9件)。ページに埋め込まれた実コードから関数を取り出して実行し、切り替え順・各段階の組み合わせ・ページ側の配線を検証する |
| `src/aichat-highlight-all-keywords.test.ts`、`src/aichat-highlight-btn-position.test.ts`、`src/aichat-highlight-toggle.test.ts` | 2段階の実装(`!historyModalHighlightActive` で反転する書き方)を文字列で確認していた4件を、3段階の仕様に合わせて更新した |

### 内部の状態

| 変数 | 意味 |
|---|---|
| `historyModalHighlightActive` | ハイライトを表示中か |
| `historyModalKwPanelOn` | 段階3(パネルON)か |
| `historyModalChipsPinned` | キーワードのチップをクリックして、そのキーワードだけを強調している間、パネルを出し続けるか |

段階は、この2つのフラグ(`historyModalHighlightActive`、`historyModalKwPanelOn`)から `currentKeywordToggleMode` で求める。クリック時は `nextKeywordToggleMode` で次の段階を決め、`keywordToggleView` でフラグの組み合わせに戻す。クリックのたびに `historyModalChipsPinned` は `false` に戻る。

パネルを出す条件は、次のいずれかである。

- 本文にハイライト対象が無い。
- `historyModalChipsPinned` が `true`。
- `historyModalKwPanelOn` が `true`(段階3)。

`historyModalKwPanelOn` を `false` に戻すタイミングは次のとおり。

| タイミング | 理由 |
|---|---|
| 別の履歴を開き直したとき(スワイプを含む) | 段階3は引き継がない |
| 検索結果から詳細プレビューを開いたとき | 初期状態に戻す |
| チップ(キーワード)をクリックしたとき | 強調表示中は段階3にしない |
| DBのキーワードを全て適用したとき(`applyAllDbKeywordHighlights`) | 段階1にする |
| 最初のクリックでDBのキーワードをハイライトに適用したとき | 段階1にする |

### テストの観点

| 観点 | 内容 |
|---|---|
| 切り替え順 | `highlight` → `off` → `panel` → `highlight` |
| 想定外の値 | `undefined` や未知の文字列が来ても `highlight` に戻る |
| 各段階の組み合わせ | `keywordToggleView` が上の表のとおりの組み合わせを返す |
| 逆算 | `currentKeywordToggleMode` がフラグから段階を求める |
| 配線 | クリック処理が `nextKeywordToggleMode` を使う。`updateHighlightToggleBtn` が `historyModalKwPanelOn` を参照し、従来の「ハイライトOFFなら自動でパネルを出す」条件を持たない |

### 関連コミット

- [`74601894`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/74601894) AIチャット詳細プレビューの🔑トグルを3段階にする
- [`edfe2bf7`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/edfe2bf7) Merge pull request #2482(マージコミット)

PR: [nekoserver/cloudflare-workers-github-oauth-1#2482](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/2482)

### 注意事項

- **履歴のスワイプ**: 履歴を左右にスワイプしても、段階3(パネルON)は引き継がれない。別の履歴を開いた時点で `historyModalKwPanelOn` は `false` に戻り、段階2(両方OFF)の表示になる。引き継ぐ場合は、この仕様を変更する必要がある。
- **実ブラウザでの確認**: マージ時点では、🔑を3回押して 1 → 2 → 3 → 1 と進むか、パネルの出入りが正しいか、チップをクリックしたときの挙動を、実ブラウザでは確認していなかった。テストはページ内の関数と文字列を検証するもので、画面上の動作は見ていない。
- **template literal 内のスクリプト**: `src/views/aichat.ts` はページ全体を template literal で返す。このスクリプトにバックスラッシュ系のエスケープ(`\n`、`\'` など)を追加すると、ページ全体が壊れる。今回の追加分にはバックスラッシュを使っていない。
- **既存テストの失敗**: この変更の前から、サンドボックス上で全体のテストは74件失敗していた(ブラウザ系のテストが動かないため)。変更後に増えた失敗は、2段階の実装を確認していた4件だけで、上記のとおり更新した。
