# SPEC: muse-vmのダッシュボード

作成日: 2026-11-07
状態: **案・協議完了**（Museが合意し、Codexが5回のレビューで確定可と判定した。実装はしない。採否と実装は利用者が決める）

関連: [/muse-statusの仕様](SPEC.cloudflare-workers-github-oauth-1.muse-status.20261106.md)、[Museへの問い合わせを記録する処理](SPEC.cloudflare-workers-github-oauth-1.20261107.muse-inquiry-recording.md)、D1`agent-inquiries`のケース`muse-vm-dashboard-20261107`（Museへの問い合わせ`mvd-e1`〜`mvd-e9`、Codexのレビュー`mvd-c1`〜`mvd-c5`）。

根拠の書き方: **ソース**はMuseがmuse-vmのソースで行番号を示したもの、**実測**はMuseがVMで読んだもの、**コード**はこのリポジトリで確かめたもの、**設計**はこの協議で決めた案（事実ではない）。

## 1. 目的と範囲

**対象**: 本体Workerの`/muse-status`、muse-vmのブリッジ`server.py`（`/home/hatch/muse-vm-hacks/files/api-bridge/server.py`）と`nix-boot-trigger.sh` — muse-vmの稼働状況（再起動、負荷、メモリ、ディスク、ブリッジの待ち）を1か所で見られるようにする。

### 背景

- muse-vmは繰り返し再起動している。記録にある起動時刻は2026-11-07 14:56:24 JST（予備知識`n-vm-reboot`）、17:52:16 UTC（`mvd-e2`、btime）、23:03:52 UTC（`mvd-e6`、btime）、2026-11-08 00:23:47 UTC（ケース`muse-status-wasm-20261107`の`msw-e3`、btime。23:50頃から00:30頃まで届かなかった）。理由はVMの内側から特定できず、wtmpは`/run`（tmpfs）にあって再起動で消える（`mvd-e2`）。
- 今のブリッジから取れるのは`/health`（生存だけ）、`/nix/packages`、ネイティブコマンド`/status`（ブリッジの稼働時間・待機ジョブ数・ツールセッション数）だけで、VM自体の指標を返す経路が無い（`mvd-e1`）。

### 範囲外

- 実装。
- Tailscaleの接続状態（DERPレイテンシ、ピア数）。今の経路では安全に取れないため不採用（提案`mvd-p1`）。
- コンテナ停止中のブラウザのTailscale WASMからの取得。WASMの`fetch`はヘッダーを付けられず、`/vm/metrics`はBearer必須なので取れない。WASMでは従来どおり`/health`の到達性だけを見る。

### 前提の状態

`/muse-status`自体がまだ本番に反映されていない（[DEPLOYMENT-STATE.md](DEPLOYMENT-STATE.md)「2026-11-06: /muse-status（未反映）」）。このSPECの「既存の実装」はリポジトリのソース上の話。

## 2. 構成

```
/muse-status（VMの指標の欄）
  → 本体Worker GET /api/muse-status/metrics?node=muse-vm（authMiddleware＋cfDashboardAdminMiddleware）
  → DEMO_CONTAINER server.js GET /admin/muse/muse-vm/metrics（Bearer MUSE_API_KEYを要求ごとに渡す）
  → tailscale nc → muse-vm:8080 GET /vm/metrics（Bearer必須）
```

Worker・`server.js`の作りは`/nix/packages`と同じにする（ノードの許可一覧、`/admin`は公開トンネルから届かない、`getState`で停止中なら起動しない）。

## 3. ブリッジに足す経路 `GET /vm/metrics`

### 置き場所と前提

