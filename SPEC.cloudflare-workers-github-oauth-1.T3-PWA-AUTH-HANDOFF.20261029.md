# T3 Code / tree-view → PWA 認証引き継ぎ仕様

策定日: 2026-10-29 UTC。状態: 認証引き継ぎは設計仕様。後続作業でmigration 0190の3テーブルを本番D1へ適用済み。API・native adapter・PWA・実機検証は未実施。

## 1. 目的と保証の境界

### 2026-10-29 実画面の401とのスコープ不一致

このSPECは **T3ネイティブのセッション**をPWAへ作る設計であり、現在表示された「ログイン状態を確認できません」(Dynamicnekoの`/api/tree-view/t3`と`/api/tree-view/t3/power`が返す401/403)を解消する設計ではない。これらのAPIはDynamicnekoの`session` Cookieと`SESSIONS` KVを検証するが、本SPECのD1記録は別Workerの本体D1にあり、Dynamicnekoの`SESSIONS`へセッションを作らない。DynamicnekoのDB bindingも本体D1とは別IDである。したがって本SPECを実装しても、この401が解消されるとは言えない。

この401を直すには、tree-viewの認証元からPWAのDynamicneko認証状態を安全に確立する別の交換経路が必要である。既存の本SPECをその実装仕様として流用せず、Dynamicnekoのセッション生成・権限範囲・Cookieの発行originを含めて設計し直す。現状はAPI未実装、本体D1のhandoff/session/eventは各0件、Dynamicneko側にhandoff設定はなく、PWA引き継ぎは動作しない。

固定ホスト候補の親ゾーン`nekomaneki.work`はCloudflareアカウント内でactiveと確認したが、利用中のAPI tokenではDNSレコードの読み取りが403となり、`t3.nekomaneki.work`の割当有無は確認できていない。候補ホストを設定済みとして扱わない。

### 現在のDynamicneko Tree View PWAの仕様先

実画面の401と、PWA上でDynamicneko `/tree-view` を使うためのセッション引き継ぎは [Dynamicneko Tree View PWA session handoff SPEC](../dynamicneko/SPEC.dynamicneko.20261029.tree-view-pwa-session-handoff.md) を正とする。この文書の以降の§2–11は、T3 Code単体をトップレベルPWAとして使い、T3ネイティブセッションを作る別機能の提案である。Tree View PWAのDynamicneko `session` Cookieを発行する機能ではなく、現在の401は解消しない。

## 2. 固定ドメインと配置

PWAの採用候補は **`https://t3.nekomaneki.work/`**。名前の空き・所有・DNS・既存割り当て・証明書は未確認であり、現時点のURLとして案内しない。競合があれば別名を決定し、初回本番公開前に一つに固定する。

同じ公開originで次を提供する。

| 経路 | 所有する処理 |
| --- | --- |
| `/`、T3静的アセット、T3 API、WebSocket | 固定ホストのgatewayから対象T3へ中継 |
| `/pwa/manifest.webmanifest`、`/pwa/sw.js` | 固定ホストのPWA用ファイル |
| `/pwa/connect` | PWA内で開始・承認待ち・接続完了を表示する画面 |
| `/pwa/handoff/*` | 同じ固定ホストの認証引き継ぎAPI |

ブラウザ → 固定ホストgateway（Worker）→ サーバー側で選んだ本体コンテナ → loopbackのT3 proxy3774 → T3 3773とする。WorkerはService Binding/既存の認証されたコンテナ管理経路を使い、必要なHTTP/WebSocketの中継を実装する。T3 HTTPの成功だけでWebSocketの中継成功とは扱わない。

固定ホストgatewayのroute所有者・D1所有者は本体Workerとする。既存本体ホストの画面/APIへT3用Service Workerを登録しない。コンテナの公開ポートやDNSを追加する具体的操作は、実装時に既存経路と照合してから決定する。管理APIのパスや認証をT3の公開経路へ混在させない。

外向きoriginは設定の正本からのみ決定する。ブラウザが指定する転送URL・Host・コンテナ名・環境IDから上流を選ばない。Quick Tunnelは現行試用の接続先としてのみ扱い、PWAのmanifest、start_url、scope、インストール先に採用しない。固定ドメイン導入時もmygw・r8・r9・streamの割り当てを無断で変更しない。

