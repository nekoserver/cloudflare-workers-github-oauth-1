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

(コミット後に追記)

### 関連

対応するIssueは無い。🔑キー管理ページの発行フロー改善として実施した。
