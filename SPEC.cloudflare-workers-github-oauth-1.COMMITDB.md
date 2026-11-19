# SPEC.cloudflare-workers-github-oauth-1.COMMITDB.md

改訂: 2026-11-19、opus-5.5（Claude Opus 5.5、Claude Code）。本文の手順は残し、pushのwebhookでの自動の追記（2026-10-04〜）と`committed_at`列（末尾の「2026-11-19の現状」）を足した
評価: [`EVAL.cloudflare-workers-github-oauth-1.COMMITDB.opus-5.5.20261119.md`](EVAL.cloudflare-workers-github-oauth-1.COMMITDB.opus-5.5.20261119.md)
定期的な見直し: このSPECは[`SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md`](SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md)の手順で、定期的に実情に合わせて改訂し、評価し直す

## repo_commit_index 追記ルール

**対象**: D1 テーブル `repo_commit_index`（DB: `workers-github-oauth-1`, UUID: `abbe590b-f7ff-4b98-b61c-17c8cb18c8cf`）— PR がマージされるたびに、新規コミットをこのテーブルに追記してコミットインデックスを最新状態に保つ。**本体リポジトリ・`nekoserver/dynamicneko`・`nekoserver/cf-auth` の複数リポジトリを `repo_name` で区別して同居させる**（2026-09-11 に `nekoserver/cf-auth`（69件）・`nekoserver/dynamicneko`（120件）の過去分を追加し、複数リポジトリ対応にした）。

---

## 背景

`repo_commit_index` は複数リポジトリの全コミットをコミットハッシュをキーとして記録する D1 テーブル。コミットと PR 番号・コミットメッセージの対応関係を整合性が保たれた状態でクエリ可能にするために設置された（マイグレーション `0034_create_repo_commit_index.sql`）。当初は本体リポジトリ専用だったが、2026-09-11 に `nekoserver/cf-auth`・`nekoserver/dynamicneko` の過去コミットも同じテーブルへ追加し、`repo_name` で複数リポジトリを区別する運用にした。

`nekoserver/dynamicneko`と`nekoserver/cf-auth`は別の実在リポジトリである（前者はAIチャット等の実験用Worker、後者はcf-authログインを扱う別Worker）。この2つを混同しないこと — 2026-09-11のセッションでは、ユーザーが「dynamicneko」のコミットログ確認を依頼したのに対し、NOTICEファイル中の「`nekoserver/dynamicneko`の`cf-auth`」という表記を「dynamicneko = cf-authの通称」と誤読し、cf-authのコミットだけを投入してしまう取り違えが一度発生した（両方とも実在するため、結果的に両方投入すること自体は無駄にならなかった）。

### テーブルスキーマ

| カラム | 型 | 説明 |
|---|---|---|
| `commit_hash` | TEXT PK | 40桁フルコミットハッシュ |
| `seq_num` | INTEGER NOT NULL | リポジトリ内通し番号（`repo_name` ごとに oldest=1） |
| `github_pr_number` | INTEGER | マージコミットの PR 番号（非マージは NULL） |
| `commit_message` | TEXT NOT NULL | コミットメッセージ全文 |
| `repo_name` | TEXT NOT NULL | 対象リポジトリ。必ず `owner/repo` 形式で統一する（下記「対象リポジトリ一覧」のいずれか）。オーナー名なしの表記（例: `cloudflare-workers-github-oauth-1` 単体）は使わないこと — 2026-09-11 にこの表記揺れで本体分の2件が別`repo_name`として分裂しているのを発見・修正した |

### 対象リポジトリ一覧

| `repo_name` | ローカルクローン | 備考 |
|---|---|---|
| `nekoserver/cloudflare-workers-github-oauth-1` | このリポジトリ自身 | 本体Worker |
| `nekoserver/dynamicneko` | 別途 `add_repo` でセッションに追加してクローン | AIチャット等の実験用Worker（cf-authとは別リポジトリ） |
| `nekoserver/cf-auth` | 別途 `add_repo` でセッションに追加してクローン | cf-authログインを扱う別Worker |

---

## トリガー

