# 現コンテナのネットワーク配置・実検証（2026-11-09 UTC）

現ENVを優先してlibとcf-container/ops/networkを配置し、mygwでtunnels.rb・observer・WebSocket/SSE/NDJSON/JSON-seq・SSIを動作確認した。全トンネルの復旧は完了していない。streamのDNS、r9のバックエンド、Cloudflare API権限、Claude認証、MuseのLLM worker対応は未解消。Dockerビルド・Workerデプロイ・Git pushは実施していない。

## 適用した設定と復元境界

- /root/libを/var/www/html/libへ.gitを除外して配置。公開配信とLLM workerに必要なvenvを作成し、既存requirementsの固定版websockets 17.3 / aiohttp 3.14.5を導入した。実ブラウザ検証用にvenvへPlaywrightも導入した。
- 有効なApache設定/etc/apache2/sites-available/000-demo.confを.pre-network-20261109へ保存し、cf-containerのapache-8443.confを配置。SSI、Ruby CGI、CGI timeout、WS/HTTP配信プロキシと非公開パス拒否を有効化。配置コピーのRuby shebangを実在する/usr/local/bin/rubyへ合わせた。元のlibソースは変更していない。
- apache2ctl configtestは成功。apache2ctl startはchroot内のsystemctlで起動が無視されたため、envvarsを読み込んでapache2 -k startで実起動した。最初の直接起動スクリプトはset -uとenvvarsの未定義変数で停止し、修正後に起動した。
- /run/lib-chat-app/app-server.sockは親0700、ソケット実体0600。既存Codex 0.166.0のdaemonトランスポートへのsymlink。新規会話forkは行っていない。既存Codexと同じ配布元のcodex-code-mode-hostを/opt/codex-web/binへ配置した。
- 読み取りAPIで現在ENVのCODEX_THREAD_IDと今回の依頼本文を照合してから、/var/lib/lib-chat-observer/source.jsonをroot:root 0600、親0700で保存した。observerは/run/lib-chat-observer/observer.sock、LLM workerは/run/lib-codex/worker.sock。両方とも親root:www-data 0750、実体0660。
- 専用codex-webユーザーと非公開認証領域を作成し、既存Codex認証を0600で配置した。Claudeバイナリと既存helperも配置したが、Claudeの認証情報はない。bubblewrap隔離を維持した。
- 現ENVのHMACを/etc/lib-hmac.env（root:www-data 0640）、Cloudflare設定を/etc/lib-tunnels.env（root 0600）へ保存。配信はwww-data、127.0.0.1:8091/8092。実プロセスのHMAC一致とCloudflare/GitHub管理資格情報・MUSE_API_KEYの非継承を確認した。現ENVの拒否後に他トークンへ切り替えていない。
- 起動スクリプトとcronを配置し、cronを起動。現/usr/local/bin/entrypoint.shにはバックアップ後、最終exec前のstart-lib-network呼び出しを追加しbash -nを確認。次回起動・コンテナ再作成後の復元は未確認で、イメージへ反映した証拠ではない。

## 検証結果

根拠: artifacts/network-20261109/。秘密値・会話本文・セッショントークンは保存していない。

| 検証 | 結果と検証範囲 |
|---|---|
| runtime.log | 4テスト成功。ソケット権限、SSI展開、Ruby/子CGI、private path 403 |
| live.log | 公開mygwで署名付きSSE/NDJSON/JSON-seqの実会話受信とWS challenge認証・実会話受信。未署名AI入力拒否。API自体は200でもauth=error/error=no_api_token |
| prompt.log | codex_prompt=“…”を公開tunnels.rbへ実POSTし、doneと指定マーカーの実回答一致 |
| quoted-prompts.log | 引用符付きprompt解析17件79 assertions成功。全エンジンの実推論成功を意味しない |
| settings.log | ENV優先・資格情報非継承・失敗時キャッシュ保持等8テスト成功。隔離データによる検証 |
| refresh.log | 現ENVトークンで稼働トンネルが一覧に現れず、個別リソースも権限拒否。キャッシュ更新を拒否。取得できなかった一覧を成功扱いしていない |
| diagnostics.json | claude_prompt=“/status”は制御コマンドとしてdone。Claude推論認証なしのため推論POST未実施。muse_prompt=“…”はHTTP200でもfailed/unsupported_engine。Museの別経路へfallbackしていない |
| diagnostics.json | mygw/r8のSSI200、未署名API401。streamはDNS解決エラー。r9はSSI timeout/API502。Redmine用r9をlibへ転用していない |

