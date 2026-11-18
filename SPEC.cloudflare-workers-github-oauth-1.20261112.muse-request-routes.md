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

## 2. Muse への7系統（/tailscale-wasm ページを追加、2026-11-13）

**対象**: Muse(muse-vm の api-bridge、`http://muse-vm:8080/v1/chat/completions`)へ届くすべての経路 — 経路キーで1つずつ区別する(ユーザー指定 2026-11-12)。

| 経路キー | 入口 | 経路 | ワーカーで完結 / コンテナ必須 | muse-vm 側で受ける鍵 | ジョブの積み上げ |
|---|---|---|---|---|---|
| `aichat-direct` | 本体 AIチャット、接頭語なし(`/askmuse prompt="…"` も同じ経路) | 本体 Worker → `TailscaleWasm`(`main-worker-muse`)→ muse-vm(⚙ で旧コンテナ直通を選んだときだけ demo コンテナの `server.js` → `tailscale nc` → muse-vm) | **ワーカーで完結**(旧コンテナ直通を選んだときはコンテナ必須) | 本体の `MUSE_API_KEY` | 特化していない |
| `treeview-muse-tab` | dynamicneko tree-view の AI タブの「Museタブ」(直送専用) | dynamicneko → 本体 `/api/tree-view/muse-chat-external`(ヘッダ付与)→ demo コンテナ → muse-vm | **コンテナ必須**(本体 demo コンテナ。tree-view で通信経路に「ワーカー」を選ぶと本体の Worker 内 WASM を通り、**ワーカーで完結**) | dynamicneko の `MUSE_API_KEY`(本体はそのまま渡す) | 特化していないが可能 |
| `treeview-worker-tab` | dynamicneko tree-view の AI タブの「ワーカータブ」 | dynamicneko → 本体ワーカーを経由(会話ストリーム) | 未確認 | 本体の `MUSE_API_KEY`(未確認) | 特化していないが可能 |
| `muse-wasm-jobs` | 本体 `/muse-wasm-test` ページ | 本体 → `TailscaleWasm` の `MuseAgentJobs`(4章)→ WASM(`main-worker-muse`)→ muse-vm | **ワーカーで完結** | 本体の `MUSE_API_KEY` | 特化している |
| `aichat-askmgs-wasm` | 本体 AIチャット、接頭語 `/askmgs prompt="…"` | 本体 → `/api/tailscale-wasm/chat` → `TailscaleWasm`(WASM)→ `MUSE_GADGET_RELAY_URL`(`http://cf-demo-container:8766`)→ Gadgets | **コンテナ必須**(WASM を通るが、行き先の `cf-demo-container` は本体 demo コンテナ) | `MUSE_GADGET_SDK_TOKEN`(中継への署名は `ORIGIN_HMAC_SECRET`) | 特化していない |
| `aichat-tunnels` | 本体 AIチャット、`/neko askgk muse_prompt="…"` | 本体 → rust-worker-sqlx-d1 の `/tunnel-signer` → tunnels.rb(コンテナ)→ Muse | **コンテナ必須**(tunnels.rb のコンテナ。本体 demo コンテナかどうかは未確認) | tunnels.rb 側の設定(本体は扱わない) | 特化していない |
| `tailscale-wasm-page`（説明用） | 本体 `/tailscale-wasm` の「Worker → Muse」 | ページ → `POST /api/tailscale-wasm/tasks`（`action: bridge-chat`）→ 永続ジョブ → `/api/tailscale-wasm/bridge-chat` → `museWorkerDep` → TailscaleWasm(`main-worker-muse`) → muse-vm | **ワーカーで完結** | 本体の `MUSE_API_KEY` | 画面を閉じても永続ジョブを照会して回答を取得。MuseAgentJobsとは別 |

