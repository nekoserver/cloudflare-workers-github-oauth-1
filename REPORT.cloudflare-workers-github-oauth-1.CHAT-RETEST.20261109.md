# チャット検証と追加修正（2026-11-09 UTC）

## テスト結果

- dynamicneko: ウィンドウ・入力方式・Cookie・Muse接続先・既存パネルの実Chromeテスト18件成功。型検査、server relay、geometry Cookie分離、host台帳のNode検査成功。根拠は/root/dynamicneko/artifacts/chat-retest-20261109/。
- lib: 入力・投稿フォーム・stream/socket/themeのNodeテスト34件成功。sourceと生成appの構文検査成功。
- 本体: 初回74件成功。Workerブリッジが複数メッセージを拒否する不整合を別の実ブリッジテストで再現した。入口とブリッジで履歴検証を共通化して修正後80件成功。実ブリッジをルートへ接続する統合テストを追加し、関連14件成功（既存13件＋新規1件）。

## 実通信の失敗

- コンテナ経由: 実応答テストは110秒でtimeout。今回は実回答成功とは扱わない。前日の実測成功は今回の結果に代用しない。
- Worker経由: ローカルworkerd＋実DO＋実WASMで初回health503。初期化を待った再検査はStarting→Running、health200を確認したが、履歴付き1回の推論はllm_timeout。containerへfallbackせず、自動再送なし。検査用ephemeralノードはログアウト・一時ファイル削除済み。本番のmain-worker-muse-1へ介入していない。
- 以上の3回の実通信失敗でAGENTS.mdの停止指定に従い、追加の通信試験は止めた。これを「通信完了」「復旧済み」と扱わない。後続の利用者指示によるMuseへの読み取り専用の説明依頼は、元ジョブの再実行や同じ試験投稿の再送ではなく別の問い合わせ。

根拠はartifacts/chat-retest-20261109/のunit.log、unit-final.log、bridge-before.log、bridge-integration.log、container-live.log、worker-runtime-first.json、worker-runtime.json。

## 送信待ち表示

現会話のnative queueに未取り込み3件があることを確認。モデルへ届いたとの確認はない。元の表示は受付だけで応答を保証する文言だったため、libの文言を「次のターン待ちとして保存しました。まだAIには渡っていません。応答開始時刻は未確定です。」に変更し生成資産を更新。関連6テスト成功。投稿の再送・削除・別会話への切替はしていない。現配信への配置は未実施。

Queueは次の実行まで待つ仕組みで、現在実行へのSteerとは別であることを公式OpenAI documentationで確認した。
https://learn.chatgpt.com/docs/prompting
https://learn.chatgpt.com/docs/app-server

## tailscale-wasmのテーマ切り替え

ページ上部の見出し横に共通のテーマ切り替えボタンを追加した。user_theme Cookieと既存settings APIへ反映し、背景・文字・フォームを共通色変数で切り替える。切り替え往復、保存済みlightの復元、生成した全scriptのnode --check、既存フォーム/費用/永続Jobを含む7テスト成功。theme-before.logで追加前の欠落を確認。ブラウザでの本番UI操作は未確認。

push・Workerデプロイ・コンテナビルド・イメージ更新なし。新規source/UI変更と稼働中サイトを区別する。
