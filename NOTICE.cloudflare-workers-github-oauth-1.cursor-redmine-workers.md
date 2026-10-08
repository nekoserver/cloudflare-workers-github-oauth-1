# NOTICE: TaskMine / Redmine と本体WorkersのHMAC接続

更新日: 2026-10-08（JST）
対象: `cloudflare-workers-github-oauth-1` の `/taskmine` と、Apache上のRedmine。
本書はこの作業で実施した設定・修正・確認結果を記録する。ファイル名のcursorは整理用の名称であり、この接続にCursor APIは使用しない。

## 現在の接続構成

```text
ログイン済みブラウザの /taskmine
  → 本体Worker /api/taskmine/redmine（認証・接続先制限・HMAC署名）
  → https://mynw.nekomaneki.work/redmine-hmac
  → Apache mod_cgid の gateway.cgi（HMAC・時刻・nonce検証）
  → gateway.wsgi の共通処理
  → https://127.0.0.1（Apache / Passenger上のRedmine）
```

- 本体Worker: `cloudflare-workers-github-oauth-1`。
- 公開Worker URL: `https://cloudflare-workers-github-oauth-1.nekoflare.workers.dev`。
- TaskMine画面で入力するRedmine URL: `https://mynw.nekomaneki.work`。
- ゲートウェイURL: `https://mynw.nekomaneki.work/redmine-hmac`。
- Redmineの配置先: `/home/box/apps/redmine`。
- 接続時にはRedmine本人のAPIキーを入力する。HMACシークレットをブラウザへ渡さない。
- Redmine REST APIの有効化が前提。Redmineの操作権限は引き続きAPIキーのユーザー権限とワークフローで判定する。
- ブラウザは同一オリジンのWorkerへ通信するため、Redmine側のブラウザ向けCORS許可は不要。

## 発生した問題と修正

| 症状 | 確認できた原因・制約 | 対応 |
| --- | --- | --- |
| 当初の「URL・ネットワーク・CORS設定を確認してください」 | 当初の実装はブラウザからRedmineへ直接fetchする方式。表示だけでは通信失敗の原因を特定できなかった | ユーザー指定に従い、本体WorkerとApacheのHMACゲートウェイ経由へ変更 |
| `HTTP 503: Redmine HMAC接続がWorkerに設定されていません` | `REDMINE_HMAC_SECRET` または `REDMINE_HMAC_TARGETS` が未設定だと、Workerが送信前に503を返す。本番では接続先マップが登録されていなかった | Cloudflareの本番Workerへ接続先マップとApacheと同じ専用シークレットを登録 |
| Apacheゲートウェイの実配置 | Apacheにはmod_cgidとPassengerがあり、mod_wsgiは未導入だった | 共通検証コードを実行するCGI入口を追加し、Apacheへ配置 |
| 内部RedmineのTLS | 内部接続先は自己署名証明書を使う `https://127.0.0.1` | `upstream_ca` に信頼する証明書を指定。証明書検証を無効にしない |
| `HTTP 502: ApacheのHMACゲートウェイに接続できません` | Workerのfetchに `redirect: "error"` を渡すと、実際のWorkersランタイムが送信前にTypeErrorを投げた | `redirect: "manual"` へ変更。3xxは明示的に拒否し、本文ストリームをcancelする |

502の根本原因は実Worker上で以下の例外を再現して確定した。

```text
Invalid redirect value, must be one of "follow" or "manual"
("error" won't be implemented since it does not make sense at the edge;
use "manual" and check the response status code).
```

ApacheやTLSの問題に見える表示だったが、このケースはApacheへの送信前に失敗していた。
修正後は転送先を追跡せず、Locationもブラウザへ返さないため、署名やAPIキーを転送先へ流さない。

## Workerに反映した設定

本番Workerには以下の2つをシークレットバインディングとして登録した。

| 名前 | 設定内容 |
| --- | --- |
| `REDMINE_HMAC_TARGETS` | 下記JSONマップ |
| `REDMINE_HMAC_SECRET` | Apacheゲートウェイの `secret` と同じ専用共有シークレット |

