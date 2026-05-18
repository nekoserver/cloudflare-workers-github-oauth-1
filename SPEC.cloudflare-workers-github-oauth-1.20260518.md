# SPEC.cloudflare-workers-github-oauth-1.20260518

2026-05-18（日本時間）に `claude/auto-fit-er-diagram-vrYgS` ブランチへコミットした全変更をコミットハッシュとともにまとめる。

---

## コミット一覧（時系列昇順）

| # | コミットハッシュ | JST | 件名 |
|---|---|---|---|
| 1 | [`399e80cc`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/399e80cc5a776251c392c112d16393fb31cca5cd) | 08:37 | ER図に「フォーカス／俯瞰」トグルボタンを追加 |
| 2 | [`c2103abb`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c2103abbdcf716acd0e46f1c24600b0226f2a814) | 08:49 | コミット履歴モーダルの月別セレクトを当月デフォルト選択に変更 |
| 3 | [`c738b518`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c738b518c37d50adfde67e03417b2a0edaa9d4f9) | 09:06 | /status の2つのER図モーダルにフォーカス／俯瞰トグルを追加 |
| 4 | [`75ffff24`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/75ffff242cbd1afabfef2f1b6779c0f83a6614e5) | 11:44 | コミット履歴モーダルにstatsボタンを追加しユーザー別集計モーダルを表示 |
| 5 | [`fc91a9ad`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/fc91a9ad1e6dd7e89a9852089908edf7f9ffde22) | 12:08 | stats モーダル: D1キャッシュAPIでコミット統計を取得・表示 |
| 6 | [`d62a973e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d62a973eb07f73cfff86a06a30e80f756ae8f4ae) | 12:50 | getGitHubCommitsForStats の since/until パラメータをパーセントエンコードしない形式に修正 |
| 7 | [`33acca06`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/33acca068359d8ad03ccd9a6e59e752dda9cc2b7) | 13:21 | コミット集計テーブルの文字色をテーマ変数化してダークモードで読めるようにする |
| 8 | [`3861c218`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3861c21815cf0f2c380db469f873bd92b6bc6fc1) | 13:23 | CSS/UI スタイリングルールを CLAUDE.CSS.md に切り出す |
| 9 | [`6ce82e44`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6ce82e44efa0016dc08c363f303c40827c073a1c) | 13:24 | Revert "getGitHubCommitsForStats の since/until パラメータをパーセントエンコードしない形式に修正" |
| 10 | [`db3d149c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/db3d149cc0aa432c217e073c432d9806e83b1acc) | 13:35 | コミット集計モーダルに集計対象リポジトリ名とデータソース表示を追加 |
| 11 | [`7e3fd883`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7e3fd88321045e5993bfbf9a1260af42883451be) | 13:49 | フィルタ済み ER図モーダルのタイトルを選択テーブルのグループ名に変更 |
| 12 | [`43e3ad8d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/43e3ad8d2ffc66b587d161a60b069a6a764369f3) | 14:18 | コミット履歴モーダルをキャッシュDB駆動の月別ロードに刷新 |
| 13 | [`22e104df`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/22e104dfec917b1bcb9fcb25f781c57d97338a8d) | 19:51 | コミット履歴セレクトボックスを cache-first 月別 total_count フィルタに変更 |
| 14 | [`357408d6`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/357408d60736a54d87bceaf17f8a2787dbd58529) | 20:05 | コミット履歴セレクトボックスの「すべて」を復活し、月一覧取得プロセスを可視化 |
| 15 | [`26cf0a64`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/26cf0a64e0f375acff56f9dd1fb3a28568c7a618) | 20:11 | ALTER TABLE 後の既存キャッシュ行を再取得して total_count を整合させる |
| 16 | [`d062a708`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d062a708396ff56be1bf70abd8701ff7b1966da6) | 20:36 | 月別コミット量チャートに件数順/日付順トグルを追加 |

---

## 1. ER図に「フォーカス／俯瞰」トグルボタンを追加

**対象**: `/repositories` ページの ER図モーダル（`src/views/repositories.ts`）— ER図モーダルに「フォーカス」「俯瞰」トグルボタンを追加し、選択中テーブルに紐づくノードのみ拡大表示するフォーカスモードと全体を表示する俯瞰モードを切り替えられるようにする。

### 背景

テーブル数が多い場合に全体俯瞰では各テーブルの詳細が読みにくいため、選択テーブルに絞ったフォーカス表示が必要だった。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/views/repositories.ts` | ER図モーダルにフォーカス／俯瞰トグルボタンを追加 |
| `src/views/repositories.ts` | フォーカスモード時は選択テーブルと直接関連するノードのみ描画 |

### 関連コミット

- [`399e80cc`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/399e80cc5a776251c392c112d16393fb31cca5cd) — ER図に「フォーカス／俯瞰」トグルボタンを追加

---

## 2. コミット履歴モーダルの月別セレクトを当月デフォルト選択に変更

**対象**: `/repositories` ページのコミット履歴一覧モーダル（`src/views/repositories.ts`）の月別セレクトボックス — セレクトボックスの初期選択を「すべて」から「当月（YYYY-MM）」に変更し、モーダルオープン時に当月のコミット一覧が即座に表示されるようにする。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/views/repositories.ts` | セレクトボックスの初期選択値を当月の YYYY-MM 形式に変更 |

### 関連コミット

- [`c2103abb`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c2103abbdcf716acd0e46f1c24600b0226f2a814) — コミット履歴モーダルの月別セレクトを当月デフォルト選択に変更

---

## 3. /status のER図モーダルにフォーカス／俯瞰トグルを追加

**対象**: `/status` ページの「全テーブル ER図」「フィルタ済み ER図」両モーダル（`src/views/status.ts`）— ER図モーダルにフォーカス／俯瞰トグルボタンを追加する（repositories ページと同等の機能を status ページにも適用）。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/views/status.ts` | 全テーブル ER図モーダルにフォーカス／俯瞰トグルを追加 |
| `src/views/status.ts` | フィルタ済み ER図モーダルにフォーカス／俯瞰トグルを追加 |

### 関連コミット

- [`c738b518`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c738b518c37d50adfde67e03417b2a0edaa9d4f9) — /status の2つのER図モーダルにフォーカス／俯瞰トグルを追加

---

## 4. コミット履歴モーダルにstatsボタンを追加しユーザー別集計モーダルを表示

**対象**: `/repositories` ページのコミット履歴一覧モーダル（`src/views/repositories.ts`）と新規コミット集計モーダル — コミット履歴一覧モーダルに「stats」ボタンを追加し、ユーザー別コミット集計を別モーダルで表示できるようにする。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/views/repositories.ts` | コミット履歴モーダルに「stats」ボタンを追加 |
| `src/views/repositories.ts` | コミット集計モーダルの HTML 骨格・CSS・JS を追加 |
| `src/views/repositories.ts` | stats ボタンクリック時にモーダルを開き `/api/.../commit-stats` を呼び出す |

### 関連コミット

- [`75ffff24`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/75ffff242cbd1afabfef2f1b6779c0f83a6614e5) — コミット履歴モーダルにstatsボタンを追加しユーザー別集計モーダルを表示

---

## 5. stats モーダル: D1キャッシュAPIでコミット統計を取得・表示

**対象**: `GET /api/repositories/:owner/:repo/commit-stats` エンドポイント（`src/index.ts`）と D1 `commit_stats_cache` テーブル — cache-first パターンでユーザー別コミット件数・マージ承認件数を取得し、コミット集計モーダルに表示する。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/index.ts` | `GET /api/repositories/:owner/:repo/commit-stats` エンドポイントを新設 |
| `src/index.ts` | `commit_stats_cache` を参照し、未キャッシュなら GitHub API から取得して書き込む |
| `src/views/repositories.ts` | `renderCommitStatsFromData(data, monthFilter)` 関数を追加、集計テーブルを描画 |

### 関連コミット

- [`fc91a9ad`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/fc91a9ad1e6dd7e89a9852089908edf7f9ffde22) — stats モーダル: D1キャッシュAPIでコミット統計を取得・表示

---

## 6. URLエンコード修正（後にrevert）

**対象**: `src/index.ts` の `getGitHubCommitsForStats` 関数 — GitHub API の `since`/`until` パラメータに含まれる `:` を `URLSearchParams` によってパーセントエンコードしないよう修正する試みを行ったが、それが根本原因ではなかったため直後に revert した。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/index.ts` | `since`/`until` パラメータを手動でクエリ文字列に連結する形式に変更 |

### 備考

- URL エンコードは GitHub API 側で適切に処理されており、このコミットは原因解決に寄与しなかった
- コミット [`6ce82e44`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6ce82e44efa0016dc08c363f303c40827c073a1c) にて revert 済み
- 根本原因は CSS の固定濃色によるダークモード表示崩れだった（次項参照）

### 関連コミット

- [`d62a973e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d62a973eb07f73cfff86a06a30e80f756ae8f4ae) — getGitHubCommitsForStats の since/until パラメータをパーセントエンコードしない形式に修正
- [`6ce82e44`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6ce82e44efa0016dc08c363f303c40827c073a1c) — Revert "getGitHubCommitsForStats の since/until パラメータをパーセントエンコードしない形式に修正"

