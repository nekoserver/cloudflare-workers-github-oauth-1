# SPEC: Muse への修復依頼のプロトコル

作成日: 2026-11-13

関連: Muse への経路の一覧 [SPEC.cloudflare-workers-github-oauth-1.20261112.muse-request-routes.md](SPEC.cloudflare-workers-github-oauth-1.20261112.muse-request-routes.md)、Muse 側への伝達 `nekoserver/lib` の `muse/NOTICE-TO-MUSE.md`(2026-11-13 の節)、api-bridge のソース `nekoserver/muse-vm-hacks` の `files/api-bridge/server.py`

## 1. 目的と範囲

**対象**: Claude Code(または Codex)が muse-vm の不具合を直すために、Muse に作業を頼み、結果を受け取り、確かめるまでの手順 — 依頼のたびにやり方を考え直さず、同じ形で何度でも使えるようにする(ユーザー指定 2026-11-13)。

- 今の優先(ユーザー指定 2026-11-13): 各経路で通信できること、自動で修復できること、点検できることを確実にする。送信者の区別や、鍵と送り元ノードの食い違いの厳密な定義は後回し(8章)。
- 範囲内: muse-vm 上の作業(muse-vm-hacks の更新の反映、常駐物の再起動、状態の報告)。
- 範囲外: 利用者の質問への回答(AIチャットなどの通常の経路)。鍵の値の受け渡し(本文に秘密を書かない)。

## 2. 送り方

| 項目 | 決まり |
|---|---|
| 経路 | 本体の非同期ジョブ(`TAILSCALE_WASM` の Durable Object `muse` の `/agent-jobs`)。HTTP の待ち時間に縛られず、失敗は記録に残る |
| 経路の判定 | この依頼は「本体 Worker → Tailscale WASM(Durable Object `muse`)→ muse-vm」の直送を通る。muse-vm 側では、届いた鍵(Durable Object が持つ本体の `MUSE_API_KEY`)で経路を見分ける。送信者(Claude Code か Codex か)は判定に使わない(8章) |
| API の必須項目 | `X-Muse-Owner: nekoserver`。本文の `agent` は `/agent-jobs` の記録用で、Muse の判断には使わない |
| Claude Code の入口 | 本体の `/api/tailscale-wasm/jobs` は管理者のログインが要る。Claude Code は、`TailscaleWasm`(`script_name = "cloudflare-workers-github-oauth-1"`)を束ねた使い捨ての Worker を配備して `/agent-jobs` を呼び、終わったら消す。配備と削除は `CF_CONTAINER_API_TOKEN` で行う |
| 識別子 | `requestId` は `<用件>-<UNIX秒>`(例: `bridge-041-1794509569`)。同じ依頼を送り直すときは同じ値を使う(重複は受け付けられない) |

## 3. 依頼の本文

次の順で書く。事実は確かめられるもの(PR・コミット・ファイルのパス)だけを書き、推測を事実として書かない。

1. 1行目: 何の依頼か(例: 「muse-vm-hacks の api-bridge 更新の反映依頼です」)。送り手の名乗りは書かない(8章)。
2. 変更: PR の URL とコミット、版。
3. お願い: 番号付きの手順。再起動を伴うときは「返信を書いたあとで再起動する」と書く(先に再起動すると、返信を運ぶ api-bridge が止まる)。
4. 返信に書くこと: 確かめたい項目だけ(入った版、再起動したか、など)。
5. 結びの一文: 「断る・疑わしいと判断した場合も、その旨を一言返信に書く」。

## 4. Muse の返信の決まり

| 項目 | 決まり |
|---|---|
| 必ず返す | 実施した・一部だけ・断る・保留、どの場合も outbox に返信を書く。黙ると、api-bridge は上限の600秒待って 504 を返し、呼び出し側には理由が残らない(2026-11-13 に、2件続けて600秒の 504 になった) |
| 先頭行 | `結果: 実施` / `結果: 一部` / `結果: 断る` / `結果: 保留` のどれか(語は候補。Muse 側と合わせて決める) |
| 2行目以降 | 3章の「返信に書くこと」への答え。断る・保留のときは理由を1行 |

