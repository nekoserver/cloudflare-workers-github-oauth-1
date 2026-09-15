# SPEC.cloudflare-workers-github-oauth-1.20260915

## 1. APIキー発行後にカウントダウンへ「Key期限」を予約する

**対象**: `POST /api/api-keys`、`/api-keys` 発行モーダル、D1 `countdown_events` —
🔑キー管理ページで有効期限付きAPIキーを発行した直後に、その `expires_at` を
`/countdown` の予定として label=`Key期限` で新規登録する。

### 背景

APIキーの有効期限はキー管理ページの一覧に表示されるだけだった。
`/countdown` の常時ウィジェットや次の予定一覧から期限を追えないため、
発行したキーの期限日時をカウントダウン予約へ自動で入れる。

### 故障シナリオ

| # | 故障 | 対処 |
|---|---|---|
| 1 | 30日/90日キー発行後に `countdown_events` へ行が作られない | 発行成功後に `insertApiKeyDeadlineCountdown` を必ず呼ぶ |
| 2 | 予約日時が `api_keys.expires_at` とずれる | `expiresAt` をそのまま `target_at` にする |
| 3 | 無期限キーなのに null 日時で不正行が入る | `expiresAt=null` は INSERT せず `skipReason=no_expiry` |
| 4 | カウントダウン INSERT 失敗でキー発行が 500 になる | 失敗は判別可能な結果で返し、キー発行は 201 のまま |
| 5 | INSERT 失敗を空文字で握りつぶす | `errorCode` + 空でない `detail` をレスポンスとログとモーダルへ出す |
| 6 | 2回発行で既存の「Key期限」を上書きする | upsert せず発行のたびに新規 INSERT する |

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/utils/countdown.ts` | `API_KEY_DEADLINE_LABEL`、`insertApiKeyDeadlineCountdown`、`formatApiKeyDeadlineCountdownNotice` を追加 |
| `src/index.ts` | `POST /api/api-keys` 成功後にカウントダウン予約し、`countdown` / `countdownNotice` を返す |
| `src/views/apiKeys.ts` | 発行モーダルに登録結果文言を表示する |
| `src/views/apis.ts` / `src/data/apiEndpointList.ts` | 発行APIの説明とレスポンス例を更新 |

### 注意事項

- 無期限キーはカウントダウンへ登録しない
- 同じユーザーがキーを複数発行すると「Key期限」が複数行になる(キーごとに期限が違うため上書きしない)
- カウントダウン登録失敗でも生キーの発行自体は成功する。失敗内容は発行モーダルと API レスポンスの `countdownNotice` で通知する

### テスト

- `src/utils/countdown.test.ts`: ラベル固定、INSERT/スキップ/失敗の戻り値、2回発行で2行
- `src/apiKeys-countdown-deadline.test.ts`: `POST /api/api-keys` の期限一致・無期限スキップ・失敗時201・モーダル連携

### 関連コミット

- [`c141417`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c141417) APIキー発行時にカウントダウンへKey期限を予約する

### 関連

対応するIssueは無い。🔑キー管理ページの発行フロー改善として実施した。

---

## 2. カウントダウン登録処理を共通化し、api-keys では予定名を「PK期限」にする

**対象**: `/welcome` の「⏱️ カウントダウンに登録」ボタン、`/api-keys` のキー発行後処理、
`POST /api/countdown` — welcome と同じクライアント登録処理を共通関数にし、
APIキー発行直後は `label` に表示名「PK期限」、`targetAt` に発行した期限を渡す。
`label` は右下ウィジェットと完了トーストに出る予定名であり、特別な呼び出しモードではない。

### 背景

サーバー側 `POST /api/api-keys` 内で `countdown_events` へ INSERT する方式は、
デプロイ前の Worker では届かず、キー発行しても `/countdown` に予定が付かない。
welcome の登録ボタンは既に動いている `POST /api/countdown` なので、その処理を
共通化して api-keys からも使う。渡す予定名はトーストに出る「PK期限」。

### 故障シナリオ

| # | 故障 | 対処 |
|---|---|---|
| 1 | 共通スクリプト未埋め込みで `registerCountdownEvent` が未定義 | `getCountdownRegisterScript()` を welcome と api-keys の両方へ入れる |
| 2 | 予定名(label)が PK期限 ではない | api-keys 側で `label: 'PK期限'` を渡す(共通関数は文字列をそのまま送る) |
| 3 | 発行した `expiresAt` と違う日時を送る | `res.data.key.expiresAt` をそのまま `targetAt` にする |
| 4 | 無期限キーでも POST する | `expiresAt` が無いときは POST しない |
| 5 | 登録後に `/countdown` へ遷移し生キーが見えなくなる | api-keys は `confirmNavigate: false` |
| 6 | welcome ボタンが旧実装のまま分岐する | welcome も同じ `registerCountdownEvent` を呼ぶ |

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/utils/countdownRegister.ts` | `window.registerCountdownEvent` を返す共通スクリプト |
| `src/views/welcome.ts` | セッション期限ボタンから共通関数を呼ぶ |
| `src/views/apiKeys.ts` | キー発行後に共通関数へ予定名 `PK期限` と `expiresAt` を渡す |
| `src/index.ts` | サーバー側の自動 INSERT を外し、二重登録を防ぐ |

