# SPEC: 試験運用の段階に入った議題をRedmineから読めるようにする

作成日: 2026-11-08
状態: **案**（構想。利用者の承認待ち。D1・Redmineともまだ変更していない）

関連: D1`agent-inquiries`の議題`trial-redmine-20261108`（問い合わせ`trm-e0`・`trm-e1`）、[発議のルールと8段の過程](SPEC.cloudflare-workers-github-oauth-1.20261108.proposal-rule.md)（7章、8段目が試験運用）、[RedmineのR9の構成](REPORT.cloudflare-workers-github-oauth-1.REDMINE-R9.20261024.md)、`src/utils/redmineProxy.ts`（RedmineへのHMAC付きの中継）。

## 1. 目的

**対象**: D1`agent-inquiries`の議題（`inquiry_cases`）のうち、段階（`stage`）が試験運用（`trial`）のもの、RedmineのR9（`https://r9.nekomaneki.work`、Redmine 7.0.2、REST API有効） — 試験運用の議題と、その確認項目・結果を、Redmineのチケットとして読めるようにする。そのための記録の形をD1に足す。

### 背景

- 利用者の提案（2026-11-08）: 試験運用段階に入ったらRedmineから読み出せるようなデータ構成を考えて、それ用の記録方式も考えてほしい。
- 今の試験運用の記録は`inquiry_entries`の自由な文（`answer`・`progress`）だけで、「何を確かめれば終わりか」「どれが済んだか」を機械的に数えられない。2026-11-08に試験運用へ進めた3件（`bridge-jobs-queue-20261107`、`inquiry-proposal-decision-20261108`、`inquiry-board-placement-20261108`）も、残りの確認は`progress`の文の中にある。
- 試験運用は、エージェントの外の人（利用者、管理者でログインできる人）が確かめる項目が多い。Redmineは担当・期日・通知・コメントを持つので、人の作業の置き場に合う。

## 2. 方針（案）

| 項目 | 案 | 理由 |
|---|---|---|
| 正（source of truth） | D1`agent-inquiries`。Redmineは写し | 議事録・8段の記録と同じ場所に置く。Redmineが止まっても記録は失わない |
| Redmineの単位 | 議題1件 = チケット1件（トラッカー「試験運用」）。確認項目は説明欄のチェックリスト、結果は注記（journal） | 議題とチケットを1対1にすると、二重作成を防ぎやすい |
| 向き | D1 → Redmine（こちらから書き込む）。Redmineで付いたコメント・状態はD1へ読み戻す（任意、6章） | Redmineには外部のDBを読む標準の仕組みが無い。プラグインを作るより、REST APIで書く方が小さい |
| いつ写すか | 段階が`trial`になったとき、確認項目か結果が増えたとき、議題が`resolved`・`abandoned`になったとき | 試験運用の始まりと終わりがRedmineで分かる |
| 書き込む者 | 本体コンテナのworker（bridge-jobsと同じく、1件ずつ取り出して片付ける） | 署名・鍵を持つ場所を増やさない |

## 3. データの構成（D1に足すもの。案）

```sql
CREATE TABLE IF NOT EXISTS inquiry_trial_checks (id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES inquiry_cases(id) ON DELETE CASCADE, seq INTEGER NOT NULL, item TEXT NOT NULL, expected TEXT NOT NULL, checker TEXT NOT NULL CHECK (checker IN ('user', 'agent')), result TEXT NOT NULL DEFAULT 'pending' CHECK (result IN ('pending', 'pass', 'fail', 'skipped')), observed TEXT, observed_by TEXT, observed_at TEXT, entry_id TEXT REFERENCES inquiry_entries(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')), UNIQUE (case_id, seq));
CREATE TABLE IF NOT EXISTS inquiry_redmine_links (case_id TEXT PRIMARY KEY REFERENCES inquiry_cases(id) ON DELETE CASCADE, redmine_issue_id INTEGER UNIQUE, synced_revision INTEGER NOT NULL DEFAULT 0, synced_at TEXT, last_error TEXT);
CREATE TABLE IF NOT EXISTS inquiry_redmine_outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, case_id TEXT NOT NULL REFERENCES inquiry_cases(id) ON DELETE CASCADE, kind TEXT NOT NULL CHECK (kind IN ('open', 'check', 'result', 'close')), ref_id TEXT, status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')), attempts INTEGER NOT NULL DEFAULT 0, redmine_ref TEXT, error TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')), UNIQUE (case_id, kind, ref_id));
```

| 表 | 役割 |
|---|---|
| `inquiry_trial_checks` | 試験運用の確認項目（何を、どうなれば合格か、誰が確かめるか）と結果。根拠の問い合わせを`entry_id`で結ぶ |
| `inquiry_redmine_links` | 議題とチケットの対応。`redmine_issue_id`が入っていれば作成済み |
| `inquiry_redmine_outbox` | Redmineへ送る出来事。`UNIQUE (case_id, kind, ref_id)`で同じ出来事を二度積まない |

### Redmineのチケットの形

