# 本体コンテナのlibアクセス制御の現状（2026-11-13 UTC）

## 対象と確認範囲

現コンテナの `/var/www/html/lib`、有効なApache設定、lib認証実装、本体Workerとdynamicnekoの中継を記録する。設定変更・認証緩和・デプロイは本SPEC作成のためには行っていない。秘密値・トークン・会話本文は記載しない。

有効設定は `/etc/apache2/sites-enabled/000-demo.conf`、`010-lib.conf`、前者がIncludeする `/etc/apache2/lib-askgk-api.conf`。`apache2ctl -t -D DUMP_VHOSTS` と待受ポートを確認した。cf-containerのテンプレートを読んだだけで適用済みとは判定していない。

## 経路別の制御

| 入口 | 到達先・制限 | 認証の境界 |
|---|---|---|
| 公開mygw → Apache TLS8443 | `/lib` とその配下を原則403。debug/adminも拒否 | 公開URLへ接続しただけではlibを利用できない |
| 公開 `/lib/api/tunnels`・`/lib/api/tunnels.rb` | 完全一致の2パスだけCGIへ接続 | ApacheはX-SignatureとX-Timestampの存在を要求。CGIが実際のHMACを照合 |
| 本体 `/cf-containers/proxy/lib/*` | 管理者用の汎用コンテナ中継 → server.js → 内部8445 | 本体のauthMiddlewareとcfDashboardAdminMiddleware。libのAPI認証は別途必要 |
| dynamicneko `/lib/*` | 所有者用の限定会話中継 → MAIN_WORKER → 本体の専用受信ルート → server.js → 内部8445 | 所有者ログイン、PWAセッションの有効性、origin確認、Worker署名、短寿命ユーザートークン、管理者本人確認 |
| 内部Apache127.0.0.1:8445 | SSI/CGI、限定したchat配信への転送 | Require local。内部到達だけでAI入力を許可するわけではない |
| WS127.0.0.1:8091 / HTTP127.0.0.1:8092 | 会話HTML・資産・観測・入力API | lib独自のorigin制限、HMAC、観測/投稿セッション |

server.jsの8080と公開Apache8443は全インターフェースで待受、8445/8091/8092はloopback限定を実測した。8080のlib中継自身はWorkerログインを検証しない。コンテナ内から直接呼ぶ場合と外部の正規Worker経路は異なる信頼境界であり、ローカルrootに対する隔離を保証するものではない。外部から8080へ直接到達可能かというネットワーク境界全体の監査は本SPECでは未実施。

## 公開Apacheの例外：tunnels API

`/etc/apache2/lib-askgk-api.conf` は原則拒否の後、catch-all ProxyPassの前で読み込まれる。対象は末尾まで完全一致する2パスだけで、`/lib/api/tunnels/extra` は例外ではない。

- ヘッダなしはApacheで403、不正署名はCGIで401。ヘッダが存在するだけでは認証成功ではない。
- 公開側は `/usr/local/libexec/lib-api/askgk.cgi` → `/var/www/html/lib/claude/api/tunnels.claude.rb`。内部側は `tunnels.cgi` → `lib/api/tunnels.rb`。入口によってCGIの実体・既定エンジンが異なる。
- 署名は `METHOD + 改行 + REQUEST_URI（queryを含む） + 改行 + UNIX秒 + 改行 + SHA256(body)` のHMAC-SHA256。許容時刻差は300秒。
- CGIは現在ENVのORIGIN_HMAC_SECRET、次にHMAC_SECRETを使用し、両方なければ保護した `/etc/lib-hmac.env` を読む。秘密値をURLへ付けない。
- `tunnels_lib.rb` はmessage、ask_id、LLMへの要求、稼働時間照会等をHMAC必須にする。単純な一覧等では既存のIP許可・検証済みAccess環境フラグを受理する分岐もある。loopbackだからAI入力のHMACを省略できるわけではない。
- CGIにはCF_ACCESS等を受理する実装があるが、今回確認した有効vhostにそのJWT検証連携は見当たらない。Cloudflare Access認証が現に有効だとは保証しない。
- 呼出し元を識別するviaやroute-idは秘密ではなく、HMACの代用にならない。Cloudflare管理APIの一覧取得権限も、この呼出し認証とは別である。