manifestのid=`/pwa/t3`、scope=`/`、start_url=`/pwa/connect`、display=`standalone`を初期値とする。通常起動はT3セッションを照会し、有効ならT3画面へ、無効なら接続画面へ進む。start_urlへ引き継ぎコード・pairing credential・利用者情報を埋め込まない。公開前に既存T3のmanifest/Service Workerとの競合を調べ、配布する登録を一つに統合する。既存T3が生成する絶対URL・WebSocket URL・リダイレクトも固定originと一致させる。

## 3. 正とする設定と認証境界

- 設定は本体の `T3_PWA_ORIGIN`（固定HTTPS origin）、`T3_PWA_HANDOFF_ENABLED`、owner→対象T3環境の許可対応を正とする。既存ENV/Secretを優先し、既存HMAC鍵を勝手に生成・置換しない。
- 実行時は本体がスイッチ・owner認可・環境対応・環境世代を毎回確認する。設定取得不能・未設定・不明な値は拒否。OFF後はcreate/approve/claimを拒否し、未消費の要求を無効化する。OFFは既存T3セッションの失効と同義ではなく、別操作で扱う。
- tree-viewの承認は既存ownerセッションとCSRF/完全一致Origin確認を必須とする。dynamicneko→本体は既存のService Binding、短寿命userToken、時刻付きHMACを使う。本体でもuserTokenとownerを検証し、UIのowner判定を信用しない。
- PWA初回は未認証でも要求を作れるが、それだけではプロジェクト閲覧・CLI実行・コンテナ起動の権限を得ない。承認と受け取り端末の所持証明が両方必要。
- iframe内のT3にある認証情報を親JavaScriptで読む設計にしない。postMessageを使う場合も、固定のmessage種別、完全一致origin、期待するsource windowを検証し、Cookie/長期credentialは送らない。
- 既存T3のscopeを維持し、ownerの明示承認したscopeだけを新セッションへ渡す。初期scopeは `orchestration:read`、`orchestration:operate`、`settings:write`、`providers:manage`、`diagnostics:read`、`terminal:read`、`terminal:operate`、`source-control:write`、`filesystem:read`、`filesystem:write`、`preview:operate` に固定する。access/relay管理とenvironment:maintainは含めない。ブラウザからの追加指定は拒否する。scope追加は本SPECの改訂と再承認を必要とし、既存セッションへ遡及追加しない。新セッションは最大24時間、利用による自動延長なしとする。native adapterでこの権限・期限を強制できることを有効化条件とする。

## 4. 利用者の操作と通信手順

### 4.1 PWAから開始

1. PWAが有効なT3セッションを持つ場合はそのまま開き、引き継ぎ要求を増やさない。
2. 未認証の場合は「tree-viewで承認」を押す。PWAはWeb Cryptoで256bitのdevice secretを生成し、SHA-256 challengeだけをcreateへ送る。秘密値はこのPWAのsessionStorageのみへ保存し、終了・成功・期限切れで削除する。
3. WorkerはランダムなrequestIdと照合用の短いコードを発行し、5分で失効させる。短いコードは承認時の見比べ用であり、それ単独で検索・承認・claimできる認証情報ではない。
4. PWAはrequestIdを含むtree-view承認画面を案内する。PWAへのリンクをOSが外部ブラウザへ開くことを前提にしない。PWAを起動したまま待機し、承認はブラウザ側のtree-viewで行う。アプリ復帰時に状態照会を再開する。

### 4.2 tree-viewで承認

5. tree-viewはログイン済みownerに、対象T3環境・PWAの固定ホスト・照合コード・有効期限・付与scopeを表示する。本人がPWAに表示されたコードと見比べて明示承認する。単なるGET、リンクプレビュー、承認画面の表示では許可しない。
6. dynamicneko経由の署名付きapproveを本体で認証し、pending→approvedを期限・owner・環境世代を条件に更新する。approve/rejectの競合は最初の有効な更新だけを採用する。承認はT3起動やモデル呼び出しを行わない。

### 4.3 PWAで受け取る

