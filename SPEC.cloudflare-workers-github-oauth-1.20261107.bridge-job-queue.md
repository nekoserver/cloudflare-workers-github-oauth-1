# SPEC: AIチャットからMuseに依頼したジョブを、本体コンテナのCLIが片付けて知見を貯める

作成日: 2026-11-07
状態: **案・主な判断は決定済み**（Museと協議済み。2026-11-08にロックをD1へ移す改訂をし、Codexがレビューした。10章の主な項目は利用者が決めた。キュー・D1ともまだ変更していない。実装は未着手）

関連: [Museへの問い合わせを記録する処理（SPEC）](SPEC.cloudflare-workers-github-oauth-1.20261107.muse-inquiry-recording.md)、D1`agent-inquiries`のケース`bridge-jobs-queue-20261107`（問い合わせ2件、キー14件、Museの提案6件）。

## 1. 目的と背景

**対象**: muse-vmの`/home/hatch/workspace/bridge-jobs`（Museが用意したジョブキュー）、本体コンテナ（cf-demo-container）のClaude Code CLI・Codex CLI、D1`agent-inquiries` — AIチャットの入力窓から利用者がMuseへ依頼したジョブを、本体コンテナのCLIがキューから取り出して片付け、そのやりとりで得た知見をデータベースに貯める。

### 背景

- 2026-11-07、利用者がMuseのメインチャットでジョブキューの作成を依頼し、Museが`queue/`・`done/`・`README.md`・`queue-job.sh`を用意した（最初のジョブ`31f81da449f7428e804ea999f7517197`）。
- 利用者の意図は、本体コンテナのCLIが消費者になること。一方、MuseのREADMEの「本体ワーカー（メインチャット）」はMuseのメインチャットを指していた。この食い違いをMuseと協議し、役割を分ける案で合意した（問い合わせ`bridge-jobs-queue-20261107-e2`）。

## 2. 現状（2026-11-07に実測）

**対象**: 今のキューの場所・読み方・形式 — 協議と実測で確かめた事実。

| 項目 | 内容 |
|---|---|
| 場所 | muse-vmの`/home/hatch/workspace/bridge-jobs`（`queue/`・`done/`・`README.md`・`queue-job.sh`） |
| 読み方 | 本体コンテナから`tailscale ssh root@muse-vm`。**絶対パス必須**（Tailscale SSHではHOMEが`/root`になり、`~/workspace`は無い）。読めることを実測で確認（2秒） |
| HTTP | ブリッジ（`muse-vm:8080`）にキュー用の入口は無い（`/jobs`は404） |
| SSHの許可 | ACLは`autogroup:member`のデバイスから`tag:muse`へ`root`を許可。本体コンテナは`okiraku.cloud@`所有でタグなしのため通る |
| 形式 | `queue/<job_id>.json`に`job_id`（bridgeの32桁16進）・`created`・`source`（`api-bridge`）・`status`・`request`・`notes` |
| 状態 | `queued`→`in_progress`（`queue/`に置いたまま）→`done`（`done/`へ移し、結果は`done/<job_id>.md`） |
| 排他 | 無い（`status`の書き換えだけ） |
| 自動処理 | 無い。メインチャットで「`bridge-jobs/queue`を確認して」と頼まれたときだけ読む |

## 3. 役割の分担（合意案）

**対象**: Muse、本体コンテナのCLI、同期役 — 誰が何を書き、誰が取り出すか。

| 主体 | 役割 | 書く場所 |
|---|---|---|
| Muse（muse-vm） | 依頼の受付と振り分け。bridgeのジョブを`queue/`へ写し、応答の1行目にjob idを返す。結果の確認 | キュー（README・`queue-job.sh`の持ち主） |
| 本体コンテナのClaude Code・Codex | `queue/`から取り出して実行し、結果を書き戻す | キュー（SSH経由） |
| 同期役（本体コンテナ） | キューを読み、D1へ履歴と知見を反映する。取り合いの判定はしない（5章のロックで行う） | D1（MuseはD1に書けない） |

- 消費者は本体コンテナのCLIだけ（10章で決定）。`target`・`assignee`は使わない。
- **正の分け方**（2026-11-08改訂）: ジョブの中身（依頼と結果の本文）の正はキューのファイル。ジョブの状態（誰が持っているか、終わったか、何回目か）の正はD1の`bridge_job_locks`。両方が食い違ったら、状態はD1に合わせてファイルを直す。履歴と検索の正はD1。

## 4. キューの形式（合意案、`schema_version: 1`）

