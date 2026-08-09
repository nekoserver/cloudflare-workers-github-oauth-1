# NOTICE 2026-08-09

## repo_commit_index の更新が PR #418 の時点で停止していた

**対象**: D1 テーブル `repo_commit_index` — ルール24(PRマージ後の追記)の運用実態。

- 2026-08-09 時点の D1 は `max_seq=421 / total=419` で、最終登録は
  [`fbcf9f8`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/fbcf9f8)
  (Merge PR #418)だった。main の実コミット数は 2882(`git rev-list --count main`)で、
  **PR #418 以降の 1961 コミットが未登録**のまま放置されていた。
- 番号規則の実態: seq_num は `git log main --reverse`(全コミット順)の並びに従うが、
  過去の登録漏れ約500件のぶん **seq はgit上の位置より500小さい**(seq 421 = 位置 921)。
  さらに `max_seq(421) ≠ total(419)` の2件のずれもある。
  SPEC の検証手順「COUNT(*) = git rev-list --count main」は以前から成立していない。
- 対応: 位置 922〜2882 の 1961 コミットを seq 422〜2382 として追記するSQL
  (`repo_commit_index_catchup_20260809.sql`、50行ずつ40文)を生成してユーザーに提供した。
  実行後は `total=2380` になる。git の 2882 との差 502 は**PR #418 以前の歴史的な
  登録漏れ**であり、埋めるには D1 の全行ダンプと突き合わせが必要(未実施)。
- 教訓: seq_num は「git上の絶対位置」ではなく「登録順の連番」として運用されている。
  **seq_num を SQL に決め打ちで書き込んではならない**。決め打ちは実行時点のD1の
  状態とずれた瞬間に不整合を生む(今回の乖離も、`INSERT OR IGNORE` で重複スキップ
  された行が番号だけ消費する飛びも、これが原因)。追記SQLは必ず次の動的採番
  パターンで書くこと:

  ```sql
  WITH base AS (SELECT COALESCE(MAX(seq_num), 0) AS n FROM repo_commit_index WHERE repo_name = '<repo>'),
  nc(ord, commit_hash, pr, msg) AS (VALUES (1, '<hash>', NULL, '<subject>'))
  INSERT OR IGNORE INTO repo_commit_index (commit_hash, seq_num, github_pr_number, commit_message, repo_name)
  SELECT nc.commit_hash, base.n + ROW_NUMBER() OVER (ORDER BY nc.ord), nc.pr, nc.msg, '<repo>'
  FROM nc, base
  WHERE nc.commit_hash NOT IN (SELECT commit_hash FROM repo_commit_index WHERE repo_name = '<repo>');
  ```

  実行時に `MAX(seq_num)` から連番を振り、登録済みハッシュを `WHERE` で除外して
  から採番するため、決め打ちによる乖離も番号飛びも構造的に発生せず、再実行しても
  冪等になる(sqlite3 でシミュレーション検証済み)。複数文に分割しても各文が
  `MAX(seq_num)` を取り直すので連番が続く。

## Claude Code on the Web のクローンは shallow(履歴切り詰め)

**対象**: リモートセッションの git 環境全般。

- セッション開始時のクローンは shallow で、`git rev-list --count` が実際より
  大幅に小さい値(今回は 2882 に対して 105)を返す。`.git/shallow` の存在で判別できる。
- コミット数・履歴位置を使う作業(`repo_commit_index` 追記など)の前には必ず
  `git fetch --unshallow origin main` を実行すること。

## PR は追加コミットのプッシュ前にマージされることがある

**対象**: PR運用とブランチ運用。

- PR #1318 は最初の1コミットのみの時点(10:52 UTC)でマージされ、その後に
  同ブランチへ積んだ4コミット(輻射点修正・ペルセウス座星座線など)は main に
  入らなかった。「マージ済みなのに機能が反映されない」ときはまず
  **マージコミットに目的の変更が含まれているか**を確認すること。
- 対応はルールどおり: マージ済みPRを再利用せず、未マージ分を最新 main へ
  リベースして新しいPR(#1319)を作成した。
