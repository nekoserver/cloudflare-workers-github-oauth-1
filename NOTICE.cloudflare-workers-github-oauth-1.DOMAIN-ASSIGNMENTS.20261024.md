# 現在のドメイン割り当て表（2026-10-24）

確認日時: 2026-10-24 12:13 UTC。Cloudflare APIのWorker Custom Domains・Worker Routes・DNS・Tunnel ingressと、現在のコンテナのApache設定を読み取りで照合した。設定の記録であり、ここに記載するためのルーティング変更は行っていない。

## 1. 本体・SecureMine・AIチャットのアドレス

| 用途 | 公開URL | 処理するWorker・接続先 |
| --- | --- | --- |
| 本体 | https://1.wr1.nekomaneki.work/ | cloudflare-workers-github-oauth-1 |
| SecureMine画面 | https://1.wr1.nekomaneki.work/securemine | 本体Worker。Redmine接続はr9へ |
| SecureMineから使うRedmine | https://r9.nekomaneki.work/ | nekoroot Tunnel → Apache10443 → Redmine/Puma3009 |
| SecureMineのサーバー間HMACゲートウェイ | https://r9.nekomaneki.work/redmine-hmac | Apache CGI → Redmine/Puma3009。利用者のAPIキーとHMAC署名が必要 |
| AIチャット画面 | https://1.wr1.nekomaneki.work/aichat | 本体Worker。r9へ切り替えていない |
| AIチャットの既定API | https://mygw.nekomaneki.work/lib/api/tunnels | nekoroot Tunnel → Apache8443 → lib API/実行ワーカー |
| 本体側の既定会話埋め込み先 | https://mygw.nekomaneki.work/lib/conversation-embed.html | Apache8443 → HTTP配信8092 / observer |
| 別の配信ホスト | https://stream.test.cfc.nekomaneki.work/lib/conversation-embed.html | 現在は同じnekoroot Tunnel → Apache8443。管理Workerのホストとは別 |
| 本体のコンテナ管理画面 | https://1.wr1.nekomaneki.work/cf-containers | 本体Worker |
| 独立コンテナ管理の入口 | https://test.cfc.nekomaneki.work/ | cfc-standalone Worker |

SecureMineとAIチャットは現在、同じ本体Worker上の別機能である。今回r9のRedmineへ接続先を変更した対象はSecureMine。AIチャットの `ASKGK_TUNNELS_URL` と `NEKOROOT_HOSTNAME` はmygwのまま維持した。共通HMACを利用することと、接続先ホストを共用することは別である。

SecureMineの画面URLは `/securemine`、Redmineそのものの画面はr9。r9をホーム画面へ追加したPWAと、本体ホストのPWAも別のオリジンになる。

## 2. Worker Custom Domains

以下はCustom Domainとして登録され、対応するproxied DNSレコードも確認できたホスト。

| ホスト | 割り当てWorker | 環境 |
| --- | --- | --- |
| 1.wr1.nekomaneki.work | cloudflare-workers-github-oauth-1 | production |
| test.cfc.nekomaneki.work | cfc-standalone | production |
| 1.cfa.nekomaneki.work | cf-auth | production |
| 1.prod.nekomaneki.work | google-oauth-worker | production |
| test.apigw.nekomaneki.work | api-gateway | production |
| r1.cfgw.nekomaneki.work | r1-cfgw | production |
| openapi.test.nekomaneki.work | openapi | production |

これらのDNSは確認時点でAAAA `100::`、proxied=true。個々のアプリへのログイン・全機能の疎通まで確認した一覧ではない。

## 3. Worker Routes

Custom Domainとは別に、次のRouteが登録されている。

