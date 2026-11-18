# NOTICE: エージェントへの問い合わせを記録するデータベース

日付: 2026-11-07

**対象**: D1`agent-inquiries`（ID`ab65ff96-6333-4673-9ad4-4324be622184`、APAC） — BOT同士の問い合わせを記録し、解決した時点で「どの質問を辿ったか」「予備知識があれば早かったか」を読めるようにする。

事例は[NOTICE.cloudflare-workers-github-oauth-1.20261107.md](NOTICE.cloudflare-workers-github-oauth-1.20261107.md)。

## 目的

細かい項目より、次の2つが分かることを優先する（ユーザー指定）。

- 解決した段階で、どんな質問を辿ったか
- 予備知識があれば解決が早かったか

問い合わせは、相手の返事から重要なキーワードを引き出すためにある。有用なキーワードを少ない手数で得られたか、予備知識でその回路自体を無くせるかを見る。

## 設計の判断

| 判断 | 理由 |
|---|---|
| 問答集（`ai_chat_shares`）と別のデータベースにする | BOT同士の会話は人の問答集に混ぜない（ユーザー指定）。コードやサーバーの内部情報も入りやすい |
| 1回の問い合わせを1行にする | 手掛かり、相手、聞き出した情報、前進が1行で読める |
| 失敗と取り下げも行として残す | 無駄だった手も測れる。集計からは取り下げを除く |
| 回答全文を保存する | workerのジョブ記録は1日で消える |
| 判定は解決後にまとめて付ける | 途中では何が省けたか分からない |
| 提案は事実と分ける | 提案は採用、不採用、完了の状態と理由を持つ |

## テーブルとビュー

| 名前 | 内容 |
|---|---|
| `inquiry_cases` | 問題と解決条件。状態（`status`）と段階（`stage`） |
| `inquiry_entries` | 問い合わせ1回。手掛かり、相手、`ask_id`、質問、回答、前進、状態、時間、選んだ根拠 |
| `inquiry_keys` | キー。種類は`known`、`unknown`、`pitfall`。開閉、止まるか、変更を伴うか、依存先 |
| `inquiry_entry_keys` | 問い合わせが狙ったキーと得たキー |
| `inquiry_knowledge` | 予備知識。問題をまたいで使う |
| `inquiry_entry_knowledge` | 質問に添えた予備知識 |
| `inquiry_agent_domains` | 相手と分野、根拠（`access`、`declared`、`measured`） |
| `inquiry_agent_assets` | 相手が抱えているものと、見えるかどうか |
| `inquiry_asset_domains` | 抱えているものの種類と分野の対応 |
| `inquiry_proposals` | 改善提案 |
| `inquiry_case_review` | **解決時に見る表** |
| `inquiry_key_cost` | キーごとの手数と時間 |
| `inquiry_knowledge_effect` | 予備知識ごとの効果 |
| `inquiry_agent_domain_stats` | 相手と分野ごとの実績 |
| `inquiry_hunch_accuracy` | 勘の試行数と当たり数 |
| `inquiry_agent_candidates` | 分野ごとの相手候補 |

スキーマは`migrations-agent-inquiries/`の8ファイル。

## 議題の段階（2026-11-08に追加）

利用者の指定で、議題を段階で区別する。`inquiry_cases.stage`（`0008_add_case_stage.sql`、既定は`concept`）。状態（`status`の`open`・`resolved`・`abandoned`）は議論が終わったかどうかで、段階はその議題の中身がどこまで進んだか。両者は別に変わる（例: 計画の段階で協議が終わり`resolved`になる）。

| `stage` | 表示 | 意味 | 例（2026-11-08時点） |
|---|---|---|---|
| `concept` | 構想 | 具体案に乏しい。何を決めるか、原因は何かから探る | `muse-vm-reboots-20261108` |
| `plan` | 計画 | 一部策定済み、または策定中（SPECの案がある） | `bridge-jobs-queue-20261107`、`muse-vm-dashboard-20261107` |
| `implementation` | 実装 | コードやVMの変更に着手した、または入れた | `nix-packages-20261107` |
| `trial` | 試験運用 | 入れたものを試している、レビューや実機確認を待っている | `muse-status-wasm-20261107`、`proposal-rule-20261108` |

- 段階を変えたエージェントは、その理由を問い合わせの`progress`か提案の`reason`に書く。
- 実装へ進めるのは利用者の承認の後（変更を伴うため）。構想から計画へは協議で進めてよい。
- `/muse-inquiries`のケース一覧と詳細に段階を表示する。

## 問い合わせの進め方

未確認キーは次の順に判定する。

1. 予備知識で閉じる（0手）
2. 手元のコードや文書で閉じる（0手）
3. 分野で一番手数の少ない相手に、予備知識を添えて聞く
4. 得たキーを予備知識に登録する

聞く順番は、止まるものが先、依存されるものが先、解決条件に近いものが先、変更は最後。未確認キーは、問いに実際に答えが返ったときだけ閉じる。回答が返っただけでは閉じない。

## 発議のルール（2026-11-08に採用）

議題（`inquiry_cases`）を新しく作る前に、全期間・全状態の議題を検索し、同一の議題が解決済みにも未解決にも無いことを確かめて、`inquiry_entries`の`seq = 0`に記録する。同一の議題があれば、新しく起こさずにその続きにする。1回の作業で自分から発議するのは20件まで。発議するときは段階（`stage`）も入れる。MuseはD1を読めないので、本体側が代わりに発議する。詳細は[SPEC](SPEC.cloudflare-workers-github-oauth-1.20261108.proposal-rule.md)。

## 勘

「ネームサーバーを抱えているなら`dns`を知っていそう」という推測を候補に出す。根拠は`inferred`で、優先順は`measured`、`access`、`declared`、`inferred`の順。

**抱えていることと、見えていることは別。** worker内のClaudeは同じコンテナのcloudflaredが見えず、トンネル停止と誤答した。`visible = 0`は候補から外す。勘は相手を選ぶだけで、回答を事実扱いする根拠にはしない。

登録済みの候補: `redmine-codex`（進捗、納期、リソース。稼働と可視性は未確認）。`name_server → dns`の対応は登録済みで、ネームサーバーは将来の予定（DoH、DNSSECも試す）。

## 未対応

- キーの自動抽出。AIチャットの`/api/aichat/vectorize-answer`のGemma抽出を流用できるが、指示文は作り直す必要がある（既存は予備知識の抽出）。未検証
- `goal_similarity`は未計算
- 候補の順番を決める処理
- Workerのバインディング、画面、自動記録。今はClaude Codeが手で登録している
- ケースは2件（`nix-packages-20261107`、`muse-status-wasm-20261107`）。相手はどちらもMuseなので、`measured`の比較や手探りとの差はまだ出せない

## 作業上の注意

- D1 MCPのクエリは複数文を送れる。途中で失敗したときに前の文が戻るかは未確認
- ビューは`CREATE VIEW IF NOT EXISTS`では更新されない。依存する順に消して作り直す
- `CHECK`はSQLiteの`ALTER`で足せるのは列の追加時だけ。既存列の制約は変えられない
- 本体リポジトリの規則どおり、`.sql`にコメントを書かない
- Cloudflare Developer Platform MCPは非推奨。後継は`https://mcp.cloudflare.com/mcp`
