# SPEC: cloudflare-workers-github-oauth-1 修正箇所一覧（2026-03-16）

本ドキュメントは 2026-03-16 に `cloudflare-workers-github-oauth-1` リポジトリに加えられた修正・追加の仕様をまとめたものである。

---

## 1. GitHub App Install App フローのコールバック対応

**対象**: `GET /github/callback` エンドポイント — GitHub App の Install App フロー経由で返されるコールバックが、既存の OAuth 認証フロー（state/PKCE 検証）と衝突して state 不一致エラーになる問題の修正。

### 背景
GitHub App の「Install App」フローでは、コールバックが `/github/callback?setup_action=install` として返される。このフローには `state` パラメータが存在せず、既存の OAuth 認証フロー（state/PKCE 検証あり）に入ると state 不一致エラーとなっていた。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/index.ts` | `/github/callback` ハンドラの先頭で `setup_action=install` を判定し、state/PKCE 検証をスキップする分岐を追加。ログイン済み（`auth_token` クッキーあり）なら `/welcome` へ、未ログインなら `/` へリダイレクト |
| `README.md` | Install App フローのコールバック仕様について注意事項を追記 |

### 関連コミット
- [`ba4cbc1`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ba4cbc1) fix: GitHub App Install Appフローでstate不一致エラーになる問題を修正

---

## 2. スコープ不足時の再認証フローとUI

**対象**: `/repositories` ページおよび `GET /auth/github/reauthorize` エンドポイント — OAuth トークンに `repo` スコープが含まれていない場合にユーザーが気づいて再認証できる仕組みの追加。

### 背景
OAuth トークンに `repo` スコープが含まれていない場合、プライベートリポジトリが取得できない。ユーザーが不足スコープに気づき、再認証できる仕組みが必要だった。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/index.ts` | 新規エンドポイント `GET /auth/github/reauthorize` を追加。既存の OAuth グラントを GitHub API で取り消し（`DELETE /applications/{client_id}/grant`）、認証クッキーを削除した上で `/auth/github` へリダイレクト |
| `src/index.ts` | `/repositories` ハンドラで `getGitHubTokenScopes()` を呼び出し、トークンのスコープ情報を取得してビューに渡す |
| `src/views/repositories.ts` | スコープ不足時に黄色い警告バナー（`missing-scope-banner`）を表示。「権限を追加して再認証」ボタンから `/auth/github/reauthorize` へ遷移 |

### 関連コミット
- [`3abcd07`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3abcd07) feat: スコープ不足時の再認証フローとUIを追加

---

## 3. リポジトリ行タップで権限モーダルを表示

**対象**: `/repositories` ページのリポジトリ詳細モーダル — 各リポジトリに対してどの GitHub App インストール権限が有効かをユーザーが確認できる UI の追加。

### 背景
各リポジトリに対してどの権限が有効かをユーザーが確認できるUIが不足していた。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/views/repositories.ts` | リポジトリ行（`.repo-row`）クリックで権限モーダル（`#permissionsModal`）を表示する機能を追加。モーダルには以下を表示: |
| | - リポジトリ名・説明・メタ情報（言語・スター・フォーク・最新コミット等） |
| | - 権限一覧（Contents / Issues / Pull Requests / Secrets / ユーザー情報）の有効/無効状態 |
| | - 各権限で可能な操作のチェックリスト |
| | - 無効な権限には「権限を追加 →」リンクを表示 |
| | - 付与スコープのフッター表示 |
| `src/views/repositories.ts` | `.repo-row` に `data-description`, `data-language`, `data-stars`, `data-forks`, `data-private`, `data-commit-sha`, `data-commit-url` 属性を追加（モーダル表示用データ） |

### 関連コミット
- [`aec3ef4`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/aec3ef4) feat: リポジトリ行タップで権限モーダルを表示
- [`a0e5e49`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a0e5e49) feat: 設定ページのセクション名変更とモーダルにリポジトリ概要を表示

---

## 4. リポジトリページのアクセストークン取得改善

