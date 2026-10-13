# AIチャットへの会話ストリーム埋め込み

`/aichat` のチャット欄に、折り畳み式の「この会話のストリーム（閲覧のみ）」を追加する。開いたときに `https://mynw.nekomaneki.work/lib/conversation-embed.html` を読み込み、閉じると iframe を解除して受信を止める。初期方式は WebSocket。SSE・NDJSON・JSON Text Sequence にも切り替えられる。

この表示は VM の会話オブザーバーが提供する会話であり、本体AIチャットの履歴を配信するものではない。通常の質問入力と履歴保存には触れない。既存 HMAC キーは埋め込み先で入力し、親ページや URL へ渡さない。方式切替後は再入力が必要。

親ページの CSP は埋め込み先の frame-src だけを許可する。埋め込み先も利用する本体ドメインを frame-ancestors に許可する必要がある。現在の許可対象は `https://cloudflare-workers-github-oauth-1.nekoflare.workers.dev` と `https://1.cfw1.nekomaneki.work`。別ドメインではサーバー側の許可設定が必要。

検証: 埋め込みテスト2件、生成されたページ内スクリプトの構文、差分の空白チェックが成功。公開埋め込みページ HTTP 200 と、公開 WebSocket で HMAC 認証後の info・conversation イベント受信を確認。全体の型チェックは既存テスト等の型エラーにより失敗。VM のサーバー類は既存 start-lib-web で再起動した。VM 復帰後の自動起動と、Worker 本番への反映はこの変更に含めない。
