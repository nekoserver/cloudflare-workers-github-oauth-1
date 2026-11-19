# EVAL: 公開鍵登録・チャレンジ署名ログイン（2026-11-19、opus-5.5）

評価日: 2026-11-19（UTC）
評価: opus-5.5（Claude Opus 5.5、Claude Code）
評価の基準: [`SPEC.cloudflare-workers-github-oauth-1.20260904.public-keys.md`](SPEC.cloudflare-workers-github-oauth-1.20260904.public-keys.md)（2026-11-19の改訂版、SHA256 `2aaf533926f18c539002cf4b2c2ef99271592a673ba8d8eb49d0beb7a15f95a1`）
評価対象: `origin/main`（[`c271b7ba`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c271b7ba)）
区分: [`SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md`](SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md)の手順1（既存の[`EVAL.cloudflare-workers-github-oauth-1.public-keys.md`](EVAL.cloudflare-workers-github-oauth-1.public-keys.md)にはモデル名が無い）

---

## 総合

**対象**: 1〜7節の仕組み。

すべて本書のとおり。本書の後に、`/auth/public-key/available`と登録後のカウントダウンが足された（10節）。

| 節 | 判定 | 根拠 |
|---|---|---|
| 2（鍵の生成・旧形式の移行） | 充足 | `src/views/publicKeys.ts`の`migrateLegacyKeyPairs` |
| 3（D1） | 未確認 | マイグレーションの中身までは見ていない |
| 4（登録・失効・有効期限） | 充足 | 選択肢（179〜184行）、`/api/public-keys/:id/revoke`、テスト |
| 5（チャレンジの検証、期限切れの鍵の除外） | 充足（テスト） | `src/publicKeyExpiry-20260903.test.ts`、`src/publicKeyAuth-20260903.test.ts` |
| 5.1（異常の記録と通知） | 充足（テスト） | `src/publicKeySecurityEvents-20260904.test.ts` |
| 6・7（確定処理、ログイン方式の記録） | 未確認 | 今回は読んでいない |

関係するテスト6ファイル56件が通過した。

---

## 確かめていないこと

**対象**: 範囲外。

- 実際のブラウザでの鍵の生成とログイン。
- 本番のD1の`public_key_security_events`の記録とSlackの通知。
