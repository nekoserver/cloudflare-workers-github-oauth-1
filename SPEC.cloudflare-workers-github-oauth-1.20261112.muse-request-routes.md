# SPEC: Muse への送り方のまとめ(経路・ヘッダ・鍵・ジョブ登録、2026-11-12)

## 1. AIチャットの接頭語なしの Muse は常に直送

**対象**: `/api/aichat` の接頭語なしの Muse の送信、`/api/aichat/muse-health`、`src/views/aichatMuseHealth.ts` の ⚙、`src/utils/museDirectAsk.ts` の `museDirectDep` — AIチャットからの Muse 送信は、接頭語を付けない限り、常に本体のコンテナから muse-vm へ直接送る。経路の選択は無くす。

### 背景

- これまでは Cookie の設定で Worker 内の Tailscale WASM(`main-worker-muse` ノード)を既定にしていた。デプロイのたびにこのノードが再起動し、最初の送信で6秒以内に tailnet へつながらないと「Museへの接続を確認できません」になった(2026-11-12、Muse は動いていた)。
- ユーザー指定(2026-11-12): 「AIチャットからのMuse送信は(接頭語をつけない限り)常に直送」。

### 修正内容

| ファイル | 変更 |
|---|---|
| `src/index.ts` | `/api/aichat` の接頭語なしの Muse と `/api/aichat/muse-health` は、Cookie を読まずに常に直送(`X-Muse-Transport: container`)。ジョブ受付が Cookie に経路を書き込む処理も外した |
| `src/utils/museWorkerAsk.ts` | `resolveMuseTransport` を削除。`checkMuseWorkerHealth`・`museWorkerDep` は `/tailscale-wasm` ページ(Worker内WASMを明示的に試す機能)だけが使う |
| `src/views/aichatMuseHealth.ts` | ⚙ の「接続方式」の選択欄を削除。保存する設定は有効/無効と間隔だけ(古い Cookie の `transport` は読まない) |
| `src/utils/museDirectAsk.ts` | 直送でも、送った結果で `X-Muse-Tailscale`(画面の接続表示)を決める。muse-vm まで届かなかった失敗(`container_not_running`・`muse_connection_failed`・`llm_timeout`)は `unavailable`、届いた上での失敗(認証・利用上限・実行)は `connected` |

### 注意事項

- 直送は本体の demo コンテナが起動していることが前提。止まっていれば送らずに「停止中」を返す(自動で起動しない・ほかの経路へ切り替えない)。

## 2. Muse への6系統

**対象**: Muse(muse-vm の api-bridge、`http://muse-vm:8080/v1/chat/completions`)へ届くすべての経路 — 経路キーで1つずつ区別する(ユーザー指定 2026-11-12)。

| 経路キー | 入口 | 経路 | muse-vm 側で受ける鍵 | ジョブの積み上げ |
|---|---|---|---|---|
| `aichat-direct` | 本体 AIチャット、接頭語なし(`/askmuse prompt="…"` も同じ経路) | 本体 Worker → demo コンテナ(`server.js`)→ `tailscale nc` → muse-vm | 本体の `MUSE_API_KEY` | 特化していない |
| `treeview-muse-tab` | dynamicneko tree-view の AI タブの「Museタブ」(直送専用) | dynamicneko → 本体 `/api/tree-view/muse-chat-external`(ヘッダ付与)→ demo コンテナ → muse-vm | dynamicneko の `MUSE_API_KEY`(本体はそのまま渡す) | 特化していないが可能 |
| `treeview-worker-tab` | dynamicneko tree-view の AI タブの「ワーカータブ」 | dynamicneko → 本体ワーカーを経由(会話ストリーム) | 本体の `MUSE_API_KEY`(未確認) | 特化していないが可能 |
| `muse-wasm-jobs` | 本体 `/muse-wasm-test` ページ | 本体 → `TailscaleWasm` の `MuseAgentJobs`(4章)→ WASM(`main-worker-muse`)→ muse-vm | 本体の `MUSE_API_KEY` | 特化している |
| `aichat-askmgs-wasm` | 本体 AIチャット、接頭語 `/askmgs prompt="…"` | 本体 → `/api/tailscale-wasm/chat` → `TailscaleWasm`(WASM)→ Gadgets | `MUSE_GADGET_SDK_TOKEN` | 特化していない |
| `aichat-tunnels` | 本体 AIチャット、`/neko askgk muse_prompt="…"` | 本体 → rust-worker-sqlx-d1 の `/tunnel-signer` → tunnels.rb(コンテナ)→ Muse | tunnels.rb 側の設定(本体は扱わない) | 特化していない |