**対象**: `queue/`・`claimed/`・`done/`のJSONと結果の`.md` — 今の形式に、後方互換で項目を足す。

```json
{
  "schema_version": 1,
  "job_id": "<bridgeのjob id、32桁16進>",
  "created": 1794080684,
  "source": "api-bridge",
  "origin": "aichat",
  "priority": 0,
  "status": "queued",
  "attempts": 0,
  "max_attempts": 3,
  "claimed_by": null,
  "claimed_at": null,
  "lease_until": null,
  "last_error": null,
  "completed_at": null,
  "result_summary": null,
  "result_path": null,
  "exit_code": null,
  "request": { "model": "muse", "messages": [], "session_available": false },
  "notes": ""
}
```

### 状態と置き場所

| `status` | 置き場所 | 意味 |
|---|---|---|
| `queued` | `queue/` | 未着手 |
| `in_progress` | `queue/`のまま | 着手済み。2026-11-08の改訂で`claimed/`は使わない。誰が持っているかはD1の`bridge_job_locks`で見る |
| `done` | `done/` | 成功 |
| `failed` | `done/` | 失敗。`.md`に理由・終了コード・ログの要約・再試行できるか |
| `cancelled` | `done/` | 中止。`.md`に誰が・なぜ・どこまで進んだか |

`done/`は「終わったもの」の置き場で、成功・失敗・中止を`status`で区別する。

## 5. 着手・書き戻し・再実行の手順（2026-11-08改訂: ロックはD1）

**対象**: 本体コンテナのCLI（Claude Code・Codex）がジョブを扱う手順と、D1`agent-inquiries`のロックの表`bridge_job_locks` — 二重着手と結果の無い完了を防ぎ、muse-vmの再起動やSSHの不通をまたいでも続きから片付けられるようにする。

### 改訂の理由

2026-11-07の案は、`queue/`から`claimed/`へのrenameで取り合いを決め、期限切れを回収役1つが`queue/`へ戻すものだった。Codexのレビュー（2026-11-08）で、次の穴が挙がった。

- renameした後、JSONに所有者と期限を書く前に止まると、所有者の分からないジョブが残る。
- 期限の判定がmuse-vmの時計に頼る。muse-vmは2026-11-07〜08に3回以上再起動した（23:03:52、00:23:47、00:38:49 UTC）。
- 取る・延長する・完了にする、のすべてがSSHのファイル操作で、SSHが届かないと全体が止まる（00:45 UTCに再起動の直後で30秒の時間切れを実測。00:5x UTCには読めた）。
- 前の実行者が残っていても、後から取った者と見分ける印（`claim_token`）が無い。

**利用者の指示（2026-11-08）で、ロックをD1に置く。** 行は最初にジョブを依頼した側が作る。Museはロックに関わらない。ロックがあって結果が無く、期限が切れていれば、再実行する。

### 役割

| 主体 | すること |
|---|---|
| 依頼した側（AIチャットのWorker、本体コンテナのCLI） | Museへ依頼し、`bridge job id`が分かった時点で`bridge_job_locks`に行を作る |
| Muse | 今までどおり`queue/`へジョブのファイルを置く。ロックには触れない |
| 本体コンテナのCLI | `queue/`をSSHで読み、D1でロックを取り、実行し、結果を書き、D1で完了にする |

行は依頼した側だけが作る。`queue/`にあってD1に行が無いジョブは、CLIは取らずにログに残し、依頼した側に行の作成を任せる（依頼した側は、`bridge job id`の行を拾えなかったときに作り直す）。

### ロックの表（案。未適用）

```sql
CREATE TABLE IF NOT EXISTS bridge_job_locks (job_id TEXT PRIMARY KEY, created_by TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'claimed', 'done', 'failed', 'cancelled')), claim_token TEXT, claimed_by TEXT, claimed_at INTEGER, lease_until INTEGER, attempts INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 3, result_path TEXT, result_sha256 TEXT, last_error TEXT, created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)), updated_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)));
```

時刻はすべてD1の時計のepoch秒で書く（`CAST(strftime('%s','now') AS INTEGER)`）。muse-vmやコンテナの時計を使わない。

### 着手

状態を変えた者（取った、延長した、完了にした、`failed`・`cancelled`にした）が、**同じD1のバッチで**7章の`bridge_job_events`に1行書く。ロックの表は最新の状態だけを持つので、途中の経過は履歴の表で追う。履歴の番号は`AUTOINCREMENT`で振り、同時に書いても衝突しない。同期役は履歴を書かない。REST APIのバッチが途中で失敗したときに前の文が戻るかは未確認なので、実装時にテストで確かめる（11章）。