- 接頭語付きの AI 投稿(`/askmuse`・`/askmgs`・`/neko askgk muse_prompt=` などの Muse と、`codex_prompt=`・`claude_prompt=` などそれ以外のモデル)は、主に外部アプリからの用途を想定している(ユーザー指定 2026-11-12)。画面から人が送る通常の投稿は接頭語なし(`aichat-direct`)。
- 「ワーカーで完結」の経路は、本体の demo コンテナが止まっていても送れる(Worker 内の Tailscale WASM ノード `main-worker-muse` が tailnet につながっていればよい)。「コンテナ必須」の経路は、そのコンテナが止まっていれば送れない(自動で起動しない・ほかの経路へ切り替えない)。
- `treeview-muse-tab` の送信チェック(2026-11-12): tree-view で Museタブを開いたとき・Museを選んだ状態で ⬜ でウィンドウで開くたびに、ボディ `{"action":"connect"}`(ヘッダは送信と同じ)を本体の中継へ送る。中継は推論を走らせず、muse-vm の `/health` だけを見て `{healthy, transport, keySource}` を返す(停止中のコンテナは起動しない)。tree-view はチェックの間だけ3本縦棒を動かし、結果の文字は出さない。
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

**対象**: Muse(`muse-vm:8080`)へ届くすべての経路と、lib を付けるコンテナ — 2章の7系統に、コンテナ起動後の確認送信を足した8系統。旧コンテナ経路を分けて記載した候補名は最大11個。**名前は候補で、まだ決めていない**(muse-vm 側の鍵の名前と揃えてから決める。ユーザー指定 2026-11-12)。基本仕様としてユーザーが確認済み。工事中の部分がある。

説明用のページ: https://claude.ai/artifact/87Nwq3mwBZKGqegxJSqZV6

### 経路

| # | 名前の候補(未確定) | 入口 | muse-vm までの道筋 | コンテナの起動 | muse-vm 側で受ける鍵 |
|---|---|---|---|---|---|
| 1 | `aichat-wasm-direct` | 本体 AIチャット、接頭語なし・`/askmuse` | 本体 Worker → TailscaleWasm(`main-worker-muse`)→ muse-vm(直送) | 不要 | 本体の `MUSE_API_KEY` |
| 1' | `aichat-legacy-container` | 同上、⚙ で旧コンテナ直通を選んだとき | 本体 Worker → demo コンテナ `server.js` → `tailscale nc` → muse-vm | 必須(本体 demo コンテナ) | 本体の `MUSE_API_KEY` |
| 2 | `treeview-musetab-container` | dynamicneko tree-view の Museタブ(通信経路: コンテナ) | dynamicneko → 本体 `/api/tree-view/muse-chat-external` → demo コンテナ → muse-vm | 必須(本体 demo コンテナ) | dynamicneko の `MUSE_API_KEY`(本体はそのまま渡す) |
| 2' | `treeview-musetab-wasm` | 同上(通信経路: ワーカー) | dynamicneko → 本体の中継 → TailscaleWasm → muse-vm | 不要 | dynamicneko の `MUSE_API_KEY` |
| 3 | `treeview-workertab-stream` | dynamicneko tree-view のワーカータブ | dynamicneko → 本体ワーカー経由の会話ストリーム(`/lib/conversation-embed.html`・`/lib/api/chat/*`)(細部は未確認) | 必須(会話ストリームを出すコンテナ、mygw)。公開`/lib`は2026-11-11から403で、2026-11-13から内部8445経由（節「libへのアクセスの厳格化による影響」） | 未確認 |
| 4 | `wasmtest-jobqueue` | 本体 `/muse-wasm-test` | 本体 → TailscaleWasm の MuseAgentJobs(キュー)→ WASM → muse-vm | 不要 | 本体の `MUSE_API_KEY` |
| 5 | `aichat-askmgs-gadget` | 本体 AIチャット `/askmgs prompt="…"` | 本体 → TailscaleWasm → `cf-demo-container:8766` → Gadgets | 必須(行き先の `cf-demo-container`、本体 demo コンテナ) | `MUSE_GADGET_SDK_TOKEN`(中継への署名は `ORIGIN_HMAC_SECRET`) |
| 6 | `aichat-askgk-tunnels` | 本体 AIチャット `/neko askgk muse_prompt="…"` | 本体 → rust-worker-sqlx-d1 `/tunnel-signer` → tunnels.rb → lib の worker → muse-vm | 必須(lib を付けたコンテナ。種類は問わない)。公開`/lib/api/tunnels`は署名ヘッダーがあるときだけ通る（節「libへのアクセスの厳格化による影響」） | lib の worker の `MUSE_API_KEY` |
| 7 | `libhost-askgk-selfcheck` | コンテナ起動後の確認送信「今日は何日？」(手で実行) | `askgk_request.rb` → `tunnels.claude.rb`(CGI を直接実行)→ lib の worker → `tailscale nc` → muse-vm(Worker・Apache・HMAC を通らない。そのため6のApacheでの403は見つけられない) | 必須(lib を付けたコンテナ。種類は問わない。そこで手で実行) | lib の worker の `MUSE_API_KEY` |
| 8 | `tailscalepage-wasm-muse` | 本体 `/tailscale-wasm` の「Worker → Muse」 | ページ → `/api/tailscale-wasm/tasks` → 永続ジョブ → `/api/tailscale-wasm/bridge-chat` → `museWorkerDep` → TailscaleWasm → muse-vm | 不要 | 本体の `MUSE_API_KEY` |
| 8' | `tailscalepage-legacy-container` | 同ページの旧コンテナ経路（明示操作・確認あり） | `/api/tailscale-wasm/tasks`（`action: legacy-chat`）→ 永続ジョブ → `/api/aichat`（Muse、`container`指定）→ demo コンテナ → muse-vm | 必須（本体 demo コンテナ） | 本体の `MUSE_API_KEY` |

