# NOTICE: TailscaleWasm の起動失敗回復と /cf-containers のヘルスチェック欄（2026-11-18）

日付: 2026-11-18（JST）
**対象**: `src/durable/tailscaleWasm.ts` の起動失敗回復（PR #2629、マージ済み）と、`/cf-containers` の tailscale ヘルスチェック欄（PR #2630）。仕様は SPEC.cloudflare-workers-github-oauth-1.tailscale-wasm.recovery 版5（REQ-TW-001〜016）。

## 経緯と結果

- 2026-11-17 18:39 JST 以降、tree-view のジョブが muse-vm に届かなくなった。本体側の応答は 503 `tailscale_wasm_unavailable`。原因として、DO の永続状態（`tailnet_state`）が壊れていると起動失敗が続き、`/status` を含む全経路が ensureNode の例外で到達不能になる構造を確認した。
- PR #2629（状態のフィンガープリントが変わった場合に限り、状態を1回だけ破棄して再起動する回復、起動失敗と破棄の D1 記録 migration 0193）をマージし、デプロイ後に実経路で復旧を確認した（ノードが netmap に戻り active、IP が 100.103.197.48 から 100.127.175.6 へ変化、tree-view のジョブがブリッジ台帳で answered）。
- 破棄が実際に発動したかの確定は、D1 の `tailscale_wasm_boot_log` に `state_discarded` の行があるかで判定する。この確認は本体側に残る。

## PR #2630 の内容（REQ-TW-015、016）

- 管理者 API `GET /api/cf-containers/tailnet-health`（DO の /status と D1 の起動記録の要約。DO への取得失敗は欄の状態として返し、API は異常終了しない。ログイン URL は出さない）。
- 欄にはノード自身の IP（DO が受け取る netmap の自ノードの addresses から取得。推測や固定値は使わない）を大きく表示し、正常は緑、停止・到達不能は赤で表す。
- 確認のたびに結果（時刻・状態・IP）を D1（migration 0194 `tailscale_node_health_checks`）に記録し、履歴として表示する。IP が前回から変わった行はその旨を表示する。自動の再確認は15秒間隔、手動のボタンも置いた。
- 検証: 対象テスト 75/75、ページの script は `node --check` 通過、tsc のエラー数は変更前後とも100件（すべて既存）。実経路の表示確認はデプロイ後に残る。

## Lint（EVAL）の指摘

EVAL.cloudflare-workers-github-oauth-1.tailscale-wasm.recovery（2026-11-18、自己評価）: 合格、error 0件、warning 2件。

- REQ-TW-005（構造化ログ）に対応する受け入れ条件の名指しが無い。確認は復旧手順の切り分けと D1 側の記録で代替している。
- REQ-TW-015 の「直近分」と REQ-TW-016 の再確認間隔に、SPEC 側の数値が無い。実装は起動記録10件、再確認15秒を選んだ。数値を SPEC に確定するのは今後の版で行う。
