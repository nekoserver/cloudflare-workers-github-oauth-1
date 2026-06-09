# リポジトリページ 分析レポート

**対象**: `GET /repositories` ページ(`src/views/repositories.ts`)および関連 API エンドポイント・GitHub Webhook・D1 テーブル — 認証後のメインダッシュボードであるリポジトリ一覧ページの全体像を整理し、構成・データフロー・機能・テスト状況・改善余地を記録する。

- 作成日: 2026-06-09
- 対象リビジョン: main(PR #542 マージ後)時点のソースコード

---

## 1. 概要

| 項目 | 値 |
|---|---|
| URL パス | `/repositories` |
| 認証 | 必須(`optionalAuthMiddleware` 経由、未認証は `/` へリダイレクト) |
| 本体ファイル | `src/views/repositories.ts`(6,979行) |
| 生成関数 | `getRepositoriesPage(user)`(L35) |
| バックエンド | Cloudflare Workers + Hono + GitHub API + D1 |

GitHub OAuth 認証後のメインダッシュボード。ユーザーがアクセス可能なリポジトリの一覧に加え、GitHub App インストール権限・外部サービス連携状況(Cloudflare / Vercel / Slack)・コミット履歴・コミット検索履歴・ラベル分類などを1ページで管理する。

---

## 2. ルーティング(関連エンドポイント)

ルート定義はすべて `src/index.ts` 内。

| メソッド | パス | 行 | 役割 |
|---|---|---|---|
| GET | `/repositories` | L5255 | リポジトリ一覧ページ HTML 生成 |
| GET | `/api/repo-permissions` | L9268 | インストール権限の最新データを JSON 返却(D1 優先、API フォールバック) |
| POST | `/webhook/github` | L5555 | GitHub App インストール/権限変更 Webhook 受信・D1 保存(署名検証あり) |
| GET | `/api/repositories/:owner/:repo/issues-count` | L6006 | Issue+PR 件数取得 |
| GET | `/api/repositories/:owner/:repo/commits` | L6035 | コミット履歴取得 |
| GET | `/api/repositories/:owner/:repo/commit-stats` | L6090 | ユーザー別コミット統計(D1 キャッシュ) |
| GET | `/api/repositories/:owner/:repo/commit-months` | L6193 | 月別コミット統計 |
| GET | `/api/repositories/:owner/:repo/commits-by-month` | L6390 | 月別コミット詳細 |
| GET | `/api/repositories/search/repo-keywords` | L7188 | リポジトリ内共起キーワード一覧 |
| GET | `/api/repositories/search/repo-list` | L7222 | 検索履歴に登場したリポジトリ名一覧 |
| GET | `/api/repositories/search/history` | L7246 | コミット検索履歴一覧 |
| POST | `/api/repositories` | L9568 | リポジトリ新規作成 |

---

## 3. データソースと同期の仕組み

### ページロード時(`GET /repositories`)

| データ | 取得元 |
|---|---|
| リポジトリ一覧 | GitHub API(`getGitHubUserRepos()`) |
| 各リポジトリの最新コミット | GitHub API(`getGitHubLatestCommit()`、`Promise.all` で並列取得) |
| インストール権限 | **D1 優先**(`installation_permissions`、L5301)→ データがなければ GitHub API(`buildRepoInstallationPermissionsMap()`)へフォールバック |
| Cloudflare / Vercel 連携 | `getExternalServiceLinkedRepos(accessToken)` |
| Slack 連携 | `getSlackLinkedReposByWebhooks(accessToken, userId, repoNames)` |

### Webhook によるリアルタイム同期(`POST /webhook/github`)

GitHub App のインストール・権限変更イベントを受信し、署名検証後に D1 `installation_permissions` を更新する(L5600-5656)。

- 対応イベント: `installation`, `installation_repositories`
- 対応アクション: `created`, `deleted`, `new_permissions_accepted`, `suspend`, `unsuspend`
- `repo_name` が NULL のレコードは「All repositories」インストールを表す(`repository_selection='all'`)

これによりページ表示時に GitHub API を呼ばず、D1 から高速に権限データを返せる設計になっている。

---

## 4. D1 テーブル

### `installation_permissions`(`migrations/0004_create_installation_permissions.sql`)

| カラム | 型 | 説明 |
|---|---|---|
| `id` | INTEGER PK | |
| `installation_id` | INTEGER | GitHub App インストール ID |
| `repo_name` | TEXT | リポジトリ名(NULL は All repositories) |
| `repository_selection` | TEXT | `all` または `selected` |
| `permissions` | TEXT | JSON 形式の権限辞書(例: `{"contents":"read"}`) |
| `updated_at` | TEXT | 更新日時 |

インデックス: `(installation_id, repo_name)` UNIQUE、`(updated_at)`。

そのほか、コミット統計キャッシュ・コミット検索履歴・リポジトリ色割当て・`cloudflare_setup_pending`(新規作成リポジトリのセットアップ通知)などのテーブルを API 経由で読み書きする。

---

## 5. 主な機能一覧

1. **リポジトリ一覧表示** — 所有者・名前・説明・言語・スター数・フォーク数・更新日時・private/public バッジ・最新コミットへのリンク
2. **外部連携バッジ** — Cloudflare / Vercel / Slack の連携状況を行内バッジで表示
3. **権限モーダル** — GitHub App インストール権限と OAuth スコープの表示、Zanzibar アクセス制御ツリー表示
4. **Issue+PR 件数** — 行内 pill バッジに動的取得して表示
5. **コミット履歴モーダル** — 月別セレクト、マージフィルタ(マージ以外/のみ/すべて)、共起キーワードタグフィルタ、ユーザー別統計
6. **コミット検索履歴モーダル** — 対象リポジトリセレクト、ラベルフィルタ(feature/ui/tech/database/bugfix/ops/未分類)、インクリメンタルサーチ(Cookie `history_incr_search` で状態保持)、共起キーワードハイライト
7. **リポジトリ色割当て** — 色コード+タグ付け、グループフィルタによる色別表示
8. **リポジトリ新規作成** — オーナー(user/org)選択・private/public 選択フォームから GitHub API で作成
9. **Cloudflare セットアップ通知** — 新規作成リポジトリを `cloudflare_setup_pending` に登録し、バナー+モーダルでセットアップを誘導
10. **ラベル分類管理** — コミットへの手動マルチラベル付与、カテゴリグループ編集

---

## 6. フロントエンド構造

単一 HTML 文字列(CSS・JS 込み、約7,000行)を生成する。

| 領域 | 内容 |
|---|---|
| ナビバー | ブランド表示、ユーザーアイコン+ドロップダウン(設定/ステータス/ログアウト) |
| ページヘッダー | タイトル・件数、エラーバナー、スコープ欠如バナー、Cloudflare セットアップバナー、コミット検索入力欄 |
| リポジトリリスト | グリッドレイアウトの行(`repo-row`)。タイトル+バッジ群+説明+メタ情報(言語・スター・フォーク・更新日時・Issue件数 pill・最新コミットリンク) |
| モーダル群 | `permissionsModal`(権限+ヒートマップ)、`colorAssignModal`、`commitHistoryModal`、`searchHistoryModal`、`createRepoModal`、`cfSetupModal`、`zanzibarModal` ほか |

### JavaScript の主要関数

- モーダル管理: `openPermissionsModal()` / `openColorAssignModal()` / `openCommitHistoryModal()` / `openHistoryModal()` 等
- 権限描画: `renderInstallPerms()` / `renderOAuthPerms()` / `startHeatmapForRepo()`
- コミット検索: `loadCommitCoKeywords()` / `applyCommitKeywordFilter()` / `fetchCommitMonthsAndInit()` / `renderCommitHistoryContent()`
- 検索履歴: `populateRepoSelect()` / `loadRepoFilter()` / `applyRepoHighlight()` / `getIncrementalFilteredItems()`
- ラベルフィルタ: `activeLabels`(Set)+ `activateAllLabels()`
- 共通: `showToast()` / `getCookie()` / `setCookie()`

### ダークモード対応

`getThemeInitScript()` による初期化と CSS 変数(`--bg-primary` 等)の `data-theme` 切り替えで対応(CLAUDE.CSS.md のルールに準拠)。

---

## 7. 主要エクスポート

| ファイル | エクスポート | 役割 |
|---|---|---|
| `src/views/repositories.ts` | `getRepositoriesPage(user)` | ページ HTML 全体を生成 |
| `src/views/repositories.ts` | `RepositoryListItem`(interface, L7) | 一覧行のデータ型 |
| `src/views/repositories.ts` | `RepoPermissionInfo`(interface, L20) | 権限情報の型 |
| `src/views/repositories.ts` | `CloudflareSetupPendingItem`(interface, L25) | セットアップ通知の型 |
| `src/utils/github.ts` | `buildRepoInstallationPermissionsMap(accessToken)` | GitHub API から権限マップ構築 |
| `src/index.ts`(内部) | `getInstallationPermissionsFromD1(db)`(L2221) | D1 から権限読み込み |

---

## 8. テストカバレッジ

`src/views/repositories.test.ts`(534行)。主なテーマ:

| テーマ | 内容 |
|---|---|
| コミット履歴モーダル | 共起キーワードタグ UI 要素・関数の存在、初回ロード0件時の月セレクト自動切り替え |
| 検索履歴モーダル | インクリメンタルサーチ(Cookie 参照)、対象リポジトリセレクト、共起ハイライト、`repo_hit_count` ソート |
| ラベルフィルタ | ボタン群・`activeLabels` 管理・件数表示更新 |
| ページ基本構造 | 主要 UI 要素の存在、埋め込み JS の構文チェック(`new Function()` によるパース) |
| カテゴリグループ | 作成・更新・削除後の `cachedGroups = null; loadGroupList()` パターン |

テストは「HTML 文字列に要素・関数が含まれるか」の静的検証が中心で、イベントハンドラの実動作(DOM 操作)は未検証。

---

## 9. 問題点・改善余地

1. **インライン JS の肥大化** — 本体6,979行の大半が埋め込み CSS/JS で、ページペイロードが大きい。コード分割・遅延ロードの検討余地
2. **Webhook 更新とページ表示の不整合** — Webhook が D1 を更新してもページ再読み込みまで旧権限が表示される。`/api/repo-permissions` を使ったクライアント側の再取得・ポーリングで緩和可能
3. **API フォールバック失敗時の通知不足** — D1 にデータがなく GitHub API も失敗した場合はログのみで、ユーザーへの通知がない(CLAUDE.md ルール8の「通知」観点)
4. **GitHub API 呼び出しの並列度** — 最新コミット取得を `Promise.all` で全リポジトリ並列実行しており、リポジトリ数が多いとレート制限に抵触しやすい。バッチ化・キャッシュの検討余地
5. **テストの実動作検証不足** — `new Function()` による構文チェック止まりで、イベントバインドや DOM 更新の検証がない。jsdom 等による検証強化の余地
6. **`installation_permissions` の全件 JSON parse** — 読み込み時に `permissions` カラムを全件 parse しており、インストール数増加時に非効率になりうる
7. **OAuth スコープ警告の分かりにくさ** — classic OAuth と GitHub App の権限表示が併存し、`missingScopesBanner` の表示条件がユーザーに伝わりにくい
8. **POST 系 API の CSRF 対策** — `/api/repositories` POST 等で明示的な CSRF トークン検証が見当たらない(Cookie 認証前提のため Origin チェック等の追加を検討)

---

## まとめ

リポジトリページは認証後のメインダッシュボードであり、GitHub API(一覧・コミット・Issue 件数)と D1(Webhook でリアルタイム同期される `installation_permissions`、コミット統計・検索履歴キャッシュ)を組み合わせた構成になっている。権限管理・色割当て・コミット検索・ラベル分類と機能が豊富な一方、インライン JS の肥大化、Webhook 更新のクライアント反映、API フォールバック失敗時の通知、テストの実動作検証が主な改善ポイントである。