| 項目 | 内容 | 根拠 |
|---|---|---|
| 位置 | `do_GET`の`/v1/models`（779〜781行）の直後、`/nix/packages`（782行）の前。完全一致`self.path == "/vm/metrics"` | ソース（`mvd-e4`） |
| 認証 | `_authorized()`（775〜778行）を通った後なのでBearer必須。認証前にあるのは`/health`と`/session/`だけ | ソース（`mvd-e4`） |
| 並行性 | `ThreadingHTTPServer`（32行・1095行）で要求ごとに別スレッド。`JOB_LOCK`（81行）を取るのはジョブ経路`_serve_via_job`（903行）だけ。`/session/<sid>/next`の55秒待ちはセッション固有のConditionで待つ（1079行） | ソース（`mvd-e4`）。負荷の下で即応答することは実測していない |
| 取得方法 | `/proc`の読み取り、`os.statvfs`、`os.listdir`。subprocessを使わない | 設計。似た前例は`/nix/packages`（378行〜、manifestを直接読む）と`/status`の件数（692行、`os.listdir`）（ソース、`mvd-e5`） |
| キャッシュ | 持たない | 設計（Museの推測による） |
| 取得の間隔 | 5秒以上。画面の既定は60秒 | 設計（Museの推測による） |

### 返す値（`schema_version: 1`）

各項目は`{"value": <値>, "error": null}`か`{"value": null, "error": "<理由>"}`のどちらかの形に揃える（成功と失敗で型を変えない）。

| 項目 | 取得元 | `value`の型 |
|---|---|---|
| `boot.boot_id` | `/proc/sys/kernel/random/boot_id` | 36文字の小文字16進UUID（実測で読める、`mvd-e7`） |
| `boot.btime` | `/proc/stat`の`btime` | 整数（epoch秒）。表示用。識別子には使わない（時計の補正で変わり得る） |
| `boot.uptime_seconds` | `/proc/uptime` | 数値 |
| `boot.history` | `/home/hatch/state/boots/`（4章） | `{"recent": [直近5件の boot_id・btime_iso・recorded_at], "total": 整数, "corrupt": 整数, "since": ISO 8601 または null}` |
| `cpu.loadavg` | `/proc/loadavg` | 数値3つの配列 |
| `pressure.cpu`・`pressure.memory`・`pressure.io` | `/proc/pressure/*` | `some`・`full`それぞれの`avg10`・`avg60`・`avg300`（3つとも両方の行があることを実測、`mvd-e7`） |
| `memory` | `/proc/meminfo` | `MemTotal`・`MemAvailable`・`SwapTotal`・`SwapFree`（バイト） |
| `disk.home`・`disk.root` | `os.statvfs("/home/hatch")`・`os.statvfs("/")` | `total`・`available`（`f_bavail`）・`used`（`total - f_bfree`）のバイト数。使用率は`used / (used + available)` |
| `bridge.inbox_count` | `/home/hatch/bridge/inbox`の`*.json`の数 | 整数。物理的な件数で、実行待ちの件数ではない |
| `bridge.pending_count` | inboxの`*.json`のうち、対応するoutboxの回答（`.txt`）が無いもの | 整数。実行中・実行待ち・処理する者がいなくなった未応答をすべて含む |
| `bridge.oldest_pending_age_seconds` | 上の対象のうち最も古い`mtime`から、VMの現在時刻までの秒数 | 整数か、対象が無ければ`null`。受付からの時間の**近似**（`mtime`は受付時刻そのものではない）。負の値（未来の`mtime`）は`parse_error` |
| `bridge.pending_overdue` | `pending_count`が1以上かつ`oldest_pending_age_seconds`が300を超える | 真偽。画面では「未応答が5分超」。処理の停止の証明ではない（正常な長い実行も当たる）。上の2つのどちらかが失敗したら、この項目も失敗にし、`false`にしない |
| `bridge.completed_inbox_count` | inboxとoutboxの回答が両方あるもの | 整数。正常に片付く直前も含むので「孤児」とは呼ばない。長く残るなら片付けの失敗を疑う |
| `nix.generations` | `~/nixdisk/var/nix/profiles/per-user/root`の`profile-*-link`の数 | 整数 |
| `generatedAt` | 応答を作った時刻 | ISO 8601（UTC） |

- 応答は64KiB以下。数値は有限の値だけを返す（NaN・Infinityは`parse_error`にする）。
- `pressure.*`は`some`・`full`のどちらかの行が欠けたら、そのファイルの項目全体を`parse_error`にする。ディスクの使用率は分母が0なら`unavailable`にする。
- `disk.home`は、`/home/hatch`が永続ディスク（4章のマウント確認と同じ条件）でなければ`{"value": null, "error": "not_mounted"}`にする。マウントされていないと`/`の容量を`home`として返してしまうため。

