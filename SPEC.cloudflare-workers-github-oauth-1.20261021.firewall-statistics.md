# Firewall統計・PTR/WHOIS/CIDR・毎時D1保存

本体 `containers/demo/Dockerfile` は、既存のwhois・dig・Pythonに加え、
`firewall-stats.py` を `/app` へ同梱する。entrypointのルール適用とserver.jsの診断APIも同じビルド元で変更する。

- ログは毎秒10件・burst 20 packets。カウンターはレート制限前で全遮断分を計測。
- nftのチェックに失敗した場合はログ行を外して再検証し、遮断とカウンターを維持。旧テーブルの削除・作成は検証後の同一トランザクションで実行。
- 現コンテナではlimit機能が使えず、counters-onlyで実際のIPv6受信・遮断件数の増加を確認。
- 送信元IPv4/IPv6、packets/bytes、IPv4 /24・IPv6 /64での集計、上位10送信元のPTR・WHOIS割当CIDR別集計を提供。非公開アドレスは外部照会しない。
- WHOIS未取得の送信元も固定プレフィックス集計には含む。登録ネットワークと比較用の固定プレフィックスを区別。
- `/debug/firewall` が収集用JSON、`/debug/net` と管理画面が診断結果を表示。既存の管理者用プロキシ経由で参照する。
- 毎時5分(UTC)のWorker cronが既存D1へ保存。migration `0180_create_firewall_snapshots.sql` でテーブルを追加。同一コンテナ・UTC時刻の1時間枠でupsertし、再実行による重複を防ぐ。
- 記録内容はスナップショット。時間内の流量ではない。カウンターの世代、1日で消える送信元、再起動/再設定によるリセットに留意して比較する。
- 取得不能、停止、旧イメージでAPI未実装の場合もavailable=falseと理由を記録。停止中のコンテナは収集のために起動しない。
- 毎時処理は既存6時間処理から分離。通知を新規に追加しない。

検証: Python4テスト、関連Vitest6ファイル58テスト、SQLiteでmigrationと同一時間枠upsert、
一時Nodeサーバーの実IPv6統計API、bash/Node構文を確認。
現コンテナにはファイアウォールのフォールバックとCLI `/usr/local/sbin/firewall-stats` を適用。
Dockerビルド・新イメージ配布・Worker反映・本番D1 migrationは未実施。毎時D1保存はまだ稼働していない。

## 本体の「コンテナ診断」ページ

- `/cf-containers/diagnostics`。既存のコンテナ管理画面からリンクし、管理者認証を必須にする。
- Apache・sshd・cloudflared・Tailscale・Dockerの現在のヘルスと、IPv4/IPv6の統計を表示。
- 専用live APIは停止中のコンテナへfetchしない。ヘルスと統計の一方の失敗を他方の結果と分離する。
- 履歴の取得API `/api/cf-containers/firewall/history` はfrom/to、limit、beforeによる期間指定・ページング。期間は最大31日、1回最大744件。
- 一覧SQLはJSONから累積packets/bytesなどの要約だけを抽出。詳細JSONは `/api/cf-containers/firewall/history/:id` で1件ずつ取得する。
- IPv4 /24・IPv6 /64、WHOIS割当CIDR、送信元のPTRとWHOISを詳細表示。WHOISなどの外部文字列はtextContentで表示する。
- データベース未準備・取得失敗と、空の履歴や0件を区別。履歴行を合計して時間内の流量にしない。

ページ追加の検証: 認証・停止時の無通信・障害分離・履歴API・ブラウザDOMのXSS対策を含む
関連35テスト、SQLiteで実際のIPv4/IPv6要約SQL、追加した履歴ユーティリティとviewの型検査を通過。
本番Worker・DBは未反映。