```json
{"https://mynw.nekomaneki.work":"https://mynw.nekomaneki.work/redmine-hmac"}
```

ブラウザから渡されたRedmine URLがマップのキーと一致した場合だけ署名する。末尾スラッシュを含めずに登録する。設定マップで指定するゲートウェイはHTTPSで、URL内の認証情報・クエリ・フラグメントは許可しない。

再設定する場合のコマンド:

```sh
npx wrangler secret put REDMINE_HMAC_TARGETS
npx wrangler secret put REDMINE_HMAC_SECRET
```

今回の本番設定はCloudflare API経由で反映した。再設定時も、値をシェルの引数やログへ出さず、対話入力などで登録する。現環境はシークレット方式なので、`wrangler.toml` の `[vars]` に同名の変数を重複定義しない。

設定名は `src/types.ts` に追加した。認証付きルートは `src/index.ts`、署名と転送処理は `src/utils/redmineProxy.ts` に実装した。TaskMineの一覧・詳細・作成・編集・添付の通信をWorker経由へ変更し、ページのCSPの `connect-src` は `'self'` に限定した。

## Apacheに反映した設定

実環境ではmod_wsgiを追加せず、既存mod_cgidを使用している。

| 用途 | 配置・設定先 |
| --- | --- |
| 有効なVirtualHost | `/etc/apache2/sites-enabled/mynw-443.conf` |
| VirtualHostの実体 | `/home/box/etc/apache2/sites-available/mynw-443.conf` |
| CGI入口 | `/opt/redmine-hmac/gateway.cgi`（0755） |
| 共通HMAC検証・転送処理 | `/opt/redmine-hmac/gateway.wsgi`（0644） |
| 設定ファイル | `/etc/redmine-hmac.json`（root:www-data、0640） |
| 再送防止nonce DB | `/var/lib/redmine-hmac/nonces.sqlite3` |
| nonceディレクトリ | `/var/lib/redmine-hmac`（www-data:www-data、0700） |

設定JSONの構造（秘密値は記載しない）:

```json
{
  "secret": "<WorkerのREDMINE_HMAC_SECRETと同じ秘密値>",
  "upstream": "https://127.0.0.1",
  "upstream_ca": "/etc/apache2/ssl/local/server.crt",
  "nonce_db": "/var/lib/redmine-hmac/nonces.sqlite3"
}
```

既存の `/home/box/.config/redmine.env` にある `REDMINE_HMAC_SECRET` の値をゲートウェイとWorkerで一致させた。既存の `/lib/api` 向け `ORIGIN_HMAC_SECRET` とその署名プロトコルとは別の接続である。

VirtualHostに追加した内容:

```apache
ScriptAlias /redmine-hmac /opt/redmine-hmac/gateway.cgi
<Directory /opt/redmine-hmac>
    Options +ExecCGI -Indexes
    AllowOverride None
    Require all granted
</Directory>
<Location /redmine-hmac>
    PassengerEnabled off
    Require all granted
    LimitRequestBody 10485760
</Location>
```

この専用パスはCGI内でHMACを検証する。既存Redmine画面のIP制限・Cloudflare Access設定は維持した。
内部接続の証明書SANに `127.0.0.1` が含まれることを確認し、指定したCAによる検証を有効にした。
`apachectl configtest` が `Syntax OK` となることを確認した後、`apachectl graceful` で反映した。

## 再起動・環境復元への対応

以下をサーバー内の永続領域に配置した。

- ゲートウェイコード: `/home/box/opt/redmine-hmac/gateway.cgi` と `gateway.wsgi`。
- 秘密値を含む設定の原本: `/home/box/etc/redmine/hmac-gateway.json`（root:www-data、0640）。
- 復元スクリプト: `/home/box/bin/restore-edge.sh`。