以下のいずれかが発生したとき、必ずこの手順を実施する。**対象リポジトリ一覧（上記）のいずれかで**発生した場合が対象。

- PR がマージされ、main ブランチに新規コミットが追加された
- 直接 main に push されて新規コミットが追加された
- セッション開始時に D1 のコミット数と `git rev-list --count main` が一致しない（対象リポジトリそれぞれについて確認する）

---

## 実施手順

以下の `<REPO>` は対象リポジトリの `repo_name`（上記「対象リポジトリ一覧」のいずれか）に、`<CLONE_DIR>` はそのリポジトリのローカルクローンのディレクトリに読み替える。`nekoserver/dynamicneko` または `nekoserver/cf-auth` を対象にする場合、セッションにクローンが無ければ先に `add_repo` で追加する（名前が似ているので取り違えないこと）。

### Step 1: D1 の現在の最大 seq_num を確認する

D1 MCP ツール `d1_database_query` で実行する:

```sql
SELECT MAX(seq_num) AS max_seq, COUNT(*) AS total FROM repo_commit_index WHERE repo_name = '<REPO>';
```

返された `max_seq` の値を `N` として記録する（初めて追加するリポジトリで行が0件の場合、`N` は 0 として扱う）。

---

### Step 2: git log で新規コミットを取得する

`<CLONE_DIR>` でまず origin/main を最新状態に取得してから実行する。

```bash
cd <CLONE_DIR>
git fetch origin main
git log origin/main --reverse --format="%H|||%s" | tail -n +$((N+1))
```

出力形式: `<40桁ハッシュ>|||<コミットメッセージ1行>`

新規コミットが 0 件であれば作業終了。

**注意**: `git log main` ではなく `git log origin/main` を使うこと。ローカルの `main` はリモートより古い場合があり、GitHubでのPRマージ時に自動生成されるマージコミット（`Merge pull request #NNN`）が欠落する原因になる。

---

### Step 3: マージコミットの PR 番号を抽出する

コミットメッセージが `Merge pull request #NNN from ...` の形式であれば PR 番号は `NNN`（整数値）。それ以外は `NULL`。

---

### Step 4: INSERT SQL を生成・実行する

各新規コミットについて以下の形式で INSERT する。`repo_name` には必ず `<REPO>`（`owner/repo` 形式）を入れる。

```sql
INSERT OR IGNORE INTO repo_commit_index (commit_hash, seq_num, github_pr_number, commit_message, repo_name) VALUES ('<hash>', <seq>, <pr_or_NULL>, '<message>', '<REPO>');
```

- `seq_num` は Step 1 の `max_seq` から +1 ずつ増やす
- メッセージ内のシングルクォートは `''` にエスケープする
- `INSERT OR IGNORE` を使うため重複挿入は安全に無視される
- SQL にコメントを含めない（CLAUDE.md ルール 6）

50 件を超える場合は 50 件以下のバッチに分割して実行する。

---

### Step 5: 件数を照合して完了確認する

```sql
SELECT COUNT(*) AS total FROM repo_commit_index WHERE repo_name = '<REPO>';
```

`<CLONE_DIR>` での `git rev-list --count origin/main` の結果と一致すれば完了。

---

## SQL 自動生成スクリプト

コミット数が多い場合は以下の手順で SQL を一括生成する。

```bash
git fetch origin main
git log origin/main --reverse --format="%H|||%s" > /tmp/new_commits.txt
```

`N` を Step 1 で得た `max_seq` の値に置き換えてから実行する:

```bash
python3 -c "
import re, sys

with open('/tmp/new_commits.txt') as f:
    lines = [l.rstrip('\n') for l in f if l.strip()]

start_seq = N + 1
repo = '<REPO>'
new_lines = lines[N:]

for i, line in enumerate(new_lines):
    parts = line.split('|||', 1)
    if len(parts) != 2:
        continue
    h, msg = parts
    m = re.search(r'Merge pull request #(\d+)', msg)
    pr = m.group(1) if m else 'NULL'
    msg_esc = msg.replace(\"'\", \"''\")
    seq = start_seq + i
    print(f\"INSERT OR IGNORE INTO repo_commit_index (commit_hash, seq_num, github_pr_number, commit_message, repo_name) VALUES ('{h}', {seq}, {pr}, '{msg_esc}', '{repo}');\")
"
```

