# NOTICE: repo_commit_index 運用ベストプラクティス

記録日 : 2026-05-28
対象リポジトリ : `nekoserver/cloudflare-workers-github-oauth-1`

このドキュメントは PR #315 で発覚した `repo_commit_index` の件数ズレ（D1: 206件 vs git: 217件）の事後分析として、「最初からこの手順を守っていれば問題は起きなかった」というベストプラクティスをまとめたものである。

---

## 発生した問題

| 問題 | 影響 |
|---|---|
| シードデータを `git log main`（ローカル）で生成したため、PRマージ時に生成されるマージコミット3件（Merge #308/309/310）が欠落 | seq_num 204〜206 がズレ、11件未追記 |
| PR マージ後に `repo_commit_index` への追記を行わなかった | D1 と git の件数が乖離し続けた |

---

## 原則

> **`git rev-list --count origin/main` の値と D1 の `COUNT(*)` は常に一致していなければならない。**

この一致を維持するために、以下の3つのフェーズそれぞれで照合コマンドを実行する。

---

## フェーズ 1: セッション開始時の照合

セッションを開始したら、作業を始める前に必ず件数を照合する。

### コマンド

```bash
git fetch origin main
git rev-list --count origin/main
```

```sql
SELECT MAX(seq_num) AS max_seq, COUNT(*) AS total
FROM repo_commit_index
WHERE repo_name = 'nekoserver/cloudflare-workers-github-oauth-1';
```

### 判定

| 状態 | 対応 |
|---|---|
| `git rev-list --count` = D1 `total` | 正常。作業を続ける |
| `git rev-list --count` > D1 `total` | ズレあり。**フェーズ 3（追記手順）** を実行する |
| `git rev-list --count` < D1 `total` | 異常（D1 過多）。手動で原因を調査する |

---

## フェーズ 2: シードデータ生成時の注意

シードデータを新規生成・再生成する場合、**必ずリモートの `origin/main` を使う**。

### やってはいけないこと

```bash
git log main --reverse ...     # NG: ローカルの main はリモートより古い場合がある
```

ローカルの `main` は最新のリモートマージコミットを含んでいないことがある。GitHub で PR をマージすると `Merge pull request #NNN` というマージコミットが自動生成されるが、`git fetch` をしていない状態ではこれが欠落する。

### 正しい手順

```bash
git fetch origin main
git rev-list --count origin/main          # 期待される総件数を確認
git log origin/main --reverse --format="%H|||%s" | wc -l   # 同じ値になることを確認
git log origin/main --reverse --format="%H|||%s" > /tmp/all_commits.txt
```

シード前の照合:

```sql
SELECT COUNT(*) AS current FROM repo_commit_index
WHERE repo_name = 'nekoserver/cloudflare-workers-github-oauth-1';
```

`current` が 0 であれば全件シード、0 より大きければ差分追記（フェーズ 3）を使う。

---

## フェーズ 3: PR マージ後の追記手順

**PR がマージされるたびに必ず実行する**（CLAUDE.md ルール 24）。

### Step 1: D1 の現在の最大 seq_num を取得する

```sql
SELECT MAX(seq_num) AS max_seq, COUNT(*) AS total
FROM repo_commit_index
WHERE repo_name = 'nekoserver/cloudflare-workers-github-oauth-1';
```

返った `max_seq` の値を `N` として記録する。

### Step 2: リモートを取得してから新規コミット一覧を取得する

```bash
git fetch origin main
git rev-list --count origin/main          # 期待される最終件数を確認
git log origin/main --reverse --format="%H|||%s" | tail -n +$((N+1))
```

出力が 0 件なら作業終了。

### Step 3: INSERT SQL を生成して実行する

コミットメッセージが `Merge pull request #NNN from ...` の形式であれば `github_pr_number = NNN`、それ以外は `NULL`。

```sql
INSERT OR IGNORE INTO repo_commit_index
  (commit_hash, seq_num, github_pr_number, commit_message, repo_name)
VALUES
  ('<hash>', <N+1>, <PR番号またはNULL>, '<message>', 'nekoserver/cloudflare-workers-github-oauth-1');
```

- メッセージ内のシングルクォートは `''` にエスケープする
- SQL にコメントを含めない（CLAUDE.md ルール 6）
- 50件を超える場合は 50件以下に分割して実行する

### Step 4: 件数を照合して完了確認する

```bash
git rev-list --count origin/main
```

```sql
SELECT MAX(seq_num) AS max_seq, COUNT(*) AS total
FROM repo_commit_index
WHERE repo_name = 'nekoserver/cloudflare-workers-github-oauth-1';
```

`git rev-list --count origin/main` = D1 `total` = D1 `max_seq` の3値が一致すれば完了。

---

## ズレが発生したときの修正手順

### 診断

```bash
git fetch origin main
git log origin/main --reverse --format="%H" > /tmp/git_hashes.txt
wc -l /tmp/git_hashes.txt
```

```sql
SELECT seq_num, commit_hash FROM repo_commit_index
WHERE repo_name = 'nekoserver/cloudflare-workers-github-oauth-1'
ORDER BY seq_num DESC LIMIT 20;
```

D1 の `commit_hash` が git の同じ行番号のハッシュと一致するか確認する。

### ズレの境界を特定する

```bash
git log origin/main --reverse --format="%H|||%s" | sed -n '<最大seq_numの前後5行>p'
```

### 修正

ズレが始まった `seq_num` 以降を DELETE して再 INSERT する。

```sql
DELETE FROM repo_commit_index
WHERE seq_num >= <ズレ開始seq>
  AND repo_name = 'nekoserver/cloudflare-workers-github-oauth-1';
```

その後フェーズ 3 の手順で正しい内容を INSERT し、最終的に件数が一致することを確認する。

---

## まとめ: やること・やってはいけないこと

| | やること | やってはいけないこと |
|---|---|---|
| コマンド | `git log origin/main` | `git log main` |
| fetch | 常に `git fetch origin main` を先に実行 | fetch なしで git log を実行 |
| 照合 | セッション開始時・追記後に必ず件数照合 | 照合なしで作業完了とみなす |
| 追記タイミング | PR マージのたびに即実行 | まとめて後でやろうとする |

---

## 関連ファイル

| ファイル | 説明 |
|---|---|
| `SPEC.cloudflare-workers-github-oauth-1.COMMITDB.md` | 追記手順の詳細（Step 1〜5・自動生成スクリプト） |
| `CLAUDE.md` ルール 24 | PR マージ後の更新義務 |