---

## 7. コミット集計テーブルの文字色をテーマ変数化してダークモード表示を修正

**対象**: `src/views/repositories.ts` のコミット集計モーダルのテーブル CSS — ダークモード時にテーブル本文の文字色が背景色と同化して読めなくなっていた問題を修正する。

### 背景

- stats モーダルを開いてもテーブル本文が何も表示されない不具合が報告された
- スクリーンショットを確認すると「サマリー行は見えるがテーブル tbody が空」という状態だった
- 原因: `tbody td { color: #2d3748 }` という固定濃色がダークモードのモーダル背景と同化し、文字が見えなくなっていた
- ヘッダーは固定背景色を持つため見えていたが、tbody はモーダル背景をそのまま引き継ぐため不可視になった

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/views/repositories.ts` | コミット集計テーブル全体の固定色を `var(--text-primary)` 等 CSS テーマ変数に置き換え |

### 関連コミット

- [`33acca06`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/33acca068359d8ad03ccd9a6e59e752dda9cc2b7) — コミット集計テーブルの文字色をテーマ変数化してダークモードで読めるようにする

---

## 8. CSS/UIスタイリングルールを CLAUDE.CSS.md に切り出す

**対象**: 新規ファイル `CLAUDE.CSS.md` と `CLAUDE.md` — 今後の CSS スタイリングにおけるダークモード表示崩れを防止するためのルールを明文化し、専用ファイルに切り出す。

### 背景

今回の「stats モーダルに何も表示されない」不具合の根本原因が CSS の固定色だったことを教訓として、再発防止ルールを文書化した。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `CLAUDE.CSS.md` | 新規作成。固定色禁止・CSS変数使用・ダークモード目視確認・スクリーンショット優先確認等のルールを記載 |
| `CLAUDE.md` | `CLAUDE.CSS.md` への参照リンクと「CSS を書く前に読め」の注意書きを追加 |

### CLAUDE.CSS.md の主なルール

- CSS に固定色（`#xxxxxx`、`rgb()`、`hsl()`）を使うな。必ず `var(--text-primary)` 等のテーマ変数を使う
- スクリーンショットを受け取ったら最初にそれを Read ツールで読め。コードを読むな
- ダークモードを目視確認してから完了と報告せよ
- 過去のやらかしパターン（ヘッダーは見えるが本文が見えない）を記録