復元スクリプトには、ゲートウェイコード・保護された設定ファイル・nonceディレクトリの配置処理を追加した。VirtualHostを生成するテンプレートにも専用パスを追加した。`bash -n` で構文を確認した。復元スクリプト全体の再実行と、再起動後の疎通はこの作業では実施していない。

Apache設定と復元スクリプトの変更前バックアップ:

- `/home/box/etc/apache2/sites-available/mynw-443.conf.before-redmine-hmac`
- `/home/box/bin/restore-edge.sh.before-redmine-hmac-runtime`

サーバー固有の設定・共有シークレット・復元スクリプトの変更はこのWorkerリポジトリのPRには含めず、サーバー内に反映した。公開できるプログラムと設定例は `deploy/redmine/` に収録した。

## HMAC署名と通信制限

WorkerからApacheへ以下のヘッダーを送る。

- `X-Redmine-API-Key`: Redmine本人のAPIキー。
- `X-Redmine-Timestamp`: UNIX秒。
- `X-Redmine-Nonce`: リクエストごとのUUID。
- `X-Redmine-Signature`: HMAC-SHA256の小文字hex。

署名対象は次の8項目をLFで連結したUTF-8バイト列。末尾LFは付けない。

```text
redmine-v1
HTTPメソッド
Redmine相対パス（クエリを含む）
時刻
nonce
APIキーのSHA256 hex
Content-TypeのSHA256 hex
本文のSHA256 hex
```

GETのContent-Typeと本文は空文字／空バイト列のハッシュを使う。ゲートウェイURLの `path` パラメータから相対パスを復元し、署名を照合する。

- 時刻差が60秒を超えるもの、署名不一致、再使用nonce、許可外APIを拒否する。
- nonceはSQLiteで共有し、署名時刻+120秒まで保持する。DB接続は処理後に閉じる。
- 必要な一覧・詳細・メンバー取得、課題作成・更新、添付操作だけを許可する。パスの逸脱も拒否する。
- Workerの更新操作は同一オリジンからのリクエストに限定する。
- APIキーは接続時にWorkerへ転送し、現在はSecureMineのログイン維持用にD1へ暗号化保存する（末尾のログイン保持設定参照）。ゲートウェイには永続化しない。秘密値や署名をログへ出さない。
- Workerの送信タイムアウトは30秒、ゲートウェイの内部Redmine接続は25秒。
- アップロード・ダウンロードの上限は10MiB。大きな応答はゲートウェイで拒否する。
- Workerもゲートウェイもリダイレクトを追跡しない。

## 検証結果と本番反映

- Vitest: 最終修正時点で関連2ファイル・22テスト成功。Workersの非対応redirectモードを再現したテストと、301/302/303/307/308の転送拒否テストを含む。
- Python: 5テスト成功。共通署名ベクトル、改ざん、期限切れ、nonce再送拒否、内部CA指定を検証。
- Apache設定検証、復元スクリプトの構文検証、`git diff --check` 成功。
- 公開ゲートウェイ: 署名付き課題一覧取得がHTTP 200。署名なしと同一署名の再送はHTTP 403。
- 一時診断Worker: `redirect: "error"` でTypeError、`manual` でApache・RedmineからHTTP 200を確認。診断Workerは検証後に削除した。
- 502修正は本番Workerの該当処理だけを緊急反映し、既存モジュール・設定・シークレット・バインディング・アセットを保持した。反映後のコードを取得してmanualモードと3xx拒否処理を確認した。
- その後PR #2288もマージ済みとなり、通常デプロイで維持できる状態になった。
- 最終的にユーザーから「入れたよ」と接続成功の報告を受けた。

リポジトリ全体の型チェックは、今回の変更外のテストファイルにエラーがあり成功していない。実Redmineでの作成・編集・添付操作の全機能確認と、復元後の再検証は未実施である。

## 関連PR・実装資料

