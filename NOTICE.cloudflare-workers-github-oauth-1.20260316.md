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

---

# GitHub上でOAuthアプリのパーミッションを変更したのにアプリ側のリポジトリ詳細モーダル内に即座に反映されない問題

## 現象

GitHub App の開発者設定（App Settings）でパーミッション（Contents, Issues, Pull Requests 等）を変更しても、アプリの `/repositories` ページのリポジトリ詳細モーダル内に表示される権限情報が更新されない。

## 原因

GitHub App のプラットフォーム仕様による。

開発者側で権限を変更しても、**既存のインストールには即座に反映されない**。GitHub は既存インストールのオーナーに「Review request」通知を送り、オーナーが明示的に承認するか、アプリを再インストールしない限り、旧権限のまま動作し続ける。

| 操作 | 既存インストールへの反映 |
|---|---|
| App Settings で権限を**追加** | 承認待ち（自動反映されない） |
| App Settings で権限を**削除** | 即座に反映 |
| アプリを**再インストール** | 最新の権限で即座に反映 |

これは Slack App のパーミッション変更時と同じ挙動であり、GitHub / Slack 共通のプラットフォーム設計思想である。

## 解決方法

### 方法1: 承認バナーから承認する

`https://github.com/settings/installations/{installation_id}` のページに黄色い「Review request」バナーが表示されていれば、それをクリックして承認する。

### 方法2: アプリを再インストールする

1. `https://github.com/settings/installations/{installation_id}` → **Uninstall**
2. GitHub App ページから再度 **Install**
3. リポジトリの選択範囲を設定して **Install** を完了

### 方法3: Webhook による自動反映（実装済み）

`POST /webhook/github` エンドポイントで GitHub App の `installation` イベントを受信し、D1 に権限を保存する仕組みを実装済み。再インストール時に以下が自動実行される:

- `installation` → `deleted`: D1 から旧レコードを削除
- `installation` → `created`: 最新権限で D1 に新規保存

これにより、再インストール後はページを再読み込みするだけでモーダル内の権限表示が最新状態に更新される。

## 教訓

- GitHub App の権限変更は「開発者側の設定変更」と「インストール側の承認」の2段階であることを意識する
- 権限を追加した場合は、必ず既存インストールの承認または再インストールが必要
- この挙動は GitHub / Slack など主要プラットフォーム共通のパターン