- 接頭語付きの AI 投稿(`/askmuse`・`/askmgs`・`/neko askgk muse_prompt=` などの Muse と、`codex_prompt=`・`claude_prompt=` などそれ以外のモデル)は、主に外部アプリからの用途を想定している(ユーザー指定 2026-11-12)。画面から人が送る通常の投稿は接頭語なし(`aichat-direct`)。
- 経路キーは、この表で区別するための名前。要求のヘッダや記録にはまだ付けていない。
- lib の `ask_muse`(`claude/ops/llm_worker_claude.py`)は、tailnet 上の機械から `tailscale nc` で muse-vm へ送る、本体の外の経路(lib の `MUSE_API_KEY`)。
- 送り方(`Authorization: Bearer <鍵>`・`Content-Type: application/json`・`{model, messages}`)を確かめたのは `aichat-direct`・`treeview-muse-tab`・`muse-wasm-jobs`(と tree-view の `X-Muse-Transport: worker`)。`treeview-worker-tab`・`aichat-askmgs-wasm`・`aichat-tunnels` の muse-vm 側の形は確かめていない。

## 3. 各区間のヘッダとボディ

**対象**: muse-vm へ届く要求の形 — すべての経路で ask_muse と同じ形にそろえる。

muse-vm へ届く要求(どの経路でも同じ):

- `POST http://muse-vm:8080/v1/chat/completions`
- ヘッダ: `Authorization: Bearer <鍵の値>`、`Content-Type: application/json`
- ボディ: `{"model": "muse", "messages": [{"role": "user", "content": "…"}]}`(`stream` などは付けない)

途中の区間:

| 区間 | ヘッダ | ボディ |
|---|---|---|
| 本体 Worker → demo コンテナ `/muse/v1/chat/completions` | `Authorization: Bearer <鍵>`、`Content-Type: application/json`(`server.js` はそのまま muse-vm へ渡す) | `{model, messages}` |
| 本体 Worker → `TailscaleWasm` `/muse/v1/chat/completions` | `Content-Type: application/json`。dynamicneko の鍵を渡すときだけ `Authorization: Bearer <鍵>` | `{model, messages}`(中継は `messages` だけ読み、`{model:'muse', messages}` を組み直す) |
| dynamicneko → 本体 `/api/tree-view/muse-chat-external` | `Authorization: Bearer <dynamicneko の MUSE_API_KEY>`、`Content-Type: application/json`、`X-Aichat-User-Token`、`X-Muse-Transport`、`CF-Worker`・`CF-Worker-Timestamp`・`CF-Worker-Signature`(ボディに対する HMAC) | `{model, messages}` |

## 4. ジョブ登録の手順

**対象**: `/api/tailscale-wasm/jobs` 系(管理者だけ。`TailscaleWasm` の `MuseAgentJobs` が順に送る)。

| 操作 | 要求 | 内容 |
|---|---|---|
| 登録 | `POST /api/tailscale-wasm/jobs`(同じオリジンから) | ボディ `{"requestId": "<ID>", "prompt": "…", "jobId": "<ID>"(省略可), "agent": "user" / "codex" / "claude"(省略時 user)}`。`prompt` は UTF-8 で 16KiB まで。同じ `requestId` を違う中身で送ると 409 |
| 一覧 | `GET /api/tailscale-wasm/jobs` | 自分のジョブ(最新20件)と各メッセージの状態(`queued`→`sending`→`done` / `failed` / `delivery_unknown`)・回答・時刻 |
| 変更の取得 | `GET /api/tailscale-wasm/jobs/changes?consumer=codex`(または `claude`) | 前回の確認位置より後の変更 |
| 確認位置の更新 | `POST /api/tailscale-wasm/jobs/ack?consumer=codex`、ボディ `{"cursor": <数値>}` | 取得した変更を読み終えたことを記録する |

- 同じ `jobId` の2件目以降は、前の依頼と回答を履歴として付けて送る。
- 送信中に Durable Object が再起動したものは `delivery_unknown` になり、自動では送り直さない。
- ジョブは Worker 内 WASM を通るので、`main-worker-muse` が tailnet につながっていないと `failed` になる(`/tailscale-wasm` で状態を確かめる。ログインが要るときは `TAILSCALE_AUTHKEY` で自動ログインする)。

## 5. エラーの見分け方

| 画面の表示(`errorCode`) | 意味 | 見るところ |
|---|---|---|
| Museへの接続を確認できません(`muse_connection_failed`) | muse-vm まで届かなかった | 直通: demo コンテナと `tailscale status`。WASM: `/tailscale-wasm` の状態 |
| 停止中(`container_not_running`) | 直通で demo コンテナが止まっている | `/cf-containers` |
| 認証に失敗(`muse_authentication_failed`) | muse-vm に届いたが鍵が違う(401/403) | 送った側の `MUSE_API_KEY` と muse-vm の鍵 |
| 利用上限(`muse_usage_limit`) | 429 | Muse 側 |
| 時間切れ(`llm_timeout`) | 待ち時間(`/neko askgk` と同じ保存値)を超えた | 待ち時間の設定 |

## 6. 確かめていないこと

- 本番での直送の送信(この PR のデプロイ後に `/aichat` で確かめる)。
- `treeview-worker-tab`・`aichat-askmgs-wasm`・`aichat-tunnels` の経路の細部と鍵(2章の「未確認」)。
- muse-vm の api-bridge が、ヘッダを理由に要求を拒否していないこと(拒否されていればユーザー側で対応する、とのユーザー指定)。

## 関連コミット

- [`b47f384`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b47f384) 接頭語なしの Muse を直通(コンテナ経由)を既定にし、直通の接続表示を送った結果で決める
