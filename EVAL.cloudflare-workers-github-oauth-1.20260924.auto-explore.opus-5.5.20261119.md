# EVAL: AIチャットの探索の境界線パネルと自動探索（2026-11-19、opus-5.5）

評価日: 2026-11-19（UTC）
評価: opus-5.5（Claude Opus 5.5、Claude Code）
評価の基準: [`SPEC.cloudflare-workers-github-oauth-1.20260924.auto-explore.md`](SPEC.cloudflare-workers-github-oauth-1.20260924.auto-explore.md)（2026-11-19の改訂版、SHA256 `943b2c7aee6c391a84218f7fd869ee7db8fc7ee81602533abeb7b1b6760051a6`）
評価対象: `origin/main`（[`c271b7ba`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c271b7ba)）
区分: [`SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md`](SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md)の手順1（既存の[`EVAL.cloudflare-workers-github-oauth-1.aichat-page.20260924.md`](EVAL.cloudflare-workers-github-oauth-1.aichat-page.20260924.md)・[`EVAL.cloudflare-workers-github-oauth-1.20261011.judgment-models-current-state.md`](EVAL.cloudflare-workers-github-oauth-1.20261011.judgment-models-current-state.md)がこのSPECを参照していた。どちらもモデル名が無い）

---

## 総合

**対象**: 2〜7節。

本書のとおり動く。4-4節の注意（自動探索の`source`が`api`に丸められる）は直っていない。

| 節 | 判定 | 根拠 |
|---|---|---|
| 2（UI） | 充足 | `src/views/aichat.ts`の要素、`aichat-boundary-panel-selection-20260923.test.ts` |
| 3（API） | 充足（テスト） | `keyword-boundary-endpoints.test.ts`（分類済みの除外、ほかのユーザーの分離、上限、DBのエラーの透過） |
| 4（クライアントの処理） | 充足（テスト） | `aichat-scissors-auto-vectorize-20260918.test.ts` |
| 4-4（`source`の区別） | 未解決（本書が注意として記録した点） | `src/index.ts`の7533行 |
| 6（テーブル） | 一致 | `aichat_auto_explore_history`は無い |

3ファイル49件が通過した。

---

## 提案（未実施）

**対象**: 次の作業。

1. `source: 'auto-explore'`を保存で区別するか（`aichatSourceStats.ts`の`AichatSourceKey`に足すか）を決める。区別しないなら、4-4節を「仕様」として書き直す。

---

## 確かめていないこと

**対象**: 範囲外。

- 実際のブラウザでの自動探索の実行。
