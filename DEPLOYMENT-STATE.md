# コード・稼働環境・ユーザー指定の差分

最終確認日: 2026-10-22（UTC）。この作業セッションで確認できた範囲を記載する。本番への反映済み一覧ではない。

「実装済み」「ローカルで適用済み」「本番で確認済み」を区別する。確認していない本番の設定・デプロイ・DB状態は推測で埋めない。

| 対象・ユーザー指定 | 作業ツリーの状態 | 稼働環境で確認できた状態 | 残る差分・必要な対応 |
|---|---|---|---|
| 本体Dockerfileへの最新版TypeScript追加 | npm latestで確認した安定版7.0.2を固定してグローバル導入。tsc・tsserverのSSH用リンクとビルド時のtscバージョン確認を追加。プロジェクトの依存・lockfileは変更しない | イメージの再ビルド・稼働コンテナへの導入は未実施 | 許可された環境でビルドし、再作成後にtsc --versionを確認する |
| 本体Dockerfileへの最新版Vitest追加 | npm latestで確認した5.0.5を固定してグローバル導入し、SSH用CLIリンクとビルド時のバージョン確認を追加。プロジェクトの依存・lockfileは変更しない | イメージの再ビルド・稼働コンテナへの導入は未実施 | 許可された環境でビルドし、再作成後にvitest --versionを確認する |
| AIチャットの自動接続先の状態表示 | 接続済みの緑丸、接続可能候補の緑文字、接続不可・確認不能候補のグレー文字を表示。生存確認の古い応答による巻き戻りを防止 | 本番画面では未確認。このセッションではWorker未デプロイ | Worker反映後、実際の接続・切替・障害・認証時の表示を確認する。色付きメニューは標準selectの端末依存を避ける表示に変更 |
| cron起動のリポジトリチェックを完全停止 | scheduledから取得・関連Slack通知・次回予定登録を除去。共有ポリシーで直接呼び出しも停止 | 本番Workerの停止反映は未確認。このセッションではデプロイしていない | Worker反映と0183適用が必要。反映後、GitHub Trees API呼び出し・関連通知・次回予定の再生成がないことを確認する |
| 停止済みリポジトリcronの旧予定 | 0183で監査情報付き論理削除 | 本番D1への適用は未確認 | 0181・0182を先に適用する。削除履歴を保持し、一覧・保存済みポップアップから除外されたことを確認する |
| 6時間cronでCodexの5時間枠リセット予定を更新 | 取得・JST表示・旧予定の毎回論理削除と新規登録を実装。双方にcron Bot・日時・理由を記録 | 本番Worker未反映。稼働中libの/statusは秒を省略する旧形式 | libワーカーの秒付き出力、0181・0182、Workerを整合する順序で反映。取得失敗時に既存予定を壊さないことも確認する |
| AIチャットのCodex /status表示 | JSTのYYYY-MM-DD HH:mm:ssだけを中央寄せで表示する実装 | 本番画面での反映は未確認 | Workerとlibの反映後に実データで確認する |
| SlackのOFF設定を実送信に反映 | 全経路での整合性は未修正。tree-viewの自動送信経路は今回の停止変更で呼ばなくした | tree-view通知が全体スイッチを参照しない実装、コンテナレポートが専用スイッチだけ参照する実装を確認。本番の設定値は未確認 | cron停止を全通知経路の修復済みと扱わない。共通の送信判定、設定変更との競合・進行中処理の境界を整理して検証する |
| GitHub Trees APIの401 | 認証の調査のみ。認証情報は変更していない | ローカルgh認証では対象2リポジトリのTrees API取得成功。Worker側のGITHUB_TOKENの有効性は未確認 | cron停止と認証修復を区別する。再開前にWorker側の認証を確認する。秘密値を記録しない |
| ファイアウォールのログ | Dockerfileに収集プログラムを追加。カーネルログ非対応時は遮断カウンター増分を記録 | 現在のコンテナではinet/filterと収集プロセスを適用済み。/tmp/firewall.logへの実際の遮断件数の継続記録を確認 | イメージ再ビルドは未実施。再作成後にも起動することは未確認。ローカル適用をイメージ反映済みと扱わない |
| Apacheの実IP・SSHの日時・last導入 | Dockerfile・設定・起動スクリプトを変更済み | これらの変更を稼働サービスへ反映したとは確認していない | イメージ反映と再作成後の確認が必要。SSHのトンネル越し実IPは取得可能になっていない |
| 巡回日別の期限変更回数・変更前後の履歴表示 | 表示案の相談まで。日別集計画面は未実装 | なし | 再登録と実際の期限変更を区別し、ユーザーごとの複製を変更回数に重複計上しない仕様が必要 |

## 反映時の確認と記録

- DBマイグレーションは0181 → 0182 → 0183の依存順を守る。本番への適用済み・未適用は実際のマイグレーション履歴で確認する。
- Dockerビルドの実行制約はAGENTS.md・AGENT.mdに従う。このセッションでDockerビルドは行っていない。
- 本番確認後に、確認日時、対象環境、デプロイの識別情報、DB適用履歴、確認した挙動を追記する。テスト成功だけで本番欄を「反映済み」に変えない。
- 過去の不一致と解消の経緯が追えるように更新する。古い確認結果を現在の状態と取り違えないよう、日時を添える。

## 2026-10-22 push時の確認