**対象**: `/repositories` ハンドラのアクセストークン取得ロジック — D1 に保存されたトークンがない場合に JWT ペイロード内のトークンにフォールバックする修正。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/index.ts` | `/repositories` ハンドラのアクセストークン取得にフォールバックを追加: `userSession.githubAccessToken ?? user.github_access_token ?? undefined` |

### 関連コミット
- [`7f5e9c4`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7f5e9c4) fix: リポジトリページでJWTフォールバックのアクセストークンを使用

---

## 5. D1 データベース有効化と診断エンドポイント

**対象**: `wrangler.toml` の D1 バインディング設定、および `GET /api/debug/d1` 診断エンドポイント — コメントアウト状態で無効だった D1 データベースの有効化と動作確認手段の整備。

### 背景
D1 データベースバインディングがコメントアウト状態で無効だった。有効化後の動作確認のため、診断エンドポイントも追加した。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `wrangler.toml` | `[[d1_databases]]` セクションのコメントを解除し、`database_id = "abbe590b-..."` を設定 |
| `package.json` | マイグレーションスクリプトを `wrangler d1 migrations apply` 方式に変更。全マイグレーションファイルを個別実行する `db:migrate:remote:manual` スクリプトを追加 |
| `src/index.ts` | 新規エンドポイント `GET /api/debug/d1`（認証必須）を追加。テーブル存在確認、カラム一覧、ユーザーレコード確認、テスト書き込み、レコード数カウントを実行 |

### 関連コミット
- [`e5a4763`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e5a4763) feat: D1データベースバインディングを有効化
- [`89b99a3`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/89b99a3) fix: D1マイグレーションスクリプトを全ファイル対応に修正
- [`2e424f2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/2e424f2) feat: D1接続診断エンドポイント /api/debug/d1 を追加
- [`c98a14d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c98a14d) debug: D1診断エンドポイントにテスト書き込みを追加

---

## 6. 設定ページの文言変更

**対象**: `/settings` ページの GitHub OAuth セクション見出し — セクションタイトルをユーザーにとってわかりやすい表現に変更。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/views/settings.ts` | セクションタイトルを `"GitHub OAuth"` → `"このアプリに付与済みの権限"` に変更 |

### 関連コミット
- [`a0e5e49`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a0e5e49) feat: 設定ページのセクション名変更とモーダルにリポジトリ概要を表示

---

## 7. ドキュメント整備

**対象**: `CLAUDE.md` / `README.md` / `NOTICE` / `HISTORY` — NOTICEファイル運用ルールの制定、Install App フローの注意事項記載、コミット履歴の整理。

| ファイル | 変更概要 |
|---|---|
| `CLAUDE.md` | NOTICEファイル運用ルール（命名規則・記載対象・運用方針）を追加 |
| `README.md` | Install App フローのコールバック分岐に関する注意事項を追記 |
| `NOTICE.cloudflare-workers-github-oauth-1.20260316.md` | Install App 後にプライベートリポジトリを表示する手順を記載 |
| `HISTORY.cloudflare-workers-github-oauth-1.latest.md` | 3/14〜3/16 のコミット履歴を追記、全コミットに GitHub リンクを追加 |

### 関連コミット
- [`3e6cfb7`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3e6cfb7) docs: NOTICEファイル運用ルールをCLAUDE.mdに追加
- [`f73b5fc`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f73b5fc) docs: Install Appフローのコールバック分岐について重要事項をREADMEに追記
- [`9e95acb`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/9e95acb) docs: Install App後にプライベートリポジトリを表示する手順をNOTICEに記載
- [`ae639c6`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ae639c6) docs: NOTICEファイルのタイポ修正とIssue #32へのリンク追加
- [`520639d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/520639d) docs: HISTORYに3/14〜3/16のコミット履歴を追記し全コミットにGitHubリンクを追加

---

## 8. GitHub App Webhook によるリアルタイム権限同期

**対象**: `POST /webhook/github` エンドポイント、D1 `installation_permissions` テーブル、`/repositories` および `/api/repo-permissions` の権限データ取得ロジック — GitHub App のインストール権限変更を Webhook 経由でリアルタイムに D1 へ保存し、ページ表示時に GitHub API を呼ばずに高速に権限データを返せるようにする。

### 背景
GitHub App のインストール権限変更を `/repositories` モーダルに反映する際、従来は GitHub API をページ読み込み時に呼び出していたが、API レート制限やレスポンス遅延の問題があった。Webhook で権限変更イベントをリアルタイムに受信し、D1 に保存する方式に変更。

### 注意事項
GitHub App の開発者設定でパーミッションを追加しても、既存インストールには即座に反映されない。オーナーが「Review request」を承認するか、アプリを再インストールする必要がある（GitHub プラットフォーム仕様）。詳細は `NOTICE.cloudflare-workers-github-oauth-1.20260316.md` を参照。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `migrations/0004_create_installation_permissions.sql` | 新規テーブル `installation_permissions` を作成。`installation_id` + `repo_name` のユニークインデックス付き |
| `src/utils/githubWebhook.ts` | GitHub Webhook の HMAC-SHA256 署名検証ユーティリティ。タイミングセーフ比較を実装 |
| `src/index.ts` | `POST /webhook/github` エンドポイントを追加。`installation` / `installation_repositories` イベントを処理し D1 に保存。Slack 通知も実施 |
| `src/index.ts` | `getInstallationPermissionsFromD1()` ヘルパー関数を追加。D1 からインストール権限を読み取り |
| `src/index.ts` | `/repositories` ハンドラを D1 優先・API フォールバックに変更 |
| `src/index.ts` | `/api/repo-permissions` ハンドラを D1 優先・API フォールバックに変更。レスポンスに `source` フィールド追加 |
| `src/index.ts` | Bindings 型に `GITHUB_WEBHOOK_SECRET` を追加 |

### Webhook で処理するイベント

| イベント | アクション | D1 操作 |
|---|---|---|
| `installation` | `created` | レコード挿入（UPSERT） |
| `installation` | `deleted` | レコード削除 |
| `installation` | `suspend` | レコード削除 |
| `installation` | `unsuspend` | レコード挿入（UPSERT） |
| `installation` | `new_permissions_accepted` | レコード挿入（UPSERT） |
| `installation_repositories` | `added` / `removed` | リポジトリ単位で挿入/削除 |

### 環境変数
- `GITHUB_WEBHOOK_SECRET`: `wrangler secret put` で設定（GitHub App の Webhook secret と一致させる）

### 関連コミット
- [`688c22b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/688c22b) feat: GitHub App Webhook受信とD1権限保存、セキュリティSlack通知を実装

---

## 9. 高優先度 Slack セキュリティ通知

**対象**: `src/middleware/auth.ts` の JWT 検証処理、`src/index.ts` の OAuth コールバックおよび GitHub Webhook ハンドラ — ログイン失敗・不審アクセス・GitHub App インストール変更の3種類のセキュリティイベントを Slack へ即時通知する。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/middleware/auth.ts` | JWT 検証失敗時に Slack へセキュリティ警告を送信（IP アドレス・パス・トークンソース付き） |
| `src/middleware/auth.ts` | Bindings 型に `SLACK_OAUTH_TOKEN`, `SLACK_CHANNEL_ID` を追加 |
| `src/index.ts` | OAuth コールバックでの認証エラー時に Slack へログイン失敗通知を送信 |
| `src/index.ts` | GitHub App Webhook の `installation` イベント受信時に Slack へ通知（インストール/アンインストール/権限変更等） |

### 通知タイミング

| 通知種別 | トリガー | 優先度 |
|---|---|---|
| ログイン失敗 | OAuth コールバック catch ブロック | 高 |
| 不審アクセス | JWT 検証失敗（無効トークン） | 高 |
| App インストール変更 | Webhook `installation` イベント | 中 |

### 関連コミット
- [`688c22b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/688c22b) feat: GitHub App Webhook受信とD1権限保存、セキュリティSlack通知を実装
- [`7cd97d4`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7cd97d4) fix: Slack通知のメッセージ形式を自然な日本語文に変更

