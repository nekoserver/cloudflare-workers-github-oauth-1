# SPEC: cloudflare-workers-github-oauth-1 修正箇所一覧（2026-03-17）

本ドキュメントは 2026-03-17 に `cloudflare-workers-github-oauth-1` リポジトリに加えられた修正・追加の仕様をまとめたものである。

---

## 1. コミットヒートマップカレンダー

**対象**: `GET /api/repositories/:owner/:repo/commits-calendar` エンドポイント、`src/views/repositories.ts` のリポジトリモーダル内カレンダーUI、D1 `commit_calendar_cache` テーブル — リポジトリごとの月単位コミット数をカレンダー形式で視覚化し、過去月のデータを D1 にキャッシュして GitHub API 呼び出しを削減する。

### 背景
リポジトリの活動状況を直感的に把握する手段がなかった。GitHub の草（コントリビューショングラフ）に相当する機能をリポジトリ単位で提供し、過去月のデータはキャッシュにより高速表示を実現する必要があった。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/index.ts` | `/api/repositories/:owner/:repo/commits-calendar` エンドポイント追加。D1 キャッシュの読み書きロジック実装 |
| `src/utils/github.ts` | `getGitHubRepoCommitsByMonth()` 関数追加。GitHub API で指定月のコミット数を日別に集計 |
| `src/views/repositories.ts` | リポジトリモーダル内にヒートマップカレンダー UI 実装。5段階の色分け、前月/翌月ナビゲーション、合計コミット数表示。リポジトリ選択時のみ遅延読み込み |
| `migrations/0005_create_commit_calendar_cache.sql` | `commit_calendar_cache` テーブル作成（owner, repo, year, month, day, commit_count） |
| `src/views/settings.ts` | `cookieHeader`/`timezone` 重複宣言バグを修正（`resolvedTimezone` にリネーム） |

### 関連コミット
- [`522663c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/522663c) feat: リポジトリモーダルにコミットヒートマップカレンダーを追加
- [`83f9555`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/83f9555) fix: settingsルートの cookieHeader/timezone 重複宣言を修正
- [`8d87031`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8d87031) refactor: ヒートマップをリポジトリ選択時のみ遅延読み込みに変更
- [`321195e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/321195e) feat: 過去月のコミットカレンダーデータをD1にキャッシュ

---

## 2. キャッシュ状況ページ (/status)

**対象**: `GET /status` エンドポイント、`src/views/status.ts` — D1 に保存されたキャッシュデータの集計を可視化する管理ページ。コミットキャッシュのリポジトリ別・月別集計、GitHub App インストール権限キャッシュ一覧、ユーザーセッション設定の分布を表示する。

### 背景
D1 に蓄積されるキャッシュデータの量や分布を確認する手段がなく、運用・デバッグ時にデータの状態把握が困難だった。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/index.ts` | `/status` ハンドラ実装。D1 から各種集計クエリを実行しビューに渡す |
| `src/views/status.ts` | 新規作成。コミットキャッシュ集計テーブル、インストール権限キャッシュ一覧、セッション設定分布を表示 |
| `src/views/repositories.ts`, `settings.ts`, `userinfo.ts`, `welcome.ts` | ドロップダウンメニューに「キャッシュ状況」リンクを追加 |

### 関連コミット
- [`650a16e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/650a16e) feat: キャッシュ状況ページ (/status) を追加
- [`2a26e1f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/2a26e1f) fix: リポジトリ一覧取得エラーにステータスコードを含めて表示

---

## 3. キャッシュデータのユーザー分離とマルチテナント対応

**対象**: D1 `commit_calendar_cache` テーブルの `user_id`/`workspace_id` カラム、`teams`/`workspaces`/`team_members` テーブル、`src/utils/workspace.ts` — 個人利用からマルチテナント対応へ移行し、キャッシュデータをユーザー → チーム → ワークスペースの 3 階層で厳格に分離する。

### 背景
キャッシュデータにユーザー識別子がなく、他人のデータが混在して集計に含まれる問題があった。さらに将来的なチーム・ワークスペース対応の基盤が必要だった。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `migrations/0006_add_user_id_to_commit_calendar_cache.sql` | `commit_calendar_cache` に `user_id` カラム追加 |
| `migrations/0007_create_teams_and_workspaces.sql` | `teams`, `workspaces`, `team_members` テーブル作成。`user_sessions` に `current_workspace_id` カラム追加。`commit_calendar_cache` を `user_id` → `workspace_id` に移行 |
| `src/utils/workspace.ts` | 新規作成。`getCurrentWorkspace()`, `getUserWorkspaces()`, `ensureDefaultWorkspace()`, `switchWorkspace()` を実装 |
| `src/index.ts` | `/api/workspaces`（一覧）, `/api/workspaces/switch`（切替）エンドポイント追加。キャッシュ読み書きに `user_id`/`workspace_id` フィルタを適用。OAuth コールバック時にデフォルトチーム+ワークスペース自動プロビジョニング |
| `src/views/status.ts` | ログイン中ユーザーのデータのみ表示するよう修正 |

### 関連コミット
- [`401fbd0`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/401fbd0) fix: キャッシュデータをユーザー単位に分離し他人の集計を排除
- [`24be2e8`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/24be2e8) feat: チーム・ワークスペースによるネームスペース分離を導入

---

## 4. ナイトモード（ダークテーマ）

**対象**: `src/utils/theme.ts`（テーマユーティリティ）、`POST /api/settings/theme` エンドポイント、全ビューファイル — システム全体に一貫したダーク/ライトテーマ切り替え機能を追加し、ユーザー設定を Cookie で永続化する。

### 背景
夜間利用時の視認性向上やユーザーの好みに応じたテーマ切り替え機能が求められていた。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/utils/theme.ts` | 新規作成。`getThemeCSS()`, `getThemeInitScript()`, `getThemeToggleHTML()`, `getThemeToggleCSS()`, `getThemeToggleScript()` を提供 |
| `src/index.ts` | `POST /api/settings/theme` エンドポイント追加 |
| `src/views/login.ts`, `welcome.ts`, `settings.ts`, `userinfo.ts`, `status.ts`, `repositories.ts`, `session-expired.ts` | CSS 変数化（ハードコード色 → `var(--text-primary)` 等）、ナビバーにテーマトグルボタン追加 |

### 注意事項
- テーマ設定は `user_theme` Cookie（非 HttpOnly）で永続化される
- FOUC 防止のため `<head>` 内で初期化スクリプトを実行し、描画前にテーマを適用する

### 関連コミット
- [`9813605`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/9813605) feat: ナイトモード (ダークテーマ) トグルを全ページに追加

---

## 5. リポジトリ一覧の timezone 未定義バグ修正

**対象**: `/repositories` ハンドラ内の `timezone` 変数 — `formatTimestampWithTimezone()` に渡す `timezone` が未定義だったバグの修正。

### 背景
リポジトリ一覧ページで `timezone` 変数が定義されておらず、タイムスタンプのタイムゾーン変換が正しく動作していなかった。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/index.ts` | `/repositories` ハンドラで Cookie/D1 セッションから `timezone` を取得する処理を追加 |

### 関連コミット
- [`77a25df`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/77a25df) fix: リポジトリ一覧で timezone が未定義だったバグを修正

---

## 6. ステータスページ拡張（テーブル別マイグレーション状況・ユーザーコンテキスト）

**対象**: `/status` ページの「テーブル別マイグレーション状況」セクションおよび「ユーザーコンテキスト」セクション — D1 テーブルの存在確認・レコード数・対応マイグレーション番号を一覧表示し、ログインユーザーの所属チーム・ワークスペース・ロールを表示する。

### 背景
マイグレーション適用状況をテーブル単位で確認する手段がなく、ワークスペース導入後にユーザーの所属コンテキストを把握する UI も不足していた。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/index.ts` | 各テーブルの `SELECT COUNT(*)` による存在確認・レコード数取得、ユーザーのチーム・ワークスペース・ロール情報取得クエリを追加 |
| `src/views/status.ts` | テーブル別マイグレーション状況セクション（テーブル名、レコード数、対応マイグレーション番号）、ユーザーコンテキストセクション（所属チーム・ワークスペース・ロール・ID）を追加。`CacheStatusData` 型に `tables`, `userContext` フィールド追加 |

### 関連コミット
- [`c47b70c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c47b70c) feat: ステータスページにテーブル別マイグレーション状況とユーザーコンテキストを追加

