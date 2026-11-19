# EVAL: 判断特化型AI（Jev・Clef）の総論（2026-11-19、opus-5.5）

評価日: 2026-11-19（UTC）
評価: opus-5.5（Claude Opus 5.5、Claude Code）
評価の基準: [`SPEC.cloudflare-workers-github-oauth-1.20261011.judgment-models-overview.md`](SPEC.cloudflare-workers-github-oauth-1.20261011.judgment-models-overview.md)（2026-11-19の改訂版、SHA256 `7a1b2dff9b715ede61dd58797bfbdb41898c2a3eaf3e2718bf663d80cd24b7b1`）
評価対象: `origin/main`（[`c271b7ba`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c271b7ba)）のJev・Clefの呼び出し
区分: [`SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md`](SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md)の手順1（既存の[`EVAL.cloudflare-workers-github-oauth-1.20261011.judgment-models-current-state.md`](EVAL.cloudflare-workers-github-oauth-1.20261011.judgment-models-current-state.md)は呼び出し箇所の一覧で、モデル名が無い）

---

## 総合

**対象**: 比較の記述が今のコードと合っているか。

比較そのもの（入出力の形、搬送路、質問の型、スキーマの厳密さ）は、`clefScoreApi.ts`の注記と一致する。古かったのは「Clefは本番の判定フローに未使用」の1点で、10-11からAIチャットの任意の評価ボタンで使われている。既存のJevの判定は置き換えられていない。4節の未検証の論点は未検証のまま。

| 記述 | 判定 |
|---|---|
| 1節（共通の設計思想） | 一致（`clefScoreApi.ts`が`parseJevApiResponse`を再利用） |
| 2節の比較表 | 一致（「既存実績」の行だけ古い。5節で読み替え） |
| 3節（優位点） | 評価の対象外（判断の記述） |
| 4節（未検証） | 未検証のまま |

---

## 根拠

**対象**: 確かめたこと。

- `src/utils/clefScoreApi.ts`の注記: 質問は`instructions`で渡す、`criteria`はJevと同じ並び、`input.model`は短い名前。SPECの表の「スキーマの厳密さ」と一致。
- `npx vitest run src/utils/clefScoreApi.test.ts src/utils/clefPlayground.test.ts`が18件通過。
- 呼び出し箇所: Clefは`src/utils/clefPlayground.ts`・`src/utils/clefScoreApi.ts`・`src/index.ts`（`/api/clef-playground`・`/api/clef-playground-external`・`/api/aichat/clef-score`）。Jevは`src/utils/jevEvaluation.ts`ほか。

---

## 提案（未実施）

**対象**: 次の作業。

1. `/api/aichat/clef-score`で溜まった評価と、同じラベルのJevの評価を比べ、4節の「スコアの意味論が同じか」を実データで確かめる（本番のD1の読み取りが要る）。

---

## 確かめていないこと

**対象**: 範囲外。

- 本番のD1にあるClefの評価の件数と、Jevとの比較。
- `src/utils/clefScoreFlow.test.ts`（今回は走らせていない）。
