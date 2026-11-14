# SPEC: `/cf-containers`のCLI版・Apacheモジュール状態表示（2026-11-14）

## 背景

本体コンテナの`containers/demo/Dockerfile`はnpmパッケージ`cf@1.0.0-beta.31`を導入し、`cf --version`で確認している。しかし、Dockerfileが生成する`/etc/image-versions.json`には`cf`の想定版がなく、`server.js`の版収集対象にも含まれない。そのため`/cf-containers`の版表は公式`cf` CLIの導入状態を正しく表せなかった。

一方、リポジトリ同梱のCloudflare API簡易スクリプトは`cf-api`として配置されているが、aptツール表では`cf`と表示されていた。公式CLIと同じ名前に見えるため、導入状況を区別しにくい。

Apacheについては、ヘルス表で8443番の応答を表示する一方、導入済みのモジュールファイルと有効状態を列挙していなかった。

## 仕様

- Dockerfileが書く`/etc/image-versions.json`に、インストール時に使う`CF_CLI_VERSION`を`cf`キーで記録する。
- `/health`の版収集で公式`cf --version`を実行し、実際の導入版と想定版を表示する。beta版のサフィックスも比較対象として保持する。
- 同梱の簡易APIコマンドは、aptツール表で`cf-api`と表示する。リポジトリビルドのコミットIDによる識別は維持する。
- `/health`は状態確認のたびに`/usr/lib/apache2/modules`の導入ファイルと`apache2ctl -M`の有効モジュールを照合し、Apache本体の版とともに返す。
- Dockerfileで有効化を意図している`ssl`、`proxy`、`proxy_http`、`proxy_wstunnel`、`rewrite`、`cgid`、`include`、`remoteip`、`mpm_event`は、ファイルが欠けていても一覧に出す。
- `/cf-containers`は導入済み・有効なモジュールと取得できたApache版を緑で表示する。未導入または未ロードの行はグレー表示にする。状態を取得できない場合は不明と表示し、未導入と混同しない。
- モジュール個別の独立した版番号は通常提供されないため、版欄はApache本体の版を明示する。

## 運用上の境界

- この変更はコンテナイメージのビルド入力を変える。ソースへの変更だけでは稼働中のコンテナへ反映されず、イメージ再ビルドと対応するWorkerデプロイが必要。
- Dockerビルドと本番デプロイはこのSPEC作成・コード変更だけでは実施しない。実際のイメージ反映後に`/cf-containers`で実データを確認する。
- `apache2ctl -M`が示すのは現在のApache設定でロード対象となるモジュールであり、個々のモジュールバイナリの独立したリリース版を示すものではない。
