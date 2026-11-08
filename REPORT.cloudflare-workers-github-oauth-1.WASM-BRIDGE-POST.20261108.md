# Worker内WASMからMuseブリッジへの実POST（2026-11-08 UTC）

ローカルの実workerdで本体Workerと同じ配布済み `@ai-ecoverse/wasm-tailscale 1.104.1-13` を起動し、既存のTailscale認証キーとMUSE_API_KEYをメモリ内で渡して検証した。秘密値は記録しない。デバイス名はworker-muse-post-check、ephemeral=true、logUpload=false。検証後にlogoutを呼び、一時ファイルと実行環境を削除した。

## 成功した経路

`ローカルworkerd → 実Tailscale WASM → muse-vm:8080/v1/chat/completions → Museの回答`

WASMの状態Running、muse-vm online=trueを確認後、Bearer認証・Content-Type application/jsonを付けたPOSTを1回だけ送った。HTTP200、JSON応答325バイト、choicesあり、回答本文が `WASM_POST_BRIDGE_OK_20261108` と完全一致した。単なるHTTP成功だけで判定していない。Gadgets SDKトークン・Gadgetsのペアリング・Bluetoothはこの経路に使用しない。

比較用の既存server.js → native Tailscale → muse-vmへの別POSTも1回送信。HTTP200、23.73秒、別の確認文字列 `POST_BRIDGE_OK_20261108` と回答本文が完全一致した。WASMからの成功の証拠はこの比較POSTではなく、独立したWASMの応答である。

## 初回の失敗と検証の境界

最初の検証コードは認証開始直後に/startの応答を返したところNeedsLoginのままとなり、POSTを送らず終了した。認証開始とRunning待機を同一のworkerdリクエスト内で行う形へ変更した再試行で認証と実POSTに成功。元の試行が進まなかった根本原因は未確定。

今回の実行は `scripts/check-worker-muse-post-live.mjs` による独立したローカルworkerdの検証であり、本番Worker・Durable Object・ログイン済み/tailscale-wasmページを通す検証ではない。現在のページAPIはGadgets専用中継へ送る実装のまま。ページから既存ブリッジへ送る変更、永続ノードの認証復元、本番反映は未実施。WASMの起動をコンテナのtailscaledへ代替していない。Dockerビルド・Workerデプロイ・pushなし。

秘密値を含まない結果:

- `artifacts/wasm-tailscale-20261108/worker-muse-post-success.jsonl`
- `artifacts/wasm-tailscale-20261108/native-muse-post-live.json`
- `artifacts/wasm-tailscale-20261108/worker-muse-post-live.log`（初回試行の要約）

構文検査 `node --check scripts/check-worker-muse-post-live.mjs` と `git diff --check` 成功。
