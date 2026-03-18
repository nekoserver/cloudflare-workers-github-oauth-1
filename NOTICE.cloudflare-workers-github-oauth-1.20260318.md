# GitHub OAuth で別アカウントに切り替える方法

## Q. ログアウト後に別の GitHub アカウントで再ログインしたいが、同じアカウントで自動認可されてしまう。どうすればいい？

### 背景

GitHub OAuth は Google のようなアカウントピッカー（`prompt=select_account`）を**サポートしていない**。
ブラウザ上で GitHub にログイン済みの場合、`/login/oauth/authorize` へリダイレクトすると
ユーザーに選択肢を見せずに既存セッションのアカウントで即座にコールバックが返る。

このため、単にアプリ側のセッション（Cookie）を消してから再度 OAuth フローを開始しても、
同じ GitHub アカウントで自動認可されてしまい、**別アカウントへの切り替えができない**。

### 解決策: `login` パラメータ

GitHub の `/login/oauth/authorize` エンドポイントには `login` パラメータがある。

```
https://github.com/login/oauth/authorize?client_id=xxx&login=
```

- `login=""` (空文字) を指定すると、**GitHub のログイン画面が強制表示**される
- ユーザーはそこで現在のアカウントからログアウトし、別アカウントで認証できる
- `login=specific_user` を指定すると、そのユーザー名が入力欄にプリフィルされる

### このアプリでの実装

| エンドポイント | 動作 |
|---|---|
| `GET /auth/switch` | Cookie を全削除 → `/auth/github?prompt=switch` にリダイレクト |
| `GET /auth/github?prompt=switch` | authorize URL に `login=""` を付与して GitHub へリダイレクト |
| `GET /auth/github` (通常) | `login` パラメータなし（既存アカウントで自動認可） |

**UI 上の配置**: 全ページ右上のドロップダウンメニューに「🔄 別アカウントでログイン」として表示。
設定ページの Danger Zone にも同等の機能がある。

### 注意事項

- `login=""` を付与しても GitHub 側でログイン画面が表示されるだけであり、
  アプリ側で GitHub のセッションを制御しているわけではない
- GitHub 側で二段階認証（2FA）を有効にしている場合、切り替え時にも 2FA が求められる
- GitHub がブラウザに保存している Cookie は GitHub 側の仕様で管理されており、
  プライベートブラウジングを使えば完全に独立したセッションで認証できる

### 参考

- [GitHub OAuth Authorize パラメータ](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#parameters)
  - `login`: GitHub ログインフォームにプリフィルするアカウント名を指定できる
- Google OAuth との違い: Google は `prompt=select_account` でアカウントピッカーを表示できるが、
  GitHub にはこの概念が存在しない
