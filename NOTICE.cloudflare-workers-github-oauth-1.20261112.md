# NOTICE 2026-11-12

## Worker 内 WASM(main-worker-muse)で、推論に1分以上かかると Muse の返事が届かない

- 2026-11-12 06:40(UTC)、AIチャットの Muse(Worker 内 WASM 経由)が、muse-vm に届いた(Muse の通知が来た)のに300秒でタイムアウトした。
- 本番のログ(Workers Observability、`$workers.entrypoint = TailscaleWasm`)の流れ: muse-vm(ホームの DERP は derp-2)への中継として derp-2 につなぐ → チャットを送る → 06:41:52 `magicsock: closing connection to derp-2 (idle), age 1m15s` → 06:43:39 `wg: [dqzjN] - Session expired after 180 seconds`。返事が届いた記録は無い。
- WASM のノードは、送信の無い DERP 接続を約1分で閉じる。推論を待つ間はこちらから何も送らないので、返事の通り道が先に閉じられる(推測。muse-vm 側では確かめていない)。`/health` のように1分以内に終わる要求は通る。本体 demo コンテナ経由(本物の tailscaled)では起きない。
- 対処: 推論を待つ間、muse-vm へ20秒ごとに短い `/health` を送り、接続を使用中に保つ(`WasmMuseBridge` の `keepAliveMs`)。推論の要求は送り直さない。
- **本番で直ったことを確かめた**(2026-11-12、[#2575](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/2575) のデプロイ後、ユーザーの確認)。
- **Durable Object で待っても直らない。** 今回も応答は `TailscaleWasm` の Durable Object の中で待っていた(ログの `POST /muse/v1/chat/completions` が数分間この Durable Object の記録として続く。上限300秒)。Durable Object も muse-vm との TCP 接続も生きていたが、その下の WASM の Tailscale が DERP 中継を閉じたため、同じ接続を戻る返事が届かなかった。待つ場所ではなく、通り道を保つか、返事を別の経路で受け取る必要がある。

  | やり方 | 中身 | muse-vm 側の変更 |
  |---|---|---|
  | 通り道を保つ(採用、#2575) | 待つ間20秒ごとに `/health` を送り、中継を使用中に保つ | 不要 |
  | 返事を後から取りに行く | muse-vm が受け付けたら ID を返し、Durable Object がアラームで結果を取りに行く | 必要(非同期の受け口) |
  | 返事を送ってもらう | muse-vm が終わったら Worker の受け口へ結果を送る | 必要(送り返す処理と鍵) |

  1つの長い接続に頼る点は残るので、`/health` を送っていても途切れるようなら、2つ目(後から取りに行く)に切り替える。
- **見分け方**: Muse に届いている(通知が来る)のに応答が返らず300秒でタイムアウトし、死活確認(`/health`)は成功する。ログに、推論中の `closing connection to derp-N (idle)` と `Session expired after 180 seconds` が出る。
- WASM の Tailscale(`@ai-ecoverse/wasm-tailscale`)の `fetch` は Go の HTTP クライアントで、応答は Content-Length・chunked に従って読み終える。読み方(keep-alive)は原因ではなかった。
- ログの調べ方: Cloudflare API `POST /accounts/{account}/workers/observability/telemetry/query` で、`$metadata.service` と `$workers.entrypoint` で絞る(エージェントの環境からも、プロキシが付ける鍵で読めた)。
