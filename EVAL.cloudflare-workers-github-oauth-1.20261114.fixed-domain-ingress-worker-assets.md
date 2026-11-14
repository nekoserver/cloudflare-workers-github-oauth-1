# 固定ドメインTunnel・Worker routes・Static Assetsの現状評価（2026-11-14）

## 対象・結論

対象は本体Worker、作業ツリーから読める関連Worker設定、コンテナApache/Tunnelテンプレート、2026-10-24のドメイン記録。Cloudflare API/ダッシュボードを今回再照会していないため、DNS・Tunnel・Custom Domain・Worker Routeのactive状態は過去記録とユーザー確認を除き確定しない。

**結論:** 固定ドメインへのApache系アクセスをTunnelで受け、Tunnel/connector/ApacheをWorkerコード・Static Assetsの配備と別系統で保守するモデルは明快である。cloudflaredは現在の実装として扱い、不可欠な要件にはしない。ユーザー確認では本番Static Assetsは本体Workerのみであり、それ自体は正常。次の課題は、入口ごとのroute所有者と本体Static Assetsのreleaseを一つの台帳で結び、古い設定記録をactiveと混同しないこと。

ただし、作業ツリー上ではdynamicnekoの`wrangler.jsonc`にも`assets.directory = "dist/client"`、`ASSETS` binding、SPA handling、`run_worker_first = true`が記載される。これはユーザー確認の本番稼働状態と食い違って見える。設定ファイルの存在だけから配備中とは判断せず、preview/別環境/未使用/本番設定のどれかをPLANで照合する。正常な「本体のみ」という運用を問題扱いして他WorkerへAssetsを追加しない。

## 入口・配備の棚卸し

| 対象 | 作業ツリー/記録で分かること | 評価と状態 |
|---|---|---|
| 本体Worker Static Assets | `wrangler.toml`が`./public`を宣言。`ASSETS` bindingと`run_worker_first`は未記載 | 事実確認済み(ソース)。本番ユーザー確認ではAssets有効。個々のpathの実ルーティング・versionは未確認 |
| 本体Worker public route | `wrangler.toml`の`1.cfw1.../*`はコメント例。2026-10-24 NOTICEはCustom Domain `1.wr1...`を記録 | 過去のCloudflare読み取り記録あり。現在のCustom Domain/routeは未確認。コメントrouteをactive扱いしない |
| Apache系固定ドメイン入口 | `cloudflared-ingress.yml.template`は`NEKOROOT_HOSTNAME`の`/ssh`→2222、残り→8443、末尾404 | ソース確認済み。ユーザーはアクセスが固定ドメインTunnel経由と確認。最新Tunnel config/DNSは未取得 |
| mygw / stream / r9等 | 2026-10-24 NOTICEにTunnelとApache vhostの割当あり | 履歴上のroute map。日付が古く現行状態としては未確認 |
| Worker間Service Binding | 本体wrangler.tomlにdynamicneko、cf-auth、rust-worker-sqlx-d1、muse-monitor等のbinding | 内部呼出し。公開hostname/Worker Routeとは別物 |
| dynamicneko Static Assets | `/root/dynamicneko/wrangler.jsonc`は`dist/client`をAssetsとして宣言 | ソース上は存在するがユーザーが示す本番状態と差がある。配備・環境・意図を照合するまでactive判定を保留 |
| cf-auth / musevm / musevm-kernel | 読んだWrangler設定に`assets`宣言なし | 今回読んだ設定ファイル上の観察であり、全Worker/全環境に未設定という証明ではない |

## 良い点

- 固定ドメインのApacheアクセスがTunnelでprivate originへ入り、ApacheがTLS・HTTP/WS proxy・SSI/CGI等の起点になる責務分担が明確。
- WorkerのCustom Domain/Route、Tunnel hostname、Worker間Service Bindingを別の種類として扱える。
- Static Assetsを本体Workerだけで運用することは正当な最小構成であり、各Workerに一律導入する必要がない。
- 本体`public/`はWorker codeと一緒に配備でき、Workers versionにcode・assets・bindings・compatibility設定が含まれるため、リリース単位を固定しやすい。

## 不足・判断保留

