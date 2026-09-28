# EVAL: 共通関数化の実績と追加候補（モーダルほか、2026-09-28）

**評価対象**: 現在の `src/views`、`src/utils`、`src/middleware` と、それらを固定するテスト。これまでの開発で既に共通関数・共通部品になったものと、ページ内に類似実装が残り、今後共通化する価値があるものを棚卸しする。

**基準点**: 2026-09-28 の `bcbf1e1`。本書は実装変更の SPEC ではなく、静的調査に基づく専用 EVAL である。単語の出現数だけで共通化を決めず、責務、呼び出し元、アクセシビリティ、セキュリティ、および変更時の回帰範囲を評価した。

---

## 1. 結論

共通関数化は「未着手」ではない。テーマ、サーバー側 HTML エスケープ、Markdown、カウントダウン部品、世界遺産の見どころモーダル、キーワードピッカー、認証・署名検証、WASM 起動設定などは既に `src/utils` へ切り出され、複数画面または複数 endpoint から利用されている。

一方、**モーダルの土台そのもの**は共通化済みとは判定できない。個別機能のモーダルが共通部品化された例はあるが、overlay、開閉、Escape、背景クリック、focus、scroll lock、z-index、drag、最大化といった横断的ライフサイクルは各 view 内に残っている。静的検索では `getNextZ...` 定義を持つファイルが25、Escape キー判定を持つファイルが13あり、挙動差と修正漏れの温床になっている。

**総合判定: 部分合格。** 共通化の成功例は十分にあり、特に文字列生成型の Worker view に合わせた「CSS / HTML / Script を返す関数」という方式は定着している。ただし、すべてを一つの巨大 UI フレームワークへ寄せるべきではない。次に行うなら、まず modal stack と開閉契約、次にブラウザー側 escape / safe rendering、最後に fetch エラー処理の順で、小さい契約と characterization test を先に作るべきである。

**SF-01〜06 実施後の再評価**: 総合判定は引き続き部分合格だが、Phase 0 の不確実性は下がった。quick-add の backdrop / Escape、browser escape の実装差、keyword picker の accessibility 契約を自動テストで固定し、見どころ modal と read-only fetch の差分を下記に明文化した。一方、共通 modal runtime、browser safety helper、request helper 自体はまだ作っていないため、候補を「共通化済み」へ昇格させる段階ではない。

---

## 2. 判定基準

本評価では次を満たすものを「共通関数化完了」とした。

1. ページ固有ファイルの外に、明示的な責務を持つ実装がある。
2. 呼び出し元がその実装を import または埋め込み、同じ契約を利用している。
3. 単なる定数の移動ではなく、重複しやすい処理または UI 一式を隠蔽している。
4. 少なくとも実利用または専用テストのどちらかを確認できる。

反対に、次は「未完了」または「候補」とした。

- 共通 CSS 変数だけがあり、開閉処理はページごとに異なる。
- 名前が似ていても、操作契約が異なるものを無理に統合する必要がある。
- 1画面にしか存在せず、近い将来の再利用先も明確でない。
- 抽象化すると文字列生成と DOM 実行環境の境界が見えにくくなる。

件数は次の `rg -l ... | wc -l` によるスナップショットであり、AST による意味解析ではない。テストファイルも import 件数に含むため、採用画面数ではなく「リポジトリ内で契約が参照されている広がり」の指標として扱う。

---

## 3. 共通関数化が完了しているもの

### 3.1 共通テーマとテーマ切替（完了度: 高）

`src/utils/theme.ts` は次を一つの責務にまとめている。

- light / dark の CSS custom properties
- 初期描画前の Cookie 読み込み
- toggle button の HTML / CSS
- Cookie 保存を含む切替 script

`theme` の参照は41ファイルで確認できる。モーダル背景色も `--modal-overlay` として定義されているため、色の共通化は完了している。ただし modal の構造・操作まで共通化したことを意味しない。

**評価**: 採用範囲が広く、ページごとの色定義を減らしている。今後 modal 基盤を作る場合も、この変数を正本にする。

### 3.2 サーバー側 HTML エスケープ（完了度: 高）

