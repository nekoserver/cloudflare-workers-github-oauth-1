# SPEC — OAuthログインのメール確認ゲート(EVP)

## 1. 現状のアーキテクチャ

**対象**: `/auth/github/callback`、`/auth/email-confirm`、`src/utils/emailConfirmGate.ts`、`src/utils/emailConfirm.ts`、`src/utils/emailVerify.ts`、D1 `email_confirm_tokens`・`notification_settings.email_confirm_login_enabled`、設定ページ（`src/views/settings.ts`）の「ログイン確認メール(EVP)を必須にする」トグル — GitHub OAuthログイン時に、実際にそのメールアドレスを受信できる人物がログインしていることをResend経由で確認してからJWTを発行する仕組み一式。

### 背景

GitHub OAuthで取得できるメールアドレスはGitHub側で検証済みだが、「そのメールに今アクセスできる人物が今ログインしようとしているか」までは保証しない。当初はEVP（SMTPハンドシェイクによるメール存在確認、`RCPT TO`まで進めて`DATA`は送らない方式）の導入を検討したが、Cloudflare Workersの`cloudflare:sockets`は出力ポート25をブロックしているため本Workerからは実装不可と判明。サードパーティのメール検証API（Abstract API等）も検討したが、「送信先アドレスが外部に漏れる・転売されるリスクがあり信用できない」との判断で却下。最終的に、既に本番で送信・Webhook受信とも動作確認済みのResend連携を使い、「確認メール送信→リンククリック→ログイン完了」という自前の確認フローを採用した。

### 判定ロジック

ログイン確定(JWT発行)前に以下の条件がすべて揃った場合のみ確認メールを挟む。1つでも欠ければ即ログイン。

1. `notification_settings.email_confirm_login_enabled` が `1`（ユーザーオプション、**デフォルト0=OFF**）
2. `RESEND_API_KEY` が設定されている
3. GitHubから取得したメールアドレスが存在する

判定は `shouldGateLoginOnEmailConfirmation(enabled, resendApiKey, email)`（`src/utils/emailConfirm.ts`）が担う。

### ログインフロー

```
/auth/github/callback
  → GitHubユーザー情報・メール取得
  → runEmailConfirmGate(db, RESEND_API_KEY, confirmUrlBase, identity)
      ├─ gated=false → finalizeGithubLogin() で即ログイン完了(JWT発行・Cookieセット)
      └─ gated=true
           ├─ email_confirm_tokens に保留ログイン情報を保存(有効期限30分)
           ├─ Resendで確認リンク付きメールを送信
           └─ 「確認メールを送信しました」ページを返す(まだJWTは発行しない)

/auth/email-confirm?token=...  （メール内リンクのクリック先）
  → resolveEmailConfirmToken(db, token)
      ├─ 無効/消費済み/期限切れ → エラーページ
      └─ 正常 → finalizeGithubLogin() でログイン完了(JWT発行・Cookieセット)
```

`finalizeGithubLogin()`（`src/index.ts`）が即時ログイン・確認後ログインの両方から呼ばれる共通処理で、D1セッション保存・ワークスペース自動プロビジョニング・JWT発行・Cookie組み立て（`buildAuthRedirectHeaders()`）を行う。

### ファイル構成

| ファイル | 役割 |
|---|---|
| `src/utils/emailConfirm.ts` | 純粋関数（有効期限判定・ゲート要否判定・Cookieヘッダー組み立て）。D1やfetchに依存しない |
| `src/utils/emailConfirmGate.ts` | D1アクセス・Resend送信・確認待ち/エラーページのHTML・オーケストレーション関数(`runEmailConfirmGate`/`resolveEmailConfirmToken`)を集約 |
| `src/utils/emailVerify.ts` | Resend API経由のメール送信（テストメール送信・ログイン確認メール送信の両方が共通の`sendResendEmail`を利用） |
| `src/index.ts` | `/auth/github/callback`・`/auth/email-confirm`・`finalizeGithubLogin`・設定エンドポイント。EVP固有ロジックは持たず、`emailConfirmGate.ts`の戻り値で分岐するだけの薄いグルーコード |
| `src/views/settings.ts` | 設定ページの「ログイン確認メール(EVP)を必須にする」トグルUI |

このように「各所にEVP用のコードが埋め込まれている」状態を避け、EVP固有のロジックを`emailConfirmGate.ts`に一本化することで、index.ts側は判定結果に従って分岐するだけで済む構成にしている。

### D1テーブル

**対象**: `email_confirm_tokens`（マイグレーション0076）、`notification_settings.email_confirm_login_enabled`カラム（マイグレーション0077） — 保留ログイン情報の一時保存と、ゲート機能のON/OFFユーザーオプション（デフォルトOFF）を保持する。

| テーブル/カラム | 役割 |
|---|---|
| `email_confirm_tokens` | 確認待ちログインの一時保存（token, GitHub情報, アクセストークン, タイムゾーン等, 有効期限, 消費日時）。トークンは一度きり消費（`consumed_at`セット後は再利用不可） |
| `notification_settings.email_confirm_login_enabled` | ゲート機能のON/OFF（`INTEGER NOT NULL DEFAULT 0`）。既存の`slack_enabled`と同じ単一行グローバル設定テーブルに同居 |

### デフォルトOFF / フェイルセーフ設計

以下のいずれの場合も**即ログインを許可**し、ロックアウトを起こさない設計になっている。

- ユーザーオプションが未設定・OFF（初期状態）
- `RESEND_API_KEY` が未設定
- GitHubからメールアドレスが取得できない
- D1への保留トークン保存が失敗した場合（`email_confirm_tokens`未作成等）
- `notification_settings.email_confirm_login_enabled` カラム自体が無い場合（マイグレーション未適用）

## 2. 今後の予定

- **cf-authアプリからの現在値参照**: Slack通知設定と同様に、`GET /api/settings/email-confirm-login` に共有シークレット認証を追加し、外部サービスからON/OFF状況を参照できるようにするかは未着手（Slack通知の`GET /api/settings/slack-notify`は既に対応済みだが、EVPゲートは今のところ本アプリ内で完結させる方針で保留）
- **確認メールのUI改善**: 現在の「確認メールを送信しました」ページ・エラーページはプレーンHTMLの最小実装。デザインシステム（CLAUDE.CSS.md）に沿ったスタイリングは未着手
- **保留トークンの掃除**: `email_confirm_tokens` に有効期限切れ・消費済みレコードが溜まり続ける。定期的な削除バッチ（cron等）は未実装
- **`/status`ページでの可視化**: `email_confirm_tokens`は`/status`カタログに登録済みだが、現在の保留件数・直近の確認成功率などのダッシュボード表示は未実装

## 3. 注意事項

- EVPという略称は元々「Email Verification Protocol」（SMTPハンドシェイクによる実在確認）を指して検討していたが、本Workerでは実装不可と判明したため、実際に採用したのは「Resend送信+クリック確認」方式である。ドキュメント上「EVP」という語を流用しているが、厳密なSMTPレベルの検証ではない点に注意
- ONにすると**ログインの都度**確認メールが必須になる（初回ログインのみのキャッシュはしない）。これは「無駄なトークン発行を防ぐ」という目的のための意図的な設計であり、UXコストは許容している

## 関連コミット

- [`44760ab`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/44760ab) OAuthログインにResend経由のメール確認ゲートを追加
- [`50d06f1`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/50d06f1) EVPをデフォルトOFFのユーザーオプションにし、EVP関連ロジックを1ファイルに集約
