# AIチャットのストリーム接続先をmygwへ変更

**対象**: AIチャットのストリームパネル、埋め込み画面とのpostMessage通信、`/api/aichat/conversation-stream/health` の上流確認先。

## 背景と故障想定

旧 `mynw.nekomaneki.work` のトンネルは撤去済みで、配信先は `mygw.nekomaneki.work` に移行した。iframeだけを変更すると、操作通知と受信Originの不一致で開始・停止・テーマ同期が動かなくなる。正常性確認だけ旧ホストに残ると、新ホストが稼働していても障害表示になる。

## 検証と検知・対処

実装変更前にテストの期待先をmygwへ変更し、4方式のURL、操作通知の宛先、受信Originとウィンドウの検証、正常性確認先の不一致を検出する。旧ホストや別ウィンドウからの通知は無視し、接続障害は既存の正常性表示で検知する。障害時も撤去済みホストへ自動的に戻さない。

## 修正内容

| ファイル | 変更 |
| --- | --- |
| `src/views/conversationStreamPanel.ts` | iframeとpostMessageの送受信Originをmygwへ統一 |
| `src/utils/conversationStreamHealth.ts` | 上流のHEAD確認先をmygwへ変更 |
| 対応するテスト | URL切替・操作・Origin検証・正常性確認を検証 |
| `src/views/aichat.test.ts` | 固定文字数の切り出しで既存5テストが失敗していたため、関数・ハンドラー内の範囲を確認するよう修正。元の検証項目は維持 |
| `src/aichat-zt-embedding-model-ui.test.ts` | コメント内の文字列をscript要素と誤認していたため、DOMParserで実際のHTML要素からテスト対象を取得 |
| `src/aichat-linked-questions.test.ts` | モデル色の取得先が共通ヘルパーへ変わっているため、リンク描画関数内の現在の取得処理を確認 |

既存5件の失敗は未変更のmainでも再現した。切り出し範囲の修正後、AIチャットと今回の変更に関する280テストが成功した。
ZTモーダルの既存19件も未変更のmainで再現し、要素取得を修正後は同ファイルの26テストが成功した。
リンク質問のモデル色テストの既存1件も未変更のmainで再現し、参照先を更新後は同ファイルの63テストが成功した。

## 注意事項

この変更はWorkerのデプロイ後に本番画面へ反映される。配信サーバー側の会話observerは別途監視対象の指定が必要。

# AIチャットのストリームiframeをCSPで許可

**対象**: `/aichat` のContent-Security-Policyと、`mygw.nekomaneki.work` の会話ストリーム埋め込み。

## 背景と故障想定

`src/views/conversationStreamPanel.ts` はiframe接続先を `mygw.nekomaneki.work` に変更済みだったが、`/aichat` の個別CSPは `frame-src https://mynw.nekomaneki.work` のままだった。ブラウザはCSP違反としてiframeを読み込まず、埋め込みJavaScriptから親ページへ `conversation-state` が届かない。そのため開始/停止ボタンが無効のままになり、ストリーム領域も空になる。上流ヘルス確認が200でも、ブラウザのCSPがiframeを遮断する症状は検知できない。

## 検証と修正

修正前に認証付き `/aichat` の応答CSPを検査するテストを追加し、実際に `mynw` だけが許可され `mygw` が許可されないことを確認した。`/aichat` のCSPを `frame-src https://mygw.nekomaneki.work` に更新し、一般ページのCSPは変更しない。テストは認証付きページ応答から許可先を検査する。

実ブラウザで本番と同じCSPを適用した親ページから公開iframeを読み込み、ハンドシェイク、会話表示、WebSocket/SSE切替、開始/停止操作を確認した。変更を有効にするにはWorkerのデプロイが必要。
