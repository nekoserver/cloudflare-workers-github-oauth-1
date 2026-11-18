# Worker内Tailscale WASMからMuseブリッジへの直接POST

## 目的と確認状態

`/tailscale-wasm`ページから、Gadgets SDKの初回ペアリングに依存せず、既存のMuseブリッジAPIへ質問を送り回答を取得する経路を整備する。

2026-11-08 UTC、独立したローカルworkerdで実Tailscale WASMから既存ブリッジへの認証付きPOSTと実回答取得に成功した。本番Worker・Durable Object・ページ操作を通す検証は未実施。現在のページはGadgets専用中継を呼ぶ実装のままであり、以下の成功をページの完成・本番反映済みと扱わない。

## 成功した経路と認証

```text
ローカルworkerd
  → @ai-ecoverse/wasm-tailscale 1.104.1-13
  → Tailscale内のmuse-vm:8080
  → POST /v1/chat/completions
  → Museの回答
```

Tailscaleへの参加は既存コンテナの認証キー、Museブリッジへの要求は既存のMUSE_API_KEYによるBearer認証を使用した。両方の認証が必要であり、Tailscaleノードの登録だけではMuse APIの利用成功を意味しない。秘密値はブラウザ・ログ・このSPECへ記録しない。

検証ノードは `worker-muse-post-check`。ユーザーもTailscale公式アプリでこの名前の認識を確認した。ephemeral=true、logUpload=falseで作成し、実行後にlogoutした。コンテナのnative tailscaledにWASM通信を代替させていない。この経路ではGadgets SDKトークン・Gadgetsペアリング・Bluetoothを使用しない。

## 成功時の実際のやり取り

送信先は `http://muse-vm:8080/v1/chat/completions`、メソッドはPOST。Content-Typeはapplication/json、AuthorizationはBearer（値は非公開）。送信本文:

```json
{
  "model": "muse",
  "stream": false,
  "messages": [
    {
      "role": "user",
      "content": "Reply with exactly WASM_POST_BRIDGE_OK_20261108 and nothing else."
    }
  ]
}
```

受信した `choices[0].message.content` は、前後空白を除いて次の文字列と完全一致した:

```text
WASM_POST_BRIDGE_OK_20261108
```

| 確認項目 | 実行結果 |
|---|---|
| WASMの状態 | Running、panic=false |
| muse-vm | online=true |
| POST回数 | 成功試行で1回、自動再送なし |
| HTTP応答 | 200 |
| 応答形式 | JSON、325バイト、choicesあり |
| 回答検査 | 指定文字列との完全一致を確認 |
| 後処理 | loggedOut=true、一時実行環境を削除 |

比較用に既存server.js → native Tailscale → muse-vmへも別POSTを1回送った。質問は `Reply with exactly POST_BRIDGE_OK_20261108 and nothing else.`、回答は前後空白を除いて `POST_BRIDGE_OK_20261108` と完全一致。HTTP200、23.73秒。この比較結果をWASMの成功の代用にはしていない。

## 検証方法と初回試行

実行スクリプトは [scripts/check-worker-muse-post-live.mjs](scripts/check-worker-muse-post-live.mjs)。既存環境の秘密値をメモリ内で渡し、固定宛先へPOSTする。再実行は実ノード登録と実質問送信を伴うため、通常のオフラインテストとは区別する。

初回は認証開始直後に/startの応答を返す検証コードでNeedsLoginのままとなり、POSTを送らず終了した。認証開始とRunning待機を同一のworkerdリクエスト内に置いた再試行で成功した。初回の停止の根本原因は未確定であり、この変更だけを一般的な解決策とは断定しない。

根拠:

- [成功したWASMの結果](artifacts/wasm-tailscale-20261108/worker-muse-post-success.jsonl)
- [比較用native経路の結果](artifacts/wasm-tailscale-20261108/native-muse-post-live.json)
- [初回試行の要約](artifacts/wasm-tailscale-20261108/worker-muse-post-live.log)
- [成功REPORT](REPORT.cloudflare-workers-github-oauth-1.WASM-BRIDGE-POST.20261108.md)

## 後続実装と未検証範囲

ページの管理者認可・別origin拒否・入力検証を維持し、質問を固定されたmuse-vm APIへ1回だけ送る実装を追加した。Gadgets・コンテナ・tunnelsへの自動切替や自動再送は行わない。

## 後続実装（ローカル、Worker未配備）

