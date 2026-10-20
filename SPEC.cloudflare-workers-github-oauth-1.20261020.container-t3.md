# CloudflareコンテナへのT3 Code接続仕様

作成日: 2026-10-20 JST

## 目的

Cloudflare Containers上でT3 Codeを常時起動し、`dynamicneko` のtree-viewから安全に埋め込んで対話できるようにする。現在の試用で確認した接続方式を、コンテナの再作成後にも再現できる仕様として整理する。

## 現状

- `cf-container` の稼働中コンテナには、2026-10-20時点でT3 Code 0.1.0を手動導入した。CLIは `/root/.local/bin/t3`、Webサーバーは `127.0.0.1:3773` である。
- `~/.t3/embed/proxy.cjs` が3774でHTTPとWebSocketを受け、3773のT3 Codeへ中継する。HTTPS埋め込み向けにHttpOnly認証Cookieへ `SameSite=None; Secure; Partitioned` を付ける。
- proxyの前段に専用Cloudflare Quick Tunnelを置き、公開originをWorkerの `TREE_VIEW_CONTAINER_ORIGIN` に設定する。T3 Code本体の3773は直接公開しない。
- T3への接続は一回限りのペアリングコードを必須とする。認証なしのプロジェクトAPIが401となることを確認済み。frame-ancestorsは `dynamicneko` とローカル検証元に限定する。
- proxyはwatchdogで監視し、停止後3秒で再起動する。T3 Code、proxy、トンネル、watchdogはいずれもコンテナ再作成後の自動起動に未対応である。Quick TunnelのURLも再起動で変わり得る。
- T3 Codeからのモデル呼び出しはまだ実施していない。現在のrootにあるプロバイダー認証を利用する試用構成であり、コンテナへ移す場合の認証供給・分離・永続化は別途設計が必要。

