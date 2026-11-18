# 現コンテナのネットワーク設定（2026-11-08 UTC）

現在ENVを優先して /root/lib と /root/cf-container/ops/network を現コンテナへ配置した。全トンネルの完了ではない。Dockerビルド・Workerデプロイ・Git push・パッケージ更新は実施していない。

## 適用内容

Apacheの有効な000-demo.confをバックアップして置換し、configtest成功後にapache2ctlで起動。lib Alias、SSI、CGI、公開WS/HTTP配信、非公開パス拒否を適用した。配置されたRuby CGIのshebangを実在する/usr/local/bin/rubyへ変更。元の/root/libのソースは変更していない。

App Server /run/lib-chat-app/app-server.sock、observer /run/lib-chat-observer/observer.sock、LLM /run/lib-codex/worker.sockを配置。親権限はそれぞれ0700/0750/0750、実体0600/0660/0660。App Serverのソケットはroot専用実体へのsymlink。read APIで現在ENVのCODEX_THREAD_IDと今回の依頼本文を照合してから、0700ディレクトリに0600のsource.jsonを保存。新規forkなし。

既存Codexバイナリと既存認証を専用codex-webユーザーの非公開領域へ配置。Claudeバイナリとhelperも配置したが、Claude認証はない。配信はwww-data、127.0.0.1:8091/8092。実プロセスのHMACが現在ENVと一致し、Cloudflare/GitHub管理トークンとMUSE_API_KEYが継承されていないことを確認した。

現在ENVのHMACをCGI用の保護ファイルへ保存し、Tunnel用ENVはroot専用0600へ保存。明示ENVの資格情報が失敗しても他トークンへ切り替えない。現entrypointへ復帰呼び出し、cronへ既存復帰設定を配置。コンテナ再作成後の復元・次回起動は未確認。service apache2 startはchrootでsystemctlに無視されたためapache2ctlで起動した。

## 検証

根拠は artifacts/network-20261108-current/。

- runtime.log: SSI展開、Ruby/子CGI、private path拒否、限定ソケット権限の4テスト成功。
- live.log: 公開mygwのHMAC認証SSE/NDJSON/JSON-seqとWebSocket challenge認証で現在会話受信。未署名AI入力拒否。APIはHTTP200でもauth=error/error=no_api_token。
- prompt.log: codex_prompt=“…”を公開tunnels.rbへ送り、doneと指定文字列の実回答一致。
- quoted-prompts.log: 引用符付きprompt解析17件79 assertions成功。ruby.log: Claude関連6件20 assertions成功。これらはClaude実回答の証拠ではない。
- settings.log: ENV優先、資格情報非継承、失敗時キャッシュ保持など8テスト成功。
- refresh.log: 現ENV資格情報ではactive tunnel一覧/リソースへの権限不足。旧キャッシュを成功扱いで置換していない。
- muse.json: muse_prompt=“…”はHTTP200だがask_status=failed/unsupported_engine。Museの別経路へ代替送信していない。
- Claude認証判定False。SETTINGの認証前提に従いClaudeの推論POSTは未実施。
- other-hosts.json: UAを指定した再検査でmygw/r8のSSI200、未署名API401。streamはAPI/SSI530。r9はAPI502/SSI500。r9は既存Redmine用途を維持。
- cloudflaredの明示config指定によるingress validate成功、sshd -t成功、Tailscale Running・peer6件。外部SSHログインは未実施。

## ストリームパネル投稿の未完了

Chrome実ブラウザで公開conversation-embedを3回試したが、フォームに到達できず投稿未実施。初回はChromeのSSLエラーも観測。証明書検証を無効化した試行でもフォームに到達せず、最後はタイトル「認証」のページだった。公開ブラウザ投稿の成功とは報告しない。フォーム内部を改変したり認証を迂回した投稿は行っていない。本体Worker親画面も未検証。

AGENTS.mdの3失敗時停止指定により追加修正・検証を停止し、Opus 5.5以上への切り替えを依頼。依存を導入しただけで復旧済みと扱わない。検証コードは/tmpの一時ファイルで、リポジトリへ追加していない。

## セキュリティ更新

apt-get update成功。apt-get -s upgradeは0 upgraded / 0 newly installed / 0 to remove / 0 not upgraded（apt-update.log、upgrade.log）。現在索引上の更新候補は0件であり、脆弱性がない保証ではない。アップグレードは未実施。既存originの自己署名TLS/noTLSVerifyは維持。公開APIのaiohttp通信は通常の証明書検証で実施した。

## ファイアウォール

最終採取は本REPORT記録後に実行。firewall.log、firewall-collector.log、nft-ruleset.txt、firewall-manifest.jsonを参照。カウンター方式の記録で、パケット単位のカーネル本文ログではない。ルール変更なし。