### 注意事項

- 無期限キーはカウントダウンへ登録しない
- 生キーモーダル表示中は `/countdown` へ自動遷移しない
- この変更を本番に載せるにはデプロイが必要

### テスト

- `src/utils/countdownRegister.test.ts`: POST ボディ・失敗時 onError・confirmNavigate
- `src/apiKeys-countdown-deadline.test.ts`: api-keys / welcome が共通関数を使うこと

### 関連コミット

- [`a10b898`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a10b898) カウントダウン登録処理を共通化しAPIキー発行時にPK期限で予約する
- [`5298528`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5298528) PK期限はトースト用の予定名であり専用の呼び出し方ではない

---

## 3. APIキー発行時のカウントダウン予約をサーバー側 INSERT に戻す

**対象**: `POST /api/api-keys`、D1 `countdown_events`、`/api-keys` 発行モーダル —
有効期限付きAPIキーを発行した同じリクエスト内で `countdown_events` へ予定名 `PK期限` を新規INSERTする。
ブラウザの後追い `POST /api/countdown` には依存しない。

### 背景

クライアント側だけ `POST /api/countdown` する実装は、新しい `/api-keys` HTML が Worker に載るまで
`/countdown` に予定が付かない。期限日時は発行 API が既に持っているので、`cf-auth 期限` と同じく
サーバー側で INSERT する。welcome のセッション期限ボタンはクライアント側のまま残す
(期限はブラウザのセッションタイマー側にしか無いため)。

### 故障シナリオ