### 伏せるもの

- `bridge.*`の5項目は、inboxとoutboxを1回ずつ列挙した同じ結果から計算する（追記: 2026-11-08、ケース`muse-status-wasm-20261107`の`msw-p2`の修正。根拠はMuseの回答`msw-e3`とCodexの`msw-c2`）。待ちの判定にoutboxを見るのは、2026-11-07 23:03のジョブがinboxとoutboxの両方に残っていたため（Museの実測）。ネイティブコマンド`/status`の待機ジョブ数（691〜694行）はinboxの数をそのまま数えるので、この残りを待ちとして数える。閾値の300秒は暫定の警告値で、ジョブの`TIMEOUT`（600秒、77行）より短くした。
- **列挙の順序と途中の変化**（設計）: inboxを先に、outboxを後に列挙する。inboxの列挙の後に作られたジョブは数えない（次の取得で数える）。2つの列挙の間に回答されたジョブは、回答済みに数える。`mtime`を読むときにファイルが消えていたら（片付けが終わった）、そのジョブは数えず、項目の失敗にもしない。結果はこの数ミリ秒の間の近似で、同じ時点の状態であることは保証しない。
- **回答の完成**（設計）: outboxの`.txt`があれば回答済みとみなす。`bridge-respond`が一時ファイルからrenameで書くかは確かめていない（8章）。書き込みの途中でも回答済みに数えるので、未応答の件数がその間だけ少なく出ることがある。
- **inboxのファイル名を返さない。** ファイル名がそのままジョブID（926行、ソース、`mvd-e5`）。中身はプロンプトを含むので読まない。
- **パス、リンク名、デバイス名を返さない。** 容量は固定のラベル`home`・`root`と数値だけ。
- ホスト名・IPは取得元に無いので足さない。
- `boot_id`はVMの外では起動の識別にしか使わない。画面には先頭8文字だけ出す。

### 失敗時

| 場合 | 応答 |
|---|---|
| 1項目が読めない | その項目を`{"value": null, "error": "<理由>"}`にし、全体は200 |
| 理由の文字列 | `unavailable`・`permission_denied`・`parse_error`・`not_mounted`の固定値。例外文・パス・トレースバックは入れない |
| 認証失敗 | 401（既存どおり） |
| ハンドラ全体の失敗 | 500と固定の本文 |

`/nix/packages`は失敗すると全体を500にする（754〜766行、ソース）。`/vm/metrics`は項目が独立しているので項目単位にする（設計）。

## 4. 再起動の記録（採用済み提案`mvd-p2`、`mvd-p5`で改訂）

**正本は起動ごとに1つのファイルにする。** 最初の案（履歴jsonlと累計ファイルの2つ）は、途中で止まると片方だけ更新されるため取りやめた（Codexの指摘、Museも同意、`mvd-e8`）。