| PR | 内容 |
| --- | --- |
| [#2284](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/2284) | TaskMine風Redmineページ追加 |
| [#2286](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/2286) | 本体Worker経由のHMAC接続、ゲートウェイと設定例 |
| [#2287](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/2287) | Apache CGI入口、内部CA検証、SQLite接続のクローズ |
| [#2288](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/2288) | Worker非対応redirectモードによる502の修正 |

全PRは2026-10-08時点でマージ済み。各後続PRは先行PRのマージ後に最新mainから独立して作成した。

関連実装: `src/utils/redmineProxy.ts`、`src/utils/redmineProxy.test.ts`、`src/views/taskmine.ts`、`src/views/taskmine.test.ts`、`src/index.ts`、`src/types.ts`。
設定・配置手順: `deploy/redmine/README.md`、`gateway.cgi`、`gateway.wsgi`、`apache-cgi.conf.example`、`apache.conf.example`、`config.json.example`、`test_gateway.py`。

## 再発時の確認箇所

| HTTP・症状 | 確認するもの |
| --- | --- |
| 503（HMAC接続未設定） | 本体Workerの2つのREDMINEバインディング。PRマージだけでは実環境の値は登録されない |
| 503（Worker設定不正） | 接続先マップのJSON形式、ゲートウェイのHTTPS URL |
| 403（接続先未登録） | 画面入力URLとマップのキーの一致 |
| 403（HMAC拒否） | WorkerとApacheのシークレットの一致、時刻同期、nonceの再使用 |
| 502（ゲートウェイ接続不可） | Workerのfetch設定、ゲートウェイURL、Apache・Cloudflare側の到達状況 |
| 502（ゲートウェイ内部エラー） | `/etc/redmine-hmac.json` の読取権限、nonce DBの書込権限、内部Redmine URL、CA・証明書SAN |
| 502（リダイレクト） | Cloudflare Accessや認証ページへの転送、公開・内部URLの指定 |
| JSON以外の応答 | CGIへの到達前のCloudflare/WAF/Apacheの拒否、別ページやURLへの接続 |

本番変更前後には、ブラウザのエラーだけでなく、実Workerの通信・Apacheへの到達・署名検証・RedmineのJSON応答を順に確認する。秘密値を出力して診断しない。

## 実データの取得・同期を中心にしたフロントへの更新

TaskMineは既存Redmineの普段使い用フロントとして、データの取得・同期・更新を中心にする。Redmineをデータの保存先とし、別DBへ複製しない。

- 初期表示は未接続とし、操作デモは明示的に選択する。
- 接続時に `users/current.json` でAPIキーのユーザーを確認し、名前を表示する。WorkerとApacheの許可リストに、この本人取得のGETだけを追加する。
- プロジェクトの説明・識別子・公開区分・更新日時を表示し、課題が0件でもプロジェクト情報を確認できる。
- 「同期」で本人情報、プロジェクト、ステータス、優先度、トラッカー、課題一覧、選択中の課題詳細を再取得する。
- 任意の60秒自動同期を追加。非表示タブと編集中は自動同期しない。
- 同期失敗時は前回取得したデータを保持し、失敗状態を表示する。取得失敗を「課題0件」と扱わない。
- 課題の作成・編集・コメント・添付は既存のRedmine更新APIを使い、保存後に一覧と詳細を再取得する。

確認時点のRedmine DBと署名付きREST API応答は、プロジェクト1件・課題0件・ステータス6種類・トラッカー3種類だった。空の課題一覧は取得失敗によるものではなく、接続先に課題が未登録だった。既存Redmineデータの投入・移行は実施していない。

このフロント更新で追加した本人取得APIを利用するには、WorkerとApacheゲートウェイの両方を更新する。コードや設定例だけのマージでは、Apacheの配置済みプログラムは更新されない。

## 画面名称とヘッダー表示の整理

画面名称をSecureMineへ変更し、ブラウザタイトル・画面ヘッダー・ウェルカムページのリンク表示を統一した。「今日の仕事を、ひと目で。」と「REDMINE WORKSPACE」を削除し、接続後のアカウント名・Redmine URL・ユーザー名を区切り記号で並べる表示も削除した。未接続・操作デモの案内と同期状態は引き続き表示する。接続時の本人確認とアカウント切り替えの処理は維持し、ページURLは `/taskmine` を使用する。

## SecureMine左上の当月コミットカレンダー

ログイン後の `/taskmine` で、左サイドバーの先頭に当月カレンダーを表示する。現在のワークスペースのGitHubコミットログを使用し、当月の日別コミット記録または月別集計に1件以上の記録がある日を薄水色（`#e0f2fe`）にする。Redmineへの接続やAPIキー入力を待たずに読み込む。

- API: 認証付き `GET /api/taskmine/commit-calendar`。ユーザーの現在のワークスペースだけを対象にする。
- 取得元: D1の `commit_list_cache`（`commit_count > 0`）と `commit_calendar_cache`（日付別の件数が正のもの）。複数リポジトリ・両取得元で同じ日付があっても1日として表示する。
- 月と日付は既存コミットログと同じ日本時間（Asia/Tokyo）で判定する。対象月以外・存在しない日付は塗らない。
- 日曜始まりで、うるう年・月初の曜日位置に対応。当日は輪郭で示し、コミットの有無は背景色で示す。
- カレンダーの更新ボタンで再取得する。DBやワークスペースの取得失敗は「ログ0件」とせず、取得失敗として表示する。
- コミットの本文や他ワークスペースの情報は返さず、対象年月と記録がある日番号だけを返す。

このカレンダーは本体Workerに保存済みのログを表示するもので、表示のたびにGitHubへ全コミットを再取得するものではない。Redmine自身のリポジトリ履歴は対象に含めない。DBマイグレーションやApacheの追加設定は不要。


## SecureMineログイン保持（7日間）

- 接続ボタンに回転インジケーターを表示し、本人確認・DB保存・Cookie更新の成功後に緑色の「ログイン完了」トーストを5秒間表示する。失敗時は完了表示を出さない。
- `POST /api/taskmine/login` はHMACゲートウェイ経由で `users/current.json` を確認する。同一オリジンのリクエストのみ許可する。
- マイグレーション `0168_create_securemine_sessions.sql` が必要。通常のdeployはD1マイグレーションを先に適用する。
- D1の `securemine_sessions` に接続先・表示名・本人情報・ログイン日時・有効期限と暗号化APIキーを保存する。`securemine_login_history` にログイン日時を追記し、`user_sessions` のログイン日時・最終操作日時・有効期間も同じDBバッチで更新する。
- APIキーはJWT_SECRETから用途を分離して導出した鍵によるAES-GCMで暗号化し、所有者IDと接続先URLに結び付ける。JWT_SECRET変更後は再ログインが必要。
- ブラウザにはランダムなセッションCookieだけを発行する（HttpOnly / Secure / SameSite=Lax、Path=/api/taskmine）。DBにはCookie値のSHA-256ハッシュを保存する。APIキーはCookie・localStorage・復元APIのレスポンスには含めない。
- 本体の認証JWTとCookieも接続成功時から604800秒（7日）へ更新する。SESSION_IDLE_TIMEOUT_SECONDSが明示設定されている場合、そのアイドル期限は引き続き優先する。強制revokeの確認も継続する。
- 再読み込み時は `GET /api/taskmine/session` から最後にログインした接続先を復元し、Workerが所有者・期限・接続先を確認して保存済みAPIキーを復号する。復元ではログイン履歴の追記や完了トースト表示をしない。
- ページ内で追加した複数アカウントは引き続き切り替え可能。再読み込みで復元する接続先は最後にログインした1件。課題・プロジェクトのデータ本体はRedmineに置いたまま。

ログイン情報の保存失敗はHTTP 502とし、画面にも `Redmine HTTP 502: ログイン情報を保存できません。接続設定とDBの状態を確認してください。` を表示する。テーブル作成SQLは `migrations/0168_create_securemine_sessions.sql`。既存user_sessionsには0054（last_activity_at）と0060（idle_timeout_seconds）の適用も必要。
