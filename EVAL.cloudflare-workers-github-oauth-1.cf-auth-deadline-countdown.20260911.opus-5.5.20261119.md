# EVAL: cf-authのログイン通知とカウントダウンの自動登録（2026-11-19、opus-5.5）

評価日: 2026-11-19（UTC）
評価: opus-5.5（Claude Opus 5.5、Claude Code）
評価の基準: [`SPEC.cloudflare-workers-github-oauth-1.cf-auth-deadline-countdown.20260911.md`](SPEC.cloudflare-workers-github-oauth-1.cf-auth-deadline-countdown.20260911.md)（2026-11-19の改訂版、SHA256 `f0ce62314ff2d400145d20d46e5b588469b0930dda9eff437582b4dcbc4f6a38`）
評価対象: `origin/main`（[`c271b7ba`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c271b7ba)）
区分: [`SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md`](SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md)の手順1（既存の[`EVAL.cloudflare-workers-github-oauth-1.cf-auth-deadline-countdown.20260928.md`](EVAL.cloudflare-workers-github-oauth-1.cf-auth-deadline-countdown.20260928.md)にはモデル名が無い）

---

## 総合

**対象**: 1〜5節。

2〜4節の変更は本書のとおり入っている。5節（緑のトーストの登録ボタン）は未解決のまま。

| 節 | 判定 | 根拠 |
|---|---|---|
| 1 | 該当なし（運用の件） | 失敗は`webhook_log`に残る |
| 2 | 充足 | `src/views/countdown.ts` |
| 3 | 充足（テスト） | `src/utils/countdown.test.ts`ほか（55件） |
| 4 | 充足 | `POST /api/countdown`に関門が無い |
| 5 | 未解決 | 記録なし |

---

## 提案（未実施）

**対象**: 次の作業。

1. 5節の件は、利用者から画面と操作の手順を聞くまで手を付けない（本書の申し送りのとおり）。解決しないままなら、件を閉じるかを利用者が決める。

---

## 確かめていないこと

**対象**: 範囲外。

- 本番のcf-authからのwebhookと、`webhook_log`の最近の記録。
