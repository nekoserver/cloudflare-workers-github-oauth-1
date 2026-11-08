# /tailscale-wasm ページ再開テスト（2026-11-08 UTC）

対象は現在のローカル実装「Muse Gadgets サンプル」。本番へのデプロイは行っていない。

- `npx vitest run src/views/tailscaleWasm.test.ts src/tailscale-wasm-route.test.ts src/utils/wasmTailnetService.test.ts src/askmgs.test.ts`: 4ファイル19テスト成功。出力scriptのnode --check、認可、別origin拒否、入力検証、Gadget専用経路、モデル選択から独立した/askmgsなどを検証。API/転送先はテスト用実装。
- `node scripts/check-tailscale-wasm-browser.mjs`: 実Chrome・390px幅で成功。初期表示で通信しないこと、接続準備による送信可否、重複submitで1回だけ送信、専用会話/要求ID、回答のHTML無害化、エラー時の入力保持・成功履歴非追加、ペアリング待ち・トークン未設定・ログイン待ち、許可外ログインURLの非表示、横はみ出しなし、CSP違反とpageerrorなしを検証。API応答は模擬しており実投稿ではない。
- `node scripts/check-worker-tailscale-wasm.mjs`: 実workerd・実WASM・SQLite Durable ObjectでNeedsLogin、shieldsUp、反復状態取得、汎用proxyの404を確認。tailnet参加は行っていない。
- `/opt/musegadget/venv/bin/python -m unittest discover -s ops -p 'test_muse_gadget_relay.py'`: 4テスト成功。署名、トークン照合、保存済みreceiptと再起動後の重複送信抑止、送信結果不明時の再送抑止を検証。最初にシステムPythonで実行した際はmusegadget未導入によりimport失敗したため、SDK導入済みの専用venvで再実行した。

このシェルでMUSE_GADGET_SDK_TOKENの存在のみ確認。秘密値は出力していない。値の有効性・本番Worker設定との一致・Museペアリング・実際の質問と回答・本番認証付き画面は未確認。Dockerビルド・Workerデプロイ・Git pushなし。