---

## 7. 別アカウントでログイン機能

**対象**: `GET /auth/switch` および `GET /auth/github?prompt=switch` エンドポイント、全ページのドロップダウンメニュー — GitHub OAuth の強制ログイン画面表示（`login=""` パラメータ）を利用して、別の GitHub アカウントへの切り替えを実現する。

### 背景
GitHub OAuth は Google のようなアカウントピッカーを提供しないため、ログイン済みアカウントから別アカウントに切り替える手段がなかった。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/index.ts` | `/auth/switch` エンドポイント追加（セッションクリア → GitHub OAuth 再認証）。`/auth/github` ハンドラで `prompt=switch` パラメータ時に `login=""` を付与して GitHub 認証画面を強制表示 |
| `src/views/repositories.ts`, `settings.ts`, `status.ts`, `userinfo.ts`, `welcome.ts` | ドロップダウンメニューに「別アカウントでログイン」リンクを追加 |
| `src/views/settings.ts` | Danger Zone セクションに「このアプリへの承認を取り消す」ボタンを追加（一時的な配置変更の過程で） |

### 注意事項
- UI 配置は 3 段階で変遷した：ドロップダウン → 設定ページ Danger Zone → ドロップダウン復帰（最終形）
- GitHub OAuth の `login=""` パラメータが強制ログイン画面表示のキーとなる

### 関連コミット
- [`0924502`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/0924502) feat: ドロップダウンメニューに「別アカウントでログイン」を追加
- [`f508f02`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f508f02) refactor: 「別アカウントでログイン」をドロップダウンから設定ページのDanger Zoneに移動
- [`cfa08f5`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/cfa08f5) feat: 全ページのドロップダウンに「別アカウントでログイン」を追加

---

## 8. カレンダーの日付タップでコミット詳細モーダルを表示

**対象**: `GET /api/repositories/:owner/:repo/commits-by-date` エンドポイント、`src/views/repositories.ts` のコミット詳細モーダル — ヒートマップカレンダーの日付クリック時に、その日のコミット一覧（メッセージ、著者、時刻、SHA）をモーダルで表示する。

### 背景
ヒートマップカレンダーでコミット数は確認できたが、具体的なコミット内容を確認するには GitHub に遷移する必要があった。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/index.ts` | `/api/repositories/:owner/:repo/commits-by-date?date=YYYY-MM-DD` エンドポイント追加 |
| `src/utils/github.ts` | `getGitHubRepoCommitsByDate()` 関数追加。GitHub API の `since`/`until` パラメータで日付範囲内のコミットを取得 |
| `src/views/repositories.ts` | コミット詳細モーダルの HTML/CSS/JS 実装。メッセージ、著者名、タイムスタンプ、短縮 SHA を表示 |