cloudflaredは既存プロセスを維持。明示config指定のingress validate成功。sshd -t成功。TailscaleはRunning、peer7件。外部SSHログイン・全peerの疎通は未確認。

## ストリームパネル実投稿

Chrome実ブラウザから公開mygwの認証フォームに既存HMACを入力し、ライブ配信画面のconsoleフォームから1件送信した。TLS証明書検証は有効。配信ページや認証処理を改変せず、親iframeの操作通知だけを同一originのテスト用HTMLから送った。本体Workerのログイン済み親画面そのものの操作検証ではない。

panel.log / panel.json: HTTP200、accepted=true、queued=true。queue.json: 現ENVと同一会話のnative queueに一致する投稿がちょうど1件、observerの対象変更なし。画面表示は「次のターン待ちとして保存しました。まだAIには渡っていません」。受付・キュー保存は確認したが、このREPORT作成時点で既存writerによる受信・assistant実回答は未確認。マーカーはSTREAM_POST_OK_20261109。受付を実回答成功とは扱わない。

## セキュリティ更新

apt-update.log: Ubuntu resolute / resolute-security / resolute-updates / resolute-backportsおよびChromeの索引更新成功。upgrade.log: apt-get -s upgradeは0 upgraded / 0 newly installed / 0 to remove / 0 not upgraded。現在のAPT索引上の更新候補は0件。python3-venvも既に最新版でOSパッケージ更新は行われていない。これは全ソフトウェアの脆弱性不存在やnpm/Python依存の完全な脆弱性監査を保証しない。

既存originの自己署名TLS/noTLSVerify設定は維持。ローカルSSIテストだけは自己署名origin向けの検証無効化を使用し、公開API・公開Chromeは通常のTLS検証を使用した。

## ファイアウォール最終採取

本REPORTとDEPLOYMENT-STATEの記録後、既存collectorの/tmp/firewall.log、firewall-collector.log、nftables.logとnft rulesetをartifacts/network-20261109へ採取する。採取日時・ハッシュはfirewall-manifest.jsonに記録。既存モードはcounters-onlyで、ログはDROP_COUNTERの遮断カウンター増分。パケット単位のカーネル本文ログではない。ファイアウォールのルール変更は行っていない。

## 後続ターン: パネル投稿の実受信

2026-11-09 UTC、既存writerの同一会話でパネルから投入した投稿を実受信し、assistantが `STREAM_POST_OK_20261109` と返答した。キュー受付だけだった状態から、writer受信・assistant返答まで確認済みに更新する。この返答が公開observerやブラウザ画面に表示されたことは別途未確認。本体Workerの親画面操作も未確認のまま。残るCloudflare権限・stream DNS・r9・Claude認証・Muse対応の制約は変わらない。記録後にファイアウォールログを再採取した。

## 再開後の再調査（2026-11-09 18:31–18:35 UTC）

根拠は `artifacts/network-resume-20261109/`。ネットワーク修復は未完了。設定変更・サービス切替・追加配備・push・Dockerビルドは行っていない。

