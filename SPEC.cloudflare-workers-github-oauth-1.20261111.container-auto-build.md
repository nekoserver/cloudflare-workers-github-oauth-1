# SPEC: demo コンテナのパッケージとイメージを GitHub Actions で作り直す(2026-11-11)

## 1. 背景と方針

**対象**: `containers/demo/`(Dockerfile・`packages/`・`image.lock.json`)、`wrangler.toml` の `[[containers]]` の `image`、新設の `.github/workflows/demo-packages.yml`・`.github/workflows/container-image.yml`・`scripts/demo-image-lock.mjs`・`scripts/demo-packages-apply.mjs` — Dockerfile を変えても、イメージを作り直すまで本番に入らない状態をなくす。

### 背景

- 2026-11-11 から、demo のイメージはビルド済みのものを digest で固定している。Workers Builds の Docker ビルドが `runc ... mounting "proc" ... operation not permitted` で落ち続けたため(`NOTICE.cloudflare-workers-github-oauth-1.20261111.md`)。
- 固定しているので、Dockerfile を変えても本番に入らない。`src/cf-containers-image-lock.test.ts` がずれを検出するが、作り直せる環境(Docker)が手元に無く、更新が止まる。2026-11-11 には、T3 0.1.9・Node.js 26.13.1(#2566)がマージされても本番は古いままだった。
- git と Apache は、Ubuntu 26.04 x86_64 でソースから作ったパッケージを `containers/demo/packages/` に置く決まり(ルール8)。手元のエージェントのコンテナは Ubuntu 24.04 で作れない。git 2.56.1(CVE-2026-111760 ほか6件の修正)と Apache 2.4.71(CVE-2026-119618 ほか)が入らないままだった。
- ユーザーの承認(2026-11-11): redmine(`SPEC.redmine.20261111.image-lock.md`)と同じく、GitHub Actions で作り直す。ルール39の「GitHub Actions は使わない」は、この2つのワークフローに限って改める。

## 2. 流れ

| 段 | 起動 | やること | 出すもの |
|---|---|---|---|
| パッケージ | 手動(`demo-packages`) | `ubuntu:26.04` のコンテナで `scripts/build-demo-packages-ubuntu26.sh` を実行(上流の公開ハッシュで照合)。`scripts/demo-packages-apply.mjs` で `packages/`・`SHA256SUMS`・Dockerfile の版とハッシュを更新し、テストを通す | パッケージを更新する PR |
| イメージ | main への push・手動(`container-image`) | `scripts/demo-image-lock.mjs --check` が一致すれば何もしない。違えば `image.lock.json` の `buildArgs` で `docker buildx build`、`npx wrangler containers push` で registry.cloudflare.com に送り、digest で `--write`。テストを通す | 固定を更新する PR |
| デプロイ | 固定を更新する PR のマージ | 今までどおり Workers Builds が、固定したイメージでデプロイする(イメージは作らない) | — |

パッケージの PR をマージすると、main への push で `container-image` が走り、イメージの PR が出る。その PR のマージで本番に入る。

## 3. 入力とハッシュ

- 入力は `src/cf-containers-image-lock.test.ts` と同じ: `git ls-files containers/demo` から `image.lock.json`・`tests/`・`*.md` を除いたもの。ハッシュも同じ形(名前・NUL・内容・NUL を名前の昇順に SHA-256)。
- `scripts/demo-image-lock.mjs` はこの計算をテストと共有しない独自の実装を持つが、テスト(`src/cf-containers-demo-image-lock-script.test.ts`)が、テスト側の計算と一致することを確かめる。

## 4. 必要な設定(ユーザー承認済み、2026-11-11)

- GitHub のリポジトリのシークレット `CLOUDFLARE_API_TOKEN`(コンテナのレジストリに送れる権限)と `CLOUDFLARE_ACCOUNT_ID`。redmine と同じ名前。ほかの変数は足さない。
- PR を出すのは Actions の `GITHUB_TOKEN`(`contents: write`・`pull-requests: write`)。
- 鍵は Docker のビルドに渡さない。ログに出さない。

## 5. 故障想定と対処

| 故障 | 検出・対処 |
|---|---|
| Dockerfile を変えたのにイメージが古い | `src/cf-containers-image-lock.test.ts` が落ちる。main に入れば `container-image` が作り直す |
| 同じ入力で毎回作り直す | `--check` が一致すれば止まる |
| 取得物の改ざん・破損 | ビルドスクリプトが上流の公開ハッシュで止まる。Dockerfile は `SHA256SUMS` と同じハッシュで照合する |
| Ubuntu 26.04 以外でパッケージを作る | ビルドスクリプトが OS を確かめて止まる |
| 送った digest が取れない | ワークフローが失敗し、PR を出さない |
| 書き換えの取りこぼし(古い版が残る) | `demo-packages-apply.mjs` が書き換え後に古い版が残っていないことを確かめ、残れば失敗する |
| PR に出す前のテスト失敗 | ワークフローが失敗し、PR を出さない |

## 6. 確かめていないこと

- GitHub Actions 上での実際のビルド・送信・PR の作成(シークレットの設定後に手動で1回実行して確かめる)。
- `ubuntu:26.04` のコンテナでのパッケージのビルド。

## GitHub Actions を使わない(2026-11-13、ユーザー指定)

**対象**: `.github/workflows/demo-packages.yml`・`.github/workflows/container-image.yml` — パッケージとイメージの作り直しに GitHub Actions を使うのをやめる。

- 2つのワークフローは GitHub 上で無効にした(`gh workflow disable`、2026-11-13)。ファイルは残すが、実行しない。
- 背景: 2026-11-12 は、手動起動も含めて Actions の実行がすべて `startup_failure` で、一度も動かなかった(リポジトリの Actions 設定は有効。原因はアカウント側と見られるが、未確認)。
- 代わりの作り方(2026-11-13、ユーザー指定): Workers Builds の本番のデプロイ(`npx wrangler deploy --containers-rollout=gradual`、設定済み)で、Dockerfile からイメージを作る。`wrangler.toml` の `image` を `./containers/demo/Dockerfile` に戻し、ビルド引数は `image_vars` で渡す。`containers/demo/image.lock.json` は、最後に動いたイメージ(戻す先)の記録として残す。11-11 の `runc` の `/proc` の失敗が今も起きるかは、この変更のビルドで確かめる。落ちたら、`image.lock.json` の digest を `image` に書いて戻す。
- パッケージ(git・Apache)の作り方は未決。パッケージ(git・Apache)は、CLAUDE.md のコンテナビルドのルール8のとおり、十分な CPU のある Ubuntu 26.04 x86_64 で `scripts/build-demo-packages-ubuntu26.sh` を実行し、`scripts/demo-packages-apply.mjs` で反映する。イメージの作り直しと `image.lock.json` の更新は、Docker を使える環境が要る(Workers Builds では Docker が使えない。NOTICE.cloudflare-workers-github-oauth-1.20261111.md)。
- エージェントのサンドボックス(2026-11-13 時点、Ubuntu 26.04 x86_64・1 CPU・メモリ 4GB・空きディスク 2.3GB・Docker なし)は、どちらにも向かない。

### ビルドが要るときだけ作る(2026-11-13、ユーザー指摘)

**対象**: Workers Builds の本番トリガーのデプロイコマンド、`scripts/select-demo-container-image.mjs` — `image` を Dockerfile のパスにしただけでは、Worker だけ・ドキュメントだけの変更でも毎回イメージを作り直してしまう(ルール44・47の「要否の判断」に反する)。

- デプロイコマンド `node scripts/select-demo-container-image.mjs`(利用者がダッシュボードで設定、2026-11-13)が、 `containers/demo` の中身のハッシュ(テスト・`*.md`・`image.lock.json` を除く)を計算する。
- そのハッシュを付けたタグ `cloudflare-workers-github-oauth-1-democontainer:ctx-<12桁>` がレジストリにあれば作らず、`wrangler.toml` の `image` をそのタグに書き換える。無いときだけ `wrangler containers build -p` で作って push し、同じく書き換える。
- 作れなかったら、`image.lock.json` の最後に動いたイメージで出し、Worker のデプロイは止めない(ログに `[container-image] 作れなかった` と出る)。
- リポジトリの `wrangler.toml` は `image = "./containers/demo/Dockerfile"` のまま。書き換えはビルド環境の中だけで起きる。
- Dockerfile の `ARG INSTALL_*` の既定値は `image_vars` と同じなので、`wrangler containers build`(ビルド引数を渡せない)でも同じイメージになる。
- スクリプトは書き換えのあと、以前のデプロイコマンドと同じ `npx wrangler deploy --containers-rollout=gradual` を実行する。デプロイの失敗は隠さず、終了コードをそのまま返す。