### 関連コミット

- [`3861c218`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3861c21815cf0f2c380db469f873bd92b6bc6fc1) — CSS/UI スタイリングルールを CLAUDE.CSS.md に切り出す

---

## 9. コミット集計モーダルへの集計対象リポジトリ名・データソース表示追加

**対象**: `src/views/repositories.ts` のコミット集計モーダル — 集計対象リポジトリが操作手順内で指定されているにもかかわらずモーダル内に表示されていなかった。またデータがキャッシュ（D1）から取得されたものか GitHub API から取得されたものかが不明だった。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/views/repositories.ts` | モーダルに `commitStatsRepo`（集計対象リポジトリ名）要素を追加 |
| `src/views/repositories.ts` | モーダルに `commitStatsSource`（D1 / GitHub API）要素を追加 |
| `src/views/repositories.ts` | `renderCommitStatsFromData(data, monthFilter, owner, repoName)` に引数を追加し両要素を描画 |

### 表示内容（モーダル内）

```
集計対象リポジトリ : nekoserver/cloudflare-workers-github-oauth-1
D1 キャッシュから取得 / GitHub API から取得（リアルタイム）
```

### 関連コミット

- [`db3d149c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/db3d149cc0aa432c217e073c432d9806e83b1acc) — コミット集計モーダルに集計対象リポジトリ名とデータソース表示を追加