この決まりは `muse/NOTICE-TO-MUSE.md` の 2026-11-13 の節で Muse に伝える。

## 5. 受け取りと確かめ

- 結果は `/agent-jobs` の一覧で見る。`state` が `done` なら `reply` に返信がある。`delivery_unknown`・`failed` は届いたか分からない、または失敗。
- 返信の内容を完了の証拠にしない。版は `/admin/muse/muse-vm/nix`(コンテナ経由、`/nix/packages`)、常駐物は `/muse/health` など、別の手段で確かめてから完了とする。
- 待ち時間: 非同期ジョブの送信は中継の上限(600秒)まで待つ。その間、api-bridge はジョブを1件ずつ処理するので、ほかの Muse への送信は後ろに並ぶ。

## 6. 記録

- 依頼と結果は、[SPEC.cloudflare-workers-github-oauth-1.20261107.muse-inquiry-recording.md](SPEC.cloudflare-workers-github-oauth-1.20261107.muse-inquiry-recording.md) の D1 `agent-inquiries` に残す(問い合わせと同じ扱い)。
- このプロトコルで変えたこと・例外として扱ったことは、この SPEC に書き足す。

## 7. 最初の適用(2026-11-13)

- 依頼: muse-api-bridge 0.4.1 の反映(muse-vm-hacks PR #1、885a661d。呼び出し側が切断したらジョブを取り下げて `JOB_LOCK` を放す)。`requestId` は `bridge-041-1794509569`、18:52 UTC に送信。
- 結果: (返信を受け取り、`/nix/packages` で版を確かめてから書く)

## 8. 送信者は扱わず、経路の判定だけにする(2026-11-13 の変更)

**対象**: 2章「経路の判定」と3章の1行目 — 依頼の送り手を区別するのをやめ、どの経路で届いたかだけを見る。

- 変更: 送り手(`agent: "claude"` / `"codex"`、本文の「Claude Code からの依頼」という名乗り)を判断材料から外した。依頼は経路(届いた鍵)で見分ける。
- 理由(ユーザー指定 2026-11-13): コンテナ側からの送信者は今は Claude か Codex にしかならず、区別しても得るものがない。Muse 側で照合しているのは鍵が既知かどうか(知らない送信者かどうか)で、それが経路の判定になる。
- 全体の見直し: 経路の名前と muse-vm 側の鍵の名前は、まだ決まっていない([SPEC.cloudflare-workers-github-oauth-1.20261112.muse-request-routes.md](SPEC.cloudflare-workers-github-oauth-1.20261112.muse-request-routes.md) の7章)。決まったら、2章の経路をその名前で書き直す。

### 8.1 未決: ワーカー経由でコンテナを通る経路の判定と矛盾

**対象**: 本体 Worker → demo コンテナ(`server.js` の中継)→ muse-vm と届く要求(AIチャットの旧コンテナ直通、tree-view の Museタブの `container`)— 鍵だけで経路を判定するときに起きうる食い違い。

- コンテナの中継は鍵を持たず、呼び出し側の `Authorization` をそのまま muse-vm へ渡す(`containers/demo/server.js` の `MUSE_PROXY_PATH`)。このため、直送と同じ鍵が、コンテナのノード(cf-demo-container)から届くことがある。
- この経路では、鍵から経路を判定するしかない。一方で、muse-vm から見える送り元のノード(直送なら `main-worker-muse`、コンテナ経由なら cf-demo-container)は、鍵が示す経路と食い違いうる。その食い違いを、矛盾として評価する必要が出るかもしれない(ユーザー指摘 2026-11-13)。
- AIチャットの入力窓から Muse に聞くときにも、同じ食い違いが起こりうる(⚙で旧コンテナ直通を選ぶと、本体の鍵がコンテナのノードから届く。ユーザー指摘 2026-11-13)。
- 今は、この食い違いに機能を割り振る予定がないので、厳密には定義しない(ユーザー指定 2026-11-13)。
- 今は決めない。コンテナ側の鍵を用意するとき(ユーザーによると、これから)に、「鍵が示す経路」と「送り元のノード」が食い違ったときの扱い(受ける・断る・記録だけ)を決め、この節に書く。
