# ApacheのWebSocket proxy設定（2026-11-14）

## このNOTICEの範囲

この記録は、コンテナ上ApacheのWebSocket proxy設定について、2026-11-14に作業ツリーの設定・関連Worker経路・Apache公式資料を照合した時点の事実と設計上の検討事項をまとめる。設定変更、Dockerビルド、コンテナ上でのApache設定確認、稼働中コンテナの版確認、HTTP/WebSocket疎通試験は行っていない。ここに記す推奨は変更承認や実装済み状態を意味しない。

## 作業ツリーで確認した設定

`containers/demo/apache-demo.conf`の公開Tunnel用VirtualHostは8443でTLSを受け、`server.js`の8080番ポートへ転送する。

- `ProxyRequests Off`でforward proxyを無効にし、`ProxyPreserveHost On`を設定する。
- `Upgrade: websocket`がある要求について、URIが完全一致で`/lib/api/chat/ws`でなければ、`RewriteRule /(.*) ws://127.0.0.1:8080/$1 [P,L]`へ送る。Rewrite条件では`Upgrade`のみを確認し、`Connection: upgrade`は確認しない。
- 上記Rewriteに一致しない要求は`ProxyPass / http://127.0.0.1:8080/ retry=0`へ進む。
- 公開VirtualHostには`^/(?:debug|admin|lib)(?:/|$)`を拒否する`LocationMatch`がある。
- `containers/demo/Dockerfile`は`proxy`、`proxy_http`、`proxy_wstunnel`、`rewrite`を有効化する。

現在のRewriteは特定のWebSocket endpointだけでなく、Upgrade条件に一致するほぼすべての公開pathを同一backendの`ws://`へ書き換える形である。`/lib/api/chat/ws`除外が意味するのは、このRewriteによる`ws://`書き換えを行わないことまでで、それ自体はWebSocket拒否ではない。公開側には別途`/lib`拒否が設定されているため拒否される意図だが、Rewrite proxy、URI認可、拒否設定の適用順を含む実応答は未確認であり、回避や悪用が成立すると断定しない。

`src/routes/treeViewConversationStream.ts`にはWorker署名・利用者token等を確認する内部会話ストリーム中継があり、Upgrade関連ヘッダをコンテナへ渡す。ただしこれは公開Tunnel用Apache VirtualHostと同一の入口として扱わない。Worker側認証を公開Apacheが代替するものでもない。

## ApacheのUpgrade処理に関する公式仕様

Apache公式HTTP Server 2.4資料によると、2.4.47以降は`mod_proxy_http`がHTTP Upgradeを扱うことができ、`ProxyPass`の`upgrade=websocket`指定がある。`mod_proxy_wstunnel`は2.4.47以降deprecatedとされ、既定では`mod_proxy_http`へ処理を引き渡す。このため、`proxy_wstunnel`をロードしていることやコメントの表現だけから、実際にどのmoduleが接続をtunnelするかは判断できない。

公式のRewriteによる動的WebSocket proxy例は、`Upgrade: websocket`に加えて`Connection: upgrade`も条件にしている。現在の設定は後者を見ていない。条件を足す場合も、通常の`Connection`ヘッダには複数tokenが含まれうるため、完全一致で正規要求を誤拒否しないようにする必要がある。ヘッダの重複・結合、異常な値、HTTP/2での挙動はこの設定の実動作として未確認。

公式資料:

