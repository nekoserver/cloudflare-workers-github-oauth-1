# SPEC: Muse への送り方のまとめ(経路・ヘッダ・鍵・ジョブ登録、2026-11-12)

## 1. AIチャットの Muse の直送は、コンテナを通さない(2026-11-12 訂正)

**対象**: `/api/aichat` の接頭語なしの Muse と `/askmuse`、`/api/aichat/muse-health`、`src/views/aichatMuseHealth.ts` の ⚙、`src/durable/tailscaleWasm.ts` — 「直送」は本体 Worker 内の Tailscale WASM(`main-worker-muse`)から muse-vm へ送る経路だけを指す。コンテナを通るものは直送と呼ばない。

### 背景

- [#2572](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/2572)(`b47f384`・`11b3c043`)は、ユーザー指定「AIチャットからのMuse送信は(接頭語をつけない限り)常に直送」を「本体のコンテナから muse-vm へ直接送る」と読み違え、接頭語なしの Muse を demo コンテナ(`server.js` → `tailscale nc`)に固定した。
- その結果、本体 Worker から demo コンテナへの `container.fetch` が戻らず、AIチャットに「❌ Muse がタイムアウトしました(300秒以内に応答がありませんでした)」が出た(2026-11-12)。muse-vm と鍵は正常(同じ鍵で muse-vm・コンテナの `server.js` のどちらに送っても 10〜44 秒で 200)。
- ユーザー指定(2026-11-12): 「直送はコンテナを経由しないという意味で直送」。直送以外は、AIチャットから直接コンテナの tunnels.rb を通る(`/neko askgk muse_prompt=`)か、`/muse-wasm-test` を通るか。
- 正しい形は `SPEC.cloudflare-workers-github-oauth-1.aichat-muse.20261106.md` の 2026-11-08 の図。既定は Worker → `TAILSCALE_WASM` → muse-vm、点線の「旧コンテナ直通」は保存済みの設定で選んだときだけ。

### 修正内容

| ファイル | 変更 |
|---|---|
| `src/index.ts` | #2572 の経路の固定を戻した。接頭語なしの Muse と `/askmuse` は ⚙ の設定(Cookie `aichat_muse_signal` の `transport`)に従い、既定は直送(`X-Muse-Transport: worker`)。旧コンテナ直通は `transport: 'container'` を選んだときだけ。失敗しても互いの代替・tunnels への切り替えはしない |
| `src/utils/museWorkerAsk.ts` | `resolveMuseTransport` を戻した(既定 `worker`) |
| `src/views/aichatMuseHealth.ts` | ⚙ の「接続方式」の選択欄を戻した(既定は直送) |
| `src/utils/museNodeReady.ts`(新規)・`src/durable/tailscaleWasm.ts` | `/muse/*` を送る前に、WASM ノードが `Running` になり、かつ netmap に muse-vm がオンラインで載るまで最大 20 秒待つ。以前は 6 秒・`Running` だけで打ち切り、デプロイ直後の最初の送信が「Museへの接続を確認できません」になっていた |
| `src/utils/museDirectAsk.ts` | コメントだけ: この部品はコンテナ経由で、直送ではないと書いた。関数や定数の名前(`askMuseDirect`・`museDirectDep`・`MUSE_DIRECT_PATH`)は、経路の名前が決まるまで変えない(7章) |

旧コンテナ直通(本体 Worker → demo コンテナの `server.js` → muse-vm)は直送ではない。⚙ で明示的に選んだときだけの互換経路。経路の名前は7章(候補・未確定)。

### 注意事項

- 直送は `main-worker-muse` が tailnet につながっていることが前提。つながらなければ「Museへの接続を確認できません」を返し、コンテナや tunnels へは切り替えない。
- 本番での直送の実送信は、デプロイ後に `/aichat` で確かめる。

## 2. Muse への6系統

**対象**: Muse(muse-vm の api-bridge、`http://muse-vm:8080/v1/chat/completions`)へ届くすべての経路 — 経路キーで1つずつ区別する(ユーザー指定 2026-11-12)。

| 経路キー | 入口 | 経路 | ワーカーで完結 / コンテナ必須 | muse-vm 側で受ける鍵 | ジョブの積み上げ |
|---|---|---|---|---|---|
| `aichat-direct` | 本体 AIチャット、接頭語なし(`/askmuse prompt="…"` も同じ経路) | 本体 Worker → `TailscaleWasm`(`main-worker-muse`)→ muse-vm(⚙ で旧コンテナ直通を選んだときだけ demo コンテナの `server.js` → `tailscale nc` → muse-vm) | **ワーカーで完結**(旧コンテナ直通を選んだときはコンテナ必須) | 本体の `MUSE_API_KEY` | 特化していない |
| `treeview-muse-tab` | dynamicneko tree-view の AI タブの「Museタブ」(直送専用) | dynamicneko → 本体 `/api/tree-view/muse-chat-external`(ヘッダ付与)→ demo コンテナ → muse-vm | **コンテナ必須**(本体 demo コンテナ。tree-view で通信経路に「ワーカー」を選ぶと本体の Worker 内 WASM を通り、**ワーカーで完結**) | dynamicneko の `MUSE_API_KEY`(本体はそのまま渡す) | 特化していないが可能 |
| `treeview-worker-tab` | dynamicneko tree-view の AI タブの「ワーカータブ」 | dynamicneko → 本体ワーカーを経由(会話ストリーム) | 未確認 | 本体の `MUSE_API_KEY`(未確認) | 特化していないが可能 |
| `muse-wasm-jobs` | 本体 `/muse-wasm-test` ページ | 本体 → `TailscaleWasm` の `MuseAgentJobs`(4章)→ WASM(`main-worker-muse`)→ muse-vm | **ワーカーで完結** | 本体の `MUSE_API_KEY` | 特化している |
| `aichat-askmgs-wasm` | 本体 AIチャット、接頭語 `/askmgs prompt="…"` | 本体 → `/api/tailscale-wasm/chat` → `TailscaleWasm`(WASM)→ `MUSE_GADGET_RELAY_URL`(`http://cf-demo-container:8766`)→ Gadgets | **コンテナ必須**(WASM を通るが、行き先の `cf-demo-container` は本体 demo コンテナ) | `MUSE_GADGET_SDK_TOKEN`(中継への署名は `ORIGIN_HMAC_SECRET`) | 特化していない |
| `aichat-tunnels` | 本体 AIチャット、`/neko askgk muse_prompt="…"` | 本体 → rust-worker-sqlx-d1 の `/tunnel-signer` → tunnels.rb(コンテナ)→ Muse | **コンテナ必須**(tunnels.rb のコンテナ。本体 demo コンテナかどうかは未確認) | tunnels.rb 側の設定(本体は扱わない) | 特化していない |

- 接頭語付きの AI 投稿(`/askmuse`・`/askmgs`・`/neko askgk muse_prompt=` などの Muse と、`codex_prompt=`・`claude_prompt=` などそれ以外のモデル)は、主に外部アプリからの用途を想定している(ユーザー指定 2026-11-12)。画面から人が送る通常の投稿は接頭語なし(`aichat-direct`)。
- 「ワーカーで完結」の経路は、本体の demo コンテナが止まっていても送れる(Worker 内の Tailscale WASM ノード `main-worker-muse` が tailnet につながっていればよい)。「コンテナ必須」の経路は、そのコンテナが止まっていれば送れない(自動で起動しない・ほかの経路へ切り替えない)。
- `treeview-muse-tab` の送信チェック(2026-11-12): tree-view で Museタブを開いたとき・Museを選んだ状態で ⬜ でウィンドウで開くたびに、ボディ `{"action":"connect"}`(ヘッダは送信と同じ)を本体の中継へ送る。中継は推論を走らせず、muse-vm の `/health` だけを見て `{healthy, transport, keySource}` を返す(停止中のコンテナは起動しない)。tree-view はチェックの間だけ3本縦棒を動かし、結果の文字は出さない。
- 経路キーは、この表で区別するための名前。要求のヘッダや記録にはまだ付けていない。
- lib の `ask_muse`(`claude/ops/llm_worker_claude.py`)は、tailnet 上の機械から `tailscale nc` で muse-vm へ送る、本体の外の経路(lib の `MUSE_API_KEY`)。
- 送り方(`Authorization: Bearer <鍵>`・`Content-Type: application/json`・`{model, messages}`)を確かめたのは `aichat-direct`・`treeview-muse-tab`・`muse-wasm-jobs`(と tree-view の `X-Muse-Transport: worker`)。`treeview-worker-tab`・`aichat-askmgs-wasm`・`aichat-tunnels` の muse-vm 側の形は確かめていない。

### 2.1 通信の確認状況(2026-11-13)

**対象**: 上の表の6系統 — 本番で実際に Muse の答えが返ったかどうか。

| 経路キー | 状況 | 確かめたこと |
|---|---|---|
| `aichat-direct`(直送、Worker 内 WASM) | **とりあえず解決** | 19:09 UTC に直送で「今日は何日？」を送り、Muse が答えた(利用者が Muse の通知で確認)。推論を通らない `/usage` は約2秒で 200。待ち時間は api-bridge と同じ600秒にした(PR #2587)。鍵は df0100…(指紋 8c740698) |
| `aichat-direct`(⚙ の旧コンテナ直通、demo コンテナ経由) | **とりあえず解決** | 19:04 UTC に同じ鍵・同じ本文で送り、58秒で HTTP 200「2026年11月13日です。」 |
| `treeview-muse-tab` | 未確認(利用者によると動いている) | 本体からは送っていない |
| `treeview-worker-tab` | 未確認 | — |
| `muse-wasm-jobs` | 未確認 | 11-11 19:43 UTC までは答えが返っていた。11-12 の3件は600秒の 504(Muse が断っていた・ロック待ちの影響を切り分けていない) |
| `aichat-askmgs-wasm` | 未確認 | — |
| `aichat-tunnels` | 未確認 | — |

- 直送で答えが返らなかった原因は、鍵でも POST の本文でもなかった。api-bridge は鍵が違えば即 401 を返す。`/usage` は直送でも返る。残った原因は2つ。(1) Muse が送信者の分かった質問を断っていた(利用者が Muse に伝えて解消)。(2) こちらが先に切ったジョブで、api-bridge が最大600秒ロックを握り、後続が詰まっていた(api-bridge 0.4.1 で解消予定。muse-vm-hacks PR #1、muse-vm には未反映)。
- Muse の答えには1〜3分かかる。コンテナ経由で58秒、直送で約2分だった。

### 2.2 直送を通すために共通化・追加した処理(2026-11-11〜13)

**対象**: `src/utils/museWorkerAsk.ts`・`src/utils/wasmMuseBridge.ts`・`src/durable/tailscaleWasm.ts`・`src/utils/museNodeReady.ts`・`src/utils/museMessages.ts` — 直送の2経路(`aichat-direct`・`treeview-musetab-wasm`)が同じ部品を通るようにした内容。

| 内容 | 関数・定数 | コミット |
|---|---|---|
| AIチャットの直送を、tree-view の Museタブ(ワーカー)と同じ関数で送る。違うのは経路IDだけ。鍵は毎回 `Authorization` で中継へ明示する | `sendMuseViaWorker`(`museWorkerDep` は `routeId: 'aichat-direct'` で呼ぶ)、`MuseWorkerRouteId` | [`dbc15f38`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/dbc15f38) |
| 送るボディを ask_muse・コンテナ経由と同じ `{model, messages}` にそろえた(`stream` を送らない) | `WasmMuseBridge.fetch` | [`2c847b01`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/2c847b01) |
| 会話の検査を共通化(40件・16KiB まで) | `parseMuseMessages` | [`2eda6474`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/2eda6474) |
| 送る前に、WASM ノードが `Running` で muse-vm がオンラインに見えるまで最大20秒待つ。死活確認も同じ待ちを使う | `waitForMuseNode`・`readMuseNodeSnapshot`・`MUSE_NODE_READY_MS`・`MUSE_WORKER_HEALTH_TIMEOUT_MS` | [`1540de6d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/1540de6d)・[`919e1c4e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/919e1c4e) |
| 推論を待つ間 `/health` を送り、返事の通り道を保つ(keepAlive) | `WasmMuseBridge.keepAlive` | [`6ff02ea8`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6ff02ea8) |
| タイムアウトしたとき、どこで止まったか(応答ヘッダなし・本文の途中・経路の喪失)を診断して返す | `MuseBridgeDiagnosis`・`formatMuseBridgeDiagnosis` | [`f05bcb9c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f05bcb9c) |
| 送った鍵の指紋(sha256 の先頭8桁)ごとに返事の有無を記録し、エラー文に出す。鍵の妥当性を本番で確かめられる | `museKeyFingerprint`・`MuseKeyLog`・`formatMuseKeyReport`(Durable Object の `muse_key_results`) | [`8419ec9a`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8419ec9a) |
| 待ち時間を api-bridge と同じ600秒にし、2経路で共通にする。askgk の保存値で縮めない | `MUSE_WORKER_MAX_TIMEOUT_SECONDS`・`WasmMuseBridge` の既定 | [`fee856be`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/fee856be) |

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
| Museへの接続を確認できません(`muse_connection_failed`) | muse-vm まで届かなかった | 直送(既定): `/tailscale-wasm` の状態(`main-worker-muse` と muse-vm の在席)。旧コンテナ直通を選んでいるとき: demo コンテナと `tailscale status` |
| 停止中(`container_not_running`) | 直通で demo コンテナが止まっている | `/cf-containers` |
| 認証に失敗(`muse_authentication_failed`) | muse-vm に届いたが鍵が違う(401/403) | 送った側の `MUSE_API_KEY` と muse-vm の鍵 |
| 利用上限(`muse_usage_limit`) | 429 | Muse 側 |
| 時間切れ(`llm_timeout`) | 待ち時間(`/neko askgk` と同じ保存値)を超えた | 待ち時間の設定 |

## 6. 確かめていないこと

- 本番での直送の送信(この PR のデプロイ後に `/aichat` で確かめる)。
- `treeview-worker-tab`・`aichat-askmgs-wasm`・`aichat-tunnels` の経路の細部と鍵(2章の「未確認」)。
- muse-vm の api-bridge が、ヘッダを理由に要求を拒否していないこと(拒否されていればユーザー側で対応する、とのユーザー指定)。

## 7. Muse への経路の一覧(コンテナの要否・鍵・名前の候補、2026-11-12)

**対象**: Muse(`muse-vm:8080`)へ届くすべての経路と、lib を付けるコンテナ — 2章の6系統に、コンテナ起動後の確認送信を足した7系統。うち2つは中でさらに分かれるため、区別する名前は最大9つ。**名前は候補で、まだ決めていない**(muse-vm 側の鍵の名前と揃えてから決める。ユーザー指定 2026-11-12)。基本仕様としてユーザーが確認済み。工事中の部分がある。

説明用のページ: https://claude.ai/artifact/87Nwq3mwBZKGqegxJSqZV6

### 経路

| # | 名前の候補(未確定) | 入口 | muse-vm までの道筋 | コンテナの起動 | muse-vm 側で受ける鍵 |
|---|---|---|---|---|---|
| 1 | `aichat-wasm-direct` | 本体 AIチャット、接頭語なし・`/askmuse` | 本体 Worker → TailscaleWasm(`main-worker-muse`)→ muse-vm(直送) | 不要 | 本体の `MUSE_API_KEY` |
| 1' | `aichat-legacy-container` | 同上、⚙ で旧コンテナ直通を選んだとき | 本体 Worker → demo コンテナ `server.js` → `tailscale nc` → muse-vm | 必須(本体 demo コンテナ) | 本体の `MUSE_API_KEY` |
| 2 | `treeview-musetab-container` | dynamicneko tree-view の Museタブ(通信経路: コンテナ) | dynamicneko → 本体 `/api/tree-view/muse-chat-external` → demo コンテナ → muse-vm | 必須(本体 demo コンテナ) | dynamicneko の `MUSE_API_KEY`(本体はそのまま渡す) |
| 2' | `treeview-musetab-wasm` | 同上(通信経路: ワーカー) | dynamicneko → 本体の中継 → TailscaleWasm → muse-vm | 不要 | dynamicneko の `MUSE_API_KEY` |
| 3 | `treeview-workertab-stream` | dynamicneko tree-view のワーカータブ | dynamicneko → 本体ワーカー経由の会話ストリーム(`/lib/conversation-embed.html`・`/lib/api/chat/*`)(細部は未確認) | 必須(会話ストリームを出すコンテナ、mygw) | 未確認 |
| 4 | `wasmtest-jobqueue` | 本体 `/muse-wasm-test` | 本体 → TailscaleWasm の MuseAgentJobs(キュー)→ WASM → muse-vm | 不要 | 本体の `MUSE_API_KEY` |
| 5 | `aichat-askmgs-gadget` | 本体 AIチャット `/askmgs prompt="…"` | 本体 → TailscaleWasm → `cf-demo-container:8766` → Gadgets | 必須(行き先の `cf-demo-container`、本体 demo コンテナ) | `MUSE_GADGET_SDK_TOKEN`(中継への署名は `ORIGIN_HMAC_SECRET`) |
| 6 | `aichat-askgk-tunnels` | 本体 AIチャット `/neko askgk muse_prompt="…"` | 本体 → rust-worker-sqlx-d1 `/tunnel-signer` → tunnels.rb → lib の worker → muse-vm | 必須(lib を付けたコンテナ。種類は問わない) | lib の worker の `MUSE_API_KEY` |
| 7 | `libhost-askgk-selfcheck` | コンテナ起動後の確認送信「今日は何日？」(手で実行) | `askgk_request.rb` → `tunnels.claude.rb`(CGI を直接実行)→ lib の worker → `tailscale nc` → muse-vm(Worker・Apache・HMAC を通らない) | 必須(lib を付けたコンテナ。種類は問わない。そこで手で実行) | lib の worker の `MUSE_API_KEY` |

- 直送は、コンテナを通さない 1 だけを指す(ユーザー指定 2026-11-12)。直送以外で AIチャットから Muse へ送るのは、tunnels.rb を通る 6 と、`/muse-wasm-test` を通る 4。
- 「必須」の経路は、そのコンテナが止まっていると送れない。どの経路も、止まっているコンテナを自動で起動したり、ほかの経路へ切り替えたりはしない。「不要」の経路(1・2'・4)は、Worker 内の `main-worker-muse` が tailnet につながっていれば送れる。
- 7 の手順は `lib/SETTINGS.claude-host.20261102.md:109`(`ruby claude/test/manual/askgk_request.rb claude/api/tunnels.claude.rb 'muse_prompt="今日は何日？"'`)。起動時に自動で送るスクリプトは無い。
- 名前の形の案は「入口-道筋-行き先」。`direct`・`worker`・`container` を単独では使わない(ほかの経路と取り違えやすい)。

### lib を付けるコンテナと CLI

tunnels.rb と LLM worker は lib 上にあり、特定のコンテナには縛られない。基本的にコンテナであれば何にでも付けられる(起動したコンテナの /home に clone し、ドキュメントルートにマウントする)。付けた先に Claude CLI・Codex CLI が入っているかで、同じ lib でも使えるエンジンが変わる。Muse は CLI を使わず HTTP で送るだけなので、CLI の有無に関係なく届く。

| コンテナ | lib を付けるか | Claude CLI | Codex CLI | 出典 |
|---|---|---|---|---|
| 本体 demo | 付けられる | あり(2.1.322) | あり(0.167.1) | `containers/demo/Dockerfile` |
| redmine | 付けられる | あり(2.1.309) | あり(0.164.0) | `containers/demo/Dockerfile.redmine` |
| musevm(カーネルのビルド環境) | 付けられる | なし | あり(0.166.0) | `musevm/Dockerfile` |
| musevm-kernel | 付けられる | なし | なし | `musevm-kernel/Dockerfile` |
| cfc-standalone | 付けられる | あり(2.1.303) | あり(0.163.0) | `nekoserver/cfc-standalone` の `Dockerfile` |
| dynamicneko(sandbox-terminal) | 付けられる | なし | あり(0.166.0)。ほかに本体コンテナへ SSH でつないで本体の codex を呼ぶ `codex-main` がある | `nekoserver/dynamicneko` の `containers/sandbox-terminal/Dockerfile` |

- cfc-standalone は、Workers Routes でコンテナ用のドメインをまとめるために作ったコンテナ。ルートが増えるにつれて本来の目的から離れたところに手間がかかるようになり、今は放置気味(2026-11-12 時点)。
- dynamicneko は、Dynamic Worker のテスト用に用意したもの。ベースは React 19 + Hono で、スタイルシートや UI のサンプルをなるべく多く集め、すぐ使えるようにしてある。tree-view もここから使う(2・2'・3 の入口)。
- 版はイメージの定義から読んだ。動いているコンテナで確かめたのは、2026-11-12 に lib が付いていた1台だけ(claude 2.1.322・codex 0.167.1、本体 demo の定義と一致)。
- Codex は入っていても、ログインが無いと `codex_authentication_failed` になる。

### 決める必要があること

- muse-vm 側で、どの名前の鍵を経路ごとに割り当てるか(今は本体と dynamicneko がどちらも `MUSE_API_KEY`)。
- 1' と 2' に別の名前を付けるか。
- 決めた名前を、本体のヘッダ・変数・SPEC にそのまま使うか。

## 関連コミット

- [`b47f384`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b47f384) 接頭語なしの Muse を直通(コンテナ経由)を既定にし、直通の接続表示を送った結果で決める

## 直送(Worker内WASM)の待ち時間(2026-11-13)

**対象**: `aichat-direct` と `treeview-musetab-wasm`(`sendMuseViaWorker`)が muse-vm の答えを待つ時間 — muse-vm の api-bridge の動きに合わせる。

| 項目 | 値 | 理由 |
|---|---|---|
| 本体の上限(`MUSE_WORKER_MAX_TIMEOUT_SECONDS`) | 600秒(以前は90秒) | api-bridge(`muse-vm-hacks/files/api-bridge/server.py`)は、鍵が通るとジョブを `~/bridge/inbox/` に置き、Muse の答えを最大600秒(`BRIDGE_TIMEOUT`)待つ。90秒で打ち切ると答えを受け取れない |
| askgk の保存値(最大300秒) | 直送には使わない | askgk 用の値で、直送の上限を縮めない |
| 中継(`WasmMuseBridge`)の上限 | 600秒(以前は290秒)。呼び出し側は3秒短くして送る | 外側より先に、中継が診断付きで答える |
| AIチャットのジョブ | alarm の中で動き、上限は15分 | 600秒待っても収まる |

- api-bridge は鍵が違えばすぐ 401 を返す。401 でなく無応答なら鍵は通っている(2026-11-13 に `server.py` で確認)。
- api-bridge はジョブを1件ずつ処理する(`JOB_LOCK`)。こちらが先に諦めても、api-bridge は最大600秒ロックを握ったまま待ち、後続の要求を詰まらせる。上限を api-bridge と同じにするのは、このためでもある。
- 変更のきっかけ: 2026-11-13、Muse 側で aichat-direct の要求が届き送信者も照合できていたが、答えに時間がかかり、90秒・290秒では受け取れなかった(ユーザー確認)。
