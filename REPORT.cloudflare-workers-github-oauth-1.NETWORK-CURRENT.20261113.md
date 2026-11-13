# 現コンテナのネットワーク再配置（2026-11-13 17時台 UTC）

本作業の結果は /root/boot.log と /root/network-validation/ に記録した。過去のartifactsの結果を今回の成功の根拠にはしていない。現コンテナに適用済みだが、全トンネルの完了ではない。Dockerビルド・本体Workerデプロイ・Git pushは行っていない。

## テストファースト・適用

/root/network-validation/acceptance_test.pyを設定前に作成し、不足する内部プロキシ設定、source.json、Unixソケットの失敗を確認した。既存lib・cf-containerと本体post_install.pyを使用し、適用後は同テスト3件成功。設定ファイルは/var/lib/lib-network/pre-network-validationへ退避した。現在ENVのHMAC、Cloudflare設定、CODEX_THREAD_ID、Muse設定を保存値より優先した。他の資格情報への暗黙の切り替えはしていない。

app-server /run/lib-chat-app/app-server.sock（root専用の既存実体へのリンク）、observer /run/lib-chat-observer/observer.sock、LLM /run/lib-codex/worker.sockを接続確認。observerは読み取りAPIで現在会話IDを確認したsource.json（0600）を使用する。実体と親ディレクトリの権限はruntimeテストでも確認した。会話forkなし。公開配信はwww-data、内部8091/8092。専用codex-webへ既存Codex認証を非公開コピーした。Claude認証は存在しない。

内部8445へSSI/CGIとストリームのプロキシ、ProxyPreserveHost Onを適用。公開8443は/lib拒否を維持し、署名付きtunnels APIの完全一致2パスだけ既存HMAC認証CGIへ接続した。Apache configtest成功。systemctlがchroot内で開始を無視したためAPACHE_STARTED_BY_SYSTEMD=1でApacheを実起動した。内部・公開の実通信で起動を確認した。

entrypointの競合する旧Claude復元呼び出しをpost_install.pyへ置き換え、cronと同じ入口に統一した。再実行は配信ready・observer configured・tunnels refresh_failedでdegradedとなる。再起動・コンテナ再作成からの復元は未検証。現ファイルシステム上の変更である。

## 今回のテスト結果

|項目|結果・検証範囲|
|---|---|
|追加受け入れテスト|変更前失敗、変更後3件成功|
|ENV優先・失敗時キャッシュ保持・配信への資格情報制限|既存9件成功|
|稼働ソケット権限・SSI・Ruby/子CGI・非公開パス|4件成功、最終再検査も成功|
|公開API署名・不正署名拒否・他libパス拒否|3件成功|
|WebSocket/SSE/NDJSON/JSON-seq|内部実通信で認証と現在会話イベント受信成功|
|引用符付きprompt解析|17件79 assertions成功|
|codex_prompt=“…”|内部経路と公開DNS/TLS経路の両方でdone・固有の実回答完全一致|
|muse_prompt=“…”|内部経路でdone・実回答完全一致。他経路へのフォールバックなし|
|claude_prompt|専用ユーザーの認証失敗を確認し実推論は未実施|
|内部Host継承契約|1件成功|
|cloudflared ingress / sshd設定|検証コマンド成功。外部SSHログインは未実施|
|Tailscale|Running、peer3件。全peerへの到達を保証しない|
|ストリームパネル|下記の実ブラウザ投稿と現在会話キュー照合成功|
|トンネル一覧更新・復帰全体|現ENV資格情報のリソース権限不足で失敗、degradedを維持|

プロンプトの各要求は一度登録し同じask_idを追跡した。内部の一覧取得error=no_api_tokenは、推論のdoneと同居するため別件として扱う。公開Codex試験は本体と同じwait_seconds=0でPOST登録・POST照会した。本体のログイン済みUIやservice bindingを通した検証ではない。

## パネル投稿と試験環境

実ChromeでHMACログイン、現在会話表示、投稿フォームから1件だけ送信した。HTTP200 accepted=true queued=true。panel-queueテストで現在ENVと同じ会話に識別子STREAM_POST_OK_20261113_CURRENTを含む入力が正確に1件存在し、observerの対象が変わっていないことを確認した。送信許可は解除済み。AIによる消費・回答・ブラウザへの回答描画は未確認。

mygw originをローカルTLS転送で内部8445へ接続し、fixtureの親ページから通常のpostMessageでパネルを制御した。認証・配信・投稿APIは実装を使用する。公開管理画面の終端検証の代用とはしない。

pipがないためaptのPython Playwrightを導入したが、Node driverが不足し、さらにOS配布のPython 1.55/Node 1.38間に不一致があった。既存Node driverを使うJavaScript試験へ切り替えて実投稿できた。試験終了時のローカル転送ソケットの後始末が不足してプロセスが残ったため終了し、テストコードに明示closeを追加。再投稿せず読み取り専用で再検証した。初期失敗と後始末終了もboot.logに残している。依存導入はaptバイナリで、ソースビルドなし。

## 外部の残件

現在トークンではactive tunnelが一覧に含まれず、対象リソースへのAPIアクセスも拒否された。失敗した一覧でキャッシュを成功扱いに置換していない。対象アカウント・トンネルの読み取り権限が必要。DNS/トンネル割当は推測で変更していない。

今回の未署名外部検査: mygw/r8はSSI・APIとも403（管理者限定・署名必須の境界）。stream.test.cfcは530。r9はSSIタイムアウト・API502。r9のRedmine用途を変更していない。cloudflaredのingress検証成功はこれらホストの正常稼働を意味しない。

## セキュリティ更新候補

今回apt-get update成功。apt-get -s upgradeの候補はgoogle-chrome-stableの1件、157.0.8103.38-1 → 157.0.8103.78-1。更新自体は実施していない。apt索引上の候補を記録したもので、個別CVEやすべてのソフトウェアの安全性を判断したものではない。

## ファイアウォール

本REPORT記録後、/root/network-validationへfirewall.log、firewall-collector.log、nft-ruleset.txtとSHA256・UTC時刻を含むfirewall-manifest.jsonを採取する。既存collectorはcounters-only。パケット単位のカーネル本文ログではなく実dropカウンター差分。ルール変更は行わない。ログは0600とする。

## 後続ターン：パネル投稿の実受信確認

同一会話キューに登録したSTREAM_POST_OK_20261113_CURRENTを含む試験投稿を、後続のユーザー発言として本エージェントが実受信し、指定の識別子を返答した。これにより投稿受付・キュー照合に加え、モデルへの入力到達を確認した。返答のブラウザ描画は未確認。Cloudflareトークンの権限不足、stream/r9の外部障害、Claude認証の残件は変わらない。追記後にファイアウォールログを再採取した。
