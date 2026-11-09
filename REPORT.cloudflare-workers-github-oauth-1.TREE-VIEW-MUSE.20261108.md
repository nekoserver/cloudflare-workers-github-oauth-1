# tree-viewのMuse接続とワーカーチャット切り替え（2026-11-08 UTC）

## 実装

`dynamicneko`のtree-view/AIチャットタブで、⚙️モーダルに「このワーカーのチャット」「muse-vm（tailnet）」のチェックボックスを追加。どちらか一方だけを選び、接続先一覧にもmuse-vmを追加した。ワーカーのトンネル一覧を取得できない場合でもMuseを選べる。

ワーカー側iframeを切り替え時に破棄せず、Muse側も一度開いた後は維持する。履歴・進行中の応答を保持し、接続先選択では推論を開始しない。読み込み状態・認証確認の案内・接続取得エラーを表示し、白いままの状態を避ける。MuseチャットはReactのテキスト表示で、HTMLとして回答を実行しない。

Muse経路: ブラウザ → dynamicneko `/api/tree-view/muse-chat` → 本体Worker `/api/tree-view/muse-chat-external` → 既存DEMO_CONTAINER `/muse/v1/chat/completions` → `tailscale nc muse-vm 8080` → `/v1/chat/completions`。既存の固定tailnetブリッジを利用し、Muse APIキーをブラウザへ渡さない。認証済みowner、同一Origin、Worker HMACと短期userTokenを検証。許可されたuser/assistantの交互履歴のみを送信し、40件・UTF-8で16KiBを上限にする。接続確認失敗時は推論を送信せず、停止コンテナを自動起動せず、他経路へのfallbackや自動再送は行わない。

既存T3のWorker署名検証関数をexportして共用し、同じ契約の署名をMuse経路でも検証した。T3既存テストを再検証済み。

## 白画面の現コンテナ修正

現コンテナの`/etc/lib-chat.env`はLIB_CHAT_FRAME_ORIGINS未指定で、HTTP配信の親サイト許可がmygwだけに限定されていた。dynamicnekoのiframeを拒否する設定だったため、現在の公開親サイトdynamicneko・本体Workerの3オリジンを明示追加。HTTP配信プロセスのみを再起動した。公開認証ページのframe-ancestorsにdynamicnekoが含まれ、実Chromeからdynamicnekoと同じオリジンのfixture親ページに埋め込んだ実公開認証フォームが可視であることを確認した。

これは現在のコンテナに適用済み。再作成後の復元は未検証。再起動でプロセスメモリ内の短期セッション/asset ticketは無効になるため、既存パネルは認証し直す必要がある。認証自体は維持し、迂回していない。動的Worker内の新しい切り替えUIは未配備なので、稼働中tree-view全体の解消はまだ保証しない。

## 検証

根拠: 本体Workerの `artifacts/tree-view-muse-20261108/`。

- main-before.log: 新経路未実装でテストが失敗することを先に確認。
- unit.log: 本体のMuse経路・既存T3・既存Muse direct/preflightの65件成功、明示liveテスト1件skip。
- browser.log: Chromeで既存会話パネルと新Museパネルの11テスト成功。checkbox切り替え、2往復の履歴送信、切り替え後のiframe/履歴維持、台帳取得失敗時のMuse選択、HTTP200エラー本文の拒否と入力保持を確認。APIはこのブラウザテストではstub。
- dynamicneko-typecheck.log: `tsc -p tsconfig.test.json`終了0。新server relayのNodeテストと既存stream-hostsテストも成功。owner・Origin・入力上限・HMAC本文・userToken・エラー応答・no-storeを検証。
- live.json/live.log: 新本体ルートから現在の実server.jsを経由して実muse-vmへ1回だけ推論POST。3件の履歴内のトークンを回答するよう要求し、HTTP200と指定文字列完全一致。ローカルルートの認証依存だけをfixture化しており、本番のWorker署名鍵・本番D1権限は未検証。
- frame-policy.json/live-frame-browser.json: 公開レスポンスと実Chromeでiframeの認証フォーム可視を確認。親ページはfixture、本番ログイン済みtree-viewではない。Chromeのこの実配信検査のみ証明書検証を無効化。公開HTTPヘッダー確認は通常のTLS検証。

ブラウザの最初の2試行はtoHaveTextContent matcherが、実際に回答1が表示されていても失敗した。文字列と正規表現の双方で同じ結果だったため、最終検証はDOM textContentのpoll/containsへ変更し成功した。失敗ログを保持し、実画面に回答がなかったとは判断しない。

## 反映範囲

ソースは `/root/dynamicneko` と本体Workerの `/root/cloudflare-workers-github-oauth-1` にある。現在はローカル変更で、Git push・PR・Workerデプロイ・Dockerビルドは実施していない。新機能を本番で使うには両Workerの更新が必要。本体Workerの既存MUSE_API_KEY、両Worker間の既存署名設定・userToken設定、起動中コンテナとtailnetのmuse-vmが前提。ブラウザからTailscaleへ直接接続する方式ではない。

実推論liveテストはRUN_TREE_VIEW_MUSE_LIVE=1を明示した場合だけ動くようガードし、通常のテストで推論を発生させない。read-onlyの実frame検査はdynamicnekoのscripts/check-tree-view-chat-frame.mjsで明示実行できる。
