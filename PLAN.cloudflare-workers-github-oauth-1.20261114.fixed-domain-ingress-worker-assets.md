# 固定ドメインTunnel・Worker routes・Static Assetsの整備予定（2026-11-14）

## 状態

本PLANは調査・運用台帳・管理手順の作成順を示す。DNS、Worker Route、Custom Domain、Tunnel、Apache、Static Assetsの設定・配備は未実施であり、この文書はそれらの変更許可ではない。

評価: [EVAL.cloudflare-workers-github-oauth-1.20261114.fixed-domain-ingress-worker-assets.md](EVAL.cloudflare-workers-github-oauth-1.20261114.fixed-domain-ingress-worker-assets.md)
要件: [SPEC.cloudflare-workers-github-oauth-1.20261114.fixed-domain-ingress-worker-assets.md](SPEC.cloudflare-workers-github-oauth-1.20261114.fixed-domain-ingress-worker-assets.md)
前提: Cloudflare Static Assetsを本番で設定しているのは現状本体Workerのみで、正常状態。cloudflaredは固定ドメインTunnelの現行connectorであり、代替可能な実装として扱う。

## 作業レーン

以下は別系統で記録し、必要な時だけ変更間の依存関係を明示する。

| Lane | 内容 | 単独で変更できる主な範囲 |
|---|---|---|
| A. Tunnel/Apache ingress | 固定hostname、Cloudflare DNS、Tunnel ingress/credentials、connector、Apache VirtualHost/backend | Apache origin、Tunnel ingress、接続監視、固定hostのport/path |
| B. Worker ingress/routes | Custom Domain、Worker Route pattern、Worker名/environment、DNS owner、Worker handler/service binding | Worker公開host/pathの追加・移行・廃止 |
| C. Worker Static Assets | 本体Worker `public/`、asset manifest/headers、HTML/JS/CSS/WASM参照、version/deployment/rollback | 本体Workerのasset contentとrouting mode |
| D. Worker間通信 | Service Binding、認証・署名、呼出元/受信側契約 | 内部Worker-to-Worker path。公開DNS/routeとは別 |

## 段階1: 正本と現在状態を読み取りで確定する

### 1.1 Cloudflare edge/Worker route snapshot

- 同一時点でCloudflare APIまたはdashboardからzone DNS、Worker Custom Domains、Worker Routes、各Worker名/environment、Tunnel hostnamesとingress configurationを読み取る。
- 各値に取得日時・zone/account scope・読めなかった領域を付す。秘密値は出力・文書に保存しない。
- `NOTICE...DOMAIN-ASSIGNMENTS.20261024.md`と`DEPLOYMENT-STATE.md`の後続状態を比較し、古い行は`historical`として残す。
- Worker Route wildcard、Custom Domain、DNS alias、Tunnel public hostnameの差を明記する。Routeのみで公開到達性を推定しない。

### 1.2 Tunnel connector/Apache route snapshot

- 固定hostnameごとにDNS → Tunnel UUID/name → active connector → remote ingress rule → local service/port → Apache vhost → server.js/Apache/lib/Redmine等の最終handlerを対応付ける。
- 作業ツリーの`cloudflared-ingress.yml.template`と実際に稼働中のremote/local configを比較する。
- `/ssh`、HTTP、WebSocket、SSE、内部専用`/lib`、Apache 8443/8445/10443等を入口ごとに分類する。別hostが同じTunnelを使う場合も同じhandlerとは仮定しない。
- Tunnel credentialの保管先、更新所有者、切替/復旧方法をSecret値なしで台帳に記載する。

### 1.3 受入台帳

`ROUTE-LEDGER`（ファイル名は実装段階で決める）を作り、SPECの必須項目を各行に記録する。最低限の列:

`id | hostname | path/pattern | ingress kind | owner Worker/environment or Tunnel | backend/handler | auth boundary | DNS state | status | evidence timestamp | rollback owner`

Service Bindingは公開routeとは別の表に記録する。除外Route、preview hostname、DNSのない旧route、停止中Tunnelはactive route表に混在させない。

