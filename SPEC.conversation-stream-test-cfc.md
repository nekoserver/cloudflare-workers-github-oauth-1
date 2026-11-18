# AIチャットのトンネル専用ストリーム接続

接続先は `https://stream.test.cfc.nekomaneki.work/lib/conversation-embed.html`。
管理画面 `test.cfc.nekomaneki.work` は引き続き cfc-standalone Worker が担当する。
ストリーム専用ホストはWorkerカスタムドメインに登録せず、DNS CNAMEをトンネルへ割り当てる。
トンネルではパス指定なしで `https://localhost:8443` へ転送する。

接続先URLを src/utils/conversationStreamHosts.ts に集約し、選択UI・自動検出・
iframe CSP・postMessageのOriginを揃える。旧mygw / mynwも手動候補として維持する。
任意URL入力は追加しない。埋め込み先へ利用者がHMAC鍵を入力するため、
許可済みの接続先に限定する。未知のhealth候補もUIで拒否する。

## 配信側の設定

- 証明書が専用ホストをカバーすることと、更新方法を確認する。
- 同名のWorkerカスタムドメインがあれば専用ホスト分だけ解除する。
- DNSは稼働トンネルの `<tunnel-id>.cfargotunnel.com` へproxied CNAMEを設定する。
- cloudflaredの公開ホストは専用ホスト、パス指定なし、HTTPS localhost:8443、自己署名証明書のTLS検証無効。
- Apacheが `/lib/conversation-embed.html` と静的アセットを配信し、
  `/lib/api/chat/ws` を8091、HTTPストリーム・セッションAPIを8092へ中継する。
- 配信プロセスのLIB_CHAT_ORIGINSへ専用ホストのHTTPS Originを追加する。
- HMAC・セッション認証、parent postMessageの許可リストは維持する。
- 実会話observerは、対象会話とapp-serverソケットを照合してから起動する。

## 検証

関連4ファイルの15テストで選択・自動検出・CSP・Origin・未知ホスト拒否を確認する。
実環境では専用ホスト経由のHTML、モジュール、WebSocket認証、HTTPストリームの逐次受信を確認する。
コードのビルド成功、トンネル接続正常、公開ストリーム受信成功を別々に記録する。
Dockerビルドはこのコンテナでは実行しない。
MCP化は後続作業とし、この接続修正の前提にしない。

## 2026-11-04: mygw投稿のアドホック対応

SSHのCodexが所有する会話を別App Serverからresumeできなかったため、ユーザー承認で履歴を分岐した投稿用会話をmygwに作成し、observerの選択先を切り替えた。元のSSH会話とは以後同期しない。これは恒久設計ではなく暫定対応。仕様・制約・共通実行サーバーへの移行条件はlibリポジトリの `SPEC.lib.20261104.console-stream-adhoc.md` に記録。公開投稿200・accepted=trueとAI回答CONSOLE_POST_OKを確認済み。