- Vitest・TypeScript追加後、PR用ブランチ `feat/network-countdown-container-tools-20261022` で全体テストを再実行。`src/heritageJourney-start-end-cookie-scope-radius-20260824.test.ts` の出発地変更と入替ボタンのケースが失敗（約40秒・30秒）。失敗確認後に中断したため全件検証は未完了。今回そのテスト・画面・タイムアウトは変更していない。ユーザーから「それは無関係だからいいよ」と今回のpush禁止ルールの例外を承認された。失敗・全件未完了を明記してドラフトPRを作成する。全体テスト成功とは扱わない。
- `nekoserver/lib` の `main` へ `b584749` をpush済み。Codexリセット日時の秒保持と回帰テスト。Pythonテスト21件成功。稼働libワーカーへの反映とは別である。
- `nekoserver/cf-container` の既存ブランチ `docs/tunnel-restore-20261022` へ `35764d9` をpush済み。設定手順と復旧記録。mainへのマージ・環境変更は行っていない。
- 本体はpush前の全体テスト `npx vitest run --maxWorkers=2` を実行したが、`src/heritageJourney-route-apply-button-20260820.test.ts` の「適用すると◯泊△日が再計算される」が失敗した。失敗確認後に全体実行を中断し、該当ケースを単独で再実行して `Test timed out in 20000ms` を再現した（処理時間約53秒）。この画面と当該テストに今回の変更はない。全804ファイルの検証は未完了であり、他の失敗がないとは判断していない。
- 本体のpushは全体テスト成功を条件とする既存TESTPOLICYに従って未実施。関係する機能テストやPythonテストの成功を、全体テストの成功に代用しない。タイムアウトを黙って緩和したり、該当テストを除外したりしてpushしない。

## 2026-10-22 コンテナ管理のセクション移動

- `/cf-containers` の左パネルに全9セクションへのジャンプリンクを追加。単価表を含む対象と親の折りたたみを開き、フォーカスして移動する。直接のハッシュ指定・ハッシュ変更にも対応。
- 狭い画面ではメニューを上部に配置し、開閉できる。API・設定の保存先は変更していない。
- グローバルVitest 5.0.5でナビゲーション2件と埋め込みJavaScript構文1件が成功。ルートを含む既存ページテストは、ローカルに依存パッケージhonoがなく起動できなかった。ブラウザ実機確認・本番デプロイ・Dockerビルドは未実施。

## 2026-10-22 コンテナ構成プランナー

- 管理者・有効セッション限定の `/cf-containers/planner` を追加し、コンテナ管理の左メニューからリンク。追加容量（非圧縮MiB）・逐次コールドビルド時間（秒）、ベースと上限から合計・余裕・超過を計算する。
- 共有依存の重複除去、不明値の伝播、負数・循環・欠落依存の拒否に対応。初期候補は既存構成のCLI名だけを提示し、未計測の容量・時間を捏造しない。
- 計測根拠の入力、バージョン付きJSONの書き出し・検証付き読み込み、明示操作でのブラウザ保存・復元に対応。サーバー・別端末への自動同期、実ビルド・自動計測・過去文のAI分析は今回の実装に含まない。
- 本番Workerへのデプロイ・ブラウザでの実機確認は未実施。ルートの実行テストは既存ローカル依存不足で未確認。Dockerビルドは実行していない。

## 2026-10-22 ビルドステップ実測の記録

- migration 0184で観測・ステップの2テーブルを追加。BuildKit plainログのDONE秒・CACHED・ERROR・未完了を解析し、ハッシュ付き不変スナップショットをD1 batchで原子的に保存する。同一ログの再取得は重複除外し、完了ステップ数の多い観測を優先する。読み出し時にステップ件数の不整合も検出する。
- 管理ページのビルドログ取得と、既存6時間cron、管理者向けPOST `/api/cf-containers/build-timings/refresh` で収集。自動収集はAPIが返す直近8ビルドまでで、全履歴・リアルタイム収集の保証はない。
- プランナー生成時はD1から直近5ビルドの代表観測を読み込み、履歴切替・ステップ選択累計・実測時間の構成候補への追加に対応。並列作業の累計を経過時間と扱わず、キャッシュ・未完了の時間を0秒のコールドビルドと扱わない。イメージサイズはこのログから推測しない。
- ローカルVitest、実SQLiteで再取得重複除外・batch失敗ロールバック、Workerソースの構文を確認。本番migration・デプロイ、実ビルドでの収集、ブラウザ実機は未実施。Dockerビルドは行っていない。

### 2026-10-24 実測履歴の空レコード混入を修正

- 本番D1を読み取り照合したところ、25観測のうち一部は `step_count=0` で、Workers Builds API上ではWorkerのプレビュー等に対応する短いログだった。これらが `log_complete=1` として保存され、作成時刻の新しい順に5件表示枠を占有していた。0件のBuildKitステップを「実測履歴」として表示する不具合を確認。
- ソースではBuildKitステップが0件の観測を新規保存せず、既存の0件観測もプランナーの選択対象から除外。更新操作では保存数・ステップなしで除外した数・取得失敗の詳細を表示する。
- 変更はローカルソースのみ。Vitest・本番反映後の再照合は未実施。

## 2026-10-22 用途別の同梱指定

- 単一Dockerfileに INSTALL_DOCKER / INSTALL_VITEST / INSTALL_TYPESCRIPT / INSTALL_WRANGLER を追加し、Wranglerのimage_varsから選択可能にした。Dockerのみ既定false、現在利用する開発CLIは既定trueを維持する。
- 省略するCLIのリンクを作らず、選択結果をイメージ内container-features.jsonとhealth.featuresに残す。Dockerの意図的な未同梱を障害表示と区別する。
- Dockerfile各RUNのシェル構文、関連Vitestとserver.js構文を確認。再ビルド・デプロイ・実イメージでの各組み合わせの検証と削減量測定は未実施。現在稼働中のDockerは削除・停止していない。