7. PWAはdevice secretをPOST本文に付け、challengeを検証できる要求だけで状態を照会する。2秒間隔から最大10秒へバックオフし、画面非表示で停止、表示復帰で再開する。照会はgrantを消費せず、T3を起動しない。
8. approvedを受けたPWAがclaimをPOSTする。Workerは同じ所持証明、完全一致Origin、期限、許可対応、環境世代を再検証し、D1の条件付き更新でapproved→redeemingを一度だけ取得する。
9. 取得できた一つの処理だけが、署名された内部経路でnative adapterへ要求する。adapterは対象環境のネイティブT3認証を利用し、新しいブラウザセッションを作る。引き継ぎ用のpairing grantを使う場合も内部で発行・交換し、ブラウザやD1へ返さない。CLIに任意引数を渡す公開APIは設けない。
10. adapterからセッションID・環境・scope・期限を照合できたら、同じattempt IDのredeeming→consumedと監査をD1で確定する。その後だけ固定ホストのclaim応答でT3のHttpOnlyセッションCookieを設定する。PWAが直後にnative session APIを呼び、有効なセッション・対象環境・付与権限を確認して初めて「接続済み」にする。応答の200だけでは成功表示しない。
11. session確認後、device secretを削除してT3画面へ進む。同じ会話・プロジェクトはT3サーバーのデータから表示する。iframeとPWAのセッションIDは別とし、Cookieが同一であることを受け入れ条件にしない。

最初のセットアップだけでPWAとブラウザが自動的に同じ利用者だと判断することはできない。初回承認は必要。有効なPWAセッションが残る通常起動時の再承認は不要とする。

## 5. API契約（新設予定）

全応答はCache-Control: no-store。秘密値をURL queryやアクセスログへ含めない。以下は新設予定であり現行APIとして呼び出さない。

| 経路 | 認証・役割 | 成功時 |
| --- | --- | --- |
| POST 固定T3ホスト `/pwa/handoff/create` | exact Origin、device challenge、発行制限 | 201: requestId、照合コード、expiresAt、承認画面の固定URL |
| POST 同 `/status` | requestId＋device secretの所持証明 | 200: pending/approved/rejected/expired/failed、expiry。grantやCookieは返さない |
| POST 同 `/claim` | requestId＋所持証明＋exact Origin | 200＋Set-Cookie。重複/処理中は409 |
| POST 同 `/cancel` | 同じ所持証明 | 204、未実行状態のみcancelledへ |
| POST dynamicneko `/api/tree-view/t3-handoff/decision` | owner＋CSRF＋exact Origin | approve/rejectを署名付きで本体へ転送 |
| POST 本体 `/api/tree-view/t3-handoff-external` | Service Binding＋既存HMAC＋userToken | decisionをownerとして条件付き適用 |

無効な要求の有無を所持証明なしに列挙できる応答は返さない。本文上限4KiB、requestId/secretの形式と長さを固定。最初のレート制限はcreateを送信元あたり毎分5件、承認をownerあたり毎分10件、状態照会をrequestIdあたり毎分30件とし、複数Workerで共通に適用する。超過は429。通信元の生IPをD1の履歴へ常設保存しない。

## 6. D1モデル、競合、期限

migration 0190のテーブル: `t3_pwa_handoffs`、`t3_pwa_sessions`、`t3_pwa_handoff_events`。同じ認証引き継ぎの正本をD1一か所に置き、UI/Worker/cronで別の承認台帳を作らない。

- id: 推測困難なrequestId、主キー。
- device_challenge: device secretのSHA-256。秘密値そのものは保存しない。
- target_origin、target_environment_key、environment_generation: サーバーが決定した接続先と認証状態の世代。
- status: pending/approved/rejected/redeeming/consumed/failed/expired/cancelled。
- approved_by: 検証済み内部owner ID、approved_at、approved_scopes。
- created_at、expires_at（createから300秒、承認・照会で延長しない）。
- attempt_id、claimed_at、completed_at、failure_code。native session IDは必要な失効・照合用途に限り保持し、セッション秘密値は保存しない。

D1にT3 Cookie、pairing credential、device secret、HMAC鍵、長期Bearerを保存しない。challenge比較は定数時間の比較を使う。

claim権取得は単一の `UPDATE ... WHERE status='approved' AND expires_at > now AND ... RETURNING ...` 等で条件判定と更新を一括実行する。プロセス内mutexや、SELECTの後に無条件UPDATEする実装で代用しない。複数Workerからの同時claimは一つだけ成功する。