- [Apache HTTP Server 2.4: mod_proxy](https://httpd.apache.org/docs/2.4/mod/mod_proxy.html) — 2.4.47以降のUpgradeと`upgrade=websocket`。
- [Apache HTTP Server 2.4: mod_proxy_wstunnel](https://httpd.apache.org/docs/2.4/en/mod/mod_proxy_wstunnel.html) — deprecatedの説明、proxy_httpへの既定委譲、Rewriteによる動的proxyの例。
- [Apache HTTP Server 2.4: mod_rewrite proxying](https://httpd.apache.org/docs/2.4/rewrite/proxy.html) — 動的proxyの説明（現行資料では内容が他ページに統合された旨の注記がある）。

## Apacheの版とイメージ記録

作業ツリーでは次を確認した。

- `containers/demo/Dockerfile`の既定値は`ARG APACHE_VERSION=2.4.71`。
- `containers/demo/packages/README.md`はApache 2.4.71のローカルパッケージ、上流ソース、ハッシュ照合・ビルドの記録を持つ。
- `containers/demo/image.lock.json`はApache 2.4.70のパッケージとソースアーカイブを列挙し、`builtFrom`に2026-11-11の`main d46051`と記録する。

従って、作業ツリーの現在のDockerfile/パッケージ説明と、image.lockが記録する以前のイメージ入力の世代が異なる。image.lockだけから現在の稼働コンテナの版を断定できない。実稼働版を確定するには、稼働コンテナ内の`apache2 -v`または同等の出力と、実際にdeployされたイメージdigest・ビルド入力の照合が必要。Dockerfileにある旧apt版2.4.66についてのコメントも、現在のソース指定2.4.71の説明として読むべきではない。

この差分を解消する際は、現在のファイル名・ビルドARG・ビルド時に使うアーカイブ・image lock・実デプロイdigestを一つの再現可能な履歴に結び直す。単に一方の数字だけ書き換えて、既に稼働している版とみなさない。

## 見直しの方向（未適用）

1. アプリが実際に必要とするWebSocket pathを列挙し、公開Tunnelで許可する経路と内部認証済み経路を分ける。
2. 実稼働Apacheが2.4.47以降と確認でき、pathが固定できる場合は、そのpathを明示的に`ProxyPass ... upgrade=websocket`で扱い、その他のpathは通常HTTPのままにする方式を検討する。適用前に、同一pathに通常HTTPも存在する場合の応答を契約試験する。
3. 任意pathへのUpgrade Rewriteは、WebSocket pathを列挙できない要件が明示された場合にのみ残す候補とする。その場合はUpgrade/Connection tokenの検査、許可範囲、異常・重複ヘッダの動作を検証する。
4. 公開VirtualHostで`/lib`、`/debug`、`/admin`をHTTPとWebSocketの両方で拒否し、Workerの内部認証経路を理由に公開拒否を緩めない。
5. proxy_wstunnelのロードとRewriteを外す場合は、実稼働版とすべての必要pathを確認し、新しい構成の設定・経路試験を通してから行う。

WebSocketの再接続、ping/pong、セッション再開はアプリケーション側が所有する。Apacheは中継点であり、切断したセッションを再開しない。`ProxyTimeout`等の実効値とTunnel・backend側のidle timeoutを揃え、アクセスログの101だけで長時間接続の正常性としない。Apacheログの継続時間・転送量と、アプリ側の開始/終了ログを関連付ける案はあるが、切断理由までApache単体で区別できるかは未検証。

## 適用判断前の確認項目

- 実稼働image digest、Apache版、ロードmodule、有効VirtualHost、拒否ディレクティブの実際の構成。
- 通常HTTP、許可WebSocket path、拒否対象pathの応答。
- `/lib/api/chat/ws`を公開Tunnel経由で要求した際に拒否され、内部Worker経路では意図した認証とWebSocket Upgradeが成立すること。
- `/debug`・`/admin`・`/lib`とUpgradeを組み合わせてもbackendへ到達しないこと。
- Upgradeなし、Connectionなし、Connectionのみ、別Upgrade token、複合・重複ヘッダの処理。
- WebSocket 101の後の双方向通信、idle/ping timeout、クライアント切断、backend再起動時の後始末とログ。
- Dockerfile、パッケージ、image.lock、デプロイdigestが同じ版の入力と成果物を指すこと。

本NOTICEの追記は、上記確認が実施済みであることや、既存設定に不具合が確認されたことを意味しない。
