# EVAL: アプリ全体の仕様（2026-03-13版）（2026-11-19、opus-5.5）

評価日: 2026-11-19（UTC）
評価: opus-5.5（Claude Opus 5.5、Claude Code）
評価の基準: [`SPEC.cloudflare-workers-github-oauth-1.20260313.md`](SPEC.cloudflare-workers-github-oauth-1.20260313.md)（2026-11-19の改訂版、SHA256 `ca120b57e37703499d092b36c08a55d560a6b7b32a104fd6d438decb31be1d42`）
評価対象: `origin/main`（[`c271b7ba`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c271b7ba)）
区分: [`SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md`](SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md)の手順1（既存の[`EVAL.cloudflare-workers-github-oauth-1.20260313.md`](EVAL.cloudflare-workers-github-oauth-1.20260313.md)は差分（Resend webhook）の評価で、モデル名が無い）

---

## 総合

**対象**: 認証とセッションの中心の約束、一覧の節。

認証の中心（流れ、CSRFのstate、トークンの順番、セッションの有効期限）は今も本書のとおり。一覧の節（エンドポイント、シークレット）は当時の一部で、今の正ではない。食い違いが2つある: OAuthのscopeに`repo`が加わったこと、`[vars]`の`GITHUB_CLIENT_ID`が今は禁止であること。

| 項目 | 判定 |
|---|---|
| 認証フロー・CSRF・トークンの順番 | 一致 |
| セッション有効期限 | 一致 |
| OAuthスコープ | 食い違い（`repo`が加わった） |
| `[vars]`の`GITHUB_CLIENT_ID` | 食い違い（今は禁止） |
| エンドポイント・シークレットの一覧 | 古い（当時の一部） |
| Resend webhook（既存のEVALの対象） | 未確認（今回は見ていない） |

---

## 提案（未実施）

**対象**: 次の作業。

1. 本書の「GitHub OAuthスコープ」は、本書の最後の更新（2026-03-17）より前の2026-03-14に`repo`が加わっていたのに直されていなかった。理由は`SPEC.cloudflare-workers-github-oauth-1.20260316.md`の2節にあり、改訂の表からリンクした。追加の作業は無い。

---

## 確かめていないこと

**対象**: 範囲外。

- Resend webhook・Slack通知の節。
- 本番のWorkerの設定（secretの実際の一覧）。