1. SSHで`queue/<id>.json`を読む。読めなければ取らない（期限だけ進むのを避ける）。
2. 実行ごとに新しい`claim_token`（UUID）を作り、1文で取る。

```sql
UPDATE bridge_job_locks SET status = 'claimed', claim_token = ?1, claimed_by = ?2, claimed_at = CAST(strftime('%s','now') AS INTEGER), lease_until = CAST(strftime('%s','now') AS INTEGER) + ?3, attempts = attempts + 1, updated_at = CAST(strftime('%s','now') AS INTEGER) WHERE job_id = ?4 AND attempts < max_attempts AND result_path IS NULL AND (status = 'queued' OR (status = 'claimed' AND lease_until <= CAST(strftime('%s','now') AS INTEGER)));
```

3. 応答の`meta.changes`が1なら取れた。0なら取らずに止める。0の理由（行が無い、終わっている、期限内、上限に達した）は断定しない。
   - **応答が返らなかったとき**（D1は更新したが通信が切れた可能性がある）は、実行を始めない。`SELECT claim_token, status FROM bridge_job_locks WHERE job_id = ?`で、自分の`claim_token`が入っていれば取れている。入っていなければ取れていない。
4. `attempts`は取ったときに増やす（同じ日の設計相談`job-queue-design-20261107-4ec8c0c5`の結論と同じ）。

### 実行中

- 期限の延長は`claim_token`と期限内であることを条件にする: `UPDATE bridge_job_locks SET lease_until = CAST(strftime('%s','now') AS INTEGER) + ?1, updated_at = CAST(strftime('%s','now') AS INTEGER) WHERE job_id = ?2 AND claim_token = ?3 AND status = 'claimed' AND lease_until > CAST(strftime('%s','now') AS INTEGER);`
- 期限内は`lease_until > 今`、期限切れは`lease_until <= 今`で、着手・延長・完了の境界を揃える。
- `changes`が0なら、結果を書かずに止める（期限が切れた、ほかの者に取られた、など。理由は断定しない）。

### 書き戻し

1. 結果を`done/<id>.<claim_token>.md.tmp`に書き、`done/<id>.<claim_token>.md`へrenameする。**名前に`claim_token`を入れるので、前の実行者と後の実行者が同じファイルを書かない**。
2. D1で完了にする: `UPDATE bridge_job_locks SET status = 'done', result_path = ?1, result_sha256 = ?2, updated_at = CAST(strftime('%s','now') AS INTEGER) WHERE job_id = ?3 AND claim_token = ?4 AND status = 'claimed' AND lease_until > CAST(strftime('%s','now') AS INTEGER);`
   - 応答が返らなかったときは、着手と同じく`SELECT`で、`status = 'done'`かつ自分の`result_path`になっているかを確かめる。
3. `changes`が1なら、`queue/<id>.json`に`status: done`・`completed_at`・`result_path`を書き、`done/<id>.json`へ移す（ファイル側の記録。正はD1）。
4. `changes`が0なら完了にできていない。書いた`.md`は消さずに残し、ログに書く（後から取った者の結果と見比べられる）。
5. **D1で完了にした後、ファイル側を直す前に止まった場合**: 次に見たCLIは、D1が`done`で`queue/<id>.json`が残っていれば、D1の`result_path`を使ってファイル側（3.）だけを直す。**再実行しない**。

### 再実行（利用者の方針）

- **ロックがあって結果が無く、期限が切れていれば、次に見たCLIが取り直して再実行する。** 着手の`UPDATE`の条件（`status = 'claimed' AND lease_until <= 今`）がそのまま再実行の条件になる。回収役は置かない。
- 期限内は待つ。前の実行がまだ動いている可能性がある。
- `attempts`が`max_attempts`に達して期限が切れたら、見つけた者が1文で`failed`にする: `UPDATE bridge_job_locks SET status = 'failed', last_error = ?1, updated_at = CAST(strftime('%s','now') AS INTEGER) WHERE job_id = ?2 AND status = 'claimed' AND result_path IS NULL AND attempts >= max_attempts AND lease_until <= CAST(strftime('%s','now') AS INTEGER);`（無条件に書くと、期限内の延長や完了を上書きする）
- 「結果が無い」は、D1の`result_path`が空であること。`done/`に残った`.md`（完了にできなかった実行の結果）は結果に数えず、再実行した後に見比べる材料にする。
- 期限が切れた前の実行が、まだ動いていることはある。延長と完了は期限内の条件で拒まれるので、D1の状態は壊れない。ただし、二重に実行された分の課金は防げない。
- このキューのジョブは調査と回答の作成が主で、再実行の損失は主に二重の課金。外部へ書き込むジョブを扱うときは、再実行してよいかを別に決める（10章）。

