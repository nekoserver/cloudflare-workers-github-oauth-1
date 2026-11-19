# EVAL: AI問い合わせ・過去ログ応答・ai-cache・Jev評価（2026-11-19、opus-5.5）

評価日: 2026-11-19（UTC）
評価: opus-5.5（Claude Opus 5.5、Claude Code）
評価の基準: [`SPEC.cloudflare-workers-github-oauth-1.ai-jev.md`](SPEC.cloudflare-workers-github-oauth-1.ai-jev.md)（2026-11-19の改訂版、SHA256 `9d7e70199e3c4cfa7d73631a9d2d1b1c939339b1b8321acf0082993228d10fe7`）
評価対象: `origin/main`（[`c271b7ba`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c271b7ba)）の本体Worker側。dynamicneko側は対象外
区分: [`SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md`](SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md)の手順1（既存の[`EVAL.cloudflare-workers-github-oauth-1.ai-jev.md`](EVAL.cloudflare-workers-github-oauth-1.ai-jev.md)にはモデル名が無い）

---

## 総合

**対象**: 本体Worker側の2・3・5・6・8節と、11節の課題。

本体側のエンドポイントと`userToken`の分離（8節）は本書のとおり。11節の課題（Jev以外の`-external`は本文の`email`を信頼）は残っている。

| 節 | 判定 | 根拠 |
|---|---|---|
| 2・3（query・qsearch・model-colors） | 充足 | エンドポイントがある。`qsearch-external`・`model-colors-external`のテスト |
| 5（テーブル） | 充足 | 0144（[table-catalog-jevのEVAL](EVAL.cloudflare-workers-github-oauth-1.table-catalog-jev.opus-5.5.20261119.md)） |
| 6（jev-score・jev-stats） | 充足（テスト） | `jev-score-external-endpoint.test.ts`・`jev-stats-external-endpoint.test.ts` |
| 8（userToken） | 充足 | `resolveJevUserTokenEmail` |
| 11の課題 | 未解決 | `query-external`・`qsearch-external`・`permission-external`は本文の`email` |
| 4・7・10（dynamicneko） | 対象外 | — |

4ファイル49件が通過した。

---

## 提案（未実施）

**対象**: 次の作業。

1. 11節の課題（残り3本の`userToken`化）は、dynamicneko側の送信も同時に直す必要がある。`CLAUDE.md`ルール38（ワーカー間の認証は`CF-Worker`ヘッダー＋HMAC）と合わせて、別の作業として計画する。

---

## 確かめていないこと

**対象**: 範囲外。

- dynamicnekoの画面とプロキシ。
- 本番での呼び出し。