## 2026-10-22 Codexリセット予定の本番再確認とSPEC整理

- 本番Workerのダウンロード内容でリセット予定の取得・登録コードを確認し、Cloudflareのschedules APIで `0 */6 * * *` と `5 * * * *` を確認した。上表の「本番Worker未反映」はこの確認で訂正する。毎時5分の処理はファイアウォール用であり、Codex予定の更新は6時間cronに接続されている。
- 稼働libの/statusは秒付きの5時間枠・週次枠を返した。上表の「秒を省略する旧形式」は現在の状態ではない。Codex予定の本番D1レコードは確認時点で0件であり、scheduledの一連の成功までは保証しない。
- 本番D1の0181・0182の列の存在、および0183対象予定の論理削除を確認済み。履歴テーブルによる実行履歴ではなく、実スキーマ・データの確認である。
- `SPEC.cloudflare-workers-github-oauth-1.codex-reset-countdown.md` を追加し、取得のコンテナ稼働前提、本体＋D1による停止中の参照、手作業削減、失敗時の保持を明文化した。最終試行・失敗状態のD1保存、期限経過時の更新待ち表示、追加の再試行は未実装として区別した。
- 今回のSPEC整理では実行コード・cron周期を変更せず、ビルド・デプロイも行っていない。

## 2026-10-22 複数コンテナ統計の再設計

- ユーザー指定により、対象案件・成果物は任意入力、集計を優先する。売上予測・費用配分・ROIは今回の対象外。
- migration 0186（既存ログへの識別情報とセッションメモ）と0187（複数コンテナの台帳・稼働区間・イベント・費用・任意対象物・書き込み条件）を追加。SQLとSPEC、制約テストを整備した。本番DBには適用していない。
- 0187は将来の収集基盤であり、DDL追加だけで現在のAPIが全て新台帳へ記録する状態にはなっていない。比較セクションの画面実装も未完了。
- 本番D1の過去operation_logにはコンテナIDがなく、スナップショット稼働数は単一デモの0/1。複数コンテナを利用した過去日数・同時稼働時間を復元できるとは判断しない。

## 2026-10-22 21:00 UTC 本番D1スキーマ再照合

- 本番D1 `workers-github-oauth`（`abbe590b-f7ff-4b98-b61c-17c8cb18c8cf`）の `sqlite_master` を読み取り、0186の4列・1索引・1テーブルの反映を確認。0187の9テーブル・3索引・2ビュー・18トリガーも存在し、DDL一致を確認した。上記の「0186/0187は本番未適用」という記載はこの確認で訂正する。
- 先に提示した欠落補完SQLの3テーブル・12索引・4トリガー・4列がすべて反映済み。取得対象のオブジェクト数は437から456。移行履歴テーブルがないため、適用実行者・日時・順序は未確認。この照合では本番への書き込みはしていない。
- スキーマ反映は新台帳への全収集経路の接続、過去データのバックフィル、比較画面の完成を証明しない。トリガーの本番発火試験・性能測定も未実施。
- 詳細: [DB拡張・欠落補完SPEC](SPEC.cloudflare-workers-github-oauth-1.database-schema-extensions-20261022.md)、[複数コンテナ統計SPEC](SPEC.cloudflare-workers-github-oauth-1.multi-container-statistics.md)。

## 2026-10-23 ネットワーク復旧

現コンテナのTLS8443、tunnels.rb、WebSocket/HTTP配信、隔離Codexワーカーを適用し、公開署名付きAPIの実回答を確認。observer用app-server UnixソケットとClaude専用認証は未解決。起動元ENVの一覧トークンは0件・稼働トンネル取得拒否で、別プロセスの検証済み既存値をcron用ファイルへ反映。Secret・イメージは未更新。詳細は [ネットワークREPORT](REPORT.cloudflare-workers-github-oauth-1.NETWORK.20261023.md)。Dockerビルド・デプロイ・再作成後検証なし。

## 2026-10-23 DeepSeek V4.1 Flash 1017追加

AIチャットの選択肢とAPI許可リストへ `@cf/deepseek-ai/deepseek-v4.1-flash-1017` を追加。表示色はティール `#14b8a6`。既存の共通色割当・D1保存経路を利用。関連モデル一覧・色設定テスト52件成功。Workerデプロイ・実モデルへの推論確認は未実施。

## 2026-10-24 ネットワーク再配置

現コンテナへlib CGI・Codex実行ワーカー・WebSocket・HTTPストリームを配置し、mygwの署名付きCodex実行、mygwとstream.test.cfcの配信認証、SSHトンネルのバナーを確認した。observerの対象Unixソケット、Claude認証、r9の10443待受は未解決。既存ENVの優先と取得失敗時のキャッシュ保持を維持し、非秘密の起動・更新設定をcf-containerへ保存した。起動元Secret、DNS、リモートTunnel設定、Worker、イメージは変更していない。再作成後の復元成功は未確認。詳細とセキュリティ情報は [当日REPORT](REPORT.cloudflare-workers-github-oauth-1.NETWORK.20261024.md) を参照。

## 2026-10-24: tunnels.rb応答内のアンダースコア表示

libのMarkdown表示と本体Worker共通Markdown表示で、`_`・`__`による強調解釈を停止。`*`による強調は維持し、APIのJSON応答は変更しない。libはキャッシュ対策のハッシュ付き資産を再生成し、稼働コンテナ `/var/www/html/lib` に反映した。本体Workerはソース修正のみで未デプロイ。libの5テストとWorkerの24テスト成功（Workerは環境内のVitest 5.0.5を使用）。ブラウザ実操作・本番Workerでの表示は未確認。


