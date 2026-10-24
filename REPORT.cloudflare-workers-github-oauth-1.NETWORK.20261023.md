# ネットワーク復旧・セキュリティ確認（2026-10-23 UTC）

現コンテナへ適用済み。全体完了ではなく、observerの接続先とClaude認証が未解決。Dockerビルド、Workerデプロイ、DNS変更、イメージ再作成は実施していない。

## 適用した設定

- `/root/lib` を `/var/www/html/lib` へ配置。Git管理情報・keys・token名のファイルは除外。Apacheのファイル直接配信はディレクトリ全体で拒否し、認証付き配信サービスとCGIのみを公開。
- 既存ENVのHMACをCGI・WebSocket・HTTP配信へ継承。新規鍵の生成・ローテーションなし。秘密値はGit・REPORTへ記録しない。
- TLS8443へtunnels.rb、拡張子なし経路、uptunnels.rb互換経路を設定。WebSocketは127.0.0.1:8091、SSE/NDJSON/JSON-seqは127.0.0.1:8092へ中継。配信タイムアウト600秒。内部ops/test/keysへのアクセスは拒否。
- Codex専用ユーザー、同梱CLIと補助バイナリ、既存認証の専用コピー、bubblewrap隔離、root:www-dataの0660 Unixソケットを構成。外部入力は専用ユーザーで実行。
- entrypointの起動設定とcronの定期キャッシュ更新・サービス生存確認を追加。observerは確認済みsource.jsonがある場合だけ起動する。
- libのtunnels_lib.rbで固定アカウントよりCLOUDFLARE_ACCOUNT_IDを優先し、トークンはCF_CONTAINER_API_TOKENを優先、未設定・空ならCLOUDFLARE_API_TOKENを利用するよう修正。CGIには管理用トークンを渡さず、rootが更新した非秘密キャッシュを使用。

現在のENVの一覧トークンを最初に検証したが、一覧はHTTP200・0件、稼働トンネルの個別取得は拒否された。別プロセスに既存の有効トークンがあり、同一アカウントの2件を確認できたため、定期更新用のroot専用 `/etc/profile.d/cf-env.sh` へ反映した。起動元Secretは変更していないため、コンテナ再作成時にはこの不一致が再発し得る。空の一覧で稼働トンネルのキャッシュを上書きしない既存検証を維持した。

復元用の非秘密設定・起動スクリプトはcf-containerの `ops/network/` に保存。秘密設定、専用ユーザー、依存・CLI配置はSETTING第11節に従って別途復元する。これらのファイルの保存だけではイメージへ反映されない。

## 実測

- cloudflared ready HTTP200。nekoroot healthy、cfc-tunnel down（意図した停止を維持）。cronによるキャッシュ更新を確認。
- ローカルTLS・公開mygwの署名付きtunnels.rbはHTTP200、2件。公開uptunnels.rbも署名付きHTTP200、2件。
- 両経路で `message: codex_prompt=“NETWORK_PROMPT_OK とだけ返してください”` を各1回POSTし、done・期待する回答を確認。pending時だけ同じask_idをGETし、POST再送なし。
- 公開 `claude_prompt=“…”` はHTTP200内のfailed / claude_not_authenticated。Claude認証が未構成のため成功とは扱わない。
- 両経路のWebSocketはHMAC認証成功。SSE/NDJSON/JSON-seqは署名付きHTTP200、署名なし401。会話配信の本文はobserver_unavailableであり、会話受信成功とは扱わない。
- 内部Python取得403、認証なし会話HTML401。Apache構文、entrypointシェル構文は成功。
- Python配信33件、LLMワーカー21件、JavaScript32件、Rubyプロンプト16件69 assertions成功。ENVアカウント・トークン優先の分離検証も成功。
- Ruby HMACテストは4件中1件がFile.stub未定義でエラー。他3件成功。現在のRuby環境にminitest/mockもなく、このテスト全件成功とは報告しない。

## 残る条件

現在のCodexプロセスにobserverが利用できるapp-server Unixソケットは存在しない。動作中という理由で別会話を選ばず、source.jsonは作成していない。対象会話と一致するapp-serverソケットの供給後に、読み取りAPIで会話一致を確認し、observerを起動して公開経路から継続受信を検証する必要がある。

Claudeは専用の認証を確認してから再テストする。Tailscaleは既存プロセスを変更しておらず、経由の実疎通は未検証。SSHのトンネル越し接続、ブラウザ実操作、コンテナ再作成後の起動は未検証。

## セキュリティ更新

apt-get update後、apt list --upgradableは0件。apache2/apache2-binは2.4.66-2ubuntu2.6、openssh-serverは1:10.2p1-2ubuntu3.8、opensslは3.5.5-1ubuntu3.7で、取得できたAPT候補と一致。今回OS更新の適用は不要だった。この確認は全ソフトウェアの脆弱性不存在を保証しない。

[Ubuntu USN-8898-1](https://ubuntu.com/security/notices/USN-8898-1) はApacheのmod_rewrite/mod_http2/mod_ssl修正を案内し、Ubuntu26.04の修正版は2.4.66-2ubuntu2.5。実インストールはそれ以降。

配信依存はリポジトリ固定値のaiohttp 3.14.5 / websockets 17.3を導入。[aiohttpのWebSocket upgradeに関するGHSA-mfx4-hv73-q22v](https://github.com/aio-libs/aiohttp/security/advisories/GHSA-mfx4-hv73-q22v) の影響範囲は3.14.1以下で、今回導入値はその範囲外。同ページのpatched versions表記には4.14.2とあり、表記の整合性は未確認。全依存の網羅監査・本体npm依存監査は未実施。