履歴は別のappend-only `t3_pwa_handoff_events` に、日時・起点・owner・対象環境・from/to状態・attempt ID・結果分類を保存する。状態変更と必須監査はD1の同一トランザクションで確定する。監査保存できなければ承認・claimを許可しない。通常APIは期限切れ・キャンセル・削除済み要求を有効な承認として参照しない。

expires_atは全操作時に評価し、cronの削除を待って失効する設計にしない。要求は最終状態への更新から最低30日、監査は記録から最低30日、セッション台帳は有効期限・ログアウト・失効のうち最も遅い日時から最低30日保持した後、明示した保持ジョブで削除する。FKを維持し、削除順は監査→セッション→要求とする。保持ジョブ自体は未実装。device secretは削除済みなので監査履歴から再認証しない。長期監査保管は別途必要なら別仕様とする。

## 7. 途中失敗と復旧

D1の更新とT3のセッション作成は分散トランザクションではない。claimのexactly-once完了やCookieの到達までは保証しない。

- claim前の認証失敗、OFF、期限切れ、承認拒否、世代不一致: T3へ接続せず終了。
- redeeming取得後の重複claim・タイムアウト: 自動的にapprovedへ戻さず、同じgrantでのセッション再発行を禁止する。利用者はPWAのnative session照会を先に行い、無効なら新しい引き継ぎを開始する。
- 内部交換失敗、D1完了更新失敗、応答断: 成功表示しない。作成済みセッションを識別できる場合はadapterで失効する。できない場合はattempt IDから照合する復旧ジョブで処理する。
- redeemingが60秒継続したものは照合対象とし、自動再実行せずfailedへ確定する。adapterはattempt IDと作成セッションを機密値なしで照合・失効できることを実装前提とする。D1破損から承認やCookieを再生成しない。
- 正常完了後もCookieがPWAに保存されたかはサーバーでは断言できない。PWAからnative session確認成功を得た時点だけを利用可能と表示する。
- T3再作成や認証ストア初期化でenvironment ID/鍵が変わった場合、旧世代の未消費要求を無効化する。新しいT3への自動再ペアリングは禁止する。
- T3/コンテナ停止中は接続待ちを返し、handoff処理やstatusによって暗黙起動しない。起動が必要なら既存電源操作でownerが明示的に行う。
- コンテナ停止・再起動とclaimの競合は本体の環境世代確認とnative adapterの実環境照合で拒否する。古いoriginや環境設定をキャッシュして交換しない。

失効は「未消費要求のキャンセル」と「発行済みT3セッションの失効」を分けて実装・表示する。tree-viewのログアウトだけで既存T3セッションが消えるとは表示しない。ownerのT3アクセス取消時には対象PWAセッションをnative側でも失効できる管理経路を用意する。

## 8. Cookie、PWA、キャッシュ

T3 Cookieはネイティブcookie名/pathとの互換性を維持し、HttpOnly、Secure、host-onlyとする。Domain=.nekomaneki.workへ広げない。現在のiframe proxyのSameSite=None; Secure; Partitionedを維持した場合でも、PWAでのclaim応答によりPWA側コンテキストのCookieを作る。ブラウザの第三者Cookie設定変更やStorage Access APIの許可を必須にしない。

gatewayは許可したT3 Cookieだけを中継し、内部管理Cookieや任意DomainのSet-Cookieを返さない。Cookie付き変更APIには既存native認証・Origin/CSRF保護を適用し、CORSをワイルドカードにしない。WebSocketにもnativeセッション認証と許可Origin確認を維持する。

Service Workerはhandoff、session、pairing、プロジェクト/会話API、認証応答をキャッシュしない。オフライン画面は未接続と表示し、承認・claim・モデル入力をbackground syncで再送しない。認証情報・handoff URLをmanifest/start_url/通知/履歴/Refererへ残さない。handoff画面はReferrer-Policy: no-referrerとする。

## 9. 実装前に確定するnative adapter条件

導入済みT3 0.1.3のCLIはpairing作成・scope・TTL・公開base URL指定を持つ。クライアントのbrowser-session契約にはcredential交換がある。ただしサーバー側から作ったセッションを固定ホストで設定する互換性、session IDの取得、attempt IDによる照合、24時間以内の期限強制、scope制限、失効、WebSocket認証はまだ検証していない。