## 2026-10-24 10:41 UTC observer・r9の差分解消

ユーザー指定でapp-serverのソケットを `/run/lib-chat-app/app-server.sock` に統一し、現在の会話を読み取りAPIで照合した後observerを接続。mygw・streamの公開WebSocket/SSE/NDJSON/JSON-seqで実会話とheartbeat、SSEで会話の更新を確認した。r9の既存転送先に合わせループバックTLS10443を追加し、署名付きtunnels.rb・uptunnels.rbのHTTP200を確認。上記のobserver・r9未解決という記録は今回解消。Claude認証と起動元ENVの一覧トークン不一致は残る。コンテナ内へ適用済み、Dockerビルド・デプロイ・再作成後検証は未実施。詳細は当日NETWORK REPORT末尾。


## 2026-10-24 10:53 UTC r9をRedmineへ割り当て

r9専用TLS10443からRedmine7.0.2/Puma3009へ切り替えた。既存DBがなく新規PostgreSQL18.6を構成。公開ログイン画面・CSS200、未認証API401、新規管理者のログイン成功と初回パスワード変更画面を確認。mygw/stream/r8のlib API200を維持。r9で以前提供していたlib APIの疎通結果は切替前の履歴であり、現在の用途はRedmine。コンテナ内適用済み、再作成後は未確認。詳細は [Redmine REPORT](REPORT.cloudflare-workers-github-oauth-1.REDMINE-R9.20261024.md)。


## 2026-10-24 12:13 UTC 現在のドメイン割り当て表

CloudflareのCustom Domains・Routes・DNS・Tunnel ingressと稼働Apacheを読み取りで確認し、[ドメイン割り当て表](NOTICE.cloudflare-workers-github-oauth-1.DOMAIN-ASSIGNMENTS.20261024.md) を追加。本体は `1.wr1.nekomaneki.work`、SecureMineは同ホストの `/securemine`、Redmineはr9、AIチャットの接続先はmygwを維持。Route登録のみで対応DNSが見当たらない別名や、停止中cfc-tunnelの旧ingressも区別して記録した。表作成に伴う設定変更は行っていない。

SecureMine用HMACゲートウェイと接続先マップはr9へ適用済み。共通鍵そのもの・AIチャット設定は未変更。画面の既定URLと共通鍵の直接参照を行うソース修正は未デプロイで、利用者のAPIキーによる画面内の接続成功は未確認。

## 2026-10-24 SecureMineのRedmine機能メニュー

接続中のRedmineの全体機能と、選択したプロジェクトのWiki・作業時間・ガント・カレンダー・ロードマップ・文書・ファイル等を開くメニューをサイドバーに追加。APIキーを転送しない別タブの画面リンクで、権限・有効モジュールの判定はRedmineへ委ねる。管理リンクはAPIの管理者フラグに連動。未接続・デモ・接続先切替で旧リンクを破棄する。関連47テスト成功。ソースのみで未デプロイ・未push、実ブラウザ/iOS未確認。

## 2026-10-24 MoonBitサンプルページ

認証後 `/moonbit-sample` を開くと、本体Worker内の生成済みMoonBit BuildKitログ解析へ例を渡し、完了秒数・キャッシュ・エラー・未完了の解析結果を表示する。コンテナ構成プランナーにもリンクを追加。ソース追加のみで、テスト・Workerデプロイ・ブラウザ表示は未確認。


## 2026-10-26 15:48 UTC: askgk HTTP530/1033 継続障害

公開mygw `/lib/api/tunnels` はHTTP530・`error code: 1033`。Cloudflare APIの実測ではnekorootはdown・接続0件。本体 `cloudflare-workers-github-oauth-1-democontainer` の既存demoインスタンスはinactive、状態更新日時は2026-10-26T15:15:12Z。現在のRedmineコンテナで動くcfc-tunnelはhealthyであり、nekorootの代替ではない。同日のNETWORK REPORTにある両トンネルhealthy・公開API200は以前の測定結果で、現在の復旧を示さない。

既存の管理API `/api/cf-containers/action` にstartを要求したがHTTP401「認証が必要です」で起動できなかった。現環境のCloudflare管理トークンによる状態参照は成功したが、本体管理画面の管理者セッションはなく、起動の成功は未確認。管理者が本体の `/cf-containers` から既存コンテナを起動し、nekorootの接続・公開API・askgkを再確認する必要がある。DNS、トンネルの転送先・トークン、Worker、イメージは変更していない。


## 2026-10-26: askgkの本体停止からの独立と経路台帳

ユーザー指示により、本番本体WorkerのASKGK_TUNNELS_URLをmygwから `https://r9.nekomaneki.work/lib/api/tunnels` へ設定APIで変更し、他50 bindingsの維持を確認。独立Redmine Worker経由APIはHMAC GET200、rust-worker-sqlx-d1の署名付きPOSTでCodex done・`INDEPENDENT_CODEX_OK` を確認。本体停止中の成功。チャット画面自体からの認証付き操作は未実施。

推論処理内の固定ホストを除き、JSON経路台帳、設定による追加・削除・無効化・ID選択、チャット/Slack/cron共通の経路解決を実装。関連5ファイル67テスト成功。台帳実装はソースのみで未デプロイ。本番反映済みなのは既存単一URL設定。一般askgkのPOSTで検出した要求記録ディレクトリ欠落を現環境とRedmine起動ソースで修正。既存のobserver変更は保持。詳細と切替・復元方法は [経路仕様](SPEC.cloudflare-workers-github-oauth-1.askgk-routes.20261026.md)。Dockerビルド・イメージ更新は未実施。


