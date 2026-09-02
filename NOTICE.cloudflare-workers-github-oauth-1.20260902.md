# NOTICE 2026-09-02

## `/gh-attach`(gh issue create --attach移植)のアップロードは classic PAT 以外では動かない

**対象**: `/gh-attach`ページ、`POST /api/gh-attach/upload`(`src/index.ts`)、
`GH_ATTACH_UPLOAD_TOKEN`環境変数 — GitHubの非公開アップロードエンドポイント
`https://uploads.github.com/user-attachments/assets`が、トークンの種類によって
挙動が大きく異なるという、公式ドキュメントに書かれていない制約が実際に確認できた。

### 分かったこと

`uploads.github.com/user-attachments/assets`(`gh issue create --attach`が
内部で使う、GitHub公式ドキュメントに存在しないエンドポイント)は、トークンの
種類によって以下の挙動になることが実機で確認できた。

| トークンの種類 | 結果 |
|---|---|
| GitHub App の user-to-server トークン(`ghu_`) | **404 Not Found**(Repository permissions・インストール範囲・SSO・新権限承認をすべて正しく設定しても解消しない) |
| Fine-grained PAT | **403 Forbidden**(`Resource not accessible by personal access token`) |
| **Classic PAT**(`ghp_`、`repo`スコープ) | **成功** |

cli/cli(`gh` CLI)本家はこの機能をclassic OAuth App/PAT前提で実装しており
(`internal/attachments/client.go`のコメントに実装意図が書かれている)、
GitHub Appのトークンやfine-grained PATでの動作は検証されていない・想定されて
いないと考えられる。

### 気づきにくいポイント

- GET `/repos/{owner}/{repo}`(通常のREST API)は`ghu_`トークンでも問題なく
  動作するため、「トークンは正常に機能している」と誤認しやすい。実際に失敗する
  のはこの`uploads.github.com`の非公開エンドポイントだけ
- GitHub Appの404は「リポジトリが存在しない」ではなく「書き込み権限が無い」を
  意味する仕様(`internal/attachments/client.go`のコメント参照)なので、
  Repository permissions・インストール範囲を何度確認しても直らず、時間を浪費した
- fine-grained PATは「新しい・より安全なトークン」という位置づけだが、この
  エンドポイントに関してはclassicトークンでなければ動かない。GitHubの
  「Generate new token」ページはデフォルトでfine-grainedタブが開くことが
  多く、意識しないとclassicで発行し忘れる

### 忘れると損すること

このアプリ自体はGitHub Appとして動いており(`installation_permissions`
テーブル・Webhook等、GitHub Appインフラを前提にした設計)、通常のGitHub API
呼び出しは全部GitHub Appのユーザートークンで問題なく動く。**`/gh-attach`の
アップロードだけ**が例外で、`GH_ATTACH_UPLOAD_TOKEN`という別のclassic PATを
`wrangler secret put`で設定する必要がある。この事情を知らずに見ると
「なぜこの機能だけ別のトークンを要求するのか」が分かりにくい。

新しいGitHub関連機能を追加する際、「非公開・undocumented なエンドポイント」を
使う場合は、GitHub Appトークンでの動作を無条件に信用せず、classic PATでの
動作確認を先に行うこと。
