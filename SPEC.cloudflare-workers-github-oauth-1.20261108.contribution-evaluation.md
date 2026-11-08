# SPEC: 決定や業務に何が効いたかを、来歴で記録して数える

作成日: 2026-11-08
状態: **案**（計画。提案`ce-p1`・`ce-p3`・`ce-p4`は利用者が採用済み。この表の形と6章の「決めること」は承認待ち。D1は変更していない）

関連: D1`agent-inquiries`の議題`contribution-evaluation-20261108`（問い合わせ`ce-e0`〜`ce-c8`、論点`ce-k1`〜`ce-k16`）、[発議のルールと8段の過程](SPEC.cloudflare-workers-github-oauth-1.20261108.proposal-rule.md)（7章）、議題`task-commit-link-20261108`（コミットとの関連付け）。

## 1. 目的

**対象**: D1`agent-inquiries`に足す記録台帳（`inquiry_records`）と、効いたものの関連（`inquiry_contributions`）、生きなかったものの記録（`inquiry_unused`） — 決定や業務に「何が、どう効いたか」を、文面の類似性ではなく来歴として記録し、引用のように数えられるようにする。

### 背景

- 利用者の指摘（2026-11-08）: 発案者の提案と決定との関連を判定したいが、類似性では測れない。効いたものは提案に限らず、前提知識、既存実装、過去の解決方法もある。業務プロセスの改善も定量化したい。前提知識の体系的な抜けを指摘する提案も評価したい。
- 類似性で測れない例: 2026-11-08、Codexの指摘「`ref_id`がNULLを許すので`UNIQUE`が効かない」（`trm-c4`）は、案の文面と似ていないが、直し方を2つに分けた。
- 今あるもの: `inquiry_entries.avoidable_by_knowledge_id`（16件）、`inquiry_keys.closed_by_knowledge_id`（1件）、`inquiry_keys.useful`（68件）。どれも出どころが知識に限られ、決定とは結ばれていない。

## 2. 決まったこと（採用済みの提案）

| 提案 | 内容 | 採用 |
|---|---|---|
| `ce-p1`（Codex） | 共通の記録台帳を作り、関連の表の両端をその台帳への外部キーにする。種類は追加できる属性。関連には出典・対象・効き方・判定者・日時・根拠を持たせ、「使った」と「効いた」を分け、未判定を「生きなかった」に含めない | 2026-11-08 06:11 |
| `ce-p3`（Muse） | 効き方に「前提を正した」「期限・費用を変えた」「後で使うために残した」を足す。「作らずに済んだ」と「問い合わせを省いた」の判定の基準を決める。「生きなかった」は効果とは別枠で数える | 2026-11-08 05:55 |
| `ce-p4`（利用者の補足） | 一般化されたワークフロー・ベストプラクティス・アンチパターンを物差しにして、体系的な抜けを表で出す。外部の基準の項目IDを出どころのIDとして記録する | 2026-11-08 06:09 |

## 3. 表の形（案）

```sql
CREATE TABLE IF NOT EXISTS inquiry_records (id TEXT NOT NULL PRIMARY KEY, kind TEXT NOT NULL, ref TEXT NOT NULL, label TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')), deleted_at TEXT, UNIQUE (kind, ref));
CREATE TABLE IF NOT EXISTS inquiry_contributions (id INTEGER PRIMARY KEY AUTOINCREMENT, source_id TEXT NOT NULL REFERENCES inquiry_records(id), target_id TEXT NOT NULL REFERENCES inquiry_records(id), effect TEXT NOT NULL CHECK (effect IN ('changed_direction', 'avoided_inquiry', 'closed_key', 'prevented_defect', 'avoided_building', 'corrected_premise', 'changed_cost', 'kept_for_later')), phase TEXT NOT NULL CHECK (phase IN ('decision', 'trial', 'retrospective')), judged_by TEXT NOT NULL, judged_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')), evidence_entry_id TEXT REFERENCES inquiry_entries(id) ON DELETE SET NULL, note TEXT, CHECK (source_id <> target_id), UNIQUE (source_id, target_id, effect, phase));
CREATE TABLE IF NOT EXISTS inquiry_unused (id INTEGER PRIMARY KEY AUTOINCREMENT, source_id TEXT NOT NULL REFERENCES inquiry_records(id), target_id TEXT NOT NULL REFERENCES inquiry_records(id), consequence TEXT NOT NULL CHECK (consequence IN ('failure', 'rework', 'delay', 'none_observed')), judged_by TEXT NOT NULL, judged_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')), evidence_entry_id TEXT REFERENCES inquiry_entries(id) ON DELETE SET NULL, note TEXT, UNIQUE (source_id, target_id));
```