## 2026-10-26: 独立側askgkのCGI 504修正

16:02:15 UTCのApacheログに `Script timed out before returning headers: tunnels.cgi`。独立Redmine側CGIの既定60秒が、tunnels.rbの90秒同期待機より短かった。直近のCodex要求2件は62.1秒・70.3秒でdoneになっており、CGIが切れた後もジョブ自体は完了していた。

`redmine/config/lib-httpd.conf` と稼働 `/opt/httpd/conf/lib-httpd.conf` のCGI専用Directoryに `CGIDScriptTimeout 105` を追加。API待機90秒＋内部ソケット待機5秒を確保し、呼出元120秒以内とした。Apache構文確認後graceful reload済み。既存ジョブを再送せず、署名Worker経由のask_id照会でHTTP200・done・保存済み回答の存在を確認。ソースと現コンテナへ適用済み、Dockerビルド・イメージ更新・再作成後確認は未実施。


## 2026-10-26: 設定ページの待ち時間保存と経路台帳を本番配備

Workerバージョン `c4886118-6819-42be-96a0-b718349b0c7f` を配備。D1に0189の新規テーブルと既定120秒のrevision=1を適用し、上限300秒の管理者設定API・設定ページ・共通送信処理を実装した。チャット/Slack/cronは各要求の開始時に保存値を参照。POSTは一度だけ送信し、同一ask_idを短い通信で照会する。経路台帳も同時に配備し、ASKGK_ROUTE_ID=independentを確認。設定API未認証401、配備済みソースに設定APIと非同期待機があること、本番DBの保存値、共通送信処理から本番署名Worker・独立コンテナへのCodex実回答 `TIMEOUT_SETTINGS_OK` を確認した。実利用者のログインセッションによる設定画面操作は未実施。

既存50 bindingsは配備前後で一致、新規ASKGK_ROUTE_IDのみ追加。Dockerfileを参照しない一時配備設定から、APIで確認した既存レジストリイメージb225cc9aを再利用し、Dockerビルドは行っていない。Wranglerはコンテナアプリケーションの宣言イメージ62758c7d→b225cc9aの更新も適用したため、再配置がなかったとは報告しない。復旧用の配備前Worker本体・settings・deploymentsはroot専用 `/root/.local/state/neko-independent/` に保存。

関連10ファイル122テスト、Ruby17件70 assertions、実Apacheの65秒遅延テストを含む2件、Apache構成4件が成功。追加の300秒設定で120秒を超えて待つテストも実装。リポジトリ全体typecheckは既存の無関係な型エラーで失敗しており、全体成功とは扱わない。独立側tunnels_lib.rbのwait_seconds対応とApache105秒設定は現環境・ソースに適用済みだが、Redmineイメージの更新・再作成後検証は未実施。詳細は経路仕様の「保存する待ち時間」。


## 2026-10-26: API/WASMを選べるコンテナ監視を本番配備

本体 `/container-monitor` と管理者専用 `/api/container-monitor/providers`・`/snapshot` を配備。最終Workerバージョン `ed80b713-ea19-4eb0-8df2-86db630a926f`。APIトークンがなければTailscale WASM、設定済みなら対応APIも選択できる。取得方式・資格情報判定・正規化を共通台帳へ分離。対象ホスト一覧のハードコードはなく、Cloudflare全アプリケーション/インスタンスのページ送りと部分失敗を処理する。監視取得ではコンテナを起動しない。

公式Tailscale Connectの配布済みJS/WASMをintegrity・SHA256照合して再利用。Docker/Goのソースビルドは行わず、同じ既存コンテナイメージを指定してWorkerを配備。Wranglerはコンテナアプリケーション変更なしを確認。既存52 bindingsの一致、未ログインAPI401、本番配信UIとローカルの一致を確認した。

ローカルでは11件の機能/APIテスト、実Cloudflare一覧取得1件、UIの注入・切替・トークン削除・古い接続表示を含む3件、Chromiumの公式WASM初期化が成功。追加モジュールの型チェックとdiff whitespaceも成功。実配信でgzipファイルとHTTP圧縮の二重扱いによるWASMヘッダ異常を検出し、読み込み側でファイルgzipを明示展開してBlobへ渡す処理に修正した。本番URLからChromiumでrun/login/fetchの初期化成功を再確認済み。

Tailscale APIの実トークンによる照会、実利用者のTailnetログイン後の端末到達性は未検証。WASMはブラウザ実行で、参照範囲はログインユーザーの権限に従う。tree-viewの既存全コンテナ検出との接続は未実施。確認したdynamicneko main/配備版は利用者別Sandboxの経路であり、別の検出経路は特定できていない。共通APIは他画面から再利用できる形としたが、tree-view側で利用済みとは報告しない。

復旧用Worker本体・settings・deploymentsはroot専用 `/root/.local/state/tailscale-wasm/` に保存し、Gitへ含めない。再取得可能なSDKキャッシュと、配布に必要なpublicアセット・ライセンス・出典/チェックサム・復元スクリプトは区別する。仕様は [コンテナ監視SPEC](SPEC.cloudflare-workers-github-oauth-1.container-monitor.md)。


## 2026-10-28: tree-view T3 Codeの本体demo起動・停止（実装済み・本番未反映）

T3 Codeタブの再接続の直前に起動/停止ボタンを追加する変更。本体のdemo DO状態を正として読み取り、CF-Worker/HMACと短寿命userTokenで新APIへ中継する。start/stopを明示し既存管理操作と同じDOロックで状態判定・実行をまとめる。状態不明・停止中はiframeを読み込まない。操作履歴を既存テーブルに保存し、no-opと停止処理中は完了と区別する。