## 内部ApacheとSSI

`010-lib.conf` はDocumentRoot全体を拒否し、`/var/www/html/lib` にRequire localを設定する。SSIは `.shtml`・`.shtm` にINCLUDESを適用し、Includes/ExecCGIを許可する。`.cgi` はCGIとして扱う。IndexesとMultiViewsは無効、AllowOverride Noneである。

| 内部パス | 扱い |
|---|---|
| `/lib/date.shtml`・`/lib/ruby_-v.shtml`等 | ローカル到達でSSIを展開。各ファイルに独立したWorkerログイン確認があるわけではない |
| `/lib/api/tunnels`・`.rb` | ScriptAliasMatchで固定CGIへ。libの認証を別途適用 |
| `/lib/api/chat/ws` | loopback8091へWebSocket転送 |
| `/lib/api/chat/` | loopback8092へHTTP転送 |
| `/lib/conversation-embed.html`・`/lib/chat/`・`/lib/t/` | 8092の認証付きHTML/資産配信へ |
| `/lib/ops`・`test`・`keys`・先頭がドットのディレクトリ | 拒否 |
| ドットで始まるファイル、AGENTS/CLAUDE/README/REPORT/SPEC/SETTINGで始まるファイル | 拒否 |
| `.py` `.sh` `.md` `.json` `.lock` `.sqlite` `.env` | 拒否 |

この拒否表はすべてのソース拡張子を一律に拒否するものではない。たとえば `.rb` 全体を拒否する設定ではない。内部lib全体を、tree-viewの限定した中継の公開範囲と同じだとは扱わない。SSIのexecやCGIを許可するため、内部側の到達境界も設定の一部である。

ProxyPreserveHost Onは、libのセッション確認がHostからHTTPS originを導くために必要。Hostを書き換えると、認証後のsession/console-session確認が403になる場合がある。

## libの認証：閲覧と投稿は別

HTMLの入口は、適切なAcceptを持つ未認証要求へキー交換フォームを返す。これは会話本文や資産への無認証アクセス成功ではない。資産は観測セッション、または有効なticketを必要とする。ticketはメモリ上で120秒有効で、配信対象はconversation-embed.htmlとchat配下に限定される。

- 観測セッションはHMAC署名・origin・scope・有効期限を持ち、最長7日。投稿セッションは別scopeで、15分・1時間・8時間・1日・7日から選ぶ。
- Cookieは `__Host-conversation-observer` と `__Host-conversation-console`。Secure、HttpOnly、Path=/、SameSite=None、Partitionedを設定する。
- 投稿は投稿セッションの署名だけでなく、サーバーの稼働中セッション表にも登録が必要。観測許可だけでconsoleへ投稿できない。
- 観測セッションは署名検証型。Cookieを消すことと、発行済みBearerを全端末から即時失効させることは同じではない。投稿セッション・asset ticketのメモリ状態は配信プロセスの再起動で失われる。
- SSE/NDJSON/JSON-seqは正確な許可Originを要求し、実会話観測は有効な観測BearerまたはリクエストHMACを必要とする。demo専用操作は実会話・AI実行と区別する。
- WebSocketは許可Originと固定パスを確認し、nonce challengeへのHMAC、またはoriginに結びついた観測セッションを確認する。観測セッションではobserveだけを許可し、demo認証ではdemoだけを許可する。
- consoleは投稿セッションを検証してobserverへ入力する。accepted、キュー登録、モデル受信、回答、ブラウザ描画は別の到達点である。

## tree-viewの限定した中継

対象は既定mygwの会話画面。一般のSSIや任意のlibファイルをtree-viewから公開するものではない。

```
dynamicneko所有者ログイン → /libの限定した会話パス
 → MAIN_WORKER /api/tree-view/conversation-stream-external/lib/*
 → Worker署名・短寿命ユーザートークン・管理者本人確認
 → 起動中demoコンテナ → server.js → 内部8445
```

許可対象はconversation-embed.html、ticket付き同HTML、chat直下とvendor配下の限定したJS/CSS、chat APIのws/sse/ndjson/jsonseq/session/console-session/console/spec-eval。tunnels、ops、任意のファイル・転送先は許可しない。PWA用ログインも有効性を照合したうえで、この範囲だけを通す。