`src/utils/html.ts` の `escapeHtml()` は `& < > " '` を一貫して escape し、39ファイルから参照されている。Worker がテンプレート文字列で HTML を組み立てる現構成に対して、適切な小さい共通関数である。

**評価**: サーバー側の正本として維持する。後述するページ内 `esc()` はブラウザーへ埋め込まれるコードなので、この TypeScript 関数をそのまま呼べない点を区別する必要がある。

### 3.3 Markdown parser / preview CSS（完了度: 高）

`src/utils/markdownRenderer.ts` は、ブラウザーへ埋め込む parser script と preview CSS を提供する。16ファイルに参照があり、`src/utils/markdownRenderer.test.ts` と `src/markdown-parser-script-shared.test.ts` で共通 parser の契約が検査されている。

**評価**: HTML escape 後に Markdown を適用し、危険な URL scheme を拒否する責務が一か所に集約されている。各画面が独自 Markdown 実装へ戻らないようにする。

### 3.4 カウントダウンの共通 UI（完了度: 高）

- `src/utils/countdownWidget.ts`: 右下 widget の CSS / HTML / Script
- `src/utils/countdownQuickAdd.ts`: 日時・ラベルの単件 / 一括登録 modal
- `src/utils/countdownRegister.ts`: 登録処理
- `src/utils/countdown.ts`: 期限計算などのドメイン処理

widget は4ファイル、quick-add は3ファイルから参照され、それぞれ専用テストがある。quick-add は modal であるが、これは「カウントダウン登録機能一式」の共通化であり、汎用 modal shell の共通化ではない。

**評価**: 機能単位の vertical component として成功している。API payload、UI、callback の境界が明示され、再利用側が DOM 詳細を持たない。

### 3.5 世界遺産「見どころ」モーダル（完了度: 中）

`src/utils/heritageMitokoroModal.ts` は、元の 3D 地球儀画面にあった回答取得・Markdown 表示を再利用可能な形へ切り出し、`heritageJourney` が import している。CSS と Script を返す現在の view 構成に合う。一方、基準点の `webglHeritage` はこの module を import せず、元のページ内実装を保持している。

**評価**: ユースケース固有 modal を再利用できる形にした実績ではあるが、正本への完全統一は未完了である。両画面の挙動差を characterization test で確認し、同じ契約なら `webglHeritage` も module 利用へ移す。parser と `getNextZ()` を呼び出し側環境に要求するため、依存契約をテストまたは型でさらに可視化する余地もある。

### 3.6 キーワードピッカー（完了度: 中）

`src/utils/keywordPickerWidget.ts` は CSS / HTML / JS と target input、trigger、選択後 callback の設定をまとめている。現時点の直接採用先は主に `functionChangelog` で、実装は再利用可能でも複数画面への展開実績は限定的である。

**評価**: 「共通化の器」は完成しているが、「重複を実際に置換した」度合いは今後の採用状況を見て再評価する。利用先を増やすためだけの強制移行はしない。

### 3.7 認証、署名、入力検証、ドメイン処理（完了度: 高）

UI 以外にも、次の境界は既に共通化されている。

- `src/middleware/auth.ts`: route の認証境界
- `src/utils/session.ts`、`jwt.ts`、`cookie.ts`、`returnTo.ts`: session と redirect
- `src/utils/githubWebhook.ts`、`slackSignature.ts`: raw body に対する署名検証
- `src/utils/cfAuthAccess.ts`: cf-auth payload / access 判定
- `src/utils/aichatModelConfig.ts`: model ごとの設定と色
- `src/utils/wasmModuleConfig.ts` と `src/data/wasmModuleRegistry.ts`: WASM module の一覧と起動可否
- `src/utils/jevEvaluation.ts`、`jevAnswerValues.ts`、`jevRecursiveDrilldown.ts`: Jev の評価ロジック

**評価**: endpoint から純粋関数や外部 I/O 境界を分離する方向は進んでいる。今後も「似た endpoint を一つの巨大 handler にする」のではなく、検証・変換・署名など意味の安定した小さな契約を共有する。

---

## 4. 共通化した方がよいもの

