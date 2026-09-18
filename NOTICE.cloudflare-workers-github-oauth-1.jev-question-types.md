# NOTICE: Jevの`question_type`3種類(noul / choice / score)の正しい理解

日付: 2026-09-19

**対象**: Jev(TypeSafe AI System One Model、`https://api.typesafe.ai/v1/systemone`)の
`question_type`。[`NOTICE.cloudflare-workers-github-oauth-1.Jev.20260917.md`](NOTICE.cloudflare-workers-github-oauth-1.Jev.20260917.md)
「D1のテーブル・列名は、実装着手前にユーザーへ一度提示して確定させる」節で
「Jevの公式語彙(`noul`/`choice`/`score`)」とだけ触れていたが、各型の意味・
使い分けまでは記録していなかった。本ドキュメントはユーザーから提示された
Jev公式Playground/CLI資料の内容をそのまま裏付けとして記録し、今後この
リポジトリでJevの質問設計をする際の一次情報として使う。

**注意**: 以下は外部サービス(Jev)の仕様そのものであり、このリポジトリの
テストで検証したものではない。`noul`/`choice`型は2026-09-19時点で
このコードベースでは未実装(後述「現状の実装との対応」参照)。

---

## 1. 3種類の定義

| question_type | どういう時に使うか | 何を判断させるか | 返ってくるもの | どう使うと効果的か | 例 |
|---|---|---|---|---|---|
| `noul` | Yes/Noで表せる条件を判定したい時 | 「この条件に該当するか」 | Yesである確率(0〜1) | 閾値を決めて、処理を通す/止める、レビューを要求するなどのゲート判定に使う | 「この変更は現在の作業ブランチの目的に合っているか？」 |
| `choice` | 複数の候補から1つを選ばせたい時 | 「どのカテゴリ・方針に該当するか」 | 選択された候補 + confidence(確率分布も取得可能) | ルーティング、分類、複数の対応方針からの選択に使う | 「この変更は current_branch / new_branch / main のどこで作業すべきか？」 |
| `score` | 程度・強さを連続的に評価したい時 | 「どの程度○○か」 | 順序付き尺度上のscore + confidence | リスク、重要度、緊急度、適合度など、Yes/Noでは情報を落としすぎる判断に使う | 「この変更と現在のブランチ目的の適合度はどの程度か？」 |

公式Playgroundでもこの3種類として定義されている。CLIでも
`jev noul`はYesの確率、`jev choice`は候補選択、`jev score`は順序付き
rubric上の位置を返す設計になっている。

## 2. `noul`と`score`は似ているようで目的が違う(混同注意)

- **`noul`は「条件成立の確率」**。例えば`0.82`は「82%くらい適合している」
  という意味では**ない**。「適合している、というYes側の確率が0.82」という
  意味である。separate confidenceは無く、**その確率自体が回答**(CLI資料の記述)
- **`score`は「程度」そのものを測る**。例えば
  `Unrelated → Weakly related → Related → Exact fit`
  のような順序付き基準(rubric)を与えて、「どの辺に位置するか」を判定させる

一行でまとめると:

```
noul = 条件判定 → choice = 分岐先決定 → score = 程度測定
```

## 3. 同じ「作業ブランチ判定」を3種類でやった場合の比較

| 型 | 質問 | 結果の意味 | その後の処理 |
|---|---|---|---|
| noul | 「この変更は現在のブランチで行うべきか？」 | 0.94 → かなりYes寄り | `>= 0.9`ならそのまま続行、など |
| choice | 「この変更をどこで行うべきか？」 | `new_branch` | 新規ブランチ作成へ分岐 |
| score | 「現在のブランチとの適合度は？」 | 「低い〜高い」の尺度上の位置 | 低ければ停止、中間なら確認、高ければ続行 |

用途の選び分け(このリポジトリで「Jevを作業ブランチの適正さ判断に割り込ませる」
場合を想定):

- 単純な実行ゲート(通す/止めるの2択で十分) → `noul`
- 不適切だった場合に「既存ブランチ継続 / 新規ブランチ / mainへ戻る」まで
  Jevに決めさせたい → `choice`
- ブランチとの関連性を数値的に扱い、閾値を細かく設けたい → `score`

Jevは同一リクエスト内の複数質問を独立して評価できるため、3つを組み合わせる
設計(例: まず`noul`でゲートし、Noだった場合のみ`choice`で行き先を決める)も可能。

## 4. 現状の実装との対応(このリポジトリの`jev_labels`テーブル)

`SPEC.cloudflare-workers-github-oauth-1.table-catalog-jev.md`・
`EVAL.cloudflare-workers-github-oauth-1.table-catalog-jev.md`で記録した通り、
`jev_labels.question_type`列は`TEXT`型で3種類すべてを許容する設計だが、
2026-09-19時点の実装・データは以下の通り**`score`型のみ**:

- `jev_labels`の初期20件はすべて`question_type='score'`(migration 0144)
- `src/utils/jevEvaluation.ts`の質問組み立て処理は`type: 'score'`を
  ハードコードしており、`noul`/`choice`を送信する経路は存在しない
- `noul`/`choice`という文字列はコードベース中に一切出現しない
  (テストコードも含め未実装)

`EVAL.cloudflare-workers-github-oauth-1.table-catalog-jev.md`2節で
「カラムの型自由度(`question_type TEXT`)だけ残り、実際に使われる値の
バリエーションは仕様として明文化されていない」と指摘していた点は、
本ドキュメントの1〜3節が明文化にあたる。

## 5. 今後`noul`/`choice`を実際に使う場合の注意点

- `src/utils/jevEvaluation.ts`の質問組み立て(`type: 'score'`固定)を、
  `jev_labels.question_type`列の値に応じて`noul`/`choice`/`score`を
  出し分けるよう拡張する必要がある
- `criteria`は`score`型固有のフィールドではなく、`options_json`列の使い方を
  型ごとに変える必要がある可能性がある(`noul`は条件文そのもの、`choice`は
  候補一覧、`score`は0側/1側の説明という具合に、型ごとにJevへ送るペイロード
  形状が異なるため)。実装前に`noul`/`choice`それぞれの最小構成リクエストを
  実機に1回投げて成功レスポンスを確認してから本実装に入ること
  (`NOTICE.cloudflare-workers-github-oauth-1.Jev.20260917.md`と同じ教訓)
- レスポンス側も型によって形が変わる可能性が高い(`score`は`answers[id].score`
  だが、`noul`は確率そのもの、`choice`は選択された候補+confidenceという
  異なる構造になると想定される)。`parseJevApiResponse`(`src/utils/jevEvaluation.ts`)
  は現状`score`/`value`/`probability`キーのフォールバック探索のみを持つため、
  `choice`型の「選択された候補」を扱うには別のパース経路が必要になる
