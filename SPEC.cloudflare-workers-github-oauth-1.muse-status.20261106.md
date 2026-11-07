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

## 本体コンテナの停止中はTailscale WASMで取得する（2026-11-07）

**対象**: `src/views/museStatus.ts`のページscriptとHTML、`/muse-status`のCSP（`src/index.ts`）、共通ローダー`public/tailscale-wasm-client.mjs` — 本体コンテナが停止中でも、ブラウザが公式`@tailscale/connect`のWASMでtailnetへ参加し、muse・muse-vmの状態とmuse-vmの`/health`シグナルを取得する。

### 背景

従来の経路は本体Worker → `DEMO_CONTAINER` → `server.js` → `tailscale nc`だけで、コンテナが停止中は「本体コンテナ停止中」としか表示できなかった。課金を避けるため、このページからコンテナは起動しない。`/container-monitor`は既に公式のTailscale WASM（`public/tailscale-connect/1.102.3-3/`）をブラウザで使っているので、同じ配布物を使う。

### 経路

```
/muse-status（ブラウザ）→ @tailscale/connect（WASM、利用者がTailscaleへログイン）→ tailnet → muse-vm:8080/health
```

| 項目 | 本体コンテナが使えるとき | 停止中でWASMが接続済みのとき | どちらも無いとき |
|---|---|---|---|
| 起動状況 | `/api/muse-status`（従来どおり） | WASMのnetmap（名前・IPv4・`online`） | 「確認できません」 |
| シグナル | `/api/muse-status/signal` | WASMの`fetch("http://<muse-vmのIPv4>:8080/health")` | 「本体コンテナ停止中」 |
| Nixの一覧 | `/api/muse-status/nix` | 取得しない（下記） | 「本体コンテナが停止中のため取得できません」 |

- 判定は毎回Workerの応答から始める。シグナルはまず`/api/muse-status/signal`へ送り、`container_not_running`か通信失敗のときだけWASMで送る。コンテナが起動していれば、WASMに接続していてもコンテナ経由を使う。
- 本体コンテナが起動していても、Workerがtailscaleの状態を読めない（`error`がある）ときは、起動状況の表示にWASMを使う。
- 画面上部の「取得経路」に、本体コンテナ・Tailscale WASM（このブラウザ）・なしのどれで表示しているかを出す。

### WASMの仕様

| 項目 | 動作 |
|---|---|
| 配布物 | 既存の`@tailscale/connect@1.102.3-3`（integrityとsha256は`build-info.json`）。新しい取得はしていない |
| 読み込み | 「Tailscaleへ接続」を押したときだけ。このタブで参加済み（sessionStorageに状態がある）で、コンテナが停止中なら、読み込み時に自動で再接続する |
| ログイン | `authKey`は空。利用者がTailscaleでログインする。ログインURLはHTTPSの`*.tailscale.com`だけをリンクにする |
| 参加状態 | sessionStorageの`muse-status.tailscale.`で始まるキー。ログアウトで消す。`/container-monitor`（`container-monitor.tailscale.`）とは分ける |
| 端末名 | `muse-status-browser` |
| ノードの特定 | netmapのpeerの`name`（FQDN）の先頭ラベルが`muse`・`muse-vm`と一致するもの。`muse-vm-old`などは対象外 |
| 宛先 | netmapにあるmuse-vmのtailnetのIPv4（100.64.0.0/10）。無ければ送らず「接続できません」と理由を出す |
| `online` | netmapで省略されたら「不明」。オフラインと決めつけない |
| 時間切れ | 8秒（Workerの待ち時間と同じ）。WASMのfetchは取り消せないので、結果だけ先に返す |
| 切断・ログアウト | netmapから作った表示を捨て、「確認できません」に戻す |
| 外向き専用の`muse` | 従来どおりHTTPを送らない |

### SDKの契約

`public/tailscale-connect/1.102.3-3/main.wasm.gz`の中の文字列で確かめた（ソースは`tailscale/tailscale`の`cmd/tsconnect`）。

| 項目 | 内容 | 根拠 |
|---|---|---|
| `fetch` | `fetch(url)`の1引数のGETだけ。ヘッダーは付けられない。戻り値は`status`・`statusText`・`text()` | `Usage: fetch(url)`、`statusText` |
| netmapのpeer | `name`・`addresses`・`online,omitempty`。OS・経路・最終接続は無い | `json:"name"`・`json:"addresses"`・`json:"online,omitempty"`・`json:"peers"` |

版を上げるときは、この2点を確かめ直してから`museStatus.test.ts`を直す。

### Nixの一覧をWASMで取らない理由

`/nix/packages`は`MUSE_API_KEY`のBearerが要る。WASMの`fetch`はヘッダーを付けられず、付けられてもキーをブラウザへ渡すことになる。キーはWorkerのsecretにだけ置く方針（[Tailscaleのポリシー](POLICY.cloudflare-workers-github-oauth-1.security-tailscale.20261106.md)）を変えないため、WASMでは取得せず、その理由を表示する。