---

## 10. モーダル UI 改善 — 権限フィルタ・ソート・インストール権限反映

**対象**: `/repositories` ページの権限モーダル（`#permissionsModal`）— GitHub App インストール権限の実データ反映、権限フィルタ・トグル UI、ソート順改善、ページ読み込み時の自動取得を実装。

### 背景
セクション3で追加した権限モーダルは静的な権限一覧のみだった。GitHub App のインストール権限（実データ）をモーダルに反映し、フィルタやソートで使いやすくする必要があった。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/views/repositories.ts` | モーダルに GitHub App インストール権限の実データを反映。`/api/repo-permissions` から非同期取得 |
| `src/views/repositories.ts` | 権限フィルタ（有効のみ / 禁止のみ / すべて）トグルボタンを追加 |
| `src/views/repositories.ts` | 権限表示を「有効→禁止」の順かつアルファベット順にソート |
| `src/views/repositories.ts` | コミット SHA をコミットページへのリンクとして表示 |
| `src/index.ts` | `/api/repo-permissions` ハンドラの改善。インストール権限API の応答改善と診断エンドポイント追加 |
| `src/utils/github.ts` | `getInstallationPermissions()` ユーティリティ関数を追加。GitHub API からインストール権限を取得 |

### 関連コミット
- [`d885f9f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d885f9f) feat: リポジトリモーダルにGitHub Appインストール権限を反映
- [`a65d2d5`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a65d2d5) feat: モーダルUIを改善 - 権限フィルタ・トグル・コミットリンク対応
- [`e4fd4b4`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e4fd4b4) feat: モーダル内の権限表示を有効→禁止の順かつアルファベット順にソート
- [`1a8bf0c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/1a8bf0c) feat: ページ読み込み時にインストール権限の最新データを自動取得
- [`f66113d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f66113d) fix: インストール権限APIの改善と診断エンドポイント追加

