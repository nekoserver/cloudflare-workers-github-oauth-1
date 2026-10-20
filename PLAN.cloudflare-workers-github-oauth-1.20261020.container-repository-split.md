# コンテナ作成部分を別リポジトリに切り出す案

作成日: 2026-10-20  
状態: 提案。実装・リソース移管・新規リポジトリ作成・デプロイは未実施。

## 1. 目的と対象

本体WorkerのCloudflare Containers用コンテナイメージの作成、ビルド・配備、実行管理を、
別リポジトリの専用Workerへ分離する。本体には管理画面、ログイン・管理者認可、
ブラウザ向けのAPIとプロキシの入口を残す。

本体の通常の更新と重いDockerビルド・イメージ配備を分離し、
コンテナ側の変更を独立して検証・配備できる構成を目指す。
リポジトリを分けるだけでは実行時の依存は解消しないため、Workerと設定の責務も分離する。

本案でいう「コンテナ作成部分」はDockerfile単体ではなく、イメージ内の起動処理と、
そのイメージを起動するDurable Objectクラスを含む。
管理補助機能のどこまでを専用Workerへ寄せるかは実装時に確定する。

移動先リポジトリ名・Worker名は未確定。
既存の `nekoserver/cf-container` を再利用する場合は、アクセス権と既存内容を確認してから判断し、
新規リポジトリとして扱ったり既存内容を上書きしたりしない。

## 2. 現在の構成と確認根拠