### 記録台帳（`inquiry_records`）

- `id`は`<kind>:<ref>`。例: `case:bridge-jobs-queue-20261107`、`proposal:ce-p1`、`entry:trm-c4`、`key:ce-k9`、`knowledge:<id>`、`commit:nekoserver/lib@<フルSHA>`、`file:nekoserver/lib:claude/ops/bridge_jobs.py@<フルSHA>`、`ext:CWE-294`、`ext:OWASP-ASVS-V2.1.1`、`rule:cloudflare-workers-github-oauth-1/CLAUDE.md#26`。
- `kind`は固定しない（`ce-p1`）。新しい種類の出どころ（利用者の一言、Museの実測値など）が出ても、表を変えずに記録できる。
- 消さない。元の記録が消えたときは`deleted_at`を入れる（`ce-k4`: `CASCADE`・`SET NULL`で証跡を失わない）。関連の外部キーは`ON DELETE`を付けないので、台帳の行を物理的に消そうとすると拒否される。
- 議題・提案・問い合わせ・論点・知識の台帳の行は、元の表への`INSERT`のトリガーで作る。コミット・ファイル・外部の基準・ルールは、関連を書く者が`INSERT OR IGNORE`で作る。

### 効いたもの（`inquiry_contributions`）

| `effect` | 効き方 | 判定の基準 |
|---|---|---|
| `changed_direction` | 向きを変えた | 前と後の案が記録に残っている |
| `avoided_inquiry` | 問い合わせを省いた | 実際に問い合わせをしなかった（しようとした記録か、同じ種類の過去の問い合わせがある） |
| `closed_key` | 論点を閉じた | 論点の`closed_by_*`か、閉じた根拠の問い合わせがある |
| `prevented_defect` | 欠陥を防いだ | 実装の前に落とし穴の論点が出て、それを受けて直した記録がある |
| `avoided_building` | 作らずに済んだ | 既存の実装・手順を流用し、新しく書かなかった。流用したファイルかコミットを出どころにする |
| `corrected_premise` | 前提を正した | 誤っていた前提と、正した後の前提が記録に残っている |
| `changed_cost` | 期限・費用を変えた | 所要時間・回数・費用の前後が記録に残っている |
| `kept_for_later` | 後で使うために残した | 知識・NOTICE・記憶として残し、まだ使われていない |

- `avoided_inquiry`と`avoided_building`の区別（`ce-p3`）: 情報を得る行為を省いたなら前者、成果物を作る行為を省いたなら後者。両方なら2行書く。
- 「使った」だけの記録は今の`inquiry_entry_knowledge`などに残し、この表には「効いた」ものだけを書く（`ce-p1`）。
- `phase`: 決めるとき（`decision`）、試験運用で確かめたとき（`trial`）、後から振り返ったとき（`retrospective`）。欠陥を防いだ・作らずに済んだは、決めるときには分からないことが多いので、試験運用か振り返りで足す（Codex）。

### 生きなかったもの（`inquiry_unused`）

- 効果ではなく別枠で数える（`ce-p3`）。出どころ（知識・手順・既存実装）があったのに使われなかったこと。
- 例: 2026-11-08、`~/lib`のNOTICEに「`pkill -f`は同じ行のシェル自身にも一致する」とあったのに使わず、確認のコマンドまで止めた（`consequence = 'failure'`）。
- 今の`avoidable_by_knowledge_id`（「この知識があれば問い合わせは要らなかった」）は、意味としてはこの表に当たる。二重に書かないため、移行はせず、5章の集計のビューで両方を合わせて読む。

