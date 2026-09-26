# NOTICE: `/webhook/github`が機能するのはリポジトリ設定の Webhooks だけ

**対象**: `/webhook/github`エンドポイント(本体Worker`cloudflare-workers-github-oauth-1`)に向けるGitHub Webhookの作成場所。

## 重要

`/webhook/github`が受け付けるのは、各リポジトリの**「(アバターアイコンの下にある)Settings → Webhooks」から作成したWebhookだけ**。

**GitHub App(OAuthではなくGitHub App)のClient ID・Client Secretが書いてあるページのWebhook設定ではない。** GitHub App側のWebhook設定を触っても、このエンドポイントには届かない・機能しない。
