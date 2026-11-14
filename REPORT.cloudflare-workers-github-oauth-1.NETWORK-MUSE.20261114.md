# ネットワーク復元とMuse直通経路の検証（2026-11-14 UTC）

## 現在の適用範囲

現コンテナのSSI/CGI、tunnels API、observer、WebSocket/SSE/NDJSON/JSON-seq、LLMソケットを復元した。現在ENVを保存値より優先し、設定変更前の受け入れテストと変更後の実通信を /root/boot.log に追記した。秘密の設定と資格情報はリポジトリに含めない。バックアップは /var/lib/lib-network/pre-network-validation/ と既存config-history。

本体WorkerとdynamicnekoのMuse修正はソースに反映済み、本番には未反映。今回の本番観測は読み取りだけ。Dockerビルド、コンテナの停止、Worker公開、Git pushは行っていない。

## 本番コードから確認した原因

Cloudflare APIから現在配備中の両Workerとsource mapを取得し、以下を確認した（本番経路原因照合）。

1. dynamicnekoのMuseタブとserver.tsの未指定時経路がcontainer。本体のtreeViewMuseChatにもコンテナを取得し、requireMuseTailscaleを呼ぶ分岐が存在する。報告された「Tailscaleのmuse-vmへの接続を確認してください」はその分岐にある。利用者の想定と配備コードの経路が食い違っていた。
2. dynamicnekoの接続確認は20秒で打ち切る。本体側はノード準備20秒とhealth通信8秒を待つ。外側が内側より先に打ち切り得る。投稿の外側310秒も内側600秒より短い。
3. 本体のMuse Worker応答で401/403/429/504以外を一律muse_connection_failedにするため、Museの500/503までTailscale接続障害に見せる。認証・上限・応答形式異常でも接続表示を解除する。

今回報告された単一の直通失敗の上流HTTPステータスは未取得。90秒の本番tailでは対象イベントが得られず、その1件の原因をTailscale切断と断定していない。native TailscaleのRunningもWorker内WASMの稼働証明として使っていない。

## 修正した仕様

- Museタブは dynamicneko → 本体Worker → TAILSCALE_WASM → muse-vm:8080 のみ。UIから経路切替を取り除き、古いcontainer Cookieを使わない。両サーバーはcontainer指定を400で拒否し、未指定はworkerとする。本体の当該ルートからgetContainer依存そのものを削除した。
- 署名、本人・所有者確認、鍵の明示継承、会話順序とサイズ検証、no-storeは維持する。本文はmodel/messagesだけ。チャット送信は1回で、別経路へ自動再送しない。
- Worker送信は必要なTAILSCALE_WASMとMUSE_API_KEYだけを参照し、固定600秒の直通で無関係なaskgk用DB設定を読まない。healthにも現在の鍵を明示する。
- health外側は本体32秒、dynamicneko40秒。投稿外側はdynamicneko610秒、Worker600秒。タイムアウトを無期限にはしない。
- Tailscaleのstatus解析を共通化し、nameとdnsNameを独立照合。不正JSON、null、不正peersで例外を外へ出さない。Runningかつmuse-vm onlineの条件は維持し、条件を満たさない投稿を許可しない。
- 既知の未接続、WASM起動失敗、Muse認証・利用上限・実行失敗、配達結果不明を区別。HTTP200の不正本文も接続済みの応答異常として扱う。配達結果不明ではtunnelsへのfallbackを許可しない。既存AIチャットの明示的な安全なfallback設定は維持。

## テスト結果