| # | 故障 | 対処 |
|---|---|---|
| 1 | 30日/90日キー発行後に `countdown_events` へ行が作られない | 発行成功後に `insertCountdownEvent` を必ず呼ぶ |
| 2 | 予約日時が `api_keys.expires_at` とずれる | `expiresAt` をそのまま `target_at` にする |
| 3 | 無期限キーなのに null 日時で不正行が入る | `targetAt=null` は INSERT せず `skipReason=no_expiry` |
| 4 | カウントダウン INSERT 失敗でキー発行が 500 になる | 失敗は判別可能な結果で返し、キー発行は 201 のまま |
| 5 | INSERT 失敗を空文字で握りつぶす | `errorCode` + 空でない `detail` をレスポンスとログとモーダルへ出す |
| 6 | 2回発行で既存の「PK期限」を上書きする | upsert せず発行のたびに新規 INSERT する |
| 7 | サーバーINSERTとクライアントPOSTで二重登録する | api-keys の発行後 `POST /api/countdown` をやめる |

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/utils/countdown.ts` | 汎用 `insertCountdownEvent` / `formatCountdownInsertNotice` を追加。予定名は引数 |
| `src/index.ts` | `POST /api/api-keys` 成功後に予定名 `PK期限` で予約し、`countdown` / `countdownNotice` を返す |
| `src/views/apiKeys.ts` | 発行モーダルにサーバーが返した登録結果を表示する。後追い POST しない |
| `src/views/apis.ts` / `src/data/apiEndpointList.ts` | 発行APIの説明とレスポンス例を更新 |

### 注意事項

- 無期限キーはカウントダウンへ登録しない
- 同じユーザーがキーを複数発行すると「PK期限」が複数行になる(キーごとに期限が違うため上書きしない)
- カウントダウン登録失敗でも生キーの発行自体は成功する。失敗内容は発行モーダルと API レスポンスの `countdownNotice` で通知する

### テスト

- `src/utils/countdown.test.ts`: 予定名をそのままINSERT、無期限スキップ、失敗時の空でない detail、2回で2行
- `src/apiKeys-countdown-deadline.test.ts`: `POST /api/api-keys` の期限一致・無期限スキップ・失敗時201・モーダル連携・二重POST禁止
- `src/apiKeys-countdown-sqlite-e2e.test.ts`: 本物の SQLite で発行→`GET /api/countdown` / `GET /api/countdown/next` まで読み戻す。発行ボタンの JSDOM 操作も含む

### 関連コミット

- [`fb477fb`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/fb477fb) APIキー発行時にログイン時と同じくサーバー側でカウントダウンへPK期限を予約する
- [`836f951`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/836f951) APIキー発行からカウントダウン一覧までSQLite実テーブルで読み戻すテストを追加する

### 関連

対応するIssueは無い。🔑キー管理ページの発行フロー修正として実施した。

---

## 4. APIキー発行のカウントダウン登録をログイン時の upsert に揃える

**対象**: `POST /api/api-keys`、`upsertCfAuthDeadlineCountdown`、D1 `countdown_events`、
予定名 `PK期限` — 有効期限付きAPIキーを発行したときのカウントダウン予約を、
ログイン時の `cf-auth 期限` と同じ upsert にする。同じ `user_id` + 予定名なら
`target_at` だけ更新し、行は増やさない。

### 背景

ログイン通知(`POST /webhook/cf-auth` の hasAccess=OK)は、最初から
`SELECT → 既存なら UPDATE / 無ければ INSERT` で `cf-auth 期限` を1行に保っている。
APIキー発行側だけ毎回 INSERT すると、ログイン時の鍵登録と処理が食い違う。
発行処理はログイン時の upsert をそのまま共有すれば足りる。

### 故障シナリオ

| # | 故障 | 対処 |
|---|---|---|
| 1 | 30日/90日キー発行後に `countdown_events` へ行が作られない | 発行成功後に `upsertCountdownEvent` を必ず呼ぶ |
| 2 | 2回発行で `PK期限` が行増殖し、ログイン時の upsert と食い違う | 同じ `user_id`+予定名なら `target_at` だけ更新する |
| 3 | `PK期限` が既存の `cf-auth 期限` を上書きする | 予定名で行を分け、ラベルが違えば別行のままにする |
| 4 | 無期限キーなのに null 日時で不正行が入る | `targetAt=null` は書き込まず `skipReason=no_expiry` |
| 5 | upsert 失敗でキー発行が 500 になる | 失敗は判別可能な結果で返し、キー発行は 201 のまま |
| 6 | 失敗を空文字で握りつぶす | `errorCode` + 空でない `detail` をレスポンスとログとモーダルへ出す |

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/utils/countdown.ts` | `insertCountdownEvent` を `upsertCountdownEvent` に置換。ログイン時と同じ SELECT/UPDATE/INSERT |
| `src/index.ts` | `upsertCfAuthDeadlineCountdown` と `POST /api/api-keys` の両方が `upsertCountdownEvent` を呼ぶ |
| `src/views/apis.ts` / `src/data/apiEndpointList.ts` | 同一ユーザーは既存行の期限を更新する旨を追記 |
| `src/utils/countdown.test.ts` / `src/apiKeys-countdown-deadline.test.ts` / `src/apiKeys-countdown-sqlite-e2e.test.ts` | 2回発行で1行更新、予定名違いで別行、SQLite実テーブルで `GET /api/countdown` まで確認 |