Cloudflare settingsのメタデータで、mainのDYNAMICNEKO_WORKER_HMAC_SECRET、dynamicnekoのCF_WORKER_SECRET_MAINとTREE_VIEW_CONTAINER_ORIGINは未設定と確認。AICHAT_USER_TOKEN_SECRET、MAIN_WORKER、DEMO_CONTAINER、DBの設定名は存在する。秘密値の照合・設定変更は行っていない。main API/DOとdynamicnekoの両反映、および共有鍵とT3 HTTPS originの設定が必要。Dockerビルド・Worker配備・本番コンテナ操作は未実施。仕様はSPEC.cloudflare-workers-github-oauth-1.tree-view-t3-power.mdを参照。

対象API/DOの11件、既存管理等43件、dynamicnekoブラウザ9件・中継等Node検証は成功。全体テストは1178件成功後に既存heritageJourneyの国旗付与テストが20秒タイムアウト。単独実行は18.18秒で成功したが全件成功ではない。ユーザーから失敗を明記したドラフトPR作成の例外承認を得た。詳細はREPORT.cloudflare-workers-github-oauth-1.T3-POWER.20261028.md。

## 2026-11-04 ネットワーク再配置

現コンテナへlib API・WebSocket/SSE/NDJSON/JSON-seq・固定会話observer・SSIを適用し、公開mygwから実会話とCodex実生成を確認。既存ENV優先。Tunnel一覧は現在トークンの権限不足、stream/r9は初回530/502、最終APIは200だがSSIはRedmineの404となり、stream配信経路に外部条件が残る。Workerデプロイ・イメージ再ビルド・パッケージ更新は未実施。詳細と復元境界は [NETWORK REPORT](REPORT.cloudflare-workers-github-oauth-1.NETWORK.20261104.md)。


## 2026-11-04: askgkを本体コンテナへ一時切替

ユーザー指示で本番ASKGK_ROUTE_IDをindependentからmainへ変更。他53 bindingsは変更前後で一致。署名付きCodex実要求でdone・ASKGK_MAIN_READYを確認。wrangler設定もmainへ変更。独立側の認証エラーは未解決。Slack画面からの実行と自動フェイルオーバーは未検証・未実装。詳細は [切替REPORT](REPORT.cloudflare-workers-github-oauth-1.ASKGK-MAIN.20261104.md)。Dockerビルド・イメージ更新なし。


## 2026-11-04: 閉じたストリームの自動アクセスを停止

Worker `267061d1-7b3a-454b-b7c3-c697141e9167` を本番反映。閉じたパネル・非表示タブでpoll/iframeを停止し、自動候補をmygw限定、他候補は手動選択へ変更。関連39テスト・出力script構文確認成功。APIで54 bindings・既存コンテナ構成とversion 93の維持、配備済みソースを確認。Dockerビルドなし。既存画面は再読み込みが必要。実利用者のログイン済み画面の通信観察は未実施。詳細は [REPORT](REPORT.cloudflare-workers-github-oauth-1.STREAM-IDLE.20261104.md)。


## 2026-11-04: mygwストリーム投稿はSSH会話のwriter競合で未復旧

投稿許可200・console POST503を再現。履歴閲覧用App ServerでnotLoadedのため投稿時のみresumeする修正後、SSH Codexが同一会話を使用中でactive writer拒否を確認。ロックは保持し、HTTP409 console_in_useとして理由を返す改善を現コンテナへ反映。投稿先の専用会話化またはSSH会話維持をユーザーへ確認中。Python48テスト成功、Nodeは38/40（未変更sessionテスト2件location未定義）、生成script構文成功。Worker・イメージ更新なし。詳細は /root/lib/REPORT.console-post.20261104.md。


## 2026-11-04: mygw投稿専用会話によるアドホック復旧

ユーザー承認で元SSH会話の履歴をthread/forkし、mygw observerを投稿用会話へ原子的に切替。公開console POST200 accepted=trueとobserverでCONSOLE_POST_OKの回答を確認。元SSH会話のロックは維持、分岐後の履歴同期なし。別会話であることを表示名に明示しブラウザで表示。ユーザー指示により /root/lib/SPEC.lib.20261104.console-stream-adhoc.md にアドホック対応・恒久設計・移行条件を記録。イメージ更新・再作成後確認・利用者ブラウザの手動投稿確認は未実施。


## 2026-11-04: ストリーム投稿復旧・初期設定検証をmain workerとcontainer docsへ記録

mygw投稿用のfork threadへ切替後、公開POST200 accepted=trueとobserver上のCONSOLE_POST_OKを確認したため一旦解決。元SSH会話とは同期しない。初期設定確認をこのリポジトリの`NETWORK-STREAM-SETUP.md`とコンテナ内`/root/lib/ops/CHAT_WEBSOCKET.md`に記録。セットアップごとにtunnels.rb、WebSocket/SSE、observer、投稿後の実応答を確認し、REPORTへ残す。詳細は [CONSOLE STREAM REPORT](REPORT.cloudflare-workers-github-oauth-1.CONSOLE-STREAM.20261104.md) と [lib SPEC](../../lib/SPEC.lib.20261104.console-stream-adhoc.md)。Dockerイメージ更新・コンテナ再作成後検証は未実施。


## 2026-11-05: fx公式WASMのサンプルページ（本番未反映）