### 4.1 modal stack と基本ライフサイクル（優先度: 最優先）

#### 現状

個別 modal は多数存在し、少なくとも以下がページごとに再実装されている。

- overlay の表示 / 非表示（`display`、class、`hidden`、native `<dialog>` が混在）
- 背景クリックで閉じる処理
- Escape キーで閉じる処理
- 開くたびに最前面へ出す `getNextZ...`
- drag / maximize / resize
- body scroll lock
- close 後の focus 復帰

静的検索では `getNextZ...` 定義が25ファイル、Escape 判定が13ファイル、`openModal` / `closeModal` という同名定義だけでも各4ファイルに存在する。名前が違う同等処理はこの数に含まれない。

#### 推奨する共通化範囲

最初から見た目や本文まで統合せず、`getModalRuntimeScript()` のような小さい runtime を設ける。

```ts
type ModalRegistration = {
  overlayId: string;
  panelId: string;
  closeButtonIds?: string[];
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  restoreFocus?: boolean;
  lockBodyScroll?: boolean;
};
```

runtime が提供する契約は `open(id)`、`close(id)`、`bringToFront(id)`、`topmost()` に絞る。drag / resize は optional plugin とし、native `<dialog>` と overlay modal を一度に同じ DOM 実装へ変換しない。

#### 先に固定すべきテスト

1. 同時に2枚開いた場合、Escape は最前面だけを閉じる。
2. backdrop 内の panel click では閉じず、backdrop 自体の click だけで閉じる。
3. close 後は opener へ focus を戻す。
4. `role="dialog"` / `aria-modal` / accessible name を持つ。
5. drag 後も viewport 外へ完全に消えない。

**期待効果**: z-index 衝突、複数 keydown listener、アクセシビリティ差、閉じ方の不一致をまとめて減らせる。

### 4.2 browser-side escape と safe DOM rendering（優先度: 高）

#### 現状

共通 `escapeHtml()` がある一方、埋め込み script 内には `function escapeHtml` を持つファイルが9、`function esc(` を持つファイルが9ある。ブラウザーコードはサーバー側関数を直接 import できないため、重複が生じる構造上の理由はあるが、文字・戻り値・URL handling が揃っている保証は弱い。

#### 推奨

`getBrowserHtmlSafetyScript()` のような script generator を用意し、`escapeHtmlText`、`safeExternalUrl`、可能なら `textContent` を使う helper を提供する。既存 `markdownRenderer` 内の `esc()` と衝突しない名前・一度だけ定義する guard を決める。

**注意**: `innerHTML` を全面禁止する置換ではない。Markdown や表組みは HTML 生成が必要なので、trusted template と untrusted value の境界をテストで固定する。

### 4.3 fetch / JSON / error response の client helper（優先度: 高）

多数の埋め込み script が `fetch → status 判定 → json/text → message 表示` を個別に持つ。API が HTML error page や空 body を返した場合の挙動、401 時の login 誘導、AbortController の扱いが画面ごとにずれやすい。

#### 推奨

- `requestJson(url, init, { timeoutMs })`
- JSON でない error body も安全に message 化
- `response.ok` と application-level `{ success:false }` を区別
- timeout / abort / network error を区別

認証切れで常に redirect すべきとは限らないため、401 policy は helper 内で固定せず callback とする。

### 4.4 toast / inline status / loading state（優先度: 中〜高）

成功、失敗、処理中の表示は aichat、repositories、WASM 各画面などで独立している。全画面のデザインを同じにする必要はないが、`aria-live`、連打抑止、一定時間後の解除、error の保持という状態遷移は共有できる。

#### 推奨

まず `setAsyncButtonState(button, state)` と `announce(message, level)` の2つへ分ける。巨大な toast manager にせず、表示先 element は呼び出し側から渡す。

### 4.5 WASM loader と実行状態（優先度: 中）

`factorWasm`、`sha256Wasm`、`sqlxWasm`、`gronWasm`、Go WASM 系などは、module 自体の server helper / registry は共通化が進む一方、ブラウザー側の fetch、MIME fallback、instantiate、loading / error UI はページ固有部分が残る。

#### 推奨