### 中止

- 中止は人が決める。`UPDATE bridge_job_locks SET status = 'cancelled', last_error = ?1, updated_at = CAST(strftime('%s','now') AS INTEGER) WHERE job_id = ?2 AND status IN ('queued', 'claimed');`
- 実行中のCLIは、次の延長が`changes = 0`になるので止まる。中止の前に送った外部への操作は取り消せない。

### SSHが届かないとき

- 取らない。取った後に届かなくなったら、延長もしない。期限が切れれば、次に届いた者が再実行する。
- muse-vmの再起動の直後は、tailscaledが戻るまで（2026-11-08 00:38:49の起動では約6分）SSHが拒否される。

## 6. AIチャットからの依頼とjob idの対応

**対象**: AIチャットの入力窓（`/api/aichat`のMuse経路）、本体D1の`ai_chat_shares` — 利用者の依頼とジョブを後から結べるようにする。

1. Museは、bridgeの応答の**1行目**に`bridge job id: \`<32桁16進>\``を出す（協議の回答で実際にこの形を返した）。
2. Workerは、Museの応答からこの行を拾い、`ai_chat_shares`の新しい列`bridge_job_id`へ保存する。本文からこの行を消すかは決めること（10章）。
3. 同期役は、`bridge_jobs.ai_chat_share_id`に`ai_chat_shares.id`を書く。`ai_chat_shares`は本体のD1、`bridge_jobs`は`agent-inquiries`にあり、**データベースをまたぐので外部キーは張れない**。値で結び、同期役が両方の存在を確かめる。

## 7. D1のデータ構造（`agent-inquiries`に足す案）

**対象**: ジョブ・状態の履歴・Museとの問い合わせ・知見の結び方 — 利用者の問い「ジョブ用のテーブルを作り、Museとの会話とはそのIDを外部キーで結ぶか、ほかに良い案はあるか」への答え。

### 結び方の比較

| 案 | 形 | 長所 | 短所 |
|---|---|---|---|
| A. 外部キー1本 | `inquiry_entries.job_id`→`bridge_jobs.job_id` | 単純。1つの問い合わせがどのジョブのものかすぐ分かる | 1つの問い合わせが複数のジョブに関わる、1つのジョブに複数の問い合わせがある、を表せない。役割（発端か、続きか）も持てない |
| **B. 対応表（推奨）** | `inquiry_job_links(entry_id, job_id, role)` | 多対多と役割（`origin`・`related`・`followup`・`supersedes`）を持てる。既存の`inquiry_entries`を変えない | 表が1つ増える |
| C. Bに状態の履歴を足す | `bridge_job_events`（ジョブごとの連番） | 誰が・いつ取り、何度やり直したかを後から測れる。「どの手が無駄だったか」の集計に使える | 同期役が履歴を書く必要がある |

**推奨はB＋C**（Museも賛成）。Aは、問い合わせとジョブが常に1対1と決まるなら足りるが、今回のケースでも1件のジョブ（キューの作成）に2件の問い合わせが付いており、すでに1対1ではない。

### テーブル案（未適用。適用するときにこのSQLを使う）

