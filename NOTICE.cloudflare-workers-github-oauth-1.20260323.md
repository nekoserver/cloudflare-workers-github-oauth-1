# Resend Webhook の送信元識別: URL パスパラメータ方式の設計判断

## 背景

`resend_webhook_log` テーブルには `source_id` カラム（FK → `resend_webhook_sources`）があり、
どの送信元から届いた Webhook かを記録する設計になっている。
しかし Resend の Webhook ペイロード自体には送信元を一意に識別するフィールドが存在しない。

Webhook 単体で考えると、受信側が送信元を判別する手段がないため `source_id` を埋められない。

## 解決方法

ルートを `/webhook/resend/:sourceId` に変更し、URL パスに送信元 ID を埋め込む方式を採用した。

```
POST /webhook/resend/main    → source_id = 'main'
POST /webhook/resend/staging  → source_id = 'staging'
```

Resend ダッシュボードで Webhook エンドポイント URL を設定する際に sourceId を含めることで、
受信側は URL から送信元を特定できる。

## この方式が成立する前提条件

**Resend のような「受信側が Webhook URL を自由に設定できるサービス」でのみ有効。**

一般的な Webhook 設計では、送信側が固定 URL にしか送信できないケースがある。
その場合は URL パスで送信元を識別する方式は使えない。

今回は以下の条件が揃っているため、この方式を例外的に採用した:

1. **Resend ダッシュボードで Webhook URL を自由に設定できる** — パスパラメータ付きの URL を登録可能
2. **Slack 連動で `email_from`（送信元アドレス）が取得済み** — Webhook ペイロードの `data.from` を Slack 通知に使っており、同じ値を `resend_webhook_log.email_from` にも保存している。万が一 sourceId の設定を誤っても、`email_from` から送信元を事後的に推定できる
3. **`resend_webhook_sources` テーブルで事前に sourceId を登録・検証する** — 未登録の sourceId は 404 で拒否されるため、誤った URL で送信された Webhook を検知できる

## 注意事項

- Resend ダッシュボードで Webhook URL を変更する際は、パス末尾の sourceId が `resend_webhook_sources` テーブルに登録済みであることを必ず確認すること
- `resend_webhook_sources` にソースを追加したら、Resend ダッシュボードの Webhook URL もあわせて更新すること（片方だけでは動作しない）
- ソースごとに異なる Webhook シークレットを使い分ける場合は `resend_webhook_sources.webhook_secret` に値を設定する。未設定の場合は環境変数 `RESEND_WEBHOOK_SECRET` がフォールバックとして使われる
