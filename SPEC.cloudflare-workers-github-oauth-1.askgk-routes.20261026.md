# askgkの独立経路と設定による切替

本体コンテナの停止中も利用するため、既定のaskgk APIは独立Redmineコンテナを起動・中継するWorker経由とする。ホストを推論処理に埋め込まず、`src/data/askgk-routes.json` を既定の経路台帳とする。

## 設定

`ASKGK_ROUTES` に台帳全体のJSONを設定すれば、コード変更なしで経路を追加・削除・無効化できる。例:

```json
{"defaultRouteId":"standalone","routes":[{"id":"standalone","url":"https://independent.example/lib/api/tunnels","enabled":true},{"id":"backup","url":"https://backup.example/lib/api/tunnels","enabled":false}]}
```

`ASKGK_ROUTE_ID` は使用する経路ID。未指定なら台帳のdefaultRouteIdを使う。台帳には署名付きtunnels APIとして検証済みの信頼するHTTPS接続先だけを登録する。新しい接続先は既存のHMAC検証、tunnels API、Codex実行・認証を備える必要があり、登録だけでサーバーを構築するものではない。

優先順位は、明示した台帳・経路ID、従来の単一URL `ASKGK_TUNNELS_URL`、同梱台帳の順。明示台帳が不正、選択IDが削除済み・無効、ID重複、HTTPS以外などの場合は送信を止める。明示設定の誤りを旧URLへのフォールバックで隠さない。旧URLは既存配備の移行用。

チャット・SlackはaskgkDepから同じ送信関数を使い、Codex残量確認cronも同じ経路解決を使う。経路設定は各操作の送信前に解決し、プロセス内キャッシュは持たない。Worker変数の更新はCloudflare側の新バージョン反映後に届いた操作へ適用される。すでに送信したPOSTは取り消さず、別経路へ再送しない。経路選択は設定に基づき、正常性を監視した自動切替は今回実装していない。

## 本番反映と復元

2026-10-26、本番ASKGK_TUNNELS_URLを独立APIへ変更。Workerの他50 bindingsは取得前後で一致を確認。更新前メタデータはroot専用 `/root/.local/state/neko-independent/` に保存した。経路台帳・解決処理はWorkerバージョン `c4886118-6819-42be-96a0-b718349b0c7f` へ配備済み。ASKGK_ROUTE_ID=independentを確認。既存50 bindingsは維持され、新規経路IDのみ追加された。既存のレジストリイメージを参照して配備し、Dockerビルドは実行していない。Cloudflareは本体コンテナアプリケーションの宣言イメージ更新も適用したため、コンテナ再配置がなかったとは保証しない。

元に戻す場合は保存メタデータのASKGK_TUNNELS_URLのみを復元する。台帳導入後は旧台帳JSONと選択IDを記録してから新値を適用し、復元時も両方を揃える。削除した選択先は送信前に検出されるため、先に選択先を有効な別IDへ切り替えるか台帳のdefaultRouteIdとともに更新する。


## 保存する待ち時間（最大300秒）

本体Workerの `/settings` に管理者用「askgkの待ち時間（全利用者共通）」を追加。既定120秒、1〜300秒の整数を保存でき、「既定値120秒に戻す」でも保存する。`GET/POST /api/settings/askgk-timeout` はログインと既存の管理者認可が必要。Cookieやブラウザだけに保存せず、D1 `askgk_timeout_settings` の最新revisionを正とする。0189のSQLが既定120秒の初期revisionを保存する。

保存は比較したrevisionを条件にしたINSERTで行い、競合は409で拒否。変更前の行、日時、実行者を残す。復元は過去のtimeout_secondsを新しいrevisionとして保存する。欠落・不正値・DB取得失敗は暗黙の既定値で隠さず、送信を止める。UIの表示、設定API、チャット、Slack、cronは同じテーブル・検証関数を使う。変更は次の送信から適用し、進行中の要求は開始時の設定と経路を保持する。

Codex要求は `wait_seconds: 0` を付けて一度だけ送信。その後は同じask_idだけを署名付きで照会し、保存した待ち時間まで待つ。通信エラー・タイムアウト後に元のプロンプトを再送しない。タイムアウト時は処理が継続し得ることと既知のask_idを返す。300秒の長いCGI接続は作らず、独立側のtunnels APIは短い応答で状態を返す。

独立Redmineのtunnels_lib.rbにwait_seconds指定を追加し、既存呼出しの90秒待機は維持。互換経路のApache CGIタイムアウト105秒も稼働環境へ反映済み。これらのコンテナ内変更はソースにも保存したが、Redmineイメージは未更新で、再作成後の維持は未検証。新しいWorkerと古いコンテナイメージの組合せまで保証したものではない。

## エンジンごとの送り先（試験運用、2026-11-02）

独立Redmineコンテナのイメージには Claude CLI がない（redmine の `e2e1242`）。そのため `/neko askgk claude_prompt="..."` は、独立経路では必ず `tunnels実行失敗: engine_unavailable` になっていた。

台帳に任意の `engineRoutes`（エンジン名 → 経路ID）を追加した。同梱の台帳は `{"claude": "main"}` で、claude の依頼だけを本体コンテナ（mygw）へ送る。codex など他の依頼は、従来どおり `ASKGK_ROUTE_ID`・`defaultRouteId` の経路へ送る。

- エンジン名は、送る文字列の先頭の `◯◯_prompt=` から読む（`askgkEngine`）。経路を選ぶためだけに読み、送る文字列からは剥がさない。
- `engineRoutes` に書いたエンジンは、`ASKGK_ROUTE_ID` より優先する。本番は `ASKGK_ROUTE_ID=independent` を明示しているため、こうしないと claude の依頼が独立経路へ行く。
- 送り先の経路が無効・未登録なら送信を止める。別の経路へは送り直さない。
- 従来の単一URL `ASKGK_TUNNELS_URL` の配備では、エンジンにかかわらずそのURLへ送る。
- 新しい環境変数は追加していない。やめるときは台帳から `engineRoutes` を消す。

**未確定のこと**: コンテナをまたぐ処理の分け方（エンジン単位か、処理の種類単位か、死活確認を見た自動の切り替えか）は、まだ決めていない。これは手探りの第一歩で、本体コンテナが止まっている間は claude の依頼は失敗する（独立経路の目的「本体の停止中も使える」は、claude には当てはまらない）。

本体コンテナ（mygw）の Apache は、すべてのリクエストを `server.js` へ中継していた。そのため、`/lib/api/tunnels` だけを lib の `tunnels.claude.rb` へ向ける設定を、稼働中のコンテナに手で入れた（イメージには未反映）。この応急の対応を本体側に寄せて共通にする最終案は [`SPEC.cloudflare-workers-github-oauth-1.cross-container.20261102.md`](SPEC.cloudflare-workers-github-oauth-1.cross-container.20261102.md)。
