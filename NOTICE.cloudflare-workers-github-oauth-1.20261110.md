# NOTICE 2026-11-10: Tailscaleのノードの所在と、Museへの要望の経路

## 1. tailnetに出てくるWorker由来のノードは2つある

**対象**: tailnetの管理画面に出る `main-worker-muse` と `muse-monitor` — どちらがどこで立っているかを取り違えないための対応表。

| ホスト名 | 立てている場所 | 状態の保存先 | ログインの鍵 |
|---|---|---|---|
| `main-worker-muse` | 本体ワーカーのDurable Object `TailscaleWasm`(`src/durable/tailscaleWasm.ts`、`wrangler.toml` の `TAILSCALE_WASM`)。名前 `muse` のインスタンス1つ | 同じDOのSQLite(`tailnet_state` 表) | `TAILSCALE_WASM_AUTHKEY`、無ければ `TAILSCALE_AUTHKEY` |
| `muse-monitor` | muse-monitorワーカー(nekoserver/muse-monitor)のDurable Object `MonitorGateway` | 同じDOのストレージ(`ts-state`) | `TS_AUTHKEY`、無ければ `TS_API_KEY`(nekoserver/muse-monitor#7 以降) |

- どちらもパッケージ `@ai-ecoverse/wasm-tailscale`(1.104.1-13)のWASMで、`ephemeral: false`。DOが眠って起き直しても同じノードとして戻る。
- `main-worker-muse` は、DOに最初の要求が来たとき(`/api/tailscale-wasm/*`、AIチャットのMuse直通、`MuseAgentJobs` のアラームなど)に `ensureNode()` で立つ。それまではノードが無い。
- `main-worker-muse` の自動ログインは、Museへ送る直前(`deliver()`)にノードが `NeedsLogin` のときだけ行う。`/status` を読むだけではログインしない。`/api/tailscale-wasm/logout` を一度呼ぶと、自動ログインを止める設定(`worker_settings.auto_login_disabled`)がDOに残り、`/login` するまで自動ログインしない。
- 状態そのものに期限は無い。残る期限は、Tailscale側のノード鍵の有効期限(管理画面の設定、既定180日)だけ。
- `main-worker-muse` は #2552(Worker Muse bridge)で追加された。

## 2. ブラウザ自身をノードにすると、開くたびにログインが要る

**対象**: `/muse-wasm-test` の到達確認 — 以前のやり方の落とし穴。

- 以前の `/muse-wasm-test` は、ブラウザで公式Tailscale WASMを動かし、ブラウザ自身をノード(`muse-wasm-test`)にしていた。状態をページのメモリにしか持たないため、開くたびにログイン(承認)が要った。
- 状態をブラウザのストレージに保存すれば残せるが、状態にはノードの秘密鍵が入るため、ブラウザには置かない方針(`TailscaleWasm` の「credentials in private DO SQLite, never in browser storage」)。
- そのため、到達確認はWorkerのノード(`main-worker-muse`)に任せた(PR #2556)。`/api/tailscale-wasm/bridge-health` は必要なら自動ログインし、muse-vmの `/health` まで確かめる。`/api/tailscale-wasm/status` はノードの状態とmuse-vmのオンライン表示を返す。

## 3. Museへの要望は2つの仕組みがあり、自動で片付くのは片方だけ

**対象**: D1 `agent-inquiries` の `bridge_jobs` と、`TailscaleWasm` DOの `MuseAgentJobs` — 積んだ要望が止まって見えるときの切り分け。

| 仕組み | 置き場所 | 片付ける者 | 自動か |
|---|---|---|---|
| `bridge_jobs` | D1 `agent-inquiries` | 本体コンテナの `nekoserver/lib` `claude/ops/bridge_jobs.py run-once`(Claude Code・Codex) | **手動**。2026-11-08に「まず手動で1件ずつ」と決めたまま、見張り役は無い |
| `MuseAgentJobs` | `TailscaleWasm` DOのSQLite | DOのアラームが1件ずつ取り出し、`main-worker-muse` からmuse-vmのMuse(`:8080/v1/chat/completions`)へ送る | 自動。コンテナを使わない |

- `bridge_jobs` に積んだものは、誰かが本体コンテナで `run-once` を実行するまで `queued (0/3)` のまま。2026-11-10に `/muse-wasm-test` から積んだ2件がそうなった。
- コンテナ上のエージェントを使わないのがこのWorkerの方針なので、`/muse-wasm-test` の要望は `MuseAgentJobs` へ送るようにした(PR #2556)。
- `MuseAgentJobs` は、以前は `failed` にするときに理由を捨てていた(`queued → sending → failed` だけが見え、原因が分からない)。PR #2556 で理由(`HTTP 503 muse_not_authenticated` など)を保存し、一覧で返すようにした。
- `503 tailscale_not_connected` は、ブリッジ(`WasmMuseBridge`)が送る前に接続を確かめて返すもので、Museへは何も届いていない。このときだけ、間隔を空けて最大5回まで送り直す。DOが眠った後の最初の要望は、WASMの起動とTailscaleの接続が `deliver()` の6秒の待ちに間に合わないことがある。それ以外の失敗と、送った後で結果が分からないもの(`delivery_unknown`)は、二重に届かせないため送り直さない。
- `failed` の主な理由: `muse_not_authenticated`(`MUSE_API_KEY` が未設定)、`tailscale_not_connected`(ノードがRunningでない、またはmuse-vmがオンラインに見えない)、`invalid_prompt`・`payload_too_large`。

## 4. muse-monitorのnetmapの読み違い

**対象**: nekoserver/muse-monitor の `parsePeers` — 同じパッケージを使う別の実装で同じ間違いをしないための注意。

- 同梱のWASMのnetmapのJSONは `self`・`peers`・`name`・`addresses` だけ(main.wasmのjsonタグで確認)。`TailscaleIPs`・`Addresses` は無い。muse-monitorはこれを読み違え、muse-vmを見つけられずに全要求が `receiver_not_found` になっていた(nekoserver/muse-monitor#7 で修正)。
- `status()` のJSONには `state`・`peers`・`name`・`dnsName`・`online` がある。本体の `WasmMuseBridge` はこれを読んでおり、キー名は合っている。
