# コンテナDockerfile再評価（2026-10-18 UTC）

対象: `nekoserver/cloudflare-workers-github-oauth-1`、`main` の `e2417d06`。
評価対象: `containers/demo/Dockerfile`、同ディレクトリの起動・Apache・cloudflared設定、`src/containers/demoContainer.ts`、既存コンテナ検証。

結論: 現在のDockerfileはデモサーバーとCLI本体の導入用であり、今回復旧したCaddy前段、Ruby CGI、HMAC付きAPI、Codex/Claude実行ワーカー、実会話ストリームの再構築には不十分。コンテナをこのソースから再作成すると、手動配置した構成は復元されない。ビルド・起動・Secret受け渡し・検証をまとめて更新する必要がある。

## 指摘事項（優先度順）

### P1: 現在稼働するアプリとサービスがイメージに入っていない

根拠: [Dockerfile](containers/demo/Dockerfile) 52〜58、92〜102行、[entrypoint.sh](containers/demo/entrypoint.sh) 99〜102、170〜171行。

DockerfileはApacheとCLI本体を入れるが、Caddy、Ruby、Python仮想環境、bubblewrap、`/var/www/html/lib` の本体、専用実行ユーザーとホーム、CGI設定、LLM・配信・observer起動スクリプトを構築していない。COPY対象もデモ用ファイルのみ。起動処理には今回追加した各サービスの呼び出しがない。

このため再作成後は `/lib/conversation-embed.html` が会話用HTMLとして配信されず、API実行と会話閲覧に必要なソケットも存在しない。今回の `codex_worker_unavailable` とobserver切断ループを再発させる条件が残る。

必要な対応:

- lib本体を検証済みの版としてビルドへ取り込み、Ruby CGIと非公開ディレクトリのアクセス拒否を設定する。
- `codex-web` と専用ホーム、bubblewrap、Python仮想環境と配信依存を配置する。
- Codexの専用実行先には本体と同じ版の `codex-code-mode-host` を配置し、Claudeには専用バイナリとヘルパーを配置する。
- worker・配信・observerを実際の依存順に起動する。CLIがPATHにあることだけではAPI連携は成立しない。
- 現在のlib本体には未commitの修正がある。単に既存mainをcloneする手順では、今回の修正まで復元できない。反映済みの版を確定してからイメージへ取り込む。

### P1: HMAC鍵と認証・会話接続先をコンテナへ渡す設計が未接続

根拠: [demoContainer.ts](src/containers/demoContainer.ts) 35〜43行、[entrypoint.sh](containers/demo/entrypoint.sh) 160〜171行。

`envVars` はトンネル・Tailscale・Cloudflare API用の5変数のみを渡しており、`ORIGIN_HMAC_SECRET` / `HMAC_SECRET` は含まない。Worker側にSecretを登録するだけでは、コンテナや配信プロセスへ渡らない。entrypointにもHMAC環境の保存・CGIへの引き継ぎ処理はない。

Codex/Claudeの専用ユーザー認証、observerのapp-serverソケットと固定thread指定についても、再作成後の供給・再接続手段がない。稼働中プロセスへのexportや稼働中ファイルの存在は、再構築の保証にならない。

必要な対応:

- WorkerのBindingsとコンテナenvVarsに、明示的なHMAC受け渡しを追加する。
- 認証はSecretまたは非公開の永続領域から起動時に供給し、イメージへCOPYしない。
- app-serverの起動と非公開ソケット、対象会話の指定・照合を設定項目として定義する。特定の稼働中ソケット名や「最新会話」を固定値としてDockerfileへ埋め込まない。
- ジョブ、CLI認証・状態、会話監視先のうち、何を維持し何を起動時に再作成するかを決める。

### P1: Caddyとヘッダー削除が再作成で消え、8443番の所有者も旧構成へ戻る

根拠: [Dockerfile](containers/demo/Dockerfile) 55、96〜101行、[apache-demo.conf](containers/demo/apache-demo.conf) 7〜13行。

