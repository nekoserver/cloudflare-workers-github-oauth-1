# PLAN.cloudflare-workers-github-oauth-1.20261011.judgment-models

## 判断特化型AI(Jev/Clef)の実運用方針

**対象**: Jevで運用中の全スコアリング機能(AIチャット回答評価・
コミット脆弱性診断・テスト充足度診断・国名キーワード評価・
テーブル設計判定)を、将来Clefへ切り替え可能にするための段階的な
実装計画。現状評価は
[`EVAL.cloudflare-workers-github-oauth-1.20261011.judgment-models-current-state.md`](EVAL.cloudflare-workers-github-oauth-1.20261011.judgment-models-current-state.md)、
比較の総論は
[`SPEC.cloudflare-workers-github-oauth-1.20261011.judgment-models-overview.md`](SPEC.cloudflare-workers-github-oauth-1.20261011.judgment-models-overview.md)
を参照。

**基本方針**: 既定の挙動は変えない(常にJevのまま)。Clefは
明示的にオプトインした場合だけ使う、段階的かつ検証優先の移行とする
(CLAUDE.mdルール37: 無断で挙動分岐スイッチを増やさない、ルール9:
テストファースト、ルール12: 推測ではなくデータで裏取り、を踏襲)。

**この計画はまだ承認を得ていない。** 以下の各ステップは、着手前に
必ずユーザーの合意を取ってから実装すること。特にステップ0(検証)を
経ずにステップ2(抽象化)・ステップ3(Cookie制御)へ進まない。

---

## ステップ0: Jev/Clefの出力比較検証(実装前の必須ステップ)

**目的**: SPEC4節で指摘した「スコアの数値的な意味論が同じか」を、
推測ではなく実データで確認する。

### 作業内容

1. 既存の`jev_labels`から数件(本番で実際に使われているラベル、
   特に境界値・判断が割れそうな`state`)を選ぶ
2. 同じ`state`・同じ質問文を、Jev(現行、`score`型・2要素criteria)と
   Clef(`score`型・2要素criteria、または`noul`型)の両方に投げる
3. 返ってきた数値を並べて比較する(`/clef-playground`・
   `/jev-playground`を使えば、コード変更なしで比較できる)
4. 以下を確認する:
   - 同じ`state`に対して、両モデルの判定結果(高い/低い)の傾向が一致するか
   - 数値のスケール(0〜1の分布)が近いか、系統的なズレがあるか
   - `noul`型で聞いた場合と`score`型(2段階)で聞いた場合で、Clef自身の
     結果が変わらないか(型の選び方自体の妥当性確認)

### 完了条件

- 最低5〜10件の実例比較結果を記録に残す(このPLANファイルへの追記、
  または新規の`EVAL.cloudflare-workers-github-oauth-1.<日付>.jev-clef-score-comparison.md`)
- 「そのまま置き換えて問題ない」「補正が必要」「型を変える必要がある」
  のいずれかの結論をユーザーに提示し、次ステップへ進む合意を得る

---

## ステップ1: 既存の技術的負債の解消(抽象化の前提整備)

**目的**: EVAL2.1節で指摘した`jev-score-external`の重複実装を解消し、
「`callJevApi`の呼び出し元は`jevScoreFlow.ts`・`queryPatternAnalysis.ts`・
`index.ts`の明示的な3箇所のみ」という状態に単純化してから抽象化に
着手する(重複が残ったまま抽象化すると、2箇所を同時に直し忘れるリスクが
増える)。

### 作業内容

- `POST /api/aichat/jev-score-external`のインラインロジックを
  `runJevScoreForShare()`呼び出しに差し替える
- 認可・login解決(dynamicneko向けuserToken検証)だけをこの
  エンドポイント固有の処理として残す
- 既存のテスト(`jev-score-external`系)が通ることを確認した上で、
  「本当に同じ挙動になっているか」を検証する新規テストを先に書く
  (ルール9)

---

## ステップ2: プロバイダ抽象化(Clef実装の追加、既定値はJevのまま)

**目的**: `callJevApi()`と同じ入出力形(`JevApiResult`、判別可能な
戻り値型)を保った新しい振り分け関数を導入し、呼び出し元の変更を
最小限にする。

### 設計方針

