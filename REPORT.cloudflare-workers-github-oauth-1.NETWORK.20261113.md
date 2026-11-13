# 現コンテナのネットワーク設定・検証（2026-11-13 UTC）

現在ENVを優先し、現コンテナのlib/CGI/SSI、固定会話observer、LLM、WebSocket/SSE/NDJSON/JSON-seqを配置して実通信を検証した。全トンネルの完了ではない。現在トークンのCloudflareリソース権限不足、streamホスト530、r9障害、本体管理画面の未検証が残る。Dockerビルド・Workerデプロイ・git push・パッケージアップグレードは行っていない。

## 設定と権限

/root/lib、/root/cf-container/ops/network、本体containers/demo/lib-network/post_install.pyを参照。現在ENVのHMAC、CODEX_THREAD_ID、Cloudflare設定を保存値より優先して保護ファイルへ保存。他プロセスの別トークンへの切替はしていない。現在会話IDと今回のユーザー発言をapp-serverのread APIで照合してからobserver sourceを作成した。新規forkなし。

| 対象 | 配置・検証 |
|---|---|
| App Server | /run/lib-chat-app/app-server.sock。親root:root 0700、実体root 0600。既存root専用ソケットへのsymlink |
| observer | /run/lib-chat-observer/observer.sock。親root:www-data 0750、実体0660。sourceは/var/lib/lib-chat-observer/source.json、root:root 0600 |
| LLM | /run/lib-codex/worker.sock。親root:www-data 0750、実体0660。Codex/Claudeはbubblewrap内のcodex-webで実行 |
| 公開配信プロセス | www-data、127.0.0.1:8091/8092。実プロセスのHMACが現在ENVと一致。Cloudflare/GitHub管理トークンとMUSE_API_KEY非継承を確認 |
| Muse | 既存lib/claude/ops/llm_worker_claude.pyを適用。tailscale ncによる独立経路。現在ENVのキーはroot専用/etc/lib-llm.json（0600）へ保存し、公開配信やCodex/Claudeの子へ渡さない |
| Claude | 既存専用ユーザーの認証を保持。隔離環境のauth status終了0を確認してから実promptを送信 |

外部8443の/lib拒否は2026-11-11の管理者限定設定を維持した。内部127.0.0.1:8445のSSI VirtualHostへtunnels.rb CGI、8091/8092への配信中継と非公開パス拒否を追加。Apache configtest、graceful成功。秘密値・会話本文はREPORTへ記載しない。

## 修正と復帰

ブラウザ試験で、内部ApacheがHostを置き換えるため、同一originのGET session/console-sessionが403になることを確認。ProxyPreserveHost Onを追加し、失敗する回帰テストを先に確認した後に修正、実Chromeで再検証した。cf-container/ops/network/apache-lib-internal.confとops/test/network_internal_proxy_test.pyに保存。

同梱post_installのリンク作成は今回のvenv配置と一致せず失敗したため、既存venvと同一インストール元の配置済みCLIを利用。再適用時の起動済みCLIへの上書きText file busyも、既存バイナリを保持して解消。初回は停止規定で停止したが、ユーザーの「停止しなくていいからそのまま続けて」で再開した。

Muse対応は既存variantを使用し、LLMジョブが実行中でないことを確認して元workerから切替。cf-containerのllm-worker-variant-command、start-lib-llm-worker-variantとREADMEに配置方法を記録。starterは現在ENVのMuse設定を保存値より優先する。起動済みworkerへの資格情報変更は再起動後に有効。

現entrypointとcronは/usr/local/share/lib-network/post_install.pyに統一し、競合する従来Claude restore起動を置き換えた。旧entrypointとApache設定は/var/lib/lib-networkに保存。復帰処理の再実行は配信ready、observer configured、tunnel refresh_failed。停止中サービスの再起動・コンテナ再作成からの復元は未検証。現ファイルシステムへの適用であり、イメージに含まれたという意味ではない。

## 検証結果

