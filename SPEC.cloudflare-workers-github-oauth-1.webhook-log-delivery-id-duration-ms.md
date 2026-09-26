# SPEC.cloudflare-workers-github-oauth-1.webhook-log-delivery-id-duration-ms — webhook_logにdelivery_id・duration_msカラムを追加(migration 0163)

## 1. `delivery_id`・`duration_ms`カラムを追加

**対象**: `webhook_log`テーブル、`logWebhookEvent()`関数、全13箇所の呼び出し元 — 姉妹Worker(`rust-worker-sqlx-d1`)の`/sqlx-d1-examples`ページのレビューで提案した改善項目のうち保留していた2件(配信追跡・処理時間記録)を実装した。

### 追加したカラム

```sql
ALTER TABLE webhook_log ADD COLUMN delivery_id TEXT;
ALTER TABLE webhook_log ADD COLUMN duration_ms INTEGER;
CREATE INDEX IF NOT EXISTS idx_webhook_log_delivery_id ON webhook_log(delivery_id);
```

`STATUS_MIGRATION_SQL`に`'0163'`として登録した。このリポジトリの`STATUS_MIGRATION_SQL`は`/status`ページの「このSQLを実行」機能が参照する登録簿であり、追加しただけではD1へ自動適用されない。**実際の適用にはユーザーが上記SQLをD1コンソールまたは`wrangler d1 execute`で実行する必要がある。**

### `delivery_id`: 送信元ごとの配信識別子

送信元によって取得元が異なる。

| 送信元 | ヘッダー/フィールド |
|---|---|
| `github` | `X-GitHub-Delivery`ヘッダー |
| `cf-wh1` | `webhook-id`ヘッダー(Standard Webhooks形式) |
| `resend:*` | `svix-id`ヘッダー |
| `cf-auth` | 該当する識別子が無いため常にNULL |

### `duration_ms`: リクエスト受信からログ記録までの処理時間

各Webhookハンドラの先頭で`const webhookStartedAt = Date.now();`を記録し、`logWebhookEvent()`呼び出し時に`Date.now() - webhookStartedAt`を渡す。

### `logWebhookEvent()`のシグネチャ変更方針

既存の位置引数(`source`・`eventType`・`status`・`payload`・`error`)の順序は変えず、7番目に任意の`meta?: { deliveryId?: string | null; durationMs?: number }`を追加した。これにより、呼び出し元が新しい引数を渡さなくても既存コードはそのまま動作する(後方互換)。

## 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/index.ts` | `STATUS_MIGRATION_SQL`に`'0163'`を追加、`TABLE_COLUMN_KEYS`の`webhook_log`エントリに`status`・`delivery_id`のインデックス表記を追加、`logWebhookEvent()`のシグネチャに`meta`引数を追加、GitHub・cf-auth・cf-wh1・Resend(共通処理+2つのルートハンドラ)の全呼び出し元(13箇所)へ`deliveryId`・`durationMs`を渡すよう更新 |
| `src/webhook-cf-wh1-route.test.ts` | `logWebhookEvent()`呼び出しの新シグネチャに合わせてアサーションを更新、`webhookId`変数抽出・`deliveryId`/`durationMs`受け渡しの検証テストを追加 |
| `src/resend-webhook-route.test.ts` | `logWebhookEvent()`呼び出しの新シグネチャに合わせてアサーションを更新 |
| `SPEC.cloudflare-workers-github-oauth-1.webhook-log-delivery-id-duration-ms.md` | 本変更のSPECファイル |

## 実行が必要なSQL

```sql
ALTER TABLE webhook_log ADD COLUMN delivery_id TEXT;
ALTER TABLE webhook_log ADD COLUMN duration_ms INTEGER;
CREATE INDEX IF NOT EXISTS idx_webhook_log_delivery_id ON webhook_log(delivery_id);
```

## テスト・検証

- `npx vitest run src/webhook-cf-wh1-route.test.ts src/resend-webhook-route.test.ts src/webhook-github-log-repository-20260925.test.ts src/webhook-github-pr-slack-independence.test.ts src/webhook-cf-auth-endpoint.test.ts src/countdown-20260828.test.ts`: 全件成功
- `npx vitest run`(フルスイート): バックグラウンドで実行し、既知の無関係な失敗以外に新規失敗が無いことを確認(詳細は次のコミットで反映)
- `npx tsc --noEmit`: `src/index.ts`に起因するエラー0件

## 注意事項

- `delivery_id`カラムを追加しても、既存の`webhook_log`行(このマイグレーション適用前に記録された行)の`delivery_id`・`duration_ms`は当然NULLのままになる。集計系サンプル(AVG等)はNULLを除外して計算する設計にしている(詳細は`rust-worker-sqlx-d1`側のSPEC参照)。
- `cf-auth`送信元には配信IDに相当するヘッダーが無いため、`delivery_id`は常にNULLになる。これは仕様であり不具合ではない。