プラットフォームのCookieはlibへ渡さず、libの上記2Cookieと必要な認証・WebSocketヘッダだけを渡す。Worker間署名とユーザートークンもコンテナへは渡さない。libのcanonical pathを維持し、内部に渡すOriginはmygwへ合わせる。lib認証の代行・省略ではない。

成功したHTMLのnonce付きCSPを維持してX-Frame-OptionsをSAMEORIGINにする。これは埋め込み許可であり、認証許可ではない。SSEの本文は読み切らず転送し、WebSocketの101応答を作り直さない。停止中コンテナの自動起動は行わない。

## ファイル・ソケットの権限（実測）

| 対象 | 所有者・mode |
|---|---|
| `/etc/lib-hmac.env` | root:www-data 0640 |
| `/etc/lib-chat.env`・`lib-tunnels.env`・`lib-llm.json` | root:root 0600 |
| `/var/lib/lib-chat-observer/source.json` | root:root 0600 |
| `/run/lib-chat-app` / app-server.sockの実体 | root:root 0700 / 0600 |
| `/run/lib-chat-observer` / observer.sock | root:www-data 0750 / 0660 |
| `/run/lib-codex` / worker.sock | root:www-data 0750 / 0660 |

app-server.sockはroot専用の既存実体を指すリンク。公開配信はwww-dataで稼働し、observer/workerのUnixソケットとroot専用app-serverの権限を分ける。source.jsonが指定する会話は起動時の読み取り確認の対象であり、会話内容を本SPECへ保存しない。

## 設定の所有元と復元の境界

- 有効なApache設定が現在のHTTP制御の根拠。リポジトリのテンプレートは `/root/cf-container/ops/network/`。
- `/usr/local/share/lib-network/post_install.py` と `/etc/cron.d/lib-network` が現コンテナのサービス・秘密設定・observerの復帰入口。entrypointからも同じ入口を使う。
- 現ENVを保存値より優先する。起動済みプロセスへの変更は、そのプロセスへの反映・再起動を確認する必要がある。
- 現コンテナへ配置したApache設定・variant等が、コンテナ再作成後にすべて同じ状態へ戻ることは今回未検証。復帰スクリプトの存在だけではイメージへの反映を保証しない。
- 会話中継のWorker反映は本体 `fe1c9bd8-908e-4e86-a175-bc326789a6e0`、dynamicneko `7ee55793-dc75-41d4-a719-9c6fa4f3425a`。コンテナは更新せずWorkerだけ反映した履歴であり、今回のSPEC作成では再デプロイしていない。

## 今回の読み取り検証

`/root/network-validation/lib-access-snapshot.json` と `/root/boot.log` に10件のHTTP確認を記録した。すべて期待値と一致。今回のHTTP検査はloopback上の実vhostにHost=mygwを指定し、本文・資格情報を保存せず実施した。TLS検証を省略したのは自己署名の127.0.0.1:8443だけである。

| 検査パス | 公開側TLS8443 | 内部8445 |
|---|---|---|
| `/lib/date.shtml` | 403 | 200 |
| `/lib/conversation-embed.html`（未認証、Accept:text/html） | 403 | 200（認証入口） |
| `/lib/ops/chat_observer.py` | 403 | 403 |
| `/lib/.git/config` | 403 | 403 |
| `/lib/api/tunnels/extra` | 403 | 今回未検査 |
| `/lib/api/tunnels`（署名なし） | 403 | 今回未検査 |

署名付き公開CGI、不正署名拒否、実観測、投稿、Worker中継の認証・パス制限は同日の既存テストとNOTICEに結果があるが、今回の文書作成では推論・投稿・セッション発行を再実行していない。本番の利用者ログイン画面、Worker経由の実WebSocket101、全ポートの外部到達性、コンテナ再作成後の復元まで保証しない。

関連: [Muse経路SPEC](SPEC.cloudflare-workers-github-oauth-1.20261112.muse-request-routes.md)、[ワーカータブのNOTICE](NOTICE.cloudflare-workers-github-oauth-1.20261113.tree-view-worker-stream.md)。