根拠: artifacts/network-20261113/。内部経路へのテストは本体Worker経由・公開経路成功の証拠に代用しない。

- runtime.log: 設置済みソケット権限、date SSI展開、Ruby/子CGI SSI、非公開パス拒否の4テスト成功。内部8445用に検査先を変更し、外部の/adminとは分離した。
- live-final.log: 認証付きSSE/NDJSON/JSON-seqとchallenge認証WebSocketから現在会話の実イベント受信。未署名AI入力は拒否。
- quoted-prompts.log: codex_prompt=“…”、claude_prompt=“…”、muse_prompt=“…”はいずれもask_status=done、指定文字列の実回答と完全一致。各1回POST後は同じask_idをGETで追跡。経路の自動切替・再送なし。Nemotronはunsupported_engineでfailed。prompt成功時にも別の一覧取得エラーno_api_tokenが同居しており、一覧成功を意味しない。
- prompt-parser.log: 引用符付きprompt解析17テスト79 assertions成功。settings.log: ENV優先と不完全一覧時のキャッシュ保護など9テスト成功。ssi-contract.log: 既存SSI構成契約1テスト成功。worker-variants.log: 既存Claude/Muse variantの19テスト成功。internal-proxy-before/after.log: Host継承の回帰テストが修正前失敗、修正後成功。
- final-contracts.log: 全体検査初回は旧runtime testが外部8443のSSI許可を前提として3 errors。既存の管理者限定構成に合わせてruntime testの検査先を内部8445へ修正し、/admin拒否は引き続き外部8443で検査する。最終結果はfinal-contracts-fixed.log: 15テスト成功。
- ingress.log: cloudflaredの明示configでingress validate成功。sshd.log: sshd -t成功。tailscale.json: Running、peer5件。外部SSHログインは未実施。

## ストリームパネル投稿

browser-post-fixed.log: 実ChromeでHMAC認証フォームからログインし、現在会話表示と送信フォームを確認、フォームから1件だけ投稿。HTTP200 accepted=true queued=true、現在ENVの同一threadのnative queueに一致する入力が正確に1件あることをread APIで照合。会話のforkやwriter lock解除なし。送信許可は試験後に解除した。

試験はローカルTLS転送とChromeのホスト解決で、mygw originの要求を内部8445へ接続し、親ページfixtureが通常のpostMessageでパネルを制御する方法。HMAC認証・セッション・実配信・投稿APIは実装そのものを使用し、応答をmockしていない。外部8443の/lib拒否設定は変更していない。本体Workerのログイン済み実画面経由・公開パネル経由の成功とは扱わない。

投稿は現writerが使用する会話の次ターン待ちであり、acceptedだけでAIの受信・回答成功とは扱わない。STREAM_POST_OK_20261113のassistant実回答は現時点で未確認。再送はしていない。

## 外部トンネルの残件

refresh.log: 現ENVトークンではactive tunnelが一覧に現れず、そのリソースへのアクセスも拒否される。失敗でキャッシュを成功扱いに置換しない。tunnels.rb一覧はauth=error/error=no_api_token。ここでの管理APIトークンをwww-dataへ渡して解消したことにはしていない。必要なのは現在のトークンに対象アカウント/トンネルの一覧・読み取り権限を与えること。

public-boundaries.json: mygw/r8は/libのSSI/APIとも403（既存管理者限定境界）。stream.test.cfcは530、r9はSSIタイムアウト/API502。r9は既存Redmine用途を変更していない。現在資格情報では外部リソースの修正権限を確認できず、DNSやトンネル割当を推測で変更していない。本体Workerの認証済み管理画面からの終端検証は未実施。

## セキュリティ更新候補

apt-get update成功。apt-get -s upgradeではgoogle-chrome-stableのみ1件: 157.0.8103.38-1 → 157.0.8103.78-1、他の更新候補0件（apt-update.log、apt-upgrade-simulation.log）。更新自体は実施していない。