**完了条件:** 対象hostnameごとに入口から最終handlerまで根拠付きで追える。未知値はunknownと表示し、推測で埋めない。

## 段階2: cloudflaredの位置付けと独立保守を確定する

- 運用要件を「固定domainからprivate originへ到達」「Apache/Tunnel制御」「長時間HTTP/WS/SSE」「接続ログ」「資格情報更新・復旧」に分解する。
- 現行のcloudflared connector/remote Tunnel設定の運用owner、更新方法、health確認、停止時の影響を記録する。
- cloudflaredがなくても同要件を満たす代替経路があるかは比較項目として残す。ただし現行DNS/routeを変更したりTunnelを停止したりしない。
- Apacheのproxy設定変更とTunnel ingress変更を別PR/別リリースにするか、依存のある場合は順序とrollbackを相互参照する。

**完了条件:** 「Tunnel経由が現行のアクセス経路」「cloudflaredという実装は必須条件でない」「maintenance ownerと変更手順」が区別して記録される。

## 段階3: Worker Route・Custom Domainの運用管理を決める

- 本体のコメントアウトRoute例と実Custom Domain/Routeの現状を照合する。
- 各Workerで公開host/pathを持つ理由、認証middleware、path owner、静的assetとの衝突、Service Binding先を一覧化する。
- Route追加/変更は、DNS存在、Worker ownership、既存route wildcard優先、Cloudflare edgeでの実到達、rollback条件を確認してから変更する。
- Service Bindingの内部経路にpublic hostnameを追加しない。外部URL呼出し、Service Binding、Tunnel origin requestを同じrouteとして扱わない。
- 異なるWorkerへhostnameを移す場合は、edge route変更前後で認証、cookie scope、CSP/CORS、API callback、固定origin値を互換確認する。

**完了条件:** 全active routeについてCloudflare登録値、DNS、Worker所有者、path handlerの対応が最新の取得結果で揃う。

## 段階4: Static Assetsの所有・release管理

### 4.1 本体Worker

- `wrangler.toml`の`assets.directory = "./public"`を本体Worker Static Assetsの正本として記録する。
- `public/`全体を列挙し、HTML/manifest/JS/CSS/WASM/Service Workerと参照関係、`_headers`等の配信規則、公開/保護情報の分類を台帳化する。
- Honoが認証・ログする必要のあるpathと、Cloudflare asset routerが直接返すpathを現行compatibility date・Wrangler仕様に沿って解決する。設定で`binding`/`run_worker_first`を追加・変更するのは要件と負例試験が決まってからにする。
- 各releaseについてGit commit、asset file manifest/SHA-256、Worker version ID、deployment ID、公開時刻、rollback先を保存する。
- HTMLが参照するhashed assets/WASMを同じWorker versionに揃える。古いHTML/asset参照とdeployment propagation/version skewを想定し、保持・互換・rollback方針を決める。
- `Cache-Control`・MIME・SPA fallback・404・Range requestが製品要件に合うか確認する。特に認証を要するassetを長期public cacheで配信しない。

### 4.2 本体以外のWorker

- 本番にCloudflare Static Assetsを設定していない現状は正常状態として維持し、一律に`assets`を追加しない。
- 各Workerのsource Wrangler config、production deployment metadata、実配信host/pathを読み取り照合し、ソースにだけある未使用・preview設定を識別する。
- 作業ツリーのdynamicneko `wrangler.jsonc`に`dist/client`等の宣言が見えるため、これが現行production設定か、別環境/未配備設定かをユーザー確認の運用前提と照合する。確認結果が出るまで本番Assetsを使用中とも停止中とも断定せず、設定変更しない。
- cf-auth、musevm、musevm-kernel等は今回読んだ設定でassets宣言を確認していない。全Cloudflare Workerの読み取り結果が揃うまで「他Workerは全て未設定」と断定しない。
- Workerに静的HTML/SPAが必要になった場合は、そのWorker固有のauth、routing、ownership、release、rollbackを評価して個別のSPECを作る。

### 4.3 別repo/独立更新の扱い

