# コンテナ専用のインストール後設定

Workerのコード・bindingsには依存しない。外部のlibリポジトリを依存先とし、lib本体とlib固有テストはこのディレクトリへコピーしない。

## 呼び出す関数

`post_install.py` の `configure_after_install()` が入口。次の設定関数をプロセス間flockの内側で呼ぶ。

- `resolve_settings()`：現在ENVを保存設定より優先。ORIGIN_HMAC_SECRET → HMAC_SECRETの順で解決し、固定会話IDとHTTPS Originを検証。
- `configure_environment()`：CGI/配信用HMAC、Origin、固定会話、cron用Cloudflare設定を原子的に保存。秘密ファイルと旧設定の履歴は非公開領域へ保存。
- `configure_sockets()`：app-serverの親0700、observer/workerの親root:www-data 0750を復元。ソケット実体は各サービスが作る。
- `configure_credentials()`：初回のみrootの既存認証を専用ユーザーの非公開領域へコピー。既存helper認証を上書きしない。新しい資格情報は生成しない。
- `configure_observer()`：明示された同じ会話をread APIで確認後、0600のsource.jsonを更新。失敗時は旧設定を履歴として保ち、古い対象のobserverは停止する。
- `restart_streams()` / `service_ready()`：署名鍵・Origin変更を既存配信プロセスへ反映し、ランチャーのexit=0だけで準備完了にしない。

`install_image()` は依存ツール導入後のイメージ配置専用。ローカルに取得済みのlibから必要なファイルだけを配置し、Rubyパス、CLI/helperリンク、CGI、cronを設定する。ダウンロード・モデル呼び出しはしない。

## Dockerfileと起動順序

1. 既存DockerfileのNode/Codex/Claude/Python/Apache等の導入。
2. `LIB_NETWORK_REVISION` で指定された**公開済みの40桁gitコミット**を `https://github.com/nekoserver/lib.git` から `/opt/lib-network-src` へfetch/checkoutし、実際のHEADと照合。
3. `post_install.py --install-image` を実行し、Apacheのlib用アクセス制御を有効化。
4. コンテナ起動時、entrypointがApache起動前に `post_install.py` を実行。
5. cronも同じ関数を毎分呼び、依存する会話/認証が後から復元された場合に再確認。

起動時にgit clone・pip/apt/npm installは行わない。会話の自動選択、fork、モデルへのテスト投稿も行わない。従来の `/usr/local/sbin/start-lib-network` も同じ設定関数へ委譲する。

`LIB_NETWORK_REVISION` は必須。公開前のローカルコミットやmoving branchを暗黙採用しない。既存ビルド定義を使う場合はコンテナのimage_varsにもこの非秘密の引数を指定する必要がある。既存 `scripts/check-cf-containers.sh` は同名ENVからbuild-argへ渡す。ビルド/実行の許可・実行環境制約はAGENTS.mdに従う。この作業ではDockerビルド・デプロイを実行していない。

コンテナ起動・再作成時に設定を再適用する構成。コンテナを再起動しないWorkerだけのデプロイではentrypointは再実行されない。

## 実行時の前提

- `ORIGIN_HMAC_SECRET` または `HMAC_SECRET`。既存値を使用。
- `LIB_CHAT_THREAD_ID` または `CODEX_THREAD_ID`。保存済み設定は現在ENV未指定時のみ使用。空のコンテナに新しい会話を作って代用しない。
- `LIB_CHAT_ORIGINS`、必要なら `LIB_CHAT_FRAME_ORIGINS`。未指定時は既存3ホストのHTTPS Origin。
- `CLOUDFLARE_ACCOUNT_ID` と `CF_CONTAINER_API_TOKEN`（空の場合のみ `CLOUDFLARE_API_TOKEN`）。権限拒否で別のトークンへ切り替えない。
- 同じ会話を復元できる `/root/.codex` の履歴・認証、必要なら専用ユーザーの既存認証を、運用側の永続領域/復元経路から提供する。イメージに履歴・秘密値を含めない。これらを供給するWorker側の変更は今回行わない。

HMACがなければwaiting_for_hmac。会話の履歴が復元されていなければobserverはwaiting_for_thread。トンネル一覧の権限不足もdegradedとして残す。起動継続とネットワーク全体の正常性を同一視しない。`/run/lib-network/status.json` とroot専用 `/var/log/lib-network-start.log` に状態を記録する。

## テストの集約窓口

本体リポジトリで実行する（Dockerやモデルは起動しない）。

```sh
python3 containers/demo/tests/run.py --lib-source /path/to/lib --log-dir artifacts/lib-network-tests
```

本体にはコンテナ設定・ENV・Apacheのテストを置き、libのテストは指定した独立checkoutから実行する。各スイートの終了コードとログをresults.jsonへ保存する。コンテナが既に稼働中の場合の読み取り検査は `--live-read-only` を追加。実投稿テストは自動起動/cron/通常テストには含めない。

今回の同一会話queue対応を含むlib修正は、別リポジトリ側の未公開変更。実イメージの作成前にlib側を公開し、その修正を含む固定コミットを選ぶ必要がある。ローカルテスト成功を、公開コミットの取得や再作成後の検証の証拠に代用しない。
