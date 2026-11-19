# 固定ドメインのTunnel入口・Workerルート・Static Assets仕様（2026-11-14）

改訂: 2026-11-19、opus-5.5（Claude Opus 5.5、Claude Code）。要件は変えず、前提の確認と台帳の状態（末尾の「2026-11-19の現状」）を足した
評価: [`EVAL.cloudflare-workers-github-oauth-1.20261114.fixed-domain-ingress-worker-assets.opus-5.5.20261119.md`](EVAL.cloudflare-workers-github-oauth-1.20261114.fixed-domain-ingress-worker-assets.opus-5.5.20261119.md)
定期的な見直し: このSPECは[`SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md`](SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md)の手順で、定期的に実情に合わせて改訂し、評価し直す

## 状態と目的

設計整理。入口と配備の責務を区別し、固定ドメイン上のApache系アクセス、Cloudflare Workerの公開ルート、Worker Static Assetsの管理台帳を一貫して追跡する。DNS、Tunnel、Worker Route、Static Assetsの変更・切替は本SPECでは実施しない。

ユーザー確認による現在の運用前提: Apache等の対象固定ドメインへ入るアクセスはArgo/Cloudflare Tunnel経由であり、Tunnel・connector・ingress・ApacheはWorkerコードやStatic Assetsとは別系統で保守する。`cloudflared`という特定connector実装は必須要件とはしない。固定ドメインからprivate originへ安全に到達し、HTTP/WebSocket等の必要な動作と運用条件を満たすことを要件とする。

また、現時点でCloudflare Static Assetsを本番設定しているWorkerは本体Workerだけであり、それは意図した正常状態であるというユーザー確認を前提とする。別リポジトリの作業ツリーにあるWrangler設定との差が見える場合は、本番で有効な設定・配備状態・意図を照合し、無断で機能追加や削除をしない。

## 入口の責務分離

| 系統 | 想定経路 | 主な管理対象 |
|---|---|---|
| 固定ドメインのprivate-origin入口 | DNS/Cloudflare edge → Cloudflare Tunnel → 現行connector（cloudflared）→ Tunnel ingress → Apache TLS VirtualHost → server.js/Apache内部サービス | hostname/DNS、Tunnel UUID・connector資格情報、ingress順序、originRequest、待受port/TLS、Apache proxy・認証、接続監視 |
| Workerの公開入口 | DNS/Cloudflare edge → Custom DomainまたはWorker Route → 指定Worker → Hono/Worker handlerおよびそのWorkerのStatic Assets | Custom Domain/Routeの所有Worker、path、Wrangler設定、Worker version/deployment、Static Assets manifestと配備 |
| Worker間内部呼出し | Worker → Service Binding → 相手Worker route/handler | binding名、service/environment、要求署名・認可、呼出元/受信側の互換性 |

Worker RouteやCustom DomainはTunnel ingressとは異なる制御点である。Tunnelを通る固定ドメイン要求が自動的にWorker Routeへも入るとはみなさず、WorkerからTunnel公開URLを呼ぶ内部APIもWorker間Service Bindingと区別する。DNS、route登録、ingress、Apacheのどれか一つだけの記録をもって経路全体が有効とは判断しない。

### 固定ドメインTunnelの現行根拠（作業ツリー）

`containers/demo/cloudflared-ingress.yml.template`は`__NEKOROOT_HOSTNAME__`について、`/ssh`をloopback SSH 2222へ、残りをHTTPS Apache 8443へ送り、末尾を404にする。`originRequest`には自己署名origin用の`noTLSVerify: true`、connect timeout、TCP keepalive等がある。`containers/demo/apache-demo.conf`は8443、`apache-lib.conf`は内部8445を担当する。

このテンプレートは一つのhostname用であり、Cloudflare側のリモートTunnel設定やDNSが同じとは限らない。`NOTICE.cloudflare-workers-github-oauth-1.DOMAIN-ASSIGNMENTS.20261024.md`にあるmygw・stream・r9等の対応は2026-10-24時点の記録で、現在の公開状態を保証しない。ユーザーが示した「対象固定ドメインのアクセスはTunnel経由」という前提と、最新のhostnameごとの実設定を照合する。

## Worker route台帳

経路の正は、Cloudflare上のRoute/Custom Domain・DNS設定と実際の配備先を、各WorkerリポジトリのWrangler設定・ルート実装と対応付けた台帳とする。

| 台帳項目 | 必須内容 |
|---|---|
| route ID | 一意な識別子 |
| hostname / custom domain / route pattern | 完全なホスト・path pattern、wildcardの有無 |
| ingress kind | Worker Custom Domain、Worker Route、Tunnel public hostname、private Service Bindingのいずれか |
| owner Worker / environment | deploy先Worker名とproduction/preview等 |
| path owner | Hono route、静的asset、Apache、server.js等の最終処理主体 |
| auth boundary | 利用者認証、Worker署名、Apache/lib認証、公開資産等の適用箇所 |
| evidence | Cloudflare読み取り結果、ソースファイル、取得時刻、確認経路 |
| state | active、disabled、historical、unknown。DNS存在と到達性を別記 |

現時点で本体`wrangler.toml`のWorker Route例`1.cfw1.nekomaneki.work/*`はコメントアウトされている。2026-10-24のNOTICEには本体のCustom Domainとして`1.wr1.nekomaneki.work`、他WorkerのCustom Domain/RouteとTunnel hostの一覧があるが、現在値の確認結果ではない。Custom DomainとWorker Routeを同一視せず、DNS欠落のある旧Routeもactiveとして登録しない。

本体からdynamicneko、cf-auth、rust-worker-sqlx-d1、muse-monitor等へのService Bindingは内部呼出し経路であり、ブラウザから入るWorker Routeではない。Service Bindingがあるだけでは相手Workerの公開URL・DNS・認証を推定できない。