Rust `wasm-bindgen`、Go `wasm_exec`、生 WebAssembly は起動方式が異なるため、一つの loader へ無理に統合しない。方式別に次の薄い adapter を作る。

- fetch と `response.ok` の検証
- `instantiateStreaming` 失敗時に許容する fallback 条件
- module URL と init function の注入
- loading / ready / failed の状態 callback

### 4.6 form validation / date-time normalization（優先度: 中）

カウントダウンでは既に validation が集約されているが、他の modal / form は trim、必須判定、日時、数値範囲、error 表示を個別に行う。HTML constraint validation を基本に、サーバー側 validation を正本とし、クライアント helper は UX 補助に限定する。

**共通化してはいけない境界**: validation rule 自体を汎用関数へ押し込まず、`readRequiredText`、`readFiniteNumber`、`toIsoFromLocalInput` のような変換だけを共有する。

### 4.7 API error response と監査ログ（優先度: 中）

server endpoint 側では status と JSON shape の組み立てが広範囲にある。`jsonError(code, message, status)` のような response factory は候補だが、OAuth callback、Slack、GitHub webhook は外部サービスが要求する response contract が異なる。

#### 推奨

内部 `/api/*` のみに scope を限定し、machine-readable code、user-safe message、request correlation id を揃える。外部 webhook と OAuth は別 adapter のままにする。

---

## 5. 現時点では共通化しない方がよいもの

### 5.1 modal の本文・レイアウト全部

検索、確認、画像 gallery、回答詳細、resize 可能な scoreboard、native dialog は要件が異なる。共通化対象は lifecycle と accessibility primitive までとし、本文 DOM や CSS class を一種類へ統一しない。

### 5.2 すべての `getNextZ()` を単純な固定値へ置換

固定 z-index は既存ページの stack context と衝突する。共通 runtime は現在の DOM から最大値を求めるか、自身が管理する stack counter を持ち、既存 modal と段階移行中も共存できる必要がある。

### 5.3 GitHub と Slack の署名検証器の一本化

HMAC-SHA256 と timing-safe compare は似ているが、header format、timestamp replay protection、base string が異なる。内部の byte / hex helper は共有候補でも、公開 API は `verifyGitHubWebhookSignature` と `verifySlackSignature` のまま分ける方が誤用を防ぐ。

### 5.4 すべての fetch を同じ retry policy にする

GET の再取得と、登録・通知・削除など副作用を持つ POST の再送は同じではない。helper が自動 retry するのではなく、idempotency を確認した呼び出し側だけが opt-in する。

---

## 6. 小一時間で完了できる独立タスク

以下は、ロードマップを **1件あたり30〜60分程度** でレビュー可能な成果物へ分割した候補である。見積もりを守るため、共通 runtime や helper の本実装・既存画面の移行は含めず、調査範囲またはテスト対象を1〜2ファイルに限定する。各タスクはほかのタスクを前提とせず、着手時点の最新 default branch から個別に開始できる。