---

## 10. フィルタ済み ER図モーダルのタイトルをグループ名列挙に変更

**対象**: `src/views/status.ts` の `window.openFilteredUmlModal` 関数 — 「フィルタ済み ER図」という固定文言を、選択テーブルが属するグループ名の列挙に変更する。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/views/status.ts` | `tableGroupMap`（テーブル→グループキーのマップ）を JS 変数として埋め込み |
| `src/views/status.ts` | `groupLabels`（グループキー→表示ラベルのマップ）を JS 変数として埋め込み |
| `src/views/status.ts` | `openFilteredUmlModal` 内でグループキーを集計し表示ラベルに変換、タイトルを動的生成 |

### 表示例

| 選択テーブル | 変更前 | 変更後 |
|---|---|---|
| commit 系のみ | フィルタ済み ER図 (3 テーブル) | commit (3 テーブル) |
| commit + config 混在 | フィルタ済み ER図 (5 テーブル) | commit / config (5 テーブル) |

### 関連コミット

- [`7e3fd883`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7e3fd88321045e5993bfbf9a1260af42883451be) — フィルタ済み ER図モーダルのタイトルを選択テーブルのグループ名に変更

---

## 11. コミット履歴モーダルをキャッシュDB駆動の月別ロードに刷新

**対象**: `GET /api/repositories/:owner/:repo/commit-months`（新規）、`GET /api/repositories/:owner/:repo/commits-by-month`（新規）、`src/views/repositories.ts` のコミット履歴モーダル全体 — セレクトボックスをキャッシュDB問い合わせ結果から生成し、月選択ごとに cache-first でコミット一覧を取得するアーキテクチャに刷新する。

### 背景

- 従来はモーダルオープン時に `/commits?per_page=500` で最近500件を取得し、そのコミットの `authoredDate` から月を抽出してセレクトを生成していた
- 月を変えてもコミット一覧は変わらず、ヒートマップのみ切り替わるだけだった
- キャッシュが有効活用されていなかった

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/index.ts` | `GET /commit-months`: `commit_calendar_cache` 内の過去月 + 当月を返すエンドポイントを新設 |
| `src/index.ts` | `GET /commits-by-month`: cache-first でその月のコミット一覧を返し、未キャッシュなら `commit_calendar_cache` / `commit_list_cache` / `commit_stats_cache` に一括書き込み |
| `src/views/repositories.ts` | `fetchCommitHistory` → `fetchCommitMonthsAndInit` + `fetchCommitsByMonth` に分割 |
| `src/views/repositories.ts` | 月変更時にモーダルを閉じずコミット一覧のみ再ロード |
| `src/views/repositories.ts` | `commitHistoryTotal` 欄をデータソース表示（D1 / GitHub API）に転用 |

### 関連コミット

