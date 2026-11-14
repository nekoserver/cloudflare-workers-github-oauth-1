# Apache WebSocket proxyの今後の予定（2026-11-14）

## 状態

調査・設計整理のPLAN。未実施。設定、イメージ、デプロイを変更する指示や承認ではない。

評価: [EVAL.cloudflare-workers-github-oauth-1.20261114.apache-websocket-proxy.md](EVAL.cloudflare-workers-github-oauth-1.20261114.apache-websocket-proxy.md)
要件: [SPEC.cloudflare-workers-github-oauth-1.20261114.apache-websocket-proxy.md](SPEC.cloudflare-workers-github-oauth-1.20261114.apache-websocket-proxy.md)
事実記録: [NOTICE.cloudflare-workers-github-oauth-1.20261114.apache-proxy-wstunnel.md](NOTICE.cloudflare-workers-github-oauth-1.20261114.apache-proxy-wstunnel.md)

## 方針

安全な最小構成を決めるため、まず事実確認と経路棚卸しを行う。実稼働版とWebSocket pathが確定するまでは、Apache設定とDockerfile/image lockを編集しない。WebSocketは必要なpathだけ許可し、内部Worker認証経路と公開Tunnel経路を分離する。

## 段階

### 1. 配備状態とソース差分を確定する

- Cloudflare上の対象コンテナ／イメージdigestと、そのイメージに対応するbuild recordを特定する。
- 承認された読み取り手段で実稼働コンテナのApache version、`apache2ctl -t -D DUMP_VHOSTS`、有効module、設定include、拒否ルール、proxy timeoutを採取する。
- 作業ツリーのDockerfile `APACHE_VERSION=2.4.71`、パッケージREADME、image.lockの2.4.70、過去builtFrom記録を照合する。
- 秘密値・Cookie・会話本文を記録へ入れず、必要な識別情報だけNOTICEか運用状態記録に残す。

**完了条件:** どの設定・イメージが稼働中かをdigestと版で説明でき、ソース指定との差分の理由が分かる。

### 2. WebSocket利用pathと入口を棚卸しする

- container内のUpgrade handler、client側URL、Tunnel ingress、Apache rewrite/proxy、内部Worker中継を相互にたどる。
- 公開経路で必要なpathと内部専用pathを別一覧にし、通常HTTP共用、認証主体、backendを記録する。
- 現時点で見つけた`/ws`を候補として確認する。`/lib/api/chat/ws`など内部経路を公開許可一覧へ混ぜない。
- 不要な公開WS pathがある場合は、現行アクセス・アプリ依存が確認できるまで切断影響を断定しない。

**完了条件:** 公開WS allowlistと、HTTPだけ／内部のみ／拒否する各pathが利用コードの根拠付きで確定する。

### 3. 読み取り専用の経路試験を設計する

隔離環境または明確に識別できる試験用echo endpointで以下を試す。共有本番会話への投稿や長時間接続を伴う場合は、別途利用者が明示した実施条件に従う。

- Apache configtestと有効vhost/moduleの確認。
- 通常HTTPと既知の許可WS pathのUpgrade・双方向通信。
- `/lib`、`/debug`、`/admin`に対するHTTP要求とUpgrade要求がbackendへ届かないこと。
- `/lib/api/chat/ws`が公開Tunnelで拒否され、認証済み内部Worker経路は既存契約どおりであること。
- Upgradeなし、Connectionなし、Connectionのみ、別Upgrade protocol、token複合・重複header。
- idle/ping timeout、クライアント急断、backend再起動時の切断と後始末。
- アクセスログの101・所要時間・転送量とbackend接続開始・終了の相関。

**完了条件:** 期待応答、試験経路、記録内容、失敗時の切り戻し方法が明示される。試験自体の実行は環境の安全性と運用条件の確認後に行う。

### 4. 構成案を比較して採用候補を決める

- 固定pathならApache 2.4.47以降の`ProxyPass ... upgrade=websocket`を用いる案。
- 動的Rewriteを限定pathで維持し、Upgrade/Connection検証を明確にする案。
- 旧Apache版も支援する必要がある場合の`mod_proxy_wstunnel`互換案。

評価軸は公開pathの最小化、通常HTTPとの共存、Apache版対応、認証境界、運用ログ、既存PWA WebSocketへの非回帰とする。`mod_proxy_wstunnel` moduleを外すならDockerfile、package、コメント、lock、受入テストを同一変更に含める。

**完了条件:** 対象版とpathに合う候補を選び、変更差分と戻し方がレビュー可能である。

### 5. 必要な場合のみ変更・検証する

- コード変更前に、新しい設定仕様と負例を表すテスト／契約検証を作り、現行方式で期待どおり失敗することを確認する。
- 既存公開拒否、内部Worker署名・利用者認証、`/ws`の既存機能を保つ。
- DockerビルドやWrangler操作は、リポジトリのAGENTS.mdに定める条件を満たす環境でのみ行う。本環境ではDocker buildを実行しない。
- build後はDockerfile・固定archive・image lock・deploy digestを同期し、ソースだけ直して完了としない。

**完了条件:** configtest、負例を含む経路試験、既存HTTP/WS回帰、成果物の版照合を満たし、未確認範囲が明記される。

### 6. 切替と記録

- 切替前に旧image digest、設定、戻し手順を保持する。
- 影響範囲を限定して段階的に切り替え、101だけではなく双方向通信と切断後の記録を確認する。
- 問題があれば直前のimage/configへ戻し、失敗応答・backend到達・ログ相関を追記する。
- NOTICEを実測で更新し、SPEC/EVAL/PLANは実装状態とずれないよう状態を更新する。

**完了条件:** 実際に反映した版、検証経路、失敗・未確認事項、復帰可能性が記録される。

## 依存・停止条件

- 実稼働版を特定できない場合、2.4.47以降を前提とする方式を適用しない。
- 公開WS pathを確定できない場合、allowlist化と既存Rewrite撤去を実施しない。
- `/lib`等の拒否×Upgrade試験ができない場合、公開vhostを変更しない。
- イメージ記録と実稼働版を結び付けられない場合、Dockerfileの版更新だけで完了扱いにしない。
- 既存のT3 PWA `/ws`と認証済みWorker内経路への影響が不明なら切替しない。

## 今回はしないこと

- Apache設定・Dockerfile・image.lockの変更。
- Docker build、コンテナ再作成、デプロイ。
- 公開WS pathの追加、Worker/Tailscaleを使う新しいWS proxyの構築。
- テストや本番セッションを使った疎通試験。

本PLANは今後の作業順を記録したもので、これらの作業をすでに実施したことや、運用上の許可を意味しない。