実装は固定したT3バージョンでこれらをPoC確認してから進める。adapterは認証済み内部呼び出しだけを受け、任意RPC/コマンド/パス/プロバイダー設定を受け付けない。秘密を含むCLI stdoutやHTTP応答は一般ログへ流さない。ネイティブDBへの直接INSERTや署名鍵の持ち出しでセッションを偽造しない。

作成後の照合・失効が実現できなければhandoffを有効化しない。その場合は既存の明示的なt3 pairを利用できる状態を維持し、未実装の自動引き継ぎを成功表示しない。

## 10. 受け入れ条件と試験

1. Android/ChromeとiOSホーム画面PWAで、iframeのCookieを共有できない初期状態から開始する。PWA起動→owner照合/承認→PWA内session確認→T3プロジェクト表示→WebSocket利用を確認する。Safari/Chromeタブで成功しただけではPWA成功としない。
2. PWAを閉じ再起動して有効セッションが復元され、期限切れ・Cookie削除後は再承認へ戻る。インストール前後とiframe/ブラウザ/PWAの組合せを分けて確認する。
3. 未認証・非owner・別Origin・改変署名・期限外userToken・偽challenge・別requestId・別環境・OFF・設定取得失敗ではセッションを作らない。
4. 2Worker同時claim、同時approve/reject、cancel/claim競合、失効直前のclaimで有効な遷移が一回だけになる。再試行で別セッションを増やさない。
5. D1障害、監査保存失敗、adapter停止、セッション作成直後の切断、完了更新失敗、Cookie保存拒否を故障注入し、成功表示しないこと、照合/失効/新規要求で復旧できることを確認する。
6. 古いpending/approvedの再利用、認証ストア初期化後の旧grant、論理削除/破損レコード、期限切れのキャッシュ応答で認証を再生成しない。
7. 固定ホストのDNS/TLS、manifest/scope/start_url、Service Worker更新、HTTP/WebSocket、Cookie属性、PWA起動originの一致を実測する。上流変更後もPWAの入口が同じであることを確認する。
8. 未認証native API401と既存HMAC配信・mygw/SSH・r9用途が維持される。T3停止時に照会やiframeがコンテナを暗黙起動しない。
9. D1・アクセスログ・監査・trace・例外ログ・アセット・Gitから長期資格情報とdevice secretが漏れない。引き継ぎ拒否や失効後に古い接続が再認証できない。

## 11. 導入順と完了の定義

固定ドメインの割り当て確認 → native adapter PoC → D1 migration/保持・失効ジョブ → 本体gateway/API → dynamicneko承認画面 → PWA → OFF状態で配備確認 → 隔離データで失敗系 → 実機PWA確認 → owner向け有効化の順とする。共有Secretの実値をSPECやREPORTへ書かない。

D1に保存できたこと、CLIでpairを発行できたこと、HTTP200、ローカル単体テストだけで完了とはしない。必要な双方Workerと固定ドメイン/PWAの本番経路を確認し、確認日時・ソースコミット・実機/OS/ブラウザ・残る制約をREPORTとDEPLOYMENT-STATEに記録する。

Dockerビルドは既存AGENTS.md/AGENT.mdの制約に従う。このSPEC作成をDNS変更、migration適用、T3更新、Workerデプロイ、認証引き継ぎの実装成功と扱わない。

## 参照

