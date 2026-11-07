# SPEC: AIチャットからMuseに依頼したジョブを、本体コンテナのCLIが片付けて知見を貯める

作成日: 2026-11-07
状態: **案**（Museと協議済み。採否と実装は利用者が決める。キュー・D1ともまだ変更していない）

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
| 同期役（本体コンテナ） | キューを読み、D1へ履歴と知見を反映する | D1（MuseはD1に書けない） |

- 消費者は本体コンテナのCLIに寄せる。Museのメインチャットも取り出すなら、キューに`target`（`muse-main`・`claude-code`・`codex`・`any`）と`assignee`を足し、`any`だけを先着で取る。
- **正の分け方**: 運用の正はキューのファイル、履歴と検索の正はD1。

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
| `in_progress` | `claimed/` | 着手済み。`claimed_by`・`claimed_at`・`lease_until`を持つ |
| `done` | `done/` | 成功 |
| `failed` | `done/` | 失敗。`.md`に理由・終了コード・ログの要約・再試行できるか |
| `cancelled` | `done/` | 中止。`.md`に誰が・なぜ・どこまで進んだか |

`done/`は「終わったもの」の置き場で、成功・失敗・中止を`status`で区別する。

## 5. 着手・書き戻し・回収の手順

**対象**: 本体コンテナのCLIがジョブを扱う手順 — 二重着手と、結果の無い完了を防ぐ。

### 着手

1. `ls queue/`で未着手を見る。`target`が自分か`any`のものだけを候補にする。
2. `mv queue/<id>.json claimed/<id>.json`（同じファイルシステム内のrenameで原子的）。失敗したら、ほかの者が取ったので次へ。
3. 取った後にJSONへ`status: in_progress`・`claimed_by`（例: `claude-code@cf-demo-container/run-<id>`）・`claimed_at`・`lease_until`を書く。**取り合いの判定はrenameで、項目は記録**。
4. 実行中は`lease_until`を延長する（ハートビート）。

### 書き戻し（この順で行う）

1. `done/<id>.md.tmp`に結果を書く。
2. `done/<id>.md`へrenameする。
3. JSONに`status`・`completed_at`・`result_summary`・`result_path`・`exit_code`を書き、`claimed/<id>.json`を`done/<id>.json`へ移す。**JSONの移動が完了の合図**。

### 期限切れの回収

- 回収役は1つだけに決める（候補: 本体コンテナの同期役）。複数で回収すると再び競合する。
- 回収は`claimed/`から`queue/`へ戻し、`status: queued`、`attempts`を1増やし、`last_error`に「期限切れで回収」を書く。
- 回収した直後に`failed`にしない。`failed`は実行者が明示したとき、または`attempts`が`max_attempts`に達したときだけ。

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
3. `claimed/`の新設など破壊的な変更は、キューを空にしてから切り替える。
4. 本体側: D1に7章のテーブルを作る（`agent-inquiries`は利用者がSQLを実行する）。`ai_chat_shares.bridge_job_id`を足す。
5. 本体コンテナ側: 同期役と、CLIの取り出し・書き戻しの手順（スクリプト）を作る。テストを先に書く。
6. ダミーのジョブ1件で、取得・実行・書き戻し・D1への反映を通す。
7. 両方で確かめたら、古い形式の読み取りをやめる。

## 10. 決めること（利用者）

| 決めること | 案 |
|---|---|
| Museのメインチャットも消費者にするか | しない（本体コンテナのCLIだけ）を推奨。する場合は`target`で振り分ける |
| 期限切れの回収役 | 本体コンテナの同期役 |
| 同期役の動かし方 | 手動（「キューを確認して」と頼まれたとき）から始め、定期実行は後で決める |
| `bridge job id:`の行をAIチャットの表示から消すか | 消して、回答バブルにリンクとして出す |
| `lease_until`の長さ・`max_attempts` | 30分・3回 |
| D1の結び方 | 7章のB＋C |

## 11. 未確認

- 本体コンテナからキューへの**書き込み**（rename・`.md`の作成）。今回は読み取りだけを実測した。ディレクトリは`drwxrws--- root`で、rootなら書けるはず。
- Codex CLIからの`tailscale ssh`（Codexのsandboxから使えるか）。
- Museが`queue-job.sh`で写さない場合（「読み取りのみ」と指示した問い合わせは写さなかった）の扱い。
- 自動で見に行く仕組み。Museのメインチャットは今は自動では見ない。