| Redmineの欄 | 中身 |
|---|---|
| トラッカー | 試験運用（新設） |
| 題名 | `[<case_id>] <goal>`（255文字で切る） |
| 説明 | 目的、8段の状態（`inquiry_case_steps`）、確認項目のチェックリスト（`- [ ]`／`- [x]`）、`/muse-inquiries`へのリンク |
| カスタムフィールド | `case_id`（文字列、検索用）、`段階`、`確認 合格/全体`（例 2/5） |
| 状態 | 新規（確認中）→ 解決（全項目が`pass`か`skipped`）→ 終了（議題が`resolved`）。`fail`があれば「フィードバック」 |
| 注記 | 結果が入るたびに1件（項目、結果、観察、確かめた者、時刻） |

## 4. 記録の方式（案）

1. 議題を`trial`へ進めるときに、確認項目を`inquiry_trial_checks`へ書く。確認項目が無い議題は`trial`へ進めない（8段の6「SPECと承認」で合格条件を決めておく）。
2. 同じ書き込みの中で`inquiry_redmine_outbox`に`open`を積む。結果を書いたら`result`、議題を閉じたら`close`を積む。D1のbatchで、記録と積み込みを同時に行う。
3. workerが`queued`を古い順に1件ずつ取り、Redmineへ送る。`open`は、送る前に`case_id`のカスタムフィールドでチケットを検索し、あればそれを使う（応答が返らず作成されたか分からない場合の二重作成を防ぐ）。
4. 送れたら`sent`と`redmine_ref`（チケット番号・journalの番号）、送れなければ`attempts`を増やして`error`を残す。3回失敗で`failed`とし、`/muse-inquiries`に表示する。Redmineが止まっていても、D1の記録は失われない。

## 5. 問題点（洗い出し。未解決）

- **R9の所在と状態**: 2026-11-08の確認で、`https://r9.nekomaneki.work/issues.json`は200、`/login`は500だった。このコンテナでは3009番も10443番も待ち受けていない。R9がどのホストで動いているか、500の原因は未確認。
- **書き込みの鍵**: RedmineのAPIキーを誰が持つか。`ORIGIN_HMAC_SECRET`の扱いはルール45で一括変更の対象なので、この議題では使い方を変えない。`src/utils/redmineProxy.ts`のHMAC付きの中継を流用できるかは未確認。
- **匿名で読める範囲**: `/issues.json`が未ログインで200なら、公開プロジェクトのチケットは誰でも読める可能性がある。議題の本文に内部の情報が入るので、プロジェクトは非公開にする必要がある（未確認）。
- **Redmineでの編集**: Redmine側で書かれたコメント・状態の変更をD1へ戻すか（6章）。戻さない場合、Redmineの変更はD1に残らない。

### MuseとCodexとの協議で分かった欠陥（2026-11-08、問い合わせ`trm-m3`・`trm-c4`）

3〜4章の案のままでは、次の欠陥がある。直し方は2案に分かれていて、採否待ち（提案`trm-p1`・`trm-p2`）。

| 論点 | 内容 | 出どころ |
|---|---|---|
| `trm-k2` | `inquiry_redmine_outbox`の`ref_id`はNULLを許すので、`UNIQUE (case_id, kind, ref_id)`があっても`open`を何件でも積める（メモリ内のSQLiteで再現）。取り出しのclaim・lease・tokenも無い | Codex |
| `trm-k3` | 検索→作成→D1への保存が別々の操作で、途中で止まると二重作成や注記の二重追加が起こる。出来事のIDをRedmine側にも残して照合する必要がある | Codex |
| `trm-k5` | `r9Gateway.ts`の`r9-v1`署名は`redmineProxy.ts`の`redmine-v1`と互換がなく、書き込みには使えない。`redmineProxy`の署名と中継は流用できるが、利用者のAPIキーとセッションに依存するので共通のクライアントへの切り出しが要る | Codex |
| `trm-k4` | `trm-p2`のように試験運用へ移すときにその場で作ると、R9が止まっている間は試験運用へ進めない | Claude Code |

ほかにCodexの指摘: 確認結果を上書きする形では再判定のときに前の結果が消えるので追記型にする。`synced_revision`に対応する元データの改訂番号が無い。`entry_id`が別の議題の問い合わせを指せる。`TEXT PRIMARY KEY`はSQLiteではNULLを許すので`NOT NULL`を明示する。

| 案 | 内容 |
|---|---|
| `trm-p1`（Codex） | 3〜4章を直す。出来事IDを`NOT NULL UNIQUE`に、取り出しは`migrations-agent-inquiries/0009_create_bridge_jobs.sql`のclaim・lease・tokenに倣う、確認結果は追記型、出来事IDをRedmine側にも残す |
| `trm-p2`（Muse） | outboxをやめる。D1には`redmine_issue_id`と送信状態だけを持ち、試験運用へ移すときにその場で1件作り、失敗したら移すのを止める。確認項目は`inquiry_entries`に種別として足す |

## 6. 決めること（利用者）

| 項目 | 選択肢 |
|---|---|
| 向き | D1 → Redmineだけ／Redmineのコメントと状態もD1へ読み戻す |
| Redmineの単位 | 議題1件 = チケット1件（案）／確認項目ごとに子チケット |
| 書き込む者 | 本体コンテナのworker（案）／Worker（Cloudflare）から直接 |
| 3章の表を足すか | 足す／`inquiry_case_steps`の`trial`の`note`だけで始める |
| R9 | 今のR9を使う（所在と500の原因を先に調べる）／別のRedmine |
