# SPEC.cloudflare-workers-github-oauth-1.muse-status.20261106.md

## /muse-status: tailnet上のMuseの状態ページ

**対象**: 本体Workerの`/muse-status` — tailnet上の`muse`・`muse-vm`の起動状況、Nixのインストールパッケージ、死活確認のシグナル送信を1ページで行う。

関連: [SPEC.cloudflare-workers-github-oauth-1.askmuse-direct.20261106.md](SPEC.cloudflare-workers-github-oauth-1.askmuse-direct.20261106.md)の中継と死活確認。

---

## 経路

Workerはtailnetに参加できないので、`/askmuse`と同じく本体デモコンテナを経由する。

```
/muse-status → 本体Worker → DEMO_CONTAINER → server.js → tailscale nc → muse・muse-vm:8080
```

| 画面の項目 | Workerの入口 | server.jsの入口 | 上流 |
|---|---|---|---|
| 起動状況 | `GET /api/muse-status` | `GET /debug/tailscale-peers`（既存） | `tailscale status --json` |
| シグナル送信 | `POST /api/muse-status/signal` | `GET /admin/muse/<ノード>/health` | `<ノード>:8080/health` |
| Nixのパッケージ | `GET /api/muse-status/nix?node=<ノード>` | `GET /admin/muse/<ノード>/nix` | `<ノード>:8080/nix/packages` |

---

## 仕様

| 項目 | 動作 |
|---|---|
| 認証 | ページもAPIも`authMiddleware`と`cfDashboardAdminMiddleware`（管理者のみ） |
| ノード | `muse`・`muse-vm`に固定。Workerと`server.js`の両方で許可の一覧と照合する。不正な値はWorkerが400を返す |
| 中継の入口 | `/admin/muse/…`。Apacheが`/admin`を拒否するので、公開トンネルからは届かない |
| キー | Workerのsecret`MUSE_API_KEY`を要求ごとに渡す。コンテナには置かない。`/health`へは渡さず、`/nix/packages`へだけ渡す |
| コンテナの停止中 | 起動しない。先に`getState`で確かめる。ページは`/cf-containers`からの起動を案内する |
| シグナルの送信 | ノードごとのボタン、ページ読み込み時、定期送信 |
| 定期送信 | 既定で有効、600秒ごと。60〜86400秒の整数。タブが隠れている間は送らず、戻ったときに間隔が空いていれば送る。送信時に起動状況も更新する |
| 設定の保存先 | Cookie`muse_status_signal`（ブラウザごと、1年）。ページ読み込み時に画面へ反映する。読めない値は既定値として扱う。範囲外の間隔は保存しない |
| 待ち時間 | シグナルは中継5秒・Worker8秒。Nixは中継15秒・Worker18秒 |
| Nixの表示 | 名前順、上限5000件、ページ内で名前の絞り込み。上流の文字列は`textContent`で表示する |
| ナビへの追加 | 行わない（CLAUDE.mdのルール30）。URLを直接開く |

### シグナルの結果

| 応答 | 表示 |
|---|---|
| 200で`{"status":"ok"}` | 稼働中 |
| 200でそれ以外、その他の状態コード | 異常応答 |
| 502 | 接続できません |
| 504、Workerの時間切れ | 応答なし（時間切れ） |
| `MUSE_API_KEY`が無い | MUSE_API_KEY未設定 |
| コンテナの停止中 | 本体コンテナ停止中 |

確かめるのは経路とノードの`/health`までで、モデルが回答を生成できることは確かめない。

### tailnetの表示とシグナルの違い

`オンライン`・`オフライン`はTailscaleの`Online`の値で、シグナルの結果とは一致しないことがある。2026-11-06に、`muse-vm`が`Online: false`のまま`/health`へ200を返すことを確認した。稼働の判断にはシグナルの結果を使う。

### ノードが提供するNixのAPI

2026-11-07に`muse-vm`へ追加した（Worker側の変更なし）。ソースはmuse-vmの`/home/hatch/muse-vm-hacks/files/api-bridge/server.py`で、`nekoserver/muse-vm-hacks`（非公開）で管理する。`nix-env`は呼ばず、rootのプロファイルの`manifest.nix`を読む。経緯は[NOTICE.cloudflare-workers-github-oauth-1.20261107.md](NOTICE.cloudflare-workers-github-oauth-1.20261107.md)。`muse`は8080番が接続拒否で、ブリッジは動いていない。応答の形は次のとおり。