| 項目 | 内容 | 根拠 |
|---|---|---|
| 書く主体 | `/home/hatch/hooks/scripts/nix-boot-trigger.sh`（5秒ごとのポーリング、タイムアウト240秒） | ソース（`mvd-e7`） |
| 書く位置 | `flock -n`（37〜40行）が取れた後、`nix --version`（42行）の直前。26行のマーカー判定はflockより前の早期終了なので、そこには置かない | ソース（`mvd-e7`）、位置は設計。行番号の訂正はMuse（`mvd-e9`） |
| Nixの成否との関係 | **Nixの確認の前に記録する。Nixが失敗した起動も記録する。** Museは`mvd-e8`で「失敗した起動ではファイルを作らない」と述べたが、再起動の回数を数える目的には失敗した起動も要るので、こちらを採った | 設計 |
| 繰り返しへの備え | マーカーは`nix --version`の成功時だけ作られる（44〜45行）。失敗が続くと毎回のポーリングで書く位置に来る。**同じ`boot_id`の記録（`<boot_id>.json`か、隔離済みの`<boot_id>.json.corrupt-*`）があれば何もしない**ので重複しない | ソース（`mvd-e7`）と設計 |
| 記録に失敗したとき | マウントされていない場合（下の行）を除き、ログに残して`nix --version`へ進む。記録の失敗でNixの初期化を止めない。マーカーが作られると、その起動では再び記録しないので欠ける。欠けた起動はWorkerの観測（下の節）でだけ分かる | 設計 |
| ファイル | `/home/hatch/state/boots/<boot_id>.json`。中身は`{"boot_id", "btime", "btime_iso", "recorded_at"}`。ディレクトリは書く前に`mkdir -p`で作る（今は無い） | 設計（`mvd-e8`）。未作成はMuseの実測（`mvd-e9`） |
| 書き方 | 同じディレクトリに一時ファイルを書き、`fsync`してからrenameする。rename後にディレクトリも`fsync`する | 設計。renameは同じファイルシステム内なら置き換えが原子的 |
| マウントの確認 | 書く前に`findmnt`で`/home/hatch`の元が`/dev/mapper/rv`（btrfs）であることを確かめる。`mountpoint -q`では足りない（同じパスにoverlayの行もある） | 実測（`mvd-e8`） |
| マウントされていないとき | 書かない。`nix --version`もしない。理由をログ`~/hooks/logs/nix-boot-trigger.jsonl`に残し、次のポーリングで再試行する。別の場所には書かない | 設計（`mvd-e8`）。マウントより後に動く保証はスクリプトにも定義にも無い（ソース、`mvd-e7`） |
| 古い記録 | 消さない（1件数百バイト）。整理するなら`boots/archive/`へ移し、累計は`boots/`と`archive/`の合計で数える | 設計（`mvd-e8`） |
| 壊れたファイル | 不正なJSONは消さず、上書きもしない。**隔離するのは書く側だけ。** `nix-boot-trigger`が記録するときに（flockの内側で）`boots/`を確かめ、不正なものを`<boot_id>.json.corrupt-<UTCの時刻>`へ移してログに残す。**上書きするrenameは使わない。** 移す先に`link`してから元を消し、移す先の名前が既にあれば末尾に`-1`、`-2`…を足して作り直す。ブリッジは読むだけで、まだ隔離されていない不正なファイルも、隔離済みのものと同じく壊れた記録として扱う。自動では直さない。1件が壊れていても、ほかの読み取りは止めない | 設計（`mvd-e8`を、書く主体を1つにする形に直した） |
| 復元できる範囲 | **起動があったこととその`boot_id`だけ。** ファイル名に残るので、中身が壊れても起動として数える。`btime`・`recorded_at`は復元できない（ほかに保存していない）ので、`recent`では`null`と`"corrupt": true`で示す。中身を推測で書き直さない | 設計 |
| 数え方 | `total`はファイル数ではなく、`boots/`と`archive/`にある**`boot_id`の種類の数**（正常と隔離済みを合わせる）。`corrupt`は、中身を読める記録が1つも無い`boot_id`の数（隔離済みか未隔離かを問わない） | 設計 |
| 所有者と権限 | ディレクトリ0755・ファイル0644、`nix-boot-trigger`を動かすユーザーの所有。ブリッジは読むだけ | 設計 |
| 累計の意味 | **記録を始めてから記録できた起動の数**で、VMのそれまでの全起動の数ではない。記録の開始日時`since`は、中身を読める記録のうち最も古い`recorded_at`。壊れた記録は時刻が分からないので使わない（そのため、実際の開始はこれより前のことがある）。読める記録が無ければ`null`。`/vm/metrics`の`boot.history`に足す | 設計（Codexの指摘） |

### Worker側の観測記録

VM側の記録が始まる前や、マウントされなかった起動を補うため、Workerは`/vm/metrics`を取るたびに観測した起動を記録する（設計）。

