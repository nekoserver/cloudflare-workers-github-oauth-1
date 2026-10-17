# NOTICE: /cf-containers(Cloudflare Containers)・Workers Builds で知っておくべきこと (2026-10-16〜17)

**対象**: `/cf-containers` ページ・`containers/demo/`(Dockerfile/entrypoint/Apache/server.js)・`src/containers/demoContainer.ts`・Workers Builds(Git連携の本番ビルド)・Cloudflare API トークン — 1日以上かけた不具合調査で判明した、知らないと時間を失う挙動と落とし穴を記録する。

---

## 1. Workers Builds の PR ビルドはコンテナイメージをビルドしない

- PR ではバージョンコマンド `npx wrangler versions upload` だけが走り、Dockerfile はビルドされない。PR の Workers Builds が緑でも、イメージが壊れていないことの証明にはならない
- イメージは main へのマージ後のデプロイコマンド `npx wrangler deploy` で初めてビルドされる。push 前に検証しないと、本番ビルドが一発勝負になる
- 対策: コンテナ関連を変更したら、push 前に `bash scripts/check-cf-containers.sh` で `ALL OK` を確認する（CLAUDE.md ルール39）。このリポジトリでは GitHub Actions を使っていない（試したところ `startup_failure` で1つも起動しなかった）

## 2. イメージのビルドが失敗しても Worker のコードは本番に出る（コンテナだけが古いまま）

