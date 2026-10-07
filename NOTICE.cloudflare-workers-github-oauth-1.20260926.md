# NOTICE: `/webhook/github`の設定場所と受信条件

2026-10-08訂正。旧記述「リポジトリSettings → Webhooksから作成したWebhookだけが使え、GitHub App側では機能しない」は、現行実装の制約ではない。

リポジトリWebhookとGitHub App Webhookは別の設定経路だが、どちらも本番の`/webhook/github`へ正しい署名付きイベントを送れば受信対象になる。GitHub Appでは対象リポジトリへのインストール・権限・イベント購読も必要。OAuthのClient ID・Client Secretの設定だけでは配信されない。

`gh api repos/<owner>/<repo>/hooks`の結果が空でもGitHub AppやOrganizationの配信設定は未確認であり、webhook未配信の原因と断定してはいけない。

具体的な設定・PATの用途・保存失敗の調査手順は[通知パイプラインNOTICEの2節](NOTICE.cloudflare-workers-github-oauth-1.github-webhook-slack.md#2-経路a-github--本体worker-webhookgithub)を参照。
GitHub側の設定種別は[公式ドキュメント](https://docs.github.com/en/webhooks/types-of-webhooks)を参照。
