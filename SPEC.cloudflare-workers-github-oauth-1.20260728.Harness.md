# SPEC: D1テーブル登録レジストリの完全性を守るharness（vitestテスト + PostToolUseフック + D1ログ）

## 1. 決定の経緯（Skill / コード化 / harnessフックの比較）

**対象**: このリポジトリで「D1に新しいテーブルを作った後、関連レジストリへの登録を忘れる」という
再発パターンをどう防ぐか、という設計判断そのもの。Claude Code Skills・アプリケーションレベルの
コード（vitestテスト）・harnessのPostToolUseフックの3つの選択肢を比較検討した結果を記録する。

### 背景

`src/index.ts` には、D1の新テーブルを作った際に手動で登録しなければならないレジストリが
5つ存在する（`STATUS_TABLE_DEFINITIONS` / `TABLE_COLUMN_KEYS` / `TABLE_GROUP_MAP` /
`COLUMN_FK_TARGETS` / `STATUS_MIGRATION_SQL`）。登録漏れが起きると `/status` ページの
テーブル一覧・ER図・SQL提示機能が部分的に壊れる。実際に本セッション中の調査で、
`heritage_ai_question_masters`（migration 0065）・`heritage_question_view_log`（0066）・
`heritage_area_boxes`（0072）・`heritage_area_items`（0073）の4テーブルが、最大4種類の
レジストリで登録漏れを起こしていたことが確認された（詳細は「3. 修正内容」参照）。

なお `/status` ページには既に「未知テーブルの自動検出」という**実行時**のセーフティネットが
存在する（[`SPEC.cloudflare-workers-github-oauth-1.NEWTABLE_CHECK.md`](./SPEC.cloudflare-workers-github-oauth-1.NEWTABLE_CHECK.md)）。
しかしこれは「本番D1に実テーブルが存在するのに定義が無い」ことを**事後的に**検知する仕組みであり、
ユーザーが実際に不完全な表示を目にした後にしか気づけない。今回追加するのは、その手前・
**開発時点**でレジストリ登録漏れを止める仕組みである。

### 検討した3案

| 案 | 発火タイミング | 長所 | 短所 |
|---|---|---|---|
| Claude Code Skill化 | エージェントの意味的マッチング（`SKILL.md`の`description`とタスク文脈の類似度） | 手順書として読みやすい、他エージェントにも再利用しやすい | **イベント駆動ではない**。「テーブル作成後」という確実なタイミングで発火する保証が無く、エージェントが気づかなければ発火しない |
| アプリレベルのコード化（vitestテスト） | `npx vitest run`（push前に必須実行）のタイミングで毎回全件チェック | 環境非依存で確実に効く。CIやpush前ゲートに自然に組み込める。既存の`ts_function_catalog`インデクサと同じ「ツールで担保する」思想に合致 | エージェントがテストを書き忘れる／pushの直前まで気づかない（=手戻りが大きい） |
| harnessのPostToolUseフック | migrationファイルへの`Edit`/`Write`直後に**必ず**発火（harnessが保証） | エージェント本人が気づく前、その場で即座にフィードバックできる。設定ファイルが割り込むツール名でスコープされる | フック自体はツール呼び出し完了後の通知に過ぎず、**既に完了した書き込みを取り消せない**（`decision:"block"`はターン停止のみ） |

### 決定: vitestテスト + PostToolUseフックの併用

どちらか一方ではなく **両方を採用** した。理由:

- vitestテストは「最後の砦」（push前に必ず走る、環境非依存、CIでも同じ結果になる）
- PostToolUseフックは「早期警告」（テーブルを作った直後にその場でエージェントへ知らせるため、
  vitest実行まで待たずに同じセッション内で直せる）
