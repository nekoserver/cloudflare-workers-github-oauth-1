# NOTICE: tree-wasm(treeコマンドのWASM移植)の知見

日付: 2026-09-17

## この知見の出自について

**対象**: 本ドキュメント全体の前提。

`tree-wasm`本体(`wasm/tree-wasm/src/lib.rs`ほか)は本セッションのClaudeが実装したものではなく、
`codex/tree-wasm`等`codex/`プレフィックスのブランチ(別のAIエージェント「Codex」)がPR #1852で
実装したものである(`git log --format="%an <%ae> %s"`で確認済み)。以下はコードを読んで確認した
事実であり、実装時の一次体験ではない点に留意すること。

## tree-wasmは「登録されているが未ビルド」の状態

**対象**: `src/data/wasmModuleRegistry.ts`の`id:'tree'`エントリ、`wasm/tree-wasm/src/lib.rs`。

`wasmModuleRegistry.ts`にはWASMモジュール一覧のUIカタログ用エントリとして`tree`が登録されて
いるが、実体は次の状態である。

- `approxSize: '未ビルド'`
- `sizeBytes: 0`
- `builtAt: '未ビルド'`

つまり`wasm/tree-wasm/src/lib.rs`(263行、Rustで`tree(1)`風のNode/Optionsモデル・
`wildcard_matches`によるワイルドカードパターンマッチを実装済み)は**ソースコードとして
存在するだけで、`wasm32`ターゲットへのビルド・デプロイは行われていない**。UIの
モジュール一覧に載っているからといって、実際にWASMとして実行されているわけではない。

## 本番で動いているのはWASMではなくTypeScriptの移植版(パリティアダプタ)

**対象**: `src/utils/treeWasmServer.ts`(101行)、`src/utils/aichatSlashCommand.ts`の
`/neko tree`サブコマンドハンドラ。

実際にAIチャットのスラッシュコマンド`/neko tree`から呼ばれているのは、Rust/WASMではなく
`src/utils/treeWasmServer.ts`内の`formatTreeViaWasm()`という**TypeScriptで書き直した
パリティ実装**である。`matchesPattern`等、Rust版と同等のロジックをTypeScriptで再実装して
あり、Workers上でWASMランタイムを介さずそのまま動く。

`/neko tree`のオプション体系(`aichatSlashCommand.ts`で解析)は次の通り:

- `--depth`
- `--pattern` / `-P`
- `--files-only` / `-f`
- `--dirs-only`
- `--hidden` / `-a`
- `--reverse` / `-r`
- `--time` / `-t`
- `--sort`

これらのオプションを解析した後、`deps.repositoryTree(repoArg, depth, treeOptions)`を呼び、
GitHub API経由で取得したリポジトリのパス一覧をツリー整形して返す。**「WASMモジュール」と
名付けられているが、現状の実行系統に本物のWASMバイナリは介在していない**ため、パフォーマンス
上の期待値をWASM前提で見積もらないこと。

## dynamicnekoの`/tree-view`ページはtree-wasmとは無関係(コードレベルでは非連携)

**対象**: dynamicneko `src/components/tree-view-page.tsx`(1174行)、
`src/data/tree-view-sample-data.ts`、`src/server.ts`、`src/tree-view-raw-path.ts`。

依頼文面上は「tree-wasmをtree-viewページにまとめた」という繋がりを想定しやすいが、
実際にコードを確認した結果、**この2つは概念(GitHub上のパス・種別・タイムスタンプ情報から
ツリー構造を組み立てる)を共有しているだけの別機能であり、コードレベルの連携(呼び出し・
共有モジュール・共有APIエンドポイントいずれも)は存在しない**。

- `/tree-view`ページは`TREE_VIEW_SAMPLE_DATA`という**静的なハードコードスナップショット
  データ**(本リポジトリ自身のファイル一覧を手作業でスナップショットしたもの)を描画している。
  `formatTreeViaWasm()`や`/neko tree`の出力をライブで取り込んではいない
- ファイル本文・HTMLプレビューの取得は`GET /api/tree-view/raw`・
  `GET /api/tree-view/html-preview`(`server.ts`)というdynamicneko独自のプロキシ経由で
  行っている。**理由**: ブラウザのCSP(`connect-src 'self'`)が`raw.githubusercontent.com`への
  直接fetchをブロックするため、サーバー側で一度取得してから返す設計になっている
- パスのバリデーションは`src/tree-view-raw-path.ts`が担当し、パストラバーサル・隠しファイル・
  `.md`/`.html`以外の拡張子を拒否する
- 別途、`src/github-repo-tree.ts`(`fetchGithubUserRepos`・`repoSummariesToTree`・
  `RepoTreeNode`型)が`GET /api/github/repos`(`server.ts`)に配線されているが、`client.tsx`を
  grepしても呼び出し元のUIコンポーネントが見つからない。**おそらく`/tree-view`とは別に
  用意された未使用/準備中のモジュールであり、現状デッドコードに近い**

## 教訓: 「移植した」「まとめた」という依頼文面を、実際のコード連携があると即断しない

**対象**: 本セッションの調査プロセス全体への反省。

依頼文の言い回し(「WASMにtreeコマンドをtree-wasmとして移植したことの知見と、それを
tree-viewページにまとめたことまで」)は、2つの取り組みが1本のパイプラインとして繋がって
いるかのように読める余地があった。しかし実際に`git log`・grep・ソースコードで裏を取った
結果、**両者は「同じテーマ(ツリー表示)を扱う別々の機能」であり、片方の出力がもう片方の
入力になっているわけではない**ことが判明した。CLAUDE.mdルール12(推測するな、データで
裏を取れ)通り、依頼文面のニュアンスだけで「連携している」と決めつけず、実際のコードを
読んでから記録する必要がある典型例だった。