通常のMuse入力はWorker→Muse WASM経路を既定にし、⚙モーダルで旧コンテナ直通を明示選択できる。prefixなしのMuseと`/askmuse`はWorkerを使い、既存の明示エンジンprefixは独立経路のまま。要求は一度だけ送信し、自動fallbackや再送を行わない。

`/tailscale-wasm`はWorker→Museのチャット、永続Jobと返信、状態確認、コスト表示を持つ。JobはWASMと別のSQLite Durable Object領域へ先に保存し、送信中にDOが終了した場合は`delivery_unknown`として人が確認できる状態にする。自動再送はしない。同じJobへの返信には過去に成功したMuse要求・回答を最大16KiBまで含める。

Codex/Claude Codeの補助問い合わせ時は、稼働中コンテナに限ってtunnels.rb経由で質問する。各エージェントが前回読んだ後のMuse Job結果を同じ問い合わせの文脈に付け、妥当な回答後にのみ読み取りカーソルを進める。これは問い合わせ時の引き継ぎであり、独立したCLIやWorkspaceへの常時同期機能ではない。T3接続確認とログイン引き継ぎも稼働中コンテナだけに許し、停止状態から起動しない。

T3の一回限りログインURL生成は`src/utils/t3PairingHandoff.ts`の`requestT3PairingHandoff`に共通化し、既存`/cf-containers/proxy/t3/pairing`と本ページの両方から呼ぶ。関数はコンテナの固定`POST /t3/pairing`を使い、`https://t3.nekomaneki.work/pair#token=...`以外を拒否する。実T3 URLは今回発行していない。

料金表示は`src/views/tailscaleWasmCost.ts`の`renderWorkerCostWidget`、`renderContainerFleetCostWidget`と各Script関数に分割し、片方ずつ、またはまとめてページへ組み込める。DOアカウント使用量とWorker要求量はAnalytics APIの集計値、コンテナ費用は稼働台帳からの概算であり、Cloudflare請求書そのものではない。全コンテナ一覧の取得は起動操作を行わない。

検証: `check-worker-muse-do-live.mjs`で実Durable Object→実Tailscale WASM→Muse POST(HTTP 200、マーカー完全一致)、明示logout後に停止(503)を再確認。関連Vitest群と実Chrome画面検査に成功。ChromeのAPI応答は模擬で、T3 URLの発行・Codex/Claudeの実問い合わせ・ログイン済み本番UIは未実施。

通常のAIチャット入力窓とこのページの長時間操作は`AICHAT_JOB` Durable Objectで受付後に実行・ポーリングする。ページはJob IDをlocalStorageに保持し、再訪時に結果取得を再開する。コンテナ直通の旧Muse経路は削除せず、ページから明示実行できる別Jobとして残す。自動fallbackはしない。Job保存とWASMの認証状態・推論状態は別のDO領域で管理する。

実際の入力窓に相当する`POST /api/aichat/jobs`から本体Workerの経路を通すlive検査は完了しなかった。Job自体はdoneになったが`museTailscale=unavailable`で、固有回答マーカーも確認できていない。別検査のDO→WASM→Muse実POST成功を入力窓の成功として扱わない。統合失敗の記録は`artifacts/wasm-tailscale-20261108/aichat-live-e2e-result.jsonl`、独立したDO成功の記録は`artifacts/wasm-tailscale-20261108/worker-do-live.jsonl`。

本番反映にはWorkerの公開操作が必要で、未実施。Cloudflare productionでは`TAILSCALE_WASM` binding/migrationをまだ追加していない。既存コンテナのイメージ更新は不要で、Container rolloutを抑止するdry-runは成功している。Docker build・Git pushも行っていない。

## 2026-11-14: tree-viewのMuseタブはWorker直通のみ

Museタブの送信と接続検査ではDEMO_CONTAINERを参照しない。dynamicnekoの旧container Cookieを採用せず、両中継APIのcontainer指定を400で拒否し、省略時もworkerに固定する。UIの経路選択を除去する。本体のAIチャットで明示選択する旧コンテナ経路と、tunnelsのmuse_promptは別仕様のまま。

接続確認の上限は本体32秒・dynamicneko40秒、投稿は本体600秒・dynamicneko610秒。送信とhealthで呼出元の同じ鍵を明示し、未接続と上流の認証/実行失敗を混同しない。テストと実測の範囲、本番未反映の状態はNETWORK-MUSE.20261114 REPORTに記録する。
