# HISTORY: cloudflare-workers-github-oauth-1 (Latest)

> この履歴は `git log` のコミットログを基に、日付ごとに「いつ・どういう変更をしたか」を要約したものです。

---

## 2026-03-16

- [`ae639c6`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ae639c6) NOTICEファイルのタイポ修正とIssue #32へのリンク追加
- [`f73b5fc`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f73b5fc) Install Appフローのコールバック分岐について重要事項をREADMEに追記
- [`3e6cfb7`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3e6cfb7) NOTICEファイル運用ルールをCLAUDE.mdに追加
- [`9e95acb`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/9e95acb) Install App後にプライベートリポジトリを表示する手順をNOTICEに記載
- [`ba4cbc1`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ba4cbc1) GitHub App Install Appフローでstate不一致エラーになる問題を修正
- [`3abcd07`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3abcd07) スコープ不足時の再認証フローとUIを追加
- [`c98a14d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c98a14d) D1診断エンドポイントにテスト書き込みを追加
- [`2e424f2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/2e424f2) D1接続診断エンドポイント /api/debug/d1 を追加
- [`89b99a3`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/89b99a3) D1マイグレーションスクリプトを全ファイル対応に修正
- [`e5a4763`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e5a4763) D1データベースバインディングを有効化
- [`a0e5e49`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a0e5e49) 設定ページのセクション名変更とモーダルにリポジトリ概要を表示
- [`7f5e9c4`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7f5e9c4) リポジトリページでJWTフォールバックのアクセストークンを使用
- [`aec3ef4`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/aec3ef4) リポジトリ行タップで権限モーダルを表示

## 2026-03-15

- [`2291890`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/2291890) PR #28 をマージ
- [`e08a15b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e08a15b) リポジトリ一覧の余白修正とプライベートリポジトリの表示修正
- [`27f752f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/27f752f) PR #27 をマージ
- [`efa326a`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/efa326a) リポジトリリンクと最新コミットリンクを追加
- [`25f62d7`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/25f62d7) PR #26 をマージ
- [`207441d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/207441d) 非同期設定ハンドラを修正
- [`6bdd3ba`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6bdd3ba) PR #25 をマージ
- [`64208f6`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/64208f6) GitHub OAuthスコープを設定画面に表示
- [`0f10b29`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/0f10b29) PR #24 をマージ
- [`c2fe831`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c2fe831) リポジトリページ用にGitHubトークンを保存
- [`0142744`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/0142744) PR #23 をマージ
- [`c3f20e1`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c3f20e1) リポジトリページとメニューリンクを追加

## 2026-03-13

- [`86617d7`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/86617d7) 仕様差分と評価ドキュメントを追加
- [`f4704b1`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f4704b1) Resend/Slack機能を含む統合仕様書を追加
- [`69079a8`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/69079a8) Resend webhookの送信結果をSlackに投稿する内容を拡充
- [`c155d7d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c155d7d) Resend webhook受信時のSlack通知機能を追加

## 2026-03-12

- [`9fd0625`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/9fd0625) Resend webhookのオリジン通知URLを修正
- [`af96124`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/af96124) Resend webhookの非POSTを405で拒否
- [`d2b8c0d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d2b8c0d) Resend webhook受信ハンドラを追加

## 2026-03-08

- [`58bfe31`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/58bfe31) PR #12 をマージ
- [`f7488fd`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f7488fd) Monodocスタイルのルールドキュメントを追加
- [`90332cb`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/90332cb) PR #11 をマージ
- [`f4b8b6a`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f4b8b6a) PR #10 をマージ
- [`e2e0d2b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e2e0d2b) PR #9 をマージ
- [`cef3bce`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/cef3bce) PR #8 をマージ
- [`9d1111b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/9d1111b) PR #7 をマージ
- [`22e8cca`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/22e8cca) PR #6 をマージ
- [`af81f4d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/af81f4d) PR #5 をマージ
- [`e42a2da`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e42a2da) PR #4 をマージ
- [`ceea8b5`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ceea8b5) PR #2 をマージ
- [`0c208f3`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/0c208f3) PR #1 をマージ

## 2026-03-07

- [`d80b515`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d80b515) HTMLガイドに折りたたみ可能なフェーズとフォーカス可能なステップブロックを追加
- [`e41dac1`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e41dac1) 左ナビ幅を280pxから240pxへ調整
- [`4f96593`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/4f96593) サイドバー付きのCLONE_JOBS HTMLを追加
- [`1d92fda`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/1d92fda) CLONE_JOBSの構成を再整理
- [`64a95f4`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/64a95f4) CLAUDE.mdに再発防止の行動ルールを追加
- [`56e9050`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/56e9050) `wrangler.toml` の `GITHUB_CLIENT_ID` を `vars` から削除
- [`cdd35e4`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/cdd35e4) CLAUDE.mdをワークフロー定義として再構成
- [`fc9f60a`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/fc9f60a) CLAUDE.mdにデプロイ制約と過去のトラブル対応を追記
- [`62a7a0c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/62a7a0c) Worker名を `cloudflare-workers-github-oauth-1` に修正
- [`f60c77f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f60c77f) CLAUDE.mdに環境制約とセッションメモを追加
- [`3300f9c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3300f9c) 新規セットアップ向けCLONE_JOBS手順書を追加
- [`09943d7`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/09943d7) OAuthコールバックのルートをGitHub App設定に合わせて修正
- [`ea91d8f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ea91d8f) 既存リポジトリから全ファイルをコピー
- [`e930fe9`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e930fe9) セキュリティ計画と拡張ロードマップを追加
- [`8c07d31`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8c07d31) Initial commit