- `wrangler deploy` は、イメージのビルドより先に Worker のコードを有効にする。2つは1つの処理として扱われないので、イメージのビルドが失敗しても Worker のコードは本番に出る（[Rollouts](https://developers.cloudflare.com/containers/configuration/rollouts/)）
- 症状: ページ（Worker）は新しいのに、コンテナは古いイメージのまま動く。実例: `/debug/net` を追加したのに、表示が全部空だった。古い server.js はどのパスにも共通の JSON を返すので、`addr` などのキーが存在しない
- 見分け方: `/cf-containers/proxy/debug/net` を直接開いて、`"message":"... demo container"` が返ってきたら古いイメージ
- この状態で secret を設定すると、`Secret edit failed ... latest version of your Worker isn't currently deployed (code 10215)` になる

## 3. GitHub の Workers Builds の結果表示は後から上書きされる

- 一度「success」だった結果が、後から所要0秒の「failure」に書き換わった（例: #2395 のマージ [`8865d562`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8865d562)）。詳細欄は空で、エラー情報も0件
- GitHub の表示だけで成功・失敗を判断しない。本当の状態はダッシュボードのビルド履歴か、Builds API で確認する
- ダッシュボードの「再実行」は、Deployment → View Build History → 該当ビルドの「…」→ **Retry build** にある

## 4. ビルドログは Builds API で取得できる（必要な権限に注意）

- `/cf-containers` の「最新ビルドのログを取得」ボタン（[`b0963ad8`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b0963ad8)、ページ分割対応 [`d7cda42f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d7cda42f)、応答の形の記録 [`5bb5d0a4`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5bb5d0a4)）
- Builds API には**ユーザー単位の API トークン**と「**Workers Build 構成**（Workers Builds Configuration）：編集」の権限が必要。無いと `Forbidden (code 12004) [HTTP 403]`
- **本番ビルド失敗の本当の原因（ビルドログで確定）**: イメージのビルドは成功していた。失敗していたのは `registry.cloudflare.com` へのレイヤーのアップロードで、`failed commit on ref "layer-sha256:..." ... net/http: timeout awaiting response headers` → `Docker command exited with code: 1` となっていた。原因は、apt・cloudflared・tailscale・npm（Codex/Claude CLI）を `RUN` 1つにまとめた **1.9GB の単一レイヤー**。成功するかどうかが毎回変わっていたのは、送り切れるかどうかが運次第だったため。`RUN` を分割し、npm のキャッシュを削除して、最大のレイヤーを 566MB、全体を 2.97GB から 2.13GB にした。検証スクリプトに「800MB を超えるレイヤーがあれば NG」のチェックを追加した（古いイメージでは NG になることを確認済み）
- メモリは原因ではない（実測で、待機中は約 21MiB、node は約 48MB。standard-1 は 4GiB）
- 2026-10-17 時点の最新ビルドは `status=stopped`。ログは Docker が `load build definition` した直後で止まっており（ダッシュボードの表示も同じ）、失敗した行が無い。原因は**未特定**（新しいビルドへの置き換えによる取り消しの可能性。直近のビルド一覧で確認する）
- ページ分割の形（`truncated` / `cursor`）は**想定で実装した**もので、実際の応答では未検証。「API応答の形」欄で実際の形を取得してから、テストを実応答のデータで作り直すこと

## 5. Cloudflare API トークンまわりの落とし穴

- `CLOUDFLARE_API_KEY` は `/cf-dashboard` 用（Global API Key ＋ `CLOUDFLARE_API_EMAIL`）。Bearer として送ると `Authentication error` になる。`/cf-containers` では `CF_CONTAINER_API_TOKEN` を最優先で使う（[`9a17cf8e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/9a17cf8e)）
- `CLOUDFLARE_ACCOUNT_ID` は秘密情報ではないので `[vars]` に置いた（[`8ac0fb88`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8ac0fb88)）
- `/accounts/{id}/tokens/verify` はアカウント所有トークン専用。個人の API トークンでは `Invalid API Token (code 1000)` になるのが正常で、問題の兆候ではない（`/user/tokens/verify` が `active` なら有効）
- `CF_CONTAINER_API_TOKEN`（API 操作用）と `NEKOROOT_TUNNEL_TOKEN`（cloudflared のトンネル接続用）は別物。トンネルを起動するには後者が必要

## 6. コンテナ・イメージの事実（手元のフルビルドで確認）

- イメージは約 2.97GB（standard-1 の上限は 8GB）。そのうち Codex/Claude CLI の npm パッケージが約 950MB
- Ubuntu 24.04 の `nodejs` には `npm` が含まれない。`npm` を明示しないと `npm install -g` が exit 127 になる（#2384〜#2387 の本番ビルド失敗の原因、[`948fe33d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/948fe33d) で修正）
- `apache-demo.conf` の VirtualHost は `*:8443` なのに `Listen 8443` が無く、Apache は 80/443 でしか待ち受けていなかった。cloudflared の転送先（8443）に届かない状態（[`34588564`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/34588564) で修正。起動確認テストで初めて判明）
- コンテナのディスクは毎回使い捨て。`stop()`→`start()` で、イメージからまっさらな状態で起動し、entrypoint.sh が新しい環境変数で再実行される

## 6.5 コンテナのファイアウォール（nftables）と、テストで見逃した理由

- INPUT を「確立済み・lo のみ許可、ほかは破棄」にしていたため、**Worker が Durable Object 経由で 8080 番へ入ってくる新規接続まで破棄**され、本番で `/cf-containers` の操作（ヘルスチェック・ネットワーク情報）がすべて応答しなくなった
- 手元のテストで見逃した理由: (1) 確認を `docker exec` によるコンテナ内部（127.0.0.1）からの接続でしかしていなかった (2) `--cap-add NET_ADMIN` を付けずに起動していたため、手元では nftables の設定自体が失敗していてルールが効いていなかった
- 現在のルール: INPUT は lo・確立済み・関連・新規（NEW）を許可し、不正（invalid）だけ破棄する。FORWARD は許可
- 検証スクリプトは `--cap-add NET_ADMIN` を付けて起動し、**コンテナの外から** 8080 番に届くことを確認する
- Codex/Claude CLI の `npm install -g` は、以前は失敗しても WARN を出して続行していたため、Claude CLI が入っていないイメージが通っていた。現在は失敗したらビルドを止める。検証スクリプトも両方の存在を確認する
- Ubuntu 24.04 の nodejs は 18。Claude CLI は Node 22 以上を要求している（`EBADENGINE` 警告）。現時点では起動するが、将来動かなくなるおそれがある（未対応）

## 7. Claude Code のクラウドサンドボックスでの検証方法

- 外向きの HTTPS は MITM プロキシ（`$HTTPS_PROXY`、CA は `/root/.ccr/ca-bundle.crt`）経由でしか通らない。プロキシは http を扱わない（apt の http は `405` になる）が、apt の http は直接外へ出られる
- Docker のビルドでは、プロキシの CA と `https_proxy` だけを注入して `--network host` にすると、本番と同じダウンロード込みでビルドできる（`scripts/check-cf-containers.sh` が自動で行う）。Tailscale の install.sh だけはプロキシに 403 で拒否される
- `dockerd` は起動していないことがある。`(dockerd >/tmp/dockerd.log 2>&1 &)` で起動する
- `*.workers.dev` と独自ドメインは名前解決できず、サンドボックスから本番に直接アクセスできない。Cloudflare MCP の `workers_get_worker_code` は、Worker が大きすぎて応答を受け取れずに失敗する

## 8. このセッションで繰り返した失敗（再発防止）

- **template literal 内の `'\n'`**: `src/views/cfContainers.ts` のページ script 全体が構文エラーになった（ルール29違反）。回帰テスト `cfContainers.script-syntax.test.ts` を追加した（[`b0963ad8`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b0963ad8)）
- **マージ済みブランチへの push**: #2394 のマージ後に push したコミット（ネットワークツールの追加）が宙に浮いた（ルール34違反）。#2395 で入れ直した
- **「手元で通った」を「通った」と報告した**: 本番ビルドの成否を確認せずに「ビルドは通る」と書いた。手元・PR・本番のどこで確認したのかを必ず書き分ける
- **推測による修正を push した**: ダウンロードのリトライ追加（#2391）など、ログを見ずに直そうとして効果がなかった。ログ・実データを先に取る
- **自動で付く PR 監視**: PR を作るたびに自動で監視が付くため、ルール2aに従ってその都度解除した