---

## 11. Zanzibar 権限モデルのドキュメント化と UI 対応

**対象**: `ZANZIBAR.cloudflare-workers-github-oauth-1.md` ドキュメント、`/repositories` ページの権限モーダル内「Zanzibar タプル表示」「Zanzibar ツリー表示」ボタンおよびモーダル — GitHub App 権限モデルを Google Zanzibar 形式で定義し、モーダルから視覚的に確認できるようにする。

### 背景
GitHub App の権限モデル（`contents:read`, `issues:write` 等）を構造的に理解しやすくするため、Google Zanzibar のリレーションシップタプル形式で表現し、ドキュメントおよびモーダル UI から確認できるようにした。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `ZANZIBAR.cloudflare-workers-github-oauth-1.md` | GitHub App 権限モデルを Zanzibar 形式（namespace 定義、relation 定義、タプル表記）で記述 |
| `src/views/repositories.ts` | 権限モーダルに「Zanzibar タプル表示」ボタンを追加。クリックで Zanzibar タプル一覧モーダルを表示（シンタックスハイライト・コピー機能付き） |
| `src/views/repositories.ts` | 権限モーダルに「Zanzibar ツリー表示」ボタンを追加。クリックでツリー構造モーダルを表示 |
| `src/views/repositories.ts` | Zanzibar ツリーモーダルの縦幅を拡張してコンテンツのはみ出しを防止 |