本体Workerに認証付き `/fx-wasm` を追加し、WASM一覧からリンク。公式libfx 0.0.16の配布済みWASMをSHA256照合して同梱し、模擬モデルの仮想ファイル読み書きを実Chromiumで確認。利用者のAI Gatewayキーによる実モデル接続も用意したが実通信は未検証。対象テスト7件とNode4件成功。Dockerビルド・CLI導入・Workerデプロイなし。詳細は [FX-WASM REPORT](REPORT.cloudflare-workers-github-oauth-1.FX-WASM.20261105.md)。

## 2026-11-05: 現コンテナのネットワーク再配置と会話一本化

現在ENVの会話と依頼本文を照合してobserverを設定。新しいforkは作らず、writer競合時は同じ会話のnative queueへ投稿する経路を現libへ反映。公開POST accepted=true/queued=trueと同じ会話に入力1件の保存を確認したが、writer取り込み・実応答は未確認。mygwの各配信/SSIとCodex/Claude実応答を確認。自動テスト138件成功。Cloudflare一覧権限不足、stream530/r9 502は残る。更新候補ca-certificates 1件を記録し、最終検証後にfirewall/nftログを取得。イメージ更新・Workerデプロイ・再作成後検証は未実施。詳細は [NETWORK REPORT](REPORT.cloudflare-workers-github-oauth-1.NETWORK.20261105.md)。

### 同一会話投稿の後続検証で確認済み

2026-11-05、キューへ投入したテスト投稿を同じ会話で実受信し、assistantがSTREAM_POST_OK_20261105を返答。公開mygwの認証済みストリームでも投稿と応答を確認し、native queueの該当件数0を確認。前項の「writer取り込み・実応答は未確認」は解消。fork・追加投稿・対象会話切替なし。実ブラウザ操作と外部トンネル障害の境界は変わらない。41-single-thread-delivery.logを参照。

## 2026-11-05: コンテナ専用のインストール後設定関数（イメージ未反映）

containers/demo/lib-network/post_install.pyへ設定関数を分割し、Dockerfileの配置処理とentrypoint/cronからの再適用を接続。libは独立checkoutのまま、ビルド時に公開済みLIB_NETWORK_REVISIONを必須指定する。Workerコード・bindings・wranglerの設定変更なし。コンテナ再作成後の同一会話は履歴・認証の復元が前提で、不在なら待機する。集約窓口による157件と既存コンテナ32件の計189件成功。Dockerビルド・配備は未実施。lib側の未公開修正の公開と、ビルド呼出側の固定リビジョン指定が必要。詳細は [CONTAINER POST-INSTALL REPORT](REPORT.cloudflare-workers-github-oauth-1.CONTAINER-POST-INSTALL.20261105.md)。

## 2026-11-05: 次回イメージのpreprint追加・4ツール更新（未ビルド/未配備）

preprint 0.1.2とChrome、cloudflared 2026.10.7、Tailscale公式バイナリ1.104.5、Claude Code 2.1.318、jj 0.47.1をDockerfileへ反映。jj配布物はpackages配下へ退避しCOPY再利用。preprint/T3 Codeの最新版チェックとapt自身の候補版の行を追加。T3の導入版0.1.3は変更なし。関連272件成功・1件スキップ、実CLI13チェック成功。Dockerビルド・Worker配備・実ブラウザ操作は未実施。自動Dockerfile反映はSPEC/PLANのみ作成し、他コンテナとの対応確認まで実装保留。詳細は [CONTAINER TOOLS REPORT](REPORT.cloudflare-workers-github-oauth-1.CONTAINER-TOOLS.20261105.md)。

## 2026-11-06: /askmuseの直接経路（未反映）

`/askmuse prompt="◯"`を実装した。経路は本体Worker → `DEMO_CONTAINER` → `server.js` → `tailscale nc` → muse-vm。ブランチ`feat/askmuse-direct-20261106`のソースのみで、未デプロイ。反映にはWorkerのsecret`MUSE_API_KEY`の設定とコンテナイメージの更新が要る。手順と未確認の項目は[仕様](SPEC.cloudflare-workers-github-oauth-1.askmuse-direct.20261106.md)。Dockerビルドは未実施。

## 2026-11-06: Museの死活確認と入力窓の枠色（未反映）

`/aichat`でスイッチが`muse`かつシグナル送信がONのとき、`GET /api/aichat/muse-health`で送信間隔（既定600秒）ごとに確認し、稼働中なら入力窓の枠をMuseの色にする。設定はMuseの行の⚙から開くモーダルで変え、Cookie`aichat_muse_signal`に保存する。ソースのみで、未デプロイ。`containers/demo/server.js`に`GET /muse/health`を追加したので、反映にはWorkerのデプロイとコンテナイメージの更新が要る。イメージが古い間は確認が失敗し、枠は既定の色のままになる。詳細は[SPEC](SPEC.cloudflare-workers-github-oauth-1.askmuse-direct.20261106.md)の「死活確認と入力窓の枠色」。

## 2026-11-06: /muse-status（未反映）

tailnet上の`muse`・`muse-vm`の起動状況、Nixのパッケージ、シグナル送信のページ`/muse-status`を実装した。ソースのみで、未デプロイ。`containers/demo/server.js`を変更したので、反映にはWorkerのデプロイとコンテナイメージの更新が要る。Nixの一覧の表示に要るノード側の`GET /nix/packages`は、2026-11-07に`muse-vm`へ追加した。`server.js`の中継がオフラインのノードで落ちる不具合の修正を含む。詳細は[仕様](SPEC.cloudflare-workers-github-oauth-1.muse-status.20261106.md)。


