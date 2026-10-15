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

## 6. この段階で決めないこと(次の確認が必要な論点)

- `repoName`省略時に全リポジトリ横断で返すか、1リポジトリ指定必須にするか
- グラフの具体的な見た目(`tokenUsageGraph`と同じSVGバー形式を流用するか)
- `rust-worker-sqlx-d1`固有の`/sqlx-d1-examples`系データを5軸目として
  含めるかどうか(本SPECの4軸には含めていない)
