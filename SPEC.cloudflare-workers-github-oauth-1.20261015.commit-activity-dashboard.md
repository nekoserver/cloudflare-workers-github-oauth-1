# SPEC.cloudflare-workers-github-oauth-1.20261015.commit-activity-dashboard

**対象**: `repo_commit_index`・`commit_file_changes`・`commit_summary_topics`/
`commit_summary_topic_links`・`jev_test_score_trend`系(本体Worker)を横断する
「コミット活動ダッシュボード」の新設。既存の`tokenUsageModal`(`/aichat`)と
同じグラフモーダルのパターンで実装し、将来独立ページへ昇格しやすい形にする。

## 1. 背景

セッション中に「各コミットがどのファイルに作用したかを記録に残せ」という
指摘を受けて`commit_file_changes`を新設した([PR #2371](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/2371)・
[PR #2372](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/2372))。
その後、この記録を実際に使う"呼び出し元"をどこに置くか議論する中で、以下が
判明した。

- `commit_summary_topics`/`commit_summary_topic_links`(migration 0173、
  別PRで追加済み)も同様に、どのページからも参照されていない
  (`ai_summary_keywords`から自動生成されるTopic一覧だが、表示する場所が無い)
- `jev-test-score-trend`(dynamicnekoの`/api/tree-view/test-score-trend`→
  本体Workerの`/api/jev-test-score-trend-external`)は個別コミットの
  テスト品質推移を見れるが、リポジトリ横断・日次集計の視点は無い
- `repo_commit_index`はPRマージ時に自動追記される信頼できる全コミット台帳
  だが、**コミット日時を持つカラムが無い**(`commit_hash`・`seq_num`・
  `github_pr_number`・`commit_message`・`repo_name`のみ)

これらを「リポジトリ横断でコミット数・変更ファイル・作業Topic・テスト品質の
推移を一度に見れる」ダッシュボードとして束ねることで、プロジェクト全体の
活動を定点観測する「プロセスモニタ」相当のものになる、というのが本SPECの
出発点(ユーザー発案)。

## 2. 技術的な前提: `repo_commit_index`への日時カラム追加が必要

日別集計を行うには各コミットの日時が要るが、既存カラムには無い。

- `commit_file_changes.committed_at`は使えるが、これは**段階的バックフィル
  対象のため全コミットを網羅しない**(SPEC.dynamicneko.20261015.md参照)。
  日別集計の母集団には使えない
- `ai_summary_log.created_at`も使えない。push summaryは1pushにつき1行
  (複数コミットを1行に集約)のため、コミット単位の日別集計には粒度が合わない
- 対応: `repo_commit_index`に`committed_at TEXT`カラムを追加するmigrationを
  作る。GitHub push webhookのpayloadは`commits[].timestamp`を既に持っている
  (`buildCommitFileChangeEntries`で2026-10-15に読み取り済み、`src/types.ts`の
  `GitHubWebhookPushPayload`に追加済み)ため、`buildPushRepoCommitIndexEntries`
  (`src/utils/githubPushNotify.ts`)を拡張してこの値も一緒に返すだけで良い
  (追加のGitHub API呼び出し不要)
- 既存行(`committed_at`追加前に記録された過去コミット)は`NULL`のまま
  残る。「都度埋める」方針(本セッションの既存合意)と同じ扱いとし、
  一括バックフィルはしない。日別集計では`committed_at IS NOT NULL`の行
  だけを対象にする(過去分は欠けた状態で始まり、今後のpushから正確になる)

## 3. ダッシュボードの構成(4軸)

| 軸 | データ源 | 集計粒度 | 完全性 |
|---|---|---|---|
| コミット数の推移 | `repo_commit_index.committed_at`(本SPECで追加) | リポジトリ×日 | 追加日以降は完全、それ以前はNULL(欠落) |
| 変更ファイル数・頻出ファイル | `commit_file_changes` | リポジトリ×日、ファイル別 | 段階的バックフィルのため部分的(閲覧済み分のみ) |
| 作業Topic(キーワード) | `commit_summary_topics`/`commit_summary_topic_links`経由で`ai_summary_log.created_at`と結合 | リポジトリ×日、Topic別 | AI要約パイプライン成功分のみ(既知のgapあり、CLAUDE.md参照) |
| テスト品質の推移 | `jev_test_score_trend`系(既存、コミット順) | リポジトリ×コミット順 | 評価実行済みコミットのみ |

いずれの軸も「完全な記録ではない」点を前提にする。欠落を隠さず、
グラフ上は「データが無い期間」として素直に空白にする(偽の0件と混同しない)。

## 4. 配置

- **modal**: `/status`ページ(D1テーブル一覧・保存データモーダルの画面)に、
  既存の`tokenUsageModal`(`/aichat`)と同じ実装パターンで「活動ダッシュボード」
  ボタン+モーダルを追加する。`/status`はすでに全テーブルの行数・スキーマを
  横断的に見せる画面であり、「システムの活動統計」という文脈に合う
- **将来のページ昇格に備えた分離**: データ取得・集計ロジックは
  モーダルのDOM生成コードと分離した関数(`buildCommitActivitySummary()`等、
  純粋関数としてテスト可能な形)に切り出す。モーダルを開いたら
  `fetch('/api/commit-activity-summary?...')`を呼ぶ構成とし、将来
  `/commit-activity`のような独立ページを作る場合もこのAPIをそのまま使える

## 5. 新規APIエンドポイント案

`GET /api/commit-activity-summary?repoName=&since=&until=`(本体Worker、
ログイン必須、既存の管理画面系エンドポイントと同じ認可)。

レスポンス例:
```json
{
  "repoName": "nekoserver/dynamicneko",
  "daily": [
    { "date": "2026-10-14", "commitCount": 12, "fileChangeCount": 8, "topics": ["Clef", "tree-view"] }
  ],
  "topFiles": [ { "filePath": "src/server.ts", "changeCount": 5 } ],
  "testScoreTrend": [ { "commitHash": "abc1234", "seqNum": 101, "issueCount": 3 } ]
}
```

(フィールド名・粒度は実装時に調整可。本SPECでは「4軸を1レスポンスで返す」
という構造のみ固定する)

## 6. 将来の権限分離・マルチテナント対応を見据えた設計上の留意点

今回実装はしないが、後から権限分離・マルチテナント対応に着手する際に
設計のやり直しが要らないよう、以下を今のうちに守る。

- **集計APIは必ず`repoName`(または明示的なリポジトリ一覧)でスコープする。**
  「全リポジトリ横断でまとめて1クエリ」のような、リポジトリ境界を暗黙に
  跨ぐ実装をしない。将来「このユーザーはこのリポジトリ群しか見れない」
  という制約を足すとき、`repoName`単位の絞り込みが既にAPIの境界になって
  いれば、呼び出し元でアクセス可能なリポジトリ一覧を絞るだけで済む
- **認可チェックを「ログイン済みなら誰でも全データ閲覧可」という前提で
  固定しない。** 現状はログインチェックのみで良いが、認可判定をエンドポイント
  内に分散させず、`requireSession`相当の1箇所([将来]`requireRepoAccess`的な
  関数)に差し替えられる形で呼ぶ
- **D1クエリに`repo_name`以外の暗黙のグローバル前提を混ぜない。**
  例えば「このWorkerのユーザーは全員nekoserver配下しか見ない」という
  前提をSQL文字列や定数配列に直接埋め込まない(CLAUDE.mdルール36と同じ
  理由: 対象の集合は将来変わりうる)
- 上記を守っておけば、後日「リポジトリ→テナント(契約単位)」の対応表を
  1枚追加するだけで、今回作るAPI群の構造を変えずにマルチテナント化できる
  見込みが立つ

## 7. 決定事項(2026-10-15、ユーザー承認: 「今できる範囲だけでいいからその方向でまとめて」)

- `repoName`は**必須**(6章のリポジトリ境界の原則と整合させる。省略して
  全リポジトリ横断で返す経路は作らない)
- グラフの見た目は既存`tokenUsageGraph`と同じSVGバー形式を流用する
- `rust-worker-sqlx-d1`固有の`/sqlx-d1-examples`系データは5軸目に含めない
  (4軸のみで今回は完結させる)

## 8. `repo_commit_index.committed_at`の段階的バックフィル(2026-10-15追記)

**対象**: dynamicnekoの`GET /api/tree-view/commits`(フォルダ/ファイル単位の
コミット履歴モーダルが呼ぶ、GitHub Commits APIの`path`絞り込み済みエンドポイント)、
本体Workerの新規書き込み用エンドポイント、`GET /api/commit-activity-summary`の
バックフィル達成度指標。

### 背景

`committed_at`追加(7章以前)は今後のpushからしか正確にならず、既存コミットは
`NULL`のまま残る。全履行をGitHub APIで一括バックフィルする案(`git log`で
全コミットの日時を取得しUPDATE文を生成)を検討したが、ユーザーから
「全体じゃなくてフォルダ単位の検出/自動バックフィルぐらいはあってもいいか」
という指摘を受け、方針を変更した。

`/api/tree-view/commits`は既にGitHub Commits APIから`date`(コミット日時)を
取得済みであり([dynamicneko] `TreeViewCommitEntry.date`)、これに便乗すれば
追加のAPI呼び出し無しで`repo_commit_index.committed_at`を埋められる
(`/api/tree-view/commit-files`への便乗と全く同じパターン、SPEC.dynamicneko.20261015.md参照)。
ユーザーがtree-viewでフォルダ・ファイルの履歴を開くたびに、そのスコープの
コミットだけ段階的に埋まっていく。

### 設計

1. **本体Worker**: `POST /api/repo-commit-committed-at-external`(新規)。
   `{ userToken, repoName, commits: [{ commitHash, committedAt }] }`を受け取り、
   `UPDATE repo_commit_index SET committed_at = ? WHERE repo_name = ? AND commit_hash = ? AND committed_at IS NULL`
   を各コミットに対して実行する。既に埋まっている行は上書きしない
   (`committed_at IS NOT NULL`なら無視。push webhook由来の値を壊さない)。
   認証は既存の`-external`系と同じ(Bearer + userToken)
2. **dynamicneko**: `GET /api/tree-view/commits`のレスポンス構築後、
   `c.executionCtx.waitUntil()`で上記エンドポイントへ非同期中継する。
   中継の成否はこのエンドポイント本来のレスポンスに一切影響させない
   (`/api/tree-view/commit-files`の中継と同じ設計)

### バックフィル達成度指標

`GET /api/commit-activity-summary`のレスポンスに`backfillCoverage`を追加する。

```json
{
  "backfillCoverage": { "totalCommits": 191, "committedAtFilled": 42, "ratio": 0.22 }
}
```

- `totalCommits`: `repo_commit_index`の該当`repoName`の全行数
- `committedAtFilled`: `committed_at IS NOT NULL`の行数
- `ratio`: `committedAtFilled / totalCommits`(`totalCommits`が0なら`0`)
