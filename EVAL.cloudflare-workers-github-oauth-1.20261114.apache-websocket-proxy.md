# Apache WebSocket proxy現状の評価（2026-11-14）

## 対象・評価の基準

NOTICEとSPEC、関連するApache設定・Worker経路を読み、現行設計を仕様要件に照らして評価する。Apacheコンテナへ接続していないため、稼働環境の評価ではない。設定変更、Docker build、実通信試験は未実施。

対象: `containers/demo/apache-demo.conf`、`containers/demo/Dockerfile`、`containers/demo/image.lock.json`、`containers/demo/packages/README.md`、`containers/demo/t3-embed-proxy.cjs`、`containers/demo/t3-pwa-client.js`、`src/routes/treeViewConversationStream.ts`。

## 判定

**結論: 設定意図は読み取れるが、公開Upgrade範囲と版の対応が未確定。現状のまま安全性・互換性を承認する根拠は不足している。** 現時点で脆弱性が成立した、または接続が壊れていると判定したわけではない。

| 評価項目 | 判定 | 根拠・不足 |
|---|---|---|
| forward proxy抑止 | ソース上確認 | `ProxyRequests Off`がある。稼働設定は未確認 |
| backend固定 | ソース上確認 | loopbackの8080に固定。Rewriteに任意host/port入力はない |
| WS pathの最小許可 | 不適合 | Upgrade条件に一致すれば`/lib/api/chat/ws`以外の全pathをws backendへ転送する |
| 正当なWebSocket pathの存在 | 一部確認 | `/ws`をPWA clientが利用しcontainer serverがUpgrade handlerを持つ。他のpath全数は未棚卸し |
| Upgrade要求の検証 | 一部不足 | `Upgrade: websocket`のみを判定し、Connection tokenを判定しない。悪用成立は未検証 |
| `/lib`等の拒否 | 設定あり・動作未確認 | LocationMatch拒否があるが、Upgrade＋Rewrite `[P]`との交点は未試験 |
| `/lib/api/chat/ws`の外部遮断 | 意図あり・動作未確認 | Rewriteから除外されるだけでは拒否ではない。公開`/lib`拒否が機能するかを実経路で確認する必要 |
| 内部Worker経路との分離 | ソース上確認 | Worker署名・token認証の中継が別に存在。Apache公開vhostの認証とは区別されている |
| Apache proxy実装の現行性 | 要整理 | ソースはRewriteで`ws://`へ送る。2.4.47以降のproxy_http対応とwstunnel委譲仕様に対し、コメントはwstunnelを直接使うように読める |
| version / image provenance | 不整合を確認 | 現行Dockerfile/READMEは2.4.71、image.lockは2.4.70を記録。lockのbuiltFromは2026-11-11の過去commit。稼働版は未知 |
| timeout・継続ログ | 未評価 | ソース断片では実効timeout、Tunnel側の値、backend相関ログ、実接続の継続を確認できない |

## 重要な解釈上の注意

### Rewrite除外と拒否は別

`/lib/api/chat/ws`の除外条件はRewriteを適用しないだけで、WS拒否を実装しない。公開vhostの`/lib`拒否があるため拒否される意図はあるが、Rewrite proxyとの処理順を実機で確認していない。したがって「catch-allが必ず101を返す」「拒否が確実に抜ける」のどちらも断定しない。

### Apache版は作業ツリーと配備イメージ記録で分ける

Dockerfileが2.4.71であることは作業ツリーの次回ビルド入力を示す。image.lockが2.4.70を持つことは、builtFromに記録された過去ビルドの入力を示す。どちらも単独で現在のコンテナ実行版を証明しない。実稼働image digestと`apache2 -v`等の実測が必要。

### wstunnelという名前だけで処理経路を決めない

Apache公式資料では2.4.47以降、proxy_httpがUpgradeを扱え、proxy_wstunnelはdeprecatedで既定でproxy_httpに委譲する。現行Rewriteが動くかどうかと、将来の設定として明確・保守可能かどうかは別の評価軸である。

## リスク優先順位

1. **高: 公開WebSocket許可範囲が広い。** 実際に多数pathが必要という根拠がなく、WebSocket endpointの追加や誤用を設定から見分けにくい。
2. **高: 拒否pathとUpgradeの交点が未試験。** 認可漏れと断定はできないが、設定上もっとも優先して確認すべき組合せ。
3. **高: イメージ世代を特定できない。** 2.4.47以降の方式選択を稼働環境に適用する前提が確認できていない。
4. **中: Upgrade条件が不完全に見える。** Connection token検証がない。Apache公式例と差があるが、現実の悪用可否は別途調査が必要。
5. **中: コメントと設定意図が曖昧。** `/lib`除外がWS拒否と誤読されうる。wstunnelが実際に担当するという誤解も招く。
6. **中: timeout/接続終了の可観測性が不明。** 101だけでは長時間接続の成否を評価できない。

## 推奨判断

変更を急がず、先に配備版を確定し、必要なWS pathをアプリ側から全数把握する。固定pathなら明示的なProxyPass Upgradeを候補にし、残りのpathをHTTPのままにする。`/lib`、`/debug`、`/admin`は公開側のHTTPとWS双方でbackendへ流さない。動的Rewriteを継続する場合は、必要性と許可範囲を仕様化し、ヘッダ検査・拒否path・実通信のテストで裏付ける。

### 根拠資料

- Apache公式 [mod_proxy](https://httpd.apache.org/docs/2.4/mod/mod_proxy.html)
- Apache公式 [mod_proxy_wstunnel](https://httpd.apache.org/docs/2.4/en/mod/mod_proxy_wstunnel.html)
- ローカル根拠: [Apache設定NOTICE](NOTICE.cloudflare-workers-github-oauth-1.20261114.apache-proxy-wstunnel.md)
- 要件案: [Apache WebSocket proxy SPEC](SPEC.cloudflare-workers-github-oauth-1.20261114.apache-websocket-proxy.md)