### 注意事項

- 無期限キーはカウントダウンへ登録しない
- 同じユーザーが有効期限付きキーを複数発行すると、`PK期限` は最新発行キーの `expires_at` で上書きされる(ログイン時の `cf-auth 期限` と同じ)
- `cf-auth 期限` と `PK期限` は予定名が違うので共存する
- カウントダウン登録失敗でも生キーの発行自体は成功する。失敗内容は発行モーダルと API レスポンスの `countdownNotice` で通知する

### テスト

- `src/utils/countdown.test.ts`: 新規INSERT、同一ラベルは UPDATE、別ラベルは別行、無期限スキップ、失敗時の空でない detail
- `src/apiKeys-countdown-deadline.test.ts`: `POST /api/api-keys` の期限一致・2回発行で1行・無期限スキップ・失敗時201
- `src/apiKeys-countdown-sqlite-e2e.test.ts`: 本物の SQLite で発行→`GET /api/countdown`。2回発行は1行更新。`cf-auth 期限` 既存行があっても `PK期限` は別行
- `src/webhook-cf-auth-endpoint.test.ts`: ログイン時の新規作成と既存更新が、共通関数に寄せたあとも維持される

### 関連コミット

- [`7d064d9`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7d064d9) APIキー発行のカウントダウン登録をログイン時と同じupsertにする

### 関連

対応するIssueは無い。ログイン時のカウントダウン登録に発行処理を揃える修正。

---

## 5. Ruby/WASM の読み込み先を 4.0 系に切り替える

**対象**: `/ruby-wasm`、`/kimi-code/markdown/:id`、`/neko rubyver`、
`POST /api/ruby-wasm/snippets` の `ruby_version` —
公式 CRuby WASM バイナリを `@ruby/3.4-wasm-wasi` から `@ruby/4.0-wasm-wasi` へ切り替える。
JS グルーコード `@ruby/wasm-wasi@2.10.1` はそのまま使い、バイナリ側のパッケージバージョンも 2.10.1 に揃える。

### 背景

`ruby/ruby.wasm` が `@ruby/4.0-wasm-wasi` を公式配布している。ページが読むのは CDN 上の
`ruby+stdlib.wasm` 1本なので、URL のビルドラインを 4.0 に変えれば 4 系になる。

### 故障シナリオ