ソースは `cloudflared -> Apache TLS :8443 -> Node :8080`。現在の稼働経路は `cloudflared -> Caddy TLS :8443 -> Apache HTTP 127.0.0.1:9080` であり一致していない。Caddyだけ追加して旧Apacheサイトも有効のままにすると8443番で競合する。Apacheの `ServerTokens Prod` / `ServerSignature Off` とCaddyのレスポンスヘッダー削除もソースにない。

必要な対応:

- CaddyfileとApacheのlocalhostバックエンド設定をビルドへ取り込み、旧8443サイトを無効化する。
- TLS証明書・秘密鍵は起動時に生成または供給し、Caddy専用ユーザーが読める権限へ設定する。
- WebSocketとSSEを含むストリーム転送、HMACのパス・本文・クエリ、Cookieを維持する。
- 削除対象はServer・X-Powered-By等の製品情報に限定する。Cloudflareが後段で付けるヘッダーと別WorkerのCSPは、この前段Caddyでは変更できない。

### P2: ヘルス確認がアプリ障害を見逃す

根拠: [server.js](containers/demo/server.js) 58〜74行、[check-cf-containers.sh](scripts/check-cf-containers.sh) 94〜103、143〜147行。

`apache` の判定は8443番へのTCP接続のみ。Caddy前段化後は、Apacheが停止してもCaddyが待ち受けているだけで `apache: true` になる。現在の検証には、Caddy、CGI、HMAC正常/不正署名、非root隔離実行、補助バイナリを使うツール実行、observer接続の判定がない。

必要な対応:

- CaddyとApacheバックエンドを個別に判定する。
- 認証ファイルがない状態では「設定待ち」と実装故障を区別する。
- 機密値を含まないテスト用設定で、正常/不正HMAC、Cookie、署名付きポーリング、WebSocket/SSE等の継続受信を検証する。
- テスト用の固定observerを用意し、個人のログインや実会話の内容にビルド検証を依存させない。

### P2: offline検証手順が現在のDockerfileと矛盾している

根拠: [check-cf-containers.sh](scripts/check-cf-containers.sh) 35〜44、101行。

`--offline` は最初のaptインストールから `WORKDIR /app` までの間を削り、Codexのnpmインストールも除去する。一方で後段は `command -v codex` を必須にしている。変換後Dockerfileを生成して、Codex導入行が消えることを確認した。この経路では、他の工程が通ってもCLI必須チェックを満たせない。

必要な対応: offline検証の保証範囲を明示し、本番構成と異なるイメージを「本番同等の検証成功」と扱わない。必須CLIを同梱したビルドターゲットを検証するか、省略項目を検証結果へ明示する。

### P2: 再ビルド時の取得物と失敗判定が安定しない

根拠: [Dockerfile](containers/demo/Dockerfile) 61〜66、69〜83行。

cloudflaredは `releases/latest`、Codex/Claudeはバージョン未指定のnpm導入で、同じソースでも取得物が変わる。Nodeアーカイブにはハッシュ検証がない。Tailscaleは導入失敗でもWARNを出してビルド成功に進む。利用機能が異なるイメージでも同じビルド成功扱いになりうる。

必要な対応: 検証した版と取得物の検証方法を明示し、必須サービスの導入失敗はビルド失敗にする。任意機能にする場合は、その有無をヘルス表示と受入条件へ反映する。冒頭の「CLIは撤回」「Caddyは導入しない」等の過去コメントも、現在の方針と分離する。

## トンネル設定の整合

[cloudflared-ingress.yml.template](containers/demo/cloudflared-ingress.yml.template) 18〜20行はSSHを22番へ転送するが、entrypointが起動するsshdは2222番。プラットフォーム側のSSH提供もあるため、単独のDocker起動とCloudflare上の経路を区別して確認する必要がある。