```sql
CREATE TABLE IF NOT EXISTS bridge_jobs (
  job_id TEXT PRIMARY KEY CHECK (length(job_id) = 32),
  schema_version INTEGER NOT NULL DEFAULT 1,
  origin TEXT NOT NULL DEFAULT 'api-bridge',
  ai_chat_share_id TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('queued', 'in_progress', 'done', 'failed', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  claimed_by TEXT,
  claimed_at TEXT,
  lease_until TEXT,
  request_summary TEXT,
  queue_path TEXT,
  result_summary TEXT,
  result_path TEXT,
  error TEXT,
  exit_code INTEGER,
  source_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_bridge_jobs_status ON bridge_jobs(status, priority);
CREATE INDEX IF NOT EXISTS idx_bridge_jobs_share ON bridge_jobs(ai_chat_share_id) WHERE ai_chat_share_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS bridge_job_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL REFERENCES bridge_jobs(job_id) ON DELETE CASCADE,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('queued', 'claimed', 'heartbeat', 'requeued', 'completed', 'failed', 'cancelled', 'note')),
  body TEXT
);
CREATE INDEX IF NOT EXISTS idx_bridge_job_events_job ON bridge_job_events(job_id, id);
CREATE TABLE IF NOT EXISTS inquiry_job_links (
  entry_id TEXT NOT NULL REFERENCES inquiry_entries(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES bridge_jobs(job_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('origin', 'related', 'followup', 'supersedes')),
  PRIMARY KEY (entry_id, job_id, role)
);
CREATE INDEX IF NOT EXISTS idx_inquiry_job_links_job ON inquiry_job_links(job_id);
CREATE TABLE IF NOT EXISTS bridge_job_knowledge (
  job_id TEXT NOT NULL REFERENCES bridge_jobs(job_id) ON DELETE CASCADE,
  knowledge_id TEXT NOT NULL REFERENCES inquiry_knowledge(id) ON DELETE CASCADE,
  PRIMARY KEY (job_id, knowledge_id)
);
ALTER TABLE inquiry_knowledge ADD COLUMN title TEXT;
ALTER TABLE inquiry_knowledge ADD COLUMN tags TEXT;
ALTER TABLE inquiry_knowledge ADD COLUMN confidence TEXT CHECK (confidence IN ('measured', 'answered', 'inferred'));
ALTER TABLE inquiry_knowledge ADD COLUMN created_from_job_id TEXT REFERENCES bridge_jobs(job_id) ON DELETE SET NULL;
```

本体のD1（`ai_chat_shares`）に足す列:

```sql
ALTER TABLE ai_chat_shares ADD COLUMN bridge_job_id TEXT;
```

- 依頼の全文（`messages`）は大きいので、D1には要約（`request_summary`）とキューのパス（`queue_path`）を置く。
- 同期の再試行で二重に登録しないよう、`job_id`を主キーにし、キューのJSONのハッシュ（`source_hash`）で差分を見る。
- 知見は結果の写しではなく、抽出・整理したもの（`title`・`summary`に当たる`text`・`tags`・`confidence`）にする。

## 8. 知見を貯める流れ

**対象**: 本体コンテナのCLIがジョブを片付けるときに、D1へ何を書くか — 次のジョブで問い合わせや手探りを省けるようにする。

1. 同期役がキューを読み、`bridge_jobs`（検索用の写し）へ追加・更新する。状態の正は5章の`bridge_job_locks`で、`bridge_jobs`の状態の列はそれを写したもの。状態の履歴（`bridge_job_events`）は、状態を変えた者が5章の手順で書く。
2. CLIが着手し、必要ならMuseへ問い合わせる。問い合わせは[問い合わせの記録の手順](SPEC.cloudflare-workers-github-oauth-1.20261107.muse-inquiry-recording.md)どおり`inquiry_entries`に書き、`inquiry_job_links`でジョブと結ぶ（発端は`origin`、続きは`followup`）。
3. 完了したら、結果から次に使える事実を`inquiry_knowledge`へ書き、`bridge_job_knowledge`で結ぶ。実測で確かめたものは`confidence: measured`、回答だけのものは`answered`。
4. 解決後に、予備知識で何手省けたかを判定する（既存の`inquiry_case_review`・`inquiry_knowledge_effect`）。

## 9. 進め方（順序）

**対象**: キュー・Worker・D1を変える順序 — 古い読み手を壊さない。

1. **利用者が10章の「決めること」を決める。**
2. Museが、READMEと`queue-job.sh`を更新し、`schema_version: 1`と追加の項目を後方互換で足す。応答の1行目に`bridge job id:`を出す。
3. 5章のロックの表をD1に作る（`claimed/`は使わない。キューのファイルの形は変えない）。
4. 本体側: D1に7章のテーブルを作る（`agent-inquiries`は利用者がSQLを実行する）。`ai_chat_shares.bridge_job_id`を足す。
5. 本体コンテナ側: 同期役と、CLIの取り出し・書き戻しの手順（スクリプト）を作る。テストを先に書く。
6. ダミーのジョブ1件で、取得・実行・書き戻し・D1への反映を通す。
7. 両方で確かめたら、古い形式の読み取りをやめる。

## 10. 決めたこと・決めること（利用者）