### 関連コミット
- [`015bf65`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/015bf65) feat: カレンダーの日付タップでコミット詳細モーダルを表示

---

## 9. コミット一覧機能（最終コミット一覧ボタン・モーダル・ページネーション）

**対象**: `GET /api/repositories/:owner/:repo/recent-commits` エンドポイント、`src/views/repositories.ts` のコミット一覧モーダル、`src/views/settings.ts` の表示件数設定 — リポジトリ選択時に直近 N 件のコミットを日付グループ別に表示し、ページネーションと表示件数のカスタマイズに対応する。

### 背景
リポジトリの最近のコミット履歴を確認するには GitHub に遷移する必要があり、アプリ内で完結する閲覧手段が求められていた。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/index.ts` | `/api/repositories/:owner/:repo/recent-commits?count=N&page=P` エンドポイント実装。GitHub API の Link ヘッダーから総コミット数を抽出 |
| `src/utils/github.ts` | `getRecentCommits()` 関数追加。Link ヘッダーパース関数を実装し、総ページ数・総コミット数を取得 |
| `src/views/repositories.ts` | リポジトリモーダル内に「コミット一覧」ボタン（表示件数/総数バッジ付き）追加。日付グループ別コミット一覧モーダル、ページネーション（上部配置、ページ番号/総ページ数表示）実装 |
| `src/views/settings.ts` | 表示件数設定 UI 追加（5〜100 件、デフォルト 20 件）。Cookie `user_recent_commits_count` で永続化 |

### 関連コミット
- [`f911f22`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f911f22) feat: リポジトリ選択時に「最終コミット一覧」ボタンとモーダルを追加
- [`10bffcb`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/10bffcb) feat: コミット一覧に件数表示・表示件数変更リンク・ページネーションを追加
- [`6237ad5`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6237ad5) feat: コミット一覧ボタンに表示件数/総数を表示、表示件数変更をモーダル内に移動、ページネーションを上部に配置

---

## 10. Markdown プレビューページ (/md-preview)

**対象**: `GET /md-preview` エンドポイント、`src/views/markdown-preview.ts` — `.md` ファイルのリアルタイム編集・プレビュー機能を提供する専用ページ。Edit/Preview/Split の 3 タブ、ローカルファイル読込・ダウンロード、ドラッグ&ドロップに対応する。

### 背景
手順書やドキュメントの Markdown 編集・プレビューを行うには外部ツールが必要だった。アプリ内で完結する編集環境が求められていた。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/index.ts` | `GET /md-preview` ハンドラ追加 |
| `src/views/markdown-preview.ts` | 新規作成（697 行）。3 タブ機能（Edit/Preview/Split）、ツールバー（ファイル読込・ダウンロード）、D&D 対応、`markdown-it` ライブラリによる HTML 変換、テーマ CSS 変数統合、レスポンシブデザイン |

### 関連コミット
- [`2e3f1a4`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/2e3f1a4) feat: Markdown プレビューページを追加 (/md-preview)
