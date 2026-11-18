# NOTICE 2026-11-12

## Worker 内 WASM(main-worker-muse)で、推論に1分以上かかると Muse の返事が届かない

- 2026-11-12 06:40(UTC)、AIチャットの Muse(Worker 内 WASM 経由)が、muse-vm に届いた(Muse の通知が来た)のに300秒でタイムアウトした。
- 本番のログ(Workers Observability、`$workers.entrypoint = TailscaleWasm`)の流れ: muse-vm(ホームの DERP は derp-2)への中継として derp-2 につなぐ → チャットを送る → 06:41:52 `magicsock: closing connection to derp-2 (idle), age 1m15s` → 06:43:39 `wg: [dqzjN] - Session expired after 180 seconds`。返事が届いた記録は無い。
- WASM のノードは、送信の無い DERP 接続を約1分で閉じる。推論を待つ間はこちらから何も送らないので、返事の通り道が先に閉じられる(推測。muse-vm 側では確かめていない)。`/health` のように1分以内に終わる要求は通る。本体 demo コンテナ経由(本物の tailscaled)では起きない。
- 対処: 推論を待つ間、muse-vm へ20秒ごとに短い `/health` を送り、接続を使用中に保つ(`WasmMuseBridge` の `keepAliveMs`)。推論の要求は送り直さない。
- ログの調べ方: Cloudflare API `POST /accounts/{account}/workers/observability/telemetry/query` で、`$metadata.service` と `$workers.entrypoint` で絞る(エージェントの環境からも、プロキシが付ける鍵で読めた)。