| 作業 | 今回の結果 |
|---|---|
| 設定前受け入れ | 3件実行で設定・ソケット・SSIの不足を検出 |
| 設定後受け入れ | 3件成功、現在HMACと会話IDを照合 |
| ENV優先・旧キャッシュ保持・公開プロセスへのENV制限 | 9件成功 |
| ソケット権限・SSI・Ruby/子CGI・非公開境界 | 4件成功、最終確認も成功 |
| 署名APIの公開側VirtualHost、不正署名、他lib拒否 | 3件成功 |
| 配信実通信 | WSのchallenge認証、SSE/NDJSON/JSON-seqの現在会話イベント受信成功 |
| prompt解析 | 17件79 assertions成功 |
| codex_prompt | 内部と実公開URLでdone、実回答の識別子完全一致 |
| muse_prompt | トンネル経路でdone、実回答完全一致。直通の証拠とは分ける |
| claude_prompt / nemotron_prompt | Claude専用ユーザー未認証で推論未実施、Nemotronはunsupported_engine |
| パネル投稿 | 実Chromeの認証・会話描画・投稿が成功、現在会話queueに正確に1件。受付後に投稿許可を解除。モデル消費・回答描画は未確認 |
| 起動復元 | 先行失敗後にentrypoint/cronを既存post_installへ統一、回帰1件とbash構文成功。実再起動は未実施 |
| CGIのENV継承 | 先行失敗後に保存設定の読込と現在ENV優先を修正、両CGIの4条件成功。cf-containerと本体bundleに保存 |
| Muse関連単体・ルート | 最終7ファイル63件成功、WASM診断・鍵記録11件成功（本体）。停止中コンテナ参照を例外にしたfixtureを含む |
| dynamicneko入口 | 7件成功。旧Cookie、省略時、container指定拒否を検証 |
| dynamicneko既存署名・認可回帰 | 所有者、Origin、署名、鍵継承、会話上限、応答検査、no-store成功 |
| Museタブ実Chrome | 古いcontainer Cookie、本体配信503で投稿・回答描画成功。送信はworkerだけで1件。API応答はfixture |
| 実Museへの両中継経路 | 両ソースの中継を公開SDK1.104.1-13と実workerd DOへ接続。health成功、/pingの実回答HTTP200、posts=1、containerReads=0。DEMO_CONTAINER bindingなし。保存したopt-in実通信テスト1件も成功。本人認証は隔離fixtureで、本番ログイン済み画面・service bindingの検証ではない |
| cloudflared / sshd / native Tailscale | ingress validateとsshd -t成功。native BackendState=Running。外部SSHログインやWorker内ノードの常時稼働を保証しない |
| トンネル一覧更新 | 現在トークンにactive tunnelが見えず対象APIも拒否。失敗した一覧でキャッシュを置換せずdegradedを維持 |

先行失敗、依存不足、試験ハーネスの失敗もboot.logに保持する。最初の両中継試験はNode RequestをMiniflareへ直接渡すハーネスでhealthに失敗し、URL・method・headersを明示して渡す形へ修正して成功した。製品コードの障害とは区別する。Vitestは既存グローバル5.0.5を使用し、lockfileの4系での実行ではない。依存は /root/network-validation/deps/ に隔離。全体テストとDockerビルドは環境ルールにより未実施。

## セキュリティ更新候補

今回apt-get update成功。apt-get -s upgradeの候補はgoogle-chrome-stable 1件、157.0.8103.38-1 → 157.0.8103.78-1。更新自体は未実施。apt配布の候補確認であり、個別CVEの該当判定や全ソフトウェアの脆弱性監査ではない。

## ファイアウォールと残件

最終記録を /root/network-validation/firewall.log、firewall-collector.log、nft-ruleset.txt、firewall-manifest.json に採取する。既存collectorはcounters-onlyであり、パケット本文ログではなく実dropカウンター差分。採取時刻とSHA256を記録し0600にする。ルールは変更しない。

本番反映には本体Worker→dynamicnekoの順でWorkerのみの公開が必要。コンテナの再ビルド・再起動はこのMuse修正には不要。ネットワークbundleのCGI変更を将来のイメージへ含める作業は別で、現コンテナには適用済み。両Workerの公開前後で既存binding/secretとコンテナ設定を維持する。復元は退避した設定、Workerの公開取り消しは旧versionへのrollbackを使う。

## 後続ターン: パネル投稿の実受信

[2026-11-14T00:50:21.971095+00:00] パネル投稿の後続実受信
STREAM_POST_OK_20261114 を含む投稿を同一会話のユーザー発言として実受信し、識別子を返答した。投稿受付・queue照合に加えてモデルへの入力到達を確認。ブラウザでの返答描画は未確認。本番公開の承認とは扱わない。

## 後続: tree-view Muse会話ログのスキーマ

dynamicnekoの既存DB向けに0011マイグレーションを作成。スレッド、回答ID、連番、ログイン名、所有者ID、親回答、状態と本文を保持し、回答IDから枝を復元できる。先行失敗後のSQLite実制約12テストとD1ローカル適用10コマンド成功。本番DBや保存APIへの接続はまだ行っていない。本体ai_chat_sharesへの自動複製ではなく、任意のmain_worker_share_idで相関可能にした。