| パターン | Worker | DNSとの照合・注意 |
| --- | --- | --- |
| wr1.nekomaneki.work/* | cloudflare-workers-github-oauth-1 | 同名A/AAAA/CNAMEは今回のDNS一覧になかった。通常の公開URLとして到達可能とは確認していない |
| cfc.nekomaneki.work/* | cfc-standalone | 同上 |
| cfa.nekomaneki.work/* | cf-auth | 同上 |
| prod.nekomaneki.work/* | google-oauth-worker | 同上 |
| apigw.nekomaneki.work/* | api-gateway | 同上 |
| cfgw.nekomaneki.work | r1-cfgw | 同名DNSなし。Routeのパターン末尾に `/*` もない |
| test.nekomaneki.work/* | openapi | 同名DNSなし |
| u26t.cfc.nekomaneki.work/* | script=null | Workerを割り当てない除外Route。同名DNSなし |

Routeが存在するだけではDNSの存在・公開到達性を保証しない。上記の別名を、確認済みCustom Domainの代わりに案内しない。

## 4. 現在のTunnel向けDNSとコンテナ内の振り分け

4ホストともproxied CNAMEが同じnekoroot Tunnelを向いている。確認時のnekorootはhealthy。各ホストにはWorker Custom Domainも、今回の一覧に該当するWorker Routeも登録されていない。

| ホスト・パス | Tunnel ingressの転送先 | コンテナ内の処理 |
| --- | --- | --- |
| mygw.nekomaneki.work /lib と配下 | https://127.0.0.1:8443 | lib API・会話配信 |
| mygw.nekomaneki.work /sshで始まるパス | ssh://127.0.0.1:2222 | SSH |
| mygw.nekomaneki.work その他 | https://127.0.0.1:8443 | Apache → 管理サーバー8080。ただしlib用の個別経路を先に適用 |
| r8.nekomaneki.work 全パス | https://127.0.0.1:8443 | 同じApache8443の振り分け |
| r9.nekomaneki.work /redmine-hmac | https://127.0.0.1:10443 | ApacheのScriptAlias → HMAC CGI → HTTP127.0.0.1:3009 |
| r9.nekomaneki.work その他 | https://127.0.0.1:10443 | Apache → HTTP127.0.0.1:3009、Redmine |
| stream.test.cfc.nekomaneki.work 全パス | https://127.0.0.1:8443 | lib用の個別経路と管理サーバーへの中継 |

8443側の主な経路は次のとおり。

| パス | ローカル接続先 |
| --- | --- |
| /lib/api/tunnels・tunnels.rb、およびuptunnels互換経路 | Ruby CGI → キャッシュ・実行ワーカーのUnixソケット |
| /lib/api/chat/ws | ws://127.0.0.1:8091/lib/api/chat/ws |
| /lib/api/chat/ 配下 | http://127.0.0.1:8092/lib/api/chat/ |
| /lib/conversation-embed.html、/lib/chat/ | HTTP配信8092。認証の適用範囲は既存設定に従う |

公開HTTPSの443と、コンテナ内8443/10443/8091/8092/3009は別の区間である。Redmine用10443・Puma3009・配信8091/8092はループバック待受である。

### 停止中の旧cfc-tunnel定義

cfc-tunnelはdownだった。リモート設定には `test.cfc.nekomaneki.work` のSSH22222・HTTP8443と、streamホストの8443転送が残っている。ただしtest.cfcの公開入口は現在cfc-standalone Worker、streamのDNSはnekoroot Tunnelを向く。この旧ingressの存在を現在の稼働経路と取り違えない。今回起動・切替は行っていない。

## 5. その他のHTTP向けDNS

| ホスト | DNS接続先 | Cloudflare proxy | 確認範囲 |
| --- | --- | --- | --- |
| api.nekomaneki.work | a816cfebe4492597.vercel-dns-017.com | false | Vercel向けCNAME。サービス内部の割り当ては未確認 |
| docs.nekomaneki.work | cname.vercel-dns.com | false | 同上 |
| www.nekomaneki.work | d421aa9d63162256.vercel-dns-017.com | true | 同上 |

この表は今回確認したnekomaneki.workゾーンのA/AAAA/CNAMEとWorker/Tunnelの設定を対象とする。MX/TXT等のメール・検証用レコードはHTTPサービスの割り当て表に含めていない。アカウントのworkers.devサブドメインはnekoflareだが、各Workerのworkers.dev公開有効/無効や全URLの到達性は今回未確認。

## 6. 稼働設定とソースの反映差分

SecureMineの本番接続先マップは `https://r9.nekomaneki.work` → `https://r9.nekomaneki.work/redmine-hmac`。既存の本番Workerコードを維持し、SecureMine用の2 bindingだけを更新した。共通鍵そのもの、AIチャットのmygw設定、R9_HMAC_SECRETは変更していない。鍵の実値はこの文書に記録しない。

設定更新後のWorker versionは `ca0e6359-09d6-4f89-affc-4bddd522d1b7`、deploymentは `c5748770-3998-47dd-be86-90afd71fd9b6`。更新前後のモジュールと対象外の実行設定を比較し、差分がないことを確認した。

作業ツリーにはSecureMine入力欄の既定URLをr9にする修正と、Workerが共通ORIGIN_HMAC_SECRETを直接優先参照する修正があるが、これらのソース変更は未デプロイ。現在の本番コードが使うREDMINE_HMAC_SECRETには共通鍵と同じ値を設定して互換を保っている。この互換bindingは共通鍵の別名を動的参照する機構ではないため、ソース反映前に共通鍵を変更する場合は同期が必要。

r9側CGIは既存の `/etc/lib-hmac.env` を読み込む。署名正常時はRedmineまで到達し、APIキーが不正なら401。署名なし・nonce再利用は403を確認した。実際の利用者APIキーによるSecureMine画面内のログイン・同期成功は未確認であり、接続先の設定成功と区別する。

関連記録: [DEPLOYMENT-STATE](DEPLOYMENT-STATE.md)、[当日ネットワークREPORT](REPORT.cloudflare-workers-github-oauth-1.NETWORK.20261024.md)、[Redmine構築REPORT](REPORT.cloudflare-workers-github-oauth-1.REDMINE-R9.20261024.md)。古い資料のmynwやr9/lib共用は、その時点の履歴として読む。
