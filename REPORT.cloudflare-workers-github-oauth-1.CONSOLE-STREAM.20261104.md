# 会話ストリーム投稿の復旧と初期設定確認 — 2026-11-04

## 結果

mygwのストリームで会話を読めるのに投稿できなかった。HTTPの投稿許可は成功していたが、同じthreadをSSH Codexが書き込み所有しており、別App Serverからの投稿が`already has an active writer`で拒否された。

ユーザー承認後、元threadの保存済み履歴をApp Serverの`thread/fork`で引き継いだmygw投稿用threadを作成。observerのprivate sourceを原子的に切り替え、公開console endpointでHTTP200・accepted=true、observer上で固有応答`CONSOLE_POST_OK`まで確認した。元SSH threadは保持され、fork後に両threadの履歴は同期されない。画面に「mygw 投稿用（SSHとは別の会話・以後同期なし）」と表示する。

これはストリーム機能の暫定的な復旧で、恒久設計ではない。単一の実行サーバーが書き込みを管理し、Web/SSH両方が同じ実行先に接続する設計と移行条件を [`lib` SPEC](../../lib/SPEC.lib.20261104.console-stream-adhoc.md) に記録した。

## 初期設定時の検証

メインWorkerリポジトリの [`NETWORK-STREAM-SETUP.md`](NETWORK-STREAM-SETUP.md) とコンテナ内 `lib/ops/CHAT_WEBSOCKET.md` に、コンテナ起動後、`tunnels.rb`・WebSocket/SSE等のストリーム・固定observerを設定するごとの確認手順を記載した。設定値/ENVとソケット、tunnels APIの内容、4配信方式の認証と実イベント、observerの対象thread、投稿受付から固有AI応答まで確認し、このREPORT相当の記録へ結果と未確認範囲を残す。起動やHTTP200、acceptedのみを完了根拠としない。初期設定の確認でAIを起動する投稿は明示の1回だけとする。停止中・未選択コンテナへのpollで起動させない。

コンテナ内の永続化・起動手順、既存ENV優先、socket権限・private設定は`/root/lib/ops/README.md`と[`lib` SPEC](../../lib/SPEC.lib.20261104.console-stream-adhoc.md)を参照する。秘密値や会話本文はREPORTへ保存しない。

## 検証結果と制約

投稿経路のPython 48 tests成功。生成ブラウザモジュールの`node --check`成功。直近Node 40テスト中38成功、今回変更していないsession cookieテスト2件は`location is not defined`で失敗し、全体成功とは扱わない。`git diff --check`成功。

コンテナ再作成後のthread/source設定の復元と、利用者のログイン済みブラウザからの操作は未確認。Dockerイメージ更新は行っていない。既存コンテナ内への適用と実リクエストの結果を次回起動時の自動復旧の証拠として扱わない。
