# Apache WebSocket proxyの仕様と見直し要件（2026-11-14）

## 状態

設計整理。現状の確認と目標要件を定義したもので、Apache設定の変更・承認ではない。実稼働環境の版・設定・接続挙動は未確認。

関連記録: [NOTICE.cloudflare-workers-github-oauth-1.20261114.apache-proxy-wstunnel.md](NOTICE.cloudflare-workers-github-oauth-1.20261114.apache-proxy-wstunnel.md)

## 目的・範囲

コンテナ上Apacheの公開Tunnel VirtualHostがWebSocket要求をどこへ転送するかを明確にし、公開経路と認証済み内部経路を混ぜずに維持する。対象は`containers/demo/apache-demo.conf`、必要な場合のDockerfile/module構成、同設定へ到達する公開Tunnel経路と、比較対象としてのWorker会話中継。

このSPECは会話機能のプロトコルや認証方式を置き換えない。Tailscale WASMを経由した新しいWebSocketゲートウェイも対象に追加しない。

## 現行構成（作業ツリー）

`containers/demo/apache-demo.conf`は8443でTLSを終端し、server.jsの8080へreverse proxyする。

| 条件 | 現行ルーティング |
|---|---|
| `Upgrade: websocket`かつURIが`/lib/api/chat/ws`以外 | Rewrite `[P]`で`ws://127.0.0.1:8080/<path>`へ転送 |
| 上記Rewriteに一致しない | catch-all `ProxyPass / http://127.0.0.1:8080/ retry=0`へ転送 |
| `/debug`、`/admin`、`/lib` | `LocationMatch`で拒否する設定がある。Upgradeとの組合せを含む実効性は未試験 |

Rewrite条件はUpgradeヘッダだけを調べ、Connectionヘッダを検証しない。Rewrite対象は既知のWebSocket endpointに限定されず、条件に合うほぼすべての公開pathである。Apacheはproxy backendであり、アプリケーション認証の代わりにはならない。

`containers/demo/t3-embed-proxy.cjs`には`upgrade`イベント処理があり、`containers/demo/t3-pwa-client.js`は同一hostの`/ws`を利用する。これらは公開WebSocket候補の具体例で、他の利用pathがないことを示す全数調査ではない。

`/lib/api/chat/ws`はRewrite対象から除外されるが、公開VirtualHostは`/lib`を拒否する意図である。Workerの`treeViewConversationStream`は別の内部認証経路でUpgradeヘッダをcontainerへ渡す。公開Apache経由でlibを許可する理由として内部経路の存在を使わない。

## 目標要件

### WS-1 経路の明示

公開VirtualHostでWebSocketを受け付けるpathは、アプリ側の利用状況を確認したうえで有限のallowlistとして明記する。現時点の候補は`/ws`。確定するまではpath追加・変更を行わない。

### WS-2 任意トンネル化の防止

クライアント指定のhost、port、backend、任意のUpgrade protocolへ転送しない。許可したpathのみ、固定したloopback backendへ送る。その他のpathはWebSocket tunnelにならず、通常HTTPルートか拒否となる。

### WS-3 内部資産・管理pathの隔離

公開VirtualHostは`/lib`、`/debug`、`/admin`をHTTPとUpgrade要求の両方でbackendへ転送しない。拒否は設定の読み取りだけでなく、公開経路を通す統合試験で確認する。Worker署名・利用者認証はWorker側で維持し、Apacheがヘッダの存在だけを本人確認に使わない。

### WS-4 Apache moduleと設定の整合

実稼働版を確定してから方式を選ぶ。Apache 2.4.47以降で固定pathを扱う場合、公式資料にある`mod_proxy_http`の`ProxyPass ... upgrade=websocket`を第一候補として評価する。動的なRewriteを残す場合は、必要性、Upgrade/Connection検証、path制限を設定とテストに記す。deprecated扱いの`mod_proxy_wstunnel`を残すなら、ロードする理由と互換性範囲を明示する。

### WS-5 通常HTTPとの共存

同じpathでHTTPとWebSocketを扱うか、別pathにするかはアプリ契約に従う。設定を変更する場合、通常HTTP要求が誤ってUpgradeされないこと、既存のHTTP応答・認証が変わらないことを両方確認する。

### WS-6 接続寿命と可観測性

接続先アプリがping/pong、再接続、必要なセッション再開を所有する。Apache・Tunnel・backendのtimeoutを確認し、意図せぬ早期切断と無制限保持を避ける。アクセスログの101だけを通信成功の証拠とせず、接続継続時間・転送量とbackendの開始/終了を相関可能にする。

## 版と配布元の記録

現在の作業ツリーのDockerfileは`APACHE_VERSION=2.4.71`、パッケージREADMEは2.4.71のローカルビルドを記録する。`image.lock.json`は2026-11-11の`main d46051`から作成されたイメージ入力として2.4.70を記録する。これは作業ツリーと過去のイメージ記録の世代差であり、稼働版の証明ではない。適用判断では実稼働コンテナの版とイメージdigest・build args・archiveを照合する。

## 完了条件

1. 稼働対象のApache版・image digest・有効vhost・ロードmoduleを確認できる。
2. 公開WS allowlistと通常HTTP pathを、アプリの利用箇所まで追って確定できる。
3. 拒否pathとUpgradeの組合せが公開経路でbackendへ届かないことを試験する。
4. 許可pathのHTTP/WS、認証、切断、timeoutの各契約を確認する。
5. Dockerfile、package、image lock、deploy記録の版を再現可能にそろえる。
6. 変更が必要と判断された場合のみ、失敗する試験を先に追加し、その後で設定を変更する。

## 未決事項

- 公開vhostに必要なWebSocket pathの完全な一覧。
- 現在稼働中のApache version、module、VirtualHost、timeoutとログ設定。
- `/lib`等の拒否とRewrite `[P]`の組合せ、catch-all ProxyPassでUpgrade付き要求を受けた際の実応答。
- 同一origin、HTTP/2、異常/重複Upgradeヘッダの実挙動。