| ID | 目安 | タスク | 変更対象の目安 | 完了条件 | 確認コマンド |
|---|---:|---|---|---|---|
| SF-01 | 30〜45分 | `countdownQuickAdd` の modal 操作契約を characterization test に追加する | `src/utils/countdownQuickAdd.test.ts` | backdrop 自体の click では閉じ、panel 内 click では閉じないことを各1ケース固定する。runtime への移行や production code の変更は行わない。 | `npx vitest run src/utils/countdownQuickAdd.test.ts` |
| SF-02 | 30〜45分 | `countdownQuickAdd` の Escape 契約を固定する | `src/utils/countdownQuickAdd.test.ts` | open 中の Escape で閉じるケースと、閉じている状態の Escape が副作用を起こさないケースを追加する。focus restore の新規実装は別タスクとする。 | `npx vitest run src/utils/countdownQuickAdd.test.ts` |
| SF-03 | 45〜60分 | 世界遺産「見どころ」モーダル2実装の依存契約を比較表にする | 本 EVAL、`src/utils/heritageMitokoroModal.ts`、`src/views/webglHeritage.ts`（調査のみ） | DOM id、open / close、Markdown parser、`getNextZ`、Escape、backdrop の6観点を表にし、「そのまま移行可能」「adapter が必要」を明記する。実装統合は行わない。 | `rg -n -e "mitokoro" -e "getNextZ" -e "Escape" -e "markdown" src/utils/heritageMitokoroModal.ts src/views/webglHeritage.ts` |
| SF-04 | 45〜60分 | browser-side escape の互換 fixture を1組作る | 新規の専用 test、`src/utils/markdownRenderer.ts` と `src/views/repositories.ts`（比較対象） | `& < > \" '`、空文字、`null` 相当の入力について両実装の出力差を表形式の test case で可視化する。helper の共通化や呼び出し元置換は行わない。 | `npx vitest run <追加したtestファイル>` |
| SF-05 | 30〜45分 | read-only fetch を1本選び、error contract を棚卸しする | 本 EVAL、選んだ view 1ファイル（調査のみ） | non-JSON、401、429、500、abort、network error の6ケースについて「現在の表示」と「期待する表示」を埋め、最初の `requestJson` 採用候補を1本だけ特定する。helper 実装は行わない。 | `rg -n -e "fetch\\(" -e "response\\.ok" -e "\\.json\\(" -e "\\.text\\(" <選んだviewファイル>` |
| SF-06 | 45〜60分 | keyword picker の accessibility 契約をテストで固定する | `src/utils/keywordPickerWidget.ts`、新規または既存の専用 test | trigger と picker の関連付け、accessible name、開閉時の `aria-expanded` の現状を検査する。欠けている属性の実装まで同時に行う場合も、この3項目以外へ scope を広げない。 | `npx vitest run <keywordPickerWidgetのtestファイル>` |

### 6.1 着手ルール

- 最初に選ぶなら、既存の専用 test があり変更範囲を予測しやすい **SF-01** とする。
- SF-01 と SF-02 は同じ test ファイルを触るため、同時並行の別 PR にはしない。両方を一つのPRにまとめる場合も、合計60分を超えそうなら片方だけに戻す。
- `<追加したtestファイル>` と `<選んだviewファイル>` は着手時に実在するパスへ置き換え、PR 本文に記録する。
- 調査タスクは表を埋めた時点、テストタスクは対象 test の単独実行が通った時点を完了とする。全件対応や共通 helper の設計開始を完了条件へ混ぜない。
- それぞれ独立した PR とし、未マージ PR の branch を基点に次のタスクを開始しない。

### 6.2 SF-01〜06 の完了結果と再評価

| ID | 状態 | 成果と再評価 |
|---|:---:|---|
| SF-01 | 完了 | `countdownQuickAdd.test.ts` で backdrop 自体と panel 内 click の差を固定した。 |
| SF-02 | 完了 | open 中の Escape だけが close し、closed 状態では行生成などの副作用を起こさないことを固定した。実装に不足していた Escape listener も最小範囲で追加した。 |
| SF-03 | 完了 | 下表の6観点で比較した。DOM を動的生成する基本構造は同じで移植可能だが、公開関数名と z-index 関数名に adapter が必要である。 |
| SF-04 | 完了 | `browserEscapeCompatibility.test.ts` に `& < > " '`、空文字、`null` 相当の表形式 fixture を追加した。4文字の escape と apostrophe 非変換は一致するが、Markdown の `esc` は `null` で `TypeError`、repositories の `escHtml` は文字列 `null` を返す差を確認した。 |
| SF-05 | 完了 | `repositories.ts` の read-only `checkHistoryExists()` を最初の `requestJson` 採用候補に特定し、下表に error contract を記録した。 |
| SF-06 | 完了 | keyword picker に dialog の accessible name、trigger の `aria-controls`、開閉同期する `aria-expanded` を追加し、専用 jsdom test で固定した。 |

#### SF-03: 世界遺産「見どころ」モーダルの依存契約比較