- main Workerへ同梱するassetの編集・レビューを分けたいだけなら、Git上の別ディレクトリ/変更管理を第一に検討し、assetを独立実行コードとして動的取得しない。
- 本体Worker再デプロイ無しでassetだけ更新する要件が確認された場合に限り、別asset Worker/service bindingまたはversioned object storeの案を評価する。
- 独立配信を採る場合は、許可package/path、immutable release ID、manifest schema、content hash、MIME、互換API version、署名/承認、retention、緊急revoke、古いHTMLとのversion affinity、Cache purge限界を先に仕様化する。
- GitHub branch/任意URL/request pathを直接配信元として使わず、public JS/WASMが同一originの権限で動くことを脅威モデルに含める。

**完了条件:** 本体assetの所有者・source revision・配備version・rollbackが照合でき、他WorkerのStatic Assets未導入が意図的な状態として記録される。

## 段階5: 保護・配信・更新の検証計画

実環境設定の変更を伴わない読取確認と、隔離された試験を区別する。

- **Routing:** 各固定hostname、public Worker host、Service Bindingについて正しいhandlerに届くかを確認する。異なるvhost・Tunnel経由の同じpathを混同しない。
- **Auth boundary:** Apache公開拒否、Worker Hono認証、内部署名、公開assetを別々に試す。asset-firstとrun_worker_firstのpathについて認証迂回・エラー応答を調べる。
- **Static Assets:** 正常asset、missing asset、wrong MIME、hashed old asset、WASM、SPA navigation、Cache-Control、更新中のHTML/asset互換を検証する。
- **Tunnel:** 正常connector、connector停止/再接続、upstream Apache停止、TLS origin設定、WS/SSE長時間接続、timeoutを測定する。Tunnel変更テストはユーザー影響のない隔離系で行う。
- **Rollback:** Worker version rollbackとTunnel/Apache rollbackが独立で機能し、片方のrollbackが他方の設定を破壊しないこと。

**完了条件:** 期待hostname/path→owner→auth→backend/assetが全て一覧で検証され、各release laneの戻し方がある。

## 段階6: 更新手順と責任者の記録

- Worker code/Static Assets releaseとTunnel/Apache releaseに別々のowner、review、version、変更時刻を記録する。
- 共通の変更が必要なときだけcross-referenceで依存を記述し、二つのreleaseを一つの不可分な配備とみなさない。
- 入口台帳、Static Assets manifest、`DEPLOYMENT-STATE.md`、NOTICEの更新時点を揃える。
- push/deploy前にこのrepositoryのAGENTS.mdにあるDocker・Workers Builds制限を確認する。文書だけの変更はDocker build対象にしない。

## 優先度

1. **P1** 現行のCloudflare route/DNS/Tunnel/connectorと対象固定domainを同じ時点で読み取り照合する。
2. **P1** 本体Worker `public/`と現行asset routing/versionを棚卸しし、保護pathとの境界を確認する。
3. **P1** Worker route台帳を作り、Custom Domain/Route/Tunnel/Service Bindingを分類する。
4. **P2** dynamicnekoのソースにあるAssets宣言と「本番は本体のみ」という運用状態を解決する。
5. **P2** Static Assetsのrelease manifest、版相関、rollback・cache方針を定める。
6. **P3** 独立asset repository/serviceの必要性を再評価する。独立更新要件がなければ作成・配備しない。
7. **P3** cloudflared代替connectorを必要時のみ比較する。現在のTunnel/DNS/Apache稼働経路を先行変更しない。

## 変更ゲート

- DNS/Worker Route/Custom Domain/Tunnelを変更する前に、現行値・影響host・復旧方法を記録する。
- Static Assetsのrouting modeやdirectoryを変える前に、asset path一覧と認証境界を確認し、正例・負例を検証する。
- Static Assetsを別Worker/repositoryに分離する前に、独立更新頻度・利用Worker数・rollback責任・公開コードの信頼者が合意された仕様を作る。
- connectorを差し替える前に、固定domainの公開継続、証明書/TLS、HTTP・WebSocket・SSE、SSH等の必要protocol、ログ、再接続、資格情報rotationを隔離検証する。
- 本PLANは実施順序であり、各変更の個別承認やデプロイ済み状態を意味しない。
