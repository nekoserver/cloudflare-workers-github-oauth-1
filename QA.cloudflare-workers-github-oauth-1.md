# QA - cloudflare-workers-github-oauth-1

## Q1. このワーカーで Resend からの Webhook を処理することは可能か？

### 回答

**可能。既に実装済みである。**

`POST /webhook/resend` エンドポイントが `src/index.ts` に存在し、以下の処理を行っている。

### エンドポイント概要

| 項目 | 値 |
|---|---|
| パス | `POST /webhook/resend` |
| 認証 | Svix 署名検証（`svix-id` / `svix-timestamp` / `svix-signature` ヘッダー） |
| 必要な Secret | `RESEND_WEBHOOK_SECRET`（`wrangler secret` で設定） |

### 処理フロー

1. **署名検証** — `verifyResendWebhookSignature()` で Svix ヘッダーと Secret を用いてペイロードの正当性を検証する
2. **重複排除** — `svix-id` をキーにインメモリキャッシュで重複 Webhook を検出し、TTL 内の再送は `409 Conflict` を返す
3. **イベント処理** — `email.delivered` / `email.failed` / `email.bounced` イベントに対して Slack 通知を送信する
4. **プロキシ転送** — 外部 URL にイベント種別を通知する

### Slack 通知に必要な環境変数

| 変数名 | 用途 |
|---|---|
| `RESEND_WEBHOOK_SECRET` | Svix 署名検証用シークレット |
| `RESEND_WEBHOOK_DEDUP_TTL_SECONDS` | 重複排除 TTL（省略時はデフォルト値が適用） |
| `SLACK_OAUTH_TOKEN` | Slack API トークン |
| `SLACK_CHANNEL_ID` | 通知先チャンネル |
| `SLACK_SIGNING_SECRET` | Slack 署名検証用（設定チェックのみ） |
| `SLACK_CLIENT_SECRET` | Slack クライアントシークレット（設定チェックのみ） |
| `SLACK_CLIENT_ID` | Slack クライアント ID（設定チェックのみ） |

### 対応イベント

| Resend イベント | Slack 通知メッセージ |
|---|---|
| `email.delivered` | `Resend: 送信完了` + from / to / 件名 |
| `email.failed` | `Resend: 失敗` + from / to / 件名 |
| `email.bounced` | `Resend: 失敗` + from / to / 件名 |
| その他 | Slack 通知なし（プロキシ転送のみ） |

### Resend 側の設定

Resend ダッシュボードの Webhook 設定で、エンドポイント URL を以下のように設定する:

```
https://<ワーカードメイン>/webhook/resend
```

---

## Q2. このリポジトリで書かれている TypeScript はどのバージョンに準拠しているか？（2026-06-03）

### 回答

| 項目 | 値 |
|---|---|
| TypeScript バージョン | `^5.3.3`（TypeScript 5系） |
| コンパイルターゲット | `ES2022` |
| モジュール形式 | `ES2022` |
| ライブラリ定義 | `["ES2022"]` |
| モジュール解決 | `bundler`（Wrangler / esbuild 向け） |
| strict モード | ON（`"strict": true`） |

`tsconfig.json` の `target` / `module` / `lib` がすべて `ES2022` に設定されているため、以下の機能が利用可能:

- `Array.at()` / `Object.hasOwn()` / `Object.entries()` 等の ES2022 組み込み
- トップレベル `await`
- クラスフィールド宣言
- `Error.cause`

実行環境は Cloudflare Workers（V8ベース）なので ES2022 の機能はネイティブサポートされている。型定義は `@cloudflare/workers-types` を使用。
