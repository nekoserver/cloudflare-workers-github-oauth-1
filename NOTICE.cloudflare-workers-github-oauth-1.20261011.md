# NOTICE.cloudflare-workers-github-oauth-1.20261011

## Clef(Cloudflare Workers AI決定モデル)Playground実装で得た知見

**対象**: `/clef-playground`(`src/views/clefPlayground.ts`)・
`POST /api/clef-playground`・`POST /api/clef-playground-external`
(`src/index.ts`)・`callClefPlaygroundModel`(`src/utils/clefPlayground.ts`)。
dynamicneko側の`/clef-pg-react`(`src/components/clef-playground-page.tsx`)も
同じ知見が当てはまる。

### 1. 質問テキストのフィールド名は`question`ではなく`instructions`

Jev(`api.typesafe.ai`)は質問オブジェクトに`question`フィールドを使うが、
Clefの公式スキーマには`question`という名前のフィールド自体が存在しない。
`type: noul/choice/score`のいずれでも、質問テキストは**`instructions`**
フィールドで渡す必要がある(noul/choice/score共通で必須)。

「ClefはJev互換を公式に名乗っている」という説明文を信用して、既存の
Jev Playground用テンプレート(`question`フィールド使用)をそのまま流用した
ことが原因の不具合だった。**「互換」は質問の種類(noul/choice/score)や
全体の形(state+questions)のレベルの話であり、フィールド名まで同一とは
限らない**という教訓。

### 2. 実際に返ってきたエラー文言が「原因を正確に指していない」ことがある

`question`フィールドを使った場合に実際に返ってきたエラーは以下だった。

```text
5006: Error: required properties at '/' are 'model,state,questions'
```

このエラー文言は「ルート直下にmodel/state/questionsが無い」と読めるが、
実際にはこの3つは送信していた。真の原因は、`questions`オブジェクト内の
`oneOf`判定(noul/choice/score)がどの分岐にも一致しなかった(必須の
`instructions`が無く、未知の`question`があった)ため、バリデータが
フォールバックでルート直下の必須プロパティ不足として報告していたこと
だった。**JSON Schemaの`oneOf`は、どの分岐にも一致しない場合に不可解な
(ネストした本当の原因を指さない)エラーメッセージを返すことがある**。
表面的なエラー文言をそのまま信じて「ルートに何か足りないのでは」と
対症療法的に直そうとすると、無関係な修正を繰り返すことになる
(実際、本セッションでも一度このエラーに引っかかり、まず
「デプロイが古いのでは」という誤った仮説を先に検討した)。

### 3. `input.model`は短い名前(`clef`/`clef-flash`)が必須、`ai.run()`の第一引数は完全なID

```ts
await env.AI.run('@cf/cloudflare/clef-flash', {
  model: 'clef-flash', // 短い名前。完全なIDを渡すと正規表現
                        // ^\s*(clef|clef-flash)\s*$ で拒否される
  state: '...',
  questions: { ... },
});
```

`ai.run()`の第一引数(Workers AIバインディングのモデル選択)と、
`input.model`(Clef自身のリクエストスキーマが要求するフィールド)は
別物で、前者は完全なカタログID、後者は短い名前という非対称な仕様。

### 4. デプロイ済みコードが最新かどうかを安易に疑うと、ユーザーの時間を奪う

本セッションでは、ユーザーから「最新をマージした結果をビルドしているから
デプロイは疑う余地なし」と明確に指摘されるまで、「デプロイが古いのでは」
という仮説を提示してしまった。根拠は「このエラー文言は過去にこのコード
ベースで実際に修正したことがある文言と完全一致する」という一見合理的な
推論だったが、**実際の原因は全く別(フィールド名の誤り)で、しかもその
誤りが「ルート直下の必須プロパティ不足」という紛らわしいエラー文言に
化けていたこと**に起因していた。デプロイ起因かどうかを主張する前に、
コードの静的トレースだけで「このコードではこのエラーは原理的に出ない」
とまで言い切れるかを確認し、言い切れないなら仮説として提示するに留め、
断定しないこと(CLAUDE.mdルール12関連)。

### 5. 外部ドキュメント参照先: `developers.cloudflare.com`等は本セッション環境からブロックされるが、`raw.githubusercontent.com`は通る

このClaude Codeクラウド実行環境のエグレスプロキシは、
`developers.cloudflare.com`・`huggingface.co`・`unpkg.com`・
`cdn.jsdelivr.net`等への接続を403(組織ポリシー)で拒否する。一方で
`raw.githubusercontent.com`は許可されている。

Cloudflareの公式モデルスキーマ(Workers AIの各モデルの入出力JSON Schema)は、
`cloudflare/cloudflare-docs`リポジトリに生データとして置かれている
(`src/content/workers-ai-models/<model-id>.json`)。developers.cloudflare.com
のモデル詳細ページが見られない場合でも、以下の形でraw取得できる。

```bash
curl -sS "https://raw.githubusercontent.com/cloudflare/cloudflare-docs/production/src/content/workers-ai-models/clef-flash.json"
```

このJSONの`schema.input`/`schema.output`が、WebSearchや外部ブログ記事の
要約よりも信頼できる一次情報だった(ブログ記事は`question`フィールドの
誤記をそのまま引用していた可能性があり、実際に本セッションのWebSearch
結果だけでは正しいフィールド名を特定できなかった)。

**今後、Workers AIの新しいモデル(またはモデルの仕様変更)を調査する際は、
developers.cloudflare.comへの直接アクセスがブロックされていても、
この`cloudflare/cloudflare-docs`リポジトリのrawファイルを先に試すこと。**

### 6. Clefの`questions`スキーマの正確な仕様(2026-10-11時点、`clef-flash`で確認)

```text
questions: {
  <質問ID>: {
    type: "noul" | "choice" | "score",
    instructions: <必須。質問文(文字列、またはオブジェクト/配列)>,
    criteria: <nounは任意、choice/scoreは必須>
      // noul:   { true?: 何がyesか, false?: 何がnoか }
      // choice: { <オプションID>: <説明>, ... } (2〜255件)
      // score:  [<最低レベルの説明>, ..., <最高レベルの説明>] (2〜10件、順序付き配列)
  }
}
```

1リクエストにつき1〜64件の質問を同時に送れる。レスポンスは
`{model, answers: {<質問ID>: {...}}, usage}`で、`answers[id].type`に
応じて`noul`(0〜1の確率)・`choice`(選択結果+probabilities+confidence)・
`score`(確率加重値+legend+probabilities+confidence)のいずれかのフィールドを
持つ。

---

## 関連コミット

| コミット | 内容 |
|---|---|
| [`15b23b7`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/15b23b7) | noulタイプの質問から`instructions`(当時は誤って「質問テキスト」ではなく「ガイダンス文」の意味で使われていた旧フィールド)を除去(誤った仮説に基づく修正、知見2で後に判明) |
| [`b0d8ab8`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b0d8ab8) | 質問テキストを`question`から`instructions`へ修正(本当の原因への対処) |
| [`866a68f`](https://github.com/nekoserver/dynamicneko/commit/866a68f) | dynamicneko側(`/clef-pg-react`)に同じ修正を反映 |