生成された SQL を `/tmp/batch_XX.sql` に保存し、50 行ごとのバッチに分割して D1 MCP で実行する。

---

## 注意事項

- D1 UUID: `abbe590b-f7ff-4b98-b61c-17c8cb18c8cf`
- D1 database name: `workers-github-oauth-1`
- コミットハッシュの取得元は常に対象リポジトリの `main` ブランチの `git log` を使う
- feature ブランチ上のコミットは main にマージされた時点で追記する（マージ前は追記しない）
- `seq_num` は同じ`repo_name`内で連続している必要がある（`repo_name`をまたいで連続させる必要は無い）。欠番が生じた場合は NOTICE に記録する
- PR マージコミット（`Merge pull request #NNN`）だけでなく、直接 push されたコミットも追記対象
- `repo_name`は必ず`owner/repo`形式で統一する。オーナー名なしの表記を使うと同一リポジトリが別`repo_name`として分裂する（2026-09-11に発生・修正済み）

---

## 関連ファイル

| ファイル | 説明 |
|---|---|
| `migrations/0034_create_repo_commit_index.sql` | テーブル定義 |
| `STATS.COMMIT.203.-20250528.md` | 2026-05-28 時点の全コミット分類集計 |
| `NOTICE.cloudflare-workers-github-oauth-1.PRCOUNT.md` | コミット数と PR 番号の不一致に関する知見 |

---

## 2026-11-19の現状（改訂で追記）

**対象**: 「実施手順」の手動の運用と、`repo_commit_index`のスキーマ（`origin/main` [`c271b7ba`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c271b7ba)） — 2026-09-11の後に変わった点。本文の手順は消さずに残す（自動の追記が失敗したときの補い方として使える）。

| 項目 | 本文の記述 | 今 | 根拠 |
|---|---|---|---|
| 追記の主な経路 | PRのマージのたびに、エージェントが手動でSQLを作って実行する（`CLAUDE.md`ルール24） | **GitHubのpushのwebhookで自動で追記する**（2026-10-04〜）。`POST /webhook/github`のpushイベントで、`buildPushRepoCommitIndexEntries`がコミットの配列から行を作り、`MAX(seq_num)`の続きの番号で`INSERT OR IGNORE`する。手動の手順は、webhookが届かなかった・失敗したときの補いになる | [`9354d9a8`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/9354d9a8)、`src/index.ts`のpush webhookの処理、`src/utils/githubPushNotify.test.ts`（20件、2026-11-19に通過） |
| 対象リポジトリ | 本体・dynamicneko・cf-authの3つ | 自動の追記は、webhookが届くリポジトリ（GitHub Appがインストールされたリポジトリ）すべてが対象。3つに限らない | 同上（`repositoryFullName`をそのまま`repo_name`にする） |
| スキーマ | 5列 | `committed_at`（TEXT）が加わった | `migrations/0175_add_repo_commit_index_committed_at.sql`（[`a76cade7`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a76cade7)、2026-10-15） |
| 失敗したとき | — | 例外は`logger.error('Failed to update repo_commit_index for push webhook')`に残るだけで、画面や通知には出ない。`CLAUDE.md`ルール8の「通知」は満たしていない | `src/index.ts`のcatch |

- `CLAUDE.md`のルール24は手動の運用を必須として書いたまま。自動の追記が入ったことと食い違う。ルールを直すかは利用者が決める。
- セッションの開始時に件数を照合する手順（「トリガー」の3つ目）は、自動の追記の取りこぼしを見つける手段として今も有効。2026-11-19の本体の`git rev-list --count origin/main`は5703。D1の件数は確かめていない（本番のD1の読み取りの認証が無い）。

## 改訂の記録

| 日付 | モデル | 箇所 | 内容 | 根拠 |
|---|---|---|---|---|
| 2026-11-19 | opus-5.5 | 冒頭・「2026-11-19の現状」 | 自動の追記、対象の広がり、`committed_at`、失敗の通知の欠落を追加。本文の手順は補いとして残した | 上の表 |
