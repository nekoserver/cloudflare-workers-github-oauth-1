# NOTICE 2026-11-11: demoコンテナのイメージをdigestで固定した

**対象**: `wrangler.toml` の `[[containers]]`、`containers/demo/image.lock.json`、`src/cf-containers-image-lock.test.ts` — Workers BuildsでDockerのビルドができなくなったため、ビルド済みのイメージを使い回す方式に変えた(dynamicnekoと同じ方式)。

## 何が起きたか

- 2026-11-11 14:46・14:54・14:59(JST)のmainのビルドが、どのステージ(`stage-2`・`tailscale-binaries`・`ruby-build`)も最初の `RUN` で `runc run failed: unable to start container process: error during container init: error mounting "proc" to rootfs at "/proc": ... operation not permitted` と0.1秒以内に落ちた。コマンドは1行も実行されていない。Dockerfileの中身ではなく、ビルド環境がコンテナを起動できていない。
- 同じDockerfileは00:47(JST 09:47)のビルド(`3f7e19d7`)では最後まで成功していた。
- イメージのビルドで止まるため、Workerのデプロイも止まった(#2560 のページが出なかった)。

## 変えたこと

- `wrangler.toml` の `image` を、00:47のビルドで登録されたイメージ `registry.cloudflare.com/4eb48547c6f6a8194e6c3eb5e700463f/cloudflare-workers-github-oauth-1-democontainer@sha256:c945ea02…` にした。Workers BuildsはDockerを使わず、Workerだけをデプロイする。
- `containers/demo/image.lock.json` に、固定したイメージ、そのイメージを作ったときの `containers/demo` の中身のハッシュ(`contextSha256`)とファイル一覧、ビルド引数(以前の `image_vars`)を記録した。
- `src/cf-containers-image-lock.test.ts` が、`containers/demo` の中身(gitで管理しているファイル。`tests/`・`*.md`・`image.lock.json` を除く)が記録と違えば落ちる。
- 固定したイメージは `d46051d`(#2559 まで)の中身で、Tailscaleは1.104.5。#2561 で上げた1.104.6はDockerfileを戻した(イメージと中身を一致させるため)。

## コンテナを変えるとき(今後の手順)

1. `containers/demo/` を変える。テストが落ちる(イメージの作り直しが要るという合図)。
2. Dockerのある環境でイメージを作って登録する。

```bash
npx wrangler containers build -p -t cloudflare-workers-github-oauth-1-democontainer:<tag> containers/demo
```

3. 出力された `sha256:...` で、`containers/demo/image.lock.json`(`image`・`contextSha256`・`files`・`builtFrom`)と `wrangler.toml` の `image` を更新する。`contextSha256` はテストが表示する値。
4. このセッションのような、DockerかCloudflareのAPIトークンが無い環境では作れない。作れていないときは報告に書く。

## 注意

- Workers Buildsで再びDockerのビルドができるようになっても、この方式のままなら、デプロイのたびにイメージは作られない(作り直しは手順2で行う)。
- イメージを作ったときのビルド引数は `INSTALL_DOCKER=false`・`INSTALL_VITEST=true`・`INSTALL_TYPESCRIPT=true`・`INSTALL_WRANGLER=true`。手順2でも同じ値を `--build-arg` で渡す(`wrangler containers build` が `image_vars` を読まない場合)。未確認。
