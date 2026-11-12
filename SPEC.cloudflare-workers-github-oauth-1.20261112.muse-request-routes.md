# SPEC: Muse への送り方のまとめ(経路・ヘッダ・鍵・ジョブ登録、2026-11-12)

## 1. 既定の経路を直通にする

**対象**: `/api/aichat` の接頭語なしの Muse の送信、`/api/aichat/muse-health`、`src/utils/museWorkerAsk.ts` の `resolveMuseTransport`、`src/views/aichatMuseHealth.ts` の ⚙(接続方式)、`src/utils/museDirectAsk.ts` の `museDirectDep` — 接頭語を付けない Muse の送信は、本体のコンテナから muse-vm へ直接送るのを既定にする。

### 背景

- これまでの既定は Worker 内の Tailscale WASM(`main-worker-muse` ノード)だった。デプロイのたびにこのノードが再起動し、最初の送信で6秒以内に tailnet へつながらないと「Museへの接続を確認できません」になった(2026-11-12、Muse は動いていた)。
- ユーザー指定(2026-11-12): 「接頭語に何も指定しない Muse リクエストは直通。これは既定路線」。

### 修正内容

| ファイル | 変更 |
|---|---|
| `src/utils/museWorkerAsk.ts` | `resolveMuseTransport`: Cookie が無い・壊れている・`transport` が無いときは `container`(直通)。`transport: 'worker'` のときだけ Worker 内 WASM |
| `src/views/aichatMuseHealth.ts` | ブラウザ側の既定も `container`。⚙ の表示を「コンテナから直接（デフォルト）」「Worker内WASM」にした |
| `src/utils/museDirectAsk.ts`・`src/index.ts` | 直通でも、送った結果で `X-Muse-Tailscale`(画面の接続表示)を決める。muse-vm まで届かなかった失敗(`container_not_running`・`muse_connection_failed`・`llm_timeout`)は `unavailable`、届いた上での失敗(認証・利用上限・実行)は `connected` |

### 注意事項

- ⚙ を一度でも保存した利用者の Cookie には、当時の既定の `transport: 'worker'` が入っている。その場合は ⚙ で「コンテナから直接」を選び直して保存する(Cookie の値は利用者が選んだものとして尊重し、書き換えない)。
- 直通は本体の demo コンテナが起動していることが前提。止まっていれば送らずに「停止中」を返す(自動で起動しない・Worker 内 WASM へ切り替えない)。

## 2. 経路の一覧

**対象**: Muse(muse-vm の api-bridge、`http://muse-vm:8080/v1/chat/completions`)へ届くすべての経路。

| 入口 | 経路 | muse-vm へ渡す鍵 |
|---|---|---|
| `/aichat` 接頭語なし(既定) | 本体 Worker → demo コンテナ(`server.js`)→ `tailscale nc` → muse-vm | 本体の `MUSE_API_KEY` |
| `/aichat` 接頭語なし(⚙ で Worker内WASM を選んだとき) | 本体 Worker → `TailscaleWasm` Durable Object(`main-worker-muse`)→ muse-vm | 本体の `MUSE_API_KEY` |
| `/askmuse prompt="…"` | 直通(上の1行目と同じ) | 本体の `MUSE_API_KEY` |
| dynamicneko tree-view の Muse チャット | dynamicneko → 本体 `/api/tree-view/muse-chat-external` → 直通(既定)または WASM(`X-Muse-Transport: worker`) | dynamicneko の `MUSE_API_KEY`(本体は受け取った鍵をそのまま渡す) |
| ジョブ(4章) | 本体 → `TailscaleWasm` の `MuseAgentJobs` → WASM → muse-vm | 本体の `MUSE_API_KEY` |
| lib の `ask_muse`(`claude/ops/llm_worker_claude.py`) | tailnet 上の機械から `tailscale nc` → muse-vm | lib の `MUSE_API_KEY` |

ジョブは常に Worker 内 WASM を通る(直通の既定は適用されない)。

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

- 本番での直通の送信(この PR のデプロイ後に `/aichat` で確かめる)。
- muse-vm の api-bridge が、ヘッダを理由に要求を拒否していないこと(拒否されていればユーザー側で対応する、とのユーザー指定)。

## 関連コミット

(コミット後に追記)