## 2026-11-07: Museの投稿前Tailscale確認と枠色・警告（未反映）

通常のMuse投稿と`/neko askgk muse_prompt`に、Runningかつmuse-vm onlineを必要とする接続ゲートを追加。確認不可なら中継以降を呼ばない。枠色healthも同じ判定を使用し、投稿時に古い結果を無効化、未接続では色を解除して「Tailscaleの接続状況を確認してください」を一度表示。HTTP失敗とunsupported_engine等の表示を区別。ソースのみで、Dockerビルド・Workerデプロイ未実施。検証と境界は[REPORT](REPORT.cloudflare-workers-github-oauth-1.MUSE-CONNECTIVITY.20261107.md)。

## 2026-11-07: Museのtunnelsフォールバックは初期OFF（本番未反映）

通常Muse入力の/askmuse変換を除去。Tailscale接続不可/確認不可かつtunnels明示ONの場合だけaskgkへ変換し、それ以外は直接Museか送信停止。Museの設定モーダルに初期OFFの切替を追加、Cookie保存とAPI明示値の優先を統一。直接送信後の実行失敗では中継へ再送しない。関連6ファイル273テスト成功、生成scriptのnode --check成功。Worker未配備。詳細は[REPORT](REPORT.cloudflare-workers-github-oauth-1.MUSE-TUNNELS-FALLBACK.20261107.md)。

## 2026-11-07: 現コンテナのネットワーク復元

現在 ENV を優先して lib の observer/LLM/WebSocket/SSE/NDJSON/JSON-seq、Apache SSI/CGI と制限ソケットを配置。mygw の実会話配信、Codex/Claude の実応答、Chrome のストリーム画面投稿受付を確認。投稿は現在 ENV の同一会話の native queue に1件待機し、応答は未観測。Tunnel一覧権限、別ホストの配信、Muse/Nemotron未対応等は残る。apt更新候補0。最終検査後にファイアウォールログを採取。ローカル稼働への適用であり、Worker/イメージの更新ではない。詳細は [NETWORK REPORT](REPORT.cloudflare-workers-github-oauth-1.NETWORK.20261107.md)。

### 2026-11-07 後続: ストリーム投稿の配信完了

同じ会話で実ブラウザ投稿を受信し、assistantのマーカー応答と実ユーザー投稿を公開mygwのobserverで確認。native queueの該当待機0件。直前の「応答未観測」は解消した。外部経路・未対応エンジン・本体親画面の検査は未完了。NETWORK REPORTと後続検証JSONを参照。

## 2026-11-07: muse-statusのブリッジ接続先を修正（本番未反映）

museは外向き専用なのでTailscaleの状態表示だけとし、health/Nix取得をmuse-vmへ限定。画面の初回・定期・手動操作、Worker共通処理、コンテナ中継でmuse:8080への接続を抑止。関連5ファイル124テストと生成scriptのnode --check成功。修正した中継を使って現コンテナから実muse-vmの/health HTTP200/status=okを確認。本番Worker・常駐server.js・イメージには未反映。詳細は [MUSE STATUS REPORT](REPORT.cloudflare-workers-github-oauth-1.MUSE-STATUS-BRIDGE.20261107.md)。

## 2026-11-07: スイッチがMuseのときのスラッシュコマンド（本番未反映）

スイッチが`muse`の`/usage`は、従来も本体Worker → `DEMO_CONTAINER` → `server.js` → `tailscale nc` → muse-vmのapi-bridgeへ届き、先方が推論せずに実行していた。問題はWorker側で、結果を通常のAI回答として保存し、`./usage`を別名として解決していなかった。応答の`bridge_command`があるときは`ai_chat_shares`へ保存せず`local/neko`として返し、`./usage`は`/usage`へ置き換えて送る。`/help`・`/status`・`/ping`・`/models`も同じ扱いで、`/Usage`のような大文字小文字の揺れは5コマンドに限って吸収する。`/ping`には本体Workerで測った往復時間を添え、api-bridgeの503は`muse_command_failed`として伝える。Tailscale停止・muse-vmオフラインでは従来どおり送らず、tunnelsへも切り替えない。muse-vm側の変更はなし。

このコンテナの`server.js`経由で実muse-vmへ5コマンドと未対応の`/nope`を送り、すべてHTTP200と`bridge_command`を確認した。本番Workerと`/aichat`の画面からの確認は未実施。

## 2026-11-07: /muse-statusを本体コンテナの停止中もTailscale WASMで取得（未反映）

本体コンテナが停止中のとき、ページの「Tailscaleへ接続」で公式`@tailscale/connect`のWASMがブラウザからtailnetへ参加し、muse・muse-vmの状態（netmap）とmuse-vmの`/health`シグナルを取得する。コンテナが使えるときは従来どおりコンテナ経由。Nixの一覧は`MUSE_API_KEY`をブラウザへ渡さないためWASMでは取らない。`/muse-status`にWASMとTailscaleへの接続を許すCSPを設定し、WASMの読み込みを`public/tailscale-wasm-client.mjs`へ共通化した（`/container-monitor`も使用）。`/health`が認証不要であることはMuseへの問い合わせ（D1`agent-inquiries`の`muse-status-wasm-20261107`）で得た、ソース上の回答で稼働版は未確認。ページのテストと実Chromeでの公式WASMの初期化（`NeedsLogin`まで、外部通信は遮断）を確認。実tailnetへのログインとmuse-vmへの到達、本番反映は未確認。Dockerビルド・Workerデプロイなし。詳細は[muse-statusのSPEC](SPEC.cloudflare-workers-github-oauth-1.muse-status.20261106.md)。