試用の詳細と運用コマンドは作業環境の `/root/T3CODE-TRIAL.md`、コンテナ復旧の観測記録は [`REPORT.cloudflare-workers-github-oauth-1.CONTAINER-RESTORE-SECURITY.20261020.md`](REPORT.cloudflare-workers-github-oauth-1.CONTAINER-RESTORE-SECURITY.20261020.md)、設定手順は [`cf-container/SETTING.cf-container.md`](https://github.com/nekoserver/cf-container/blob/main/SETTING.cf-container.md) を参照する。

## 接続構成

```text
ブラウザー
  └─ dynamicneko tree-view (TREE_VIEW_CONTAINER_ORIGIN)
       └─ HTTPS / WebSocket
            └─ T3用公開トンネル
                 └─ 127.0.0.1:3774 埋め込みproxy
                      └─ 127.0.0.1:3773 T3 Code
```

- Workerは `TREE_VIEW_CONTAINER_ORIGIN` を埋め込み先originとして使う。トンネルのoriginが変わった場合はWorker側の設定も更新する。
- T3 Code本体はloopbackだけで待ち受け、トンネルはproxyのポートだけを公開する。
- 既存のCloudflareコンテナ管理用トンネル、Apache、server.jsの入口とは独立した経路として扱う。既存のホスト名・ingressを流用する場合も、ルーティングと認証境界を混ぜない。

## コンテナへの組み込み要件

1. T3 Codeの固定した安定版と必要な実行環境、proxy、watchdogをイメージのビルド定義へ反映する。試用版0.1.0を初期基準とし、更新時は互換性を確認してバージョンを明示する。
2. コンテナ起動時にT3 Code、proxy、公開トンネル、watchdogを起動し、それぞれのPIDとログを管理する。停止時は子プロセスを終了し、コンテナ再作成後はentrypointから再び起動する。
3. T3 Codeは `127.0.0.1:3773`、proxyは `127.0.0.1:3774` にbindする。公開トンネルのoriginをWorkerの `TREE_VIEW_CONTAINER_ORIGIN` と一致させる。
4. 埋め込みHTTPとWebSocketを中継し、T3の認証Cookie属性をHTTPS iframeに必要な `HttpOnly; SameSite=None; Secure; Partitioned` にする。認証をproxyで省略したり、3773を公開したりしない。
5. pairingを利用開始の必須手順とする。一回限り、短時間有効なコードで利用者を登録し、再ペアリング時もコードを共有ログやリポジトリに残さない。
6. frame-ancestorsは本番の `dynamicneko` originと明示したローカル検証originに絞る。任意originを許可しない。
7. T3のユーザーデータ、会話履歴、プロバイダー認証、ペアリング情報、トンネル資格情報、ログの保存先とバックアップ・保持方針を決める。認証情報をイメージ、Git、公開環境変数、一般ログへ含めない。コンテナの一時領域だけに置く場合は再作成時に失われることを明示する。
8. `TREE_VIEW_CONTAINER_ORIGIN` をSecretまたはWorker設定として管理する。Quick Tunnelを使い続ける場合はorigin変更を検出して更新する運用を用意する。安定した公開originへ移行する場合はDNS・Tunnel・所有権を確認する。
9. 既存コンテナのCodex/Claude、会話observer、HMAC配信、SSH、Cloudflareトンネルの起動とヘルスチェックに影響を与えない。T3の失敗が既存のserver.jsと管理ページの起動を止めない。

## 認証とデータの扱い

- T3のpairing認証、Workerの管理者認証、既存ストリームのHMAC認証は別々の境界として維持する。
- T3 Web UI/APIはpairing済みセッションを要求する。認証なしのAPIが401を返すことを確認する。
- T3がrootの既存プロバイダー認証を読む設計は試用時の便宜であり、コンテナ本番仕様としては未確定。採用する場合は専用実行ユーザー、最小権限の認証供給、秘密情報を露出しない実行確認を定義する。
- T3のユーザーデータとプロジェクト作業ディレクトリの範囲を分け、tree-viewやpairingした利用者がコンテナ内の不要な資格情報・他プロジェクトへアクセスできないようにする。
- アクセスログや障害ログにpairingコード、Cookie、Authorization、会話本文、プロバイダートークンを記録しない。

## 起動・復旧・監視

- 起動順は、永続データと設定の準備、T3 Code、loopback疎通、proxy、公開トンネル、origin通知の順とする。外部依存のT3が失敗しても既存コンテナのサービスは継続する。
- watchdogはT3 Codeとproxyの異常終了を区別して再起動し、再起動回数・待機時間を制限する。無限の高速再起動を避け、状態を秘密情報なしで記録する。
- ヘルスチェックではT3のloopback応答、proxy経由のHTTP応答、WebSocket upgrade、トンネルready、Worker設定originとの一致を個別に確認する。T3 APIの401は未認証状態として期待値を確認し、プロセス障害と混同しない。
- コンテナ再作成後にユーザーデータが保持され、全プロセスと埋め込みが復帰することを受け入れ条件にする。トンネルoriginが変わった場合は、Worker設定の更新完了まで埋め込みを正常扱いしない。

## 受け入れ条件

- クリーンなイメージから起動し、entrypointが既存機能とT3一式を起動する。
- T3 Codeの3773とproxyの3774がloopbackにのみbindし、公開経路から3773へ直接到達できない。
- 有効なpairing後にtree-view iframeでHTTPとWebSocketの会話ができ、未認証APIは401となる。
- 許可originから埋め込め、許可外originではframe表示が拒否される。HTTPSでCookie属性が維持される。
- コンテナ再作成とT3/proxy/tunnel個別停止から、自動復旧し、決めたデータ保持方針どおりに状態が残る。
- T3またはトンネルが停止しても既存コンテナのserver.js、管理API、Codex/Claude関連機能が起動・応答を継続する。
- 実際のモデル呼び出しを行う場合は、選定した認証方式で成功し、秘密情報がログ・HTTP応答・公開リソースへ現れないことを別途確認する。

## 未決事項

- Cloudflare Containers内でT3 CodeとQuick Tunnelを常駐させるリソース・プロセスモデル。
- Quick Tunnelを継続利用するか、安定した専用Tunnel hostnameを割り当てるか。
- T3のuserdata、会話履歴、作業ディレクトリを保持するストレージと保持期間。
- T3のモデル認証をどの専用アカウント・仕組みで供給するか。試用では実際のモデル呼び出しを検証していない。
- T3の利用者ごとの認可、コンテナ内ファイルアクセス範囲、同時利用時の分離。

この文書は実装仕様と受け入れ条件を定める。イメージへの組み込み、Dockerビルド、Worker設定変更、本番デプロイ、実モデル呼び出しは完了済みを意味しない。2026-10-20時点で確認できているのは稼働中環境での試用構成である。
