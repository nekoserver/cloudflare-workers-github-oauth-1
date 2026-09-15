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
- 本番に載せるにはこの Worker をデプロイする必要がある。git push だけでは `/countdown` に行は増えない

### テスト

- `src/utils/countdown.test.ts`: 予定名をそのままINSERT、無期限スキップ、失敗時の空でない detail、2回で2行
- `src/apiKeys-countdown-deadline.test.ts`: `POST /api/api-keys` の期限一致・無期限スキップ・失敗時201・モーダル連携・二重POST禁止
- `src/apiKeys-countdown-sqlite-e2e.test.ts`: 本物の SQLite で発行→`GET /api/countdown` / `GET /api/countdown/next` まで読み戻す。発行ボタンの JSDOM 操作も含む

### 関連コミット

- [`fb477fb`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/fb477fb) APIキー発行時にログイン時と同じくサーバー側でカウントダウンへPK期限を予約する

### 関連

対応するIssueは無い。🔑キー管理ページの発行フロー修正として実施した。