### 関連コミット
- [`220d9b7`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/220d9b7) docs: GitHub App権限モデルをZanzibar形式で定義
- [`3309c1b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3309c1b) feat: 権限モーダルにZanzibarタプル表示ボタンとモーダルを追加
- [`6ede224`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6ede224) feat: 権限モーダルにZanzibarツリー表示ボタンとモーダルを追加
- [`bfce5a3`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/bfce5a3) fix: Zanzibarツリーモーダルの縦幅を拡張してはみ出しを防止

---

## 12. Slack 通知メッセージの日本語文体変更

**対象**: `src/index.ts` 内の Slack 通知メッセージ — 箇条書き形式だった通知メッセージを自然な日本語文に変更。

### 背景
Slack に送信されるセキュリティ通知・Webhook 通知が箇条書き形式で読みにくかった。自然な日本語の文体に変更して可読性を向上。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/index.ts` | Webhook 受信通知・セキュリティ警告・ログイン失敗通知のメッセージ形式を、箇条書きから自然な日本語文に変更 |

### 関連コミット
- [`7cd97d4`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7cd97d4) fix: Slack通知のメッセージ形式を自然な日本語文に変更

---

## 13. API リファレンス・ドキュメント整備（追加分）

**対象**: `API.cloudflare-workers-github-oauth-1.latest.md` / `CLAUDE.md` / `NOTICE` / `SPEC` — API リファレンスの新規作成、SPEC 記述ルールの制定、コミットハッシュリンクルールの追加。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `API.cloudflare-workers-github-oauth-1.latest.md` | 全エンドポイント・外部 API 連携・ファイル構成を網羅した API リファレンスを新規作成 |
| `API.cloudflare-workers-github-oauth-1.latest.md` | GitHub / Slack / Webhook セクションに分離、Slack 通知タイミング提案を追加 |
| `API.cloudflare-workers-github-oauth-1.latest.md` | Webhook 実装に合わせて全面更新、全コミットハッシュに GitHub リンクを追加 |
| `CLAUDE.md` | SPEC ファイルの「対象」記述ルールを制定 |
| `CLAUDE.md` | コミットハッシュへの GitHub リンク必須ルールを追加 |
| `NOTICE.cloudflare-workers-github-oauth-1.20260316.md` | GitHub App 権限変更が即座に反映されない問題を記載 |
| `SPEC.cloudflare-workers-github-oauth-1.20260316.md` | 各セクションに「対象」記述を追加 |

### 関連コミット
- [`a048fb6`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a048fb6) docs: APIリファレンスを作成 - 全エンドポイント・外部API・ファイル一覧
- [`6d7f484`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6d7f484) docs: APIリファレンスをGitHub/Slack/Webhookセクションに分離、Slack通知タイミング提案を追加
- [`800871f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/800871f) docs: APIリファレンスをWebhook実装に合わせて全面更新
- [`a74119e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a74119e) docs: APIリファレンスの全コミットハッシュにGitHubコミットページへのリンクを追加
- [`1ee46f2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/1ee46f2) docs: GitHub App権限変更が即座に反映されない問題をNOTICEに記載
- [`eef2d4d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/eef2d4d) docs: SPECファイルの各セクションに「対象」記述を追加、記述ルールをCLAUDE.mdに制定
- [`e1c8172`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e1c8172) docs: コミットハッシュへのリンク必須ルールをCLAUDE.mdに追加
- [`7dea79e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7dea79e) docs: 2026-03-16の修正箇所をSPECファイルにまとめて出力

---

## 変更ファイル一覧

| ファイル | 種別 |
|---|---|
| `src/index.ts` | 機能追加・修正（Webhook, D1読み取り, Slack通知, 権限API） |
| `src/middleware/auth.ts` | 機能追加（JWT検証失敗時Slack通知） |
| `src/utils/githubWebhook.ts` | 新規（Webhook署名検証） |
| `src/utils/github.ts` | 新規（インストール権限取得ユーティリティ） |
| `src/views/repositories.ts` | 機能追加（権限モーダル, フィルタ, ソート, Zanzibar表示） |
| `src/views/settings.ts` | 文言変更 |
| `migrations/0004_create_installation_permissions.sql` | 新規（D1マイグレーション） |
| `wrangler.toml` | 設定変更（D1バインディング有効化） |
| `package.json` | スクリプト変更（マイグレーション） |
| `CLAUDE.md` | ドキュメント（SPECルール, コミットリンクルール, NOTICEルール） |
| `README.md` | ドキュメント（Install App注意事項） |
| `API.cloudflare-workers-github-oauth-1.latest.md` | 新規ドキュメント（APIリファレンス） |
| `ZANZIBAR.cloudflare-workers-github-oauth-1.md` | 新規ドキュメント（Zanzibar権限モデル） |
| `NOTICE.cloudflare-workers-github-oauth-1.20260316.md` | 新規ドキュメント（知見・注意事項） |
| `HISTORY.cloudflare-workers-github-oauth-1.latest.md` | ドキュメント更新（コミット履歴） |
| `SPEC.cloudflare-workers-github-oauth-1.20260316.md` | 本ファイル |
