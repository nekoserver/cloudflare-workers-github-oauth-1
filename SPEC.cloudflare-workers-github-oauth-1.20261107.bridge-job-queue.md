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

- 消費者は本体コンテナのCLIに寄せる。Museのメインチャットも取り出すなら、キューに`target`（`muse-main`・`claude-code`・`codex`・`any`）と`assignee`を足し、`any`だけを先着で取る。
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
  "target": "claude-code",
  "assignee": null,
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
CREATE TABLE IF NOT EXISTS bridge_job_locks (job_id TEXT PRIMARY KEY, created_by TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'claimed', 'done', 'failed')), claim_token TEXT, claimed_by TEXT, claimed_at INTEGER, lease_until INTEGER, attempts INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 3, result_path TEXT, result_sha256 TEXT, last_error TEXT, created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)), updated_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)));
```

時刻はすべてD1の時計のepoch秒で書く（`CAST(strftime('%s','now') AS INTEGER)`）。muse-vmやコンテナの時計を使わない。

### 着手

状態が変わったら（取った、完了にした、`failed`にした）、7章の`bridge_job_events`に1行書く。D1のロックの表は最新の状態だけを持つので、途中の経過は履歴の表で追う。

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

- **ロックがあって結果が無く、期限が切れていれば、次に見たCLIが取り直して再実行する。** 着手の`UPDATE`の条件（`status = 'claimed' AND lease_until < 今`）がそのまま再実行の条件になる。回収役は置かない。
- 期限内は待つ。前の実行がまだ動いている可能性がある。
- `attempts`が`max_attempts`に達して期限が切れたら、見つけた者が1文で`failed`にする: `UPDATE bridge_job_locks SET status = 'failed', last_error = ?1, updated_at = CAST(strftime('%s','now') AS INTEGER) WHERE job_id = ?2 AND status = 'claimed' AND result_path IS NULL AND attempts >= max_attempts AND lease_until <= CAST(strftime('%s','now') AS INTEGER);`（無条件に書くと、期限内の延長や完了を上書きする）
- 「結果が無い」は、D1の`result_path`が空であること。`done/`に残った`.md`（完了にできなかった実行の結果）は結果に数えず、再実行した後に見比べる材料にする。
- 期限が切れた前の実行が、まだ動いていることはある。延長と完了は期限内の条件で拒まれるので、D1の状態は壊れない。ただし、二重に実行された分の課金は防げない。
- このキューのジョブは調査と回答の作成が主で、再実行の損失は主に二重の課金。外部へ書き込むジョブを扱うときは、再実行してよいかを別に決める（10章）。

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
  target TEXT,
  assignee TEXT,
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
  job_id TEXT NOT NULL REFERENCES bridge_jobs(job_id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('queued', 'claimed', 'heartbeat', 'requeued', 'completed', 'failed', 'cancelled', 'note')),
  body TEXT,
  PRIMARY KEY (job_id, seq)
);
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

1. 同期役がキューを読み、`bridge_jobs`へ追加・更新し、状態の変化を`bridge_job_events`に書く。
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
| 同期役の動かし方 | 未定。案は、手動（「キューを確認して」と頼まれたとき）から始め、定期実行は後で決める |
| 外部へ書き込むジョブ（PRの作成、デプロイ、メールなど）も期限切れで再実行してよいか | 未定。案は、しない。そうしたジョブは`max_attempts = 1`で登録し、期限切れは`failed`にして人が判断する |
| READMEの書き直しと時刻の統一（`bjw-p1`・`bjw-p2`） | 未定。muse-vmのファイルの変更なので、承認後にメインのチャットで依頼する。案はD1の提案の本文 |

## 11. 未確認

- 本体コンテナからキューへの**書き込み**（rename・`.md`の作成）。読み取りだけを実測した（2026-11-07と2026-11-08）。ディレクトリは`drwxrws--- root`で、rootなら書けるはず。
- D1のREST APIの応答で`meta.changes`が条件付き`UPDATE`の結果を正しく返すこと（実装時にテストで確かめる）。
- Codex CLIからの`tailscale ssh`（Codexのsandboxから使えるか）。
- Museが`queue-job.sh`で写さない場合（「読み取りのみ」と指示した問い合わせは写さなかった）の扱い。
- 自動で見に行く仕組み。Museのメインチャットは今は自動では見ない。