- 両者は同じロジック（migrations/*.sqlのCREATE TABLE ↔ 3レジストリの突合）を参照するが、
  実装は意図的に分離した（vitestテストはTypeScriptから`src/index.ts`のexportを直接import、
  フックスクリプトは高速起動のため素のNode.js CommonJSで正規表現ベースの軽量チェック）。
  フック側はあくまで早期警告であり、正式な合否判定はvitestテスト側が担う。
- Skillは不採用。理由は「イベント駆動としての発火保証が無い」ため、今回のような
  「特定のファイル変更に対して確実に反応してほしい」要件には向かないと判断した
  （Skillは「どう調査・実装するか」を示す手順書としては有効だが、今回のような
  自動チェックの主役には据えない）。

### 設定ファイルの配置場所

`.claude/settings.json` は **リポジトリ直下**（プロジェクトレベル設定）に配置し、
`~/.claude/settings.json`（ユーザーレベル、gitで追跡されない）は使わない。
理由: ユーザーレベル設定は他のセッション・他のマシンから見えず、「本当に有効になっているか」
を都度確認しないといけない不透明な状態になる。プロジェクトレベル設定はリポジトリを
cloneした時点で全員（人間・エージェント問わず）に同じ設定が効くため、テストコードと
同じ意味で「差分レビュー可能・再現可能」な形で運用できる。

---

## 2. 対象

**対象**: `src/index.ts` の5レジストリ（`STATUS_TABLE_DEFINITIONS` / `TABLE_COLUMN_KEYS` /
`TABLE_GROUP_MAP` / `COLUMN_FK_TARGETS` / `STATUS_MIGRATION_SQL`）、新規テスト
`src/db-table-registry-completeness-20260728.test.ts`、新規フックスクリプト
`scripts/check-migration-table-registry.js`、新規設定ファイル `.claude/settings.json`、
新規D1テーブル `harness_hook_log`（フック発火ログ、結果フラグ付き）。

## 3. 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/index.ts` | `heritage_ai_question_masters`(0065)・`heritage_question_view_log`(0066)・`heritage_area_boxes`(0072)・`heritage_area_items`(0073) の4テーブルを `STATUS_TABLE_DEFINITIONS`/`TABLE_COLUMN_KEYS`/`TABLE_GROUP_MAP`/`COLUMN_FK_TARGETS`/`STATUS_MIGRATION_SQL` へ登録。`STATUS_TABLE_DEFINITIONS`・`STATUS_MIGRATION_SQL`・`StatusTableDefinition`型をexportに変更（テストからimportするため） |
| `src/index.ts` | `STATUS_MIGRATION_SQL['0063']` が2回定義されていた重複バグ（TS1117コンパイルエラー）を発見・修正。片方（`ai_chat_shares.source`用ALTER TABLE）はどのmigrationファイルにも対応せず、既に本番投入済みで永久に到達不能な死んだコードだったため削除 |
| `migrations/0082_create_unresolved_station_keywords.sql`（新規） | レジストリ上はmigration 0082として存在していたが対応するmigrationファイルが存在しなかったため追加（`IF NOT EXISTS`のため安全に再実行可） |
| `migrations/0083_create_harness_hook_log.sql`（新規） | harness/フック発火ログ用テーブル。`result`列（`ok`/`ng`/`error`）が結果フラグ |
| `src/index.ts` | `harness_hook_log` を5レジストリすべてへ登録 |
| `src/db-table-registry-completeness-20260728.test.ts`（新規） | `migrations/*.sql`のCREATE TABLE一覧と5レジストリを突合する完全性テスト（6件）。regression確認済み（該当行を一時的に削除→red、復元→green） |
| `scripts/check-migration-table-registry.js`（新規） | PostToolUseフック本体。migrationファイルへの`Edit`/`Write`直後に発火し、レジストリ登録漏れを検知したら`stderr`へ警告を出し(`exit code 2`)、結果を`harness_hook_log`へ記録（D1書き込み失敗時は`.claude/harness-hook-log-fallback.jsonl`へフォールバック保存し`stderr`で通知） |
| `src/check-migration-table-registry-20260728.test.ts`（新規） | フックスクリプトの純粋関数部分（抽出・突合・SQLエスケープ・フォールバック記録）のユニットテスト（12件） |
| `.claude/settings.json`（新規、リポジトリ直下） | `PostToolUse`フックを`Edit`/`Write`にマッチさせ、上記スクリプトを起動する設定 |

### `harness_hook_log` テーブル定義

```sql
CREATE TABLE IF NOT EXISTS harness_hook_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hook_event TEXT NOT NULL,
  check_name TEXT NOT NULL,
  tool_name TEXT,
  file_path TEXT,
  result TEXT NOT NULL,
  detail TEXT,
  session_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_harness_hook_log_created ON harness_hook_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_harness_hook_log_result ON harness_hook_log(result, created_at DESC);
```

`result` は `'ok'`（登録漏れなし）/ `'ng'`（登録漏れ検知）/ `'error'`（チェック自体が失敗、
例: `src/index.ts` が読めない）の3値。

## 4. 動作確認

- `echo '<PostToolUse payload>' | node scripts/check-migration-table-registry.js` で
  未登録テーブルを含むmigrationファイル・登録済みのmigrationファイル・migrations以外の
  ファイルの3パターンを手動実行し、期待通りの`exit code`（2/0/0）と`stderr`出力を確認済み
- D1書き込み（`wrangler d1 execute --remote`）は本環境に`CLOUDFLARE_API_TOKEN`が無いため
  常に失敗するが、その場合に`.claude/harness-hook-log-fallback.jsonl`へ正しくフォールバック
  記録されることを確認済み（ルール8の「記録・通知」義務を満たす）
- `npx vitest run` 全体実行、`npx tsc --noEmit` エラー0件を確認済み

## 5. 注意事項

- フックスクリプトは高速化のため`tsx`を使わず素のNode.js CommonJSで書いている。
  `Edit`/`Write`は多数呼ばれるため、対象外ファイル（migrations以外）は即座にreturnして
  早期リターンする設計にしている
- フックの`exit code 2`は「ターンを止めない非ブロッキングエラー」としてClaude側にstderrが
  見える形で伝わる想定（харness仕様）。既に完了したファイル書き込み自体を取り消すことはできない
- D1へのログ書き込みはこの開発環境では`CLOUDFLARE_API_TOKEN`が無いため常にフォールバックへ
  回る。ユーザーのローカル環境（`wrangler`認証済み）で実行された場合は`harness_hook_log`
  テーブルへ直接記録される
- 正式な合否判定はあくまで `src/db-table-registry-completeness-20260728.test.ts`
  （`npx vitest run`）。フックは早期警告であり、フックが未設定/無効化されていても
  vitestテストが最終防波堤として機能する

## 6. 関連コミット

このSPEC・実装一式は同一のプルリクエストに含まれる一連のコミットとして追加された。
個別コミットハッシュは、ルール24の手順に従い `repo_commit_index` を更新する際に
このセクションへ追記する。
