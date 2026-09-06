# NOTICE 2026-09-06

## 1. このリポジトリのgitクローンはshallow clone(浅いクローン)で始まる場合がある

**対象**: `git log`・`git log -S`・`git blame`など、コミット履歴を根拠にした調査全般
(コミット履歴の突き合わせレポート作成、バグの原因コミット特定、`ts_function_catalog`の
`last_modified_at`算出等)。

### 症状

`git rev-parse --is-shallow-repository` が `true` を返す状態でセッションが開始することがある
(観測時点で `git log --oneline | wc -l` が176件のみ)。この状態で特定ファイル(例:
`src/index.ts`)の履歴を辿ると、実際にはPRを重ねて何年も編集され続けているファイルが、
浅いクローンの境界となったコミットで **突然「新規ファイルとして18,238行が追加された」ように
見える**。`git log -S"<任意の文字列>"`でこのファイル内の文字列を検索すると、本来は無関係な
別の日の別のコミットが「唯一の変更コミット」として返ってきてしまい、履歴の突き合わせが
実質的に機能しなくなる。

### 気づき方

- `git rev-parse --is-shallow-repository` で `true` が返る
- 特定ファイルの`git log --oneline -- <file> | wc -l`が、リポジトリの規模・PR数
  (`git log --oneline | wc -l`や`repo_commit_index`テーブルの件数)に対して不自然に少ない
- `git show <commit> -- <file>` で `new file mode` と出るのに、その内容が明らかに
  長期間かけて育ってきたはずのファイル(何千行もある`src/index.ts`等)である

### 対処

作業開始時、履歴を根拠にした調査(コミットリンク付きレポート、原因コミット特定等)を行う前に
`git fetch --unshallow` を実行してフル履歴を取得すること。実行後は
`git rev-parse --is-shallow-repository` が `false` になり、`git log`が本来のコミット数
(このリポジトリでは3560件、`src/index.ts`だけで679件)を返すようになる。

### 実例

2026-09-06、`src/index.ts`中の478件の`db.prepare()`呼び出しからD1クエリカタログを作成する
セッション(`REPORT.cloudflare-workers-github-oauth-1.D1QUERYCATALOG.20260906.md`参照)で、
`git log -S`によるクエリ変更履歴の検索結果が、251件中ほぼ全てが同一の無関係なコミット
(`/gh-attachのアップロード修正`コミット)を指すという不自然な結果になり、原因を辿った結果
shallow cloneであることが判明した。`git fetch --unshallow`後に再生成したところ、
クエリごとに異なる妥当なコミットが返るようになった。
