# Docker ビルドの前提処理(2026-10-31)

コンテナのイメージ(`containers/demo/Dockerfile`)をビルドする前に、必ず通す前提処理を定める。本番のビルド(Workers Builds)、エージェントの検証ビルド、Dockerfile の変更のすべてに適用する。

---

## 1. 前提処理の一覧

**対象**: `containers/demo/Dockerfile` を変更するとき、または Docker ビルドを行うとき(`scripts/check-cf-containers.sh` を含む) — ビルドの前に、無駄なビルドと、不要なソースビルドを止める。

| 順番 | 前提処理 | 強制の仕組み | 失敗したとき |
|---|---|---|---|
| 1 | ドキュメントだけの変更(`*.md`)では、本番のビルドを走らせない | Workers Builds の「Build watch paths」で `*.md` を除外する(Cloudflare のダッシュボードで、ユーザーが設定する) | ビルドしない |
| 2 | 公式のコンパイル済みのバイナリがあるパッケージは、それを使う。ソースからのビルドは、許可の表に理由を書いたものだけ | `src/cf-containers-source-build-allowlist.test.ts` | テストが失敗する |
| 3 | 取得したバイナリは、sha256 で照合する | `src/cf-containers-prebuilt-binaries.test.ts`(gh・jj)と、Dockerfile の `sha256sum -c` | テストが失敗する。ビルドでは照合で止まる |
| 4 | 外部ツールの版と、契約テストを確かめた版が一致する | `src/cf-containers-t3-contract.test.ts`・`src/cf-containers-go-toolchain.test.ts` | テストが失敗する |
| 5 | ソースからビルドしたら、パッケージまで作って動作を確かめた時点で、ソースツリーとビルドのキャッシュを捨てる | `src/cf-containers-source-build-allowlist.test.ts` の `CLEANUP` | テストが失敗する |
| 6 | エージェントの `git push` の前に、2〜5 を自動で検査する | `scripts/claude-push-guard.js`(`.claude/settings.json` の PreToolUse フック) | push を止める(終了コード2) |
| 7 | エージェントが Docker ビルドをするのは、条件を満たし、ユーザーの許可を得たときだけ | AGENTS.md「Dockerビルドの実行条件」と、CLAUDE.md ルール42 | ビルドしない |

### 背景
- gh と jj は、公式の GitHub リリースにコンパイル済みのバイナリがある。それなのに毎回ソースからコンパイルしていて、本番のビルドで約19分(jj 875秒、gh 267秒、10/29 の実測)を使っていた。
- 10/21 にソースビルドへ変えた理由は「エージェントのサンドボックスから配布元に届かない」ことで、本番のビルドとは関係がなかった(#2508 で戻した)。
- ドキュメントだけの PR をマージしても、毎回コンテナのイメージを作り直していた。
- ルールを文書に書くだけでは、読み忘れると守られない。そこで、テストと自動の検査で強制する(ユーザー指定 2026-10-31)。

## 2. ソースからのビルドの許可の表

**対象**: `src/cf-containers-source-build-allowlist.test.ts` の `ALLOWED_SOURCE_BUILDS` — Dockerfile の中で、ソースからのビルドを許すステージと、その理由。

| ステージ | コンパイル済みを使えない理由(2026-10-31) | 解消する条件 |
|---|---|---|
| `tailscale-build` | GitHub のリリースにバイナリが無い。`pkgs.tailscale.com` はエージェントのサンドボックスから届かず、1.104.4 の sha256 を確かめられていない | `pkgs.tailscale.com/stable/tailscale_<版>_amd64.tgz` の sha256 を確かめる(ユーザーから受け取るか、届く環境で取得する) |
| `ruby-build` | 公式のコンパイル済みは、Debian 向けの Docker イメージだけ。Ubuntu のイメージへそのまま COPY して動くかを確かめていない | 依存ライブラリ(libssl・libyaml・libffi など)が合うことを確かめる |

- ソースビルドとみなす処理: `go install`、`cargo install`、`./configure`、`make -j`/`make install`、`cmake`、`npm build`/`npm run build`。
- 表に無いステージがソースビルドしていると、テストが失敗する。理由が解消したのに表に残っている項目があっても、テストが失敗する。
- 表に足すのは、ユーザーの許可を得てからにする。

## 3. ソースツリーの破棄

**対象**: 許可したソースビルドのステージ(`tailscale-build`・`ruby-build`)と、エージェントの手元(スクラッチパッド) — ビルドの後に、ソースツリーとビルドのキャッシュを残さない(ユーザー指定 2026-10-31)。

| ステージ | 動作の確認 | 削除 |
|---|---|---|
| `tailscale-build` | `/go/bin/tailscale version`・`/go/bin/tailscaled --version` | `go clean -modcache -cache` |
| `ruby-build` | `/opt/ruby/bin/ruby --version`・`-ropenssl -ryaml -rzlib -rfiddle` | `rm -rf /tmp/ruby-src /tmp/ruby.tar.gz` |

- 順番: パッケージ(インストール先)を作る → 動作を確かめる → ソースとキャッシュを消す。Docker では、同じ `RUN` の中で行う。
- ビルド済みのパッケージのキャッシュ(保存先は未決定)を導入したときは、キャッシュから読み込めることを確かめてから、ソースツリーを消す。
- エージェントの手元で取得・展開したソースツリーや配布物の展開先も、成果物の確認が済んだら消す。

## 4. 公式のバイナリの取得元

**対象**: Dockerfile の実行ステージ — 公式のリリースから取得するパッケージと、照合の方法。

| パッケージ | 取得元 | sha256 の出どころ |
|---|---|---|
| gh | `https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_amd64.tar.gz` | 公式の `gh_<版>_checksums.txt` |
| jj | `https://github.com/jj-vcs/jj/releases/download/v${JJ_VERSION}/jj-v${JJ_VERSION}-x86_64-unknown-linux-musl.tar.gz` | 配布物から計算した値(公式のチェックサムのファイルが無い) |
| cloudflared | `https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/cloudflared-linux-amd64.deb` | Dockerfile の `CLOUDFLARED_SHA256` |
| Node | `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz` | Dockerfile の `NODE_SHA256` |

- 版を上げるときは、sha256 も一緒に上げる。gh と jj は、`src/cf-containers-prebuilt-binaries.test.ts` の版と sha256 の組の表もあわせて直す。

## 5. push の前の自動検査

**対象**: `scripts/claude-push-guard.js`、`.claude/settings.json` の `hooks.PreToolUse`(matcher: `Bash`) — エージェントが `git push` を実行する前に、自動で検査する。

- 対象の変更: `containers/`、`src/containers/`、`src/views/cfContainers.ts`、`src/cf-containers*` に触れる変更(`origin/main` との差分)。
- 検査: `npx vitest run src/cf-containers`。前提処理の2〜5 のテストは、すべてここに含まれる。
- 失敗したら終了コード2で push を止め、失敗したテストの行をエージェントに返す。
- テスト: `src/claude-push-guard.test.ts`。

### 注意事項
- このフックが働くのは、このリポジトリで動く Claude Code のエージェントだけ。人の手元の `git push` には働かない(`.githooks/pre-push` は `core.hooksPath` が未設定のため、有効になっていない)。
- 前提処理の1(Build watch paths)は、Cloudflare のダッシュボードの設定で、エージェントからは変えられない。設定されたかどうかも、エージェントからは確かめられない。

## 関連コミット
- [`7fa95eb7`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7fa95eb7) コンテナ: ghとjjをソースからビルドせず、公式のリリースのバイナリを使う