| 項目 | 結果 |
|---|---|
| Museのメインチャットも消費者にするか | **しない**。取り出すのは本体コンテナのCLIだけ（2026-11-08決定）。`target`・`assignee`は足さない |
| 期限切れの回収役 | **置かない**。期限が切れたら、次に見たCLIが取り直す（2026-11-08、利用者の指示） |
| ロックの置き場所 | **D1の`bridge_job_locks`**。最初の依頼者が行を作り、Museは関わらない（2026-11-08、利用者の指示） |
| `bridge job id:`の行をAIチャットの表示から消すか | **消す**。Workerが拾ってD1に保存し、回答の吹き出しにリンクとして出す（2026-11-08決定） |
| `lease_until`の長さ・`max_attempts` | **30分・3回**（2026-11-08決定） |
| D1の結び方 | **7章のB＋C**（`inquiry_job_links`と`bridge_job_events`）（2026-11-08決定） |
| **ジョブの入れ方** | **依頼した側がD1に直接入れる**（2026-11-08決定）。12章。muse-vmのキューとSSHは使わない |
| 本体コンテナのCLIの起動のしかた | **まず手動で1件ずつ**（「キューを確認して」と頼まれたときに`run-once`）（2026-11-08決定）。定期実行は、課金と権限を少ないジョブで確かめてから決める |
| 外部へ書き込むジョブ（PRの作成、デプロイ、メールなど）も期限切れで再実行してよいか | **しない**（2026-11-08決定）。そうしたジョブは`max_attempts = 1`で登録し、期限切れは`failed`にして、人が外部の状態を確かめてから再実行を決める |
| READMEの書き直しと時刻の統一（`bjw-p1`・`bjw-p2`） | 見送り（2026-11-08）。12章の決定で、本体コンテナのCLIはmuse-vmのキューを使わなくなったため |

## 11. 未確認

- **（2026-11-08に実測）キューは今は使われていない。** READMEは「新しいbridgeジョブが届いたら、応答する前にキューへ写す」と書くが、`queue/`は空で、直前のジョブ（`3602e565…`）も、この協議の質問（`a8df60d3…`。応答の1行目にjob id行が出た）も写されていない。Museから本体コンテナへ新着を知らせる手段も無い。**誰がどうやってキューへ入れるかを決めるまで、取り出す側を作っても動かない**（D1の未確認キー`u-feed`）。
- 本体コンテナからキューへの**書き込み**（rename・`.md`の作成）。読み取りだけを実測した（2026-11-07と2026-11-08）。ディレクトリは`drwxrws--- root`で、rootなら書けるはず。
- D1のREST APIの応答で`meta.changes`が条件付き`UPDATE`の結果を正しく返すこと（実装時にテストで確かめる）。
- Codex CLIからの`tailscale ssh`（Codexのsandboxから使えるか）。
- Museが`queue-job.sh`で写さない場合（「読み取りのみ」と指示した問い合わせは写さなかった）の扱い。
- 自動で見に行く仕組み。Museのメインチャットは今は自動では見ない。

## 12. 2026-11-08の改訂: 依頼した側がジョブをD1に入れる

**対象**: ジョブの入り口と中身の置き場所 — muse-vmの`queue/`が実際には使われていなかったこと（11章）を受け、利用者が決めた形。**この章は、2〜6章のうちmuse-vmのキューとSSHに関わる記述に優先する。**

### 理由

- Museは、READMEの「新しいbridgeジョブが届いたら応答の前にキューへ写す」を守っていなかった（`queue/`は空。2026-11-08に実測）。Museの判断で写す方式では、写し漏れが起きる。
- Museから本体コンテナへ新着を知らせる手段も無い。
- ロックについては、既に「依頼した側が行を作り、Museは関わらない」と決めている。同じ考え方を、依頼の中身にも広げる。

### 流れ

| 段 | 主体 | すること |
|---|---|---|
| 1 | 依頼した側（AIチャットのWorker、本体コンテナのCLI） | `bridge_jobs`（依頼の本文`request_text`、出どころ、`ai_chat_share_id`）と`bridge_job_locks`の行を、同じバッチで作る。外部へ書き込むジョブは`max_attempts = 1` |
| 2 | 本体コンテナのCLI | 頼まれたときに`run-once`で1件取る（5章の条件付き`UPDATE`）。依頼の本文はD1から読む。**SSHは使わない** |
| 3 | 本体コンテナのCLI | 実行し、結果を`bridge_jobs.result_text`（とハッシュ）に書き、5章の条件付き`UPDATE`で完了にする。状態の変化は同じバッチで`bridge_job_events`に書く |
| 4 | 利用者 | AIチャットや`/muse-inquiries`から結果を見る |

- 5章の「SSHで`queue/<id>.json`を読む」「`done/<id>.<claim_token>.md`に書く」「ファイル側を直す」は使わない。ロックの条件（期限、`claim_token`、`attempts`）はそのまま使う。
- 結果の本文が大きいときは、D1の1行の上限に収まるよう、実装時に上限を決める（未確認）。
- Museとmuse-vmのキューは、この流れには関わらない。Museに相談したいジョブは、CLIがこれまでどおり`muse_prompt`で問い合わせる。

