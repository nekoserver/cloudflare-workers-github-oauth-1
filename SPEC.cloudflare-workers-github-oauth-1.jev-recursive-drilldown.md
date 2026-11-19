# Jev再帰ドリルダウン仕様

改訂: 2026-11-19、opus-5.5（Claude Opus 5.5、Claude Code）。本文は変えず、要件の番号と今の状態（末尾）を足した
評価: [`EVAL.cloudflare-workers-github-oauth-1.jev-recursive-drilldown.opus-5.5.20261119.md`](EVAL.cloudflare-workers-github-oauth-1.jev-recursive-drilldown.opus-5.5.20261119.md)
定期的な見直し: このSPECは[`SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md`](SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md)の手順で、定期的に実情に合わせて改訂し、評価し直す

## 目的

Jevの評価を同じ質問セットで繰り返すのではなく、広い観点の評価結果が低かった
枝だけを次の問い合わせで詳しく調べる。全ての詳細質問を常に送る方式より呼び出す
質問数を抑えながら、「総合点が低い」から「何が原因か」まで到達できる。

例:

| 深さ | 質問 | 次へ進む条件 |
|---|---|---|
| 0 | 事実の正確さ | scoreが閾値以下 |
| 1 | 根拠の明示 / 情報の鮮度 | それぞれのscoreが閾値以下 |
| 2 | 一次情報への参照 / 更新日の明示 | 結果として記録して終了 |

Jevは質問文を生成するモデルではないため、子質問は呼び出し側が評価ツリーとして
事前に定義する。実行中にJev自身へ新しい質問を生成させる設計にはしない。

## 実装

`src/utils/jevRecursiveDrilldown.ts`の`runJevRecursiveDrilldown`は、ルート質問を
最初のラウンドで評価し、`value <= threshold`だったノードの`children`だけを
次のラウンドへ送る。Jev APIそのものは`evaluate`として注入するため、既存の
`callJevApi`にもテスト用のスタブにも接続できる。

主な既定値:

| 設定 | 既定値 | 役割 |
|---|---:|---|
| `threshold` | 0.6 | この値以下の枝を掘り下げる |
| `maxDepth` | 3 | 子質問を辿る最大深さ |
| `maxQuestions` | 20 | 1実行で評価する質問総数の上限 |

停止理由は`completed`、`max_depth`、`question_budget`の判別可能な値で返す。
途中でJevが失敗した場合は`jev_error`として、失敗前までの`findings`、失敗した
深さ、評価済み質問数を返す。これにより部分結果を失わず、画面やログで失敗を通知できる。

## 安全策

- 同じ質問IDがツリー内に複数あれば循環相当として問い合わせ前に拒否する
- 閾値は0〜1、深さは0以上の整数、質問上限は1以上の整数だけを許可する
- `maxQuestions`を超えるノードはJevへ送らない
- `maxDepth`に達した低スコア枝は未探索であることを停止理由に残す
- APIエラーを空の結果に置き換えず、それまでの評価結果と共に返す

## 接続例

```ts
const result = await runJevRecursiveDrilldown({
  state: answerText,
  roots: evaluationTree,
  evaluate: (state, labels) => callJevApi({ apiKey, state, labels, fetchImpl: fetch }),
});
```

現時点では再利用可能なコアまでを実装範囲とし、D1テーブルや外部APIエンドポイントは
追加しない。実際の画面へ接続する際は、評価ツリーを追記専用マスターとして保存し、
各所見に実行ID・親質問ID・深さを持たせれば、評価経路を後から再現できる。

## 要件の番号と2026-11-19の現状（改訂で追記）

**対象**: `src/utils/jevRecursiveDrilldown.ts`（[`5886b485`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5886b485)、2026-09-21から変更なし） — 本書の要件に番号を付け、今の実装と照らした結果。

| 番号 | 要件 | 状態 |
|---|---|---|
| REQ-JRD-1 | `value <= threshold`のノードの`children`だけを次のラウンドへ送る | 実装どおり |
| REQ-JRD-2 | 既定値は`threshold` 0.6、`maxDepth` 3、`maxQuestions` 20 | 実装どおり（60〜62行） |
| REQ-JRD-3 | 停止理由は`completed`・`max_depth`・`question_budget`。Jevの失敗は`jev_error`で、それまでの`findings`を返す | 実装どおり |
| REQ-JRD-4 | 同じ質問IDの重複、範囲外の設定は問い合わせの前に拒否する（`invalid_tree`・`invalid_config`） | 実装どおり |
| REQ-JRD-5 | D1のテーブルと外部のAPIは足さない（コアだけ） | そのまま。`runJevRecursiveDrilldown`を呼ぶ画面・APIは無い（`git grep`） |

## 改訂の記録

| 日付 | モデル | 箇所 | 内容 | 根拠 |
|---|---|---|---|---|
| 2026-11-19 | opus-5.5 | 冒頭・末尾 | 要件の番号と現状を追加。本文は変えていない | 実装の実読、`src/utils/jevRecursiveDrilldown.test.ts`の通過 |
