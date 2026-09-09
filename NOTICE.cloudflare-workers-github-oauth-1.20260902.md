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

## Rust/WASM(`wasm/gh-wasm`)で`gh pr list`相当を実装する際の知見

**対象**: `wasm/gh-wasm/src/lib.rs`の`format_pr_list`、`src/index.ts`の
`fetchAndFormatGhPrList`、`src/utils/ghWasmServer.ts` — GitHub CLI(`gh pr
list`)相当をRust/WASM + Worker側fetchで再実装する際に、素朴にGitHub REST
APIをそのまま整形するだけでは実機のCLI相当の情報が欠落する、という制約が
複数回見つかった。今後同種の`gh`コマンド移植(`gh pr view`、`gh pr
checks`等)をする際に同じ落とし穴を踏まないためにまとめる。

### 一覧取得(list)エンドポイントは実は情報が薄い

`GET /repos/{owner}/{repo}/pulls`(一覧)のレスポンスには**`mergeable`・
`mergeable_state`が含まれない**。これらはGitHub側で非同期に計算される
フィールドで、`GET /repos/{owner}/{repo}/pulls/{number}`(個別取得)を
呼んだときだけレスポンスに乗る(それも初回アクセス時は`null`/`"unknown"`
になり得り、GitHub側が裏で計算を開始するだけの場合がある)。

`gh pr list`はローカルCLIなので実行のたびに複数APIを叩いて補完しており、
単純にREST API一覧エンドポイントをラップしただけでは「本家ghコマンドに
存在する情報が出ない」状態になる。**一覧系のコマンドを移植するときは、
一覧エンドポイントのレスポンスだけで完結すると思わず、GitHub公式ドキュメント
で個別取得エンドポイントとのフィールド差分を先に確認すること。**

今回`mergeable_state`(コンフリクト有無)が一覧に無いと気づかず、
最初のPRでは「コンフリクト検出ができていない」状態のまま一度マージされて
しまった(ユーザー指摘で気づき、別PRで個別取得を並列実行するよう追加修正)。

### 対処: 一覧+個別取得のN+1をどう許容するか

- PR一覧の各PRについて`GET /repos/{owner}/{repo}/pulls/{number}`を
  `Promise.all`で並列fetchし、`mergeable_state`を補完する設計にした
  (`src/index.ts`の`fetchAndFormatGhPrList`)
- GitHub APIのレート制限(認証済みユーザートークンで5000req/h)を考えると、
  オープンPRが数十件を超えるような巨大リポジトリでは無条件の全件個別取得は
  リスクになる。今回は許容したが、**PR件数が多いリポジトリを想定する場合は
  上限件数を設けてから個別取得するなどの対策を検討すること**(今回は
  スコープ外として未実装)
- 個別取得が失敗しても一覧表示全体を失敗させず、該当PRだけ「確認中」表示に
  フォールバックする設計にした(CLAUDE.mdルール8: 握りつぶす場合の3義務
  「記録・通知・テスト」を満たすため、失敗時は`logger.warn`で記録しつつ
  `null`を返す)

### Rust側(serde)でAPIレスポンスの未知フィールドを追加するときの型設計

`PullRequest`構造体に新しいフィールド(`mergeable_state`)を追加する際、
`Option<String>`にしておけば、そのフィールドが存在しないJSON(既存のテスト
データや、Worker側でまだ個別取得結果を結合していない場合)でも
`serde_json::from_str`が失敗せず`None`になる。**JSON側のフィールドを
`Option`にせず必須にしてしまうと、後方互換性が壊れて既存のテスト/呼び出し
元が軒並みエラーになるので注意**(今回は最初から`Option`で設計したため
影響なし)。

### gh-wasmの列追加はMarkdownテーブルの列数変更を伴う

`format_pr_list`が返すMarkdownテーブルに列を追加すると、区切り行
(`|---:|---|:---:|---|`のような行)の列数も一致させないと市販の
Markdownパーサ次第では列がずれて描画される。`src/utils/markdownRenderer.ts`
の`parseMd`は区切り行の列数とヘッダ行・データ行の列数が一致している前提で
`text-align`を割り当てるため、**列を追加したら必ずヘッダ行・区切り行・
データ行生成部分の3箇所を同時に直すこと**(1箇所だけ直して残りを忘れる
凡ミスが起きやすい)。

### クライアント側バッジ化の列インデックスはハードコードなので列追加のたびに要修正

`src/views/aichat.ts`の`styleGhPrListBubble`は`cells[3]`(状態列)・
`cells[4]`(コンフリクト列)のように列位置を決め打ちでDOM操作している。
Rust側でテーブルの列順・列数を変えた場合、ここのインデックスも同時に
直さないと「別の列の値が誤ってバッジ化される」「新しい列がバッジ化されない」
バグになる。テストコード側もクエリセレクタを`table .gh-pr-state-badge`の
ように広く取ると、見出し側に別のバッジ(Draft/Open件数バッジ)を追加した際に
誤ってヒットしてテストが壊れることがあるため、行単位(`tbody tr`)で
スコープを絞ったセレクタを使うこと。
