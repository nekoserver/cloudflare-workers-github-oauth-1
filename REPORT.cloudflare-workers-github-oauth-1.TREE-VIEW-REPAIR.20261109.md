# tree-viewの重なり順・最大化・白画面・tailnet照合の修正（2026-11-09）

## 公開反映

- dynamicneko: `666ad9f2-4de6-4c96-a2ef-65176b4dd8d9`。
- 本体Worker: `5943c560-297c-4fc5-9934-a17036af065e`。
- 両方とも `--containers-rollout none --keep-vars`。Dockerビルド、コンテナ更新、Git pushなし。ブラウザは再読み込みが必要。
- 公開tree-view?pwa=1と、正規PWA shellのRefererを付けた/assets/index-BM5xJdo7.jsは200。JSはローカル本番ビルドとSHA256一致。Refererなしのasset取得は既存認証で401となるため、公開ファイル未反映の証拠とは扱わない。

## 原因と修正

プレビューのz-indexが50から、履歴が固定1000、TerminalSurfaceが1200からと別管理だった。アクティブ表示だけ変わり、他種ウィンドウより上がらなかった。window-stackで全種のアクティブIDとレイヤー増分を共有し、クリック、サイドバーからの再表示、タブ再選択で対象を最前面へ移す。履歴が既に開いている場合も再選択で上げ、前の窓のアクティブ表示を解除する。trueのActiveを複数残さない。

プレビュー最大化の復元先は初期サイズだったため、リサイズ後の直前サイズを失っていた。最大化直前の位置・サイズを別に保持し、トグルで正確に戻す。タイトルバー操作ボタンからのdblclickをシェード操作に伝播させず、シェード時にも最大化状態を勝手に解除しない。最大化時の90vw/85vh上限も解除した。

タイムラインの白画面は、現コンテナの/lib/conversation-embed.htmlのCSP frame-ancestorsにdynamicnekoがなく、埋め込みが拒否されていた。直前のネットワーク再配置で/etc/lib-chat.envへLIB_CHAT_FRAME_ORIGINSを引き継げなかったもの。設定のバックアップ後、既存のdynamicneko・本体Workerの親オリジン許可を復元し、HTTP配信だけを再起動。cf-containerと本体イメージ内の起動スクリプトにも、設定が無い場合の同じ既定値を追加した。保存済み設定と明示ENVを優先し、APIのOrigin許可や認証を広げていない。イメージ内の変更は再ビルドしていないため、次回コンテナ再作成への反映は未確認。

実tailnet一覧では本体のHostNameがcf-demo-container、実DNSはcf-demo-container-2、接尾辞なしと-1はオフラインだった。WorkerのMuse preflight・状態表示には先頭の古いノードを拾う処理、WASM Muse/Gadgetには固定名判定と固定宛先があった。共通ヘルパーでサービス名と数値接尾辞だけを照合し、Online=trueの一意の候補を選び、WASMはその実DNS名へ送る。設定済みのサービス・ポートを維持し、別サービスへfallbackしない。オンライン候補が複数なら曖昧として送信しない。Active=falseでもOnline=trueの端末は除外しない。

## 検証と限界

根拠はartifacts/tree-view-repair-20261109。

- Chromeブラウザ4ファイル13テスト成功。履歴/プレビュー/ターミナル間の相互前面化と排他的アクティブ状態、サイドバー再選択、最大化前のサイズ復元、チャット/T3/ビルド窓操作を含む。新テストで元の固定レイヤーと初期サイズ復元の失敗を確認してから修正した。
- dynamicneko型検査とVite本番ビルド成功。全体テストは未実施。
- 設定優先順位・frame既定値など9テスト成功。
- dynamicnekoと同じoriginのテスト親ページから、改変していない公開mygw iframeを通常TLS検証で開き、認証フォーム経由のログインと実会話タイムラインの可視、投稿マーカーを確認。CSP frame-ancestorsエラー0件。実際のログイン済み本番tree-view親画面とiPhone PWAの操作は未確認。
- 本体tailnet関連5ファイル62テスト、既存Muse連携3ファイル54テスト成功。接尾辞、古いoffline先頭、同時onlineの曖昧性、別サービス拒否、WASM実送信先、Gadget設定ポート保持を検証。
- 現コンテナの実tailnet一覧を新ヘルパーへ入力し、cf-demo-container-2とmuse-vmのオンライン実DNSが選ばれることを確認。これはWorker内WASMノードの実接続・実推論成功の証拠ではない。実推論POSTは今回行っていない。
- 既存コンテナserver.jsのtailscale nc経路は変更していない。今回の実宛先選択修正はWorker側の状態判定とWASM Muse/Gadget送信経路。現muse-vmは接尾辞なしでonline。コンテナ内ncで番号付きMuseを選ぶ挙動は未実装・未確認。

全体typecheck/全体テストを本体Workerで成功とは報告しない。公開版IDは配備の根拠、ローカルブラウザテストは操作の根拠であり、ログイン済み本番画面の実操作検証とは区別する。