| # | 故障 | 対処 |
|---|---|---|
| 1 | 4.0 パッケージが無く CDN が 404 | `@ruby/4.0-wasm-wasi@2.10.1` の実在を npm と Range GET で確認してから URL を変える |
| 2 | `/ruby-wasm` だけ 4.0 で kimi-code が 3.4 のまま | 両方 `RUBY_WASM_BINARY_URL` を共有する |
| 3 | `/neko rubyver` が 3.4 のまま表示される | `getRubyWasmVersionInfo()` が URL からビルドラインを取る |
| 4 | 新規スニペットの `ruby_version` が 3.4 のまま | 保存時に `getRubyWasmVersionInfo().rubyBuildLine` を書く |
| 5 | 過去の 3.4 URL をパースできなくなる | パーサは 3.4 も 4.0 も受け付ける |

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/views/rubyWasm.ts` | `RUBY_WASM_BINARY_URL` を `@ruby/4.0-wasm-wasi@2.10.1` にする |
| `src/index.ts` | コメント例を 4.0 に合わせる。マイグレーション DEFAULT `'3.4'` は既存行用のため変えない |

### 注意事項

- 既存スニペットの `ruby_version='3.4'` は保存当時の値のまま残る
- 無期限ではなく、これから保存する行が `4.0` になる
- JS グルーはこれまで通り esm.sh の `@ruby/wasm-wasi@2.10.1`

### テスト

- `src/ruby-wasm-version-info.test.ts`: ビルドライン 4.0、CDN の WASM マジック
- `src/ruby-wasm-page-20260831.test.ts` / `src/kimi-code-markdown-page.test.ts`: HTML が 4.0 URL を読む
- `src/ruby-wasm-snippets.test.ts`: 保存時 `ruby_version` が `4.0`
- `src/aichat-slash-rubyver.test.ts`: `/neko rubyver` が 4.0 を出す

### 関連コミット

- [`f0c6138`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f0c6138) Ruby/WASMの読み込み先を公式4.0バイナリに切り替える

### 関連

対応するIssueは無い。Ruby/WASM の公式 4.0 パッケージへの追随。

---

## 6. Ruby/WASM 4.0 の読み込みを compileStreaming から外す

**対象**: `/ruby-wasm` と `/kimi-code/markdown/:id` のブラウザ側 WASM 初期化
(`src/utils/rubyWasmLoader.ts`、`src/views/rubyWasm.ts`、`src/views/kimiCodeMarkdown.ts`) —
4.0 の `ruby+stdlib.wasm`(非圧縮約32MB)を `WebAssembly.compileStreaming` で読むと、
iOS などでモジュール読み込みが失敗・ハングし、進捗も出ないため止まったように見える。

### 背景

3.4 では同じ `compileStreaming` + jsDelivr 経路で動いていた。4.0 はバイナリが約2MB大きく、
gzip 展開とストリーミングコンパイルの組み合わせでモバイルブラウザが本文を WASM として
解釈できない／終わらないことがある。ダウンロード中にステータスが更新されないと、
失敗と待ちの区別もつかない。

### 故障シナリオ

| # | 故障 | 対処 |
|---|---|---|
| 1 | `compileStreaming` が巨大 gzip WASM で失敗・ハングする | 本文を ArrayBuffer にしてから `WebAssembly.compile` する |
| 2 | 進捗が無く「読み込めない」と誤認する | 受信バイト量をステータスに出す。Content-Length が圧縮サイズで受信(展開後)を超えたらパーセントを付けない |
| 3 | 毎回 32MB を取り直して遅い | Cache API にバイナリを残し、バージョン付きキャッシュ名で 3.4 と衝突させない。`put` 失敗は変数に残して読み込み自体は続行する |
| 4 | `/ruby-wasm` だけ直して kimi-code が古い経路のまま | 共通 `loadRubyWasmVm` を両方から呼ぶ |
| 6 | 4.0 URL なのに `RUBY_VERSION` が 3.4.1 のまま成功扱い | 起動後に `RUBY_VERSION` を評価し、期待ビルドラインで始まらなければエラーにする。ステータスに実バージョンを出す |

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/utils/rubyWasmLoader.ts` | 進捗・結合・キャッシュ名・arrayBuffer compile・インラインローダー |
| `src/views/rubyWasm.ts` | 共通ローダー呼び出し。案内文を約32MB・進捗・2回目キャッシュに更新 |
| `src/views/kimiCodeMarkdown.ts` | 同じローダーに切り替え |

### 注意事項

- 初回ダウンロード自体は CDN 上の約32MBなので、進捗表示とキャッシュが改善の本体である
- `compileStreaming` は使わない。MIME が `application/wasm` でもストリーミング経路は使わない

### テスト

- `src/ruby-wasm-loader.test.ts`: 進捗文言、チャンク結合、HTTPエラー、compileStreaming 非使用、両ページの埋め込み
- 既存の `/ruby-wasm` HTML・構文テスト

### 関連コミット

(コミット後に追記)

### 関連

対応するIssueは無い。4.0 切り替え後の読み込み失敗への対処。



