# SPEC: cloudflare-workers-github-oauth-1 修正箇所一覧（2026-03-16）

本ドキュメントは 2026-03-16 に `cloudflare-workers-github-oauth-1` リポジトリに加えられた修正・追加の仕様をまとめたものである。

---

## 1. GitHub App Install App フローのコールバック対応

### 背景
GitHub App の「Install App」フローでは、コールバックが `/github/callback?setup_action=install` として返される。このフローには `state` パラメータが存在せず、既存の OAuth 認証フロー（state/PKCE 検証あり）に入ると state 不一致エラーとなっていた。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/index.ts` | `/github/callback` ハンドラの先頭で `setup_action=install` を判定し、state/PKCE 検証をスキップする分岐を追加。ログイン済み（`auth_token` クッキーあり）なら `/welcome` へ、未ログインなら `/` へリダイレクト |
| `README.md` | Install App フローのコールバック仕様について注意事項を追記 |

### 関連コミット
- `ba4cbc1` fix: GitHub App Install Appフローでstate不一致エラーになる問題を修正

---

## 2. スコープ不足時の再認証フローとUI

### 背景
OAuth トークンに `repo` スコープが含まれていない場合、プライベートリポジトリが取得できない。ユーザーが不足スコープに気づき、再認証できる仕組みが必要だった。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/index.ts` | 新規エンドポイント `GET /auth/github/reauthorize` を追加。既存の OAuth グラントを GitHub API で取り消し（`DELETE /applications/{client_id}/grant`）、認証クッキーを削除した上で `/auth/github` へリダイレクトする |
| `src/index.ts` | `/repositories` ハンドラで `getGitHubTokenScopes()` を呼び出し、トークンのスコープ情報を取得してビューに渡す |
| `src/views/repositories.ts` | スコープ不足時に黄色い警告バナー（`missing-scope-banner`）を表示。「権限を追加して再認証」ボタンから `/auth/github/reauthorize` へ遷移 |

### 関連コミット
- `3abcd07` feat: スコープ不足時の再認証フローとUIを追加

---

## 3. リポジトリ行タップで権限モーダルを表示

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
- `aec3ef4` feat: リポジトリ行タップで権限モーダルを表示
- `a0e5e49` feat: 設定ページのセクション名変更とモーダルにリポジトリ概要を表示

---

## 4. リポジトリページのアクセストークン取得改善

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/index.ts` | `/repositories` ハンドラのアクセストークン取得にフォールバックを追加: `userSession.githubAccessToken ?? user.github_access_token ?? undefined` |

### 関連コミット
- `7f5e9c4` fix: リポジトリページでJWTフォールバックのアクセストークンを使用

---

## 5. D1 データベース有効化と診断エンドポイント

### 背景
D1 データベースバインディングがコメントアウト状態で無効だった。有効化後の動作確認のため、診断エンドポイントも追加した。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `wrangler.toml` | `[[d1_databases]]` セクションのコメントを解除し、`database_id = "abbe590b-..."` を設定 |
| `package.json` | マイグレーションスクリプトを `wrangler d1 migrations apply` 方式に変更。全マイグレーションファイルを個別実行する `db:migrate:remote:manual` スクリプトを追加 |
| `src/index.ts` | 新規エンドポイント `GET /api/debug/d1`（認証必須）を追加。テーブル存在確認、カラム一覧、ユーザーレコード確認、テスト書き込み、レコード数カウントを実行 |

### 関連コミット
- `e5a4763` feat: D1データベースバインディングを有効化
- `89b99a3` fix: D1マイグレーションスクリプトを全ファイル対応に修正
- `2e424f2` feat: D1接続診断エンドポイント /api/debug/d1 を追加
- `c98a14d` debug: D1診断エンドポイントにテスト書き込みを追加

---

## 6. 設定ページの文言変更

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/views/settings.ts` | セクションタイトルを `"GitHub OAuth"` → `"このアプリに付与済みの権限"` に変更 |

### 関連コミット
- `a0e5e49` feat: 設定ページのセクション名変更とモーダルにリポジトリ概要を表示

---

## 7. ドキュメント整備

| ファイル | 変更概要 |
|---|---|
| `CLAUDE.md` | NOTICEファイル運用ルール（命名規則・記載対象・運用方針）を追加 |
| `README.md` | Install App フローのコールバック分岐に関する注意事項を追記 |
| `NOTICE.cloudflare-workers-github-oauth-1.20260316.md` | Install App 後にプライベートリポジトリを表示する手順を記載 |
| `HISTORY.cloudflare-workers-github-oauth-1.latest.md` | 3/14〜3/16 のコミット履歴を追記、全コミットに GitHub リンクを追加 |

### 関連コミット
- `3e6cfb7` docs: NOTICEファイル運用ルールをCLAUDE.mdに追加
- `f73b5fc` docs: Install Appフローのコールバック分岐について重要事項をREADMEに追記
- `9e95acb` docs: Install App後にプライベートリポジトリを表示する手順をNOTICEに記載
- `ae639c6` docs: NOTICEファイルのタイポ修正とIssue #32へのリンク追加
- `520639d` docs: HISTORYに3/14〜3/16のコミット履歴を追記し全コミットにGitHubリンクを追加

---

## 変更ファイル一覧（9ファイル）

| ファイル | 追加行 | 削除行 | 種別 |
|---|---|---|---|
| `src/index.ts` | +149 | -1 | 機能追加・修正 |
| `src/views/repositories.ts` | +286 | -1 | 機能追加（UI） |
| `src/views/settings.ts` | +1 | -1 | 文言変更 |
| `wrangler.toml` | +4 | -4 | 設定変更 |
| `package.json` | +3 | -2 | スクリプト変更 |
| `CLAUDE.md` | +26 | 0 | ドキュメント |
| `README.md` | +9 | 0 | ドキュメント |
| `NOTICE...20260316.md` | +25 | 0 | 新規ドキュメント |
| `HISTORY...latest.md` | +64 | -36 | ドキュメント更新 |