今回の実コンテナはトークンで起動し、ログにCloudflare側の設定version 16の受信を記録していた。その設定はローカルテンプレートと異なる。テンプレートの変更だけで公開経路まで変わったと判断せず、実際に受信するリモート設定も照合する。

## 検証と評価の限界

実施済み:

- `/root/cloudflare-workers-github-oauth-1` へcloneし、対象コミットを確認。
- 稼働中のDockerfile相当構成、Apache/Caddy設定、追加起動処理とソースを照合。秘密情報の実値は評価書へ記録していない。
- `bash -n containers/demo/entrypoint.sh`、`bash -n scripts/check-cf-containers.sh` 成功。
- `node --check containers/demo/server.js`、`node --check containers/demo/cf` 成功。
- Node 22のPATHで `npm ci --ignore-scripts --no-audit --no-fund` を実行。
- コンテナ関連の既存6ファイル・32テストが成功（下記）。これらの成功は、今回追加した機能の再構築成功を保証しない。

```sh
env PATH=/opt/node22/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
  node_modules/.bin/vitest run \
  src/cf-containers-page.test.ts \
  src/cf-containers-claude-cli.test.ts \
  src/cf-containers-health-docker.test.ts \
  src/cf-containers-health-tailscale.test.ts \
  src/cf-containers-sshd-port.test.ts \
  src/cf-containers-no-autostop.test.ts
```

今回の依頼は再評価のため、Dockerfile・Worker・起動スクリプトの実装修正、完全なDockerビルド、Workerデプロイ、コンテナ再作成は実施していない。ソース比較と既存テストに基づく評価であり、ビルド成功や本番での再起動成功を主張するものではない。

## 修正順序

1. lib本体の反映済み版と、認証・会話監視先の起動時供給方法を確定する。
2. アプリ・実行ユーザー・依存パッケージ・CLI本体と補助バイナリをイメージへ組み込む。
3. Caddy/Apacheの待受分離と起動処理を取り込み、HMACのWorker→コンテナ→CGI/配信への引き継ぎを接続する。
4. 認証待ち状態を扱うヘルス確認と、起動・API・ストリームを通す受入テストを追加する。
5. `/run` が空の新規コンテナから、設定と非公開認証の供給だけで再現できることを完全ビルドで確認する。

## 追加評価: バージョン更新・セキュリティパッチ（2026-10-18 UTC）

### OSの未適用更新

`apt-get update -qq` 後の `apt-get -s upgrade` は、更新0件、保留0件だった。現在のapt候補と比較した範囲で未適用のOSパッケージ更新はない。これは、npm/Python依存、別配置のNode、CLIバイナリや全CVEが対処済みであることを意味しない。

確認したUbuntuパッケージ:

| パッケージ | インストール済み |
| --- | --- |
| Apache | 2.4.58-1ubuntu8.17 |
| OpenSSL | 3.0.13-0ubuntu3.16 |
| OpenSSH server | 1:9.6p1-3ubuntu13.20 |
| Caddy | 2.6.2-6ubuntu0.24.04.3 |
| curl | 8.5.0-2ubuntu10.16 |
| bubblewrap | 0.9.0-1ubuntu0.3 |
| Docker | 29.1.3-0ubuntu3~24.04.2 |

Ubuntuは同じ上流バージョン表記のまま修正をバックポートする。Caddyは実際にnoble-security由来の候補と一致し、パッケージ変更履歴にもGo更新による再ビルドがある。「2.6.2だから未修正」とは判断しない。ベースイメージとaptレイヤーを定期的に再ビルドして取り込む手順が必要。

### Nodeは更新対象

- システムNode: 18.19.1。上流Node 18はEOL。Ubuntuの候補と一致していても、Dockerfileで長期使用する方針は見直す。
- 別配置Node: `/opt/node22` の22.20.0。公式配布一覧で確認した22系の最新版は22.23.3。22.20.0より後に22.22.0、22.22.2、22.23.0、22.23.2のsecurityリリースが存在する。
- まず互換性を維持して22.23.3へ更新する案、または24系LTS（確認時24.22.0）へ統一する案を検証する。Nodeを2系統入れたまま、システムの古いNodeが通常のPATHで使われ続ける構成を避ける。
- ダウンロード版はチェックサムも検証する。DockerfileにNode 22.20.0のURLを固定したままでは `apt upgrade` で更新されない。

