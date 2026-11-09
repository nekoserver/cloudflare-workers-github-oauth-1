# tree-viewボタンと待機状態の公開反映（2026-11-09 UTC）

利用者から「⬜︎や⌨️がまだ出ない」と報告を受け、ローカル検証と公開反映が別であることを説明した後、Dockerを起動せず両Workerを公開した。Git pushは行っていない。

- 本体Worker: ca303d16-b1e6-4276-91d8-13f50ec41390
- dynamicneko: 562f1d57-4b76-4305-9765-e41e5e45305b
- 両方ともwrangler deploy --containers-rollout none --keep-vars。コンテナのビルド/更新なし。dynamicnekoのremote D1 migration listは適用待ちなし。

本体の事前dry-run成功。dynamicnekoのVite本番ビルド成功。公開tree-view?pwa=1から参照された/assets/index-Dp3hw88V.jsはHTTP200、ローカル本番ビルドとSHA256一致、「AIチャットをウィンドウで開く」「AIチャットの入力方式を切り替える」の両ボタン実装を含む。ログイン済み本番tree-viewを実ブラウザで操作した検査は行っていない。画面は再読み込みが必要。

本体tailscale-wasm上部のテーマ切り替えも今回のWorkerに含む。Museの実推論のタイムアウトが解消したとは扱わない。

## 待機状態の修正

取り込まれた投稿にも受付時の「送信待ち」が残る実装だった。observerが同じ固定会話のthread/queue/listを読み取り、公開スナップショットに件数と取得可否のみを追加する。未送信本文・queue IDは公開しない。UIは件数の減少・0件・取得失敗で表示を更新する。0件はモデル受信/回答の成功とは言わない。キュー登録・turn/start・投稿再送・削除・forkは追加していない。

同一会話の3件のうち2件が取り込まれたことと、別の1件が残ることを実測。公開mygwの署名付き配信からconsoleQueue available=true/pending=1を確認した。残っている1件の実行時刻は未確認で、表示修正でキューを強制消費させたとは報告しない。

変更は/root/libから現配信ディレクトリへ配置し、read observerのみを再起動。HTTP配信/HMAC/既存console session/現在の会話IDは維持した。変更前のobserverとHTMLはroot専用の/var/lib/lib-chat-observer/backup-queue-status-20261109へ保存。

observer既存6件＋集計2件、Node状態表示/投稿フォーム/キーボード8件成功。生成したハッシュ資産とHTMLを一緒に配置した。新しい表示を使うには再読み込みが必要。

根拠はartifacts/ui-publish-20261109/。既存の「未配備」というREPORT記述は、それぞれの検証時点の履歴として保持し、この追記で公開反映の状態を更新する。

## 後続更新（2026-11-09）

dynamicnekoを再ビルド・再配備。Version ID: `7fd593e7-53d5-4606-b6f0-7b029e58661c`。公開 `/tree-view?pwa=1` と参照JSはHTTP200で、JSのSHA256はローカル本番ビルドと一致。公開バンドルにパネル⬜︎・共通ウィンドウリサイズがあり、AIチャット用のミニキーボードと不要な案内文が含まれないことを確認。

`lib/ops/chat_site.py`の認証handoffを現コンテナへ配置し、HTTP stream processのみ再起動。接続中のHTTP streamはありませんでした。公開`/lib/conversation-embed.html`はHTTP200で、セッショントークンを`sessionStorage`へ保存し、短命asset ticketへ遷移するコードを配信。URLフラグメントにトークンを載せないことを確認。iPhone実機PWAでの認証完了は未確認。