調査基点: [`d9e853d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d9e853d9e7f0cb274d197b265cd21853ba510eec) のmain。
以下のファイルサイズはGitHub Trees APIの非圧縮バイト数であり、
Git履歴、依存パッケージ、Dockerイメージ、実行中のデータ量を含まない。

- `wrangler.toml` に `[[containers]]`、`DemoContainer` のDurable Object binding、
  SQLiteクラス作成用のmigration、SSH公開鍵設定がある。
- `src/worker-entry.ts` が `DemoContainer` をexportしている。
- `src/containers/demoContainer.ts` はコンテナの起動・停止・再起動と排他制御を持つ。
  コンテナへシークレットを渡し、停止時にD1へ操作ログを記録する。
- シークレット更新APIの既存テストは、本体Worker名への保存を前提としている。
- 管理画面には状態、起動・停止・再起動、プロキシ、ヘルスチェック、
  Dockerダッシュボード、トークン更新、ビルドログ、トンネル一覧等の導線がある。
- 大きな `src/index.ts` 内に混在する関連APIの全実装は今回全文取得できていない。
  実装前に、呼び出し元と固定された本体Worker名を含め、全経路を追跡する。

## 3. 分離候補の規模

| 区分 | ファイル数 | 合計バイト数 |
|---|---:|---:|
| コンテナイメージの定義・同梱ファイル | 6 | 26,901 |
| コンテナ実行クラス | 1 | 6,502 |
| 関連補助処理 | 6 | 25,860 |
| 検証スクリプト・ログ用SQL | 2 | 8,665 |
| 関連テスト | 12 | 33,272 |
| **合計** | **27** | **101,200** |

- 最小の既存依存集合は9ファイル・42,498バイト（約42.5 kB、約41.5 KiB）。
  イメージ用6ファイル、実行クラス1ファイル、そのクラスが参照する
  操作ログ・シークレット関連の2ファイルである。
- 周辺機能・関連テストまで広く数えると27ファイル・101,200バイト
  （約101.2 kB、約98.8 KiB）。
- これは移動候補の棚卸しであり、27ファイルすべての移動を確定するものではない。
  料金計算、状態整形、ログ参照等は本体に残す選択肢がある。
- 9ファイルだけで専用Workerが独立稼働するわけではない。
  Worker入口、最小の型定義、Wrangler設定、依存関係の定義等を追加・調整する。

### ファイル別の内訳

| 区分 | ファイル | バイト数 |
|---|---|---:|
| コンテナイメージの定義・同梱ファイル | `containers/demo/Dockerfile` | 5,450 |
| コンテナイメージの定義・同梱ファイル | `containers/demo/apache-demo.conf` | 1,590 |
| コンテナイメージの定義・同梱ファイル | `containers/demo/cf` | 3,310 |
| コンテナイメージの定義・同梱ファイル | `containers/demo/cloudflared-ingress.yml.template` | 1,004 |
| コンテナイメージの定義・同梱ファイル | `containers/demo/entrypoint.sh` | 9,138 |
| コンテナイメージの定義・同梱ファイル | `containers/demo/server.js` | 6,409 |
| コンテナ実行クラス | `src/containers/demoContainer.ts` | 6,502 |
| 関連補助処理 | `src/utils/cfBuildsApi.ts` | 5,361 |
| 関連補助処理 | `src/utils/cfContainerCost.ts` | 3,632 |
| 関連補助処理 | `src/utils/cfContainerOperationLog.ts` | 4,971 |
| 関連補助処理 | `src/utils/cfContainerStatus.ts` | 2,335 |
| 関連補助処理 | `src/utils/cfWorkerSecretApi.ts` | 4,124 |
| 関連補助処理 | `src/utils/dockerDashboardProxy.ts` | 5,437 |
| 検証スクリプト・ログ用SQL | `migrations/0178_create_cf_container_operation_log.sql` | 331 |
| 検証スクリプト・ログ用SQL | `scripts/check-cf-containers.sh` | 8,334 |
| 関連テスト | `src/cf-containers-claude-cli.test.ts` | 546 |
| 関連テスト | `src/cf-containers-health-docker.test.ts` | 953 |
| 関連テスト | `src/cf-containers-health-tailscale.test.ts` | 997 |
| 関連テスト | `src/cf-containers-no-autostop.test.ts` | 652 |
| 関連テスト | `src/cf-containers-sshd-port.test.ts` | 771 |
| 関連テスト | `src/containers/demoContainer.secrets.test.ts` | 2,130 |
| 関連テスト | `src/utils/cfBuildsApi.test.ts` | 4,699 |
| 関連テスト | `src/utils/cfContainerCost.test.ts` | 3,718 |
| 関連テスト | `src/utils/cfContainerOperationLog.test.ts` | 4,998 |
| 関連テスト | `src/utils/cfContainerStatus.test.ts` | 2,999 |
| 関連テスト | `src/utils/cfWorkerSecretApi.test.ts` | 3,576 |
| 関連テスト | `src/utils/dockerDashboardProxy.test.ts` | 7,233 |

### 集計に含めていないもの

| 対象 | 現在の規模・扱い |
|---|---|
| `src/index.ts` | 全体1,309,766バイト。関連APIの部分抽出量は未集計。全文を移す案ではない |
| 管理画面と画面関連テスト | 3ファイル・41,084バイト。本体に残す想定 |
| `wrangler.toml`、`src/worker-entry.ts`、`src/types.ts` | 既存の全体コピーではなく、必要な設定・型・入口だけを専用Worker向けに分離 |
| `package.json`、`package-lock.json` | 専用Workerの最小依存に基づき作成・再生成。現在のロックファイル全体を移動対象へ加算しない |
| Dockerイメージ・ダウンロードするツール・実行データ | ソース規模とは別に実測する |
| 運用手順書・その他の関連テスト | 上記27ファイルで網羅したとは扱わず、依存調査で追加する |

## 4. 推奨する責務分担

| 本体Worker | 専用Worker・別リポジトリ |
|---|---|
| ログインと管理者認可 | Dockerfile、起動処理、イメージに同梱する設定・サーバー |
| `/cf-containers` 管理画面 | `DemoContainer` と起動・停止・再起動の排他制御 |
| ブラウザ向けAPIの入口 | コンテナ用のWrangler設定、依存関係、ビルド・配備 |
| 管理者権限を確認した操作の転送 | 許可された内部操作の実行 |
| 操作ログ・利用状況の表示 | コンテナ停止等のライフサイクルイベントの記録 |
| 認可済みプロキシの入口 | コンテナへの転送とストリーム等の取り扱い |

管理画面の既存URLを維持する方向で設計する。
本体から専用Workerへは、同じCloudflareアカウントのService Bindingを使う案を第一候補とする。
公開URLへ直接管理操作を送る構成を前提としない。

専用WorkerにHTTPの内部操作を追加する場合は、リポジトリの既存方針に従い、
`CF-Worker`、時刻、本文等を含むHMACの検証、タイミングセーフ比較、
リプレイ対策を設計する。Service Binding自体による到達範囲の制限と、
アプリケーションの管理者認可・内部要求の検証を区別する。
新しい名前・設定・シークレットは実装前に契約として確定し、今回のPLANでは追加しない。

外部WorkerのDurable Objectを本体からbindingで参照する構成も比較対象とする。
この方法でもシークレットやビルドログの対象Workerを変更する必要があり、
実際のSDK呼び出しとクラス依存を確認してから選ぶ。

## 5. 移行前に解消する依存

### シークレットと更新先

`NEKOROOT_TUNNEL_TOKEN`、`TAILSCALE_AUTHKEY`、`CF_CONTAINER_API_TOKEN` 等の
コンテナ用設定は、実行クラスが所属するWorkerで解決できる必要がある。
新Workerへ自動で継承されると考えず、安全な方法で移行する。

既存の更新処理・テストにある本体Worker名を専用Workerへ変更する。
本体のJWT・OAuth等のシークレットは移動しない。
更新に成功しても再起動が失敗した場合を、管理画面で区別できるようにする。

### D1の操作ログ

`DemoContainer.onStop()` の記録が失われると、表示する稼働時間等が不整合になる。
初期案では同じD1データベースのログを利用し、専用Workerからも記録できる方法を検討する。
同一D1へのbindingを採るか、本体側の認証された記録処理を呼ぶかを、
権限範囲と障害時の挙動を比較して決める。

既存DBのスキーマとログは保持する。
SQLファイルを候補一覧に含めたことは、本体から削除したり新DBを作ったりする指示ではない。

### 管理・通信経路

- 状態、instance ID、起動・停止・再起動、操作結果とログを一貫した契約にする。
- Dockerダッシュボード、プロキシ、ヘルスチェックのパス・ヘッダー・
  ストリーム・WebSocket等は、実際に利用している範囲を確認して維持する。
- ビルドログ取得は、コンテナを配備する専用Worker・ビルド設定を対象にする。
- トンネル・Tailscale・SSHの識別情報、権限、起動順序を移行前後で点検する。
- 本体用の認証Cookie等を、そのまま任意の転送先へ渡さない。
- `scripts/check-cf-containers.sh` は本体の構成に依存する箇所を調べて移植する。
- `sleepAfter` の値だけで自動停止すると判断しない。
  現行クラスでは `onActivityExpired()` が上書きされているため、実際の停止動作を確認する。

## 6. 既存インスタンスとデータの扱い

同じクラス名や同じinstance名を新Workerで使っても、既存namespaceの引き継ぎは保証されない。
次の2案から移行方針を明示的に選ぶ。

| 案 | 確認すること |
|---|---|
| 新しいnamespace・コンテナとして作成 | 必要データの退避・再設定、SSH・トンネル等の接続先、切替中の二重起動防止 |
| 既存Durable Object namespaceを移管 | 同一アカウント等の制約、利用中のWrangler・SDKでの対応、必要な設定と配備順序、参照元のbinding |

Durable Objectのnamespace移管と、コンテナのディスクやプロセス状態の保持は別の問題である。
namespaceを移せば実行中のすべての状態が保持されるとは約束しない。
本体は従来の `migrations` 設定を使っているため、最新の `exports` の手順を
検証せず混在させたり、既存migrationを書き換えたりしない。

## 7. 実装・切替の順序

1. 本体の関連API、固定されたWorker名、Cloudflare API呼び出し、
   コンテナと管理画面の全呼び出し元を調査し、移動範囲を確定する。
2. 移動先リポジトリ・Worker名、同一アカウント、ログの保存先、
   namespace移行方式、内部操作の契約を決める。
3. 操作の成功・失敗、認可、更新先、ログ、プロキシの互換性について失敗するテストを先に書く。
4. 別リポジトリに最小のWorkerとコンテナの定義・テストを作成する。
5. 本体の管理APIに専用Workerの呼び出しを実装し、管理画面のURLと認可を維持する。
6. 許可された環境で専用Workerをビルド・配備し、必要な設定を登録する。
7. データ退避と戻し手順を確認した上で、namespaceの移管または新規インスタンスへの切替を行う。
8. 状態・操作・ログ・各接続経路を検証した後、本体に不要となったコンテナ設定・クラスexport・依存を削除する。

本体から先に既存namespaceや必要なクラスを削除しない。
本体の切替とコンテナ側の更新は順序を管理する。
PRは最新のmainから作成し、他の未マージPRをベースにしない。

## 8. 故障想定・テスト・戻し方

| 故障想定 | 検証・対処 |
|---|---|
| Service Binding未設定、専用Worker停止 | 操作前に失敗を検出し、画面に理由を表示する |
| 管理者以外の操作・偽造内部要求 | 本体の認可と内部要求の検証で拒否するテストを作る |
| secretが旧Workerに保存される | 対象script名と保存後の再起動先を検証する |
| 起動・停止・再起動が競合する | 現行の排他制御を維持し、並行操作を試験する |
| 停止イベントのログが欠落・重複する | 記録失敗と稼働時間集計を検証し、異常を通知する |
| プロキシ・ストリームの応答が壊れる | 実際の利用経路でHTTP・利用中の接続方式を比較する |
| 切替時に同じトンネルを2台が使用する | 同時稼働させない切替手順を用意する |
| 移管後に旧参照先へ戻してしまう | 移管状態を確認し、namespaceの状態に応じた復旧手順を使う |

切替前は本体の既存構成を復旧基点として保持する。
namespace移管後は、単純に旧コードへ戻すだけで復旧できるとは扱わない。
コード、namespace、コンテナ内の必要データ、トンネル・シークレットの状態を
対応づけて戻し手順を決める。

Dockerビルドは、既存の `AGENTS.md`・`AGENT.md` に従い、
Claude Code WebかつOpus 5.5以上であることを確認できる環境だけで実施する。
この環境ではDockerビルドを実行しない。軽量テスト、全体テスト、実コンテナ検証を
区別して結果を記録し、未実施の検証を成功扱いにしない。

## 9. 完成条件

- 専用リポジトリから、コンテナ用Workerとイメージを再現可能にビルド・配備できる。
- 本体の管理画面から認可された状態確認・起動・停止・再起動・トークン更新ができる。
- 操作ログとライフサイクルイベントの記録が保持され、稼働時間等の表示が整合する。
- 現行で利用するプロキシ、Docker管理、ヘルスチェック、SSH・トンネル等の経路が動作する。
- 本体の通常配備で、コンテナイメージをビルド・配備する必要がなくなる。
- 必要データを失わない切替手順と、移管状態に応じた復旧手順が確認されている。
- 認証・秘密情報・操作権限が本体と専用Workerの間で適切に分離されている。

## 10. 代替案と未決事項

目的が重いDockerビルドの分離だけなら、イメージを作るリポジトリだけを分け、
実行WorkerとDurable Objectは本体に残す案も比較する。
この場合は本体で利用するイメージ参照・バージョン固定・更新手順の設計が必要だが、
実行管理全体を分離する案より変更範囲を小さくできる可能性がある。

未決事項は、移動先、移行方式、API抽出量、ログ記録方法、
ビルドと配備の設定、既存コンテナ内データの保存要件、復旧方式である。
本PLANの追加だけでは、これらの実装・外部設定変更を行わない。

## 11. 参照資料

- [Cloudflare Containers: Get started](https://developers.cloudflare.com/containers/get-started/)
- [Service bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)
- [Durable Object class exports・namespace移管](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/)
- [本体のコンテナ実行クラス](src/containers/demoContainer.ts)
- [本体のコンテナ設定](wrangler.toml)
- [本体の操作ログ処理](src/utils/cfContainerOperationLog.ts)
- [本体のシークレット更新処理](src/utils/cfWorkerSecretApi.ts)
