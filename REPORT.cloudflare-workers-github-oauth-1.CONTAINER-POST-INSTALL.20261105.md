# コンテナ専用のインストール後設定関数（2026-11-05）

## 実装

`containers/demo/lib-network/post_install.py` の `configure_after_install()` をコンテナ専用の入口とした。ENV、ソケット、認証、固定会話observer、設定変更時の配信再起動と準備確認を個別の関数へ分離。Workerのコード・bindings・接続先設定は変更していない。

Dockerfileは依存ツールのインストール後に `--install-image` を呼び、ランタイム、Rubyパス、CLI補助バイナリへのリンク、CGI、cronを配置する。entrypointはApache起動前に設定関数を呼ぶ。cronと従来のstart-lib-networkも同じ関数へ委譲し、プロセス間flockで直列化する。

lib本体は独立リポジトリのまま。本体へのlibコード・libテストのコピーは採用しなかった。ビルド時に `LIB_NETWORK_REVISION` で指定した公開済み40桁コミットをfetch/checkoutし、HEADの一致を確認する。起動時のclone・依存インストール・会話分岐・モデルへの自動投稿は行わない。

既存ENVを保存設定より優先する。設定ファイルを原子的に置換し、旧重要設定はroot専用のconfig-historyへ保持。検証に失敗した新会話へは切り替えず、古い会話のobserverも停止して誤配信を防ぐ。HMAC/Originの変更は既存配信へ再起動で適用する。ランチャーの終了コードだけではconfiguredにせず、実際のTCP/Unixソケットも確認する。

## テスト

本体の `containers/demo/tests/run.py` に実行窓口を集約した。コンテナ設定とネットワーク契約のテストは本体内、lib固有テストは指定した独立checkoutから実行する。

実行コマンド：

```sh
python3 containers/demo/tests/run.py --lib-source /root/lib --log-dir artifacts/network-bootstrap-20261105/final
```

| 検証 | 結果 |
| --- | --- |
| インストール後設定関数、ENV優先、繰返し、失敗時保持、秘密ファイル、symlink拒否、準備状態、Docker/起動経路 | 23件成功 |
| ネットワークENV・管理資格情報非継承・不完全キャッシュ保護 | 8件成功 |
| 本体ApacheのSSI・経路順序・アクセス制御 | 1件成功 |
| 独立libのchat/observer/同一会話queue | 52件成功 |
| 独立libのLLM worker | 21件成功 |
| 独立libのRuby prompt | 16件・69 assertions成功 |
| 独立libのNode stream/form/socket/reconnect/theme | 36件成功 |
| 既存コンテナ回帰（Docker COPY・source-build allowlist・prebuilt・SSH・Redmine） | 5ファイル32件成功 |
| 実際の独立libを仮ルートへ配置、Ruby/Node構文、.git/tests/auth除外 | 成功（14-real-lib-staging.log） |
| shell/Python構文・git diff whitespace | 成功 |

合計189件成功。変更前の欠落・配置の繰返し・状態ファイル除外・成功誤判定・共通起動経路の失敗をテストで確認してから修正した。各段階のログは `artifacts/network-bootstrap-20261105/`、最終スイートの終了コードと件数は `results.json`。既存Vitestは依存を追加せずグローバル5.0.5の一時設定で実行し、Dockerビルドは起動していない。

## 未反映と前提

- **Dockerビルド・デプロイ・Worker配備・イメージ再作成は未実施。** AGENTS.mdの環境/モデル制約により、この環境ではDockerビルドしない。Docker内部で実際にgit取得・useradd・全サービスを起動する検証は未実施。隔離した仮ルートへの配置テストを、その証拠に代用しない。
- 新しい必須ビルド入力 `LIB_NETWORK_REVISION` は未指定では失敗する。既存のコンテナimage_varsやビルド呼出側で公開済み固定コミットを指定する必要がある。今回はWorkerとの結合を増やさないため、wrangler.tomlのimage_varsも変更していない。check-cf-containers.shには同名ENVをbuild-argへ渡す処理を追加したが、このビルドを含むスクリプト自体は実行していない。
- 今回の同一会話queue修正は独立libの未commit/未push変更。実ビルド前にlib側を公開し、その修正を含むコミットを指定する必要がある。ローカルの独立lib checkoutでテストした結果と、将来取得する公開版を同一視しない。
- 同じ会話を再作成後も使うには、履歴と認証を永続領域/復元経路から供給する必要がある。秘密値・会話ID・履歴はイメージへ焼かない。履歴がなければ別会話を作らずwaiting_for_thread、HMACがなければwaiting_for_hmac。
- コンテナの起動・再作成時に設定を再適用する。コンテナを起動し直さないWorkerだけのデプロイではentrypointは呼ばれない。
- 本体リポジトリ全件テスト、実イメージでの環境変更時再起動、実ブラウザのパネル操作は未実施。既存の外部Tunnel権限不足・530/502はこの関数化で解消していない。

## ファイアウォールとセキュリティ

検証後に既存 `/tmp/firewall.log` とnft rulesetを `artifacts/network-bootstrap-20261105/` へ採取。時刻・サイズ・SHA256はfirewall-manifest.json。counters-onlyモードの採取時刻とDROP_COUNTERであり、パケット単位のカーネル本文ログではない。

パッケージの版を変更・アップグレードしていない。本日のca-certificates更新候補と公式USNの照合は [先行NETWORK REPORT](REPORT.cloudflare-workers-github-oauth-1.NETWORK.20261105.md) に記録済み。今回の関数化のためにソースビルドや追加パッケージの導入は行っていない。