| 観点 | 共通 module | `webglHeritage` 内実装 | 移行判定 |
|---|---|---|---|
| DOM id | 固定 id を使わず毎回要素を生成 | 同左 | そのまま移行可能 |
| open / close | `openHeritageMitokoroModal`; close button / backdrop で overlay を remove | `openHeritageMitokoroCacheModal`; close 手段は同じ | 呼び出し関数名の adapter が必要 |
| Markdown parser | 呼び出し側の `parseMd` を前提 | `getMarkdownParserScript()` を同じ script 内へ埋め込み | そのまま移行可能 |
| `getNextZ` | private な `heritageMitokoroGetNextZ()` | page 内 `getNextZ()` | 計算は同等。名前衝突を避ける adapter が必要 |
| Escape | 未対応 | 未対応 | 挙動維持ならそのまま。runtime 移行時に共通追加する |
| backdrop | `e.target === overlay` のときだけ close | 同左 | そのまま移行可能 |

#### SF-05: `checkHistoryExists()` の read-only error contract

| ケース | 現在の表示 | helper 導入後に期待する表示 |
|---|---|---|
| non-JSON 2xx | JSON parse reject を catch し、既存表示のまま | inline status に「履歴を確認できません」を通知し、既存内容は保持 |
| 401 | `null` 扱いで履歴 row を非表示 | session 切れを区別し、login 導線を呼び出し側 callback で提示 |
| 429 | `null` 扱いで履歴 row を非表示 | retry-after を尊重し、再試行可能な一時エラーとして表示 |
| 500 | `null` 扱いで履歴 row を非表示 | server error として表示し、データ無しと区別 |
| abort | catch で無視し、既存表示のまま | user / navigation 起因の abort は無表示、timeout 起因なら timeout と表示 |
| network error | catch で無視し、既存表示のまま | offline / network error として表示し、手動再試行を可能にする |

この endpoint は GET で副作用がなく、現状の silent failure と「履歴なし」が混同されているため、最初の `requestJson` 採用候補に適する。401 redirect や retry は helper が自動実行せず、判別可能な error を callback へ返す。

---

## 7. 推奨ロードマップ

### Phase 0: characterization（実装変更なし）

1. modal inventory を `overlayId / close methods / Escape / backdrop / focus / z-index / drag / resize` で表にする。
2. 移行第1号を、機能が単純で専用 DOM テストがある modal から一つ選ぶ。
3. 現在の操作を jsdom または Playwright test で固定する。

### Phase 1: modal runtime の最小導入

1. stack、open / close、Escape、backdrop、focus restore だけ実装する。
2. 一画面のみ移行し、既存テストと a11y contract test を通す。
3. 二画面目で API が本当に再利用可能か確認してから安定化する。

### Phase 2: 安全な文字列処理

1. browser-side escape の差分を fixture で比較する。
2. Markdown parser との名前・読み込み順を確定する。
3. 手書き `esc` を一括置換せず、出力が一致する画面から移行する。

### Phase 3: request / async UI helper

1. JSON / non-JSON / 401 / 429 / 500 / abort の matrix test を作る。
2. read-only API から採用する。
3. 副作用 POST は idempotency の有無を明示してから採用する。

### Phase 4: 方式別 WASM adapter

1. Rust / Go / raw module を分類する。
2. MIME fallback の既知回帰を fixture 化する。
3. 各方式で一ページずつ移行し、初期化時間と error 表示を比較する。

各 Phase は独立した PR にする。未マージ PR を基点に次の PR を作らず、前段が必要なら default branch へマージされた後に次を開始する。

---

## 8. 完了条件

共通関数を新設しただけでは完了としない。各テーマで次を満たした時点を完了とする。

- 少なくとも性質の異なる2つの実利用先がある、または再利用予定が明文化されている。
- 旧実装を削除し、同じ責務の正本が一つになっている。
- success だけでなく error、close、競合などの境界テストがある。
- 共通化前のユーザー操作と response contract を維持する。
- accessibility と untrusted input の扱いが悪化していない。
- 共通 helper の障害が全ページへ波及するリスクに見合うテストがある。

---

## 9. 調査コマンドと結果