### テーブル（実装した形。7章の`bridge_jobs`の案と、5章のロックの表に優先する）

正は`/root/lib`（`nekoserver/lib`）の`claude/ops/bridge_jobs_schema.sql`で、このリポジトリの`migrations-agent-inquiries/0009_create_bridge_jobs.sql`はその写し。**2026-11-08に本番のD1`agent-inquiries`へ適用した**（テーブル4つ、索引3つ、トリガー2つ）。

| 表 | 持つもの |
|---|---|
| `bridge_jobs` | 依頼の本文`request_text`、出どころ、依頼者、`ai_chat_share_id`、外部へ書き込むか（`external_write`）。状態は持たない |
| `bridge_job_locks` | 状態の正。5章のロックの表と同じ（`cancelled`を含む） |
| `bridge_job_results` | 結果の本文とsha256を`(job_id, claim_token)`ごとに保存する。上書きしない。完了にしたロックの`result_path`は`bridge_job_results:<claim_token>` |
| `bridge_job_events` | 状態の履歴。**ロックの表のトリガーが書く**（行を作ると`queued`、状態か`claim_token`が変わると`claimed`・`released`・`completed`・`failed`・`cancelled`）。状態の変更と同じ文の中で書かれるので、片方だけ残ることはない |

- 結果は、期限内で自分が持っているときだけ保存し（条件付きの`INSERT … SELECT … WHERE EXISTS`）、その後で完了にする。保存と完了の間に期限が切れると、結果だけが残る。残った結果は、取り直した者の結果と見比べる材料にする。
- 実行に失敗したら、上限に達していれば`failed`、まだなら`queued`に戻す（`release`）。
- 外部へ書き込むジョブは`max_attempts = 1`で登録する（`register --external`）。

### 実装（`nekoserver/lib`の`claude/ops/bridge_jobs.py`）

| コマンド | すること |
|---|---|
| `register` | 依頼の本文を標準入力から読み、`bridge_jobs`と`bridge_job_locks`の行を作る。同じ`job_id`で2回呼んでも上書きしない |
| `run-once --executor claude\|codex` | 期限が切れて上限に達したものを`failed`にし、取れる最も古い1件を取る。依頼の本文を標準入力で子プロセスに渡し、5分ごとに期限を延ばす。延ばせなければ子を止める。結果を保存して完了にする |
| `list` | 直近50件の状態 |
| `cancel` | 人が中止する |

- 子プロセスに渡す環境変数は`PATH`・`HOME`・`LANG`など10個だけ。トークン・秘密の値・アカウントIDは渡さない。
- テスト（`claude/test/bridge_jobs_test.py`、17件）は、D1の代わりにSQLiteで本番と同じSQLを流す。取り合い、期限の境目、古い`claim_token`の拒否、応答が返らないときの照会、上限での`failed`、中止、トリガーの履歴、子の停止を確かめる。条件を1つ外すとテストが失敗することも確かめた（期限内の条件、結果が無い条件）。
- D1のREST APIで応答が返らなかったとき（`D1Unknown`）は、取る・完了にするの成否を、自分の`claim_token`が入っているかで判断する。
- 変更件数は1件以上で判定する（対象は主キー1行。D1の`meta.changes`がトリガーで書いた行を含む場合に備える）。
- `--executor claude`は、`claude-helper.sh`と同じ順でネイティブのClaude Codeを探す（`/opt/node22/bin/claude`はスタブで動かない）。

### 本番で1件流した結果（2026-11-08）

`register`で「今日の日付をUTCで答えて」を入れ、`run-once --executor codex`で実行した（job `614f66bf5ab2413f8deace62c7aa7dcc`）。

| 項目 | 結果 |
|---|---|
| 所要 | 5秒 |
| ロック | `done`、1回目、`codex@cf-demo-container-1` |
| 結果 | `2026-11-08`（UTCの日付と一致）、終了コード0、sha256はロックと結果で一致 |
| 履歴（トリガー） | `queued` → `claimed`（attempt 1）→ `completed` |

続けて`run-once --executor claude`でも1件流した（「1から5の合計」、job `db5691368eca46e2986e43407cce7ab1`）。7秒で`done`、結果`15`、履歴は同じ3行。子プロセスには限られた環境変数だけを渡したが、Claude Codeは`HOME`の下の資格情報で認証できた。

