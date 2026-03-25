# SPEC: cloudflare-workers-github-oauth-1 修正箇所一覧（2026-03-25）

本ドキュメントは 2026-03-25 に `cloudflare-workers-github-oauth-1` リポジトリに加えられた修正・追加の仕様をまとめたものである。

---

## 1. 崩れない罫線（区切り線・表罫線）ルールの明文化

**対象**: [`CLAUDE.md`](CLAUDE.md) の「崩れない罫線（区切り線・表罫線）の書き方」セクション — Markdown/チャットUIで罫線が崩れやすい問題を避けるため、区切り線は水平線（`---`）を使い、表は Markdown テーブル優先・ASCII罫線表は ` ```text ` の code block 内で ASCII のみ使用する、という運用ルールを明文化する。

### 背景
等幅フォントにならない環境や自動折り返し、Unicode 罫線の表示差により、見た目の罫線（区切り線・表罫線）が崩れて可読性が落ちることがある。環境差に左右されにくい記法へ統一するため、書き方のルールと例を `CLAUDE.md` に追記した。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `CLAUDE.md` | 区切り線は `---` を単独行で使用、表は Markdown テーブル優先、ASCII罫線表は ` ```text ` に入れて ASCII のみ使用、というルールと例を追記 |

### 関連コミット
- [`2cbcea8`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/2cbcea84cee962a830adbc99465095e0a6892f8d) docs: add stable line/table rules