## Static Assetsの仕様

### 現行の運用前提

ユーザー確認では、Cloudflare Workers Static Assets featureを本番設定しているのは本体Workerのみである。作業ツリーの本体`wrangler.toml`は`assets = { directory = "./public" }`を宣言する。`public/`内のHTML補助ファイル、JS/CSS、WASM、manifest等は本体Workerの静的配信物である。

本体設定には`binding = "ASSETS"`も`run_worker_first`も明示されていない。このため個々の要求がWorker Hono handlerとStatic Assetsのどちらを通るかはCloudflareの現在のrouting仕様・デプロイ設定と照合する。保護対象routeをasset-firstで迂回させない。`public/_headers`等のasset規則も含めてmanifestと一緒に追跡する。

本番でStatic Assetsを設定しない他Workerが存在することは問題ではなく、それぞれのWorkerの責務と配信方式に沿った正常な違いとして記録する。Worker側にVite build outputやHTMLファイルがあることだけでCloudflare Static Assets featureが本番で有効とは判断しない。

### 管理要件

- Static Assetsの配備単位は所有Worker・環境・Worker versionとし、資産manifest/hashと対応ソースrevisionを記録する。
- Worker code、bindings、compatibility settingsとasset setの組合せを一つのversionとして追跡し、deploy後のversion IDを記録する。
- HTMLが参照するJS/CSS/WASM等は同じリリース内で整合し、必要な古いhashed URLの保持期間、rollback、emergency revokeの意味を定める。
- Cache-Control、MIME、404/SPA fallback、authentication before assets、`run_worker_first`のpath範囲、asset-firstによるHono認証迂回の有無をWorkerごとに台帳化する。
- libリポジトリのApache SSI/CGI用bind mount、Cloudflare Tunnel経由のApache配信、Cloudflare Worker Static Assetsを異なる配信面・更新手順として扱う。
- 別repoでの編集を導入する場合、asset publisher・許可ファイル・revision/hash・承認者・manifest schema・rollbackを固定する。公開Workerがrequestごとにmoving branchや任意Git URLを取りに行く仕組みは設けない。
- 現時点で本体以外がStatic Assetsを使わない前提を維持し、別Workerへの拡張は独立した必要性と互換性評価ができるまで行わない。

## 到達・保護に関する不変条件

1. 固定ドメインのApache系公開アクセスは、最新route台帳に明記されたTunnel入口とApache vhostを通る。
2. cloudflaredは現在のconnector実装であり、固定ドメイン/private-originの要件と同義の必須製品にはしない。代替時も認証・DNS・ログ・復旧・WebSocket/SSE互換を評価する。
3. Worker Route/Custom Domainのpath所有者を一意にする。Tunnel経由pathと同一hostnameのWorker ingressが並存する場合はCloudflare edge側の優先関係を実測する。
4. Static Assetsは所有Workerの明示したasset directoryからそのWorker versionに付属させる。Apache/lib資産をWorker assetsへコピーしたり、逆方向に移したりしない。
5. 資産の取得・更新はrelease時に固定し、利用者要求ごとの動的な任意URL取得を許可しない。
6. 未確認のDNS/Route/ingressはactiveと記録せず、廃止済み・preview・placeholderを別状態として表示する。

## 公式資料

- [Cloudflare Tunnel configuration file](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/configuration-file/) — ingress rule、hostname/service、末尾catch-all、検証コマンド。
- [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) — Worker versionに付属するStatic Assets。
- [Worker script and asset routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/) — asset-firstと`run_worker_first`によるWorker handlerの実行順。
- [Versions and deployments](https://developers.cloudflare.com/workers/versions-and-deployments/) — versionとdeploymentの区別。
- [Version skew and static assets](https://developers.cloudflare.com/workers/versions-and-deployments/version-skew/) — deployment中のversionとasset manifestの対応。

## 2026-11-19の現状（改訂で追記）

**対象**: `origin/main`（[`c271b7ba`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c271b7ba)）の`wrangler.toml`・`public/_headers`・`containers/demo/cloudflared-ingress.yml.template`と、本体のdemoコンテナの`/etc/cloudflared/ingress.yml` — 11-14の記述の前提が今も同じか。

- **Worker route台帳は作られていない。** 機能ごとの接続先の台帳（`src/data/askgk-routes.json`、`src/data/conversation-stream-routes.json`）はあるが、本書の台帳項目（route ID、ingress kind、owner Worker、path owner、auth boundary、evidence、state）を持つ全体の台帳は無い。ポートの対応の正本も未作成（[port-route-registry](SPEC.cloudflare-workers-github-oauth-1.port-route-registry.md)）。
- `wrangler.toml`は今も`assets = { directory = "./public" }`だけで、`binding = "ASSETS"`・`run_worker_first`は無い。Worker Routeの例（`1.cfw1.nekomaneki.work/*`）はコメントアウトのまま。
- `public/_headers`には2026-11-15に`/apache-manual/`の規則が足された（[`afb11f51`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/afb11f51)）。asset規則の台帳化（管理要件）はまだ。
- `cloudflared-ingress.yml.template`は11-14から変わっていない。稼働中のコンテナの`/etc/cloudflared/ingress.yml`は、`mygw.nekomaneki.work`の`/ssh`を2222へ、残りを8443へ送る（テンプレートどおり）。

## 改訂の記録

| 日付 | モデル | 箇所 | 内容 | 根拠 |
|---|---|---|---|---|
| 2026-11-19 | opus-5.5 | 冒頭・「2026-11-19の現状」 | 前提の確認と、台帳が未作成であることを追加。要件は変えていない | 上の箇条書き |