- `direct-public.json`: aiohttpの直接接続でmygw/r8はSSI展開済み200、未署名API401。streamは引き続きDNS解決失敗。r9は今回の最終採取では/lib/date.shtmlが404、未署名API401。途中にはタイムアウトもあった。以前の502から変化したが、Redmine復旧の根拠ではない。
- `current.json`: urllibの既定経路ではmygw/r8/r9に403を記録した。直接接続とcurlではmygw200を確認したため、この403を公開サービス障害と断定しない。Redmineの/opt/redmine・/opt/redmine-bundle・/var/lib/postgresqlは存在しない。旧DBの所在と復元元は未確認で、新規DBを作成して復旧扱いにはしていない。
- `refresh.log`: 現ENV優先の既存更新スクリプトは、稼働中トンネルが一覧に含まれず個別APIも権限拒否として終了1。別トークンへの切り替えなし。キャッシュ更新成功とは扱わない。DNS変更に必要な権限・正しいレコードは未確認。
- `/root/lib/claude/ops/llm_worker_claude.py`に既存のMuse対応を発見。現在の/usr/local/libexec/start-lib-llm-workerは非対応のops/llm_worker.pyを起動している。`muse-unit.log`は既存9テスト成功（模擬tailscale nc、HTTP失敗、ジョブ保存・照会）。本番推論成功の証拠ではない。
- `muse-health-http.json`: 既存対応workerのTailnetConnectionを使い、tailscale nc → muse-vm:8080のGET /healthでHTTP200と応答本文を確認。先行のstdinパイプ方式はHTTP応答を取得できず、接続成功の根拠にしていない。health成功は認証付き推論成功とは区別する。
- MUSE_API_KEYは現ENVに無く、専用Claude認証も不在。Museキーの非公開入力を要求したが時間切れ。サービス切替・推論POSTは未実施。キーが用意できれば既存Muse対応workerの復元を進められるが、起動経路・cron・資格情報非継承と既存Codex/Claude経路の回帰確認も必要。
- `runtime.log`: ソケット権限・非公開パス拒否・Ruby/子CGI・SSIの4テスト成功。全体テストは実行していない。

## Muse対応workerの復元と実推論（2026-11-09 UTC）

ユーザーから非公開入力でMuseキーを受領。最初の値は空白を含み、Muse側で認証拒否となった。再入力後の値で公開APIから実推論成功。秘密値・入力ファイルの場所は本記録に含めない。

- `/usr/local/libexec/start-lib-llm-worker`をバックアップし、既存`/var/www/html/lib/claude/ops/llm_worker_claude.py`へ起動先を変更。キーはroot専用`/etc/lib-muse-api-key`（0600）から読み、CLI引数には渡さない。既存workerはキーを環境から取り除き、CLI子プロセスは既存の限定ENVで起動する。公開配信サービスへのキー追加なし。
- 切替前に保存済みpending/runningジョブ0件を確認。既存ジョブストアとソケットを維持してworkerのみ再起動。既存cronとstart-lib-networkは同じsupervisorを参照することを確認。現コンテナのプロセス再起動には適用されるが、コンテナ再作成後の永続復元・イメージ反映は未確認。
- 切替前の関連workerテスト14件成功。切替後のruntimeテスト4件成功（権限、非公開パス拒否、Ruby/子CGI、SSI）。Codex/Claudeの切替後実推論と全配信方式の推論は未検証。専用Claude認証は引き続き不在。
- `muse-public-final.json`: 公開mygwの`/lib/api/tunnels.rb`へ署名付き`muse_prompt`をPOSTし、ask_idを照会。HTTP200、ask_status=done、via=muse、指定返答の完全一致を確認。経路は本API → LLM worker → tailscale nc → muse-vm。/askmuseの本体コンテナ経路は変更・検証していない。
- 現ENVのHMACは不在だったため、初回の公開確認は401。既存`/etc/lib-hmac.env`の署名設定を読み取って再確認し、サーバー設定は変更していない。`public-signed-status.json`のerror=no_api_tokenはCloudflare一覧資格情報についての未解決事項で、Museの実回答成功とは別。
- 初回の再起動用補助スクリプトは非ASCII bytes literalの構文エラーで実行前に停止し、修正してから切替を実施した。初回認証拒否などの記録はmuse-live.jsonに残し、最終成功とは区別する。

Cloudflare権限、stream DNS、r9のRedmine配置・DB復元、Claude認証は未解決。Dockerビルド・本体Worker配備・Git pushなし。