未確認: 長いジョブでの期限の延長、外部へ書き込むジョブ、AIチャットのWorkerからの登録（実装の順序の4）。

### 実装の順序（案。Codexの計画`bridge-jobs-queue-20261107-c3`を12章の決定に合わせたもの）

1. 失敗するテストを先に書く: 同時に取ったときに勝つのは1件だけ、期限ちょうどでの取り直し、期限後・古い`claim_token`での延長・完了の拒否、上限に達したときの`failed`、応答が返らなかったときの照会、状態の更新と履歴の片方だけが残らないこと。
2. `migrations-agent-inquiries/`に`bridge_jobs`（`request_text`・`result_text`を足す）・`bridge_job_locks`・`bridge_job_events`を足す。本番への適用は利用者の確認の後。
3. 本体コンテナ側: `/root/lib`に`bridge_jobs.py`（`register`・`run-once`）。D1の操作は親プロセスで行い、Claude Code・Codexには認証情報を渡さない。
4. AIチャットのWorker側の登録（`register`の相当）は、1〜3を確かめた後。


## 13. AIチャットからジョブを積む（案。利用者の承認待ち）

**対象**: `/aichat`のMuseの経路（`src/utils/museDirectAsk.ts`・`src/utils/aichatSlashCommand.ts`の`interpretMusePrompt`）と、D1`agent-inquiries`の`bridge_jobs`・`bridge_job_locks` — AIチャットでMuseに普通の文章で頼み、本体コンテナで片付けるべきものはMuseの判断でジョブとして積む。

### 利用者の指示（2026-11-08）

- AIチャットの既定でMuseに普通の文章で頼めるので、専用のコマンドは作らない。積むかどうかはMuseが判断する。
- スラッシュで始まる入力は特殊なので、渡し方を工夫する。
- 実装は、SPECを書いて承認を受けてから行う。

### 流れ（案）

| 段 | 主体 | すること |
|---|---|---|
| 1 | Worker | Museへの要求に、決まりを**システムメッセージ**で足す。利用者の本文は変えない。`/`で始まる入力（`/status`などmuse-vmのネイティブコマンド）には足さない |
| 2 | Muse | 本体コンテナで片付けるべき依頼（ファイルの変更・作成、コードの調査・実装、長時間・多段階の作業）と判断したら、回答の**1行目**に`[[bridge-job]]`とだけ書く。読み取りのみの質問や短く終わる依頼には付けない |
| 3 | Worker | 1行目が印なら、印を消し、**利用者の元の依頼文**を`bridge_jobs`と`bridge_job_locks`に1つのbatchで登録する（`origin = 'aichat'`、依頼者は利用者）。回答の末尾に「📋 ジョブとして積みました: `<job id>`」を添える。1行目以外の印は本文として扱う。ネイティブコマンドの応答（`bridge_command`）は対象にしない |
| 4 | 本体コンテナ | `bridge_jobs.py`で片付ける（実行のしかたは「決めること」） |

- 決まりの置き場所は、Museの回答（2026-11-08）で「呼び出し側が毎回送るシステムメッセージが最も確実」とされた。
- 送り先の`server.js`は本文を加工せずに中継するので、コンテナの再ビルドは要らない（`containers/demo/server.js`で確認）。

### 影響

- AGENTS.mdの「Muse選択の通常入力はコマンドへ変換せず本文のまま実行する」: 本文は変えないが、システムメッセージを1つ足す。これを「本文のまま」に含めてよいかを利用者が決める。
- 既存のテスト5件（`src/aichat-askmuse-integration.test.ts`）は、Museへの**最初の**メッセージが本文であることを確かめている。承認されたら、「利用者のメッセージが本文そのもの」を確かめる形に先に直す。
- 2026-11-08に作りかけた`/neko job_prompt="…"`（コミット`f0819fbb`、未push）は取り消す。D1への登録の部品（`registerBridgeJob`）は残して使う。

### 決めること（利用者）

| 項目 | 案 |
|---|---|
| この方式で進めるか | 進める |
| 対象の経路 | Muse選択の通常入力と`/askmuse prompt="…"`（同じ処理）。`/neko askgk muse_prompt="…"`（tunnels経由）は対象外 |
| 外部へ書き込むジョブ（PR作成など） | 印を分ける（`[[bridge-job:external]]`なら試す回数を1回にする） |
| 積んだジョブの実行 | 今は手動（`run-once`）。自動にするなら、本体コンテナに常駐の見張り役を置き、30秒ごとにD1を見て1件ずつ片付ける（同時に1件、1件あたり最長3時間） |
