# ネットワーク再配置・セキュリティ確認（2026-10-24 UTC）

現コンテナへAPI・実行ワーカー・WebSocket・HTTPストリームを配置した。公開Codex実行とSSHトンネルのバナー受信は成功した。observerの実会話配信、Claude認証、r9の接続先は未解決であり、全ネットワーク完了とは扱わない。Dockerビルド、Workerデプロイ、DNS・リモートTunnel設定の変更は実施していない。

## 既存ENVと設定の正本

`lib` と `cf-container/SETTING.cf-container.md`、`ops/network/` を参照した。既存HMACをCGI・配信へ渡し、新規生成・ローテーションしていない。秘密値・署名・会話IDは本書とGitに保存していない。

コマンド実行先の `CLOUDFLARE_ACCOUNT_ID` は32文字で、既存 `CF_CONTAINER_API_TOKEN` による一覧取得はHTTP200だが0件だった。既存親プロセスに供給されていた別の同一アカウント用ENVでは、nekoroot healthy / cfc-tunnel down の2件を取得できた。こちらを確認後、root専用 `/etc/lib-tunnels.env`（0600）へ保存して定期更新だけに利用した。起動元Secretを変更したわけではなく、再作成時の不一致は残る。稼働トンネルが一覧から欠落した場合にキャッシュを置換しない検証を維持した。

CGIには管理トークンを渡さず、非秘密キャッシュを使用する。APIのアカウント・トークン優先順位は既存libの実装を使用した。キャッシュ更新にも `CF_CONTAINER_API_TOKEN` 優先・空なら `CLOUDFLARE_API_TOKEN` を適用し、cronと手動更新の競合をflockで抑止した。失敗時は前回のファイルを保持し、Rubyの120秒期限は維持する。

## 適用と復元

- `/var/www/html/lib` へGit管理情報・keys・token名のファイルを除外して配置。Apacheの直接ファイル配信は禁止し、認証付きサービスとCGIへ中継。
- TLS8443のtunnels.rb・拡張子なし・uptunnels互換経路、WebSocket8091、SSE/NDJSON/JSON-seq8092を配置。配信はループバックのみで待受。
- 専用codex-webユーザー、既存認証の専用コピー、同一配布元のCodex本体・補助バイナリ0.164.0、Claude CLI 2.1.309、bubblewrap隔離、root:www-dataの実行用Unixソケットを配置。Claudeの認証は発見できなかった。
- 配信起動で現在のENVを保存済み設定より優先するよう修正し、起動処理をflockで排他化。二度の起動後もPythonの各配信プロセス・実行ワーカーがそれぞれ1個であることを確認。
- cronによる一覧更新・配信・実行ワーカー生存確認を配置。停止していたcronも起動し、起動ヘルパーにcronと初回キャッシュ更新を追加。cron用ENVのexport漏れも修正し、次の定期実行で2件のキャッシュ更新成功を確認。`start-lib-network` をentrypointの最終exec前に追加。確認済みsource.jsonがある場合だけobserverを起動する。

非秘密の復元設定はcf-containerの `ops/network/`、一覧更新は `ops/refresh-tunnels.py` に保存した。秘密設定と専用ユーザー・CLI・Python依存はSETTING第11節に従い別途復元する。稼働コンテナへの配置をイメージ反映や再作成後の成功と同一視しない。既存認証のコピーは元ファイルの更新へ自動追従しない。

## 実測

| 対象 | 結果 |
|---|---|
| cloudflared ready | HTTP200、readyConnections=3 |
| mygwのtunnels.rb / uptunnels.rb | 署名付きHTTP200、2件 |
| 両APIの `message: codex_prompt=“Reply exactly NETWORK_PROMPT_OK. Do not use tools.”` | 各1回POSTし、同じask_idをGETで確認、done・期待する回答 |
| 両APIの同形式claude_prompt | failed / claude_not_authenticated。成功扱いしない |
| mygw / stream.test.cfcのWebSocket | 公開TLS経由のチャレンジHMAC認証成功 |
| 両ホストのSSE / NDJSON / JSON-seq | 正しいobserve要求で署名付き200・各Content-Type、署名なし401。本文はobserver_unavailable |
| 両ホストの内部Python・keys / 会話HTML | 403 / 401 |
| stream.test.cfc / r8の署名付きAPI | HTTP200、トンネルJSON |
| r9の署名付きAPI | HTTP502。リモートの既存転送先10443にローカル待受なし |
| mygw /ssh | 公開WebSocketトンネル越しにSSHバナー受信。SSHログインまでは未検証 |
| Tailscale | BackendState Running、71 peer。個々のpeerへの接続は未検証 |

最初のHTTPストリーム試験では誤った `type: conversation` を送り400だった。正しい `type: observe` に修正して上表の結果を取得した。400を認証や配信の成功として数えていない。

Pythonのlibテスト63件、JavaScript39件、Rubyプロンプト16件69 assertions、Rubyトンネル6件20 assertions成功。キャッシュ更新のENV優先・空値フォールバック・不完全一覧・通信障害時の旧データ保持は分離した4件のテスト成功。Apache構文、entrypointシェル構文、pip check成功。

既存Ruby HMACテストは4件中3件成功、1件はFile.stub未定義でエラー。minitest/mockが現在のRuby環境になく、テスト全件成功とは扱わない。Python observerテストは接続終了時の診断を出すが、テスト結果は成功だった。

## 未完了の条件

- 現在の会話に対応するapp-server Unixソケットが存在せず、observer用source.jsonは作成していない。対象ソケットの供給、読み取りAPIでの会話一致確認、公開経路での継続受信が必要。CLIの実行成功で代替しない。接続先パスをユーザーへ照会済み。
- Claudeの既存資格情報または認証済み保存先が必要。値そのものの送信を求めず保存先だけ照会した。失敗後の自動再送はしていない。
- r9は既存リモート設定が10443を向いている。別サービスを上書きしないよう、8443へ揃える想定か照会済み。停止中cfc-tunnelは停止を維持し、トークンを混用していない。
- ブラウザ実操作、SSHログイン、Tailscale個別peer、再作成後の起動は未検証。Workerの変更・デプロイと全体npm依存監査は実施していない。

## セキュリティ更新

APTインデックス更新後、更新候補は0件。Apacheは2.4.66-2ubuntu2.6、OpenSSH serverは1:10.2p1-2ubuntu3.8、OpenSSLは3.5.5-1ubuntu3.7。今回はOS更新の適用不要だった。配置に必要なrsyncとlibpopt0は新規導入した。

[Ubuntu USN-8931-1](https://ubuntu.com/security/notices/USN-8931-1)（2026-10-14）はApacheの複数の脆弱性を扱い、Ubuntu26.04の修正版を2.4.66-2ubuntu2.6としている。現インストールは同版だった。

配信依存はリポジトリ固定値のaiohttp 3.14.5 / websockets 17.3を導入し、pip check成功。[aiohttp公式変更履歴](https://docs.aiohttp.org/en/stable/changes.html)の3.14.4にはWebSocketの過剰メモリ使用等の修正、3.14.5には制御フレーム処理修正があり、今回の版に含まれる。これは全依存・全ソフトウェアの脆弱性不存在を保証しない。