```text
find src -maxdepth 2 -type f -name '*.ts' ! -name '*.test.ts' | sort
  -> 実装ファイルを views / utils / middleware / data 単位で棚卸し

rg -l "utils/<module>|./<module>|../utils/<module>" src --glob '*.ts' | wc -l
  -> theme 41, html 39, markdownRenderer 16,
     countdownQuickAdd 3, heritageMitokoroModal 2,
     keywordPickerWidget 1, countdownWidget 4

rg -l "function getNextZ" src/views src/utils --glob '*.ts' | wc -l
  -> 25 files

rg -l "Escape patterns" src/views src/utils --glob '*.ts' | wc -l
  -> 13 files

rg -l "function escapeHtml" src/views src/utils --glob '*.ts' | wc -l
  -> 9 files

rg -l "function esc\\(" src/views src/utils --glob '*.ts' | wc -l
  -> 9 files
```

初回 EVAL ではコードを変更していなかったため、アプリケーション test suite は実行対象外とした。初回の `npm run typecheck` は既存 test file 群の型エラー（`aichat-slash-s.test.ts`、`answer-graph-first-person-mode.test.ts`、heritage journey tests ほか）により不合格だった。

SF-01〜06 完了後は次を実行し、対象3ファイル・31 test の成功を確認した。

```text
npx vitest run src/utils/countdownQuickAdd.test.ts src/utils/keywordPickerWidget.test.ts src/utils/browserEscapeCompatibility.test.ts
  -> 3 files passed, 31 tests passed

rg -n -e "mitokoro" -e "getNextZ" -e "Escape" -e "markdown" src/utils/heritageMitokoroModal.ts src/views/webglHeritage.ts
  -> SF-03 の6観点を比較

rg -n -e "fetch\\(" -e "response\\.ok" -e "\\.json\\(" -e "\\.text\\(" src/views/repositories.ts
  -> SF-05 の error contract を確認
```

第3節および第10節の参照数は初回基準点のスナップショットとして残す。再評価で増えた専用 test の import 数と混同しないため、実利用画面数の昇格根拠には用いない。

---

## 10. 要素別サマリー

### 10.1 判定記号

| 記号 | 意味 |
|---|---|
| ○ | 共通化済み、または現状の分離方針を維持する |
| △ | 一部共通化済み、もしくは条件を限定して共通化する |
| × | 未共通化で優先的な改善候補、または一律の共通化を行わない |

参照数は第9節の静的検索結果であり、テストを含む「参照ファイル数」である。参照数を個別集計していない要素は、数値を推測せず「未集計」と明記した。重複数は類似処理の定義を持つファイル数であり、参照数とは異なる。

### 10.2 共通化済み要素と追加候補