- キーは`(node, boot_id)`で一意にし、`INSERT OR IGNORE`で登録する（複数のタブ・Worker・応答の順の入れ替わりで二重に数えない）。
- 列は`node`・`boot_id`・`btime`・`first_seen_at`・`last_seen_at`。`last_seen_at`は値が大きくなるときだけ更新する。
- `boot_id`の形式が正しくない応答は保存しない。
- これは「観測できた起動」の記録で、観測の合間に起きた複数の再起動は分からない。
- **VM側の記録とは突き合わせない。** `/vm/metrics`は直近5件しか返さないので、全件の照合はできない。画面では「VMの記録」と「Workerの観測」を別々に表示し、直近5件の`boot_id`（先頭8文字）が並ぶことで見比べられるようにする。
- 保存先のD1とテーブルは利用者が決める（7章）。

## 5. 画面と中継

`/muse-status`のmuse-vmの欄に「VMの指標」を足す。新しいページは作らない（ナビへの追加もしない。CLAUDE.mdのルール30）。

| 表示 | 内容 |
|---|---|
| 起動 | 起動時刻、稼働時間、直近5回の起動時刻、記録した起動の数（記録の開始日時つき）、壊れた記録の数（1以上のとき） |
| 負荷 | loadavg、PSI（cpu・memory・io）の`some`の`avg10`・`avg60` |
| メモリ | 利用可能／合計 |
| ディスク | `home`・`root`の使用率と空き |
| ブリッジ | 未応答の件数と最古の経過時間（5分を超えたら「未応答が5分超」）、inboxに残っている回答済みの件数、Nixの世代数 |
| 項目の失敗 | 項目ごとに「取得できません（理由）」。ほかの項目は表示する |
| 最終取得 | 最後に成功した時刻。取得に失敗したら、前の値は「〇分前の値」と明示し、現在の値として表示しない |
| 更新 | 読み込み時と定期（既定60秒、タブが隠れている間は止める）。取得中は次の取得を始めない。古い要求の応答が後から届いたら捨てる |
| 上流の文字列 | `textContent`で表示する（表示の安全のため。情報を伏せる対策にはならない） |

### Workerの応答（`/api/muse-status/metrics`）

既存の`/nix/packages`と同じく、上流のHTTP状態をJSONの`state`に変換する（`src/utils/museNodeStatus.ts`、コード）。外側の取得の成否と、項目ごとの成否は分けて扱う。

| 上流・中継 | `state` | 画面 |
|---|---|---|
| 200で`schema_version`が1 | `ok` | 指標（項目ごとの失敗を含む） |
| 200で形式が違う、JSONでない、64KiBを超える | `invalid_response` | 応答の形式が正しくありません |
| 200で全項目が失敗 | `ok` | 全項目に「取得できません」 |
| ノードの404で、本文が`/vm/metrics`未提供を示す | `not_provided` | このノードは /vm/metrics を提供していません |
| 中継の404（`not_found`。コンテナのイメージが古く、`metrics`の中継が無い） | `relay_outdated` | コンテナの中継が古いため取得できません |
| 401・403 | `unauthorized` | MUSE_API_KEYが一致しません |
| ノードの500 | `bridge_error` | ノードで指標を作れませんでした |
| 502 | `unreachable` | 接続できません |
| 504、Workerの時間切れ | `timeout` | 応答なし（時間切れ） |
| `MUSE_API_KEY`が無い | `no_key` | MUSE_API_KEY未設定 |
| コンテナの停止中 | `container_stopped` | 本体コンテナ停止中 |

- `server.js`の中継は、未対応のパスにも404`not_found`を返す（`containers/demo/server.js`の`relayMuseNode`、コード）。ノードの404と区別できるよう、Workerは中継のエラー本文の`error`で見分ける。
- 中継は接続に失敗すると、ncのstderrから作った`detail`を返す（`relayMuseGet`、コード）。**metricsの経路では`detail`をWorkerのAPI応答にも画面にも含めない**（固定の文言だけにする）。
- Workerは`boot_id`の形式（36文字の小文字16進UUID）と`btime`（正の整数）を確かめ、正しくなければ観測記録に保存しない。
- 定期取得は既存のシグナルの定期送信とは別の設定にしない（同じ画面の更新に含める）。失敗した後も、次の定期取得まで再試行しない。
- `getState`で停止を確かめてから`fetch`するまでの間にコンテナが止まった場合、起動を確実に防げるかは確かめていない（`readContainer`、コード上で追加の確認は無い）。