1. **route台帳が古い。** 2026-10-24のCloudflare DNS/Custom Domain/Worker Route/Tunnel snapshotは現在の構成証明にならない。`DEPLOYMENT-STATE.md`にも後日のtunnel down記録があり、別時点の資料を混ぜてはならない。
2. **入口の所有者を一意に照合できない。** 固定domainがTunnelだけを向くのか、一部がWorker Custom Domain/Routeへ移行しているのか、hostnameごとのedge設定と実アクセスで再照合する必要がある。
3. **Tunnelのlocal templateとremote ingress差は未知。** `NEKOROOT_HOSTNAME`一つのtemplateから、複数固定hostすべての現在のroutingを推定できない。
4. **Static Assetsの本番実態と一部ソース宣言に差がある。** ユーザー確認を現行運用の基準とし、dynamicnekoの設定ファイルが未配備・別environmentかを読み取りで確認する。どちらかを即座に誤りとしない。
5. **本体のasset routingが明示されていない。** `binding`/`run_worker_first`未記載の状態で、Hono authやroute middlewareが全asset requestを守るとは推定しない。`/api/*`等の保護pathとasset collision/fallbackを確認する。
6. **更新とrollbackの所在が分散しうる。** Tunnel credential/ingress、Apache config/image、Worker code、Static Assets、DNS/routeは異なる変更・復旧単位となる。共通releaseと誤解せず、相関ID・変更時刻・ownerを記録する必要がある。

## リスク評価

| リスク | 重要度 | 理由 |
|---|---|---|
| 古いDNS/Worker Route snapshotを現在値とみなす | 高 | 誤ったhost/pathを切替・停止する可能性 |
| Tunnel入口とWorker routeの所有が曖昧 | 高 | 保護pathの意図しない別handler到達やedge優先差を見落とす |
| Assetsのasset-first/Worker-firstを誤認 | 高 | Hono認証・ログmiddlewareがasset requestに適用されない可能性。実際の保護対象pathで確認が要る |
| source wranglerと稼働環境の食い違い | 中 | dynamicneko assets宣言等が本番・preview・古い設定のどれか不明 |
| Tunnel connector固有実装を必須化 | 中 | 同じ経路契約を満たす代替connectorを評価しにくくする |
| Static Assetsを別repo化して頻繁に独立更新 | 中 | version skew、互換性・rollback・実行JSの信頼管理を新設する。現時点の必要性は未確認 |

## 推奨評価

- 本体WorkerだけStatic Assetsを使う現状は維持する。ほかのWorkerに追加することを要件化しない。
- cloudflared・Tunnel/Apache系は独立した運用laneとして記録する。ただし利用者が必要としているのは固定domainからの到達契約であり、cloudflaredを技術上唯一の選択肢とは規定しない。
- hostname単位のroute台帳を新設または更新し、DNS、Worker Custom Domain/Route、Tunnel ingress、Apache vhost、最終handlerを同じ行に結ぶ。
- 本体assetsは`public/`、`_headers`、asset manifest、参照元HTML/JS/WASM、Worker versionと一体でrelease管理する。別repo・動的取得は独立更新要件が実証されるまで保留。
- `/root/dynamicneko/wrangler.jsonc`のAssets宣言はユーザー確認の本番状態と照合し、その結果が出るまで評価上は`unknown`としておく。

## 根拠

- この作業で読んだ: `wrangler.toml`、`containers/demo/cloudflared-ingress.yml.template`、`containers/demo/apache-demo.conf`、`containers/demo/apache-lib.conf`、`src/data/conversation-stream-routes.json`、`src/routes/treeViewConversationStream.ts`。
- 別リポジトリで読んだ設定: `/root/dynamicneko/wrangler.jsonc`、`/root/dynamicneko/cf-auth/wrangler.toml`、`/root/musevm/wrangler.toml`、`/root/musevm-kernel/wrangler.toml`。
- 過去の割当記録: `NOTICE.cloudflare-workers-github-oauth-1.DOMAIN-ASSIGNMENTS.20261024.md`。現在のCloudflare状態の代替証拠にはしない。
- Cloudflare公式: [Tunnel configuration](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/configuration-file/)、[Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)、[Worker/asset routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)、[Versions and deployments](https://developers.cloudflare.com/workers/versions-and-deployments/)、[Version skew](https://developers.cloudflare.com/workers/versions-and-deployments/version-skew/)。