- [既存T3接続仕様](SPEC.cloudflare-workers-github-oauth-1.20261020.container-t3.md)
- [既存tree-view電源/owner認可仕様](SPEC.cloudflare-workers-github-oauth-1.tree-view-t3-power.md)
- [T3セットアップREPORT](REPORT.cloudflare-workers-github-oauth-1.T3-SETUP.20261029.md)
- [T3公式remote access](https://github.com/pingdotgg/t3code/blob/main/docs/user/remote-access.md)
- [T3公式認証設計](https://github.com/pingdotgg/t3code/blob/main/docs/internals/environment-auth.md)
- [CHIPS/Partitioned Cookie](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Third-party_cookies/Partitioned_cookies)
- [WebKitの保存領域/追跡防止](https://webkit.org/tracking-prevention/)


## 12. DB準備・ログイン日時の記録（後続依頼）

migration `0190_create_t3_pwa_handoffs.sql` を作成し、本体DBへ個別適用した。3テーブル・10索引・14トリガーがローカル定義と一致し、作成直後の3テーブルは0件であることを読み取り確認。既存migrationの一括再適用、Workerデプロイ、認証の有効化は行っていない。

`t3_pwa_sessions` には非秘密のnative session ID、owner、環境/世代、scope、attempt IDに加え、以下を記録する。日時はすべてサーバー側で検証したUTC Unix秒のINTEGERとする。

| 列 | 意味・記録する時点 |
| --- | --- |
| issued_at | native adapterがセッションを発行した日時。ログイン成功とは別 |
| first_verified_at | PWAがそのセッションを所持してnative認証を通過したことをgatewayが最初に検証した日時 |
| last_authenticated_at | そのPWAセッションによる認証成功をgatewayが最後に検証した日時 |
| expires_at | native側と照合した有効期限、発行から最大24時間。利用で延長しない |
| logged_out_at | サーバーでログアウト/当該セッションの利用終了を確定した日時。単に画面を閉じただけでは記録しない |
| revoked_at / revocation_reason | owner操作や復旧でnative側の失効を確認した日時/理由。失効要求を送っただけでは完了にしない |

初期のfirst_verified_at/last_authenticated_atはNULL。Cookieの発行応答やブラウザから申告された日時だけで埋めない。最初の確認時は両列を同じ検証日時で一括設定し、以後はfirst_verified_atを変更しない。last_authenticated_atのDB更新は同一セッションで最大5分に1回（初回・失効確認は即時）とし、この列が全HTTPアクセスの精密な最終時刻とは表示しない。ログアウト/失効の後は認証日時を更新しない。更新経路はAPI実装時に追加するため、現時点では実ログインの記録はまだ始まっていない。

DBトリガーは要求作成・状態遷移、session発行・初回ログイン確認・最終認証日時更新・ログアウト・失効を同じSQL文の監査イベントとして自動保存する。監査INSERT失敗は状態更新もロールバックする。アプリ側は同じイベントを二重INSERTしない。APIで拒否した認証失敗や所持証明不一致は状態遷移がないため、別の安全な診断経路で記録し、device secretや無効credentialを保存しない。

承認scopeはJSON配列を一度検証して固定のシリアライズで保存し、adapterへ同じ値を渡す。DB側でも許可外scopeを拒否し、native sessionの環境・owner・attempt・scopeが一致しない台帳登録を拒否する。秘密値や任意のエラー本文を保存する自由形式カラムは設けない。台帳/監査のchanged_by・sourceは実行経路の検証済み主体を設定する。owner IDは期限の短いuser_sessions行とは別の持続する主体を表すため、そのセッションテーブルへの物理FKは設けない。

[SQL全文と適用・検証手順](SETTING.cloudflare-workers-github-oauth-1.T3-PWA-D1.20261029.md)を参照。

## 後続の開発用実装（2026-10-29追記）

この文書の本体D1 broker案とは別に、native T3 proxy内の専用SQLiteを台帳とする開発用アダプターを実装し、現稼働環境へ反映した。正式native bearer/短寿命WS ticketを利用するが、承認仲介と既存UI transportは独自方式。利用者の明示判断により一般利用は承認不可、開発環境限定の例外対応とする。公開Chromium/WebKitのCookieなしiframeで承認・native UI/WS・再読み込み・元の別タブ認証維持を確認。iPhone実機とコンテナimage更新は未実施。本体D1 t3_pwa_*を新方式で使用済みと扱わない。詳細は REPORT.cloudflare-workers-github-oauth-1.T3-PWA-NATIVE.20261029.md。以後の設計・失敗・検証記録は本体D1 t3_setup_log_entries（topic=t3-log）を参照。

## 起動経路の回帰条件（実機失敗後の訂正）

従来の自動試験はiframeのみで、トップレベルのiOS standalone PWAを通していなかった。clientのwindow.top===window分岐がPWAを通常タブとして扱い接続フローを迂回する欠落を、WebKitでnavigator.standalone=true・Cookieなし条件を与えPairing表示まで再現。単独PWA（iOS standalone flagとdisplay-mode）、iframe、通常ブラウザーの既存Cookie認証を別々に検証する。再現条件での通過を実機全体の解決と混同しない。