## 6. 本番への反映の順序

1. muse-vm側: `server.py`への経路の追加と`nix-boot-trigger.sh`の変更は、メインのチャットで人が依頼する。ブリッジ経由のMuseは本番反映を断る（予備知識`n-muse-no-deploy`）。`server.py`の編集はブリッジの再起動で反映され、実行中のジョブの応答は失われるので、ジョブが無いときに行う。`BRIDGE_PORT`で別のポートに起動して先に試せる（予備知識`n-bridge-restart`）。
2. 本体コンテナ: `server.js`に`/admin/muse/<ノード>/metrics`を足す（コンテナの再ビルドが要る）。
3. Worker: `/api/muse-status/metrics`、観測記録、画面。`/muse-status`の未反映分と一緒に反映する。

## 7. 決めること（利用者）

- 実装するか。する場合の順序（6章）。
- Worker側の観測記録の保存先（`agent-inquiries`か別のD1か）と保持期間。
- 画面の定期取得の既定間隔（案は60秒）。
- 古い起動記録を整理するか（案は整理しない）。

## 8. 未確認

- 推論の負荷が高いときに`/vm/metrics`が即応答すること（ソースの構造からの判断だけ）。
- `nix-boot-trigger`が`/home/hatch`のマウントより後に動くこと。保証は無く、4章のマウントの確認で補う。
- `getState`から`fetch`までの間にコンテナが止まった場合の扱い。
- 再起動の原因。
- `bridge-respond`がoutboxの`.txt`を一時ファイルからrenameで書くか（3章の「回答の完成」）。
- `/home/hatch`の容量が足りないときの記録の失敗（4章の「記録に失敗したとき」の扱いになる。実測していない）。

## 9. 協議の経過

| 順 | 相手 | 内容 | 結果 |
|---|---|---|---|
| `mvd-e1`・`mvd-e2` | Muse | ブリッジの経路、VMの指標と取得元 | 材料が決まった。再起動の記録の案（`mvd-p2`）を採用 |
| `mvd-e3` | Muse | `/vm/metrics`の制約を5点まとめて | 300秒で時間切れ |
| `mvd-e4`・`mvd-e5` | Muse | 並行性と位置、伏せるもの・取得方法・失敗時 | 3章が決まった |
| `mvd-e6` | Muse | 再起動の記録の具体化 | 23:03:52 UTCの再起動が分かった。履歴jsonlの案 |
| `mvd-c1` | Codex | 下書き全体 | 根拠の過大な扱い、2ファイル更新の非原子性、`boot_id`、中継の404と`detail`など |
| `mvd-e7`・`mvd-e8` | Muse | Codexの確認事項、起動ごと1ファイルの案 | 4章を起動ごとのファイルに改めた |
| `mvd-c2` | Codex | 改訂版 | 隔離の主体、照合、復元、記録の失敗、Museの回答との採否の5点で確定を保留 |
| `mvd-e9` | Muse | 改訂版の要点 | 合意。書く位置の行番号と`mkdir -p`を訂正 |
| `mvd-c3` | Codex | 5点の反映 | 4点を解消。復元できる範囲、隔離物の重複と上書きが残った |
| `mvd-c4` | Codex | 復元の範囲、`boot_id`単位の数え方、隔離物の名前 | 3点を解消。上書きの防止、`corrupt`の定義、開始日時の扱いが残った |
| `mvd-c5` | Codex | 上記3点 | 4点を解消。3章の`since`の型を`null`も許す形に揃えることを条件に確定可。揃えた |

## 10. 結論

Museは`mvd-e9`で全体に合意した。Codexは`mvd-c5`で、3章の`since`の型を揃えることを条件に「実装判断を残した協議の結果の案」として確定してよいと判定し、その修正を入れた。このSPECは協議の結果の案で、実装するかは利用者が決める（7章）。
