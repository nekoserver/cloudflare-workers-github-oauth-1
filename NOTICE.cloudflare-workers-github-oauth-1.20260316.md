# このアプリインストール後にプライベートリポジトリを表示させる方法

## Q. GitHub OAuth でログインしても `/repositories` にプライベートリポジトリが表示されない。どうすればいい？

### A. GitHub App の「Install App」フローでリポジトリへのアクセス権を付与する

GitHub OAuth だけではパブリックリポジトリしか取得できない場合がある。
プライベートリポジトリを表示するには、GitHub App としてのインストール（リポジトリアクセス許可）が必要。

### 手順

1. GitHub App の設定ページ（`https://github.com/apps/<your-app-name>`）を開く
2. **「Install App」** リンクをクリックする
3. アクセスさせたいアカウント／Organization を選択する
4. **「Only select repositories」** または **「All repositories」** を選び、表示させたいプライベートリポジトリを選択する
5. **「Install」** をクリックしてインストールを完了する
6. アプリを再ビルド・再デプロイする（コールバック修正等が含まれる場合）
7. 再ログイン（ログアウト → ログイン）する
8. `/repositories` にアクセスすると、選択したプライベートリポジトリが表示される

### 補足

- GitHub App の「Install App」コールバックは `/github/callback?setup_action=install` として戻ってくる。これは通常の OAuth 認証フロー（state/PKCE パラメータ付き）とは異なるため、コールバックハンドラで分岐処理が必要（[Issue #32](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/issues/32) で対応済み）
- Install App フローを経ていない場合、OAuth トークンだけではプライベートリポジトリの一覧取得に必要な権限が不足する
- リポジトリの選択範囲は後から GitHub App の設定ページで変更可能