- 直送はコンテナを通さない経路を指す。1 と同じ Worker 内 WASM の送り方を 2'・8 も利用する。直送以外で AIチャットから Muse へ送るのは、tunnels.rb を通る 6 と、`/muse-wasm-test` を通る 4。
- 「必須」の経路は、そのコンテナが止まっていると送れない。どの経路も、止まっているコンテナを自動で起動したり、ほかの経路へ切り替えたりはしない。「不要」の経路(1・2'・4・8)は、Worker 内の `main-worker-muse` が tailnet につながっていれば送れる。
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

## /tailscale-wasm ページを加えた根拠（2026-11-13）

- `src/views/tailscaleWasm.ts` の通常送信フォームは `submitDurableTask('bridge-chat', {prompt}, …)` を呼ぶ。`POST /api/tailscale-wasm/tasks` はジョブを登録し、回答はジョブ照会で受け取る。登録成功だけをMuseの回答成功と扱わない。
- `src/index.ts` の `bridge-chat` は `museWorkerDep(c.env)(data.prompt)` を呼び、`src/utils/museWorkerAsk.ts` の `sendMuseViaWorker` から Worker 内 WASM へ送る。管理者認証と同一origin確認が必要。本体demoコンテナは不要で、自動で別経路へ切り替えない。
- `tailscale-wasm-page`・`tailscalepage-wasm-muse` は一覧で入口を区別するための説明用・候補名。実装の `museWorkerDep` は現時点で `routeId: 'aichat-direct'` を使う。新しいヘッダ・鍵・経路IDを実装したという意味ではない。
- 同ページのジョブ登録パネル（`/api/tailscale-wasm/jobs`）は4のMuseAgentJobsを利用する。同じページに入口があっても、通常フォームの永続ジョブとは別。
- `/api/tailscale-wasm/chat` は `/askmgs` と同じGadgets側の経路であり、通常フォームの `bridge-chat` と混同しない。旧コンテナ送信ボタンは明示操作と確認が必要で、直送失敗時の自動フォールバックではない。
- この追記は現コードの参照による経路整理。今回 `/tailscale-wasm` から新たな実推論送信・デプロイは行っていない。

## tree-view のMuseウィンドウ内「ワーカー」の403（2026-11-13）

### 実際の入口と原因

`https://dynamicneko.nekoflare.workers.dev/tree-view` のAIチャットでMuseを選び、⬜︎でウィンドウを開いてから「ワーカー」へ切り替える操作でも、同じ `TreeViewConversationStream` のiframeを使用する。修正前は台帳の既定mygwの公開 `/lib/conversation-embed.html` を直接表示したが、管理者限定のApacheが公開 `/lib` を403にしていた。公開403・内部8445の200を実測した。内部配信・投稿の成功だけを、tree-viewの成功と扱わない。

この「ワーカー」はlibの固定会話の観測・投稿画面であり、「Muse」タブの `/api/tree-view/muse-chat-external` とは別。ウィンドウのタイトルがMuseでも、それだけでMuse直送やMuseのAPIキーを使うことにはならない。今回の中継はMUSE_API_KEYをブラウザや公開配信へ渡さない。

### 修正後の会話ストリーム経路

```
AIチャット → Muse → ⬜︎ → ワーカー
  → 同一origin /lib/conversation-embed.html
  → dynamicnekoの所有者セッション確認・限定した/lib中継
  → MAIN_WORKER /api/tree-view/conversation-stream-external/lib/*
      CF-Worker+HMAC署名 + 短寿命ユーザートークン + 管理者本人確認
  → 起動中demoコンテナのserver.js
  → 内部Apache 127.0.0.1:8445 → lib / observer
```

既定mygwを本体demoコンテナへ対応させる。その他の台帳接続先は既存の公開URLを使う。公開Apacheの/lib拒否は維持し、停止中コンテナは起動しない。HTML・限定したJS/CSS・ticket付き資産・chat APIだけ中継し、任意のホストやファイルへのプロキシにはしない。

### 見落としを防ぐ点

- `HTTP200`やiframeのsrcだけでは表示成功ではない。CSP、X-Frame-Options、相対importするJS/CSS、会話本文まで確認する。成功したlib応答のnonce付きCSPを維持し、X-Frame-OptionsはSAMEORIGINにする。
- 実libの試験で `chat/vendor/markdown-it.mjs` の許可漏れも発見した。ticket付き資産からの相対importも許可表とテストの対象にする。
- PWA用ログインには通常ログインとは別のパス制限がある。限定した会話パスをPWAでも通し、ops等の非公開パスは拒否し続ける。
- 接続前のHEAD確認ではログインページへのredirectを成功扱いにしない。失敗・時間切れは理由と再試行を表示する。閲覧再試行で推論入力は送らない。
- SSE等は本文を読み切らず中継し、WebSocketの101は作り直さない。ログイン用Cookie・中継の資格情報を無条件に全区間へ転送しない。

### 確認と反映

本体の関連テスト41件、ブラウザ11件に加え、指定されたMuseウィンドウ操作と失敗時の再試行2件、PWA所有者認証・非公開パス拒否・型チェックに成功。実libと両中継実装を通すChrome試験でHMACログイン・JS/CSS・SSE・現在会話articleを確認した。ローカルのセッション保存先と本人照会はfixtureであり、本番の利用者ログイン・WebSocket 101の終端確認とは区別する。

Workerだけの反映にWranglerの `deploy --containers-rollout none --keep-vars` を使用した。インストール済みCLIのhelpと実装でコンテナのビルド・更新を省略することを確認した後、本体→dynamicnekoの順に反映した。Dockerビルド・コンテナ再作成なし。

- 本体Worker: `fe1c9bd8-908e-4e86-a175-bc326789a6e0`
- dynamicneko（PWA補正後）: `7ee55793-dc75-41d4-a719-9c6fa4f3425a`

公開側では未ログインのdynamicneko埋め込みがログインへ302、未署名の本体中継が401、mygwの公開/libが403を確認。配信されたフロントエンドJSのSHA256が修正ビルドと一致することも確認した。利用者のログイン済みブラウザでの最終表示は再読み込み後の確認が残る。詳細の経緯は `NOTICE.cloudflare-workers-github-oauth-1.20261113.tree-view-worker-stream.md`。

### 再発時の切り分けと画面の更新（2026-11-13 追記）

| 症状・確認結果 | 判断と確認先 |
|---|---|
| ワーカータブ内にApacheの `Forbidden / You don't have permission to access this resource.` | iframeが公開mygwの `/lib` を直接見ていないか確認する。今回の構成では公開側の403は意図したアクセス制限であり、解除する対象ではない |
| 通常ログインでは表示できるがPWAでは403 | dynamicnekoのPWA専用パス制限と、失効・ログアウト済みセッションの照合を確認する。所有者認証を省略せず、限定した会話パスだけ許可する |
| 接続前のHEADがログインへ302 | 認証切れの可能性がある。redirect先のHTTP200を中継成功と扱わない |
| HTMLは200だが会話が出ない | CSP・X-Frame-Options、ticket付きJS/CSSとvendor依存の取得、観測セッション、SSE/WSの実イベントを順に確認する |
| Workerを反映したのに古い公開mygwへ接続する | 既に開いている親画面が旧JavaScriptを実行している可能性がある。iframeだけでなくtree-view全体を再読み込みし、Museウィンドウを開き直す。配信JSと最終ビルドのSHA256も照合する |

利用者へ案内する更新手順は、tree-view全体の再読み込み → AIチャット → Muse → ⬜︎ → ワーカー。ウィンドウ移動・タブ切替では同じiframeを維持する実装なので、既存iframeだけの再読み込みでは親画面の接続先ロジックは更新されない。

未ログイン埋め込みの302、未署名中継の401、公開mygw/libの403、配信JSのハッシュ一致は、それぞれ認証境界と配信版の確認である。利用者のログイン済み画面で会話が描画された証拠とは分けて記録する。テストの投稿受付、同一会話キューへの登録、モデルの実受信、回答、ブラウザ描画も別々の到達点として確認する。

本体コンテナのlibに対する公開拒否・署名付きAPI例外・内部SSI・観測/投稿認証・Worker中継・ソケット権限の現状は、[libアクセス制御SPEC](SPEC.cloudflare-workers-github-oauth-1.20261113.lib-access-control.md)に分けて記録した。

## libへのアクセスの厳格化による影響（2026-11-18）

**対象**: 7章の経路1〜8'のうち、本体demoコンテナの`/lib`を通るもの（3・6・7） — 2026-11-11に公開Apache（:8443）で`/lib`を拒否したこと（利用者の判断「管理者だけ」、[`1a9e0c62`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/1a9e0c62)）が、Museへの経路にどう効いたかをまとめる。制限の目的と内容は、libの`NOTICE.lib.20261107.claude-host-setup.md`の2026-11-18の節と`SPEC.lib.20261118.lib-features-access.md`。

### 経路ごとの影響

| # | 名前の候補 | `/lib`を通るか | 2026-11-11の厳格化の影響 | 今の状態（2026-11-18） |
|---|---|---|---|---|
| 1 | `aichat-wasm-direct` | 通らない（Worker内WASM） | なし | 影響なし |
| 1' | `aichat-legacy-container` | 通らない（Worker → `container.fetch` → `server.js`の`/muse/*`。8443を通らない） | なし | 影響なし |
| 2 | `treeview-musetab-container` | 通らない（同上） | なし | 影響なし |
| 2' | `treeview-musetab-wasm` | 通らない | なし | 影響なし |
| 3 | `treeview-workertab-stream` | **通る**（`/lib/conversation-embed.html`・`/lib/chat/`・`/lib/api/chat/*`） | 公開mygwの`/lib`を直接表示していたため、iframeに「Forbidden」（403）が出た（2026-11-13に発覚） | 2026-11-13にdynamicneko → 本体の中継 → `server.js` → 内部Apache 8445へ移した（下の「経路3」）。**ただし今のイメージの8445にはチャットの中継が無く、動かない可能性が高い**（未確認）。2026-11-18に中継を`apache-lib.conf`へ足した（ソースのみ、イメージの再ビルド待ち） |
| 4 | `wasmtest-jobqueue` | 通らない | なし | 影響なし |
| 5 | `aichat-askmgs-gadget` | 通らない（tailnetの`cf-demo-container:8766`） | なし | 影響なし |
| 6 | `aichat-askgk-tunnels` | **通る**（公開mygwの`/lib/api/tunnels`） | 例外なしで拒否され、`/neko askgk muse_prompt=`も403になった | 2026-11-13にイメージ側の例外で戻ったが、2026-11-18のイメージに例外が無く、再び`HTTP 403`。同日、libの`claude/ops/apache-lib-tunnels.conf`に例外を足して戻した（下の「経路6」） |
| 7 | `libhost-askgk-selfcheck` | 通らない（CGIを直接実行） | なし。**そのため、6の403を見つけられない** | 影響なし。点検としての役割は下の「経路7」 |
| 8 | `tailscalepage-wasm-muse` | 通らない | なし | 影響なし |
| 8' | `tailscalepage-legacy-container` | 通らない（`/api/aichat` → `container.fetch`） | なし | 影響なし |

- `/lib`を通るのは、公開のトンネル（mygw → cloudflared → Apache :8443）を使う経路だけ。本体Workerから`container.fetch`で`server.js`（8080）へ直接入る経路（1'・2・8'）と、Worker内WASMの経路（1・2'・4・8）は、8443を通らないため影響を受けない。
- Museの鍵（`MUSE_API_KEY`）と muse-vm 側には、厳格化による変更は無い。6・7で使う鍵はlibのworkerの`MUSE_API_KEY`で、`/lib`の制限とは関係しない。

### 経路3（ワーカータブ）

- 2026-11-13の修正（節「tree-view のMuseウィンドウ内「ワーカー」の403（2026-11-13）」）は、内部Apache 8445が`/lib/api/chat/*`を8091・8092へ中継することを前提にしている。libの`NOTICE.lib.20261113.lib-admin-only-impact.md`は、その中継を「本体の作業ツリーにある未コミットの変更」と書いている。
- 本体のmainの`containers/demo/apache-lib.conf`には、この中継が無い（2026-11-18確認。最後の変更は[`a97025ca`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a97025ca)の文字コードの追加だけ）。
- 2026-11-18に、コンテナの中から8445へ直接`GET`した結果は、`/lib/conversation-embed.html`が200（8092を通らない静的なファイル）、`/lib/api/chat/session`が404、`/lib/chat/`が403。会話のセッションとストリームは、8445からは取れない。
- dynamicneko → 本体の中継 → 8445を、利用者のログイン済みの画面で通した結果は、まだ確かめていない。
- **修正（2026-11-18、ソースのみ）**: `containers/demo/apache-lib.conf`に、`ProxyPreserveHost On`と、`/lib/api/chat/ws`（8091）・`/lib/api/chat/`・`/lib/conversation-embed.html`・`/lib/chat/`・`/lib/t/`（8092）の中継を足した。テストは`src/cf-containers-lib-ssi.test.ts`（修正前に3件失敗することを確かめた）。この設定を使い捨てのApacheで起動し、いま動いているストリームのサーバーへ中継されることを確かめた（`/lib/api/chat/session`・`/lib/conversation-embed.html`・`/lib/chat/`は、ストリームのサーバーの認証による401。修正前は404・静的なファイル。WebSocketはchallengeまで届いた）。
- **反映にはイメージの再ビルドとコンテナの再起動が要る。** Dockerビルド・本番のイメージでの確認はしていない。
- `server.js`の`proxyToLib`はWebSocketのupgradeを中継しない。本体の中継 → `server.js` → 8445の経路では、`/lib/api/chat/ws`は届かない見込み（未確認）。SSE・NDJSON・JSON Text Sequenceは届く見込み。
- tunnels APIの例外は本体のイメージに入れない。mainのイメージには2026-11-05から`/lib/api/tunnels`のCGIの別名も秘密の受け渡しも無く、例外だけを入れると`server.js` → 8445へ流れて`tunnels.rb`のソースが公開側に見える。CGI・秘密・例外は、libの`restore-claude-host.sh`がまとめて入れる。2026-11-11〜13の固定イメージ（`image.lock.json`のdigest）に例外があり、11-13からmainのDockerfileでイメージを作るようになって消えた、というのが今回の403の経緯（固定イメージの中身は確かめていない）。

### 経路6（`/neko askgk muse_prompt=`）

| 時期 | 公開`/lib/api/tunnels`の扱い | askgkの結果 |
|---|---|---|
| 〜2026-11-10 | Apacheは確かめず、CGIが署名を確かめる。署名なしは401 | 動く |
| 2026-11-11〜 | `/lib`の拒否に巻き込まれ、署名があっても403 | `HTTP 403` |
| 2026-11-13〜 | イメージ側の例外（署名ヘッダーがあれば通す）。署名なしは403、不正な署名は401 | 動く |
| 2026-11-18 | 新しいイメージに例外が無い。例外は本体のmainの履歴にも無い | `HTTP 403`（Slackで「tunnels.rbへの接続・HTTP応答に異常があります: HTTP 403」） |
| 2026-11-18〜（修正後） | libの`claude/ops/apache-lib-tunnels.conf`が例外を持つ（`<LocationMatch "^/lib/api/tunnels$">`、`X-Timestamp`と`X-Signature`の両方を要求）。`restore-claude-host.sh`で反映 | Apache経由の署名付きPOSTで、`muse_prompt`が`done`（約28秒）、`claude_prompt`が`done`（約7秒） |

- 例外はApacheの段では「ヘッダーがあるか」だけを見る。署名の照合はCGI（`tunnels_lib.rb`）が行う。
- 本体のイメージに例外を入れれば、lib側の例外は要らなくなる（提案、未実施）。イメージを作り直すたびに例外が消える状態は、まだ残っている。
- askgkの経路台帳の`independent`（r9、別のコンテナ）は、今回は測っていない。

### 経路7（起動後の確認送信）

- 7は`askgk_request.rb`でCGIを直接実行するため、Apacheを通らない。2026-11-18は、7が`done`を返した一方で、Slackからの6は`HTTP 403`だった。**7の成功は、6が届くことの根拠にならない。**
- 6の経路まで確かめるには、Apache（8443）へ、askgkと同じ形の署名付きPOSTを送る。`[点検 libhost-askgk-selfcheck <UNIX秒>]`の印はそのまま使える（7の経路キーのまま。Apache経由用の新しい経路キーは決めていない）。

### エラーの見分け方（5章への追加）

| 画面の表示 | 意味 | 見るところ |
|---|---|---|
| tunnels.rbへの接続・HTTP応答に異常があります: HTTP 403 | askgk（6）が、CGIに届く前にApacheで拒否された。LLM worker・Tailscale・Museまでは届いていない | コンテナの`/etc/apache2/lib-tunnels.conf`に`Require expr`の例外があるか。無ければ`restore-claude-host.sh`を再実行する |
| ワーカータブに「Forbidden」 | 3が公開mygwの`/lib`を直接見ている、または8445がチャットを中継していない | 節「tree-view のMuseウィンドウ内「ワーカー」の403」の切り分けの表と、上の「経路3」 |

### 確かめていないこと

- 修正後のSlackからの`/neko askgk muse_prompt=`（Apache経由の署名付きPOSTでは確かめた）。
- 経路3を、利用者のログイン済みの画面で通した結果。
- 2026-11-11〜13の固定イメージの中身（例外がそこにあったことは、当時のlibの記録からの判断）。
- 8445のチャットの中継を入れたイメージでの、ワーカータブの表示（再ビルド前）。
- askgkの`independent`（r9）経路の、今の応答。
