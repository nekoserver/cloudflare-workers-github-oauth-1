# EVAL: GitHub App連携・権限モーダル・Slack通知（2026-03-16版）（2026-11-19、opus-5.5）

評価日: 2026-11-19（UTC）
評価: opus-5.5（Claude Opus 5.5、Claude Code）
評価の基準: [`SPEC.cloudflare-workers-github-oauth-1.20260316.md`](SPEC.cloudflare-workers-github-oauth-1.20260316.md)（2026-11-19の改訂版、SHA256 `9cef138b8217fb27fb81706b1339c558a96b09a6d03c418ed55952d42d6bdfb7`）
評価対象: `origin/main`（[`c271b7ba`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c271b7ba)）
区分: [`SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md`](SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md)の手順1（既存の[`EVAL.cloudflare-workers-github-oauth-1.20260316.md`](EVAL.cloudflare-workers-github-oauth-1.20260316.md)にはモデル名が無い）

---

## 総合

**対象**: 1〜13節のエンドポイント・テーブル・文書の有無。

ほとんどが今もある。違いは2つ: 1節の`GET /github/callback`が無い（コールバックは`/auth/github/callback`）、13節の`API...latest.md`が日付付きの`API...20260924.md`に置き換わった。各節の振る舞い（権限モーダル、Slackのセキュリティ通知、Zanzibarの表示）は、今回はテストで確かめていない。

| 項目 | 判定 |
|---|---|
| 2・4・5・8節のエンドポイント、`installation_permissions` | 存在する |
| 1節の`/github/callback` | 無い（`/auth/github/callback`） |
| 13節のAPIリファレンス | 置き換え（20260924版） |
| 3・9〜12節の振る舞い | 未確認 |

---

## 確かめていないこと

**対象**: 範囲外。

- 各節の振る舞いのテスト。本番のGitHub Appのwebhook。