- [`43e3ad8d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/43e3ad8d2ffc66b587d161a60b069a6a764369f3) — コミット履歴モーダルをキャッシュDB駆動の月別ロードに刷新

---

## 12. コミット履歴セレクトボックスを cache-first 月別 total_count フィルタに変更

**対象**: `GET /api/repositories/:owner/:repo/commit-months`、`migrations/0031_add_total_count_to_commit_calendar_cache.sql`（新規）、`src/utils/github.ts`（純粋関数追加）、`src/utils/github.test.ts`（テスト追加）— セレクトボックスはリポジトリ作成月〜(当月-1) の全月について `commit_calendar_cache` にキーが存在しかつ `total_count > 0` の月のみ表示する。

### 新規追加

- `getGitHubRepoInfo({ owner, repo, accessToken })`: リポジトリの `created_at` を GitHub API から取得
- `sumCountsTotal(counts)`: counts JSON（`{"YYYY-MM-DD": N, ...}`）の合計を返す純粋関数
- `buildPastMonthRange(createdYM, currentYM)`: 作成月〜(当月-1) の月一覧を降順生成する純粋関数
- テスト: `sumCountsTotal` 4件・`buildPastMonthRange` 6件（計375件全パス）
- migration 0031: `commit_calendar_cache` に `total_count INTEGER NOT NULL DEFAULT 0` カラム追加

### migration SQL

```sql
ALTER TABLE commit_calendar_cache ADD COLUMN total_count INTEGER NOT NULL DEFAULT 0;
UPDATE commit_calendar_cache SET total_count = (SELECT COALESCE(SUM(CAST(je.value AS INTEGER)), 0) FROM json_each(commit_calendar_cache.counts) je) WHERE total_count = 0;
```

### 関連コミット

- [`22e104df`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/22e104dfec917b1bcb9fcb25f781c57d97338a8d) — コミット履歴セレクトボックスを cache-first 月別 total_count フィルタに変更

---

## 13. コミット履歴セレクトボックスの「すべて」復活・月一覧取得プロセスを可視化

**対象**: `GET /api/repositories/:owner/:repo/commit-months`、`src/views/repositories.ts` — リファクタ時に誤削除された「すべて」選択肢を復活させ、キャッシュ確認プロセスの診断情報をモーダル内に表示する。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/index.ts` | `/commit-months` レスポンスに `details` オブジェクトを追加（status / repoCreatedMonth / candidatesCount / cacheHits / fetched / fetchErrors / pastMonthsWithCommits / cacheReadError / repoInfoError） |
| `src/views/repositories.ts` | 「すべて」選択肢を復活（`value=""` → 従来の `/commits?per_page=N` を呼ぶ） |
| `src/views/repositories.ts` | `renderCommitMonthsDetails(details)` 関数を追加、`commit-history-months-details` 要素に診断情報を表示 |
| `src/views/repositories.ts` | `loadCommitsForSelectedValue(owner, repoName, repoKey, period)`: 期間に応じて `fetchAllCommits` か `fetchCommitsByMonth` を振り分け |

### 診断情報の表示例（モーダル内）

```
状態: ok / 作成月: 2024-12 / 対象月: 17 / キャッシュHIT: 0 / GitHub取得: 17 / コミット有: 12
```

### 関連コミット

- [`357408d6`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/357408d60736a54d87bceaf17f8a2787dbd58529) — コミット履歴セレクトボックスの「すべて」を復活し、月一覧取得プロセスを可視化

---

## 14. ALTER TABLE 後の既存キャッシュ行を再取得して total_count を整合させる

**対象**: `migrations/0031_add_total_count_to_commit_calendar_cache.sql`、`src/index.ts` の `/commit-months` エンドポイント — migration 0031 適用直後の既存行は `total_count = 0`（DEFAULT）となり、実際にはコミットがある月も 0 件扱いされる不整合を2層のセーフティネットで解消する。

### 問題

- `ALTER TABLE` で `total_count` カラムを追加すると、既存行はすべて `total_count = 0`（DEFAULT）になる
- セレクトボックスは `total_count > 0` の月のみ表示するため、既存キャッシュが全件 `0` だとセレクトが空になる

### 対策

**1. マイグレーション SQL にバックフィル UPDATE を追加**

```sql
ALTER TABLE commit_calendar_cache ADD COLUMN total_count INTEGER NOT NULL DEFAULT 0;
UPDATE commit_calendar_cache SET total_count = (SELECT COALESCE(SUM(CAST(je.value AS INTEGER)), 0) FROM json_each(commit_calendar_cache.counts) je) WHERE total_count = 0;
```

**2. アプリ側で不整合検出 → 再取得**

- `/commit-months` で `total_count = 0` かつ `counts` JSON の合計 > 0 の行を不整合と判定
- 該当行を未キャッシュ扱いとして GitHub API から再取得し、各キャッシュテーブルを上書き
- `details.inconsistentRefetched` フィールドで再取得件数を可視化

### 関連コミット

- [`26cf0a64`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/26cf0a64e0f375acff56f9dd1fb3a28568c7a618) — ALTER TABLE 後の既存キャッシュ行を再取得して total_count を整合させる

---

## 15. 月別コミット量チャートに件数順/日付順トグルを追加

**対象**: `src/views/status.ts` の「月別コミット量」セクション、`src/views/settings.ts` の設定ページ、`POST /api/settings/status-chart-sort-order`（新規）— 月別コミット量の横棒グラフに件数順/日付順のトグルボタンを追加し、Cookie と設定ページで並び順を永続化できるようにする。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/index.ts` | `/status` と `/settings` の Cookie 読込に `user_status_chart_sort_order` を追加 |
| `src/index.ts` | `POST /api/settings/status-chart-sort-order` エンドポイントを新設 |
| `src/views/status.ts` | `statusChartSortOrder` インターフェースと初期値解決ロジックを追加 |
| `src/views/status.ts` | `sortByOrder()` ヘルパーで初期描画時のソートを統一 |
| `src/views/status.ts` | タイトル横に `.chart-sort-toggle` トグルボタンを追加、クリック時に Cookie 更新 + `renderCommitChart` 再描画 |
| `src/views/status.ts` | gradient / repo 両モードで `currentChartSortOrder` を参照するよう `renderCommitChart` を修正 |
| `src/views/settings.ts` | 「月別コミット量のトグル状態」設定項目を追加（セレクト + 保存/キャンセルボタン） |
| `src/views/settings.ts` | `toggleStatusChartSortOrderEdit` / `onStatusChartSortOrderChange` / `saveStatusChartSortOrder` / `cancelStatusChartSortOrder` 関数を追加 |

### Cookie

| Cookie名 | 値 | 意味 |
|---|---|---|
| `user_status_chart_sort_order` | `count`（デフォルト） | 総コミット数 降順 |
| `user_status_chart_sort_order` | `date` | 年月 昇順 |

### 並び順の挙動

| sort order | gradient モード | repo モード |
|---|---|---|
| `count`（デフォルト） | 総コミット数 DESC | 総コミット数 DESC |
| `date` | yearMonth ASC | yearMonth ASC |

### 関連コミット

- [`d062a708`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d062a708396ff56be1bf70abd8701ff7b1966da6) — 月別コミット量チャートに件数順/日付順トグルを追加

---

## PR 一覧

| PR番号 | タイトル | 状態 |
|---|---|---|
| [#260](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/260) | ER図に「フォーカス／俯瞰」トグルボタンを追加 | マージ済み |
| [#261](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/261) | コミット履歴モーダルに stats ボタンを追加しユーザー別集計モーダルを表示 | マージ済み |
| [#262](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/262) | コミット集計テーブルのダークモード表示修正・CSS ルール策定 | マージ済み |
| [#263](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/263) | フィルタ済み ER図モーダルのタイトルをグループ名表示に変更 | マージ済み |
| [#264](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/264) | コミット履歴モーダルをキャッシュDB駆動の月別ロードに刷新 | マージ済み |
| [#265](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/265) | コミット履歴セレクトボックスを cache-first 月別 total_count フィルタに変更 | マージ済み |
| [#266](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/266) | セレクトボックスの「すべて」復活・診断情報可視化・ALTER後の整合性回復 | マージ済み |
| [#267](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/267) | 月別コミット量チャートに件数順/日付順トグルを追加 | オープン |