```
GET http://<ノード>:8080/nix/packages
Authorization: Bearer <MUSE_API_KEY>
```

```json
{
  "packages": [{ "name": "hello", "version": "2.12.2" }],
  "generatedAt": "2026-11-06T20:00:00Z"
}
```

| 項目 | 内容 |
|---|---|
| `packages` | 必須。`name`は1〜200文字の文字列。`version`は文字列、不明なら`null` |
| `generatedAt` | 任意。一覧を作った時刻 |
| 認証 | ノード側で`Authorization`を照合する。`server.js`はBearerの形式しか確かめないので、照合が無いと8080番へ届く端末から読める |
| 応答の大きさ | 1MiB以下 |
| 応答の時間 | 15秒以内。`nix`の実行に時間がかかるなら、結果を保存して返す |

| ノードの応答 | 画面の表示 |
|---|---|
| 200 | 一覧 |
| 404 | このノードは /nix/packages を提供していません |
| 401・403 | ノードがキーを拒否しました |
| 502 | ノードへ接続できません |
| 504 | 時間内に応答がありませんでした |
| それ以外（`muse-vm`が`manifest.nix`を読めない500を含む） | ノードの応答を読み取れませんでした |
| その他、読めない本文 | ノードの応答を読み取れませんでした |

`muse`は8080番が接続拒否（2026-11-06）で、現状はシグナルも「接続できません」になる。

---

## 中継の修正

オフラインのノードへの`tailscale nc`は何も返さずに終わることがある。このときhttpは`socket hang up`の後に`ABORT_ERR`をもう一度`error`として出す。`upstream.once('error')`では2回目を受けられず、`server.js`のプロセスごと落ちる（2026-11-06に実際のtailnetで再現）。`upstream.on('error')`へ変更した。`POST /muse/v1/chat/completions`にも同じ修正を入れた。

---

## 「接続できません」の理由を表示する（2026-11-07）

**対象**: `containers/demo/server.js`の`connectMuse`・`relayMuseGet`、`src/utils/museNodeStatus.ts`の`sendMuseSignal`、`src/views/museStatus.ts`のシグナル欄 — Tailscaleではオンラインなのにシグナルが「接続できません」になるとき、理由をページに出す。

### 背景

2026-11-07、`muse`がTailscaleでオンラインと表示されているのに、シグナルが「接続できません」になると報告があった（`muse-vm`は稼働中）。シグナルの送り先は`muse:8080/health`で、`muse`は8080番で何も待ち受けていない（2026-11-06に接続拒否を確認済み）。Tailscaleの「オンライン」は端末がtailnetにいることしか表さず、8080番のサービスの有無は分からない。

一方、中継は`tailscale nc`のエラー出力を捨てており、到達不能・接続拒否・途中切断が同じ「接続できません」になって、ページから原因を判断できなかった。

### 修正内容

| ファイル | 変更 |
|---|---|
| `containers/demo/server.js` | `tailscale nc`のstderrを受け取り、つながらなかったときは502の本文に`detail`（末尾300文字、加工なし）を入れる。ncの終了を最大500ミリ秒待ってから返す。`error`が2回出ても応答は1回にする |
| `src/utils/museNodeStatus.ts` | 502の本文の`detail`を`MuseSignalResult.detail`に入れる（300文字まで。読めなければnull） |
| `src/views/museStatus.ts` | 「接続できません」のとき、理由を`textContent`で表示する。Tailscaleでオンラインのノードには「8080番(/health)で待ち受けていないか、途中で切断された可能性」と添える。稼働中に戻れば消す |

`tailscale nc`が出す文言は確かめていないので、文言で分類はしない（契約にしない）。

### 残っていること

`muse`のシグナルを稼働中にするには、`muse`側で8080番に`/health`を用意する必要がある。`muse`のソースはこのリポジトリに無い。

---

## 確認の状況

| 項目 | 結果 |
|---|---|
| 中継 | 実際のtailnetで確認。`muse-vm`の`/health`は200、`/nix/packages`は2026-11-06に404、2026-11-07の追加後に200。`muse`は502 |
| ページ | モックのAPIでChromeのライト・ダーク・幅400pxを確認。このホストに日本語フォントが無いので、日本語の字形は未確認 |
| 本番の経路 | 未確認（未デプロイ）。Worker → Durable Object → `server.js`は通していない |
| Nixの一覧の表示 | モックのみ。実際のノードのAPIが無いので未確認 |
| コンテナイメージのビルド | 未確認。作業環境にDockerが無い |