```ts
export type ScoringProvider = 'jev' | 'clef';

export type ScoreLabelsParams = {
  provider: ScoringProvider;
  state: string;
  labels: JevLabel[];
  // Jev用
  jevApiKey?: string;
  fetchImpl?: JevFetch;
  // Clef用
  ai?: ClefAiBinding;
  clefModel?: ClefPlaygroundModel;
};

export async function scoreLabels(params: ScoreLabelsParams): Promise<JevApiResult> {
  if (params.provider === 'clef') {
    return callClefScoreApi({ ai: params.ai!, state: params.state, labels: params.labels, model: params.clefModel });
  }
  return callJevApi({ apiKey: params.jevApiKey!, state: params.state, labels: params.labels, fetchImpl: params.fetchImpl! });
}
```

- `callClefScoreApi()`(新規)は、`JevLabel[]`(`question_text`+
  `criteria`)をClefの`questions`オブジェクト(`instructions`+
  `criteria`)へ変換し、`env.AI.run()`を呼び、レスポンスを既存の
  `JevApiResult`形式へ変換する。ステップ0で「`noul`型に変えるべき」と
  結論が出た場合は、2要素criteriaのラベルを`noul`型として送る変換も
  ここに実装する
- 既存の6箇所の呼び出し元は、`callJevApi(...)`を`scoreLabels({provider: 'jev', ...})`
  へ置き換えるだけで、**既定でJevを使う現状の挙動を一切変えない**
- `provider`を渡さなかった場合・不明な値の場合は必ず`'jev'`にフォール
  バックする(黙ってClefに切り替わることがないようにする)

### テスト方針

- `callClefScoreApi()`は`clefPlayground.test.ts`と同様、`ai.run`を
  モック化した単体テストで「正しい`questions`形式に変換できているか」
  「レスポンスを正しく`JevApiResult`へ変換できているか」を検証する
- 既存の6箇所の呼び出し元のテストは、`provider`を明示していない場合に
  挙動が変わっていないことを確認する回帰テストとして残す

---

## ステップ3: Cookie(またはD1ユーザー設定)によるプロバイダ制御

**目的**: ステップ2で導入した`provider`を、CLAUDE.mdルール27の
解決順(D1優先→Cookie→デフォルト)に従って実際の値に解決する。

### 設計方針

```ts
// resolveSessionDuration等と同じパターン
async function resolveScoringProvider(db: D1Database, userId: string, cookieHeader: string | null): Promise<ScoringProvider> {
  // 1. D1のユーザー設定(将来、設定ページでの切り替えUIを作る場合に備える)
  // 2. Cookie(例: scoring_provider=clef)
  // 3. デフォルト: 'jev'(現状維持)
}
```

- 既定値は常に`'jev'`。Cookieが無い・不正な値・D1未設定の場合は全て
  `'jev'`にフォールバックする(安全側デフォルト)
- Cookieの切り替えUIは、まず`/cf-dashboard`等の管理者向けページに
  小さなトグルとして置くことを想定する(一般ユーザー向けの`/aichat`に
  いきなり出す必要は無い。検証目的のA/B切り替えとして位置づける)
- この設定スイッチの追加自体、CLAUDE.mdルール37に該当するため、
  着手前に「この切り替えのためにこういう設定を追加したいが良いか」を
  改めてユーザーに確認すること(本PLANの存在をもって事前承認済みとは
  見なさない)

---

## ステップ4: 限定的な本番導入(段階的ロールアウト)

**目的**: ステップ0〜3が完了し、Clefでの判定結果がJevと同等以上と
判断できた機能から、ユーザーの判断で個別に本番導入する。

### 優先順位の考え方

- **低リスクから始める**: 既存データとの整合性が問題になりにくい機能
  (例: 新規ラベルのみ・まだ本番データが少ない機能)を先に対象にする
- **AIチャット回答評価(`jev_evaluations`)は最後にする**: 既に最も
  本番で使われており、既存データとの数値的な整合性要求が最も高い
  (ルール27的に言えば「最も壊すと影響が大きい」設定)
- 各機能を切り替える際は、切り替え前後でしばらく両方の結果を記録し、
  ズレが無いかを監視する期間を設ける(具体的な監視方法・期間は
  ステップ0の検証結果を見てから決める)

---

## 非対象として明示するもの

- `/jev-playground`・`/jev-playground-external`(生パススルー経路)は
  このPLANの対象外とする。既にClef側の対(`/clef-playground`・
  `/clef-playground-external`)が独立して存在しており、ユーザーが
  Playground上で両方を自由に試せる状態で十分目的を達成しているため、
  無理に1つの抽象化へ統合する必要は無い(EVAL1.4節)