| 区分 | 要素 | 判定 | 参照数・重複数などの具体値 | 要約 |
|---|---|:---:|---:|---|
| 完了 | 共通テーマとテーマ切替 | ○ | 41ファイル参照 | CSS custom properties、初期 Cookie 読み込み、toggle UI、保存 script を共通化済み。modal は色変数のみが対象で、構造と操作は含まない。 |
| 完了 | サーバー側 HTML エスケープ | ○ | 39ファイル参照、5文字種を escape | `& < > " '` を `escapeHtml()` の一つの契約で処理する。ブラウザー内 helper とは実行境界が異なる。 |
| 完了 | Markdown parser / preview CSS | ○ | 16ファイル参照、専用テスト2系統 | parser script と preview CSS を共通化し、危険な URL scheme の拒否も集約している。 |
| 完了 | カウントダウン共通 UI / ドメイン処理 | ○ | widget 4ファイル、quick-add 3ファイル、関連 module 4個 | widget、登録 modal、登録処理、期限計算を機能単位で分離し、widget と quick-add にはそれぞれ専用テストがある。 |
| 部分完了 | 世界遺産「見どころ」モーダル | △ | 2ファイル参照、採用画面1・未移行画面1 | `heritageJourney` は共通 module を利用する一方、`webglHeritage` はページ内実装を保持しており、正本の統一は未完了。 |
| 部分完了 | キーワードピッカー | △ | 1ファイル参照、主な採用先1画面 | 再利用可能な CSS / HTML / JS と callback 契約はあるが、複数画面で重複を置換した実績はまだない。 |
| 完了 | 認証・署名・入力検証・ドメイン処理 | ○ | 本文で14ファイル／moduleを列挙、参照数は未集計 | 認証、session、redirect、GitHub / Slack 署名、CF Access、AI model、WASM、Jev を意味の安定した小さい契約へ分離済み。 |
| 最優先候補 | modal stack と基本ライフサイクル | × | `getNextZ...` 25ファイル、Escape 13ファイル、`openModal` / `closeModal` 各4ファイル | stack、open / close、Escape、backdrop、focus restore を小さい runtime にする。drag / resize は optional とし、先に5項目の操作テストを固定する。 |
| 高優先候補 | browser-side escape / safe DOM rendering | × | `function escapeHtml` 9ファイル、`function esc(` 9ファイル | script generator で安全な text / URL 処理を共有する。`innerHTML` は全面禁止せず、trusted template との境界を検査する。 |
| 高優先候補 | fetch / JSON / error response helper | × | 想定する異常系6種（non-JSON、401、429、500、abort、network error） | status、JSON / text、timeout を揃える。401 policy と副作用 request の retry は呼び出し側に残す。 |
| 中〜高優先候補 | toast / inline status / loading state | × | 最小 helper 2個 | `setAsyncButtonState` と `announce` に分け、`aria-live`、連打抑止、解除、error 保持の状態遷移を共有する。 |
| 中優先候補 | WASM loader と実行状態 | △ | 起動方式3種、例示ページ群5種 | Rust `wasm-bindgen`、Go `wasm_exec`、raw WebAssembly を別 adapter とし、fetch、fallback、状態 callback だけを薄く共有する。 |
| 中優先候補 | form validation / date-time normalization | △ | 推奨変換 helper 3個 | rule は統合せず、required text、有限数、local date-time から ISO への変換だけを共有する。 |
| 中優先候補 | API error response と監査ログ | △ | response factory案1個、共通 field 3個 | 内部 `/api/*` のみに限定し、code、user-safe message、correlation id を揃える。OAuth / webhook は別契約を維持する。 |

### 10.3 一律に共通化しない境界

| 要素 | 判定 | 具体値 | 維持する境界 |
|---|:---:|---:|---|
| modal の本文・全レイアウト | × | 異なる用途5種（検索、確認、gallery、scoreboard、native dialog） | lifecycle と accessibility primitive までを共有し、本文 DOM と CSS class は一種類へ統一しない。 |
| `getNextZ()` の固定値化 | × | 現在25ファイルに類似定義 | 固定 z-index へ一括置換せず、既存 modal と共存可能な stack counter または DOM 最大値を使う。 |
| GitHub / Slack 署名検証器の一本化 | × | 外部サービス2種 | algorithm の類似だけで公開 API を統合せず、header、timestamp、base string の契約を分離する。 |
| 全 fetch の同一 retry policy | × | request 分類2種（read-only、副作用あり） | retry は自動化せず、idempotency を確認した呼び出し側だけが opt-in する。 |

### 10.4 実施順序と数値目標

| Phase | 判定 | 主な作業 | 明示された確認数・採用数 |
|---:|:---:|---|---:|
| 0 | ○ | modal inventory と characterization test | quick-add 3操作契約、見どころ modal 6観点、移行候補1件を確認済み |
| 1 | △ | modal runtime の最小導入 | 基本責務5個、先行1画面、再利用確認の2画面目 |
| 2 | △ | browser-side escape の比較と段階移行 | fixture 比較、読み込み順確認、画面単位の移行 |
| 3 | △ | request / async UI helper | response matrix 6ケース、read-only API から採用 |
| 4 | △ | 方式別 WASM adapter | 起動方式3分類、各方式1ページずつ移行 |

最終的な完了判定は、(1) 性質の異なる実利用先が最低2つ、または再利用予定の明文化、(2) 旧実装の削除、(3) success 以外を含む境界テスト、(4) 操作と response contract の維持、(5) accessibility と untrusted input の非悪化、という5条件で行う。

再評価時点では Phase 0 の個別確認は完了したが、Phase 1〜4 の production helper 導入と旧実装削除は未着手である。したがって modal stack、browser-side safety、request helper の判定は `×`、世界遺産 modal と keyword picker の判定は `△` を維持する。