一次資料: [Node EOL](https://nodejs.org/en/about/eol)、[公式配布一覧](https://nodejs.org/dist/index.json)。

### Workerのnpm依存監査

今回cloneしたmainのlockfileを使用して `npm audit --json` を実行。影響対象パッケージは計6（High 4、Moderate 2）。これはCVE数ではなく、npm auditのパッケージ単位の集計。

| 対象 | 現在 | 判定・対応候補 |
| --- | --- | --- |
| hono | 4.11.9 | High。本番依存。確認時最新版4.13.13への更新を優先 |
| postcss | 8.5.15 | High。確認時最新版8.5.30。親依存とlockfileを更新 |
| nanoid | 3.3.15 | High。3系の修正版3.3.18以上を確認。6系へ無条件に上げない |
| source-map-js | 1.2.1 | High。修正版1.2.2を確認 |
| vitest | 4.1.9 | Moderate。4系の修正版4.1.11以上を使用する案を優先 |
| @vitest/mocker | Vitestの間接依存 | Moderate。Vitestと合わせて更新 |

`npm audit --omit=dev --json` はHigh 1件、対象はhonoのみ。開発依存を本番Workerで同じように悪用できるとは断定しない。個々の脆弱性の成立には、該当機能や入力経路の利用が必要。HonoのCORSは本体で利用している。ただし `src/index.ts` 5248行以降では非空の `allowHeaders` を明示しており、CORS ReDoSアドバイザリ（GHSA-8j4g-w8fx-2239）の条件には該当しない。監査検出だけで実際の悪用可能性を断定せず、Cookie・JWT等も含めて更新後の認証とレスポンスを回帰確認する。

`npm audit fix --force` でメジャー更新を一括適用する方式は避け、直接依存・間接依存の更新後に全テストとWorkerバンドルを検証する。今回の調査では依存ファイルを変更していない。

一次資料例: [Honoアドバイザリ](https://github.com/honojs/hono/security/advisories/GHSA-hxh3-vqpv-xpqv)、[Vitestアドバイザリ](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9)。最新版の確認はnpm公式レジストリで実施した。

### CLI・Python・Caddyの更新候補

| 対象 | 稼働版 | 確認時の更新候補・判定 |
| --- | --- | --- |
| Codex CLI | 0.163.0 | npm latestと一致 |
| Claude CLI | 2.1.197 | npm latestは2.1.302。専用コピーも合わせて更新・ヘルパーの互換性を確認 |
| cloudflared | 2026.10.1 | 公式最新リリースと一致 |
| Tailscale | 1.104.1 | 公式最新リリースと一致 |
| Caddy | Ubuntu版2.6.2 | 上流最新は2.11.7。Ubuntuのバックポートと上流更新を分けて評価し、設定互換性・WebSocket/SSE・ヘッダー削除を確認してから移行 |
| websockets | 17.1 | pipの更新候補は17.2。配信の回帰テスト後に更新 |
| pip | 24.0 | 更新候補26.2.1。ランタイムの脆弱性検出と同一視しない |

Pythonの最新版照会は `pip list --outdated` の結果。Python依存のCVE監査やイメージ全体のスキャナによる監査は今回未実施。これらすべてを既知脆弱性と断定せず、更新候補として扱う。

### バージョン以外の公開範囲

`server.js` の `/debug/logs` はアプリ内で認証を行わずログを返す。実コンテナのNode :8080とCaddy :8443では、認証なしでJSONのlogsオブジェクトを取得できた。公開ホストの同URLは200だが本文が空であり、外部へのログ本文漏えいは今回の確認では成立していない。

それでも、Caddyが全パスをバックエンドへ渡す構成では、親Workerの管理者認証だけを前提にできない。公開トンネル経由の `/debug/*` を拒否し、管理用経路のみで利用できるようにすることを優先事項に追加する。ログ内容自体は報告へ転記していない。

### 継続的な更新手順

- ベースイメージの定期再ビルド、OS更新、npm lockfile監査、Python依存監査、コンテナイメージ全体の脆弱性スキャンをCIへ追加する。
- ダウンロードするCLI・Node・cloudflaredの版とハッシュを管理し、更新通知を取り込む。
- パッチ後は、Worker全テスト・バンドル、新規イメージ起動、HMAC正常/不正署名、Cookie、CLIツール呼び出し、4方式のストリーム受信を確認する。
- 今回は更新候補と根拠の確認まで。パッケージ更新、依存lockfile変更、サービス切り替え・デプロイは実施していない。

## 更新の適用状況（2026-10-18 UTC、調査後）

上記は調査時点の記録。続く依頼により、以下の更新を適用した。

- 稼働環境の既定Nodeを22.23.3、npmを11.19.1、Claude CLIと専用実行先を2.1.302へ更新。Node配布アーカイブのSHA-256を検証済み。すでに起動していたNodeサーバープロセスはそのままで、新ランタイムでの起動には再起動が必要。
- Python仮想環境のwebsocketsを17.2、pipを26.2.1へ更新。配信・observerを再起動し、公開URLでHMAC正常/不正署名、Cookie、署名付き照会、WebSocket/SSE/NDJSON/JSON-seqの会話更新を再確認。
- Workerのhonoを4.13.13、Vitestを4.1.12、PostCSSを8.5.30、nanoidを3.3.20、source-map-jsを1.2.2へ更新。更新後のnpm auditは開発依存を含めて0件。
- DockerfileはNode 18との二重構成を解消し、Node/npm/Codex/Claude/cloudflared/Tailscaleの版を固定。Node/cloudflared/Tailscaleの配布物にSHA-256検証を追加。`gh` も初期インストール対象へ追加。
- 稼働中Caddyの公開経路で `/debug` と `/debug/*` を404にし、ApacheバックエンドとDockerfile側の公開Apacheでも拒否する設定を追加。管理用8080経路は維持。
- ビルド検証にNode/CLI/gh/補助バイナリと公開debug拒否の確認を追加。必須ランタイムを除去する旧offlineモードは明示的なエラーに変更。

通過した軽量検証は、JavaScript 32件、Python配信29件、ワーカー20件、Ruby4件。更新後の隔離Node/Claude起動と公開4方式の実通信も成功。

全体Vitestでは画面テスト1件のタイムアウトを確認し、型チェックでは72件のエラーを検出した。更新前との差分確認は完了していないため、既存エラーと断定しない。ユーザーのメモリ懸念による指示でDockerビルドを中止し、同時実行していた全体テストと型チェックも停止した。ビルド成功・全テスト成功は未確認。Dockerfileと依存ファイルの変更はローカルブランチ `fix/container-security-updates` にあり、未commit・未push・未デプロイ。


最終の追跡結果: 画面の失敗テストは単独再実行で成功。関連11ファイル・70テストが成功。Hono更新で増えた26件の型エラーは修正し、更新前と同一の46件だけが残ることを確認した。Dockerビルドは禁止を維持。実施内容の最終状態は [更新REPORT](REPORT.cloudflare-workers-github-oauth-1.CONTAINER-SECURITY-UPDATES.20261018.md) を参照。

## リポジトリ保存状況（2026-10-18追記）

上記の未commit・未pushという記述は各評価時点の状態。Workerの更新は `fix/container-security-updates`、libの修正は `fix/conversation-stream-recovery` ブランチで保存する。本番へのマージ・デプロイおよびDockerビルドは実施していない。最終の検証結果はREPORTを参照。