## 4. 物差し（`ce-p4`）の記録

- 物差しの項目は台帳の`ext:`・`rule:`の行にする。照らした結果は論点（`inquiry_keys`、`domain`に分野）に書く。2026-11-08の試し: 認証（`ce-k9`〜`k12`、`domain = 'auth'`）、CLAUDE.mdのルール（`ce-k13`〜`k15`、`domain = 'code-rules'`）。
- 件数は「検索の候補数」「文脈を見て確かめた違反数」「承認・互換性の確認待ち」を分けて持つ（`ce-k16`）。候補数を違反数として数えない。分けて持つ表を足すかは6章で決める。
- 体系的な抜けは3種類に分ける（`ce-k7`）: 未整備（知識が無い）、知識化の不足（閉じた有用な論点が知識にならない）、発見・適用の不足（知識があるのに使われない。`inquiry_unused`で数える）。

## 5. 数え方（案）

- 提案者・出どころごとに、`inquiry_contributions`の`target_id`の重複を除いた件数を効き方別に数える。1つの出どころが複数の決定に効いたら、決定の数だけ数える（引用と同じ）。1つの決定に複数の出どころが効いたら、それぞれに1件ずつ数える。
- 件数が少ない間は割合を出さず、件数と具体例を並べる（`ce-k5`、Muse）。0件の期間は「判定していない」と「効果が無かった」を区別し、判定していない件数（`ce-k6`: 未判定の割合）を並べて出す。
- 業務プロセスの改善は、改善を台帳の1行（`kind = 'process'`など）にし、入れるときに対象の数字と向きを先に書く。前後の比較には段階の移り変わりの履歴と利用者の介入の記録が要る（`ce-k2`、提案`ce-p2`、採否待ち）。

## 6. 決めること（利用者）

| 項目 | 選択肢 | 論点 |
|---|---|---|
| 効き方を付けられる人 | 利用者だけ／エージェントも付けられるが「判定者」を残し、利用者が確かめるまで仮扱い | `ce-k5` |
| 仮に付けたものを確かめる方法 | `UNIQUE (source_id, target_id, effect, phase)`により同じ組は1行なので、利用者が確かめるときは行を足さず`judged_by`を書き換え、確かめた記録を出来事の表（`ce-p2`）に残す（案）／確かめた印の列を足す | `ce-k5` |
| 付けるとき | 採否のボタンで決めるとき＋試験運用・振り返りで足す（案）／決めるときだけ | `ce-k5` |
| 3章の表を足すか | 3つとも足す／台帳と`inquiry_contributions`だけ先に足す | — |
| 物差しの候補数・確認済み数・確認待ちを分けて持つ表 | 足す／当面は論点の本文に書く | `ce-k16` |
| 出来事の表（`ce-p2`） | 採用して一緒に作る／後にする | `ce-k2` |
| 画面 | `/muse-inquiries`の採否のモーダルで効き方を選べるようにする（この案の承認後に別に作る） | — |

## 7. 確かめたこと

3章のSQLを、`migrations-agent-inquiries/`の全マイグレーション（0010まで）の上にSQLite（`node:sqlite`、外部キー有効）で当て、10通りが期待どおりになることを確かめた（2026-11-08）: 正しい効き方は入る、知らない効き方・同じ組の二重・自分自身・台帳に無い出どころ・`id`のNULLは拒否、段が違えば別の行、関連に使われている台帳の行は消せない、`inquiry_unused`の同じ組の二重は拒否。本番のD1では確かめていない。

## 8. 注意事項

- 台帳の`id`は、元の表をまたいで一意とは限らないIDに`kind`の接頭辞を付けて一意にする（Codex: 各表のIDが表をまたいで一意とは仮定しない）。
- `inquiry_knowledge_effect`のビューは`planned`・`withdrawn`を除いていない（`ce-k3`）。5章の集計では0005と同じく除く。
- 評価の数字は、件数が少ないうちは改善の効き方の候補として並べ、断定には使わない。
