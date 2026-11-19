# EVAL: Apache WebSocket proxy（2026-11-19、opus-5.5）

評価日: 2026-11-19（UTC）
評価: opus-5.5（Claude Opus 5.5、Claude Code）
評価の基準: [`SPEC.cloudflare-workers-github-oauth-1.20261114.apache-websocket-proxy.md`](SPEC.cloudflare-workers-github-oauth-1.20261114.apache-websocket-proxy.md)（2026-11-19の改訂版、SHA256 `bd304b560f279563c1016b745b820bba00bdcfaf92ffc6312ddd890492389bb1`）
評価対象: 本体のdemoコンテナの公開Apache（8443、稼働中）と、`origin/main`（[`c271b7ba`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c271b7ba)）の`containers/demo/apache-demo.conf`
区分: [`SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md`](SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md)の手順1（既存の[`EVAL.cloudflare-workers-github-oauth-1.20261114.apache-websocket-proxy.md`](EVAL.cloudflare-workers-github-oauth-1.20261114.apache-websocket-proxy.md)にはモデル名が無い）

---

## 総合

**対象**: 目標要件WS-1〜6。

既存のEVALの判定（「公開Upgrade範囲と版の対応が未確定」）のうち、版と、拒否のパスとUpgradeの組み合わせは、稼働中のコンテナで確かめられた。設定は11-14から変わっておらず、許可リスト（WS-1）と`Connection`の検証は入っていない。

| 要件 | 判定 |
|---|---|
| WS-1 | 未充足（許可リストなし） |
| WS-2 | 一部（送り先は固定のloopback。パスは限定していない） |
| WS-3 | 一部（Upgrade付きでも403を実測。公開の経路＝Cloudflareを通す試験はしていない） |
| WS-4 | 未着手（2.4.71なので`ProxyPass ... upgrade=websocket`が使える版だが、`proxy_wstunnel`のRewriteのまま） |
| WS-5・6 | 未確認 |

---

## 要件ごとの評価

**対象**: 判定と根拠。

| 要件 | 根拠 |
|---|---|
| WS-1 | `RewriteRule /(.*) ws://127.0.0.1:8080/$1 [P,L]`で、`/lib/api/chat/ws`以外のどのパスもUpgradeを送る。`/some/random`へのUpgradeが8080へ届いた（200） |
| WS-2 | 送り先はコードで固定（`127.0.0.1:8080`）。クライアントが送り先を選ぶ余地は無い |
| WS-3 | `/lib/README.md`・`/debug`・`/admin`へUpgrade付きで403。コンテナの中から8443へ直接送った結果 |
| WS-4 | 稼働中の`Apache/2.4.71`、module`proxy_wstunnel`あり |
| WS-5・6 | timeout・ログの相関は見ていない |

完了条件1（稼働中の版・module）は満たした。image digestとvhostの一覧は、このコンテナの`/etc/apache2`で見られるが、本番イメージのdigestとの照合はしていない。

---

## 提案（未実施）

**対象**: 次の作業。

1. `t3-embed-proxy.cjs`・`t3-pwa-client.js`の利用箇所から、公開のWebSocketのパスを確定し（候補`/ws`）、許可リストのRewriteにする。失敗する試験（`/some/random`へのUpgradeが8080へ届かない）を先に書く。
2. 2.4.71なので、`ProxyPass /ws ws://... upgrade=websocket`へ移せるかを評価する（WS-4）。

---

## 確かめていないこと

**対象**: 範囲外。

- Cloudflare Tunnelを通した公開の経路での結果。
- 101の応答が返る実際のWebSocketの通信（今回の要求はserver.jsがHTTPで答えた）。
