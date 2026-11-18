# ネットワーク再配置・検証（2026-11-04 UTC）

## 適用範囲

現在のコンテナへ `/root/lib` と `/root/cf-container/ops/network` を配置した。Workerのデプロイ、Dockerビルド、イメージ更新は行っていない。既存ENVのHMAC・Cloudflareアカウント・トークン・CODEX_THREAD_IDを優先した。秘密値は本REPORTへ記録しない。

- `/var/www/html/lib` にlibを配置。既存専用起動スクリプトとcronを配置し、現entrypointの最終exec前にstart-lib-networkを追加。イメージ再作成への永続化は未実施。
- WebSocketは127.0.0.1:8091、SSE/NDJSON/JSON-seqは127.0.0.1:8092。www-dataで配信し、管理API・GitHubトークンを継承しない。
- 許可Originはmygw.nekomaneki.work、r8.nekomaneki.work、stream.test.cfc.nekomaneki.workのHTTPS。現在ENVに指定があれば保存設定より優先する。
- `/run/lib-chat-app/app-server.sock` はroot専用0700ディレクトリ内（検証時ソケット0600）。現在ENVの会話IDと今回の依頼本文をthread/readで照合してから、root専用0600の `/var/lib/lib-chat-observer/source.json` を作成した。
- `/run/lib-chat-observer/observer.sock` と `/run/lib-codex/worker.sock` はroot:www-data 0660、親は0750。observerは固定した現在会話を配信する。
- 専用codex-webユーザーを作成し、既存Codex認証を非公開領域へ配置。CLIは既存bubblewrapの読み取り専用マウントと専用ユーザーで動かす。現在のroot環境とLLM実行ユーザーの資格情報は別の保存先になる。
- 有効なApacheの000-demo.confへAPI/配信経路とSSIを適用。SSIはIncludesとINCLUDESフィルター、Ruby/CGIを有効化。既存VMのRuby絶対パスは配置先で実在する `/usr/local/bin/ruby` に調整した。
- tunnels-filter.rbはHMAC環境を読み込むCGIラッパーを追加。libの通常HTTP公開を全体設定で拒否し、8443の明示経路で公開。ops/test/keys（子ディレクトリ内も含む）、ドットファイル、ソース・運用ファイル、admin/debugは拒否。
- 旧Apache設定は `/etc/apache2/sites-available/000-demo.conf.pre-lib-network`。設定と秘密ファイルはコンテナ内。Gitに資格情報・会話本文を保存しない。

## 実測

- Apache configtest: Syntax OK。graceful適用済み。既存起動スクリプト再実行で稼働サービスを維持。
- mygwの署名付き `message: codex_prompt="/status"` と `claude_prompt="/status"` は200、ask_status=doneとreplyを確認。Claudeの/statusはCLI設定取得であり、モデル認証・実生成の証拠ではない。
- `codex_prompt="NETWORK_OK とだけ返答してください"` は公開API経由でask_status=done、reply=NETWORK_OK。quoted promptから実モデル応答まで確認した。
- 未署名のAI要求は403。HTTP 200だけでトンネル一覧取得成功とは扱わない。
- mygwのWebSocketはchallenge署名認証後にconversationを受信。SSE・NDJSON・JSON-seqも200に加え、実際のconversationスナップショット受信を確認。consoleへの入力は現在の作業会話へ別ターンを起こすため実施していない。
- SSIのdate.shtmlは展開済み200。api/tunnels.shtmlの子CGI展開を確認（SSIエラーなし）。ruby_-v.shtmlは実際のRuby 4.0.9を表示。未署名の公開SSIは子APIの認証条件を引き継ぐため、トンネル一覧表示を保証しない。
- HTTP80のlib/ops、TLSの.git/config・ops・adminは403。
- cloudflared ingress validateはOK、readyConnections=3。TailscaleはRunning、peer 1件。SSHの設定と既存Tunnelは維持したが、外部SSH接続は未検証。
- cf-containerネットワーク回帰8件、SSI回帰1件、libのchat Python43件、LLM worker21件、Ruby prompt16件/69assertionsが成功。SSI回帰は旧設定で失敗を確認後に設定を修正した。実ブラウザ・全リポジトリテストは未実施。

## 完了できない外部条件

現在ENVのCF_CONTAINER_API_TOKENで一覧更新を実行したが、稼働中Tunnelが一覧に現れず、対象Tunnel読み取りもAPIに拒否された（tunnel_api_not_authorized）。別の資格情報へ切り替えず、不完全キャッシュの保存を拒否した。今回のコンテナには旧キャッシュがないため、公開APIの一覧部分はtunnels=[]、auth=error、no_api_tokenになる。LLM・observerの成功とは別件。Tunnel読み取り権限を持つ現在ENVが必要。

他ホストの確認: r8.nekomaneki.workの署名付きAPIは200だが一覧取得成功は未確認。stream.test.cfc.nekomaneki.workは初回530、Redmine専用r9.nekomaneki.workは初回502。最終再確認では両者のAPIが200/auth=oauthを返したが、date.shtmlはRedmineの404ページとなった。streamのlib配信・observer経路は復旧済みと扱わない。r8は200/auth=error/no_api_tokenで、date.shtmlは展開済み200だった。現在のトークン権限では外部Tunnel設定の読み取りも拒否されるため、全Tunnelの復旧完了とは扱わない。r9をlibへ転用していない。Cloudflare 1010がPython標準User-Agentで出たため、検証ツールに固有User-Agentを付けて再確認した。

既存のoriginは自己署名証明書とnoTLSVerifyを使用し、ローカルTLS検証は検証時に無効化した。公開HTTPSとorigin証明書検証を同一視しない。コンテナ再作成後の復元は未検証。

## セキュリティ更新候補

Ubuntu 26.04.1 LTS。apt-get update後のインストール済み/候補を比較。今回の依頼は更新結果のREPORT記録であり、パッケージアップグレードは実行していない。

| パッケージ | 現在 | セキュリティ更新候補 |
| --- | --- | --- |
| bind9-dnsutils / bind9-host / bind9-libs | 1:9.20.24-1ubuntu0.4 | 1:9.20.24-1ubuntu0.5 |
| libpcre2-8-0 | 10.46-1build1 | 10.46-1ubuntu0.1 |

Ubuntu公式 [USN-8969-1](https://ubuntu.com/security/notices/USN-8969-1) と [USN-8974-1](https://ubuntu.com/security/notices/USN-8974-1) の修正版とaptの候補が一致する。PCRE2にはメモリ破損・コード実行等の修正を含む。Apache 2.4.66-2ubuntu2.6、OpenSSH 1:10.2p1-2ubuntu3.8、OpenSSL 3.5.5-1ubuntu3.7には今回のapt一覧で更新候補なし。更新候補なしは脆弱性なしの保証ではない。

## ファイアウォール

検証終了後の `/tmp/firewall.log` のスナップショットとnft rulesetを本REPORTと同じディレクトリの `artifacts/network-20261104/` へ取得。既存のfirewall-log.py収集プロセスがDROP_COUNTERの時刻・増分・累計を継続記録している。カーネルのパケット本文ログとは異なる。
