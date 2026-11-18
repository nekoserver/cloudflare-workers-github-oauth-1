# tree-view T3 Codeの本体demoコンテナ起動・停止

## 対象と正とする状態

T3 Codeタブの「再接続」の直前に、本体Workerの`DEMO_CONTAINER`でキー`demo`を使うコンテナの起動／停止ボタンを配置する。利用者別Sandboxは操作しない。running/healthyなら「T3サーバを停止」、stopped/stopped_with_codeなら「T3サーバを起動」。不明・取得失敗・stoppingでは操作を無効にする。

状態確認は`getState`のみとし、`fetch`による暗黙のコンテナ起動を行わない。停止中と状態不明の間はT3 iframeを読み込まず、停止の直後にiframe経由で再起動させない。既存コンテナのentrypointがT3を起動するため、T3プロセス単独の制御や設定変更は行わない。

## 認証と経路

dynamicnekoのownerセッション＋変更時の同一Origin照合を入口とし、Service Bindingで本体へ送る。本体でも既存の短寿命userTokenを検証して許可済みGitHub login=nekoserverに限定する。新規のWorker間経路はCF-Worker=dynamicneko＋時刻付きHMACを必須とし、共有鍵の設定名CF_WORKER_SECRET_MAIN / DYNAMICNEKO_WORKER_HMAC_SECRETを使用する。キーとトークンはブラウザへ返さない。

## 競合と反映時点

操作はtoggleではなくstart/stopの明示的な希望状態として送る。DemoContainerの既存start/stop/restartと同じDO内のロックを使い、状態判定と操作を一括して行う。既に希望状態なら二重起動・停止しない。実行後にgetStateを再確認して返す。途中状態は完了表示せず照会で追跡する。ブラウザ内の連打を抑え、操作前に発行した古い状態応答が操作後表示を巻き戻さないようにする。他画面からの変更はT3タブ表示中の定期照会で反映する。

## 故障シナリオ・予兆・対処

- 認証失敗・別Origin・本文改変・期限外署名: 実処理前に拒否し、DOを操作しない。
- 状態取得不能・未知の状態: 起動と誤認せず操作無効。状態の再取得で回復する。
- 同時操作: 同じDOの既存ロックで拒否。自動再送せず実状態を照会する。
- 操作途中の失敗・タイムアウト: 成功と表示しない。状態確認だけ再実行し、操作自体は自動再試行しない。
- stop後のiframe・古いpoll: iframeを外し、古い応答を無効化する。
- 監査保存失敗: 既存方針に合わせコンテナ操作を巻き戻さず、保存失敗を応答で明示しサーバーログに残す。

## 履歴と復旧

実際のstart/stopと失敗を既存cf_container_operation_logへ、実行者・起点・状態とともに保存する。既に希望状態の操作と停止処理中の受付は、起動回数や停止済みの集計を早めない別actionで記録する。停止完了は既存onStopでも記録される。正しい稼働状態はDOのgetStateで再確認し、誤操作からは明示的な希望状態を指定して復旧する。履歴を削除・上書きしない。

本番コンテナの起動・停止、Dockerビルド、デプロイは実装のテストとして実行しない。本体Workerとdynamicnekoの両変更の反映が必要。

## 本番設定の確認（2026-10-28）

Cloudflareの設定メタデータで、mainのDYNAMICNEKO_WORKER_HMAC_SECRET、dynamicnekoのCF_WORKER_SECRET_MAINとTREE_VIEW_CONTAINER_ORIGINが存在しないことを確認した。AICHAT_USER_TOKEN_SECRET、MAIN_WORKER、DEMO_CONTAINER、DBの各バインディング名は存在する。秘密値の取得や変更は行っていないため、署名鍵の一致やT3サーバーの実稼働はこの確認では保証しない。

反映時はmainとdynamicnekoの共有鍵2設定に同じ新しい値を設定し、dynamicnekoのTREE_VIEW_CONTAINER_ORIGINへT3の実HTTPS originを設定する（ペアリングコードやURLのqueryは含めない）。mainのAPI/DO変更を先に反映後、dynamicnekoを反映する。今回Dockerビルドや本番設定変更は実施しない。
