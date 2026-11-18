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

---

# NOTICE 2026-11-11(続き): `@cloudflare/containers` から Durable Object Container API へ移した

仕様: [`SPEC.cloudflare-workers-github-oauth-1.20261111.container-api-migration.md`](SPEC.cloudflare-workers-github-oauth-1.20261111.container-api-migration.md)

## 知らないと損すること

- **`@cloudflare/containers` は非推奨。** 公式の移行ガイド(2026-11-09 更新)が明記している。旧ライン(Container クラス・Sandbox SDK 0.x)の修正は 2026-12-31 まで。redmine も 0.3.7 を使っているので、同じ移行が要る。
- **移行は「基底クラスを替えるだけ」で済む。** クラス名・バインディング・`[[containers]]` のイメージ・`[[migrations]]` はそのまま。基底クラスの変更だけでは Durable Object の移行タグは要らない(公式)。旧 `getContainer(binding, 'demo')` の中身は `binding.get(binding.idFromName('demo'))` なので、同じ呼び方なら今の Durable Object と保存データに届く。
- **旧クラスは裏で多くのことをしていた。** 移すと、これらを自分で書く必要がある(`node_modules/@cloudflare/containers/dist/lib/container.js` 0.3.7 で確かめた)。
  - `start()` はポートが応答するまで待っていた(`http://ping` に何か応答が返れば OK、300ms おき最大20秒)。新しい `start()` は準備完了の前に返る。
  - 既定でインターネット接続を許していた。新しい `start()` は `enableInternet` が必須で、許すなら `true` を明示する。
  - `onActivityExpired(){}` で止めないようにしていたのは、**アラームを約3分ごとにかけ直して Durable Object を起こし続ける**ループがあったから。新しい API にそのループは無い。
  - WebSocket は両端を受けて中継していた。
- **コンテナを止めずに置くには、無活動タイムアウトより短い間隔のアラームが要る。** アラームの実行は Durable Object の活動に数える。`setInactivityTimeout()` の上限は6時間で、Durable Object の再起動(デプロイを含む)で消えるので、コンストラクタで張り直す(公式「Sandbox lifetime」)。
- **コンテナが止まっても Durable Object は起こされない。** `monitor()` は Durable Object がメモリにいる間しか停止を知らせない。停止の記録(接続時間の計算に使う)は、アラームでも確かめないと取りこぼす。`compatibility_date` が 2026-10-01 より前だと、待っている `monitor()` は退避を防がない。
- **スナップショットは `durable_object` ポリシーでしか使えず、ポリシーは後から変えられない。** 変えるには新しいコンテナアプリ(新しいクラス)を作り、今のインスタンスを置き換える。Docker を使わない更新(スナップショット)に進むなら、ここが最大の手間になる。スナップショットは30日で期限が切れる。
- **`cloudflare:workers` を読み込むクラスも、vitest で `vi.mock('cloudflare:workers', ...)` すれば素の Node でテストできる。** `@cloudflare/containers` を偽物にしていたテストは、偽物の `ctx.container`(`src/containers/demoContainerFakeCtx.ts`)に替えた。

## 落とし穴

- `src/cf-containers-no-autostop.test.ts` は旧クラスの1行(`override async onActivityExpired(): Promise<void> {}`)を文字列で検査していた。実装の書き方を文字列で固定するテストは、移行のたびに書き換えが要る。振る舞いは `demoContainer.lifecycle.test.ts` で確かめる。
- `/cf-containers` はすでに「自動停止はしません」と表示している。`/api/cf-containers/status` が返す `sleepAfter: '5m'` は実際の動きと合っていない(この移行では触っていない)。
- `npx vitest run` の全体では、この変更の前から main で6ファイルが落ちている(`aichat-stream-frame-csp`・`cf-containers-image-lock`・`firewall-hourly-cron`・`ruby-wasm-version-info`・`tree-view-cron-notification`・`utils/aichatSlashCommand`)。`cf-containers-image-lock` はイメージの作り直し待ち。
