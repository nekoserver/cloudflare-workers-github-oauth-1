# AIチャットの test.cfc ストリーム接続

接続先を src/utils/conversationStreamHosts.ts に集約し、
`https://test.cfc.nekomaneki.work/http/lib/conversation-embed.html` を第一候補へ追加。
選択UI、自動検出、iframe CSP、postMessageのOriginを同じ接続先設定に合わせた。
任意URLの自由入力は追加していない。埋め込み先のページには利用者がHMAC鍵を入力するため、
任意の第三者サイトを許可する設計は避ける。接続先を追加する場合は管理された許可リストを更新する。
health応答に未知の候補が混入しても、UIは許可済み候補のみを使用する。

## コンテナ側

/root/lib のチャット画面で /http 配下ならAPIの接続先も同じプレフィックスを使うよう修正。
配信サーバーは既存パスと /http プレフィックスの双方を受け付ける。
HTTP署名は送信したパスに束縛し、WebSocket署名も実際の接続パスで照合する。
Apacheは静的ファイルの /http リライトを維持し、認証付きストリームはパスを保持してプロキシする。
変更は稼働コンテナのコード・静的アセット・Apacheへ反映した。

## 検証と公開状態

- Worker側の関連4ファイル・15テスト成功。
- Pythonのチャット関連31テスト成功。プレフィックス付きの認証と署名使い回し拒否を含む。
- ローカルApache TLSで /http 配下の画面、SSE、NDJSON、JSON-seq、WebSocketを確認。
- 正常署名セッション200、不正署名401、未許可Origin403、WebSocket不正鍵1008。
- 全体のTypeScript型検査は変更対象外の複数テストファイルの型エラーで失敗。
- Workerリポジトリの変更は未デプロイ。Dockerビルドは実行していない。
- 公開URLは現在 cfc-standalone Worker の認証により401で、実会話配信は未完了。

トンネル側には /http の経路があるが、同ホストのWorkerカスタムドメインが先に要求を受け、
cfc-standalone の route() が認証を要求する。公開接続を完了するには、この入口側で
対象の静的配信とチャットAPIをコンテナのApacheへ中継する必要がある。
チャットAPI自身のHMAC・セッション認証を維持し、管理APIの認証を外さない。
また実会話observerは対象会話の選択と起動が必要。
MCP化は後続作業とし、この修正の前提にしない。