Google公式の2026-11-11安定版告知でもLinux 157.0.8103.78を確認。取得時点の本文はSecurity changes will be updated shortlyのため、個別CVE・修正件数は断定しない。出典: https://chromereleases.googleblog.com/2026/11/stable-channel-update-for-desktop_01744469280.html 。更新候補が他にないことは、脆弱性がない保証ではない。

既存originの自己署名TLS/noTLSVerifyは維持。内部ブラウザ試験だけ自己署名証明書を許容し、外部ホストの検査は通常の証明書検証で行った。

## 最終ファイアウォール採取

全検査とREPORT更新の後にartifacts/network-20261113へfirewall.log、firewall-collector.log、nftables.log、nft-ruleset.txt、firewall-manifest.jsonを再採取した。既存modeはcounters-onlyであり、パケット本文のカーネルログではない。ルールは変更していない。接続情報を含み得るログは0600で保存し、manifestにUTC時刻とSHA256を記録する。

## 後続ターン: パネル投稿の実受信

同一会話のnative queueに登録したテスト入力を本エージェントがユーザー発言として実受信し、STREAM_POST_OK_20261113を返答した。続く読み取り確認で一致する待機queueは0件、observerの現在会話イベントに該当user投稿あり。根拠: panel-received-status.json。投稿受付のみという状態から、モデルへの入力到達確認済みに更新する。assistant回答が利用者のブラウザへ描画されたことは未確認。トンネル権限・外部経路の残件は変わらない。追記と読み取り確認の後にファイアウォールを再採取した。

## 後続修正: AIチャットの /neko askgk HTTP403

ユーザーが本体AIチャットの入力窓で/neko askgkを送った結果、tunnels.rbへのHTTP403となることを報告。直前の設定を再確認し、前段の公開8443の/lib一括拒否が本体の署名付き機械間API /lib/api/tunnels まで拒否していたと確認した。前回の内部8445検証ではこの経路を確認できておらず、設定が不足していた。

拒否を再現するテストを先に実行後、Apacheの完全一致2パス（/lib/api/tunnels と /lib/api/tunnels.rb）だけを既存HMAC認証CGIへ接続した。署名ヘッダなしは403、不正署名はCGIで401、正しい署名は実処理へ到達する。その他の/libとSSIの外部拒否は維持。/lib/api/tunnels/extraなどの類似パスも403。

公開APIは既存lib/claude/api/tunnels.claude.rbを利用し、明示されたCodex/Claude/Muse prefixと、prefixなしの既定Claudeを維持。現在HMAC ENVを保存値より優先し、別トークンへ切替なし。CFトンネル一覧の権限不足とは別件であり、一覧権限を変更したわけではない。

askgk-access-before.logで修正前の署名付き要求403を再現。askgk-access-after.logはCGIへの到達後、テスト側がuptimeではなくuptime_secondsという実フィールドを参照すべき不整合で失敗した。フィールド名を訂正し、askgk-access-final.logの3テスト成功。既存を含むaskgk-all-tests.logは18テスト成功。Apache configtest/graceful成功。

askgk-public-fixed.log: DNS/TLSを通常どおり検証する実公開 https://mygw.nekomaneki.work/lib/api/tunnels で、未署名403、署名付き稼働時間照会200を確認。本体と同じwait_seconds=0のPOST登録・同じask_idへのPOST照会によりCodex/Museの両方でHTTP200/ask_status=done/固有実回答の完全一致を確認。各エンジン1回登録、失敗した要求の自動再送なし。最初のaskgk-public.logは拒否応答HTMLをJSONとして読もうとした試験側の失敗であり、その時点で推論投稿は行っていない。

本体のログイン済みAIチャット画面からのクリック操作はこの後続試験では未実施。本体→rust-worker service bindingそのものを通した確認ではないため、公開URL実応答との検証範囲を区別する。本体Workerの変更・再デプロイ・コンテナビルドなし。修正と検査後にファイアウォールログを再採取。