### `/health`に認証が要らないこと

2026-11-07にブリッジ経由でMuseへ問い合わせ、`server.py`の`do_GET`が`/health`を`_authorized()`より前に返すこと（769〜771行）、`0.0.0.0:8080`で待ち受けること（1095行）、送信元IPやHostで拒否しないことの回答を得た。**ソース上の回答で、稼働版との一致は未確認。** 問い合わせはD1`agent-inquiries`の`muse-status-wasm-20261107`に記録した。

Museの提案を採用し、WASM経由の結果には「到達性の確認のみ」と添える。`/health`の成功は、その端末から認証付きの経路を使えることまでは示さない。WASMで接続できないときは、tailnetのACL・ノードの稼働・WASMの接続状態を確かめるよう表示する。

2回目の問い合わせ（同じケース）で、Museは稼働中のプロセスがソースと同一内容であることを確かめたうえで、次を答えた。判定規則は変えていない。

- `/health`は`JOB_LOCK`を取らずにすぐ返り、本文は`{"status":"ok"}`で固定。推論中でも遅れない。
- パスは完全一致。`/health/`や`/health?…`は401になる。ページは`/health`だけを送る（テストで固定）。
- `/health`の200はHTTPのリスナーが生きていることだけを示し、ジョブが処理されていることは示さない（コンテナ経由も同じ）。
- 「HTTPSのページから`http://`への取得は混合コンテンツになる」という指摘は採用しなかった。WASMの`fetch`は、ブラウザのfetchではなく、WASMの中のGoのHTTPクライアントがtailnetで送る。ブラウザから見えるのは、TailscaleへのHTTPSとWebSocketだけ。設計から判断したもので、実tailnetでは確かめていない。
- 提案「`/health`に最終ジョブの応答時刻を足し、直近N分以内も稼働の条件にする」は未着手（`proposed`）。muse-vm側の変更が要り、本番反映はMuseのメインのチャットで人が依頼する。

### CSP

`/muse-status`は全体の既定（`connect-src 'self'`、`wasm-unsafe-eval`なし）ではWASMを動かせない。ルートで`MUSE_STATUS_CSP`を設定する。内容は`/container-monitor`と同じで、`wasm-unsafe-eval`、`blob:`、Tailscaleの`https:`・`wss:`（`*.tailscale.com`・`*.tailscale.io`）を足す。

### 共通ローダー

`/container-monitor.mjs`にあったWASMの取得・gzipの展開・ヘッダの確認と、ログインURLの判定を`public/tailscale-wasm-client.mjs`へ移し、両ページが使う。`/container-monitor.mjs`は`loadTailscaleClient`をそのまま再エクスポートする。

### 確認

| 項目 | 結果 |
|---|---|
| ページの単体テスト（jsdom、WASMは偽物） | 停止中の案内、接続後のnetmap表示とシグナル、museへ送らないこと、Nixを取らないこと、失敗の区別、起動中はコンテナ経由、切断・ログアウトで古い表示を捨てること、ログインURLの制限、自動再接続、読み込みの失敗 |
| ルートのCSP | `wasm-unsafe-eval`とTailscaleの`wss:`を含むことをテストした |
| 実ブラウザ | `node scripts/check-muse-status-browser.mjs`。Chromeで、ページのCSPの下で公式WASMを読み込み、`NeedsLogin`まで進むことを確かめた。外部への通信は遮断した |
| 実tailnet | **未確認。** Tailscaleへのログイン、ブラウザの端末からmuse-vmの8080番へ届くか（ACL）、netmapの実際の`name`の形 |
| 本番 | **未確認（未デプロイ）** |

### 注意事項

- WASMの端末は、ログインしたアカウントの端末としてtailnetへ参加する。ログインのたびに管理画面に端末が増える可能性がある（エフェメラルかどうかは未確認）。`/container-monitor`も同じ。
- tailnetのACLは2026-11-06の時点で全許可。ACLを絞るときは、ブラウザの端末からmuse-vmの8080番へ届くかも決める。

---

## 確認の状況

| 項目 | 結果 |
|---|---|
| 中継 | 実際のtailnetで確認。`muse-vm`の`/health`は200、`/nix/packages`は2026-11-06に404、2026-11-07の追加後に200。`muse`は502 |
| Tailscale WASM経由 | 2026-11-07追加。上の「本体コンテナの停止中はTailscale WASMで取得する」の確認を参照 |
| ページ | モックのAPIでChromeのライト・ダーク・幅400pxを確認。このホストに日本語フォントが無いので、日本語の字形は未確認 |
| 本番の経路 | 未確認（未デプロイ）。Worker → Durable Object → `server.js`は通していない |
| Nixの一覧の表示 | モックのみ。実際のノードのAPIが無いので未確認 |
| コンテナイメージのビルド | 未確認。作業環境にDockerが無い |
